import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseViewerQuality,LatestGeneration,panoramaTilePath,cubeFaces} from '../src/visitor-loading.ts';
test('explicit quality wins; auto respects constrained network and device',()=>{
 assert.equal(chooseViewerQuality('high',{width:390,saveData:true,memory:2}),'high');
 assert.equal(chooseViewerQuality('economy',{width:1600}),'economy');
 assert.equal(chooseViewerQuality('auto',{width:390}),'mid');
 assert.equal(chooseViewerQuality('auto',{width:1400,saveData:true}),'economy');
 assert.equal(chooseViewerQuality('auto',{width:1400,effectiveType:'2g'}),'economy');
 assert.equal(chooseViewerQuality('auto',{width:1400,memory:4}),'mid');
 assert.equal(chooseViewerQuality('auto',{width:1400,memory:8,effectiveType:'4g'}),'high');
});
test('navigation and page invalidation reject older auxiliary media',()=>{
 const gate=new LatestGeneration();const scene=gate.next();assert.ok(gate.isCurrent(scene));const page=gate.next();assert.equal(gate.isCurrent(scene),false);assert.ok(gate.isCurrent(page));gate.invalidate();assert.equal(gate.isCurrent(page),false);
});
test('all source cube tile requests preserve source face and row-column mapping',()=>{
 for(const face of Object.keys(cubeFaces) as (keyof typeof cubeFaces)[])for(let row=0;row<4;row++)for(let col=0;col<4;col++)assert.equal(panoramaTilePath('/media/full/panos/scene',face,col,row,2,'webp'),`/media/full/panos/scene/${cubeFaces[face]}/2/${row}_${col}.webp`);
});
