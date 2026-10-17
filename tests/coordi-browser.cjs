const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const base=process.argv[2]||'http://127.0.0.1:8778/',out=path.resolve(__dirname,'evidence/coordi-051');await fs.mkdir(out,{recursive:true});
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),p=await b.newPage({reducedMotion:'reduce',acceptDownloads:true}),errors=[],report=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 let releaseModule;const moduleReady=new Promise(resolve=>releaseModule=resolve);
 await p.route('**/coordi.js?*',async route=>{await moduleReady;await route.continue();});
 await p.goto(base+'coordi.html?v=coordi-2263-1',{waitUntil:'commit'});await p.locator('#coordi-search').waitFor();
 assert(await p.locator('#coordi-search').isDisabled());assert(await p.locator('#coordi-example').isDisabled());
 releaseModule();await p.waitForFunction(()=>!document.getElementById('coordi-search').disabled);await p.unroute('**/coordi.js?*');
 for(const[width,height]of[[320,740],[390,844],[1100,700],[1536,930]]){
  await p.setViewportSize({width,height});await p.goto(base+'demo.html?v=coordi-2263-1');
  async function capture(screen){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,screen+' overflow '+width);report.push({width,height,screen,overflow:0});if([390,1536].includes(width))await p.screenshot({path:path.join(out,`${width}-${screen}.jpg`),quality:80,fullPage:true});}
  assert.equal(await p.locator('.home-apps article').count(),3);assert((await p.locator('.home-coordi>img').getAttribute('src')).includes('coordi-icon.png'));await capture('home');await p.locator('.home-coordi a').click();await p.waitForSelector('#coordi-search');
  assert(await p.locator('.coordi-art>img').evaluate(i=>i.complete&&i.naturalWidth>0));await capture('search');await p.click('#coordi-example');await p.click('#coordi-search');assert.equal(await p.locator('#coordi-rows tr').count(),3);await p.locator('[data-result="0"]').click();assert((await p.textContent('#coordi-preview')).includes('기본 · 사용중'));await capture('results');
  await p.click('#coordi-open-detail');assert.equal(await p.locator('#coordi-detail .detail-config').count(),2);await p.click('#coordi-detail-close');
  await p.click('#module-nav [data-page=search]');await p.selectOption('[name=mode]','exact');await p.click('#coordi-search');await p.locator('[data-result="0"]').click();assert((await p.textContent('#coordi-preview')).includes('프리셋 2'));assert(!(await p.textContent('#coordi-preview')).includes('달빛 망토'));
  const downloadPromise=p.waitForEvent('download');await p.click('#coordi-export');const download=await downloadPromise;assert.equal(download.suggestedFilename(),'MapleTools_coordi_demo.csv');const csv=await fs.readFile(await download.path(),'utf8');assert(csv.includes('추가 프리셋 3'));assert.equal(csv.split('\r\n').length,4);
  await p.click('#module-nav [data-page=logs]');assert((await p.textContent('#coordi-log')).includes('API 호출 0회'));await p.click('#module-nav [data-page=results]');
  await p.click('#module-nav [data-page=search]');await p.selectOption('[name=mode]','contains');await p.fill('#coordi-query','별빛 반지, 별빛 반지');await p.click('#coordi-search');assert.equal(await p.locator('#coordi-rows tr').count(),1);assert((await p.textContent('#coordi-rows')).includes('푸른기계'));await p.click('#module-nav [data-page=search]');await p.uncheck('[name=special]');await p.click('#coordi-search');assert.equal(await p.locator('#coordi-rows tr').count(),0);assert(await p.locator('#coordi-export').isDisabled());
  await p.click('#module-nav [data-page=search]');await p.uncheck('[name=normal]');await p.click('#coordi-search');assert((await p.textContent('#coordi-status')).includes('월드 유형'));await p.click('#coordi-example');await p.fill('[name=date]','2026-10-13');await p.click('#coordi-search');assert((await p.textContent('#coordi-status')).includes('가상 기록만'));
  await p.click('#coordi-reset');assert.equal(await p.inputValue('#coordi-query'),'');await p.locator('[name=min]').focus();await p.locator('[name=min]').hover();await p.mouse.wheel(0,150);assert.equal(await p.inputValue('[name=min]'),'290');
  await p.locator('.app-switch a[aria-label="장비 검색기"]').click();await p.waitForSelector('#search-button');await p.locator('.coordi-switch').click();await p.waitForSelector('#coordi-search');
 }
 await p.setViewportSize({width:1440,height:1000});await p.goto(base+'index.html?v=coordi-2263-1');await p.click('[data-feature=coordi]');assert((await p.locator('#feature-panel a').getAttribute('href')).startsWith('coordi.html'));assert.equal(await p.locator('.coordi-intro').count(),0);
 await p.locator('iframe.interactive-frame').scrollIntoViewIfNeeded();const frame=p.frameLocator('iframe.interactive-frame');await frame.locator('.home-coordi a').click();await frame.locator('#coordi-example').click();await frame.locator('#coordi-search').click();assert.equal(await frame.locator('#coordi-rows tr').count(),3);assert(await frame.locator('html').evaluate(e=>e.classList.contains('is-embedded')));
 assert.deepEqual(errors,[]);const result={base,report,errors,embeddedCoordi:true,csvDownload:true,originalIllustration:true};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({screens:report.length,errors,embeddedCoordi:true,csvDownload:true}));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
