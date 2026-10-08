type Point={clone():Point;distanceTo(point:Point):number};
type PickSphere={clone():PickSphere;copy(sphere:PickSphere):PickSphere;applyMatrix4(matrix:unknown):PickSphere};
type PickMesh={isMesh?:boolean;userData:Record<string,unknown>;matrixWorld:unknown;
 geometry:{type:string;boundingSphere:PickSphere;computeBoundingSphere():void};
 raycast:(raycaster:{ray:{origin:Point;intersectSphere(sphere:PickSphere,target:Point):Point|null};near:number;far:number},intersections:{distance:number;point:Point;object:PickMesh}[])=>void;
};
export type PickingScene={children:PickMesh[]};

/** PSV 5.15's invisible picking sphere can miss rays exactly on a triangle seam.
 * Intersect that sphere analytically; rendered panorama and marker meshes stay intact. */
export function stabilizePanoramaRaycast(scene:PickingScene):()=>void{
 const restores:(()=>void)[]=[];
 scene.children.forEach(object=>{
  if(!object.isMesh||!object.userData.photoSphereViewer||object.geometry.type!=='SphereGeometry')return;
  const original=object.raycast;
  object.geometry.computeBoundingSphere();
  const worldSphere=object.geometry.boundingSphere.clone();
  object.raycast=function(raycaster,intersections){
   const point=raycaster.ray.origin.clone();
   worldSphere.copy(this.geometry.boundingSphere!).applyMatrix4(this.matrixWorld);
   if(!raycaster.ray.intersectSphere(worldSphere,point))return;
   const distance=raycaster.ray.origin.distanceTo(point);
   if(distance>=raycaster.near&&distance<=raycaster.far)intersections.push({distance,point:point.clone(),object:this});
  };
  restores.push(()=>{object.raycast=original;});
 });
 return ()=>restores.forEach(restore=>restore());
}
