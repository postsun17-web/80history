async page => {
 const errors=[];const capture=error=>errors.push(error.message);page.on('pageerror',capture);
 try{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:4174/?startscene=scene_c-s-e%2B1&page=1&startlookat=90,0,105');
  await page.waitForFunction(()=>document.querySelector('#panorama canvas')&&document.querySelector('#loading')?.textContent==='');
  await page.getByRole('navigation',{name:'관람 메뉴'}).getByRole('button',{name:'전시실',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'E실 · 확장 전시실',exact:true}).click();
  await page.waitForURL(url=>url.searchParams.get('startscene')==='scene_ext-e-entry');
  await page.waitForFunction(()=>document.querySelector('#loading')?.textContent==='');
  await page.getByRole('navigation',{name:'관람 메뉴'}).getByRole('button',{name:'더보기',exact:true}).click();
  await page.getByRole('combobox',{name:'화질',exact:true}).selectOption('economy');
  await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'글과 사진으로 보기',exact:true}).click();
  await page.waitForFunction(()=>document.body.classList.contains('reading-mode')&&!document.querySelector('#panorama canvas'));
  await page.waitForTimeout(1000);
  if(errors.length)throw new Error('Quality-to-read lifecycle errors: '+errors.join('; '));
  if(new URL(page.url()).searchParams.get('startscene')!=='scene_ext-e-entry')throw new Error('Route changed during quality-to-read');
  return {passed:true,scene:'scene_ext-e-entry',webglRemoved:true,pageErrors:errors};
 }finally{page.off('pageerror',capture);}
}
