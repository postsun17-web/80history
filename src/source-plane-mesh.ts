export type SourcePlanePoint = {yaw:number;pitch:number;distance:number};
type SourcePlaneMesh={
 isMesh:boolean;
 geometry:{
  getAttribute(name:string):{needsUpdate:boolean;setXYZ(index:number,x:number,y:number,z:number):unknown};
  computeVertexNormals():void;computeBoundingBox():void;computeBoundingSphere():void;
 };
 material:{repeat:{set(x:number,y:number):unknown};offset:{set(x:number,y:number):unknown}};
 onBeforeRender:(...args:unknown[])=>void;
};
const preparedMeshes=new WeakSet<SourcePlaneMesh>();

/** Preserve the original flat panel: PSV's four angular corners alone discard depth. */
export function applySourcePlane(marker:{threeElement:{children:unknown[]}},points:readonly SourcePlanePoint[]):boolean {
 const mesh=marker.threeElement.children.find(child=>(child as SourcePlaneMesh).isMesh) as SourcePlaneMesh|undefined;
 if(!mesh||points.length!==4)return false;
 const position=mesh.geometry.getAttribute('position');
 // PlaneGeometry stores TL, TR, BL, BR, while the public marker API is clockwise.
 [0,1,3,2].forEach((corner,index)=>{
  const p=points[corner],radius=p.distance*10;
  position.setXYZ(index,-Math.cos(p.pitch)*Math.sin(p.yaw)*radius,Math.sin(p.pitch)*radius,Math.cos(p.pitch)*Math.cos(p.yaw)*radius);
 });
 position.needsUpdate=true;
 mesh.geometry.computeVertexNormals();
 mesh.geometry.computeBoundingBox();
 mesh.geometry.computeBoundingSphere();
 const keepWholeTexture=()=>{mesh.material.repeat.set(1,1);mesh.material.offset.set(0,0);};
 keepWholeTexture();
 if(!preparedMeshes.has(mesh)){
  // PSV reapplies a spherical aspect-ratio crop asynchronously when media loads.
  // Restore the planar UV transform just before drawing, without a polling loop.
  const beforeRender=mesh.onBeforeRender;
  mesh.onBeforeRender=function(...args){beforeRender.apply(this,args);keepWholeTexture();};
  preparedMeshes.add(mesh);
 }
 return true;
}
