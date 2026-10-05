/** One sound policy for the history museum and the memorial, with native media controls. */
export interface MuseumAudioTrack {src:string;title?:string;volume?:number}
export interface MuseumAudioState {
 muted:boolean;
 unlocked:boolean;
 blocked:boolean;
 playingNarration?:string;
 error?:string;
}
export interface MuseumAudioOptions {
 onState?:(state:MuseumAudioState)=>void;
 createAudio?:()=>HTMLAudioElement;
 storage?:Pick<Storage,'getItem'|'setItem'>|null;
 document?:Document|null;
 window?:Window|null;
}
export interface MuseumMediaOptions {volume?:number;autoplay?:boolean;muted?:boolean;scope?:'scene'|'content'}
export const MUSEUM_AUDIO_STORAGE_KEY='youngnak-museum-muted';

// Silent PCM primes the *same* audio elements later used for narration on iOS.
const SILENCE='data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==';
type ChannelName='background'|'scene'|'content';
interface Channel {
 name:ChannelName;el:HTMLAudioElement;track?:MuseumAudioTrack;
 wanted:boolean;completed:boolean;blocked:boolean;error?:string;
 version:number;pending?:Promise<void>;priming:boolean;primed:boolean;
 managerPauses:number;managerPlay:boolean;cancelledPlay:boolean;cleanup:(()=>void)[];
}
interface BoundMedia {
 el:HTMLMediaElement;localMuted:boolean;applying:boolean;scope:'scene'|'content';
 resumeVisible:boolean;blocked:boolean;autoplay:boolean;cleanup:(()=>void)[];
}
const volume=(value:number|undefined,fallback:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value!:fallback));

export class MuseumAudio {
 private channels:Record<ChannelName,Channel>;
 private listeners=new Set<(state:MuseumAudioState)=>void>();
 private bound=new Map<HTMLMediaElement,BoundMedia>();
 private suspensions=new Set<symbol>();
 private sceneMediaSuspensions=new Set<symbol>();
 private storage:Pick<Storage,'getItem'|'setItem'>|null;
 private doc:Document|null;
 private win:Window|null;
 private muted=false;
 private unlocked=false;
 private hidden=false;
 private destroyed=false;
 private reconciling=false;
 private sceneKey?:string;
 private lastState='';

 constructor(options:MuseumAudioOptions={}) {
  this.doc=options.document===undefined?(typeof document==='undefined'?null:document):options.document;
  this.win=options.window===undefined?(typeof window==='undefined'?null:window):options.window;
  this.storage=null;
  try{this.storage=options.storage===undefined?this.win?.localStorage??null:options.storage;this.muted=this.storage?.getItem(MUSEUM_AUDIO_STORAGE_KEY)==='true';}catch{/* Storage may be disabled in private browsing. */}
  this.hidden=this.doc?.hidden??false;
  const createAudio=options.createAudio??(()=>new Audio());
  const create=(name:ChannelName):Channel=>{
   const el=createAudio();el.preload='metadata';el.loop=false;
   const channel:Channel={name,el,wanted:false,completed:false,blocked:false,version:0,priming:false,primed:false,managerPauses:0,managerPlay:false,cancelledPlay:false,cleanup:[]};
   this.listen(channel,el,'play',()=>this.onChannelPlay(channel));
   this.listen(channel,el,'volumechange',()=>{
    if(!channel.priming&&channel.el.muted!==this.muted)this.setMuted(channel.el.muted);
   });
   this.listen(channel,el,'pause',()=>{
    if(channel.managerPauses){channel.managerPauses--;return;}
    if(channel.priming||channel.el.ended)return;
    channel.wanted=false;this.reconcile();
   });
   this.listen(channel,el,'ended',()=>{
    if(channel.priming)return;
    channel.completed=true;channel.wanted=false;channel.blocked=false;channel.error=undefined;this.reconcile();
   });
   this.listen(channel,el,'error',()=>{
    if(!channel.track||channel.priming)return;
    channel.blocked=true;channel.error=`${channel.track.title??'음성 안내'} 음원을 불러오지 못했습니다.`;this.pause(channel);this.emit();
   });
   return channel;
  };
  this.channels={background:create('background'),scene:create('scene'),content:create('content')};
  this.doc?.addEventListener('visibilitychange',this.visibilityChanged);
  this.win?.addEventListener('storage',this.storageChanged);
  if(options.onState)this.subscribe(options.onState);
 }

