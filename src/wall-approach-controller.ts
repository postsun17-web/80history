import type {Viewer} from '@photo-sphere-viewer/core';
import type {MarkersPlugin} from '@photo-sphere-viewer/markers-plugin';
import type {SourceAction} from './source-actions';
import {findWallApproach,wallApproachAction,type WallCatalogue,type WallMarker} from './wall-approach';
import {stabilizePanoramaRaycast,type PickingScene} from './panorama-raycast';

type SourceMarker={data?:{action?:SourceAction;sourceName?:string};hideTooltip?:()=>void};

/** Uses PSV's gesture-qualified click, with no extra hit layer above exhibit markers. */
export class WallApproachController {
 private loading=false;
 private locked=false;
 private abort=new AbortController();
 private points=new Map<number,{x:number;y:number;time:number}>();
 private suppressUntil=0;
 private hoverMarker:SourceMarker|null=null;
 private tooltip:HTMLDivElement;
 private hoverFrame=0;
 private pointer:PointerEvent|null=null;
 private restoreRaycast:()=>void;
 constructor(private viewer:Viewer,markers:MarkersPlugin,private container:HTMLElement,private scene:()=>string,private action:(action:SourceAction)=>void,private catalogue:WallCatalogue){
  // Pinned PSV 5.15.1 keeps its invisible click sphere in this internal scene.
  this.restoreRaycast=stabilizePanoramaRaycast((viewer.renderer as unknown as {scene:PickingScene}).scene);
  this.tooltip=document.createElement('div');this.tooltip.className='wall-approach-tooltip';this.tooltip.setAttribute('role','tooltip');this.tooltip.hidden=true;container.append(this.tooltip);
  const click=(event:{data:{rightclick:boolean;yaw:number;pitch:number;marker?:SourceMarker;target?:HTMLElement}})=>{
   if(event.data.rightclick||this.loading||this.locked||performance.now()<this.suppressUntil)return;
   const {marker,target,yaw,pitch}=event.data;
   const hit=findWallApproach(this.catalogue,this.scene(),yaw*180/Math.PI,-pitch*180/Math.PI,this.markerInfo(marker,target));
   if(hit){this.locked=true;this.clearHover();try{this.action(wallApproachAction(hit));}catch(error){this.locked=false;throw error;}}
   else if(marker?.data?.action)this.action(marker.data.action);
  };
  const enter=({marker}:{marker:SourceMarker})=>{this.hoverMarker=marker;this.scheduleHover();};
  const leave=()=>{this.hoverMarker=null;this.scheduleHover();};
  const rotated=()=>this.clearHover();
  const options={signal:this.abort.signal};
  viewer.addEventListener('click',click,options);viewer.addEventListener('position-updated',rotated,options);viewer.addEventListener('zoom-updated',rotated,options);
  markers.addEventListener('enter-marker',enter,options);markers.addEventListener('leave-marker',leave,options);
  container.addEventListener('pointerdown',event=>{
   this.points.set(event.pointerId,{x:event.clientX,y:event.clientY,time:performance.now()});
   if(this.points.size>1)this.suppressUntil=Infinity;
   this.clearHover();
  },options);
  container.addEventListener('pointermove',event=>{
   const start=this.points.get(event.pointerId);
   if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)this.suppressUntil=Infinity;
   this.pointer=event;if(!this.points.size)this.scheduleHover();
  },options);
  const release=(event:PointerEvent)=>{
   const start=this.points.get(event.pointerId);
   if(event.type==='pointercancel'||this.suppressUntil===Infinity||start&&performance.now()-start.time>500)this.suppressUntil=performance.now()+350;
   this.points.delete(event.pointerId);
  };
  // Pointer-up can occur outside the viewer after a drag.
  window.addEventListener('pointerup',release,options);window.addEventListener('pointercancel',release,options);
  window.addEventListener('blur',()=>{this.points.clear();this.suppressUntil=performance.now()+350;this.clearHover();},options);
  container.addEventListener('pointerleave',()=>{this.pointer=null;this.clearHover();},options);
 }
 private markerInfo(marker?:SourceMarker|null,target?:EventTarget|null):WallMarker{
  const control=target instanceof Element&&!!target.closest('button,input,select,a,audio,video,[role="button"]');
  return {sourceName:marker?.data?.sourceName,action:marker?.data?.action,control};
 }
 private scheduleHover(){
  if(this.hoverFrame)return;
  this.hoverFrame=requestAnimationFrame(()=>{this.hoverFrame=0;this.updateHover();});
 }
 private updateHover(){
  const event=this.pointer;
  if(!event||event.pointerType!=='mouse'||!matchMedia('(hover: hover)').matches||this.loading||this.locked||this.points.size){this.clearHover();return;}
  const rect=this.container.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  const position=this.viewer.dataHelper.viewerCoordsToSphericalCoords({x,y});
  if(!position){this.clearHover();return;}
  const hit=findWallApproach(this.catalogue,this.scene(),position.yaw*180/Math.PI,-position.pitch*180/Math.PI,this.markerInfo(this.hoverMarker,event.target));
  if(!hit){this.clearHover();return;}
  this.hoverMarker?.hideTooltip?.();
  this.container.classList.add('wall-approach-ready');this.tooltip.hidden=false;this.tooltip.textContent=hit.target.title+' 앞으로 이동';
  this.tooltip.style.left=Math.max(8,Math.min(x+14,rect.width-this.tooltip.offsetWidth-8))+'px';
  this.tooltip.style.top=Math.max(8,Math.min(y+18,rect.height-this.tooltip.offsetHeight-8))+'px';
 }
 private clearHover(){this.container.classList.remove('wall-approach-ready');this.tooltip.hidden=true;}
 setLoading(loading:boolean){this.loading=loading;this.clearHover();if(!loading){this.locked=false;this.hoverMarker=null;}}
 destroy(){this.abort.abort();this.restoreRaycast();cancelAnimationFrame(this.hoverFrame);this.points.clear();this.clearHover();this.tooltip.remove();}
}
