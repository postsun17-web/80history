"""Acquire the public memorial sources and compile inert, self-hosted PSV assets.

All large inputs and generated outputs live on E:, never in the streamed handoff
folder. Downloads and face conversion are resumable; original bytes are retained
with SHA-256 provenance. No krpano JavaScript is shipped. Requires Pillow/requests.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import gzip
from html import unescape
from io import BytesIO
import json
import math
from pathlib import Path
import re
import shutil
import threading
import time
import xml.etree.ElementTree as ET

from PIL import Image
import requests

PROJECT = Path(__file__).resolve().parents[1]
SOURCE = Path('E:/CodexAssets/youngnak-memorial-source')
OUTPUT = Path('E:/CodexAssets/youngnak-memorial')
ORIGIN = 'http://youngnakdhm.net/'
FACES = ('f', 'r', 'b', 'l', 'u', 'd')
_thread = threading.local()


def source_path(value: str) -> str:
    return re.sub(r'%(?:FIRSTXML|VIEWER|CURRENTXML|SWFPATH)%/?', '', value).lstrip('/')


def local_asset(value: str) -> str:
    path = source_path(value)
    return '/media/memorial/' + path + ('.webp' if re.search(r'\.(?:png|jpe?g)$', path, re.I) else '')


def target_levels(sizes: list[int]) -> list[dict]:
    """Keep original face dimensions, but use the power-of-two grid PSV requires."""
    return [{'faceSize': size, 'tiles': min(16, 2 ** max(0, round(math.log2(size / 512)))), 'level': i + 1}
            for i, size in enumerate(sizes)]


def original_tile_path(pattern: str, face: str, level: int, row: int, col: int) -> str:
    return (pattern.replace('%s', face).replace('%l', str(level))
            .replace('%0v', f'{row + 1:02d}').replace('%0h', f'{col + 1:02d}'))


def scene_title(identifier: str) -> str:
    if identifier == 'scene_vr11':
        return '한경직목사기념관 입구'
    match = re.fullmatch(r'scene_hkj_([12])f_(\d+)', identifier)
    if not match:
        raise ValueError(f'Unknown memorial scene: {identifier}')
    floor, point = match.groups()
    return f'기념관 {floor}층 입구' if point == '01' else f'기념관 {floor}층 관람 지점 {int(point)}'


def object_title(value: str) -> str:
    return re.sub(r'\s+', ' ', unescape(value)).strip().replace('템플턴 매달', '템플턴 메달')


def compile_catalog(xml: str) -> tuple[dict, list[dict]]:
    tree = ET.fromstring(xml)
    result = {'id': 'memorial', 'title': '한경직목사기념관', 'defaultScene': 'scene_vr11',
              'scenes': [], 'zones': [], 'galleries': [], 'articles': {}, 'ebooks': [],
              'objects': {}, 'styles': {}, 'assets': {}, 'map': '', 'logo': '', 'intro': '',
              'menus': [{'title': '층 이동', 'items': [
                  {'title': '1층', 'scene': 'scene_hkj_1f_01', 'look': [0, 0, 110]},
                  {'title': '2층', 'scene': 'scene_hkj_2f_01', 'look': [0, 0, 110]}]}]}
    for node in tree.findall('style'):
        attrs = dict(node.attrib)
        name = attrs.pop('name')
        if 'url' in attrs:
            path = source_path(attrs['url'])
            attrs['url'] = result['assets'][path] = local_asset(path)
        result['styles'][name] = attrs
    sources = []
    for node in tree.findall('scene'):
        identifier = node.attrib['name'].lower()
        view = node.find('view')
        cube = node.find('image/cube')
        source_values = [int(n) for n in cube.attrib['multires'].split(',')]
        tile_size, sizes = source_values[0], source_values[1:]
        levels = target_levels(sizes)
        scene = {'id': identifier, 'title': scene_title(identifier), 'source': 'hgj.xml',
                 'view': [float(view.get('hlookat', 0)), float(view.get('vlookat', 0)), float(view.get('fov', 120))],
                 'pano': {'root': f'/media/memorial/panos/{identifier}', **levels[-1], 'ext': 'webp', 'levels': levels},
                 'hotspots': []}
        sound = re.search(r"playsound\(\s*[^,]+,\s*['\"]([^'\"]+)['\"]\s*,\s*false\s*,\s*([\d.]+)", node.get('onstart', ''))
        if sound:
            path = source_path(sound[1])
            scene['narration'] = {'src': local_asset(path), 'title': scene['title'] + ' 해설', 'volume': float(sound[2])}
            result['assets'][path] = local_asset(path)
        for item in node.findall('hotspot'):
            attrs = dict(item.attrib)
            hotspot = {'name': attrs['name'], 'attrs': attrs}
            match = re.search(r'spinzam\.com/shot/\?idx=(\d+)', attrs.get('onclick', ''))
            if match:
                obj_id = match[1]
                title = object_title(attrs.get('tooltip', ''))
                attrs['tooltip'] = title
                frames = [f'/media/memorial/objects/{obj_id}/{index:02d}.webp' for index in range(36)]
                result['objects'][obj_id] = {'id': obj_id, 'title': title, 'frames': frames, 'poster': frames[0]}
            scene['hotspots'].append(hotspot)
        result['scenes'].append(scene)
        sources.append({'id': identifier, 'pattern': cube.attrib['url'], 'sizes': sizes, 'tileSize': tile_size,
                        'thumbnail': node.get('thumburl'), 'levels': levels})
    return result, sources


def atomic_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str, path: Path, expected_size: tuple[int, int] | None = None) -> dict:
    """Never trust a cache entry without fully decoding images and checking size."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if not hasattr(_thread, 'session'):
        _thread.session = requests.Session()
        _thread.session.headers.update({'User-Agent': 'YoungnakMuseumMigration/1.0'})
    for attempt in range(6):
        try:
            if path.exists():
                raw = path.read_bytes()
            else:
                response = _thread.session.get(url, timeout=(15, 60))
                response.raise_for_status()
                raw = response.content
            if expected_size is not None:
                with Image.open(BytesIO(raw)) as decoded:
                    decoded.load()
                    if decoded.size != expected_size:
                        raise ValueError(f'{url}: expected {expected_size}, got {decoded.size}')
            if not path.exists():
                temporary = path.with_suffix(path.suffix + '.part')
                temporary.write_bytes(raw)
                temporary.replace(path)
            record = {'url': url, 'path': path.relative_to(SOURCE).as_posix(), 'bytes': len(raw), 'sha256': sha256(raw)}
            if expected_size:
                record['width'], record['height'] = expected_size
            return record
        except Exception:
            if attempt == 5:
                raise
            # Corrupt cache entries are kept for diagnosis, and then retried.
            if path.exists():
                path.replace(path.with_suffix(path.suffix + f'.invalid-{attempt}'))
            time.sleep(min(12, 0.8 * 2 ** attempt))
    raise AssertionError('unreachable')


