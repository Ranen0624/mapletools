import {publicCharacter} from './public-identity.mjs';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {normalizeDetail} from '../mystery-details.js';
import {validDate,MAX_CSV_BYTES} from '../mystery-core.js';
import {retentionDays,cutoffDate,retentionPlan,assertSiteBudget} from './mystery-retention.mjs';
import {pruneOrphans} from './mystery-orphans.mjs';
export async function publishDetails({input,root,date}) {
  if(!validDate(date))throw Error('기준일을 확인하세요.');
  const catalog=JSON.parse(await readFile(join(root,'data/mystery-dates.json'),'utf8'));
  if(!catalog.dates.some(d=>d.date===date)||date<cutoffDate(catalog.latest,await retentionDays(root)))throw Error('공개 보관 범위 안의 기준일만 코디 정보를 등록할 수 있습니다.');
  await pruneOrphans(root,{apply:true});
  const directory=join(root,'data/mystery-details',date);await mkdir(directory,{recursive:true});
  const records={},pools=[],batch=[];let total=0;
  async function flush(){
    if(!batch.length)return;
    const source=JSON.stringify(batch);
    if(Buffer.byteLength(source)>MAX_CSV_BYTES)throw Error('상세 정보 원본이 너무 큽니다.');
    const text=JSON.stringify({schema_version:1,date,encoding:'gzip-base64',payload:gzipSync(source,{level:9}).toString('base64')})+'\n';
    if(Buffer.byteLength(text)>MAX_CSV_BYTES)throw Error('상세 정보 파일이 너무 큽니다.');
    const hash=createHash('sha256').update(text).digest('hex'),file=`data/mystery-details/${date}/${hash}.json`;
    await writeFile(join(root,file),text);pools.push({file,count:batch.length});batch.length=0;
  }
  for await(const line of createInterface({input:createReadStream(input),crlfDelay:Infinity})){
    if(!line.trim())continue;const detail=normalizeDetail(publicCharacter(JSON.parse(line)));
    if(!detail||detail.date!==date||Object.hasOwn(records,detail.ocid))throw Error('중복 또는 잘못된 코디 상세 기록입니다.');
    records[detail.ocid]=[pools.length,batch.length];batch.push(detail);total++;
    if(batch.length===100)await flush();
  }
  await flush();
  const text=JSON.stringify({schema_version:1,date,records,pools})+'\n';
  if(Buffer.byteLength(text)>MAX_CSV_BYTES)throw Error('상세 정보 목록이 너무 큽니다.');
  // Keep old immutable files; move only this date's public pointer last.
  const path=join(directory,'index.json');
  try{
    const previous=await readFile(path,'utf8');
    if(previous!==text){const revisions=join(directory,'revisions');await mkdir(revisions,{recursive:true});await writeFile(join(revisions,createHash('sha256').update(previous).digest('hex')+'.json'),previous);}
  }catch(e){if(e.code!=='ENOENT')throw e;}
  await assertSiteBudget(root,await retentionPlan(root,catalog.latest,await retentionDays(root)));
  await writeFile(path+'.tmp',text);await rename(path+'.tmp',path);
  return {date,characters:total,pools:pools.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const [input,date,root='.']=process.argv.slice(2);console.log(JSON.stringify(await publishDetails({input,date,root:resolve(root)})));}
  catch(e){console.error(e.message);process.exitCode=1;}
}
