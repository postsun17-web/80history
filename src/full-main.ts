import {readerArticleForRoute,bindDeferredSearch} from './visitor-ui-state';
import type {FullViewer} from './full-viewer';
import type {FullContent} from './full-content';
import type {VisitorReader} from './visitor-reader';
import {createVisitorCatalog} from './visitor-catalog';
import {useMediaPreview} from './visitor-media';
import {normalizePreferences,readPreferences,savePreferences} from './visitor-preferences';
import {searchEntries} from './visitor-search';
import {decodeAction,type SourceAction} from './source-actions';
import {assetUrl,type FullMuseum,type MenuItem} from './full-types';
import {parseFullRoute,fullRouteUrl,type FullRoute} from './full-navigation';
import './full-style.css';

const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML='<main class="entrance-shell"><p>영락교회 디지털역사관</p><h1>믿음의 발자취를 만나다</h1><p>전시실을 둘러보거나 글과 사진으로 역사를 읽어 보세요.</p><p role="status">관람을 준비하고 있습니다…</p></main>';
void boot().catch(error=>{console.error(error);app.innerHTML='<main class="entrance-shell"><h1>관람 준비를 완료하지 못했습니다.</h1><p>연결을 확인하고 다시 시도해 주세요.</p><button id="boot-retry">다시 준비하기</button></main>';document.querySelector<HTMLButtonElement>('#boot-retry')!.onclick=()=>location.reload();});
async function boot(){
const raw=await import('./data/full-museum.json');
const data=raw.default as unknown as FullMuseum;
const catalog=createVisitorCatalog(data);
let preferences=normalizePreferences(readPreferences(),catalog);
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const actions=new Map<string,SourceAction>();
function button(a:SourceAction,label:string,className=''){if(a.type==='chatbot')label='자료 검색';const key=String(actions.size);actions.set(key,a);return `<button class="${className}" data-action="${key}">${escape(label)}</button>`;}
function menuAction(m:MenuItem):SourceAction|null{return m.scene?{type:'scene',scene:m.scene,look:m.look}:decodeAction(m.action||'')||(m.url&&/^https?:/.test(m.url)?{type:'external',url:m.url}:null);}
const menus=data.menus.map((g,i)=>`<details class="menu-group" data-menu-index="${i}"><summary><span>${escape(g.title)}</span></summary><div class="submenu">${g.items.map(m=>{const a=menuAction(m);return a?button(a,m.title):'';}).join('')}</div></details>`).join('');
const quickIcons=['01','02','05','06','04'];
const quick=(data.quickMenu||[]).map((m,i)=>{const a=menuAction(m);if(!a)return '';const label=a.type==='chatbot'?'자료 검색':m.title;const key=String(actions.size);actions.set(key,a);return `<button data-action="${key}" aria-label="${escape(label)}" title="${escape(label)}"><img src="${assetUrl(`images/qmenu_ico${quickIcons[i]}.png`)}" alt=""><span>${escape(label)}</span></button>`;}).join('');
const persistentActionCount=actions.size;
$('#app').innerHTML=`<a class="skip-link" href="#full-menu">전시 메뉴로 건너뛰기</a>
 <main class="full-museum"><div id="panorama" aria-label="360도 디지털역사관. 마우스 또는 손가락으로 둘러보세요."></div>
 <header class="museum-header"><a href="?startscene=scene_vr02" class="museum-logo" aria-label="영락교회 디지털역사관 처음으로"><img src="${data.logo}" alt="영락교회 디지털역사관"></a><button id="mobile-menu" aria-controls="full-menu" aria-expanded="false" aria-label="전시 메뉴 열기">☰</button><nav id="full-menu" aria-label="전시실">${menus}</nav></header>
 <aside id="floorplan" aria-label="전시실 안내도"><div class="map-tools"><span>전시실 안내도</span><button id="map-enlarge" aria-label="안내도 확대">⛶</button><button id="map-close" aria-label="안내도 닫기">×</button></div><div class="map-scroll"><div class="full-map" style="aspect-ratio:${data.mapSize?.join('/')||'2200/2220'}"><img src="${data.map}" alt="영락교회 디지털역사관 평면도"><div class="e-annex" aria-hidden="true"><b>E</b><small>확장 전시실</small></div>${data.scenes.filter(s=>s.map).map(s=>`<button class="map-dot" data-scene="${s.id}" style="left:${s.map!.x}%;top:${s.map!.y}%" aria-label="${escape(s.title)} 이동" title="${escape(s.title)}"></button>`).join('')}<span id="map-direction" aria-hidden="true"></span></div></div></aside>
 <button id="map-open" hidden aria-label="전시실 안내도 열기">⌖ 안내도</button>
 <aside id="quick-menu" aria-label="빠른 메뉴"><button id="quick-toggle" aria-expanded="true" aria-label="빠른 메뉴 접기">❯</button><div class="quick-items">${quick}</div></aside>
 <div class="tour-controls"><button data-control="help" aria-label="관람 안내" title="관람 안내">?</button><button data-control="sound" aria-label="배경 음악 재생" aria-pressed="false" title="배경 음악">♫</button><button data-control="in" aria-label="확대">＋</button><button data-control="out" aria-label="축소">−</button><button data-control="fullscreen" aria-label="전체 화면">⛶</button></div>
 <div class="scene-caption"><span id="scene-name"></span><button id="all-scenes" aria-label="전체 공간 목록">⌄</button></div>
 <section id="page-bar" hidden aria-label="전시 페이지"></section>
 <details id="scene-resources"><summary>이 공간의 자료</summary><div></div></details>
 <section id="media-shelf" hidden aria-label="미디어센터 영상 목록"></section>
 <div id="scene-list" hidden><div class="scene-list-top"><h2>전체 공간</h2><button id="scene-list-close" aria-label="공간 목록 닫기">×</button></div><div class="scene-grid">${data.scenes.map(s=>`<button data-scene="${s.id}">${escape(s.title)}</button>`).join('')}</div></div>
 <div id="loading" role="status"></div><div id="scene-error" hidden role="alert"><p>이 공간을 불러오지 못했습니다.</p><button id="retry">다시 불러오기</button></div>
 <dialog id="welcome" hidden aria-label="디지털역사관에 오신 것을 환영합니다"><div class="welcome-card"><p>영락교회 디지털역사관</p><h1>믿음의 발자취를 만나다</h1><p>영락교회의 역사와 사람들을 만나 보세요.</p><button id="enter-museum">관람 시작 →</button><button id="start-read">글과 사진으로 보기</button><button id="resume" hidden>이어서 관람하기</button><button id="exterior">외부 먼저 둘러보기</button></div></dialog>
 <section id="reader" hidden aria-label="글과 사진으로 보기"></section>
 <aside id="visitor-context"><span id="location-label"></span><strong id="subject-label"></strong><span id="progress-label"></span><div><button id="previous-space">이전 공간</button><button id="lobby">로비</button><button id="next-exhibit">다음 전시</button><button id="mode-switch">글과 사진으로 보기</button></div></aside>
 <nav id="visitor-nav" aria-label="관람 메뉴"><button data-panel="rooms">전시실</button><button data-panel="materials">자료 보기</button><button data-panel="search">검색</button><button data-panel="more">더보기</button></nav>
 </main><dialog id="visitor-panel" aria-labelledby="panel-title"><header><h2 id="panel-title"></h2><button id="panel-close" aria-label="닫기">×</button></header><div id="panel-body"></div></dialog><dialog id="content-dialog"></dialog>`;

let route=parseFullRoute(location.search,data.scenes,data.zones),loaded='',generation=0,viewer:FullViewer|undefined,reader:VisitorReader|undefined,content:FullContent|undefined;
let viewerPromise:Promise<FullViewer>|undefined,contentPromise:Promise<FullContent>|undefined;
let readerArticle='',readerLocation='',tourLoad:Promise<void>=Promise.resolve();
let readerKey='',renderedModal='',internalClose=false,previousRoute:FullRoute|undefined,bgm:HTMLAudioElement|undefined;
const panel=$<HTMLDialogElement>('#visitor-panel'),dialog=$<HTMLDialogElement>('#content-dialog');
let panelFocus:HTMLElement|null=null,panelGeneration=0,activePanel='';
const coursePositions=new Map<string,number>();
function currentEntry(){return (route.exhibit?catalog.entries.find(e=>e.scene===route.scene&&e.page===route.page&&JSON.stringify(e.sourceAction)===route.exhibit):undefined)||catalog.getEntry(route.scene,route.page);}
function updateCourses(){const entry=currentEntry();for(const c of catalog.courses){const index=c.entryIds.indexOf(entry?.id||'');if(index>=0)coursePositions.set(c.id,index);}}
let articlesPromise:ReturnType<typeof import('./visitor-articles').loadVisitorArticles>|undefined;
const articles=()=>articlesPromise??=import('./visitor-articles').then(m=>m.loadVisitorArticles());
function persist(){preferences.lastRoute={...route};savePreferences(preferences);}
function saveView(){if(viewer&&loaded===route.scene&&route.mode!=='read'){route={...route,look:viewer.getLook()};history.replaceState({route},'',fullRouteUrl(route));}persist();}
function navigate(next:FullRoute,replace=false){saveView();if(next.scene!==route.scene){previousRoute={...route};delete previousRoute.exhibit;}route=parseFullRoute(fullRouteUrl(next),data.scenes,data.zones);generation++;history[replace?'replaceState':'pushState']({route},'',fullRouteUrl(route));persist();updateCourses();renderSceneUI();void apply();}
function perform(action:SourceAction){
 if(action.type==='scene')navigate({scene:action.scene,page:1,mode:route.mode,look:action.look||(viewer&&loaded===route.scene?viewer.getLook():undefined)});
 else if(action.type==='page'){const z=data.zones.find(z=>z.id===action.zone);if(z)navigate({scene:z.scene,page:action.page,mode:route.mode,look:z.scene===route.scene?(viewer&&loaded===route.scene?viewer.getLook():route.look):undefined});}
 else if(action.type==='external')window.open(action.url,'_blank','noopener,noreferrer');
 else if(action.type==='chatbot')openPanel('search');
 else if(action.type==='help')openPanel('help');
 else navigate({...route,look:viewer&&route.mode!=='read'?viewer.getLook():route.look,exhibit:JSON.stringify(action)});
 closeMenus();
}
function closeMenus(){document.querySelectorAll<HTMLDetailsElement>('.menu-group').forEach(n=>n.open=false);$('#full-menu').classList.remove('mobile-open');$('#mobile-menu').setAttribute('aria-expanded','false');}
function safeModal(value:string):SourceAction|null{
 if(value==='books'||value==='help'||value==='chatbot')return {type:value};
 try{const a=JSON.parse(value) as SourceAction;
 if(a.type==='gallery'&&data.galleries.some(g=>g.id===a.gallery&&g.items[a.index]))return a;
 if(a.type==='article'&&(data.articles[a.path]||catalog.entries.some(e=>e.sourceAction.type==='article'&&e.sourceAction.path===a.path)))return a;
 if(a.type==='document'&&/^photo\/[\w/-]+\.pdf$/.test(a.src))return a;
 if(a.type==='youtube'&&/^[\w-]{11}$/.test(a.id))return a;
 if(a.type==='books'||a.type==='help'||a.type==='chatbot')return a;
 if(a.type==='object'&&(a.folder&&/^ovr\/\d+$/.test(a.folder)||a.url&&/^https:\/\/(?:www\.)?spinzam\.com\//.test(a.url)))return a;
 if((a.type==='image'||a.type==='video'||a.type==='audio')&&typeof a.src==='string'&&!a.src.includes('..')&&/^(?:\/media\/|images\/|img\/|mov\/|mp3\/)/.test(a.src))return a;
 }catch{}return null;
}
async function ensureViewer(token:number){
 if(viewer)return viewer;
 return viewerPromise??=import('./full-viewer').then(({FullViewer})=>{
 if(token!==generation||route.mode==='read')throw new Error('Navigation superseded');
 viewer=new FullViewer($('#panorama'),data,perform,yaw=>{const s=data.scenes.find(s=>s.id===loaded);if(s?.map)$('#map-direction').style.transform=`translate(-50%,-50%) rotate(${yaw+s.map.heading}deg)`;});
 const v=viewer as FullViewer&{setQuality?:(q:string)=>void|Promise<void>};void Promise.resolve(v.setQuality?.(preferences.quality)).catch(()=>{});return viewer;
 }).catch(error=>{viewerPromise=undefined;throw error;});
}
async function showModal(token:number){
 const a=route.exhibit?safeModal(route.exhibit):null;
 if(!a||(route.mode==='read'&&a.type==='article')){if(dialog.open){internalClose=true;content?.close();internalClose=false;}renderedModal='';return;}
 if(a.type==='chatbot'||a.type==='help'){openPanel(a.type==='help'?'help':'search');return;}
 if(renderedModal===route.exhibit&&dialog.open)return;
 contentPromise??=import('./full-content').then(({FullContent})=>content=new FullContent(dialog,data,perform)).catch(error=>{contentPromise=undefined;throw Object.assign(error instanceof Error?error:new Error('Content unavailable'),{visitorContent:true});});
 const c=await contentPromise;if(token!==generation)return;
 (c as FullContent&{setFontSize?:(n:18|21|24)=>void}).setFontSize?.(preferences.fontSize);
 renderedModal=route.exhibit!;viewer?.viewer.stopKeyboardControl();c.open(a);
}
dialog.addEventListener('close',()=>{if(route.mode!=='read')viewer?.viewer.startKeyboardControl();if(!internalClose&&route.exhibit){const next={...route};delete next.exhibit;if(route.mode==='read'&&readerArticle)next.exhibit=readerArticle;navigate(next,true);}});
async function apply(){
 const token=generation,current={...route};$('#scene-error').hidden=true;
 const read=current.mode==='read';document.body.classList.toggle('reading-mode',read);$('#reader').hidden=!read;$('#panorama').hidden=read;
 try{
 if(read){if(viewer){viewer.viewer.stopKeyboardControl();const old=viewer as FullViewer&{destroy?:()=>void};if(old.destroy)old.destroy();else old.viewer.destroy();viewer=undefined;viewerPromise=undefined;loaded='';}
 if(!reader){const {VisitorReader}=await import('./visitor-reader');if(token!==generation)return;reader=new VisitorReader($('#reader'),data,catalog,{navigate,action:perform,fontSize:size=>{preferences.fontSize=size;savePreferences(preferences);readerKey='';void apply();}});}
 const a=current.exhibit?safeModal(current.exhibit):null;
 const place=current.scene+':'+current.page;if(place!==readerLocation){readerArticle='';readerLocation=place;}readerArticle=readerArticleForRoute(readerArticle,current.exhibit,a);
 const key=JSON.stringify([current.scene,current.page,readerArticle,preferences.fontSize]);
 if(key!==readerKey){readerKey=key;await reader.render({...current,exhibit:readerArticle||undefined},preferences.fontSize);}
 }else{
 $('#loading').textContent='전시 공간을 불러오는 중입니다';
 const task=tourLoad.catch(()=>{}).then(async()=>{if(token!==generation)return;const v=await ensureViewer(token);if(token!==generation)return;await v.show(current);if(token!==generation)return;loaded=current.scene;v.viewer.startKeyboardControl();});tourLoad=task;await task;if(token!==generation)return;
 }
 if(token!==generation)return;$('#loading').textContent='';await showModal(token);
 }catch(error){if(token!==generation)return;console.error(error);$('#loading').textContent='';$('#scene-error p').textContent=(error as {visitorContent?:boolean})?.visitorContent?'자료 화면을 불러오지 못했습니다. 다시 불러오기를 눌러 재시도해 주세요.':'이 공간을 불러오지 못했습니다. 다시 시도하거나 글과 사진으로 관람해 주세요.';$('#scene-error').hidden=false;}
}
function renderSceneUI(){
 for(const key of actions.keys())if(Number(key)>=persistentActionCount)actions.delete(key);
 const scene=data.scenes.find(s=>s.id===route.scene)!,zone=data.zones.find(z=>z.id===scene.zone),page=zone?.pages[route.page-1],entry=catalog.getEntry(route.scene,route.page);
 $('#scene-name').textContent=scene.title;$('#location-label').textContent=scene.title;$('#subject-label').textContent=page?.title||entry?.title||scene.title;$('#progress-label').textContent=zone?`${route.page} / ${zone.pages.length} 페이지`:'';
 $('#mode-switch').textContent=route.mode==='read'?'공간으로 보기':'글과 사진으로 보기';document.title=`${page?.title||scene.title} · 영락교회 디지털역사관`;
 $('#previous-space').toggleAttribute('disabled',!previousRoute);$('#next-exhibit').toggleAttribute('disabled',!entry||!catalog.getAdjacentExhibit(entry.id,'next'));
 document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(b=>b.setAttribute('aria-current',b.dataset.scene===scene.id?'location':'false'));
 const dir=$('#map-direction');dir.hidden=!scene.map;if(scene.map){dir.style.left=scene.map.x+'%';dir.style.top=scene.map.y+'%';}
 $('#page-bar').hidden=!zone;
 if(zone&&page)$('#page-bar').innerHTML=`<div class="page-caption"><strong>${escape(page.title)}</strong></div><div class="page-step"><button data-page="${route.page-1}" ${route.page<=1?'disabled':''} aria-label="이전 페이지">‹</button><select id="page-select" aria-label="전시 페이지 선택">${zone.pages.map(p=>`<option value="${p.number}" ${p.number===route.page?'selected':''}>${p.number}. ${escape(p.title)}</option>`).join('')}</select><span>${route.page} / ${zone.pages.length}</span><button data-page="${route.page+1}" ${route.page>=zone.pages.length?'disabled':''} aria-label="다음 페이지">›</button>${button({type:'image',src:page.image,title:page.title},'크게 보기','read-page')}</div>`;
 const materials=catalog.entries.filter(e=>e.scene===route.scene&&e.page===route.page&&e.kind!=='exhibit'&&e.kind!=='scene');
 $('#scene-resources').hidden=materials.length===0||route.mode==='read';$('#scene-resources > div').innerHTML=materials.map(e=>`<button data-entry="${escape(e.id)}">${escape(e.title)}</button>`).join('');
 $('#media-shelf').hidden=scene.id!=='scene_f-c-w-1'||route.mode==='read';
 if(scene.id==='scene_f-c-w-1')$('#media-shelf').innerHTML=`<details><summary>미디어센터 · 영상 선택</summary><div class="media-categories">${(data.mediaSections||[]).map(g=>`<details><summary>${escape(g.title)}</summary><div>${g.items.map(m=>{const a=menuAction(m);return a?button(a,m.title):`<p>${escape(m.title)} · 준비 중</p>`;}).join('')}</div></details>`).join('')}</div></details>`;
}
function closePanel(){panel.close();activePanel='';panelGeneration++;if(route.mode!=='read')viewer?.viewer.startKeyboardControl();panelFocus?.focus();}
function entryRoute(id:string,mode:'tour'|'read'):FullRoute|undefined{const e=catalog.entries.find(e=>e.id===id);return e?{scene:e.scene,page:e.page,look:e.look,mode,...(e.kind!=='exhibit'&&e.kind!=='scene'?{exhibit:JSON.stringify(e.sourceAction)}:{})}:undefined;}
const kindLabels:Record<string,string>={exhibit:'전시',scene:'공간',article:'글',image:'사진',gallery:'사진 모음',youtube:'영상',video:'영상',audio:'음성',object:'유물',document:'문서',books:'도서'};
function entryCards(ids:string[],both=true){return ids.map(id=>{const e=catalog.entries.find(e=>e.id===id);if(!e)return '';return `<article class="material-card">${e.thumbnail?`<img class="material-thumbnail" data-thumbnail="${escape(e.thumbnail)}" alt="" loading="lazy">`:''}<h3>${escape(e.title)}</h3><p>${escape(kindLabels[e.kind]||e.kind)} · ${escape(catalog.rooms.find(r=>r.id===e.room)?.title||e.room)} · ${e.page} 페이지</p><button data-entry-read="${escape(e.id)}">자료 읽기</button>${both?`<button data-entry-tour="${escape(e.id)}">공간에서 보기</button>`:''}</article>`;}).join('');}
function bindPreviews(){document.querySelectorAll<HTMLImageElement>('[data-thumbnail]').forEach(img=>useMediaPreview(img,img.dataset.thumbnail!,true));}
async function openPanel(name:string){
 closeMenus();if(!panel.open)panelFocus=document.activeElement as HTMLElement;activePanel=name;const token=++panelGeneration;viewer?.viewer.stopKeyboardControl();
 $('#panel-title').textContent=({rooms:'전시실과 공간',materials:'이 공간의 자료',search:'자료 검색',more:'관람 설정',help:'관람 안내'} as Record<string,string>)[name]||'관람 안내';
 const body=$('#panel-body');body.innerHTML='';if(!panel.open)panel.showModal();$('#panel-close').focus();
 if(name==='rooms')body.innerHTML=`<div class="room-shortcuts">${catalog.rooms.filter(r=>r.id!=='other').map(r=>`<button data-scene="${r.scene}">${escape(r.title)}</button>`).join('')}</div><h3>전체 공간 목록</h3>`+catalog.rooms.map(r=>`<details><summary>${escape(r.title)}</summary><div class="room-spaces">${data.scenes.filter(s=>catalog.getEntry(s.id,1)?.room===r.id).map(s=>`<button data-scene="${s.id}">${escape(s.title)}</button>`).join('')}</div></details>`).join('');
 if(name==='materials')body.innerHTML=entryCards(catalog.entries.filter(e=>e.scene===route.scene&&e.page===route.page&&e.kind!=='exhibit'&&e.kind!=='scene').map(e=>e.id))||'<p>이 공간에는 별도 자료가 없습니다. 전시 페이지를 글과 사진으로 살펴보세요.</p><button id="panel-read">글과 사진으로 보기</button>';
 if(name==='help')body.innerHTML='<p>전시실에서 공간을 선택하고 화면을 드래그하여 둘러보세요. 다음 전시는 다른 전시로, 페이지 화살표는 현재 전시의 다음 페이지로 이동합니다.</p><p>글과 사진으로 보기에서는 화면을 아래로 내려 읽을 수 있습니다. 사진은 눌러 크게 볼 수 있습니다.</p><p>대화형 안내는 연결되지 않았습니다. 자료 검색에서 원문 자료를 찾을 수 있습니다.</p><button data-panel="search">자료 검색 열기</button>';
 if(name==='more'){
 const entry=catalog.getEntry(route.scene,route.page);body.innerHTML=`<div class="more-utilities"><button data-panel="help">관람 안내</button><button data-control="sound" aria-pressed="${!!bgm&&!bgm.paused}">배경 음악 ${bgm&&!bgm.paused?'끄기':'재생'}</button><button data-control="fullscreen">전체 화면</button></div><label>글자 크기<select id="font-size">${[18,21,24].map(n=>`<option value="${n}" ${preferences.fontSize===n?'selected':''}>${n}px</option>`).join('')}</select></label><label>화질<select id="quality">${[['auto','자동'],['high','높음'],['economy','절약']].map(([v,t])=>`<option value="${v}" ${preferences.quality===v?'selected':''}>${t}</option>`).join('')}</select></label><button id="bookmark">${entry&&preferences.bookmarks.includes(entry.id)?'책갈피 해제':'현재 전시 책갈피'}</button><button id="share">주소와 제목 복사</button><p id="share-status" role="status"></p><button id="start-over">처음부터 관람</button><h3>내 책갈피</h3>${entryCards(preferences.bookmarks)||'<p>저장한 책갈피가 없습니다.</p>'}<h3>추천 관람 코스</h3>${catalog.courses.map(c=>`<article class="material-card"><h3>${escape(c.title)}</h3><p>${escape(c.description)}</p><p>${Math.max(0,(coursePositions.get(c.id)??-1)+1)} / ${c.entryIds.length} 전시</p><button data-course="${escape(c.id)}">${coursePositions.has(c.id)?'다음 단계':'코스 시작'}</button></article>`).join('')}`;
 }
 bindPreviews();
 if(name==='search'){
 body.innerHTML=`<form id="search-form"><label>검색어<input id="search-query" type="search" placeholder="인물, 사건, 자료 이름"></label><label>전시실<select id="search-room"><option value="">전체</option>${catalog.rooms.map(r=>`<option value="${r.id}">${escape(r.title)}</option>`).join('')}</select></label><label>자료 종류<select id="search-kind"><option value="">전체</option>${[...new Set(catalog.entries.map(e=>e.kind))].map(k=>`<option value="${k}">${escape(({scene:'공간',help:'안내',external:'연계 자료',chatbot:'자료 검색',exhibit:'전시',article:'글',image:'사진',gallery:'사진 모음',youtube:'영상',video:'영상',audio:'음성',object:'유물',document:'문서',books:'도서'} as Record<string,string>)[k]||k)}</option>`).join('')}</select></label><button>검색</button></form><p id="search-status" role="status">원문 자료를 준비하고 있습니다…</p><div id="search-results"></div>`;
 const form=$<HTMLFormElement>('#search-form'),pendingSearch=bindDeferredSearch(form),submit=form.querySelector<HTMLButtonElement>('button')!;submit.disabled=true;form.setAttribute('aria-busy','true');
 try{const texts=await articles();if(token!==panelGeneration||activePanel!=='search')return;
 const search=()=>{const results=searchEntries($<HTMLInputElement>('#search-query').value,catalog.entries,texts,{room:$<HTMLSelectElement>('#search-room').value||undefined,kind:$<HTMLSelectElement>('#search-kind').value||undefined});$('#search-status').textContent=`${results.length}개 자료`;
 $('#search-results').innerHTML=results.slice(0,150).map(r=>`<article class="material-card"><h3>${escape(r.title)}</h3><p>${escape(kindLabels[r.kind]||r.kind)} · ${escape(r.locationLabel)}</p><p>${escape(r.snippet)}</p><button data-entry-read="${escape(r.entryId)}">자료 읽기</button><button data-entry-tour="${escape(r.entryId)}">공간에서 보기</button></article>`).join('');bindPreviews();};
 submit.disabled=false;form.setAttribute('aria-busy','false');$('#search-room').onchange=search;$('#search-kind').onchange=search;pendingSearch.ready(search);
 }catch{if(token===panelGeneration){form.setAttribute('aria-busy','false');$('#search-status').innerHTML='검색 자료를 불러오지 못했습니다. <button data-reload>현재 화면 새로고침</button>';}articlesPromise=undefined;}
 }
}
function switchMode(){saveView();navigate({...route,mode:route.mode==='read'?'tour':'read'});}
document.addEventListener('click',event=>{
 const t=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!t)return;
 if(t.hasAttribute('data-reload'))location.reload();
 if(t.dataset.action){const a=actions.get(t.dataset.action);if(a)perform(a);}
 if(t.dataset.scene){const s=data.scenes.find(s=>s.id===t.dataset.scene);if(s){navigate({scene:s.id,page:1,look:catalog.getEntry(s.id,1)?.look||s.view,mode:route.mode});if(panel.open)closePanel();$('#scene-list').hidden=true;}}
 if(t.dataset.page){const zone=data.scenes.find(s=>s.id===route.scene)?.zone;if(zone)perform({type:'page',zone,page:Number(t.dataset.page)});}
 if(t.dataset.panel)void openPanel(t.dataset.panel);
 if(t.dataset.entry){const e=catalog.entries.find(e=>e.id===t.dataset.entry);if(e)perform(e.sourceAction);}
 if(t.dataset.entryRead||t.dataset.entryTour){const next=entryRoute((t.dataset.entryRead||t.dataset.entryTour)!,t.dataset.entryRead?'read':'tour');if(next){closePanel();navigate(next);}}
 if(t.dataset.course){const c=catalog.courses.find(c=>c.id===t.dataset.course);if(c){const index=coursePositions.get(c.id)??-1;const next=entryRoute(c.entryIds[(index+1)%c.entryIds.length],route.mode==='read'?'read':'tour');if(next){closePanel();navigate(next);}}}
 const control=t.dataset.control;
 if(control==='in'&&viewer)viewer.viewer.zoom(Math.min(100,viewer.viewer.getZoomLevel()+10));
 if(control==='out'&&viewer)viewer.viewer.zoom(Math.max(0,viewer.viewer.getZoomLevel()-10));
 if(control==='help')void openPanel('help');
 if(control==='fullscreen'){if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(()=>{});}
 if(control==='sound'){bgm??=new Audio(assetUrl('mp3/bg_short1.mp3'));bgm.preload='none';bgm.loop=true;bgm.volume=.18;if(bgm.paused)void bgm.play().then(()=>{t.setAttribute('aria-pressed','true');if(t.closest('#panel-body'))t.textContent='배경 음악 끄기';}).catch(()=>{});else{bgm.pause();t.setAttribute('aria-pressed','false');if(t.closest('#panel-body'))t.textContent='배경 음악 재생';}}
 if(t.id==='panel-read'){closePanel();navigate({...route,mode:'read'});}
 if(t.id==='bookmark'){const e=catalog.getEntry(route.scene,route.page);if(e){preferences.bookmarks=preferences.bookmarks.includes(e.id)?preferences.bookmarks.filter(id=>id!==e.id):[...preferences.bookmarks,e.id];savePreferences(preferences);void openPanel('more');}}
 if(t.id==='share'){saveView();const text=`${document.title}\n${location.href}`;void (async()=>{try{await navigator.clipboard.writeText(text);$('#share-status').textContent='주소와 제목을 복사했습니다.';}catch{const field=document.createElement('textarea');field.value=text;field.setAttribute('aria-label','복사할 주소와 제목');$('#share-status').replaceChildren(field);field.select();$('#share-status').append('주소를 선택하여 복사해 주세요.');}})();}
 if(t.id==='start-over'){closePanel();navigate({scene:'scene_f-c-0',page:1,mode:route.mode});}
});
document.addEventListener('change',event=>{const t=event.target as HTMLSelectElement;
 if(t.id==='page-select'){const zone=data.scenes.find(s=>s.id===route.scene)?.zone;if(zone)perform({type:'page',zone,page:Number(t.value)});}
 if(t.id==='font-size'){preferences.fontSize=Number(t.value) as 18|21|24;savePreferences(preferences);document.documentElement.style.setProperty('--visitor-font',preferences.fontSize+'px');readerKey='';void apply();}
 if(t.id==='quality'){preferences.quality=t.value as typeof preferences.quality;savePreferences(preferences);void Promise.resolve((viewer as (FullViewer&{setQuality?:(q:string)=>void|Promise<void>})|undefined)?.setQuality?.(preferences.quality)).catch(()=>{});}
});
$('#panel-close').onclick=closePanel;panel.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
$('#mobile-menu').onclick=()=>{const open=$('#full-menu').classList.toggle('mobile-open');$('#mobile-menu').setAttribute('aria-expanded',String(open));};
for(const d of document.querySelectorAll<HTMLDetailsElement>('.menu-group'))d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll<HTMLDetailsElement>('.menu-group').forEach(o=>{if(o!==d)o.open=false;});});
function setMap(open:boolean){$('#floorplan').hidden=!open;$('#map-open').hidden=open;}
$('#map-close').onclick=()=>setMap(false);$('#map-open').onclick=()=>setMap(true);$('#map-enlarge').onclick=()=>$('#floorplan').classList.toggle('expanded');
$('#quick-toggle').onclick=()=>{const folded=$('#quick-menu').classList.toggle('folded');$('#quick-toggle').setAttribute('aria-expanded',String(!folded));};
$('#all-scenes').onclick=()=>void openPanel('rooms');$('#scene-list-close').onclick=()=>$('#scene-list').hidden=true;
$('#retry').onclick=()=>void apply();$('#scene-error').insertAdjacentHTML('beforeend','<button id="error-read">글과 사진으로 보기</button><button id="error-back">이전 공간</button><button data-reload>현재 화면 새로고침</button>');
$('#error-read').onclick=()=>navigate({...route,mode:'read'});$('#error-back').onclick=()=>navigate(previousRoute||{scene:'scene_f-c-0',page:1,mode:'read'});
$('#mode-switch').onclick=switchMode;$('#lobby').onclick=()=>navigate({scene:'scene_f-c-0',page:1,mode:route.mode});$('#previous-space').onclick=()=>{if(previousRoute)navigate(previousRoute);};
$('#next-exhibit').onclick=()=>{const e=catalog.getEntry(route.scene,route.page),next=e&&catalog.getAdjacentExhibit(e.id,'next');if(next)navigate({scene:next.scene,page:next.page,look:next.look,mode:route.mode});};
window.addEventListener('popstate',()=>{generation++;route=parseFullRoute(location.search,data.scenes,data.zones);renderSceneUI();void apply();});window.addEventListener('pagehide',saveView);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenus();$('#scene-list').hidden=true;}});
document.documentElement.style.setProperty('--visitor-font',preferences.fontSize+'px');setMap(false);
let welcomeSeen=false;try{welcomeSeen=!!sessionStorage.getItem('museum-welcome');}catch{}
const explicit=new URLSearchParams(location.search);const welcome=!welcomeSeen&&!['startscene','page','startlookat','exhibit','mode'].some(k=>explicit.has(k));
function enter(next:FullRoute){if($('#welcome').hidden)return;$('#welcome').hidden=true;$<HTMLDialogElement>('#welcome').close();try{sessionStorage.setItem('museum-welcome','1');}catch{}navigate(next,true);}
$('#enter-museum').onclick=()=>enter({scene:'scene_f-c-0',page:1});$('#start-read').onclick=()=>enter({scene:'scene_f-c-0',page:1,mode:'read'});$('#exterior').onclick=()=>enter({scene:'scene_vr02',page:1});
$('#resume').hidden=!preferences.lastRoute;$('#resume').onclick=()=>{if(preferences.lastRoute)enter(preferences.lastRoute);};
$('#welcome').addEventListener('cancel',e=>e.preventDefault());
updateCourses();renderSceneUI();if(welcome){$('#welcome').hidden=false;$<HTMLDialogElement>('#welcome').showModal();$('#enter-museum').focus();}else{history.replaceState({route},'',fullRouteUrl(route));void apply();}
}
