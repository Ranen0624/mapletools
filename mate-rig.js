import {WIDTH,HEIGHT,POSES,CROPS,HEAD_PLACEMENT,HEAD_EYES,NECKS,HAND_PATH,ARM_PATH,WRIST,ELBOW,framePoint} from './mate-parts.js';
import {blinkAt,drawEffects} from './mate-effects.js';
import {greetingAt,GREETING_DURATION,reactionAt,gestureAt} from './mate-motion.js';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const rad=degrees=>degrees*Math.PI/180;
export function poseAt(time,x=0,y=0,reaction=0){
 return {bodyY:-1.2*Math.sin(time*1.45),body:rad(.2*Math.sin(time*1.1)),head:rad(x*1.2+y*.3+.55*Math.sin(time*.85)),reaction,time,blink:blinkAt(time)};
}
export function sceneAt(time,lastInteraction,hovered,reaction){
 if(reaction>0)return POSES.greet;
 if(hovered)return POSES.hover;
 const rest=time-lastInteraction;
 return rest>8&&rest%18>8?POSES.read:POSES.idle;
}
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Mate asset unavailable'));im.src=src;});}
function surface(){const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;return canvas;}
function drawJoint(ctx,pivot,angle,draw){
 ctx.save();ctx.translate(...pivot);ctx.rotate(angle);ctx.translate(-pivot[0],-pivot[1]);draw();ctx.restore();
}
export function createMatePainter(open,closed,atlas,layers={}){
 const bodies=[],heads=[],full=[];
 const {body:bodyAtlas,head:headAtlas,headBlink}=layers;
 for(let state=0;state<4;state++){
  const [sx,sy,sw,sh]=CROPS[state],base=surface(),baseCtx=base.getContext('2d');
  baseCtx.drawImage(atlas||open,...(atlas?CROPS[state]:[0,0,WIDTH,HEIGHT]),24,24,464,550);full.push(base);
  const body=surface(),bodyCtx=body.getContext('2d');bodyCtx.drawImage(bodyAtlas||atlas||open,...(bodyAtlas||atlas?CROPS[state]:[0,0,WIDTH,HEIGHT]),24,24,464,550);bodies.push(body);
  heads[state]=[];
  for(let blink=0;blink<2;blink++){
   const layer=surface(),ctx=layer.getContext('2d'),[scale,dx,dy]=HEAD_PLACEMENT[state];
   if(headAtlas){
    ctx.translate(24,24);ctx.scale(464/sw,550/sh);ctx.translate(dx,dy);ctx.scale(scale,scale);
    ctx.drawImage(headAtlas[state],-sx,-sy);
    if(blink&&headBlink){ctx.save();ctx.beginPath();for(const [x,y,rx,ry]of HEAD_EYES[state])ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.clip();ctx.drawImage(headBlink[state],-sx,-sy);ctx.restore();}
   }
   heads[state].push(layer);
  }
 }
 function skin(path){
  const layer=surface(),ctx=layer.getContext('2d');ctx.translate(24,24);ctx.scale(464/590,550/682);ctx.translate(0,-662);ctx.clip(new Path2D(path));ctx.drawImage(atlas,0,0);return layer;
 }
 const hand=atlas?skin(HAND_PATH):null,arm=atlas?skin(ARM_PATH):null,wrist=framePoint(2,...WRIST),elbow=framePoint(2,...ELBOW);
 return (ctx,p,state=0,still=false)=>{
  const age=p.actionAge??((p.time||0)%8),greeting=state===2&&!still&&p.actionKind==='greet'?greetingAt(age):greetingAt(-1);
  ctx.save();ctx.translate(256+(still?0:(p.shiftX||0)),510+(still?0:(p.bodyY||0)+greeting.lift));ctx.rotate(still?0:(p.body||0)+greeting.body);ctx.translate(-256,-510);
  if(!bodyAtlas||!headAtlas){ctx.drawImage(full[state],0,0);ctx.restore();return;}
  ctx.drawImage(bodies[state],0,0);
  const [cx,cy,sw,sh]=CROPS[state],neck=[24+NECKS[state][0]*464/sw,24+NECKS[state][1]*550/sh];
  const t=p.time||0,phase=t%8,tilt=phase>2&&phase<5?Math.sin((phase-2)/3*Math.PI):0;
  const angle=still?0:(p.head||0)+greeting.head+(state===1?rad(2)*tilt:0);
  // Entire head + hat is a rigid layer: no vertex warping, stretching or blur.
  drawJoint(ctx,neck,angle,()=>ctx.drawImage(heads[state][!still&&p.blink>.5?1:0],0,0));
  // Hovering finger and the book must stay in front of the head's lower curls.
  if(state===1){ctx.save();ctx.beginPath();ctx.moveTo(273,319);ctx.lineTo(292,267);ctx.lineTo(313,256);ctx.lineTo(319,272);ctx.lineTo(304,318);ctx.closePath();ctx.clip();ctx.drawImage(bodies[state],0,0);ctx.restore();}
  if(state===3){ctx.save();ctx.beginPath();ctx.rect(231,310,160,100);ctx.clip();ctx.drawImage(bodies[state],0,0);ctx.restore();}
  if(state===2&&hand){
   const elbowAngle=p.actionKind==='greet'?greeting.elbow:(p.gesture?.elbow||0),wristAngle=p.actionKind==='greet'?greeting.wrist:(p.gesture?.wrist||0);
   drawJoint(ctx,elbow,elbowAngle,()=>{ctx.drawImage(arm,0,0);drawJoint(ctx,wrist,wristAngle,()=>ctx.drawImage(hand,0,0));});
  }
  if(!still)drawEffects(ctx,t,state,p.reaction||0);ctx.restore();
 };
}

