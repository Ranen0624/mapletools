import './avatar-client.js?v=release-203';
import './outfit-effects.js?v=release-203';
import './outfit-ui.js?v=release-203';
import {normalizeName,parseQuery} from './coordi-engine.js?v=release-203';
const key=name=>normalizeName(name).replace(/ /g,'');
let catalog={items:[],region:'KMS',version:'389'},sets=[];
const exact=new Map(),searchCache=new Map(),stages=new WeakMap();
export const catalogReady=fetch('assets/coordi-catalog.json?v=release-203').then(r=>{if(!r.ok)throw Error('catalog');return r.json();}).then(data=>{catalog=data;MapleAvatar.setCatalog(data);for(const item of catalog.items){item.key=key(item.name);if(!exact.has(item.key))exact.set(item.key,[]);exact.get(item.key).push(item);}return data;});
export const suggestions=(name,part='',limit=10)=>MapleAvatar.suggestions(name,part,limit);
export const resolve=names=>MapleAvatar.resolve(names);
export const iconUrl=item=>MapleAvatar.iconUrl(item);
export const previewUrl=items=>MapleAvatar.previewUrl(items);
export async function stage(container,names,caption='선택한 코디 미리보기 · 빈 부위는 기본 외형',force=false){
 const {items,missing}=resolve(names);let view=stages.get(container);
 if(!view){container.replaceChildren();container.classList.add('coordi-stage');const heading=document.createElement('span');heading.textContent='✧ COORDI ROOM ✧';const state=document.createElement('small'),note=document.createElement('p');container.append(heading,state,note);view={url:null,state,note,pending:null,image:null};stages.set(container,view);}
 const seq=(view.revision||0)+1;view.revision=seq;
 let url;try{url=await previewUrl(items);}catch{view.state.textContent='미리보기 코드를 생성하지 못했어요.';return;}
 if(view.revision!==seq)return;
 view.note.textContent=missing.length?'이미지 미선택: '+missing.join(', ')+' · 이름 검색에는 포함됩니다.':caption;
 if(view.url===url&&!force)return;
 clearTimeout(view.timeout);
 if(view.pending){view.pending.onload=view.pending.onerror=null;view.pending.src='';view.pending=null;}
 view.url=url;
 if(!url){view.image?.remove();view.image=null;view.state.textContent='코디를 고르면 미리 볼 수 있어요.';return;}
 view.state.textContent='착용 모습 준비 중… 이전 이미지가 있으면 잠시 유지합니다.';
 const img=new Image();view.pending=img;img.alt='선택한 코디의 참고용 착용 모습';
 img.onload=()=>{if(view.pending!==img)return;clearTimeout(view.timeout);view.frame?.remove();view.image?.remove();view.image=img;view.frame=OutfitUI.previewFrame(img,items,container.closest('#coordi-preview')?1.1:1.3);view.pending=null;container.insertBefore(view.frame,view.state);view.state.textContent='';};
 img.onerror=()=>{if(view.pending!==img)return;clearTimeout(view.timeout);view.pending=null;view.state.textContent='새 이미지를 불러오지 못했어요. 다시 보기를 눌러 주세요.';};view.timeout=setTimeout(()=>{if(view.pending!==img)return;img.onload=img.onerror=null;img.src='';view.pending=null;view.state.textContent='외부 미리보기 서버 응답이 늦어지고 있어요. 이름 검색은 계속 사용할 수 있어요.';},10000);img.src=url;
}
export function bindPicker(query){
 const results=document.getElementById('coordi-suggestions'),part=document.getElementById('coordi-part'),preview=document.getElementById('coordi-fitting'),selected=document.getElementById('coordi-selected'),related=document.getElementById('coordi-related');
 let timer,previewTimer;
 const append=name=>{try{const names=parseQuery(query.value);let index=names.length-1;const active=names[index];if(!active||(MapleAvatar.identify(active)&&!key(name).includes(key(active))))index=null;query.value=MapleAvatar.selectName(names,name,index).join(', ')+', ';query.focus();refresh(true);}catch(error){document.getElementById('coordi-resource-note').textContent=error.message;}};
 const showSets=name=>OutfitUI.setPopup(name,document.activeElement,append);
 const refresh=(keep=false)=>{
  clearTimeout(timer);if(keep!==true)results.replaceChildren();const fragment=query.value.split(/[,;\n\r]/).at(-1).trim(),matches=suggestions(fragment,part.value);
  if(keep!==true)for(const item of matches){
   const row=document.createElement('div');row.className='coordi-suggestion-row';const button=document.createElement('button');button.type='button';const img=document.createElement('img');MapleAvatar.loadIcon(img,item);img.alt='';img.loading='lazy';img.onerror=()=>{img.hidden=true;};
   const text=document.createElement('span');text.textContent=item.name+' · '+item.part;const frame=document.createElement('span');frame.className='coordi-icon-frame';frame.append(img);button.append(frame,text);
   button.addEventListener('click',()=>append(item.name));button.addEventListener('contextmenu',e=>{e.preventDefault();showSets(item.name);});
   const setButton=document.createElement('button');setButton.type='button';setButton.textContent='세트';setButton.setAttribute('aria-label',item.name+' 세트 보기');setButton.addEventListener('click',()=>showSets(item.name));row.append(button);if(MapleAvatar.relatedSets(item.name).length)row.append(setButton);results.append(row);
  }
  if(keep!==true&&!matches.length){const hint=document.createElement('p');hint.className='pc-hint';hint.textContent=fragment?'추천 목록에 없는 이름도 그대로 검색할 수 있어요.':'코디 이름을 입력하면 추천 아이템이 나와요.';results.append(hint);}
  const names=parseQuery(query.value);let slotBox=document.getElementById('coordi-slot-list');if(!slotBox){slotBox=document.createElement('div');slotBox.id='coordi-slot-list';slotBox.className='coordi-slot-list';selected.before(slotBox);}slotBox.replaceChildren();for(const slot of MapleAvatar.slots){const count=resolve(names).items.filter(i=>i.part===slot).length;const button=document.createElement('button');button.type='button';button.className=count?'filled':'';button.textContent=(count?'● ':'○ ')+slot+(count?' '+count+'/'+(slot==='반지'?4:1):'');button.onclick=()=>{part.value=slot;refresh();const index=names.findIndex(n=>MapleAvatar.identify(n)?.part===slot);const row=selected.children[index];if(row){row.classList.add('selected');row.scrollIntoView({block:'nearest'});}};slotBox.append(button);}selected.replaceChildren();document.getElementById('coordi-selected-title').textContent=`선택한 조건 · ${names.length}개 · 모두 일치`;
  names.forEach((name,index)=>{const row=document.createElement('div');row.className='coordi-selected-row';const button=document.createElement('button');button.type='button';button.textContent=name;button.title='클릭하거나 우클릭해 세트 보기';button.addEventListener('click',()=>showSets(name));button.addEventListener('contextmenu',e=>{e.preventDefault();showSets(name);});const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',name+' 조건 빼기');remove.addEventListener('click',()=>{const current=parseQuery(query.value);current.splice(index,1);query.value=current.join(', ')+(current.length?', ':'');refresh();});row.append(button,remove);selected.append(row);});
  clearTimeout(previewTimer);previewTimer=setTimeout(()=>stage(preview,names),600);
 };
 query.addEventListener('input',()=>{clearTimeout(timer);clearTimeout(previewTimer);timer=setTimeout(refresh,180);});part.addEventListener('change',refresh);
 document.getElementById('coordi-preview-retry').addEventListener('click',()=>{clearTimeout(previewTimer);stage(preview,parseQuery(query.value),undefined,true);});
 catalogReady.then(()=>{document.getElementById('coordi-resource-note').textContent=catalog.notice;refresh();}).catch(()=>{document.getElementById('coordi-resource-note').textContent='추천 목록을 불러오지 못했어요. 이름을 직접 입력하면 검색할 수 있어요.';});
 return refresh;
}
