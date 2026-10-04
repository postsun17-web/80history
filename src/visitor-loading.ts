export type ViewerQuality='auto'|'high'|'economy';
export type EffectiveQuality='high'|'mid'|'economy';
export function chooseViewerQuality(mode:ViewerQuality,device:{width:number;saveData?:boolean;effectiveType?:string;memory?:number}):EffectiveQuality {
 if(mode==='economy'||(mode==='auto'&&(device.saveData||/^(slow-)?2g$/.test(device.effectiveType??''))))return 'economy';
 if(mode==='high')return 'high';
 return device.width<900||(device.memory!==undefined&&device.memory<=4)||device.effectiveType==='3g'?'mid':'high';
}
export class LatestGeneration {
 private generation=0;
 next():number{return ++this.generation;}
 isCurrent(token:number):boolean{return token===this.generation;}
 invalidate():void{this.generation++;}
}
export const cubeFaces={front:'f',back:'b',left:'l',right:'r',top:'u',bottom:'d'} as const;
export function panoramaTilePath(root:string,face:keyof typeof cubeFaces,col:number,row:number,level:number,extension:string):string {return `${root}/${cubeFaces[face]}/${level}/${row}_${col}.${extension}`;}
