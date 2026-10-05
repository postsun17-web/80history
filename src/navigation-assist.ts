import type {FullMuseum} from './full-types.ts';
import type {SourceAction} from './source-actions.ts';

export type MapShortcut={label:string;section:string;action:Extract<SourceAction,{type:'scene'}>};
export function mapShortcuts(menus:FullMuseum['menus']):MapShortcut[]{
 const shortcuts:MapShortcut[]=[{label:'로비',section:'lobby',action:{type:'scene',scene:'scene_f-c-0',look:[0,0,100]}}];
 for(const label of ['A','B','C','D']){
  const first=menus.find(group=>group.title.startsWith(label+' '))?.items.find(item=>item.scene);
  if(first?.scene)shortcuts.push({label,section:label.toLowerCase(),action:{type:'scene',scene:first.scene,...(first.look?{look:[...first.look] as [number,number,number]}:{})}});
 }
 return shortcuts;
}
export function sceneSection(scene:string):string|undefined{
 const section=/^scene_([a-f])-/.exec(scene)?.[1];
 return section==='e'||section==='f'?'lobby':section;
}
export function walkDestination(title:string):string{return title.replace(/\s*\([^)]*\d[^)]*\)\s*$/,'').trim();}
export function allowWalkActivation(event:{doubleClick?:boolean;rightClick?:boolean;key?:string;repeat?:boolean}):boolean{
 return event.key!==undefined?(event.key==='Enter'||event.key===' ')&&!event.repeat:!event.doubleClick&&!event.rightClick;
}
