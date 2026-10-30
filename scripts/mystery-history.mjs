import {publicCharacter} from './public-identity.mjs';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {validDate} from '../mystery-core.js';
import {retentionDays,cutoffDate,retentionPlan,assertSiteBudget,pruneHistory} from './mystery-retention.mjs';

async function atomic(path,text) { await writeFile(path+'.tmp',text); await rename(path+'.tmp',path); }

// Store each real character once per date; queries refer to shared, compressed pools.
// Keep dates within the configured calendar window; expired public files are pruned.
export async function writeHistory(root,index,snapshots) {
  if(!validDate(index.data_date)) throw Error('기준일을 확인하세요.');
  const catalogPath=join(root,'data','mystery-dates.json');
  let catalog={schema_version:1,dates:[]};
  try { catalog=JSON.parse(await readFile(catalogPath,'utf8')); } catch(e) { if(e.code!=='ENOENT') throw e; }
  const latest=[index.data_date,...catalog.dates.map(d=>d.date)].sort().at(-1),days=await retentionDays(root);
  if(index.data_date<cutoffDate(latest,days))throw Error('공개 보관 기간이 지난 기준일입니다. 내 CSV 기록 분석을 이용하세요.');
  const directory=join(root,'data','mystery-history',index.data_date);
  await mkdir(directory,{recursive:true});
  const records=[],ids=new Map(),queries=[];
  for(let n=0;n<index.queries.length;n++) {
    const q=index.queries[n],refs=[];
    for(const original of snapshots[n].characters) {
      const row=publicCharacter(original);
      const key=row.ocid||JSON.stringify([row.world,row.name]);
      if(!ids.has(key)) { ids.set(key,records.length); records.push(row); }
      const id=ids.get(key);
      if(JSON.stringify(records[id])!==JSON.stringify(row)) throw Error('날짜별 캐릭터 기록이 충돌합니다.');
      refs.push(id);
    }
    queries.push({group:q.group,world:q.world,job:q.job,counts:q.counts,refs});
  }
  const pools=[];
  for(let first=0;first<records.length;first+=700) {
    const rows=records.slice(first,first+700);
    const text=JSON.stringify({schema_version:1,encoding:'gzip-base64',data_date:index.data_date,payload:gzipSync(JSON.stringify(rows)).toString('base64')})+'\n';
    const hash=createHash('sha256').update(text).digest('hex');
    const file=`data/mystery-history/${index.data_date}/${hash}.json`;
    await writeFile(join(root,file),text);
    pools.push({file,first,count:rows.length});
  }
  const packed={...index,schema_version:2,queries,pools},text=JSON.stringify(packed)+'\n';
  const hash=createHash('sha256').update(text).digest('hex');
  const file=`data/mystery-history/${index.data_date}/${hash}.json`;
  await writeFile(join(root,file),text);
  await assertSiteBudget(root,await retentionPlan(root,latest,days));
  const dates=[...catalog.dates.filter(d=>d.date!==index.data_date),{date:index.data_date,index:file,verified:index.verified,updated_at:index.updated_at,...(index.coverage?.api_mode?{api_mode:index.coverage.api_mode}:{})}].sort((a,b)=>b.date.localeCompare(a.date));
  const latestDated=dates.find(d=>d.api_mode==='dated')?.date;
  const config=JSON.parse(await readFile(join(root,'mystery-config.json'),'utf8'));
  const preferred=config.preferredApiMode==='dated'?latestDated:dates[0].date;
  if(preferred===index.data_date) await atomic(join(root,'data','mystery-index.json'),text);
  await atomic(catalogPath,JSON.stringify({schema_version:1,latest:dates[0].date,...(latestDated?{latest_dated:latestDated}:{}),dates},null,2)+'\n');
  await pruneHistory(root);
  return packed;
}
