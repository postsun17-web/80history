import {Viewer} from '@photo-sphere-viewer/core';
import {CubemapTilesAdapter} from '@photo-sphere-viewer/cubemap-tiles-adapter';
import {MarkersPlugin,type MarkerConfig} from '@photo-sphere-viewer/markers-plugin';
import {assetUrl,sourcePath,type FullMuseum,type SourceHotspot} from './full-types';
import {decodeAction,type SourceAction} from './source-actions';
import {titlesForMuseum} from './content-titles';
import {panoramaSource} from './museum-viewer-data';
import type {MuseumAudio} from './museum-audio';
import {projectPlane} from './source-projection';
import {applySourcePlane} from './source-plane-mesh';
import mediaScreen from './assets/media-screen.svg';
import {visiblePageControl,sourcePageControlPosition} from './source-page-controls';
import {toPosition,verticalFov} from './navigation';
import type {FullRoute} from './full-navigation';
import {WallApproachController} from './wall-approach-controller';
import {wallCatalogue} from './wall-catalogue';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

export class FullViewer {
 viewer:Viewer; markers:MarkersPlugin; scene=''; page=0;
 missingAssets=new Set<string>();
 private dimensions=new Map<string,Promise<[number,number]>>();
 private markerImages=new Map<string,HTMLImageElement>();
 private activePage=1;
 private titles:ReturnType<typeof titlesForMuseum>;
 private revision=0;
 private mediaCleanup:(()=>void)[]=[];
 private wallVideos=new Map<string,{video:HTMLVideoElement;button:HTMLButtonElement;audible:boolean}>();
 private wallApproach:WallApproachController|null=null;
 constructor(private container:HTMLElement,private data:FullMuseum,private action:(a:SourceAction)=>void,heading:(yaw:number)=>void,private audio?:MuseumAudio){
  this.titles=titlesForMuseum(data);
  this.viewer=new Viewer({container,adapter:[CubemapTilesAdapter,{baseBlur:false}],navbar:false,minFov:25,maxFov:110,defaultZoomLvl:30,
   keyboard:'always',mousewheelCtrlKey:false,touchmoveTwoFingers:false,loadingTxt:'전시 공간을 불러오는 중입니다',plugins:[[MarkersPlugin,{clickEventOnMarker:data.id!=='memorial'}]]});
  this.markers=this.viewer.getPlugin(MarkersPlugin);
  if(data.id!=='memorial')this.wallApproach=new WallApproachController(this.viewer,this.markers,container,()=>this.scene,this.action,wallCatalogue);
  // Marker3D starts an uncaught second load unless we supply the image already
  // awaited below. Keep only the current room/page's images, not a growing tour cache.
  const loadImage=this.viewer.textureLoader.loadImage.bind(this.viewer.textureLoader);
  this.viewer.textureLoader.loadImage=(...args)=>{
   const cached=this.markerImages.get(args[0]);
   if(cached){args[1]?.(100);return Promise.resolve(cached);}
   return loadImage(...args);
  };
  this.markers.addEventListener('select-marker',({marker})=>{if(!this.wallApproach&&marker.data?.action)this.action(marker.data.action);});
  this.markers.addEventListener('enter-marker',({marker})=>{if(matchMedia('(hover: hover)').matches)this.setVideoAudible(marker.id,true);});
  this.markers.addEventListener('leave-marker',({marker})=>{if(matchMedia('(hover: hover)').matches)this.setVideoAudible(marker.id,false);});
  this.viewer.addEventListener('position-updated',({position})=>heading(position.yaw*180/Math.PI));
  this.viewer.addEventListener('zoom-updated',()=>heading(this.viewer.getPosition().yaw*180/Math.PI));
 }
 destroy(){this.revision++;this.wallApproach?.destroy();this.releaseMedia();this.dimensions.clear();this.markerImages.clear();this.viewer.destroy();}
 private releaseMedia(){for(const task of this.mediaCleanup)task();this.mediaCleanup=[];this.wallVideos.clear();}
 private setVideoAudible(id:string,audible:boolean){
  const item=this.wallVideos.get(id);if(!item)return;
  item.audible=audible;item.button.setAttribute('aria-pressed',String(audible));item.button.textContent=audible?'영상 소리 끄기':'영상 소리 켜기';
  if(this.audio)this.audio.setMediaAudible(item.video,audible);else item.video.muted=!audible;
 }
 getLook():[number,number,number]{
  const p=this.viewer.getPosition(),vfov=110-this.viewer.getZoomLevel()*.85;
  const fov=2*Math.atan(Math.tan(vfov*Math.PI/360)*Math.max(this.container.clientWidth/this.container.clientHeight,4/3))*180/Math.PI;
  return [p.yaw*180/Math.PI,-p.pitch*180/Math.PI,fov];
 }
 private zoom(fov:number){return Math.max(0,Math.min(100,(110-verticalFov(fov,this.container.clientWidth/this.container.clientHeight))/.85));}
 async enterLobby(){
  const marker=this.markers.getMarkers().find(m=>m.id.endsWith('-open_door1'));
  const video=(marker as unknown as {video?:HTMLVideoElement})?.video;
  if(!marker||!video)return;
  const entrance=this.markers.getMarkers().find(m=>m.id.endsWith('-open_b'));if(entrance)this.markers.hideMarker(entrance.id);
  this.markers.updateMarker({id:marker.id,opacity:1});
  if(marker.data?.sourcePlane)applySourcePlane(marker,marker.data.sourcePlane);
  video.loop=false;video.currentTime=0;
  try{
   await video.play();
   void this.viewer.animate({yaw:0,pitch:0,zoom:this.zoom(60),speed:6000});
   await new Promise<void>(resolve=>{const finish=()=>{clearTimeout(timer);video.removeEventListener('ended',finish);video.removeEventListener('error',finish);resolve();};const timer=setTimeout(finish,Math.min(12000,(video.duration||6)*1000+1000));video.addEventListener('ended',finish,{once:true});video.addEventListener('error',finish,{once:true});});
  }catch{/* A blocked video must not prevent entering the exhibition. */}
 }
 async show(route:FullRoute){
  const revision=++this.revision;
  this.wallApproach?.setLoading(true);
  try{
  const scene=this.data.scenes.find(s=>s.id===route.scene);if(!scene)throw new Error('Unknown scene '+route.scene);
  if(this.scene!==scene.id){
   this.releaseMedia();
   this.dimensions.clear();this.markerImages.clear();
   const panorama=panoramaSource(scene.pano);
   await Promise.all(Object.values(panorama.baseUrl).map(src=>this.size(src)));
   if(revision!==this.revision)return;
   // Delivered krpano polar faces need a 180° turn.
   const look=route.look||scene.view;
   this.markers.clearMarkers();
   await this.viewer.setPanorama(panorama,{position:toPosition(look[0],look[1]),zoom:this.zoom(look[2]),transition:this.scene?{speed:500,rotation:false,effect:'fade'}:false});
   if(revision!==this.revision)return;
   this.scene=scene.id;this.page=0;
  }else if(route.look){this.viewer.rotate(toPosition(route.look[0],route.look[1]));this.viewer.zoom(this.zoom(route.look[2]));}
  if(this.page!==route.page){await this.updateMarkers(route,revision);if(revision===this.revision)this.page=route.page;}
  }finally{if(revision===this.revision)this.wallApproach?.setLoading(false);}
 }
 resolve(h:SourceHotspot):Record<string,string>{
  const attrs:Record<string,string>={};
  for(const name of (h.attrs.style||'').split('|'))Object.assign(attrs,this.data.styles[name]||{});
  return Object.assign(attrs,h.attrs);
 }
 hotspotAction(h:SourceHotspot):SourceAction|null{
  const a=this.resolve(h);
  if(h.name==='open_b')return {type:'scene',scene:'scene_f-c-0',look:[0,0,100]};
  if(a.videourl&&a.html5controls==='true')return {type:'video',src:this.url(a.videourl)};
  if(/(?:^|\|)(nextb|prevb)(?:\||$)/.test(a.style||'')){
   const scene=this.data.scenes.find(s=>s.id===this.scene),zone=this.data.zones.find(z=>z.id===scene?.zone);
   const page=this.activePage+(a.style.includes('nextb')?1:-1);
   return zone&&page>=1&&page<=zone.pages.length?{type:'page',zone:zone.id,page}:null;
  }
  if(a.linkedscene){
   const id=a.linkedscene.toLowerCase();if(!this.data.scenes.some(s=>s.id===id))return null;
   const look=(a.linkedscene_lookat||'').split(',').map(Number);
   return {type:'scene',scene:id,...(look.length===3&&look.every(Number.isFinite)?{look:look as [number,number,number]}:{})};
  }
  return decodeAction(a.onclick||'')||decodeAction(a.onloaded||'');
 }
 private url(value:string){return this.data.assets[sourcePath(value)]||assetUrl(value);}
 private size(src:string,video=false):Promise<[number,number]>{
  const old=this.dimensions.get(src);if(old)return old;
  const promise=new Promise<[number,number]>((resolve,reject)=>{
   const element=video?document.createElement('video'):new Image();
   const release=()=>{clearTimeout(timer);element.removeEventListener('loadedmetadata',done);element.removeEventListener('error',fail);if(video){element.removeAttribute('src');(element as HTMLVideoElement).load();}};
   const done=()=>{const dimensions:[number,number]=video?[(element as HTMLVideoElement).videoWidth,(element as HTMLVideoElement).videoHeight]:[(element as HTMLImageElement).naturalWidth,(element as HTMLImageElement).naturalHeight];release();resolve(dimensions);};
   const fail=()=>{release();this.missingAssets.add(src);reject(new Error('Media missing: '+src));};
   const timer=setTimeout(fail,20000);
   if(!video){void this.viewer.textureLoader.loadImage(src).then(img=>{clearTimeout(timer);this.markerImages.set(src,img);resolve([img.naturalWidth,img.naturalHeight]);},fail);return;}
   (element as HTMLVideoElement).preload='metadata';element.addEventListener('loadedmetadata',done,{once:true});element.addEventListener('error',fail,{once:true});element.src=src;
  });this.dimensions.set(src,promise);void promise.catch(()=>this.dimensions.delete(src));return promise;
 }
 async updateMarkers(route:FullRoute,revision=this.revision){
  this.dimensions.clear();this.markerImages.clear();
  const scene=this.data.scenes.find(s=>s.id===route.scene)!,zone=this.data.zones.find(z=>z.id===scene.zone),page=zone?.pages[route.page-1];
  this.activePage=route.page;
  const sources=[...scene.hotspots,...(page?.hotspots||[])];
  const markers=await Promise.all(sources.map(async(h,index):Promise<MarkerConfig|null>=>{
   const a=this.resolve(h);if(!('ath'in a)&&!('ath2'in a)&&!h.points?.length)return null;
   if(a.devices==='mobile')return null;
   a.ath=a.ath||a.ath2||'0';a.atv=a.atv||a.atv2||'0';
   const id=`source-${index}-${h.name}`;let action=this.hotspotAction(h);
   if(zone&&h.name.startsWith('listspot_')&&action?.type==='page'){
    if(!visiblePageControl(zone.id,route.page,action.page))return null;
    const moved=sourcePageControlPosition(zone.id,route.page,action.page);
    if(moved){a.ath=String(moved.ath);a.atv=String(moved.atv);}
   }
   if(/(?:^|\|)(nextb|prevb)(?:\||$)/.test(a.style||'')&&!action)return null;
   if(action?.type==='page')a.alpha=action.page===route.page?'1':'.45';
   const dynamicPanel=!!(zone&&h.name===`sector_${zone.id}_01`&&page);
   if(dynamicPanel){a.url=page!.image;action={type:'image',src:page!.image,title:this.titles.page(zone!.id,page!.number)};}
   if(action)action=this.titles.action(action);
   const defaultLabels:Record<string,string>={scene:'다른 공간으로 이동',page:'전시 페이지',gallery:'사진 보기',article:'설명 더 보기',youtube:'영상 보기',object:'유물 둘러보기',books:'전자책',chatbot:'챗봇',help:'관람 안내',image:'크게 보기',video:'영상 보기',audio:'해설 듣기',document:'자료 읽기'};
   const sourceLabel=action?.type==='image'?action.title||'':action?.type==='article'?this.titles.article(action.path):action?.type==='page'?this.titles.page(action.zone,action.page):a.tooltip||a.title||a.html||a.text||'';
   const label=((/^hotspot_\d+$/.test(sourceLabel)?'':sourceLabel)||defaultLabels[action?.type||'']||'자료 보기').replace(/\[br\]/g,' ').replace(/<[^>]+>/g,'');
   const position=()=>toPosition(Number(a.ath),Number(a.atv));
   const base={id,data:{action,sourceName:h.name},tooltip:action?label:undefined,zIndex:Math.min(1000,Number(a.zorder)||1)};
   if(h.points?.length)return {...base,polygon:h.points.map(p=>toPosition(...p)),svgStyle:{fill:'rgba(255,255,255,.01)',stroke:'transparent'}};
   if(a.linkedscene&&action){
    const title=this.data.scenes.find(s=>s.id===a.linkedscene.toLowerCase())?.title||'이동';
    const button=document.createElement('button');button.type='button';button.className='walk-hotspot';button.setAttribute('aria-label',title+' 이동');
    button.innerHTML='<svg class="walk-hotspot-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 14 6-6 6 6"/></svg>';
    // The label stays outside the measured button so the source marker anchor is unchanged.
    const destination=document.createElement('span');destination.className='walk-hotspot-label';destination.textContent=title;destination.setAttribute('aria-hidden','true');button.append(destination);
    button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();if(!e.repeat)this.action(action!);}});
    return {...base,tooltip:{content:title+' 이동',position:'top center'},element:button,position:position()};
   }
   const wallVideo=h.name==='iframe'&&action?.type==='youtube'&&a.onloaded?.includes('add_iframe');
   const url=wallVideo?mediaScreen:a.videourl?this.url(a.videourl):a.url&&!/\.js(?:\?|$)/.test(a.url)?this.url(a.url):'';
   if(url){
    try{
     const [w,h]=await this.size(url,!!a.videourl);
     const opacity=a.alpha===undefined?1:Number(a.alpha);
     if(a.distorted==='true'||dynamicPanel||a.videourl){
      const plane=projectPlane(a,w,h);
      if(a.videourl){
       const chroma=(a.chromakey||'').split('|');
       return {...base,data:{...base.data,sourcePlane:plane,shouldAutoplay:a.pausedonstart!=='true',soundControl:a.html5controls==='true',volume:Number(a.volume)||0,loop:a.loop!=='false'},videoLayer:url,position:plane,opacity,autoplay:false,...(a.chromakey?{chromaKey:{enabled:true,color:Number(chroma[0]),similarity:Number(chroma[1]),smoothness:Number(chroma[2])}}:{})};
      }
      // A transparent original hotspot still needs a clickable hit area.
      if(opacity===0&&action)return {...base,polygon:plane,svgStyle:{fill:'rgba(255,255,255,.001)',stroke:'transparent'}};
      return {...base,data:{...base.data,sourcePlane:plane},imageLayer:url,position:plane,opacity};
     }
     const scale=Number(a.scale)||1,width=(Number(a.width)||w)*scale,height=(Number(a.height)||width*h/w);
     return {...base,opacity,image:url,size:{width:Math.max(16,Math.min(width,300)),height:Math.max(16,Math.min(height,300))},position:position()};
    }catch(error){console.warn('Unable to render source hotspot',h.name,error);}
   }
   if(!action&&a.style?.split('|').includes('callout')){
    const callout=document.createElement('div');callout.className='source-callout';
    const title=document.createElement('span');title.textContent=label;callout.append(title);
    return {...base,element:callout,position:position()};
   }
   if(!action)return null;
   const button=document.createElement('button');button.className='content-hotspot';button.textContent=a.style?.includes('callout')?label:action.type==='youtube'?'▶':action.type==='object'?'↻':'＋';button.setAttribute('aria-label',label);
   button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();this.action(action!);}});
   return {...base,element:button,position:position()};
  }));
  if(revision!==this.revision)return;
  this.releaseMedia();
  this.markers.setMarkers(markers.filter((m):m is MarkerConfig=>m!==null));
  for(const marker of this.markers.getMarkers()){
   if(marker.data?.sourcePlane)applySourcePlane(marker,marker.data.sourcePlane);
   if(marker.video){
    const video=marker.video;video.loop=marker.data?.loop!==false;
    const release=this.audio?.bindMedia(video,{volume:marker.data?.volume??0,muted:true,autoplay:!!marker.data?.shouldAutoplay});
    this.mediaCleanup.push(()=>{release?.();video.pause();video.removeAttribute('src');video.load();});
    if(marker.data?.soundControl){
     const button=document.createElement('button');button.type='button';button.className='wall-video-sound';button.textContent='영상 소리 켜기';button.setAttribute('aria-pressed','false');
     const corners=marker.data.sourcePlane as ReturnType<typeof projectPlane>,left=corners[2],right=corners[3];
     this.wallVideos.set(marker.id,{video,button,audible:false});
     const onClick=(event:MouseEvent)=>{event.stopPropagation();const audible=!this.wallVideos.get(marker.id)?.audible;if(audible){this.audio?.setMuted(false);void this.audio?.unlock();}this.setVideoAudible(marker.id,audible);};
     button.addEventListener('click',onClick);
     button.addEventListener('pointerdown',event=>event.stopPropagation());
     this.markers.addMarker({id:marker.id+'-sound',element:button,position:{yaw:Math.atan2(Math.sin(left.yaw)+Math.sin(right.yaw),Math.cos(left.yaw)+Math.cos(right.yaw)),pitch:(left.pitch+right.pitch)/2-.035},zIndex:1000},false);
    }
   }
   if(marker.data?.shouldAutoplay&&!this.audio)void marker.video?.play().catch(error=>{if(error?.name!=='AbortError'&&error?.name!=='NotAllowedError')console.warn('Unable to play exhibit video',error);});
  }
  this.markers.renderMarkers();
 }
}
