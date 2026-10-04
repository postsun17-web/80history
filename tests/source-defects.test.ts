import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceGalleryIssue,sourceGalleryNote} from '../src/source-defects.ts';
import {readFileSync} from 'node:fs';
import type {FullMuseum} from '../src/full-types.ts';
const museum=JSON.parse(readFileSync(new URL('../src/data/full-museum.json',import.meta.url),'utf8')) as FullMuseum;

test('blank C03 photo links display the matching delivered alternate while retaining legacy identity',()=>{
 for(const [id,image,title] of [
  ['c03:7','/media/full/galleries/c03-01/1.webp','한경직 목사 총회장 기념촬영(1955,04,26)'],
  ['c03:8','/media/full/galleries/c03-01/2.webp','WCC 지도자들의 한경직 목사 예방(1976.6.16.)'],
  ['c03:12','/media/full/galleries/c03-01/9.webp','빌리 그래함 한국전도대회 포스터'],
 ]){
  const recovery=sourceGalleryIssue('c03',id,museum.galleries)?.recovery;
  assert.equal(recovery?.type,'photo',id);
  if(recovery?.type!=='photo')continue;
  assert.equal(recovery.item.id,id);assert.equal(recovery.item.title,title);
  assert.equal(recovery.item.image,image);assert.equal(recovery.item.faces,undefined);
 }
 assert.match(sourceGalleryIssue('c03','c03:8',museum.galleries)?.recovery?.note??'',/1976.*1991/);
});

test('unfinished photo groups expose only the actual related source photographs',()=>{
 for(const [id,expected] of [
  ['c03:9',['c03-01:3','c03-01:4','c03-01:5']],
  ['c03:10',['c03-01:6','c03-01:7','c03-01:8']],
  ['c03:16',['c03-02:0','c03-02:1','c03-02:2','c03-02:3','c03-02:4']],
 ] as const){
  const recovery=sourceGalleryIssue('c03',id,museum.galleries)?.recovery;
  assert.equal(recovery?.type,'collection',id);
  if(recovery?.type!=='collection')continue;
  assert.deepEqual(recovery.items.map(target=>target.item.id),expected);
  for(const target of recovery.items)assert.equal(museum.galleries.find(g=>g.id===target.gallery)?.items[target.index].image,target.item.image);
 }
});

test('missing or unrelated alternate data never hides an unresolved blank',()=>{
 assert.equal(sourceGalleryIssue('c03','c03:7',[])?.recovery,undefined);
 const noLastPhoto=museum.galleries.map(g=>g.id==='c03-01'?{...g,items:g.items.slice(0,5)}:g);
 assert.equal(sourceGalleryIssue('c03','c03:9',noLastPhoto)?.recovery,undefined);
 assert.equal(sourceGalleryIssue('a07','a07:35',museum.galleries)?.recovery,undefined);
 assert.equal(sourceGalleryIssue('a07','c03:7',museum.galleries),undefined);
});

test('the same WCC photo discloses conflicting dates through both gallery routes',()=>{
 assert.match(sourceGalleryNote('c03','c03:8')??'',/1976.*1991/);
 assert.match(sourceGalleryNote('c03-01','c03-01:2')??'',/1976.*1991/);
 assert.equal(sourceGalleryNote('c03-01','c03-01:3'),undefined);
 assert.equal(sourceGalleryNote('a07','c03-01:2'),undefined);
});

test('audited empty originals report a source defect instead of rendering a successful white photo',()=>{
 const expected=[['c03:7','scene_08'],['c03:8','scene_09'],['c03:9','scene_10'],['c03:10','scene_11'],['c03:12','scene_13'],['c03:16','scene_17']];
 for(const [id,scene] of expected){
  const issue=sourceGalleryIssue('c03',id);
  assert.equal(issue?.sourceScene,scene,id);
  assert.equal(issue?.message,'전달받은 원본 이미지가 비어 있어 사진을 표시할 수 없습니다.');
  assert.ok(issue?.sourceFile.startsWith('photo/jpg파일모음/c03_jpg/'));
 }
});

test('real neighboring photos and similarly numbered photos in other galleries remain available',()=>{
 for(const [gallery,id] of [['c03','c03:6'],['c03','c03:11'],['c03','c03:13'],['a02','a02:7'],['a02','c03:7']])assert.equal(sourceGalleryIssue(gallery,id),undefined);
});

test('audited blank flat-photo slots retain their original gallery and scene identity',()=>{
 for(const [gallery,index,scene] of [
  ['a07',35,'scene_36'],['a07',36,'scene_37'],['a07',37,'scene_38'],['a07',38,'scene_39'],['a07',39,'scene_40'],
  ['b01',0,'scene_b01_00'],['c01',0,'scene_00'],['d01',0,'scene_00'],['d01',5,'scene_05'],['d01',16,'scene_16'],
  ['d02',0,'scene_00'],['d04',0,'scene_00'],['d04',2,'scene_02'],['d04',3,'scene_03'],
 ] as const)assert.equal(sourceGalleryIssue(gallery,`${gallery}:${index}`)?.sourceScene,scene);
});
