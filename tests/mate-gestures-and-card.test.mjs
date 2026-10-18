import test from 'node:test';
import assert from 'node:assert/strict';
import {MASCOT_BEHAVIORS,MASCOT_MOODS,DEFAULT_AMBIENT_BEHAVIORS,mascotPoseFor} from '../mate-behaviors.js';
import {reactionAt,gestureAt} from '../mate-motion.js';
import {cardTheme,prettyPower,drawCollectibleCard} from '../character-card-art.js';

test('all sixteen everyday behaviors use approved source poses only',()=>{
 assert.equal(MASCOT_BEHAVIORS.length,16);
 assert.equal(new Set(MASCOT_BEHAVIORS.map(x=>x.id)).size,16);
 const poses=new Set(['idle','hover','greet','read']);
 for(const action of MASCOT_BEHAVIORS){
  assert(poses.has(action.pose),action.id);
  assert(MASCOT_MOODS[action.mood],action.id);
  assert.equal(mascotPoseFor(action.id),action.pose);
  assert(action.label&&action.icon&&action.spoken);
 }
 assert(DEFAULT_AMBIENT_BEHAVIORS.length>5);
 assert(DEFAULT_AMBIENT_BEHAVIORS.every(id=>MASCOT_BEHAVIORS.some(x=>x.id===id)));
});
test('gesture curves remain finite and bounded without shearing original images',()=>{
 for(const action of MASCOT_BEHAVIORS){
  let peak=0;
  for(let time=0;time<=4.25;time+=.04){
   const a=reactionAt(action.id,time),g=gestureAt(action.id,time);
   for(const v of Object.values({...a,...g}))assert(Number.isFinite(v),action.id);
   assert(Math.abs(a.shiftX)<=35,action.id);
   assert(Math.abs(a.lift)<=35,action.id);
   assert(Math.abs(a.body)<.2,action.id);
   assert(Math.abs(a.head)<.2,action.id);
   assert(Math.abs(g.elbow)<.25,action.id);
   assert(Math.abs(g.wrist)<.25,action.id);
   peak=Math.max(peak,Math.abs(a.shiftX),Math.abs(a.lift),Math.abs(a.head),Math.abs(g.wrist));
  }
  assert(peak>.001,'missing motion '+action.id);
 }
});
test('collectible styling is deterministic, matches classes and never invents stats',()=>{
 assert.equal(cardTheme('아델').id,'warrior');
 assert.equal(cardTheme('비숍').id,'magic');
 assert.equal(cardTheme('보우마스터').id,'archer');
 assert.equal(cardTheme('듀얼블레이드').id,'thief');
 assert.equal(cardTheme('바이퍼').id,'pirate');
 assert.equal(prettyPower(null),'확인 불가');
 assert.equal(prettyPower('not available'),'확인 불가');
 assert.equal(prettyPower(242852148),'2.43억');
 let drew=0;
 const noop=()=>{},grad={addColorStop:noop};
 const fake=new Proxy({createLinearGradient:()=>grad,createRadialGradient:()=>grad,measureText:s=>({width:String(s).length*24}),drawImage:()=>drew++},{get:(o,p)=>p in o?o[p]:noop,set:(o,p,v)=>(o[p]=v,true)});
 assert.equal(drawCollectibleCard(fake,{name:'테스트',job:'아델',level:291,world:'루나',combat:null,union:null}).containsCharacter,false);
 assert.equal(drawCollectibleCard(fake,{name:'테스트',job:'비숍',level:291,world:'루나',combat:243000000,union:10000},{}).theme,'magic');
 assert.equal(drew,1);
});
