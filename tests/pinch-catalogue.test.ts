import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import type {FullMuseum} from '../src/full-types.ts';
import {findPinchDestination,type PassageCatalogue,type ZoomCatalogue} from '../src/pinch-navigation.ts';
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
   assert.deepEqual(region.direction,[Number(attrs.ath),Number(attrs.atv)],`${source}/${region.source}: original arrow bearing`);
   assert.notEqual(region.scene,source);assert.ok(ids.has(region.scene));
   assert.match(region.title,/이동$/);assert.ok(!region.title.includes('undefined'));
   assert.equal(region.look.length,3);assert.ok(region.look.every(Number.isFinite));
   assert.ok(Math.abs(region.look[1])<=90);assert.equal(region.look[2],110);
   assert.ok(region.points.length>=3);assert.ok(region.points.flat().every(Number.isFinite));
   assert.ok(region.points.every(point=>Math.abs(point[1])<=90));
  }
 });
 test(`${id}: all viewpoints choose the closest forward original link at every sampled yaw regardless of pitch`,()=>{
  for(const [scene,links] of Object.entries(catalogue.scenes)){
   for(const link of links){
    for(const [yaw,atv] of link.points)assert.ok(containsWallPoint(link.points,yaw,atv),`${scene}: degenerate audit polygon`);
    assert.equal(findPinchDestination(id,scene,...link.direction,catalogue,undefined,{sourceName:link.source,action:{type:'scene',scene:link.scene}})?.action.scene,link.scene);
   }
   for(let yaw=-180;yaw<180;yaw+=5){
    const distances=links.map(link=>({link,distance:Math.abs(Math.atan2(Math.sin((link.direction[0]-yaw)*Math.PI/180),Math.cos((link.direction[0]-yaw)*Math.PI/180))*180/Math.PI)})).filter(x=>x.distance<=45+1e-9).sort((a,b)=>a.distance-b.distance);
    const nearest=distances.length?links.find(link=>distances.some(d=>d.link===link&&Math.abs(d.distance-distances[0].distance)<1e-7)):undefined;
    for(const atv of [-30,0,35])assert.equal(findPinchDestination(id,scene,yaw,atv,catalogue)?.action.scene,nearest?.scene,`${scene} facing ${yaw},${atv}`);
   }
  }
 });
 test(`${id}: no original destination is missing from direction candidates`,()=>{
  for(const scene of museum.scenes)for(const hotspot of scene.hotspots){
   const attrs=Object.assign({},...(hotspot.attrs.style||'').split('|').map(style=>museum.styles[style]||{}),hotspot.attrs);
   const target=attrs.linkedscene?.toLowerCase();if(!target||target===scene.id)continue;
   assert.ok(catalogue.scenes[scene.id].some(link=>link.scene===target),`${scene.id}/${hotspot.name} missing ${target}`);
  }
 });
 test(`${id}: zoom-only regions protect local surfaces and leave passage directions available`,()=>{
  const zoom:ZoomCatalogue=JSON.parse(readFileSync(new URL(`../src/data/pinch-zoom-${id}.json`,import.meta.url),'utf8'));
  assert.equal(zoom.museum,id);
  for(const [scene,regions] of Object.entries(zoom.scenes)){
   assert.ok(museum.scenes.some(s=>s.id===scene));
   for(const region of regions){
    assert.ok(region.source);assert.ok(region.points.length>=3);
    for(const [yaw,atv] of region.points){assert.ok(containsWallPoint(region.points,yaw,atv));assert.equal(findPinchDestination(id,scene,yaw,atv,catalogue,undefined,undefined,zoom),null);}
   }
   assert.ok(catalogue.scenes[scene].length===0||catalogue.scenes[scene].some(link=>findPinchDestination(id,scene,...link.direction,catalogue,undefined,undefined,zoom)),`${scene}: reading masks block all exits`);
  }
 });
}
