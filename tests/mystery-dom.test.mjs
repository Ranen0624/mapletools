import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as core from '../mystery-core.js';
const html=await readFile(new URL('../mystery.html',import.meta.url),'utf8');
const code=(await readFile(new URL('../mystery.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
const flush=()=>new Promise(r=>setTimeout(r,0));
const row=(n=0,extra={})=>({name:'검증전용'+n,world:'루나',job:'아델',level:290+Math.min(n,10),combat:100+n,observedAt:'2026-10-19',...extra});
async function setup(source=core.emptySnapshot(),url='https://example.test/mystery.html',detail=async()=>null) {
  const dom=new JSDOM(html,{url,runScripts:'outside-only'}),w=dom.window;
  Object.assign(w,core,{TextDecoder,loadCharacterDetail:detail,loadRankingSource:async options=>{if(source instanceof Error) throw source;return typeof source==='function'?source(options):source;}});
  const dialog=w.document.getElementById('outfit-dialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new w.Event('close'));};
  w.eval(code); await flush(); return dom;
}
test('public empty page shows three uncollected places and no images or values',async()=>{
  const dom=await setup(),d=dom.window.document;
  assert.equal(d.querySelectorAll('.uncollected').length,3); assert.equal(d.querySelectorAll('.portrait img').length,0);
  assert.match(d.getElementById('snapshot-date').textContent,/미수집/); assert.match(d.getElementById('data-status').textContent,/미수집/); dom.window.close();
});

test('finished candidate lookup distinguishes calculation holds and API errors from active collection',async()=>{
  const s={...core.prepareSnapshot([row()]),collection:{state:'scanned',verified:1,candidates:4,pending:0,calculating:0,unverified:2,failed:1}};
  const dom=await setup(s),d=dom.window.document;
  const progress=d.getElementById('snapshot-progress').textContent;
  assert.match(progress,/후보 조회 완료/);assert.match(progress,/검증 보류/);assert.match(progress,/조회 오류/);
  assert.doesNotMatch(progress,/수집 중/);
  assert.match(d.getElementById('coverage-note').textContent,/일부 수집·검증/);
  dom.window.close();
});

test('fixed API daily records are labelled separately from legacy dates',async()=>{
  const s={...core.prepareSnapshot([row()],{coverage:{api_mode:'dated'}}),preferredApiMode:'dated',availableDates:['2026-10-20','2026-10-19'],availableDateModes:{'2026-10-20':'legacy','2026-10-19':'dated'}};
  const dom=await setup(s),d=dom.window.document;
  assert.match(d.getElementById('snapshot-date').textContent,/2026-10-19 · API 일일 기록/);
  assert.match(d.getElementById('snapshot-basis').textContent,/분 단위 시점 지정 미지원/);
  assert.match(d.getElementById('data-date').textContent,/최신 일일 기록/);
  assert.match(d.getElementById('data-date').textContent,/2026-10-20 · 이전 수집본/);
  dom.window.close();
});

test('owned Android basis and manual equip condition are visible with the original API power',async()=>{
 const calculation={basis:'preset',api_combat:100,baseline_combat:100,presets:{equipment:2,hyper:1,ability:1,union:1},version:'preset-api-v5',observed_at:'2026-10-20T07:00:00Z',combinations:1,configuration_scope:'presets-and-owned-android',android:{name:'검증용 안드로이드',source_preset:1,manual_equip:true}};
 const dom=await setup(core.prepareSnapshot([row(0,{combat:200,calculation})])),d=dom.window.document;
 assert.match(d.getElementById('coverage-note').textContent,/안드로이드 장착 조합 포함/);
 assert.match(d.getElementById('snapshot-basis').textContent,/직접 장착/);
 assert.match(d.querySelector('#podium-1 .combat-caption').textContent,/조합 계산/);
 d.querySelector('#podium-1 .name-button').click();await flush();
 assert.match(d.getElementById('profile-facts').textContent,/검증용 안드로이드/);
 assert.match(d.getElementById('profile-facts').textContent,/직접 장착/);
 assert.match(d.getElementById('profile-facts').textContent,/API 착용 전투력100/);
 dom.window.close();
});

test('combat-only ranking explains an excluded hunting preset alongside the larger equipped API value',async()=>{
 const calculation={basis:'preset',api_combat:100,baseline_combat:100,presets:{equipment:2,hyper:1,ability:1,union:1},version:'preset-api-v14',observed_at:'2026-10-22T07:00:00Z',combinations:1,
   equipment_policy:'exclude-training-presets-v1',active_equipment_preset:1,excluded_equipment_presets:[{preset:1,items:['정령의 펜던트']}]};
 const dom=await setup(core.prepareSnapshot([row(0,{combat:90,calculation})])),d=dom.window.document;
 assert.match(d.getElementById('snapshot-basis').textContent,/사냥 장비 프리셋은 제외/);
 d.querySelector('#podium-1 .name-button').click();await flush();
 assert.match(d.getElementById('profile-presets').textContent,/사냥 프리셋 1 제외/);
 assert.match(d.getElementById('profile-facts').textContent,/API 착용 전투력100/);dom.window.close();
});

test('loading a new date is explicitly pending until verified data arrives; no fake winners appear',async()=>{
 let resolve;
 const dom=await setup(()=>new Promise(r=>resolve=r)),d=dom.window.document;
 assert.equal(d.getElementById('result-section').getAttribute('aria-busy'),'true');
 assert.match(d.querySelector('#podium-1 .character-name').textContent,/기록 확인 중/);
 assert.match(d.getElementById('rank-rows').textContent,/불러오는 중/);
 assert.equal(d.querySelectorAll('.portrait img').length,0);
 resolve(core.prepareSnapshot([row()]));await flush();
 assert.equal(d.getElementById('result-section').getAttribute('aria-busy'),'false');
 assert.match(d.getElementById('podium-1').textContent,/검증전용0/);
 assert.equal(d.querySelectorAll('.uncollected').length,2);dom.window.close();
});
test('populated rendering, lower ranks, text safety and job/world filters',async()=>{
  const s=core.prepareSnapshot(Array.from({length:12},(_,i)=>row(i,{name:i===11?'<img src=x onerror=alert(1)>':'검증전용'+i})));
  const dom=await setup(s),w=dom.window,d=w.document;
  assert.equal(d.getElementById('podium-1').querySelector('h3').textContent,'<img src=x onerror=alert(1)>');
  assert.equal(d.querySelectorAll('.portrait img').length,0); assert.equal(d.querySelectorAll('#rank-rows tr').length,7);
  d.getElementById('min-level').value='290';d.getElementById('max-level').value='290';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
  assert.equal(d.querySelectorAll('.uncollected').length,2); assert.match(w.location.search,/max=290/);
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
  const dom=await setup(core.emptySnapshot(),'https://example.test/mystery.html?min=299&max=290'),w=dom.window,d=w.document;
  assert.equal(d.getElementById('min-level').value,'290'); assert.match(d.getElementById('feedback').textContent,/올바르지/);
  d.getElementById('min-level').value='300';d.getElementById('max-level').value='290';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.match(d.getElementById('feedback').textContent,/최소/);
  d.getElementById('min-level').value='290';d.getElementById('share-btn').click();await flush();assert.equal(d.getElementById('share-fallback').hidden,false);assert.match(d.getElementById('share-url').value,/min=290/);dom.window.close();
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
test('old 280 links are clamped to 290 and a named Eos link infers its group',async()=>{
  const dom=await setup(core.emptySnapshot(),'https://example.test/mystery.html?min=280&max=300&world=%EC%97%90%EC%98%A4%EC%8A%A4');
  const d=dom.window.document;assert.equal(d.getElementById('min-level').value,'290');assert.equal(d.getElementById('world-group').value,'eos-helios');assert.equal(d.getElementById('world').value,'에오스');assert.match(d.getElementById('feedback').textContent,/290/);dom.window.close();
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
    collection:{state:'collecting',verified:1000,candidates:10000,pending:8000,calculating:100,unverified:899,failed:1},selectionCounts:{290:200,291:30,292:2}};
  const dom=await setup(source),d=dom.window.document;
  assert.match(d.getElementById('data-status').textContent,/수집본 내 순위/);
  assert.match(d.getElementById('snapshot-progress').textContent,/수집 1,000명.*수집 중/);
  assert.match(d.getElementById('snapshot-exclusions').textContent,/전체 대기 8,000명.*계산 중 100명.*검증 보류 899명.*조회 오류 1건/);
  assert.match(d.getElementById('result-subtitle').textContent,/확인된 232명/);
  assert.equal(d.querySelectorAll('.uncollected').length,0); dom.window.close();
});

test('date selector keeps the chosen snapshot in shared links and missing dates stay empty',async()=>{
  const date='2026-10-19';
  const dom=await setup(({options})=>options.date==='2026-10-18'?{...core.prepareSnapshot([],{date:'2026-10-18'}),availableDates:[date],uncollectedDate:true}:{...core.prepareSnapshot([row()]),availableDates:[date]});
  const w=dom.window,d=w.document;
  assert.equal(d.getElementById('data-date').options.length,2);
  d.getElementById('share-btn').click();await flush();
  assert.match(d.getElementById('share-url').value,/date=2026-10-19/);
  d.getElementById('data-date').add(new w.Option('2026-10-18','2026-10-18'));d.getElementById('data-date').value='2026-10-18';
  d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
  assert.equal(d.querySelectorAll('.uncollected').length,3);assert.match(d.getElementById('coverage-note').textContent,/선택한 날짜는 미수집/);
  dom.window.close();
});

test('official outfit opens an accessible larger view and can be closed',async()=>{
  const dom=await setup(core.prepareSnapshot([row(0,{image:'https://open.api.nexon.com/static/maplestory/character/look/VALIDATION_ONLY'})]));
  const d=dom.window.document,dialog=d.getElementById('outfit-dialog');
  d.querySelector('#podium-1 button.portrait').click();
  assert.equal(dialog.open,true);assert.match(d.getElementById('outfit-title').textContent,/검증전용0/);
  assert.equal(d.getElementById('outfit-image').src,d.querySelector('.portrait img').src);
  d.getElementById('outfit-close').click();assert.equal(dialog.open,false);dom.window.close();
});

test('preset scores show their selected combinations and excluded job queries clear the podium',async()=>{
  const calculation={basis:'preset',api_combat:100,baseline_combat:100,presets:{equipment:1,hyper:2,ability:3,union:5},version:'preset-api-v1',observed_at:'2026-10-20T07:00:00Z',combinations:90};
  const s=core.prepareSnapshot([row(0,{combat:200,calculation})]);
  const dom=await setup({...s,availableJobs:['제논','데몬어벤져','아델']}),d=dom.window.document,w=dom.window;
  assert.match(d.querySelector('#podium-1 .combat-caption').textContent,/프리셋 계산/);
  assert.match(d.querySelector('#podium-1 .preset-info').textContent,/장비 1.*하이퍼 2.*어빌 3.*유니온 5/);
  assert.equal([...d.querySelectorAll('#mystery-job-list option')].some(o=>['제논','데몬어벤져'].includes(o.value)),false);
  d.getElementById('job').value='제논';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
  assert.equal(d.querySelectorAll('.uncollected').length,3);assert.match(d.getElementById('coverage-note').textContent,/집계에서 제외/);dom.window.close();
});

test('every TOP 10 name opens details, real item text is safe, and previous/next uses the selected ranking',async()=>{
  const source=core.prepareSnapshot(Array.from({length:10},(_,i)=>row(i)));
  const dom=await setup(source,undefined,async()=>({gender:'여',guild:'테스트길드',outfit_source:'preset',cash_preset:2,items:[{slot:'모자',name:'<img src=x onerror=alert(1)>',label:'스페셜라벨'}]}));
  const d=dom.window.document;
  assert.equal(d.querySelectorAll('.name-button').length,10);
  const fourth=d.querySelector('#rank-rows .name-button');fourth.focus();fourth.click();await flush();
  assert.match(d.getElementById('profile-rank').textContent,/4위/);assert.match(d.getElementById('profile-subtitle').textContent,/아델.*루나/);
  assert.equal(d.getElementById('outfit-title').textContent,'검증전용6');assert.equal(d.getElementById('profile-power').textContent,'106');
  assert.match(d.getElementById('profile-facts').textContent,/테스트길드/);assert.match(d.getElementById('profile-outfit-preset').textContent,/프리셋 2/);
  assert.equal(d.querySelector('#profile-outfit-items strong').textContent,'<img src=x onerror=alert(1)>');assert.equal(d.querySelectorAll('#profile-outfit-items img').length,0);
  d.getElementById('profile-next').click();await flush();assert.match(d.getElementById('profile-rank').textContent,/5위/);
  d.getElementById('profile-prev').click();await flush();assert.match(d.getElementById('profile-rank').textContent,/4위/);
  d.getElementById('outfit-close').click();assert.equal(d.activeElement,fourth);assert.equal(d.body.classList.contains('profile-open'),false);dom.window.close();
});

test('a slow detail response never replaces another character, and missing/error states are distinct',async()=>{
  const pending=[],dom=await setup(core.prepareSnapshot([row(),row(1)]),undefined,()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
  const d=dom.window.document;d.querySelector('#podium-1 .name-button').click();d.getElementById('profile-next').click();
  pending[1].resolve(null);await flush();assert.match(d.getElementById('profile-detail-status').textContent,/미수집/);
  pending[0].resolve({gender:'여',guild:'SHOULD_NOT_APPEAR',items:[],outfit_source:'base'});await flush();assert.equal(d.getElementById('profile-facts').textContent.includes('SHOULD_NOT_APPEAR'),false);
  d.getElementById('profile-prev').click();pending[2].reject(new Error('private diagnostic'));await flush();
  assert.match(d.getElementById('profile-detail-status').textContent,/불러오지 못/);assert.equal(d.body.textContent.includes('private diagnostic'),false);
  d.querySelector('.detail-retry').click();pending[3].resolve(null);await flush();assert.match(d.getElementById('profile-detail-status').textContent,/미수집/);dom.window.close();
});

test('personal CSV older than seven days provides date-isolated statistics without fetching public rankings',async()=>{
  let requests=0;const dom=await setup(()=>{requests++;return core.emptySnapshot();}),w=dom.window,d=w.document;
  const csv='닉네임,월드,직업,레벨,전투력,기준일\n기록하나,루나,아델,290,100,2020-01-01\n기록둘,루나,아델,291,300,2020-01-01\n기록하나,루나,아델,292,500,2020-01-02';
  const file={name:'old.csv',size:new TextEncoder().encode(csv).length,arrayBuffer:async()=>new TextEncoder().encode(csv).buffer};
  Object.defineProperty(d.getElementById('csv-input'),'files',{value:[file]});d.getElementById('import-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();await flush();
  assert.equal(d.getElementById('local-analysis').hidden,false);assert.match(d.getElementById('analysis-metrics').textContent,/500/);assert.equal(d.getElementById('snapshot-date').textContent,'2020-01-02');
  d.getElementById('data-date').value='2020-01-01';d.getElementById('mystery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
  assert.deepEqual([...d.querySelectorAll('#analysis-metrics dd')].map(e=>e.textContent),['2명','300','200','200']);
  assert.equal(d.getElementById('snapshot-date').textContent,'2020-01-01');assert.equal(requests,1);assert.match(d.getElementById('history-retention').textContent,/관계없이/);
  d.getElementById('public-reset').click();await flush();assert.equal(requests,2);assert.equal(d.getElementById('local-analysis').hidden,true);dom.window.close();
});

test('shared site navigation, exclusion explanation and filter reset are usable on the ranking page',async()=>{
  const dom=await setup(core.emptySnapshot(),'https://example.test/mystery.html?min=295&max=299&group=eos-helios&job=렌'),d=dom.window.document;
  assert.equal(d.querySelector('header.site-header #main-nav a[aria-current=page]').textContent,'명예의 전당');assert.match(d.querySelector('.scope-explanation').textContent,/API.*현재 착용 전투력.*사냥 세팅.*정확도/s);
  d.getElementById('filter-reset').click();await flush();assert.equal(d.getElementById('min-level').value,'290');assert.equal(d.getElementById('max-level').value,'300');assert.equal(d.getElementById('job').value,'');assert.equal(d.getElementById('world-group').value,'regular');
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');dom.window.matchMedia=()=>({matches:true,addEventListener(){}});dom.window.IntersectionObserver=class{observe(){} disconnect(){}};dom.window.eval(app);
  const toggle=d.querySelector('.menu-toggle');toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');d.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(toggle.getAttribute('aria-expanded'),'false');dom.window.close();
});
