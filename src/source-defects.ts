export type SourceGalleryIssue={message:string;sourceScene:string;sourceFile:string};
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

/** Audited against the delivered original JPEGs; see docs/SOURCE-DEFECTS.md. */
export function sourceGalleryIssue(gallery:string,itemId:string):SourceGalleryIssue|undefined {
 return itemId.startsWith(gallery+':')?emptyOriginals[itemId]:undefined;
}
