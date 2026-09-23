"""Build an explicit, reproducible public asset subset; never modify source assets."""
from pathlib import Path
import sys, json, re, math, shutil, hashlib, urllib.request, urllib.parse, os
from concurrent.futures import ThreadPoolExecutor
import xml.etree.ElementTree as ET
from PIL import Image, ImageChops
from html.parser import HTMLParser
from html import escape, unescape

sys.stdout.reconfigure(encoding='utf-8')
PROJECT=Path(__file__).resolve().parents[1]
SOURCE=Path(os.environ.get('YOUNGNAK_SOURCE', str(PROJECT.parent)))
OUT=PROJECT/'public/media/v1'
CACHE=PROJECT/'.cache/source'
OUT.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True)
origins=[]
def register(path, source, kind):
 origins.append({'path':'/'+str(path.relative_to(PROJECT/'public')).replace('\\','/'),'source':str(source),'kind':kind,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
def copy(source, dest):
 target=OUT/dest; target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(SOURCE/source,target);register(target,source,'local-copy');return '/media/v1/'+dest
def remote(path):
 dest=CACHE/path;dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():
  url='http://youngnakdhm.net/'+urllib.parse.quote(path,safe='/+()')
  for attempt in range(3):
   try:
    with urllib.request.urlopen(url,timeout=30) as response: dest.write_bytes(response.read())
    break
   except Exception:
    if attempt==2:raise
 return dest
def stitch(folder, face, level, size):
 result=Image.new('RGB',(size,size));seen=set()
 for p in (folder/face/f'l{level}').rglob('*.jpg'):
  m=re.search(r'_(\d+)_(\d+)\.jpg$',p.name);row,col=map(int,m.groups());seen.add((row,col))
  with Image.open(p) as tile:
   expected=(min(512,size-(col-1)*512),min(512,size-(row-1)*512))
   assert tile.size==expected,(p,tile.size,expected)
   result.paste(tile,((col-1)*512,(row-1)*512))
 n=math.ceil(size/512);assert seen=={(r,c) for r in range(1,n+1) for c in range(1,n+1)},(folder,face,level,'missing tile')
 return result
def pano(args):
 key,name=args;folder=SOURCE/'panos'/f'{name}.tiles'
 for face in ['f','b','l','r','u','d']:
  dst=OUT/'panos'/key/face;dst.mkdir(parents=True,exist_ok=True)
  base=dst/'base.webp'
  if not base.exists():stitch(folder,face,1,1024).save(base,lossless=True,method=4)
  register(base,str(folder.relative_to(SOURCE)),'lossless-base')
  for lv,size,n,ext in [(2,2048,4,'jpg'),(3,3840,8,'webp')]:
   (dst/str(lv)).mkdir(exist_ok=True)
   if lv==3:
    full=stitch(folder,face,3,size)
    for row in range(n):
     for col in range(n):
      tile=full.crop((col*480,row*480,(col+1)*480,(row+1)*480));target=dst/str(lv)/f'{row}_{col}.{ext}'
      if not target.exists():tile.save(target,lossless=True,method=4)
      with Image.open(target) as restored:assert ImageChops.difference(tile,restored.convert('RGB')).getbbox() is None
      register(target,str(folder.relative_to(SOURCE)),'pixel-verified-retile')
   else:
    for row in range(n):
     for col in range(n):
      source=folder/face/'l2'/str(row+1)/f'l2_{face}_{row+1}_{col+1}.jpg';target=dst/'2'/f'{row}_{col}.jpg'
      shutil.copyfile(source,target);register(target,str(source.relative_to(SOURCE)),'local-copy')
 print('Panorama ready:',key,flush=True)
with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(pano,[('lobby','F-c-0'),('a-entry','A-s-0'),('a-history','A-s-w-1+')]))

scenes=[{'id':'scene_f-c-0','key':'lobby','title':'메인 로비','label':'MAIN LOBBY','subtitle':'영락의 이야기가 시작되는 곳','ath':0,'atv':0,'fov':100}, {'id':'scene_a-s-0','key':'a-entry','title':'영락교회 성장 및 발전','label':'A · INTRODUCTION','subtitle':'한 공동체의 믿음이 시대를 만나다','ath':0,'atv':0,'fov':95}, {'id':'scene_a-s-w-1+','key':'a-history','title':'복음의 문이 열리다','label':'A · 01 / 1945년 이전','subtitle':'한국교회의 뿌리와 신앙공동체의 시작','ath':180,'atv':0,'fov':95}]
fp=ET.parse(SOURCE/'floorplan_SM/setting_FP.xml').getroot()
with Image.open(SOURCE/'floorplan_SM/plan/map.png') as im:map_size=im.size
for scene in scenes:
 point=next(x for x in fp.iter('layer') if x.get('erscena')==scene['id'])
 scene['map']={'x':float(point.get('x'))/map_size[0]*100,'y':float(point.get('y'))/map_size[1]*100,'heading':float(point.get('heading2','0'))}
 scene['viewSource']='PoC framing, not original view metadata'
 scene['thumb']=copy(f'panos/{dict(lobby="F-c-0",**{"a-entry":"A-s-0","a-history":"A-s-w-1+"})[scene["key"]]}.tiles/thumb.jpg',f'thumbs/{scene["key"]}.jpg')
map_url=copy('floorplan_SM/plan/map.png','map.png')
panels=[]
for x in ET.parse(SOURCE/'pannel.xml').getroot().iter('hotspot'):
 if x.get('id') not in [s['id'] for s in scenes]:continue
 source=x.get('url','').replace('%FIRSTXML%/','');image=copy(source,'panels/'+Path(source).name)
 panels.append(dict(x.attrib,image=image,source='pannel.xml'))
pages=[copy(f'img/sector_a02_{i:02}.png',f'exhibition/page-{i}.png') for i in range(1,7)]
action=ET.parse(SOURCE/'list_a02_action.xml').getroot()
hotspots=[]
for x in action.iter('hotspot'):
 click=x.get('onclick','');pm=re.search(r'photo/a02/index.html\?startscene=(\d+)',click);tm=re.search(r'html/a02_(\d+)\.html',click)
 if not(pm or tm):continue
 hotspots.append({'id':x.get('name'),'page':int(x.get('tag','1p').rstrip('p')),'ath':float(x.get('ath','0')),'atv':float(x.get('atv','0')),'title':x.get('tooltip') or ('사진 보기' if pm else '이야기 더 읽기'),'exhibit':f'photo-{pm[1]}' if pm else f'text-{int(tm[1])}','source':'list_a02_action.xml'})

# Only the two polygons whose titles and indices match the public current tour are retained.
fragment=ET.fromstring('<root>'+re.sub(r'<!--.*?-->','',(SOURCE/'a2_111.xml').read_text(encoding='utf-8-sig'),flags=re.S)+'</root>')
polygons=[]
for x in fragment.findall('hotspot'):
 if x.get('name') in ['poly_1','poly_2']:
  polygons.append({'id':x.get('name'),'page':1,'title':x.get('tooltip'),'exhibit':'photo-'+('0' if x.get('name')=='poly_1' else '1'),'points':[[float(p.get('ath')),float(p.get('atv'))] for p in x.findall('point')],'source':'a2_111.xml; restricted to verified title/index matches'})

photo_xml=remote('photo/a02/tour.xml');photos=[]
for index,scene in enumerate(ET.parse(photo_xml).getroot().findall('scene')):
 flat=scene.find('image/flat');tokens=flat.get('multires').split(',');tile_size=int(tokens[0]);lv=len(tokens)-1;width,height=map(int,tokens[-1].split('x'));pattern=flat.get('url');root=OUT/'photos'/str(index);root.mkdir(parents=True,exist_ok=True)
 tasks=[]
 for row in range(math.ceil(height/tile_size)):
  for col in range(math.ceil(width/tile_size)):
   url=pattern.replace('%l',str(lv)).replace('%v',str(row+1)).replace('%h',str(col+1));tasks.append((row,col,'photo/a02/'+url))
 def fetch(t):return t[0],t[1],remote(t[2]),t[2]
 canvas=Image.new('RGB',(width,height))
 with ThreadPoolExecutor(max_workers=6) as pool:
  for row,col,p,path in pool.map(fetch,tasks):
   with Image.open(p) as tile:
    assert tile.size==(min(tile_size,width-col*tile_size),min(tile_size,height-row*tile_size)),path
    canvas.paste(tile,(col*tile_size,row*tile_size))
 output=root/'image.webp';canvas.save(output,lossless=True,method=4);register(output,'http://youngnakdhm.net/photo/a02/tour.xml#'+scene.get('name'),'assembled-photo')
 photos.append({'id':f'photo-{index}','title':scene.get('title'),'image':f'/media/v1/photos/{index}/image.webp','width':width,'height':height,'source':'http://youngnakdhm.net/photo/a02/index.html?startscene='+str(index)})
 print('Photo ready:',index,scene.get('title'),flush=True)

from articles import ArticleParser
texts=[]
for i,title in enumerate(['복음을 들고 문을 두드린 이들','복음의 뿌리와 신앙공동체','장로교 교회 분포와 북한교회 통계','한국교회와 신앙의 성장','해방 이전의 교회'],1):
 p=ArticleParser(lambda src:copy('html/'+src,'articles/'+Path(src).name));p.feed((SOURCE/f'html/a02_{i:02}.html').read_text(encoding='utf-8-sig'));texts.append({'id':f'text-{i}','title':title,'html':''.join(p.parts),'source':f'html/a02_{i:02}.html'})

ebooks=[];s=(SOURCE/'e-book.html').read_text(encoding='utf-8-sig')
for block in re.findall(r'<div\s+class="gallery-item".*?</div>',s,re.S):
 url=re.search(r'https://heyzine\.com/flip-book/[a-z0-9]+\.html',block);img=re.search(r'<img[^>]+src="([^"]+)"',block);cat=re.search(r'data-cat="([^"]+)"',block)
 if not(url and img):continue
 title=unescape(re.sub(r'<[^>]+>',' ',block[block.find('>')+1:])).strip();title=re.sub(r'\s+',' ',title)
 source=img[1].lstrip('./')
 if (SOURCE/source).exists():
  image=copy(source,f'books/{len(ebooks)}'+Path(source).suffix)
  ebooks.append({'title':title,'category':cat[1] if cat else '기타','url':url[0],'image':image})

data={'scenes':scenes,'panels':panels,'pages':pages,'hotspots':hotspots,'polygons':polygons,'photos':photos,'texts':texts,'ebooks':ebooks,'map':map_url,'mapSize':map_size,'video':{'title':'영락교회 성장 및 발전','id':'aTbykwPkmsE'}}
(PROJECT/'src/data').mkdir(parents=True,exist_ok=True)
(PROJECT/'src/data/museum.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
# Deduplicate shared assets in manifest.
origins=list({o['path']:o for o in origins}.values())
(PROJECT/'docs/source-map.json').write_text(json.dumps({'sourceSite':'http://youngnakdhm.net/','observed':'2026-09-23','assets':origins,'rulings':['Scene initial views are PoC framing.','Only photo polygon indices 0 and 1 from a2_111.xml retained; remaining links use list_a02_action.xml and current public tour.','No encrypted runtime or plugins are shipped.','Main history panel bounds are calibrated web geometry; original main XML unavailable.']},ensure_ascii=False,indent=2),encoding='utf-8')
print('READY',len(origins),'assets',round(sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file())/1048576,2),'MiB','books',len(ebooks),flush=True)
