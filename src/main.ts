import OpenSeadragon from 'openseadragon';
import data from './data/museum.json';
import { MuseumViewer } from './viewer';
import { parseRoute,routeUrl,followSceneLink,type Route } from './navigation';
import {sceneLinks} from './scene-links';
import { VisitMemory } from './history';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const sceneDestination=(title:string)=>{const last=title.charCodeAt(title.length-1)-0xac00;return `${title}${last>=0&&last<11172&&last%28!==0&&last%28!==8?'으로':'로'} 이동`;};
const sceneButtons=(className:string)=>data.scenes.map((s,i)=>`<button class="${className}" data-scene="${s.id}" aria-label="${sceneDestination(s.title)}"><span class="scene-number">${String(i+1).padStart(2,'0')}</span><span>${escape(s.title)}</span></button>`).join('');
app.innerHTML=`<a class="skip-link" href="#scene-nav">공간 선택으로 건너뛰기</a>
 <header class="site-header"><a class="brand" href="?startscene=scene_f-c-0" aria-label="영락교회 디지털역사관 로비"><span class="brand-mark" aria-hidden="true">✝</span><span>영락교회 <strong>디지털역사관</strong><small>YOUNGNAK DIGITAL HISTORY MUSEUM</small></span></a><nav class="top-nav" aria-label="주요 메뉴"><button data-action="books">E-BOOK <span>↗</span></button><button data-action="help">관람 안내</button></nav><span class="preview-badge">시범 관람</span></header>
 <main class="museum"><div id="panorama" aria-label="360도 전시 공간. 마우스 또는 손가락으로 둘러볼 수 있습니다."></div><div class="vignette"></div>
 <section class="scene-heading" aria-live="polite"><span id="scene-label" class="eyebrow"></span><h1 id="scene-title"></h1><p id="scene-subtitle"></p></section>
 <aside class="map-shell"><button id="map-toggle" aria-expanded="true" aria-controls="map-content"><span>⌖ &nbsp; 전시실 안내도</span><span id="map-toggle-icon">−</span></button><div id="map-content"><div class="map-viewport" id="map-viewport"><div class="map-image" id="map-image"><img src="${data.map}" alt="기존 디지털역사관 평면도"><span class="map-corridor" aria-hidden="true"></span><span class="map-extension" aria-hidden="true"><b>E</b><small>확장 전시실</small></span>${data.scenes.map((s,i)=>`<button class="map-point" data-scene="${s.id}" style="left:${s.map.x}%;top:${s.map.y}%" aria-label="${sceneDestination(s.title)}">${i+1}</button>`).join('')}<span id="map-heading" aria-hidden="true"></span></div></div><div class="map-footer"><span>● 현재 위치</span><div><button data-map-zoom="out" aria-label="안내도 축소">−</button><button data-map-zoom="in" aria-label="안내도 확대">＋</button></div></div></div></aside>
 <div class="viewer-controls" aria-label="화면 조작"><button data-control="zoom-in" aria-label="확대">＋</button><button data-control="zoom-out" aria-label="축소">−</button><button data-control="reset" aria-label="처음 시점으로">↺</button><button data-control="fullscreen" aria-label="전체 화면">⛶</button></div>
 <section id="exhibit-bar" hidden aria-label="전시 패널 선택"><div><span class="eyebrow">EXHIBITION 01</span><strong>복음의 문이 열리다</strong></div><div class="page-buttons">${data.pages.map((_,i)=>`<button data-page="${i+1}" aria-label="전시 ${i+1}쪽">${i+1}</button>`).join('')}</div><button class="read-panel" data-action="panel">전시 읽기 <span>↗</span></button></section>
 <div class="scene-status" id="status" role="status"></div><div id="load-error" hidden role="alert"><p>전시 공간을 불러오지 못했습니다.</p><button id="retry">다시 불러오기</button></div>
 <footer class="tour-dock"><div class="dock-label"><span>EXPLORE THE MUSEUM</span><small>드래그하여 360° 둘러보기</small></div><nav id="scene-nav" aria-label="공간 선택">${sceneButtons('scene-button')}</nav><span class="dock-count">${data.scenes.length}개 시점<br><small>시범 공개</small></span></footer>
 </main><dialog id="detail-dialog" aria-labelledby="dialog-title"><div class="dialog-header"><div><span class="eyebrow" id="dialog-label">YOUNGNAK ARCHIVE</span><h2 id="dialog-title"></h2></div><button id="close-dialog" aria-label="닫고 전시로 돌아가기">×</button></div><div id="dialog-body"></div></dialog><div id="toast" role="status"></div>`;

