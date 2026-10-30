// One-time migration of the active public graph. No API calls or rank changes.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {publicCharacterId,PUBLIC_ID_POLICY} from './public-identity.mjs';
import {pruneOrphans} from './mystery-orphans.mjs';
const root=resolve(process.argv[2]||'.');
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const write=async(path,value)=>writeFile(join(root,path),JSON.stringify(value)+'\n');
const catalog=await read('data/mystery-dates.json'),current=await read('data/mystery-index.json');
const prepared=[],report=[];
async function pool(file){
  const envelope=await read(file),old=JSON.parse(gunzipSync(Buffer.from(envelope.payload,'base64')));
  const rows=old.map(row=>({...row,ocid:publicCharacterId(row.ocid)}));
  rows.forEach((row,n)=>assert.deepEqual({...row,ocid:old[n].ocid},old[n]));
  const bytes=JSON.stringify({...envelope,payload:gzipSync(JSON.stringify(rows)).toString('base64')})+'\n';
  const target=file.slice(0,file.lastIndexOf('/')+1)+createHash('sha256').update(bytes).digest('hex')+'.json';
  await writeFile(join(root,target),bytes);return {file:target,rows};
}
for(const record of catalog.dates){
  const index=await read(record.index);assert.equal(index.schema_version,2);
  const next=structuredClone(index),ids=new Set();let characters=0;
  for(let n=0;n<index.pools.length;n++){
    const rewritten=await pool(index.pools[n].file);next.pools[n].file=rewritten.file;
    for(const row of rewritten.rows){assert(!ids.has(row.ocid));ids.add(row.ocid);characters++;}
  }
  const bytes=JSON.stringify(next)+'\n',file=record.index.slice(0,record.index.lastIndexOf('/')+1)+createHash('sha256').update(bytes).digest('hex')+'.json';
  await writeFile(join(root,file),bytes);
  const detailsPath=`data/mystery-details/${record.date}/index.json`,detail=await read(detailsPath),updated=structuredClone(detail);updated.records={};let outfits=0;
  for(let n=0;n<detail.pools.length;n++){
    const rewritten=await pool(detail.pools[n].file);updated.pools[n].file=rewritten.file;
    rewritten.rows.forEach((row,offset)=>{assert(ids.has(row.ocid));assert(!Object.hasOwn(updated.records,row.ocid));updated.records[row.ocid]=[n,offset];outfits++;});
  }
  assert.equal(outfits,Object.keys(detail.records).length);
  prepared.push({record,file,index:next,detailsPath,detail:updated});
  report.push({date:record.date,characters,outfits,rank_values_changed:0});
}
// Move pointers only after every new immutable object has been prepared.
for(const item of prepared){item.record.index=item.file;await write(item.detailsPath,item.detail);if(item.index.data_date===current.data_date)await write('data/mystery-index.json',item.index);}
await write('data/mystery-dates.json',catalog);
const legacy=await read('data/mystery-rankings.json');if(legacy.characters?.length){legacy.characters=legacy.characters.map(row=>({...row,ocid:publicCharacterId(row.ocid)}));await write('data/mystery-rankings.json',legacy);}
const cleanup=await pruneOrphans(root,{apply:true});
console.log(JSON.stringify({policy:PUBLIC_ID_POLICY,dates:report,removed_obsolete_public_files:cleanup.remove.length,api_calls:0}));
