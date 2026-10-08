import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import type {FullMuseum,SourceHotspot} from '../src/full-types.ts';
import {decodeAction} from '../src/source-actions.ts';
import {containsWallPoint,findWallApproach,wallApproachAction,type WallCatalogue,type WallTarget} from '../src/wall-approach.ts';

const dataDirectory=new URL('../src/data/',import.meta.url);
const museum=JSON.parse(readFileSync(new URL('full-museum.json',dataDirectory),'utf8')) as FullMuseum;
// Node does not execute Vite's import.meta.glob; discover the same data files for the integrity audit.
const parts=readdirSync(dataDirectory).filter(name=>/^wall-approach-.+\.json$/.test(name)).sort().map(name=>({
 name,catalogue:JSON.parse(readFileSync(new URL(name,dataDirectory),'utf8')) as WallCatalogue,
}));
const catalogue:WallCatalogue={targets:{},scenes:{}};
for(const {catalogue:part} of parts){
 Object.assign(catalogue.targets,part.targets);
 for(const [scene,regions] of Object.entries(part.scenes))catalogue.scenes[scene]=[...(catalogue.scenes[scene]||[]),...regions];
}
const indoor=museum.scenes.filter(scene=>scene.source==='tour.xml');
const scenes=new Map(indoor.map(scene=>[scene.id,scene]));
const zones=new Map(museum.zones.map(zone=>[zone.id,zone]));
const menuItems=museum.menus.flatMap(menu=>menu.items);
const resolvedAttrs=(hotspot:SourceHotspot)=>Object.assign({},...(hotspot.attrs.style||'').split('|').map(style=>museum.styles[style]||{}),hotspot.attrs) as Record<string,string>;

test('wall catalogue accounts for all 51 history source viewpoints, including reviewed entrance coverage',()=>{
 assert.ok(parts.length,'calibration files must be discoverable');
 assert.equal(indoor.length,51,'source inventory changed; review new viewpoints');
 assert.deepEqual(Object.keys(catalogue.scenes).sort(),indoor.map(scene=>scene.id).sort());
 for(const scene of indoor){
  assert.ok(Array.isArray(catalogue.scenes[scene.id]),scene.id);
  if(scene.id!=='scene_vr02')assert.ok(catalogue.scenes[scene.id].length,`${scene.id}: indoor content walls need reviewed coverage`);
 }
});

test('catalogue parts cannot silently overwrite a target with a conflicting destination',()=>{
 const definitions=new Map<string,{target:WallTarget;file:string}>();
 for(const {name,catalogue:part} of parts)for(const [id,target] of Object.entries(part.targets)){
  const previous=definitions.get(id);
  if(previous)assert.deepEqual(target,previous.target,`${id}: conflicting definitions in ${previous.file} and ${name}`);
  else definitions.set(id,{target,file:name});
 }
});

test('all 21 exhibit destinations retain their source zone identity and exact menu arrival view',()=>{
 assert.equal(museum.zones.length,21,'source zone inventory changed');
 for(const zone of museum.zones){
  const target=catalogue.targets[zone.id];
  assert.ok(target,`${zone.id}: missing canonical destination`);
  const menu=menuItems.find(item=>item.scene===zone.scene);
  assert.ok(menu?.look,`${zone.id}: missing source menu view`);
  assert.equal(target.zone,zone.id);
  assert.equal(target.scene,zone.scene);
  assert.equal(target.title,zone.title);
  assert.deepEqual(target.look,menu.look,`${zone.id}: face the original panel on arrival`);
 }
});

test('every destination has a valid source scene and finite view without conflating dedicated info walls with exhibits',()=>{
 for(const [id,target] of Object.entries(catalogue.targets)){
  assert.ok(id.trim(),`empty target ID`);
  assert.ok(scenes.has(target.scene),`${id}: unknown/non-history scene ${target.scene}`);
  assert.ok(typeof target.title==='string'&&target.title.trim(),`${id}: missing visitor title`);
  assert.equal(target.look.length,3,`${id}: arrival view shape`);
  assert.ok(target.look.every(value=>typeof value==='number'&&Number.isFinite(value)),`${id}: non-finite arrival view`);
  assert.ok(Math.abs(target.look[1])<=90&&target.look[2]>0&&target.look[2]<180,`${id}: invalid pitch/FOV`);
  if(target.zone){
   assert.ok(zones.has(target.zone),`${id}: unknown exhibit zone`);
   assert.equal(target.scene,zones.get(target.zone)!.scene,`${id}: zone/scene mismatch`);
  }
 }
 // More than one physical wall may share an arrival scene; its own ID and look remain valid.
 assert.ok(Object.values(catalogue.targets).some(target=>!target.zone),'static information walls must remain representable');
});

