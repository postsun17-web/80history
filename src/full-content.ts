import OpenSeadragon from 'openseadragon';
import {Viewer} from '@photo-sphere-viewer/core';
import {CubemapAdapter} from '@photo-sphere-viewer/cubemap-adapter';
import {assetUrl,sourcePath,type FullMuseum,type GalleryImage} from './full-types';
import type {SourceAction} from './source-actions';
import {sourceGalleryIssue,sourceGalleryNote} from './source-defects';
import './full-content.css';

const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const button=(command:string,label:string,text=label)=>`<button type="button" data-content-command="${command}" aria-label="${escape(label)}">${escape(text)}</button>`;
const faceNames={front:'f',back:'b',left:'l',right:'r',top:'u',bottom:'d'};

/** Visitor-facing content; all source action strings have already been decoded to inert data. */
export class FullContent {
 private dialog:HTMLDialogElement;
 private data:FullMuseum;
 private onAction:(action:SourceAction)=>void;
 private body:HTMLDivElement;
 private heading:HTMLHeadingElement;
 private previousFocus:HTMLElement|null=null;
 private zoom?:OpenSeadragon.Viewer;
 private sphere?:Viewer;
 private gallery?:{id:string;index:number};
 private frames:string[]=[];
 private frame=0;
 private dragStart?:{x:number;frame:number};
 private activeAction?:SourceAction;
 private bookCategory='전체';
 private cleanupTasks:(()=>void)[]=[];

