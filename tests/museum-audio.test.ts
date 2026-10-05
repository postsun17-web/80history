import test from 'node:test';
import assert from 'node:assert/strict';
import {MuseumAudio, MUSEUM_AUDIO_STORAGE_KEY} from '../src/museum-audio.ts';

class Media extends EventTarget {
 src=''; volume=1; muted=false; loop=false; preload=''; controls=false; currentTime=0;
 paused=true; ended=false; playCount=0; loadCount=0; asyncEvents=false;
 emit(type:string):void {if(this.asyncEvents)queueMicrotask(()=>this.dispatchEvent(new Event(type)));else this.dispatchEvent(new Event(type));}
 nextPlay?:()=>Promise<void>;
 play():Promise<void> {
  this.playCount++;this.ended=false;
  const next=this.nextPlay;this.nextPlay=undefined;
  if(next)return next().then(()=>{this.paused=false;this.emit('play');});
  this.paused=false;this.emit('play');return Promise.resolve();
 }
 pause():void {if(!this.paused){this.paused=true;this.emit('pause');}}
 load():void {this.loadCount++;this.paused=true;}
 removeAttribute(name:string):void {if(name==='src')this.src='';}
 finish():void {this.paused=true;this.ended=true;this.dispatchEvent(new Event('ended'));}
 userPause():void {this.pause();}
}
class Visibility extends EventTarget {hidden=false; set(hidden:boolean){this.hidden=hidden;this.dispatchEvent(new Event('visibilitychange'));}}
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function setup(options:{muted?:boolean;brokenStorage?:boolean}={}){
 const media:Media[]=[];const visibility=new Visibility();const values=new Map<string,string>();
 if(options.muted)values.set(MUSEUM_AUDIO_STORAGE_KEY,'true');
 const storage={getItem:(key:string)=>{if(options.brokenStorage)throw Error('denied');return values.get(key)??null;},setItem:(key:string,value:string)=>{if(options.brokenStorage)throw Error('denied');values.set(key,value);}};
 const audio=new MuseumAudio({createAudio:()=>{const el=new Media();media.push(el);return el as unknown as HTMLAudioElement;},document:visibility as unknown as Document,window:null,storage});
 return {audio,media,visibility,values};
}
const track=(name:string)=>({src:`/${name}.mp3`,title:name,volume:.35});

test('entry gesture starts queued background once and preserves original volume',async()=>{
 const {audio,media}=setup();audio.configureBackground({...track('background'),volume:.1});audio.startBackground();
 assert.equal(media[0].playCount,0);await audio.unlock();await settle();
 assert.equal(media[0].paused,false);assert.equal(media[0].volume,.1);assert.equal(media[0].loop,false);
 media[0].finish();audio.setMuted(true);audio.setMuted(false);await audio.unlock();await settle();
 assert.equal(media[0].paused,true);assert.equal(media[0].playCount,1);audio.destroy();
});

test('scene narration replaces previous scene and silent scenes stop it',async()=>{
 const {audio,media}=setup();await audio.unlock();audio.setScene('one',track('one'));await settle();
 assert.equal(media[1].src,'/one.mp3');assert.equal(media[1].paused,false);
 audio.setScene('two',track('two'));await settle();assert.equal(media[1].src,'/two.mp3');
 audio.setScene('silent');await settle();assert.equal(media[1].paused,true);assert.equal(audio.state.playingNarration,undefined);audio.destroy();
});

test('same scene does not restart an already completed narration',async()=>{
 const {audio,media}=setup();audio.setScene('one',track('one'));await audio.unlock();await settle();media[1].finish();
 const before=media[1].playCount;audio.setScene('one',track('one'));await settle();assert.equal(media[1].playCount,before);audio.destroy();
});

test('content narration pauses scene and background then restores eligible playback',async()=>{
 const {audio,media}=setup();audio.configureBackground(track('background'));audio.startBackground();await audio.unlock();
 audio.setScene('room',track('scene'));await settle();assert.equal(media[0].paused,true);assert.equal(media[1].paused,false);
 const content=audio.playNarration(track('content'));assert.equal(content,media[2]);await settle();
 assert.equal(media[1].paused,true);assert.equal(media[2].paused,false);assert.equal(audio.state.playingNarration,'content');
 audio.stopContent();await settle();assert.equal(media[1].paused,false);media[1].finish();await settle();assert.equal(media[0].paused,false);audio.destroy();
});

