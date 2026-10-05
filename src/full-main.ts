import raw from './data/full-museum.json';
import {FullViewer} from './full-viewer';
import {FullContent} from './full-content';
import {decodeAction,type SourceAction} from './source-actions';
import {assetUrl,type FullMuseum,type MenuItem} from './full-types';
import {parseFullRoute,fullRouteUrl,type FullRoute} from './full-navigation';
import {mapShortcuts,sceneSection} from './navigation-assist';
import {SceneHistory} from './scene-history';
import './full-style.css';

const data=raw as unknown as FullMuseum;
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const actions=new Map<string,SourceAction>();
function button(a:SourceAction,label:string,className=''){const key=String(actions.size);actions.set(key,a);return `<button class="${className}" data-action="${key}">${escape(label)}</button>`;}
function menuAction(m:MenuItem):SourceAction|null{return m.scene?{type:'scene',scene:m.scene,look:m.look}:decodeAction(m.action||'')||(m.url&&/^https?:/.test(m.url)?{type:'external',url:m.url}:null);}
const menus=data.menus.map((g,i)=>`<details class="menu-group" data-menu-index="${i}"><summary><span>${escape(g.title)}</span></summary><div class="submenu">${g.items.map(m=>{const a=menuAction(m);return a?button(a,m.title):'';}).join('')}</div></details>`).join('');
const quickIcons=['01','02','05','06','04'];
const quick=(data.quickMenu||[]).map((m,i)=>{const a=menuAction(m);if(!a)return '';const key=String(actions.size);actions.set(key,a);return `<button data-action="${key}" aria-label="${escape(m.title)}" title="${escape(m.title)}"><img src="${assetUrl(`images/qmenu_ico${quickIcons[i]}.png`)}" alt=""><span>${escape(m.title)}</span></button>`;}).join('');
const shortcuts=mapShortcuts(data.menus).map(shortcut=>{
 const key=String(actions.size);actions.set(key,shortcut.action);
 return `<button data-action="${key}" data-section="${shortcut.section}" aria-label="${shortcut.label} 전시실로 이동">${shortcut.label}</button>`;
}).join('');
const persistentActionCount=actions.size;
$('#app').innerHTML=`<a class="skip-link" href="#full-menu">전시 메뉴로 건너뛰기</a>
 <main class="full-museum"><div id="panorama" aria-label="360도 디지털역사관. 마우스 또는 손가락으로 둘러보세요."></div>
 <header class="museum-header"><a href="?startscene=scene_vr02" class="museum-logo" aria-label="영락교회 디지털역사관 처음으로"><img src="${data.logo}" alt="영락교회 디지털역사관"></a><button id="mobile-menu" aria-controls="full-menu" aria-expanded="false" aria-label="전시 메뉴 열기">☰</button><nav id="full-menu" aria-label="전시실">${menus}</nav></header>
 <aside id="floorplan" aria-label="전시실 안내도"><div class="map-tools"><span>전시실 안내도</span><button id="map-enlarge" aria-label="안내도 확대">⛶</button><button id="map-close" aria-label="안내도 닫기">×</button></div><nav class="map-shortcuts" aria-label="전시실 바로가기">${shortcuts}</nav><div class="map-scroll"><div class="full-map" style="aspect-ratio:${data.mapSize?.join('/')||'1733/2220'}"><img src="${data.map}" alt="영락교회 디지털역사관 평면도">${data.scenes.filter(s=>s.map).map(s=>`<button class="map-dot" data-scene="${s.id}" style="left:${s.map!.x}%;top:${s.map!.y}%" aria-label="${escape(s.title)} 이동" title="${escape(s.title)}"></button>`).join('')}<span id="map-direction" aria-hidden="true"></span></div></div></aside>
 <button id="map-open" hidden aria-label="전시실 안내도 열기">⌖ 안내도</button>
 <aside id="quick-menu" aria-label="빠른 메뉴"><button id="quick-toggle" aria-expanded="true" aria-label="빠른 메뉴 접기">❯</button><div class="quick-items">${quick}</div></aside>
 <div class="tour-controls"><button data-control="help" aria-label="관람 안내" title="관람 안내">?</button><button data-control="sound" aria-label="배경 음악 재생" aria-pressed="false" title="배경 음악">♫</button><button data-control="in" aria-label="확대">＋</button><button data-control="out" aria-label="축소">−</button><button data-control="fullscreen" aria-label="전체 화면">⛶</button></div>
 <div class="scene-caption"><span id="scene-name"></span><button id="all-scenes" aria-label="전체 공간 목록">⌄</button><button id="previous-location" disabled aria-label="이전 위치로 돌아가기">‹ 이전 위치</button></div>
 <section id="page-bar" hidden aria-label="전시 페이지"></section>
 <details id="scene-resources"><summary>이 공간의 자료</summary><div></div></details>
 <section id="media-shelf" hidden aria-label="미디어센터 영상 목록"></section>
 <div id="scene-list" hidden><div class="scene-list-top"><h2>전체 공간</h2><button id="scene-list-close" aria-label="공간 목록 닫기">×</button></div><div class="scene-grid">${data.scenes.map(s=>`<button data-scene="${s.id}">${escape(s.title)}</button>`).join('')}</div></div>
 <div id="loading" role="status"></div><div id="scene-error" hidden role="alert"><p>이 공간을 불러오지 못했습니다.</p><button id="retry">다시 불러오기</button></div>
 <section id="welcome" hidden aria-label="디지털역사관에 오신 것을 환영합니다"><div class="welcome-card"><img src="${assetUrl('info/intro.png')}" alt="영락교회 디지털역사관. 화면을 드래그하여 둘러보고 화살표와 자료 버튼을 눌러 관람하세요."><button id="enter-museum">ENTER <span>입장하기 →</span></button></div></section>
 </main><dialog id="content-dialog"></dialog>`;

