import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSearchIndex,searchDocuments} from '../src/search/engine.ts';
import type {SearchDocument} from '../src/search/types.ts';

test('real corpus search reaches articles and HWP, and every excerpt comes from its cited paragraph',()=>{
 const {documents}=JSON.parse(readFileSync(new URL('../src/search/corpus.json',import.meta.url),'utf8')) as {documents:SearchDocument[]};
 const index=createSearchIndex(documents),byId=new Map(documents.map(document=>[document.id,document]));
 const first=searchDocuments(index,'한경직',1),results=[...first.results];
 for(let page=2;page<=first.pageCount;page++)results.push(...searchDocuments(index,'한경직',page).results);
 assert.ok(results.length>20);
 assert.equal(new Set(results.map(result=>result.id)).size,first.total);
 assert.ok(results.some(result=>result.kind==='article'));assert.ok(results.some(result=>result.kind==='hwp'));
 for(const result of results){
  assert.equal(result.snippets.length,1);
  const snippet=result.snippets[0];
  const original=byId.get(result.id)!.paragraphs.find(paragraph=>paragraph.id===snippet.paragraphId)!.text;
  const excerpt=snippet.parts.map(part=>part.text).join('').replace(/^…|…$/gu,'');
  assert.ok(original.includes(excerpt),`${result.id} excerpt must be actual source text`);
 }
 assert.ok(searchDocuments(index,'我則見天地一新',1).results.some(result=>result.kind==='hwp'));
});
