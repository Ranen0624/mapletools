const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const p=await browser.newPage({reducedMotion:'reduce'}),base=process.argv[2]||'http://127.0.0.1:8778/',checks=[];
 try{
  for(const [width,height] of [[320,740],[390,844],[1100,700],[1200,740],[1536,930]]){
   await p.setViewportSize({width,height});await p.goto(base+'index.html');
   assert.equal(await p.locator('.character-plane').count(),3);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
   const hero=p.locator('.character-plane-three a');assert((await hero.getAttribute('href')).startsWith('coordi.html'));
   assert(await hero.locator('.art-title').isVisible());
   await p.screenshot({path:`tests/evidence/hero-${width}.png`});
   let reference;
   await p.goto(base+'demo.html?app=union&embedded=1');await p.locator('#app-shell').waitFor();
   reference=await p.locator('.pc-sidebar').evaluate(e=>e.getBoundingClientRect().width);
   await p.goto(base+'coordi.html?embedded=1');await p.locator('#coordi-example').click();
   assert.equal(await p.locator('.coordi-art').evaluate(e=>e.getBoundingClientRect().width),reference);
   assert.equal(await p.locator('#module-nav button').count(),5);
   const titleY=(await p.locator('.pc-titlebar').boundingBox()).y;
   await p.locator('.coordi-conditions').evaluate(e=>e.scrollTop=10000);
   assert.equal((await p.locator('.pc-titlebar').boundingBox()).y,titleY);
   if(width>900){assert(await p.locator('.coordi-art .art-title').isVisible());assert.equal(await p.evaluate(()=>document.documentElement.scrollHeight-innerHeight),0);}
   await p.click('#coordi-search');assert.equal(await p.locator('#coordi-rows tr').count(),3);
   for(const page of ['settings','help','logs','results','search']){await p.click(`[data-page=${page}]`);assert.equal(await p.locator(`[data-page=${page}]`).getAttribute('aria-current'),'page');}
   assert.equal(await p.inputValue('#coordi-query'),'별빛 베레모, 은하 로브, 별구름 헤어');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
   checks.push({width,height,sidebarWidth:reference,threeHeroCards:true,fixedHeader:true,allNavigation:true});
  }
  await fs.writeFile('tests/evidence/coordi-layout-report.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify(checks));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
