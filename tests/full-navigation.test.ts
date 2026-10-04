import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFullRoute, fullRouteUrl} from '../src/full-navigation.ts';
const scenes=[{id:'scene_vr02'}, {id:'scene_c-s-e+1',zone:'c02'},{id:'scene_a-c-e+1',zone:'a06'}];
const zones=[{id:'c02',pages:Array(8).fill({})},{id:'a06',pages:Array(29).fill({})}];
test('original upper case and raw plus deep links resolve against the full catalogue',()=>{
 assert.equal(parseFullRoute('?startscene=scene_C-s-e+1&page=8',scenes,zones).scene,'scene_c-s-e+1');
 assert.equal(parseFullRoute('?startscene=scene_C-s-e%2B1&page=80',scenes,zones).page,8);
 assert.equal(parseFullRoute('?startscene=scene_a-c-e+1&page=29',scenes,zones).page,29);
});
test('invalid routes use original exterior and clamp page according to scene',()=>{
 assert.deepEqual(parseFullRoute('?startscene=oops&page=999&startlookat=1,no,90',scenes,zones),{scene:'scene_vr02',page:1});
});
test('content actions survive safe JSON deep-link round trip without executing source',()=>{
 const route={scene:'scene_a-c-e+1',page:12,look:[10,-1,100] as [number,number,number],exhibit:'gallery:a07-02:3'};
 assert.deepEqual(parseFullRoute(fullRouteUrl(route),scenes,zones),route);
});
