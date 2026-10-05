import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sceneLinks} from '../src/scene-links.ts';

const museum=JSON.parse(readFileSync(new URL('../src/data/museum.json',import.meta.url),'utf8'));
const ids=new Set(museum.scenes.map((scene:{id:string})=>scene.id));

test('legacy visitors can walk from the lobby to original C and back',()=>{
 assert.equal(ids.size,7);
 const walk=(start:string,target:string)=>{
  const seen=new Set([start]);let frontier=[start];
  while(frontier.length){
   const next:string[]=[];
   for(const id of frontier){
    if(id===target)return true;
    for(const link of sceneLinks.filter(link=>link.from===id))if(!seen.has(link.to)){seen.add(link.to);next.push(link.to);}
   }
   frontier=next;
  }
  return false;
 };
 assert.equal(walk('scene_f-c-0','scene_c-s-e+1'),true);
 assert.equal(walk('scene_c-s-e+1','scene_f-c-0'),true);
 for(const link of sceneLinks){
  assert.ok(ids.has(link.from),`unknown source ${link.from}`);
  assert.ok(ids.has(link.to),`unknown destination ${link.to}`);
  assert.ok(Number.isFinite(link.ath) && Number.isFinite(link.atv));
  assert.ok(link.arrivalLook[1]>=-90 && link.arrivalLook[1]<=90);
 }
});

test('legacy catalogue and navigation cannot enter the retired E extension',()=>{
 assert.equal([...ids].some(id=>String(id).startsWith('scene_ext-')),false);
 assert.equal(sceneLinks.some(link=>link.from.startsWith('scene_ext-')||link.to.startsWith('scene_ext-')),false);
 const c02=museum.scenes.find((scene:{id:string})=>scene.id==='scene_c-s-e+1');
 assert.equal(c02.pano.root,'/media/full/panos/scene_c-s-e+1');
 assert.equal(c02.pano.ext,'webp');
 assert.deepEqual(museum.mapSize,[1733,2220]);
 assert.ok(Math.abs(c02.map.x-1433/1733*100)<1e-9);
});
