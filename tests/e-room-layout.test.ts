import {test} from 'node:test';
import assert from 'node:assert/strict';
import {besideEDoor} from '../src/e-room-layout.ts';
import {projectPlane} from '../src/source-projection.ts';

test('C02 display clears the E door and its clickable centre follows the same wall transform',()=>{
 const corners=projectPlane({ath:'90',atv:'0',width:'759.36',height:'400'},759,400);
 const transformed=corners.map(p=>besideEDoor(p));
 assert.ok(transformed.every(p=>p.yaw*180/Math.PI>118));
 const centre=besideEDoor({yaw:Math.PI/2,pitch:0,distance:1});
 const hitArea=besideEDoor({yaw:Math.PI/2,pitch:0,distance:1},true);
 assert.deepEqual(hitArea,centre);
 assert.ok(centre.yaw>transformed[0].yaw&&centre.yaw<transformed[1].yaw);
});
