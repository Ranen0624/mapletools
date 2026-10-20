import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {pruneHistory,cutoffDate,retentionDays,assertSiteBudget} from '../scripts/mystery-retention.mjs';

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