 get sceneElement():HTMLAudioElement{return this.channels.scene.el;}
 get state():MuseumAudioState {
  const channels=Object.values(this.channels);
  const failure=channels.find(channel=>channel.wanted&&channel.blocked);
  const playing=[this.channels.content,this.channels.scene].find(channel=>channel.track&&!channel.el.paused&&!channel.priming&&!this.muted&&!this.hidden);
  return {muted:this.muted,unlocked:this.unlocked,blocked:!!failure||[...this.bound.values()].some(media=>media.blocked),playingNarration:playing?.track?.title,error:failure?.error};
 }
 subscribe(listener:(state:MuseumAudioState)=>void):()=>void {
  this.listeners.add(listener);listener(this.state);return()=>this.listeners.delete(listener);
 }

 /** Call directly from a user gesture, before awaiting other work. Never changes mute preference. */
 async unlock():Promise<void> {
  if(this.destroyed)return;
  this.unlocked=true;
  for(const channel of Object.values(this.channels)){channel.blocked=false;channel.error=undefined;}
  for(const record of this.bound.values())record.blocked=false;
  this.reconcile();
  const pending:Promise<void>[]=[];
  for(const channel of Object.values(this.channels)){
   if(channel.pending)pending.push(channel.pending);
   else if(!channel.primed)pending.push(this.prime(channel));
  }
  for(const record of this.bound.values())if(record.autoplay&&!this.hidden&&record.el.paused)this.playBound(record);
  await Promise.all(pending);
  if(!this.destroyed)this.reconcile();
 }

 setMuted(muted:boolean):void {
  if(this.destroyed)return;
  this.muted=muted;
  try{this.storage?.setItem(MUSEUM_AUDIO_STORAGE_KEY,String(muted));}catch{/* Playback remains usable when storage is unavailable. */}
  this.reconcile();
 }
 toggleMuted():void{this.setMuted(!this.muted);}

 configureBackground(track:MuseumAudioTrack|null):void {
  this.setTrack(this.channels.background,track??undefined,false);this.reconcile();
 }
 startBackground():void {
  const channel=this.channels.background;
  if(channel.track&&!channel.completed){channel.wanted=true;this.reconcile();}
 }
 setScene(key:string,narration?:MuseumAudioTrack):void {
  if(this.destroyed||this.sceneKey===key)return;
  this.sceneKey=key;
  this.setTrack(this.channels.scene,narration,!!narration);
  this.stopContent();
  this.reconcile();
 }
 playNarration(track:MuseumAudioTrack,scope:'content'|'scene'='content'):HTMLAudioElement {
  const channel=this.channels[scope];
  this.setTrack(channel,track,true);this.reconcile();return channel.el;
 }
 stopContent():void {this.setTrack(this.channels.content,undefined,false);this.reconcile();}

