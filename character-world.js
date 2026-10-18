import {mountMateRig} from './mate-rig.js';
import {MATE_ANIMATIONS,availableAnimations,pendingArtwork} from './mate-animation-catalog.js';
import {MASCOT_BEHAVIORS,BEHAVIORS_BY_ID} from './mate-behaviors.js';
import {cardTheme,drawCollectibleCard} from './character-card-art.js';

const API='https://open.api.nexon.com/maplestory/v1/';
export function formatPower(value){
 const n=Number(String(value??'').replace(/,/g,''));
 if(!Number.isFinite(n)||n<0||String(value??'').trim()==='')return '확인 불가';
 return Math.round(n).toLocaleString('ko-KR');
}
export function safePortraitUrl(value,action='A00',emotion='E00',frame=null){
 if(typeof value!=='string'||!value)return null;
 let u;
 try{u=new URL(value)}catch{return null}
 if(u.protocol!=='https:'||!['open.api.nexon.com','openapi.nexon.com'].includes(u.hostname)||!u.pathname.startsWith('/static/maplestory/character/look/'))return null;
 if(!/^A(0[0-9]|[1-3][0-9]|4[01])$/.test(action)||!/^E(0[0-9]|1[0-9]|2[0-4])$/.test(emotion))return null;
 u.searchParams.set('action',action+(Number.isInteger(frame)&&frame>=0&&frame<=3?'.'+frame:''));
 u.searchParams.set('emotion',emotion);
 u.searchParams.set('width','300');u.searchParams.set('height','300');
 u.searchParams.set('x','150');u.searchParams.set('y','210');
 return u.href;
}
export function statCombat(stat){
 const arr=Array.isArray(stat?.final_stat)?stat.final_stat:[];
 const row=arr.find(s=>s?.stat_name==='전투력'||s?.stat_name==='Combat Power');
 return row?.stat_value??null;
}
export function userReadableError(error){
 if(error?.name==='AbortError')return '이전 조회를 취소했어요.';
 if(/429/.test(String(error?.message)))return 'API 호출 한도에 도달했어요. 잠시 후 다시 시도해 주세요.';
 if(/400|403/.test(String(error?.message)))return '캐릭터명 또는 API 키를 확인해 주세요. 아직 데이터가 제공되지 않는 캐릭터일 수도 있어요.';
 return '조회하지 못했어요. 네트워크 또는 브라우저의 API 접근 제한을 확인해 주세요.';
}
if(typeof document!=='undefined')init();

