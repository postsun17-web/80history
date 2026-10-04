"""Compile delivered visitor content into inert PSV data; never execute XML actions.

Input is the text-only ZIP extraction in .cache/full-source. Runtime style values
may be supplemented by a read-only export from the original public viewer.
Binary generation belongs to prepare_full_assets.py, not this compiler.
"""
from __future__ import annotations

import argparse
from collections import Counter
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import posixpath
import re
import sys
import xml.etree.ElementTree as ET

PROJECT = Path(__file__).resolve().parents[1]
IMAGE = re.compile(r"\.(?:png|jpe?g|gif|bmp)$", re.I)
MEDIA = re.compile(r"\.(?:png|jpe?g|gif|bmp|webp|svg|mp3|mp4|pdf|html)$", re.I)
TOKENS = re.compile(r"%(?:FIRSTXML|VIEWER|CURRENTXML|SWFPATH|HTMLPATH)%/?", re.I)
GALLERY = re.compile(r"photo/([^/'\"\s]+)/index\.html\?startscene=(\d+)")


def active_xml(value: str) -> str:
    return re.sub(r"<!--.*?-->", "", value, flags=re.S)


def source_path(value: str) -> str:
    value = TOKENS.sub("", unescape(value).strip()).replace("\\", "/")
    value = re.sub(r"^https?://youngnakdhm\.net/", "", value, flags=re.I)
    value = value.split("?")[0].split("#")[0]
    return posixpath.normpath(value) if not re.match(r"https?://", value) else value


def asset_url(value: str) -> str:
    path = source_path(value)
    if re.match(r"(?:https?:|data:|/media/)", path):
        return path
    return "/media/full/" + path + (".webp" if IMAGE.search(path) else "")


def gallery_targets(value: str) -> set[tuple[str, int]]:
    # A07's live action uses a07-2; the delivered actual folder is a07-02.
    return {(g.replace("a07-2", "a07-02"), int(i)) for g, i in GALLERY.findall(value)}


def plain(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]*>|\[br\]", " ", value))).strip()


def hotspot(node: ET.Element) -> dict:
    value = {"name": node.get("name", ""), "attrs": dict(node.attrib)}
    points = [[float(p.get("ath", "0")), float(p.get("atv", "0"))] for p in node.findall("point")]
    if points:
        value["points"] = points
    return value


def dimensions(node: ET.Element) -> tuple[int, int]:
    last = node.get("multires", "").split(",")[-1]
    if not re.fullmatch(r"\d+(?:x\d+)?", last):
        raise ValueError(f"Unsupported source image dimensions: {last!r}")
    dims = [int(v) for v in last.split("x")]
    return dims[0], dims[-1]


def menu_item(node: ET.Element, scenes: set[str]) -> dict:
    action = node.get("onclick", "")
    item = {"title": plain(node.get("html", "") or node.get("tooltip", "") or node.get("name", "")), "action": action}
    match = re.search(r"loadscene\(\s*([^,\s)]+)", action)
    if match and match[1].lower() in scenes:
        item["scene"] = match[1].lower()
    look = re.search(r"look(?:to|at)\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)", action)
    if look:
        item["look"] = [float(x) for x in look.groups()]
    url = re.search(r"(?:openurl|popup2?)\(\s*(?:'iframe'\s*,\s*)?['\"]([^'\"]+)['\"]", action)
    if url:
        item["url"] = url[1]
    return item


