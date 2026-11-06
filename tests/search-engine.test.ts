import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearchIndex, searchDocuments, highlightText, normalizeQuery} from '../src/search/engine.ts';
import type {SearchDocument} from '../src/search/types.ts';

const doc=(id:string,title:string,source:string,text:string):SearchDocument=>({id,kind:'hwp',title,source,paragraphs:[{id:'p1',text}]});
const documents=[
 doc('body','다른 기록','기록집','영락교회의 창립 기록입니다.'),
 doc('source','자료집','영락교회 역사','창립 이야기'),
 doc('title','영락교회 역사','기록집','창립 이야기'),
 doc('exact','영락교회','기록집','창립 이야기'),
];
test('search ranks exact title, title, source, then body and groups by document',()=>{
 const index=createSearchIndex(documents);
 assert.deepEqual(searchDocuments(index,'영락교회',1).results.map(x=>x.id),['exact','title','source','body']);
 assert.equal(searchDocuments(index,'영락교회 창립',1).total,4);
 assert.equal(searchDocuments(index,'영락교회 없는말',1).total,0);
});
test('normalization handles Korean composition, case, spaces and query limits',()=>{
 assert.equal(normalizeQuery('  영락\n 교회  '),'영락 교회');
 const index=createSearchIndex([doc('a','한글 ABC','출처','영락  교회')]);
 assert.equal(searchDocuments(index,'영락 교회 abc',1).total,1);
 assert.equal(searchDocuments(index,'   ',1).total,0);
 assert.throws(()=>searchDocuments(index,'가'.repeat(201),1),/200/);
});
test('highlight ranges preserve original decomposed text, whitespace and hostile markup',()=>{
 const original='영락\n  교회 <script>ABC</script>';
 const parts=highlightText(original,['영락','abc']);
 assert.equal(parts.map(p=>p.text).join(''),original);
 assert.deepEqual(parts.filter(p=>p.match).map(p=>p.text),['영락','ABC']);
});
test('pagination is stable, clamps stale pages and limits snippets',()=>{
 const docs=Array.from({length:45},(_,i)=>({...doc(String(i).padStart(2,'0'),'기록','영락','본문 영락'),paragraphs:Array.from({length:5},(_,j)=>({id:`p${j+1}`,text:`영락 ${j}`}))}));
 const index=createSearchIndex(docs.reverse());
 const page=searchDocuments(index,'영락',2);
 assert.equal(page.total,45);assert.equal(page.results.length,20);assert.equal(page.results[0].id,'20');
 assert.equal(page.results[0].snippets.length,3);
 assert.equal(searchDocuments(index,'영락',999).page,3);
 assert.equal(searchDocuments(index,'영락',NaN).page,1);
});
