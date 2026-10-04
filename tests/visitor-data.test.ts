import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createVisitorCatalog} from '../src/visitor-catalog.ts';
import {loadVisitorArticles} from '../src/visitor-articles.ts';
import {searchEntries} from '../src/visitor-search.ts';
import {normalizePreferences,readPreferences,savePreferences} from '../src/visitor-preferences.ts';
import {parseFullRoute,fullRouteUrl} from '../src/full-navigation.ts';
const data=JSON.parse(readFileSync(new URL('../src/data/full-museum.json',import.meta.url),'utf8'));
const catalog=createVisitorCatalog(data);
test('all scenes,207 pages and orphan article sources are accessible',async()=>{
 assert.equal(catalog.entries.filter(e=>e.kind==='exhibit').length,207);
 assert.equal(catalog.entries.filter(e=>e.kind==='scene').length,64);
 assert.equal(new Set(catalog.entries.map(e=>e.id)).size,catalog.entries.length);
 const articles=await loadVisitorArticles();assert.equal(Object.keys(articles).length,225);
 for(const path of Object.keys(articles))assert.ok(catalog.entries.some(e=>e.sourceAction.type==='article'&&e.sourceAction.path===path),path);
 for(const article of Object.values(articles))for(const image of article.images){assert.ok(image.src.startsWith('/media/full/'));assert.ok(existsSync('E:/CodexAssets/youngnak-full/'+image.src.slice('/media/full/'.length)),image.src);}
});
test('exhibition navigation crosses sections instead of moving one page',()=>{
 const first=catalog.getEntry(data.zones[0].scene,1)!;const next=catalog.getAdjacentExhibit(first.id,'next')!;
 assert.notEqual(next.scene,first.scene);assert.equal(next.page,1);
 const menu=data.menus.flatMap(m=>m.items).find(m=>m.scene===first.scene);assert.deepEqual(first.look,menu.look);
 for(const course of catalog.courses)for(const id of course.entryIds)assert.notEqual(catalog.entries.find(e=>e.id===id)?.room,'e');
});
test('real article search covers people,dates,mission and filters deterministically',async()=>{
 const articles=await loadVisitorArticles();for(const query of ['한경직','1950','선교'])assert.ok(searchEntries(query,catalog.entries,articles).length,query);
 assert.deepEqual(searchEntries('',catalog.entries,articles),[]);assert.deepEqual(searchEntries('없는검색xyz',catalog.entries,articles),[]);
 const results=searchEntries('1950',catalog.entries,articles,{kind:'article'});assert.ok(results.every(r=>r.kind==='article'));assert.deepEqual(results,searchEntries('1950',catalog.entries,articles,{kind:'article'}));
 const base=catalog.entries[0];assert.equal(searchEntries('같은 제목',[{...base,id:'one',title:'같은 제목'},{...base,id:'two',title:'같은 제목'}],{}).length,2);
});
test('mode routes preserve original URLs and invalid modes fall back',()=>{
 const route={scene:data.scenes[0].id,page:1,mode:'read' as const};assert.deepEqual(parseFullRoute(fullRouteUrl(route),data.scenes,data.zones),route);
 assert.equal(parseFullRoute('?mode=unknown',data.scenes,data.zones).mode,undefined);
});
test('preferences tolerate corrupt,blocked,unknown schema and prune invalid IDs',()=>{
 assert.equal(normalizePreferences({schemaVersion:2,fontSize:24}).fontSize,21);
 const valid=catalog.entries[0].id;assert.deepEqual(normalizePreferences({schemaVersion:1,fontSize:999,quality:'unknown',bookmarks:[valid,valid,'bad'],lastRoute:{scene:'bad',page:1}},catalog),{schemaVersion:1,fontSize:21,quality:'auto',bookmarks:[valid]});
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked');}});assert.equal(readPreferences().fontSize,21);savePreferences(normalizePreferences(null));
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{broken',setItem:()=>{throw Error('blocked');}}});assert.equal(readPreferences().quality,'auto');savePreferences(normalizePreferences(null));
 if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;
});
