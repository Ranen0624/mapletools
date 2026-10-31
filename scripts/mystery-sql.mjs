import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {publicCharacter} from './public-identity.mjs';
import {validateSnapshot} from '../mystery-core.js';
const [input,output]=process.argv.slice(2);
if(!input||!output) throw Error('사용법: node scripts/mystery-sql.mjs 공개수집본.json 출력.sql');
const original=validateSnapshot(JSON.parse(await readFile(input,'utf8')));
const s=validateSnapshot({...original,characters:original.characters.map(publicCharacter)});
const id=createHash('sha256').update(JSON.stringify(s)).digest('hex');
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
const {characters,...metadata}=s;
const statements=[`INSERT OR IGNORE INTO mystery_snapshots (id, metadata) VALUES (${quote(id)}, ${quote(JSON.stringify(metadata))});`];
characters.forEach((r,i)=>statements.push(`INSERT OR IGNORE INTO mystery_characters (snapshot_id, row_no, payload) VALUES (${quote(id)}, ${i}, ${quote(JSON.stringify(r))});`));
// Publish only after every immutable row has been written. Keep the previous snapshot for rollback.
statements.push(`INSERT INTO mystery_publication (id, snapshot_id) VALUES (1, ${quote(id)}) ON CONFLICT(id) DO UPDATE SET snapshot_id=excluded.snapshot_id;`);
await writeFile(output,statements.join('\n')+'\n');
console.log('검증한 공개 수집본 SQL을 생성했습니다. 자동 배포는 하지 않았습니다.');
