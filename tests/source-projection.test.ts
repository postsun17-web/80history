import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPlane} from '../src/source-projection.ts';
test('krpano 1000-unit distorted hotspot covers 90 degrees, as specified by hotspotworldscale=2',()=>{
 const p=projectPlane({ath:'0',atv:'0',width:'1000',height:'1000'},1000,1000);
 assert.ok(Math.abs(p[0].yaw+Math.PI/4)<1e-8);
 assert.ok(Math.abs(p[1].yaw-Math.PI/4)<1e-8);
 assert.ok(p[0].pitch>0&&p[2].pitch<0);
});
test('bottom-left edge remains at source sphere coordinate while aspect follows image',()=>{
 const p=projectPlane({ath:'90',atv:'10',width:'100',height:'prop',edge:'leftbottom'},200,100);
 assert.ok(Math.abs(p[3].yaw-Math.PI/2)<1e-8);
 assert.ok(Math.abs(p[3].pitch+Math.PI/18)<1e-8);
 assert.ok(p[0].pitch>p[3].pitch);
});
test('positive source rx compensates the downward anchor angle on an upright wall',()=>{
 const p=projectPlane({ath:'0',atv:'20',rx:'20',width:'600',height:'300',edge:'bottom'},600,300);
 const rays=p.map(v=>({x:Math.sin(v.yaw)*Math.cos(v.pitch),z:Math.cos(v.yaw)*Math.cos(v.pitch)}));
 // An upright front wall projects with parallel vertical edges in an undistorted view.
 assert.ok(Math.abs(rays[0].x/rays[0].z-rays[3].x/rays[3].z)<1e-8);
});
test('source rotations cancel the spherical tangent frame without introducing roll',()=>{
 const p=projectPlane({ath:'30',atv:'20',rx:'20',ry:'-30',width:'600',height:'300',edge:'bottom'},600,300);
 const planeY=(v:{yaw:number;pitch:number})=>Math.tan(v.pitch)/Math.cos(v.yaw);
 assert.ok(Math.abs(planeY(p[0])-planeY(p[1]))<1e-8);
 assert.ok(Math.abs(planeY(p[2])-planeY(p[3]))<1e-8);
});
