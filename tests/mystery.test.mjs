// Synthetic inputs exist only inside automated validation; never public feed rows.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {emptySnapshot,prepareSnapshot,validateSnapshot,parseImport,filterRank,imageAllowed,collectionStatus,snapshotCSV,validDate,MAX_CSV_BYTES,worldGroup,AMMUNITION_LIMITATION,ammunitionHoldNotice,AMMUNITION_POLICY} from '../mystery-core.js';
import {loadRankingSource} from '../mystery-source.js';
import {importFile} from '../scripts/import-mystery.mjs';
const row=(n=0,extra={})=>({name:'검증전용'+n,world:'루나',job:'아델',level:290+n,combat:100+n,image:'',observedAt:'2026-10-19',...extra});

test('v18 selects the exact max of API and assumed presets, preserving mismatch and API-only zero through CSV',()=>{
  const make=(api,candidate)=>({basis:'preset',version:'preset-api-v18',observed_at:'2026-10-24T00:00:00Z',
    api_combat:api,preset_combat:candidate,baseline_combat:90,baseline_status:api===90?'matched':'mismatch',
    selection_policy:'api-or-calculated-maximum-v1',selected_source:candidate!==null&&candidate>api?'preset':'api',
    search_complete:candidate!==null,review_reasons:[],presets:candidate===null?null:{equipment:2,hyper:1,ability:1,union:1},combinations:candidate===null?0:1,
    equipment_policy:'exclude-training-presets-v1',active_equipment_preset:null,excluded_equipment_presets:[],
    configuration_scope:'presets-owned-android-cash-plus',cash_effect_policy:'cash-base-and-confirmed-plus-v1',ammunition_policy:AMMUNITION_POLICY});
  for(const [api,candidate] of [[100,120],[120,100],[100,100],[0,null],[0,120]]) {
    const c=make(api,candidate),combat=Math.max(api,candidate??0);
    const s=prepareSnapshot([row(0,{combat,calculation:c})]);
    assert.equal(s.characters[0].combat,combat);assert.deepEqual(parseImport(snapshotCSV(s)).characters,s.characters);
    assert.equal(s.coverage.selection_policy,'api-or-calculated-maximum-v1');
    assert.throws(()=>prepareSnapshot([row(0,{combat:combat+1,calculation:c})]));
    assert.throws(()=>prepareSnapshot([row(0,{combat,calculation:{...c,selected_source:c.selected_source==='api'?'preset':'api'}})]));
  }
  const c=make(100,null);
  for(const patch of [{combinations:1},{presets:{equipment:1,hyper:1,ability:1,union:1}},{search_complete:true},{baseline_status:'matched'},{selection_policy:'unknown'}])
    assert.throws(()=>prepareSnapshot([row(0,{calculation:{...c,...patch}})]));
});

test('maximum-projectile assumptions survive CSV and reject false inventory claims or lower attack',()=>{
  const c={basis:'preset',api_combat:100,baseline_combat:100,presets:{equipment:1,hyper:1,ability:1,union:1},
    version:'preset-api-v17',observed_at:'2026-10-24T00:00:00Z',combinations:1,
    equipment_policy:'exclude-training-presets-v1',active_equipment_preset:1,excluded_equipment_presets:[],
    configuration_scope:'presets-owned-android-cash-plus',cash_effect_policy:'cash-base-and-confirmed-plus-v1',
    ammunition_policy:AMMUNITION_POLICY,ammunition:{name:'플레임 표창',attack:29,inventory_confirmed:false}};
  const s=prepareSnapshot([row(0,{job:'나이트로드',calculation:c})]);
  assert.equal(s.coverage.ammunition_policy,AMMUNITION_POLICY);
  assert.deepEqual(parseImport(snapshotCSV(s)).characters,s.characters);
  assert.throws(()=>filterRank([s.characters[0],row(1,{job:'나이트로드',calculation:{...c,version:'preset-api-v16',ammunition:undefined,ammunition_policy:undefined}})]),/탄약/);
  for(const bad of [{...c,ammunition:undefined},{...c,ammunition_policy:undefined},
    {...c,ammunition:{...c.ammunition,attack:27}},{...c,ammunition:{...c.ammunition,inventory_confirmed:true}}])
    assert.throws(()=>prepareSnapshot([row(0,{job:'나이트로드',calculation:bad})]));
  assert.throws(()=>prepareSnapshot([row(0,{job:'나이트로드',calculation:c})],{coverage:{ammunition_policy:'unknown'}}),/탄약/);
});