 /** Register existing videos/audio. Local mute (hover/touch) remains distinct from global mute. */
 bindMedia(el:HTMLMediaElement,options:MuseumMediaOptions={}):()=>void {
  if(this.destroyed)return()=>{};
  const existing=this.bound.get(el);
  if(existing)this.removeBound(existing);
  const record:BoundMedia={el,localMuted:options.muted??el.muted,scope:options.scope??'scene',applying:false,resumeVisible:false,blocked:false,autoplay:options.autoplay??false,cleanup:[]};
  if(options.volume!==undefined)el.volume=volume(options.volume,1);
  this.bound.set(el,record);
  this.listen(record,el,'play',()=>{record.blocked=false;this.reconcile();});
  this.listen(record,el,'pause',()=>this.reconcile());
  this.listen(record,el,'ended',()=>{record.resumeVisible=false;record.autoplay=false;this.reconcile();});
  this.listen(record,el,'error',()=>{record.blocked=true;this.emit();});
  this.listen(record,el,'volumechange',()=>{
   if(!record.applying&&!this.muted&&!this.sceneMediaSuppressed(record))record.localMuted=el.muted;
   this.reconcile();
  });
  this.applyMediaMute(record);
  if(record.autoplay)this.playBound(record);
  this.reconcile();
  let removed=false;
  return()=>{if(removed)return;removed=true;this.removeBound(record);this.reconcile();};
 }
 setMediaAudible(el:HTMLMediaElement,audible:boolean):void {
  const record=this.bound.get(el);if(!record)return;
  record.localMuted=!audible;this.applyMediaMute(record);this.reconcile();
 }
 suspend(reason:string):()=>void {
  const token=Symbol(reason);this.suspensions.add(token);this.reconcile();
  return()=>{this.suspensions.delete(token);this.reconcile();};
 }
 /** A modal owns foreground sound until it closes, without changing wall-video preferences. */
 suspendSceneMedia():()=>void {
  const token=Symbol('content-dialog');this.sceneMediaSuspensions.add(token);this.reconcile();
  return()=>{this.sceneMediaSuspensions.delete(token);this.reconcile();};
 }
 destroy():void {
  if(this.destroyed)return;
  this.destroyed=true;
  this.doc?.removeEventListener('visibilitychange',this.visibilityChanged);
  this.win?.removeEventListener('storage',this.storageChanged);
  for(const record of [...this.bound.values()])this.removeBound(record);
  for(const channel of Object.values(this.channels)){
   channel.version++;channel.wanted=false;channel.track=undefined;
   for(const cleanup of channel.cleanup)cleanup();
   channel.el.pause();channel.el.removeAttribute('src');channel.el.load();
  }
  this.suspensions.clear();this.sceneMediaSuspensions.clear();this.listeners.clear();
 }

