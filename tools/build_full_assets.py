"""Resumable, selective conversion of the authoritative delivered museum ZIP.

No source binary is extracted to a temporary directory. Tiles are read from ZIP,
assembled in memory and atomically written as optimized WebP visitor assets.
Requires Pillow and requests. On a Google Drive virtual disk, use:
python tools/build_full_assets.py --phase all --workers 1 --prefer-http
Panorama-only conversion can safely use --workers 2 for faster throughput.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import escape, unescape
from html.parser import HTMLParser
from io import BytesIO
import json
import gc
import math
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import shutil
import struct
import sys
import threading
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
import zlib

from PIL import Image, ImageOps
import requests

sys.stdout.reconfigure(encoding="utf-8")
PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT / ".cache/full-source"
OUT = PROJECT / "public/media/full"
PREFIX = "/media/full/"
FACES = ("f", "b", "l", "r", "u", "d")
IMAGE_RE = re.compile(r"\.(?:png|jpe?g|gif|bmp|webp)$", re.I)
RESOURCE_RE = re.compile(r"(?:%(?:FIRSTXML|VIEWER|CURRENTXML)%/)?(?:\.?\.?/)*[\w\-+%()\u0080-\uffff][\w\-+%()\u0080-\uffff/ .]*?\.(?:png|jpe?g|gif|bmp|webp|mp4|mp3|wav|ogg|webm|css|woff2?|ttf|svg|pdf)(?=[\s\"'<>;,)\]?]|$)", re.I)
ALIASES = {"images/sector_a1_03a.png": "img/sector_a1_03a.png"}
# These four visitor-facing frames are absent from the delivered ZIP. Their
# exact originals were verified on the public museum, 2026-10-04 (HTTP 200).
LIVE_RECOVERY = {f"ovr/02/{n}.png" for n in (2, 10, 24, 28)}
LOCK = threading.Lock()


class IndexedArchive:
    """Cache central-directory metadata, while streaming only requested entries.

    Google Drive can temporarily refuse even a tiny ZIP-tail read when its local
    cache is under pressure. A stat-validated local index removes that dependency
    from resumed HTTP-verified conversions. The cached index contains metadata
    only; entry bytes still come from the authoritative ZIP or verified HTTP.
    """
    def __init__(self, path: Path):
        self.filename = str(path)
        stat = path.stat()
        identity = {"archive": str(path), "bytes": stat.st_size, "mtime": stat.st_mtime_ns}
        cache = PROJECT / ".cache/full-zip-catalog.json"
        saved = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else {}
        if saved.get("identity") != identity:
            with zipfile.ZipFile(path) as archive:
                entries = [{"filename": i.filename, "file_size": i.file_size, "compress_size": i.compress_size,
                            "compress_type": i.compress_type, "header_offset": i.header_offset,
                            "flag_bits": i.flag_bits, "CRC": i.CRC} for i in archive.infolist() if not i.is_dir()]
            saved = {"identity": identity, "entries": entries}
            temporary = cache.with_suffix(".json.part")
            temporary.write_text(json.dumps(saved, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            temporary.replace(cache)
        self.infos = []
        for values in saved["entries"]:
            info = zipfile.ZipInfo(values["filename"])
            for key, value in values.items():
                setattr(info, key, value)
            self.infos.append(info)
        self.file = path.open("rb")
        self.lock = threading.Lock()

    def infolist(self):
        return self.infos

    def read(self, entry):
        with self.lock:
            self.file.seek(entry.header_offset)
            header = self.file.read(30)
            if len(header) != 30 or header[:4] != b"PK\x03\x04":
                raise ValueError(f"Invalid local ZIP header: {entry.filename}")
            fields = struct.unpack("<4s5H3I2H", header)
            self.file.seek(fields[9] + fields[10], 1)
            compressed = self.file.read(entry.compress_size)
        if entry.flag_bits & 1:
            raise ValueError("Encrypted ZIP entries are outside the visitor asset scope")
        if entry.compress_type == zipfile.ZIP_DEFLATED:
            raw = zlib.decompress(compressed, -15)
        elif entry.compress_type == zipfile.ZIP_STORED:
            raw = compressed
        else:
            raise ValueError(f"Unsupported ZIP compression {entry.compress_type}")
        if len(raw) != entry.file_size or zlib.crc32(raw) != entry.CRC:
            raise ValueError(f"ZIP entry checksum mismatch: {entry.filename}")
        return raw


def xml(path: Path) -> ET.Element:
    text = re.sub(r"<!--.*?-->", "", path.read_text(encoding="utf-8-sig"), flags=re.S)
    return ET.fromstring(text)


def decode_name(name: str) -> str:
    try:
        return name.encode("cp437").decode("cp949")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name


def clean_path(value: str, context: str = "") -> str | None:
    value = unescape(value).strip().replace("\\", "/")
    if value.startswith(PREFIX):
        value = value[len(PREFIX):]
        if re.search(r"\.(png|jpe?g|gif|bmp)\.webp$", value, re.I):
            value = value[:-5]
        return value
    if re.match(r"(?:https?:|data:|javascript:|mailto:|tel:|#|//)", value, re.I):
        # Localize absolute URLs pointing to the original museum only.
        parsed = urllib.parse.urlparse(value)
        if parsed.hostname and parsed.hostname.lower() in {"youngnakdhm.net", "www.youngnakdhm.net"}:
            value = parsed.path.lstrip("/")
        else:
            return None
    absolute = bool(re.match(r"%(?:FIRSTXML|VIEWER)%", value, re.I)) or value.startswith("/")
    value = re.sub(r"%(?:FIRSTXML|VIEWER|CURRENTXML)%/?", "", value, flags=re.I)
    value = urllib.parse.unquote(value.split("?", 1)[0].split("#", 1)[0])
    value = posixpath.normpath(posixpath.join("" if absolute else context, value.lstrip("/")))
    if value.startswith("../") or value == "..":
        return None
    return value


def output_path(path: str) -> str:
    return path + (".webp" if IMAGE_RE.search(path) and not path.lower().endswith(".webp") else "")


def tile_url(pattern: str, level: int, row: int, col: int, face: str = "f", stereo: str = "1") -> str:
    return (pattern.replace("%0v", f"{row:02d}").replace("%0h", f"{col:02d}")
            .replace("%l", str(level)).replace("%v", str(row)).replace("%h", str(col))
            .replace("%s", face).replace("%t", stereo))


class Builder:
    def __init__(self, archive: Path, workers: int, prefer_http: bool = False):
        OUT.mkdir(parents=True, exist_ok=True)
        self.archive = IndexedArchive(archive)
        self.entries = {}
        for entry in self.archive.infolist():
            if not entry.is_dir():
                self.entries[decode_name(entry.filename).replace("\\", "/")] = entry
        self.casefold = {p.casefold(): p for p in self.entries}
        self.workers = workers
        self.prefer_http = prefer_http
        self.http = threading.local()
        self.http_verified = 0
        self.cache_verified = 0
        self.zip_reads = 0
        self.records = {}
        manifest = OUT / "asset-manifest.json"
        if manifest.exists():
            self.records = json.loads(manifest.read_text(encoding="utf-8")).get("files", {})
        self.errors = []
        self.missing = set()
        self.requested = set()
        self.article_paths = set()
        compiled = PROJECT / "src/data/full-museum.json"
        self.active_galleries = {g["id"] for g in json.loads(compiled.read_text(encoding="utf-8"))["galleries"]} if compiled.exists() else None
        self.started = time.time()

    def resolve(self, path: str) -> str:
        path = ALIASES.get(path, path)
        if path in self.entries:
            return path
        return self.casefold.get(path.casefold(), path)

    def read(self, path: str) -> bytes:
        path = self.resolve(path)
        if path in LIVE_RECOVERY and path not in self.entries:
            return self.download(path)
        entry = self.entries[path]
        cached = SOURCE / path
        if cached.is_file() and cached.stat().st_size == entry.file_size:
            raw = cached.read_bytes()
            if zlib.crc32(raw) == entry.CRC:
                with LOCK:
                    self.cache_verified += 1
                return raw
        if self.prefer_http:
            try:
                raw = self.download(path)
                if len(raw) == entry.file_size and zlib.crc32(raw) == entry.CRC:
                    with LOCK:
                        self.http_verified += 1
                    return raw
            except (requests.RequestException, OSError):
                pass
        with LOCK:
            self.zip_reads += 1
        if shutil.disk_usage(self.archive.filename).free < 550 * 1024 * 1024:
            raise RuntimeError("Source Drive cache needs at least 550 MiB free; this asset remains pending for resume")
        return self.archive.read(self.entries[path])

    def download(self, path: str) -> bytes:
        if not hasattr(self.http, "session"):
            self.http.session = requests.Session()
        response = self.http.session.get("http://youngnakdhm.net/" + urllib.parse.quote(path), timeout=(10, 45))
        response.raise_for_status()
        return response.content

    def save_manifest(self):
        with LOCK:
            data = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    "archive": str(self.archive.filename), "files": self.records,
                    "reads": {"httpVerifiedAgainstZipCRC": self.http_verified, "textCacheVerifiedAgainstZipCRC": self.cache_verified, "zip": self.zip_reads},
                    "missingSources": sorted(self.missing), "errors": self.errors,
                    "counts": {"files": len(self.records), "bytes": sum(x["bytes"] for x in self.records.values())}}
            tmp = OUT / "asset-manifest.json.part"
            tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            tmp.replace(OUT / "asset-manifest.json")

    def record(self, destination: str, source: str, kind: str, dimensions=None):
        path = OUT / destination
        record = {"source": source, "kind": kind, "bytes": path.stat().st_size}
        if kind == "source-image":
            record["profile"] = 2
        if dimensions:
            record["dimensions"] = list(dimensions)
        with LOCK:
            self.records[destination] = record

    def write(self, destination: str, data: bytes, source: str, kind: str, dimensions=None):
        if shutil.disk_usage(OUT).free < len(data) + 300 * 1024 * 1024:
            raise RuntimeError("Stopped before disk exhaustion: less than 300 MiB reserve")
        target = OUT / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + ".part")
        temporary.write_bytes(data)
        temporary.replace(target)
        self.record(destination, source, kind, dimensions)

    def webp(self, image: Image.Image, destination: str, source: str, kind: str, quality=90):
        if (OUT / destination).exists() and not (kind == "source-image" and self.records.get(destination, {}).get("profile") != 2):
            self.record(destination, source, kind, image.size)
            return
        buffer = BytesIO()
        image.save(buffer, "WEBP", quality=quality, method=4)
        self.write(destination, buffer.getvalue(), source, kind, image.size)

    def assemble(self, pattern: str, tile_size: int, level: int, width: int, height: int,
                 face: str = "f", stereo: str = "1") -> Image.Image:
        canvas = Image.new("RGB", (width, height))
        for row in range(math.ceil(height / tile_size)):
            for col in range(math.ceil(width / tile_size)):
                path = tile_url(pattern, level, row + 1, col + 1, face, stereo)
                with Image.open(BytesIO(self.read(path))) as tile:
                    expected = (min(tile_size, width - col * tile_size), min(tile_size, height - row * tile_size))
                    if tile.size != expected:
                        raise ValueError(f"Unexpected tile size {path}: {tile.size} != {expected}")
                    canvas.paste(tile, (col * tile_size, row * tile_size))
        return canvas

    def run_tasks(self, tasks, function, label):
        print(f"{label}: {len(tasks)} jobs, {self.workers} workers", flush=True)
        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = {pool.submit(function, task): task for task in tasks}
            for count, future in enumerate(as_completed(futures), 1):
                try:
                    name = future.result()
                    print(f"{label} {count}/{len(tasks)}: {name}", flush=True)
                except Exception as exc:
                    problem = f"{label}: {str(futures[future])[:160]}: {type(exc).__name__}: {exc}"
                    self.errors.append(problem)
                    print("ERROR " + problem, flush=True)
                if count % 10 == 0:
                    self.save_manifest()
        self.save_manifest()

    def panorama(self, task):
        scene, source = task
        key = scene.get("name").lower()
        cube = scene.find("image/cube")
        sizes = [int(x) for x in cube.get("multires").split(",")]
        tile_size, levels = sizes[0], sizes[1:]
        adequate = [(size, level) for level, size in enumerate(levels, 1) if size >= 2048]
        size, level = min(adequate) if adequate else (levels[-1], len(levels))
        for face in FACES:
            root = f"panos/{key}/{face}"
            destinations = [f"{root}/base.webp"] + [f"{root}/2/{r}_{c}.webp" for r in range(4) for c in range(4)]
            if all((OUT / p).exists() for p in destinations):
                for p in destinations:
                    self.record(p, source + "#" + key, "panorama", (512, 512))
                continue
            image = self.assemble(cube.get("url"), tile_size, level, size, size, face)
            if image.size != (2048, 2048):
                image = image.resize((2048, 2048), Image.Resampling.LANCZOS)
            self.webp(image.resize((512, 512), Image.Resampling.LANCZOS), destinations[0], source + "#" + key, "panorama-base")
            for row in range(4):
                for col in range(4):
                    tile = image.crop((col * 512, row * 512, (col + 1) * 512, (row + 1) * 512))
                    self.webp(tile, f"{root}/2/{row}_{col}.webp", source + "#" + key, "panorama-tile")
        return key

    def panoramas(self):
        tasks = [(s, source) for source in ("tour.xml", "outside.xml") for s in xml(SOURCE / source).findall("scene")]
        priority = ["scene_vr02", "scene_f-c-0", "scene_a-s-w-1+", "scene_f-c-e+1", "scene_f-c-w-1"]
        tasks.sort(key=lambda task: priority.index(task[0].get("name").lower()) if task[0].get("name").lower() in priority else len(priority))
        self.run_tasks(tasks, self.panorama, "Panorama")

    def gallery(self, task):
        group, index, scene, context = task
        target = f"galleries/{group}/{index}.webp"
        flat = scene.find("image/flat")
        if flat is not None:
            values = flat.get("multires").split(",")
            width, height = map(int, values[-1].split("x"))
            if (OUT / target).exists():
                self.record(target, f"{context}/tour.xml#{scene.get('name')}", "gallery-flat")
                return f"{group}/{index}"
            image = self.assemble(context + "/" + flat.get("url"), int(values[0]), len(values) - 1, width, height)
            image.thumbnail((3840, 3840), Image.Resampling.LANCZOS)
            self.webp(image, target, f"{context}/tour.xml#{scene.get('name')}", "gallery-flat", quality=86)
        else:
            cube = scene.find("image/cube")
            values = [int(v) for v in cube.get("multires").split(",")]
            for face in FACES:
                image = self.assemble(context + "/" + cube.get("url"), values[0], len(values) - 1, values[-1], values[-1], face)
                self.webp(image, f"galleries/{group}/{index}-{face}.webp", f"{context}/tour.xml#{scene.get('name')}", "gallery-cube")
                if face == "f":
                    self.webp(image, target, f"{context}/tour.xml#{scene.get('name')}", "gallery-cube-front")
        return f"{group}/{index}"

    def galleries(self):
        files = sorted((SOURCE / "photo").glob("*/tour.xml")) + [SOURCE / "info/tour.xml"]
        compiled = PROJECT / "src/data/full-museum.json"
        active = {g["id"] for g in json.loads(compiled.read_text(encoding="utf-8"))["galleries"]} if compiled.exists() else None
        tasks = []
        for path in files:
            context = path.parent.relative_to(SOURCE).as_posix()
            group = "help" if context == "info" else path.parent.name
            if active is not None and group not in active:
                continue
            tasks.extend((group, index, scene, context) for index, scene in enumerate(xml(path).findall("scene")))
        self.run_tasks(tasks, self.gallery, "Gallery")

    def add_reference(self, value: str, context: str = ""):
        path = clean_path(value, context)
        if not path or "%" in path or not re.search(r"\.(?:png|jpe?g|gif|bmp|webp|mp4|mp3|wav|ogg|webm|css|woff2?|ttf|svg|pdf)$", path, re.I):
            return
        if path.startswith("galleries/") or (path.startswith("panos/scene_") and path.endswith(".webp")):
            return  # Generated assets have no corresponding source ZIP entry.
        gallery = re.match(r"photo/([^/]+)/", path)
        if gallery and self.active_galleries is not None and gallery[1] not in self.active_galleries:
            return  # Legacy, unreferenced gallery variants are not visitor UI.
        if ".tiles/" in path:
            return
        if path.startswith(("floorplan_SM/editor/", "admin/", "youngnak_cms")):
            return
        # Some XML code snippets contain prose before the filename; only actual
        # archive entries are accepted, with unresolved clean paths reported.
        resolved = self.resolve(path)
        if resolved in self.entries or resolved in LIVE_RECOVERY:
            self.requested.add(path)
        else:
            self.missing.add(path)

    def discover(self):
        for path in SOURCE.rglob("*.xml"):
            context = path.parent.relative_to(SOURCE).as_posix()
            if context == ".":
                context = ""
            text = re.sub(r"<!--.*?-->", "", path.read_text(encoding="utf-8-sig"), flags=re.S)
            for match in re.finditer(r"html/[\w+\-]+\.html", text):
                self.article_paths.add(match.group())
            for match in RESOURCE_RE.finditer(text):
                self.add_reference(match.group(), context)
        for path in (SOURCE / "e-book.html", PROJECT / ".cache/runtime-styles.json", PROJECT / "src/data/full-museum.json"):
            if path.exists():
                text = path.read_text(encoding="utf-8-sig")
                for match in RESOURCE_RE.finditer(text):
                    self.add_reference(match.group())
        compiled = PROJECT / "src/data/full-museum.json"
        if compiled.exists():
            self.article_paths = set(json.loads(compiled.read_text(encoding="utf-8"))["articles"])
        inventory = json.loads((PROJECT / ".cache/full-rebuild-inventory.json").read_text(encoding="utf-8-sig"))
        for zone in inventory["zones"]:
            for page in zone["pages"]:
                self.add_reference(page["source"])
        # Explicit visitor categories include animation frames and the small
        # original UI sprite sheets, even when loaded dynamically at runtime.
        for path in self.entries:
            if (re.match(r"ovr/(?:01|02|04)/\d+\.png$", path) or
                re.match(r"(?:mov|mp3)/[^/]+\.(?:mp4|mp3|wav|webm|ogg)$", path, re.I) or
                (path.startswith(("skin/", "floorplan_SM/plan/")) and IMAGE_RE.search(path)) or
                (re.match(r"(?:photo/[^/]+|info)/skin/", path) and IMAGE_RE.search(path))):
                self.add_reference(path)
        for path in LIVE_RECOVERY:
            self.add_reference(path)
        for article in self.article_paths:
            if article not in self.entries:
                self.missing.add(article)
                continue
            parser = ArticleSanitizer(self, article)
            parser.feed(decode_text(self.read(article)))
        print(f"Discovered {len(self.requested)} image/media/style assets and {len(self.article_paths)} articles", flush=True)
        media = [(p, self.entries[self.resolve(p)].file_size) for p in self.requested if re.search(r"\.(mp4|mp3|webm|wav|ogg)$", p, re.I)]
        print(f"Local audio/video: {len(media)} files, {sum(s for _, s in media)/1048576:.1f} MiB; largest: {max(media, key=lambda x:x[1]) if media else None}", flush=True)

    def asset(self, path: str):
        resolved = self.resolve(path)
        destination = output_path(path)
        if (OUT / destination).exists() and (not IMAGE_RE.search(path) or self.records.get(destination, {}).get("profile") == 2):
            if IMAGE_RE.search(path):
                return path
            self.record(destination, resolved, "source-asset")
            return path
        raw = self.read(resolved)
        if IMAGE_RE.search(path):
            with Image.open(BytesIO(raw)) as source_image:
                article_photo = path.startswith("html/photo/")
                quality = 86 if article_photo else 90
                if article_photo:
                    width, height = source_image.size
                    scale = min(1, 2560 / width, 10000 / height, math.sqrt(12_000_000 / (width * height)))
                    target_size = (max(1, round(width * scale)), max(1, round(height * scale)))
                else:
                    target_size = (3840, 3840)
                # JPEG draft downsampling avoids decoding 20+MP historical scans
                # at full size. Resize before any transpose/colour-mode copy.
                source_image.draft("RGB", target_size)
                source_image.thumbnail(target_size, Image.Resampling.LANCZOS)
                image = ImageOps.exif_transpose(source_image) if source_image.getexif().get(274, 1) != 1 else source_image
                mode = "RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB"
                if image.mode != mode:
                    image = image.convert(mode)
                self.webp(image, destination, "http://youngnakdhm.net/" + resolved if resolved in LIVE_RECOVERY else resolved, "source-image", quality=quality)
                if image is not source_image:
                    image.close()
                source_image.close()
            del raw
            gc.collect()
        elif path.lower().endswith(".css"):
            content = decode_text(raw)
            content = re.sub(r"/\*.*?\*/", "", content, flags=re.S)
            def replace_url(match):
                value = match[1].strip(" \"'")
                local = clean_path(value, posixpath.dirname(path))
                if local and self.resolve(local) in self.entries:
                    self.requested.add(local)
                    return 'url("' + PREFIX + output_path(local) + '")'
                return match[0]
            content = re.sub(r"url\(([^)]+)\)", replace_url, content)
            self.write(destination, content.encode("utf-8"), resolved, "stylesheet")
        else:
            self.write(destination, raw, resolved, "source-media")
        return path

    def assets(self):
        processed = set()
        while self.requested - processed:
            candidates = self.requested - processed
            tasks = [p for p in candidates if not (OUT / output_path(p)).exists() or
                     (IMAGE_RE.search(p) and self.records.get(output_path(p), {}).get("profile") != 2)]
            tasks.sort(key=lambda p: (0 if p.startswith(("mov/", "mp3/", "ovr/")) or p.endswith(".pdf") or p == "info/intro.png" else 1, p))
            self.run_tasks(tasks, self.asset, "Asset")
            processed.update(candidates)

    def articles(self):
        for path in sorted(self.article_paths):
            parser = ArticleSanitizer(self, path)
            parser.feed(decode_text(self.read(path)))
            self.write(path, "".join(parser.parts).encode("utf-8"), path, "sanitized-article")
        self.save_manifest()
        print(f"Articles: {len(self.article_paths)} sanitized documents", flush=True)


def decode_text(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            pass
    return raw.decode("utf-8", errors="replace")


class ArticleSanitizer(HTMLParser):
    """Retain article markup and prose while removing active/administrative code."""
    blocked = {"script", "iframe", "object", "embed", "form", "button", "input"}
    void = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, builder: Builder, source: str):
        super().__init__(convert_charrefs=False)
        self.builder, self.source = builder, source
        self.parts, self.skip = [], []

    def handle_decl(self, decl):
        self.parts.append("<!" + decl + ">")

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if self.skip:
            if tag not in self.void:
                self.skip.append(tag)
            return
        if tag in self.blocked:
            if tag not in self.void:
                self.skip.append(tag)
            return
        values = dict(attrs)
        if tag == "base" or (tag == "meta" and values.get("http-equiv", "").lower() == "refresh"):
            return
        filtered = []
        for key, value in attrs:
            if key.lower().startswith("on") or key.lower() in {"srcdoc", "action", "formaction", "nonce"}:
                continue
            if value is None:
                filtered.append(key)
                continue
            if key.lower() in {"src", "href", "poster"}:
                if re.match(r"\s*(?:javascript|vbscript):", value, re.I) or re.search(r"(?:admin|cms|login|statistics)\.(?:php|asp|html)", value, re.I):
                    continue
                local = clean_path(value, posixpath.dirname(self.source))
                if local and (self.builder.resolve(local) in self.builder.entries):
                    self.builder.add_reference(local)
                    value = PREFIX + output_path(local)
            filtered.append(key + '="' + escape(value, quote=True) + '"')
        self.parts.append("<" + tag + (" " + " ".join(filtered) if filtered else "") + ">")
        if tag == "head":
            self.parts.append('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\' data:; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src \'self\' https://fonts.gstatic.com; base-uri \'none\'; form-action \'none\'">')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if self.skip:
            if tag in self.skip:
                while self.skip:
                    if self.skip.pop() == tag:
                        break
            return
        if tag not in self.blocked and tag not in self.void:
            self.parts.append("</" + tag + ">")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

    def handle_entityref(self, name):
        if not self.skip:
            self.parts.append("&" + name + ";")

    def handle_charref(self, name):
        if not self.skip:
            self.parts.append("&#" + name + ";")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=Path(r"G:\내 드라이브\영락역사관\영락교회_디지털역사관_1.최종소스및이미지.zip"))
    parser.add_argument("--phase", choices=["all", "panos", "galleries", "assets", "articles", "discover"], default="all")
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--prefer-http", action="store_true", help="Use original public bytes only when size and CRC match ZIP metadata; otherwise read ZIP. Avoids Google Drive archive hydration.")
    args = parser.parse_args()
    builder = Builder(args.archive, args.workers, args.prefer_http)
    builder.discover()
    if args.phase in {"all", "assets", "articles"}:
        builder.articles()
        builder.assets()
    if args.phase in {"all", "panos"}:
        builder.panoramas()
    if args.phase in {"all", "galleries"}:
        builder.galleries()
    builder.save_manifest()
    print(json.dumps({"files": len(builder.records), "MiB": round(sum(x["bytes"] for x in builder.records.values()) / 1048576, 2),
                      "missing": len(builder.missing), "errors": len(builder.errors), "seconds": round(time.time() - builder.started),
                      "freeMiB": round(shutil.disk_usage(OUT).free / 1048576)}, ensure_ascii=False), flush=True)
    if builder.errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
