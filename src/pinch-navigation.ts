import type {MuseumId} from './full-types';
import type {SourceAction} from './source-actions';
import {containsWallPoint,findWallApproach,wallApproachAction,type WallCatalogue,type WallMarker} from './wall-approach.ts';

export interface Passage {source:string;scene:string;title:string;look:[number,number,number];direction:[number,number];points:[number,number][]}
export interface PassageCatalogue {museum:MuseumId;scenes:Record<string,Passage[]>}
export interface ZoomCatalogue {museum:MuseumId;scenes:Record<string,{source:string;points:[number,number][]}[]>}
export interface PinchDestination {action:Extract<SourceAction,{type:'scene'}>;label:string}
export interface PinchMarker extends WallMarker {zoomSurface?:boolean}

/** Delivered static exhibit layers, excluding pedestal labels, shadows and scenery. */
export function isPinchReadingSurface(sourceName?:string):boolean{
 return /^(?:sector_|pannelspot_|pptspot_|map_|dacuspot_|other_build|object_|zone_infotext$)/.test(sourceName||'');
}

export function isPinchControl(marker?:WallMarker):boolean{
 return !!(marker?.control||marker?.action&&['page','object','audio','video','youtube'].includes(marker.action.type));
}
/** Only actual controls veto the contact start; content under an off-center finger is not the target. */
export function isPinchStartControl(marker:WallMarker):boolean{
 return !!(marker.control||marker.action&&['page','audio'].includes(marker.action.type));
}
function destination(passage:Passage):PinchDestination{
 return {action:{type:'scene',scene:passage.scene,look:[...passage.look]},label:passage.title};
}
/** Camera-center picking: exact content first, then the closest original forward link. */
export function findPinchDestination(museum:MuseumId,scene:string,ath:number,atv:number,passages:PassageCatalogue,walls?:WallCatalogue,marker?:PinchMarker,zoom?:ZoomCatalogue,previous?:string):PinchDestination|null{
 if(museum!==passages.museum||isPinchControl(marker)||![ath,atv].every(Number.isFinite))return null;
 const links=(passages.scenes[scene]||[]).filter(link=>link.scene!==scene);
 if(marker?.action?.type==='scene'){
  const action=marker.action;
  const link=links.find(link=>link.scene===action.scene&&link.source===marker.sourceName)||links.find(link=>link.scene===action.scene);
  return link?destination(link):null;
 }
 if(zoom?.museum===museum&&(zoom.scenes[scene]||[]).some(region=>containsWallPoint(region.points,ath,atv)))return null;
 if(museum==='history'&&walls){
  const hit=findWallApproach(walls,scene,ath,atv,marker);
  if(hit&&(!marker?.zoomSurface||!!marker.sourceName&&hit.region.surfaces?.includes(marker.sourceName)))return {action:wallApproachAction(hit),label:hit.target.title+' 앞으로 이동'};
  if((walls.scenes[scene]||[]).some(region=>walls.targets[region.target]?.scene===scene&&containsWallPoint(region.points,ath,atv)))return null;
 }
 // Other content, including near exhibits, must keep its normal magnification.
 if(marker?.action||marker?.zoomSurface)return null;
 const candidates=new Map<string,{link:Passage;distance:number}>();
 for(const link of links){
  const distance=Math.abs(((link.direction[0]-ath)%360+540)%360-180);
  if(distance>45||!Number.isFinite(distance))continue;
  const existing=candidates.get(link.scene);
  if(!existing||distance<existing.distance)candidates.set(link.scene,{link,distance});
 }
 let best:{link:Passage;distance:number}|undefined;
 for(const candidate of candidates.values()){
  if(!best||candidate.distance<best.distance-1e-7||Math.abs(candidate.distance-best.distance)<=1e-7&&candidate.link.scene===previous)best=candidate;
 }
 return best?destination(best.link):null;
}
