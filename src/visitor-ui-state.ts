import type {SourceAction} from './source-actions.ts';
/** Keep a direct article only underneath a real temporary media overlay. */
export function readerArticleForRoute(previous:string,exhibit:string|undefined,action:SourceAction|null):string {
 if(!action)return '';
 return action.type==='article'?exhibit??'':previous;
}
/** Install navigation prevention before asynchronous search data becomes available. */
export function bindDeferredSearch(form:EventTarget):{ready:(search:()=>void)=>void} {
 let run:(()=>void)|undefined;
 form.addEventListener('submit',event=>{event.preventDefault();run?.();});
 return {ready(search){run=search;search();}};
}