 constructor(dialog:HTMLDialogElement,data:FullMuseum,onAction:(action:SourceAction)=>void){
  this.dialog=dialog;this.data=data;this.onAction=onAction;
  dialog.classList.add('full-content');
  dialog.setAttribute('aria-labelledby','full-content-title');
  dialog.innerHTML=`<header class="full-content-header"><div><span>YOUNGNAK DIGITAL HISTORY MUSEUM</span><h2 id="full-content-title"></h2></div>${button('close','닫고 전시로 돌아가기','×')}</header><div class="full-content-body"></div>`;
  this.body=dialog.querySelector<HTMLDivElement>('.full-content-body')!;
  this.heading=dialog.querySelector<HTMLHeadingElement>('h2')!;
  dialog.addEventListener('click',event=>this.controls(event));
  dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
  dialog.addEventListener('close',()=>{if(dialog.open)return;this.teardown();this.previousFocus?.focus();this.previousFocus=null;});
  dialog.addEventListener('keydown',event=>{
   if((event.target as HTMLElement).matches('input,textarea,select'))return;
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    const direction=event.key==='ArrowLeft'?-1:1;
    if(this.gallery){event.preventDefault();this.moveGallery(direction);}
    else if(this.frames.length){event.preventDefault();this.showFrame(this.frame+direction);}
   }
  });
 }

 open(action:SourceAction):void {
  if(action.type==='scene'||action.type==='page'){this.onAction(action);return;}
  if(!this.dialog.open)this.previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  this.teardown();this.activeAction=action;
  this.body.className='full-content-body';this.body.replaceChildren();
  this.dialog.dataset.contentType=action.type;
  if(!this.dialog.open)this.dialog.showModal();
  switch(action.type){
   case 'gallery':this.renderGallery(action.gallery,action.index);break;
   case 'article':this.renderArticle(action.path);break;
   case 'youtube':this.heading.textContent='영상 자료';this.renderEmbed(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(action.id)}?rel=0`, 'YouTube 영상', `https://www.youtube.com/watch?v=${encodeURIComponent(action.id)}`);break;
   case 'image':this.heading.textContent=action.title??'전시 자료';this.renderImage(this.url(action.src),action.title??'전시 자료');if(action.audio)this.addAudio(action.audio);break;
   case 'video':this.heading.textContent='영상 자료';this.renderVideo(action.src);break;
   case 'audio':this.heading.textContent='음성 안내';this.body.innerHTML='<div class="full-content-audio-card"><span aria-hidden="true">♪</span><p>영락교회 디지털역사관 음성 안내</p></div>';this.addAudio(action.src);break;
   case 'object':this.renderObject(action);break;
   case 'books':this.renderBooks();break;
   case 'chatbot':this.renderChatbot();break;
   case 'help':this.renderGallery('help',0);if(action.audio)this.addAudio(action.audio);break;
   case 'external':this.heading.textContent='연계 자료';this.renderEmbed(action.url,'연계 자료',action.url);break;
   case 'document':this.heading.textContent='기록 자료';this.renderDocument(action.src);break;
  }
  this.dialog.querySelector<HTMLButtonElement>('[data-content-command="close"]')?.focus();
 }

 close():void {this.teardown();if(this.dialog.open)this.dialog.close();}

 /** Event delegation is local to the content dialog; main can call this for forwarded events. */
 controls(event:Event):boolean {
  const target=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-content-command]'):null;
  if(!target||!this.dialog.contains(target))return false;
  const command=target.dataset.contentCommand!;
  if(command==='close')this.close();
  else if(command==='previous')this.moveGallery(-1);
  else if(command==='next')this.moveGallery(1);
  else if(command==='related-photo'){
   const gallery=target.dataset.gallery,index=Number(target.dataset.index);
   if(gallery&&Number.isInteger(index)&&this.data.galleries.find(item=>item.id===gallery)?.items[index])this.onAction({type:'gallery',gallery,index});
  }
  else if(command==='zoom-in'){this.zoom?.viewport.zoomBy(1.4);this.zoom?.viewport.applyConstraints();if(this.sphere)this.sphere.zoom(Math.min(100,this.sphere.getZoomLevel()+10));}
  else if(command==='zoom-out'){this.zoom?.viewport.zoomBy(1/1.4);this.zoom?.viewport.applyConstraints();if(this.sphere)this.sphere.zoom(Math.max(0,this.sphere.getZoomLevel()-10));}
  else if(command==='home'){this.zoom?.viewport.goHome();if(this.sphere){this.sphere.zoom(40);void this.sphere.animate({yaw:0,pitch:0,speed:'8rpm'});}}
  else if(command==='frame-previous')this.showFrame(this.frame-1);
  else if(command==='frame-next')this.showFrame(this.frame+1);
  else if(command==='books')this.open({type:'books'});
  else if(command==='book-category'){this.bookCategory=target.dataset.contentCategory??'전체';this.renderBooks();}
  else if(command==='book')this.renderBook(Number(target.dataset.contentBook));
  else if(command==='chat-help')this.open({type:'help'});
  else if(command==='chat-exhibit'){
   const scene=this.data.menus[1]?.items[0]?.scene;
   if(scene){this.close();this.onAction({type:'scene',scene});}
  }
  else return false;
  return true;
 }

 private url(path:string):string {return this.data.assets[sourcePath(path)]??assetUrl(path);}
 private teardown():void {
  this.zoom?.destroy();this.zoom=undefined;
  this.sphere?.destroy();this.sphere=undefined;
  for(const media of this.body?.querySelectorAll<HTMLMediaElement>('audio,video')??[]){media.pause();media.removeAttribute('src');media.load();}
  for(const iframe of this.body?.querySelectorAll<HTMLIFrameElement>('iframe')??[])iframe.src='about:blank';
  for(const task of this.cleanupTasks)task();this.cleanupTasks=[];
  this.gallery=undefined;this.frames=[];this.dragStart=undefined;
 }
 private notice(message:string):void {
  const note=document.createElement('p');note.className='full-content-note';note.setAttribute('role','status');note.textContent=message;this.body.append(note);
 }
 private renderGallery(id:string,index:number):void {
  const gallery=this.data.galleries.find(item=>item.id===id);
  if(!gallery?.items.length){this.heading.textContent=id==='help'?'관람 안내':'사진 자료';this.notice('자료를 불러올 수 없습니다. 잠시 후 다시 열어 주세요.');return;}
  const position=Math.min(gallery.items.length-1,Math.max(0,Math.floor(index)));
  this.gallery={id,index:position};const original=gallery.items[position];
  const sourceIssue=sourceGalleryIssue(id,original.id,this.data.galleries),recovery=sourceIssue?.recovery;
  const item=recovery?.type==='photo'?recovery.item:original;
  const imageAvailable=!sourceIssue||recovery?.type==='photo';
  this.heading.textContent=id==='help'?`관람 안내 · ${position+1} / ${gallery.items.length}`:recovery?.type==='collection'?recovery.title:item.title||gallery.title||'사진 자료';
  this.body.classList.add('full-content-gallery');
  const canPrevious=position>0,canNext=position<gallery.items.length-1;
  this.body.innerHTML=`<div class="full-content-media-stage" role="img" aria-label="${escape(item.title||'확대 가능한 사진 자료')}"></div><div class="full-content-toolbar"><div class="full-content-paging">${button('previous','이전 사진','←')}<span aria-live="polite">${position+1} / ${gallery.items.length}</span>${button('next','다음 사진','→')}</div><p>${recovery?.type==='collection'?'사진을 선택하면 확대해서 볼 수 있습니다.':!imageAvailable?'이전·다음 버튼으로 다른 사진을 확인할 수 있습니다.':item.faces?'드래그하여 360° 둘러보기':'드래그하여 이동 · 휠 또는 두 손가락으로 확대'}</p><div>${button('zoom-out','자료 축소','−')}${button('home','자료 전체 보기','↺')}${button('zoom-in','자료 확대','＋')}</div></div>`;
  this.body.querySelector<HTMLButtonElement>('[data-content-command="previous"]')!.disabled=!canPrevious;
  this.body.querySelector<HTMLButtonElement>('[data-content-command="next"]')!.disabled=!canNext;
  if(!imageAvailable){
   const stage=this.body.querySelector<HTMLElement>('.full-content-media-stage')!;
   stage.removeAttribute('role');stage.removeAttribute('aria-label');
   if(recovery?.type==='collection'){
    stage.classList.add('full-content-related');
    stage.innerHTML=`<p>관련 전시 사진 ${recovery.items.length}장</p><div class="full-content-related-grid">${recovery.items.map(({gallery,index,item})=>`<button type="button" data-content-command="related-photo" data-gallery="${escape(gallery)}" data-index="${index}" aria-label="${escape(item.title||'사진 자료')} 확대"><img src="${escape(item.image)}" alt=""><span>${escape(item.title||'사진 자료')}</span></button>`).join('')}</div>`;
   }else stage.innerHTML=`<div class="full-content-source-note" role="status"><span aria-hidden="true">▧</span><p>${escape(sourceIssue!.message)}</p></div>`;
   for(const button of this.body.querySelectorAll<HTMLButtonElement>('[data-content-command="zoom-in"],[data-content-command="zoom-out"],[data-content-command="home"]'))button.disabled=true;
  }else this.showGalleryImage(item);
  const sourceNote=sourceGalleryNote(id,original.id);if(sourceNote)this.notice(sourceNote);
 }
 private moveGallery(offset:number):void {
  if(!this.gallery)return;
  const {id,index}=this.gallery,items=this.data.galleries.find(item=>item.id===id)?.items;
  if(!items||index+offset<0||index+offset>=items.length)return;
  if(this.activeAction?.type==='gallery'){this.onAction({type:'gallery',gallery:id,index:index+offset});return;}
  // The help narration describes all five pages; changing the page must not restart it.
  const narration=this.activeAction?.type==='help'?this.body.querySelector('.full-content-audio'):null;
  narration?.remove();
  this.teardown();this.renderGallery(id,index+offset);if(narration)this.body.append(narration);
 }
 private showGalleryImage(item:GalleryImage):void {
  const stage=this.body.querySelector<HTMLDivElement>('.full-content-media-stage')!;
  if(item.faces){
   const faces=item.faces;
   this.sphere=new Viewer({container:stage,adapter:CubemapAdapter,panorama:Object.fromEntries(Object.entries(faceNames).map(([name,key])=>[name,faces[key]??faces[name]])),navbar:false,defaultZoomLvl:40,mousewheelCtrlKey:false,touchmoveTwoFingers:false,loadingTxt:'자료를 불러오는 중…'});
  }else this.createZoom(stage,item.image);
 }
 private renderImage(url:string,title:string):void {
  this.body.innerHTML=`<div class="full-content-media-stage" role="img" aria-label="${escape(title)}"></div><div class="full-content-toolbar"><p>드래그하여 이동 · 휠 또는 두 손가락으로 확대</p><div>${button('zoom-out','자료 축소','−')}${button('home','자료 전체 보기','↺')}${button('zoom-in','자료 확대','＋')}</div></div>`;
  this.createZoom(this.body.querySelector<HTMLDivElement>('.full-content-media-stage')!,url);
 }
 private createZoom(stage:HTMLDivElement,url:string):void {
  this.zoom=OpenSeadragon({element:stage,tileSources:{type:'image',url},showNavigationControl:false,showNavigator:false,minZoomImageRatio:0.8,maxZoomPixelRatio:4,visibilityRatio:0.5,constrainDuringPan:true,gestureSettingsMouse:{clickToZoom:false,dblClickToZoom:true,scrollToZoom:true},gestureSettingsTouch:{pinchToZoom:true,clickToZoom:false}});
  this.zoom.addHandler('open-failed',()=>{stage.textContent='이미지를 불러오지 못했습니다. 네트워크 연결을 확인하고 다시 열어 주세요.';});
 }
 private renderArticle(path:string):void {
  const key=sourcePath(path),article=this.data.articles[key];
  this.heading.textContent=article&&article.title.length<=90?article.title:'역사 자료';
  if(!article){this.notice('이 자료의 본문을 찾을 수 없습니다.');return;}
  const iframe=document.createElement('iframe');iframe.className='full-content-article';iframe.title=article.title||'역사 자료 본문';iframe.src=article.url;iframe.setAttribute('sandbox','allow-same-origin allow-popups');
  this.body.append(iframe);
  // Delivered articles are script-free; wire in-document image links for accessible enlargement.
  iframe.addEventListener('load',()=>{
   try{
    const doc=iframe.contentDocument;if(!doc)return;
    const handler=(event:MouseEvent)=>{
     const element=event.target as Element|null;
     const target=element?.nodeType===1?element.closest<HTMLAnchorElement>('a'):null;
     if(!target)return;
     const href=target.getAttribute('href')??'';
     if(/\.(jpe?g|png|webp|gif)(?:\.webp)?(?:\?|$)/i.test(href)){
      event.preventDefault();const imageUrl=new URL(href,iframe.src).href;
      this.open({type:'image',src:imageUrl,title:target.textContent?.trim()||'본문 이미지'});
     }else if(/^https?:/i.test(href)){target.target='_blank';target.rel='noopener noreferrer';}
    };
    doc.addEventListener('click',handler);this.cleanupTasks.push(()=>doc.removeEventListener('click',handler));
   }catch{/* A linked external page can have a different origin. */}
  });
 }
 private safeExternal(value:string):string|null {
  try{const url=new URL(value);return /^https?:$/.test(url.protocol)?url.href:null;}catch{return null;}
 }
 private renderEmbed(url:string,title:string,outside:string):void {
  const safe=this.safeExternal(url),safeOutside=this.safeExternal(outside);
  if(!safe){this.notice('올바른 자료 주소가 아닙니다.');return;}
  const iframe=document.createElement('iframe');iframe.src=safe;iframe.title=title;iframe.className='full-content-embed';iframe.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-presentation');
  this.body.append(iframe);
  if(safeOutside){const footer=document.createElement('div');footer.className='full-content-external-footer';footer.innerHTML=`<span>자료가 표시되지 않으면 새 창에서 열어 주세요.</span><a href="${escape(safeOutside)}" target="_blank" rel="noopener noreferrer">새 창에서 열기 ↗</a>`;this.body.append(footer);}
 }
 private renderVideo(src:string):void {
  const video=document.createElement('video');video.src=this.url(src);video.controls=true;video.playsInline=true;video.preload='metadata';video.className='full-content-video';video.setAttribute('aria-label','역사관 영상 자료');this.body.append(video);
 }
 private renderDocument(src:string):void {
  const url=this.url(src),iframe=document.createElement('iframe');iframe.src=url;iframe.title='기록 자료 PDF';iframe.className='full-content-article';this.body.append(iframe);
  const footer=document.createElement('div');footer.className='full-content-external-footer';footer.innerHTML=`<span>문서가 표시되지 않으면 새 창에서 열어 주세요.</span><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">PDF 열기 ↗</a>`;this.body.append(footer);
 }
 private addAudio(src:string):void {
  const wrapper=document.createElement('div');wrapper.className='full-content-audio';
  const label=document.createElement('span');label.textContent='음성 안내';
  const audio=document.createElement('audio');audio.src=this.url(src);audio.controls=true;audio.preload='metadata';audio.setAttribute('aria-label','전시 설명 듣기');wrapper.append(label,audio);this.body.append(wrapper);
 }
 private renderObject(action:Extract<SourceAction,{type:'object'}>):void {
  this.heading.textContent='유물 360° 관람';
  if(action.url){this.renderEmbed(action.url,'유물 360도 회전 관람',action.url);return;}
  if(!action.folder){this.notice('유물 자료를 찾을 수 없습니다.');return;}
  const prefix=sourcePath(action.folder).replace(/\/$/,'')+'/';
  this.frames=Object.entries(this.data.assets).filter(([key])=>key.startsWith(prefix)&&!key.slice(prefix.length).includes('/')&&/\.(png|jpe?g|webp)$/i.test(key)).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([,url])=>url).slice(0,action.frames??36);
  if(!this.frames.length){this.notice('유물 회전 이미지를 불러올 수 없습니다.');return;}
  this.body.innerHTML=`<div class="full-content-object" tabindex="0" role="img" aria-label="드래그 또는 좌우 방향키로 회전하는 유물"><img draggable="false" alt="유물의 회전 모습"></div><div class="full-content-toolbar"><p>좌우로 드래그하거나 방향키로 회전하세요.</p><div>${button('frame-previous','유물을 왼쪽으로 회전','←')}<span class="full-content-frame-count" aria-live="polite"></span>${button('frame-next','유물을 오른쪽으로 회전','→')}</div></div>`;
  const stage=this.body.querySelector<HTMLDivElement>('.full-content-object')!;
  stage.addEventListener('pointerdown',event=>{this.dragStart={x:event.clientX,frame:this.frame};stage.setPointerCapture(event.pointerId);});
  stage.addEventListener('pointermove',event=>{if(this.dragStart)this.showFrame(this.dragStart.frame+Math.round((this.dragStart.x-event.clientX)/8));});
  stage.addEventListener('pointerup',()=>this.dragStart=undefined);stage.addEventListener('pointercancel',()=>this.dragStart=undefined);
  this.showFrame(0);
 }
 private showFrame(index:number):void {
  if(!this.frames.length)return;this.frame=(index%this.frames.length+this.frames.length)%this.frames.length;
  this.body.querySelector<HTMLImageElement>('.full-content-object img')!.src=this.frames[this.frame];
  this.body.querySelector<HTMLElement>('.full-content-frame-count')!.textContent=`${this.frame+1} / ${this.frames.length}`;
  for(const offset of [-1,1]){const image=new Image();image.src=this.frames[(this.frame+offset+this.frames.length)%this.frames.length];}
 }
 private renderBooks():void {
  this.heading.textContent='영락교회 E-BOOK';this.body.className='full-content-body full-content-books';
  const categories=['전체',...new Set(this.data.ebooks.map(book=>book.category))];
  this.body.innerHTML=`<nav class="full-content-categories" aria-label="전자책 분류">${categories.map(category=>`<button type="button" data-content-command="book-category" data-content-category="${escape(category)}" aria-pressed="${this.bookCategory===category}">${escape(category)}</button>`).join('')}</nav><div class="full-content-book-grid">${this.data.ebooks.map((book,index)=>this.bookCategory!=='전체'&&book.category!==this.bookCategory?'':`<button type="button" class="full-content-book" data-content-command="book" data-content-book="${index}"><img src="${escape(book.cover)}" alt="" loading="lazy"><span>${escape(book.title)}</span><small>${escape(book.category)}</small></button>`).join('')}</div>`;
 }
 private renderBook(index:number):void {
  const book=this.data.ebooks[index];if(!book)return;
  this.teardown();this.heading.textContent=book.title;
  this.body.className='full-content-body full-content-book-reader';this.body.innerHTML=`<div class="full-content-book-heading">${button('books','전자책 목록으로','← 목록으로')}<span>${escape(book.category)}</span></div>`;
  if(book.url)this.renderEmbed(book.url,book.title,book.url);
  else{this.body.insertAdjacentHTML('beforeend',`<img class="full-content-book-cover" src="${escape(book.cover)}" alt="${escape(book.title)} 표지">`);this.notice('전자책 본문 연결을 준비하고 있습니다.');}
 }
 private renderChatbot():void {
  this.heading.textContent='영락교회 역사 안내 챗봇';this.body.classList.add('full-content-chat');
  this.body.innerHTML=`<div class="full-content-chat-status"><span aria-hidden="true">✦</span><div><strong>영락 역사 길잡이</strong><small>시범 화면 · 답변 서비스 연결 준비 중</small></div></div><div class="full-content-chat-messages" role="log" aria-live="polite"><div class="full-content-chat-bubble">안녕하세요. 영락교회 디지털역사관에 오신 것을 환영합니다.<br>전시실을 둘러보거나 역사 자료를 찾아보세요.</div><div class="full-content-chat-suggestions">${button('chat-exhibit','역사 전시 둘러보기')}${button('books','전자책 찾아보기')}${button('chat-help','관람 방법 보기')}</div><p class="full-content-note">챗봇 답변 서비스는 아직 연결되지 않았습니다. 아래 입력창에서는 화면 구성만 확인할 수 있습니다.</p></div><form class="full-content-chat-form"><label class="full-content-sr-only" for="full-content-chat-input">역사관에 관해 궁금한 내용</label><input id="full-content-chat-input" autocomplete="off" placeholder="역사관에 관해 궁금한 내용을 입력하세요"><button type="submit" aria-label="메시지 보내기">↑</button></form>`;
  this.body.querySelector('form')!.addEventListener('submit',event=>{
   event.preventDefault();const input=this.body.querySelector<HTMLInputElement>('input')!,text=input.value.trim();if(!text)return;
   const messages=this.body.querySelector<HTMLElement>('.full-content-chat-messages')!;
   const user=document.createElement('div');user.className='full-content-chat-bubble is-user';user.textContent=text;
   const response=document.createElement('div');response.className='full-content-chat-bubble';response.textContent='현재는 답변 서비스 연결 전입니다. 관람 메뉴와 전자책에서 관련 자료를 확인하실 수 있습니다.';
   messages.append(user,response);input.value='';messages.scrollTop=messages.scrollHeight;
  });
 }
}
