import {MAX_CSV_BYTES,validateSnapshot} from './mystery-core.js';
async function json(url, fetcher) {
  const response = await fetcher(url,{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('공개 데이터에 연결하지 못했습니다.');
  const text = await response.text();
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw Error('공개 데이터 용량이 허용 범위를 넘었습니다.');
  try { return JSON.parse(text); } catch { throw Error('공개 데이터 형식을 확인할 수 없습니다.'); }
}
export async function loadRankingSource({fetcher=fetch,base=new URL('.',import.meta.url)} = {}) {
  const config = await json(new URL('mystery-config.json',base),fetcher);
  let url = new URL('data/mystery-rankings.json',base);
  if (config.apiBase) {
    const api = new URL(config.apiBase);
    if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash) throw Error('공개 데이터 연결 주소를 확인하세요.');
    url = new URL('v1/mystery/snapshot',api.href.replace(/\/?$/,'/'));
  }
  return validateSnapshot(await json(url,fetcher));
}
