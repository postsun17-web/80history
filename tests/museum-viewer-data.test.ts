import test from 'node:test';
import assert from 'node:assert/strict';
import {panoramaSource,localMuseumObject,objectFrameWindow} from '../src/museum-viewer-data.ts';

test('memorial panorama retains full resolution and maps sorted PSV level indexes to source directories',()=>{
 const source=panoramaSource({root:'/media/memorial/panos/room',faceSize:8960,tiles:16,level:4,ext:'webp',levels:[{faceSize:8960,tiles:16,level:4},{faceSize:1152,tiles:2,level:1},{faceSize:4608,tiles:8,level:3}]});
 assert.deepEqual(source.levels,[{faceSize:1152,nbTiles:2},{faceSize:4608,nbTiles:8},{faceSize:8960,nbTiles:16}]);
 assert.equal(source.tileUrl('top',15,14,2),'/media/memorial/panos/room/u/4/14_15.webp');
 assert.equal(source.tileUrl('front',1,0,0),'/media/memorial/panos/room/f/1/0_1.webp');
 assert.equal(source.flipTopBottom,true);
 assert.equal(source.baseUrl.bottom,'/media/memorial/panos/room/d/base.webp');
});
test('historical museum single-level panorama URLs remain unchanged',()=>{
 const source=panoramaSource({root:'/media/full/panos/vr02',faceSize:2048,tiles:4,level:3,ext:'webp'});
 assert.deepEqual(source.levels,[{faceSize:2048,nbTiles:4}]);
 assert.equal(source.tileUrl('right',2,1,0),'/media/full/panos/vr02/r/3/1_2.webp');
});
test('only a known original Spinzam object maps to locally hosted frames',()=>{
 const object={id:'519164',title:'영락교회 창립 25주년 기념메달',frames:['/media/memorial/objects/519164/0.webp']};
 assert.equal(localMuseumObject({objects:{519164:object}},{type:'object',url:'https://spinzam.com/shot/?idx=519164'}),object);
 assert.equal(localMuseumObject({objects:{519164:object}},{type:'object',url:'https://spinzam.com/shot/embed/?idx=519164'}),object);
 assert.equal(localMuseumObject({objects:{519164:object}},{type:'object',url:'https://example.com/?idx=519164'}),undefined);
 assert.equal(localMuseumObject({objects:{519164:object}},{type:'object',url:'https://spinzam.com/shot/?idx=1'}),undefined);
});
test('rotation preload window wraps and keeps only the current frame and immediate neighbors',()=>{
 assert.deepEqual(objectFrameWindow(0,36),[0,35,1]);
 assert.deepEqual(objectFrameWindow(-1,36),[35,34,0]);
 assert.deepEqual(objectFrameWindow(73,36),[1,0,2]);
 assert.deepEqual(objectFrameWindow(0,1),[0]);
 assert.deepEqual(objectFrameWindow(0,0),[]);
});
