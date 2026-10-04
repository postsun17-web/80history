export type FullRoute={scene:string;page:number;look?:[number,number,number];exhibit?:string};
export function parseFullRoute(search:string,scenes:{id:string;zone?:string}[],zones:{id:string;pages:unknown[]}[]):FullRoute{
 const params=new URLSearchParams(search.replace(/\+/g,'%2B'));
 const requested=(params.get('startscene')||'').toLowerCase();
 const scene=scenes.find(s=>s.id===requested)||scenes.find(s=>s.id==='scene_vr02')||scenes[0];
 const max=zones.find(z=>z.id===scene.zone)?.pages.length||1;
 const route:FullRoute={scene:scene.id,page:Math.max(1,Math.min(max,Math.trunc(Number(params.get('page')))||1))};
 const look=(params.get('startlookat')||'').split(',').map(Number);
 if(look.length===3&&look.every(Number.isFinite)&&Math.abs(look[1])<=90&&look[2]>0&&look[2]<180)route.look=look as [number,number,number];
 const exhibit=params.get('exhibit');
 if(exhibit&&exhibit.length<=4000)route.exhibit=exhibit;
 return route;
}
export function fullRouteUrl(route:FullRoute):string{
 const params=new URLSearchParams({startscene:route.scene,page:String(route.page)});
 if(route.look)params.set('startlookat',route.look.join(','));
 if(route.exhibit)params.set('exhibit',route.exhibit);
 return '?'+params.toString();
}
