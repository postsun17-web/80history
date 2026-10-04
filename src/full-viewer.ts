import {Viewer} from '@photo-sphere-viewer/core';
import {CubemapTilesAdapter,type CubemapMultiTilesPanorama} from '@photo-sphere-viewer/cubemap-tiles-adapter';
import {MarkersPlugin,type MarkerConfig} from '@photo-sphere-viewer/markers-plugin';
import {assetUrl,sourcePath,type FullMuseum,type SourceHotspot} from './full-types';
import {decodeAction,type SourceAction} from './source-actions';
import {projectPlane} from './source-projection';
import {applySourcePlane} from './source-plane-mesh';
import {besideEDoor} from './e-room-layout';
import mediaScreen from './assets/media-screen.svg';
import {visiblePageControl,sourcePageControlPosition} from './source-page-controls';
import {toPosition,verticalFov} from './navigation';
import type {FullRoute} from './full-navigation';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

const faces={front:'f',back:'b',left:'l',right:'r',top:'u',bottom:'d'};
export class FullViewer {
 viewer:Viewer; markers:MarkersPlugin; scene=''; page=0;
 missingAssets=new Set<string>();
 private dimensions=new Map<string,Promise<[number,number]>>();
 private markerImages=new Map<string,HTMLImageElement>();
 private activePage=1;
 constructor(private container:HTMLElement,private data:FullMuseum,private action:(a:SourceAction)=>void,heading:(yaw:number)=>void){
  this.viewer=new Viewer({container,adapter:[CubemapTilesAdapter,{baseBlur:false}],navbar:false,minFov:25,maxFov:110,defaultZoomLvl:30,
   keyboard:'always',mousewheelCtrlKey:false,touchmoveTwoFingers:false,loadingTxt:'전시 공간을 불러오는 중입니다',plugins:[MarkersPlugin]});
  this.markers=this.viewer.getPlugin(MarkersPlugin);
  // Marker3D starts an uncaught second load unless we supply the image already
  // awaited below. Keep only the current room/page's images, not a growing tour cache.
  const loadImage=this.viewer.textureLoader.loadImage.bind(this.viewer.textureLoader);
  this.viewer.textureLoader.loadImage=(...args)=>{
   const cached=this.markerImages.get(args[0]);
   if(cached){args[1]?.(100);return Promise.resolve(cached);}
   return loadImage(...args);
  };
  this.markers.addEventListener('select-marker',({marker})=>{if(marker.data?.action)this.action(marker.data.action);});
  this.viewer.addEventListener('position-updated',({position})=>heading(position.yaw*180/Math.PI));
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
  const scene=this.data.scenes.find(s=>s.id===route.scene);if(!scene)throw new Error('Unknown scene '+route.scene);
  if(this.scene!==scene.id){
   this.dimensions.clear();this.markerImages.clear();
   const p=scene.pano,baseUrl=Object.fromEntries(Object.entries(faces).map(([name,f])=>[name,`${p.root}/${f}/base.webp`])) as Record<keyof typeof faces,string>;
   await Promise.all(Object.values(baseUrl).map(src=>this.size(src)));
   const panorama:CubemapMultiTilesPanorama={baseUrl,levels:[{faceSize:p.faceSize,nbTiles:p.tiles}],tileUrl:(face,col,row)=>`${p.root}/${faces[face]}/${p.level}/${row}_${col}.${p.ext}`};
   const look=route.look||scene.view;
   this.markers.clearMarkers();
   await this.viewer.setPanorama(panorama,{position:toPosition(look[0],look[1]),zoom:this.zoom(look[2]),transition:this.scene?{speed:500,rotation:false,effect:'fade'}:false});
   this.scene=scene.id;this.page=0;
  }else if(route.look){this.viewer.rotate(toPosition(route.look[0],route.look[1]));this.viewer.zoom(this.zoom(route.look[2]));}
  if(this.page!==route.page){await this.updateMarkers(route);this.page=route.page;}
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
   const done=()=>{clearTimeout(timer);resolve(video?[(element as HTMLVideoElement).videoWidth,(element as HTMLVideoElement).videoHeight]:[(element as HTMLImageElement).naturalWidth,(element as HTMLImageElement).naturalHeight]);};
   const fail=()=>{clearTimeout(timer);this.missingAssets.add(src);reject(new Error('Media missing: '+src));};
   const timer=setTimeout(fail,20000);
   if(!video){void this.viewer.textureLoader.loadImage(src).then(img=>{clearTimeout(timer);this.markerImages.set(src,img);resolve([img.naturalWidth,img.naturalHeight]);},fail);return;}
   element.addEventListener('loadedmetadata',done,{once:true});element.addEventListener('error',fail,{once:true});element.src=src;
  });this.dimensions.set(src,promise);void promise.catch(()=>this.dimensions.delete(src));return promise;
 }
 async updateMarkers(route:FullRoute){
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
   if(dynamicPanel){a.url=page!.image;action={type:'image',src:page!.image,title:`${zone!.title} · ${page!.title}`};}
   const defaultLabels:Record<string,string>={scene:'다른 공간으로 이동',page:'전시 페이지',gallery:'사진 보기',article:'설명 더 보기',youtube:'영상 보기',object:'유물 둘러보기',books:'전자책',chatbot:'챗봇',help:'관람 안내',image:'크게 보기',video:'영상 보기',audio:'해설 듣기',document:'자료 읽기'};
   const sourceLabel=a.tooltip||a.title||a.html||a.text||'';
   const label=((/^hotspot_\d+$/.test(sourceLabel)?'':sourceLabel)||defaultLabels[action?.type||'']||'자료 보기').replace(/\[br\]/g,' ').replace(/<[^>]+>/g,'');
   const besideDoor=scene.id==='scene_c-s-e+1'&&(dynamicPanel||!!page?.hotspots.includes(h)||/^(?:listspot_|next_|prev_)/.test(h.name));
   const position=()=>{const p=toPosition(Number(a.ath),Number(a.atv));return besideDoor?besideEDoor({...p,distance:1},true):p;};
   const base={id,data:{action},tooltip:action?label:undefined,zIndex:Math.min(1000,Number(a.zorder)||1)};
   if(h.points?.length)return {...base,polygon:h.points.map(p=>toPosition(...p)),svgStyle:{fill:'rgba(255,255,255,.01)',stroke:'transparent'}};
   if(a.linkedscene&&action){
    const title=this.data.scenes.find(s=>s.id===a.linkedscene.toLowerCase())?.title||'이동';
    const button=document.createElement('button');button.className='walk-hotspot';button.setAttribute('aria-label',title+' 이동');button.innerHTML='<span aria-hidden="true">⌃</span>';
    button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();this.action(action!);}});
    return {...base,tooltip:title+' 이동',element:button,position:position()};
   }
   const wallVideo=h.name==='iframe'&&action?.type==='youtube'&&a.onloaded?.includes('add_iframe');
   const url=wallVideo?mediaScreen:a.videourl?this.url(a.videourl):a.url&&!/\.js(?:\?|$)/.test(a.url)?this.url(a.url):'';
   if(url){
    try{
     const [w,h]=await this.size(url,!!a.videourl);
     const opacity=a.alpha===undefined?1:Number(a.alpha);
     if(a.distorted==='true'||dynamicPanel||a.videourl){
      const originalPlane=projectPlane(a,w,h);
      const plane=(besideDoor?originalPlane.map(p=>besideEDoor(p)):originalPlane) as typeof originalPlane;
      if(a.videourl){
       const chroma=(a.chromakey||'').split('|');
       return {...base,data:{...base.data,sourcePlane:plane,shouldAutoplay:a.pausedonstart!=='true'},videoLayer:url,position:plane,opacity,autoplay:false,...(a.chromakey?{chromaKey:{enabled:true,color:Number(chroma[0]),similarity:Number(chroma[1]),smoothness:Number(chroma[2])}}:{})};
      }
      // A transparent original hotspot still needs a clickable hit area.
      if(opacity===0&&action)return {...base,polygon:plane,svgStyle:{fill:'rgba(255,255,255,.001)',stroke:'transparent'}};
      return {...base,data:{...base.data,sourcePlane:plane},imageLayer:url,position:plane,opacity};
     }
     const scale=(Number(a.scale)||1)*(besideDoor?.65:1),width=(Number(a.width)||w)*scale,height=(Number(a.height)||width*h/w),minimum=besideDoor?8:16;
     return {...base,opacity,image:url,size:{width:Math.max(minimum,Math.min(width,300)),height:Math.max(minimum,Math.min(height,300))},position:position()};
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
  this.markers.setMarkers(markers.filter((m):m is MarkerConfig=>m!==null));
  for(const marker of this.markers.getMarkers()){
   if(marker.data?.sourcePlane)applySourcePlane(marker,marker.data.sourcePlane);
   if(marker.data?.shouldAutoplay)void marker.video?.play().catch(error=>{if(error?.name!=='AbortError'&&error?.name!=='NotAllowedError')console.warn('Unable to play exhibit video',error);});
  }
 }
}
