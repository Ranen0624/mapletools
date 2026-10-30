import {publicCharacter} from './public-identity.mjs';
// Run locally. Raw PC exports never need to enter the public Git repository.
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MAX_CSV_BYTES,parseImport,prepareSnapshot,snapshotCSV,validateSnapshot} from '../mystery-core.js';
export async function importFile({input,output,date='',scope}) {
  const buffer=await readFile(input);
  if(buffer.length>MAX_CSV_BYTES) throw Error('파일 용량은 5MB 이하여야 합니다.');
  const format=extname(input).toLowerCase()==='.json'?'json':'csv';
  let text;
  try { text=new TextDecoder('utf-8',{fatal:true}).decode(buffer); }
  catch { if(format==='json') throw Error('JSON은 UTF-8로 저장해 주세요.'); text=new TextDecoder('euc-kr',{fatal:true}).decode(buffer); }
  const imported=parseImport(text,{format,date});
  if(!imported.characters.length) throw Error('공개할 실제 캐릭터가 없습니다.');
  const metadata=scope?JSON.parse(await readFile(scope,'utf8')):{};
  const snapshot=validateSnapshot(prepareSnapshot(imported.characters.map(publicCharacter),{
    date:imported.coverage.data_date,source:metadata.source,coverage:metadata.coverage,updatedAt:new Date().toISOString(),
  }));
  const json=JSON.stringify(snapshot,null,2)+'\n';
  if(Buffer.byteLength(json)>MAX_CSV_BYTES) throw Error('정규화한 공개 JSON이 5MB를 넘었습니다. 범위를 나눠 주세요.');
  const target=resolve(output),csv=target.replace(/\.json$/i,'')+'.csv';
  if([target,csv].includes(resolve(input)) || (scope&&[target,csv].includes(resolve(scope)))) throw Error('원본 파일을 출력으로 덮어쓸 수 없습니다.');
  await mkdir(dirname(target),{recursive:true});
  // The feed's JSON is replaced last. Git publishes JSON and CSV in one reviewed commit.
  await writeFile(csv+'.tmp',snapshotCSV(snapshot)); await rename(csv+'.tmp',csv);
  await writeFile(target+'.tmp',json); await rename(target+'.tmp',target);
  return {characters:snapshot.characters.length,data_date:snapshot.coverage.data_date,status:snapshot.coverage.status};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),o={};
    for(let i=0;i<args.length;i+=2) { if(!['--input','--output','--date','--scope'].includes(args[i])||!args[i+1]) throw Error('사용법: node scripts/import-mystery.mjs --input 원본.csv --date YYYY-MM-DD [--scope 범위.json] [--output data/mystery-rankings.json]'); o[args[i].slice(2)]=args[i+1]; }
    if(!o.input) throw Error('--input 원본 파일 경로가 필요합니다.');
    console.log(JSON.stringify(await importFile({...o,output:o.output||'data/mystery-rankings.json'})));
  } catch(e) { console.error(e.message); process.exitCode=1; }
}
