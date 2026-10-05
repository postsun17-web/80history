import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapShortcuts,sceneSection,walkDestination,allowWalkActivation} from '../src/navigation-assist.ts';
import type {FullMuseum} from '../src/full-types.ts';

const data=JSON.parse(readFileSync(new URL('../src/data/full-museum.json',import.meta.url),'utf8')) as FullMuseum;

test('map shortcuts reuse the original first exhibit and arrival view for each section',()=>{
 assert.deepEqual(mapShortcuts(data.menus),[
  {label:'로비',section:'lobby',action:{type:'scene',scene:'scene_f-c-0',look:[0,0,100]}},
  {label:'A',section:'a',action:{type:'scene',scene:'scene_a-s-w-1+',look:[-180,0,110]}},
  {label:'B',section:'b',action:{type:'scene',scene:'scene_b-c-s-1',look:[180,0,120]}},
  {label:'C',section:'c',action:{type:'scene',scene:'scene_c-c-s-1',look:[180,0,125]}},
  {label:'D',section:'d',action:{type:'scene',scene:'scene_d-n-w-2',look:[270,0,110]}},
 ]);
});

test('map shortcuts omit missing sections instead of inventing destinations',()=>{
 assert.deepEqual(mapShortcuts([]).map(s=>s.label),['로비']);
});

test('current room indication treats original e and f scenes as lobby',()=>{
 assert.equal(sceneSection('scene_e-c-0'),'lobby');
 assert.equal(sceneSection('scene_f-c-w-1'),'lobby');
 assert.equal(sceneSection('scene_c-s-e+1'),'c');
 assert.equal(sceneSection('scene_vr02'),undefined);
});

test('arrow labels preserve destination names while removing long date suffixes',()=>{
 assert.equal(walkDestination('복음의 문이 열리다 (1945년 이전)'),'복음의 문이 열리다');
 assert.equal(walkDestination('한국기독교 연합운동의 중심에 서다(1973-1997)'),'한국기독교 연합운동의 중심에 서다');
 assert.equal(walkDestination('사회봉사기관'),'사회봉사기관');
});

test('walking accepts one primary marker activation or one navigation key press',()=>{
 assert.equal(allowWalkActivation({doubleClick:false,rightClick:false}),true);
 assert.equal(allowWalkActivation({doubleClick:true,rightClick:false}),false);
 assert.equal(allowWalkActivation({doubleClick:false,rightClick:true}),false);
 assert.equal(allowWalkActivation({key:'Enter',repeat:false}),true);
 assert.equal(allowWalkActivation({key:' ',repeat:false}),true);
 assert.equal(allowWalkActivation({key:'Enter',repeat:true}),false);
 assert.equal(allowWalkActivation({key:'ArrowRight',repeat:false}),false);
});
