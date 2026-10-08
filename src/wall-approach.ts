import type {SourceAction} from './source-actions';

export interface WallTarget {scene:string;title:string;look:[number,number,number];zone?:string}
export interface WallRegion {target:string;points:[number,number][];surfaces?:string[]}
export interface WallCatalogue {targets:Record<string,WallTarget>;scenes:Record<string,WallRegion[]>}
export interface WallMarker {sourceName?:string;action?:SourceAction;control?:boolean}
export interface WallHit {region:WallRegion;target:WallTarget}

function unwrap(points:[number,number][]):[number,number][]{
 let previous=points[0]?.[0]??0;
 return points.map(([yaw,atv])=>{const x=yaw+360*Math.round((previous-yaw)/360);previous=x;return [x,atv];});
}
function area(points:[number,number][]):number{
 return Math.abs(points.reduce((sum,[x,y],i)=>{const [nx,ny]=points[(i+1)%points.length];return sum+x*ny-nx*y;},0))/2;
}
/** Camera-local source degrees: yaw wraps at 180; positive atv points down. */
export function containsWallPoint(points:[number,number][],ath:number,atv:number):boolean{
 if(points.length<3||![ath,atv,...points.flat()].every(Number.isFinite))return false;
 const polygon=unwrap(points),xs=polygon.map(p=>p[0]);
 if(Math.max(...xs)-Math.min(...xs)>=180||area(polygon)<1e-6)return false;
 const center=xs.reduce((a,b)=>a+b,0)/xs.length,x=ath+360*Math.round((center-ath)/360),y=atv;
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[j],[bx,by]=polygon[i];
  const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
  if(Math.abs(cross)<1e-7&&x>=Math.min(ax,bx)-1e-7&&x<=Math.max(ax,bx)+1e-7&&y>=Math.min(ay,by)-1e-7&&y<=Math.max(ay,by)+1e-7)return true;
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
export function findWallApproach(catalogue:WallCatalogue,scene:string,ath:number,atv:number,marker?:WallMarker):WallHit|null{
 if(marker?.control||marker?.action&&['scene','page','object','audio','video'].includes(marker.action.type))return null;
 const candidates=(catalogue.scenes[scene]||[]).filter(region=>{
  const target=catalogue.targets[region.target];
  return target&&target.scene!==scene&&(!marker?.action||!!marker.sourceName&&region.surfaces?.includes(marker.sourceName))&&containsWallPoint(region.points,ath,atv);
 });
 candidates.sort((a,b)=>area(unwrap(a.points))-area(unwrap(b.points)));
 const region=candidates[0];return region?{region,target:catalogue.targets[region.target]}:null;
}
export function wallApproachAction(hit:WallHit):Extract<SourceAction,{type:'scene'}>{
 return {type:'scene',scene:hit.target.scene,look:[...hit.target.look]};
}
