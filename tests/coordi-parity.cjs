const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const base=process.argv[2]||'http://127.0.0.1:8778/',browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),p=await browser.newPage(),errors=[],sizes=[];
 p.on('pageerror',e=>errors.push(e.message));
 try{
  for(const [width,height] of [[390,844],[1100,700],[1536,930],[1920,1080]]){
   await p.setViewportSize({width,height});
   const metrics=[];
   for(const url of ['demo.html?app=detailed','demo.html?app=union','coordi.html']){
    await p.goto(base+url);await p.waitForFunction(()=>[...document.images].filter(i=>i.closest('.pc-sidebar,.coordi-art')).every(i=>i.complete&&i.naturalWidth));
    metrics.push(await p.evaluate(()=>{const header=document.querySelector('.pc-titlebar').getBoundingClientRect(),footer=document.querySelector('.pc-status').getBoundingClientRect(),side=document.querySelector('.pc-sidebar,.coordi-art').getBoundingClientRect();return {header:header.height,footerBottom:footer.bottom,sidebar:side.width,overflow:document.documentElement.scrollWidth-innerWidth};}));
   }
   assert(metrics.every(x=>x.overflow===0));
   if(width>900){assert.equal(metrics[0].sidebar,metrics[2].sidebar);assert.equal(metrics[0].header,metrics[2].header);assert(Math.abs(metrics[0].footerBottom-metrics[2].footerBottom)<3);}
   for(const page of ['settings','logs','help','search']){await p.click('#module-nav [data-page='+page+']');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);}
   if(width===1536){await p.screenshot({path:'tests/evidence/hero-coordi-ui-2265.png'});}
   sizes.push({width,height,metrics});
  }
  await p.goto(base+'coordi.html');await p.click('[data-page=settings]');await p.click('#configure-api');await p.selectOption('#settings-speed','fast');await p.click('#save-api-settings');await p.selectOption('#startup-view','coordi');
  await p.goto(base+'demo.html?app=union');await p.click('[data-page=settings]');assert((await p.textContent('#speed-state')).includes('고속'));assert.equal(await p.inputValue('#startup-view'),'coordi');
  await p.click('#apply-startup');await p.waitForURL('**/coordi.html?*');await p.click('[data-page=settings]');assert((await p.textContent('#speed-state')).includes('고속'));assert.equal(await p.inputValue('#startup-view'),'coordi');
  assert.deepEqual(errors,[]);await fs.writeFile('tests/evidence/coordi-parity-2265.json',JSON.stringify({sizes,sharedSettingsAcrossTools:true,errors},null,2)+'\n');console.log(JSON.stringify({sizes:sizes.length,sharedSettingsAcrossTools:true,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
