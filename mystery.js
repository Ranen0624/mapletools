import {MIN_LEVEL,MAX_LEVEL,MAX_CSV_BYTES,WORLD_GROUPS,worldGroup,jobExcluded,emptySnapshot,filterRank,parseImport,collectionStatus,snapshotCSV,validDate} from './mystery-core.js?v=8';
import {loadRankingSource} from './mystery-source.js?v=8';
const $ = id => document.getElementById(id);
let downloadURLs=[];
let snapshot=emptySnapshot(),local=false,failure='',busy=false,importVersion=0;
const jobs=['아델','히어로','팔라딘','다크나이트','소울마스터','미하일','아란','블래스터','데몬슬레이어','데몬어벤져','카이저','제로','렌','비숍','아크메이지(불,독)','아크메이지(썬,콜)','플레임위자드','에반','루미너스','배틀메이지','키네시스','일리움','라라','보우마스터','신궁','패스파인더','윈드브레이커','메르세데스','와일드헌터','카인','나이트로드','섀도어','듀얼블레이더','나이트워커','팬텀','카데나','호영','칼리','바이퍼','캡틴','캐논마스터','스트라이커','은월','메카닉','엔젤릭버스터','아크','제논'];
function el(tag,className='',text='') { const n=document.createElement(tag); n.className=className; n.textContent=text; return n; }
function options() { return {min:$('min-level').value,max:$('max-level').value,job:$('job').value.trim(),group:$('world-group').value,world:$('world').value,date:$('data-date').value}; }
function urlFor(o) { const u=new URL(location.href); u.search=''; for(const [k,v] of Object.entries(o)) if(v) u.searchParams.set(k,v); return u; }
function addDataOptions() {
  const selected=$('data-date').value,dates=snapshot.availableDates||[];
  $('data-date').replaceChildren(new Option('최신 기록',''),...dates.map(d=>new Option(d,d)));
  if(selected&&!dates.includes(selected)) $('data-date').add(new Option(selected+' · 미수집',selected));
  $('data-date').value=selected;

  $('mystery-job-list').replaceChildren(...[...new Set([...jobs,...(snapshot.availableJobs||[]),...snapshot.characters.map(r=>r.job)])].filter(j=>!jobExcluded(j)).sort((a,b)=>a.localeCompare(b,'ko')).map(n=>new Option(n,n)));
  updateWorlds();
}
function updateWorlds() {
  const group=$('world-group').value,previous=$('world').value;
  const worlds=[...new Set([...WORLD_GROUPS[group].worlds,...(snapshot.availableWorlds||[]),...snapshot.characters.map(r=>r.world),...(previous?[previous]:[])])].filter(w=>worldGroup(w)===group);
  $('world').replaceChildren(new Option('선택 분류 전체',''),...worlds.map(w=>new Option(w,w)));
  if(worlds.includes(previous)) $('world').value=previous;
}
function podium(rank,character) {
  const container=$('podium-'+rank); container.replaceChildren(); container.classList.toggle('uncollected',!character);
  container.append(el('span','medal',['','GOLD / 01','SILVER / 02','BRONZE / 03'][rank]));
  const portrait=el(character?.image?'button':'div','portrait'); if(character?.image) { portrait.type='button'; portrait.setAttribute('aria-label',character.name+' 코디 크게 보기'); portrait.addEventListener('click',()=>showOutfit(character)); }
  if(character?.image) {
    const img=el('img'); img.src=character.image; img.alt=character.name+' 실제 캐릭터 외형'; img.width=420; img.height=420; img.referrerPolicy='no-referrer'; img.decoding='async';
    img.addEventListener('error',()=>portrait.replaceChildren(el('span','image-missing','이미지 확인 불가')),{once:true}); portrait.append(img);
  } else portrait.append(el('span','image-missing',character?'외형 이미지 미수집':'미수집'));
  container.append(portrait,el('h3','character-name',character?.name||'미수집'));
  container.append(el('p','character-info',character?`Lv.${character.level} · ${character.job} · ${character.world}`:'—'));
  container.append(el('p','combat',character?character.combat.toLocaleString('ko-KR'):'—'),el('span','combat-caption',character?(character.calculation?'프리셋 계산 전투력':'착용 전투력'):''));
  if(character?.calculation) container.append(el('p','preset-info',presetInfo(character)));
  container.append(el('div','podium-base',String(rank)));
}
function render() {
  const o=options(),excluded=jobExcluded(o.job); let ranked;
  try { ranked=excluded?[]:filterRank(snapshot.characters,o); } catch(e) { $('feedback').textContent=e.message; return false; }
  const count=excluded?0:snapshot.selectionCounts?Object.entries(snapshot.selectionCounts).filter(([lv])=>Number(lv)>=Number(o.min)&&Number(lv)<=Number(o.max)).reduce((sum,[,n])=>sum+n,0):ranked.length;
  for(let i=1;i<=3;i++) podium(i,ranked[i-1]);
  $('result-subtitle').textContent=`${o.min===o.max?o.min:o.min+'~'+o.max}레벨 · ${o.job||'전체 직업'} · ${WORLD_GROUPS[o.group].label} / ${o.world||'분류 전체'} · 확인된 ${count.toLocaleString('ko-KR')}명`;
  $('data-status').textContent=busy?'불러오는 중':failure||`${local?'내 파일 · ':''}${ranked.length?'수집본 내 순위':'선택 조건 미수집'}`;
  $('data-status').dataset.state=failure?'error':ranked.length?'partial':'empty';
  const c=snapshot.coverage,span=values=>values.includes('*')?'전체':values.join(', ')||'미수집';
  $('snapshot-date').textContent=c.data_date||'미수집';
  $('snapshot-updated').textContent=snapshot.updated_at?new Date(snapshot.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})+' (한국시간)':local?'내 파일 미리보기':'등록 전';
  $('snapshot-scope').textContent=`${c.level_min}~${c.level_max}레벨 · ${c.worlds.length}개 월드 · ${c.jobs.length}개 직업`;
  $('snapshot-source').textContent=snapshot.source;
  const preset=c.combat_basis==='preset';
  $('snapshot-progress').textContent=snapshot.collection?`${preset?'프리셋 계산 · 검증':'수집'} ${snapshot.collection.verified.toLocaleString('ko-KR')}명 · ${snapshot.collection.pending?'수집 중':snapshot.collection.calculating?'계산 중':snapshot.collection.unverified?'일부 검증 보류':'후보 조회 완료'}`:local?`내 파일 ${snapshot.characters.length.toLocaleString('ko-KR')}명`:snapshot.uncollectedDate?'이 날짜의 기록은 아직 없습니다.':'미수집';
  $('snapshot-basis').textContent=preset?'장비·하이퍼·어빌리티·유니온 프리셋의 계산 전투력으로 비교합니다.':'현재 착용 상태의 API 전투력으로 비교합니다.';
  $('snapshot-exclusions').textContent=`제논·데몬어벤져 집계 제외${snapshot.collection?.unverified?` · 계산 검증 보류 ${snapshot.collection.unverified.toLocaleString('ko-KR')}명`:''}`;
  updateDownloads();
  $('coverage-note').textContent=excluded?'제논·데몬어벤져는 집계에서 제외합니다.':failure?'불러오지 못했습니다. 잠시 후 다시 검색해 주세요.':snapshot.uncollectedDate?'선택한 날짜는 미수집입니다. 다른 기준일을 선택하세요.':ranked.length?`${snapshot.collection?.state==='collecting'?'일부 수집 · 순위가 바뀔 수 있습니다. ':''}${preset?'프리셋 계산값 · ':''}수집본 내 순위입니다.`:'선택 조건의 기록이 아직 없습니다.';
  const rows=ranked.slice(3,10).map((r,i)=>{ const row=el('tr'); for(const v of [i+4,r.name,r.world,r.job,r.level]) row.append(el('td','',String(v)));const combat=el('td','',r.combat.toLocaleString('ko-KR')); if(r.calculation) combat.append(el('small','preset-info',presetInfo(r))); row.append(combat);return row; });
  if(!rows.length) { const row=el('tr'),cell=el('td','empty-table','4~10위에 표시할 수집 기록이 없습니다.'); cell.colSpan=6; row.append(cell); rows.push(row); }
  $('rank-rows').replaceChildren(...rows); $('local-notice').hidden=!local; $('public-reset').hidden=!local; return true;
}
async function loadPublic() {
  const requested=options();
  const version=++importVersion; busy=true; failure=''; local=false; snapshot=emptySnapshot(); render();
  try { const data=await loadRankingSource({options:requested}); if(version!==importVersion) return false; if(JSON.stringify(requested)!==JSON.stringify(options())) { busy=false; render(); $('feedback').textContent='조건이 바뀌었습니다. 최강자 찾기를 다시 눌러 주세요.'; return false; } snapshot=data; addDataOptions(); }
  catch(e) { if(version!==importVersion) return; failure='공개 데이터 연결 실패'; if(e.message.includes('업데이트')) $('feedback').textContent=e.message; }
  if(version!==importVersion) return false; busy=false; render(); return !failure;
}
for(const id of ['min-level','max-level']) for(let n=MIN_LEVEL;n<=MAX_LEVEL;n++) $(id).add(new Option(String(n),String(n)));
$('min-level').value=String(MIN_LEVEL); $('max-level').value=String(MAX_LEVEL);
const params=new URL(location.href).searchParams;
for(const [key,id] of [['min','min-level'],['max','max-level'],['job','job'],['group','world-group'],['world','world'],['date','data-date']]) {
  const value=params.get(key); if(!value) continue;
  if(id==='data-date'&&validDate(value)) { $(id).add(new Option(value,value)); $(id).value=value; }
  else if(id==='job') $(id).value=value.slice(0,50);
  else if([...$(id).options].some(o=>o.value===value)) $(id).value=value;
  else if(key==='world'&&value.length<=100) { $(id).add(new Option(value,value)); $(id).value=value; }
  else $('feedback').textContent='링크의 잘못된 조건을 기본 범위로 바꿨습니다. 최소 레벨은 290입니다.';
}
if(!params.has('group')&&$('world').value) $('world-group').value=worldGroup($('world').value);
if(Number($('min-level').value)>Number($('max-level').value)) { $('min-level').value=String(MIN_LEVEL); $('max-level').value=String(MAX_LEVEL); $('feedback').textContent='링크의 레벨 범위가 올바르지 않아 290~300으로 표시합니다.'; }
addDataOptions();
$('world-group').addEventListener('change',updateWorlds);
$('mystery-form').addEventListener('submit',async e=>{ e.preventDefault(); $('feedback').textContent=''; if(jobExcluded(options().job)) {render();return;} try { filterRank([],options()); } catch(err) { $('feedback').textContent=err.message; return; } const ok=local?render():await loadPublic(); if(ok) { history.replaceState(null,'',urlFor(options())); $('feedback').textContent='검색 조건을 적용했습니다.'; } });
$('share-btn').addEventListener('click',async()=>{
  try { filterRank([],options()); } catch(e) { $('feedback').textContent=e.message; return; }
  if(!(local?render():await loadPublic())) return; const url=urlFor({...options(),date:snapshot.coverage.data_date||options().date}).href;
  try { await navigator.clipboard.writeText(url); $('feedback').textContent='링크를 복사했습니다.'; }
  catch { $('share-fallback').hidden=false; $('share-url').value=url; $('share-url').focus(); $('share-url').select(); $('feedback').textContent='아래 링크를 직접 복사해 주세요.'; }
});
$('public-reset').addEventListener('click',()=>{ $('csv-input').value=''; $('feedback').textContent=''; loadPublic(); });
$('import-form').addEventListener('submit',async e=>{
  e.preventDefault(); const file=$('csv-input').files[0];
  if(!file) { $('feedback').textContent='미리 볼 CSV 또는 JSON 파일을 선택하세요.'; return; }
  const version=++importVersion; busy=false;
  try {
    if(file.size>MAX_CSV_BYTES) throw Error('파일 용량은 5MB 이하여야 합니다.');
    const buffer=await file.arrayBuffer(); let text;
    try { text=new TextDecoder('utf-8',{fatal:true}).decode(buffer); }
    catch { if(file.name.toLowerCase().endsWith('.json')) throw Error('JSON은 UTF-8로 저장해 주세요.'); text=new TextDecoder('euc-kr',{fatal:true}).decode(buffer); }
    const data=parseImport(text,{format:file.name.toLowerCase().endsWith('.json')?'json':'csv',date:$('import-date').value});
    if(!data.characters.length) throw Error('파일에 순위로 표시할 캐릭터가 없습니다.');
    if(version!==importVersion) return;
    snapshot=data; local=true; failure=''; addDataOptions(); render(); $('feedback').textContent=`내 파일 ${data.characters.length}명 미리보기 · 서버 전송 및 홈페이지 공개 없음`;
  } catch(e) { if(version===importVersion) { render(); $('feedback').textContent=e.message||'파일을 읽지 못했습니다.'; } }
});
window.addEventListener('popstate',()=>location.reload());
loadPublic();

