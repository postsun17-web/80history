// Run with playwright-cli run-code --filename <this file> against the Vite preview.
// Exercise FullViewer.show itself; substitute only the panorama/marker I/O.
async page => {
 const results=await page.evaluate(async()=>{
  const {FullViewer}=await import('/src/full-viewer.ts');
  const results=[];
  for(const failure of ['cancelled','rejected']){
   const viewer=Object.create(FullViewer.prototype);
   const original={id:'original',view:[0,0,100],pano:{root:'/original',faceSize:2048,tiles:4,level:2,ext:'webp'}};
   const next={...original,id:'next',pano:{...original.pano,root:'/next'}};
   const panoramas=[];let clears=0,updates=0,errorOverlay=false;
   Object.assign(viewer,{scene:'original',page:5,data:{scenes:[original,next]},
    container:{clientWidth:1440,clientHeight:900},dimensions:new Map(),markerImages:new Map(),
    markers:{clearMarkers(){clears++;}},viewer:{
     config:{panorama:undefined},
     async setPanorama(panorama){
      this.config.panorama=panorama;panoramas.push(panorama.baseUrl.front);
      errorOverlay=panoramas.length===1;
      if(errorOverlay){if(failure==='rejected')throw new Error('Texture load failed');return false;}
      return true;
     },rotate(){},zoom(){}},
    size:async()=>[1,1],updateMarkers:async()=>{updates++;}});
   let rejected=false;
   try{await viewer.show({scene:'next',page:1,look:[90,0,100]});}catch{rejected=true;}
   await viewer.show({scene:'original',page:5,look:[12,3,105]});
   results.push({failure,rejected,clears,updates,page:viewer.page,scene:viewer.scene,panoramas,errorOverlay,currentPanorama:viewer.viewer.config.panorama.baseUrl.front});
  }
  return results;
 });
 for(const result of results){
  if(!result.rejected||result.clears!==2||result.updates!==1||result.page!==5||result.scene!=='original'||result.errorOverlay||result.currentPanorama!=='/original/f/base.webp'||result.panoramas.join(',')!=='/next/f/base.webp,/original/f/base.webp')throw new Error('Failed panorama must reload original panorama and same-page markers: '+JSON.stringify(result));
 }
 return results;
}
