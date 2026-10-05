import type {FullMuseum} from './full-types';
import type {FullRoute} from './full-navigation';
import type {SourceAction} from './source-actions';
import {exhibitImageContext} from './content-sequence.ts';

/** Route content contains identifiers, never executable source or arbitrary remote media. */
export function safeContentAction(data:FullMuseum,value:string):SourceAction|null{
 if(['books','chatbot','help'].includes(value))return {type:value} as SourceAction;
 try{
  const a=JSON.parse(value);
  if(!a||typeof a!=='object')return null;
  const local=(src:unknown):src is string=>{
   if(typeof src!=='string'||src.length>2048||/[\\\x00-\x1f]/.test(src))return false;
   let decoded:string;try{decoded=decodeURIComponent(src);}catch{return false;}
   if(decoded.split(/[/?#]/).includes('..')||decoded.includes('\\'))return false;
   return /^(?:\/media\/(?:full|memorial|v1)\/|images\/|img\/|mov\/|mp3\/|info\/|photo\/)/.test(src);
  };
  const knownAudio=(src:unknown)=>typeof src==='string'&&(/\.mp3$/i.test(src))&&(data.assets[src]||Object.values(data.assets).includes(src))&&local(src)?src:undefined;
  if(a.type==='gallery'&&data.galleries.some(g=>g.id===a.gallery)&&Number.isInteger(a.index))return {type:'gallery',gallery:a.gallery,index:a.index};
  if(a.type==='article'&&typeof a.path==='string'&&data.articles[a.path])return {type:'article',path:a.path};
  if(a.type==='document'&&typeof a.src==='string'&&/^photo\/[\w/-]+\.pdf$/.test(a.src))return {type:'document',src:a.src};
  if(a.type==='youtube'&&typeof a.id==='string'&&/^[\w-]{11}$/.test(a.id))return {type:'youtube',id:a.id};
  if(a.type==='books'||a.type==='chatbot')return {type:a.type};
  if(a.type==='help')return {type:'help',...(knownAudio(a.audio)?{audio:a.audio}:{}),...(Number.isInteger(a.index)?{index:a.index}:{})};
  if(a.type==='object'){
   if(typeof a.folder==='string'&&/^ovr\/\d+$/.test(a.folder))return {type:'object',folder:a.folder,...(Number.isInteger(a.frames)&&a.frames>0&&a.frames<=360?{frames:a.frames}:{})};
   if(typeof a.url==='string'&&/^https:\/\/(?:www\.)?spinzam\.com\//.test(a.url))return {type:'object',url:a.url};
  }
  if(a.type==='image'&&local(a.src))return {type:'image',src:a.src,...(typeof a.title==='string'?{title:a.title}:{}),...(knownAudio(a.audio)?{audio:a.audio}:{}),...(typeof a.article==='string'&&data.articles[a.article]?{article:a.article}:{})};
  if((a.type==='video'||a.type==='audio')&&local(a.src))return {type:a.type,src:a.src};
 }catch{/* Invalid or stale content keeps the visitor in the room. */}
 return null;
}

/** The shown panel is authoritative when an old share URL has a stale page or room. */
export function normalizeContentRoute(data:FullMuseum,route:FullRoute):FullRoute{
 if(!route.exhibit)return route;
 const action=safeContentAction(data,route.exhibit);
 if(action?.type!=='image'||action.article)return route;
 const context=exhibitImageContext(data,action.src);if(!context)return route;
 const current=data.scenes.find(scene=>scene.id===route.scene);
 const scene=current?.zone===context.zone.id?current:data.scenes.find(scene=>scene.id===context.zone.scene);
 if(!scene)return route;
 return {...route,scene:scene.id,page:context.page.number,...(scene.id===route.scene?{}:{look:scene.view})};
}
