import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visiblePageControl,sourcePageControlPosition} from '../src/source-page-controls.ts';

const shown=(zone:string,current:number,count:number)=>Array.from({length:count},(_,i)=>i+1).filter(page=>visiblePageControl(zone,current,page));
const range=(first:number,last:number)=>Array.from({length:last-first+1},(_,i)=>first+i);

test('A06 initially shows group headings; opening a pastor group exposes only its own children',()=>{
 // list_a06_action.xml: spot_view/spot_view2 hide aspot/bspot/cspot before showing one group.
 assert.deepEqual(shown('a06',1,29),[1,2,3,4,15,18]);
 for(const current of [4,5,14])assert.deepEqual(shown('a06',current,29),[...range(1,15),18]);
 for(const current of [15,16,17])assert.deepEqual(shown('a06',current,29),[1,2,3,4,15,16,17,18]);
 for(const current of [18,19,29])assert.deepEqual(shown('a06',current,29),[1,2,3,4,15,...range(18,29)]);
});

test('A07 del/a01/b01 states collapse and expand the source pastor groups',()=>{
 // list_a07_action.xml: spot_view3(del) is called explicitly for pages 1, 2 and 3.
 for(const current of [1,2,3])assert.deepEqual(shown('a07',current,21),[1,2,3,4,14]);
 for(const current of [4,5,13])assert.deepEqual(shown('a07',current,21),range(1,14));
 for(const current of [14,15,21])assert.deepEqual(shown('a07',current,21),[1,2,3,4,...range(14,21)]);
});

test('D05 and ordinary zones retain every distinct source page control',()=>{
 for(const current of [1,5,10])assert.deepEqual(shown('d05',current,10),range(1,10));
 assert.deepEqual(shown('c02',5,8),range(1,8));
});

test('expanded headers move to the exact source spot_view coordinates',()=>{
 assert.deepEqual(sourcePageControlPosition('a06',4,15),{ath:113.5393,atv:19.1671});
 assert.deepEqual(sourcePageControlPosition('a06',14,18),{ath:115.9943,atv:18.8494});
 assert.deepEqual(sourcePageControlPosition('a06',15,18),{ath:94.0617,atv:20.7248});
 assert.deepEqual(sourcePageControlPosition('a06',18,15),{ath:84.9741,atv:20.7272});
 assert.deepEqual(sourcePageControlPosition('a06',29,18),{ath:88.0226,atv:20.7391});
 assert.deepEqual(sourcePageControlPosition('a07',13,14),{ath:-157.6304,atv:19.2881});
 assert.deepEqual(sourcePageControlPosition('a07',14,14),{ath:174.386,atv:21.1937});
 assert.equal(sourcePageControlPosition('d05',1,1),undefined);
});

test('no two displayed controls occupy the same source position on any grouped page',()=>{
 const data=JSON.parse(readFileSync(new URL('../src/data/full-museum.json',import.meta.url),'utf8'));
 for(const zoneId of ['a06','a07']){
  const zone=data.zones.find((z:{id:string})=>z.id===zoneId);
  const controls=data.scenes.find((s:{id:string})=>s.id===zone.scene).hotspots.filter((h:{name:string})=>/^listspot_\d+$/.test(h.name));
  for(let page=1;page<=zone.pages.length;page++){
   const occupied=new Set<string>();
   for(const control of controls){
    const target=Number(control.name.slice(9));
    if(!visiblePageControl(zoneId,page,target))continue;
    const position=sourcePageControlPosition(zoneId,page,target)||control.attrs;
    const key=Number(position.ath)+','+Number(position.atv);
    assert.equal(occupied.has(key),false,`${zoneId} page ${page}: overlapping ${control.name}`);
    occupied.add(key);
   }
  }
 }
});
