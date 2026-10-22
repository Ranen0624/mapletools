import {MAX_CSV_BYTES,MIN_LEVEL,MAX_LEVEL,WORLD_GROUPS,worldGroup,jobExcluded,prepareSnapshot,validateSnapshot,validDate} from './mystery-core.js?v=daily-1';
const poolsByFetcher=new WeakMap();
const historyPath=(file,date)=>typeof file==='string'&&new RegExp(`^data/mystery-history/${date}/[a-f0-9]{64}\\.json$`).test(file);
async function readPool(pool,date,base,fetcher) {
  if(!historyPath(pool.file,date)) throw Error('날짜별 기록 주소를 확인하세요.');
  let cache=poolsByFetcher.get(fetcher); if(!cache) { cache=new Map(); poolsByFetcher.set(fetcher,cache); }
  const key=new URL(pool.file,base).href;
  if(!cache.has(key)) cache.set(key,(async()=>{
    const packed=await json(key,fetcher);
    if(packed.schema_version!==1||packed.encoding!=='gzip-base64'||packed.data_date!==date||typeof packed.payload!=='string'||packed.payload.length>MAX_CSV_BYTES) throw Error('날짜별 기록 형식을 확인하세요.');
    if(typeof DecompressionStream==='undefined') throw Error('기록을 보려면 브라우저를 최신 버전으로 업데이트하세요.');
    const bytes=Uint8Array.from(atob(packed.payload),c=>c.charCodeAt(0));
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const parts=[]; let length=0;
    try { while(true) { const {value,done}=await reader.read(); if(done) break; length+=value.length; if(length>MAX_CSV_BYTES) throw Error('날짜별 기록 용량을 확인하세요.'); parts.push(value); } }
    finally { await reader.cancel(); }
    const all=new Uint8Array(length); let offset=0; for(const part of parts) { all.set(part,offset); offset+=part.length; }
    const rows=JSON.parse(new TextDecoder().decode(all));
    if(!Array.isArray(rows)||rows.length!==pool.count||rows.length>700) throw Error('날짜별 캐릭터 수를 확인하세요.');
    return prepareSnapshot(rows,{date}).characters;
  })().catch(e=>{cache.delete(key);throw e;}));
  return cache.get(key);
}
async function json(url, fetcher) {
  const response = await fetcher(url,{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('공개 데이터에 연결하지 못했습니다.');
  const text = await response.text();
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw Error('공개 데이터 용량이 허용 범위를 넘었습니다.');
  try { return JSON.parse(text); } catch { throw Error('공개 데이터 형식을 확인할 수 없습니다.'); }
}
export async function loadRankingSource({fetcher=fetch,base=new URL('.',import.meta.url),options={}} = {}) {
  const config = await json(new URL('mystery-config.json',base),fetcher);
  if(config.preferredApiMode!==undefined&&config.preferredApiMode!=='dated')throw Error('기본 API 기록 기준을 확인하세요.');
  const historyRetentionDays=config.historyRetentionDays??7;
  if(!Number.isInteger(historyRetentionDays)||historyRetentionDays<1||historyRetentionDays>366)throw Error('공개 기록 보관 기간을 확인하세요.');
  let url = new URL('data/mystery-rankings.json',base);
  if (config.apiBase) {
    const api = new URL(config.apiBase);
    if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash) throw Error('공개 데이터 연결 주소를 확인하세요.');
    url = new URL('v1/mystery/snapshot',api.href.replace(/\/?$/,'/'));
    if(options.date) { if(!validDate(options.date)) throw Error('기준일을 확인하세요.'); url.searchParams.set('date',options.date); }
  } else if(config.staticIndex) {
    if(config.staticIndex!=='data/mystery-index.json') throw Error('공개 데이터 목록 주소를 확인하세요.');
    let indexURL=config.staticIndex,availableDates=[],availableDateModes={},selectedMode;
    if(config.staticCatalog) {
      if(config.staticCatalog!=='data/mystery-dates.json') throw Error('기준일 목록 주소를 확인하세요.');
      const catalog=await json(new URL(config.staticCatalog,base),fetcher);
      if(catalog.schema_version!==1||!Array.isArray(catalog.dates)||!catalog.dates.length||catalog.dates.some(d=>!validDate(d.date)||!historyPath(d.index,d.date))||new Set(catalog.dates.map(d=>d.date)).size!==catalog.dates.length||catalog.latest!==catalog.dates.map(d=>d.date).sort().at(-1)) throw Error('기준일 목록을 확인하세요.');
      availableDates=catalog.dates.map(d=>d.date).sort().reverse();
      availableDateModes=Object.fromEntries(catalog.dates.map(d=>[d.date,d.api_mode||'legacy']));
      const latestDated=catalog.dates.filter(d=>d.api_mode==='dated').map(d=>d.date).sort().at(-1);
      if(catalog.latest_dated!==latestDated)throw Error('일일 기록 기준일 목록을 확인하세요.');
      const requested=options.date||(config.preferredApiMode==='dated'?latestDated:catalog.latest);
      if(!requested&&config.preferredApiMode==='dated')return {...prepareSnapshot([]),availableDates,availableDateModes,preferredApiMode:'dated',historyRetentionDays,uncollectedDate:true};
      if(!validDate(requested)) throw Error('기준일을 확인하세요.');
      const day=catalog.dates.find(d=>d.date===requested);
      if(!day) return {...prepareSnapshot([],{date:requested}),availableDates,availableDateModes,preferredApiMode:config.preferredApiMode,historyRetentionDays,uncollectedDate:true};
      selectedMode=day.api_mode;
      indexURL=day.index;
    }
    const index=await json(new URL(indexURL,base),fetcher);
    if(![1,2].includes(index.schema_version) || !validDate(index.data_date) || index.type!=='mystery-query-index' || !Array.isArray(index.queries) || !Array.isArray(index.jobs) || !Array.isArray(index.worlds)) throw Error('공개 데이터 목록 형식을 확인하세요.');
    if(options.date&&options.date!==index.data_date) throw Error('선택한 기준일과 수집 기록이 일치하지 않습니다.');
    if(selectedMode&&selectedMode!==index.coverage?.api_mode)throw Error('선택한 API 기록 기준과 일치하지 않습니다.');
    const group=options.group || (options.world?worldGroup(options.world):'regular');
    if(!Object.hasOwn(WORLD_GROUPS,group)) throw Error('월드 분류를 확인하세요.');
    const query=index.queries.find(q=>q.group===group && q.world===(options.world||'') && q.job===(options.job||''));
    const collection=index.collection;
    if(collection && (!['collecting','scanned'].includes(collection.state) || ['candidates','processed','pending','failed','verified',...['skipped','unverified','calculating','scope_excluded'].filter(k=>Object.hasOwn(collection,k))].some(k=>!Number.isSafeInteger(collection[k])||collection[k]<0) || collection.processed+collection.pending+(collection.skipped||0)!==collection.candidates || collection.verified!==index.verified)) throw Error('공개 수집 진행 정보를 확인하세요.');
    const extras={...(availableDates.length?{availableDates}:{}),availableDateModes,preferredApiMode:config.preferredApiMode,historyRetentionDays,availableJobs:index.jobs.filter(j=>!jobExcluded(j)),availableWorlds:index.worlds,selectionCounts:{},downloadJSON:null,downloadCSV:null,...(collection?{collection}:{} )};
    if(!query) return {...prepareSnapshot([],{date:index.data_date,source:index.source,coverage:index.coverage,updatedAt:index.updated_at}),...extras};
    if((index.schema_version===1&&!/^data\/mystery-cache\/[a-f0-9]{64}\.json$/.test(query.file)) || !Array.isArray(query.counts)) throw Error('공개 데이터 파일 정보를 확인하세요.');
    const counts=new Map(query.counts);
    if(counts.size!==MAX_LEVEL-MIN_LEVEL+1 || [...counts].some(([level,count])=>!Number.isInteger(level)||level<MIN_LEVEL||level>MAX_LEVEL||!Number.isSafeInteger(count)||count<0)) throw Error('공개 집계 수를 확인하세요.');
    let data;
    if(index.schema_version===2) {
      if(!Array.isArray(index.pools)||!Array.isArray(query.refs)||new Set(query.refs).size!==query.refs.length||query.refs.length>(MAX_LEVEL-MIN_LEVEL+1)*10) throw Error('날짜별 상위 기록을 확인하세요.');
      let next=0;
      for(const p of index.pools) { if(!Number.isSafeInteger(p.first)||p.first!==next||!Number.isInteger(p.count)||p.count<1||p.count>700||!historyPath(p.file,index.data_date)) throw Error('날짜별 기록 목록을 확인하세요.'); next+=p.count; }
      if(query.refs.some(id=>!Number.isSafeInteger(id)||id<0||id>=next)) throw Error('날짜별 캐릭터 참조를 확인하세요.');
      const needed=[...new Set(query.refs.map(id=>index.pools.findIndex(p=>id>=p.first&&id<p.first+p.count)))];
      const values=new Map(await Promise.all(needed.map(async n=>[n,await readPool(index.pools[n],index.data_date,base,fetcher)])));
      const rows=query.refs.map(id=>{ const n=index.pools.findIndex(p=>id>=p.first&&id<p.first+p.count);return values.get(n)[id-index.pools[n].first]; });
      data=prepareSnapshot(rows,{date:index.data_date,source:index.source,coverage:index.coverage,updatedAt:index.updated_at});
    } else data=validateSnapshot(await json(new URL(query.file,base),fetcher));
    if(data.coverage.data_date!==index.data_date || data.characters.some(r=>worldGroup(r.world)!==group || (query.world&&r.world!==query.world) || (query.job&&r.job!==query.job))) throw Error('공개 데이터의 날짜 또는 범위가 일치하지 않습니다.');
    for(const [level,count] of counts) if(data.characters.filter(r=>r.level===level).length!==Math.min(10,count)) throw Error('전투력 상위 기록과 집계 수가 일치하지 않습니다.');
    return {...data,...extras,selectionCounts:Object.fromEntries(counts),...(query.file?{downloadJSON:new URL(query.file,base).href,downloadCSV:new URL(query.file.replace(/\.json$/,'.csv'),base).href}:{})};
  }
  const data=validateSnapshot(await json(url,fetcher));
  if(options.date&&data.coverage.data_date!==options.date) throw Error('선택한 기준일과 수집 기록이 일치하지 않습니다.');
  return data;
}
