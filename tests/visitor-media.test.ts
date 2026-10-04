import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const index=JSON.parse(readFileSync(new URL('../src/data/visitor-media.json',import.meta.url),'utf8'));
const museum=JSON.parse(readFileSync(new URL('../src/data/full-museum.json',import.meta.url),'utf8'));
test('all delivered 2048 panorama faces have immutable midresolution assets',()=>{
 assert.match(index.version,/^[a-f0-9]{16}$/);
 for(const scene of museum.scenes.filter((s:any)=>s.pano.faceSize>1024)){
  assert.deepEqual(Object.keys(index.panos[scene.id]).sort(),['b','d','f','l','r','u']);
  for(const url of Object.values(index.panos[scene.id]) as string[]){assert.ok(url.startsWith(`/visitor-assets/${index.version}/`));assert.ok(existsSync(new URL('../public'+url,import.meta.url)),url);}
 }
});
test('gallery derivatives map to actual source images and generated files',()=>{
 const originals=new Set(museum.galleries.flatMap((g:any)=>g.items.map((i:any)=>i.image)));
 for(const [original,derivatives] of Object.entries(index.images)){assert.ok(originals.has(original));for(const url of Object.values(derivatives as object) as string[])assert.ok(existsSync(new URL('../public'+url,import.meta.url)),url);}
 const expected=new Set(museum.galleries.flatMap((g:any)=>g.items.filter((i:any)=>!i.faces).map((i:any)=>i.image)));assert.equal(Object.keys(index.images).length,expected.size);
});
