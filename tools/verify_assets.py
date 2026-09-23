"""Validate the complete deployable content graph, hashes and tile dimensions."""
from pathlib import Path
import json,hashlib,re
from PIL import Image
root=Path(__file__).resolve().parents[1];public=root/'public'
data=json.loads((root/'src/data/museum.json').read_text(encoding='utf-8'))
manifest=json.loads((root/'docs/source-map.json').read_text(encoding='utf-8'))
errors=[];paths={a['path'] for a in manifest['assets']}
for a in manifest['assets']:
 p=public/a['path'].lstrip('/')
 if not p.is_file():errors.append('Missing '+str(p));continue
 if hashlib.sha256(p.read_bytes()).hexdigest()!=a['sha256']:errors.append('Hash mismatch '+a['path'])
for path in re.findall(r'/media/v1/[^"<>\s\\]+',json.dumps(data,ensure_ascii=False)):
 if path not in paths:errors.append('Untracked data asset '+path)
for scene in data['scenes']:
 for face in 'fblrud':
  folder=public/'media/v1/panos'/scene['key']/face
  assert Image.open(folder/'base.webp').size==(1024,1024)
  for level,count,size,ext in [(2,4,512,'jpg'),(3,8,480,'webp')]:
   for row in range(count):
    for col in range(count):
     tile=folder/str(level)/f'{row}_{col}.{ext}'
     if not tile.exists() or Image.open(tile).size!=(size,size):errors.append('Invalid tile '+str(tile))
ids={p['id'] for p in data['photos']+data['texts']}
for hotspot in data['hotspots']+data['polygons']:
 if hotspot['exhibit'] not in ids:errors.append('Broken exhibit '+hotspot['exhibit'])
assert (len(data['scenes']),len(data['pages']),len(data['photos']),len(data['texts']),len(data['ebooks']))==(3,6,10,5,29)
assert sum(t['html'].count('<img ') for t in data['texts'])==3
assert not re.search(r'<script|\bonerror\s*=|src="http:', ''.join(t['html'] for t in data['texts']))
assert not errors,'\n'.join(errors)
size=sum(p.stat().st_size for p in public.rglob('*') if p.is_file())
print(f'PASS: {len(paths)} tracked assets, 1440 detail tiles, 3 article images, all references and hashes valid; {size/1048576:.2f} MiB')
