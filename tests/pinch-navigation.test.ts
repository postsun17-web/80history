import test from 'node:test';
import assert from 'node:assert/strict';
import {findPinchDestination,type PassageCatalogue} from '../src/pinch-navigation.ts';
import type {WallCatalogue} from '../src/wall-approach.ts';

const points:[number,number][]=[[170,0],[190,0],[190,30],[170,30]];
const passages:PassageCatalogue={museum:'history',scenes:{from:[{source:'arrow',scene:'next',title:'B실 방향으로 이동',look:[90,0,110],points}]}};
const walls:WallCatalogue={targets:{exhibit:{scene:'front',title:'교회개척',look:[0,0,100]}},scenes:{from:[{target:'exhibit',surfaces:['panel'],points:[[175,5],[185,5],[185,15],[175,15]]}]}};

test('pinch follows the original adjacent passage, including panorama seam',()=>{
 const result=findPinchDestination('history','from',-179,25,passages);
 assert.equal(result?.action.scene,'next');
 assert.deepEqual(result?.action.look,[90,0,110]);
 assert.equal(result?.label,'B실 방향으로 이동');
 assert.equal(findPinchDestination('memorial','from',-179,25,passages),null,'museum IDs never collide');
 assert.equal(findPinchDestination('history','from',0,25,passages),null,'blank floor is not a destination');
});
test('exhibit walls take precedence and an image marker must belong to that wall',()=>{
 const result=findPinchDestination('history','from',180,10,passages,walls,{sourceName:'panel',action:{type:'image',src:'panel.png'}});
 assert.equal(result?.action.scene,'front');
 assert.equal(result?.label,'교회개척 앞으로 이동');
 assert.equal(findPinchDestination('history','from',180,10,passages,walls,{sourceName:'other',action:{type:'image',src:'photo.png'}}),null);
});
test('controls and independent artifacts preserve their gestures',()=>{
 for(const action of [{type:'object',id:'relic'},{type:'scene',scene:'next'},{type:'page',zone:'a01',page:2},{type:'audio',src:'voice.mp3'},{type:'video',src:'movie.mp4'},{type:'youtube',id:'123'}] as any[]){
  assert.equal(findPinchDestination('history','from',180,10,passages,walls,{action}),null);
 }
 assert.equal(findPinchDestination('history','from',180,10,passages,walls,{control:true}),null);
});
test('being in front of a wall retains ordinary zoom and never navigates to self',()=>{
 const atFront:WallCatalogue={targets:{exhibit:{scene:'from',title:'교회개척',look:[0,0,110]}},scenes:walls.scenes};
 assert.equal(findPinchDestination('history','from',180,10,passages,atFront),null);
 const self:PassageCatalogue={museum:'history',scenes:{from:[{...passages.scenes.from[0],scene:'from'}]}};
 assert.equal(findPinchDestination('history','from',180,25,self),null);
});
