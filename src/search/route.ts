import catalogue from './catalogue.json' with {type:'json'};
import type {SearchAction} from './types.ts';

const documents=new Map(catalogue.documents.map(document=>[document.id,document.paragraphCount]));
export const emptySearch=():SearchAction=>({type:'search',query:'',resultPage:1});
export function safeSearchAction(value:Record<string,unknown>):SearchAction|null{
 if(typeof value.query!=='string'||[...value.query].length>200||/[\u0000-\u001f]/u.test(value.query.replace(/[\t\n\r]/g,'')))return null;
 if(!Number.isSafeInteger(value.resultPage)||Number(value.resultPage)<1)return null;
 const action:SearchAction={type:'search',query:value.query.normalize('NFC').replace(/\s+/gu,' ').trim(),resultPage:Number(value.resultPage)};
 if(value.documentId!==undefined){
  if(typeof value.documentId!=='string'||!documents.has(value.documentId))return null;
  action.documentId=value.documentId;
 }
 if(value.paragraphId!==undefined){
  if(!action.documentId||typeof value.paragraphId!=='string'||!/^p[1-9]\d*$/.test(value.paragraphId))return null;
  const number=Number(value.paragraphId.slice(1));if(!Number.isSafeInteger(number)||number>documents.get(action.documentId)!)return null;
  action.paragraphId=value.paragraphId;
 }
 return action;
}
