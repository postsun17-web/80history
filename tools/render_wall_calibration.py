"""Diagnostic angular atlas from original cubemap bases; never edits assets."""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[1]
DATA = json.loads((REPO / 'src/data/full-museum.json').read_text(encoding='utf-8'))
OUT = Path('E:/CodexAssets/youngnak-wall-qa')

def render(scene, width=2880):
    # x = yaw -180..180, y = source atv -40..40. Faces follow PSV cubemap convention.
    height = width * 80 // 360
    ath = np.linspace(-np.pi, np.pi, width, endpoint=False)[None, :]
    atv = np.linspace(-40, 40, height)[:, None] * np.pi / 180
    x = np.cos(atv) * np.sin(ath); y = -np.sin(atv) * np.ones_like(x); z = np.cos(atv) * np.cos(ath)
    axis = np.argmax(np.stack([abs(x), abs(y), abs(z)]), axis=0)
    pixels = np.zeros((height, width, 3), dtype=np.uint8)
    root = REPO / 'public' / scene['pano']['root'].lstrip('/')
    for face, mask, u, v in [
        ('f',(axis==2)&(z>=0),x/(abs(z)+1e-9),-y/(abs(z)+1e-9)),
        ('b',(axis==2)&(z<0),-x/(abs(z)+1e-9),-y/(abs(z)+1e-9)),
        ('r',(axis==0)&(x>=0),-z/(abs(x)+1e-9),-y/(abs(x)+1e-9)),
        ('l',(axis==0)&(x<0),z/(abs(x)+1e-9),-y/(abs(x)+1e-9)),
        ('u',(axis==1)&(y>=0),-x/(abs(y)+1e-9),-z/(abs(y)+1e-9)),
        ('d',(axis==1)&(y<0),-x/(abs(y)+1e-9),z/(abs(y)+1e-9)),
    ]:
        img=np.array(Image.open(root / face / 'base.webp').convert('RGB'))
        rows=np.clip(((v[mask]+1)/2*(img.shape[0]-1)).astype(int),0,img.shape[0]-1)
        cols=np.clip(((u[mask]+1)/2*(img.shape[1]-1)).astype(int),0,img.shape[1]-1)
        pixels[mask]=img[rows,cols]
    return Image.fromarray(pixels)

def atlas(scene, regions=None):
    img=render(scene); draw=ImageDraw.Draw(img)
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
    w,h=img.size
    def xy(a,v): return ((a+180)/360*w,(v+40)/80*h)
    for a in range(-180,181,15):
        x,_=xy(a,0);draw.line((x,0,x,h),fill='#6acbcb',width=1);draw.text((x+2,5),str(a),fill='yellow',font=font)
    for v in range(-40,41,10):
        _,y=xy(0,v);draw.line((0,y,w,y),fill='#6acbcb',width=1);draw.text((3,y+2),str(v),fill='yellow',font=font)
    if regions:
        for r in regions:
            points=[xy(*p) for p in r['points']]
            # split seam-crossing polygons into shifted copies, clipping naturally.
            for offset in [-w,0,w]:
                p=[(x+offset,y) for x,y in points]
                draw.line(p+[p[0]],fill='#ffdf00',width=3)
                draw.text((sum(x for x,y in p)/len(p),sum(y for x,y in p)/len(p)),r['target'],fill='#ffdf00',font=font)
    else:
        for hotspot in scene['hotspots']:
            a=hotspot['attrs'];target=a.get('linkedscene')
            if target:
                x,y=xy(float(a.get('ath','0')),float(a.get('atv','0')))
                draw.ellipse((x-4,y-4,x+4,y+4),fill='red')
                draw.text((x+5,y),target.removeprefix('scene_'),fill='yellow',font=font)
    OUT.mkdir(parents=True,exist_ok=True)
    file=OUT/(scene['id']+('-regions' if regions is not None else '')+'.jpg')
    img.save(file,quality=92)
    return file

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--prefix',default='');parser.add_argument('--scene');parser.add_argument('--regions')
    args=parser.parse_args()
    catalogue=json.loads(Path(args.regions).read_text(encoding='utf-8')) if args.regions else None
    for scene in DATA['scenes']:
        if scene['source']!='tour.xml': continue
        if args.scene and scene['id']!=args.scene: continue
        if args.prefix and not scene['id'].startswith(args.prefix): continue
        print(atlas(scene,catalogue.get(scene['id'],[]) if catalogue is not None else None))
