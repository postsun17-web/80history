import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContentTitles,type TitleCatalogue} from '../src/title-resolver.ts';
import type {FullMuseum} from '../src/full-types.ts';

const data=JSON.parse(readFileSync(new URL('../src/data/full-museum.json',import.meta.url),'utf8')) as FullMuseum;
const catalogue=JSON.parse(readFileSync(new URL('../src/data/content-titles.json',import.meta.url),'utf8')) as TitleCatalogue;
const titles=createContentTitles(data,catalogue);
test('every exhibit, article, gallery and lobby image has a sourced reviewed title',()=>{
 const expectedPages=data.zones.flatMap(z=>z.pages.map(p=>`${z.id}:${p.number}`)).sort();
 assert.equal(expectedPages.length,207);
 assert.deepEqual(Object.keys(catalogue.pages).sort(),expectedPages);
 assert.deepEqual(Object.keys(catalogue.articles).sort(),Object.keys(data.articles).sort());
 assert.equal(Object.keys(catalogue.articles).length,224);
 assert.deepEqual(Object.keys(catalogue.galleries).sort(),data.galleries.flatMap(g=>g.items.map(i=>i.id)).sort());
 for(let n=1;n<=4;n++)for(const suffix of ['.png','_text.jpg'])assert.ok(catalogue.images[`images/zone_info0${n}${suffix}`]);
 for(const group of [catalogue.pages,catalogue.articles,catalogue.images,catalogue.galleries])for(const [key,entry] of Object.entries(group)){
  assert.ok(entry.title.trim()&&entry.title.length<120,`${key}: concise title`);
  assert.ok(entry.sources.length&&entry.sources.every(s=>typeof s==='string'&&s.trim()),`${key}: sources`);
  assert.ok(entry.reason.trim(),`${key}: review reason`);
  assert.doesNotMatch(entry.title,/\+·\+|…$|^\d+\||^image\d+$|^DSC[_\d]/i,key);
  assert.ok(!entry.matte||['dark','contrast'].includes(entry.matte),`${key}: supported matte`);
 }
});
test('all 207 panel actions, captions and legacy URLs resolve a single title',()=>{
 for(const zone of data.zones)for(const page of zone.pages){
  const title=titles.page(zone.id,page.number);
  assert.equal(titles.image(page.image,'오래된+잘못된+제목'),title,`${zone.id}:${page.number}`);
  assert.equal(titles.action({type:'image',src:page.image}).title,title);
 }
});
test('known mislabelled panels are identified by their actual contents',()=>{
 assert.equal(titles.page('c02',1),'보린의 정신과 영락사회복지재단의 발자취');
 assert.equal(titles.page('a02',4),'서북지역 기독교의 성장과 확산');
 assert.equal(titles.page('b03',1),'영락교회의 구국전도');
 assert.match(titles.page('c01',6),/숭실/);
 assert.match(titles.page('c01',7),/보성/);
 assert.equal(catalogue.pages['a07:1'].matte,'contrast','white years and black body both need legible contrast');
});
