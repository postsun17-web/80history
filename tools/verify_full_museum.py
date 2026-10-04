"""Verify full visitor coverage against delivered XML and actual public files.

This verifier deliberately reports incomplete asset generation as incomplete.
It does not infer completion from inventory totals or from a build succeeding.
JSON findings are also written to .cache/full-verification.json by default.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict, deque
from html import unescape
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import posixpath
import re
import subprocess
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

PROJECT = Path(__file__).resolve().parents[1]
FACES = "fblrud"
NATIVE_ROUTES = re.compile(r"^(?:photo/[^/]+/(?:index|tour)\.html|info/(?:index|tour)\.html|e-book2?\.html)$", re.I)
TOKENS = re.compile(r"%(?:FIRSTXML|VIEWER|CURRENTXML|SWFPATH|HTMLPATH)%/?", re.I)
# ZIP inventory plus exact original-site HTTP 404 checks by the asset audit,
# 2026-10-04. These are recorded, never silently waived or deemed complete.
KNOWN_SOURCE_DEFECTS = {
    path: "Absent from delivered ZIP and original public URL returned HTTP 404 (2026-10-04)."
    for path in [
        "images/obob002-3.png", "images/arr.png", "images/close01.png",
        "images/open01.png", "images/video.png", "images/zoom1.png",
        "skin/close.png", "add_hotspot/picture/info001.png", "img/con02-2.png",
        "img/con03.png", "img/gallery_wall.png", "img/glass.png", "img/plus_ico.png",
    ]
}
SOURCE_PATH_REPAIRS = {
    "images/obob002-3.png": {
        "target": "/media/full/images/ob002-3.png.webp",
        "reason": "Duplicated 'ob' prefix in two active decorative object URLs; existing exact medallion image is used by six other A viewpoints.",
        "affectedSourceHotspots": ["scene_a-s-e+1+/object_66", "scene_a-s-w-1+/object_69"],
        "preserved": "Original hotspot attributes, geometry, and absent onclick are unchanged; only asset URL resolution is repaired.",
    }
}


def strip_comments(text: str) -> str:
    return re.sub(r"<!--.*?-->", "", text, flags=re.S)


def normalize(value: str) -> str:
    value = TOKENS.sub("", unescape(value).strip()).replace("\\", "/")
    value = value.split("?")[0].split("#")[0]
    return posixpath.normpath(value)


def reachable(graph: dict[str, set[str]], starts: set[str]) -> set[str]:
    seen = set(starts)
    queue = deque(starts)
    while queue:
        for target in graph.get(queue.popleft(), set()):
            if target not in seen:
                seen.add(target)
                queue.append(target)
    return seen


def source_graph(scenes: list[ET.Element]) -> dict[str, set[str]]:
    graph = defaultdict(set)
    for scene in scenes:
        origin = scene.get("name", "").lower()
        for h in scene.findall("hotspot"):
            target = h.get("linkedscene", "").lower()
            if target:
                graph[origin].add(target)
            if h.get("name") == "open_b":
                graph[origin].add("scene_f-c-0")
            for action in (h.get("onclick", ""), h.get("onvideocomplete", "")):
                graph[origin].update(t.lower() for t in re.findall(r"loadscene\(\s*(scene_[\w+-]+)", action, re.I))
    return graph


def decode_actions(records: list[dict], root: Path) -> list[dict]:
    """Exercise the production TypeScript interpreter without evaluating actions."""
    code = """
