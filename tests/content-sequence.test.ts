import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {FullMuseum} from '../src/full-types.ts';
import {exhibitImageContext,imageSequence,articleImageSequence,sequenceAction} from '../src/content-sequence.ts';

const museum=JSON.parse(readFileSync(new URL('../src/data/full-museum.json',import.meta.url),'utf8')) as FullMuseum;

test('all 207 exhibit images stay within their 21 ordered topics and stop at boundaries',()=>{
 assert.equal(museum.zones.length,21);
 let total=0;
 for(const zone of museum.zones)for(const [index,page] of zone.pages.entries()){
  total++;
  const context=exhibitImageContext(museum,page.image);
  assert.equal(context?.zone.id,zone.id);assert.equal(context?.page.number,page.number);
  const sequence=imageSequence(museum,{type:'image',src:page.image});
  assert.equal(sequence.index,index);assert.equal(sequence.items.length,zone.pages.length);
  assert.equal(sequenceAction(sequence,-1)?.src,index?zone.pages[index-1].image:undefined);
  assert.equal(sequenceAction(sequence,1)?.src,zone.pages[index+1]?.image);
 }
 assert.equal(total,207);
});

test('source paths, WebP paths, full URLs and asset aliases resolve one exhibit without corrupting plus signs',()=>{
 const data={...museum,zones:[{id:'test',title:'test',scene:'scene_test',pages:[{number:1,title:'첫째',image:'/media/full/img/a+1.png.webp',hotspots:[]},{number:2,title:'둘째',image:'/media/full/img/a 1.png.webp',hotspots:[]}]}],assets:{'source/alias+1.png':'/media/full/img/a+1.png.webp'}};
 for(const src of ['img/a+1.png','https://museum.test/media/full/img/a%2B1.png.webp','source/alias+1.png'])assert.equal(exhibitImageContext(data,src)?.page.number,1);
 assert.equal(exhibitImageContext(data,'img/a%201.png')?.page.number,2);
 assert.equal(exhibitImageContext(data,'img/unknown.png'),undefined);
});

test('unknown standalone image is 1/1 and cannot move',()=>{
 const sequence=imageSequence(museum,{type:'image',src:'img/unknown.png',title:'자료 + 기록'});
 assert.equal(sequence.index,0);assert.equal(sequence.items.length,1);
 assert.equal(sequence.items[0].title,'자료 + 기록');
 assert.equal(sequenceAction(sequence,-1),undefined);assert.equal(sequenceAction(sequence,1),undefined);
});

test('article images follow linked order, deduplicate aliases, retain article and captions, and do not escape their article',()=>{
 const data={...museum,assets:{'original/first.png':'/media/full/galleries/first.webp'}};
 const action={type:'image' as const,src:'original/first.png',article:'html/c01_01.html'};
 const sequence=articleImageSequence(data,action,[{src:'/media/full/galleries/second.webp',title:'두 번째 자료'},{src:'/media/full/galleries/first.webp',title:'자료 + 1 & 2'},{src:'original/first.png',title:'중복'}]);
 assert.equal(sequence.items.length,2);assert.equal(sequence.index,1);
 assert.equal(sequence.items[1].title,'자료 + 1 & 2');
 assert.deepEqual(sequenceAction(sequence,-1),{type:'image',src:'/media/full/galleries/second.webp',title:'두 번째 자료',article:'html/c01_01.html'});
 assert.equal(sequenceAction(sequence,1),undefined);
 assert.equal(articleImageSequence(data,{...action,src:'other.png'},sequence.items).items.length,1);
});