 private listen(owner:{cleanup:(()=>void)[]},target:EventTarget,type:string,listener:()=>void):void {
  target.addEventListener(type,listener);owner.cleanup.push(()=>target.removeEventListener(type,listener));
 }
 private setTrack(channel:Channel,track:MuseumAudioTrack|undefined,wanted:boolean):void {
  if(this.destroyed)return;
  channel.version++;channel.pending=undefined;channel.priming=false;
  this.pause(channel);channel.track=track;channel.wanted=wanted;channel.completed=false;channel.blocked=false;channel.error=undefined;
  channel.el.loop=false;channel.el.muted=this.muted;channel.el.volume=volume(track?.volume,channel.name==='background'?.1:.35);
  if(track)channel.el.src=track.src;else channel.el.removeAttribute('src');
  channel.el.load();
 }
 private desired(channel:Channel):boolean{return !!channel.track&&channel.wanted&&!channel.completed;}
 private audibleExternal():boolean {
  return [...this.bound.values()].some(record=>!record.el.paused&&!record.el.ended&&!record.el.muted&&record.el.volume>0);
 }
 private shouldPlay(channel:Channel):boolean {
  if(this.destroyed||!this.unlocked||this.muted||this.hidden||!this.desired(channel))return false;
  if(channel.name==='content')return !this.audibleExternal();
  if(this.suspensions.size||this.audibleExternal()||this.desired(this.channels.content))return false;
  return channel.name==='scene'||!this.desired(this.channels.scene);
 }
 private reconcile():void {
  if(this.destroyed||this.reconciling)return;
  this.reconciling=true;
  try{
   for(const record of this.bound.values())this.applyMediaMute(record);
   // Pause lower-priority channels before playing a new narration.
   for(const channel of Object.values(this.channels)){
    if(!channel.priming)channel.el.muted=this.muted;
    if(!this.shouldPlay(channel)&&!channel.priming)this.pause(channel);
   }
   for(const channel of Object.values(this.channels))if(this.shouldPlay(channel)&&!channel.blocked&&!channel.pending&&!channel.priming&&channel.el.paused)this.play(channel);
  }finally{this.reconciling=false;}
  this.emit();
 }
 private pause(channel:Channel):void {
  if(!channel.el.paused){channel.managerPauses++;channel.cancelledPlay=!!channel.pending;channel.el.pause();}
 }
 private onChannelPlay(channel:Channel):void {
  if(channel.priming)return;
  if(channel.managerPlay){channel.managerPlay=false;return;}
  if(!channel.track||this.destroyed){this.pause(channel);return;}
  // A native control click is itself a gesture. It can replay an ended narration.
  this.unlocked=true;channel.wanted=true;channel.completed=false;channel.blocked=false;channel.error=undefined;
  this.reconcile();
 }
 private play(channel:Channel):void {
  const version=channel.version;channel.managerPlay=true;channel.cancelledPlay=false;
  let playing:Promise<void>;
  try{playing=channel.el.play();}catch(error){playing=Promise.reject(error);}
  channel.pending=Promise.resolve(playing).then(()=>{
   if(this.destroyed||channel.version!==version){if(!this.shouldPlay(channel))this.pause(channel);return;}
   channel.primed=true;channel.blocked=false;channel.error=undefined;
   if(!this.shouldPlay(channel))this.pause(channel);
  }).catch((error:unknown)=>{
   if(this.destroyed||channel.version!==version||!this.shouldPlay(channel)||channel.cancelledPlay)return;
   channel.blocked=true;
   channel.error=error instanceof DOMException&&error.name==='NotAllowedError'?'소리 켜고 관람 버튼을 눌러 주세요.':`${channel.track?.title??'음성 안내'} 재생을 시작하지 못했습니다.`;
   this.pause(channel);
  }).finally(()=>{
   if(channel.version===version){channel.pending=undefined;channel.managerPlay=false;channel.cancelledPlay=false;}
   this.reconcile();
  });
 }
 private prime(channel:Channel):Promise<void> {
  const version=channel.version;const source=channel.track?.src;
  channel.priming=true;channel.el.src=SILENCE;channel.el.muted=false;channel.el.volume=1;
  let playing:Promise<void>;
  try{playing=channel.el.play();}catch(error){playing=Promise.reject(error);}
  const pending=Promise.resolve(playing).then(()=>{
   if(channel.version===version&&!this.destroyed)channel.primed=true;
  }).catch(()=>{/* Only a requested track should expose an autoplay failure. */}).finally(()=>{
   if(channel.version!==version||this.destroyed){if(!this.shouldPlay(channel))this.pause(channel);return;}
   this.pause(channel);channel.priming=false;channel.pending=undefined;
   if(source)channel.el.src=source;else channel.el.removeAttribute('src');
   channel.el.volume=volume(channel.track?.volume,channel.name==='background'?.1:.35);channel.el.muted=this.muted;channel.el.load();
  });
  channel.pending=pending;return pending;
 }
 private applyMediaMute(record:BoundMedia):void {
  const muted=this.muted||record.localMuted||this.sceneMediaSuppressed(record);
  if(record.el.muted===muted)return;
  record.applying=true;record.el.muted=muted;record.applying=false;
 }
 private sceneMediaSuppressed(record:BoundMedia):boolean {
  if(record.scope==='content')return false;
  return this.sceneMediaSuspensions.size>0||this.desired(this.channels.content)||[...this.bound.values()].some(media=>media.scope==='content'&&!media.el.paused&&!media.el.ended&&!media.localMuted&&media.el.volume>0);
 }
 private playBound(record:BoundMedia):void {
  if(this.destroyed||this.hidden||!this.bound.has(record.el))return;
  try{
   void record.el.play().then(()=>{if(this.destroyed||!this.bound.has(record.el)||this.hidden)record.el.pause();}).catch(()=>{
    if(this.destroyed||!this.bound.has(record.el))return;
    record.blocked=true;this.emit();
   });
  }catch{record.blocked=true;this.emit();}
 }
 private removeBound(record:BoundMedia):void {
  for(const cleanup of record.cleanup)cleanup();
  this.bound.delete(record.el);record.el.pause();
 }
 private emit():void {
  if(this.destroyed)return;
  const state=this.state,serialized=JSON.stringify(state);
  if(serialized===this.lastState)return;
  this.lastState=serialized;for(const listener of this.listeners)listener(state);
 }
 private visibilityChanged=():void=>{
  if(this.destroyed)return;
  this.hidden=this.doc?.hidden??false;
  for(const record of this.bound.values()){
   if(this.hidden){record.resumeVisible=!record.el.paused&&!record.el.ended;if(record.resumeVisible)record.el.pause();}
   else if(record.resumeVisible){record.resumeVisible=false;this.playBound(record);}
  }
  this.reconcile();
 };
 private storageChanged=(event:StorageEvent):void=>{
  if(event.key===MUSEUM_AUDIO_STORAGE_KEY){this.muted=event.newValue==='true';this.reconcile();}
 };
}
