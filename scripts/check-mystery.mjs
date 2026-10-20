import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadRankingSource} from '../mystery-source.js';
import {MAX_CSV_BYTES,validateSnapshot,snapshotCSV} from '../mystery-core.js';
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
  const index=JSON.parse(await readFile(new URL(config.staticIndex,root),'utf8'));
  const fetcher=async url=>({ok:true,text:()=>readFile(new URL(new URL(url).pathname.slice(1),root),'utf8')});
  for(const q of index.queries) {
    const data=await loadRankingSource({base:new URL('https://mystery.test/'),fetcher,options:q});
    const file=await readFile(new URL(q.file,root),'utf8');
    assert.ok(q.file.endsWith(createHash('sha256').update(file).digest('hex')+'.json'));
    const {availableJobs,availableWorlds,selectionCounts,downloadJSON,downloadCSV,collection,...canonical}=data;
    assert.deepEqual(JSON.parse(file),canonical,'검색 파일에 허용되지 않은 필드가 있습니다.');
    assert.equal(await readFile(new URL(q.file.replace(/\.json$/,'.csv'),root),'utf8'),snapshotCSV(canonical));
  }
  console.log(`Mystery index verified: ${index.verified} API characters, ${index.queries.length} query files`);
}
