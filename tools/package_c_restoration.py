"""Package the delivered C02 panorama as a small supplement to existing archives.

Reads the full-asset cache and optionally compares every detailed tile to its
delivered JPEG. Does not modify the cache, original media, or deployment manifest.
"""
from pathlib import Path
from io import BytesIO
import argparse
import hashlib
import json
import zipfile
from PIL import Image, ImageChops, ImageStat


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--delivered', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve()
    folder = source / 'panos/scene_c-s-e+1'
    provenance = json.loads((source / 'asset-manifest.json').read_text(encoding='utf-8'))['files']
    entries, checks = [], []
    expected = []
    for face in 'fblrud':
        expected.append(folder / face / 'base.webp')
        for row in range(4):
            for col in range(4):
                expected.append(folder / face / '2' / f'{row}_{col}.webp')
    actual = set(folder.rglob('*.webp'))
    if actual != set(expected):
        raise ValueError('C02 must contain exactly six base faces and 96 detail tiles')
    for path in sorted(expected):
        relative = path.relative_to(source).as_posix()
        record = provenance.get(relative, {})
        if record.get('source') != 'tour.xml#scene_c-s-e+1':
            raise ValueError(f'Unexpected provenance: {relative}')
        data = path.read_bytes()
        if len(data) != record.get('bytes'):
            raise ValueError(f'Cached asset length changed: {relative}')
        with Image.open(BytesIO(data)) as encoded:
            encoded = encoded.convert('RGB')
            if encoded.size != (512, 512):
                raise ValueError(f'Invalid panorama tile dimensions: {relative}')
            if path.parent.name == '2':
                row, col = map(int, path.stem.split('_'))
                face = path.parent.parent.name
                jpeg = args.delivered / face / 'l2' / str(row + 1) / f'l2_{face}_{row + 1}_{col + 1}.jpg'
                with Image.open(jpeg) as original:
                    original = original.convert('RGB')
                    if original.size != encoded.size:
                        raise ValueError(f'Unexpected original dimensions: {jpeg}')
                    difference = ImageStat.Stat(ImageChops.difference(original, encoded))
                    mean_error = sum(difference.mean) / 3
                    if mean_error > 5:
                        raise ValueError(f'Cache differs materially from source: {relative}, {mean_error}')
                    checks.append({'path': relative, 'originalSha256': sha(jpeg.read_bytes()), 'meanAbsoluteChannelError': mean_error})
        entries.append({'path': 'media/full/' + relative, 'bytes': len(data), 'sha256': sha(data)})
    args.output.mkdir(parents=True, exist_ok=True)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_STORED) as archive:
        for entry in entries:
            item = zipfile.ZipInfo(entry['path'], date_time=(2026, 1, 1, 0, 0, 0))
            item.external_attr = 0o100644 << 16
            archive.writestr(item, (source / entry['path'].removeprefix('media/full/')).read_bytes())
    data = buffer.getvalue()
    digest = sha(data)
    filename = f'assets-{digest[:20]}.zip'
    (args.output / filename).write_bytes(data)
    manifest = {'filename': filename, 'bytes': len(data), 'sha256': digest, 'url': '', 'assets': entries}
    (args.output / 'supplement.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    evidence = {'source': str(source), 'delivered': str(args.delivered), 'files': len(entries), 'assetBytes': sum(e['bytes'] for e in entries), 'sourceTileChecks': checks}
    (args.output / 'source-verification.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'archive': filename, 'archiveBytes': len(data), 'files': len(entries), 'sourceTilesCompared': len(checks), 'maximumMeanError': max(e['meanAbsoluteChannelError'] for e in checks)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
