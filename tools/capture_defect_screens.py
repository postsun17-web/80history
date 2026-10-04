"""Capture reviewed public defect slots in an isolated agent-browser session.

Browser DOM annotations are review overlays; no image is generated or edited.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BROWSER = Path(os.environ['LOCALAPPDATA']) / 'npm-cache/_npx/6de2aa2fded2970c/node_modules/agent-browser/bin/agent-browser-win32-x64.exe'
OUT = Path('E:/CodexAssets/youngnak-defect-reaudit/screenshots')
SESSION = 'defect-captures'


def run(*args, script=None):
    result = subprocess.run([str(DEFAULT_BROWSER), '--session', SESSION, '--json', *args],
                            input=script, text=True, encoding='utf-8', errors='replace',
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=75)
    if result.returncode:
        raise RuntimeError(f'{args}: {result.stdout} {result.stderr}')
    data = json.loads(result.stdout)
    if not data.get('success'):
        raise RuntimeError(f'{args}: {data}')
    return data.get('data', {})


def capture(record, kind, path):
    url = record['blankUrl'] if kind in ['before', 'after'] else record['url']
    run('open', url)
    run('snapshot', '-i')
    label = (f"검수 대상 {record['id']} · 사진 목록 {record['displayPosition']}/{record['galleryLength']}" if kind == 'before'
             else f"보강 후 {record['id']}" if kind == 'after'
             else '관련 전시판 · 자료는 사진목록 이전/다음에서 접근')
    config = {'kind': kind, 'label': label, 'id': record.get('id'), 'items': record.get('items'),
              'page': record.get('page'), 'pageTitle': record.get('pageTitle')}
    js = r'''(async()=>{
 const config=CONFIG;
 const deadline=Date.now()+40000;
 function ready(){
  const loading=document.querySelector('#loading');
  const error=document.querySelector('#scene-error');
  const dialog=document.querySelector('#content-dialog');
  if(loading?.textContent.trim()||(error&&!error.hidden))return false;
  if(config.kind==='before')return dialog?.open&&document.querySelector('.full-content-source-note')?.textContent.includes('전달받은 원본 이미지가 비어');
  if(config.kind==='after'){
   if(!dialog?.open||document.querySelector('.full-content-source-note'))return false;
   const images=[...document.querySelectorAll('.full-content-related-grid img')];
   const expected={'c03:9':3,'c03:10':3,'c03:16':5}[config.id];
   if(expected)return images.length===expected&&images.every(i=>i.complete&&i.naturalWidth>0);
   return !!document.querySelector('.full-content-media-stage canvas');
  }
  return !dialog?.open&&document.querySelector('.psv-canvas')&&document.querySelector('#page-select')?.value===String(config.page);
 }
 while(!ready()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,200));
 if(!ready())throw new Error('Capture readiness failed: '+document.body.innerText.slice(-1500));
 await new Promise(r=>setTimeout(r,config.kind==='after'?1800:900));
 document.querySelector('#defect-review-overlay')?.remove();
 const overlay=document.createElement('div');overlay.id='defect-review-overlay';
 overlay.textContent=config.label;
 overlay.style.cssText='position:fixed;z-index:2147483647;left:22px;top:74px;padding:10px 16px;background:#fff7e8;color:#7c271c;border:2px solid #b93827;border-radius:7px;font:700 18px/1.4 Arial,sans-serif;pointer-events:none;box-shadow:0 2px 10px #0002';
 if(config.kind==='before'){
  const stage=document.querySelector('.full-content-media-stage');
  stage.style.outline='4px solid #d52d2d';stage.style.outlineOffset='-4px';
  stage.style.position='relative';overlay.style.position='absolute';overlay.style.left='16px';overlay.style.top='16px';stage.appendChild(overlay);
 }else if(config.kind==='after'){
  overlay.style.left='auto';overlay.style.right='90px';overlay.style.top='20px';overlay.style.position='absolute';
  overlay.style.background='#eef9f1';overlay.style.color='#1b6334';overlay.style.borderColor='#25824c';
  document.querySelector('#content-dialog').appendChild(overlay);
 }else{
  document.body.appendChild(overlay);
  const plan=document.querySelector('#floorplan');if(plan)plan.hidden=true;
  const open=document.querySelector('#map-open');if(open)open.hidden=false;
  const quick=document.querySelector('#quick-menu');quick?.classList.add('folded');
 }
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const stage=document.querySelector('.full-content-media-stage');const rect=stage?.getBoundingClientRect();
 return {url:location.href,title:document.title,heading:document.querySelector('#content-dialog h2')?.textContent,
  sourceNotice:document.querySelector('.full-content-source-note')?.textContent,loading:document.querySelector('#loading')?.textContent,
  dateNote:document.querySelector('.full-content-note')?.textContent,
  relatedImages:[...document.querySelectorAll('.full-content-related-grid img')].map(i=>({src:i.src,complete:i.complete,width:i.naturalWidth,height:i.naturalHeight})),
  canvasCount:document.querySelectorAll('.full-content-media-stage canvas').length,
  sceneError:!document.querySelector('#scene-error')?.hidden,pageTitle:document.querySelector('.page-caption strong')?.textContent,
  stageRect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
  annotation:config.label,viewport:{width:innerWidth,height:innerHeight},capturedAt:new Date().toISOString(),
  scripts:[...document.scripts].map(x=>x.src).filter(Boolean)};
})()'''.replace('CONFIG', json.dumps(config, ensure_ascii=False))
    observed = run('eval', '--stdin', script=js)['result']
    path.parent.mkdir(parents=True, exist_ok=True)
    run('screenshot', str(path))
    return {'kind': kind, 'id': record.get('id'), 'items': record.get('items'), 'requestedUrl': url,
            'path': str(path).replace('\\', '/'), 'observed': observed}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', choices=['all', 'before', 'panels', 'after'], default='all')
    args = parser.parse_args()
    os.chdir(ROOT)
    source = json.loads((ROOT / '.cache/defect-screen-map.json').read_text(encoding='utf-8'))
    run('set', 'viewport', '1440', '1000')
    evidence_path = OUT / 'capture-evidence.json'
    evidence = json.loads(evidence_path.read_text(encoding='utf-8')) if evidence_path.exists() else {
        'session': SESSION, 'viewport': [1440, 1000], 'annotationMethod': 'Temporary browser DOM overlay only; native browser screenshots.', 'captures': []}
    jobs = []
    if args.only in ['all', 'before']:
        jobs += [(item, 'before', OUT / 'before' / f"{item['id'].replace(':', '-')}.png") for item in source['items']]
    if args.only in ['all', 'panels']:
        jobs += [(item, 'panels', OUT / 'panels' / f"{item['zone']}-page-{item['page']:02d}.png") for item in source['captureGroups']]
    if args.only == 'after':
        jobs += [(item, 'after', OUT / 'after' / f"{item['id'].replace(':', '-')}.png") for item in source['items'] if item['gallery']=='c03']
    for record, kind, path in jobs:
        entry = capture(record, kind, path)
        evidence['captures'] = [x for x in evidence['captures'] if x['path'] != entry['path']]
        evidence['captures'].append(entry)
        evidence['updatedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
        evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f"CAPTURED {kind} {record.get('id') or record['zone']+':'+str(record['page'])} {path}", flush=True)
    print(f'DONE {len(jobs)} captures; evidence: {evidence_path}', flush=True)


if __name__ == '__main__':
    main()
