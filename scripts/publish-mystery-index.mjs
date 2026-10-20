// All eligible API rows are scanned first. Only then build small, exact TOP 10 queries.
import {createReadStream} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MIN_LEVEL,MAX_LEVEL,normalizeCharacter,worldGroup,prepareSnapshot,snapshotCSV,MAX_CSV_BYTES} from '../mystery-core.js';

const compare=(a,b)=>b.combat-a.combat || a.name.localeCompare(b.name,'ko') || a.world.localeCompare(b.world,'ko');
export function queryAccumulator(date) {
  const seen=new Map(),names=new Map(),queries=new Map(),jobs=new Set(),worlds=new Set(); let inputRows=0;
  function add(raw) {
    inputRows++;
    const row=normalizeCharacter(raw);
    if(!row || row.observedAt!==date) throw Error('같은 기준일의 유효한 캐릭터 API 기록만 공개할 수 있습니다.');
    const key=row.ocid||JSON.stringify([row.world,row.name]),serialized=createHash('sha256').update(JSON.stringify(row)).digest('hex');
    const nameKey=JSON.stringify([row.world,row.name]);
    if(names.has(nameKey)&&names.get(nameKey)!==key) throw Error('같은 기준일 캐릭터의 식별자가 충돌합니다.');
    if(seen.has(key)) { if(seen.get(key)!==serialized) throw Error('동일 캐릭터의 API 기록이 충돌합니다.'); return; }
    seen.set(key,serialized); names.set(nameKey,key); jobs.add(row.job); worlds.add(row.world);
    const group=worldGroup(row.world);
    for(const world of ['',row.world]) for(const job of ['',row.job]) {
      const key=JSON.stringify([group,world,job]);
      if(!queries.has(key)) queries.set(key,{group,world,job,counts:new Map(Array.from({length:MAX_LEVEL-MIN_LEVEL+1},(_,i)=>[MIN_LEVEL+i,0])),levels:new Map()});
      const q=queries.get(key); q.counts.set(row.level,q.counts.get(row.level)+1);
      const top=q.levels.get(row.level)||[]; top.push(row); top.sort(compare); top.length=Math.min(10,top.length); q.levels.set(row.level,top);
    }
  }
  return {add,queries,jobs,worlds,get total(){return seen.size;},get inputRows(){return inputRows;}};
}

export async function publishIndex({input,audit,root}) {
  const progress=JSON.parse(await readFile(audit,'utf8')),counts=progress.counts;
  if(!counts || counts.pending || counts.error || !Number.isSafeInteger(progress.candidates) || Object.values(counts).reduce((s,n)=>s+n,0)!==progress.candidates) throw Error('전체 후보 API 검증과 오류 재확인이 끝난 작업만 공개할 수 있습니다.');
  const acc=queryAccumulator(progress.data_date);
  for await(const line of createInterface({input:createReadStream(input),crlfDelay:Infinity})) if(line.trim()) acc.add(JSON.parse(line));
  if(acc.inputRows!==counts.verified || !acc.total) throw Error('수집 완료 기록과 API 원본 행 수가 일치하지 않습니다.');
  const data=join(root,'data'),cache=join(data,'mystery-cache'); await mkdir(cache,{recursive:true});
  const updatedAt=new Date().toISOString();
  const source='NEXON character/basic · character/stat API';
  const coverage={status:'partial',level_min:MIN_LEVEL,level_max:MAX_LEVEL,jobs:[...acc.jobs].sort(),worlds:[...acc.worlds].sort(),
    description:`후보 ${progress.candidates.toLocaleString('ko-KR')}명을 조회해 확인한 API 대상 ${acc.total.toLocaleString('ko-KR')}명의 전투력을 비교합니다.`,
    limitations:['이름 목록 확보에 사용한 랭킹 순위·레벨로 전투력 시상 순위를 결정하지 않습니다.',
      'API로 확인 불가능한 캐릭터와 후보 목록 밖 캐릭터가 있어 공식 전체 순위를 보장하지 않습니다.',
      '공개 파일은 전체 검증 후 추린 레벨별 전투력 상위 10명이며 선택 조건의 TOP 10을 정확히 재구성합니다.']};
  const entries=[];
  for(const q of acc.queries.values()) {
    const rows=[...q.levels].sort(([a],[b])=>a-b).flatMap(([,rows])=>rows);
    const snapshot=prepareSnapshot(rows,{date:progress.data_date,source,coverage,updatedAt});
    const text=JSON.stringify(snapshot)+'\n';
    if(Buffer.byteLength(text)>MAX_CSV_BYTES) throw Error('조회 파일이 허용 용량을 넘었습니다.');
    const hash=createHash('sha256').update(text).digest('hex');
    await writeFile(join(cache,hash+'.json'),text); await writeFile(join(cache,hash+'.csv'),snapshotCSV(snapshot));
    entries.push({group:q.group,world:q.world,job:q.job,file:`data/mystery-cache/${hash}.json`,counts:[...q.counts]});
  }
  entries.sort((a,b)=>JSON.stringify([a.group,a.world,a.job]).localeCompare(JSON.stringify([b.group,b.world,b.job])));
  const index={schema_version:1,type:'mystery-query-index',data_date:progress.data_date,updated_at:updatedAt,source,coverage,
    candidates:progress.candidates,verified:acc.total,duplicate_verified_rows:acc.inputRows-acc.total,excluded:progress.candidates-acc.inputRows,
    jobs:[...acc.jobs].sort(),worlds:[...acc.worlds].sort(),queries:entries};
  await writeFile(join(data,'mystery-index.json'),JSON.stringify(index,null,2)+'\n');
  // This is an operator preparation step. Commit and deploy only after checks and review.
  const config=JSON.parse(await readFile(join(root,'mystery-config.json'),'utf8'));
  if(config.apiBase) throw Error('Worker 연결을 사용 중입니다. 정적 목록 전환을 먼저 검토하세요.');
  await writeFile(join(root,'mystery-config.json'),JSON.stringify({...config,staticIndex:'data/mystery-index.json'},null,2)+'\n');
  return {candidates:progress.candidates,verified:acc.total,queries:entries.length};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { const [input,audit,root='.']=process.argv.slice(2); if(!input||!audit) throw Error('사용법: node scripts/publish-mystery-index.mjs 검증본.jsonl 수집완료기록.json [저장소경로]'); console.log(JSON.stringify(await publishIndex({input,audit,root:resolve(root)}))); }
  catch(e) { console.error(e.message); process.exitCode=1; }
}
