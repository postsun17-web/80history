import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,MeshBasicMaterial,Raycaster,Scene,SphereGeometry,Vector3} from 'three';
import {stabilizePanoramaRaycast} from '../src/panorama-raycast.ts';

test('panorama clicks include exact cardinal triangle seams and keep other markers untouched',()=>{
 const scene=new Scene(),sphere=new Mesh(new SphereGeometry(10).scale(-1,1,1),new MeshBasicMaterial());
 sphere.userData.photoSphereViewer=true;scene.add(sphere);
 const ordinary=new Mesh(new SphereGeometry(2),new MeshBasicMaterial());scene.add(ordinary);
 const original=sphere.raycast,ordinaryRaycast=ordinary.raycast;
 const restore=stabilizePanoramaRaycast(scene);
 for(const direction of [[.9961946980917455,.08715574274765807,-2.220446049250313e-16],[0,0,1],[0,1,0],[0,-1,0],[-1,0,0]]){
  const ray=new Raycaster(new Vector3(),new Vector3(...direction).normalize());
  const hits=ray.intersectObject(sphere);
  assert.equal(hits.length,1);assert.ok(Math.abs(hits[0].distance-10)<1e-5);
 }
 assert.equal(ordinary.raycast,ordinaryRaycast);
 const clipped=new Raycaster(new Vector3(),new Vector3(1,0,0),0,5);
 assert.equal(clipped.intersectObject(sphere).length,0);
 restore();assert.equal(sphere.raycast,original);
});
