'use strict';
const menu=document.querySelector('.menu-toggle'),nav=document.getElementById('main-nav');
function closeMenu(){nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','메뉴 열기');}
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';nav.classList.toggle('is-open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');});
nav.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
document.addEventListener('click',event=>{if(!event.target.closest('.site-header'))closeMenu();});
const features={
 "search": [
  "EQUIPMENT FINDER",
  "궁금했던 그 장비,<br>함께 찾아봐요.",
  "장비 이름과 원하는 옵션을 골라보세요.<br>전투력·유니온·HEXA 조건도 함께 검색할 수 있어요.",
  [
   [
    "장비 옵션",
    "스타포스 · 잠재능력 · 에디셔널 · 추가옵션"
   ],
   [
    "성장 조건",
    "전투력 · 유니온 · HEXA"
   ]
  ],
  "detailed",
  "장비 검색 체험하기"
 ],
 "union": [
  "UNION CHAMPION FINDER",
  "직업과 레벨로,<br>유니온 조합 찾기.",
  "최대 6개 캐릭터의 직업과 레벨을 골라보세요.<br>공개된 유니온 챔피언에서 같은 조합을 찾아드려요.",
  [
   [
    "캐릭터 조합",
    "직업과 레벨을 최대 6개까지"
   ],
   [
    "일치 방식",
    "모두 일치하거나 일부가 일치하는 조합"
   ]
  ],
  "union",
  "유니온 검색 체험하기"
 ],
 "coordi": [
  "COORDI FINDER",
  "마음에 드는 코디,<br>누가 입고 있을까요?",
  "아이템·헤어·성형·피부를 골라보세요.<br>같은 코디를 착용한 캐릭터를 찾아드려요.",
  [
   [
    "코디 조건",
    "아이템 · 헤어 · 성형 조합"
   ],
   [
    "검색 범위",
    "현재 코디와 저장된 프리셋"
   ]
  ],
  "coordi",
  "코디 검색 체험하기"
 ],
 "audit": [
  "COMBAT POWER",
  "내 전투력,<br>어디서 왔을까요?",
  "장비와 세트 효과가 더해진 내역을 살펴봐요.<br>API 전투력과 계산값을 나란히 비교할 수 있어요.",
  [
   [
    "확인할 내용",
    "장비 효과 · 세트 효과 · 프리셋 예상값"
   ],
   [
    "참고해 주세요",
    "일부 직업과 조건은 계산 오차가 있어요."
   ]
  ],
  "audit",
  "전투력 살펴보기"
 ],
 "statistics": [
  "MY CHARACTERS",
  "찾아본 캐릭터를,<br>한곳에 모아봐요.",
  "직업·월드·레벨별로 결과를 모아보세요.<br>필요한 결과는 CSV로 저장할 수 있어요.",
  [
   [
    "모아보기",
    "직업별 · 월드별 · 레벨별 분포"
   ]
  ],
  "statistics",
  "결과 모아보기"
 ],
 "history": [
  "MY MAPLE HISTORY",
  "그때의 레벨과 코디,<br>다시 꺼내봐요.",
  "공개된 기록을 날짜별로 살펴보세요.<br>레벨과 코디가 달라진 순간을 확인할 수 있어요.",
  [
   [
    "변화 기록",
    "레벨 · 닉네임 · 길드 · 코디"
   ]
  ],
  "timeline",
  "변화 이력 보기"
 ],
 "save": [
  "SAVE & RESUME",
  "자주 찾는 조건은,<br>다음에도 그대로.",
  "검색 조건을 저장하고 다시 불러오세요.<br>장비 검색은 중단한 기록에서 이어갈 수 있어요.",
  [
   [
    "다음 검색도 편하게",
    "조건 저장 · 결과 복원 · 이어하기"
   ]
  ],
  "detailed",
  "검색 체험하기"
 ]
};
const tabs=[...document.querySelectorAll('[data-feature]')],panel=document.getElementById('feature-panel');
let featureMarker;
function moveFeatureMarker(){
 const selected=tabs.find(t=>t.getAttribute('aria-selected')==='true');if(!selected)return;
 const host=selected.parentElement;
 if(!featureMarker){featureMarker=document.createElement('span');featureMarker.className='feature-selection-marker';featureMarker.setAttribute('aria-hidden','true');host.append(featureMarker);}
 const r=selected.getBoundingClientRect(),h=host.getBoundingClientRect();
 Object.assign(featureMarker.style,{width:r.width+'px',height:r.height+'px',transform:`translate(${r.left-h.left+host.scrollLeft}px,${r.top-h.top+host.scrollTop}px)`});
}
window.addEventListener('resize',moveFeatureMarker,{passive:true});moveFeatureMarker();
function selectFeature(button){const key=button.dataset.feature,d=features[key];if(!d)return;tabs.forEach(tab=>{tab.setAttribute('aria-selected',String(tab===button));tab.tabIndex=tab===button?0:-1;});panel.style.minHeight=Math.max(panel.getBoundingClientRect().height,panel.scrollHeight)+'px';panel.setAttribute('aria-labelledby',button.id);panel.innerHTML=`<p class="eyebrow">${d[0]}</p><h3>${d[1]}</h3><p>${d[2]}</p><div class="feature-facts">${d[3].map(([label,text])=>`<div><span>${label}</span><p>${text}</p></div>`).join('')}</div><a class="text-link" href="${key==='coordi'?'coordi.html?v=release-203':'demo.html?v=ui-2267-1&app='+d[4]}">${d[5]} <span aria-hidden="true">→</span></a>`;moveFeatureMarker();window.MapleMotion?.enter(panel);}
tabs.forEach((button,index)=>{button.addEventListener('click',()=>selectFeature(button));button.addEventListener('keydown',event=>{let i=index;if(event.key==='ArrowDown'||event.key==='ArrowRight')i=(index+1)%tabs.length;else if(event.key==='ArrowUp'||event.key==='ArrowLeft')i=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else return;event.preventDefault();tabs[i].focus();selectFeature(tabs[i]);});});

// Bounded motion: CSS handles float/twinkle; JS only interpolates the active pointer.
const scene=document.querySelector('[data-motion-scene]'),motionToggle=document.getElementById('motion-toggle');
if(scene&&motionToggle){
 const preference=typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 let manualPause=window.MapleMotion?.paused()||false,inView=true,frame=0,bounds=null,x=0,y=0,targetX=0,targetY=0;
 const active=()=>!manualPause&&!preference.matches&&!document.hidden&&inView;
 const cancel=()=>{if(frame){cancelAnimationFrame(frame);frame=0;}};
 function paint(){frame=0;if(!active())return;x+=(targetX-x)*.085;y+=(targetY-y)*.085;scene.style.setProperty('--pointer-x',x.toFixed(4));scene.style.setProperty('--pointer-y',y.toFixed(4));if(Math.abs(targetX-x)+Math.abs(targetY-y)>.002)frame=requestAnimationFrame(paint);}
 function queue(){if(active()&&!frame)frame=requestAnimationFrame(paint);}
 function sync(){const enabled=!manualPause&&!preference.matches;document.documentElement.classList.toggle('motion-enabled',enabled);document.documentElement.classList.toggle('motion-paused',!enabled);document.documentElement.classList.toggle('has-reveals',enabled&&'IntersectionObserver' in window);scene.dataset.motion=active()?'on':'paused';motionToggle.disabled=Boolean(preference.matches);motionToggle.setAttribute('aria-pressed',String(!enabled));motionToggle.innerHTML=preference.matches?'동작 줄임 사용 중':enabled?'모션 끄기 <span aria-hidden="true">✧</span>':'모션 켜기 <span aria-hidden="true">✧</span>';if(!active()){cancel();scene.style.setProperty('--pointer-x','0');scene.style.setProperty('--pointer-y','0');x=y=0;}else queue();}
 if(window.MapleMotion)window.addEventListener('maple-motion-change',()=>{manualPause=window.MapleMotion.paused();sync();});else motionToggle.addEventListener('click',()=>{manualPause=!manualPause;sync();});
 scene.addEventListener('pointerenter',()=>{bounds=scene.getBoundingClientRect();});
 scene.addEventListener('pointermove',event=>{if(event.pointerType==='touch'||!active())return;bounds??=scene.getBoundingClientRect();if(!bounds.width||!bounds.height)return;targetX=Math.max(-1,Math.min(1,(event.clientX-bounds.left)/bounds.width*2-1));targetY=Math.max(-1,Math.min(1,(event.clientY-bounds.top)/bounds.height*2-1));queue();},{passive:true});
 scene.addEventListener('pointerleave',()=>{targetX=targetY=0;bounds=null;queue();});
 window.addEventListener('resize',()=>{bounds=null;},{passive:true});document.addEventListener('visibilitychange',sync);
 preference.addEventListener?.('change',sync);
 if('IntersectionObserver' in window){new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{threshold:.05}).observe(scene);if(!preference.matches){document.documentElement.classList.add('has-reveals');const revealObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}},{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));}}
 sync();
}

// The phone only floats when visible; the shared motion switch still controls it.
const phoneStage=document.querySelector('.android-art');
if(phoneStage){
 const syncPhoneVisibility=()=>phoneStage.classList.toggle('is-hidden-page',document.hidden);
 document.addEventListener('visibilitychange',syncPhoneVisibility);syncPhoneVisibility();
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{phoneStage.dataset.awake=String(entries[0].isIntersecting);},{threshold:.05}).observe(phoneStage);
 else phoneStage.dataset.awake='true';
}
