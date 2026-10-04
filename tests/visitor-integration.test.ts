import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createVisitorCatalog} from '../src/visitor-catalog.ts';
import {readerArticleForRoute,bindDeferredSearch} from '../src/visitor-ui-state.ts';
import {loadImageWithFallback} from '../src/visitor-image.ts';
const data=JSON.parse(readFileSync(new URL('../src/data/full-museum.json',import.meta.url),'utf8'));
const catalog=createVisitorCatalog(data);
test('E shortcut and members refer only to the two approved extension scenes',()=>{
 const approved=data.scenes.filter(s=>s.source==='approved-e-extension').map(s=>s.id).sort();
 assert.deepEqual(catalog.entries.filter(e=>e.kind==='scene'&&e.room==='e').map(e=>e.scene).sort(),approved);
 assert.equal(catalog.rooms.find(r=>r.id==='e')?.scene,'scene_ext-e-entry');
 for(const scene of data.scenes.filter(s=>/^scene_[ef]-/.test(s.id)))assert.equal(catalog.getEntry(scene.id,1)?.room,'lobby',scene.id);
 assert.equal(catalog.rooms.find(r=>r.id==='lobby')?.scene,'scene_f-c-0');
});
test('photo course is a short unique source-backed gallery sequence with forward stops',()=>{
 const course=catalog.courses.find(c=>c.id==='photos')!;assert.ok(course.entryIds.length>=4&&course.entryIds.length<=6);
 const entries=course.entryIds.map(id=>catalog.entries.find(e=>e.id===id)!);
 assert.equal(new Set(entries.map(e=>e.sourceAction.type==='gallery'&&e.sourceAction.gallery)).size,entries.length);
 for(let index=0;index<entries.length;index++){
  const entry=entries[index];assert.notEqual(entry.room,'e');assert.equal(entry.sourceAction.type,'gallery');
  if(entry.sourceAction.type==='gallery'){const gallery=data.galleries.find(g=>g.id===entry.sourceAction.gallery);assert.ok(gallery?.items[entry.sourceAction.index]);}
  const current=catalog.entries.find(e=>e.scene===entry.scene&&e.page===entry.page&&JSON.stringify(e.sourceAction)===JSON.stringify(entry.sourceAction));assert.equal(current?.id,course.entryIds[index]);
  if(index+1<entries.length)assert.notEqual(course.entryIds[index+1],current?.id);
 }
});
test('history removal restores base reader while temporary media retains selected article',()=>{
 const exhibit=JSON.stringify({type:'article',path:'html/a03_03.html'});
 assert.equal(readerArticleForRoute('',exhibit,{type:'article',path:'html/a03_03.html'}),exhibit);
 assert.equal(readerArticleForRoute(exhibit,JSON.stringify({type:'image',src:'/media/full/x.webp'}),{type:'image',src:'/media/full/x.webp'}),exhibit);
 assert.equal(readerArticleForRoute(exhibit,undefined,null),'');
 assert.equal(readerArticleForRoute(exhibit,exhibit,{type:'article',path:'html/a03_03.html'}),exhibit);
});
test('cold search prevents submit navigation and searches the retained input once ready',()=>{
 const form=new EventTarget();let input='한경직',queries:string[]=[];const pending=bindDeferredSearch(form);
 const first=new Event('submit',{cancelable:true});form.dispatchEvent(first);assert.equal(first.defaultPrevented,true);assert.deepEqual(queries,[]);
 input='한경직 1950';pending.ready(()=>queries.push(input));assert.deepEqual(queries,['한경직 1950']);
 const next=new Event('submit',{cancelable:true});form.dispatchEvent(next);assert.equal(next.defaultPrevented,true);assert.deepEqual(queries,['한경직 1950','한경직 1950']);
});
test('media has exactly one original fallback and one terminal failure, with fresh retry',()=>{
 class ImageStub extends EventTarget{src='';}
 const image=new ImageStub();let failures=0;
 loadImageWithFallback(image as unknown as HTMLImageElement,'preview','original',()=>failures++);
 assert.equal(image.src,'preview');image.dispatchEvent(new Event('error'));assert.equal(image.src,'original');assert.equal(failures,0);
 image.dispatchEvent(new Event('error'));assert.equal(failures,1);image.dispatchEvent(new Event('error'));assert.equal(failures,1);
 const retry=new ImageStub();loadImageWithFallback(retry as unknown as HTMLImageElement,'preview','original',()=>failures++);retry.dispatchEvent(new Event('load'));retry.dispatchEvent(new Event('error'));assert.equal(failures,1);
});
