// Shared by the browser, publisher and future Worker. No sample ranking data.
import {parseCSV} from './csv-statistics.js';
export const MIN_LEVEL = 290;
export const MAX_LEVEL = 300;
export const EXCLUDED_JOBS = Object.freeze(['제논','데몬어벤져']);
export const jobExcluded = job => EXCLUDED_JOBS.includes(String(job).replaceAll(' ',''));
export const AMMUNITION_JOBS = Object.freeze(['보우마스터','신궁','윈드브레이커','와일드헌터','나이트로드','나이트워커','캡틴']);
export const AMMUNITION_LIMITATION = '사용 중인 화살·표창·불릿은 전투력에 반영되지만 API에서 확인할 수 없어, 해당 자료는 탄약을 가정하지 않고 검증 보류합니다.';
export function ammunitionHoldNotice(coverage,job,{local=false}={}) {
  return !local && coverage?.combat_basis==='preset' && coverage?.limitations?.includes(AMMUNITION_LIMITATION) && AMMUNITION_JOBS.includes(job)
    ? '사용 탄약을 API에서 확인할 수 없어 조합 전투력 검증을 보류했습니다. 탄약을 임의로 가정해 순위를 표시하지 않습니다.' : '';
}
export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const CASH_EFFECT_POLICY = 'cash-base-and-confirmed-plus-v1';
export const CASH_SCOPE = 'presets-owned-android-cash-plus';
const calculationScopes = new Set(['presets-and-owned-android',CASH_SCOPE]);
export const WORLD_GROUPS = {
  regular: {label:'일반 월드',worlds:['스카니아','베라','루나','제니스','크로아','유니온','엘리시움','이노시스','레드','오로라','아케인','노바']},
  'eos-helios': {label:'에오스·핼리오스',worlds:['에오스','핼리오스']},
  other: {label:'기타·이벤트 월드',worlds:[]},
};
export function worldGroup(world) {
  if (WORLD_GROUPS.regular.worlds.includes(world)) return 'regular';
  if (WORLD_GROUPS['eos-helios'].worlds.includes(world) || world === '헬리오스') return 'eos-helios';
  return 'other';
}
const ALIASES = {
  name: ['character_name','name','nickname','닉네임','캐릭터명','이름','본캐 후보'],
  world: ['world_name','world','server','월드','서버'],
  job: ['character_class','class_name','job','class','직업','본캐 직업'],
  level: ['character_level','level','레벨','본캐 레벨'],
  combat: ['combat_power','combat','전투력','캐릭터 전투력'],
  image: ['character_image','image_url','image','캐릭터 이미지'],
  ocid: ['ocid','캐릭터 식별자'],
  date: ['data_date','observedat','observed_at','date','조회일','수집일','기준일'],
};
const clean = (v, max = 100) => typeof v === 'string' && v.trim().length <= max && !/[\u0000-\u001f]/.test(v) ? v.trim() : '';
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function imageAllowed(value) {
  if (typeof value !== 'string' || value.length > 2500) return '';
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.host !== 'open.api.nexon.com' || u.username || u.password || u.hash ||
        !/^\/static\/maplestory\/character\/look\/[A-Za-z0-9_-]+$/.test(u.pathname)) return '';
    if ([...u.searchParams.keys()].some(k => !['action','emotion','wmotion','width','height','x','y'].includes(k))) return '';
    return u.href;
  } catch { return ''; }
}
export function normalizeCharacter(row, fallbackDate = '') {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const keys = new Map(Object.entries(row).map(([k,v]) => [k.trim().toLowerCase(),v]));
  const get = k => ALIASES[k].map(a => keys.get(a)).find(v => v !== undefined && v !== null && String(v).trim()) ?? '';
  const name = clean(get('name')), world = clean(get('world')), job = clean(get('job'));
  const levelText = String(get('level')).replace(/^lv\.?\s*/i, '').trim();
  const combatText = String(get('combat')).trim();
  if (!/^\d{3}$/.test(levelText) || !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(combatText)) return null;
  const level = Number(levelText), combat = Number(combatText.replaceAll(',', ''));
  const observedAt = String(get('date') || fallbackDate).trim();
  if (!name || !world || !job || level < MIN_LEVEL || level > MAX_LEVEL ||
      !Number.isSafeInteger(combat) || combat <= 0 || !validDate(observedAt)) return null;
  const rawImage = String(get('image')).trim(), image = imageAllowed(rawImage);
  if (rawImage && !image) return null;
  let calculation;
  if(Object.hasOwn(row,'calculation')) {
    let c=row.calculation;
    if(typeof c==='string') { try {c=JSON.parse(c);} catch {return null;} }
    const p=c?.presets;
    const policy=c?.equipment_policy,excluded=c?.excluded_equipment_presets;
    const trainingNames=new Set(['어비스 헌터 링','어비스 헌터스 링','정령의 펜던트','스페셜 정령의 펜던트']);
    let activeTraining=false;
    if(policy!==undefined || Number(/^preset-api-v(\d+)$/.exec(String(c?.version))?.[1])>=14) {
      if(policy!=='exclude-training-presets-v1' || !Number.isInteger(c?.active_equipment_preset) || c.active_equipment_preset<1 || c.active_equipment_preset>3 ||
          !Array.isArray(excluded)||excluded.length>2 || new Set(excluded.map(r=>r?.preset)).size!==excluded.length ||
          excluded.some(r=>!Number.isInteger(r?.preset)||r.preset<1||r.preset>3||!Array.isArray(r.items)||!r.items.length||r.items.some(name=>!trainingNames.has(name))) ||
          excluded.some(r=>r.preset===p?.equipment))return null;
      activeTraining=excluded.some(r=>r.preset===c.active_equipment_preset);
    }
    if(!c || c.basis!=='preset' || !Number.isSafeInteger(c.api_combat) || c.api_combat<=0 ||
        c.baseline_combat!==c.api_combat || (combat<c.api_combat&&!activeTraining) || !p ||
        ['equipment','hyper','ability','union'].some(k=>!Number.isInteger(p[k])||p[k]<1||p[k]>(k==='union'?10:3)) ||
        !Number.isInteger(c.combinations)||c.combinations<1||c.combinations>(Number(/^preset-api-v(\d+)$/.exec(String(c.version))?.[1])>=15?1350:270) ||
        typeof c.version!=='string'||!/^preset-api-v\d+$/.test(c.version)||
        typeof c.observed_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(c.observed_at)||Number.isNaN(Date.parse(c.observed_at))) return null;
    calculation={basis:'preset',api_combat:c.api_combat,baseline_combat:c.baseline_combat,
      presets:Object.fromEntries(['equipment','hyper','ability','union'].map(k=>[k,p[k]])),
      version:c.version,observed_at:c.observed_at,combinations:c.combinations};
    if(policy)Object.assign(calculation,{equipment_policy:policy,active_equipment_preset:c.active_equipment_preset,excluded_equipment_presets:excluded.map(r=>({preset:r.preset,items:[...new Set(r.items)]}))});
    if(c.configuration_scope!==undefined) {
      if(!calculationScopes.has(c.configuration_scope))return null;
      calculation.configuration_scope=c.configuration_scope;
      if(c.android!==undefined) {
        const a=c.android;
        if(!a || !clean(a.name) || !Number.isInteger(a.source_preset) || a.source_preset<1 || a.source_preset>3 || typeof a.manual_equip!=='boolean')return null;
        calculation.android={name:clean(a.name),source_preset:a.source_preset,manual_equip:a.manual_equip};
      }
    } else if(c.android!==undefined)return null;
    if(c.configuration_scope===CASH_SCOPE || Number(/^preset-api-v(\d+)$/.exec(String(c.version))?.[1])>=15) {
      if(Number(/^preset-api-v(\d+)$/.exec(String(c.version))?.[1])<15||c.configuration_scope!==CASH_SCOPE||c.cash_effect_policy!==CASH_EFFECT_POLICY)return null;
      calculation.cash_effect_policy=CASH_EFFECT_POLICY;
      if(c.cash_plus!==undefined) {
        const v=c.cash_plus;
        if(!v||!Number.isInteger(v.preset)||v.preset<0||v.preset>3||!Number.isInteger(v.count)||v.count<1||v.count>5)return null;
        calculation.cash_plus={preset:v.preset,count:v.count};
      }
      if(c.cash_set_adjustments!==undefined) {
        const sets=c.cash_set_adjustments;
        if(!Array.isArray(sets)||sets.length>20||sets.some(v=>!clean(v?.set)||!Number.isInteger(v.before)||v.before<1||v.before>10||!Number.isInteger(v.after)||v.after<0||v.after>=v.before))return null;
        calculation.cash_set_adjustments=sets.map(v=>({set:clean(v.set),before:v.before,after:v.after}));
      }
    } else if(c.cash_effect_policy!==undefined||c.cash_plus!==undefined||c.cash_set_adjustments!==undefined)return null;
  }
  return {name,world,job,level,combat,image,observedAt,ocid:clean(get('ocid')),...(calculation?{calculation}:{})};
}
export function uniqueCharacters(rows) {
  const byName = new Map(), byOcid = new Map(), result = [];
  for (const raw of rows) {
    const row = normalizeCharacter(raw);
    if (!row) continue;
    const key = JSON.stringify([row.world,row.name]);
    const previous = byName.get(key) ?? (row.ocid ? byOcid.get(row.ocid) : undefined);
    if (previous !== undefined) {
      const old = result[previous];
      if (row.observedAt > old.observedAt) result[previous] = row;
      else if (row.observedAt === old.observedAt && (row.combat !== old.combat || row.level !== old.level || row.job !== old.job || row.world !== old.world || row.name !== old.name || JSON.stringify(row.calculation)!==JSON.stringify(old.calculation) || (row.image && old.image && row.image !== old.image))) {
        throw Error('동일 캐릭터·기준일의 기록이 충돌합니다. 원본을 확인하세요.');
      } else if (row.observedAt === old.observedAt) result[previous] = {...old,image:old.image || row.image,ocid:old.ocid || row.ocid};
      byName.set(key, previous);
      if (row.ocid) byOcid.set(row.ocid, previous);
    } else {
      const index = result.length;
      byName.set(key,index);
      if (row.ocid) byOcid.set(row.ocid,index);
      result.push(row);
    }
  }
  return result;
}
export function filterRank(rows, options = {}) {
  const min = Number(options.min ?? MIN_LEVEL), max = Number(options.max ?? MAX_LEVEL);
  const job = String(options.job || '').trim(), world = String(options.world || '').trim();
  const group = options.group || (world ? worldGroup(world) : 'regular');
  if(jobExcluded(job)) throw Error('제논·데몬어벤져는 집계에서 제외합니다.');
  if (!Object.hasOwn(WORLD_GROUPS,group)) throw Error('월드 분류를 확인하세요.');
  if (world && worldGroup(world) !== group) throw Error('월드 분류와 선택한 월드가 일치하지 않습니다.');
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < MIN_LEVEL || max > MAX_LEVEL || min > max) throw Error('레벨은 290~300 사이에서 최소 ≤ 최대가 되도록 선택하세요.');
  const dates = new Set(rows.map(r => normalizeCharacter(r)?.observedAt).filter(Boolean));
  if (dates.size > 1) throw Error('서로 다른 기준일의 기록은 한 순위로 비교할 수 없습니다.');
  if(new Set(rows.map(r=>r.calculation?'preset':'equipped')).size>1) throw Error('착용 전투력과 프리셋 계산 전투력은 한 순위로 비교할 수 없습니다.');
  if(new Set(rows.map(r=>normalizeCharacter(r)?.calculation?.configuration_scope||'stored-presets')).size>1)throw Error('안드로이드 장착 조합의 계산 기준이 다른 기록은 한 순위로 비교할 수 없습니다.');
  if(new Set(rows.map(r=>normalizeCharacter(r)?.calculation?.equipment_policy||'all-presets')).size>1)throw Error('사냥 프리셋 제외 기준이 다른 기록은 한 순위로 비교할 수 없습니다.');
  return uniqueCharacters(rows).filter(r => !jobExcluded(r.job) && r.level >= min && r.level <= max && worldGroup(r.world) === group && (!job || r.job === job) && (!world || r.world === world))
    .sort((a,b) => b.combat - a.combat || a.name.localeCompare(b.name,'ko') || a.world.localeCompare(b.world,'ko'));
}
export function emptySnapshot() {
  return {schema_version:1,updated_at:null,source:'PC 검색 결과 · NEXON Open API',coverage:{
    status:'uncollected',data_date:null,level_min:MIN_LEVEL,level_max:MAX_LEVEL,jobs:[],worlds:[],
    description:'최초 수집 파일 등록 전입니다.',limitations:['전체 캐릭터를 수집한 공식 랭킹이 아닙니다.'],
  },characters:[]};
}
export function prepareSnapshot(rawRows, {date='',source='PC 검색 결과 · NEXON Open API',coverage={},updatedAt=null} = {}) {
  if (!Array.isArray(rawRows) || rawRows.length > 50000) throw Error('캐릭터 배열은 50,000행 이하여야 합니다.');
  const normalized = rawRows.map((row,i) => {
    const result = normalizeCharacter(row,date);
    if (!result) throw Error(`${i+1}번째 데이터의 닉네임·월드·직업·290~300레벨·정수 전투력·기준일·공식 이미지 URL을 확인하세요.`);
    return result;
  });
  const dates = [...new Set(normalized.map(r => r.observedAt))];
  if (dates.length > 1 || (date && dates.length && dates[0] !== date)) throw Error('하나의 공개 수집본에는 동일한 기준일의 기록만 넣어 주세요.');
  if (date && !validDate(date)) throw Error('기준일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.');
  if(coverage.api_mode!==undefined&&!['dated','live'].includes(coverage.api_mode))throw Error('API 기록 기준을 확인하세요.');
  const characters = uniqueCharacters(normalized);
  const bases=new Set(characters.map(r=>r.calculation?'preset':'equipped'));
  const scopes=new Set(characters.map(r=>r.calculation?.configuration_scope||'stored-presets'));
  const policies=new Set(characters.map(r=>r.calculation?.equipment_policy||'all-presets'));
  if(coverage.cash_effect_policy!==undefined && (coverage.cash_effect_policy!==CASH_EFFECT_POLICY||coverage.calculation_scope!==CASH_SCOPE||(scopes.size&&!scopes.has(CASH_SCOPE))))throw Error('캐시 효과의 계산 기준이 일치하지 않습니다.');
  if(policies.size>1 || (coverage.equipment_policy!==undefined&&coverage.equipment_policy!=='exclude-training-presets-v1') ||
      (coverage.equipment_policy&&policies.size&&!policies.has(coverage.equipment_policy)))throw Error('사냥 프리셋 제외 기준이 일치하지 않습니다.');
  if(scopes.size>1 || (coverage.calculation_scope!==undefined && !calculationScopes.has(coverage.calculation_scope)) ||
      (coverage.calculation_scope && scopes.size && !scopes.has(coverage.calculation_scope)))throw Error('안드로이드 장착 조합의 계산 기준이 일치하지 않습니다.');
  if(bases.size>1 || (coverage.combat_basis && !['preset','equipped'].includes(coverage.combat_basis)) ||
      (coverage.combat_basis && bases.size && !bases.has(coverage.combat_basis))) throw Error('전투력 집계 기준이 일치하지 않습니다.');
  const list = v => Array.isArray(v) ? [...new Set(v.map(x => clean(x)).filter(Boolean))] : [];
  const min = Number(coverage.level_min ?? MIN_LEVEL), max = Number(coverage.level_max ?? MAX_LEVEL);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < MIN_LEVEL || max > MAX_LEVEL || min > max) throw Error('수집 범위 레벨이 올바르지 않습니다.');
  const jobs = list(coverage.jobs), worlds = list(coverage.worlds);
  if (characters.some(r => r.level < min || r.level > max || (jobs.length && !jobs.includes('*') && !jobs.includes(r.job)) || (worlds.length && !worlds.includes('*') && !worlds.includes(r.world)))) throw Error('수집 범위 밖의 캐릭터가 있습니다.');
  const status = characters.length ? (coverage.status === 'complete' ? 'complete' : 'partial') : 'uncollected';
  if (status === 'complete' && (!jobs.length || !worlds.length || coverage.expected_count !== characters.length)) throw Error('수집 완료 표시는 직업·월드 범위와 확인한 전체 대상 수(expected_count)가 필요합니다.');
  return {schema_version:1,updated_at:updatedAt,source:clean(source,200) || 'PC 검색 결과',coverage:{
    status,data_date:dates[0] || date || null,level_min:min,level_max:max,
    jobs:jobs.length ? jobs : [...new Set(characters.map(r => r.job))],
    worlds:worlds.length ? worlds : [...new Set(characters.map(r => r.world))],
    description:clean(coverage.description,500) || (characters.length ? '업로드한 검색 결과 범위' : '최초 수집 파일 등록 전입니다.'),
    limitations:list(coverage.limitations),...(coverage.combat_basis||bases.has('preset')?{combat_basis:coverage.combat_basis||'preset'}:{}),
    ...(coverage.api_mode?{api_mode:coverage.api_mode}:{}),
    ...(coverage.equipment_policy||policies.has('exclude-training-presets-v1')?{equipment_policy:'exclude-training-presets-v1'}:{}),
    ...(coverage.calculation_scope||[...scopes].some(s=>calculationScopes.has(s))?{calculation_scope:coverage.calculation_scope||[...scopes][0]}:{}),
    ...(scopes.has(CASH_SCOPE)||coverage.cash_effect_policy===CASH_EFFECT_POLICY?{cash_effect_policy:CASH_EFFECT_POLICY}:{}),
    ...(coverage.excluded_jobs?{excluded_jobs:[...EXCLUDED_JOBS]}:{}),...(status === 'complete' ? {expected_count:characters.length} : {}),
  },characters};
}
export function validateSnapshot(data) {
  if (!data || data.schema_version !== 1 || !data.coverage || !Array.isArray(data.characters) || !['uncollected','partial','complete'].includes(data.coverage.status)) throw Error('지원하지 않는 공개 데이터 형식입니다.');
  const updatedAt = data.updated_at;
  if (updatedAt !== null && (typeof updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(updatedAt) || Number.isNaN(Date.parse(updatedAt)))) throw Error('공개 갱신 시각이 올바르지 않습니다.');
  return prepareSnapshot(data.characters,{date:data.coverage.data_date || '',source:data.source,coverage:data.coverage,updatedAt});
}
function importRows(text, {format='csv',date=''} = {}) {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw Error('파일 용량은 5MB 이하여야 합니다.');
  if (format === 'json') {
    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/,'')); } catch { throw Error('JSON 형식을 확인하세요.'); }
    const rows = Array.isArray(data) ? data : data?.characters;
    // A local file cannot claim exhaustive collection.
    return {rows,date:date || data?.coverage?.data_date || ''};
  }
  const table = parseCSV(text), headers = (table.shift() || []).map(v => v.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw Error('CSV에 중복된 열 이름이 있습니다.');
  for (const key of ['name','world','job','level','combat']) if (!headers.some(h => ALIASES[key].includes(h))) throw Error('닉네임·월드·직업·레벨·전투력 열이 필요합니다.');
  const rows = table.map((cells,i) => {
    if (cells.length !== headers.length) throw Error(`${i+2}번째 CSV 행의 열 개수가 다릅니다.`);
    return Object.fromEntries(headers.map((h,i) => [h,cells[i]]));
  });
  return {rows,date};
}
export function parseImport(text,options={}) {const {rows,date}=importRows(text,options);return prepareSnapshot(rows,{date});}
// Personal history can contain older and multiple dates. Each date remains a
// separate snapshot so scores from different days never share one ranking.
export function parseLocalImport(text,options={}) {
  const {rows,date}=importRows(text,options);
  if(!Array.isArray(rows)||rows.length>50000)throw Error('캐릭터 배열은 50,000행 이하여야 합니다.');
  const groups=new Map();
  rows.forEach((row,i)=>{const r=normalizeCharacter(row,date);if(!r)throw Error(`${i+1}번째 기록의 닉네임·월드·직업·레벨·전투력·기준일·이미지를 확인하세요.`);if(!groups.has(r.observedAt))groups.set(r.observedAt,[]);groups.get(r.observedAt).push(r);});
  const dates=[...groups.keys()].sort().reverse();
  return dates.map(day=>({...prepareSnapshot(groups.get(day),{date:day,source:'내 파일 기록'}),availableDates:dates}));
}
export async function parseImportedCSV(text, options={}) { return parseImport(text,options).characters; }
export function snapshotCSV(snapshot) {
  const headers = ['character_name','world_name','character_class','character_level','combat_power','character_image','data_date'];
  const calculated=snapshot.characters.some(r=>r.calculation); if(calculated) headers.push('calculation');
  const cell = v => '"' + String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""') + '"';
  return '\uFEFF' + [headers,...snapshot.characters.map(r => [r.name,r.world,r.job,r.level,r.combat,r.image,r.observedAt,...(calculated?[JSON.stringify(r.calculation)]:[])])].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
export function collectionStatus(snapshot, options, count) {
  const c = snapshot.coverage;
  if (!count) return '선택 조건 미수집 · 확인된 캐릭터 없음';
  const group = options.group || (options.world ? worldGroup(options.world) : 'regular');
  const worlds = WORLD_GROUPS[group]?.worlds || [];
  const within = Number(options.min) >= c.level_min && Number(options.max) <= c.level_max &&
    (c.jobs.includes('*') || (!!options.job && c.jobs.includes(options.job))) &&
    (c.worlds.includes('*') || (options.world ? c.worlds.includes(options.world) : worlds.length > 0 && worlds.every(w => c.worlds.includes(w))));
  return c.status === 'complete' && within ? '기재한 범위 수집 완료 · 수집본 내 순위' : '일부 수집 · 수집본 내 순위';
}
