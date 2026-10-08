import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import type {FullMuseum} from '../src/full-types.ts';
import {findPinchDestination,type PassageCatalogue} from '../src/pinch-navigation.ts';
import {containsWallPoint} from '../src/wall-approach.ts';

for(const [id,file,total] of [['history','full-museum.json',62],['memorial','memorial-museum.json',29]] as const){
 const museum=JSON.parse(readFileSync(new URL('../src/data/'+file,import.meta.url),'utf8')) as FullMuseum;
 const url=new URL(`../src/data/pinch-passages-${id}.json`,import.meta.url);
 const catalogue:PassageCatalogue=existsSync(url)?JSON.parse(readFileSync(url,'utf8')):{museum:id,scenes:{}};
 test(`${id}: every original viewpoint is reviewed for pinch passages`,()=>{
  assert.equal(catalogue.museum,id);assert.equal(museum.scenes.length,total);
  assert.deepEqual(Object.keys(catalogue.scenes).sort(),museum.scenes.map(scene=>scene.id).sort());
 });
 test(`${id}: each passage follows an original adjacent link with an explicit arrival view`,()=>{
  const ids=new Set(museum.scenes.map(scene=>scene.id));
  assert.ok(Object.values(catalogue.scenes).flat().length,'navigation needs reviewed passages');
  for(const [source,regions] of Object.entries(catalogue.scenes))for(const region of regions){
   const scene=museum.scenes.find(scene=>scene.id===source)!;
   const hotspot=scene.hotspots.find(h=>h.name===region.source);assert.ok(hotspot,`${source}/${region.source}`);
   const attrs=Object.assign({},...(hotspot.attrs.style||'').split('|').map(style=>museum.styles[style]||{}),hotspot.attrs);
   const target=id==='history'&&source==='scene_vr02'&&hotspot.name==='open_b'?'scene_f-c-0':attrs.linkedscene?.toLowerCase();
   assert.equal(region.scene,target,`${source}/${region.source}: no invented shortcut`);
   assert.notEqual(region.scene,source);assert.ok(ids.has(region.scene));
   assert.match(region.title,/이동$/);assert.ok(!region.title.includes('undefined'));
   assert.equal(region.look.length,3);assert.ok(region.look.every(Number.isFinite));
   assert.ok(Math.abs(region.look[1])<=90);assert.equal(region.look[2],110);
   assert.ok(region.points.length>=3);assert.ok(region.points.flat().every(Number.isFinite));
   assert.ok(region.points.every(point=>Math.abs(point[1])<=90));
  }
 });
 test(`${id}: region boundaries survive panorama seams and each lane has selectable interior`,()=>{
  let checked=0;
  for(const [scene,regions] of Object.entries(catalogue.scenes))for(const region of regions){
   for(const [yaw,atv] of region.points)assert.ok(containsWallPoint(region.points,yaw,atv),`${scene}: degenerate polygon`);
   const first=region.points[0][0];const unwrapped=region.points.map(([yaw,atv])=>[yaw+360*Math.round((first-yaw)/360),atv]);
   const xs=unwrapped.map(p=>p[0]),ys=unwrapped.map(p=>p[1]);let interior=false;
   for(let yaw=Math.min(...xs)+.25;yaw<Math.max(...xs);yaw+=1)for(let atv=Math.min(...ys)+.25;atv<Math.max(...ys);atv+=1){
    if(!containsWallPoint(region.points,yaw,atv))continue;
    const hit=findPinchDestination(id,scene,yaw,atv,catalogue);
    assert.ok(hit,`${scene}: unpickable interior`);checked++;
    if(hit.action.scene===region.scene)interior=true;
   }
   assert.ok(interior,`${scene}/${region.source}: entire lane hidden by another destination`);
  }
  assert.ok(checked>0);
 });
}
