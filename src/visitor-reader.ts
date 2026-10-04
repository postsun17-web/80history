import type {FullMuseum} from './full-types';
import {sourcePath} from './full-types';
import type {FullRoute} from './full-navigation';
import type {SourceAction} from './source-actions';
import type {VisitorCatalog} from './visitor-catalog';
import './visitor-reader.css';
import {useMediaPreview} from './visitor-media';

import {safeReaderUrl,readerArticlePath} from './visitor-reader-utils';
export class VisitorReader {
 private generation=0;
 constructor(private container:HTMLElement,private data:FullMuseum,private catalog:VisitorCatalog,private callbacks:{navigate:(route:FullRoute)=>void;action:(action:SourceAction)=>void;fontSize:(size:18|21|24)=>void}){}
 async render(route:FullRoute,fontSize:18|21|24):Promise<void>{
  const generation=++this.generation;
  this.container.classList.add('visitor-reader');this.container.style.setProperty('--reader-font-size',`${fontSize}px`);
  this.container.replaceChildren();
  const entry=this.catalog.getReaderEntry(route.scene,route.page);
  const heading=document.createElement('h1');heading.textContent=entry?.title??'역사 자료 읽기';this.container.append(heading);
  const controls=document.createElement('nav');controls.className='visitor-reader-controls';controls.setAttribute('aria-label','읽기 설정');
  const addButton=(parent:HTMLElement,label:string,run:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',run);parent.append(b);return b;};
  addButton(controls,'360° 전시로 돌아가기',()=>{const next={...route,mode:'tour' as const};delete next.exhibit;this.callbacks.navigate(next);});
  for(const size of [18,21,24] as const){const b=addButton(controls,`글자 ${size}`,()=>this.callbacks.fontSize(size));b.setAttribute('aria-pressed',String(size===fontSize));}
  this.container.append(controls);
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='본문을 불러오는 중…';this.container.append(status);
  try{
   const {loadVisitorArticles}=await import('./visitor-articles');const articles=await loadVisitorArticles();if(generation!==this.generation)return;
   status.remove();const direct=readerArticlePath(route.exhibit);const paths=direct?[direct]:entry?.articlePaths??[];
   for(const path of paths){const article=articles[sourcePath(path)];if(!article)continue;
    const section=document.createElement('article');section.className='visitor-reader-article';const h=document.createElement('h2');h.textContent=article.title;section.append(h);
    for(const paragraph of article.paragraphs){const p=document.createElement('p');p.textContent=paragraph;section.append(p);}
    for(const item of article.images){const src=safeReaderUrl(item.src);if(!src)continue;const b=addButton(section,'사진 확대',()=>this.callbacks.action({type:'image',src,title:item.alt||article.title}));const img=document.createElement('img');useMediaPreview(img,src);img.alt=item.alt;img.loading='lazy';b.prepend(img);}
    this.container.append(section);
   }
   if(!paths.some(path=>articles[sourcePath(path)])){const p=document.createElement('p');p.textContent='이 전시는 아래 자료와 원본 전시판에서 확인하실 수 있습니다.';this.container.append(p);}
   const media=document.createElement('section');media.className='visitor-reader-materials';media.setAttribute('aria-label','전시 자료');
   const labels:Record<string,string>={image:'사진',gallery:'사진 모음',video:'영상',youtube:'영상',audio:'음성 안내',object:'유물 360°',document:'기록 문서',books:'전자책',help:'관람 안내',external:'연계 자료',chatbot:'역사 안내',article:'본문'};
   for(const action of entry?.mediaActions??[]){const card=addButton(media,labels[action.type]??'자료 보기',()=>this.callbacks.action(action));const preview=action.type==='image'?(this.data.assets[sourcePath(action.src)]??action.src):action.type==='gallery'?this.data.galleries.find(g=>g.id===action.gallery)?.items[action.index]?.image:undefined;const src=preview?safeReaderUrl(preview):null;if(src){const img=document.createElement('img');useMediaPreview(img,src,true);img.alt='';img.loading='lazy';card.prepend(img);}}
   const scene=this.data.scenes.find(s=>s.id===route.scene);const page=this.data.zones.find(z=>z.id===scene?.zone)?.pages.find(p=>p.number===route.page);
   if(page){const src=safeReaderUrl(page.image);if(src)addButton(media,'원본 전시판 확대',()=>this.callbacks.action({type:'image',src,title:page.title}));}
   this.container.append(media);
  }catch{if(generation!==this.generation)return;status.textContent='본문을 불러오지 못했습니다. 연결을 확인해 주세요.';addButton(this.container,'다시 불러오기',()=>{void this.render(route,fontSize);});addButton(this.container,'현재 화면 새로고침',()=>location.reload());}
 }
 destroy():void{this.generation++;this.container.replaceChildren();}
}
