// Remove only content-addressed generated files outside the active snapshot graph.
// Active catalog dates, the current index, and outfit pointers are always roots.
import {readFile,readdir,lstat,realpath,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';

const generated=/^data\/(?:mystery-cache\/[a-f0-9]{64}\.(?:json|csv)|mystery-(?:history|details)\/\d{4}-\d{2}-\d{2}\/(?:revisions\/)?[a-f0-9]{64}\.json)$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const jsonHashMatches=(name,bytes)=>name===sha(bytes)||name===sha(bytes.toString('utf8').replace(/\r\n/g,'\n'));
function knownGeneratedJSON(bytes){
  let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{return false;}
  if(!value||![1,2].includes(value.schema_version))return false;
  return value.type==='mystery-query-index'&&Array.isArray(value.queries)
    ||value.encoding==='gzip-base64'&&typeof value.payload==='string'&&typeof (value.data_date||value.date)==='string'
    ||Array.isArray(value.characters)&&typeof value.coverage?.data_date==='string'
    ||typeof value.date==='string'&&Array.isArray(value.pools)&&value.records&&typeof value.records==='object';
}

export async function orphanPlan(root){
  root=resolve(root);const actualRoot=await realpath(root),keep=new Set();
  async function safe(name){
    const path=resolve(root,...name.split('/'));
    if(!path.startsWith(root+sep))throw Error('Generated file is outside the public root');
    const actual=await realpath(path);
    if(!actual.startsWith(actualRoot+sep)||(await lstat(path)).isSymbolicLink())throw Error('Generated file links are not allowed');
    return path;
  }
  async function read(name,optional=false){
    try{return JSON.parse(await readFile(await safe(name),'utf8'));}
    catch(e){if(optional&&e.code==='ENOENT')return null;throw e;}
  }
  function retain(name){
    if(typeof name!=='string'||!generated.test(name))throw Error('Invalid generated snapshot reference');
    keep.add(name);if(name.startsWith('data/mystery-cache/')&&name.endsWith('.json'))keep.add(name.slice(0,-5)+'.csv');
  }
  async function index(name,optional=false){
    const data=await read(name,optional);if(!data)return;
    for(const pool of data.pools||[])retain(pool.file);
    for(const query of data.queries||[])if(query.file!==undefined)retain(query.file);
  }
  const catalog=await read('data/mystery-dates.json',true);
  // Without complete roots, keep unknown files rather than guessing reachability.
  if(!catalog?.dates?.length||catalog.dates.some(d=>typeof d.index!=='string'))return {root,remove:[],bytes:0,skipped:'No complete active catalog'};
  for(const date of catalog.dates){
    retain(date.index);await index(date.index);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date.date))throw Error('Invalid snapshot date');
    await index(`data/mystery-details/${date.date}/index.json`,true);
  }
  await index('data/mystery-index.json',true);
  // Verify all referenced JSON files exist before planning any removal.
  for(const name of keep)if(name.endsWith('.json'))await safe(name);
  const files=[];
  async function walk(name){
    let entries;try{entries=await readdir(join(root,name),{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}
    for(const entry of entries){
      const child=name+'/'+entry.name;
      if(entry.isSymbolicLink())throw Error('Generated directory links are not allowed');
      if(entry.isDirectory()){
        await safe(child);await walk(child);
      }else if(entry.isFile()&&generated.test(child))files.push(child);
    }
  }
  for(const directory of ['data/mystery-cache','data/mystery-history','data/mystery-details'])await walk(directory);
  const remove=[],orphanJson=new Set();
  for(const name of files){
    if(keep.has(name)||!name.endsWith('.json'))continue;
    const path=await safe(name),bytes=await readFile(path),hash=name.split('/').at(-1).slice(0,-5);
    // An unfamiliar/manual file is not proved disposable by its name alone.
    if(!jsonHashMatches(hash,bytes)||!knownGeneratedJSON(bytes))continue;
    remove.push({path,file:name,bytes:bytes.length,sha256:sha(bytes)});orphanJson.add(name);
  }
  for(const name of files){
    if(keep.has(name)||!name.endsWith('.csv')||!orphanJson.has(name.slice(0,-4)+'.json'))continue;
    const path=await safe(name),bytes=await readFile(path);remove.push({path,file:name,bytes:bytes.length,sha256:sha(bytes)});
  }
  return {root,remove,bytes:remove.reduce((sum,file)=>sum+file.bytes,0),referenced_files:keep.size};
}

export async function pruneOrphans(root,{apply=false}={}){
  const plan=await orphanPlan(root);
  if(apply){
    const actualRoot=await realpath(plan.root);
    // Revalidate every source and digest before the first individual removal.
    for(const file of plan.remove){
      if(!generated.test(file.file)||resolve(plan.root,...file.file.split('/'))!==file.path
         ||!(await realpath(file.path)).startsWith(actualRoot+sep)||(await lstat(file.path)).isSymbolicLink()
         ||sha(await readFile(file.path))!==file.sha256)throw Error('Generated file changed while preparing cleanup');
    }
    for(const file of plan.remove)await rm(file.path);
  }
  return {...plan,applied:apply};
}