test('regions reference real destinations and real source overlays, preserving independent controls and objects',()=>{
 for(const [sceneId,regions] of Object.entries(catalogue.scenes))for(const region of regions){
  const label=`${sceneId} -> ${region.target}`;
  const target=catalogue.targets[region.target];
  assert.ok(target,`${label}: unresolved target`);
  assert.notEqual(target.scene,sceneId,`${label}: own front wall must keep its near opening action`);
  assert.ok(Array.isArray(region.points)&&region.points.length>=3,`${label}: polygon requires at least three points`);
  for(const point of region.points){
   assert.equal(point.length,2,`${label}: coordinate pair shape`);
   assert.ok(point.every(value=>typeof value==='number'&&Number.isFinite(value)),`${label}: non-finite coordinate`);
   assert.ok(Math.abs(point[1])<=90,`${label}: source atv outside spherical range`);
  }
  const surfaceNames=region.surfaces||[];
  assert.equal(new Set(surfaceNames).size,surfaceNames.length,`${label}: duplicate source names`);
  for(const name of surfaceNames){
   const hotspot=scenes.get(sceneId)?.hotspots.find(hotspot=>hotspot.name===name);
   assert.ok(hotspot,`${label}: surface ${name} does not exist in that source scene`);
   const attrs=resolvedAttrs(hotspot),action=decodeAction(attrs.onclick||'')||decodeAction(attrs.onloaded||'');
   assert.ok(!attrs.linkedscene,`${label}: ${name} is a movement arrow`);
   assert.doesNotMatch(attrs.style||'',/(?:^|\|)(?:object_obj|nextb|prevb|list_spot)(?:\||$)/,`${label}: ${name} is an independent object/control`);
   if(action)assert.ok(!['scene','page','object','audio','video'].includes(action.type),`${label}: ${name} has a protected ${action.type} action`);
   // Original gallery hit polygons are valid wall surfaces even when attrs.url is absent.
  }
 }
});

test('every calibrated boundary remains hittable, including unwrapped seam edges',()=>{
 for(const [scene,regions] of Object.entries(catalogue.scenes))for(const region of regions){
  const label=`${scene} -> ${region.target}`;
  for(let index=0;index<region.points.length;index++){
   const [yaw,atv]=region.points[index];
   assert.ok(containsWallPoint(region.points,yaw,atv),`${label}: rejected boundary vertex ${index}`);
   const [nextYaw,nextAtv]=region.points[(index+1)%region.points.length];
   const nearestNext=nextYaw+360*Math.round((yaw-nextYaw)/360);
   const edgeYaw=(yaw+nearestNext)/2,edgeAtv=(atv+nextAtv)/2;
   assert.ok(containsWallPoint(region.points,edgeYaw,edgeAtv),`${label}: rejected boundary edge ${index}`);
   const hit=findWallApproach(catalogue,scene,edgeYaw,edgeAtv);
   // The reviewed A02/A03 physical corner shares yaw 192 (-168). Its exact edge belongs
   // to both faces; dispatch consistently chooses A03, while either interior stays distinct.
   const sharedCorner=scene==='scene_a-n-w-1'&&region.target==='a02'&&edgeYaw===192&&edgeAtv===-2;
   assert.equal(hit?.region.target,sharedCorner?'a03':region.target,`${label}: edge ${index} reaches a neighboring wall`);
  }
 }
});