import {decodeAction} from './src/source-actions.ts';
let input='';for await (const chunk of process.stdin) input+=chunk;
const records=JSON.parse(input);
process.stdout.write(JSON.stringify(records.map(record=>({...record,decoded:decodeAction(record.action)}))));
"""
    result = subprocess.run(["node", "--experimental-strip-types", "--input-type=module", "-e", code], cwd=root, input=json.dumps(records, ensure_ascii=False), text=True, encoding="utf-8", capture_output=True, check=True, timeout=45)
    return json.loads(result.stdout)


class LocalReferences(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.active = []
        self.hidden_depth = 0
        self.visible_parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        # Legacy article zoom/close buttons are replaced by the native dialog;
        # compare exhibition prose, not those old '+'/'−'/'×' control labels.
        if tag in {"head", "script", "style", "button"}:
            self.hidden_depth += 1
        if tag in {"script", "iframe", "object", "embed"}:
            self.active.append(tag)
        for name, value in attrs.items():
            if name.lower().startswith("on") or (name in {"src", "href"} and value.lower().startswith("javascript:")):
                self.active.append(name)
        for attr in ("src", "href", "poster"):
            if attrs.get(attr):
                self.refs.append((tag, attr, attrs[attr]))
        if attrs.get("srcset"):
            self.refs.extend((tag, "srcset", part.strip().split()[0]) for part in attrs["srcset"].split(",") if part.strip())

    def handle_endtag(self, tag):
        if tag in {"head", "script", "style", "button"}:
            self.hidden_depth = max(0, self.hidden_depth - 1)

    def handle_data(self, value):
        if not self.hidden_depth:
            self.visible_parts.append(value)

    def visible_text(self):
        return re.sub(r"\s+", " ", "".join(self.visible_parts)).strip()


def verify(root: Path, source: Path, max_examples: int = 12, write_assets: Path | None = None) -> dict:
    public = root / "public"
    data = json.loads((root / "src/data/full-museum.json").read_text(encoding="utf-8"))
    source_text = {}
    def text(path):
        if path not in source_text:
            source_text[path] = strip_comments((source / path).read_text(encoding="utf-8-sig"))
        return source_text[path]
    def xml(path):
        return ET.fromstring(text(path))
    errors = []
    warnings = []
    required = defaultdict(set)
    required_origins = defaultdict(set)
    checked_html = set()
    def error(category, message):
        errors.append({"category": category, "message": message})
    def require(category, value, origin=""):
        if not value or re.match(r"https?:|data:|mailto:|tel:|//|#", value, re.I):
            return
        parsed = urllib.parse.urlsplit(value)
        path = urllib.parse.unquote(parsed.path)
        if not path.startswith("/media/"):
            error("url-contract", f"Unexpected local URL {value!r} from {origin}")
            return
        path = posixpath.normpath(path)
        required[category].add(path)
        if origin:
            required_origins[path].add(origin)
    def asset(value):
        key = normalize(value)
        if value.startswith("/media/"):
            return value
        return data["assets"].get(key) or data["assets"].get(value) or "/media/full/" + key + (".webp" if re.search(r"\.(png|jpe?g|gif|bmp)$", key, re.I) else "")

    originals = xml("tour.xml").findall("scene") + xml("outside.xml").findall("scene")
    original_ids = {s.get("name").lower() for s in originals}
    scenes = {s["id"]: s for s in data["scenes"]}
    if len(scenes) != len(data["scenes"]):
        error("scenes", "Duplicate compiled scene IDs")
    missing_scenes = sorted(original_ids - set(scenes))
    extra_originals = sorted(s for s in scenes if not s.startswith("scene_ext-") and s not in original_ids)
    if missing_scenes or extra_originals:
        error("scenes", f"Source scene mismatch missing={missing_scenes}, extra={extra_originals}")
    original_graph = source_graph(originals)
    globals_ = xml("pannel.xml").findall("hotspot")
    expected_scene_hotspot_count = 0
    for node in originals:
        sid = node.get("name").lower()
        raw_nodes = list(node.findall("hotspot")) + [h for h in globals_ if h.get("id", "").lower() == sid]
        expected_scene_hotspot_count += len(raw_nodes)
        def signature(attrs, points):
            return json.dumps({"attrs": attrs, "points": points}, sort_keys=True, ensure_ascii=False)
        expected = Counter(signature(h.attrib, [[float(p.get("ath", "0")), float(p.get("atv", "0"))] for p in h.findall("point")]) for h in raw_nodes)
        actual = Counter(signature(h["attrs"], h.get("points", [])) for h in scenes.get(sid, {}).get("hotspots", []))
        for missing_signature, count in (expected - actual).items():
            missing_node = json.loads(missing_signature)
            error("scene-hotspots", f"Missing/changed {count} source hotspot(s) {sid}/{missing_node['attrs'].get('name')}")
    graph = defaultdict(set)
    action_records = []
    def inspect_hotspot(h, context, scene_id=None):
        attrs = {}
        for style in h["attrs"].get("style", "").split("|"):
            attrs.update(data["styles"].get(style, {}))
        attrs.update(h["attrs"])
        target = attrs.get("linkedscene", "").lower()
        if target:
            if target not in scenes:
                error("scene-links", f"{context} links to missing {target}")
            elif scene_id:
                graph[scene_id].add(target)
        if h["name"] == "open_b" and scene_id:
            graph[scene_id].add("scene_f-c-0")
        # FullViewer draws polygons and CSS navigation before it attempts image
        # loading. Their inherited sprite URLs therefore are not runtime assets.
        drawable = ("ath" in attrs or "ath2" in attrs or h.get("points")) and attrs.get("devices") != "mobile"
        if drawable and not h.get("points") and not target:
            value = attrs.get("videourl") or attrs.get("url", "")
            if re.search(r"\.(png|jpe?g|webp|gif|bmp|mp4|webm|svg)(?:\?|$)", value, re.I):
                require("hotspot-media", asset(value), context)
        # Internal skin callbacks have no visitor destination. Linked scenes
        # and open_b are handled directly by FullViewer, before decodeAction.
        action = attrs.get("onclick", "")
        if action and not target and h["name"] != "open_b":
            if action.strip() != "skin_hotspotstyle_click();":
                action_records.append({"context": context, "action": action})
        onloaded = attrs.get("onloaded", "")
        if re.search(r"\b(?:buildovr|add_iframe)\s*\(", onloaded):
            action_records.append({"context": context + "/onloaded", "action": onloaded})
    for sid, scene in scenes.items():
        p = scene["pano"]
        for face in FACES:
            require("panorama-base", f"{p['root']}/{face}/base.webp", sid)
            for row in range(p["tiles"]):
                for col in range(p["tiles"]):
                    require("panorama-tiles", f"{p['root']}/{face}/{p['level']}/{row}_{col}.{p['ext']}", sid)
        for h in scene["hotspots"]:
            inspect_hotspot(h, sid + "/" + h["name"], sid)
    for origin, targets in original_graph.items():
        for target in targets - graph[origin]:
            error("scene-links", f"Source edge omitted: {origin} -> {target}")
    walked = reachable(graph, {"scene_f-c-0"})
    source_walked = reachable(original_graph, {"scene_f-c-0"})
    lost_walk = sorted((source_walked & original_ids) - walked)
    if lost_walk:
        error("reachability", f"Previously walkable source viewpoints lost: {lost_walk}")
    for sid in scenes:
        if sid.startswith("scene_ext-") and sid not in walked:
            error("reachability", f"Approved extension is not walkable from lobby: {sid}")
    ui_entries = {s["id"] for s in scenes.values() if s.get("map")}
    ui_entries.update(item["scene"] for m in data["menus"] for item in m["items"] if item.get("scene"))
    ui_reachable = reachable(graph, walked | ui_entries)
    if set(scenes) - ui_reachable:
        error("reachability", f"No navigation/map/menu entry: {sorted(set(scenes)-ui_reachable)}")

    source_zone_map = {sid.lower(): zone for sid, zone in re.findall(r"if\(xml.scene == '([^']+)'.*?list_change_(\w+)\(01\)", text("tour.xml"))}
    zones = {z["id"]: z for z in data["zones"]}
    source_page_count = 0
    source_page_hotspots = 0
    source_page_controls = 0
    expected_zone_ids = set(source_zone_map.values())
    if set(zones) != expected_zone_ids:
        error("zones", f"Zone mismatch: source={sorted(expected_zone_ids)}, compiled={sorted(zones)}")
    for sid, zone_id in source_zone_map.items():
        if zone_id not in zones:
            continue
        zone = zones[zone_id]
        if zone["scene"] != sid or scenes.get(sid, {}).get("zone") != zone_id:
            error("zones", f"Wrong scene/zone attachment for {zone_id}")
        raw = xml(f"list_{zone_id}_action.xml")
        expected_pages = {}
        for node in raw.findall("hotspot"):
            match = re.search(r"list_change_" + zone_id + r"\((\d+)\)", node.get("onclick", ""))
            if node.get("name", "").startswith("listspot") and match:
                expected_pages[int(match[1])] = node
        actual_pages = {p["number"]: p for p in zone["pages"]}
        controls = [h for h in raw.findall("hotspot") if h.get("name", "").startswith("listspot") or h.get("style") in {"nextb", "prevb"}]
        source_page_controls += len(controls)
        compiled_scene_attrs = [h["attrs"] for h in scenes.get(sid, {}).get("hotspots", [])]
        for control in controls:
            if control.attrib not in compiled_scene_attrs:
                error("page-controls", f"Missing original on-wall page control {zone_id}/{control.get('name')}")
        source_page_count += len(expected_pages)
        if set(actual_pages) != set(expected_pages):
            error("pages", f"Page number mismatch for {zone_id}")
        for number in expected_pages:
            if number not in actual_pages:
                continue
            page = actual_pages[number]
            expected_image = f"img/sector_{zone_id}_{number:02}.png"
            if expected_image not in text(f"list_{zone_id}_action.xml"):
                error("source-pages", f"Menu points to page without panel branch: {zone_id}/{number}")
            if page["image"] != asset(expected_image):
                error("pages", f"Wrong panel image for {zone_id}/{number}: {page['image']}")
            require("exhibition-panels", page["image"], f"{zone_id}/{number}")
            expected_nodes = [h for h in raw.findall("hotspot") if h.get("tag") == f"{number}p"]
            source_page_hotspots += len(expected_nodes)
            actual_nodes = {h["name"]: h for h in page["hotspots"]}
            if Counter(h.get("name") for h in expected_nodes) != Counter(h["name"] for h in page["hotspots"]):
                error("page-hotspots", f"Hotspot count/name mismatch at {zone_id}/{number}")
            for node in expected_nodes:
                actual = actual_nodes.get(node.get("name"))
                if actual and actual["attrs"] != node.attrib:
                    error("page-hotspots", f"Source attrs changed at {zone_id}/{number}/{node.get('name')}")
            for h in page["hotspots"]:
                inspect_hotspot(h, f"{zone_id}/{number}/{h['name']}")

    runtime_files = ["tour.xml", "pannel.xml", "outside.xml", "action.xml", "qmenu.xml", "mobile_menu.xml", "combobox.xml", "media_mobile.xml"] + sorted(p.name for p in source.glob("list_*_action.xml"))
    runtime_text = "\n".join(text(path) for path in runtime_files)
    source_galleries = {g.replace("a07-2", "a07-02") for g in re.findall(r"photo/([^/'\"\s]+)/index\.html\?startscene=\d+", runtime_text)}
    galleries = {g["id"]: g for g in data["galleries"]}
    if set(galleries) != source_galleries | {"help"}:
        error("galleries", f"Gallery IDs differ missing={sorted((source_galleries|{'help'})-set(galleries))}, extra={sorted(set(galleries)-source_galleries-{'help'})}")
    source_gallery_items = 0
    source_help_items = 0
    for gid in sorted(source_galleries | {"help"}):
        original = xml("info/tour.xml" if gid == "help" else f"photo/{gid}/tour.xml").findall("scene")
        if gid == "help":
            source_help_items += len(original)
        else:
            source_gallery_items += len(original)
        actual = galleries.get(gid, {}).get("items", [])
        if len(actual) != len(original):
            error("gallery-items", f"{gid} has {len(actual)} items, source has {len(original)}")
        for index, item in enumerate(actual):
            require("gallery-images", item["image"], f"{gid}:{index}")
            expected_url = f"/media/full/galleries/{gid}/{index}.webp"
            if item["image"] != expected_url:
                error("gallery-items", f"Wrong zero-based URL at {gid}:{index}: {item['image']}")
            if index < len(original):
                cube = original[index].find("image/cube") is not None
                if cube != bool(item.get("faces")):
                    error("gallery-items", f"Cube/flat type mismatch at {gid}:{index}")
            for face, value in item.get("faces", {}).items():
                require("gallery-cube-faces", value, f"{gid}:{index}:{face}")

    source_articles = set(re.findall(r"html/[\w-]+\.html", runtime_text))
    if set(data["articles"]) != source_articles:
        error("articles", f"Article coverage missing={sorted(source_articles-set(data['articles']))}, extra={sorted(set(data['articles'])-source_articles)}")
    article_ref_count = 0
    for path, article in data["articles"].items():
        require("article-html", article["url"], path)
        file = public / article["url"].lstrip("/")
        if not file.exists():
            continue
        parser = LocalReferences()
        parser.feed(file.read_text(encoding="utf-8-sig"))
        original_parser = LocalReferences()
        original_parser.feed(text(path))
        if parser.visible_text() != original_parser.visible_text():
            error("article-content", f"Visible source prose changed or omitted in {path}")
        checked_html.add(path)
        if parser.active:
            error("article-sanitization", f"Active content in {path}: {sorted(set(parser.active))}")
        for tag, attr, value in parser.refs:
            if re.match(r"https?:|data:|mailto:|tel:|//|#", value, re.I):
                continue
            relative = urllib.parse.urljoin(article["url"], value)
            if NATIVE_ROUTES.fullmatch(normalize(value)):
                continue
            require("article-dependencies", relative, path + f" <{tag} {attr}>")
            article_ref_count += 1
    for book in data["ebooks"]:
        require("ebook-covers", book["cover"], book["title"])
    source_ebook_cards = re.findall(r'<div\s+class="gallery-item".*?</div>', text("e-book.html"), re.S)
    source_ebook_urls = []
    for block in source_ebook_cards:
        match = re.search(r"https://heyzine\.com/flip-book/[^'\"]+", block)
        if match:
            source_ebook_urls.append(re.sub(r"\s+", "", match[0]))
    if Counter(source_ebook_urls) != Counter(b["url"] for b in data["ebooks"]):
        error("ebooks", "Compiled ebook card/reader URLs do not match source HTML")
    for key in ("map", "logo", "intro"):
        require("interface", data[key], key)
    for icon in ("01", "02", "05", "06", "04"):
        require("interface", asset(f"images/qmenu_ico{icon}.png"), "full-main quick menu")
    require("audio", asset("mp3/bg_short1.mp3"), "background music")
    for section in [*data["menus"], {"title": "quickMenu", "items": data.get("quickMenu", [])}, *data.get("mediaSections", [])]:
        for index, item in enumerate(section["items"]):
            if item.get("action"):
                action_records.append({"context": f"menu/{section['title']}/{index}", "action": item["action"]})
    unknown = []
    decoded_count = Counter()
    youtube_ids = set()
    try:
        decoded = decode_actions(action_records, root)
        for record in decoded:
            action = record["decoded"]
            context = record["context"]
            if action is None:
                unknown.append({"context": context, "action": record["action"]})
                continue
            kind = action["type"]
            decoded_count[kind] += 1
            if kind == "youtube":
                youtube_ids.add(action["id"])
            if kind == "scene" and action["scene"] not in scenes:
                error("decoded-actions", f"Missing scene from {context}: {action['scene']}")
            elif kind == "gallery":
                target = galleries.get(action["gallery"])
                if target is None or not 0 <= action["index"] < len(target["items"]):
                    error("decoded-actions", f"Missing gallery item from {context}: {action}")
            elif kind == "article" and action["path"] not in data["articles"]:
                error("decoded-actions", f"Missing article from {context}: {action['path']}")
            elif kind == "page":
                target = zones.get(action["zone"])
                if target is None or action["page"] not in {p["number"] for p in target["pages"]}:
                    error("decoded-actions", f"Missing page from {context}: {action}")
            elif kind in {"image", "video", "audio", "document"}:
                require("action-" + kind, asset(action["src"]), context)
            elif kind == "object" and action.get("folder"):
                for frame in range(action["frames"]):
                    require("object-frames", asset(f"{action['folder']}/{frame}.png"), context)
            if action.get("audio"):
                require("audio", asset(action["audio"]), context)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        error("action-decoder", str(exc))
    if unknown:
        warnings.append({"category": "undecoded-actions", "count": len(unknown), "examples": unknown[:max_examples]})
    source_youtube_ids = set(re.findall(r"youtube\.com/(?:embed/|watch\?v=)([A-Za-z0-9_-]{11})", runtime_text))
    if source_youtube_ids - youtube_ids:
        error("videos", f"Source videos lack a decoded visitor action: {sorted(source_youtube_ids-youtube_ids)}")

    # Follow local stylesheet dependencies as part of the visitor document,
    # including url(...) images/fonts and nested @import. External font hosts
    # remain external and are deliberately not copied into the package.
    seen_css = set()
    css_queue = deque(p for paths in required.values() for p in paths if p.endswith(".css"))
    while css_queue:
        css_url = css_queue.popleft()
        if css_url in seen_css:
            continue
        seen_css.add(css_url)
        css_file = public / css_url.lstrip("/")
        if not css_file.is_file():
            continue
        css = css_file.read_text(encoding="utf-8-sig")
        refs = re.findall(r"url\(\s*['\"]?([^)'\"]+)", css)
        refs += re.findall(r"@import\s+['\"]([^'\"]+)['\"]", css)
        for value in refs:
            value = value.strip()
            if re.match(r"https?:|data:|//|#", value, re.I):
                continue
            dependency = urllib.parse.urljoin(css_url, value)
            require("article-css-dependencies", dependency, css_url)
            if dependency.endswith(".css"):
                css_queue.append(dependency)

    missing = {}
    all_required = set().union(*required.values())
    for category, values in sorted(required.items()):
        absent = []
        for path in sorted(values):
            file = public / path.lstrip("/")
            if not file.is_file() or file.stat().st_size == 0:
                absent.append({"url": path, "origins": sorted(required_origins[path])[:3]})
        missing[category] = {"required": len(values), "present": len(values) - len(absent), "missing": len(absent), "examples": absent[:max_examples]}
    unique_missing = [p for p in sorted(all_required) if not (public / p.lstrip("/")).is_file() or (public / p.lstrip("/")).stat().st_size == 0]
    # Asset generation is resumable and may atomically rename files while this
    # audit runs. Capture one successful stat per file instead of stat-ing a
    # stale pathname later; a concurrent removal is not a verifier crash.
    actual_file_sizes = {}
    concurrent_changes = []
    if (public / "media/full").exists():
        for path in (public / "media/full").rglob("*"):
            try:
                if path.is_file() and path.suffix not in {".tmp", ".partial"}:
                    actual_file_sizes[str(path)] = path.stat().st_size
            except FileNotFoundError:
                concurrent_changes.append(str(path.relative_to(public)))
    if concurrent_changes:
        warnings.append({"category": "assets-changing-during-audit", "count": len(concurrent_changes), "examples": concurrent_changes[:max_examples]})
    result = {
        "status": "complete" if not errors and not unique_missing and not unknown and not concurrent_changes else "incomplete",
        "sourceCoverage": {"originalScenes": len(original_ids), "compiledScenes": len(scenes), "sourceSceneHotspots": expected_scene_hotspot_count, "sourceZones": len(source_zone_map), "sourcePages": source_page_count, "sourcePageHotspots": source_page_hotspots, "sourcePageControls": source_page_controls, "sourcePhotoGalleries": len(source_galleries), "sourcePhotoItems": source_gallery_items, "sourceHelpItems": source_help_items, "sourceArticles": len(source_articles), "sourceEbooks": len(source_ebook_urls), "sourceYoutubeIds": len(source_youtube_ids)},
        "navigation": {"physicallyReachable": len(walked), "sourcePhysicallyReachable": len(source_walked), "interfaceReachable": len(ui_reachable), "unreachableWalk": sorted(set(scenes) - walked), "unreachableInterface": sorted(set(scenes) - ui_reachable)},
        "articles": {"checked": len(checked_html), "localReferences": article_ref_count},
        "actionDecoding": {"checked": len(action_records), "decodedByType": dict(decoded_count), "unknown": unknown},
        "files": {"actualFullFiles": len(actual_file_sizes), "actualFullMiB": round(sum(actual_file_sizes.values()) / 1048576, 2), "uniqueRequired": len(all_required), "uniqueMissing": len(unique_missing), "missingByCategory": missing},
        "errors": errors,
        "warnings": warnings,
        "sourcePathRepairs": [{"sourcePath": path, **repair} for path, repair in SOURCE_PATH_REPAIRS.items() if data["assets"].get(path) == repair["target"]],
    }
    if write_assets is not None:
        manifest_entries = []
        categories_by_url = defaultdict(set)
        for category, paths in required.items():
            for path in paths:
                categories_by_url[path].add(category)
        for url in sorted(all_required):
            file = public / url.lstrip("/")
            entry = {"url": url, "path": url.lstrip("/"), "exists": False, "bytes": 0, "sha256": None, "categories": sorted(categories_by_url[url]), "origins": sorted(required_origins[url])}
            try:
                before = file.stat()
                if before.st_size > 0 and file.is_file():
                    with file.open("rb") as stream:
                        digest = hashlib.file_digest(stream, "sha256").hexdigest()
                    after = file.stat()
                    entry.update(exists=True, bytes=after.st_size)
                    if (before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns):
                        entry["sha256"] = digest
                    else:
                        entry["unstableDuringHash"] = True
                        result["status"] = "incomplete"
            except (FileNotFoundError, PermissionError):
                pass
            original = url.removeprefix("/media/full/").removesuffix(".webp")
            if original in KNOWN_SOURCE_DEFECTS:
                entry["knownSourceDefect"] = KNOWN_SOURCE_DEFECTS[original]
            repairs = [{"sourcePath": path, **repair} for path, repair in SOURCE_PATH_REPAIRS.items() if repair["target"] == url and data["assets"].get(path) == url]
            if repairs:
                entry["sourcePathRepairs"] = repairs
            manifest_entries.append(entry)
        present_entries = [entry for entry in manifest_entries if entry["exists"]]
        full_entries = [entry for entry in present_entries if entry["url"].startswith("/media/full/")]
        totals = {
            "requiredFiles": len(manifest_entries),
            "presentFiles": len(present_entries),
            "missingFiles": len(manifest_entries) - len(present_entries),
            "unhashedExistingFiles": sum(entry["sha256"] is None for entry in present_entries),
            "presentBytes": sum(entry["bytes"] for entry in present_entries),
            "presentMiB": round(sum(entry["bytes"] for entry in present_entries) / 1048576, 2),
            "fullPresentBytes": sum(entry["bytes"] for entry in full_entries),
            "fullPresentMiB": round(sum(entry["bytes"] for entry in full_entries) / 1048576, 2),
        }
        if totals["missingFiles"] or totals["unhashedExistingFiles"]:
            result["status"] = "incomplete"
        manifest = {"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "sourceDataSha256": hashlib.sha256((root / "src/data/full-museum.json").read_bytes().replace(b"\r\n", b"\n")).hexdigest(), "verificationStatus": result["status"], "totals": totals, "assets": manifest_entries}
        write_assets.parent.mkdir(parents=True, exist_ok=True)
        write_assets.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result["activeAssetManifest"] = {"path": str(write_assets), **totals}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=PROJECT / ".cache/full-source")
    parser.add_argument("--output", type=Path, default=PROJECT / ".cache/full-verification.json")
    parser.add_argument("--examples", type=int, default=8)
    parser.add_argument("--write-assets", type=Path, help="Write visitor-active URLs, provenance, byte sizes, and SHA-256 of existing files.")
    args = parser.parse_args()
    result = verify(PROJECT, args.source, args.examples, args.write_assets)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k not in {"files", "actionDecoding"}}, ensure_ascii=False, indent=2))
    print("FILE CATEGORIES")
    for category, counts in result["files"]["missingByCategory"].items():
        print(f"  {category}: {counts['present']}/{counts['required']} present; missing {counts['missing']}")
        for item in counts["examples"][:3]:
            print("   ", item["url"])
    print("ACTUAL FULL FILES", result["files"]["actualFullFiles"], f"({result['files']['actualFullMiB']} MiB)")
    print("ACTION DECODING", json.dumps(result["actionDecoding"]["decodedByType"], ensure_ascii=False), "unknown", len(result["actionDecoding"]["unknown"]))
    print("REPORT", args.output)
    raise SystemExit(0 if result["status"] == "complete" else 1)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
