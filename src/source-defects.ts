import type {FullGallery,GalleryImage} from './full-types';
export type GalleryRecovery=({type:'photo';item:GalleryImage}|{type:'collection';title:string;items:{gallery:string;index:number;item:GalleryImage}[]})&{note?:string};
export type SourceGalleryIssue={message:string;sourceScene:string;sourceFile:string;recovery?:GalleryRecovery};
const message='전달받은 원본 이미지가 비어 있어 사진을 표시할 수 없습니다.';
const emptyOriginals:Record<string,SourceGalleryIssue>={};
for(const [item,scene,file] of [
 ['c03:7','scene_08','08(한경직 목사 총회장 기념촬영-19550426).jpg'],
 ['c03:8','scene_09','09WCC 지도자들의 한경직 목사 예방(1976.6.16.).jpg'],
 ['c03:9','scene_10','10(사진 2-3)추가 전달.jpg'],
 ['c03:10','scene_11','11관련 자료 1-3)추후 전달.jpg'],
 ['c03:12','scene_13','13빌리 그래함 한국전도대회 포스터.jpg'],
 ['c03:16','scene_17','17.100주년 행사 사진 1-8장.jpg'],
])emptyOriginals[item]={message,sourceScene:scene,sourceFile:'photo/jpg파일모음/c03_jpg/'+file};

for(const [gallery,index,scene] of [
 ['a07',35,'scene_36'],['a07',36,'scene_37'],['a07',37,'scene_38'],['a07',38,'scene_39'],['a07',39,'scene_40'],
 ['b01',0,'scene_b01_00'],['c01',0,'scene_00'],['d01',0,'scene_00'],['d01',5,'scene_05'],['d01',16,'scene_16'],
 ['d02',0,'scene_00'],['d04',0,'scene_00'],['d04',2,'scene_02'],['d04',3,'scene_03'],
] as const)emptyOriginals[`${gallery}:${index}`]={message,sourceScene:scene,sourceFile:`photo/${gallery}/tour.xml#${scene}`};

const replacements:Record<string,{gallery:string;indices:number[];title?:string;note?:string}>={
 'c03:7':{gallery:'c03-01',indices:[1]},
 'c03:8':{gallery:'c03-01',indices:[2],note:'같은 사진의 촬영 연도가 전시판에는 1976년, 사진 목록에는 1991년으로 표기되어 있어 확인이 필요합니다.'},
 'c03:9':{gallery:'c03-01',indices:[3,4,5],title:'한국기독교연합회 활동'},
 'c03:10':{gallery:'c03-01',indices:[6,7,8],title:'전국복음화운동'},
 'c03:12':{gallery:'c03-01',indices:[9]},
 'c03:16':{gallery:'c03-02',indices:[0,1,2,3,4],title:'한국기독교 100주년 행사 사진'},
};

/** The date conflict belongs to the photograph, including its original alternate-gallery route. */
export function sourceGalleryNote(gallery:string,itemId:string):string|undefined {
 return itemId.startsWith(gallery+':')&&['c03:8','c03-01:2'].includes(itemId)?replacements['c03:8'].note:undefined;
}

/** Raw files remain blank; verified alternate content means they are not missing subjects. */
export function sourceGalleryIssue(gallery:string,itemId:string,galleries:FullGallery[]=[]):SourceGalleryIssue|undefined {
 const issue=itemId.startsWith(gallery+':')?emptyOriginals[itemId]:undefined;
 if(!issue)return;
 const replacement=replacements[itemId],original=galleries.find(g=>g.id===gallery)?.items.find(item=>item.id===itemId);
 if(!replacement||!original)return issue;
 const alternate=galleries.find(g=>g.id===replacement.gallery);
 const items=replacement.indices.flatMap(index=>{
  const item=alternate?.items[index];
  return item?.image&&!emptyOriginals[item.id]?[{gallery:replacement.gallery,index,item}]:[];
 });
 if(items.length!==replacement.indices.length)return issue;
 const recovery:GalleryRecovery=replacement.title
  ?{type:'collection',title:replacement.title,items}
  :{type:'photo',item:{...items[0].item,id:original.id,title:original.title},note:replacement.note};
 return {...issue,recovery};
}
