const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const base=process.argv[2]||'http://127.0.0.1:8778/';
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const p=await browser.newPage(),errors=[],report=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  for(const width of [320,390,1100,1440,1920]){
   await p.setViewportSize({width,height:1000});await p.goto(base+'?v=ui-2266-1');
   const label=p.locator('.scene-label');assert.equal(await label.textContent(),'MY MAPLESTORY.');
   assert.equal(await label.evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');
   await p.locator('.android-art').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('.android-art').dataset.awake==='true');
   const phone=p.locator('.phone');await p.waitForTimeout(100);
   assert.equal(await phone.evaluate(e=>getComputedStyle(e).animationName),'phone-hover');
   // Sample both extreme animation poses, including the rotated corners.
   for(const time of [0,3500]){
    await phone.evaluate((e,t)=>{const a=e.getAnimations()[0];a.pause();a.currentTime=t;},time);
    const b=await phone.boundingBox(),area=await p.locator('.android-art').boundingBox();
    assert(b.y>=area.y&&b.y+b.height<=area.y+area.height,`phone vertical bounds ${width}`);
    assert(b.x>=0&&b.x+b.width<=width,`phone viewport bounds ${width}`);
   }
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
   await p.screenshot({path:`tests/evidence/hero-phone-${width}.png`});
   await p.locator('.creator-credit').scrollIntoViewIfNeeded();
   assert.match(await p.locator('.creator-credit').innerText(),/케페우스[\s\S]*미호/);
   await p.screenshot({path:`tests/evidence/hero-credit-${width}.png`});
   await p.locator('#motion-toggle').click();await p.locator('.android-art').scrollIntoViewIfNeeded();
   assert.equal(await phone.evaluate(e=>getComputedStyle(e).animationName),'none');
   report.push({width,phoneUnclipped:true,subtleFloat:true,manualPause:true,credit:true});
  }
  await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base);await p.locator('.android-art').scrollIntoViewIfNeeded();
  assert.equal(await p.locator('.phone').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.deepEqual(errors,[]);
  await fs.writeFile('tests/evidence/visual-polish-2266.json',JSON.stringify({report,reducedMotion:true,errors},null,2)+'\n');
  console.log(JSON.stringify({sizes:report.length,allChecks:true,reducedMotion:true,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