export async function mountMateRig(figure,section){
 const canvas=figure.querySelector('.mate-canvas');if(!canvas)return null;
 let ctx;try{ctx=canvas.getContext('2d',{alpha:true});}catch{return null;}if(!ctx)return null;
 let disposed=false,active=false,frame=0,lastFrame=0,time=0,actionTime=-100,lastInteraction=0,kind='greet',hovered=false;
 let x=0,y=0,targetX=0,targetY=0,drag=null,offsetX=0,offsetY=0,suppressClickUntil=0;
 const cleanups=[],on=(target,name,fn,options)=>{target.addEventListener(name,fn,options);cleanups.push(()=>target.removeEventListener(name,fn,options));};
 const cancel=()=>{cancelAnimationFrame(frame);frame=0;lastFrame=0;};
 const releaseDrag=()=>{if(drag&&figure.hasPointerCapture?.(drag.id))figure.releasePointerCapture(drag.id);drag=null;figure.classList.remove('is-dragging');};
 const resetPosition=()=>{releaseDrag();offsetX=offsetY=0;if(figure.style)figure.style.translate='';};
 const dispose=()=>{if(disposed)return;disposed=true;cancel();resetPosition();cleanups.splice(0).forEach(fn=>fn());figure.classList.remove('has-rig');delete figure.dataset.renderer;delete figure.dataset.pose;};
 try{
  const original=figure.querySelector('.mate-body img:not(.mate-blink)');
  const asset=name=>loadImage(new URL('./assets/'+name,import.meta.url).href);
  const [open,atlas,body,head,headBlink]=await Promise.all([loadImage(original.src),asset('data-mate-poses.webp'),asset('data-mate-body-repair.webp'),Promise.all([0,1,2,3].map(i=>asset('data-mate-head-'+i+'.webp'))),Promise.all([0,1,2,3].map(i=>asset('data-mate-head-'+i+'-blink.webp')))]);
  if(disposed||!figure.isConnected)return null;
  const draw=createMatePainter(open,null,atlas,{body,head,headBlink}),preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  function size(){const width=Math.max(1,Math.round(figure.getBoundingClientRect().width*Math.min(window.devicePixelRatio||1,2)));const height=Math.round(width*HEIGHT/WIDTH);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}}
  function paint(still=false){
   size();ctx.setTransform(canvas.width/WIDTH,0,0,canvas.height/HEIGHT,0,0);ctx.clearRect(0,0,WIDTH,HEIGHT);
   const elapsed=time-actionTime,reaction=elapsed>=0&&elapsed<GREETING_DURATION?Math.sin(elapsed/GREETING_DURATION*Math.PI)**2:0;
   const state=still?POSES.idle:reaction>0&&['sleep','search'].includes(kind)?POSES.read:reaction>0&&['curious','surprised'].includes(kind)?POSES.hover:sceneAt(time,lastInteraction,hovered,reaction);
   figure.dataset.pose=Object.keys(POSES)[state];
   const motion=still?reactionAt('none',-1):reactionAt(kind,elapsed);
   const base=poseAt(time,x,y,reaction);
   draw(ctx,still?{}:{...base,shiftX:motion.shiftX,bodyY:base.bodyY+motion.lift,body:base.body+motion.body,head:base.head+motion.head,actionAge:elapsed,actionKind:kind,gesture:gestureAt(kind,elapsed)},state,still);
  }
  function tick(now){
   frame=0;if(!active||disposed)return;
   if(!lastFrame||now-lastFrame>=1000/30){
    const dt=lastFrame?Math.min((now-lastFrame)/1000,.05):1/30;lastFrame=now;time+=dt;
    const easing=1-Math.exp(-dt*7);x+=(targetX-x)*easing;y+=(targetY-y)*easing;
    paint();
   }
   frame=requestAnimationFrame(tick);
  }
  function sync(){
   active=!disposed&&!document.hidden&&section.dataset.awake==='true'&&!document.documentElement.classList.contains('motion-paused')&&!preference.matches;
   if(active){if(!frame)frame=requestAnimationFrame(tick);}else{cancel();resetPosition();hovered=false;targetX=targetY=x=y=0;actionTime=-100;lastInteraction=time;paint(true);}
  }
  function point(event){if(!active)return;const rect=figure.getBoundingClientRect();if(!rect.width||!rect.height)return;targetX=clamp((event.clientX-rect.left)/rect.width*2-1,-1,1);targetY=clamp((event.clientY-rect.top)/rect.height*2-1,-1,1);lastInteraction=time;
   if(drag&&event.pointerId===drag.id){
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.moved ||= Math.hypot(dx,dy)>5;
    if(drag.moved){offsetX=clamp(drag.ox+dx,drag.minX,drag.maxX);offsetY=clamp(drag.oy+dy,-18,18);figure.style.translate=`${offsetX}px ${offsetY}px`;figure.classList.add('is-dragging');}
   }
  }
  const reset=()=>{if(!drag){targetX=targetY=0;hovered=false;}};
  on(section,'pointermove',point,{passive:true});on(section,'pointerleave',reset);
  on(figure,'pointerenter',()=>{if(active){hovered=true;lastInteraction=time;}});
  on(figure,'pointerleave',reset);on(figure,'focus',()=>{if(active){hovered=true;lastInteraction=time;}});on(figure,'blur',reset);
  on(figure,'pointerdown',event=>{if(!active||event.button!==0)return;point(event);const r=figure.getBoundingClientRect(),stage=figure.parentElement.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,ox:offsetX,oy:offsetY,minX:Math.min(0,stage.left-r.left+offsetX+8),maxX:Math.max(0,stage.right-r.right+offsetX-8),moved:false};figure.setPointerCapture?.(event.pointerId);});
  on(figure,'pointerup',event=>{if(drag?.moved)suppressClickUntil=event.timeStamp+400;releaseDrag();if(event.pointerType==='touch')reset();});
  on(figure,'pointercancel',()=>{releaseDrag();reset();});on(figure,'lostpointercapture',()=>{releaseDrag();reset();});
  on(figure,'click',event=>{if(event.timeStamp<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
  on(figure,'keydown',event=>{if(event.key==='Escape')resetPosition();});
  on(figure,'mate-react',event=>{if(!active)return;kind=event.detail?.kind||'greet';actionTime=time;lastInteraction=time;});
  const observer=new MutationObserver(sync);observer.observe(section,{attributes:true,attributeFilter:['data-awake']});observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});cleanups.push(()=>observer.disconnect());
  on(document,'visibilitychange',sync);on(window,'resize',()=>{resetPosition();if(!active)paint(true);},{passive:true});
  if(preference.addEventListener)on(preference,'change',sync);
  on(window,'pagehide',event=>{if(event.persisted){active=false;cancel();resetPosition();}else dispose();});on(window,'pageshow',sync);
  on(canvas,'contextlost',event=>{event.preventDefault();dispose();});
  paint(true);figure.classList.add('has-rig');figure.dataset.renderer='canvas2d';sync();return {dispose,sync};
 }catch{dispose();return null;}
}
if(typeof document!=='undefined'){
 const figure=document.getElementById('data-mate'),section=document.getElementById('data-playground');
 if(figure&&section){if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();mountMateRig(figure,section);}},{rootMargin:'160px'});observer.observe(section);}else mountMateRig(figure,section);}
}