test('global mute persists and unlock does not overwrite the preference',async()=>{
 const {audio,media,values}=setup({muted:true});audio.configureBackground(track('background'));audio.startBackground();await audio.unlock();
 assert.equal(audio.state.muted,true);assert.equal(media[0].paused,true);
 audio.setMuted(false);await settle();assert.equal(media[0].paused,false);assert.equal(values.get(MUSEUM_AUDIO_STORAGE_KEY),'false');
 audio.toggleMuted();assert.equal(media[0].paused,true);assert.equal(values.get(MUSEUM_AUDIO_STORAGE_KEY),'true');audio.destroy();
});

test('unavailable local storage does not prevent audio or mute controls',async()=>{
 const {audio}=setup({brokenStorage:true});audio.setMuted(true);audio.setMuted(false);await audio.unlock();assert.equal(audio.state.unlocked,true);audio.destroy();
});

test('rejected playback is visible and can be retried with a new gesture',async()=>{
 const {audio,media}=setup();audio.setScene('room',track('narration'));media[1].nextPlay=()=>Promise.reject(new DOMException('Gesture required','NotAllowedError'));
 await audio.unlock();await settle();assert.equal(audio.state.blocked,true);assert.equal(media[1].paused,true);
 await audio.unlock();await settle();assert.equal(audio.state.blocked,false);assert.equal(media[1].paused,false);audio.destroy();
});

test('late successful play cannot revive a narration after leaving the room',async()=>{
 const {audio,media}=setup();let finish!:()=>void;
 audio.setScene('room',track('old'));media[1].nextPlay=()=>new Promise<void>(resolve=>{finish=resolve;});
 const unlocking=audio.unlock();audio.setScene('silent');finish();await unlocking;await settle();
 assert.equal(media[1].paused,true);assert.equal(audio.state.playingNarration,undefined);assert.equal(audio.state.blocked,false);audio.destroy();
});

test('late rejection from an old scene does not block its replacement',async()=>{
 const {audio,media}=setup();let fail!:(error:Error)=>void;
 audio.setScene('old',track('old'));media[1].nextPlay=()=>new Promise<void>((_,reject)=>{fail=reject;});
 const unlocking=audio.unlock();audio.setScene('new',track('new'));await settle();fail(Error('old cancellation'));await unlocking;await settle();
 assert.equal(media[1].src,'/new.mp3');assert.equal(media[1].paused,false);assert.equal(audio.state.blocked,false);audio.destroy();
});

test('a native pause is respected across mute and tab visibility changes',async()=>{
 const {audio,media,visibility}=setup();audio.setScene('room',track('narration'));await audio.unlock();await settle();media[1].userPause();
 visibility.set(true);visibility.set(false);audio.setMuted(true);audio.setMuted(false);await settle();assert.equal(media[1].paused,true);
 await media[1].play();await settle();assert.equal(media[1].paused,false);audio.destroy();
});

test('hidden pages pause audio and resume only current desired tracks',async()=>{
 const {audio,media,visibility}=setup();audio.setScene('room',track('narration'));await audio.unlock();await settle();
 visibility.set(true);assert.equal(media[1].paused,true);audio.setScene('new',track('new'));assert.equal(media[1].paused,true);
 visibility.set(false);await settle();assert.equal(media[1].src,'/new.mp3');assert.equal(media[1].paused,false);audio.destroy();
});

test('only an audible playing video suspends background and scene audio',async()=>{
 const {audio,media}=setup();audio.configureBackground(track('background'));audio.startBackground();await audio.unlock();await settle();
 const video=new Media();const dispose=audio.bindMedia(video as unknown as HTMLVideoElement,{volume:.5,muted:true});await video.play();await settle();
 assert.equal(media[0].paused,false);audio.setMediaAudible(video as unknown as HTMLVideoElement,true);await settle();assert.equal(media[0].paused,true);
 audio.setMuted(true);assert.equal(video.muted,true);audio.setMuted(false);assert.equal(video.muted,false);
 audio.setMediaAudible(video as unknown as HTMLVideoElement,false);await settle();assert.equal(media[0].paused,false);
 dispose();assert.equal(video.paused,true);audio.destroy();
});

test('nested iframe suspensions release independently and never replay finished background',async()=>{
 const {audio,media}=setup();audio.configureBackground(track('background'));audio.startBackground();await audio.unlock();await settle();
 const a=audio.suspend('popup'),b=audio.suspend('popup');assert.equal(media[0].paused,true);a();await settle();assert.equal(media[0].paused,true);
 b();await settle();assert.equal(media[0].paused,false);media[0].finish();const c=audio.suspend('other');c();await settle();assert.equal(media[0].paused,true);audio.destroy();
});

