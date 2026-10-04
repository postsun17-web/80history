import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,PlaneGeometry,ShaderMaterial,Vector2,Vector3} from 'three';
import {applySourcePlane} from '../src/source-plane-mesh.ts';

const points=[
 {yaw:Math.PI/4,pitch:Math.asin(1/Math.sqrt(3)),distance:Math.sqrt(3)},
 {yaw:-Math.PI/4,pitch:Math.asin(1/3),distance:3},
 {yaw:-Math.PI/4,pitch:-Math.asin(1/3),distance:3},
 {yaw:Math.PI/4,pitch:-Math.asin(1/Math.sqrt(3)),distance:Math.sqrt(3)},
];

function fixture(){
 const material=Object.assign(new ShaderMaterial(),{repeat:new Vector2(.8,.7),offset:new Vector2(.1,.15)});
 const mesh=new Mesh(new PlaneGeometry(),material);
 return {mesh,material,marker:{threeElement:new Group().add(mesh)}};
}

test('source panel preserves corner depth and remains one plane instead of a folded spherical quad',()=>{
 const {mesh,marker}=fixture();
 assert.equal(applySourcePlane(marker,points),true);
 const positions=mesh.geometry.getAttribute('position');
 const expected=[[-10,10,10],[20,10,20],[-10,-10,10],[20,-10,20]];
 expected.forEach((point,index)=>{
  const actual=new Vector3().fromBufferAttribute(positions,index);
  assert.ok(actual.distanceTo(new Vector3(...point))<.00001,`corner ${index}: ${actual.toArray()}`);
 });
 const a=new Vector3().fromBufferAttribute(positions,0),b=new Vector3().fromBufferAttribute(positions,1),c=new Vector3().fromBufferAttribute(positions,2),d=new Vector3().fromBufferAttribute(positions,3);
 const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
 assert.ok(Math.abs(normal.dot(d.sub(a)))<.00001);
 assert.ok(mesh.geometry.boundingSphere!.radius>18);
});

test('source panels keep their entire texture after a late image or video load changes crop settings',()=>{
 const {mesh,material,marker}=fixture();
 applySourcePlane(marker,points);
 assert.deepEqual(material.repeat.toArray(),[1,1]);
 assert.deepEqual(material.offset.toArray(),[0,0]);
 material.repeat.set(.4,.5);material.offset.set(.3,.25);
 mesh.onBeforeRender();
 assert.deepEqual(material.repeat.toArray(),[1,1]);
 assert.deepEqual(material.offset.toArray(),[0,0]);
});
