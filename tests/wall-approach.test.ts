import test from 'node:test';
import assert from 'node:assert/strict';
import {containsWallPoint,findWallApproach,wallApproachAction,type WallCatalogue} from '../src/wall-approach.ts';

const catalogue:WallCatalogue={targets:{a:{scene:'front',title:'전시 A',look:[90,0,110],zone:'a02'},b:{scene:'other',title:'전시 B',look:[-90,0,110]}},scenes:{far:[{target:'a',points:[[70,-20],[110,-20],[110,10],[70,10]],surfaces:['panel']}],front:[{target:'a',points:[[70,-20],[110,-20],[110,10],[70,10]]}]}};

test('wall hit includes edges, excludes blank wall/floor and unwraps the panorama seam',()=>{
 const seam:[[number,number],[number,number],[number,number],[number,number]]=[[170,-15],[190,-15],[190,5],[170,5]];
 for(const yaw of [170,175,180,-175,-170])assert.equal(containsWallPoint(seam,yaw,0),true);
 assert.equal(containsWallPoint(seam,0,0),false);
 assert.equal(containsWallPoint(seam,179,25),false);
 assert.equal(containsWallPoint([[0,0],[1,1],[2,2]],1,1),false);
 assert.equal(containsWallPoint(seam,NaN,0),false);
});
test('concave wall boundaries exclude a doorway without stealing neighboring exhibit clicks',()=>{
 const wall:[number,number][]=[[0,-20],[50,-20],[50,10],[35,10],[35,-5],[15,-5],[15,10],[0,10]];
 assert.equal(containsWallPoint(wall,10,0),true);
 assert.equal(containsWallPoint(wall,25,0),false);
 assert.equal(containsWallPoint(wall,25,-10),true);
 assert.equal(containsWallPoint(wall,60,0),false);
});
test('far wall selects explicit front-facing scene; own destination never approaches again',()=>{
 const hit=findWallApproach(catalogue,'far',90,0);
 assert.ok(hit);assert.deepEqual(wallApproachAction(hit),{type:'scene',scene:'front',look:[90,0,110]});
 assert.equal(findWallApproach(catalogue,'front',90,0),null);
 assert.equal(findWallApproach(catalogue,'unknown',90,0),null);
 assert.equal(findWallApproach(catalogue,'far',90,30),null);
});
test('only explicitly registered wall images are intercepted; arrows, controls and objects win',()=>{
 assert.ok(findWallApproach(catalogue,'far',90,0,{sourceName:'panel',action:{type:'image',src:'panel.png'}}));
 assert.equal(findWallApproach(catalogue,'far',90,0,{sourceName:'different-panel',action:{type:'image',src:'other.png'}}),null);
 for(const action of [{type:'scene',scene:'next'},{type:'page',zone:'a02',page:2},{type:'object',frames:36},{type:'audio',src:'a.mp3'},{type:'video',src:'v.mp4'}] as const){
  assert.equal(findWallApproach(catalogue,'far',90,0,{sourceName:'panel',action}),null);
 }
 assert.equal(findWallApproach(catalogue,'far',90,0,{control:true}),null);
 assert.ok(findWallApproach(catalogue,'far',90,0,{sourceName:'decoration'}));
});
