import {isPublicCharacterId} from './public-identity.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadRankingSource} from '../mystery-source.js';
import {MAX_CSV_BYTES,validateSnapshot,snapshotCSV,prepareSnapshot} from '../mystery-core.js';
import {gunzipSync} from 'node:zlib';
import {normalizeDetail} from '../mystery-details.js';
import {cutoffDate,retentionDays} from './mystery-retention.mjs';
const text=await readFile(new URL('../data/mystery-rankings.json',import.meta.url),'utf8');
assert(Buffer.byteLength(text)<=MAX_CSV_BYTES);
const snapshot=validateSnapshot(JSON.parse(text));
assert(snapshot.characters.every(row=>!row.ocid||isPublicCharacterId(row.ocid)),'Legacy public feed contains a private identifier');
assert.equal(await readFile(new URL('../data/mystery-rankings.csv',import.meta.url),'utf8'),snapshotCSV(snapshot),'공개 JSON과 CSV가 서로 다릅니다.');
// Unknown fields cannot accidentally publish configuration or credentials.
assert.deepEqual(JSON.parse(text),snapshot,'공개 데이터에 허용되지 않은 필드가 있습니다.');
console.log(`Mystery feed verified: ${snapshot.characters.length} characters, ${snapshot.coverage.status}`);
const root=new URL('../',import.meta.url),config=JSON.parse(await readFile(new URL('mystery-config.json',root),'utf8'));
if(config.staticIndex) {
  assert.equal(config.staticIndex,'data/mystery-index.json'); assert.ok(!config.apiBase);
  const latest=JSON.parse(await readFile(new URL(config.staticIndex,root),'utf8'));
  const indexes=config.staticCatalog?JSON.parse(await readFile(new URL(config.staticCatalog,root),'utf8')).dates.map(d=>({date:d.date,path:d.index})):[{date:latest.data_date,path:config.staticIndex}];
  const fetcher=async url=>({ok:true,text:()=>readFile(new URL(new URL(url).pathname.slice(1),root),'utf8')});
  const keepDays=await retentionDays(fileURLToPath(root));
  if(config.staticCatalog){
    const catalog=JSON.parse(await readFile(new URL(config.staticCatalog,root),'utf8'));
    assert.equal(catalog.retention_days,keepDays);
    assert(indexes.every(d=>d.date>=cutoffDate(catalog.latest,keepDays)),'공개 보관 기간이 지난 날짜입니다.');
  }
  for(const day of indexes) {
  const index=JSON.parse(await readFile(new URL(day.path,root),'utf8'));
  const canonicalById=new Map();
  if(index.schema_version===2) {
    for(const pool of index.pools) {
      const bytes=await readFile(new URL(pool.file,root));
      assert.ok(pool.file.endsWith(createHash('sha256').update(bytes).digest('hex')+'.json'));
      const envelope=JSON.parse(bytes),rows=JSON.parse(gunzipSync(Buffer.from(envelope.payload,'base64')));
      for(const row of rows)if(row.ocid){assert(isPublicCharacterId(row.ocid),'공개 파일에 원본 API 식별자가 있습니다.');canonicalById.set(row.ocid,row);}
      assert.deepEqual(Object.keys(envelope).sort(),['data_date','encoding','payload','schema_version']);
      assert.deepEqual(rows,prepareSnapshot(rows,{date:day.date}).characters,'압축 기록에 허용되지 않은 필드가 있습니다.');
    }
    const indexBytes=await readFile(new URL(day.path,root));
    assert.ok(day.path.endsWith(createHash('sha256').update(indexBytes).digest('hex')+'.json'));
  }
  let details;
  try{details=JSON.parse(await readFile(new URL(`data/mystery-details/${day.date}/index.json`,root),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(details){
    assert.deepEqual(Object.keys(details).sort(),['date','pools','records','schema_version']);assert.equal(details.schema_version,1);assert.equal(details.date,day.date);
    const found=new Set();
    for(let n=0;n<details.pools.length;n++){
      const pool=details.pools[n];assert.deepEqual(Object.keys(pool).sort(),['count','file']);assert(pool.count>=1&&pool.count<=100);
      assert(new RegExp(`^data/mystery-details/${day.date}/[a-f0-9]{64}\\.json$`).test(pool.file));
      const bytes=await readFile(new URL(pool.file,root));assert(bytes.length<=MAX_CSV_BYTES);assert(pool.file.endsWith(createHash('sha256').update(bytes).digest('hex')+'.json'));
      const envelope=JSON.parse(bytes);assert.deepEqual(Object.keys(envelope).sort(),['date','encoding','payload','schema_version']);assert.equal(envelope.schema_version,1);assert.equal(envelope.date,day.date);assert.equal(envelope.encoding,'gzip-base64');
      const raw=gunzipSync(Buffer.from(envelope.payload,'base64'),{maxOutputLength:MAX_CSV_BYTES}),rows=JSON.parse(raw);assert.equal(rows.length,pool.count);
      for(let offset=0;offset<rows.length;offset++){
        const row=rows[offset];assert.deepEqual(row,normalizeDetail(row),'상세 정보에 허용되지 않은 필드가 있습니다.');assert.equal(row.date,day.date);
        assert(!found.has(row.ocid));found.add(row.ocid);assert.deepEqual(details.records[row.ocid],[n,offset]);
        const original=canonicalById.get(row.ocid);assert(original,'공개 순위에 없는 상세 정보입니다.');assert.equal(row.name,original.name);assert.equal(row.world,original.world);assert.equal(row.image_sha256,createHash('sha256').update(original.image).digest('hex'));
      }
    }
    assert.equal(found.size,Object.keys(details.records).length);console.log(`Character details verified: ${day.date}, ${found.size} same-snapshot outfits`);
  }
  for(const q of index.queries) {
    const data=await loadRankingSource({base:new URL('https://mystery.test/'),fetcher,options:{...q,...(config.staticCatalog?{date:day.date}:{})}});
    const {availableDates,availableDateModes,preferredApiMode,historyRetentionDays,availableJobs,availableWorlds,selectionCounts,downloadJSON,downloadCSV,collection,...canonical}=data;
    if(index.schema_version===2) { assert.deepEqual(canonical,validateSnapshot(canonical)); assert.equal(canonical.coverage.data_date,day.date); continue; }
    const file=await readFile(new URL(q.file,root),'utf8');
    assert.ok(q.file.endsWith(createHash('sha256').update(file).digest('hex')+'.json'));
    assert.deepEqual(JSON.parse(file),canonical,'검색 파일에 허용되지 않은 필드가 있습니다.');
    assert.equal(await readFile(new URL(q.file.replace(/\.json$/,'.csv'),root),'utf8'),snapshotCSV(canonical));
  }
  console.log(`Mystery index verified: ${index.verified} API characters, ${index.queries.length} query files`);
  }
}
