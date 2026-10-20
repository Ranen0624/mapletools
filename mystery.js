import {MIN_LEVEL,MAX_LEVEL,MAX_CSV_BYTES,emptySnapshot,filterRank,parseImport,collectionStatus} from './mystery-core.js';
import {loadRankingSource} from './mystery-source.js';
const $ = id => document.getElementById(id);
let snapshot=emptySnapshot(),local=false,failure='',busy=false,importVersion=0;
const jobs=['아델','히어로','팔라딘','다크나이트','소울마스터','미하일','아란','블래스터','데몬슬레이어','데몬어벤져','카이저','제로','렌','비숍','아크메이지(불,독)','아크메이지(썬,콜)','플레임위자드','에반','루미너스','배틀메이지','키네시스','일리움','라라','보우마스터','신궁','패스파인더','윈드브레이커','메르세데스','와일드헌터','카인','나이트로드','섀도어','듀얼블레이더','나이트워커','팬텀','카데나','호영','칼리','바이퍼','캡틴','캐논마스터','스트라이커','은월','메카닉','엔젤릭버스터','아크','제논'];
function el(tag,className='',text='') { const n=document.createElement(tag); n.className=className; n.textContent=text; return n; }
function options() { return {min:$('min-level').value,max:$('max-level').value,job:$('job').value.trim(),world:$('world').value}; }
function urlFor(o) { const u=new URL(location.href); u.search=''; for(const [k,v] of Object.entries(o)) if(v) u.searchParams.set(k,v); return u; }
function addDataOptions() {
  $('mystery-job-list').replaceChildren(...[...new Set([...jobs,...snapshot.characters.map(r=>r.job)])].sort((a,b)=>a.localeCompare(b,'ko')).map(n=>new Option(n,n)));
  for(const world of snapshot.characters.map(r=>r.world)) if(![...$('world').options].some(o=>o.value===world)) $('world').add(new Option(world,world));
}
function podium(rank,character) {
  const container=$('podium-'+rank); container.replaceChildren(); container.classList.toggle('uncollected',!character);
  container.append(el('span','medal',['','GOLD / 01','SILVER / 02','BRONZE / 03'][rank]));
  const portrait=el('div','portrait');
  if(character?.image) {
    const img=el('img'); img.src=character.image; img.alt=character.name+' 실제 캐릭터 외형'; img.width=200; img.height=200; img.referrerPolicy='no-referrer'; img.decoding='async';
    img.addEventListener('error',()=>portrait.replaceChildren(el('span','image-missing','이미지 확인 불가')),{once:true}); portrait.append(img);
  } else portrait.append(el('span','image-missing',character?'외형 이미지 미수집':'미수집'));
  container.append(portrait,el('h3','character-name',character?.name||'아직 비어 있는 자리'));
  container.append(el('p','character-info',character?`Lv.${character.level} · ${character.job} · ${character.world}`:'확인된 기록이 들어오면 공개됩니다.'));
  container.append(el('p','combat',character?character.combat.toLocaleString('ko-KR'):'—'),el('span','combat-caption',character?'전투력':'기록을 기다리는 중'));
  if(character) container.append(el('p','character-date','기준일 '+character.observedAt));
  container.append(el('div','podium-base',String(rank)));
}
function render() {
  const o=options(); let ranked;
  try { ranked=filterRank(snapshot.characters,o); } catch(e) { $('feedback').textContent=e.message; return false; }
  for(let i=1;i<=3;i++) podium(i,ranked[i-1]);
  $('result-subtitle').textContent=`${o.min===o.max?o.min:o.min+'~'+o.max}레벨 · ${o.job||'전체 직업'} · ${o.world||'전체 월드'} / 확인된 ${ranked.length.toLocaleString('ko-KR')}명`;
  $('data-status').textContent=busy?'공개 데이터 확인 중':failure||`${local?'내 파일 · ':''}${collectionStatus(snapshot,o,ranked.length)}`;
  $('data-status').dataset.state=failure?'error':ranked.length?'partial':'empty';
  const c=snapshot.coverage,span=values=>values.includes('*')?'전체':values.join(', ')||'미수집';
  $('snapshot-date').textContent=c.data_date||'미수집';
  $('snapshot-updated').textContent=snapshot.updated_at?new Date(snapshot.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})+' (한국시간)':local?'내 파일 미리보기':'등록 전';
  $('snapshot-scope').textContent=`${c.level_min}~${c.level_max}레벨 / ${span(c.jobs)} / ${span(c.worlds)}`;
  $('snapshot-source').textContent=snapshot.source;
  $('coverage-note').textContent=failure?'데이터를 불러오지 못해 순위를 표시하지 않습니다. 공개 데이터로 돌아가기를 눌러 재시도해 주세요.':
    `${c.description} ${c.limitations.join(' ')} ${ranked.length?'선택 조건의 전체 캐릭터 1위임을 보장하지 않습니다. 동률은 이름·월드 순으로 표시합니다.':'미수집은 해당 캐릭터가 존재하지 않는다는 뜻이 아닙니다.'}`;
  const rows=ranked.slice(3,10).map((r,i)=>{ const row=el('tr'); for(const v of [i+4,r.name,r.world,r.job,r.level,r.combat.toLocaleString('ko-KR')]) row.append(el('td','',String(v))); return row; });
  if(!rows.length) { const row=el('tr'),cell=el('td','empty-table','4~10위에 표시할 수집 기록이 없습니다.'); cell.colSpan=6; row.append(cell); rows.push(row); }
  $('rank-rows').replaceChildren(...rows); $('local-notice').hidden=!local; return true;
}
async function loadPublic() {
  const version=++importVersion; busy=true; failure=''; local=false; snapshot=emptySnapshot(); render();
  try { const data=await loadRankingSource(); if(version!==importVersion) return; snapshot=data; addDataOptions(); }
  catch { if(version!==importVersion) return; failure='공개 데이터 연결 실패'; }
  if(version!==importVersion) return; busy=false; render();
}
for(const id of ['min-level','max-level']) for(let n=MIN_LEVEL;n<=MAX_LEVEL;n++) $(id).add(new Option(String(n),String(n)));
$('min-level').value=String(MIN_LEVEL); $('max-level').value=String(MAX_LEVEL);
const params=new URL(location.href).searchParams;
for(const [key,id] of [['min','min-level'],['max','max-level'],['job','job'],['world','world']]) {
  const value=params.get(key); if(!value) continue;
  if(id==='job') $(id).value=value.slice(0,50);
  else if([...$(id).options].some(o=>o.value===value)) $(id).value=value;
  else if(key==='world'&&value.length<=100) { $(id).add(new Option(value,value)); $(id).value=value; }
  else $('feedback').textContent='링크의 잘못된 레벨 조건을 기본 범위로 바꿨습니다.';
}
if(Number($('min-level').value)>Number($('max-level').value)) { $('min-level').value='280'; $('max-level').value='300'; $('feedback').textContent='링크의 레벨 범위가 올바르지 않아 280~300으로 표시합니다.'; }
addDataOptions();
$('mystery-form').addEventListener('submit',e=>{ e.preventDefault(); $('feedback').textContent=''; if(render()) { history.replaceState(null,'',urlFor(options())); $('feedback').textContent='검색 조건을 적용했습니다.'; } });
$('share-btn').addEventListener('click',async()=>{
  if(!render()) return; const url=urlFor(options()).href;
  try { await navigator.clipboard.writeText(url); $('feedback').textContent='조건 링크를 복사했습니다. 내 파일 데이터는 링크에 포함되지 않습니다.'; }
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
