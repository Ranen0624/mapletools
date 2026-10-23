import {MIN_LEVEL,MAX_LEVEL,MAX_CSV_BYTES,WORLD_GROUPS,worldGroup,jobExcluded,emptySnapshot,filterRank,parseLocalImport,collectionStatus,snapshotCSV,validDate} from './mystery-core.js?v=owned-android-1';
import {loadRankingSource} from './mystery-source.js?v=owned-android-1';
import {loadCharacterDetail} from './mystery-details.js?v=9';
const $ = id => document.getElementById(id);
let downloadURLs=[];
let snapshot=emptySnapshot(),local=false,failure='',busy=false,importVersion=0;
let currentRanked=[],profileIndex=-1,detailVersion=0,profileTrigger=null;
let localSnapshots=[];
const jobs=['아델','히어로','팔라딘','다크나이트','소울마스터','미하일','아란','블래스터','데몬슬레이어','데몬어벤져','카이저','제로','렌','비숍','아크메이지(불,독)','아크메이지(썬,콜)','플레임위자드','에반','루미너스','배틀메이지','키네시스','일리움','라라','보우마스터','신궁','패스파인더','윈드브레이커','메르세데스','와일드헌터','카인','나이트로드','섀도어','듀얼블레이더','나이트워커','팬텀','카데나','호영','칼리','바이퍼','캡틴','캐논마스터','스트라이커','은월','메카닉','엔젤릭버스터','아크','제논'];
function el(tag,className='',text='') { const n=document.createElement(tag); n.className=className; n.textContent=text; return n; }
function options() { return {min:$('min-level').value,max:$('max-level').value,job:$('job').value.trim(),group:$('world-group').value,world:$('world').value,date:$('data-date').value}; }
function urlFor(o) { const u=new URL(location.href); u.search=''; for(const [k,v] of Object.entries(o)) if(v) u.searchParams.set(k,v); return u; }
function addDataOptions() {
  const selected=$('data-date').value,dates=snapshot.availableDates||[];
  $('data-date').replaceChildren(new Option(snapshot.preferredApiMode==='dated'?'최신 일일 기록':'최신 기록',''),...dates.map(d=>new Option(d+(snapshot.availableDateModes?.[d]==='dated'?' · 일일 기록':snapshot.availableDateModes?.[d]?' · 이전 수집본':''),d)));
  if(selected&&!dates.includes(selected)) $('data-date').add(new Option(selected+(snapshot.uncollectedDate?' · 미수집':''),selected));
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
function nameButton(character) {
  const button=el('button','name-button',character.name);button.type='button';
  button.setAttribute('aria-label',character.name+' 캐릭터 상세 보기');button.setAttribute('aria-haspopup','dialog');
  button.addEventListener('click',()=>showOutfit(character,button));return button;
}
function podium(rank,character) {
  const container=$('podium-'+rank); container.replaceChildren(); container.classList.toggle('uncollected',!character);
  container.append(el('span','medal',['','GOLD / 01','SILVER / 02','BRONZE / 03'][rank]));
  const portrait=el(character?.image?'button':'div','portrait'); if(character?.image) { portrait.type='button'; portrait.setAttribute('aria-label',character.name+' 코디 및 상세 보기'); portrait.setAttribute('aria-haspopup','dialog'); portrait.addEventListener('click',()=>showOutfit(character,portrait)); }
  if(character?.image) {
    const img=el('img'); img.src=character.image; img.alt=character.name+' 실제 캐릭터 외형'; img.width=420; img.height=420; img.referrerPolicy='no-referrer'; img.decoding='async';
    img.addEventListener('error',()=>portrait.replaceChildren(el('span','image-missing','이미지 확인 불가')),{once:true}); portrait.append(img);
  } else portrait.append(el('span','image-missing',character?'외형 이미지 미수집':'미수집'));
  const name=el('h3','character-name',character?'':'미수집');if(character)name.append(nameButton(character));
  container.append(portrait,name);
  container.append(el('p','character-info',character?`Lv.${character.level} · ${character.job} · ${character.world}`:'—'));
  container.append(el('p','combat',character?character.combat.toLocaleString('ko-KR'):'—'),el('span','combat-caption',character?powerLabel(character):''));
  if(character?.calculation) container.append(el('p','preset-info',presetInfo(character)));
  container.append(el('div','podium-base',String(rank)));
}
function render() {
  if(local&&localSnapshots.length)snapshot=localSnapshots.find(s=>s.coverage.data_date===$('data-date').value)||localSnapshots[0];
  const o=options(),excluded=jobExcluded(o.job); let ranked;
  try { ranked=excluded?[]:filterRank(snapshot.characters,o); } catch(e) { $('feedback').textContent=e.message; return false; }
  currentRanked=ranked.slice(0,10);
  $('result-section')?.setAttribute('aria-busy',String(busy));$('result-section')?.classList.toggle('is-loading',busy);
  $('search-btn').disabled=busy;$('search-btn').textContent=busy?'불러오는 중…':'최강자 찾기 ↗';
  const count=excluded?0:snapshot.selectionCounts?Object.entries(snapshot.selectionCounts).filter(([lv])=>Number(lv)>=Number(o.min)&&Number(lv)<=Number(o.max)).reduce((sum,[,n])=>sum+n,0):ranked.length;
  for(let i=1;i<=3;i++) {
    podium(i,ranked[i-1]);const card=$('podium-'+i);card.classList.remove('is-awarded');
    if(busy){card.querySelector('.image-missing').textContent='불러오는 중…';card.querySelector('.character-name').textContent='기록 확인 중';}
    else if(ranked[i-1]){card.style.setProperty('--award-delay',(i===1?90:i===2?0:160)+'ms');void card.offsetWidth;card.classList.add('is-awarded');}
  }
  $('result-subtitle').textContent=`${o.min===o.max?o.min:o.min+'~'+o.max}레벨 · ${o.job||'전체 직업'} · ${WORLD_GROUPS[o.group].label} / ${o.world||'분류 전체'} · 확인된 ${count.toLocaleString('ko-KR')}명`;
  $('data-status').textContent=busy?'불러오는 중':failure||`${local?'내 파일 · ':''}${ranked.length?'수집본 내 순위':'선택 조건 미수집'}`;
  $('data-status').dataset.state=failure?'error':ranked.length?'partial':'empty';
  $('share-btn').hidden=local;
  const c=snapshot.coverage,span=values=>values.includes('*')?'전체':values.join(', ')||'미수집';
  $('snapshot-date').textContent=(c.data_date||'미수집')+(c.api_mode==='dated'?' · API 일일 기록':'');
  $('snapshot-updated').textContent=snapshot.updated_at?new Date(snapshot.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})+' (한국시간)':local?'내 파일 미리보기':'등록 전';
  $('snapshot-scope').textContent=`${c.level_min}~${c.level_max}레벨 · ${c.worlds.length}개 월드 · ${c.jobs.length}개 직업`;
  $('snapshot-source').textContent=snapshot.source;
  $('history-retention').textContent=local?'내 파일은 공개 기록의 보관 기간과 관계없이 분석할 수 있습니다.':`최근 ${snapshot.historyRetentionDays||7}일의 기록을 제공합니다. 오래된 기록은 내 CSV 기록 분석을 이용하세요.`;
  const preset=c.combat_basis==='preset';
  $('snapshot-progress').textContent=snapshot.collection?`${c.calculation_scope==='presets-and-owned-android'?'조합 계산 · 검증':preset?'프리셋 계산 · 검증':'수집'} ${snapshot.collection.verified.toLocaleString('ko-KR')}명 · ${snapshot.collection.pending?'수집 중':snapshot.collection.calculating?'계산 중':snapshot.collection.unverified?'일부 검증 보류':'후보 조회 완료'}`:local?`내 파일 ${snapshot.characters.length.toLocaleString('ko-KR')}명`:snapshot.uncollectedDate?'이 날짜의 기록은 아직 없습니다.':'미수집';
  $('snapshot-basis').textContent=(c.api_mode==='dated'?'표시된 날짜의 API 일일 기록 · 분 단위 시점 지정 미지원. ':'')+(preset?'장비·하이퍼·어빌리티·유니온 프리셋의 계산 전투력으로 비교합니다.':'착용 상태의 API 전투력으로 비교합니다.')+(c.calculation_scope==='presets-and-owned-android'?' 보유가 확인된 안드로이드를 직접 장착하는 조합을 포함합니다.':'');
  const counts=snapshot.collection,collectionNotes=counts?[
    `전체 대기 ${(counts.pending||0).toLocaleString('ko-KR')}명`,
    ...(counts.calculating?[`계산 중 ${counts.calculating.toLocaleString('ko-KR')}명`]:[]),
    ...(counts.unverified?[`계산 검증 보류 ${counts.unverified.toLocaleString('ko-KR')}명`]:[]),
    ...(counts.failed?[`조회 오류 ${counts.failed.toLocaleString('ko-KR')}건`]:[])
  ]:[];
  $('snapshot-exclusions').textContent=['제논·데몬어벤져 집계 제외',...collectionNotes].join(' · ');
  updateDownloads();
  $('coverage-note').textContent=excluded?'제논·데몬어벤져는 집계에서 제외합니다.':local?`${c.data_date} 내 파일 기준 순위 · 홈페이지 공개 데이터와 별개입니다.`:failure?'불러오지 못했습니다. 잠시 후 다시 검색해 주세요.':snapshot.uncollectedDate?'선택한 날짜는 미수집입니다. 다른 기준일을 선택하세요.':ranked.length?`${snapshot.collection?.state==='collecting'?'일부 검증 보류 · ':''}${c.calculation_scope==='presets-and-owned-android'?'확인된 안드로이드 장착 조합 포함 · ':preset?'프리셋 계산값 · ':''}수집본 내 순위입니다.`:'선택 조건의 기록이 아직 없습니다.';
  if(busy){$('snapshot-date').textContent=o.date||'최신 기록 확인 중';$('snapshot-progress').textContent='수집 기록 확인 중…';$('result-subtitle').textContent='조건에 맞는 기록을 확인하고 있습니다.';$('coverage-note').textContent='순위 기록을 불러오는 중입니다…';}
  const rows=ranked.slice(3,10).map((r,i)=>{ const row=el('tr'),name=el('td');name.append(nameButton(r));row.append(el('td','',String(i+4)),name);for(const v of [r.world,r.job,r.level])row.append(el('td','',String(v)));const combat=el('td','',r.combat.toLocaleString('ko-KR')); if(r.calculation) combat.append(el('small','preset-info',presetInfo(r))); row.append(combat);return row; });
  if(!rows.length) { const row=el('tr'),cell=el('td','empty-table',busy?'순위 기록을 불러오는 중입니다…':'4~10위에 표시할 수집 기록이 없습니다.'); cell.colSpan=6; row.append(cell); rows.push(row); }
  $('rank-rows').replaceChildren(...rows);if(!busy)rows.forEach((row,i)=>window.MapleMotion?.animate(row,[{opacity:.25},{opacity:1}],{duration:180,delay:i*22})); $('local-notice').hidden=!local; $('public-reset').hidden=!local;
  $('local-analysis').hidden=!local;
  if(local){
    const values=ranked.map(r=>r.combat),n=values.length;
    const mean=n?Math.round(values.reduce((avg,v,i)=>avg+(v-avg)/(i+1),0)):null;
    const median=n?Math.round(n%2?values[(n-1)/2]:(values[n/2-1]/2+values[n/2]/2)):null;
    $('analysis-metrics').replaceChildren(...[['조건에 맞는 캐릭터',n.toLocaleString('ko-KR')+'명'],['최고 전투력',n?values[0].toLocaleString('ko-KR'):'—'],['평균 전투력',mean===null?'—':mean.toLocaleString('ko-KR')],['중앙값',median===null?'—':median.toLocaleString('ko-KR')]].map(([k,v])=>fact(k,v)));
    $('analysis-caption').textContent=`${snapshot.coverage.data_date} · 파일 ${localSnapshots.length}개 기준일 · 선택 조건의 기록만 분석 · 제논·데몬어벤져 제외`;
  }
  return true;
}
async function loadPublic() {
  if($('outfit-dialog').open)$('outfit-dialog').close();
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
$('filter-reset').addEventListener('click',async()=>{
  $('min-level').value=String(MIN_LEVEL);$('max-level').value=String(MAX_LEVEL);$('job').value='';$('world-group').value='regular';$('world').value='';$('data-date').value='';updateWorlds();
  $('share-fallback').hidden=true;$('feedback').textContent='';
  if(local?render():await loadPublic()){history.replaceState(null,'',urlFor(options()));$('feedback').textContent='기본 조건으로 초기화했습니다.';}
});
$('share-btn').addEventListener('click',async()=>{
  try { filterRank([],options()); } catch(e) { $('feedback').textContent=e.message; return; }
  if(!(local?render():await loadPublic())) return; const url=urlFor({...options(),date:snapshot.coverage.data_date||options().date}).href;
  try { await navigator.clipboard.writeText(url); $('feedback').textContent='링크를 복사했습니다.'; }
  catch { $('share-fallback').hidden=false; $('share-url').value=url; $('share-url').focus(); $('share-url').select(); $('feedback').textContent='아래 링크를 직접 복사해 주세요.'; }
});
$('public-reset').addEventListener('click',()=>{ $('csv-input').value=''; $('feedback').textContent=''; loadPublic(); });
$('open-local-import').addEventListener('click',()=>{$('local-import').open=true;$('local-import').scrollIntoView?.({block:'center'});$('csv-input').focus({preventScroll:true});});
$('import-form').addEventListener('submit',async e=>{
  e.preventDefault(); const file=$('csv-input').files[0];
  if(!file) { $('feedback').textContent='미리 볼 CSV 또는 JSON 파일을 선택하세요.'; return; }
  const version=++importVersion; busy=false;
  try {
    if(file.size>MAX_CSV_BYTES) throw Error('파일 용량은 5MB 이하여야 합니다.');
    const buffer=await file.arrayBuffer(); let text;
    try { text=new TextDecoder('utf-8',{fatal:true}).decode(buffer); }
    catch { if(file.name.toLowerCase().endsWith('.json')) throw Error('JSON은 UTF-8로 저장해 주세요.'); text=new TextDecoder('euc-kr',{fatal:true}).decode(buffer); }
    const dates=parseLocalImport(text,{format:file.name.toLowerCase().endsWith('.json')?'json':'csv',date:$('import-date').value});
    if(!dates.length) throw Error('파일에 순위로 표시할 캐릭터가 없습니다.');
    if(version!==importVersion) return;
    if($('outfit-dialog').open)$('outfit-dialog').close();
    localSnapshots=dates;snapshot=dates[0]; local=true; failure='';
    $('min-level').value=String(MIN_LEVEL);$('max-level').value=String(MAX_LEVEL);$('job').value='';$('world').value='';
    if(!snapshot.characters.some(r=>worldGroup(r.world)===$('world-group').value))$('world-group').value=worldGroup(snapshot.characters[0].world);
    addDataOptions();$('data-date').value=snapshot.coverage.data_date; render(); $('feedback').textContent=`내 파일 ${dates.reduce((n,d)=>n+d.characters.length,0)}개 기록 분석 · 기기에서만 표시`;
    $('result-section').scrollIntoView?.({block:'start'});
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
function fact(label,value) {
  const pair=el('div');pair.append(el('dt','',label),el('dd','',value));return pair;
}
function showOutfit(character,trigger) {
  const dialog=$('outfit-dialog'),image=$('outfit-image'),version=++detailVersion;
  profileIndex=currentRanked.indexOf(character);if(trigger)profileTrigger=trigger;
  $('profile-rank').textContent=`${local?'내 파일':'현재 조건'} ${profileIndex+1}위`;
  $('outfit-title').textContent=character.name;$('profile-subtitle').textContent=`Lv.${character.level} · ${character.job} · ${character.world}`;
  image.hidden=!character.image;$('profile-image-missing').hidden=!!character.image;$('profile-image-missing').textContent='외형 이미지 미수집';
  if(character.image){image.onload=()=>window.MapleMotion?.fade(image);image.src=character.image;image.alt=character.name+' 수집 당시 실제 캐릭터 코디';if(image.complete&&image.naturalWidth)window.MapleMotion?.fade(image);}else image.removeAttribute('src');
  $('profile-date').textContent=`${character.observedAt} 수집 코디`;
  $('profile-power-label').textContent=powerLabel(character);
  $('profile-power').textContent=character.combat.toLocaleString('ko-KR');
  $('profile-facts').replaceChildren(fact('월드',character.world),fact('직업',character.job),fact('레벨',String(character.level)),fact('기준일',character.observedAt));
  if(character.calculation)$('profile-facts').append(fact('API 착용 전투력',character.calculation.api_combat.toLocaleString('ko-KR')));
  if(character.calculation?.android) {
    const a=character.calculation.android;
    $('profile-facts').append(fact('안드로이드',a.name));
    if(a.manual_equip)$('profile-facts').append(fact('장착 조건',`프리셋 ${a.source_preset}의 안드로이드 직접 장착`));
  }
  $('profile-presets').textContent=character.calculation?'계산 조합 · '+presetInfo(character):'';
  $('profile-prev').disabled=profileIndex<=0;$('profile-next').disabled=profileIndex<0||profileIndex>=currentRanked.length-1;
  $('profile-outfit-preset').textContent='';$('profile-outfit-items').replaceChildren();
  $('profile-detail-status').textContent=local?'내 파일에 코디 착용 정보가 포함되어 있지 않습니다.':'코디 착용 정보 불러오는 중…';
  if(dialog.open)window.MapleMotion?.fade($('profile-facts'));
  if(!dialog.open){dialog.showModal();document.body.classList.add('profile-open');}
  if(!local)fillDetail(character,version);
}
async function fillDetail(character,version) {
  try{
    const detail=await loadCharacterDetail(character);
    if(version!==detailVersion||!$('outfit-dialog').open)return;
    if(!detail){$('profile-detail-status').textContent='이 기록의 코디 착용 정보는 미수집입니다.';return;}
    if(detail.gender)$('profile-facts').append(fact('성별',detail.gender));
    if(detail.guild!==null)$('profile-facts').append(fact('길드',detail.guild||'소속 없음'));
    $('profile-outfit-preset').textContent=detail.outfit_source==='preset'?`코디 프리셋 ${detail.cash_preset}`:detail.outfit_source==='base'?'기본 코디':'';
    $('profile-detail-status').textContent=detail.outfit_source==='unavailable'?'이 기록의 코디 착용 정보는 미수집입니다.':detail.items.length?'수집 당시 착용 정보 · 전투력 계산 조합과 별개입니다.':'수집 당시 착용한 캐시 아이템이 없습니다.';
    const items=detail.items.map(item=>{
      const li=el('li'),text=el('div','outfit-item-copy');li.append(el('span','outfit-slot',item.slot));
      text.append(el('strong','',item.name));if(item.label)text.append(el('small','outfit-label',item.label));
      if(item.prism)text.append(el('small','outfit-prism',`컬러링 프리즘 · ${item.prism.range||'전체'} · 색조 ${item.prism.hue} / 채도 ${item.prism.saturation} / 명도 ${item.prism.value}`));
      li.append(text);return li;
    });$('profile-outfit-items').replaceChildren(...items);
  }catch{
    if(version!==detailVersion||!$('outfit-dialog').open)return;
    const status=$('profile-detail-status'),retry=el('button','detail-retry','다시 불러오기');retry.type='button';
    retry.addEventListener('click',()=>{status.textContent='코디 착용 정보 불러오는 중…';fillDetail(character,++detailVersion);});
    status.replaceChildren(document.createTextNode('코디 착용 정보를 불러오지 못했습니다. '),retry);
  }
}
function presetInfo(character) {
  const p=character.calculation.presets;
  return `장비 ${p.equipment} · 하이퍼 ${p.hyper} · 어빌 ${p.ability} · 유니온 ${p.union}`+(character.calculation.android?.manual_equip?' · 안드로이드 장착':'');
}
function powerLabel(character) {
  return character.calculation?.configuration_scope==='presets-and-owned-android'?'조합 계산 전투력':character.calculation?'프리셋 계산 전투력':'API 착용 전투력';
}
$('outfit-close').addEventListener('click',()=>window.MapleMotion?window.MapleMotion.closeDialog($('outfit-dialog')):$('outfit-dialog').close());
$('profile-prev').addEventListener('click',()=>{if(profileIndex>0)showOutfit(currentRanked[profileIndex-1]);});
$('profile-next').addEventListener('click',()=>{if(profileIndex<currentRanked.length-1)showOutfit(currentRanked[profileIndex+1]);});
$('outfit-image').addEventListener('error',()=>{$('outfit-image').hidden=true;$('profile-image-missing').hidden=false;$('profile-image-missing').textContent='이미지를 불러오지 못했습니다.';});
$('outfit-dialog').addEventListener('close',()=>{++detailVersion;document.body.classList.remove('profile-open');profileTrigger?.focus();});
$('outfit-dialog').addEventListener('click',e=>{if(e.target!==$('outfit-dialog'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)window.MapleMotion?window.MapleMotion.closeDialog(e.target):e.target.close();});
