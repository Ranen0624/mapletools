import {bindPicker,stage,catalogReady} from './coordi-picker.js?v=release-203';
import {bindDemoSettings} from './shared-demo-settings.js?v=release-203';
import {GROUPS} from './demo-engine.js?v=release-203';
import {COORDI_CHARACTERS,SAMPLE_DATE,searchCoordi,coordiCsv} from './coordi-engine.js?v=release-203';
const $=id=>document.getElementById(id),form=$('coordi-form'),field=name=>form.elements.namedItem(name);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let results=[],selected=null,logs=[],lastButton=null;
if(window.self!==window.top||new URLSearchParams(location.search).get('embedded')==='1')document.documentElement.classList.add('is-embedded');
for(const group of Object.keys(GROUPS))$('coordi-group').add(new Option(group,group));
function updateJobs(){$('coordi-job').innerHTML='<option value="">전체</option>';for(const job of GROUPS[field('group').value]||[])$('coordi-job').add(new Option(job,job));}
$('coordi-group').addEventListener('change',updateJobs);
const names=[...new Set(COORDI_CHARACTERS.flatMap(c=>c.configs.flatMap(conf=>conf.items.map(i=>i.aliases[0]))))];
for(const name of names){const b=document.createElement('button');b.type='button';b.textContent='+ '+name;b.addEventListener('click',()=>{field('query').value+=(field('query').value.trim()?', ':'')+name;field('query').focus();refreshPicker();});$('coordi-samples').append(b);}
const refreshPicker=bindPicker(field('query'));
function status(text){$('coordi-status').textContent=text;}
function showPage(page){
 const resultPage=page==='results'||page==='logs';
 for(const key of ['search','results','settings','help'])$('coordi-'+key+'-page').hidden=key==='results'?!resultPage:key!==page;
 document.querySelectorAll('[data-page]').forEach(b=>{if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 $('coordi-results-page').querySelector('.workspace-heading').hidden=page==='logs';
 if(resultPage){$('coordi-result-panel').hidden=page==='logs';$('coordi-log-panel').hidden=page!=='logs';}
}
function tab(log=false){showPage(log?'logs':'results');}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
bindDemoSettings({status,navigate:key=>{if(key==='coordi')showPage('search');else location.href='demo.html?app='+key+'&v=release-203';}});
function itemsHtml(items){return '<ul class="item-list">'+items.map(i=>`<li><span>${esc(i.part)}</span><b>${esc(i.name)}</b></li>`).join('')+'</ul>';}
function source(conf){return conf.label+(conf.current?' · 사용중':'');}
function selectRow(index){selected=results[index];const r=selected;if(!r)return;document.querySelectorAll('#coordi-rows tr').forEach((tr,i)=>tr.setAttribute('aria-selected',String(i===index)));
 $('coordi-preview').innerHTML=`<h2>선택 결과 미리보기</h2><strong>${esc(r.name)}</strong><p class="hint">${esc(r.world)} · Lv.${r.level} · ${esc(r.job)}</p><div class="preview-avatar"><span aria-hidden="true">✧</span><small>가상 캐릭터 · 외형 이미지 생략</small></div><p class="source-label">${esc(source(r.chosen))}</p><h3>검색조건 일치 코디</h3>${itemsHtml(r.chosen.matched)}<p class="hint">일치한 위치: ${r.matches.map(c=>esc(source(c))).join(' / ')}</p><button class="button ghost" id="coordi-open-detail" type="button">모든 일치 구성 보기</button>`;
 $('coordi-open-detail').addEventListener('click',openDetail);
 catalogReady.then(()=>{if(selected===r)stage($('coordi-preview').querySelector('.preview-avatar'),r.chosen.items.map(i=>i.name),'가상 캐릭터 · 검출 구성 미리보기');}).catch(()=>{});
}
function openDetail(){if(!selected)return;lastButton=document.activeElement;$('coordi-detail-title').textContent=selected.name+' · 검출된 코디 구성';$('coordi-detail-body').innerHTML='<p class="hint">PC의 캐릭터 이미지는 조회 기준일의 적용 외형이에요. 저장 프리셋의 착용 구성은 아래 목록으로 확인해요. 이 체험에서는 가상 이름만 표시해요.</p>'+selected.matches.map(conf=>`<section class="detail-config"><h3>${esc(source(conf))}</h3>${itemsHtml(conf.items)}</section>`).join('');$('coordi-detail').showModal();}
$('coordi-detail-close').addEventListener('click',()=>$('coordi-detail').close());$('coordi-detail').addEventListener('close',()=>lastButton?.focus());
function render(){
 $('coordi-count').textContent=results.length+'명';$('coordi-export').disabled=!results.length;
 $('coordi-rows').innerHTML=results.map((r,i)=>`<tr aria-selected="false"><td><button type="button" data-result="${i}">${esc(r.name)}</button></td><td>${esc(r.world)}</td><td>${r.level}</td><td>${esc(r.job)}</td><td>${r.matches.map(c=>esc(source(c))).join('<br>')}</td><td>${r.chosen.items.length}</td><td>${r.chosen.label.startsWith('추가')?'추가 외형':'기본 외형'}</td><td>${esc(r.chosen.items.map(i=>i.name).join(' · '))}</td></tr>`).join('');
 for(const b of document.querySelectorAll('[data-result]')){b.addEventListener('click',()=>selectRow(Number(b.dataset.result)));b.closest('tr').addEventListener('dblclick',()=>{selectRow(Number(b.dataset.result));openDetail();});}
 $('coordi-empty').hidden=!!results.length;$('coordi-empty').textContent='이 조건과 일치하는 가상 캐릭터가 없어요. 이름이나 검색 방식을 바꿔 보세요.';
 $('coordi-preview').innerHTML='<h2>선택 결과 미리보기</h2><p class="hint">결과에서 캐릭터를 선택하면 일치한 코디 구성을 볼 수 있어요.</p>';
}
form.addEventListener('submit',e=>{e.preventDefault();try{const filters=Object.fromEntries(new FormData(form));filters.normal=field('normal').checked;filters.special=field('special').checked;results=searchCoordi(filters);selected=null;render();tab();logs.push(`${new Date().toLocaleTimeString('ko-KR')} · ${filters.date} 가상 검색 · ${results.length}명 · ${filters.mode==='exact'?'입력 코디만 착용':'모두 착용'} · API 호출 0회`);$('coordi-log').textContent=logs.join('\n');status(`검색 완료 · ${results.length}명 · 가상 데이터`);}catch(error){status(error.message);}});
$('coordi-example').addEventListener('click',()=>{form.reset();updateJobs();field('date').value=SAMPLE_DATE;field('query').value='밤의 엘로디, 메르헨 판타지, 엘로디 헤어';refreshPicker();status('예시를 채웠어요. 검색 시작을 눌러 보세요.');});
$('coordi-reset').addEventListener('click',()=>{form.reset();updateJobs();results=[];selected=null;refreshPicker();render();showPage('search');$('coordi-empty').textContent='찾고 싶은 코디를 입력하거나 예시 채우기를 눌러 보세요.';status('검색 조건과 결과를 초기화했어요.');});
$('coordi-export').addEventListener('click',()=>{if(!results.length)return;const url=URL.createObjectURL(new Blob([coordiCsv(results)],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='MapleTools_coordi_demo.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('가상 코디 검색 결과를 CSV로 저장했어요.');});
document.addEventListener('wheel',e=>{const input=e.target.closest?.('input[type=number],input[type=date],select');if(input&&document.activeElement===input)input.blur();},{capture:true,passive:true});

// Prevent interactions before the module and its fixtures are ready.
for(const id of ['coordi-example','coordi-reset','coordi-search'])$(id).disabled=false;
