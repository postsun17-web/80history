import type {MuseumId} from './full-types';
import type {FullRoute} from './full-navigation';

export const museumIdAt=(path:string):MuseumId=>path==='/hkjmuseum.html'?'memorial':'history';
export const museumPath=(id:MuseumId)=>id==='memorial'?'/hkjmuseum.html':'/';
export function museumRouteUrl(id:MuseumId,route:FullRoute):string{
 const query=new URLSearchParams({startscene:route.scene,page:String(route.page)});
 if(route.look)query.set('startlookat',route.look.join(','));
 if(route.exhibit)query.set('exhibit',route.exhibit);
 return museumPath(id)+'?'+query.toString();
}
export function memorialDestination(value:string):boolean{
 try{
  const url=new URL(value,'https://youngnakdhm.net');
  return /^(?:www\.)?youngnakdhm\.net$/.test(url.hostname)&&url.pathname==='/hkjmuseum.html'||url.hostname==='vrcontents.synology.me'&&url.pathname.replace(/\/$/,'')==='/youngnak/vr';
 }catch{return false;}
}
export function readReturnRoute(value:string|null):FullRoute|null{
 if(!value)return null;
 try{
  const route=JSON.parse(value);
  if(typeof route.scene!=='string'||!/^scene_[\w+\-]+$/.test(route.scene)||!Number.isInteger(route.page)||route.page<1)return null;
  if(route.look&&(!Array.isArray(route.look)||route.look.length!==3||!route.look.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n))))return null;
  if(route.exhibit!==undefined&&(typeof route.exhibit!=='string'||route.exhibit.length>4000))return null;
  return {scene:route.scene,page:route.page,...(route.look?{look:route.look}:{}),...(route.exhibit?{exhibit:route.exhibit}:{})};
 }catch{return null;}
}