test('ammunition holds explain missing API evidence only for the flagged public preset snapshot',()=>{
  const coverage={combat_basis:'preset',limitations:[AMMUNITION_LIMITATION]};
  assert.match(ammunitionHoldNotice(coverage,'캡틴'),/검증을 보류/);
  assert.equal(ammunitionHoldNotice(coverage,'아델'),'');
  assert.equal(ammunitionHoldNotice(coverage,'캡틴',{local:true}),'');
  assert.equal(ammunitionHoldNotice({...coverage,combat_basis:'equipped'},'캡틴'),'');
  assert.equal(ammunitionHoldNotice({combat_basis:'preset',limitations:[]},'캡틴'),'');
});
test('empty feed never invents a winner',()=>{ const s=validateSnapshot(emptySnapshot()); assert.equal(filterRank(s.characters).length,0); assert.match(collectionStatus(s,{},0),/미수집/); });
test('inclusive level boundaries, jobs/worlds, deterministic ties and top ten',()=>{
  const rows=Array.from({length:16},(_,i)=>row(i));
  assert.equal(filterRank(rows)[0].level,300);
  assert.equal(filterRank(rows,{min:290,max:290}).length,1);
  assert.equal(filterRank(rows,{job:'비숍'}).length,0);
  assert.equal(filterRank(rows,{world:'크로아'}).length,0);
  assert.equal(filterRank(rows).slice(3,10).length,7);
  for(const options of [{min:289},{max:301},{min:299,max:290},{min:290.5}]) assert.throws(()=>filterRank(rows,options));
  const tied=[row(0,{name:'나',combat:100}),row(1,{name:'가',combat:100})];
  assert.equal(filterRank(tied)[0].name,'가');
});
test('reject rounded, unsafe, missing, invalid date and malformed images',()=>{
  for(const extra of [{combat:'1.8억'},{combat:'1,2,3'},{combat:0},{combat:Infinity},{combat:9007199254740992},{observedAt:''},{observedAt:'2026-02-30'},{observedAt:'2026-10-19T01:00:00Z'},{image:'javascript:alert(1)'},{name:''}]) assert.throws(()=>prepareSnapshot([row(0,extra)]));
  assert.equal(validDate('2024-02-29'),true); assert.equal(validDate('2026-02-29'),false);
  assert.equal(imageAllowed('https://open.api.nexon.com/static/maplestory/character/look/VALIDATION_ONLY?width=200').includes('width=200'),true);
  for(const url of ['https://open.api.nexon.com.evil.test/static/maplestory/character/look/x','https://key@open.api.nexon.com/static/maplestory/character/look/x','https://open.api.nexon.com/static/maplestory/character/look/x?api_key=hidden','data:image/png,x']) assert.equal(imageAllowed(url),'');
});
test('same-day conflicts and mixed dates fail closed; duplicates do not inflate counts',()=>{
  assert.equal(prepareSnapshot([row(),row()]).characters.length,1);
  assert.throws(()=>prepareSnapshot([row(),row(0,{combat:200})]),/충돌/);
  assert.throws(()=>prepareSnapshot([row(),row(1,{observedAt:'2026-10-18'})]),/동일한 기준일/);
  assert.throws(()=>filterRank([row(),row(1,{observedAt:'2026-10-18'})]),/기준일/);
  assert.throws(()=>prepareSnapshot([row()],{date:'2026-10-18'}),/기준일/);
});
test('CSV BOM, quotes, comma in job and exact power; no missing date guessing',()=>{
  const csv='\uFEFF닉네임,월드,직업,레벨,전투력\r\n검증전용,루나,"아크메이지(불,독)",290,"123,456"\r\n';
  assert.throws(()=>parseImport(csv),/기준일/);
  const s=parseImport(csv,{date:'2026-10-19'}); assert.equal(s.characters[0].combat,123456); assert.equal(s.characters[0].job,'아크메이지(불,독)');
  assert.throws(()=>parseImport(csv+'broken,line\n',{date:'2026-10-19'}),/열 개수/);
  assert.throws(()=>parseImport('name,name,world,job,level,combat\n'),/중복/);
  assert.throws(()=>parseImport('name,world,job,level\n'),/전투력/);
  assert.throws(()=>parseImport('x'.repeat(MAX_CSV_BYTES+1)),/5MB/);
  assert.throws(()=>parseImport('null',{format:'json'}),/배열/);
});
test('normalization allowlist drops configuration; local files always partial',()=>{
  const source={characters:[row(0,{api_key:'NEVER_PUBLISH',password:'NEVER_PUBLISH'})],api_key:'NEVER_PUBLISH',coverage:{status:'complete',data_date:'2026-10-19'}};
  const s=parseImport(JSON.stringify(source),{format:'json'});
  assert.equal(s.coverage.status,'partial'); assert.equal(JSON.stringify(s).includes('NEVER_PUBLISH'),false);
  assert.throws(()=>validateSnapshot({...s,coverage:{...s.coverage,status:'invented'}}));
});
test('scope and exhaustive claims are explicit and bounded to selected scope',()=>{
  assert.throws(()=>prepareSnapshot([row()],{coverage:{status:'complete'}}),/전체 대상 수/);
  assert.throws(()=>prepareSnapshot([row()],{coverage:{worlds:['크로아']}}),/범위 밖/);
  const s=prepareSnapshot([row()],{coverage:{status:'complete',jobs:['아델'],worlds:['루나'],expected_count:1}});
  assert.match(collectionStatus(s,{min:290,max:300,job:'아델',world:'루나'},1),/수집 완료/);
  assert.match(collectionStatus(s,{min:290,max:300,job:'',world:''},1),/일부 수집/);
  assert.equal(validateSnapshot(s).characters.length,1);
});
test('CSV export prevents formula execution',()=>{ const s=prepareSnapshot([row(0,{name:'=CHECK_ONLY'})]); assert(snapshotCSV(s).includes("'=CHECK_ONLY")); });

