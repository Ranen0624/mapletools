// Build exact TOP 10 queries over all verified rows in this explicitly dated snapshot.
import {createReadStream} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeHistory} from './mystery-history.mjs';
import {MIN_LEVEL,MAX_LEVEL,EXCLUDED_JOBS,jobExcluded,normalizeCharacter,worldGroup,prepareSnapshot,snapshotCSV,MAX_CSV_BYTES,AMMUNITION_JOBS,AMMUNITION_LIMITATION,AMMUNITION_POLICY,AMMUNITION_ASSUMPTION,SELECTION_POLICY,SELECTION_NOTICE} from '../mystery-core.js';

const compare=(a,b)=>b.combat-a.combat || a.name.localeCompare(b.name,'ko') || a.world.localeCompare(b.world,'ko');
const requiresAmmoSource=version=>{const n=Number(/^preset-api-v(\d+)$/.exec(String(version))?.[1]);return n>=11&&n<17;};
export function queryAccumulator(date) {
  const seen=new Map(),names=new Map(),queries=new Map(),jobs=new Set(),worlds=new Set(),bases=new Set(),scopes=new Set(),policies=new Set(),selectionCounts={api:0,preset:0}; let inputRows=0,scopeExcluded=0,apiFallbackCount=0;
  function add(raw) {
    inputRows++;
    const row=normalizeCharacter(raw);
    if(!row || row.observedAt!==date) throw Error('같은 기준일의 유효한 캐릭터 API 기록만 공개할 수 있습니다.');
    if(jobExcluded(row.job)) {scopeExcluded++;return;}
    bases.add(row.calculation?'preset':'equipped');
    if(bases.size>1) throw Error('착용 전투력과 프리셋 계산값을 혼합할 수 없습니다.');
    scopes.add(row.calculation?.configuration_scope||'stored-presets');
    if(scopes.size>1)throw Error('안드로이드 장착 조합의 계산 기준이 다른 기록을 혼합할 수 없습니다.');
    policies.add(row.calculation?.equipment_policy||'all-presets');
    if(policies.size>1)throw Error('사냥 프리셋 제외 기준이 다른 기록을 혼합할 수 없습니다.');
    const key=row.ocid||JSON.stringify([row.world,row.name]),serialized=createHash('sha256').update(JSON.stringify(row)).digest('hex');
    const nameKey=JSON.stringify([row.world,row.name]);
    if(names.has(nameKey)&&names.get(nameKey)!==key) throw Error('같은 기준일 캐릭터의 식별자가 충돌합니다.');
    if(seen.has(key)) { if(seen.get(key)!==serialized) throw Error('동일 캐릭터의 API 기록이 충돌합니다.'); return; }
    seen.set(key,serialized); names.set(nameKey,key); jobs.add(row.job); worlds.add(row.world);
    if(row.calculation?.selection_policy===SELECTION_POLICY)selectionCounts[row.calculation.selected_source]++;
    if(row.calculation?.api_fallback)apiFallbackCount++;
    const group=worldGroup(row.world);
    for(const world of ['',row.world]) for(const job of ['',row.job]) {
      const key=JSON.stringify([group,world,job]);
      if(!queries.has(key)) queries.set(key,{group,world,job,counts:new Map(Array.from({length:MAX_LEVEL-MIN_LEVEL+1},(_,i)=>[MIN_LEVEL+i,0])),levels:new Map()});
      const q=queries.get(key); q.counts.set(row.level,q.counts.get(row.level)+1);
      const top=q.levels.get(row.level)||[]; top.push(row); top.sort(compare); top.length=Math.min(10,top.length); q.levels.set(row.level,top);
    }
  }
  return {add,queries,jobs,worlds,bases,scopes,policies,selectionCounts,get apiFallbackCount(){return apiFallbackCount;},get scopeExcluded(){return scopeExcluded;},get total(){return seen.size;},get inputRows(){return inputRows;}};
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
  const maximumAmmo=Number(/^preset-api-v(\d+)$/.exec(String(progress.calculator_version))?.[1])>=17;
  const selectMaximum=Number(/^preset-api-v(\d+)$/.exec(String(progress.calculator_version))?.[1])>=18;
  if(selectMaximum&&progress.selection_policy!==SELECTION_POLICY)throw Error('API·계산 최댓값 선택 정책을 확인하세요.');
  if(maximumAmmo&&progress.ammunition_policy!==AMMUNITION_POLICY)throw Error('탄약 가정 정책을 확인하세요.');
  for await(const line of createInterface({input:createReadStream(input),crlfDelay:Infinity})) if(line.trim()) {
    const raw=JSON.parse(line);
    if(selectMaximum&&normalizeCharacter(raw)?.calculation?.selection_policy!==SELECTION_POLICY)throw Error('캐릭터와 수집본의 최댓값 선택 기준이 다릅니다.');
    if(maximumAmmo&&normalizeCharacter(raw)?.calculation?.ammunition_policy!==AMMUNITION_POLICY)throw Error('캐릭터와 수집본의 탄약 가정 기준이 다릅니다.');
    if((requiresAmmoSource(progress.calculator_version)||requiresAmmoSource(raw.calculation?.version)) && AMMUNITION_JOBS.includes(normalizeCharacter(raw)?.job)) throw Error('사용 탄약의 독립 근거가 없는 계산 기록은 공개할 수 없습니다.');
    acc.add(raw);
  }
  if(acc.inputRows!==counts.verified || !acc.total) throw Error('수집 완료 기록과 API 원본 행 수가 일치하지 않습니다.');
  const preset=acc.bases.has('preset');
  const cashPlus=acc.scopes.has('presets-owned-android-cash-plus');
  const ownedAndroid=cashPlus||acc.scopes.has('presets-and-owned-android');
  const scope=ownedAndroid?[...acc.scopes][0]:undefined;
  const combatOnly=acc.policies.has('exclude-training-presets-v1');
  if(combatOnly!==(progress.equipment_policy==='exclude-training-presets-v1'))throw Error('수집본과 사냥 프리셋 제외 기준이 다릅니다.');
  if((scope||'stored-presets')!==(progress.calculation_scope||'stored-presets'))throw Error('수집본과 장착 조합의 계산 기준이 다릅니다.');
  if(cashPlus!==(progress.cash_effect_policy==='cash-base-and-confirmed-plus-v1'))throw Error('수집본과 캐시 효과 계산 기준이 다릅니다.');
  if(preset !== (progress.basis==='preset')) throw Error('수집 기록의 계산 기준이 원본과 다릅니다.');
  const data=join(root,'data'),cache=join(data,'mystery-cache'); await mkdir(cache,{recursive:true});
  const updatedAt=new Date().toISOString();
  const collection={state:counts.pending||counts.collected?'collecting':'scanned',candidates:progress.candidates,
    processed:progress.candidates-(counts.pending||0)-(counts.skipped||0),pending:counts.pending||0,failed:counts.error||0,skipped:counts.skipped||0,
    outside:counts.outside||0,unavailable:counts.excluded||0,verified:acc.total,unverified:counts.unverified||0,calculating:counts.collected||0,scope_excluded:acc.scopeExcluded,
    duplicate_verified_rows:acc.inputRows-acc.scopeExcluded-acc.total,as_of:progress.captured_at||updatedAt,
    ...(selectMaximum?{selected_sources:acc.selectionCounts,api_only_from_partial:acc.apiFallbackCount}:{}),
    error_breakdown:Object.fromEntries(Object.entries(progress.error_breakdown||{}).filter(([k,v])=>/^(?:(?:user\/union-champion|character\/basic|id):OPENAPI\d{5}|character\/basic:empty_snapshot)$/.test(k)&&Number.isSafeInteger(v)&&v>=0))};
  const source=selectMaximum?'NEXON Open API · API 착용값·가정 프리셋 최댓값':preset?`NEXON Open API · ${progress.api_mode==='dated'?'API 일일 기록 · ':''}${ownedAndroid?'프리셋·안드로이드':'프리셋'} 조합 계산`:'NEXON character/basic · character/stat API';
  const coverage={status:'partial',level_min:MIN_LEVEL,level_max:MAX_LEVEL,jobs:[...acc.jobs].sort(),worlds:[...acc.worlds].sort(),
    combat_basis:preset?'preset':'equipped',excluded_jobs:[...EXCLUDED_JOBS],...(['dated','live'].includes(progress.api_mode)?{api_mode:progress.api_mode}:{}),
    ...(ownedAndroid?{calculation_scope:scope}:{}),
    ...(cashPlus?{cash_effect_policy:'cash-base-and-confirmed-plus-v1'}:{}),
    ...(maximumAmmo?{ammunition_policy:AMMUNITION_POLICY}:{}),
    ...(selectMaximum?{selection_policy:SELECTION_POLICY}:{}),
    ...(combatOnly?{equipment_policy:'exclude-training-presets-v1'}:{}),
    description:`${incomplete?'중간 공개본. ':''}290~300레벨 ${acc.total.toLocaleString('ko-KR')}명 · ${ownedAndroid?'프리셋·안드로이드 조합':preset?'프리셋 계산':'API 착용'} 전투력 · 제논·데몬어벤져 제외`,
    limitations:[...(cashPlus?['캐시 개별 능력치는 실제 적용 슬롯으로 검산하며, API에 활성화가 확인된 마스터라벨 전투 플러스의 코디 프리셋 조합을 포함합니다.']:[]),...(incomplete?[`아직 조회하지 않은 후보 ${collection.pending.toLocaleString('ko-KR')}명과 재확인 오류 ${collection.failed.toLocaleString('ko-KR')}건이 있습니다. 이후 수집으로 순위가 바뀔 수 있습니다.`]:[]),
      ...(acc.apiFallbackCount?[`유니온 챔피언 조회 실패 ${acc.apiFallbackCount.toLocaleString('ko-KR')}명은 같은 날짜의 기본정보·API 착용 전투력으로 포함합니다. 해당 기록은 프리셋을 계산하지 않았으며 장비·사냥 세팅과 코디 착용 목록은 미확인입니다.`]:[]),
      '이름 목록 확보에 사용한 랭킹 순위·레벨로 전투력 시상 순위를 결정하지 않습니다.',
      'API로 확인 불가능한 캐릭터와 후보 목록 밖 캐릭터가 있어 공식 전체 순위를 보장하지 않습니다.',
      ...(progress.api_mode==='dated'?['표시된 날짜의 API 일일 기록입니다. API는 분 단위 시점을 지정하지 않으며 정확한 23:59 스냅샷을 의미하지 않습니다.']:[]),
      ...(selectMaximum?[SELECTION_NOTICE,'착용 전투력 검산이 일치하지 않아도 가정 계산값을 비교합니다. 프리셋 계산 불가 시 실제 API 착용값을 사용하며, 선택한 출처와 계산 가능 범위를 상세에 표시합니다.']:preset?['같은 기준일의 실제 API 장비·하이퍼·어빌리티·유니온 조합을 계산했습니다. 착용 전투력 검산과 프리셋 확인을 통과한 기록만 포함합니다.',`계산 검증 보류 ${collection.unverified.toLocaleString('ko-KR')}명은 순위에 포함하지 않습니다.`]:[]),
      ...(ownedAndroid?['API에서 보유가 확인된 안드로이드를 직접 장착하는 조합을 포함합니다. 현재 착용 전투력과 다를 수 있으며 필요한 장착은 캐릭터 상세에 표시합니다.']:[]),
      ...(combatOnly?[selectMaximum?'어비스 헌터스 링·어비스 헌터 링·정령의 펜던트·스페셜 정령의 펜던트가 있는 장비 프리셋은 계산 후보에서 제외합니다. 실제 API 착용 전투력은 그대로 비교합니다.':'어비스 헌터스 링·어비스 헌터 링·정령의 펜던트·스페셜 정령의 펜던트가 있는 장비 프리셋은 사냥 세팅으로 제외합니다. 현재 착용 프리셋이 제외되면 계산 전투력이 착용 전투력보다 낮을 수 있습니다.']:[]),
      ...(maximumAmmo?[AMMUNITION_ASSUMPTION]:requiresAmmoSource(progress.calculator_version)?[AMMUNITION_LIMITATION]:[]),
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
    ...(selectMaximum?{selection_policy:SELECTION_POLICY}:{}),
    ...(maximumAmmo?{ammunition_policy:AMMUNITION_POLICY}:{}),
    ...(combatOnly?{equipment_policy:'exclude-training-presets-v1'}:{}),
    ...(['dated','live'].includes(progress.api_mode)?{api_mode:progress.api_mode}:{}),
    ...(ownedAndroid?{calculation_scope:scope}:{}),
    ...(cashPlus?{cash_effect_policy:'cash-base-and-confirmed-plus-v1'}:{}),
    value_basis:{name_world_job_level_image:'character/basic',combat:selectMaximum?'max(same-day character/stat API combat power, calculable assumed equipment/hyper/ability/union/Android/cash preset combinations); no fitted stat residuals; missing preset options remain uncomputed':preset?'same-day API options, maximum verified equipment/hyper/ability/union preset combination'+(ownedAndroid?' including confirmed owned compatible Android equip combinations':'')+(cashPlus?' including confirmed Master Label Plus appearance choices; cash item stats from stat-bearing base slots only':'')+(combatOnly?' excluding named training equipment presets':''):'character/stat final_stat[stat_name=전투력]'},
    ranking_basis:selectMaximum?'max(actual same-day API equipped combat power, calculable assumed preset combat power); API wins ties; unavailable presets remain uncomputed':preset?'calculated preset combat_power descending; exact equipped baseline validation required':'API combat_power descending; API basic level/job/world only',
    excluded_jobs:[...EXCLUDED_JOBS],
    candidate_discovery:'ranking/overall API for names only; includes level 289 as a date-boundary buffer',
    candidates:progress.candidates,candidate_groups:discovery.candidate_groups,per_level_candidate_cap:null,
    display_level_min:MIN_LEVEL,display_level_max:MAX_LEVEL,published_characters:acc.total,api_verified_groups:groups,
    collection,discovery_coverage:discovery.discovery_coverage,
    error_breakdown:progress.error_breakdown||{},
    notes:[...(maximumAmmo?['Maximum projectile ownership is assumed: arrows +9, throwing stars +29, bullets +22. Inventory is not observed.'+(selectMaximum?' API CP is unchanged and compared with calculable assumed presets; exact baseline agreement is not required.':' Exact equipped baseline and all other preset checks remain required.')]:[]),...(progress.api_mode==='dated'?['All game data uses the requested API calendar date; collection.as_of is the publication cutoff, not a minute-specific game snapshot.']:[]),'Interim rankings compare published API-backed records as of collection.as_of; pending candidates are not included.',
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
