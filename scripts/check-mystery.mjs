import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadRankingSource} from '../mystery-source.js';
import {MAX_CSV_BYTES,validateSnapshot,snapshotCSV,prepareSnapshot} from '../mystery-core.js';
import {gunzipSync} from 'node:zlib';
const text=await readFile(new URL('../data/mystery-rankings.json',import.meta.url),'utf8');
assert(Buffer.byteLength(text)<=MAX_CSV_BYTES);
const snapshot=validateSnapshot(JSON.parse(text));
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
  for(const day of indexes) {
  const index=JSON.parse(await readFile(new URL(day.path,root),'utf8'));
  if(index.schema_version===2) {
    for(const pool of index.pools) {
      const bytes=await readFile(new URL(pool.file,root));
      assert.ok(pool.file.endsWith(createHash('sha256').update(bytes).digest('hex')+'.json'));
      const envelope=JSON.parse(bytes),rows=JSON.parse(gunzipSync(Buffer.from(envelope.payload,'base64')));
      assert.deepEqual(Object.keys(envelope).sort(),['data_date','encoding','payload','schema_version']);
      assert.deepEqual(rows,prepareSnapshot(rows,{date:day.date}).characters,'압축 기록에 허용되지 않은 필드가 있습니다.');
    }
    const indexBytes=await readFile(new URL(day.path,root));
    assert.ok(day.path.endsWith(createHash('sha256').update(indexBytes).digest('hex')+'.json'));
  }
  for(const q of index.queries) {
    const data=await loadRankingSource({base:new URL('https://mystery.test/'),fetcher,options:{...q,...(config.staticCatalog?{date:day.date}:{})}});
    const {availableDates,availableJobs,availableWorlds,selectionCounts,downloadJSON,downloadCSV,collection,...canonical}=data;
    if(index.schema_version===2) { assert.deepEqual(canonical,validateSnapshot(canonical)); assert.equal(canonical.coverage.data_date,day.date); continue; }
    const file=await readFile(new URL(q.file,root),'utf8');
    assert.ok(q.file.endsWith(createHash('sha256').update(file).digest('hex')+'.json'));
    assert.deepEqual(JSON.parse(file),canonical,'검색 파일에 허용되지 않은 필드가 있습니다.');
    assert.equal(await readFile(new URL(q.file.replace(/\.json$/,'.csv'),root),'utf8'),snapshotCSV(canonical));
  }
  console.log(`Mystery index verified: ${index.verified} API characters, ${index.queries.length} query files`);
  }
}
