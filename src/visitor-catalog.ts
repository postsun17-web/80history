import articleIndex from './data/visitor-article-index.json' with {type:'json'};
import type {FullMuseum} from './full-types.ts';
import {assetUrl} from './full-types.ts';
import {decodeAction} from './source-actions.ts';
import type {SourceAction} from './source-actions.ts';
export interface VisitorEntry {id:string;title:string;scene:string;page:number;room:string;kind:string;sourceAction:SourceAction;look?:[number,number,number];thumbnail?:string}
export interface ReaderEntry {id:string;title:string;scene:string;page:number;articlePaths:string[];mediaActions:SourceAction[]}
export interface VisitorCatalog {entries:VisitorEntry[];rooms:{id:string;title:string;scene:string}[];courses:{id:string;title:string;description:string;entryIds:string[]}[];getEntry(scene:string,page:number):VisitorEntry|undefined;getRoomEntries(roomId:string):VisitorEntry[];getAdjacentExhibit(entryId:string,direction:'previous'|'next'):VisitorEntry|undefined;getReaderEntry(scene:string,page:number):ReaderEntry|undefined}
const roomOf=(scene:string)=>/^scene_([a-e])-/i.exec(scene)?.[1].toLowerCase()??(/^scene_f-/i.test(scene)?'lobby':scene==='scene_vr02'?'outside':'other');
export function createVisitorCatalog(data:FullMuseum):VisitorCatalog {
 const entries:VisitorEntry[]=[], readers=new Map<string,ReaderEntry>(), materialKeys=new Set<string>();
 const menus=data.menus.flatMap(menu=>menu.items),orderedZones=[...data.zones].sort((a,b)=>{
  const index=(scene:string)=>{const n=menus.findIndex(item=>item.scene===scene);return n<0?999:n;};return index(a.scene)-index(b.scene);
 });
 const actions=(hotspots:{attrs:Record<string,string>}[])=>hotspots.map(h=>{const attrs={...Object.assign({},...(h.attrs.style??'').split('|').map(style=>data.styles[style]??{})),...h.attrs};return {action:attrs.videourl&&attrs.html5controls==='true'?decodeAction(`videoplayer_open('${attrs.videourl}');`):(decodeAction(attrs.onclick??'')??decodeAction(attrs.onloaded??'')),title:attrs.title??attrs.tooltip??attrs.text??''};}).filter(x=>x.action!==null);
 function material(action:SourceAction,title:string,base:VisitorEntry){
  if(action.type==='scene'||action.type==='page')return;
  const key=JSON.stringify(action),contextKey=`${base.scene}:${base.page}:${key}`;if(materialKeys.has(contextKey))return;materialKeys.add(contextKey);
  const article=action.type==='article'?data.articles[action.path]:undefined;
  entries.push({...base,id:'material:'+contextKey,kind:action.type,sourceAction:action,title:title||article?.title||('title' in action?action.title:undefined)||base.title,thumbnail:action.type==='image'?assetUrl(action.src):undefined});
 }
 function add(base:VisitorEntry,hotspots:{attrs:Record<string,string>}[]){
  entries.push(base);const items=Array.from(new Map(actions(hotspots).map(item=>[JSON.stringify(item.action),item])).values());
  readers.set(base.id,{id:base.id,title:base.title,scene:base.scene,page:base.page,articlePaths:items.flatMap(x=>x.action!.type==='article'?[x.action!.path]:[]),mediaActions:items.flatMap(x=>['scene','page','article'].includes(x.action!.type)?[]:[x.action!])});
  items.forEach(x=>material(x.action!,x.title,base));
 }
 for(const zone of orderedZones){const menu=menus.find(m=>m.scene===zone.scene);for(const page of zone.pages)add({id:`page:${zone.id}:${page.number}`,title:page.title||zone.title,scene:zone.scene,page:page.number,room:roomOf(zone.scene),kind:'exhibit',sourceAction:{type:'page',zone:zone.id,page:page.number},look:menu?.look,thumbnail:assetUrl(page.image)},[...(data.scenes.find(scene=>scene.id===zone.scene)?.hotspots??[]),...page.hotspots]);}
 for(const scene of data.scenes){const menu=menus.find(m=>m.scene===scene.id);const base={id:'scene:'+scene.id,title:menu?.title||scene.title,scene:scene.id,page:1,room:roomOf(scene.id),kind:'scene',sourceAction:{type:'scene',scene:scene.id} as SourceAction,look:menu?.look??scene.view};add(base,scene.hotspots);}
 for(const item of [...menus,...(data.quickMenu??[]),...(data.mediaSections??[]).flatMap(section=>section.items)]){const action=decodeAction(item.action??(item.url?`openurl('${item.url}');`:''));if(action){const base=entries.find(e=>e.scene===item.scene)??entries.find(e=>e.room==='lobby')??entries[0];material(action,item.title,base);}}
 for(const [path,article] of Object.entries({...articleIndex,...data.articles})){if(entries.some(entry=>entry.sourceAction.type==='article'&&entry.sourceAction.path===path))continue;material({type:'article',path},article.title,{id:'',title:article.title,scene:data.scenes[0].id,page:1,room:'other',kind:'article',sourceAction:{type:'article',path}});}
 const rooms=[['lobby','로비'],['a',data.menus[1]?.title||'A실'],['b',data.menus[2]?.title||'B실'],['c',data.menus[3]?.title||'C실'],['d',data.menus[4]?.title||'D실'],['e','E실 · 확장 전시실'],['outside','야외'],['other','전체 자료']].map(([id,title])=>({id,title,scene:entries.find(e=>e.room===id)?.scene??data.scenes[0].id}));
 const exhibitStarts=orderedZones.map(z=>entries.find(e=>e.id===`page:${z.id}:1`)!).filter(Boolean);
 const courses=[{id:'core',title:'핵심 관람 · 5–10분',description:'각 전시실의 주요 전시를 순서대로 둘러봅니다.',entryIds:['a','b','c','d'].map(room=>exhibitStarts.find(e=>e.room===room)?.id).filter((id):id is string=>!!id)},{id:'history',title:'역사 순서로 보기',description:data.menus[1]?.title??'A실 역사 전시',entryIds:exhibitStarts.filter(e=>e.room==='a').map(e=>e.id)},{id:'photos',title:'사진 자료 보기',description:'전시의 사진 자료를 살펴봅니다.',entryIds:entries.filter(e=>e.kind==='gallery'&&['a','b','c','d'].includes(e.room)).map(e=>e.id)}];
 const getEntry=(scene:string,page:number)=>entries.find(e=>e.scene===scene&&e.page===page&&e.kind==='exhibit')??entries.find(e=>e.scene===scene&&e.kind==='scene');
 return {entries,rooms,courses,getEntry,getRoomEntries:room=>entries.filter(e=>e.room===room),getAdjacentExhibit:(id,direction)=>{const entry=entries.find(e=>e.id===id);if(!entry)return;const zone=data.scenes.find(s=>s.id===entry.scene)?.zone;const index=exhibitStarts.findIndex(e=>e.scene===entry.scene);if(index<0||!zone)return;return exhibitStarts[index+(direction==='next'?1:-1)];},getReaderEntry:(scene,page)=>{const entry=getEntry(scene,page);return entry?readers.get(entry.id):undefined;}};
}
