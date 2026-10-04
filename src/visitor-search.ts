import type {FullRoute} from './full-navigation.ts';
import type {VisitorEntry} from './visitor-catalog.ts';
import type {VisitorArticle} from './visitor-articles.ts';
export interface SearchResult {entryId:string;title:string;locationLabel:string;snippet:string;route:FullRoute;kind:string}
export function searchEntries(query:string,entries:VisitorEntry[],articles:Record<string,VisitorArticle>,filters:{room?:string;kind?:string}={}):SearchResult[]{
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);if(!terms.length)return [];
 const seen=new Set<string>();
 return entries.flatMap((entry,index)=>{
  if((filters.room&&entry.room!==filters.room)||(filters.kind&&entry.kind!==filters.kind)||seen.has(entry.id))return [];seen.add(entry.id);
  const article=entry.sourceAction.type==='article'?articles[entry.sourceAction.path]:undefined;
  const body=article?.paragraphs.join(' ')??'',title=entry.title,text=(title+' '+body).toLocaleLowerCase();if(!terms.every(term=>text.includes(term)))return [];
  const position=Math.max(0,body.toLocaleLowerCase().indexOf(terms[0])),start=Math.max(0,position-35);
  const snippet=body?`${start?'…':''}${body.slice(start,start+160)}${body.length>start+160?'…':''}`:title;
  const route:FullRoute={scene:entry.scene,page:entry.page,mode:'read',...(entry.look?{look:entry.look}:{})};
  if(!['scene','exhibit'].includes(entry.kind))route.exhibit=JSON.stringify(entry.sourceAction);
  return [{index,score:terms.reduce((n,t)=>n+(title.toLocaleLowerCase().includes(t)?10:1),0),result:{entryId:entry.id,title,locationLabel:({lobby:'로비',a:'A실',b:'B실',c:'C실',d:'D실',e:'E실 · 확장 전시실',outside:'야외',other:'전체 자료'} as Record<string,string>)[entry.room]??entry.room,snippet,route,kind:entry.kind}}];
 }).sort((a,b)=>b.score-a.score||a.index-b.index).map(item=>item.result);
}
