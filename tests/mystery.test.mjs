// Synthetic inputs exist only inside automated validation; never public feed rows.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {emptySnapshot,prepareSnapshot,validateSnapshot,parseImport,filterRank,imageAllowed,collectionStatus,snapshotCSV,validDate,MAX_CSV_BYTES,worldGroup} from '../mystery-core.js';
import {loadRankingSource} from '../mystery-source.js';
import {importFile} from '../scripts/import-mystery.mjs';
const row=(n=0,extra={})=>({name:'검증전용'+n,world:'루나',job:'아델',level:290+n,combat:100+n,image:'',observedAt:'2026-10-19',...extra});
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

test('Xenon and Demon Avenger never enter any ranking scope',()=>{
  const rows=[row(),row(1,{job:'제논',combat:999}),row(2,{job:'데몬어벤져',combat:998}),row(3,{job:'비숍',combat:110})];
  assert.deepEqual(filterRank(rows).map(r=>r.job),['비숍','아델']);
  assert.throws(()=>filterRank(rows,{job:'제논'}),/집계에서 제외/);
  assert.throws(()=>filterRank(rows,{job:'데몬어벤져'}),/집계에서 제외/);
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
