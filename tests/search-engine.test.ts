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
 assert.equal(page.results[0].snippets.length,1);
 assert.equal(searchDocuments(index,'영락',999).page,3);
 assert.equal(searchDocuments(index,'영락',NaN).page,1);
});

test('one representative excerpt preserves document-wide AND and prefers distinct terms over repetitions',()=>{
 const document={...doc('a','기록','출처',''),paragraphs:[
  {id:'p1',text:'교회 교회 교회 교회'},
  {id:'p2',text:'교회 학교의 설립 이야기'},
  {id:'p3',text:'피난민을 위한 기록'},
  {id:'p4',text:'교회 학교의 다른 이야기'},
 ]};
 const result=searchDocuments(createSearchIndex([document]),'교회 학교 피난민').results[0];
 assert.equal(result.snippets.length,1);
 assert.equal(result.snippets[0].paragraphId,'p2');
 assert.equal(result.snippets[0].parts.map(part=>part.text).join(''),document.paragraphs[1].text);
 assert.deepEqual(result.snippets[0].parts.filter(part=>part.match).map(part=>part.text),['교회','학교']);
});

test('title-only matches fall back to the first body paragraph',()=>{
 const document={...doc('a','영락교회','출처','첫 번째 본문'),paragraphs:[{id:'p1',text:'첫 번째 본문'},{id:'p2',text:'두 번째 본문'}]};
 const [snippet]=searchDocuments(createSearchIndex([document]),'영락교회').results[0].snippets;
 assert.equal(snippet.paragraphId,'p1');
 assert.equal(snippet.parts.map(part=>part.text).join(''),'첫 번째 본문');
});

test('the excerpt chooses a continuous window containing more distinct query terms',()=>{
 const original='교회 '+ '기록 '.repeat(100)+'교회와 학교 설립에 관한 이야기 '+ '내용 '.repeat(100);
 const [snippet]=searchDocuments(createSearchIndex([doc('a','기록','출처',original)]),'교회 학교').results[0].snippets;
 const excerpt=snippet.parts.map(part=>part.text).join('').replace(/^…|…$/gu,'');
 assert.ok(original.includes(excerpt));
 assert.ok(excerpt.length<=160);
 assert.ok(excerpt.includes('교회와 학교'));
 assert.deepEqual(snippet.parts.filter(part=>part.match).map(part=>part.text),['교회','학교']);
});

test('excerpt edges preserve compound graphemes and the original decomposed text',()=>{
 const cluster='👨‍👩‍👧‍👦가e\u0301';
 const original=cluster.repeat(30)+'영락교회'+cluster.repeat(30);
 const [snippet]=searchDocuments(createSearchIndex([doc('a','기록','출처',original)]),'영락교회').results[0].snippets;
 const excerpt=snippet.parts.map(part=>part.text).join('').replace(/^…|…$/gu,'');
 const start=original.indexOf(excerpt),end=start+excerpt.length;
 const boundaries=new Set([...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(original)].map(segment=>segment.index));
 boundaries.add(original.length);
 assert.ok(start>=0);
 assert.ok(boundaries.has(start));assert.ok(boundaries.has(end));
 assert.ok(excerpt.includes('영락교회'));
 assert.ok(excerpt.length<190);
});

test('a 200-character search term remains whole even when longer than the excerpt budget',()=>{
 const term='가'.repeat(200),original='앞 문장 '.repeat(20)+term+' 뒤 문장'.repeat(20);
 const [snippet]=searchDocuments(createSearchIndex([doc('a','기록','출처',original)]),term).results[0].snippets;
 const excerpt=snippet.parts.map(part=>part.text).join('').replace(/^…|…$/gu,'');
 assert.ok(original.includes(excerpt));
 assert.ok(excerpt.includes(term));
 assert.deepEqual(snippet.parts.filter(part=>part.match).map(part=>part.text),[term]);
});
