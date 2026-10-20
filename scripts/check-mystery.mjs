import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {MAX_CSV_BYTES,validateSnapshot,snapshotCSV} from '../mystery-core.js';
const text=await readFile(new URL('../data/mystery-rankings.json',import.meta.url),'utf8');
assert(Buffer.byteLength(text)<=MAX_CSV_BYTES);
const snapshot=validateSnapshot(JSON.parse(text));
assert.equal(await readFile(new URL('../data/mystery-rankings.csv',import.meta.url),'utf8'),snapshotCSV(snapshot),'공개 JSON과 CSV가 서로 다릅니다.');
// Unknown fields cannot accidentally publish configuration or credentials.
assert.deepEqual(JSON.parse(text),snapshot,'공개 데이터에 허용되지 않은 필드가 있습니다.');
console.log(`Mystery feed verified: ${snapshot.characters.length} characters, ${snapshot.coverage.status}`);
