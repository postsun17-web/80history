import type {FullRoute} from './full-navigation.ts';
import type {VisitorCatalog} from './visitor-catalog.ts';
export type QualityMode='auto'|'high'|'economy';
export interface Preferences {schemaVersion:1;fontSize:18|21|24;quality:QualityMode;lastRoute?:FullRoute;bookmarks:string[]}
export const PREFERENCES_KEY='youngnak-visitor-preferences';
export function normalizePreferences(value:unknown,catalog?:VisitorCatalog):Preferences {
 const defaults:Preferences={schemaVersion:1,fontSize:21,quality:'auto',bookmarks:[]};
 if(!value||typeof value!=='object'||(value as {schemaVersion?:unknown}).schemaVersion!==1)return defaults;
 const v=value as Record<string,unknown>;
 defaults.fontSize=[18,21,24].includes(v.fontSize as number)?v.fontSize as 18|21|24:21;
 defaults.quality=['auto','high','economy'].includes(v.quality as string)?v.quality as QualityMode:'auto';
 defaults.bookmarks=Array.isArray(v.bookmarks)?[...new Set(v.bookmarks.filter((id):id is string=>typeof id==='string'&&id.length<=4000&&(!catalog||catalog.entries.some(e=>e.id===id))))].slice(0,500):[];
 const r=v.lastRoute as Record<string,unknown>|undefined;
 if(r&&typeof r.scene==='string'&&/^scene_[\w+-]+$/.test(r.scene)&&Number.isInteger(r.page)&&Number(r.page)>0&&(!catalog||catalog.getEntry(r.scene,Number(r.page))?.page===r.page)){
  defaults.lastRoute={scene:r.scene,page:Number(r.page)};
  if(r.mode==='read'||r.mode==='tour')defaults.lastRoute.mode=r.mode;
  if(Array.isArray(r.look)&&r.look.length===3&&r.look.every(n=>typeof n==='number'&&Number.isFinite(n))&&Math.abs(r.look[1])<=90&&r.look[2]>0&&r.look[2]<180)defaults.lastRoute.look=r.look as [number,number,number];
  if(typeof r.exhibit==='string'&&r.exhibit.length<=4000)defaults.lastRoute.exhibit=r.exhibit;
 }
 return defaults;
}
export const validatePreferences=normalizePreferences;
export function readPreferences():Preferences {try{return normalizePreferences(JSON.parse(globalThis.localStorage.getItem(PREFERENCES_KEY)??'null'));}catch{return normalizePreferences(null);}}
export function savePreferences(value:Preferences):void {try{globalThis.localStorage.setItem(PREFERENCES_KEY,JSON.stringify(normalizePreferences(value)));}catch{}}
