import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {queryAccumulator,publishIndex,discoveryMetadata} from '../scripts/publish-mystery-index.mjs';
import {filterRank,snapshotCSV} from '../mystery-core.js';
import {loadRankingSource} from '../mystery-source.js';
const date='2026-10-19';
const rows=Array.from({length:640},(_,i)=>({name:'검증전용'+i,world:['루나','스카니아','에오스','핼리오스'][i%4],job:['아델','비숍','렌'][i%3],level:290+(i%11),combat:(i*7919)%997+1,image:'',observedAt:date,ocid:'validation'+i}));

test('TOP 10 per single level exactly preserves arbitrary interval TOP 10 and full population counts',()=>{
  const acc=queryAccumulator(date); rows.forEach(acc.add);
  assert.equal(acc.total,rows.length);
  const intervals=[...Array.from({length:11},(_,i)=>[290+i,290+i]),[290,300],[290,299],[291,299],[292,296],[294,300]];
  for(const q of acc.queries.values()) for(const [min,max] of intervals) {
    const options={min,max,group:q.group,world:q.world,job:q.job};
    const full=filterRank(rows,options),small=filterRank([...q.levels.values()].flat(),options);
    assert.deepEqual(small.slice(0,10),full.slice(0,10));
    assert.equal([...q.counts].filter(([lv])=>lv>=min&&lv<=max).reduce((s,[,n])=>s+n,0),full.length);
  }
});

test('streamed publication rejects unfinished scans, serves exact selected scope, and rejects corrupt counts',async()=>{
  const root=await mkdtemp(join(tmpdir(),'mystery-index-'));
  try {
    const input=join(root,'api-only.jsonl'),audit=join(root,'audit.json');
    await writeFile(input,rows.map(r=>JSON.stringify(r)).join('\n'));
    await writeFile(join(root,'mystery-config.json'),JSON.stringify({apiBase:''}));
    await writeFile(audit,JSON.stringify({data_date:date,candidates:rows.length+1,counts:{verified:rows.length,pending:1}}));
    await assert.rejects(publishIndex({input,audit,root}),/전체 후보/);
    const partial=await publishIndex({input,audit,root,allowPartial:true});
    assert.equal(partial.collection.state,'collecting'); assert.equal(partial.collection.pending,1);
    const partialIndex=JSON.parse(await readFile(join(root,'data/mystery-index.json'),'utf8'));
    assert.match(partialIndex.coverage.description,/중간 공개본/);
    assert.match(partialIndex.coverage.limitations[0],/조회하지 않은 후보 1명/);
    await writeFile(audit,JSON.stringify({data_date:date,candidates:rows.length,counts:{verified:rows.length}}));
    const result=await publishIndex({input,audit,root}); assert.equal(result.verified,rows.length);
    const fetcher=async url=>({ok:true,text:()=>readFile(join(root,new URL(url).pathname.slice(1)),'utf8')});
    const options={min:292,max:299,group:'eos-helios',world:'에오스',job:'렌'};
    const selected=await loadRankingSource({fetcher,base:new URL('https://example.test/'),options});
    assert.deepEqual(filterRank(selected.characters,options).slice(0,10),filterRank(rows,options).slice(0,10));
    assert.equal(await readFile(join(root,new URL(selected.downloadCSV).pathname.slice(1)),'utf8'),snapshotCSV(selected));
    const absent=await loadRankingSource({fetcher,base:new URL('https://example.test/'),options:{...options,job:'미수집 직업'}});
    assert.equal(absent.characters.length,0); assert.equal(absent.coverage.status,'uncollected');
    const path=join(root,'data/mystery-index.json'),index=JSON.parse(await readFile(path,'utf8'));
    const q=index.queries.find(q=>q.group===options.group&&q.world===options.world&&q.job===options.job);
    q.counts[0][1]=999; await writeFile(path,JSON.stringify(index));
    await assert.rejects(loadRankingSource({fetcher,base:new URL('https://example.test/'),options}),/집계 수/);
    q.file='https://example.invalid/private'; await writeFile(path,JSON.stringify(index));
    await assert.rejects(loadRankingSource({fetcher,base:new URL('https://example.test/'),options}),/파일 정보/);
  } finally { assert.ok(root.startsWith(join(tmpdir(),'mystery-index-'))); await rm(root,{recursive:true,force:true}); }
});

test('mixed dates and conflicting OCID records are rejected before publishing',()=>{
  const acc=queryAccumulator(date); acc.add(rows[0]); acc.add(rows[0]); assert.equal(acc.total,1);
  assert.throws(()=>acc.add({...rows[0],combat:999999}),/충돌/);
  assert.throws(()=>acc.add({...rows[0],ocid:'different-ocid'}),/충돌/);
  assert.throws(()=>acc.add({...rows[1],observedAt:'2026-10-18'}),/같은 기준일/);
});

