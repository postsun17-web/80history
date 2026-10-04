import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceGalleryIssue} from '../src/source-defects.ts';

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
