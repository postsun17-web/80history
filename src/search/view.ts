import {getDocument,search} from './client';
import {highlightText,normalizeQuery,queryTerms} from './engine';
import type {SearchAction,SearchDocument,SearchResponse,SearchState,TextPart} from './types';
import './search.css';

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const marked=(parts:TextPart[])=>parts.map(part=>part.match?`<mark>${escape(part.text)}</mark>`:escape(part.text)).join('');
export type SearchView={update:(state:SearchState)=>void;dispose:()=>void};

export function mountSearchView(root:HTMLElement,initial:SearchState,onAction:(action:SearchAction)=>void):SearchView{
 const lifecycle=new AbortController();let state=initial,generation=0,disposed=false,first=true,returnTo:string|undefined;
 root.classList.add('museum-search');
 root.innerHTML='<form class="search-form" role="search"><label for="museum-search-input">역사 자료에서 찾기</label><div><input id="museum-search-input" type="search" maxlength="200" autocomplete="off" placeholder="인물, 사건, 연도 등을 입력하세요" aria-describedby="search-hint"><button type="submit">검색</button></div><p id="search-hint">전체 자료의 제목·본문·출처를 검색합니다. 여러 단어를 입력하면 모두 포함된 자료를 찾습니다.</p></form><div class="search-content" aria-busy="false"></div>';
 const form=root.querySelector<HTMLFormElement>('form')!,input=root.querySelector<HTMLInputElement>('input')!,content=root.querySelector<HTMLDivElement>('.search-content')!;
 const navigate=(next:SearchState)=>onAction({type:'search',...next});
 form.addEventListener('submit',event=>{
  event.preventDefault();
  if([...input.value].length>200){input.setCustomValidity('검색어는 200자 이내로 입력해 주세요.');input.reportValidity();return;}
  const query=normalizeQuery(input.value);if(!query){input.focus();return;}
  returnTo=undefined;navigate({query,resultPage:1});
 },{signal:lifecycle.signal});
 input.addEventListener('input',()=>input.setCustomValidity(''),{signal:lifecycle.signal});
 content.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target.closest<HTMLButtonElement>('button[data-search-command]'):null;if(!target)return;
  const command=target.dataset.searchCommand;
  if(command==='document')navigate({...state,documentId:target.dataset.searchDocument,paragraphId:target.dataset.searchParagraph});
  if(command==='page'){returnTo=undefined;navigate({query:state.query,resultPage:Number(target.dataset.searchPage)});}
  if(command==='back'){returnTo=state.documentId;navigate({query:state.query,resultPage:state.resultPage});}
  if(command==='retry')update(state);
 },{signal:lifecycle.signal});
 function focusResult(){
  const target=returnTo?Array.from(content.querySelectorAll<HTMLButtonElement>('[data-search-document]')).find(button=>button.dataset.searchDocument===returnTo):undefined;
  (target??content.querySelector<HTMLElement>('h3'))?.focus({preventScroll:true});
  if(target)target.scrollIntoView({block:'center'});else root.scrollTop=0;
  returnTo=undefined;
 }
 function results(response:SearchResponse){
  state={...state,resultPage:response.page};
  const heading=`<h3 tabindex="-1">‘${escape(state.query)}’ 검색 결과 <span>${response.total.toLocaleString('ko')}건</span></h3>`;
  const list=response.results.map(result=>{
   const snippet=result.snippets[0];
   return `<li><h4><button type="button" title="${escape(result.title)}" data-search-command="document" data-search-document="${escape(result.id)}" data-search-paragraph="${escape(snippet?.paragraphId??'p1')}">${marked(highlightText(result.title,queryTerms(state.query)))}</button></h4><p class="search-source" title="${escape(result.source)}">출처: ${escape(result.source)}</p>${snippet?`<button class="search-excerpt" type="button" data-search-command="document" data-search-document="${escape(result.id)}" data-search-paragraph="${escape(snippet.paragraphId)}" aria-label="${escape(result.title)} 본문에서 이 문단 읽기"><span class="search-excerpt-text">${marked(snippet.parts)}</span></button>`:''}</li>`;
  }).join('');
  const paging=response.pageCount>1?`<nav class="search-paging" aria-label="검색 결과 페이지"><button type="button" data-search-command="page" data-search-page="${response.page-1}" ${response.page===1?'disabled':''}>이전</button><span>${response.page} / ${response.pageCount}</span><button type="button" data-search-command="page" data-search-page="${response.page+1}" ${response.page===response.pageCount?'disabled':''}>다음</button></nav>`:'';
  content.innerHTML=heading+(response.total?`<ol class="search-results" start="${(response.page-1)*20+1}">${list}</ol>`:'<p class="search-empty">일치하는 자료가 없습니다. 다른 표현이나 짧은 단어로 다시 검색해 보세요.</p>')+paging;
  focusResult();
 }
 function documentView(document:SearchDocument){
  const terms=queryTerms(state.query);
  content.innerHTML=`<button class="search-back" type="button" data-search-command="back">← 검색 결과로</button><article class="search-document"><h3 tabindex="-1">${escape(document.title)}</h3><p class="search-source">출처: ${escape(document.source)}</p>${document.articlePath?`<a class="search-original" href="/media/full/${escape(document.articlePath)}" target="_blank" rel="noopener noreferrer">원본 기사 새 창에서 보기</a>`:''}<div class="search-document-body">${document.paragraphs.map(paragraph=>`<p id="search-${paragraph.id}" tabindex="-1">${terms.some(term=>normalizeQuery(paragraph.text).includes(term))?marked(highlightText(paragraph.text,terms)):escape(paragraph.text)}</p>`).join('')}</div></article>`;
  const paragraph=state.paragraphId?content.querySelector<HTMLElement>(`#search-${state.paragraphId}`):null;
  const target=paragraph??content.querySelector<HTMLElement>('h3');target?.focus({preventScroll:true});
  if(paragraph)paragraph.scrollIntoView({block:'start'});else root.scrollTop=0;
 }
 function update(next:SearchState){
  if(state.documentId&&!next.documentId&&state.query===next.query&&state.resultPage===next.resultPage)returnTo=state.documentId;
  state=next;input.value=state.query;const current=++generation;
  const initialFocus=first;first=false;
  content.setAttribute('aria-busy','true');content.innerHTML='<p class="search-empty" role="status">자료를 불러오는 중입니다.</p>';
  const work=state.documentId?getDocument(state.documentId):search(state.query,state.resultPage);
  if(initialFocus&&!state.documentId&&!state.query)input.focus();
  void work.then(response=>{
   if(disposed||current!==generation)return;
   content.setAttribute('aria-busy','false');
   if('paragraphs' in response)documentView(response);
   else if(!normalizeQuery(state.query)){
    content.innerHTML='<div class="search-empty"><p>영락교회의 기록을 찾아보세요.</p><p>기사 224건과 문서 26건의 제목·본문·출처에서 검색합니다.</p></div>';
   }else results(response);
  }).catch(error=>{
   if(disposed||current!==generation)return;
   content.setAttribute('aria-busy','false');content.innerHTML=`<p role="alert">${escape(error instanceof Error?error.message:'자료를 불러오지 못했습니다.')}</p><button class="search-back" type="button" data-search-command="retry">다시 불러오기</button>`;
  });
 }
 update(initial);
 return {update,dispose:()=>{disposed=true;generation++;lifecycle.abort();}};
}
