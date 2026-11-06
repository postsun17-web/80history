import type {SearchDocument,SearchRequest,SearchResponse,WorkerResponse} from './types';

let worker:Worker|undefined,sequence=0;
const pending=new Map<number,{resolve:(value:SearchResponse|SearchDocument)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
function reset(){
 worker?.terminate();worker=undefined;
 for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));}
 pending.clear();
}
function getWorker(){
 if(!worker){
  worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
  const instance=worker;
  worker.onerror=event=>{event.preventDefault();if(worker===instance)reset();};
  worker.onmessage=(event:MessageEvent<WorkerResponse>)=>{
   const response=event.data,request=pending.get(response.id);if(!request)return;
   pending.delete(response.id);clearTimeout(request.timer);
   if(response.ok)request.resolve(response.value);else request.reject(new Error(response.error));
  };
 }
 return worker;
}
function request(payload:Omit<Extract<SearchRequest,{type:'search'}>,'id'>|Omit<Extract<SearchRequest,{type:'document'}>,'id'>):Promise<SearchResponse|SearchDocument>{
 return new Promise((resolve,reject)=>{
  const instance=getWorker(),id=++sequence;
  pending.set(id,{resolve,reject,timer:setTimeout(reset,45000)});
  instance.postMessage({...payload,id});
 });
}
export const search=(query:string,page:number)=>request({type:'search',query,page}) as Promise<SearchResponse>;
export const getDocument=(documentId:string)=>request({type:'document',documentId}) as Promise<SearchDocument>;
