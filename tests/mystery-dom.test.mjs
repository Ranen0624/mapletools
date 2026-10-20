import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as core from '../mystery-core.js';
const html=await readFile(new URL('../mystery.html',import.meta.url),'utf8');
const code=(await readFile(new URL('../mystery.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
const flush=()=>new Promise(r=>setTimeout(r,0));
const row=(n=0,extra={})=>({name:'검증전용'+n,world:'루나',job:'아델',level:280+n,combat:100+n,observedAt:'2026-10-19',...extra});
async function setup(source=core.emptySnapshot(),url='https://example.test/mystery.html') {
  const dom=new JSDOM(html,{url,runScripts:'outside-only'}),w=dom.window;
  Object.assign(w,core,{TextDecoder,loadRankingSource:async()=>{if(source instanceof Error) throw source;return source;}});
  w.eval(code); await flush(); return dom;
}
test('public empty page shows three uncollected places and no images or values',async()=>{
  const dom=await setup(),d=dom.window.document;
  assert.equal(d.querySelectorAll('.uncollected').length,3); assert.equal(d.querySelectorAll('.portrait img').length,0);
  assert.match(d.getElementById('snapshot-date').textContent,/미수집/); assert.match(d.getElementById('data-status').textContent,/미수집/); dom.window.close();
});
test('populated rendering, lower ranks, text safety and job/world filters',async()=>{
  const s=core.prepareSnapshot(Array.from({length:12},(_,i)=>row(i,{name:i===11?'<img src=x onerror=alert(1)>':'검증전용'+i})));
  const dom=await setup(s),w=dom.window,d=w.document;
  assert.equal(d.getElementById('podium-1').querySelector('h3').textContent,'<img src=x onerror=alert(1)>');
  assert.equal(d.querySelectorAll('.portrait img').length,0); assert.equal(d.querySelectorAll('#rank-rows tr').length,7);
  d.getElementById('min-level').value='280';d.getElementById('max-level').value='280';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  assert.equal(d.querySelectorAll('.uncollected').length,2); assert.match(w.location.search,/max=280/);
  d.getElementById('job').value='비숍';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(d.querySelectorAll('.uncollected').length,3);
  dom.window.close();
});
test('official image and broken-image notice; no invented avatar',async()=>{
  const dom=await setup(core.prepareSnapshot([row(0,{image:'https://open.api.nexon.com/static/maplestory/character/look/VALIDATION_ONLY'})]));
  const img=dom.window.document.querySelector('.portrait img'); assert.match(img.src,/open.api.nexon.com/); img.dispatchEvent(new dom.window.Event('error'));
  assert.match(dom.window.document.querySelector('#podium-1 .portrait').textContent,/이미지 확인 불가/); dom.window.close();
});
test('load failure is distinct from uncollected and contains no previous winners',async()=>{
  const dom=await setup(new Error('private internal error'));
  assert.match(dom.window.document.getElementById('data-status').textContent,/연결 실패/);
  assert.equal(dom.window.document.body.textContent.includes('private internal error'),false); assert.equal(dom.window.document.querySelectorAll('.uncollected').length,3);dom.window.close();
});
test('invalid deep link and reversed form range are visible errors; clipboard fallback works',async()=>{
  const dom=await setup(core.emptySnapshot(),'https://example.test/mystery.html?min=299&max=280'),w=dom.window,d=w.document;
  assert.equal(d.getElementById('min-level').value,'280'); assert.match(d.getElementById('feedback').textContent,/올바르지/);
  d.getElementById('min-level').value='300';d.getElementById('max-level').value='280';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.match(d.getElementById('feedback').textContent,/최소/);
  d.getElementById('min-level').value='280';d.getElementById('share-btn').click();await flush();assert.equal(d.getElementById('share-fallback').hidden,false);assert.match(d.getElementById('share-url').value,/min=280/);dom.window.close();
});
test('local JSON preview never uploads or changes public data; reset clears it',async()=>{
  const dom=await setup(),w=dom.window,d=w.document;
  const data=JSON.stringify([row()]);const file={name:'validation-only.json',size:data.length,arrayBuffer:async()=>new TextEncoder().encode(data).buffer};
  Object.defineProperty(d.getElementById('csv-input'),'files',{value:[file]});
  d.getElementById('import-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
  assert.equal(d.getElementById('local-notice').hidden,false); assert.match(d.getElementById('data-status').textContent,/내 파일/);
  d.getElementById('public-reset').click();await flush();assert.equal(d.getElementById('local-notice').hidden,true);assert.equal(d.querySelectorAll('.uncollected').length,3);dom.window.close();
});