let route=parseFullRoute(location.search,data.scenes,data.zones),loaded='',renderedModal='',internalClose=false;
let entering=false,navigationGeneration=0;
const viewer=new FullViewer($('#panorama'),data,perform,yaw=>{
 const scene=data.scenes.find(s=>s.id===(loaded||route.scene));if(scene?.map)$('#map-direction').style.transform=`translate(-50%,-50%) rotate(${yaw+scene.map.heading}deg)`;
});
const dialog=$<HTMLDialogElement>('#content-dialog');
const content=new FullContent(dialog,data,perform);
const bgm=new Audio(assetUrl('mp3/bg_short1.mp3'));bgm.loop=true;bgm.volume=.18;
const sceneHistory=new SceneHistory({
 show:next=>viewer.show(next),getLook:()=>viewer.getLook(),
 onPending:next=>{
  route=next;history.replaceState({route},'',fullRouteUrl(route));
  $('#scene-error').hidden=true;$('#loading').textContent=loaded!==next.scene?'전시 공간을 불러오는 중입니다':'';updatePrevious(true);
 },
 onCommit:next=>{
  route=next;loaded=next.scene;history.replaceState({route},'',fullRouteUrl(route));
  $('#loading').textContent='';renderSceneUI();showModal();updatePrevious();
 },
 onFailure:(attempt,error,restored)=>{
  console.error('Unable to load scene',attempt.scene,error);$('#loading').textContent='';
  $('#scene-error p').textContent=restored?'이동하지 못해 이전 공간으로 돌아왔습니다.':'이 공간을 불러오지 못했습니다.';
  $('#scene-error').hidden=false;updatePrevious();
 },
});

