import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {FullRoute} from '../src/full-navigation.ts';
import {SceneHistory,type Look} from '../src/scene-history.ts';

const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function viewer(){
 const calls:{route:FullRoute;resolve:()=>void;reject:(error:unknown)=>void}[]=[];
 const commits:FullRoute[]=[];
 const failures:{attempt:FullRoute;error:unknown;restored:boolean}[]=[];
 const events:string[]=[];
 let look:Look=[0,0,100];
 const history=new SceneHistory({
  show:route=>{
   events.push('show');
   return new Promise<void>((resolve,reject)=>calls.push({route,resolve,reject}));
  },
  getLook:()=>{events.push('getLook');return look;},
  onPending:()=>events.push('pending'),
  onCommit:route=>{events.push('commit');commits.push(route);},
  onFailure:(attempt,error,restored)=>{events.push('failure');failures.push({attempt,error,restored});},
 });
 const finish=async(index=calls.length-1)=>{assert.ok(calls[index]);calls[index].resolve();await flush();};
 const fail=async(error:unknown,index=calls.length-1)=>{assert.ok(calls[index]);calls[index].reject(error);await flush();};
 const go=async(route:FullRoute)=>{const result=history.request(route);await finish();await result;};
 return {history,calls,commits,failures,events,finish,fail,go,setLook:(value:Look)=>{look=value;}};
}

test('initial loading creates no previous location', async () => {
 const commits:FullRoute[]=[];
 const history=new SceneHistory({
  show:async()=>{},getLook:()=>[12,3,80],onCommit:route=>commits.push(route),onFailure:()=>{},
 });
 await history.request({scene:'A',page:1});
 assert.equal(history.previous(),undefined);
 assert.deepEqual(history.committed,{scene:'A',page:1});
 assert.deepEqual(commits,[{scene:'A',page:1}]);
 assert.equal(history.busy,false);
});

test('queued requests show serially and only the latest success records the original departure',async()=>{
 const v=viewer();
 await v.go({scene:'A',page:2});
 v.setLook([32,-6,75]);
 const b=v.history.request({scene:'B',page:1});
 v.setLook([200,40,120]);
 const skipped=v.history.request({scene:'skipped',page:1});
 const c=v.history.request({scene:'C',page:3});
 assert.equal(v.calls.length,2,'the viewer must never receive concurrent show calls');
 assert.equal(v.history.busy,true);
 await v.finish(1);
 assert.deepEqual(v.calls.map(call=>call.route.scene),['A','B','C']);
 assert.deepEqual(v.commits.map(route=>route.scene),['A']);
 assert.equal(v.history.previous(),undefined);
 await v.finish(2);
 await Promise.all([b,skipped,c]);
 assert.deepEqual(v.history.previous(),{scene:'A',page:2,look:[32,-6,75]});
 assert.deepEqual(v.history.committed,{scene:'C',page:3});
 assert.deepEqual(v.commits.map(route=>route.scene),['A','C']);
 assert.equal(v.history.busy,false);
});

test('page and popup commits preserve C02 page five and its live look for the next return',async()=>{
 const v=viewer();
 await v.go({scene:'scene_c-s-e+1',page:1,look:[90,0,105]});
 await v.go({scene:'scene_c-s-e+1',page:5});
 await v.go({scene:'scene_c-s-e+1',page:5,exhibit:'photo'});
 assert.equal(v.history.previous(),undefined,'page and popup changes do not create spatial history');
 v.setLook([123,-11,65]);
 v.events.length=0;
 const outgoing=v.history.request({scene:'B',page:1});
 assert.deepEqual(v.events,['getLook','pending','show'],'capture must precede any viewer/UI mutation');
 await v.finish();
 await outgoing;
 assert.deepEqual(v.history.previous(),{scene:'scene_c-s-e+1',page:5,look:[123,-11,65]});
 const returning=v.history.back();
 assert.deepEqual(v.calls.at(-1)?.route,{scene:'scene_c-s-e+1',page:5,look:[123,-11,65]});
 assert.ok(v.history.previous(),'return history is consumed only after the viewer succeeds');
 await v.finish();
 await returning;
 assert.deepEqual(v.history.committed,{scene:'scene_c-s-e+1',page:5,look:[123,-11,65]});
 assert.equal(v.history.previous(),undefined);
});

