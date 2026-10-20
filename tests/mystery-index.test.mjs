import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {queryAccumulator,publishIndex} from '../scripts/publish-mystery-index.mjs';
import {filterRank,snapshotCSV} from '../mystery-core.js';
import {loadRankingSource} from '../mystery-source.js';
const date='2026-10-19';
const rows=Array.from({length:640},(_,i)=>({name:'검증전용'+i,world:['루나','스카니아','에오스','핼리오스'][i%4],job:['아델','비숍','렌'][i%3],level:285+(i%16),combat:(i*7919)%997+1,image:'',observedAt:date,ocid:'validation'+i}));

test('TOP 10 per single level exactly preserves arbitrary interval TOP 10 and full population counts',()=>{
  const acc=queryAccumulator(date); rows.forEach(acc.add);
  assert.equal(acc.total,rows.length);
  const intervals=[...Array.from({length:16},(_,i)=>[285+i,285+i]),[285,300],[285,299],[286,299],[287,293],[289,300]];
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
    await writeFile(audit,JSON.stringify({data_date:date,candidates:rows.length,counts:{verified:rows.length}}));
    const result=await publishIndex({input,audit,root}); assert.equal(result.verified,rows.length);
    const fetcher=async url=>({ok:true,text:()=>readFile(join(root,new URL(url).pathname.slice(1)),'utf8')});
    const options={min:287,max:299,group:'eos-helios',world:'에오스',job:'렌'};
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