class ArticleTitle(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.values = {"title": [], "h1": [], "h2": [], "p": []}
        self.buffers = []

    def handle_starttag(self, tag, attrs):
        if tag in self.values:
            self.buffers.append([tag, []])

    def handle_endtag(self, tag):
        for index in range(len(self.buffers) - 1, -1, -1):
            if self.buffers[index][0] == tag:
                _, data = self.buffers.pop(index)
                text = plain(" ".join(data))
                if text:
                    self.values[tag].append(text)
                break

    def handle_data(self, data):
        for _, parts in self.buffers:
            parts.append(data)

    def result(self, fallback: str) -> str:
        for tag in ("h1", "h2", "title", "p"):
            for value in self.values[tag]:
                if value not in {"영락교회", "영락교회 디지털역사관", "Untitled Document"}:
                    return value if len(value) <= 90 else value[:87] + "…"
        return fallback


class EbookCards(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.card = None
        self.cards = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "div":
            if self.card is not None:
                self.depth += 1
            elif "gallery-item" in attrs.get("class", "").split():
                # One delivered card misspells onclick as nclick. Its cover,
                # caption and complete reader URL are still authoritative.
                match = re.search(r"https://heyzine\.com/flip-book/[^'\"]+", attrs.get("onclick", "") or attrs.get("nclick", ""))
                if match:
                    self.card = {"titleParts": [], "category": attrs.get("data-cat", "기타"), "url": re.sub(r"\s+", "", match[0])}
                    self.depth = 1
        if self.card is not None and tag == "img":
            self.card["sourceCover"] = attrs.get("src", "")

    def handle_data(self, value):
        if self.card is not None:
            self.card["titleParts"].append(value)

    def handle_endtag(self, tag):
        if self.card is not None and tag == "div":
            self.depth -= 1
            if not self.depth:
                self.card["title"] = plain(" ".join(self.card.pop("titleParts")))
                self.cards.append(self.card)
                self.card = None


def compile_museum(source: Path, existing_file: Path, runtime_styles_file: Path) -> dict:
    text_cache = {}
    tree_cache = {}
    def text(path):
        if path not in text_cache:
            text_cache[path] = active_xml((source / path).read_text(encoding="utf-8-sig"))
        return text_cache[path]
    def tree(path):
        if path not in tree_cache:
            tree_cache[path] = ET.fromstring(text(path))
        return tree_cache[path]

    main = tree("tour.xml")
    outside = tree("outside.xml")
    raw_scenes = [("tour.xml", s) for s in main.findall("scene")] + [("outside.xml", s) for s in outside.findall("scene")]
    scene_ids = {s.get("name").lower() for _, s in raw_scenes}
    scene_zone = dict(re.findall(r"if\(xml.scene == '([^']+)'.*?list_change_(\w+)\(01\)", text("tour.xml")))
    scene_zone = {s.lower(): zone for s, zone in scene_zone.items()}
    menu_layers = list(tree("combobox.xml").iter("layer"))
    labels = {}
    for layer in menu_layers:
        if not layer.get("name", "").startswith("menu_txt_"):
            continue
        item = menu_item(layer, scene_ids)
        if "scene" in item:
            labels.setdefault(item["scene"], item["title"])
    map_points = {n.get("erscena").lower(): n.attrib for n in tree("floorplan_SM/setting_FP.xml").iter("layer") if n.get("erscena")}
    globals_ = tree("pannel.xml").findall("hotspot")
    scenes = []
    for source_file, node in raw_scenes:
        scene_id = node.get("name").lower()
        view = node.find("view")
        point = map_points.get(scene_id)
        source_hotspots = list(node.findall("hotspot")) + [h for h in globals_ if h.get("id", "").lower() == scene_id]
        entry = {
            "id": scene_id,
            "title": labels.get(scene_id) or (point or {}).get("tit_scena") or node.get("title", scene_id),
            "source": source_file,
            "view": [float(view.get(k, default)) for k, default in [("hlookat", "0"), ("vlookat", "0"), ("fov", "100")]],
            "pano": {"root": f"/media/full/panos/{scene_id}", "faceSize": 2048, "tiles": 4, "level": 2, "ext": "webp"},
            "hotspots": [hotspot(h) for h in source_hotspots],
        }
        if point:
            entry["map"] = {"x": float(point["x"]) / 2200 * 100, "y": float(point["y"]) / 2220 * 100, "heading": float(point.get("heading2", "0"))}
        if scene_id in scene_zone:
            entry["zone"] = scene_zone[scene_id]
        if scene_id == "scene_c-s-e+1":
            entry["pano"] = {"root": "/media/v1/panos/c-right", "faceSize": 2048, "tiles": 4, "level": 2, "ext": "jpg"}
        scenes.append(entry)

    existing = json.loads(existing_file.read_text(encoding="utf-8"))
    for s in existing["scenes"]:
        if s["id"].startswith("scene_ext-"):
            scenes.append({"id": s["id"], "title": s["title"], "source": "approved-e-extension", "view": [s["ath"], s["atv"], s["fov"]], "map": s["map"], "pano": {"root": "/media/v1/panos/" + s["key"], **s["pano"]}, "hotspots": []})
    by_id = {s["id"]: s for s in scenes}
    ext_links = [
        ("scene_c-s-e+1", "scene_ext-e-entry", 90, 15, "E 전시실로", "90,0,100"),
        ("scene_ext-e-entry", "scene_c-s-e+1", -90, 15, "C존으로 돌아가기", "-92,0,105"),
        ("scene_ext-e-entry", "scene_ext-e-center", 90, 16, "E 전시실 안쪽으로", "90,0,100"),
        ("scene_ext-e-center", "scene_ext-e-entry", -90, 16, "E 전시실 입구로", "-90,0,100"),
    ]
    for origin, target, yaw, pitch, label, look in ext_links:
        name = "extension_to_" + target
        by_id[origin]["hotspots"].append({"name": name, "attrs": {"name": name, "style": "skin_hotspotstyle", "ath": str(yaw), "atv": str(pitch), "linkedscene": target, "linkedscene_lookat": look, "tooltip": label}})

    zones = []
    action_files = sorted(p.name for p in source.glob("list_*_action.xml"))
    for scene, zone in sorted(scene_zone.items(), key=lambda x: x[1]):
        xml = tree(f"list_{zone}_action.xml")
        buttons = []
        for h in xml.findall("hotspot"):
            match = re.search(r"list_change_" + zone + r"\((\d+)\)", h.get("onclick", ""))
            if h.get("name", "").startswith("listspot") and match:
                number = int(match[1])
                buttons.append({"number": number, "title": plain(h.get("tooltip", "")) or f"{number}쪽", "image": asset_url(f"img/sector_{zone}_{number:02}.png"), "hotspots": [hotspot(x) for x in xml.findall("hotspot") if x.get("tag") == f"{number}p"]})
                # These original dots live on the panorama wall, independently
                # of page-specific exhibit links. Keep their source placement.
                by_id[scene]["hotspots"].append(hotspot(h))
            elif h.get("style") in {"nextb", "prevb"}:
                # Their onclick is assigned dynamically by list_check_* in
                # krpano; the viewer derives next/previous from current page.
                by_id[scene]["hotspots"].append(hotspot(h))
        zones.append({"id": zone, "title": labels.get(scene, zone.upper()), "scene": scene, "pages": sorted(buttons, key=lambda x: x["number"])})

    runtime_files = ["tour.xml", "pannel.xml", "outside.xml", "action.xml", "qmenu.xml", "mobile_menu.xml", "combobox.xml", "media_mobile.xml", *action_files]
    runtime_text = "\n".join(text(f) for f in runtime_files)
    targets = gallery_targets(runtime_text)
    galleries = []
    gallery_ids = sorted({g for g, _ in targets})
    for gallery in [*gallery_ids, "help"]:
        gallery_file = "info/tour.xml" if gallery == "help" else f"photo/{gallery}/tour.xml"
        xml = tree(gallery_file)
        items = []
        for index, scene in enumerate(xml.findall("scene")):
            image = scene.find("image/flat")
            cube = scene.find("image/cube")
            if image is None:
                image = cube
            if image is None:
                raise ValueError(f"Gallery scene has no image: {gallery}:{index}")
            w, h = dimensions(image)
            entry = {"id": f"{gallery}:{index}", "title": plain(scene.get("title", "")), "image": f"/media/full/galleries/{gallery}/{index}.webp", "width": w, "height": h}
            if cube is not None:
                entry["faces"] = {face: f"/media/full/galleries/{gallery}/{index}-{face}.webp" for face in "fblrud"}
            items.append(entry)
        zone = next((z for z in zones if gallery == z["id"]), None)
        galleries.append({"id": gallery, "title": "디지털역사관 관람 안내" if gallery == "help" else (zone["title"] if zone else f"{gallery.upper()} 사진자료"), "items": items})

    articles = {}
    article_paths = sorted(set(re.findall(r"html/[\w-]+\.html", runtime_text)))
    for path in article_paths:
        parser = ArticleTitle()
        parser.feed(text(path))
        articles[path] = {"title": parser.result(Path(path).stem.upper()), "url": asset_url(path)}

    menus = []
    for group, title in [("f", "MAIN LOBBY"), ("a", "A 영락교회 성장 및 발전"), ("b", "B 영락교회와 한국사회"), ("c", "C 영락교회와 한국기독교"), ("d", "D 영락교회 5대 본질"), ("e", "영락연계")]:
        nodes = [n for n in menu_layers if re.fullmatch(r"menu_txt_" + group + r"\d+a?", n.get("name", ""))]
        menus.append({"title": title, "items": [menu_item(n, scene_ids) for n in nodes]})
    quick_names = {"qmenu_ico01": "처음으로", "qmenu_ico02": "챗봇", "qmenu_ico05": "E-BOOK", "qmenu_ico06": "한경직 목사 기념관", "qmenu_ico04": "80주년 영락다큐"}
    quick = []
    for node in tree("qmenu.xml").iter("layer"):
        if node.get("name") in quick_names:
            quick.append({**menu_item(node, scene_ids), "title": quick_names[node.get("name")]})

    # The media centre's menus are scene-level combobox children, not hotspots.
    # Keep its original grouping and the intentionally empty 'preparing' item.
    media_sections = []
    media_ids = set()
    youtube_id = re.compile(r"youtube\.com/(?:embed/|watch\?v=)([A-Za-z0-9_-]{11})")
    for combo in main.iter("combobox"):
        nodes = combo.findall("item")
        if not any("youtube.com" in n.get("onclick", "") for n in nodes):
            continue
        heading = next((n.get("caption") for n in nodes if n.get("name") == "item0"), combo.get("name"))
        items = []
        for node in nodes:
            if node.get("name") == "item0":
                continue
            action = node.get("onclick", "")
            items.append({"title": plain(node.get("caption", "")), "action": action})
            media_ids.update(youtube_id.findall(action))
        media_sections.append({"title": plain(heading), "items": items})
    doc_items = []
    for index, node in enumerate(h for h in main.iter("hotspot") if h.get("style") == "b_dacu"):
        action = node.get("onclick", "")
        doc_items.append({"title": menus[index + 1]["title"], "action": action})
        media_ids.update(youtube_id.findall(action))
    if doc_items:
        media_sections.append({"title": "80주년 영락다큐", "items": doc_items})
    extra_media = []
    for file in runtime_files:
        for node in tree(file).iter():
            for key in ("onclick", "onloaded"):
                action = node.get(key, "")
                ids_in_action = youtube_id.findall(action)
                if ids_in_action and not set(ids_in_action).issubset(media_ids):
                    title = plain(node.get("tooltip") or node.get("title") or node.get("caption") or "전시 영상")
                    extra_media.append({"title": title, "action": action})
                    media_ids.update(ids_in_action)
        for node in tree(file).iter("action"):
            for url in re.findall(r"https://www\.youtube\.com/[^'\"]+", node.text or ""):
                ids_in_url = youtube_id.findall(url)
                if ids_in_url and not set(ids_in_url).issubset(media_ids):
                    extra_media.append({"title": "영락교회 소개 영상", "action": f"popup2('iframe','{url}',1100,606,false);"})
                    media_ids.update(ids_in_url)
    if extra_media:
        media_sections.append({"title": "전시 안내영상", "items": extra_media})

    book_parser = EbookCards()
    book_parser.feed(text("e-book.html"))
    ebooks = [{"title": b["title"], "category": b["category"], "cover": asset_url(b["sourceCover"]), "url": b["url"]} for b in book_parser.cards]

    styles = {}
    for path in ["skin/vtourskin.xml", *runtime_files]:
        for node in tree(path).iter("style"):
            styles[node.get("name")] = {k: v for k, v in node.attrib.items() if k != "name"}
    if runtime_styles_file.exists():
        runtime_styles = json.loads(runtime_styles_file.read_text(encoding="utf-8-sig"))
        for name, attrs in runtime_styles.items():
            styles[name] = {k: str(v).lower() if isinstance(v, bool) else str(v) for k, v in attrs.items() if k not in {"_type", "index", "name"} and isinstance(v, (str, int, float, bool))}

    assets = {}
    def register(raw):
        path = source_path(raw)
        if MEDIA.search(path) and not re.match(r"https?://|data:|/media/", path) and "%" not in path:
            assets[path] = asset_url(path)
            assets[raw] = asset_url(path)
    for path in [*runtime_files, "floorplan_SM/setting_FP.xml"]:
        for node in tree(path).iter():
            for k in ("url", "thumburl", "videourl"):
                register(node.get(k, ""))
        # Actions contain both quoted and unquoted URLs (notably add_iframe).
        for raw in re.findall(r"(?:%(?:FIRSTXML|VIEWER|CURRENTXML|SWFPATH)%/|\./)?(?:images|img|mov|mp3|html|info|photo)/[^\s'\"<>;,()]+", text(path)):
            register(raw)
    for attrs in styles.values():
        register(attrs.get("url", ""))
    for path in article_paths:
        register(path)
        for raw in re.findall(r"<img[^>]+src\s*=\s*['\"]([^'\"]+)['\"]", text(path), flags=re.I):
            if not re.match(r"https?://|data:", raw):
                register(posixpath.normpath(posixpath.join("html", raw)))
    for zone in zones:
        for page in zone["pages"]:
            register(f"img/sector_{zone['id']}_{page['number']:02}.png")
    for b in book_parser.cards:
        register(b["sourceCover"])
    for folder in ("01", "02", "04"):
        for frame in range(36):
            register(f"ovr/{folder}/{frame}.png")
    for raw in ["floorplan_SM/plan/map.png", "images/logo1.png", "info/intro.png", "mov/opendoor.mp4", "mp3/bg_short1.mp3"]:
        register(raw)
    # Proven source typo: same panel basename is delivered under img/.
    for raw in ["images/sector_a1_03a.png", "%FIRSTXML%/images/sector_a1_03a.png"]:
        assets[raw] = asset_url("img/sector_a1_03a.png")
    # Two active decorative objects duplicate the "ob" prefix in their URL.
    # The exact existing medallion image is used by six other A viewpoints.
    # Resolve only the asset path; retain source geometry and absent onclick.
    for raw in ["images/obob002-3.png", "%FIRSTXML%/images/obob002-3.png"]:
        assets[raw] = asset_url("images/ob002-3.png")
    return {"scenes": scenes, "zones": zones, "galleries": galleries, "articles": articles, "menus": menus, "quickMenu": quick, "mediaSections": media_sections, "ebooks": ebooks, "styles": styles, "assets": dict(sorted(assets.items())), "map": asset_url("floorplan_SM/plan/map.png"), "mapSize": [2200, 2220], "logo": asset_url("images/logo1.png"), "intro": asset_url("info/intro.png")}


def validate(data: dict, source: Path) -> dict:
    ids = [s["id"] for s in data["scenes"]]
    assert len(ids) == len(set(ids)), "Duplicate scene IDs"
    for scene in data["scenes"]:
        for h in scene["hotspots"]:
            linked = h["attrs"].get("linkedscene", "").lower()
            if linked:
                assert linked in ids, f"Unresolved destination {scene['id']} -> {linked}"
    for zone in data["zones"]:
        pages = [p["number"] for p in zone["pages"]]
        assert pages == list(range(1, len(pages) + 1)), f"Non-contiguous pages: {zone['id']}"
        assert zone["scene"] in ids, f"Unresolved zone scene {zone['id']}"
    galleries = {g["id"]: g for g in data["galleries"]}
    actions = "\n".join(active_xml(p.read_text(encoding="utf-8-sig")) for p in source.glob("*.xml") if p.name != "a2_111.xml")
    for gallery, index in gallery_targets(actions):
        assert gallery in galleries and index < len(galleries[gallery]["items"]), f"Unresolved gallery link: {gallery}:{index}"
    media_ids = set(re.findall(r"youtube\.com/(?:embed/|watch\?v=)([A-Za-z0-9_-]{11})", json.dumps(data["mediaSections"])))
    return {"scenes": len(ids), "zones": len(data["zones"]), "pages": sum(len(z["pages"]) for z in data["zones"]), "pageHotspots": sum(len(p["hotspots"]) for z in data["zones"] for p in z["pages"]), "galleries": len(galleries), "galleryItems": sum(len(g["items"]) for g in galleries.values()), "articles": len(data["articles"]), "ebooks": len(data["ebooks"]), "mediaSections": len(data["mediaSections"]), "youtubeIds": len(media_ids), "styles": len(data["styles"]), "assetAliases": len(data["assets"])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=PROJECT / ".cache/full-source")
    parser.add_argument("--output", type=Path, default=PROJECT / "src/data/full-museum.json")
    args = parser.parse_args()
    data = compile_museum(args.source, PROJECT / "src/data/museum.json", PROJECT / ".cache/runtime-styles.json")
    counts = validate(data, args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(counts, ensure_ascii=False))
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
