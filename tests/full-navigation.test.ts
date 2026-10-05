import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFullRoute, fullRouteUrl} from '../src/full-navigation.ts';
const scenes=[{id:'scene_vr02'}, {id:'scene_c-s-e+1',zone:'c02'},{id:'scene_a-c-e+1',zone:'a06'}];
const zones=[{id:'c02',pages:Array(8).fill({})},{id:'a06',pages:Array(29).fill({})}];

test('retired E-room links normalize to original C02 page and view, discarding stale content',()=>{
 for(const id of ['scene_ext-e-entry','scene_ext-e-center','SCENE_EXT-E-ENTRY']){
  const route=parseFullRoute(`?startscene=${id}&page=8&startlookat=-90,20,80&exhibit=panel`,scenes,zones);
  assert.deepEqual(route,{scene:'scene_c-s-e+1',page:1,look:[90,0,105]});
  assert.equal(fullRouteUrl(route),'?startscene=scene_c-s-e%2B1&page=1&startlookat=90%2C0%2C105');
 }
});

test('original scene_e lobby viewpoints remain valid destinations',()=>{
 assert.deepEqual(parseFullRoute('?startscene=scene_e-c-0',[...scenes,{id:'scene_e-c-0'}],zones),{scene:'scene_e-c-0',page:1});
});
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

test('Korean titles, spaces, literal plus and ampersand survive shared links',()=>{
 const action={type:'image',src:'/media/full/img/A+B & 기록.png.webp',title:'보린의 정신 + 사랑 & 나눔'};
 const route={scene:'scene_c-s-e+1',page:1,exhibit:JSON.stringify(action)};
 assert.deepEqual(parseFullRoute(fullRouteUrl(route),scenes,zones),route);
 // Only the legacy raw-plus scene ID receives compatibility treatment.
 const legacy='?startscene=scene_c-s-e+1&page=1&exhibit='+encodeURIComponent(JSON.stringify(action)).replace(/%20/g,'+');
 assert.deepEqual(parseFullRoute(legacy,scenes,zones),route);
});
