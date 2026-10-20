import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as core from '../mystery-core.js';
const html=await readFile(new URL('../mystery.html',import.meta.url),'utf8');
const code=(await readFile(new URL('../mystery.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
const flush=()=>new Promise(r=>setTimeout(r,0));
const row=(n=0,extra={})=>({name:'검증전용'+n,world:'루나',job:'아델',level:285+n,combat:100+n,observedAt:'2026-10-19',...extra});
async function setup(source=core.emptySnapshot(),url='https://example.test/mystery.html') {
  const dom=new JSDOM(html,{url,runScripts:'outside-only'}),w=dom.window;
  Object.assign(w,core,{TextDecoder,loadRankingSource:async options=>{if(source instanceof Error) throw source;return typeof source==='function'?source(options):source;}});
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
  d.getElementById('min-level').value='285';d.getElementById('max-level').value='285';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
  assert.equal(d.querySelectorAll('.uncollected').length,2); assert.match(w.location.search,/max=285/);
  d.getElementById('job').value='비숍';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(d.querySelectorAll('.uncollected').length,3);
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
  const dom=await setup(core.emptySnapshot(),'https://example.test/mystery.html?min=299&max=285'),w=dom.window,d=w.document;
  assert.equal(d.getElementById('min-level').value,'285'); assert.match(d.getElementById('feedback').textContent,/올바르지/);
  d.getElementById('min-level').value='300';d.getElementById('max-level').value='285';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.match(d.getElementById('feedback').textContent,/최소/);
  d.getElementById('min-level').value='285';d.getElementById('share-btn').click();await flush();assert.equal(d.getElementById('share-fallback').hidden,false);assert.match(d.getElementById('share-url').value,/min=285/);dom.window.close();
});
test('local JSON preview never uploads or changes public data; reset clears it',async()=>{
  const dom=await setup(),w=dom.window,d=w.document;
  const data=JSON.stringify([row()]);const file={name:'validation-only.json',size:data.length,arrayBuffer:async()=>new TextEncoder().encode(data).buffer};
  Object.defineProperty(d.getElementById('csv-input'),'files',{value:[file]});
  d.getElementById('import-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();await flush();
  assert.equal(d.getElementById('local-notice').hidden,false); assert.match(d.getElementById('data-status').textContent,/내 파일/);
  d.getElementById('public-reset').click();await flush();assert.equal(d.getElementById('local-notice').hidden,true);assert.equal(d.querySelectorAll('.uncollected').length,3);dom.window.close();
});
test('world category changes rebuild the selector and persist distinct ranking scopes',async()=>{
  const s=core.prepareSnapshot([row(),row(1,{world:'에오스',combat:999}),row(2,{world:'핼리오스'}),row(3,{world:'챌린저스4'})]);
  const dom=await setup(s),w=dom.window,d=w.document;
  assert.equal(d.getElementById('podium-1').querySelector('h3').textContent,'검증전용0');
  assert.equal([...d.getElementById('world').options].some(o=>o.value==='에오스'),false);
  d.getElementById('world-group').value='eos-helios';d.getElementById('world-group').dispatchEvent(new w.Event('change'));
  assert.deepEqual([...d.getElementById('world').options].map(o=>o.value),['','에오스','핼리오스']);
  d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
  assert.equal(d.getElementById('podium-1').querySelector('h3').textContent,'검증전용1');assert.match(w.location.search,/group=eos-helios/);
  d.getElementById('world-group').value='regular';d.getElementById('world-group').dispatchEvent(new w.Event('change'));assert.equal(d.getElementById('world').value,'');dom.window.close();
});
test('old 280 links are clamped to 285 and a named Eos link infers its group',async()=>{
  const dom=await setup(core.emptySnapshot(),'https://example.test/mystery.html?min=280&max=300&world=%EC%97%90%EC%98%A4%EC%8A%A4');
  const d=dom.window.document;assert.equal(d.getElementById('min-level').value,'285');assert.equal(d.getElementById('world-group').value,'eos-helios');assert.equal(d.getElementById('world').value,'에오스');assert.match(d.getElementById('feedback').textContent,/285/);dom.window.close();
});

test('a pending public query cannot display winners for changed conditions or replace a newer query',async()=>{
  const requests=[];
  const dom=await setup(options=>new Promise(resolve=>requests.push({options,resolve}))),w=dom.window,d=w.document;
  d.getElementById('job').value='아델'; requests[0].resolve(core.prepareSnapshot([row()])); await flush();
  assert.equal(d.querySelectorAll('.uncollected').length,3); assert.match(d.getElementById('feedback').textContent,/조건이 바뀌/);
  d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  d.getElementById('job').value='비숍';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  requests[2].resolve(core.prepareSnapshot([row(1,{job:'비숍'})])); await flush();
  requests[1].resolve(core.prepareSnapshot([row()])); await flush();
  assert.equal(d.getElementById('podium-1').querySelector('h3').textContent,'검증전용1');
  assert.equal(requests[2].options.options.job,'비숍'); dom.window.close();
});

test('interim data shows actual population and unfinished collection above the podium',async()=>{
  const source={...core.prepareSnapshot([row(),row(1),row(2)]),
    collection:{state:'collecting',verified:1000,candidates:10000,pending:8000},selectionCounts:{285:200,286:30,287:2}};
  const dom=await setup(source),d=dom.window.document;
  assert.match(d.getElementById('data-status').textContent,/수집 진행 중 · 중간 수집본/);
  assert.match(d.getElementById('snapshot-progress').textContent,/API 대상 1,000명.*미조회 8,000명/);
  assert.match(d.getElementById('result-subtitle').textContent,/확인된 232명/);
  assert.equal(d.querySelectorAll('.uncollected').length,0); dom.window.close();
});
