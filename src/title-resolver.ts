import type {FullMuseum} from './full-types';
import type {SourceAction} from './source-actions';

export interface ReviewedTitle {title:string;sources:string[];reason:string;matte?:'dark'|'contrast'}
export interface TitleCatalogue {
 schemaVersion:1;
 pages:Record<string,ReviewedTitle>;
 articles:Record<string,ReviewedTitle>;
 images:Record<string,ReviewedTitle>;
 galleries:Record<string,ReviewedTitle>;
}

/** A source path and its deployed WebP refer to the same unmodified content.
 * URI decoding deliberately preserves literal '+' in filenames and titles. */
export function contentKey(value:string):string {
 let path=value.replace(/%(?:FIRSTXML|VIEWER|CURRENTXML)%\/?/gi,'').replace(/^\.\//,'');
 if(/^https?:\/\//i.test(path)){
  try{path=new URL(path).pathname;}catch{return value;}
 }
 path=path.split(/[?#]/)[0].replace(/^\/media\/full\//,'');
 try{path=decodeURIComponent(path);}catch{/* Retain malformed input as an unknown key. */}
 return path.replace(/(\.(?:png|jpe?g|gif|bmp))\.webp$/i,'$1');
}

/** Build once; original museum data, source labels and room names stay intact. */
export function createContentTitles(data:FullMuseum,catalogue:TitleCatalogue){
 const images=new Map<string,ReviewedTitle>();
 const originalPages=new Map<string,string>();
 const originalGallery=new Map<string,string>();
 for(const gallery of data.galleries)for(const item of gallery.items){
  originalGallery.set(item.id,item.title);
  const reviewed=catalogue.galleries[item.id];
  if(reviewed&&!images.has(contentKey(item.image)))images.set(contentKey(item.image),reviewed);
 }
 for(const zone of data.zones)for(const page of zone.pages){
  const id=`${zone.id}:${page.number}`;
  originalPages.set(id,page.title);
  const reviewed=catalogue.pages[id];if(reviewed)images.set(contentKey(page.image),reviewed);
 }
 for(const [path,entry] of Object.entries(catalogue.images))images.set(contentKey(path),entry);
 // Source article image links may use the original path instead of the packed gallery path.
 for(const [path,url] of Object.entries(data.assets)){
  const reviewed=images.get(contentKey(url));if(reviewed)images.set(contentKey(path),reviewed);
 }
 const fallback=(value:unknown,otherwise:string)=>typeof value==='string'&&value.trim()?value:otherwise;
 const resolver={
  page:(zone:string,page:number)=>catalogue.pages[`${zone}:${page}`]?.title??fallback(originalPages.get(`${zone}:${page}`),'전시 자료'),
  image:(src:string,title?:string)=>images.get(contentKey(src))?.title??fallback(title,'전시 자료'),
  matte:(src:string):'ivory'|'dark'|'contrast'=>images.get(contentKey(src))?.matte??'ivory',
  article:(path:string)=>catalogue.articles[contentKey(path)]?.title??fallback(data.articles[contentKey(path)]?.title,'역사 자료'),
  gallery:(id:string)=>catalogue.galleries[id]?.title??fallback(originalGallery.get(id),'사진 자료'),
  action:<T extends SourceAction>(action:T):T=>action.type==='image'?{...action,title:resolver.image(action.src,action.title)}:action,
 };
 return resolver;
}
