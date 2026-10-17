const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),p=await browser.newPage();try{
for(const width of [320,390,1100,1440,1920]){
await p.setViewportSize({width,height:1000});await p.goto((process.argv[2]||'http://127.0.0.1:8778/')+'?v=home-refresh-1');await p.emulateMedia({reducedMotion:'reduce'});
assert.deepEqual(await p.locator('[data-feature]').evaluateAll(es=>es.slice(0,3).map(e=>e.dataset.feature)),['search','union','coordi']);
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
assert.equal(await p.locator('main>section').count(),7);
const colors=await p.locator('.homepage-section').evaluateAll(es=>es.map(e=>getComputedStyle(e).backgroundColor));assert.equal(colors.length,6);for(let i=1;i<colors.length;i++)assert.notEqual(colors[i],colors[i-1]);
await p.locator('#features').scrollIntoViewIfNeeded();await p.screenshot({path:`tests/evidence/hero-refresh-features-${width}.png`});
for(const key of ['union','coordi','audit','statistics','history','save']){await p.locator(`[data-feature=${key}]`).click();assert.equal(await p.locator('#feature-panel>p:not(.eyebrow)>br').count(),1);}
await p.locator('#android').scrollIntoViewIfNeeded();await p.screenshot({path:`tests/evidence/hero-refresh-android-${width}.png`});
if(width===1440){await p.screenshot({path:'tests/evidence/hero-refresh-full.png',fullPage:true});}
console.log(JSON.stringify({width,overflow:false,primaryOrder:true,alternatingSections:true}));
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
