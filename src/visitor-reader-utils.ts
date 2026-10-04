import {sourcePath} from './full-types.ts';
export function safeReaderUrl(value:string):string|null {
 if(/[\\\u0000-\u001f]/.test(value)||value.startsWith('//'))return null;
 if(value.startsWith('/media/full/')&&!value.split('/').includes('..'))return value;
 try{const url=new URL(value);return /^https?:$/.test(url.protocol)?url.href:null;}catch{return null;}
}
export function readerArticlePath(exhibit?:string):string|undefined {
 try{const action=JSON.parse(exhibit??'null');return action?.type==='article'&&typeof action.path==='string'?sourcePath(action.path):undefined;}catch{return undefined;}
}
