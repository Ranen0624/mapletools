import {readFile,writeFile,readdir,stat,rm,rename} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validDate} from '../mystery-core.js';

export async function retentionDays(root) {
  let config={};try{config=JSON.parse(await readFile(join(root,'mystery-config.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const days=config.historyRetentionDays??7;
  if(!Number.isInteger(days)||days<1||days>366)throw Error('기록 보관 기간을 확인하세요.');return days;
}
export function cutoffDate(latest,days) {
  if(!validDate(latest)||!Number.isInteger(days)||days<1||days>366)throw Error('기록 보관 기준을 확인하세요.');
  return new Date(Date.parse(latest)-(days-1)*86400000).toISOString().slice(0,10);
}
async function entries(path){try{return await readdir(path,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}}
export async function siteBytes(root) {
  let bytes=0;
  for(const e of await entries(root)){
    if(e.name.startsWith('.')||e.name==='node_modules'||e.name==='private-imports'||e.name==='evidence')continue;
    if(e.isSymbolicLink())throw Error('공개 저장소의 링크 경로를 확인하세요.');
    const path=join(root,e.name);bytes+=e.isDirectory()?await siteBytes(path):(await stat(path)).size;
  }return bytes;
}
export async function retentionPlan(root,latest,days=7) {
  root=resolve(root);const cutoff=cutoffDate(latest,days),remove=[];
  for(const kind of ['mystery-history','mystery-details']){
    const directory=join(root,'data',kind);
    for(const e of await entries(directory))if(e.isDirectory()&&validDate(e.name)&&e.name<cutoff){
      const path=resolve(directory,e.name);
      if(!path.startsWith(resolve(directory)+sep))throw Error('보관 정리 경로가 올바르지 않습니다.');
      remove.push({path,bytes:await siteBytes(path)});
    }
  }
  // Legacy query files also contain a date. Only delete our hash-named pairs
  // when their own recorded date has expired; downloads and sources stay intact.
  const cache=join(root,'data/mystery-cache');
  for(const e of await entries(cache))if(e.isFile()&&/^[a-f0-9]{64}\.json$/.test(e.name)){
    const path=join(cache,e.name),data=JSON.parse(await readFile(path,'utf8')),date=data.coverage?.data_date;
    if(validDate(date)&&date<cutoff){
      remove.push({path,bytes:(await stat(path)).size});
      const csv=path.replace(/\.json$/,'.csv');try{remove.push({path:csv,bytes:(await stat(csv)).size});}catch(e){if(e.code!=='ENOENT')throw e;}
    }
  }
  return {cutoff,days,remove,bytes:remove.reduce((n,e)=>n+e.bytes,0)};
}
export async function assertSiteBudget(root,plan) {
  // Count binaries and other public assets too, leaving room under Pages' 1GB.
  const bytes=await siteBytes(root)-(plan?.bytes||0);
  if(bytes>900*1024*1024)throw Error('공개 사이트가 900MB를 넘었습니다. 저장 공간을 확인한 후 공개하세요.');return bytes;
}
export async function pruneHistory(root) {
  root=resolve(root);const catalogPath=join(root,'data/mystery-dates.json'),catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  if(!validDate(catalog.latest)||!Array.isArray(catalog.dates)||catalog.dates.some(d=>!validDate(d.date)))throw Error('기준일 목록을 확인하세요.');
  const days=await retentionDays(root),plan=await retentionPlan(root,catalog.latest,days);
  await assertSiteBudget(root,plan);
  const dates=catalog.dates.filter(d=>d.date>=plan.cutoff&&d.date<=catalog.latest);
  if(!dates.some(d=>d.date===catalog.latest))throw Error('최신 기록이 보관 범위에 없습니다.');
  const {latest_dated:previousDated,...baseCatalog}=catalog;
  const latestDated=dates.filter(d=>d.api_mode==='dated').map(d=>d.date).sort().at(-1);
  const next=JSON.stringify({...baseCatalog,...(latestDated?{latest_dated:latestDated}:{}),retention_days:days,dates},null,2)+'\n';
  await writeFile(catalogPath+'.tmp',next);await rename(catalogPath+'.tmp',catalogPath);
  for(const e of plan.remove){
    // Validate every resolved absolute target immediately before recursive removal.
    const target=resolve(e.path);
    if(!['mystery-history','mystery-details','mystery-cache'].some(k=>target.startsWith(join(root,'data',k)+sep)))throw Error('정리 대상이 공개 기록 경로를 벗어났습니다.');
    await rm(target,{recursive:true,force:true});
  }
  return {retention_days:days,cutoff:plan.cutoff,dates:dates.length,removed_paths:plan.remove.length,removed_bytes:plan.bytes};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(await pruneHistory(resolve(process.argv[2]||'.'))));}catch(e){console.error(e.message);process.exitCode=1;}
}