const calculation={basis:'preset',api_combat:100,baseline_combat:100,presets:{equipment:1,hyper:2,ability:3,union:10},version:'preset-api-v1',observed_at:'2026-10-20T07:00:00Z',combinations:270};

test('confirmed owned Android combinations preserve their basis and safe details in personal CSV',()=>{
 const owned={...calculation,version:'preset-api-v5',configuration_scope:'presets-and-owned-android',android:{name:'검증용 안드로이드',source_preset:1,manual_equip:true,secret:'NEVER_PUBLISH'}};
 const s=prepareSnapshot([row(0,{combat:200,calculation:owned})]);
 assert.equal(s.coverage.calculation_scope,'presets-and-owned-android');
 assert.deepEqual(s.characters[0].calculation.android,{name:'검증용 안드로이드',source_preset:1,manual_equip:true});
 assert.equal(JSON.stringify(s).includes('NEVER_PUBLISH'),false);
 assert.deepEqual(parseImport(snapshotCSV(s)).characters,s.characters);
 assert.deepEqual(validateSnapshot(s),s);
 assert.throws(()=>prepareSnapshot([row(0,{combat:200,calculation:owned}),row(1,{combat:200,calculation})]),/계산 기준/);
 assert.throws(()=>filterRank([row(0,{combat:200,calculation:owned}),row(1,{combat:200,calculation})]),/계산 기준/);
 for(const android of [{...owned.android,source_preset:4},{...owned.android,name:''},{...owned.android,manual_equip:'true'}])assert.throws(()=>prepareSnapshot([row(0,{combat:200,calculation:{...owned,android}})]));
});
test('preset records preserve their evidence through JSON and CSV and reject unverified or mixed bases',()=>{
  const s=prepareSnapshot([row(0,{combat:200,calculation:{...calculation,api_key:'NEVER_PUBLISH',presets:{...calculation.presets,secret:'NEVER_PUBLISH'}}})]);
  assert.equal(s.coverage.combat_basis,'preset');assert.equal(s.characters[0].calculation.api_combat,100);
  assert.equal(JSON.stringify(s).includes('NEVER_PUBLISH'),false);
  assert.deepEqual(parseImport(snapshotCSV(s)).characters,s.characters);
  assert.deepEqual(validateSnapshot(s),s);
  for(const c of [{...calculation,baseline_combat:99},{...calculation,api_combat:201,baseline_combat:201},{...calculation,combinations:271},{...calculation,presets:{...calculation.presets,union:11}},{...calculation,observed_at:'invalid'}]) assert.throws(()=>prepareSnapshot([row(0,{combat:200,calculation:c})]));
  assert.throws(()=>prepareSnapshot([row(0,{calculation}),row(1)]),/기준/);
  assert.throws(()=>prepareSnapshot([row(0,{calculation})],{coverage:{combat_basis:'equipped'}}),/기준/);
  assert.throws(()=>filterRank([row(0,{calculation}),row(1)]),/한 순위/);
});