test('media errors are exposed instead of silently swallowing a missing narration',async()=>{
 const {audio,media}=setup();audio.setScene('room',track('missing'));await audio.unlock();await settle();media[1].dispatchEvent(new Event('error'));
 assert.equal(audio.state.blocked,true);assert.match(audio.state.error??'',/missing/);audio.setScene('silent');assert.equal(audio.state.blocked,false);audio.destroy();
});

test('destroy stops tracks and ignores late play completions and visibility events',async()=>{
 const {audio,media,visibility}=setup();let finish!:()=>void;audio.setScene('room',track('scene'));
 media[1].nextPlay=()=>new Promise<void>(resolve=>{finish=resolve;});const unlocking=audio.unlock();audio.destroy();finish();await unlocking;await settle();
 assert.ok(media.every(el=>el.paused));assert.ok(media.every(el=>el.src===''));const count=media.reduce((n,el)=>n+el.playCount,0);
 visibility.set(true);visibility.set(false);await audio.unlock();assert.equal(media.reduce((n,el)=>n+el.playCount,0),count);
});

test('rapid mute toggles retain playback intent with asynchronous native events',async()=>{
 const {audio,media}=setup();for(const el of media)el.asyncEvents=true;
 audio.setScene('room',track('scene'));await audio.unlock();await settle();
 audio.setMuted(true);audio.setMuted(false);audio.setMuted(true);audio.setMuted(false);await settle();
 assert.equal(audio.state.muted,false);assert.equal(media[1].paused,false);assert.equal(audio.state.blocked,false);audio.destroy();
});

test('native narration mute controls use the shared persistent mute preference',async()=>{
 const {audio,media,values}=setup();audio.setScene('room',track('scene'));await audio.unlock();await settle();
 media[1].muted=true;media[1].dispatchEvent(new Event('volumechange'));
 assert.equal(audio.state.muted,true);assert.equal(values.get(MUSEUM_AUDIO_STORAGE_KEY),'true');assert.equal(media[1].paused,true);
 media[1].muted=false;media[1].dispatchEvent(new Event('volumechange'));await settle();
 assert.equal(audio.state.muted,false);assert.equal(media[1].paused,false);audio.destroy();
});

test('opening a dialog suppresses audible wall media and restores its user preference on close',async()=>{
 const {audio,media}=setup();audio.configureBackground(track('background'));audio.startBackground();await audio.unlock();
 const wall=new Media();const remove=audio.bindMedia(wall as unknown as HTMLVideoElement,{muted:false});await wall.play();await settle();
 assert.equal(media[0].paused,true);const close=audio.suspendSceneMedia();await settle();
 assert.equal(wall.muted,true);assert.equal(wall.paused,false);assert.equal(media[0].paused,false);
 close();await settle();assert.equal(wall.muted,false);assert.equal(media[0].paused,true);remove();audio.destroy();
});

test('content narration has priority over an already audible wall video',async()=>{
 const {audio,media}=setup();await audio.unlock();const wall=new Media();
 audio.bindMedia(wall as unknown as HTMLVideoElement,{muted:false});await wall.play();
 audio.playNarration(track('content'));await settle();
 assert.equal(wall.muted,true);assert.equal(media[2].paused,false);
 audio.stopContent();await settle();assert.equal(wall.muted,false);audio.destroy();
});

test('a modal video cannot overlap the wall audio and remains governed by global mute',async()=>{
 const {audio}=setup();await audio.unlock();const wall=new Media(),modal=new Media();
 audio.bindMedia(wall as unknown as HTMLVideoElement,{muted:false,scope:'scene'});await wall.play();
 const close=audio.suspendSceneMedia();const remove=audio.bindMedia(modal as unknown as HTMLVideoElement,{muted:false,scope:'content'});await modal.play();await settle();
 assert.equal(wall.muted,true);assert.equal(modal.muted,false);
 audio.setMuted(true);assert.equal(wall.muted,true);assert.equal(modal.muted,true);
 audio.setMuted(false);assert.equal(wall.muted,true);assert.equal(modal.muted,false);
 remove();close();await settle();assert.equal(wall.muted,false);assert.equal(modal.paused,true);audio.destroy();
});

test('nested dialog media suppression releases independently and does not unmute a user-muted wall',async()=>{
 const {audio}=setup();const wall=new Media();audio.bindMedia(wall as unknown as HTMLVideoElement,{muted:true});await wall.play();
 const a=audio.suspendSceneMedia(),b=audio.suspendSceneMedia();a();assert.equal(wall.muted,true);b();assert.equal(wall.muted,true);
 const c=audio.suspendSceneMedia();audio.setMediaAudible(wall as unknown as HTMLVideoElement,true);assert.equal(wall.muted,true);c();assert.equal(wall.muted,false);audio.destroy();
});
