// MapleTools Mystery File: pure, source-aware ranking functions.
// No simulated users or fallback winners. Incoming CSV/API rows must provide numeric combat power.
export const MIN_LEVEL = 280;
export const MAX_LEVEL = 300;
export const MAX_CSV_BYTES = 5 * 1024 * 1024;
const ALIASES = {
  name: ['character_name', 'name', 'nickname', '닉네임', '캐릭터명', '이름', '본캐 후보'],
  world: ['world_name', 'world', 'server', '월드', '서버'],
  job: ['character_class', 'class_name', 'job', 'class', '직업', '본캐 직업'],
  level: ['character_level', 'level', '레벨', '본캐 레벨'],
  combat: ['combat_power', 'combat', '전투력', '캐릭터 전투력'],
  image: ['character_image', 'image_url', 'image', '캐릭터 이미지'],
  ocid: ['ocid', '캐릭터 식별자'],
  date: ['observed_at', 'fetched_at', 'updated_at', '조회일', '수집일', '기준일'],
};
const IMG_PREFIX = 'https://open.api.nexon.com/static/maplestory/character/look/';
function safeImage(value) {
  if (typeof value !== 'string' || value.length > 2500) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.origin !== 'https://open.api.nexon.com') return '';
    if (!url.pathname.startsWith('/static/maplestory/character/look/')) return '';
    return url.href;
  } catch { return ''; }
}
export function normalizeCharacter(row) {
  if (!row || typeof row !== 'object') return null;
  const keymap = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]));
  const get = (key) => {
    for (const alias of ALIASES[key]) {
      const val = keymap.get(alias);
      if (val !== undefined && val !== null && String(val).trim()) return val;
    }
    return '';
  };
  const name = String(get('name')).trim();
  const world = String(get('world')).trim();
  const job = String(get('job')).trim();
  const level = Number(String(get('level')).replace(/^lv\.?\s*/i, '').replace(/,/g, '').trim());
  const combatStr = String(get('combat')).replace(/,/g, '').trim();
  // Deliberately reject rounded or abbreviated values such as 1.8억.
  if (!/^[0-9]+$/.test(combatStr)) return null;
  const combat = Number(combatStr);
  if (!name || !world || !job || !Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) return null;
  if (!Number.isSafeInteger(combat) || combat <= 0) return null;
  if ([name, world, job].some(s => s.length > 100)) return null;
  const observed = String(get('date')).trim();
  const validDate = /^\d{4}-\d{2}-\d{2}/.test(observed) && !Number.isNaN(Date.parse(observed));
  return {
    name, world, job, level, combat, image: safeImage(String(get('image'))),
    ocid: String(get('ocid')).trim().slice(0, 100),
    observedAt: validDate ? observed : '',
  };
}
export function uniqueCharacters(rows) {
  const dedup = new Map();
  for (const raw of rows) {
    const item = normalizeCharacter(raw);
    if (!item) continue;
    // Prefer OCID when available; otherwise identify by world+name.
    const id = item.ocid ? 'ocid:' + item.ocid : 'name:' + item.world + '/' + item.name;
    const old = dedup.get(id);
    if (!old || item.observedAt >= old.observedAt) dedup.set(id, item);
  }
  return [...dedup.values()];
}
export function filterRank(rows, options = {}) {
  const min = Number(options.min ?? MIN_LEVEL);
  const max = Number(options.max ?? MAX_LEVEL);
  const job = String(options.job || '').trim();
  const world = String(options.world || '').trim();
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < MIN_LEVEL || max > MAX_LEVEL || min > max) throw Error('레벨은 280~300 사이에서 선택하세요.');
  return uniqueCharacters(rows).filter(row =>
    row.level >= min && row.level <= max &&
    (!job || row.job === job) && (!world || row.world === world)
  ).sort((a, b) => b.combat - a.combat || a.name.localeCompare(b.name, 'ko') || a.world.localeCompare(b.world, 'ko'));
}
export function parseImportedCSV(text) {
  // Reuse the same standard CSV parser as the existing MapleTools homepage.
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw Error('CSV 용량은 5MB 이하여야 합니다.');
  return import('./csv-statistics.js').then(({parseCSV}) => {
    const data = parseCSV(text);
    const headers = (data.shift() || []).map(x => x.trim());
    if (!headers.length) throw Error('CSV 헤더가 없습니다.');
    const matching = Object.entries(ALIASES).filter(([key, aliases]) => ['name','world','job','level','combat'].includes(key) && headers.some(x => aliases.includes(x.toLowerCase())));
    if (matching.length !== 5) throw Error('닉네임·월드·직업·레벨·전투력 열이 필요합니다.');
    const records = data.map(row => Object.fromEntries(headers.map((key, i) => [key, row[i] || ''])));
    return uniqueCharacters(records);
  });
}
export function imageAllowed(url) { return safeImage(url); }
