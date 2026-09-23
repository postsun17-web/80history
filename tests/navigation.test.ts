import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute, routeUrl, toPosition, verticalFov} from '../src/navigation.ts';
test('legacy raw and encoded plus scene IDs are retained',()=>{
 for(const id of ['scene_a-s-w-1+','scene_a-s-w-1%2B']) assert.equal(parseRoute('?startscene='+id).scene,'scene_a-s-w-1+');
});
test('unknown and numeric scenes fall back, malformed angles do not propagate',()=>{
 assert.equal(parseRoute('?startscene=999&page=99&startlookat=NaN,0,90').scene,'scene_f-c-0');
 assert.equal(parseRoute('?page=99').page,6);
 assert.equal(parseRoute('?startlookat=NaN,0,90').look,undefined);
 assert.doesNotThrow(()=>parseRoute('?startscene=%ZZ'));
});
test('route round trip preserves panel and modal and initial view',()=>{
 const r={scene:'scene_a-s-w-1+',page:4,exhibit:'photo-2',look:[170,-10,90] as [number,number,number]};
 assert.deepEqual(parseRoute(routeUrl(r)),r);
});
test('vertical angles are inverted and horizontal angles normalized',()=>{
 assert.equal(toPosition(90,30).yaw,Math.PI/2);
 assert.equal(toPosition(90,30).pitch,-Math.PI/6);
 assert.ok(Math.abs(toPosition(-90,0).yaw-Math.PI*1.5)<1e-9);
});
test('MFOV honors krpano 4:3 ratio, portrait and landscape',()=>{
 assert.ok(Math.abs(verticalFov(90,16/9)-58.7155)<0.001);
 assert.ok(Math.abs(verticalFov(90,9/16)-73.7398)<0.001);
 assert.equal(verticalFov(90,16/9,'VFOV'),90);
});
