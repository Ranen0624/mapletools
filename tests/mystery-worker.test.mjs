import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/mystery-worker.js';
import {emptySnapshot} from '../mystery-core.js';
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
