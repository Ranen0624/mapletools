import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,access,symlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {pruneHistory,cutoffDate,retentionDays,assertSiteBudget} from '../scripts/mystery-retention.mjs';
import {orphanPlan,pruneOrphans} from '../scripts/mystery-orphans.mjs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';

const digest=text=>createHash('sha256').update(text).digest('hex');
async function generated(root,directory,value){
  const text=JSON.stringify(value)+'\n',name=directory+'/'+digest(text)+'.json';
  await mkdir(join(root,directory),{recursive:true});await writeFile(join(root,name),text);return name;
}
async function fixture(root){
  const day='2026-10-23';
  const pool=await generated(root,'data/mystery-history/'+day,{schema_version:1,encoding:'gzip-base64',data_date:day,payload:'ACTIVE'});
  const legacy=await generated(root,'data/mystery-cache',{schema_version:1,coverage:{data_date:day},characters:[]});
  await writeFile(join(root,legacy.replace('.json','.csv')),'ACTIVE CSV');
  const index=await generated(root,'data/mystery-history/'+day,{schema_version:2,type:'mystery-query-index',queries:[{file:legacy}],pools:[{file:pool}]});
  const outfit=await generated(root,'data/mystery-details/'+day,{schema_version:1,encoding:'gzip-base64',date:day,payload:'ACTIVE OUTFIT'});
  await writeFile(join(root,'data/mystery-details/'+day+'/index.json'),JSON.stringify({schema_version:1,date:day,records:{},pools:[{file:outfit}]}));
  await writeFile(join(root,'data/mystery-dates.json'),JSON.stringify({schema_version:1,latest:day,dates:[{date:day,index}]}));
  await writeFile(join(root,'data/mystery-index.json'),await readFile(join(root,index)));
  return {day,index,pool,legacy,outfit};
}
async function withOrphanFixture(check){
  const parent=join(tmpdir(),'mapletools-orphans-'),root=await mkdtemp(parent);
  try{return await check(root,await fixture(root));}
  finally{assert.ok(root.startsWith(parent));await rm(root,{recursive:true,force:true});}
}

test('orphan cleanup preserves active ranking, legacy CSV, outfit, current-index-only data and unrelated assets',async()=>withOrphanFixture(async(root,active)=>{
  const stale=await generated(root,'data/mystery-history/'+active.day,{schema_version:1,encoding:'gzip-base64',data_date:active.day,payload:'STALE'});
  const oldOutfit=await generated(root,'data/mystery-details/'+active.day,{schema_version:1,encoding:'gzip-base64',date:active.day,payload:'OLD OUTFIT'});
  const cache=await generated(root,'data/mystery-cache',{schema_version:1,coverage:{data_date:active.day},characters:[{}]});
  await writeFile(join(root,cache.replace('.json','.csv')),'OLD CSV');
  const currentOnly=await generated(root,'data/mystery-history/'+active.day,{schema_version:1,encoding:'gzip-base64',data_date:active.day,payload:'CURRENT ONLY'});
  await writeFile(join(root,'data/mystery-index.json'),JSON.stringify({pools:[{file:currentOnly}],queries:[]}));
  const manual=await generated(root,'data/mystery-history/'+active.day,{user:'PRESERVE UNKNOWN SCHEMA'});
  await mkdir(join(root,'downloads'));await writeFile(join(root,'downloads/app.zip'),'PRESERVE');
  const plan=await orphanPlan(root);assert.deepEqual(new Set(plan.remove.map(r=>r.file)),new Set([stale,oldOutfit,cache,cache.replace('.json','.csv')]));
  await access(join(root,stale));await pruneOrphans(root,{apply:true});
  for(const path of [active.index,active.pool,active.legacy,active.legacy.replace('.json','.csv'),active.outfit,currentOnly,manual,'downloads/app.zip'])await access(join(root,path));
  for(const path of [stale,oldOutfit,cache,cache.replace('.json','.csv')])await assert.rejects(access(join(root,path)));
  assert.equal((await pruneOrphans(root,{apply:true})).remove.length,0);
}));

test('missing or escaping active references stop cleanup before any file removal',async()=>withOrphanFixture(async(root,active)=>{
  const stale=await generated(root,'data/mystery-history/'+active.day,{schema_version:1,encoding:'gzip-base64',data_date:active.day,payload:'STALE'});
  for(const index of ['../../downloads/app.zip',`data/mystery-history/${active.day}/${'a'.repeat(64)}.json`]){
    await writeFile(join(root,'data/mystery-dates.json'),JSON.stringify({dates:[{date:active.day,index}]}));
    await assert.rejects(pruneOrphans(root,{apply:true}));await access(join(root,stale));
  }
}));

