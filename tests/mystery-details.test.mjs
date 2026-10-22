import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {normalizeDetail,imageFingerprint,loadCharacterDetail,decodeDetailPool} from '../mystery-details.js';
import {publishDetails} from '../scripts/publish-mystery-details.mjs';
import {parseLocalImport,parseImport} from '../mystery-core.js';
const date='2026-10-20',image='https://open.api.nexon.com/static/maplestory/character/look/VALIDATION_ONLY';
const character={ocid:'test-detail-only',name:'상세검증전용',world:'루나',observedAt:date,image};
const detail={ocid:character.ocid,name:character.name,world:character.world,date,observed_at:date+'T07:00:00Z',image_sha256:await imageFingerprint(image),gender:'여',guild:'검증길드',cash_preset:2,outfit_source:'preset',items:[{slot:'모자',name:'검증 아이템',label:'스페셜라벨',prism:{range:'전체',hue:10,saturation:-20,value:30}}]};

test('detail schema strips unknown fields and rejects invalid items, dates and prism data',()=>{
  assert.deepEqual(normalizeDetail({...detail,private_source:'VALIDATION_ONLY',items:[{...detail.items[0],raw_options:'PRIVATE'}]}),detail);
  for(const extra of [{date:'2026-02-30'},{cash_preset:4},{outfit_source:'unavailable'},{cash_preset:null},{items:[{...detail.items[0],prism:{...detail.items[0].prism,hue:360}}]}])assert.equal(normalizeDetail({...detail,...extra}),null);
});

test('compressed public details are lazy, cached and matched against name, world, date and outfit image',async()=>{
  const evidence=fileURLToPath(new URL('./evidence/',import.meta.url));await mkdir(evidence,{recursive:true});
  const root=await mkdtemp(join(evidence,'details-'));
  try{
    await mkdir(join(root,'data'));await writeFile(join(root,'data/mystery-dates.json'),JSON.stringify({latest:date,dates:[{date}]}));
    const input=join(root,'private-input.jsonl');await writeFile(input,JSON.stringify({...detail,private_source:'DROP_THIS'})+'\n');
    assert.equal((await publishDetails({input,root,date})).characters,1);
    const calls=[],fetcher=async url=>{calls.push(url);try{return {ok:true,text:()=>readFile(join(root,new URL(url).pathname.slice(1)),'utf8')};}catch{return {ok:false,status:404};}};
    const opts={base:new URL('https://detail.test/'),fetcher};
    assert.deepEqual(await loadCharacterDetail(character,opts),detail);await loadCharacterDetail(character,opts);assert.equal(calls.length,2);
    assert.equal(await loadCharacterDetail({...character,ocid:'uncollected'},opts),null);
    for(const extra of [{name:'different'},{world:'에오스'},{image:image+'CHANGED'}])await assert.rejects(loadCharacterDetail({...character,...extra},opts),/일치하지/);
    const index=JSON.parse(await readFile(join(root,'data/mystery-details',date,'index.json'),'utf8'));
    const pool=JSON.parse(await readFile(join(root,index.pools[0].file),'utf8'));
    assert.deepEqual(await decodeDetailPool(pool,date,1),[detail]);
    assert.equal(JSON.stringify(await decodeDetailPool(pool,date,1)).includes('DROP_THIS'),false);
    const badFetcher=async()=>({ok:true,text:async()=>JSON.stringify({...index,pools:[{file:'https://untrusted.test/private',count:1}]})});
    await assert.rejects(loadCharacterDetail(character,{...opts,fetcher:badFetcher}),/주소/);
    const missing=async()=>({ok:false,status:404});assert.equal(await loadCharacterDetail(character,{...opts,fetcher:missing}),null);
    await assert.rejects(publishDetails({input,root,date:'2026-09-01'}),/보관 범위/);
    const indexPath=join(root,'data/mystery-details',date,'index.json'),previous=await readFile(indexPath,'utf8');
    await writeFile(input,JSON.stringify({...detail,guild:'수정 검증'})+'\n');await publishDetails({input,root,date});
    const revision=join(root,'data/mystery-details',date,'revisions',createHash('sha256').update(previous).digest('hex')+'.json');
    assert.equal(await readFile(revision,'utf8'),previous);
    assert.deepEqual(JSON.parse(await readFile(join(root,index.pools[0].file),'utf8')),pool);
  }finally{assert.ok(root.startsWith(join(evidence,'details-')));await rm(root,{recursive:true,force:true});}
});

test('corrupt or oversized decompressed detail sources cannot display as collected items',async()=>{
  const packed=rows=>({schema_version:1,date,encoding:'gzip-base64',payload:gzipSync(JSON.stringify(rows)).toString('base64')});
  await assert.rejects(decodeDetailPool(packed([{...detail,date:'2026-10-19'}]),date,1),/기록/);
  await assert.rejects(decodeDetailPool(packed([detail]),date,2),/개수/);
  await assert.rejects(decodeDetailPool(packed(['x'.repeat(6*1024*1024)]),date,1),/용량/);
});

test('personal CSV keeps old dates separate while the public importer still rejects mixed dates',()=>{
  const csv='닉네임,월드,직업,레벨,전투력,기준일\n기록검증,루나,아델,290,100,2020-01-01\n기록검증,루나,아델,291,200,2020-01-02';
  const dates=parseLocalImport(csv);assert.deepEqual(dates.map(s=>s.coverage.data_date),['2020-01-02','2020-01-01']);
  assert.equal(dates[0].characters[0].combat,200);assert.equal(dates[1].characters[0].combat,100);assert.throws(()=>parseImport(csv),/동일한 기준일/);
  assert.throws(()=>parseLocalImport(csv.replace('2020-01-01','2020-02-30')),/기준일/);
});
