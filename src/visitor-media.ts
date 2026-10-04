import {loadImageWithFallback} from './visitor-image';
import index from './data/visitor-media.json';
export function previewUrl(original:string):string|undefined {return (index.images as Record<string,{preview:string;thumbnail:string}>)[original]?.preview;}
export function thumbnailUrl(original:string):string|undefined {return (index.images as Record<string,{preview:string;thumbnail:string}>)[original]?.thumbnail;}
export function midPanoramaFaces(scene:string):Record<string,string>|undefined {return (index.panos as Record<string,Record<string,string>>)[scene];}
/** Derivative failures retain access to the delivered source. */
export function useMediaPreview(image:HTMLImageElement,original:string,thumbnail=false,onFailure?:()=>void):void {
 loadImageWithFallback(image,(thumbnail?thumbnailUrl(original):previewUrl(original))??original,original,onFailure);
}
