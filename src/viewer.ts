import { Viewer } from '@photo-sphere-viewer/core';
import { CubemapTilesAdapter, type CubemapMultiTilesPanorama } from '@photo-sphere-viewer/cubemap-tiles-adapter';
import { MarkersPlugin, type MarkerConfig } from '@photo-sphere-viewer/markers-plugin';
import data from './data/museum.json';
import { toPosition, verticalFov, type Route } from './navigation';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

const faceNames = {front:'f',back:'b',left:'l',right:'r',top:'u',bottom:'d'};
export class MuseumViewer {
 viewer: Viewer;
 markers: MarkersPlugin;
 scene = '';
 constructor(private container: HTMLElement, private action: (action:string)=>void, heading:(degrees:number)=>void) {
  this.viewer=new Viewer({container, adapter:[CubemapTilesAdapter,{baseBlur:false}],navbar:false,
   minFov:25,maxFov:100,defaultZoomLvl:35,keyboard:'always',mousewheelCtrlKey:false,
   touchmoveTwoFingers:false,loadingTxt:'전시 공간을 불러오는 중입니다',
   plugins:[MarkersPlugin]});
  this.markers=this.viewer.getPlugin(MarkersPlugin);
  this.markers.addEventListener('select-marker',({marker})=>{if(marker.data?.action)this.action(marker.data.action);});
  this.viewer.addEventListener('position-updated',({position})=>heading(position.yaw*180/Math.PI));
 }
 getLook():[number,number,number] {
  const p=this.viewer.getPosition();
  const vfov=100-this.viewer.getZoomLevel()*.75;
  const mfov=2*Math.atan(Math.tan(vfov*Math.PI/360)*Math.max(this.container.clientWidth/this.container.clientHeight,4/3))*180/Math.PI;
  return [+(p.yaw*180/Math.PI).toFixed(3),+(-p.pitch*180/Math.PI).toFixed(3),+mfov.toFixed(3)];
 }
 async show(route:Route) {
  const scene=data.scenes.find(s=>s.id===route.scene)!;
  if(this.scene!==scene.id){
   this.markers.clearMarkers();
   const root=`/media/v1/panos/${scene.key}`;
   const panorama:CubemapMultiTilesPanorama={
    baseUrl:Object.fromEntries(Object.entries(faceNames).map(([name,face])=>[name,`${root}/${face}/base.webp`])) as Record<keyof typeof faceNames,string>,
    levels:[{faceSize:2048,nbTiles:4},{faceSize:3840,nbTiles:8}],
    tileUrl:(face,col,row,level)=>`${root}/${faceNames[face]}/${level+2}/${row}_${col}.${level===0?'jpg':'webp'}`};
   const look=route.look||[scene.ath,scene.atv,scene.fov];
   const zoom=this.zoomFor(look[2]);
   await this.viewer.setPanorama(panorama,{position:toPosition(look[0],look[1]),zoom,transition:false});
   this.scene=scene.id;
  }else if(route.look){
   this.viewer.rotate(toPosition(route.look[0],route.look[1]));this.viewer.zoom(this.zoomFor(route.look[2]));
  }
  await this.updateMarkers(route);
 }
 private zoomFor(fov:number){return Math.max(0,Math.min(100,(100-verticalFov(fov,this.container.clientWidth/this.container.clientHeight))/.75));}
 private async updateMarkers(route:Route){
  const markers:MarkerConfig[]=[];
  const button=(id:string,ath:number,atv:number,label:string,action:string,icon='↗')=>{
   const element=document.createElement('button');element.className='pano-hotspot';element.setAttribute('aria-label',label);
   const symbol=document.createElement('span');symbol.textContent=icon;
   const text=document.createElement('span');text.textContent=label;element.append(symbol,text);
   element.addEventListener('click',e=>{e.stopPropagation();this.action(action)});
   markers.push({id,element,position:toPosition(ath,atv),anchor:'center center',data:{action},tooltip:label});
  };
  // Original XML dimensions are in krpano distorted-hotspot units (1000-unit distance).
  // The spherical four-corner projection preserves edge and local X/Y rotations.
  for(const p of data.panels.filter(p=>p.id===route.scene)){
   const img=new Image();img.src=p.image;
   await img.decode();
   const width=Number(p.width)/1000,height=width*img.naturalHeight/img.naturalWidth;
   const edge=p.edge||'center';
   const ax=edge.includes('left')?0:edge.includes('right')?1:.5;
   const ay=edge.includes('top')?0:edge.includes('bottom')?1:.5;
   const yaw=Number(p.ath)*Math.PI/180,pitch=-Number(p.atv)*Math.PI/180;
   const rx=Number(p.rx||0)*Math.PI/180,ry=Number(p.ry||0)*Math.PI/180;
   const corners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{
    let x=(u-ax)*width,y=(ay-v)*height,z=0;
    const py=y*Math.cos(rx)-z*Math.sin(rx),pz=y*Math.sin(rx)+z*Math.cos(rx);y=py;z=pz;
    const px=x*Math.cos(ry)+z*Math.sin(ry);z=-x*Math.sin(ry)+z*Math.cos(ry);x=px;
    // Tangent frame: centre + right*x + up*y + normal*z.
    const X=Math.sin(yaw)*Math.cos(pitch)*(1+z)+Math.cos(yaw)*x-Math.sin(yaw)*Math.sin(pitch)*y;
    const Y=Math.sin(pitch)*(1+z)+Math.cos(pitch)*y;
    const Z=Math.cos(yaw)*Math.cos(pitch)*(1+z)-Math.sin(yaw)*x-Math.cos(yaw)*Math.sin(pitch)*y;
    return {yaw:Math.atan2(X,Z),pitch:Math.atan2(Y,Math.hypot(X,Z))};
   });
   markers.push({id:p.name,imageLayer:p.image,position:corners as [typeof corners[0],typeof corners[0],typeof corners[0],typeof corners[0]],opacity:Number(p.alpha||1)});
  }
  if(route.scene===data.scenes[0].id)button('to-a',0,16,'A존으로 이동',`scene:${data.scenes[1].id}`);
  if(route.scene===data.scenes[1].id){
   button('to-history',-145,13,'복음의 문이 열리다',`scene:${data.scenes[2].id}`);
   button('a-video',35,5,'A존 소개 영상','video-a','▶');
   button('to-lobby',180,22,'로비로 이동',`scene:${data.scenes[0].id}`,'↩');
  }
  if(route.scene===data.scenes[2].id){
   // Main panel geometry is unavailable in the encrypted tour: this is explicitly a PoC calibration.
   markers.push({id:'history-panel',imageLayer:data.pages[route.page-1],
    position:[toPosition(137,-21),toPosition(225,-21),toPosition(225,23),toPosition(137,23)],
    data:{action:'panel'},tooltip:'전시 패널 크게 보기',zIndex:1});
   for(const h of data.hotspots.filter(h=>h.page===route.page))button(h.id,h.ath,h.atv,h.title,h.exhibit,h.exhibit.startsWith('photo')?'+':'≡');
   for(const p of data.polygons.filter(p=>p.page===route.page))markers.push({id:p.id,polygon:p.points.map(([a,v])=>toPosition(a,v)),svgStyle:{fill:'rgba(203,170,104,0.04)',stroke:'rgba(203,170,104,0.5)',strokeWidth:'1'},data:{action:p.exhibit},tooltip:p.title,zIndex:3});
   button('panel-read',-178,27,'전시 패널 읽기','panel','▤');
   button('to-entry',0,20,'A존 입구로',`scene:${data.scenes[1].id}`,'↩');
  }
  this.markers.setMarkers(markers);
 }
}