function updateDownloads() {
  for(const url of downloadURLs) URL.revokeObjectURL(url); downloadURLs=[];
  if(!snapshot.characters.length||!URL.createObjectURL) { for(const id of ['json-download','csv-download']) $(id).hidden=true; return; }
  const canonical={schema_version:snapshot.schema_version,updated_at:snapshot.updated_at,source:snapshot.source,coverage:snapshot.coverage,characters:snapshot.characters};
  for(const [id,contents,type,extension] of [['json-download',JSON.stringify(canonical,null,2),'application/json','json'],['csv-download',snapshotCSV(canonical),'text/csv;charset=utf-8','csv']]) {
    const link=$(id),url=URL.createObjectURL(new Blob([contents],{type}));downloadURLs.push(url);link.href=url;link.download='mystery-'+(snapshot.coverage.data_date||'preview')+'.'+extension;link.hidden=false;
  }
}
function showOutfit(character) {
  const dialog=$('outfit-dialog'),image=$('outfit-image'); $('outfit-title').textContent=character.name+' · '+character.world;image.src=character.image;image.alt=character.name+' 실제 캐릭터 코디';
  dialog.showModal();
}
function presetInfo(character) {
  const p=character.calculation.presets;
  return `장비 ${p.equipment} · 하이퍼 ${p.hyper} · 어빌 ${p.ability} · 유니온 ${p.union}`;
}
$('outfit-close').addEventListener('click',()=>$('outfit-dialog').close());
$('outfit-dialog').addEventListener('click',e=>{if(e.target===$('outfit-dialog')) $('outfit-dialog').close();});