test('every region retains its intended destination throughout a representative interior grid',()=>{
 for(const [scene,regions] of Object.entries(catalogue.scenes))for(const region of regions){
  const label=`${scene} -> ${region.target}`,anchor=region.points[0][0];
  const xs=region.points.map(([yaw])=>yaw+360*Math.round((anchor-yaw)/360));
  const ys=region.points.map(([,atv])=>atv);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  let interiorHits=0;
  // Cell centers avoid counting a shared physical boundary as two intended interiors.
  for(let column=0;column<5;column++)for(let row=0;row<5;row++){
   const yaw=left+(column+.5)*(right-left)/5,atv=top+(row+.5)*(bottom-top)/5;
   if(!containsWallPoint(region.points,yaw,atv))continue;
   interiorHits++;
   assert.equal(findWallApproach(catalogue,scene,yaw,atv)?.region.target,region.target,`${label}: interior ${yaw},${atv} is shadowed by another destination`);
  }
  assert.ok(interiorHits,`${label}: no usable interior remains`);
 }
});

test('reviewed wall interiors and seam points reach the right exhibit while pillars, benches, people and floor do not',()=>{
 const hits:[string,number,number,string][]=[
  ['scene_b-c-n-0',0,-5,'b04'],
  ['scene_b-c-s-0',-100,0,'b02'],
  ['scene_b-n-e+1',-30,0,'b04'],
  ['scene_c-c-s-0',100,0,'c02'],
  ['scene_c-n-0',90,0,'c03'],
  ['scene_c-s-w-1+',15,0,'c04'],
  ['scene_b-c-s-0',180,0,'b01'],
  ['scene_b-c-s-0',-180,0,'b01'],
  ['scene_c-c-s-0',180,0,'c01'],
  ['scene_c-c-s-0',-180,0,'c01'],
  ['scene_b-c-s-0',-136,-8,'b02'], // reviewed upper wall edge
  ['scene_c-n-0',-44,-18,'c04'], // reviewed corner beside the west wall
  ['scene_a-n-w-1',191.99,-2,'a02'], // opposite interiors beside the shared physical corner
  ['scene_a-n-w-1',192.01,-2,'a03'],
 ];
 for(const [scene,yaw,atv,target] of hits){
  const hit=findWallApproach(catalogue,scene,yaw,atv);
  assert.equal(hit?.region.target,target,`${scene} at ${yaw},${atv}`);
  assert.deepEqual(wallApproachAction(hit!),{type:'scene',scene:catalogue.targets[target].scene,look:catalogue.targets[target].look});
 }
 const excluded:[string,number,number,string][]=[
  ['scene_b-c-n-0',-12,5,'person in front of b04'],
  ['scene_c-n-0',-39,5,'person in front of c04'],
  ['scene_b-c-s-0',-50,0,'brown dividing pillar'],
  ['scene_c-c-s-0',50,0,'white dividing pillar'],
  ['scene_b-c-s-0',90,5,'bench and independent object display'],
  ['scene_c-c-s-0',-85,6,'bench'],
 ];
 for(const [scene,yaw,atv,reason] of excluded)assert.equal(findWallApproach(catalogue,scene,yaw,atv),null,`${scene}: ${reason}`);
 for(const scene of indoor)assert.equal(findWallApproach(catalogue,scene.id,0,40),null,`${scene.id}: floor at the central bearing`);
});

test('named wall media and original gallery polygons approach first using their source action',()=>{
 const overlays:[string,string,string][]=[
  ['scene_a-s-0','tvspot_72','info-b'],
  ['scene_e-n-e+1','ashotspot_1','e-buildings'],
  ['scene_e-c-w-1','poly_1','e-timeline'],
 ];
 for(const [sceneId,name,target] of overlays){
  const hotspot=scenes.get(sceneId)!.hotspots.find(hotspot=>hotspot.name===name)!;
  assert.ok(hotspot,`${sceneId}: ${name}`);
  const attrs=resolvedAttrs(hotspot),action=decodeAction(attrs.onclick||'')||decodeAction(attrs.onloaded||'');
  assert.ok(action,`${sceneId}: ${name} retains its near action`);
  const region=catalogue.scenes[sceneId].find(region=>region.target===target&&region.surfaces?.includes(name));
  assert.ok(region,`${sceneId}: ${name} missing from approach surfaces`);
  const [yaw,atv]=region.points[0];
  assert.equal(findWallApproach(catalogue,sceneId,yaw,atv,{sourceName:name,action})?.region.target,target,`${sceneId}: ${name}`);
  assert.equal(findWallApproach(catalogue,sceneId,yaw,atv,{sourceName:name,action,control:true}),null,`${sceneId}: explicit controls still win`);
 }
});
