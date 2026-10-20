import {MAX_CSV_BYTES,MIN_LEVEL,MAX_LEVEL,WORLD_GROUPS,worldGroup,prepareSnapshot,validateSnapshot} from './mystery-core.js?v=4';
async function json(url, fetcher) {
  const response = await fetcher(url,{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('공개 데이터에 연결하지 못했습니다.');
  const text = await response.text();
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw Error('공개 데이터 용량이 허용 범위를 넘었습니다.');
  try { return JSON.parse(text); } catch { throw Error('공개 데이터 형식을 확인할 수 없습니다.'); }
}
export async function loadRankingSource({fetcher=fetch,base=new URL('.',import.meta.url),options={}} = {}) {
  const config = await json(new URL('mystery-config.json',base),fetcher);
  let url = new URL('data/mystery-rankings.json',base);
  if (config.apiBase) {
    const api = new URL(config.apiBase);
    if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash) throw Error('공개 데이터 연결 주소를 확인하세요.');
    url = new URL('v1/mystery/snapshot',api.href.replace(/\/?$/,'/'));
  } else if(config.staticIndex) {
    if(config.staticIndex!=='data/mystery-index.json') throw Error('공개 데이터 목록 주소를 확인하세요.');
    const index=await json(new URL(config.staticIndex,base),fetcher);
    if(index.schema_version!==1 || index.type!=='mystery-query-index' || !Array.isArray(index.queries) || !Array.isArray(index.jobs) || !Array.isArray(index.worlds)) throw Error('공개 데이터 목록 형식을 확인하세요.');
    const group=options.group || (options.world?worldGroup(options.world):'regular');
    if(!Object.hasOwn(WORLD_GROUPS,group)) throw Error('월드 분류를 확인하세요.');
    const query=index.queries.find(q=>q.group===group && q.world===(options.world||'') && q.job===(options.job||''));
    const extras={availableJobs:index.jobs,availableWorlds:index.worlds,selectionCounts:{},downloadJSON:null,downloadCSV:null};
    if(!query) return {...prepareSnapshot([],{date:index.data_date,source:index.source,coverage:index.coverage,updatedAt:index.updated_at}),...extras};
    if(!/^data\/mystery-cache\/[a-f0-9]{64}\.json$/.test(query.file) || !Array.isArray(query.counts)) throw Error('공개 데이터 파일 정보를 확인하세요.');
    const counts=new Map(query.counts);
    if(counts.size!==MAX_LEVEL-MIN_LEVEL+1 || [...counts].some(([level,count])=>!Number.isInteger(level)||level<MIN_LEVEL||level>MAX_LEVEL||!Number.isSafeInteger(count)||count<0)) throw Error('공개 집계 수를 확인하세요.');
    const data=validateSnapshot(await json(new URL(query.file,base),fetcher));
    if(data.coverage.data_date!==index.data_date || data.characters.some(r=>worldGroup(r.world)!==group || (query.world&&r.world!==query.world) || (query.job&&r.job!==query.job))) throw Error('공개 데이터의 날짜 또는 범위가 일치하지 않습니다.');
    for(const [level,count] of counts) if(data.characters.filter(r=>r.level===level).length!==Math.min(10,count)) throw Error('전투력 상위 기록과 집계 수가 일치하지 않습니다.');
    return {...data,...extras,selectionCounts:Object.fromEntries(counts),downloadJSON:new URL(query.file,base).href,downloadCSV:new URL(query.file.replace(/\.json$/,'.csv'),base).href};
  }
  return validateSnapshot(await json(url,fetcher));
}
