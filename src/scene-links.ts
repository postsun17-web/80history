export type SceneLink={from:string;to:string;ath:number;atv:number;label:string;arrivalLook:[number,number,number]};

// Original positions for A/C links are from the delivered, editable tour.xml.
// E links and their positions belong to the proposed extension.
export const sceneLinks:SceneLink[]=[
 {from:'scene_f-c-0',to:'scene_a-s-0',ath:0,atv:16,label:'A존으로 이동',arrivalLook:[0,0,95]},
 {from:'scene_a-s-0',to:'scene_f-c-0',ath:180,atv:22,label:'로비로 이동',arrivalLook:[0,0,100]},
 {from:'scene_a-s-0',to:'scene_a-s-w-1+',ath:-145,atv:13,label:'복음의 문이 열리다',arrivalLook:[180,0,95]},
 {from:'scene_a-s-w-1+',to:'scene_a-s-0',ath:0,atv:20,label:'A존 입구로',arrivalLook:[0,0,95]},
 {from:'scene_a-s-0',to:'scene_a-s-e+1',ath:89.868,atv:14.574,label:'A존 오른쪽으로',arrivalLook:[87.16,0,105]},
 {from:'scene_a-s-e+1',to:'scene_a-s-0',ath:-89.3,atv:16.213,label:'A존 입구로',arrivalLook:[0,0,95]},
 {from:'scene_a-s-e+1',to:'scene_c-c-s-1',ath:87.16,atv:15.617,label:'C존 입구로',arrivalLook:[-1.658,0,105]},
 {from:'scene_c-c-s-1',to:'scene_a-s-e+1',ath:-87.811,atv:19.602,label:'A존 오른쪽으로',arrivalLook:[-89.3,0,105]},
 {from:'scene_c-c-s-1',to:'scene_c-c-s-0',ath:-1.658,atv:15.986,label:'C존 중앙으로',arrivalLook:[89.497,0,105]},
 {from:'scene_c-c-s-0',to:'scene_c-c-s-1',ath:178.732,atv:17.025,label:'C존 입구로',arrivalLook:[-87.811,0,105]},
 {from:'scene_c-c-s-0',to:'scene_c-s-e+1',ath:89.497,atv:17.533,label:'C존 오른쪽으로',arrivalLook:[90,0,105]},
 {from:'scene_c-s-e+1',to:'scene_c-c-s-0',ath:-92.052,atv:26.275,label:'C존 중앙으로',arrivalLook:[178.732,0,105]},
 {from:'scene_c-s-e+1',to:'scene_ext-e-entry',ath:90,atv:15,label:'E 전시실로',arrivalLook:[90,0,100]},
 {from:'scene_ext-e-entry',to:'scene_c-s-e+1',ath:-90,atv:15,label:'C존으로 돌아가기',arrivalLook:[-92,0,105]},
 {from:'scene_ext-e-entry',to:'scene_ext-e-center',ath:90,atv:16,label:'E 전시실 안쪽으로',arrivalLook:[90,0,100]},
 {from:'scene_ext-e-center',to:'scene_ext-e-entry',ath:-90,atv:16,label:'E 전시실 입구로',arrivalLook:[-90,0,100]},
];
