import test from 'node:test';
import assert from 'node:assert/strict';
import {MATE_ANIMATIONS,MATE_ANIMATION_TARGET,availableAnimations,pendingArtwork,animationStatus} from '../mate-animation-catalog.js';
import {reactionAt,gestureAt} from '../mate-motion.js';

test('34 advertised actions are uniquely identified and honestly staged',()=>{
 assert.equal(MATE_ANIMATION_TARGET,34);
 assert.equal(new Set(MATE_ANIMATIONS.map(x=>x.id)).size,34);
 assert.deepEqual(
  ['life','movement','emotion','special'].map(group=>MATE_ANIMATIONS.filter(x=>x.group===group).length),
  [10,8,8,8]
 );
 assert.equal(availableAnimations().length+pendingArtwork().length,34);
 for(const x of MATE_ANIMATIONS){
  assert.ok(x.label&&x.notes);
  assert.ok(['ready','needs-art'].includes(x.status));
 }
 for(const id of ['walk','run','sit','stand','stretch','hair-sway','high-five','wink','approach']){
  assert.equal(animationStatus(id),'needs-art',id+' needs original animation artwork');
 }
 for(const id of ['hop','land','bow','float','farewell']){
  assert.equal(animationStatus(id),'ready');
 }
});
test('phase-one full-body effects and independently rotated joints stay within anatomical bounds',()=>{
 for(const id of ['land','bow','float','farewell']){
  let max=0;
  for(let time=0;time<=4.25;time+=.01){
   const p=reactionAt(id,time);
   const g=gestureAt(id,time);
   assert(Object.values({...p,...g}).every(Number.isFinite));
   assert(Math.abs(p.shiftX)<=30,id+' horizontal');
   assert(Math.abs(p.lift)<=35,id+' height');
   assert(Math.abs(p.body)<=Math.PI/14,id+' body');
   assert(Math.abs(p.head)<=Math.PI/14,id+' head');
   assert(Math.abs(g.elbow)<=Math.PI/12,id+' elbow');
   assert(Math.abs(g.wrist)<=Math.PI/12,id+' wrist');
   max=Math.max(max,Math.abs(p.shiftX),Math.abs(p.lift),Math.abs(p.body),Math.abs(p.head),Math.abs(g.wrist));
  }
  assert.ok(max>0,id+' should be visibly animated');
  assert.deepEqual(reactionAt(id,4.5),{shiftX:0,lift:0,body:0,head:0});
  assert.deepEqual(gestureAt(id,4.5),{elbow:0,wrist:0});
 }
});