def save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.part')
    try:
        image.save(temporary, 'WEBP', quality=92, method=4)
    except Exception as error:
        raise RuntimeError(f'WebP conversion failed for {path} ({image.width}x{image.height}, {image.mode}): {error}') from error
    temporary.replace(path)


def source_tile_jobs(source: dict, face: str, level: int) -> list[tuple]:
    size = source['sizes'][level - 1]
    tile_size = source['tileSize']
    count = math.ceil(size / tile_size)
    return [(original_tile_path(source['pattern'], face, level, row, col),
             (min(tile_size, size - col * tile_size), min(tile_size, size - row * tile_size)))
            for row in range(count) for col in range(count)]


def assemble_face(source: dict, face: str, level: int) -> Image.Image:
    size = source['sizes'][level - 1]
    tile_size = source['tileSize']
    face_image = Image.new('RGB', (size, size))
    count = math.ceil(size / tile_size)
    for row in range(count):
        for col in range(count):
            path = SOURCE / original_tile_path(source['pattern'], face, level, row, col)
            with Image.open(path) as tile:
                tile.load()
                expected = (min(tile_size, size - col * tile_size), min(tile_size, size - row * tile_size))
                if tile.size != expected:
                    raise ValueError(f'Incorrect source tile dimensions: {path}')
                face_image.paste(tile, (col * tile_size, row * tile_size))
    return face_image


