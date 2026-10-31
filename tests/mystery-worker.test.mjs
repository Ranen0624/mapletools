import {writeFile,readFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/mystery-worker.js';
import {publicCharacterId} from '../scripts/public-identity.mjs';
import {prepareSnapshot,emptySnapshot} from '../mystery-core.js';
const req=(path='/v1/mystery/snapshot',method='GET',origin='https://mapletools.kr')=>new Request('https://worker.test'+path,{method,headers:{Origin:origin}});
test('Worker adapter returns same empty snapshot contract with bounded CORS',async()=>{
  const env={PUBLIC_ORIGIN:'https://mapletools.kr',DB:{prepare:()=>({first:async()=>null})}};
  const response=await worker.fetch(req(),env);assert.equal(response.status,200);assert.deepEqual(await response.json(),emptySnapshot());assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.PUBLIC_ORIGIN);
  assert.equal((await worker.fetch(req('/v1/mystery/snapshot','GET','https://other.test'),env)).headers.get('Access-Control-Allow-Origin'),null);
  assert.equal((await worker.fetch(req('/other'),env)).status,404);assert.equal((await worker.fetch(req('/v1/mystery/snapshot','POST'),env)).status,405);
});
test('Worker hides internal errors and never substitutes ranks on D1 failure',async()=>{
  const response=await worker.fetch(req(),{DB:{prepare:()=>{throw Error('private-key-context');}}});
  assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual(await response.json(),{error:'snapshot_unavailable'});
});
test('immutable snapshot read validates stored rows before publication response',async()=>{
  const metadata=emptySnapshot(); delete metadata.characters;
  const env={DB:{prepare:query=>query.startsWith('SELECT s.')?{first:async()=>({id:'snapshot-a',metadata:JSON.stringify(metadata)})}:{bind:()=>({all:async()=>({results:[{payload:'{"combat":"unverified"}'}]})})}}};
  assert.equal((await worker.fetch(req(),env)).status,503);
});


test('Worker serves opaque identifiers and refuses a stored raw API identifier',async()=>{
  const raw='f'.repeat(32)+'b'.repeat(32);
  for(const ocid of [raw,publicCharacterId(raw),'']) {
    const snapshot=prepareSnapshot([{name:'테스트',world:'루나',job:'아델',level:290,combat:123456,ocid,observedAt:'2026-10-29',image:''}],{date:'2026-10-29'});
    assert.equal(snapshot.characters.length,1);
    const {characters,...metadata}=snapshot;
    const env={DB:{prepare:query=>query.startsWith('SELECT s.')?{first:async()=>({id:'snapshot-a',metadata:JSON.stringify(metadata)})}:{bind:()=>({all:async()=>({results:characters.map(row=>({payload:JSON.stringify(row)}))})})}}};
    const response=await worker.fetch(req(),env);
    assert.equal(response.status,ocid===raw?503:200);
    const text=await response.text();assert(!text.includes(raw));
    if(ocid===raw)assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
});


test('D1 SQL builder anonymizes raw API identifiers before writing payloads',async()=>{
  const raw='e'.repeat(32)+'a'.repeat(32);
  const input=join(tmpdir(),'mapletools-sql-'+randomUUID()+'.json'),output=input+'.sql';
  try {
    const snapshot=prepareSnapshot([{name:'테스트',world:'루나',job:'아델',level:290,combat:123456,ocid:raw,observedAt:'2026-10-29',image:''}],{date:'2026-10-29'});
    await writeFile(input,JSON.stringify(snapshot));
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/mystery-sql.mjs',import.meta.url)),input,output],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const sql=await readFile(output,'utf8');assert(!sql.includes(raw));assert(!sql.includes('a'.repeat(32)));
    assert(sql.includes(publicCharacterId(raw)));assert(sql.includes('123456'));
    assert(sql.includes('mystery_publication'));
  } finally {await unlink(input).catch(()=>{});await unlink(output).catch(()=>{});}
});