function updatePrevious(pending=false){
 const previous=sceneHistory.previous(),button=$<HTMLButtonElement>('#previous-location');
 button.disabled=pending||!previous;
 const title=previous&&data.scenes.find(s=>s.id===previous.scene)?.title;
 button.title=title?`${title} · ${previous!.page}쪽으로 돌아가기`:'이전 위치로 돌아가기';
}
function saveView(){if(loaded===route.scene&&!sceneHistory.busy){route={...route,look:viewer.getLook()};history.replaceState({route},'',fullRouteUrl(route));}}
function navigate(next:FullRoute,replace=false){
 navigationGeneration++;
 saveView();route=parseFullRoute(fullRouteUrl(next),data.scenes,data.zones);
 history[replace?'replaceState':'pushState']({route},'',fullRouteUrl(route));void sceneHistory.request(route);
}
function perform(action:SourceAction){
 if(action.type==='scene'){
  if(loaded==='scene_vr02'&&action.scene==='scene_f-c-0'){
   if(entering)return;entering=true;
   const generation=navigationGeneration;
   void viewer.enterLobby().finally(()=>{entering=false;if(generation===navigationGeneration&&route.scene==='scene_vr02')navigate({scene:action.scene,page:1,look:action.look||[0,0,100]});});
   return;
  }
  const look=action.look||(loaded?viewer.getLook():undefined);
  navigate({scene:action.scene,page:1,...(look?{look}:{})});
 }else if(action.type==='page'){
  const zone=data.zones.find(z=>z.id===action.zone);if(zone)navigate({scene:zone.scene,page:action.page,...(zone.scene===route.scene?{look:viewer.getLook()}:{})});
 }else if(action.type==='external'){window.open(action.url,'_blank','noopener,noreferrer');}
 else navigate({...route,look:viewer.getLook(),exhibit:JSON.stringify(action)});
 closeMenus();
}
function closeMenus(){for(const node of document.querySelectorAll<HTMLDetailsElement>('.menu-group'))node.open=false;$('#full-menu').classList.remove('mobile-open');$('#mobile-menu').setAttribute('aria-expanded','false');}
function safeModal(value:string):SourceAction|null{
 // Deep links are resolved against known content instead of executing arbitrary source or URLs.
 if(value==='books'||value==='chatbot'||value==='help')return {type:value};
 try{
  const a=JSON.parse(value) as SourceAction;
  if(a.type==='gallery'&&data.galleries.some(g=>g.id===a.gallery)&&Number.isInteger(a.index))return a;
  if(a.type==='article'&&data.articles[a.path])return a;
  if(a.type==='document'&&/^photo\/[\w/-]+\.pdf$/.test(a.src))return a;
  if(a.type==='youtube'&&/^[\w-]{11}$/.test(a.id))return a;
  if(a.type==='books'||a.type==='chatbot'||a.type==='help')return a;
  if(a.type==='object'&&(a.folder&&/^ovr\/\d+$/.test(a.folder)||a.url&&/^https:\/\/(?:www\.)?spinzam\.com\//.test(a.url)))return a;
  if((a.type==='image'||a.type==='video'||a.type==='audio')&&typeof a.src==='string'&&!a.src.includes('..')&&/^(?:\/media\/|images\/|img\/|mov\/|mp3\/)/.test(a.src))return a;
 }catch{/* Invalid or stale deep link: keep the visitor in the room. */}
 return null;
}
function showModal(){
 if(!route.exhibit){if(dialog.open){internalClose=true;content.close();internalClose=false;}renderedModal='';viewer.viewer.startKeyboardControl();return;}
 if(route.exhibit===renderedModal&&dialog.open)return;
 const a=safeModal(route.exhibit);if(!a)return;
 renderedModal=route.exhibit;viewer.viewer.stopKeyboardControl();content.open(a);
}
dialog.addEventListener('close',()=>{viewer.viewer.startKeyboardControl();if(!internalClose&&route.exhibit){const next={...route};delete next.exhibit;navigate(next,true);}});
function renderSceneUI(){
 for(const key of actions.keys())if(Number(key)>=persistentActionCount)actions.delete(key);
 const scene=data.scenes.find(s=>s.id===route.scene)!,zone=data.zones.find(z=>z.id===scene.zone),page=zone?.pages[route.page-1];
 for(const group of document.querySelectorAll<HTMLElement>('[data-menu-index]')){const i=Number(group.dataset.menuIndex),letter=String.fromCharCode(96+i);group.classList.toggle('current',i>0&&i<5?scene.id.startsWith(`scene_${letter}-`):i===0&&/^scene_[ef]-/.test(scene.id));}
 $('#scene-name').textContent=scene.title;
 document.title=`${scene.title} · 영락교회 디지털역사관`;
 for(const b of document.querySelectorAll<HTMLButtonElement>('[data-scene]'))b.setAttribute('aria-current',b.dataset.scene===scene.id?'location':'false');
 for(const b of document.querySelectorAll<HTMLButtonElement>('[data-section]'))b.setAttribute('aria-current',b.dataset.section===sceneSection(scene.id)?'location':'false');
 const dir=$('#map-direction');dir.hidden=!scene.map;if(scene.map){dir.style.left=scene.map.x+'%';dir.style.top=scene.map.y+'%';}
 $('#page-bar').hidden=!zone;
 if(zone&&page){
  $('#page-bar').innerHTML=`<div class="page-caption"><span>${escape(zone.title)}</span><strong>${escape(page.title)}</strong></div><div class="page-step"><button data-page="${route.page-1}" ${route.page<=1?'disabled':''} aria-label="이전 전시 페이지">‹</button><select id="page-select" aria-label="전시 페이지 선택">${zone.pages.map(p=>`<option value="${p.number}" ${p.number===route.page?'selected':''}>${p.number}. ${escape(p.title)}</option>`).join('')}</select><span>${route.page} / ${zone.pages.length}</span><button data-page="${route.page+1}" ${route.page>=zone.pages.length?'disabled':''} aria-label="다음 전시 페이지">›</button>${button({type:'image',src:page.image,title:page.title},'크게 보기','read-page')}</div>`;
 }
 const resources=[...scene.hotspots,...(page?.hotspots||[])].map(h=>({h,a:viewer.hotspotAction(h)})).filter(p=>p.a&&p.a.type!=='scene'&&p.a.type!=='page');
 const seen=new Set<string>();
 $('#scene-resources').hidden=resources.length===0;
 $('#scene-resources > div').innerHTML=resources.filter(p=>{const key=JSON.stringify(p.a);if(seen.has(key))return false;seen.add(key);return true;}).map(({h,a},i)=>{const attrs=viewer.resolve(h),sourceTitle=attrs.tooltip||attrs.title||'',title=/^hotspot_\d+$/.test(sourceTitle)?'':sourceTitle;return button(a!,title||`${a!.type==='gallery'?'사진':a!.type==='youtube'?'영상':a!.type==='object'?'유물':'자료'} ${i+1}`);}).join('');
 $('#media-shelf').hidden=scene.id!=='scene_f-c-w-1';
 if(scene.id==='scene_f-c-w-1')$('#media-shelf').innerHTML=`<details><summary>미디어센터 · 영상 선택</summary><div class="media-categories">${(data.mediaSections||[]).map(g=>`<details><summary>${escape(g.title)} <span>${g.items.length}</span></summary><div>${g.items.map(m=>{const a=menuAction(m);return a?button(a,m.title):`<p>${escape(m.title)} · 준비 중</p>`;}).join('')}</div></details>`).join('')}</div></details>`;
 positionSceneResources();
}
document.addEventListener('click',event=>{
 const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target)return;
 if(target.dataset.action){const a=actions.get(target.dataset.action);if(a)perform(a);}
 if(target.dataset.scene){const scene=data.scenes.find(s=>s.id===target.dataset.scene);if(scene)navigate({scene:scene.id,page:1,look:scene.view});$('#scene-list').hidden=true;}
 if(target.dataset.page){const scene=data.scenes.find(s=>s.id===route.scene)!;if(scene.zone)perform({type:'page',zone:scene.zone,page:Number(target.dataset.page)});}
 const control=target.dataset.control;
 if(control==='in')viewer.viewer.zoom(Math.min(100,viewer.viewer.getZoomLevel()+10));
 if(control==='out')viewer.viewer.zoom(Math.max(0,viewer.viewer.getZoomLevel()-10));
 if(control==='help')perform({type:'help'});
 if(control==='fullscreen'){if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen();}
 if(control==='sound'){
  if(bgm.paused)void bgm.play().then(()=>{target.setAttribute('aria-pressed','true');target.setAttribute('aria-label','배경 음악 끄기');}).catch(()=>{});
  else {bgm.pause();target.setAttribute('aria-pressed','false');target.setAttribute('aria-label','배경 음악 재생');}
 }
});
document.addEventListener('change',event=>{if((event.target as HTMLElement).id==='page-select'){const zone=data.scenes.find(s=>s.id===route.scene)?.zone;if(zone)perform({type:'page',zone,page:Number((event.target as HTMLSelectElement).value)});}});
$('#mobile-menu').onclick=()=>{const open=$('#full-menu').classList.toggle('mobile-open');$('#mobile-menu').setAttribute('aria-expanded',String(open));};
for(const details of document.querySelectorAll<HTMLDetailsElement>('.menu-group'))details.addEventListener('toggle',()=>{if(details.open)for(const other of document.querySelectorAll<HTMLDetailsElement>('.menu-group'))if(other!==details)other.open=false;});
function positionSceneResources(){
 positionSceneControls();
 const resources=$('#scene-resources'),map=$('#floorplan');
 if(matchMedia('(max-width: 700px)').matches&&map.hidden){resources.style.removeProperty('top');resources.style.removeProperty('bottom');resources.style.removeProperty('--resource-height');return;}
 const top=(map.hidden?$('#map-open'):map).getBoundingClientRect().bottom+6;
 resources.style.top=top+'px';resources.style.bottom='auto';resources.style.setProperty('--resource-height',Math.max(0,innerHeight-top-180)+'px');
}
function positionSceneControls(){
 const caption=$('.scene-caption'),neighbors=[$('#page-bar'),$('#media-shelf')];
 caption.style.removeProperty('max-width');for(const neighbor of neighbors)neighbor.style.removeProperty('bottom');
 if(matchMedia('(max-width: 700px)').matches)return;
 const bounds=caption.getBoundingClientRect();let maximum=365;
 for(const neighbor of neighbors){
  if(neighbor.hidden)continue;
  const other=neighbor.getBoundingClientRect();
  if(other.top>=bounds.bottom||other.bottom<=bounds.top)continue;
  const available=other.left-bounds.left-8;
  if(available>=180)maximum=Math.min(maximum,available);
  else neighbor.style.bottom=(innerHeight-bounds.top+8)+'px';
 }
 caption.style.maxWidth=maximum+'px';
}
function setMap(open:boolean){$('#floorplan').hidden=!open;$('#map-open').hidden=open;positionSceneResources();}
$('#map-close').onclick=()=>setMap(false);$('#map-open').onclick=()=>setMap(true);$('#map-enlarge').onclick=()=>{$('#floorplan').classList.toggle('expanded');positionSceneResources();};
new ResizeObserver(positionSceneResources).observe($('#floorplan'));window.addEventListener('resize',positionSceneResources);
$('#quick-toggle').onclick=()=>{const folded=$('#quick-menu').classList.toggle('folded');$('#quick-toggle').setAttribute('aria-expanded',String(!folded));};
$('#all-scenes').onclick=()=>{$('#scene-list').hidden=!$('#scene-list').hidden;};$('#scene-list-close').onclick=()=>{$('#scene-list').hidden=true;};
$('#previous-location').onclick=()=>{
 const previous=sceneHistory.previous();if(!previous||sceneHistory.busy)return;
 navigationGeneration++;saveView();route=previous;history.pushState({route},'',fullRouteUrl(route));void sceneHistory.back();
};
$('#retry').onclick=()=>{navigationGeneration++;void sceneHistory.retry();};
window.addEventListener('popstate',()=>{navigationGeneration++;route=parseFullRoute(location.search,data.scenes,data.zones);void sceneHistory.request(route);});
window.addEventListener('pagehide',saveView);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenus();$('#scene-list').hidden=true;}});
if(matchMedia('(max-width: 700px)').matches)setMap(false);
if(!new URLSearchParams(location.search).has('startscene')&&!sessionStorage.getItem('museum-welcome')){
 $('#welcome').hidden=false;viewer.viewer.stopKeyboardControl();
}
$('#enter-museum').onclick=()=>{$('#welcome').hidden=true;sessionStorage.setItem('museum-welcome','1');viewer.viewer.startKeyboardControl();};
history.replaceState({route},'',fullRouteUrl(route));void sceneHistory.request(route);