test('excluded jobs are removed before top-ten truncation and full population counting',()=>{
  const acc=queryAccumulator(date),valid=Array.from({length:11},(_,n)=>({...rows[0],name:'포함검증'+n,ocid:'included'+n,combat:100+n}));
  for(let n=0;n<20;n++) acc.add({...rows[0],name:'제외검증'+n,ocid:'excluded'+n,job:n%2?'제논':'데몬어벤져',combat:999999});
  for(const row of valid) acc.add(row);
  const q=acc.queries.get(JSON.stringify(['regular','','']));
  assert.equal(acc.scopeExcluded,20);assert.equal(acc.total,valid.length);
  assert.equal(q.counts.get(290),valid.length);assert.equal(q.levels.get(290).length,Math.min(10,valid.length));
  assert.equal(acc.jobs.has('제논'),false);assert.equal(acc.jobs.has('데몬어벤져'),false);
});

test('extracted sources awaiting calculation stay outside public rows and prevent a complete claim',async()=>{
  const evidence=fileURLToPath(new URL('./evidence/',import.meta.url));await mkdir(evidence,{recursive:true});
  const root=await mkdtemp(join(evidence,'mystery-stages-'));
  try {
    await writeFile(join(root,'mystery-config.json'),'{"apiBase":""}');
    const input=join(root,'input.jsonl'),audit=join(root,'audit.json');
    await writeFile(input,JSON.stringify(rows[0])+'\n');
    await writeFile(audit,JSON.stringify({data_date:date,candidates:3,counts:{verified:1,collected:1,unverified:1}}));
    await assert.rejects(publishIndex({input,audit,root}),/중간 공개/);
    const r=await publishIndex({input,audit,root,allowPartial:true});
    assert.equal(r.verified,1);assert.equal(r.collection.calculating,1);assert.equal(r.collection.unverified,1);assert.equal(r.collection.state,'collecting');
  } finally {assert.ok(root.startsWith(join(evidence,'mystery-stages-')));await rm(root,{recursive:true,force:true});}
});

test('daily archives retain earlier dates, default to latest, and never replace missing dates with another day',async()=>{
  const evidence=fileURLToPath(new URL('./evidence/',import.meta.url));await mkdir(evidence,{recursive:true});
  const root=await mkdtemp(join(evidence,'mystery-history-'));
  try {
    const input=join(root,'input.jsonl'),audit=join(root,'audit.json');
    await writeFile(join(root,'mystery-config.json'),'{"apiBase":""}');
    const publish=async(day,increment=0)=>{
      await writeFile(input,rows.map(r=>JSON.stringify({...r,observedAt:day,combat:r.combat+increment})).join('\n'));
      await writeFile(audit,JSON.stringify({data_date:day,candidates:rows.length,counts:{verified:rows.length}}));
      await publishIndex({input,audit,root,archive:true});
    };
    await publish(date);
    const original=JSON.parse(await readFile(join(root,'data/mystery-dates.json'),'utf8')).dates[0].index;
    const originalBytes=await readFile(join(root,original),'utf8');
    await publish('2026-10-20',10000);
    const catalog=JSON.parse(await readFile(join(root,'data/mystery-dates.json'),'utf8'));
    assert.deepEqual(catalog.dates.map(d=>d.date),['2026-10-20',date]);
    assert.equal(await readFile(join(root,original),'utf8'),originalBytes);
    const fetcher=async url=>({ok:true,text:()=>readFile(join(root,new URL(url).pathname.slice(1)),'utf8')});
    const load=options=>loadRankingSource({fetcher,base:new URL('https://archive.test/'),options});
    const latest=await load({}),old=await load({date});
    assert.equal(latest.coverage.data_date,'2026-10-20');assert.equal(old.coverage.data_date,date);
    assert.deepEqual(filterRank(old.characters).slice(0,10),filterRank(rows).slice(0,10));
    assert.equal(filterRank(latest.characters)[0].combat,filterRank(old.characters)[0].combat+10000);
    const missing=await load({date:'2026-10-18'});
    assert.equal(missing.characters.length,0);assert.equal(missing.uncollectedDate,true);assert.equal(missing.coverage.data_date,'2026-10-18');
    // Backfilling an earlier day cannot roll back the current snapshot.
    await publish('2026-10-18');
    assert.equal(JSON.parse(await readFile(join(root,'data/mystery-index.json'),'utf8')).data_date,'2026-10-20');
    const current=JSON.parse(await readFile(join(root,catalog.dates[0].index),'utf8'));
    current.queries[0].refs[0]=999999;
    await writeFile(join(root,catalog.dates[0].index),JSON.stringify(current));
    await assert.rejects(load({...current.queries[0]}),/참조/);
  } finally { assert.ok(root.startsWith(join(evidence,'mystery-history-'))); await rm(root,{recursive:true,force:true}); }
});


