import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safeContentAction,normalizeContentRoute} from '../src/content-route.ts';
import {parseFullRoute,fullRouteUrl} from '../src/full-navigation.ts';
import type {FullMuseum} from '../src/full-types.ts';

const data=JSON.parse(readFileSync(new URL('../src/data/full-museum.json',import.meta.url),'utf8')) as FullMuseum;
const catalogue=JSON.parse(readFileSync(new URL('../src/search/catalogue.json',import.meta.url),'utf8'));
const action={type:'search',query:'한경직 + 역사 & 기록',resultPage:2};
test('legacy chatbot links and search links all resolve to one global search',()=>{
 for(const value of ['chatbot','search','{"type":"chatbot"}'])assert.deepEqual(safeContentAction(data,value),{type:'search',query:'',resultPage:1});
});
test('search result and paragraph routes round trip without changing museum view',()=>{
 const exhibit=JSON.stringify({...action,documentId:catalogue.documents[0].id,paragraphId:'p1'});
 const route={scene:'scene_d-n-w-2',page:2,look:[264,-11,113] as [number,number,number],exhibit};
 assert.deepEqual(normalizeContentRoute(data,route),route);
 const parsed=parseFullRoute(fullRouteUrl(route),data.scenes,data.zones);
 assert.deepEqual(parsed,route);assert.deepEqual(safeContentAction(data,parsed.exhibit!),JSON.parse(exhibit));
});
test('search rejects malformed queries, page values and unknown document targets',()=>{
 for(const invalid of [
  {...action,query:123},{...action,query:'가'.repeat(201)},
  {...action,resultPage:0},{...action,resultPage:1.5},{...action,resultPage:Number.MAX_SAFE_INTEGER+1},
  {...action,documentId:'https://bad.example'},{...action,paragraphId:'p1'},
  {...action,documentId:catalogue.documents[0].id,paragraphId:'p9999999'},
  {...action,documentId:catalogue.documents[0].id,paragraphId:'p1"] [onclick]'},
 ])assert.equal(safeContentAction(data,JSON.stringify(invalid)),null);
});
test('deep links normalize whitespace and Korean composition',()=>{
 const result=safeContentAction(data,JSON.stringify({...action,query:'  영락\n교회  '}));
 assert.deepEqual(result,{type:'search',query:'영락 교회',resultPage:2});
});
