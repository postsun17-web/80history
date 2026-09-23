import type {SceneLink} from './scene-links';
export const sceneIds = ['scene_f-c-0', 'scene_a-s-0', 'scene_a-s-w-1+', 'scene_a-s-e+1', 'scene_c-c-s-1', 'scene_c-c-s-0', 'scene_c-s-e+1', 'scene_ext-e-entry', 'scene_ext-e-center'];
export type Route = { scene: string; page: number; exhibit?: string; look?: [number, number, number] };
export function followSceneLink(_route:Route,link:SceneLink):Route {
 return {scene:link.to,page:1,look:link.arrivalLook};
}
export function parseRoute(search: string): Route {
 const p = new URLSearchParams(search.replace(/\+/g, '%2B'));
 const scene = p.get('startscene') || '';
 const route: Route = {scene: sceneIds.includes(scene) ? scene : sceneIds[0], page: Math.max(1,Math.min(6,Math.trunc(Number(p.get('page')))||1))};
 const exhibit=p.get('exhibit');
 if(exhibit && /^(photo-\d+|text-\d+|video-a|books|panel|help)$/.test(exhibit)) route.exhibit=exhibit;
 const angles=(p.get('startlookat')||'').split(',').map(Number);
 if(angles.length===3 && angles.every(Number.isFinite) && Math.abs(angles[1])<=90 && angles[2]>0 && angles[2]<180) route.look=angles as [number,number,number];
 return route;
}
export function routeUrl(route: Route): string {
 const p=new URLSearchParams({startscene:route.scene,page:String(route.page)});
 if(route.exhibit) p.set('exhibit',route.exhibit);
 if(route.look) p.set('startlookat',route.look.join(','));
 return '?'+p.toString();
}
export function toPosition(ath: number, atv: number) {
 return {yaw: ((ath%360+360)%360)*Math.PI/180, pitch:-atv*Math.PI/180};
}
export function verticalFov(fov: number, aspect: number, type='MFOV') {
 const factor=type==='VFOV'?1:type==='HFOV'?aspect:Math.max(aspect,4/3);
 return 2*Math.atan(Math.tan(fov*Math.PI/360)/factor)*180/Math.PI;
}
