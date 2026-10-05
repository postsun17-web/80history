import type {FullMuseum,FullScene} from './full-types';
import type {SourceAction} from './source-actions';

const faces={front:'f',back:'b',left:'l',right:'r',top:'u',bottom:'d'};

/** PSV passes the sorted level index, not the original krpano directory number. */
export function panoramaSource(p:FullScene['pano']){
 const levels=[...(p.levels?.length?p.levels:[p])].sort((a,b)=>a.faceSize-b.faceSize);
 return {
  baseUrl:Object.fromEntries(Object.entries(faces).map(([name,face])=>[name,`${p.root}/${face}/base.webp`])) as Record<keyof typeof faces,string>,
  flipTopBottom:true,
  levels:levels.map(level=>({faceSize:level.faceSize,nbTiles:level.tiles})),
  tileUrl:(face:keyof typeof faces,col:number,row:number,level:number)=>`${p.root}/${faces[face]}/${levels[level].level}/${row}_${col}.${p.ext}`,
 };
}

export function localMuseumObject(data:Pick<FullMuseum,'objects'>,action:Extract<SourceAction,{type:'object'}>){
 if(!action.url)return undefined;
 try{
  const url=new URL(action.url);
  if(!/^https?:$/.test(url.protocol)||!['spinzam.com','www.spinzam.com'].includes(url.hostname))return undefined;
  return data.objects?.[url.searchParams.get('idx')??''];
 }catch{return undefined;}
}

/** At most three decoded frame images are retained by an open object viewer. */
export function objectFrameWindow(index:number,length:number):number[]{
 if(length<1)return [];
 const normalize=(value:number)=>(value%length+length)%length;
 return [...new Set([normalize(index),normalize(index-1),normalize(index+1)])];
}
