/** A deliberately small interpreter for the delivered site's navigation syntax. */
export type SourceAction =
 | {type:'scene';scene:string;look?:[number,number,number]}
 | {type:'page';zone:string;page:number}
 | {type:'gallery';gallery:string;index:number}
 | {type:'article';path:string}
 | {type:'youtube';id:string}
 | {type:'image';src:string;audio?:string;title?:string;article?:string}
 | {type:'object';url?:string;folder?:string;frames?:number}
 | {type:'books'} | {type:'chatbot'} | {type:'help';audio?:string;index?:number}
 | {type:'external';url:string} | {type:'video';src:string} | {type:'audio';src:string} | {type:'document';src:string};

function unquote(value:string):string {
 const text=value.trim();
 return /^(['"]).*\1$/s.test(text)?text.slice(1,-1):text;
}
function argumentsAt(source:string,start:number):string[] {
 const args:string[]=[];let current='',depth=0,quote='';
 for(let i=start;i<source.length;i++){
  const char=source[i];
  if(quote){current+=char;if(char===quote&&source[i-1]!=='\\')quote='';continue;}
  if(char==='"'||char==="'"){quote=char;current+=char;continue;}
  if(char==='('){depth++;current+=char;continue;}
  if(char===')'){if(depth===0){args.push(unquote(current));return args;}depth--;}
  if(char===','&&depth===0){args.push(unquote(current));current='';}else current+=char;
 }
 return [];
}
function calls(source:string):{name:string;args:string[]}[] {
 return Array.from(source.matchAll(/\b([a-z][a-z_0-9]*)\s*\(/gi),match=>({name:match[1].toLowerCase(),args:argumentsAt(source,match.index!+match[0].length)}));
}
function localPath(value:string):string|null {
 let path=value.trim().replace(/%(?:FIRSTXML|VIEWER|CURRENTXML|SWFPATH)%\/?/gi,'').replace(/^\.\//,'').replace(/\/$/,'');
 try{path=decodeURIComponent(path);}catch{return null;}
 if(!path||/^[a-z][a-z0-9+.-]*:|^\/\/|[\\\u0000-\u001f]/i.test(path)||path.split('/').includes('..'))return null;
 return path;
}
function webUrl(value:string):URL|null {
 try{const url=new URL(value);return /^https?:$/.test(url.protocol)?url:null;}catch{return null;}
}
function destination(value:string,kind='iframe'):SourceAction|null {
 const url=webUrl(value);
 if(url){
  if(url.hostname==='121.161.240.244'&&url.port==='50088')return {type:'chatbot'};
  if(/(^|\.)youtube(?:-nocookie)?\.com$/.test(url.hostname)||url.hostname==='youtu.be'){
   const id=url.hostname==='youtu.be'?url.pathname.slice(1):url.pathname.match(/^\/embed\/([\w-]{11})/)?.[1]??url.searchParams.get('v');
   return id&&/^[\w-]{11}$/.test(id)?{type:'youtube',id}:null;
  }
  if(/(^|\.)spinzam\.com$/.test(url.hostname))return {type:'object',url:url.href};
  return {type:'external',url:url.href};
 }
 const path=localPath(value);if(!path)return null;
 const pathname=path.split('?')[0];
 if(/^e-book2?\.html$/i.test(pathname))return {type:'books'};
 if(/^info\/(?:index|tour)\.html$/i.test(pathname))return {type:'help'};
 const gallery=pathname.match(/^photo\/([\w-]+)\/(?:index|tour)\.html$/i);
 if(gallery){
  const raw=new URLSearchParams(path.split('?')[1]??'').get('startscene')??'0';
  if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw)))return null;
  const id=gallery[1].toLowerCase().replace(/^a07-([1-7])$/,'a07-0$1').replace(/^a06-2$/,'a06-02');
  return {type:'gallery',gallery:id,index:Number(raw)};
 }
 if(/^html\/.+\.html$/i.test(pathname))return {type:'article',path:pathname};
 if(/\.pdf$/i.test(pathname))return {type:'document',src:pathname};
 if(kind==='image'||/\.(png|jpe?g|webp|gif)$/i.test(pathname))return {type:'image',src:pathname};
 if(/\.(mp4|webm|ogv)$/i.test(pathname))return {type:'video',src:pathname};
 if(/\.(mp3|wav|ogg|m4a)$/i.test(pathname))return {type:'audio',src:pathname};
 return null;
}
export function decodeAction(source:string):SourceAction|null {
 const parsed=calls(source.replaceAll('&amp;','&'));
 const narration=parsed.find(call=>call.name==='playsound')?.args[1];
 const audio=narration?localPath(narration):null;
 for(const {name,args} of parsed){
  if(name==='loadscene'&&/^scene_[\w+-]+$/i.test(args[0]??'')){
   const look=parsed.find(call=>call.name==='lookto'||call.name==='lookat')?.args.slice(0,3).map(Number);
   return {type:'scene',scene:args[0].toLowerCase(),...(look?.length===3&&look.every(Number.isFinite)?{look:look as [number,number,number]}:{})};
  }
  const page=name.match(/^list_change_([a-d]\d{2})$/);
  if(page&&/^\d+$/.test(args[0]??'')&&Number(args[0])>0)return {type:'page',zone:page[1],page:Number(args[0])};
  if(name==='popup'||name==='popup2'||name==='add_iframe'||name==='openurl'||name==='videoplayer_open'){
   const popup=name.startsWith('popup'),result=destination(args[popup?1:0]??'',popup?args[0]:'iframe');
   if(result){if(audio&&(result.type==='image'||result.type==='help'))result.audio=audio;return result;}
  }
  if(name==='buildovr'){
   const folder=localPath(args[0]??''),frames=Number(args[1]);
   if(folder&&/^ovr\/\d+$/.test(folder)&&Number.isInteger(frames)&&frames>0&&frames<=360)return {type:'object',folder,frames};
  }
 }
 return audio?{type:'audio',src:audio}:null;
}