test('combat-only equipment policy preserves exclusions and only permits a lower value for an excluded active preset',()=>{
  const c={...calculation,version:'preset-api-v14',equipment_policy:'exclude-training-presets-v1',active_equipment_preset:1,
    excluded_equipment_presets:[{preset:1,items:['스페셜 정령의 펜던트']}],presets:{...calculation.presets,equipment:2}};
  const s=prepareSnapshot([row(0,{combat:90,calculation:c})]);
  assert.equal(s.coverage.equipment_policy,'exclude-training-presets-v1');
  assert.deepEqual(parseImport(snapshotCSV(s)).characters,s.characters);
  for(const bad of [{...c,excluded_equipment_presets:[]},{...c,active_equipment_preset:2},
    {...c,presets:{...c.presets,equipment:1}},{...c,excluded_equipment_presets:[{preset:1,items:['NOT A TRAINING ITEM']}]},
    {...c,equipment_policy:undefined},{...c,baseline_combat:99}])assert.throws(()=>prepareSnapshot([row(0,{combat:90,calculation:bad})]));
  assert.throws(()=>prepareSnapshot([row(0,{calculation:c}),row(1,{calculation})]),/사냥 프리셋/);
  assert.throws(()=>filterRank([row(0,{calculation:c}),row(1,{calculation})]),/사냥 프리셋/);
});

test('Xenon and Demon Avenger never enter any ranking scope',()=>{
  const rows=[row(),row(1,{job:'제논',combat:999}),row(2,{job:'데몬어벤져',combat:998}),row(3,{job:'비숍',combat:110})];
  assert.deepEqual(filterRank(rows).map(r=>r.job),['비숍','아델']);
  assert.throws(()=>filterRank(rows,{job:'제논'}),/집계에서 제외/);
  assert.throws(()=>filterRank(rows,{job:'데몬어벤져'}),/집계에서 제외/);
});

test('cash effects require a consistent v15 scope and survive local export',()=>{
  const c={...calculation,version:'preset-api-v15',equipment_policy:'exclude-training-presets-v1',active_equipment_preset:1,excluded_equipment_presets:[],
    configuration_scope:'presets-owned-android-cash-plus',cash_effect_policy:'cash-base-and-confirmed-plus-v1',
    cash_plus:{preset:2,count:5},cash_set_adjustments:[{set:'레헬른 세트',before:4,after:0}],combinations:1350};
  const s=prepareSnapshot([row(0,{calculation:c})]);
  assert.equal(s.coverage.calculation_scope,c.configuration_scope);assert.equal(s.coverage.cash_effect_policy,c.cash_effect_policy);
  assert.deepEqual(parseImport(snapshotCSV(s)).characters,s.characters);
  for(const bad of [{...c,cash_effect_policy:undefined},{...c,configuration_scope:'presets-and-owned-android'},
    {...c,version:'preset-api-v14',combinations:270},
    {...c,cash_plus:{preset:4,count:5}},{...c,cash_plus:{preset:1,count:6}},{...c,combinations:1351},
    {...c,cash_set_adjustments:[{set:'레헬른 세트',before:4,after:5}]}])assert.throws(()=>prepareSnapshot([row(0,{calculation:bad})]));
  const older={...c,version:'preset-api-v14',configuration_scope:'presets-and-owned-android',cash_effect_policy:undefined,cash_plus:undefined,cash_set_adjustments:undefined,combinations:270};
  assert.throws(()=>prepareSnapshot([row(0,{calculation:c}),row(1,{calculation:older})]),/계산 기준/);
  assert.throws(()=>prepareSnapshot([row(0,{calculation:c})],{coverage:{cash_effect_policy:'unknown'}}),/캐시/);
  assert.equal(prepareSnapshot([],{coverage:s.coverage}).coverage.cash_effect_policy,c.cash_effect_policy);
});
test('regular, Eos/Helios and unknown event worlds never share a podium',()=>{
  const rows=[row(0),row(1,{world:'에오스',combat:999}),row(2,{world:'핼리오스',combat:998}),row(3,{world:'챌린저스',combat:997})];
  assert.deepEqual(filterRank(rows).map(r=>r.world),['루나']);
  assert.deepEqual(filterRank(rows,{group:'eos-helios'}).map(r=>r.world),['에오스','핼리오스']);
  assert.deepEqual(filterRank(rows,{group:'other'}).map(r=>r.world),['챌린저스']);
  assert.equal(filterRank(rows,{world:'에오스'}).length,1);
  assert.equal(worldGroup('헬리오스'),'eos-helios');
  assert.throws(()=>filterRank(rows,{group:'regular',world:'에오스'}),/일치하지/);
  assert.throws(()=>filterRank(rows,{group:'all'}),/분류/);
  assert.throws(()=>prepareSnapshot([row(0,{level:289})]));
});
test('static and Worker sources share validation and never silently fall back on failure',async()=>{
  let urls=[]; const fetcher=async url=>{ urls.push(String(url)); return new Response(JSON.stringify(urls.length===1?{apiBase:''}:emptySnapshot())); };
  await loadRankingSource({fetcher,base:new URL('https://example.test/project/')}); assert.equal(urls[1],'https://example.test/project/data/mystery-rankings.json');
  urls=[]; await loadRankingSource({fetcher:async url=>{urls.push(String(url));return new Response(JSON.stringify(urls.length===1?{apiBase:'https://worker.test'}:emptySnapshot()));}}); assert.equal(urls[1],'https://worker.test/v1/mystery/snapshot');
  let calls=0; await assert.rejects(loadRankingSource({fetcher:async()=>{ calls++; return calls===1?new Response('{"apiBase":"https://worker.test"}'):new Response('unavailable',{status:503}); }})); assert.equal(calls,2);
  await assert.rejects(loadRankingSource({fetcher:async()=>new Response('{"apiBase":"http://invalid.test"}')}));
});
test('publisher reads raw PC exports, removes private fields, preserves source, emits matching JSON/CSV',async()=>{
  const root=fileURLToPath(new URL('./evidence/',import.meta.url));
  await mkdir(root,{recursive:true});
  const dir=await mkdtemp(join(root,'mystery-'));
  try {
    const input=join(dir,'raw.json'),output=join(dir,'public.json'),raw=JSON.stringify([row(0,{api_key:'NEVER_PUBLISH'})]); await writeFile(input,raw);
    const info=await importFile({input,output}); assert.equal(info.characters,1); assert.equal(await readFile(input,'utf8'),raw);
    const s=validateSnapshot(JSON.parse(await readFile(output,'utf8'))); assert.equal(JSON.stringify(s).includes('NEVER_PUBLISH'),false); assert.equal(await readFile(join(dir,'public.csv'),'utf8'),snapshotCSV(s));
    await assert.rejects(importFile({input,output:input}),/원본 파일/);
    await writeFile(input,JSON.stringify([row(0,{combat:'1억'})])); await assert.rejects(importFile({input,output})); assert.equal(validateSnapshot(JSON.parse(await readFile(output,'utf8'))).characters.length,1);
  } finally { assert(dir.startsWith(root)); await rm(dir,{recursive:true,force:true}); }
});


