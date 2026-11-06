import test from 'node:test';
import assert from 'node:assert/strict';
import {search,getDocument} from '../src/search/client.ts';

test('worker requests resolve by id out of order; errors reject pending requests and allow retry',async()=>{
 const original=globalThis.Worker;
 class FakeWorker{
  static instances:FakeWorker[]=[];messages:any[]=[];onmessage:any;onerror:any;terminated=false;
  constructor(){FakeWorker.instances.push(this);}
  postMessage(message:any){this.messages.push(message);}
  terminate(){this.terminated=true;}
  respond(index:number,value:any){this.onmessage({data:{id:this.messages[index].id,ok:true,value}});}
 }
 globalThis.Worker=FakeWorker as any;
 try{
  const a=search('첫 검색',1),b=search('두 번째',2),worker=FakeWorker.instances[0];
  worker.respond(1,{query:'두 번째'});worker.respond(0,{query:'첫 검색'});
  assert.equal((await a).query,'첫 검색');assert.equal((await b).query,'두 번째');
  const failed=assert.rejects(getDocument('sample'),/불러오지/);
  worker.onerror({preventDefault(){}});await failed;assert.ok(worker.terminated);
  const retry=search('다시',1),replacement=FakeWorker.instances[1];
  replacement.respond(0,{query:'다시'});assert.equal((await retry).query,'다시');
  replacement.onerror({preventDefault(){}});
 }finally{globalThis.Worker=original;}
});
