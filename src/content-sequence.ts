import type {ExhibitPage,ExhibitZone,FullMuseum} from './full-types';
import type {SourceAction} from './source-actions';
import {contentKey} from './title-resolver.ts';

type ImageAction=Extract<SourceAction,{type:'image'}>;
export interface ImageSequence {items:ImageAction[];index:number}
export interface ArticleImageLink {src:string;title?:string}
type ExhibitContext={zone:ExhibitZone;page:ExhibitPage};
const indexes=new WeakMap<FullMuseum,{aliases:Map<string,string>;pages:Map<string,ExhibitContext>}>();

function indexFor(data:FullMuseum){
 let index=indexes.get(data);if(index)return index;
 const aliases=new Map(Object.entries(data.assets).map(([path,url])=>[contentKey(path),contentKey(url)]));
 const pages=new Map<string,ExhibitContext>();
 for(const zone of data.zones)for(const page of zone.pages)pages.set(contentKey(page.image),{zone,page});
 index={aliases,pages};indexes.set(data,index);return index;
}
function imageKey(data:FullMuseum,src:string):string {
 const key=contentKey(src);return indexFor(data).aliases.get(key)??key;
}
/** Match source paths and deployed aliases without decoding literal '+' as whitespace. */
export function exhibitImageContext(data:FullMuseum,src:string):ExhibitContext|undefined {
 return indexFor(data).pages.get(imageKey(data,src));
}
export function imageSequence(data:FullMuseum,action:ImageAction):ImageSequence {
 const context=exhibitImageContext(data,action.src);
 if(!context||action.article)return {items:[action],index:0};
 return {items:context.zone.pages.map(page=>({type:'image',src:page.image,title:page.title})),index:context.zone.pages.indexOf(context.page)};
}
/** The caller supplies safe linked images in article DOM order. Never infer unrelated siblings. */
export function articleImageSequence(data:FullMuseum,action:ImageAction,links:ArticleImageLink[]):ImageSequence {
 const seen=new Set<string>(),items:ImageAction[]=[];
 for(const link of links){
  const key=imageKey(data,link.src);if(seen.has(key))continue;seen.add(key);
  items.push({type:'image',src:link.src,title:link.title??'본문 이미지',article:action.article});
 }
 const index=items.findIndex(item=>imageKey(data,item.src)===imageKey(data,action.src));
 return index<0?{items:[action],index:0}:{items,index};
}
export function sequenceAction(sequence:ImageSequence,offset:number):ImageAction|undefined {
 const index=sequence.index+offset;return index>=0&&index<sequence.items.length?sequence.items[index]:undefined;
}
