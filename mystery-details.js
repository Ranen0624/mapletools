import {validDate,MAX_CSV_BYTES} from './mystery-core.js?v=20261024-combat18';
const clean=(v,max=120)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f]/.test(v)?v.trim():null;
export function normalizeDetail(raw) {
  if(!raw||typeof raw!=='object'||!validDate(raw.date)||!clean(raw.ocid,100)||!clean(raw.name)||!clean(raw.world)||
      !/^[a-f0-9]{64}$/.test(raw.image_sha256)||typeof raw.observed_at!=='string'||Number.isNaN(Date.parse(raw.observed_at))||
      !['preset','base','unavailable'].includes(raw.outfit_source)||!Array.isArray(raw.items)||raw.items.length>40||
      (raw.cash_preset!==null&&(!Number.isInteger(raw.cash_preset)||raw.cash_preset<1||raw.cash_preset>3))||
      (raw.outfit_source==='preset'&&raw.cash_preset===null)||(raw.outfit_source==='unavailable'&&raw.items.length)) return null;
  const items=[];
  for(const item of raw.items) {
    const slot=clean(item?.slot,40),name=clean(item?.name,160),label=clean(item?.label||'',60);
    if(!slot||!name||label===null)return null;
    let prism;
    if(item.prism) {
      const p=item.prism;
      if(clean(p.range,60)===null||!Number.isInteger(p.hue)||p.hue<0||p.hue>359||!Number.isInteger(p.saturation)||Math.abs(p.saturation)>100||!Number.isInteger(p.value)||Math.abs(p.value)>100)return null;
      prism={range:p.range,hue:p.hue,saturation:p.saturation,value:p.value};
    }
    items.push({slot,name,label,...(prism?{prism}:{})});
  }
  const gender=raw.gender===null?null:clean(raw.gender,20),guild=raw.guild===null?null:clean(raw.guild,100);
  if(gender===null&&raw.gender!==null||guild===null&&raw.guild!==null)return null;
  return {ocid:raw.ocid,name:raw.name,world:raw.world,date:raw.date,observed_at:raw.observed_at,image_sha256:raw.image_sha256,
    gender,guild,cash_preset:raw.cash_preset,outfit_source:raw.outfit_source,items};
}
const byFetcher=new WeakMap();
const pathAllowed=(path,date)=>typeof path==='string'&&new RegExp(`^data/mystery-details/${date}/[a-f0-9]{64}\\.json$`).test(path);
async function json(url,fetcher,missing=false) {
  const r=await fetcher(url,{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(15000)});
  if(missing&&r.status===404)return null;
  if(!r.ok)throw Error('상세 정보를 불러오지 못했습니다.');
  const text=await r.text();if(new TextEncoder().encode(text).length>MAX_CSV_BYTES)throw Error('상세 정보 용량을 확인하세요.');
  return JSON.parse(text);
}
export async function decodeDetailPool(value,date,count) {
  if(value.schema_version!==1||value.date!==date||value.encoding!=='gzip-base64'||typeof value.payload!=='string'||value.payload.length>MAX_CSV_BYTES)throw Error('상세 정보 형식을 확인하세요.');
  if(typeof DecompressionStream==='undefined')throw Error('상세 정보를 보려면 브라우저를 최신 버전으로 업데이트하세요.');
  const bytes=Uint8Array.from(atob(value.payload),c=>c.charCodeAt(0));
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let length=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>MAX_CSV_BYTES)throw Error('상세 정보 용량을 확인하세요.');parts.push(value);}}finally{await reader.cancel();}
  const all=new Uint8Array(length);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.length;}
  const values=JSON.parse(new TextDecoder().decode(all));
  if(!Array.isArray(values)||values.length!==count)throw Error('상세 정보 개수를 확인하세요.');
  const rows=values.map(normalizeDetail);if(rows.some(r=>!r||r.date!==date))throw Error('상세 정보 기록을 확인하세요.');return rows;
}
export async function imageFingerprint(image) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(image)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function loadCharacterDetail(character,{fetcher=fetch,base=new URL('.',import.meta.url)}={}) {
  const date=character.observedAt;if(!validDate(date)||!character.ocid)return null;
  let cache=byFetcher.get(fetcher);if(!cache){cache=new Map();byFetcher.set(fetcher,cache);}
  const memo=(key,read)=>{if(!cache.has(key))cache.set(key,read().catch(e=>{cache.delete(key);throw e;}));return cache.get(key);};
  const url=new URL(`data/mystery-details/${date}/index.json`,base).href;
  const index=await memo(url,()=>json(url,fetcher,true));if(!index)return null;
  if(index.schema_version!==1||index.date!==date||!Array.isArray(index.pools)||!index.records||typeof index.records!=='object'||Array.isArray(index.records))throw Error('상세 정보 목록을 확인하세요.');
  const ref=index.records[character.ocid];if(!ref)return null;
  if(!Array.isArray(ref)||ref.length!==2||ref.some(n=>!Number.isInteger(n)||n<0)||!index.pools[ref[0]])throw Error('상세 정보 참조를 확인하세요.');
  const pool=index.pools[ref[0]];
  if(!pathAllowed(pool.file,date)||!Number.isInteger(pool.count)||pool.count<1||pool.count>100||ref[1]>=pool.count)throw Error('상세 정보 주소를 확인하세요.');
  const poolURL=new URL(pool.file,base).href;
  const data=await memo(poolURL,async()=>{
    const value=await json(poolURL,fetcher);
    return decodeDetailPool(value,date,pool.count);
  });
  const detail=data[ref[1]];
  if(detail.ocid!==character.ocid||detail.name!==character.name||detail.world!==character.world||detail.image_sha256!==await imageFingerprint(character.image))throw Error('캐릭터와 수집 당시 코디 정보가 일치하지 않습니다.');
  return detail;
}
