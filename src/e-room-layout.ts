import type {SphericalPoint} from './source-projection';

/** The approved C-right doorway replaces this wall's old full-width display.
 * Keep that display and its hit areas together on the empty wall to its right. */
export function besideEDoor(point:SphericalPoint,rayOnly=false):SphericalPoint {
 let x=Math.cos(point.pitch)*Math.sin(point.yaw)*point.distance;
 let y=Math.sin(point.pitch)*point.distance;
 let z=Math.cos(point.pitch)*Math.cos(point.yaw)*point.distance;
 if(rayOnly){y/=x;z/=x;x=1;}
 y*=.55;z=z*.55-.95;
 return {yaw:Math.atan2(x,z),pitch:Math.atan2(y,Math.hypot(x,z)),distance:Math.hypot(x,y,z)};
}
