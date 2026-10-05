// Both public museum paths share a shell and one gesture-enabled audio manager.
import {mountMuseum} from './full-main';
import {MuseumAudio} from './museum-audio';
import {museumIdAt,museumRouteUrl,readReturnRoute} from './museum-route';
import type {FullMuseum,MuseumId} from './full-types';
import type {FullRoute} from './full-navigation';

const audio=new MuseumAudio();
let active:ReturnType<typeof mountMuseum>|undefined,activeId:MuseumId|undefined,generation=0;
let historyReturn:FullRoute|null=null;
try{historyReturn=readReturnRoute(sessionStorage.getItem('museum-history-return'));}catch{/* Optional storage. */}
async function loadMuseum(id:MuseumId,initialRoute?:FullRoute){
 const current=++generation;
 active?.destroy();active=undefined;activeId=undefined;
 document.querySelector<HTMLElement>('#app')!.innerHTML='<div class="museum-starting" role="status">전시 공간을 준비하고 있습니다…</div>';
 try{
  const raw=id==='memorial'?await import('./data/memorial-museum.json'):await import('./data/full-museum.json');
  if(current!==generation)return;
  const data=raw.default as unknown as FullMuseum;
  activeId=id;active=mountMuseum(data,audio,switchMuseum,initialRoute);
 }catch(error){
  if(current!==generation)return;
  console.error('Unable to start museum',error);
  document.querySelector<HTMLElement>('#app')!.innerHTML='<div class="museum-starting" role="alert">전시 공간을 준비하지 못했습니다. <button id="reload-museum">다시 불러오기</button></div>';
  document.querySelector('#reload-museum')!.addEventListener('click',()=>void loadMuseum(museumIdAt(location.pathname)));
 }
}
function switchMuseum(id:MuseumId){
 if(activeId===id)return;
 const outgoing=active?.capture();
 if(activeId==='history'&&outgoing){
  historyReturn=outgoing;
  try{sessionStorage.setItem('museum-history-return',JSON.stringify(outgoing));}catch{/* Optional storage. */}
 }
 const next:FullRoute=id==='history'?historyReturn||{scene:'scene_vr02',page:1}:{scene:'scene_vr11',page:1,look:[90,0,120]};
 history.pushState({route:next},'',museumRouteUrl(id,next));
 void loadMuseum(id,next);
}
window.addEventListener('popstate',()=>{
 const id=museumIdAt(location.pathname);
 if(active&&activeId===id)active.popstate();else void loadMuseum(id);
});
void loadMuseum(museumIdAt(location.pathname));
