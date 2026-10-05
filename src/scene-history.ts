import type {FullRoute} from './full-navigation.ts';

export type Look=[number,number,number];
export type Snapshot={scene:string;page:number;look:Look};
export type SceneHistoryPort={
 show:(route:FullRoute)=>Promise<void>;
 getLook:()=>Look;
 onCommit:(route:FullRoute)=>void;
 onFailure:(attempt:FullRoute,error:unknown,restored:boolean)=>void;
 onPending?:(route:FullRoute)=>void;
};

function copyRoute(route:FullRoute):FullRoute{
 return {...route,...(route.look?{look:[...route.look] as Look}:{})};
}
function copySnapshot(snapshot:Snapshot):Snapshot{
 return {scene:snapshot.scene,page:snapshot.page,look:[...snapshot.look]};
}
type Intent={route:FullRoute;returnTo?:Snapshot};
type Work={intent:Intent;id:number;resolve:()=>void};

export class SceneHistory{
 private port:SceneHistoryPort;
 private current:FullRoute|undefined;
 private entries:Snapshot[]=[];
 private running=false;
 private revision=0;
 private pending:Work|undefined;
 private departure:FullRoute|undefined;
 private failed:Intent|undefined;
 private settled=true;
 constructor(port:SceneHistoryPort){this.port=port;}
 get committed():FullRoute|undefined{return this.current?copyRoute(this.current):undefined;}
 get busy():boolean{return this.running;}
 previous():Snapshot|undefined{
  const previous=this.entries.at(-1);
  return previous?copySnapshot(previous):undefined;
 }
 request(route:FullRoute):Promise<void>{
  this.failed=undefined;
  return this.enqueue({route:copyRoute(route)});
 }
 back():Promise<void>{
  const returnTo=this.entries.at(-1);
  this.failed=undefined;
  return returnTo?this.enqueue({route:copySnapshot(returnTo),returnTo}):Promise.resolve();
 }
 retry():Promise<void>{
  const intent=this.failed;
  this.failed=undefined;
  return intent?this.enqueue({route:copyRoute(intent.route),returnTo:intent.returnTo}):Promise.resolve();
 }
 private enqueue(intent:Intent):Promise<void>{
  const launch=!this.running;
  if(this.settled){
   this.departure=this.current?{...copyRoute(this.current),look:[...this.port.getLook()]}:undefined;
   this.settled=false;
  }
  this.running=true;
  const result=new Promise<void>(resolve=>{
   this.pending?.resolve();
   this.pending={intent,id:++this.revision,resolve};
  });
  this.port.onPending?.(copyRoute(intent.route));
  if(launch)void this.drain();
  return result;
 }
 private async drain():Promise<void>{
  while(this.pending){
   const work=this.pending;
   this.pending=undefined;
   try{
    await this.port.show(copyRoute(work.intent.route));
   }catch(error){
    if(work.id===this.revision)await this.recover(work,error);
    work.resolve();
    continue;
   }
   if(work.id===this.revision){
    if(work.intent.returnTo){
     if(this.entries.at(-1)===work.intent.returnTo)this.entries.pop();
    }else if(this.departure&&this.departure.scene!==work.intent.route.scene){
     this.entries.push(copySnapshot(this.departure as Snapshot));
     if(this.entries.length>50)this.entries.shift();
    }
    this.current=copyRoute(work.intent.route);
    this.settled=true;
    this.port.onCommit(copyRoute(this.current));
   }
   work.resolve();
  }
  this.running=false;
 }
 private async recover(work:Work,error:unknown):Promise<void>{
  this.failed={route:copyRoute(work.intent.route),returnTo:work.intent.returnTo};
  const fallback=this.departure?copyRoute(this.departure):undefined;
  let restored=false;
  if(fallback){
   try{
    await this.port.show(copyRoute(fallback));
    restored=true;
   }catch{
    // Keep the saved departure when the viewer could not restore it either.
   }
  }
  if(work.id!==this.revision)return;
  if(restored&&fallback){
   this.current=copyRoute(fallback);
   this.settled=true;
   this.port.onCommit(copyRoute(fallback));
   if(work.id!==this.revision)return;
  }else if(!fallback){
   this.settled=true;
  }
  this.port.onFailure(copyRoute(work.intent.route),error,restored);
 }
}
