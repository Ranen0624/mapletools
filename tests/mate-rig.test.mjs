import test from 'node:test';
import assert from 'node:assert/strict';
import {mountMateRig,poseAt,sceneAt} from '../mate-rig.js';
import {blinkAt} from '../mate-effects.js';
import {greetingAt,GREETING_DURATION} from '../mate-motion.js';

// Behavioural lifecycle tests. Real raster/visual checks are recorded in QA_NOTES.
test('unavailable Canvas keeps the ordinary accessible illustration',async()=>{
 assert.equal(await mountMateRig({querySelector:()=>({getContext:()=>null})},{}),null);
});
test('pointer tracking rotates the head within a small anatomical range',()=>{
 const right=poseAt(2,1,1),left=poseAt(2,-1,-1);assert(right.head>left.head);
 for(let t=0;t<12;t+=.1){const p=poseAt(t,1,1,1);assert(Object.values(p).every(Number.isFinite));assert(Math.abs(p.head)<.04);}
});
test('2D rig suspends offscreen/hidden/paused, handles touch and releases listeners',async()=>{
 const keys=['window','document','Image','Path2D','MutationObserver','requestAnimationFrame','cancelAnimationFrame'];
 const saved=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const callbacks=new Map(),requests=[],transforms=[];let sequence=0,draws=0,paused=false;
 const noop=()=>{},buffer=()=>({data:new Uint8ClampedArray(512*606*4)}),context=new Proxy({drawImage:()=>draws++,rotate:a=>transforms.push(a),getImageData:buffer,createImageData:buffer,createRadialGradient:()=>({addColorStop:noop}),createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
 const newCanvas=()=>Object.assign(new EventTarget(),{width:0,height:0,getContext:type=>{requests.push(type);return context;}});
 const canvas=newCanvas(),classes=new Set(),figure=new EventTarget();Object.assign(figure,{isConnected:true,dataset:{},querySelector:s=>s==='.mate-canvas'?canvas:{src:s.includes(':not')?'open.webp':'closed.webp'},getBoundingClientRect:()=>({width:295,height:350,left:0,top:0}),classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}});
 const section=Object.assign(new EventTarget(),{dataset:{awake:'false'}}),doc=new EventTarget(),win=new EventTarget(),preference=new EventTarget();
 preference.matches=false;doc.hidden=false;doc.documentElement={classList:{contains:()=>paused}};doc.createElement=newCanvas;win.devicePixelRatio=4;win.matchMedia=()=>preference;
 const flush=now=>{const [id,fn]=callbacks.entries().next().value;callbacks.delete(id);fn(now);};
 const touch=(name)=>{const event=new Event(name);Object.assign(event,{clientX:295,clientY:20,pointerType:'touch'});section.dispatchEvent(event);};
 try{
  Object.assign(globalThis,{window:win,document:doc,Image:class{set src(v){queueMicrotask(()=>this.onload());}},Path2D:class{ellipse(){}},MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>(callbacks.set(++sequence,fn),sequence),cancelAnimationFrame:id=>callbacks.delete(id)});
  const handle=await mountMateRig(figure,section);assert(handle);assert(classes.has('has-rig'));assert.equal(figure.dataset.renderer,'canvas2d');assert.equal(callbacks.size,0);assert.equal(canvas.width,590);assert.equal(canvas.height,698);assert(requests.every(type=>type==='2d'));
  section.dataset.awake='true';handle.sync();assert.equal(callbacks.size,1);flush(1000);const initialDraws=draws;assert(transforms.some(a=>a!==0));
  touch('pointermove');flush(1050);touch('pointercancel');touch('pointerup');flush(1100);assert(draws>initialDraws);
  doc.hidden=true;handle.sync();assert.equal(callbacks.size,0);doc.hidden=false;paused=true;handle.sync();assert.equal(callbacks.size,0);
  paused=false;preference.matches=true;handle.sync();assert.equal(callbacks.size,0);preference.matches=false;handle.sync();assert.equal(callbacks.size,1);
  const hide=new Event('pagehide');hide.persisted=true;win.dispatchEvent(hide);assert.equal(callbacks.size,0);win.dispatchEvent(new Event('pageshow'));assert.equal(callbacks.size,1);
  handle.dispose();assert.equal(callbacks.size,0);assert(!classes.has('has-rig'));assert.equal(figure.dataset.renderer,undefined);const before=draws;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(draws,before);handle.dispose();
 }finally{for(const [key,descriptor]of Object.entries(saved))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
});

test('blink timing includes closed eyes, reopening and a double blink',()=>{
 assert.equal(blinkAt(0),0);assert.equal(blinkAt(1.91),1);assert(blinkAt(2)>0&&blinkAt(2)<1);assert.equal(blinkAt(2.1),0);assert.equal(blinkAt(5.84),1);
 assert.equal(sceneAt(10,0,false,0),3);assert.equal(sceneAt(10,0,true,0),1);assert.equal(sceneAt(10,0,true,.5),2);assert.equal(sceneAt(19,18,false,0),0);
});
test('greeting is bounded, settles and leaves a pause instead of endlessly waving',()=>{
 const resting={elbow:0,wrist:0,head:0,body:0,lift:0};
 assert.deepEqual(greetingAt(-1),resting);assert.deepEqual(greetingAt(3.5),resting);assert.deepEqual(greetingAt(GREETING_DURATION),resting);assert.deepEqual(greetingAt(20),resting);
 let peak=0;for(let age=0;age<=3.4;age+=.01){const p=greetingAt(age);assert(Object.values(p).every(Number.isFinite));assert(Math.abs(p.elbow)<.04);assert(Math.abs(p.wrist)<.14);peak=Math.max(peak,Math.abs(p.wrist));}assert(peak>.07);
 // Elbow crosses neutral first; delayed wrist continues its follow-through.
 const middle=greetingAt(1.7);assert(Math.abs(middle.elbow)<1e-8);assert(Math.abs(middle.wrist)>.02);
});
