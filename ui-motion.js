/* Short, cancellable feedback. Data and navigation never wait for decoration. */
(()=>{
 'use strict';
 const root=document.documentElement,key='mapletools-motion-paused';
 const preference=window.matchMedia?.('(prefers-reduced-motion: reduce)')||{matches:false};
 let paused=false;try{paused=localStorage.getItem(key)==='true';}catch{}
 const running=new Map(),closing=new WeakMap();
 const enabled=()=>!paused&&!preference.matches&&!document.hidden;
 function animate(node,frames,options={}){
  if(!node||!enabled()||typeof node.animate!=='function')return Promise.resolve(false);
  running.get(node)?.cancel();
  const animation=node.animate(frames,{duration:220,easing:'cubic-bezier(.2,.7,.2,1)',...options});
  running.set(node,animation);
  return animation.finished.then(()=>true,()=>false).finally(()=>{if(running.get(node)===animation)running.delete(node);});
 }
 const enter=(node,options)=>animate(node,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],options);
 const fade=node=>animate(node,[{opacity:0},{opacity:1}]);
 const pulse=node=>animate(node,[{boxShadow:'0 0 0 0 #bba4fb00'},{boxShadow:'0 0 0 3px #bba4fb70',offset:.35},{boxShadow:'0 0 0 0 #bba4fb00'}],{duration:380});
 function rows(host){host?.querySelectorAll('tbody tr').forEach((row,i)=>fadeRow(row,i));}
 function fadeRow(row,index){animate(row,[{opacity:.25},{opacity:1}],{duration:180,delay:Math.min(index,6)*22});}
 function closeDialog(dialog){
  if(!dialog?.open)return;
  if(closing.has(dialog))return;
  if(!enabled()||typeof dialog.animate!=='function'){dialog.close();return;}
  const token={};closing.set(dialog,token);
  animate(dialog,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(5px)'}],{duration:140}).then(finished=>{
   if(closing.get(dialog)!==token)return;closing.delete(dialog);
   if(dialog.open&&(finished||!enabled()))dialog.close();
  });
 }
 function sync(){
  const on=!paused&&!preference.matches;
  root.classList.toggle('motion-enabled',on);root.classList.toggle('motion-paused',!on);
  for(const button of document.querySelectorAll('[data-motion-toggle],#motion-toggle')){
   button.disabled=!!preference.matches;button.setAttribute('aria-pressed',String(!on));
   button.textContent=preference.matches?'동작 줄임 사용 중':on?'모션 끄기':'모션 켜기';
  }
  if(!enabled())for(const animation of running.values())animation.cancel();
  window.dispatchEvent(new CustomEvent('maple-motion-change'));
 }
 function toggle(){paused=!paused;try{localStorage.setItem(key,String(paused));}catch{}sync();}
 window.MapleMotion={enabled,paused:()=>paused,animate,enter,fade,pulse,rows,closeDialog};
 let button=document.getElementById('motion-toggle');
 if(!button){
  const host=document.querySelector('.demo-sitebar')||document.querySelector('.site-footer .container')||document.querySelector('footer');
  if(host){button=document.createElement('button');button.type='button';button.className='motion-toggle shared-motion-toggle';button.dataset.motionToggle='';host.append(button);}
 }
 button?.addEventListener('click',toggle);
 preference.addEventListener?.('change',sync);document.addEventListener('visibilitychange',sync);
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null){try{paused=localStorage.getItem(key)==='true';}catch{}sync();}});
 // Native dialogs retain Escape, focus trapping and focus restoration.
 const observer=new MutationObserver(entries=>{
  for(const entry of entries){const dialog=entry.target;if(dialog.tagName!=='DIALOG')continue;
   if(dialog.open){closing.delete(dialog);enter(dialog,{duration:180});}
   else running.get(dialog)?.cancel();
  }
 });
 observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 document.addEventListener('cancel',event=>{if(event.target.tagName==='DIALOG'&&enabled()){event.preventDefault();closeDialog(event.target);}},true);
 // Measure the current height, so rapid open/close clicks reverse cleanly.
 const accordions=new WeakMap();
 document.querySelectorAll('.faq details').forEach(details=>{
  const summary=details.querySelector('summary');
  summary.addEventListener('click',event=>{
   if(!enabled()||typeof details.animate!=='function')return;
   event.preventDefault();const previous=accordions.get(details),open=previous?!previous.open:!details.open;
   const height=details.getBoundingClientRect().height;running.get(details)?.cancel();details.open=true;
   const target=open?details.scrollHeight:summary.getBoundingClientRect().height;
   const token={open};accordions.set(details,token);details.style.overflow='hidden';
   animate(details,[{height:height+'px'},{height:target+'px'}],{duration:200}).then(()=>{
    if(accordions.get(details)!==token)return;
    details.open=open;details.style.overflow='';accordions.delete(details);
   });
  });
 });
 sync();
})();
