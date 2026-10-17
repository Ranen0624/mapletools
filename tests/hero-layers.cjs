const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{const base=process.argv[2]||'http://127.0.0.1:8778/',browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),p=await browser.newPage(),errors=[],report=[];p.on('pageerror',e=>errors.push(e.message));try{
 for(const [width,height] of [[320,740],[390,844],[1100,800],[1200,740],[1440,1000]]){
  await p.setViewportSize({width,height});await p.goto(base+'?v=hero-layers-1');await p.locator('.character-scene').scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>[...document.querySelectorAll('.character-plane img')].every(i=>i.complete&&i.naturalWidth));
  assert.equal(await p.locator('.hero-title img').count(),3);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
  for(const card of await p.locator('.character-plane').all()){
   await p.mouse.move(0,0);await p.waitForTimeout(450);
   const rect=await card.boundingBox(),scene=await p.locator('.character-scene').boundingBox();
   assert(rect.x>=scene.x-1&&rect.x+rect.width<=scene.x+scene.width+1,`card bounds ${width}`);
   // Hover the exposed upper portion of each card, including overlapped side cards.
   await card.hover({position:{x:rect.width*.45,y:100}});await p.waitForTimeout(500);
   assert.equal(await card.evaluate(e=>getComputedStyle(e).zIndex),'8');
   assert.notEqual(await card.locator('.hero-title').evaluate(e=>getComputedStyle(e).transform),'matrix(1, 0, 0, 1, 0, 0)');
   const hovered=await card.boundingBox();assert(hovered.x>=0&&hovered.x+hovered.width<=width,`hover bounds ${width}`);
  }
  await p.mouse.move(0,0);await p.waitForTimeout(450);await p.screenshot({path:`tests/evidence/hero-layers-${width}.png`});
  for(const url of ['demo.html?app=union&embedded=1','demo.html?app=detailed&embedded=1','coordi.html?embedded=1']){
   await p.goto(base+url);await p.locator('.pc-titlebar').waitFor();
   const offsets=await p.locator('.app-switch>:is(button,a)').evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect(),i=e.querySelector('img').getBoundingClientRect();return [Math.abs(b.x+b.width/2-i.x-i.width/2),Math.abs(b.y+b.height/2-i.y-i.height/2)];}));
   assert(offsets.every(x=>x.every(v=>v<.6)),JSON.stringify({width,url,offsets}));
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
  }
  report.push({width,height,unclippedCards:true,hoverFront:true,independentTitleMotion:true,centeredIcons:true});
 }
 await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base);await p.locator('.character-scene').scrollIntoViewIfNeeded();const c=p.locator('.character-plane-three');await c.hover();await p.waitForTimeout(100);assert.equal(await c.locator('.hero-title').evaluate(e=>getComputedStyle(e).transform),'none');
 assert.deepEqual(errors,[]);await fs.writeFile('tests/evidence/hero-layers-report.json',JSON.stringify({report,reducedMotion:true,errors},null,2)+'\n');console.log(JSON.stringify({sizes:report.length,allChecks:true,reducedMotion:true,errors}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

