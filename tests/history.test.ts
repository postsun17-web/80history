import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VisitMemory} from '../src/history.ts';
test('back then forward restores outgoing live view and panel for each history entry',()=>{
 const visits=new VisitMemory();
 const a={scene:'scene_a-s-0',page:1};
 visits.save('lobby',{scene:'scene_f-c-0',page:1},[0,0,100]);
 visits.save('a',a,[75,-12,60]);
 assert.deepEqual(visits.restore('a',a),{...a,look:[75,-12,60]});
 visits.save('history',{scene:'scene_a-s-w-1+',page:4,exhibit:'photo-2'},[180,5,90]);
 assert.equal(visits.restore('history',a).page,4);
 assert.equal(visits.restore('history',a).exhibit,'photo-2');
 assert.deepEqual(visits.restore('lobby',a).look,[0,0,100]);
});
