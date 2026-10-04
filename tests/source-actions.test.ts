import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeAction} from '../src/source-actions.ts';

test('scene actions preserve plus signs and explicit arrival direction',()=>{
 assert.deepEqual(decodeAction('menum(cls); loadscene(scene_A-s-e+1+, null, MERGE, BLEND(1)); lookto(180,-10,110, smooth(60,60,60));'),{type:'scene',scene:'scene_a-s-e+1+',look:[180,-10,110]});
});
test('gallery URLs normalize known source aliases and use zero-based numeric indices',()=>{
 assert.deepEqual(decodeAction("popup2('iframe', './photo/a07-2/index.html?startscene=12', 580, 860, false);"),{type:'gallery',gallery:'a07-02',index:12});
 assert.deepEqual(decodeAction('popup("iframe", "./photo/c05-1/index.html?startscene=0", 600, 480);'),{type:'gallery',gallery:'c05-1',index:0});
 assert.equal(decodeAction("popup('iframe','./photo/a02/index.html?startscene=-1');"),null);
 assert.equal(decodeAction("popup('iframe','./photo/a02/index.html?startscene=1.5');"),null);
});
test('article iframe calls accept nested unquoted arguments and source filenames with spaces',()=>{
 assert.deepEqual(decodeAction('contentview(); set(hotspot[frame_name].onloaded, add_iframe(./html/a02_01.html,600,480); );'),{type:'article',path:'html/a02_01.html'});
 assert.deepEqual(decodeAction("popup('iframe','./html/제목 없음2.html?',1100,600,false);"),{type:'article',path:'html/제목 없음2.html'});
});
test('extracts YouTube ids despite malformed legacy query strings',()=>{
 assert.deepEqual(decodeAction("sound_na(stop); popup2('iframe','https://www.youtube.com/embed/Cs8PwMg7TIM?si=a?rel=0&amp;autoplay=1',900,506,false);"),{type:'youtube',id:'Cs8PwMg7TIM'});
});
test('page actions reject zero and decode original zero-padded pages',()=>{
 assert.deepEqual(decodeAction('list_change_a06(04); spot_view(a01);'),{type:'page',zone:'a06',page:4});
 assert.equal(decodeAction('list_change_a06(0);'),null);
});
test('image popup retains matching narration and local video/object are explicit',()=>{
 assert.deepEqual(decodeAction("popup('image','%CURRENTXML%/images/zone_info01_text.jpg'); playsound(na1,'%VIEWER%/mp3/zone_a.mp3',false,0.7);"),{type:'image',src:'images/zone_info01_text.jpg',audio:'mp3/zone_a.mp3'});
 assert.deepEqual(decodeAction("videoplayer_open('%VIEWER%/mov/opendoor.mp4');"),{type:'video',src:'mov/opendoor.mp4'});
 assert.deepEqual(decodeAction('buildovr(%VIEWER%/ovr/04/,36,png,0.3,s1,false);'),{type:'object',folder:'ovr/04',frames:36});
});
test('recognizes service destinations without retaining insecure chatbot endpoint',()=>{
 assert.deepEqual(decodeAction("popup2('iframe','http://121.161.240.244:50088?',600,506,false);"),{type:'chatbot'});
 assert.deepEqual(decodeAction("popup2('iframe','./e-book.html?',600,506,false);"),{type:'books'});
 assert.deepEqual(decodeAction("popup2('iframe','./info/index.html?',800,600,false); playsound(na0,'%VIEWER%/mp3/info.mp3');"),{type:'help',audio:'mp3/info.mp3'});
 assert.deepEqual(decodeAction("popup2('iframe','https://spinzam.com/shot/?idx=519130',800,600,false);"),{type:'object',url:'https://spinzam.com/shot/?idx=519130'});
});
test('unknown code and unsafe URL schemes or traversal remain inert',()=>{
 for(const input of ["js(alert(1))", "popup('iframe','javascript:alert(1)');", "openurl('data:text/html,hello')", "popup('image','../../private.png')", "popup('iframe','./html/../private.html')"]){assert.equal(decodeAction(input),null,input);}
});
test('delivered PDF material opens as a local document',()=>{
 assert.deepEqual(decodeAction("openurl('./photo/d02/d02.pdf',_blank);"),{type:'document',src:'photo/d02/d02.pdf'});
});
