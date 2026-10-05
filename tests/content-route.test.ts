import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeContentRoute,safeContentAction} from '../src/content-route.ts';
import type {FullMuseum} from '../src/full-types.ts';
const data=JSON.parse(readFileSync(new URL('../src/data/full-museum.json',import.meta.url),'utf8')) as FullMuseum;
const image=(src:string)=>JSON.stringify({type:'image',src,title:'stale'});
test('zoomed panel movement updates the room page and keeps the panorama look',()=>{
 const look:[number,number,number]=[264,-11,113];
 const route=normalizeContentRoute(data,{scene:'scene_d-n-w-2',page:2,look,exhibit:image('/media/full/img/sector_d01_03.png.webp')});
 assert.equal(route.page,3);assert.equal(route.scene,'scene_d-n-w-2');assert.deepEqual(route.look,look);
});
test('old mismatched image links use their actual panel page and room',()=>{
 const route=normalizeContentRoute(data,{scene:'scene_c-s-e+1',page:1,look:[90,0,105],exhibit:image('img/sector_d01_02.png')});
 assert.equal(route.scene,'scene_d-n-w-2');assert.equal(route.page,2);
 assert.deepEqual(route.look,data.scenes.find(s=>s.id===route.scene)!.view);
});
test('standalone image and gallery actions never move the underlying exhibition',()=>{
 for(const exhibit of [image('/media/full/img/unrelated.png.webp'),JSON.stringify({type:'gallery',gallery:data.galleries[0].id,index:1})]){
  const route={scene:'scene_d-n-w-2',page:2,look:[264,-11,113] as [number,number,number],exhibit};
  assert.deepEqual(normalizeContentRoute(data,route),route);
 }
});
test('image article context must refer to known local content and cannot introduce remote sound',()=>{
 const article=Object.keys(data.articles)[0];
 const action=safeContentAction(data,JSON.stringify({type:'image',src:'/media/full/img/example.webp',article,audio:'https://bad.example/private',title:'A + B & C'}));
 assert.equal(action?.type,'image');
 if(action?.type==='image'){assert.equal(action.article,article);assert.equal(action.audio,undefined);assert.equal(action.title,'A + B & C');}
 assert.equal(safeContentAction(data,JSON.stringify({type:'image',src:'https://bad.example/image.jpg'})),null);
 assert.equal(safeContentAction(data,JSON.stringify({type:'image',src:'/media/full/../../private'})),null);
});
