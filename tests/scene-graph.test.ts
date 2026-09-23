import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sceneLinks} from '../src/scene-links.ts';

const museum=JSON.parse(readFileSync(new URL('../src/data/museum.json',import.meta.url),'utf8'));
const ids=new Set(museum.scenes.map((scene:{id:string})=>scene.id));

test('visitors can walk from the lobby to E and back through adjacent scenes',()=>{
 assert.equal(ids.size,9);
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
 assert.equal(walk('scene_f-c-0','scene_ext-e-center'),true);
 assert.equal(walk('scene_ext-e-center','scene_f-c-0'),true);
 for(const link of sceneLinks){
  assert.ok(ids.has(link.from),`unknown source ${link.from}`);
  assert.ok(ids.has(link.to),`unknown destination ${link.to}`);
  assert.ok(Number.isFinite(link.ath) && Number.isFinite(link.atv));
  assert.ok(link.arrivalLook[1]>=-90 && link.arrivalLook[1]<=90);
 }
});

test('the E doorway is connected in both directions to the right edge of C',()=>{
 assert.ok(sceneLinks.some(link=>link.from==='scene_c-s-e+1'&&link.to==='scene_ext-e-entry'));
 assert.ok(sceneLinks.some(link=>link.from==='scene_ext-e-entry'&&link.to==='scene_c-s-e+1'));
});
