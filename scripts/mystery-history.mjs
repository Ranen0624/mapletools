import {readFile,writeFile,mkdir,rename,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {validDate} from '../mystery-core.js';

async function atomic(path,text) { await writeFile(path+'.tmp',text); await rename(path+'.tmp',path); }
async function size(path) { let total=0; for(const e of await readdir(path,{withFileTypes:true})) total+=e.isDirectory()?await size(join(path,e.name)):(await stat(join(path,e.name))).size; return total; }

// Store each real character once per date; queries refer to shared, compressed pools.
// Old dates and revisions are retained. Only the catalog pointer changes on publication.
export async function writeHistory(root,index,snapshots) {
  if(!validDate(index.data_date)) throw Error('기준일을 확인하세요.');
  const directory=join(root,'data','mystery-history',index.data_date);
  await mkdir(directory,{recursive:true});
  const records=[],ids=new Map(),queries=[];
  for(let n=0;n<index.queries.length;n++) {
    const q=index.queries[n],refs=[];
    for(const row of snapshots[n].characters) {
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
  // Fail before moving the public pointer; never silently remove history to make room.
  if(await size(join(root,'data'))>800*1024*1024) throw Error('공개 기록이 800MB를 넘었습니다. 기존 기록을 보존하고 저장소 확장 후 공개하세요.');
  const catalogPath=join(root,'data','mystery-dates.json');
  let catalog={schema_version:1,dates:[]};
  try { catalog=JSON.parse(await readFile(catalogPath,'utf8')); } catch(e) { if(e.code!=='ENOENT') throw e; }
  const dates=[...catalog.dates.filter(d=>d.date!==index.data_date),{date:index.data_date,index:file,verified:index.verified,updated_at:index.updated_at}].sort((a,b)=>b.date.localeCompare(a.date));
  if(dates[0].date===index.data_date) await atomic(join(root,'data','mystery-index.json'),text);
  await atomic(catalogPath,JSON.stringify({schema_version:1,latest:dates[0].date,dates},null,2)+'\n');
  return packed;
}
