const between=(page:number,first:number,last:number)=>page>=first&&page<=last;

/** Source list_a06_action.xml spot_view/spot_view2 and list_a07_action.xml
 * spot_view3 share coordinates between collapsed pastor groups. Group headings
 * stay visible while only the current group's child controls are expanded.
 * Page-derived state also makes direct links and history restoration stable.
 * A06 pages 1–3 use the source's initial collapsed state (legacy navigation can
 * retain its previously expanded group on those three introductory pages).
 * D05 has ten distinct, always-visible controls and no grouping action. */
export function visiblePageControl(zoneId:string,currentPage:number,targetPage:number):boolean {
 if(zoneId==='a06'){
  if(between(targetPage,5,14))return between(currentPage,4,14);
  if(between(targetPage,16,17))return between(currentPage,15,17);
  if(between(targetPage,19,29))return between(currentPage,18,29);
 }
 if(zoneId==='a07'){
  if(between(targetPage,5,13))return between(currentPage,4,13);
  if(between(targetPage,15,21))return between(currentPage,14,21);
 }
 return true;
}

/** Final coordinates after the source set/tween calls. Apply before converting
 * ath/atv to viewer coordinates; leave source attributes themselves unchanged. */
export function sourcePageControlPosition(zoneId:string,currentPage:number,targetPage:number):{ath:number;atv:number}|undefined {
 if(zoneId==='a06'){
  const firstGroup=between(currentPage,4,14),secondGroup=between(currentPage,15,17);
  if(targetPage===15)return firstGroup?{ath:113.5393,atv:19.1671}:{ath:84.9741,atv:20.7272};
  if(targetPage===18)return firstGroup?{ath:115.9943,atv:18.8494}:secondGroup?{ath:94.0617,atv:20.7248}:{ath:88.0226,atv:20.7391};
 }
 if(zoneId==='a07'&&targetPage===14)return between(currentPage,4,13)?{ath:-157.6304,atv:19.2881}:{ath:174.386,atv:21.1937};
 return undefined;
}