function init(){
 const get=id=>document.getElementById(id),stage=get('cw-playground'),mate=get('cw-mate'),visitor=get('cw-visitor');
 if(!stage||!mate)return;
 const form=get('cw-form'),input=get('cw-name'),keyInput=get('cw-key'),submit=get('cw-submit'),status=get('cw-status'),bubble=get('cw-bubble');
 const portrait=get('cw-avatar'),cardImage=get('cw-card-image'),card=get('cw-card'),profile=get('cw-profile');
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let active=null,requestController=null,currentPose=0,currentEmotion=0,rig=null;
 const phrases={greet:'반가워! 오늘도 좋은 하루야!',curious:'어떤 캐릭터인지 궁금해!',hop:'폴짝! 별을 잡아볼까?',dance:'신나는 춤을 춰 보자!',nod:'응응! 알겠어.',shy:'앗, 부끄러워…',surprised:'와! 정말 놀라운걸?',celebrate:'축하해! 반짝반짝!',search:'마법책에서 찾아보고 있어…',sleep:'조금만 쉬었다 갈게…',summon:'마법진이 열리고 있어!',photograph:'찰칵! 추억을 남겨보자.',land:'사뿐히 착지!',bow:'정중하게 인사할게!',float:'별빛을 타고 떠올라!',farewell:'다음에 또 만나!'};
 function say(kind,text){bubble.textContent=text||BEHAVIORS_BY_ID[kind]?.spoken||phrases[kind]||phrases.greet;stage.dataset.action=kind;mate.dispatchEvent(new CustomEvent('mate-react',{detail:{kind}}));}
 mate.addEventListener('click',()=>say(active?'celebrate':'greet'));
 const progress=get('cw-animation-progress'),plan=get('cw-motion-plan');
 if(progress)progress.textContent='('+availableAnimations().length+'종 구현 · '+pendingArtwork().length+'종 원화 필요)';
 if(plan){
  const labels={life:'기본 생활',movement:'이동',emotion:'감정',special:'상호작용'};
  for(const [key,label] of Object.entries(labels)){
   const group=document.createElement('section'),title=document.createElement('h4'),items=document.createElement('ul');
   title.textContent=label;
   for(const action of MATE_ANIMATIONS.filter(x=>x.group===key)){
    const li=document.createElement('li');li.textContent=action.label+' — '+(action.status==='ready'?'동작 구현':'추가 원화 필요');li.dataset.ready=String(action.status==='ready');items.append(li);
   }
   group.append(title,items);plan.append(group);
  }
 }
 const extra=get('cw-extra-actions');
 if(extra)for(const item of MASCOT_BEHAVIORS){
  const button=document.createElement('button');
  button.type='button';button.dataset.mateAction=item.id;button.textContent=item.icon+' '+item.label;
  extra.append(button);
 }
 for(const b of document.querySelectorAll('[data-mate-action]'))b.addEventListener('click',()=>{
  const type=b.dataset.mateAction;say(type);
  if(active&&['hop','dance','celebrate','welcome','encourage','wave'].includes(type))actOnVisitor(type);
 });
 const observer='IntersectionObserver'in window?new IntersectionObserver(items=>{stage.dataset.awake=items[0]?.isIntersecting?'true':'false';rig?.sync();},{rootMargin:'120px'}):null;
 observer?.observe(stage);
 mountMateRig(mate,stage).then(handle=>{rig=handle;if(handle)handle.sync();});
 window.addEventListener('pagehide',()=>{requestController?.abort();observer?.disconnect();rig?.dispose();},{once:true});
 get('cw-motion').addEventListener('click',()=>{
  const paused=!stage.classList.contains('cw-no-motion');
  stage.classList.toggle('cw-no-motion',paused);
  document.documentElement.classList.toggle('motion-paused',paused);
  get('cw-motion').textContent=paused?'움직임 켜기':'움직임 끄기';
  get('cw-motion').setAttribute('aria-pressed',String(paused));
  rig?.sync();updateAvatarPose();
 });
 // Distinct body action and facial emotion are separate controls.
 // Not every combination is supported by the official image endpoint;
 // unsupported combinations gracefully restore the verified base portrait.
 const poses=[['A00','기본'],['A06','역동적인 자세'],['A01','다른 자세'],['A07','특수 자세']];
 const emotions=[['E00','기본'],['E02','미소'],['E13','장난'],['E17','감정 표현']];
 function updateAvatarPose(){
  if(!active)return;
  const [action,poseLabel]=poses[currentPose%poses.length];
  const [emotion,emotionLabel]=emotions[currentEmotion%emotions.length];
  const url=safePortraitUrl(active.image,action,emotion);
  if(!url)return;
  get('cw-pose-state').textContent='자세: '+poseLabel+' · 표정: '+emotionLabel+' (일부 캐릭터는 동일하게 보일 수 있어요)';
  for(const img of [portrait,cardImage]){
   img.onerror=()=>{img.onerror=null;img.src=active.image;};
   img.src=url;
  }
 }
 function nextPose(){if(!active)return;currentPose=(currentPose+1)%poses.length;updateAvatarPose();say('present','다른 자세를 골랐어!');}
 function nextEmotion(){if(!active)return;currentEmotion=(currentEmotion+1)%emotions.length;updateAvatarPose();say('wave','표정을 바꿔 볼까?');}
 get('cw-avatar-button').addEventListener('click',nextPose);get('cw-pose').addEventListener('click',nextPose);
 get('cw-emotion').addEventListener('click',nextEmotion);
 function actOnVisitor(type){
  visitor.dataset.motion=type;
  if(stage.classList.contains('cw-no-motion')||reduced.matches)return;
  visitor.classList.remove('cw-tap');
  void visitor.offsetWidth;
  visitor.classList.add('cw-tap');
 }
 async function apiGet(endpoint,key,params,signal){
  const query=new URLSearchParams(params);
  const response=await fetch(API+endpoint+'?'+query.toString(),{headers:{'x-nxopen-api-key':key},signal,cache:'no-store',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error('API HTTP '+response.status);
  return response.json();
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const name=input.value.trim(),key=keyInput.value.trim();
  if(!name||!key)return;
  requestController?.abort();
  requestController=new AbortController();
  const thisController=requestController;
  keyInput.value=''; // Never persist the key in the page, query string or storage.
  submit.disabled=true;status.textContent='캐릭터 정보를 조회하고 있어요…';say('search');
  try{
   const id=await apiGet('id',key,{character_name:name},thisController.signal);
   if(!id?.ocid)throw Error('NO_OCID');
   const [basic,stat,union]=await Promise.allSettled([
    apiGet('character/basic',key,{ocid:id.ocid},thisController.signal),
    apiGet('character/stat',key,{ocid:id.ocid},thisController.signal),
    apiGet('user/union',key,{ocid:id.ocid},thisController.signal)
   ]);
   if(basic.status!=='fulfilled')throw basic.reason;
   if(thisController!==requestController||thisController.signal.aborted)return;
   const info=basic.value,img=safePortraitUrl(info?.character_image);
   if(!img)throw Error('NO_PORTRAIT');
   const statInfo=stat.status==='fulfilled'?stat.value:null,unionInfo=union.status==='fulfilled'?union.value:null;
   active={image:img,name:info.character_name||name,world:info.world_name||'월드 확인 불가',job:info.character_class||'직업 확인 불가',level:info.character_level??null,combat:statCombat(statInfo),union:unionInfo?.union_level??null};
   currentPose=0;currentEmotion=0;updateAvatarPose();visitor.hidden=false;
   const palette=cardTheme(active.job);
   for(const surface of [stage,card]){surface.style.setProperty('--cw-accent',palette.accent);surface.style.setProperty('--cw-deep',palette.deep);surface.dataset.classTheme=palette.id;}
   get('cw-visitor-class').textContent=active.job+' · Lv.'+(active.level??'—');
   visitor.classList.remove('cw-tap');get('cw-visitor-label').textContent=active.name;
   stage.dataset.awake='true';
   get('cw-stage-info').textContent=active.name+' · '+active.job;
   say('summon',active.name+' 님, 어서 와! 만나서 반가워!');
   renderProfile();
   status.textContent='실제 캐릭터를 불러왔어요. 전투력과 유니온 정보는 제공된 경우에만 표시해요.';
   if(stat.status==='rejected'||union.status==='rejected')status.textContent+=' 일부 부가 정보는 조회되지 않았어요.';
  }catch(err){if(thisController.signal.aborted)return;status.textContent=userReadableError(err);say('surprised','앗, 소환에 실패했어. 정보를 확인해 줘.');}
  finally{if(thisController===requestController){submit.disabled=false;requestController=null;}}
 });
 function renderProfile(){
  if(!active)return;
  get('cw-card-name').textContent=active.name;
  get('cw-card-world').textContent=active.world;
  get('cw-card-job').textContent=active.job;
  get('cw-card-level').textContent=active.level==null?'확인 불가':Number(active.level).toLocaleString('ko-KR');
  get('cw-card-combat').textContent=formatPower(active.combat);
  get('cw-card-union').textContent=active.union==null?'확인 불가':Number(active.union).toLocaleString('ko-KR');
  profile.hidden=false;card.setAttribute('aria-label',active.name+' '+active.job+' 캐릭터 프로필');
 }
 function cardTilt(event){
  if(reduced.matches)return;
  const rect=card.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
  card.style.setProperty('--ry',(x-.5)*12+'deg');
  card.style.setProperty('--rx',(.5-y)*10+'deg');
  card.style.setProperty('--glow-x',x*100+'%');card.style.setProperty('--glow-y',y*100+'%');
  card.style.setProperty('--shine',String(x));
 }
 function resetTilt(){card.style.setProperty('--ry','0deg');card.style.setProperty('--rx','0deg')}
 card.addEventListener('pointermove',cardTilt);card.addEventListener('pointerleave',resetTilt);card.addEventListener('blur',resetTilt);
 function wrapText(ctx,text,x,y,maxWidth,size){
  ctx.font='700 '+size+'px sans-serif';
  if(ctx.measureText(text).width<=maxWidth){ctx.fillText(text,x,y);return;}
  while(size>13&&ctx.measureText(text).width>maxWidth){size--;ctx.font='700 '+size+'px sans-serif';}
  ctx.fillText(text,x,y);
 }
 async function loadForCanvas(url){
  return new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});
 }
 get('cw-capture').addEventListener('click',async()=>{
  if(!active)return;
  const msg=get('cw-save-status'),canvas=document.createElement('canvas');
  canvas.width=900;canvas.height=1200;
  const ctx=canvas.getContext('2d');
  if(!ctx){msg.textContent='이 브라우저에서는 PNG 저장을 지원하지 않아요.';return;}
  msg.textContent='수집 카드 이미지를 제작하고 있어요…';
  let portraitImage=null;
  try{portraitImage=await loadForCanvas(cardImage.src);}catch{}
  drawCollectibleCard(ctx,active,portraitImage);
  try{
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)throw Error('PNG_ENCODE');
   const blobUrl=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=blobUrl;link.download='MapleTools_'+active.name.replace(/[^\w가-힣-]/g,'_')+'.png';
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(blobUrl),3000);
   msg.textContent=portraitImage?'프로필 카드가 저장됐어요.':'카드를 저장했지만 외부 이미지 정책 때문에 캐릭터 그림은 제외됐어요.';
   say('photograph');
  }catch{msg.textContent='PNG 저장에 실패했어요. 브라우저 다운로드 설정을 확인해 주세요.';}
 });
}