test('a failed return restores the last good view and retry consumes the same previous location',async()=>{
 const v=viewer();
 await v.go({scene:'A',page:4});
 v.setLook([45,-8,70]);
 await v.go({scene:'B',page:2});
 v.setLook([125,9,90]);
 const returning=v.history.back();
 const error=new Error('return unavailable');
 await v.fail(error);
 assert.deepEqual(v.calls.at(-1)?.route,{scene:'B',page:2,look:[125,9,90]});
 assert.deepEqual(v.history.previous(),{scene:'A',page:4,look:[45,-8,70]});
 await v.finish();
 await returning;
 assert.deepEqual(v.history.committed,{scene:'B',page:2,look:[125,9,90]});
 assert.deepEqual(v.events.slice(-2),['commit','failure']);
 assert.deepEqual(v.failures,[{attempt:{scene:'A',page:4,look:[45,-8,70]},error,restored:true}]);
 const retry=v.history.retry();
 assert.deepEqual(v.calls.at(-1)?.route,{scene:'A',page:4,look:[45,-8,70]});
 assert.ok(v.history.previous());
 await v.finish();
 await retry;
 assert.equal(v.history.previous(),undefined);
 assert.deepEqual(v.history.committed,{scene:'A',page:4,look:[45,-8,70]});
});

test('a failed forward move never adds history and a new request clears its retry',async()=>{
 const v=viewer();
 await v.go({scene:'A',page:5,exhibit:'old-popup'});
 v.setLook([100,-3,60]);
 const failed=v.history.request({scene:'B',page:1});
 await v.fail(new Error('B unavailable'));
 assert.deepEqual(v.calls.at(-1)?.route,{scene:'A',page:5,exhibit:'old-popup',look:[100,-3,60]});
 await v.finish();
 await failed;
 assert.equal(v.history.previous(),undefined);
 assert.equal(v.failures.at(-1)?.restored,true);
 await v.go({scene:'C',page:1});
 const count=v.calls.length;
 await v.history.retry();
 assert.equal(v.calls.length,count,'a new request must clear an unrelated failed destination');
 assert.equal(v.history.previous()?.scene,'A');
});

for(const completion of ['success','failure'] as const){
 test(`a superseded return ${completion} cannot consume history or replace the new destination`,async()=>{
  const v=viewer();
  await v.go({scene:'A',page:1});
  v.setLook([10,0,100]);
  await v.go({scene:'B',page:2});
  v.setLook([20,1,80]);
  const returning=v.history.back();
  const onward=v.history.request({scene:'C',page:3});
  assert.equal(v.calls.length,3);
  if(completion==='success')await v.finish(2);
  else await v.fail(new Error('superseded return'),2);
  assert.equal(v.history.previous()?.scene,'A');
  assert.deepEqual(v.commits.map(route=>route.scene),['A','B']);
  assert.equal(v.failures.length,0);
  assert.deepEqual(v.calls.map(call=>call.route.scene),['A','B','A','C']);
  await v.finish(3);
  await Promise.all([returning,onward]);
  assert.deepEqual(v.history.previous(),{scene:'B',page:2,look:[20,1,80]});
  const back=v.history.back();
  await v.finish();
  await back;
  assert.equal(v.history.previous()?.scene,'A','the stale return must leave the older entry intact');
 });

 test(`a superseded rollback ${completion} cannot publish stale callbacks`,async()=>{
  const v=viewer();
  await v.go({scene:'A',page:1});
  await v.go({scene:'B',page:2});
  v.setLook([33,4,70]);
  const returning=v.history.back();
  await v.fail(new Error('return unavailable'),2);
  assert.equal(v.calls.length,4,'failure must begin a serial rollback');
  const onward=v.history.request({scene:'C',page:3});
  v.setLook([300,40,110]);
  if(completion==='success')await v.finish(3);
  else await v.fail(new Error('rollback unavailable'),3);
  assert.deepEqual(v.commits.map(route=>route.scene),['A','B']);
  assert.equal(v.failures.length,0);
  assert.equal(v.calls[4].route.scene,'C');
  await v.finish(4);
  await Promise.all([returning,onward]);
  assert.deepEqual(v.history.previous(),{scene:'B',page:2,look:[33,4,70]});
  assert.equal(v.history.committed?.scene,'C');
 });
}

