export type SphericalPoint={yaw:number;pitch:number;distance:number};
export function hasSourcePosition(a:Record<string,string>,points?:readonly unknown[]):boolean{
 // Source hotspots can omit either zero coordinate (B04/C04 omit ath).
 return 'ath'in a||'ath2'in a||'atv'in a||'atv2'in a||!!points?.length;
}
export function projectPlane(a:Record<string,string>,naturalWidth:number,naturalHeight:number):[SphericalPoint,SphericalPoint,SphericalPoint,SphericalPoint]{
 const num=(k:string,d=0)=>Number.isFinite(Number(a[k]))?Number(a[k]):d;
 const scale=num('scale',1),factor=scale/500;
 const w=num('width',naturalWidth),h=num('height',w*naturalHeight/naturalWidth);
 const width=w*factor,height=h*factor;
 const edge=a.edge||'center',ax=edge.includes('left')?0:edge.includes('right')?1:.5,ay=edge.includes('top')?0:edge.includes('bottom')?1:.5;
 const radians=Math.PI/180,yaw=num('ath')*radians,pitch=-num('atv')*radians;
 const rx=-num('rx')*radians,ry=num('ry')*radians,rz=-num('rz')*radians;
 // krpano's default hotspotworldscale is 2: width 1000 at depth 1000 spans 90°.
 // See https://krpano.com/docu/xml/#display.hotspotworldscale.
 return [[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{
  let x=(u-ax)*width,y=(ay-v)*height,z=0;
  const zx=x*Math.cos(rz)-y*Math.sin(rz);y=x*Math.sin(rz)+y*Math.cos(rz);x=zx;
  const px=x*Math.cos(ry)+z*Math.sin(ry);z=-x*Math.sin(ry)+z*Math.cos(ry);x=px;
  const py=y*Math.cos(rx)-z*Math.sin(rx);z=y*Math.sin(rx)+z*Math.cos(rx);y=py;
  const X=Math.sin(yaw)*Math.cos(pitch)*(1+z)+Math.cos(yaw)*x-Math.sin(yaw)*Math.sin(pitch)*y;
  const Y=Math.sin(pitch)*(1+z)+Math.cos(pitch)*y;
  const Z=Math.cos(yaw)*Math.cos(pitch)*(1+z)-Math.sin(yaw)*x-Math.cos(yaw)*Math.sin(pitch)*y;
  return {yaw:Math.atan2(X,Z),pitch:Math.atan2(Y,Math.hypot(X,Z)),distance:Math.hypot(X,Y,Z)};
 }) as [SphericalPoint,SphericalPoint,SphericalPoint,SphericalPoint];
}