test('dated partial API-only evidence survives CSV while fabricated completeness or preset choices are rejected',()=>{
  const c={basis:'preset',version:'preset-api-v18',api_combat:100,baseline_combat:null,baseline_status:'unavailable',
    observed_at:'2026-10-24T00:00:00Z',selection_policy:'api-or-calculated-maximum-v1',selected_source:'api',preset_combat:null,
    presets:null,combinations:0,search_complete:false,review_reasons:['baseline_unavailable','preset_unavailable'],
    equipment_policy:'exclude-training-presets-v1',active_equipment_preset:null,excluded_equipment_presets:[],
    configuration_scope:'presets-owned-android-cash-plus',cash_effect_policy:'cash-base-and-confirmed-plus-v1',ammunition_policy:AMMUNITION_POLICY,
    api_fallback:{policy:'dated-partial-api-v1',failed_endpoint:'user/union-champion',error_code:'OPENAPI00004',equipment_verified:false,secret:'DROP'}};
  const s=prepareSnapshot([row(0,{calculation:c})]);assert.deepEqual(parseImport(snapshotCSV(s)).characters,s.characters);
  assert.equal(s.characters[0].calculation.api_fallback.secret,undefined);
  for(const patch of [{equipment_verified:true},{failed_endpoint:'id'},{error_code:'OPENAPI00007'},{policy:'invented'}])
    assert.throws(()=>prepareSnapshot([row(0,{calculation:{...c,api_fallback:{...c.api_fallback,...patch}}})]));
  for(const patch of [{baseline_combat:100,baseline_status:'matched'},{active_equipment_preset:1},{presets:{equipment:1,hyper:1,ability:1,union:1},preset_combat:120,selected_source:'preset',combinations:1}])
    assert.throws(()=>prepareSnapshot([row(0,{combat:patch.preset_combat||100,calculation:{...c,...patch}})]));
});
