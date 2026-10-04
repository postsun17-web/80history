"""Re-read delivered ZIP bytes for the 20 reported white source scenes.

Uses the stat-validated central-directory index only for entry locations. Every
selected source is read from the delivered ZIP; HTTP and old extracted caches
are never used. Sequential reads limit Google Drive cache pressure. The raw
bytes and incremental size/CRC/SHA-256/pixel evidence are preserved separately.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
import re
import sys
import zlib

from PIL import Image

from build_full_assets import IndexedArchive, PROJECT, decode_name

ARCHIVE = Path(r"G:\내 드라이브\영락역사관\영락교회_디지털역사관_1.최종소스및이미지.zip")
RAW_ROOT = Path(r"E:\CodexAssets\youngnak-defect-reaudit\raw")
EVIDENCE = PROJECT / ".cache/defect-reaudit-raw.json"
IMAGE_RE = re.compile(r"\.(?:jpe?g|png|bmp|tiff?|psd|webp)$", re.I)
ORIGINALS = {
    "b01:0": "photo/jpg파일모음/b1_jpg/b01_00.jpg",
    "c01:0": "photo/jpg파일모음/c01_jpg/00.jpg",
    "c03:7": "photo/jpg파일모음/c03_jpg/08(한경직 목사 총회장 기념촬영-19550426).jpg",
    "c03:8": "photo/jpg파일모음/c03_jpg/09WCC 지도자들의 한경직 목사 예방(1976.6.16.).jpg",
    "c03:9": "photo/jpg파일모음/c03_jpg/10(사진 2-3)추가 전달.jpg",
    "c03:10": "photo/jpg파일모음/c03_jpg/11관련 자료 1-3)추후 전달.jpg",
    "c03:12": "photo/jpg파일모음/c03_jpg/13빌리 그래함 한국전도대회 포스터.jpg",
    "c03:16": "photo/jpg파일모음/c03_jpg/17.100주년 행사 사진 1-8장.jpg",
    "d01:0": "photo/jpg파일모음/d01_jpg/00.jpg",
    "d01:5": "photo/jpg파일모음/d01_jpg/05.jpg",
    "d01:16": "photo/jpg파일모음/d01_jpg/16.jpg",
    "d02:0": "photo/jpg파일모음/d02jpg/00.jpg",
    "d04:0": "photo/jpg파일모음/d04jpg/00.jpg",
    "d04:2": "photo/jpg파일모음/d04jpg/02.jpg",
    "d04:3": "photo/jpg파일모음/d04jpg/03.jpg",
}


def image_evidence(raw: bytes) -> dict:
    with Image.open(BytesIO(raw)) as source:
        source.load()
        rgb = source.convert("RGB")
        extrema = [list(pair) for pair in rgb.getextrema()]
        return {
            "format": source.format,
            "mode": source.mode,
            "dimensions": list(source.size),
            "rgbExtrema": extrema,
            "pureWhite": extrema == [[255, 255]] * 3,
            "pixelSha256Rgb": hashlib.sha256(rgb.tobytes()).hexdigest(),
            "metadataKeys": sorted(source.info.keys()),
        }


def embedded_jpegs(raw: bytes) -> list[dict]:
    """Check embedded JPEG previews, including EXIF/Photoshop thumbnails."""
    results = []
    offset = raw.find(b"\xff\xd8", 2)
    while offset >= 0:
        end = raw.find(b"\xff\xd9", offset + 2)
        if end < 0:
            break
        part = raw[offset:end + 2]
        try:
            result = image_evidence(part)
            result.update({"offset": offset, "bytes": len(part), "sha256": hashlib.sha256(part).hexdigest()})
            results.append(result)
        except Exception:
            pass
        offset = raw.find(b"\xff\xd8", offset + 2)
    return results


def safe_write(base: Path, name: str, raw: bytes) -> str:
    parts = PurePosixPath(name).parts
    if ".." in parts or PurePosixPath(name).is_absolute():
        raise ValueError(f"Unsafe archive path: {name}")
    destination = base.joinpath(*parts)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(raw)
    return str(destination)


def build_selection(entries: dict, scenes: list, phase: str) -> dict:
    selected = {}
    if phase == "core":
        for scene in scenes:
            highest = set(scene["sourceEvidence"]["sourceTilePaths"])
            root = next(iter(highest)).split(".tiles/")[0] + ".tiles/"
            for name in entries:
                if name.startswith(root):
                    role = "highest-resolution-tile" if name in highest else (
                        "preview" if name.endswith("/preview.jpg") else (
                        "thumb" if name.endswith("/thumb.jpg") else "lower-resolution-tile"))
                    selected[name] = {"sceneId": scene["id"], "role": role}
            if scene["id"] in ORIGINALS:
                selected[ORIGINALS[scene["id"]]] = {"sceneId": scene["id"], "role": "matching-original"}
            selected[f"photo/{scene['gallery']}/tour.xml"] = {"role": "scene-xml"}
    else:
        core = build_selection(entries, scenes, "core")
        for name in entries:
            if name in core:
                continue
            if IMAGE_RE.search(name) and "/panos/" not in name and "/plugins/" not in name and "/skin/" not in name:
                if name.startswith("photo/jpg파일모음/c03_jpg/"):
                    selected[name] = {"role": "c03-related-original"}
                elif re.search(r"(19550426|1955[._ -]0?4[._ -]26|1976[._ -]0?6[._ -]16|100주년|총회장|WCC|그래함.*포스터)", name, re.I):
                    selected[name] = {"role": "title-related-candidate"}
                elif name in {"img/blank.png", "img/blank_photo.psd", "photo/jpg파일모음/d04jpg/04.jpg"}:
                    selected[name] = {"role": "placeholder-comparison"}
        selected["photo/jpg파일모음/c03_jpg/vtour/tour.xml"] = {"role": "alternate-c03-xml"}
    return selected


def save(data: dict) -> None:
    records = data["files"]
    for phase in data["phases"].values():
        if "selectedPaths" in phase:
            phase["verifiedFiles"] = sum(name in records for name in phase["selectedPaths"])
            phase["pendingPaths"] = [name for name in phase["selectedPaths"] if name not in records]
    data["summary"] = {
        "directZipFiles": len(records),
        "directZipBytes": sum(record["bytes"] for record in records.values()),
        "images": sum("image" in record for record in records.values()),
        "pureWhiteImages": sum(record.get("image", {}).get("pureWhite", False) for record in records.values()),
        "roles": dict(Counter(record["role"] for record in records.values())),
        "looseMatches": sum(record.get("looseCopy", {}).get("matchesZip", False) for record in records.values()),
        "looseDifferences": sum(record.get("looseCopy", {}).get("matchesZip") is False for record in records.values()),
        "readErrors": len(data["errors"]),
        "allRecordedZipCrcAndSizesVerified": all(record["crcAndSizeVerified"] for record in records.values()),
    }
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    temporary = EVIDENCE.with_suffix(".json.part")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(EVIDENCE)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=("core", "related"), required=True)
    parser.add_argument("--plan", action="store_true", help="List metadata only without opening ZIP bytes")
    parser.add_argument("--skip-loose", action="store_true")
    args = parser.parse_args()
    catalog_path = PROJECT / ".cache/full-zip-catalog.json"
    catalog_raw = catalog_path.read_bytes()
    catalog = json.loads(catalog_raw)
    scenes = json.loads((PROJECT / "docs/source-blank-evidence.json").read_text(encoding="utf-8"))
    catalog_entries = {decode_name(entry["filename"]).replace("\\", "/"): entry for entry in catalog["entries"]}
    selected = build_selection(catalog_entries, scenes, args.phase)
    missing = [name for name in selected if name not in catalog_entries]
    if missing:
        raise ValueError(f"Selected paths absent from delivered ZIP catalog: {missing}")
    ordered = sorted(selected, key=lambda name: catalog_entries[name]["header_offset"])
    print(json.dumps({"phase": args.phase, "plannedFiles": len(ordered),
                      "bytes": sum(catalog_entries[n]["file_size"] for n in ordered),
                      "roles": dict(Counter(r["role"] for r in selected.values()))}, ensure_ascii=False), flush=True)
    if args.plan:
        for name in ordered:
            print(selected[name]["role"], catalog_entries[name]["file_size"], name)
        return 0
    archive = IndexedArchive(ARCHIVE)
    entries = {decode_name(entry.filename).replace("\\", "/"): entry for entry in archive.infolist()}
    if args.phase == "related" and EVIDENCE.exists():
        data = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    else:
        data = {
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "archiveIdentity": catalog["identity"],
            "catalogSha256": hashlib.sha256(catalog_raw).hexdigest(),
            "rawRoot": str(RAW_ROOT),
            "method": "All ZIP entries re-read directly from delivered archive, sorted by offset; size and CRC checked against stat-validated central directory. No HTTP or prior extracted-byte cache used.",
            "scenes": [{"id": s["id"], "title": s["title"], "sourceScene": s["sourceScene"],
                        "tileRoot": s["sourceEvidence"]["sourceTilePaths"][0].split(".tiles/")[0] + ".tiles/",
                        "matchingOriginal": ORIGINALS.get(s["id"]),
                        "interpretation": "content-needed" if s["gallery"] == "c03" else "possible-structural-placeholder"} for s in scenes],
            "files": {}, "errors": [], "phases": {},
        }
    data["phases"][args.phase] = {"plannedFiles": len(ordered), "selectedPaths": ordered,
                                "startedAt": datetime.now(timezone.utc).isoformat(), "complete": False}
    save(data)
    for count, name in enumerate(ordered, 1):
        try:
            raw = archive.read(entries[name])
            record = dict(selected[name])
            record.update({
                "source": "delivered-zip-direct-read", "bytes": len(raw),
                "expectedBytes": entries[name].file_size,
                "crc32": f"{zlib.crc32(raw):08x}", "expectedCrc32": f"{entries[name].CRC:08x}",
                "crcAndSizeVerified": len(raw) == entries[name].file_size and zlib.crc32(raw) == entries[name].CRC,
                "sha256": hashlib.sha256(raw).hexdigest(),
                "zipHeaderOffset": entries[name].header_offset,
                "compressedBytes": entries[name].compress_size,
                "extractedPath": safe_write(RAW_ROOT / "zip", name, raw),
                "readAt": datetime.now(timezone.utc).isoformat(),
            })
            if IMAGE_RE.search(name):
                record["image"] = image_evidence(raw)
                if record["role"] == "matching-original":
                    record["embeddedJpegPreviews"] = embedded_jpegs(raw)
            if not args.skip_loose:
                loose = ARCHIVE.parent.joinpath(*PurePosixPath(name).parts)
                if loose.is_file():
                    loose_raw = loose.read_bytes()
                    loose_record = {"path": str(loose), "bytes": len(loose_raw),
                                    "crc32": f"{zlib.crc32(loose_raw):08x}",
                                    "sha256": hashlib.sha256(loose_raw).hexdigest(),
                                    "matchesZip": loose_raw == raw,
                                    "extractedPath": safe_write(RAW_ROOT / "loose", name, loose_raw)}
                    if IMAGE_RE.search(name):
                        loose_record["image"] = image_evidence(loose_raw)
                    record["looseCopy"] = loose_record
                else:
                    record["looseCopy"] = {"path": str(loose), "present": False}
            data["files"][name] = record
            save(data)
            if count % 10 == 0 or record["role"] not in {"highest-resolution-tile", "lower-resolution-tile", "preview", "thumb"}:
                print(f"{args.phase} {count}/{len(ordered)} {name}: white={record.get('image', {}).get('pureWhite')} looseMatch={record.get('looseCopy', {}).get('matchesZip')}", flush=True)
        except Exception as error:
            data["phases"][args.phase]["status"] = "stopped-on-error"
            data["errors"].append({"phase": args.phase, "path": name, "type": type(error).__name__, "message": str(error), "at": datetime.now(timezone.utc).isoformat()})
            save(data)
            print(f"STOPPED: {type(error).__name__}: {error}; path={name}", flush=True)
            return 1
    data["phases"][args.phase].update({"complete": True, "status": "complete", "finishedAt": datetime.now(timezone.utc).isoformat()})
    save(data)
    print(json.dumps(data["summary"], ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
