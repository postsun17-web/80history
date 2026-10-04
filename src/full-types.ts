/** Source-derived museum data. Original krpano actions are data, never evaluated. */
export interface SourceHotspot {
 name:string; attrs:Record<string,string>; points?:[number,number][];
}
export interface FullScene {
 id:string; title:string; source:string; view:[number,number,number];
 pano:{root:string; faceSize:number; tiles:number; level:number; ext:string};
 map?:{x:number;y:number;heading:number}; zone?:string;
 hotspots:SourceHotspot[];
}
export interface ExhibitPage {number:number;title:string;image:string;hotspots:SourceHotspot[]}
export interface ExhibitZone {id:string;title:string;scene:string;pages:ExhibitPage[]}
export interface GalleryImage {id:string;title:string;image:string;width:number;height:number;faces?:Record<string,string>}
export interface FullGallery {id:string;title:string;items:GalleryImage[]}
export interface MenuItem {title:string;scene?:string;look?:[number,number,number];action?:string;url?:string}
export interface FullMuseum {
 scenes:FullScene[]; zones:ExhibitZone[];
 galleries:FullGallery[];
 articles:Record<string,{title:string;url:string}>;
 menus:{title:string;items:MenuItem[]}[];
 quickMenu?:MenuItem[];
 mediaSections?:{title:string;items:MenuItem[]}[];
 ebooks:{title:string;category:string;cover:string;url:string}[];
 styles:Record<string,Record<string,string>>;
 assets:Record<string,string>;
 map:string; mapSize?:[number,number]; logo:string; intro:string;
}
export function sourcePath(value:string):string {
 return value.replace(/%(?:FIRSTXML|VIEWER|CURRENTXML)%\/?/gi,'').replace(/^\.\//,'').split('?')[0];
}
export function assetUrl(value:string):string {
 const path=sourcePath(value);
 if(/^(?:https?:|data:|\/media\/)/i.test(path))return path;
 return '/media/full/'+path+(/\.(?:png|jpe?g|gif|bmp)$/i.test(path)?'.webp':'');
}