def build_face(source: dict, face: str) -> str:
    """Process-pool entry point: at most one original face plus one resized face."""
    destination = OUTPUT / 'panos' / source['id'] / face
    marker = SOURCE / 'conversion' / f'{source["id"]}-{face}.json'
    highest = source['levels'][-1]
    expected = [destination / 'base.webp'] + [
        destination / str(spec['level']) / f'{row}_{col}.webp'
        for spec in source['levels'] for row in range(spec['tiles']) for col in range(spec['tiles'])]
    if marker.exists() and all(path.exists() for path in expected):
        return f'{source["id"]}/{face} cached'
    full = assemble_face(source, face, len(source['sizes']))
    try:
        with full.resize((512, 512), Image.Resampling.LANCZOS) as base:
            save_webp(base, destination / 'base.webp')
        count = 1
        for spec in source['levels']:
            size = spec['faceSize']
            working = full if full.width == size else full.resize((size, size), Image.Resampling.LANCZOS)
            try:
                tile_size = size // spec['tiles']
                assert tile_size * spec['tiles'] == size
                for row in range(spec['tiles']):
                    for col in range(spec['tiles']):
                        with working.crop((col * tile_size, row * tile_size, (col + 1) * tile_size, (row + 1) * tile_size)) as tile:
                            save_webp(tile, destination / str(spec['level']) / f'{row}_{col}.webp')
                        count += 1
            finally:
                if working is not full:
                    working.close()
    finally:
        full.close()
    atomic_json(marker, {'scene': source['id'], 'face': face, 'assets': count, 'faceSize': highest['faceSize']})
    return f'{source["id"]}/{face} converted {count}'


def bootstrap(catalog: dict, sources: list[dict], workers: int) -> None:
    records = []
    # Small source documents preserve original provenance but never ship at runtime.
    for path in ('hkjmuseum.html', 'hgj.xml', 'usvrplugins/xml/action2.xml'):
        records.append(fetch(ORIGIN + path, SOURCE / path))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        jobs = {}
        for source in sources:
            for face in FACES:
                for path, size in source_tile_jobs(source, face, 1):
                    jobs[pool.submit(fetch, ORIGIN + path, SOURCE / path, size)] = path
        for future in as_completed(jobs):
            records.append(future.result())
    for source in sources:
        for face in FACES:
            # A resumed bootstrap must not replace a completed high-resolution
            # derived base with the temporary low-source-resolution base.
            if (SOURCE / 'conversion' / f'{source["id"]}-{face}.json').exists():
                continue
            image = assemble_face(source, face, 1)
            save_webp(image.resize((512, 512), Image.Resampling.LANCZOS), OUTPUT / 'panos' / source['id'] / face / 'base.webp')
            image.close()
    for path, destination in catalog['assets'].items():
        records.append(fetch(ORIGIN + path, SOURCE / path))
        target = OUTPUT / destination.removeprefix('/media/memorial/')
        if target.suffix == '.webp':
            with Image.open(SOURCE / path) as image:
                save_webp(image, target)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(SOURCE / path, target)
    for obj_id, item in catalog['objects'].items():
        url = f'https://spinzam.com/shot/?idx={obj_id}'
        page = SOURCE / 'objects' / obj_id / 'index.html'
        records.append(fetch(url, page))
        html = page.read_text(encoding='utf-8')
        film = re.search(r"https://[^'\"\s]+_film\.jpg", html)
        if not film:
            raise ValueError(f'No public object filmstrip at {url}')
        strip_path = SOURCE / 'objects' / obj_id / 'film.jpg'
        records.append(fetch(film[0], strip_path, (640, 640 * 36)))
        with Image.open(strip_path) as strip:
            strip.load()
            for index, frame in enumerate(item['frames']):
                save_webp(strip.crop((0, index * 640, 640, (index + 1) * 640)), OUTPUT / frame.removeprefix('/media/memorial/'))
        print(f'Object {obj_id}: 36 decoded frames', flush=True)
    atomic_json(SOURCE / 'bootstrap-provenance.json', records)
    print(f'BOOTSTRAP READY: {len(sources)} panorama bases, {len(catalog["objects"])} objects, {sum("narration" in s for s in catalog["scenes"])} audio tracks', flush=True)


