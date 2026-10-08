import type {MuseumId} from './full-types';
import type {SourceAction} from './source-actions';
import {containsWallPoint,findWallApproach,wallApproachAction,type WallCatalogue,type WallMarker} from './wall-approach.ts';

export interface Passage {source:string;scene:string;title:string;look:[number,number,number];points:[number,number][]}
export interface PassageCatalogue {museum:MuseumId;scenes:Record<string,Passage[]>}
export interface PinchDestination {action:Extract<SourceAction,{type:'scene'}>;label:string}

export function isPinchControl(marker?:WallMarker):boolean{
 return !!(marker?.control||marker?.action&&['scene','page','object','audio','video','youtube'].includes(marker.action.type));
}
export function findPinchDestination(museum:MuseumId,scene:string,ath:number,atv:number,passages:PassageCatalogue,walls?:WallCatalogue,marker?:WallMarker):PinchDestination|null{
 if(museum!==passages.museum||isPinchControl(marker))return null;
 if(museum==='history'&&walls){
  const hit=findWallApproach(walls,scene,ath,atv,marker);
  if(hit)return {action:wallApproachAction(hit),label:hit.target.title+' 앞으로 이동'};
  if((walls.scenes[scene]||[]).some(region=>walls.targets[region.target]?.scene===scene&&containsWallPoint(region.points,ath,atv)))return null;
 }
 // Other content, including near exhibits, must keep its normal magnification.
 if(marker?.action)return null;
 const passage=(passages.scenes[scene]||[]).find(region=>region.scene!==scene&&containsWallPoint(region.points,ath,atv));
 return passage?{action:{type:'scene',scene:passage.scene,look:[...passage.look]},label:passage.title}:null;
}
