"""Build C-room panorama copies and the new E-room cubemaps without changing delivered files.

Run with Vite serving this checkout on E_ROOM_RENDER_URL (default 127.0.0.1:5173).
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageFilter
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.parse
import xml.etree.ElementTree as ET

PROJECT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get('YOUNGNAK_SOURCE', r'G:\내 드라이브\영락역사관'))
OUTPUT = PROJECT / 'public/media/v1'
CHROME = Path(os.environ.get('E_ROOM_CHROME', r'C:\Program Files\Google\Chrome\Application\chrome.exe'))
RENDER_URL = os.environ.get('E_ROOM_RENDER_URL', 'http://127.0.0.1:5173/tools/render_e_room.html')
SCRATCH = Path(os.environ.get('E_ROOM_SCRATCH', str(
    Path(tempfile.gettempdir()) / f'youngnak-e-room-{hashlib.sha256(str(PROJECT).encode("utf-8")).hexdigest()[:12]}'
)))
FACES = 'fblrud'
COPIES = {'a-right': 'A-s-e+1', 'c-entry': 'C-c-s-1', 'c-center': 'C-c-s-0', 'c-right': 'C-s-e+1'}


def extend_museum_data() -> None:
    path = PROJECT / 'src/data/museum.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    if any(scene['id'] == 'scene_ext-e-center' for scene in data['scenes']):
        assert len(data['scenes']) == 9, 'Unexpected scene set in existing extension'
        return
    original_width, height = data['mapSize']
    assert original_width == 1733 and height == 2220, data['mapSize']
    map_width = 2200
    for scene in data['scenes']:
        scene['map']['x'] *= original_width / map_width
    points = {item.get('erscena'): item for item in ET.parse(SOURCE / 'floorplan_SM/setting_FP.xml').getroot().iter('layer') if item.get('erscena')}
    delivered = [
        ('scene_a-s-e+1', 'a-right', 'A존 오른쪽 연결부', 'A · EAST', 'C존으로 이어지는 길', 87.16),
        ('scene_c-c-s-1', 'c-entry', 'C존 입구', 'C · ENTRANCE', '영락교회와 한국기독교', -1.658),
        ('scene_c-c-s-0', 'c-center', 'C존 중앙', 'C · CENTER', '영락교회와 한국기독교', 89.497),
        ('scene_c-s-e+1', 'c-right', 'C존 오른쪽', 'C · EAST', '새 전시실로 이어지는 곳', 90),
    ]
    for id, key, title, label, subtitle, ath in delivered:
        point = points[id]
        data['scenes'].append({'id': id, 'key': key, 'title': title, 'label': label, 'subtitle': subtitle,
                               'ath': ath, 'atv': 0, 'fov': 105,
                               'map': {'x': float(point.get('x')) / map_width * 100,
                                       'y': float(point.get('y')) / height * 100,
                                       'heading': float(point.get('heading2'))},
                               'viewSource': 'tour.xml and floorplan_SM/setting_FP.xml; framing chosen for linked room',
                               'thumb': f'/media/v1/thumbs/{key}.jpg',
                               'pano': {'faceSize': 2048, 'tiles': 4, 'level': 2, 'ext': 'jpg'}})
    proposed = [
        ('scene_ext-e-entry', 'e-entry', 'E 전시실 입구', 'E · ENTRY', '새로운 전시를 준비하는 공간', 1650, 930, 90),
        ('scene_ext-e-center', 'e-center', 'E 전시실', 'E · GALLERY', '기존 공간과 이어지는 빈 전시실', 1860, 850, -90),
    ]
    for id, key, title, label, subtitle, x, y, ath in proposed:
        data['scenes'].append({'id': id, 'key': key, 'title': title, 'label': label, 'subtitle': subtitle,
                               'ath': ath, 'atv': 0, 'fov': 100,
                               'map': {'x': x / map_width * 100, 'y': y / height * 100, 'heading': 179.5},
                               'viewSource': 'Proposed E-room extension; original did not contain these rooms',
                               'thumb': f'/media/v1/thumbs/{key}.jpg',
                               'pano': {'faceSize': 1024, 'tiles': 1, 'level': 1, 'ext': 'webp'}})
    data['mapSize'] = [map_width, height]
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def stitch(folder: Path, face: str, level: int, size: int) -> Image.Image:
    result = Image.new('RGB', (size, size))
    count = size // 512
    for row in range(1, count + 1):
        for col in range(1, count + 1):
            tile = folder / face / f'l{level}' / str(row) / f'l{level}_{face}_{row}_{col}.jpg'
            with Image.open(tile) as image:
                assert image.size == (512, 512), tile
                result.paste(image, ((col - 1) * 512, (row - 1) * 512))
    return result


def portal_face(original: Image.Image) -> Image.Image:
    with Image.open(PROJECT / 'tools/assets/c-right-portal.png') as generated:
        generated = generated.convert('RGB').resize(original.size, Image.Resampling.LANCZOS)
    mask = Image.new('L', original.size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).rectangle((215, 180, 1833, 1868), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(95))
    return Image.composite(generated, original, mask)


def save_original_rooms() -> None:
    for key, name in COPIES.items():
        folder = SOURCE / 'panos' / f'{name}.tiles'
        assert folder.is_dir(), folder
        for face in FACES:
            out = OUTPUT / 'panos' / key / face
            (out / '2').mkdir(parents=True, exist_ok=True)
            if key == 'c-right' and face == 'r':
                medium = portal_face(stitch(folder, face, 2, 2048))
                medium.resize((1024, 1024), Image.Resampling.LANCZOS).save(out / 'base.webp', lossless=True)
                for row in range(4):
                    for col in range(4):
                        medium.crop((col * 512, row * 512, (col + 1) * 512, (row + 1) * 512)).save(
                            out / '2' / f'{row}_{col}.jpg', quality=94, subsampling=0)
            else:
                stitch(folder, face, 1, 1024).save(out / 'base.webp', lossless=True)
                for row in range(4):
                    for col in range(4):
                        source = folder / face / 'l2' / str(row + 1) / f'l2_{face}_{row + 1}_{col + 1}.jpg'
                        shutil.copyfile(source, out / '2' / f'{row}_{col}.jpg')
        target = OUTPUT / 'thumbs' / f'{key}.jpg'
        target.parent.mkdir(parents=True, exist_ok=True)
        if key == 'c-right':
            with Image.open(OUTPUT / 'panos/c-right/r/base.webp') as image:
                image.resize((400, 400), Image.Resampling.LANCZOS).save(target, quality=88)
        else:
            shutil.copyfile(folder / 'thumb.jpg', target)
        print('Original room prepared:', key, flush=True)


def capture(view: str, face: str) -> Image.Image:
    SCRATCH.mkdir(parents=True, exist_ok=True)
    screenshot = SCRATCH / f'{view}-{face}.png'
    profile = SCRATCH / f'chrome-{view}-{face}'
    url = RENDER_URL + '?' + urllib.parse.urlencode({'view': view, 'face': face})
    common = [str(CHROME), '--headless=new', '--no-first-run', '--disable-gpu',
              '--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-device-scale-factor=1',
              '--window-size=1024,1024', '--virtual-time-budget=3000', f'--user-data-dir={profile}']
    ready = subprocess.run([*common, '--dump-dom', url], check=True, capture_output=True,
                           text=True, encoding='utf-8', errors='replace', timeout=45)
    assert f'<title>ready-{view}-{face}</title>' in ready.stdout, \
        f'E-room render was not ready for {view}/{face} at {url}'
    screenshot.unlink(missing_ok=True)
    command = [*common, f'--screenshot={screenshot}', url]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=45)
    deadline = time.monotonic() + 45
    while not screenshot.exists() and time.monotonic() < deadline:
        time.sleep(.15)
    assert screenshot.exists(), f'Chrome did not capture {view}/{face}'
    with Image.open(screenshot) as image:
        assert image.size == (1024, 1024), (view, face, image.size)
        return image.convert('RGB')


def save_new_room() -> None:
    for view in ('entry', 'center'):
        key = 'e-' + view
        for face in FACES:
            image = capture(view, face)
            out = OUTPUT / 'panos' / key / face
            (out / '1').mkdir(parents=True, exist_ok=True)
            image.save(out / 'base.webp', quality=92, method=6)
            image.save(out / '1' / '0_0.webp', quality=92, method=6)
            if face == 'l':
                thumb = OUTPUT / 'thumbs' / f'{key}.jpg'
                thumb.parent.mkdir(parents=True, exist_ok=True)
                image.resize((400, 400), Image.Resampling.LANCZOS).save(thumb, quality=88)
        print('New room rendered:', key, flush=True)


def update_manifest() -> None:
    path = PROJECT / 'docs/source-map.json'
    manifest = json.loads(path.read_text(encoding='utf-8'))
    assets = {item['path']: item for item in manifest['assets']}
    for key in (*COPIES, 'e-entry', 'e-center'):
        paths = list((OUTPUT / 'panos' / key).rglob('*')) + [OUTPUT / 'thumbs' / f'{key}.jpg']
        for file in paths:
            if not file.is_file():
                continue
            url = '/' + file.relative_to(PROJECT / 'public').as_posix()
            source = f'panos/{COPIES[key]}.tiles' if key in COPIES else 'tools/render_e_room.html'
            if key == 'c-right':
                source += ' + tools/assets/c-right-portal.png'
            assets[url] = {'path': url, 'source': source, 'kind': 'derived-room',
                           'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
    manifest['assets'] = list(assets.values())
    manifest['rulings'] = [r for r in manifest['rulings'] if 'main XML unavailable' not in r]
    manifest['rulings'].append('Main tour.xml was found editable in the delivered ZIP; C transition values are taken from it.')
    manifest['rulings'].append('E room is a proposed extension: two consistent rendered viewpoints, not delivered historical footage.')
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    save_original_rooms()
    save_new_room()
    extend_museum_data()
    update_manifest()
    print('E-room asset build complete.', flush=True)