def panoramas(sources: list[dict], download_workers: int, conversion_workers: int) -> None:
    pending = []
    with ThreadPoolExecutor(max_workers=download_workers) as downloads, ProcessPoolExecutor(max_workers=conversion_workers) as conversions:
        for scene_index, source in enumerate(sources):
            for face in FACES:
                records = []
                jobs = [downloads.submit(fetch, ORIGIN + path, SOURCE / path, size)
                        for path, size in source_tile_jobs(source, face, len(source['sizes']))]
                for future in as_completed(jobs):
                    records.append(future.result())
                atomic_json(SOURCE / 'provenance' / f'{source["id"]}-{face}.json', sorted(records, key=lambda r: r['path']))
                pending.append(conversions.submit(build_face, source, face))
            completed = sum(f.done() for f in pending)
            print(f'SOURCE {scene_index + 1}/{len(sources)} {source["id"]}; conversion {completed}/{len(pending)} faces', flush=True)
            for future in pending:
                if future.done():
                    future.result()
        for index, future in enumerate(as_completed(pending)):
            result = future.result()
            if index % 6 == 0 or index == len(pending) - 1:
                print(f'CONVERT {index + 1}/{len(pending)} {result}', flush=True)


def verify_and_audit(catalog: dict, sources: list[dict]) -> None:
    expected = {}
    for source in sources:
        for face in FACES:
            expected[f'panos/{source["id"]}/{face}/base.webp'] = (512, 512)
            for spec in source['levels']:
                size = spec['faceSize'] // spec['tiles']
                for row in range(spec['tiles']):
                    for col in range(spec['tiles']):
                        expected[f'panos/{source["id"]}/{face}/{spec["level"]}/{row}_{col}.webp'] = (size, size)
    for item in catalog['objects'].values():
        for frame in item['frames']:
            expected[frame.removeprefix('/media/memorial/')] = (640, 640)
    for path in catalog['assets'].values():
        expected[path.removeprefix('/media/memorial/')] = None
    def inspect_asset(item: tuple[str, tuple[int, int] | None]) -> dict:
        path, size = item
        raw = (OUTPUT / path).read_bytes()
        if path.endswith('.webp'):
            with Image.open(BytesIO(raw)) as image:
                image.load()
                if size and image.size != size:
                    raise ValueError(f'Invalid output image {path}: {image.size}, expected {size}')
        return {'path': 'media/memorial/' + path, 'bytes': len(raw), 'sha256': sha256(raw)}
    # These workers each decode only one <=640px tile, not a complete 8704px
    # panorama face, so their memory bound remains small.
    with ThreadPoolExecutor(max_workers=4) as inspection:
        assets = list(inspection.map(inspect_asset, sorted(expected.items())))
    source_records = json.loads((SOURCE / 'bootstrap-provenance.json').read_text(encoding='utf-8'))
    for path in sorted((SOURCE / 'provenance').glob('*.json')):
        source_records.extend(json.loads(path.read_text(encoding='utf-8')))
    unique_records = {record['path']: record for record in source_records}
    atomic_json(SOURCE / 'source-provenance.json', sorted(unique_records.values(), key=lambda r: r['path']))
    atomic_json(SOURCE / 'generated-assets.json', assets)
    source_manifest_bytes = (SOURCE / 'source-provenance.json').read_bytes()
    compressed_provenance = gzip.compress(source_manifest_bytes, compresslevel=9, mtime=0)
    compressed_path = PROJECT / 'docs' / 'memorial-source-provenance.json.gz'
    compressed_path.parent.mkdir(parents=True, exist_ok=True)
    compressed_path.write_bytes(compressed_provenance)
    audit = {'schemaVersion': 1, 'capturedAt': datetime.now(timezone.utc).isoformat(),
             'source': ORIGIN + 'hkjmuseum.html', 'catalogue': 'src/data/memorial-museum.json',
             'counts': {'scenes': len(sources), 'movementLinks': sum(bool(h['attrs'].get('linkedscene')) for s in catalog['scenes'] for h in s['hotspots']),
                        'objects': len(catalog['objects']), 'objectFrames': sum(len(o['frames']) for o in catalog['objects'].values()),
                        'narrations': sum('narration' in scene for scene in catalog['scenes']), 'sourceFiles': len(unique_records),
                        'outputFiles': len(assets), 'outputBytes': sum(a['bytes'] for a in assets)},
             'panoramas': [{'scene': s['id'], 'sourceFaceSizes': s['sizes'], 'outputLevels': s['levels']} for s in sources],
             'conversion': {'format': 'WebP', 'quality': 92, 'method': 4, 'baseFaceSize': 512,
                            'rule': 'Highest original JPEG tiles are assembled without scaling; lower original face sizes are regenerated with Lanczos. Each level uses a power-of-two tile grid; maximum face dimensions are preserved.'},
             'sourceProvenanceSha256': sha256(source_manifest_bytes),
             'sourceProvenanceFile': {'path': 'docs/memorial-source-provenance.json.gz', 'compression': 'gzip',
                                      'bytes': len(compressed_provenance), 'sha256': sha256(compressed_provenance)},
             'generatedAssetsSha256': sha256((SOURCE / 'generated-assets.json').read_bytes()),
             'verification': {'allOutputImagesFullyDecoded': True, 'allOriginalTilesFullyDecoded': True,
                              'audioEndToEndPlayback': 'Runtime verification required; byte hashes alone do not prove complete playback.'},
             'sources': [r for r in source_records if not r['path'].startswith('panos/')],
             'objects': [{'id': o['id'], 'title': o['title'], 'frames': len(o['frames'])} for o in catalog['objects'].values()]}
    atomic_json(PROJECT / 'docs' / 'memorial-source-audit.json', audit)
    print(json.dumps(audit['counts']), flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=('catalogue', 'bootstrap', 'panos', 'verify', 'all'), default='all')
    parser.add_argument('--download-workers', type=int, default=12)
    # Limit full-resolution memory contention while browsers and audio
    # verification are using the same workstation.
    parser.add_argument('--conversion-workers', type=int, default=1)
    args = parser.parse_args()
    SOURCE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    fetch(ORIGIN + 'hgj.xml', SOURCE / 'hgj.xml')
    catalog, sources = compile_catalog((SOURCE / 'hgj.xml').read_text(encoding='utf-8-sig'))
    ids = {scene['id'] for scene in catalog['scenes']}
    movement = [h['attrs']['linkedscene'] for s in catalog['scenes'] for h in s['hotspots'] if h['attrs'].get('linkedscene')]
    assert len(ids) == 29 and len(movement) == 67 and all(target in ids for target in movement)
    assert len(catalog['objects']) == 17 and sum('narration' in s for s in catalog['scenes']) == 10
    atomic_json(PROJECT / 'src' / 'data' / 'memorial-museum.json', catalog)
    atomic_json(SOURCE / 'panorama-sources.json', sources)
    print('CATALOGUE READY: 29 scenes / 67 movements / 17 objects / 10 narrations', flush=True)
    if args.phase in ('bootstrap', 'all'):
        bootstrap(catalog, sources, args.download_workers)
    if args.phase in ('panos', 'all'):
        panoramas(sources, args.download_workers, args.conversion_workers)
    if args.phase in ('verify', 'all'):
        verify_and_audit(catalog, sources)


if __name__ == '__main__':
    main()
