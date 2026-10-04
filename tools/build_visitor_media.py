"""Create immutable visitor derivatives without modifying delivered source media."""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageOps
ROOT=Path(__file__).resolve().parents[1]
VERSION='visitor-media-v1-q78-mid1024-thumb360-preview1280'
def build(source:Path):
 data=json.loads((ROOT/'src/data/full-museum.json').read_text(encoding='utf-8'))
 galleries={item['image'] for g in data['galleries'] for item in g['items'] if not item.get('faces')}
 def local(url):
  if url.startswith('/media/full/'):return source/url[len('/media/full/'):]
  if url.startswith('/media/v1/'):return ROOT/'public'/url.lstrip('/')
  return None
 inputs=[]
 for scene in data['scenes']:
  p=scene['pano']
  if p['faceSize']<=1024:continue
  for f in 'fblrud':
   for row in range(p['tiles']):
    for col in range(p['tiles']):inputs.append(local(f"{p['root']}/{f}/{p['level']}/{row}_{col}.{p['ext']}"))
 panorama_inputs=inputs.copy()
 for url in sorted(galleries):
  p=local(url)
  if p and p.exists():inputs.append(p)
 digest=hashlib.sha256(VERSION.encode())
 for path in inputs:
  digest.update(path.name.encode());digest.update(hashlib.sha256(path.read_bytes()).digest())
 version=digest.hexdigest()[:16];out=ROOT/'public/visitor-assets'/version;out.mkdir(parents=True,exist_ok=True)
 index={'version':version,'panos':{},'images':{}};metrics={'version':version,'top10':[],'skipped':[]}
 for scene in data['scenes']:
  p=scene['pano']
  if p['faceSize']<=1024:continue
  urls={}
  for f in 'fblrud':
   image=Image.new('RGB',(p['faceSize'],p['faceSize']));tileSize=p['faceSize']//p['tiles']
   for row in range(p['tiles']):
    for col in range(p['tiles']):
     with Image.open(local(f"{p['root']}/{f}/{p['level']}/{row}_{col}.{p['ext']}")) as tile:image.paste(tile,(col*tileSize,row*tileSize))
   target=out/'panos'/scene['id']/f'{f}.webp';target.parent.mkdir(parents=True,exist_ok=True);image.resize((1024,1024),Image.Resampling.LANCZOS).save(target,'WEBP',quality=78,method=4)
   urls[f]=f'/visitor-assets/{version}/panos/{scene["id"]}/{f}.webp'
  index['panos'][scene['id']]=urls
 records=[]
 for url in sorted(galleries):
  path=local(url)
  if not path or not path.exists():metrics['skipped'].append(url);continue
  try:
   with Image.open(path) as raw:
    image=ImageOps.exif_transpose(raw).convert('RGB');record={'original':url,'originalBytes':path.stat().st_size,'dimensions':list(image.size)}
    key=hashlib.sha256(url.encode()).hexdigest()[:16];urls={}
    for kind,size in [('thumbnail',360),('preview',1280)]:
     target=out/'images'/f'{key}-{kind}.webp';target.parent.mkdir(parents=True,exist_ok=True);copy=image.copy();copy.thumbnail((size,size),Image.Resampling.LANCZOS);copy.save(target,'WEBP',quality=78,method=4);urls[kind]=f'/visitor-assets/{version}/images/{target.name}';record[kind+'Bytes']=target.stat().st_size
    index['images'][url]=urls;records.append(record)
  except (OSError,ValueError):metrics['skipped'].append(url)
 metrics['top10']=sorted(records,key=lambda r:r['originalBytes'],reverse=True)[:10]
 metrics['top10Totals']={kind:sum(r[kind] for r in metrics['top10']) for kind in ['originalBytes','previewBytes','thumbnailBytes']}
 metrics['top10Totals']['previewReductionPercent']=round(100*(1-metrics['top10Totals']['previewBytes']/metrics['top10Totals']['originalBytes']),2)
 metrics['panoramaBytes']={'original2048Tiles':sum(path.stat().st_size for path in panorama_inputs),'mid1024Faces':sum(path.stat().st_size for path in (out/'panos').rglob('*.webp'))}

 files=list(out.rglob('*.webp'));metrics.update({'fileCount':len(files),'totalBytes':sum(p.stat().st_size for p in files),'midFaces':len(index['panos'])*6,'galleryPreviews':len(records),'panoRequests':{'economy':{'base':6,'detailMaximum':6},'autoMobile':{'base':6,'detailMaximum':6},'high':{'base':6,'detailMaximum':96}},'note':'Request maxima per scene, visible detail subset depends on viewport. Economy base tile URLs reuse the six already-loaded bases. Image preview requests 1, original only on explicit expansion.'})
 if metrics['totalBytes']>100*1024*1024:raise RuntimeError('Derivative assets exceed 100MiB budget')
 (ROOT/'src/data/visitor-media.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')),encoding='utf8')
 report=ROOT/'docs/visitor-experience/media-metrics.json';report.parent.mkdir(parents=True,exist_ok=True);report.write_text(json.dumps(metrics,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps({k:metrics[k] for k in ['version','fileCount','totalBytes','midFaces','galleryPreviews']}))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=Path('E:/CodexAssets/youngnak-full'));build(parser.parse_args().source)
