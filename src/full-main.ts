import {FullViewer} from './full-viewer';
import {FullContent} from './full-content';
import {titlesForMuseum} from './content-titles';
import {memorialDestination,museumIdAt} from './museum-route';
import {normalizeContentRoute,safeContentAction} from './content-route';
import type {MuseumAudio} from './museum-audio';
import {decodeAction,type SourceAction} from './source-actions';
import {assetUrl,type FullMuseum,type MenuItem,type MuseumId} from './full-types';
import {parseFullRoute,fullRouteUrl,type FullRoute} from './full-navigation';
import './full-style.css';

export function mountMuseum(data:FullMuseum,audio:MuseumAudio,onMuseum:(id:MuseumId)=>void,initialRoute?:FullRoute){
const memorial=data.id==='memorial',museumId:MuseumId=memorial?'memorial':'history';
const museumTitle=memorial?'한경직목사기념관':'영락교회 디지털역사관';
const contentTitles=titlesForMuseum(data),lifecycle=new AbortController();
let disposed=false,viewTimer:ReturnType<typeof setTimeout>|undefined,audioScene='';
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const actions=new Map<string,SourceAction>();
function button(a:SourceAction,label:string,className=''){const key=String(actions.size);actions.set(key,a);return `<button class="${className}" data-action="${key}">${escape(label)}</button>`;}
function menuAction(m:MenuItem):SourceAction|null{return m.scene?{type:'scene',scene:m.scene,look:m.look}:decodeAction(m.action||'')||(m.url&&/^https?:/.test(m.url)?{type:'external',url:m.url}:null);}
const menus=data.menus.map((g,i)=>`<details class="menu-group" data-menu-index="${i}"><summary><span>${escape(g.title)}</span></summary><div class="submenu">${g.items.map(m=>{const a=menuAction(m);return a?button(a,m.title):'';}).join('')}</div></details>`).join('');
const quickIcons=['01','02','05','06','04'];
const quick=(data.quickMenu||[]).map((m,i)=>{const a=menuAction(m);if(!a)return '';const key=String(actions.size);actions.set(key,a);return `<button data-action="${key}" aria-label="${escape(m.title)}" title="${escape(m.title)}"><img src="${assetUrl(`images/qmenu_ico${quickIcons[i]}.png`)}" alt=""><span>${escape(m.title)}</span></button>`;}).join('');
const persistentActionCount=actions.size;
$('#app').innerHTML=`${memorial?'':'<a class="skip-link" href="#full-menu">전시 메뉴로 건너뛰기</a>'}
 <main class="full-museum${memorial?' is-memorial':''}"><div id="panorama" aria-label="360도 ${museumTitle}. 마우스 또는 손가락으로 둘러보세요."></div>
 ${memorial?'<header class="memorial-header"><button id="return-museum">← 역사관으로</button><span>한경직목사기념관</span></header>':''}
 <header class="museum-header"><a href="?startscene=scene_vr02" class="museum-logo" aria-label="영락교회 디지털역사관 처음으로"><img src="${data.logo}" alt="영락교회 디지털역사관"></a><button id="mobile-menu" aria-controls="full-menu" aria-expanded="false" aria-label="전시 메뉴 열기">☰</button><nav id="full-menu" aria-label="전시실">${menus}</nav></header>
 <aside id="floorplan" aria-label="전시실 안내도"><div class="map-tools"><span>전시실 안내도</span><button id="map-enlarge" aria-label="안내도 확대">⛶</button><button id="map-close" aria-label="안내도 닫기">×</button></div><div class="map-scroll"><div class="full-map" style="aspect-ratio:${data.mapSize?.join('/')||'1733/2220'}"><img src="${data.map}" alt="영락교회 디지털역사관 평면도">${data.scenes.filter(s=>s.map).map(s=>`<button class="map-dot" data-scene="${s.id}" style="left:${s.map!.x}%;top:${s.map!.y}%" aria-label="${escape(s.title)} 이동" title="${escape(s.title)}"></button>`).join('')}<span id="map-direction" aria-hidden="true"></span></div></div></aside>
 <button id="map-open" hidden aria-label="전시실 안내도 열기">⌖ 안내도</button>
 <aside id="quick-menu" aria-label="빠른 메뉴"><button id="quick-toggle" aria-expanded="true" aria-label="빠른 메뉴 접기">❯</button><div class="quick-items">${quick}</div></aside>
 <div class="tour-controls">${memorial?'<button data-floor="1" aria-label="기념관 1층 입구로 이동">1F</button><button data-floor="2" aria-label="기념관 2층 입구로 이동">2F</button>':'<button data-control="help" aria-label="관람 안내" title="관람 안내">?</button>'}<button data-control="sound" aria-label="소리 켜기" aria-pressed="false" title="소리 켜기">♫</button><button data-control="in" aria-label="확대">＋</button><button data-control="out" aria-label="축소">−</button><button data-control="fullscreen" aria-label="전체 화면">⛶</button></div>
 <button id="enable-audio" hidden>소리 켜고 관람</button><aside id="scene-audio-controls" hidden aria-label="이 장소의 음성 해설"><span id="scene-audio-title"></span></aside>
 <div class="scene-caption"><span id="scene-name"></span><button id="all-scenes" aria-label="전체 공간 목록">⌄</button></div>
 <section id="page-bar" hidden aria-label="전시 페이지"></section>
 <section id="media-shelf" hidden aria-label="미디어센터 영상 목록"></section>
 <div id="scene-list" hidden><div class="scene-list-top"><h2>전체 공간</h2><button id="scene-list-close" aria-label="공간 목록 닫기">×</button></div><div class="scene-grid">${data.scenes.map(s=>`<button data-scene="${s.id}">${escape(s.title)}</button>`).join('')}</div></div>
 <div id="loading" role="status"></div><div id="scene-error" hidden role="alert"><p>이 공간을 불러오지 못했습니다.</p><button id="retry">다시 불러오기</button></div>
 <section id="welcome" hidden aria-label="디지털역사관에 오신 것을 환영합니다"><div class="welcome-card"><img src="${assetUrl('info/intro.png')}" alt="영락교회 디지털역사관. 화면을 드래그하여 둘러보고 화살표와 자료 버튼을 눌러 관람하세요."><button id="enter-museum">ENTER <span>입장하기 →</span></button></div></section>
 </main><dialog id="content-dialog"></dialog>`;

let route=normalizeContentRoute(data,initialRoute||parseFullRoute(location.search,data.scenes,data.zones)),busy=false,queued=false,loaded='',renderedModal='',internalClose=false;
let lastGood:FullRoute|undefined,entering=false,navigationGeneration=0;
const viewer=new FullViewer($('#panorama'),data,perform,yaw=>{
 const scene=data.scenes.find(s=>s.id===loaded||s.id===route.scene);if(scene?.map)$('#map-direction').style.transform=`translate(-50%,-50%) rotate(${yaw+scene.map.heading}deg)`;
 clearTimeout(viewTimer);viewTimer=setTimeout(saveView,200);
},audio);
const dialog=$<HTMLDialogElement>('#content-dialog');
const content=new FullContent(dialog,data,perform,audio);
audio.sceneElement.controls=true;audio.sceneElement.setAttribute('aria-label','이 장소의 음성 해설 재생');
audio.configureBackground(memorial?null:{src:assetUrl('mp3/bg_short1.mp3'),title:'역사관 배경 음악',volume:.1});
if(!memorial&&route.scene!=='scene_vr02')audio.startBackground();
const unsubscribeAudio=audio.subscribe(state=>{
 if(disposed)return;
 const control=$<HTMLButtonElement>('[data-control="sound"]');
 control.setAttribute('aria-pressed',String(!state.muted&&state.unlocked));
 control.setAttribute('aria-label',state.muted||!state.unlocked?'소리 켜기':'모든 소리 끄기');
 control.title=control.getAttribute('aria-label')!;control.textContent=state.muted?'♬':'♫';
 $('#enable-audio').hidden=state.muted||state.unlocked&&!state.blocked;
 $('#enable-audio').title=state.error||'소리 켜고 관람';
});

function saveView(){if(!disposed&&museumIdAt(location.pathname)===museumId&&loaded===route.scene&&!busy){route={...route,look:viewer.getLook()};history.replaceState({route},'',fullRouteUrl(route));}}
function navigate(next:FullRoute,replace=false){
 navigationGeneration++;
 saveView();route=normalizeContentRoute(data,parseFullRoute(fullRouteUrl(next),data.scenes,data.zones));
 if(loaded!==route.scene){audio.setScene(museumId+':loading');audioScene='';}
 history[replace?'replaceState':'pushState']({route},'',fullRouteUrl(route));
 // Reading the next panel must not wait for the hidden 3D marker images to load.
 if(loaded===route.scene){renderSceneUI();showModal();}
 void apply();
}
function perform(action:SourceAction){
 void audio.unlock();
 action=contentTitles.action(action);
 if(action.type==='scene'){
  if(!memorial&&loaded==='scene_vr02'&&action.scene==='scene_f-c-0'){
   if(entering)return;entering=true;
   const generation=navigationGeneration;
   void viewer.enterLobby().finally(()=>{entering=false;if(!disposed&&generation===navigationGeneration&&route.scene==='scene_vr02'){audio.startBackground();navigate({scene:action.scene,page:1,look:action.look||[0,0,100]});}});
   return;
  }
  const look=action.look||(loaded?viewer.getLook():undefined);
  navigate({scene:action.scene,page:1,...(look?{look}:{})});
 }else if(action.type==='page'){
  const zone=data.zones.find(z=>z.id===action.zone);if(zone)navigate({scene:zone.scene,page:action.page,...(zone.scene===route.scene?{look:viewer.getLook()}:{})});
 }else if(action.type==='external'){if(memorialDestination(action.url)){onMuseum('memorial');return;}window.open(action.url,'_blank','noopener,noreferrer');}
 else navigate({...route,look:viewer.getLook(),exhibit:JSON.stringify(action)});
 closeMenus();
}
function closeMenus(){for(const node of document.querySelectorAll<HTMLDetailsElement>('.menu-group'))node.open=false;$('#full-menu').classList.remove('mobile-open');$('#mobile-menu').setAttribute('aria-expanded','false');}
function safeModal(value:string):SourceAction|null{
 return safeContentAction(data,value);
}
function showModal(){
 if(!route.exhibit){if(dialog.open){internalClose=true;content.close();internalClose=false;}renderedModal='';viewer.viewer.startKeyboardControl();return;}
 if(route.exhibit===renderedModal&&dialog.open)return;
 const parsed=safeModal(route.exhibit);if(!parsed)return;
 const a=contentTitles.action(parsed);
 if(a!==parsed){route={...route,exhibit:JSON.stringify(a)};history.replaceState({route},'',fullRouteUrl(route));}
 renderedModal=route.exhibit!;viewer.viewer.stopKeyboardControl();content.open(a);
}
dialog.addEventListener('close',()=>{if(disposed||dialog.open)return;viewer.viewer.startKeyboardControl();if(!internalClose&&route.exhibit){const next={...route};delete next.exhibit;navigate(next,true);}});
function renderSceneUI(){
 for(const key of actions.keys())if(Number(key)>=persistentActionCount)actions.delete(key);
 const scene=data.scenes.find(s=>s.id===route.scene)!,zone=data.zones.find(z=>z.id===scene.zone),page=zone?.pages[route.page-1];
 for(const group of document.querySelectorAll<HTMLElement>('[data-menu-index]')){const i=Number(group.dataset.menuIndex),letter=String.fromCharCode(96+i);group.classList.toggle('current',i>0&&i<5?scene.id.startsWith(`scene_${letter}-`):i===0&&/^scene_[ef]-/.test(scene.id));}
 $('#scene-name').textContent=scene.title;
 document.title=`${scene.title} · ${museumTitle}`;
 const narration=scene.narration;
 $('#scene-audio-controls').hidden=!narration;
 $('#scene-audio-title').textContent=narration?.title||'';
 if(narration&&audio.sceneElement.parentElement!==$('#scene-audio-controls'))$('#scene-audio-controls').append(audio.sceneElement);
 for(const b of document.querySelectorAll<HTMLButtonElement>('[data-scene]'))b.setAttribute('aria-current',b.dataset.scene===scene.id?'location':'false');
 const dir=$('#map-direction');dir.hidden=!scene.map;if(scene.map){dir.style.left=scene.map.x+'%';dir.style.top=scene.map.y+'%';}
 $('#page-bar').hidden=!zone;
 if(zone&&page){
  $('#page-bar').innerHTML=`<div class="page-caption"><span>${escape(zone.title)}</span><strong>${escape(contentTitles.page(zone.id,page.number))}</strong></div><div class="page-step"><button data-page="${route.page-1}" ${route.page<=1?'disabled':''} aria-label="이전 전시 페이지">‹</button><select id="page-select" aria-label="전시 페이지 선택">${zone.pages.map(p=>`<option value="${p.number}" ${p.number===route.page?'selected':''}>${p.number}. ${escape(contentTitles.page(zone.id,p.number))}</option>`).join('')}</select><span>${route.page} / ${zone.pages.length}</span><button data-page="${route.page+1}" ${route.page>=zone.pages.length?'disabled':''} aria-label="다음 전시 페이지">›</button>${button({type:'image',src:page.image,title:contentTitles.page(zone.id,page.number)},'크게 보기','read-page')}</div>`;
 }
 $('#media-shelf').hidden=scene.id!=='scene_f-c-w-1';
 if(scene.id==='scene_f-c-w-1')$('#media-shelf').innerHTML=`<details><summary>미디어센터 · 영상 선택</summary><div class="media-categories">${(data.mediaSections||[]).map(g=>`<details><summary>${escape(g.title)} <span>${g.items.length}</span></summary><div>${g.items.map(m=>{const a=menuAction(m);return a?button(a,m.title):`<p>${escape(m.title)} · 준비 중</p>`;}).join('')}</div></details>`).join('')}</div></details>`;
}
async function apply(){
 if(disposed)return;
 if(busy){queued=true;return;}busy=true;
 const current={...route};$('#scene-error').hidden=true;
 if(loaded!==current.scene)$('#loading').textContent='전시 공간을 불러오는 중입니다';
 try{
  await viewer.show(current);if(disposed)return;loaded=current.scene;lastGood=current;$('#loading').textContent='';
 }catch(error){
  if(disposed)return;console.error('Unable to load scene',current.scene,error);$('#loading').textContent='';$('#scene-error').hidden=false;
 }
 busy=false;
 if(queued){queued=false;void apply();return;}
 if(loaded===route.scene){
  if(audioScene!==route.scene){audioScene=route.scene;audio.setScene(museumId+':'+route.scene,data.scenes.find(s=>s.id===route.scene)?.narration);}
  renderSceneUI();showModal();
 }
}
document.addEventListener('click',event=>{
 const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target)return;
 if(target.dataset.action){const a=actions.get(target.dataset.action);if(a)perform(a);}
 if(target.dataset.scene){void audio.unlock();const scene=data.scenes.find(s=>s.id===target.dataset.scene);if(scene)navigate({scene:scene.id,page:1,look:scene.view});$('#scene-list').hidden=true;}
 if(target.dataset.floor){void audio.unlock();navigate({scene:`scene_hkj_${target.dataset.floor}f_01`,page:1,look:[0,0,110]});}
 if(target.dataset.page){const scene=data.scenes.find(s=>s.id===route.scene)!;if(scene.zone)perform({type:'page',zone:scene.zone,page:Number(target.dataset.page)});}
 const control=target.dataset.control;
 if(control==='in')viewer.viewer.zoom(Math.min(100,viewer.viewer.getZoomLevel()+10));
 if(control==='out')viewer.viewer.zoom(Math.max(0,viewer.viewer.getZoomLevel()-10));
 if(control==='help')perform({type:'help',audio:'mp3/info.mp3'});
 if(control==='fullscreen'){if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen();}
 if(control==='sound'){
  if(!audio.state.unlocked||audio.state.muted){audio.setMuted(false);void audio.unlock();}else audio.setMuted(true);
 }
},{signal:lifecycle.signal});
document.addEventListener('change',event=>{if((event.target as HTMLElement).id==='page-select'){const zone=data.scenes.find(s=>s.id===route.scene)?.zone;if(zone)perform({type:'page',zone,page:Number((event.target as HTMLSelectElement).value)});}},{signal:lifecycle.signal});
$('#mobile-menu').onclick=()=>{const open=$('#full-menu').classList.toggle('mobile-open');$('#mobile-menu').setAttribute('aria-expanded',String(open));};
for(const details of document.querySelectorAll<HTMLDetailsElement>('.menu-group'))details.addEventListener('toggle',()=>{if(details.open)for(const other of document.querySelectorAll<HTMLDetailsElement>('.menu-group'))if(other!==details)other.open=false;});
function setMap(open:boolean){$('#floorplan').hidden=!open;$('#map-open').hidden=open;}
$('#map-close').onclick=()=>setMap(false);$('#map-open').onclick=()=>setMap(true);$('#map-enlarge').onclick=()=>$('#floorplan').classList.toggle('expanded');
$('#quick-toggle').onclick=()=>{const folded=$('#quick-menu').classList.toggle('folded');$('#quick-toggle').setAttribute('aria-expanded',String(!folded));};
$('#all-scenes').onclick=()=>{$('#scene-list').hidden=!$('#scene-list').hidden;};$('#scene-list-close').onclick=()=>{$('#scene-list').hidden=true;};
$('#retry').onclick=()=>{if(lastGood&&route.scene===loaded)viewer.page=0;void apply();};
window.addEventListener('pagehide',saveView,{signal:lifecycle.signal});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenus();$('#scene-list').hidden=true;}},{signal:lifecycle.signal});
if(matchMedia('(max-width: 700px)').matches)setMap(false);
let welcomed=false;try{welcomed=!!sessionStorage.getItem('museum-welcome');}catch{/* Storage is optional. */}
if(!memorial&&!initialRoute&&!new URLSearchParams(location.search).has('startscene')&&!welcomed){
 $('#welcome').hidden=false;viewer.viewer.stopKeyboardControl();
}
$('#enter-museum').onclick=()=>{$('#welcome').hidden=true;try{sessionStorage.setItem('museum-welcome','1');}catch{/* Storage is optional. */}void audio.unlock();viewer.viewer.startKeyboardControl();};
$('#enable-audio').onclick=()=>{audio.setMuted(false);void audio.unlock();};
if(memorial)$('#return-museum').onclick=()=>onMuseum('history');
history.replaceState({route},'',fullRouteUrl(route));void apply();
return {
 capture:()=>{saveView();return {...route,look:loaded===route.scene?viewer.getLook():route.look};},
 popstate:()=>{navigationGeneration++;const next=normalizeContentRoute(data,parseFullRoute(location.search,data.scenes,data.zones));if(next.scene!==route.scene){audio.setScene(museumId+':loading');audioScene='';}route=next;if(loaded===route.scene){renderSceneUI();showModal();}void apply();},
 destroy:()=>{disposed=true;navigationGeneration++;clearTimeout(viewTimer);lifecycle.abort();unsubscribeAudio();internalClose=true;content.destroy();audio.setScene(museumId+':closed');viewer.destroy();}
};
}
