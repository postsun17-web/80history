import {createSearchIndex,searchDocuments} from './engine';
import type {SearchDocument,SearchRequest,WorkerResponse} from './types';
// This module is itself a separate worker bundle; no document text enters the museum entry bundle.
import corpus from './corpus.json';

const documents=corpus.documents as SearchDocument[];
const index=createSearchIndex(documents);
const byId=new Map(documents.map(document=>[document.id,document]));
self.onmessage=(event:MessageEvent<SearchRequest>)=>{
 const request=event.data;let response:WorkerResponse;
 try{
  const value=request.type==='search'?searchDocuments(index,request.query,request.page):byId.get(request.documentId);
  if(!value)throw new Error('자료를 찾을 수 없습니다. 검색 결과에서 다시 선택해 주세요.');
  response={id:request.id,ok:true,value};
 }catch(error){response={id:request.id,ok:false,error:error instanceof Error?error.message:'검색 중 오류가 발생했습니다.'};}
 self.postMessage(response);
};
