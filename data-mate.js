'use strict';
(()=>{
const section=document.getElementById('data-playground');if(!section)return;
const get=id=>document.getElementById(id),input=get('stats-csv'),bubble=get('mate-message'),figure=get('data-mate'),status=get('csv-status'),chart=get('csv-chart'),clear=get('csv-clear'),summary=get('csv-summary');
let worker=null,result=null,revision=0,tip=0,reactionTimer=0;
const tips=['프로그램의 「전체 결과 CSV」를 골라 줘.\n직업·월드·레벨별로 정리해 줄게!','같은 월드와 닉네임은 한 명으로 세어. 장비가 여러 개여도 중복 집계하지 않아.','여기서는 불러온 캐릭터만 모아봐. 메이플 전체 유저 수와는 달라.'];
function react(message,kind='data'){bubble.replaceChildren();for(const line of message.split('\n')){const span=document.createElement('span');span.textContent=line;if(message.includes('\n'))span.className='mate-line';bubble.append(span);}figure.dispatchEvent(new CustomEvent('mate-react',{detail:{kind}}));figure.classList.remove('is-reacting');void figure.offsetWidth;figure.classList.add('is-reacting');clearTimeout(reactionTimer);reactionTimer=setTimeout(()=>figure.classList.remove('is-reacting'),1250);}
figure.addEventListener('click',()=>{tip=(tip+1)%tips.length;react(tips[tip],'greet');});
const modes=[...section.querySelectorAll('[data-stat-group]')];
function render(kind='job'){
  modes.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.statGroup===kind)));
  if(!result)return;
  chart.replaceChildren();const entries=result[kind],max=Math.max(...entries.map(e=>e[1]));
  const shown=entries.length>8?[...entries.slice(0,7),['기타 '+(entries.length-7)+'개 항목',entries.slice(7).reduce((s,e)=>s+e[1],0)]]:entries;
  for(const [label,count]of shown){const li=document.createElement('li'),name=document.createElement('span'),track=document.createElement('span'),bar=document.createElement('i'),value=document.createElement('b');name.textContent=label;track.className='stat-track';track.setAttribute('aria-hidden','true');bar.style.setProperty('--bar',`${count/Math.max(max,...shown.map(e=>e[1]))*100}%`);track.append(bar);value.textContent=`${count.toLocaleString()}명 · ${(count/result.total*100).toFixed(1)}%`;li.append(name,track,value);chart.append(li);}
  get('csv-total').textContent=result.total.toLocaleString();get('csv-dedup').textContent=result.duplicates.toLocaleString();get('csv-rows').textContent=result.rows.toLocaleString();summary.hidden=false;
  const issues=[result.skipped?`형식·필수값 누락 ${result.skipped}행 제외`:'',result.unknownLevels?`레벨 미상 ${result.unknownLevels}명 포함`:'',result.conflicts?`직업·레벨이 다른 중복 ${result.conflicts}행: 첫 행 기준`:''].filter(Boolean);
  get('csv-note').textContent='불러온 파일의 월드+닉네임 기준 집계 · 전체 인구 통계가 아닙니다.'+(issues.length?' '+issues.join(' · '):'');
}
modes.forEach(b=>b.addEventListener('click',()=>{render(b.dataset.statGroup);if(result)react(`${b.textContent} 보기로 바꿨어. 막대 옆에서 인원과 비율을 함께 확인해 봐!`);}));
function stop(){revision++;worker?.terminate();worker=null;section.removeAttribute('aria-busy');}
clear.addEventListener('click',()=>{stop();result=null;input.value='';summary.hidden=true;chart.replaceChildren();get('csv-empty').hidden=false;get('csv-note').textContent='장비·상세검색·유니온의 전체 결과 CSV 지원 · UTF-8 / CP949 · 최대 5MB, 50,000행';status.textContent='불러온 파일을 지웠습니다.';clear.disabled=true;react(tips[0]);});
async function loadFiles(files){
 if(!files?.length)return;
 if(files.length!==1){status.textContent='CSV 파일은 한 번에 하나씩 놓아주세요.';return;}
 const file=files[0];
 if(!/\.csv$/i.test(file.name)){status.textContent='프로그램에서 저장한 CSV 파일을 골라주세요.';return;}
 if(file.size>5*1024*1024){status.textContent='5MB 이하의 CSV를 선택하세요.';return;}
 if(typeof Worker==='undefined'){status.textContent='이 브라우저는 파일 분석을 지원하지 않습니다. 최신 브라우저에서 열어주세요.';return;}
 stop();const current=revision;
 result=null;summary.hidden=true;chart.replaceChildren();get('csv-empty').hidden=false;input.value='';
 section.setAttribute('aria-busy','true');status.textContent='파일 속 캐릭터를 모으고 있어요…';clear.disabled=false;
 try{
  const buffer=await file.arrayBuffer();if(current!==revision)return;
  worker=new Worker('csv-worker.js?v=data-mate-4',{type:'module'});
  worker.onmessage=({data})=>{if(current!==revision)return;worker?.terminate();worker=null;section.removeAttribute('aria-busy');if(data.error){status.textContent=data.error;return;}
   result=data.result;get('csv-empty').hidden=true;render();status.textContent=`${file.name} · 집계 완료`;window.MapleMotion?.pulse(summary);react(`${result.total.toLocaleString()}명의 캐릭터를 모았어! 아래에서 직업·월드·레벨별로 바꿔 봐.`);
  };
  worker.onerror=()=>{if(current!==revision)return;stop();status.textContent='분석 도구를 불러오지 못했습니다. 새로고침 후 다시 선택하세요.';};
  worker.postMessage(buffer,[buffer]);
 }catch{if(current===revision){stop();status.textContent='파일을 읽지 못했습니다. CSV를 다시 선택하세요.';}}
}
input.addEventListener('change',()=>{const files=Array.from(input.files||[]);input.value='';loadFiles(files);});
const dropZone=get('csv-drop-zone');let dragDepth=0;
const hasFiles=event=>Array.from(event.dataTransfer?.types||[]).includes('Files');
function resetDrag(){dragDepth=0;dropZone.classList.remove('is-dragging');}
dropZone.addEventListener('dragenter',event=>{if(!hasFiles(event))return;event.preventDefault();dragDepth++;dropZone.classList.add('is-dragging');});
dropZone.addEventListener('dragover',event=>{if(!hasFiles(event))return;event.preventDefault();event.dataTransfer.dropEffect='copy';});
dropZone.addEventListener('dragleave',()=>{if(dragDepth>0&&--dragDepth===0)resetDrag();});
dropZone.addEventListener('drop',event=>{resetDrag();if(!hasFiles(event))return;event.preventDefault();loadFiles(Array.from(event.dataTransfer.files||[]));});
// Avoid navigating away if a file is accidentally released outside the target.
document.addEventListener('dragover',event=>{if(hasFiles(event)){event.preventDefault();if(!dropZone.contains(event.target))event.dataTransfer.dropEffect='none';}});
document.addEventListener('drop',event=>{resetDrag();if(hasFiles(event)){event.preventDefault();if(!dropZone.contains(event.target))status.textContent='CSV 파일을 「내 결과 모아보기」의 불러오기 영역에 놓아주세요.';}});
window.addEventListener('dragend',resetDrag);
if('IntersectionObserver'in window)new IntersectionObserver(entries=>{section.dataset.awake=String(entries[0].isIntersecting);},{threshold:.05}).observe(section);else section.dataset.awake='true';
document.addEventListener('visibilitychange',()=>{section.classList.toggle('is-hidden-page',document.hidden);});
})();