const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const sceneMapX=()=>data.scenes.find(s=>s.id===route.scene)!.map.x/100;
const dialog=$<HTMLDialogElement>('#detail-dialog');
let route=parseRoute(location.search), appliedScene='',busy=false, queued=false,failedRoute:Route|undefined;
const visits=new VisitMemory();let entryKey=crypto.randomUUID();
let photoViewer:OpenSeadragon.Viewer|undefined, lastFocus:HTMLElement|null=null,modalKey='';
const museum=new MuseumViewer($('#panorama'),action,(yaw)=>{
 const s=data.scenes.find(s=>s.id===route.scene)!;
 $('#map-heading').style.transform=`translate(-50%,-50%) rotate(${yaw+s.map.heading}deg)`;
});
function saveLook(){if(appliedScene===route.scene&&!busy){route={...route,look:museum.getLook()};visits.save(entryKey,route,route.look);history.replaceState({...history.state,route,entryKey},'',routeUrl(route));}}
function navigate(next:Route,replace=false){
 saveLook();
 failedRoute=undefined;$('#load-error').hidden=true;
 route=next;
 if(!replace)entryKey=crypto.randomUUID();
 history[replace?'replaceState':'pushState']({route,entryKey},'',routeUrl(route));
 void apply();
}
function action(id:string){
 if(id.startsWith('scene:')){
  const destination=id.slice(6);
  const link=sceneLinks.find(item=>item.from===route.scene&&item.to===destination);
  navigate(link?followSceneLink(route,link):{scene:destination,page:1});
 }
 else {saveLook();navigate({...route,exhibit:id});}
}
function setPage(page:number){saveLook();navigate({...route,page});}
function closeDetail(){
 if(!route.exhibit){dialog.close();return;}
 if(history.state?.modalEntry)history.back();
 else {const next={...route};delete next.exhibit;navigate(next,true);}
}
async function apply(){
 if(busy){queued=true;return;}
 busy=true;
 const target={...route};
 const scene=data.scenes.find(s=>s.id===target.scene)!;
 $('#scene-label').textContent=scene.label;$('#scene-title').textContent=scene.title;$('#scene-subtitle').textContent=scene.subtitle;
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-scene]')){
  button.classList.toggle('active',button.dataset.scene===target.scene);button.setAttribute('aria-current',button.dataset.scene===target.scene?'location':'false');
 }
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-page]'))button.setAttribute('aria-pressed',String(Number(button.dataset.page)===target.page));
 $('#exhibit-bar').hidden=target.scene!==data.scenes[2].id;
 const dot=$('#map-heading');dot.style.left=scene.map.x+'%';dot.style.top=scene.map.y+'%';
 requestAnimationFrame(()=>{
  const viewport=$<HTMLElement>('#map-viewport'),map=$<HTMLElement>('#map-image');
  viewport.scrollLeft=Math.max(0,scene.map.x/100*map.offsetWidth-viewport.clientWidth/2);
  viewport.scrollTop=Math.max(0,scene.map.y/100*map.offsetHeight-viewport.clientHeight/2);
  document.querySelector<HTMLElement>('.scene-button.active')?.scrollIntoView({block:'nearest',inline:'nearest'});
 });
 $('#load-error').hidden=true;
 if(appliedScene!==target.scene)$('#status').textContent='전시 공간을 불러오고 있습니다…';
 try{
  await museum.show(target);appliedScene=target.scene;$('#status').textContent='';
 }catch(error){
  console.error('Scene load failed',error);failedRoute=target;$('#status').textContent='';
  if(appliedScene&&appliedScene!==target.scene){
   const previous=data.scenes.find(s=>s.id===appliedScene)!;
   route={scene:previous.id,page:1,look:museum.getLook()};
   history.replaceState({...history.state,route,entryKey},'',routeUrl(route));
   $('#scene-label').textContent=previous.label;$('#scene-title').textContent=previous.title;$('#scene-subtitle').textContent=previous.subtitle;
   for(const button of document.querySelectorAll<HTMLButtonElement>('[data-scene]')){
    button.classList.toggle('active',button.dataset.scene===previous.id);
    button.setAttribute('aria-current',button.dataset.scene===previous.id?'location':'false');
   }
   dot.style.left=previous.map.x+'%';dot.style.top=previous.map.y+'%';
   $('#exhibit-bar').hidden=previous.id!==data.scenes[2].id;
  }
  $('#load-error').hidden=false;
 }
 busy=false;
 if(queued){queued=false;void apply();return;}
 renderDialog();
}
function related(page:number){
 const ids=[...new Set(data.hotspots.filter(h=>h.page===page).map(h=>h.exhibit))];
 if(page===2)ids.push('text-1');
 return ids.map(id=>{
  const record=data.photos.find(p=>p.id===id)||data.texts.find(t=>t.id===id);
  return record?`<button class="related-item" data-action="${id}"><span>${id.startsWith('photo')?'사진':'이야기'}</span>${escape(record.title)} <b>↗</b></button>`:'';
 }).join('');
}
function renderDialog(){
 const key=route.exhibit||'';
 if(!key){if(dialog.open)dialog.close();photoViewer?.destroy();photoViewer=undefined;$('#dialog-body').replaceChildren();museum.viewer.startKeyboardControl();modalKey='';if(lastFocus?.isConnected)lastFocus.focus();return;}
 const renderKey=key==='panel'?`${key}-${route.page}`:key;
 if(renderKey===modalKey&&dialog.open)return;
 const previousKey=modalKey;modalKey=renderKey;photoViewer?.destroy();photoViewer=undefined;
 const body=$('#dialog-body');body.className='';dialog.className='';body.innerHTML='';
 $('#dialog-label').textContent='YOUNGNAK ARCHIVE';
 let title='';
 const photo=data.photos.find(p=>p.id===key),article=data.texts.find(t=>t.id===key);
 if(photo){
  title=photo.title;dialog.className='photo-dialog';
  body.innerHTML=`<div id="photo-canvas" aria-label="${escape(title)} 확대 보기"></div><div class="photo-tools"><span>휠 또는 두 손가락으로 확대 · 드래그하여 이동</span><button data-photo="in" aria-label="사진 확대">＋</button><button data-photo="out" aria-label="사진 축소">−</button><button data-photo="home">전체 보기</button><a href="${photo.image}" target="_blank" rel="noopener">이미지 열기 ↗</a></div>`;
 }else if(article){title=article.title;body.className='article-body';body.innerHTML=article.html;}
 else if(key==='panel'){
  title=`복음의 문이 열리다 · ${route.page} / 6`;dialog.className='panel-dialog';
  body.innerHTML=`<div class="panel-image"><img src="${data.pages[route.page-1]}" alt="복음의 문이 열리다 전시 패널 ${route.page}쪽"></div><div class="panel-pagination"><button data-page="${route.page-1}" ${route.page===1?'disabled':''}>← 이전</button><span>${route.page} / 6</span><button data-page="${route.page+1}" ${route.page===6?'disabled':''}>다음 →</button></div><section class="related"><h3>이 페이지의 자료</h3>${related(route.page)||'<p>전시 이미지에서 내용을 확인하세요.</p>'}</section>`;
 }else if(key==='video-a'){
  title=data.video.title;dialog.className='video-dialog';
  body.innerHTML=`<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${data.video.id}?rel=0" title="${escape(title)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="video-note">영상이 표시되지 않으면 <a href="https://www.youtube.com/watch?v=${data.video.id}" target="_blank" rel="noopener">YouTube에서 보기 ↗</a></p>`;
 }else if(key==='books'){
  title='기록으로 만나는 영락';dialog.className='books-dialog';
  const categories=[...new Set(data.ebooks.map(b=>b.category))];
  body.innerHTML=`<p class="books-intro">함께 걸어온 시간을 책장에 담았습니다. 책을 선택하면 전자책이 새 탭에서 열립니다.</p><nav class="book-filters" aria-label="전자책 분류"><button data-category="전체" aria-pressed="true">전체 <small>${data.ebooks.length}</small></button>${categories.map(c=>`<button data-category="${escape(c)}" aria-pressed="false">${escape(c)}</button>`).join('')}</nav><div class="book-grid">${data.ebooks.map(b=>`<a class="book-card" data-book-category="${escape(b.category)}" href="${b.url}" target="_blank" rel="noopener"><div><img src="${b.image}" alt="" loading="lazy"></div><small>${escape(b.category)}</small><h3>${escape(b.title)}</h3><span>전자책 읽기 ↗</span></a>`).join('')}</div>`;
 }else if(key==='help'){
  title='믿음의 발자취를 따라';dialog.className='help-dialog';$('#dialog-label').textContent='WELCOME TO YOUNGNAK';
  body.innerHTML=`<p class="help-intro">영락교회 디지털역사관에 오신 것을 환영합니다.<br>공간을 둘러보고, 기록 속 이야기를 만나보세요.</p><div class="guide-steps"><div><span>01</span><h3>공간 둘러보기</h3><p>화면을 드래그해 시선을 움직이세요.<br>＋, − 버튼으로 확대할 수 있습니다.</p></div><div><span>02</span><h3>전시실 이동하기</h3><p>화면의 이동 표시를 따라 E 전시실까지 걸어가거나<br>아래 공간 이름과 안내도 번호를 눌러 이동하세요.</p></div><div><span>03</span><h3>이야기 자세히 보기</h3><p>전시의 ＋ 표시와 ‘전시 읽기’로<br>사진과 기록을 크게 볼 수 있습니다.</p></div></div><button class="primary-button" id="start-tour">관람 시작 <span>→</span></button><p class="scope-note">기존 전시 공간과 새로 제안한 빈 E 전시실을 연결한 시범 관람입니다.</p>`;
 }else{
  title='자료를 찾을 수 없습니다';body.innerHTML='<p class="empty-message">이 주소의 자료는 시범 관람에 포함되어 있지 않습니다. 창을 닫고 전시를 계속 관람하세요.</p>';
 }
 $('#dialog-title').textContent=title;
 if(!dialog.open){lastFocus=document.activeElement as HTMLElement;dialog.showModal();}
 museum.viewer.stopKeyboardControl();
 if(previousKey!==renderKey)$('#close-dialog').focus();
 if(photo){
  photoViewer=OpenSeadragon({element:$('#photo-canvas'),tileSources:{type:'image',url:photo.image},showNavigationControl:false,showNavigator:true,animationTime:.3,visibilityRatio:1,constrainDuringPan:true,maxZoomPixelRatio:3,gestureSettingsTouch:{pinchToZoom:true}});
  photoViewer.addHandler('open-failed',()=>{$('#photo-canvas').innerHTML='<p class="empty-message">사진을 불러오지 못했습니다. 아래 이미지 열기를 이용하거나 창을 다시 열어주세요.</p>';});
 }
}
document.addEventListener('click',event=>{
 const target=(event.target as HTMLElement).closest<HTMLElement>('button,a');if(!target)return;
 if(target.hasAttribute('disabled'))return;
 if(target.dataset.scene)action('scene:'+target.dataset.scene);
 if(target.dataset.mapZoom){
  const map=$<HTMLElement>('#map-image'),viewport=$<HTMLElement>('#map-viewport');
  const width=Math.max(320,Math.min(880,map.offsetWidth+(target.dataset.mapZoom==='in'?120:-120)));
  map.style.width=width+'px';viewport.scrollLeft=Math.max(0,sceneMapX()*width-viewport.clientWidth/2);
 }
 if(target.dataset.action){
  const hadExhibit=!!route.exhibit;action(target.dataset.action);
  if(!hadExhibit)history.replaceState({...history.state,modalEntry:true},'');
 }
 if(target.dataset.page)setPage(Math.max(1,Math.min(6,Number(target.dataset.page))));
 if(target.dataset.category){
  document.querySelectorAll<HTMLElement>('[data-book-category]').forEach(el=>el.hidden=target.dataset.category!=='전체'&&el.dataset.bookCategory!==target.dataset.category);
  document.querySelectorAll<HTMLElement>('[data-category]').forEach(el=>el.setAttribute('aria-pressed',String(el===target)));
 }
 if(target.dataset.photo&&photoViewer){
  if(target.dataset.photo==='home')photoViewer.viewport.goHome();else photoViewer.viewport.zoomBy(target.dataset.photo==='in'?1.5:1/1.5);
 }
 const control=target.dataset.control;
 if(control==='zoom-in')museum.viewer.zoom(Math.min(100,museum.viewer.getZoomLevel()+10));
 if(control==='zoom-out')museum.viewer.zoom(Math.max(0,museum.viewer.getZoomLevel()-10));
 if(control==='reset'){const s=data.scenes.find(s=>s.id===route.scene)!;navigate({...route,look:[s.ath,s.atv,s.fov]},true);}
 if(control==='fullscreen')museum.viewer.toggleFullscreen();
 if(target.id==='start-tour'){try{sessionStorage.setItem('youngnak-intro','seen')}catch{}closeDetail();}
});
$('#close-dialog').addEventListener('click',closeDetail);
dialog.addEventListener('cancel',event=>{event.preventDefault();closeDetail();});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDetail();}});
$('#map-toggle').addEventListener('click',()=>{const hidden=!$('#map-content').hidden;$('#map-content').hidden=hidden;$('#map-toggle').setAttribute('aria-expanded',String(!hidden));$('#map-toggle-icon').textContent=hidden?'+':'−';});
$('#retry').addEventListener('click',()=>{
 if(failedRoute){route=failedRoute;failedRoute=undefined;history.replaceState({...history.state,route,entryKey},'',routeUrl(route));}
 void apply();
});
window.addEventListener('popstate',()=>{
 if(appliedScene===route.scene&&!busy)visits.save(entryKey,route,museum.getLook());
 entryKey=history.state?.entryKey||crypto.randomUUID();
 route=visits.restore(entryKey,history.state?.route||parseRoute(location.search));
 history.replaceState({...history.state,route,entryKey},'',routeUrl(route));
 void apply();
});
if(matchMedia('(max-width: 700px)').matches){$('#map-content').hidden=true;$('#map-toggle').setAttribute('aria-expanded','false');$('#map-toggle-icon').textContent='+';}
let seen=false;try{seen=sessionStorage.getItem('youngnak-intro')==='seen'}catch{}
if(!location.search&&!seen)route.exhibit='help';
history.replaceState({route,entryKey},'',routeUrl(route));
void apply();
