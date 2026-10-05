import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeAction} from '../src/source-actions.ts';
import {localMuseumObject,panoramaSource} from '../src/museum-viewer-data.ts';
import type {FullMuseum} from '../src/full-types.ts';
const data=JSON.parse(readFileSync(new URL('../src/data/memorial-museum.json',import.meta.url),'utf8')) as FullMuseum;

test('memorial restores all source rooms and directed movement links without an invented staircase',()=>{
 assert.equal(data.scenes.length,29);
 const links=data.scenes.flatMap(scene=>scene.hotspots.filter(h=>h.attrs.linkedscene).map(h=>({from:scene.id,to:h.attrs.linkedscene.toLowerCase()})));
 assert.equal(links.length,67);
 assert.ok(links.every(link=>data.scenes.some(s=>s.id===link.to)));
 assert.ok(!links.some(link=>link.from.startsWith('scene_hkj_1f')&&link.to.startsWith('scene_hkj_2f')));
 const reached=new Set(['scene_vr11']);
 for(let n=0;n<29;n++)for(const link of links)if(reached.has(link.from))reached.add(link.to);
 assert.equal(reached.size,29);
 assert.deepEqual(data.scenes[0].view,[90,0,120]);
});
test('all 17 source artifact hotspots resolve to 36 local frames',()=>{
 const actions=data.scenes.flatMap(s=>s.hotspots.map(h=>decodeAction(h.attrs.onclick||''))).filter(a=>a?.type==='object');
 assert.equal(actions.length,17);
 for(const action of actions){
  const object=localMuseumObject(data,action!);
  assert.ok(object?.title);assert.equal(object.frames.length,36);
  assert.ok(object.frames.every(src=>src.startsWith('/media/memorial/objects/')));
 }
 assert.equal(Object.keys(data.objects!).length,17);
});
test('scene narration and full source face resolution are retained',()=>{
 assert.equal(data.scenes.filter(s=>s.narration).length,10);
 for(const scene of data.scenes){
  const expected=scene.id==='scene_vr11'?5120:scene.id==='scene_hkj_2f_01'?8960:8704;
  assert.equal(Math.max(...scene.pano.levels!.map(l=>l.faceSize)),expected);
  if(scene.narration){assert.ok(scene.narration.src.startsWith('/media/memorial/mp3/'));assert.equal(scene.narration.volume,.7);}
 }
});
