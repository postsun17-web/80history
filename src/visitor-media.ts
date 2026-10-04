import index from './data/visitor-media.json';
export function previewUrl(original:string):string|undefined {return (index.images as Record<string,{preview:string;thumbnail:string}>)[original]?.preview;}
export function thumbnailUrl(original:string):string|undefined {return (index.images as Record<string,{preview:string;thumbnail:string}>)[original]?.thumbnail;}
export function midPanoramaFaces(scene:string):Record<string,string>|undefined {return (index.panos as Record<string,Record<string,string>>)[scene];}
/** Derivative failures retain access to the delivered source. */
export function useMediaPreview(image:HTMLImageElement,original:string,thumbnail=false):void {
 image.src=(thumbnail?thumbnailUrl(original):previewUrl(original))??original;
 image.addEventListener('error',()=>{if(image.getAttribute('src')!==original)image.src=original;},{once:true});
}
