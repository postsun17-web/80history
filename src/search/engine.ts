import type {SearchDocument,SearchResponse,SearchSnippet,TextPart} from './types.ts';

export const normalizeQuery=(value:string)=>value.normalize('NFC').toLowerCase().replace(/\s+/gu,' ').trim();
export const queryTerms=(query:string)=>[...new Set(normalizeQuery(query).split(' ').filter(Boolean))];
type IndexedDocument={document:SearchDocument;title:string;source:string;body:string;paragraphs:string[]};
export function createSearchIndex(documents:SearchDocument[]):IndexedDocument[]{
 return documents.map(document=>{
  const paragraphs=document.paragraphs.map(p=>normalizeQuery(p.text));
  return {document,title:normalizeQuery(document.title),source:normalizeQuery(document.source),body:paragraphs.join(' '),paragraphs};
 });
}

/** Map normalized graphemes back to original UTF-16 offsets, including decomposed Korean. */
function normalizedMap(text:string){
 let value='';const starts:number[]=[],ends:number[]=[],boundaries=new Set<number>([text.length]);
 const segments=new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text);
 for(const item of segments){
  boundaries.add(item.index);
  const normalized=item.segment.normalize('NFC').toLowerCase();
  for(const char of normalized){
   if(/\s/u.test(char)){
    if(value.endsWith(' ')){ends[ends.length-1]=item.index+item.segment.length;continue;}
    value+=' ';starts.push(item.index);ends.push(item.index+item.segment.length);
   }else{
    value+=char;
    for(let i=0;i<char.length;i++){starts.push(item.index);ends.push(item.index+item.segment.length);}
   }
  }
 }
 return {value,starts,ends,boundaries};
}
export function highlightText(text:string,terms:string[]):TextPart[]{
 if(!terms.length)return [{text,match:false}];
 const map=normalizedMap(text),ranges:[number,number][]=[];
 for(const term of terms){
  if(!term)continue;
  let offset=0;
  while((offset=map.value.indexOf(term,offset))!==-1){
   ranges.push([map.starts[offset],map.ends[offset+term.length-1]]);offset+=term.length;
  }
 }
 ranges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const merged:[number,number][]=[];
 for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
 const parts:TextPart[]=[];let offset=0;
 for(const [start,end] of merged){if(start>offset)parts.push({text:text.slice(offset,start),match:false});parts.push({text:text.slice(start,end),match:true});offset=end;}
 if(offset<text.length)parts.push({text:text.slice(offset),match:false});
 return parts.length?parts:[{text,match:false}];
}
function snippet(text:string,terms:string[]):TextPart[]{
 const map=normalizedMap(text);
 const hits:{start:number;end:number;term:string}[]=[];
 for(const term of terms){
  let offset=0;
  while((offset=map.value.indexOf(term,offset))!==-1){
   hits.push({start:map.starts[offset],end:map.ends[offset+term.length-1],term});offset+=term.length;
  }
 }
 hits.sort((a,b)=>a.start-b.start||a.end-b.end);
 const windowAt=(from:number):[number,number]=>{
  let start=Math.max(0,Math.min(from,text.length-160)),end=Math.min(text.length,start+160);
  while(!map.boundaries.has(start))start--;
  while(!map.boundaries.has(end))end++;
  // Keep whole query matches at either edge, including overlapping or long terms.
  for(let i=hits.length-1;i>=0;i--)if(hits[i].start<start&&hits[i].end>start)start=hits[i].start;
  for(const hit of hits)if(hit.start<end&&hit.end>end)end=hit.end;
  return [start,end];
 };
 let [start,end]=windowAt(0),best=-1;
 const available=new Set(hits.map(hit=>hit.term)).size;
 // Try surrounding context and both match-aligned edges; keep source order on ties.
 select:for(const hit of hits)for(const from of [hit.start-35,hit.start,hit.end-160]){
  const [left,right]=windowAt(from);
  const count=new Set(hits.filter(match=>match.start>=left&&match.end<=right).map(match=>match.term)).size;
  if(count>best){start=left;end=right;best=count;}
  if(count===available)break select;
 }
 const parts=highlightText(text.slice(start,end),terms);
 if(start)parts.unshift({text:'…',match:false});if(end<text.length)parts.push({text:'…',match:false});
 return parts;
}
export function searchDocuments(index:IndexedDocument[],rawQuery:string,requestedPage=1):SearchResponse{
 if([...rawQuery].length>200)throw new Error('검색어는 200자 이내로 입력해 주세요.');
 const query=normalizeQuery(rawQuery),terms=queryTerms(query);
 if(!terms.length)return {query,page:1,pageCount:0,total:0,results:[]};
 const contains=(text:string)=>terms.every(term=>text.includes(term));
 const hits=index.filter(item=>terms.every(term=>item.title.includes(term)||item.source.includes(term)||item.body.includes(term))).map(item=>({item,rank:item.title===query?0:contains(item.title)?1:contains(item.source)?2:3}));
 hits.sort((a,b)=>a.rank-b.rank||a.item.document.title.localeCompare(b.item.document.title,'ko')||(a.item.document.id<b.item.document.id?-1:a.item.document.id>b.item.document.id?1:0));
 const pageCount=Math.ceil(hits.length/20),page=Math.max(1,Math.min(pageCount||1,Number.isSafeInteger(requestedPage)?requestedPage:1));
 const results=hits.slice((page-1)*20,page*20).map(({item})=>{
  const {document}=item;
  let selected=0,best=0;
  item.paragraphs.forEach((paragraph,i)=>{
   const count=terms.filter(term=>paragraph.includes(term)).length;
   if(count>best){selected=i;best=count;}
  });
  const paragraph=document.paragraphs[selected];
  const snippets:SearchSnippet[]=paragraph?[{paragraphId:paragraph.id,parts:snippet(paragraph.text,terms)}]:[];
  return {id:document.id,kind:document.kind,title:document.title,source:document.source,snippets};
 });
 return {query,page,pageCount,total:hits.length,results};
}
