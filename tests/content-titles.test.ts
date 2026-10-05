import test from 'node:test';
import assert from 'node:assert/strict';
import {createContentTitles,type TitleCatalogue} from '../src/title-resolver.ts';
import type {FullMuseum} from '../src/full-types.ts';

const entry=(title:string)=>({title,sources:['원본 전시판'],reason:'원문 내용 대조'});
const catalogue:TitleCatalogue={schemaVersion:1,pages:{'c02:1':entry('보린의 정신과 영락사회복지재단의 발자취')},articles:{'html/c02_01.html':entry('영락사회복지재단의 역사')},images:{'images/zone_info01_text.jpg':{...entry('A관 안내'),matte:'dark'},'img/mixed.png':{...entry('검은 본문과 흰 연도'),matte:'contrast'}},galleries:{'a01-photo':entry('사랑 + 나눔 & 봉사')}};
const data={zones:[{id:'c02',title:'사회봉사기관',pages:[{number:1,title:'사회봉사기관',image:'/media/full/img/sector_c02_01.png.webp'}]}],articles:{'html/c02_01.html':{title:'첫 문장…'}},galleries:[{id:'a01',items:[{id:'a01-photo',title:'01',image:'/media/full/galleries/a01/1.webp'}]}],assets:{}} as unknown as FullMuseum;
const titles=createContentTitles(data,catalogue);
test('all image entry paths resolve the same reviewed title over stale URL titles',()=>{
 const title=catalogue.pages['c02:1'].title;
 assert.equal(titles.page('c02',1),title);
 for(const src of ['img/sector_c02_01.png','/media/full/img/sector_c02_01.png.webp','https://museum.test/media/full/img/sector_c02_01.png.webp']){
  assert.equal(titles.image(src,'사회봉사기관+·+사회봉사기관'),title);
  assert.equal(titles.action({type:'image',src,title:'잘못된 제목'}).title,title);
 }
});
test('article, gallery and lobby titles use stable resource IDs',()=>{
 assert.equal(titles.article('html/c02_01.html'),'영락사회복지재단의 역사');
 assert.equal(titles.gallery('a01-photo'),'사랑 + 나눔 & 봉사');
 assert.equal(titles.image('/media/full/images/zone_info01_text.jpg.webp'),'A관 안내');
});
test('unknown image titles keep literal plus and fall back safely',()=>{
 assert.equal(titles.image('img/unreviewed+1.png','자료 + 사진 & 기록'),'자료 + 사진 & 기록');
 assert.equal(titles.image('img/unknown.png'),'전시 자료');
 assert.equal(titles.image('img/unknown.png',42 as unknown as string),'전시 자료');
});
test('ivory is the default; only reviewed white-letter originals use dark matte',()=>{
 assert.equal(titles.matte('/media/full/img/sector_c02_01.png.webp'),'ivory');
 assert.equal(titles.matte('images/zone_info01_text.jpg'),'dark');
 assert.equal(titles.matte('img/mixed.png'),'contrast');
});