test('daily discovery uses its own candidate groups and never carries another date or population',()=>{
  const previous={data_date:'2026-10-19',candidates:640,candidate_groups:{regular:320,'eos-helios':320},discovery_coverage:[{world_type:0,last_page:4,limited:false}]};
  assert.deepEqual(discoveryMetadata({data_date:'2026-10-20',candidates:640},previous),{candidate_groups:{},discovery_coverage:[]});
  assert.deepEqual(discoveryMetadata({data_date:previous.data_date,candidates:641},previous),{candidate_groups:{},discovery_coverage:[]});
  assert.deepEqual(discoveryMetadata({data_date:previous.data_date,candidates:640},previous),{candidate_groups:previous.candidate_groups,discovery_coverage:previous.discovery_coverage});
  const fresh={data_date:'2026-10-20',candidates:700,candidate_groups:{regular:600,'eos-helios':100},discovery_coverage:[{world_type:0,last_page:7,limited:false}]};
  assert.deepEqual(discoveryMetadata(fresh,previous),{candidate_groups:fresh.candidate_groups,discovery_coverage:fresh.discovery_coverage});
  assert.throws(()=>discoveryMetadata({...fresh,candidate_groups:{regular:700,'eos-helios':100}},previous),/후보/);
  assert.deepEqual(discoveryMetadata({data_date:previous.data_date,candidates:640},{...previous,candidate_groups:{regular:1}}),{candidate_groups:{},discovery_coverage:[]});
});

test('dated defaults stay separate from newer live records and preserve the replaced revision',async()=>{
  const evidence=fileURLToPath(new URL('./evidence/',import.meta.url));await mkdir(evidence,{recursive:true});
  const root=await mkdtemp(join(evidence,'mystery-dated-'));
  try{
    const input=join(root,'input.jsonl'),audit=join(root,'audit.json');
    await writeFile(join(root,'mystery-config.json'),JSON.stringify({apiBase:'',historyRetentionDays:7}));
    const publish=async(day,mode)=>{
      await writeFile(input,rows.slice(0,4).map(r=>JSON.stringify({...r,observedAt:day})).join('\n'));
      await writeFile(audit,JSON.stringify({data_date:day,api_mode:mode,candidates:4,counts:{verified:4}}));
      await publishIndex({input,audit,root,archive:true});
    };
    await publish(date,'live');
    const previous=JSON.parse(await readFile(join(root,'data/mystery-dates.json'),'utf8')).dates[0].index;
    const original=await readFile(join(root,previous),'utf8');
    await publish('2026-10-20','live');
    await writeFile(join(root,'mystery-config.json'),JSON.stringify({apiBase:'',staticIndex:'data/mystery-index.json',staticCatalog:'data/mystery-dates.json',preferredApiMode:'dated'}));
    await publish(date,'dated');
    const catalog=JSON.parse(await readFile(join(root,'data/mystery-dates.json'),'utf8'));
    assert.equal(catalog.latest,'2026-10-20');assert.equal(catalog.latest_dated,date);
    const collection=JSON.parse(await readFile(join(root,'data/mystery-collection.json'),'utf8'));
    assert.equal(collection.data_date,date);assert.equal(collection.api_mode,'dated');assert.equal(collection.published_characters,4);
    assert.equal(await readFile(join(root,previous),'utf8'),original);
    assert.equal(JSON.parse(await readFile(join(root,'data/mystery-index.json'),'utf8')).data_date,date);
    const fetcher=async url=>({ok:true,text:()=>readFile(join(root,new URL(url).pathname.slice(1)),'utf8')});
    const load=options=>loadRankingSource({fetcher,base:new URL('https://dated.test/'),options});
    const preferred=await load({}),legacy=await load({date:'2026-10-20'});
    assert.equal(preferred.coverage.data_date,date);assert.equal(preferred.coverage.api_mode,'dated');
    assert.equal(legacy.coverage.api_mode,'live');assert(preferred.characters.every(r=>r.observedAt===date));
    catalog.latest_dated='2026-10-20';await writeFile(join(root,'data/mystery-dates.json'),JSON.stringify(catalog));
    await assert.rejects(load({}),/일일 기록/);
  }finally{assert(root.startsWith(join(evidence,'mystery-dated-')));await rm(root,{recursive:true,force:true});}
});

test('a missing dated collection cannot silently fall back to the old live source',async()=>{
  const evidence=fileURLToPath(new URL('./evidence/',import.meta.url));await mkdir(evidence,{recursive:true});
  const root=await mkdtemp(join(evidence,'mystery-no-dated-'));
  try{
    await mkdir(join(root,'data'));await writeFile(join(root,'mystery-config.json'),JSON.stringify({staticIndex:'data/mystery-index.json',staticCatalog:'data/mystery-dates.json',preferredApiMode:'dated'}));
    await writeFile(join(root,'data/mystery-dates.json'),JSON.stringify({schema_version:1,latest:date,dates:[{date,index:`data/mystery-history/${date}/${'a'.repeat(64)}.json`}]}));
    const fetcher=async url=>({ok:true,text:()=>readFile(join(root,new URL(url).pathname.slice(1)),'utf8')});
    const result=await loadRankingSource({fetcher,base:new URL('https://missing.test/')});
    assert.equal(result.characters.length,0);assert.equal(result.uncollectedDate,true);assert.equal(result.preferredApiMode,'dated');
  }finally{assert(root.startsWith(join(evidence,'mystery-no-dated-')));await rm(root,{recursive:true,force:true});}
});
