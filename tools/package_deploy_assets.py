"""Package only verified visitor assets into bounded, content-addressed ZIPs."""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import zipfile


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', default='.cache/active-assets.json')
    parser.add_argument('--output', required=True)
    parser.add_argument('--public', default='public')
    args = parser.parse_args()
    source = json.loads(Path(args.manifest).read_text(encoding='utf-8'))
    if source['verificationStatus'] != 'complete' or source['totals']['missingFiles']:
        raise SystemExit('Refusing to package an incomplete asset audit')
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    root = Path(args.public).resolve()
    limit = 88 * 1024 * 1024
    groups, current, size = [], [], 0
    for item in sorted(source['assets'], key=lambda x: x['path']):
        path = PurePosixPath(item['path'])
        if path.is_absolute() or '..' in path.parts or '\\' in item['path'] or path.parts[:2] not in [('media', 'full'), ('media', 'v1'), ('media', 'memorial')]:
            raise ValueError(f'Unsafe asset path: {path}')
        target = root.joinpath(*path.parts)
        if not item['exists'] or not item.get('sha256') or target.stat().st_size != item['bytes'] or digest(target) != item['sha256']:
            raise ValueError(f'Asset changed since verification: {path}')
        if item['bytes'] > limit:
            raise ValueError(f'Asset exceeds archive limit: {path}')
        if current and size + item['bytes'] > limit:
            groups.append(current)
            current, size = [], 0
        current.append({k: item[k] for k in ['path', 'bytes', 'sha256']})
        size += item['bytes']
    if current:
        groups.append(current)
    result = {'schemaVersion': 1, 'sourceDataSha256': source['sourceDataSha256'], 'archives': []}
    for number, assets in enumerate(groups):
        temporary = output / f'assets-{number:02}.zip.partial'
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_STORED) as archive:
            for asset in assets:
                entry = zipfile.ZipInfo(asset['path'], date_time=(2026, 1, 1, 0, 0, 0))
                entry.external_attr = 0o100644 << 16
                archive.writestr(entry, root.joinpath(*PurePosixPath(asset['path']).parts).read_bytes())
        sha = digest(temporary)
        destination = output / f'assets-{sha[:20]}.zip'
        temporary.replace(destination)
        result['archives'].append({'filename': destination.name, 'bytes': destination.stat().st_size, 'sha256': sha, 'url': '', 'assets': assets})
        print(f'{destination.name}: {len(assets)} assets / {destination.stat().st_size / 1024**2:.2f} MiB', flush=True)
    manifest = output / 'deployment-assets.json'
    manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Manifest: {manifest}', flush=True)


if __name__ == '__main__':
    main()
