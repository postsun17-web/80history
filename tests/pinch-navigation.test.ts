import test from 'node:test';
import assert from 'node:assert/strict';
import {findPinchDestination,isPinchControl,isPinchStartControl,isPinchReadingSurface,type PassageCatalogue,type ZoomCatalogue} from '../src/pinch-navigation.ts';
import type {WallCatalogue} from '../src/wall-approach.ts';
const points:[number,number][]=[[170,20],[190,20],[190,30],[170,30]];
const passages:PassageCatalogue={museum:'history',scenes:{from:[{source:'arrow',scene:'next',title:'B실 방향으로 이동',look:[90,0,110],direction:[180,25],points}]}};
const walls:WallCatalogue={targets:{exhibit:{scene:'front',title:'교회개척',look:[0,0,100]}},scenes:{from:[{target:'exhibit',surfaces:['panel'],points:[[175,5],[185,5],[185,15],[175,15]]}]}};
test('static reading panels preserve zoom, decorative pedestal labels do not block forward navigation',()=>{
 for(const name of ['sector_a011','sector_a01_03a','pannelspot_1','dacuspot_1','pptspot_8','map_1','other_build_1','zone_infotext','object_59','object_63','object_66','object_69'])assert.equal(isPinchReadingSurface(name),true,name);
 for(const name of ['infospot_1','shadow360','lc_ovr_1','whotspot_120','zone_kiosk1',undefined])assert.equal(isPinchReadingSurface(name),false,name);
});
test('forward passage selection ignores floor boundaries and pitch, and wraps the panorama seam',()=>{
 for(const atv of [-70,0,10,25,80]){const r=findPinchDestination('history','from',-179,atv,passages);assert.equal(r?.action.scene,'next');assert.deepEqual(r?.action.look,[90,0,110]);}
 assert.equal(findPinchDestination('memorial','from',180,25,passages),null);
 assert.equal(findPinchDestination('history','from',134.9,25,passages),null);
 assert.equal(findPinchDestination('history','from',135,25,passages)?.action.scene,'next');
});
test('visible exhibit wins over adjacent passage and unrelated near content keeps normal zoom',()=>{
 const r=findPinchDestination('history','from',180,10,passages,walls,{sourceName:'panel',action:{type:'image',src:'panel.png'}});
 assert.equal(r?.action.scene,'front');assert.equal(r?.label,'교회개척 앞으로 이동');
 assert.equal(findPinchDestination('history','from',180,10,passages,walls,{sourceName:'other',action:{type:'image',src:'photo.png'}}),null);
 assert.equal(findPinchDestination('history','from',180,10,passages,walls,{sourceName:'near-static',zoomSurface:true}),null,'non-clickable near panels still keep ordinary zoom');
 assert.equal(findPinchDestination('history','from',180,10,passages,walls,{sourceName:'panel',zoomSurface:true})?.action.scene,'front','distant wall image can still be approached');
});
test('movement arrows are eligible while page, media and artifact controls retain their gestures',()=>{
 for(const action of [{type:'object',folder:'relic'},{type:'page',zone:'a01',page:2},{type:'audio',src:'voice.mp3'},{type:'video',src:'movie.mp4'},{type:'youtube',id:'123'}] as any[]){assert.equal(findPinchDestination('history','from',180,10,passages,walls,{action}),null);assert.ok(isPinchControl({action}));}
 assert.equal(isPinchControl({action:{type:'scene',scene:'next'}}),false);
 assert.equal(findPinchDestination('history','from',180,10,passages,walls,{sourceName:'arrow',action:{type:'scene',scene:'next'}})?.action.scene,'next');
 assert.equal(findPinchDestination('history','from',180,10,passages,walls,{control:true}),null);
});
test('off-center exhibit hit areas do not make the destination depend on finger placement',()=>{
 assert.equal(isPinchStartControl({action:{type:'object',folder:'relic'}}),false);
 assert.equal(isPinchStartControl({action:{type:'video',src:'wall.mp4'}}),false);
 assert.equal(isPinchStartControl({action:{type:'scene',scene:'next'}}),false);
 assert.equal(isPinchStartControl({control:true}),true);
 assert.equal(isPinchStartControl({action:{type:'page',zone:'a02',page:2}}),true);
 assert.equal(isPinchStartControl({action:{type:'audio',src:'audio.mp3'}}),true);
});
test('near reading surface protects zoom without blocking the rest of the same viewpoint',()=>{
 const zoom:ZoomCatalogue={museum:'history',scenes:{from:[{source:'near-panel',points:[[170,-15],[190,-15],[190,15],[170,15]]}]}};
 assert.equal(findPinchDestination('history','from',180,0,passages,undefined,undefined,zoom),null);
 assert.equal(findPinchDestination('history','from',155,0,passages,undefined,undefined,zoom)?.action.scene,'next');
 assert.equal(findPinchDestination('history','from',180,0,passages,undefined,undefined,{...zoom,museum:'memorial'})?.action.scene,'next');
});
test('nearest link wins; equal angles retain preview then original order; duplicate destinations collapse',()=>{
 const base=passages.scenes.from[0];
 const choices:PassageCatalogue={museum:'history',scenes:{from:[{...base,source:'left',scene:'left',direction:[-20,10]},{...base,source:'right',scene:'right',direction:[20,70]},{...base,source:'duplicate',scene:'left',direction:[-20,20]}]}};
 const pick=(yaw:number,previous?:string)=>findPinchDestination('history','from',yaw,0,choices,undefined,undefined,undefined,previous)?.action.scene;
 assert.equal(pick(0),'left');assert.equal(pick(0,'right'),'right');assert.equal(pick(-1,'right'),'left');assert.equal(pick(1,'left'),'right');assert.equal(pick(0,'unrelated'),'left');assert.equal(pick(180),undefined);
});
test('invalid geometry and self destinations never navigate',()=>{
 const self:PassageCatalogue={museum:'history',scenes:{from:[{...passages.scenes.from[0],scene:'from'}]}};
 assert.equal(findPinchDestination('history','from',180,25,self),null);
 assert.equal(findPinchDestination('history','from',NaN,25,passages),null);
});
