// Build exact TOP 10 queries over all verified rows in this explicitly dated snapshot.
import {createReadStream} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeHistory} from './mystery-history.mjs';
import {MIN_LEVEL,MAX_LEVEL,EXCLUDED_JOBS,jobExcluded,normalizeCharacter,worldGroup,prepareSnapshot,snapshotCSV,MAX_CSV_BYTES} from '../mystery-core.js';

const compare=(a,b)=>b.combat-a.combat || a.name.localeCompare(b.name,'ko') || a.world.localeCompare(b.world,'ko');
export function queryAccumulator(date) {
  const seen=new Map(),names=new Map(),queries=new Map(),jobs=new Set(),worlds=new Set(),bases=new Set(); let inputRows=0,scopeExcluded=0;
  function add(raw) {
    inputRows++;
    const row=normalizeCharacter(raw);
    if(!row || row.observedAt!==date) throw Error('같은 기준일의 유효한 캐릭터 API 기록만 공개할 수 있습니다.');
    if(jobExcluded(row.job)) {scopeExcluded++;return;}
    bases.add(row.calculation?'preset':'equipped');
    if(bases.size>1) throw Error('착용 전투력과 프리셋 계산값을 혼합할 수 없습니다.');
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
  return {add,queries,jobs,worlds,bases,get scopeExcluded(){return scopeExcluded;},get total(){return seen.size;},get inputRows(){return inputRows;}};
}

export function discoveryMetadata(progress,previous={}) {
  const fresh=Object.hasOwn(progress,'candidate_groups');
  const same=previous.data_date===progress.data_date && previous.candidates===progress.candidates;
  const groups=fresh?progress.candidate_groups:(same?previous.candidate_groups||{}:{});
  const valid=!!groups && !Array.isArray(groups) && typeof groups==='object'
    && Object.entries(groups).every(([key,n])=>['regular','eos-helios'].includes(key)&&Number.isSafeInteger(n)&&n>=0)
    && (!Object.keys(groups).length || Object.values(groups).reduce((a,b)=>a+b,0)===progress.candidates);
  if(fresh&&!valid) throw Error('후보 탐색 분류 인원과 전체 후보 수가 일치하지 않습니다.');
  const coverage=progress.discovery_coverage ?? (same&&valid?previous.discovery_coverage:[]) ?? [];
  if(!Array.isArray(coverage)) throw Error('후보 탐색 범위 기록을 확인하세요.');
  return {candidate_groups:valid?groups:{},discovery_coverage:coverage};
}

export async function publishIndex({input,audit,root,allowPartial=false,archive=false}) {
  const config=JSON.parse(await readFile(join(root,'mystery-config.json'),'utf8'));
  if(config.apiBase) throw Error('Worker 연결을 사용 중입니다. 정적 목록 전환을 먼저 검토하세요.');
  const progress=JSON.parse(await readFile(audit,'utf8')),counts=progress.counts;
  if(!counts || Object.entries(counts).some(([key,n])=>!['verified','pending','error','excluded','outside','skipped','unverified','collected'].includes(key)||!Number.isSafeInteger(n)||n<0) || !Number.isSafeInteger(progress.candidates) || progress.candidates<1 || Object.values(counts).reduce((s,n)=>s+n,0)!==progress.candidates) throw Error('수집 진행 기록의 인원 수를 확인하세요.');
  const collectionPath=join(root,'data/mystery-collection.json');
  let previous={}; try { previous=JSON.parse(await readFile(collectionPath,'utf8')); } catch(e) { if(e.code!=='ENOENT') throw e; }
  const discovery=discoveryMetadata(progress,previous);
  const incomplete=!!(counts.pending||counts.collected||counts.error||counts.unverified);
  if(incomplete&&!allowPartial) throw Error('전체 후보 API 검증과 오류 재확인이 끝난 작업만 공개할 수 있습니다. 중간 공개는 --allow-partial을 명시하세요.');
  const acc=queryAccumulator(progress.data_date);
  for await(const line of createInterface({input:createReadStream(input),crlfDelay:Infinity})) if(line.trim()) acc.add(JSON.parse(line));
  if(acc.inputRows!==counts.verified || !acc.total) throw Error('수집 완료 기록과 API 원본 행 수가 일치하지 않습니다.');
  const preset=acc.bases.has('preset');
  if(preset !== (progress.basis==='preset')) throw Error('수집 기록의 계산 기준이 원본과 다릅니다.');
  const data=join(root,'data'),cache=join(data,'mystery-cache'); await mkdir(cache,{recursive:true});
  const updatedAt=new Date().toISOString();
  const collection={state:incomplete?'collecting':'scanned',candidates:progress.candidates,
    processed:progress.candidates-(counts.pending||0)-(counts.skipped||0),pending:counts.pending||0,failed:counts.error||0,skipped:counts.skipped||0,
    outside:counts.outside||0,unavailable:counts.excluded||0,verified:acc.total,unverified:counts.unverified||0,calculating:counts.collected||0,scope_excluded:acc.scopeExcluded,
    duplicate_verified_rows:acc.inputRows-acc.scopeExcluded-acc.total,as_of:progress.captured_at||updatedAt};
  const source=preset?`NEXON Open API · ${progress.api_mode==='dated'?'API 일일 기록 · ':''}프리셋 조합 계산`:'NEXON character/basic · character/stat API';
  const coverage={status:'partial',level_min:MIN_LEVEL,level_max:MAX_LEVEL,jobs:[...acc.jobs].sort(),worlds:[...acc.worlds].sort(),
    combat_basis:preset?'preset':'equipped',excluded_jobs:[...EXCLUDED_JOBS],...(['dated','live'].includes(progress.api_mode)?{api_mode:progress.api_mode}:{}),
    description:`${incomplete?'중간 공개본. ':''}290~300레벨 ${acc.total.toLocaleString('ko-KR')}명 · ${preset?'프리셋 계산':'API 착용'} 전투력 · 제논·데몬어벤져 제외`,
    limitations:[...(incomplete?[`아직 조회하지 않은 후보 ${collection.pending.toLocaleString('ko-KR')}명과 재확인 오류 ${collection.failed.toLocaleString('ko-KR')}건이 있습니다. 이후 수집으로 순위가 바뀔 수 있습니다.`]:[]),
      '이름 목록 확보에 사용한 랭킹 순위·레벨로 전투력 시상 순위를 결정하지 않습니다.',
      'API로 확인 불가능한 캐릭터와 후보 목록 밖 캐릭터가 있어 공식 전체 순위를 보장하지 않습니다.',
      ...(progress.api_mode==='dated'?['표시된 날짜의 API 일일 기록입니다. API는 분 단위 시점을 지정하지 않으며 정확한 23:59 스냅샷을 의미하지 않습니다.']:[]),
      ...(preset?['같은 기준일의 실제 API 장비·하이퍼·어빌리티·유니온 조합을 계산했습니다. 착용 전투력 검산과 프리셋 확인을 통과한 기록만 포함합니다.',`계산 검증 보류 ${collection.unverified.toLocaleString('ko-KR')}명은 순위에 포함하지 않습니다.`]:[]),
      '공개 파일은 이 수집본의 레벨별 전투력 상위 10명이며 선택 범위의 TOP 10을 재구성합니다.']};
  const entries=[],snapshots=[];
  for(const q of acc.queries.values()) {
    const rows=[...q.levels].sort(([a],[b])=>a-b).flatMap(([,rows])=>rows);
    const snapshot=prepareSnapshot(rows,{date:progress.data_date,source,coverage,updatedAt});
    const text=JSON.stringify(snapshot)+'\n';
    if(Buffer.byteLength(text)>MAX_CSV_BYTES) throw Error('조회 파일이 허용 용량을 넘었습니다.');
    const hash=createHash('sha256').update(text).digest('hex');
    if(!archive) { await writeFile(join(cache,hash+'.json'),text); await writeFile(join(cache,hash+'.csv'),snapshotCSV(snapshot)); }
    entries.push({group:q.group,world:q.world,job:q.job,file:`data/mystery-cache/${hash}.json`,counts:[...q.counts],snapshot});
  }
  entries.sort((a,b)=>JSON.stringify([a.group,a.world,a.job]).localeCompare(JSON.stringify([b.group,b.world,b.job])));
  for(const entry of entries) { snapshots.push(entry.snapshot); delete entry.snapshot; }
  const index={schema_version:1,type:'mystery-query-index',data_date:progress.data_date,updated_at:updatedAt,source,coverage,
    candidates:progress.candidates,verified:acc.total,duplicate_verified_rows:collection.duplicate_verified_rows,excluded:collection.outside+collection.unavailable+acc.scopeExcluded,
    collection,
    jobs:[...acc.jobs].sort(),worlds:[...acc.worlds].sort(),queries:entries};
  if(archive) await writeHistory(root,index,snapshots);
  else await writeFile(join(data,'mystery-index.json'),JSON.stringify(index,null,2)+'\n');
  const groups=Object.fromEntries([...acc.queries.values()].filter(q=>!q.world&&!q.job).map(q=>[q.group,[...q.counts.values()].reduce((a,b)=>a+b,0)]));
  const report={schema_version:1,data_date:progress.data_date,publication_status:incomplete?'interim':'scanned',
    ...(['dated','live'].includes(progress.api_mode)?{api_mode:progress.api_mode}:{}),
    value_basis:{name_world_job_level_image:'character/basic',combat:preset?'same-day API options, maximum verified equipment/hyper/ability/union preset combination':'character/stat final_stat[stat_name=전투력]'},
    ranking_basis:preset?'calculated preset combat_power descending; exact equipped baseline validation required':'API combat_power descending; API basic level/job/world only',
    excluded_jobs:[...EXCLUDED_JOBS],
    candidate_discovery:'ranking/overall API for names only; includes level 289 as a date-boundary buffer',
    candidates:progress.candidates,candidate_groups:discovery.candidate_groups,per_level_candidate_cap:null,
    display_level_min:MIN_LEVEL,display_level_max:MAX_LEVEL,published_characters:acc.total,api_verified_groups:groups,
    collection,discovery_coverage:discovery.discovery_coverage,
    notes:[...(progress.api_mode==='dated'?['All game data uses the requested API calendar date; collection.as_of is the publication cutoff, not a minute-specific game snapshot.']:[]),'Interim rankings compare verified API records as of collection.as_of; pending candidates are not included.',
      'Candidate count includes the level 289 date-boundary buffer and is not the final eligible population.',
      'Counts are a publication snapshot, not a live progress counter.']};
  const catalog=archive?JSON.parse(await readFile(join(data,'mystery-dates.json'),'utf8')):null;
  const latestDate=catalog?(config.preferredApiMode==='dated'?catalog.latest_dated:catalog.latest):progress.data_date;
  if(latestDate===progress.data_date) await writeFile(collectionPath,JSON.stringify(report,null,2)+'\n');
  // This is an operator preparation step. Commit and deploy only after checks and review.
  await writeFile(join(root,'mystery-config.json'),JSON.stringify({...config,staticIndex:'data/mystery-index.json',...(archive?{staticCatalog:'data/mystery-dates.json'}:{})},null,2)+'\n');
  return {candidates:progress.candidates,verified:acc.total,queries:entries.length,collection};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { const args=process.argv.slice(2),allowPartial=args.includes('--allow-partial'),archive=args.includes('--archive'),[input,audit,root='.']=args.filter(a=>!['--allow-partial','--archive'].includes(a)); if(!input||!audit) throw Error('사용법: node scripts/publish-mystery-index.mjs 검증본.jsonl 수집기록.json [저장소경로] [--allow-partial] [--archive]'); console.log(JSON.stringify(await publishIndex({input,audit,root:resolve(root),allowPartial,archive}))); }
  catch(e) { console.error(e.message); process.exitCode=1; }
}
