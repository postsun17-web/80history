/** One derivative fallback, followed by an explicit terminal failure callback. */
export function loadImageWithFallback(image:HTMLImageElement,primary:string,original:string,onFailure?:()=>void):void {
 let fellBack=primary===original;
 const cleanup=()=>{image.removeEventListener('error',error);image.removeEventListener('load',cleanup);};
 const error=()=>{if(!fellBack){fellBack=true;image.src=original;}else{cleanup();onFailure?.();}};
 image.addEventListener('error',error);image.addEventListener('load',cleanup,{once:true});image.src=primary;
}
