import type {Viewer} from '@photo-sphere-viewer/core';
import {PinchGesture,type TouchPoint} from './pinch-gesture';
import {findPinchDestination,isPinchControl,type PassageCatalogue,type PinchDestination} from './pinch-navigation';
import type {WallCatalogue,WallMarker} from './wall-approach';
import type {MuseumId} from './full-types';

type Look=[number,number,number];
type GestureTarget={destination:PinchDestination;scene:string;look:Look};
type SourceMarker={data?:WallMarker;config?:{visible?:boolean;opacity?:number}};

/** Observe native touch input without taking over PSV's normal zoom and pan. */
export class PinchNavigationController {
 private gesture=new PinchGesture<GestureTarget>();
 private abort=new AbortController();
 private observer:MutationObserver;
 private hint:HTMLDivElement;
 private loading=false;
 private locked=false;
 private cycle=false;
 private multiTouch=false;
 private suppressUntil=0;
 private points:TouchPoint[]=[];
 private target:GestureTarget|null=null;
 private frame=0;
 private commitFrame=0;

 constructor(private viewer:Viewer,private container:HTMLElement,private museum:MuseumId,
  private scene:()=>string,private getLook:()=>Look,private commit:(target:PinchDestination,origin:Look)=>void,
  private unlock:()=>void,private passages:PassageCatalogue,private walls?:WallCatalogue){
  this.hint=document.createElement('div');this.hint.className='pinch-navigation-hint';this.hint.hidden=true;
  this.hint.setAttribute('role','status');this.hint.setAttribute('aria-live','polite');container.append(this.hint);
  const options={capture:true,passive:true,signal:this.abort.signal};
  window.addEventListener('touchstart',event=>this.start(event),options);
  window.addEventListener('touchmove',event=>this.move(event),options);
  window.addEventListener('touchend',event=>this.end(event),options);
  window.addEventListener('touchcancel',event=>{this.cancel();this.end(event);},options);
  window.addEventListener('blur',()=>this.cancel(),options);
  window.addEventListener('orientationchange',()=>this.cancel(),options);
  window.addEventListener('resize',()=>this.cancel(),options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancel();},options);
  container.addEventListener('click',event=>{if(this.suppressesClick){event.preventDefault();event.stopImmediatePropagation();}},{capture:true,signal:this.abort.signal});
  this.observer=new MutationObserver(()=>{if(this.blocked())this.cancel();});
  for(const element of document.querySelectorAll('dialog,#welcome,#scene-list,#full-menu,.menu-group'))this.observer.observe(element,{attributes:true,attributeFilter:['open','hidden','class']});
 }
 get suppressesClick(){return this.multiTouch||this.locked||performance.now()<this.suppressUntil;}
 private blocked(){return this.loading||this.locked||document.hidden||!!document.querySelector('dialog[open],#welcome:not([hidden]),#scene-list:not([hidden]),#full-menu.mobile-open,.menu-group[open]');}
 private contacts(event:TouchEvent):TouchPoint[]{return Array.from(event.touches,t=>({id:t.identifier,x:t.clientX,y:t.clientY}));}
 private markerAt(point:TouchPoint):WallMarker{
  const top=document.elementFromPoint(point.x,point.y);
  if(!top||!this.container.contains(top)||top.closest('button,input,select,a,audio,video,[role="button"],.psv-capture-event'))return {control:true};
  const dom=top.closest('.psv-marker') as (Element&{psvMarker?:SourceMarker})|null;
  const rect=this.container.getBoundingClientRect();
  const hits=this.viewer.renderer.getIntersections({x:point.x-rect.left,y:point.y-rect.top});
  // Same marker key as pinned PSV 5.15.1. Never use the mouse-only hover marker.
  const marker=dom?.psvMarker||hits.map(hit=>hit.object.userData.psvMarker as SourceMarker|undefined).find(m=>m&&m.config?.visible!==false&&m.config?.opacity!==0);
  return marker?.data||{};
 }
 private start(event:TouchEvent){
  const previous=this.points.length;this.points=this.contacts(event);
  if(previous===0){this.cycle=false;this.multiTouch=false;this.gesture.release([],performance.now());}
  if(this.points.length<2)return;
  // Suppress touch-generated marker selection even when there is no destination.
  if(this.points.some(point=>{const el=document.elementFromPoint(point.x,point.y);return el&&this.container.contains(el);}))this.multiTouch=true;
  if(this.cycle){this.gesture.update(this.points,performance.now());this.showHint();return;}
  this.cycle=true;
  if(this.points.length!==2||this.blocked()||this.points.some(point=>isPinchControl(this.markerAt(point))))return;
  const midpoint={id:-1,x:(this.points[0].x+this.points[1].x)/2,y:(this.points[0].y+this.points[1].y)/2};
  const marker=this.markerAt(midpoint);if(isPinchControl(marker))return;
  const rect=this.container.getBoundingClientRect();
  const position=this.viewer.dataHelper.viewerCoordsToSphericalCoords({x:midpoint.x-rect.left,y:midpoint.y-rect.top});
  if(!position)return;
  const destination=findPinchDestination(this.museum,this.scene(),position.yaw*180/Math.PI,-position.pitch*180/Math.PI,this.passages,this.walls,marker);
  if(!destination)return;
  this.target={destination,scene:this.scene(),look:[...this.getLook()]};
  if(this.gesture.begin(this.points,performance.now(),rect,this.target))this.tick();
 }
 private move(event:TouchEvent){
  this.points=this.contacts(event);
  if(this.blocked()){this.cancel();return;}
  this.gesture.update(this.points,performance.now());this.showHint();
 }
 private tick(){
  if(this.frame)return;
  this.frame=requestAnimationFrame(()=>{
   this.frame=0;
   if(this.blocked()){this.cancel();return;}
   this.gesture.update(this.points,performance.now());this.showHint();
   if(this.gesture.active)this.tick();
  });
 }
 private end(event:TouchEvent){
  this.points=this.contacts(event);
  if(this.blocked())this.gesture.cancel();
  const target=this.gesture.release(this.points,performance.now());this.showHint();
  if(this.points.length)return;
  if(this.multiTouch)this.suppressUntil=performance.now()+400;
  this.multiTouch=false;this.cycle=false;cancelAnimationFrame(this.frame);this.frame=0;
  if(!target||target.scene!==this.scene())return;
  this.locked=true;this.unlock();
  this.commitFrame=requestAnimationFrame(()=>{
   this.commitFrame=0;
   if(this.loading||document.hidden||document.querySelector('dialog[open]')||target.scene!==this.scene()){this.locked=false;return;}
   // stopAll also clears PSV's accumulated drag/zoom deltas; stopAnimation alone does not.
   void (this.viewer as Viewer&{stopAll():Promise<unknown>}).stopAll();
   try{this.commit(target.destination,target.look);}catch(error){this.locked=false;throw error;}
  });
 }
 private showHint(){
  const visible=this.gesture.armed&&!!this.target;
  if(visible&&this.hint.hidden){
   const rect=this.container.getBoundingClientRect();let bottom=24;
   for(const element of document.querySelectorAll<HTMLElement>('#page-bar,#media-shelf,#scene-audio-controls,#enable-audio,.scene-caption')){
    if(!element.getClientRects().length)continue;
    const bounds=element.getBoundingClientRect();
    if(bounds.top>rect.top+rect.height/2)bottom=Math.max(bottom,rect.bottom-bounds.top+10);
   }
   this.hint.style.bottom=bottom+'px';
   this.hint.textContent='손을 떼면 '+this.target!.destination.label;
  }
  this.hint.hidden=!visible;
 }
 cancel(){
  this.gesture.cancel();this.target=null;this.hint.hidden=true;
  if(this.commitFrame&&!this.loading)this.locked=false;
  cancelAnimationFrame(this.frame);this.frame=0;cancelAnimationFrame(this.commitFrame);this.commitFrame=0;
 }
 setLoading(loading:boolean){this.loading=loading;this.cancel();if(!loading)this.locked=false;}
 destroy(){this.cancel();this.abort.abort();this.observer.disconnect();this.hint.remove();}
}