test('a failed rollback leaves the return available for retry',async()=>{
 const v=viewer();
 await v.go({scene:'A',page:1});
 await v.go({scene:'B',page:1});
 const returning=v.history.back();
 const error=new Error('return unavailable');
 await v.fail(error);
 assert.equal(v.calls.at(-1)?.route.scene,'B');
 await v.fail(new Error('rollback unavailable'));
 await returning;
 assert.equal(v.failures.at(-1)?.error,error);
 assert.equal(v.failures.at(-1)?.restored,false);
 assert.equal(v.history.previous()?.scene,'A');
 assert.equal(v.history.busy,false);
 const retry=v.history.retry();
 assert.equal(v.calls.at(-1)?.route.scene,'A');
 await v.finish();
 await retry;
 assert.equal(v.history.previous(),undefined);
 assert.equal(v.history.committed?.scene,'A');
});

test('a failed initial load is retryable without inventing a rollback location',async()=>{
 const v=viewer();
 const initial=v.history.request({scene:'A',page:3});
 await v.fail(new Error('initial unavailable'));
 await initial;
 assert.equal(v.calls.length,1);
 assert.equal(v.failures.at(-1)?.restored,false);
 assert.equal(v.history.committed,undefined);
 const retry=v.history.retry();
 await v.finish();
 await retry;
 assert.deepEqual(v.history.committed,{scene:'A',page:3});
 assert.equal(v.history.previous(),undefined);
});

test('only the most recent fifty departures remain reachable',async()=>{
 const v=viewer();
 for(let index=0;index<=52;index++)await v.go({scene:`scene-${index}`,page:1});
 const returned:string[]=[];
 while(v.history.previous()){
  const returning=v.history.back();
  await v.finish();
  await returning;
  returned.push(v.history.committed!.scene);
 }
 assert.equal(returned.length,50);
 assert.equal(returned[0],'scene-51');
 assert.equal(returned.at(-1),'scene-2');
 const count=v.calls.length;
 await v.history.back();
 assert.equal(v.calls.length,count);
});

test('caller, viewer and callback mutations cannot change saved routes or views',async()=>{
 const v=viewer();
 const route:FullRoute={scene:'A',page:5,look:[12,3,80],exhibit:'photo'};
 const first=v.history.request(route);
 route.scene='mutated';
 route.look![0]=999;
 v.calls[0].route.look![1]=999;
 await v.finish();
 await first;
 assert.deepEqual(v.history.committed,{scene:'A',page:5,look:[12,3,80],exhibit:'photo'});
 v.commits[0].look![2]=999;
 v.history.committed!.look![0]=999;
 assert.deepEqual(v.history.committed?.look,[12,3,80]);
 const live:Look=[22,-4,60];
 v.setLook(live);
 const onward=v.history.request({scene:'B',page:1});
 live[0]=999;
 await v.finish();
 await onward;
 v.history.previous()!.look[1]=999;
 const returning=v.history.back();
 assert.deepEqual(v.calls.at(-1)?.route,{scene:'A',page:5,look:[22,-4,60]});
 await v.finish();
 await returning;
 assert.deepEqual(v.history.committed,{scene:'A',page:5,look:[22,-4,60]});
});
