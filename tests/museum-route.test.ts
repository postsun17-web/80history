import test from 'node:test';
import assert from 'node:assert/strict';
import {museumIdAt,museumPath,museumRouteUrl,memorialDestination,readReturnRoute} from '../src/museum-route.ts';

test('museum paths scope identical source scene IDs without changing query semantics',()=>{
 assert.equal(museumIdAt('/hkjmuseum.html'),'memorial');
 assert.equal(museumIdAt('/'),'history');
 assert.equal(museumPath('memorial'),'/hkjmuseum.html');
 const url=museumRouteUrl('memorial',{scene:'scene_vr11',page:1,look:[90,0,120]});
 assert.equal(new URL(url,'https://example.test').pathname,'/hkjmuseum.html');
 assert.equal(new URL(url,'https://example.test').searchParams.get('startscene'),'scene_vr11');
});
test('both delivered desktop and mobile memorial links route internally',()=>{
 assert.equal(memorialDestination('http://youngnakdhm.net/hkjmuseum.html'),true);
 assert.equal(memorialDestination('https://vrcontents.synology.me/youngnak/vr'),true);
 assert.equal(memorialDestination('https://spinzam.com/shot/?idx=519164'),false);
 assert.equal(memorialDestination('https://evil.test/hkjmuseum.html'),false);
});
test('return locations retain complete view and panel state but cannot navigate to another host',()=>{
 const route={scene:'scene_c-s-e+1',page:3,look:[91,-5,100] as [number,number,number],exhibit:'{"type":"image","title":"A + B & C"}'};
 assert.deepEqual(readReturnRoute(JSON.stringify(route)),route);
 assert.equal(readReturnRoute('https://evil.test/'),null);
 assert.equal(readReturnRoute('{"scene":"bad","page":1,"look":[0,null,100]}'),null);
});