test('unknown root catalogs and non-content-addressed files are left untouched',async()=>withOrphanFixture(async(root,active)=>{
  const mismatched=`data/mystery-history/${active.day}/${'f'.repeat(64)}.json`;
  await writeFile(join(root,mismatched),JSON.stringify({schema_version:1,encoding:'gzip-base64',data_date:active.day,payload:'MANUAL'}));
  assert.equal((await orphanPlan(root)).remove.length,0);
  await writeFile(join(root,'data/mystery-dates.json'),JSON.stringify({dates:[{date:active.day}]}));
  assert.ok((await pruneOrphans(root,{apply:true})).skipped);await access(join(root,mismatched));
}));

test('generated-directory links and Windows junctions cannot redirect cleanup',async()=>withOrphanFixture(async(root,active)=>{
  const target=join(root,'unrelated');await mkdir(target);await writeFile(join(target,'preserve.txt'),'PRESERVE');
  await symlink(target,join(root,'data/mystery-history/'+active.day+'/linked'),'junction');
  await assert.rejects(pruneOrphans(root,{apply:true}),/links/);
  assert.equal(await readFile(join(target,'preserve.txt'),'utf8'),'PRESERVE');
}));

test('seven calendar days expire ranking and outfit files together while preserving unrelated assets',async()=>{
  const evidence=fileURLToPath(new URL('./evidence/',import.meta.url));await mkdir(evidence,{recursive:true});
  const root=await mkdtemp(join(evidence,'retention-'));
  try{
    const dates=['2026-10-20','2026-10-14','2026-10-13','2026-10-01'];
    for(const date of dates)for(const kind of ['mystery-history','mystery-details']){const p=join(root,'data',kind,date);await mkdir(p,{recursive:true});await writeFile(join(p,'source.json'),'{}');}
    await mkdir(join(root,'downloads'));await writeFile(join(root,'downloads/app.zip'),'PRESERVE');
    await writeFile(join(root,'CNAME'),'mapletools.kr');await mkdir(join(root,'data/mystery-cache'));
    const legacy=join(root,'data/mystery-cache','a'.repeat(64));await writeFile(legacy+'.json',JSON.stringify({coverage:{data_date:'2026-10-13'}}));await writeFile(legacy+'.csv','old');
    await writeFile(join(root,'data/mystery-dates.json'),JSON.stringify({schema_version:1,latest:dates[0],dates:dates.map(date=>({date}))}));
    const result=await pruneHistory(root);assert.equal(result.cutoff,'2026-10-14');assert.equal(result.removed_paths,6);
    assert.deepEqual(JSON.parse(await readFile(join(root,'data/mystery-dates.json'),'utf8')).dates.map(d=>d.date),dates.slice(0,2));
    await access(join(root,'data/mystery-history/2026-10-14/source.json'));await assert.rejects(access(join(root,'data/mystery-details/2026-10-13')));
    await assert.rejects(access(legacy+'.json'));assert.equal(await readFile(join(root,'downloads/app.zip'),'utf8'),'PRESERVE');assert.equal(await readFile(join(root,'CNAME'),'utf8'),'mapletools.kr');
    assert.equal((await pruneHistory(root)).removed_paths,0);
    await writeFile(join(root,'mystery-config.json'),'{"historyRetentionDays":30}');assert.equal(await retentionDays(root),30);
    await writeFile(join(root,'mystery-config.json'),'{"historyRetentionDays":0}');await assert.rejects(retentionDays(root),/기간/);
    await assert.rejects(assertSiteBudget(root,{bytes:-1000*1024*1024}),/900MB/);
  }finally{assert.ok(root.startsWith(join(evidence,'retention-')));await rm(root,{recursive:true,force:true});}
});
test('retention uses calendar dates across month boundaries and rejects invalid targets',()=>{
  assert.equal(cutoffDate('2026-11-02',7),'2026-10-27');assert.equal(cutoffDate('2026-10-20',1),'2026-10-20');
  assert.throws(()=>cutoffDate('../downloads',7),/기준/);assert.throws(()=>cutoffDate('2026-02-30',7),/기준/);
});
