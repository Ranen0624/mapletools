const rad=d=>d*Math.PI/180;
export const GREETING_DURATION=4.2;
export function greetingAt(age){
 if(age<0||age>3.4)return {elbow:0,wrist:0,head:0,body:0,lift:0};
 const phase=age/3.4,envelope=Math.sin(Math.PI*phase)**2;
 // Two gentle waves, then a still hold. The wrist trails the forearm.
 const elbowWave=Math.sin(phase*Math.PI*4);
 const wristWave=Math.sin(Math.max(0,age-.16)/3.4*Math.PI*4);
 return {elbow:rad(2.2*envelope*elbowWave),wrist:rad(8*envelope*wristWave),head:rad(-.8*envelope),body:rad(-.35*envelope*elbowWave),lift:-1.1*envelope};
}

/**
 * Small, rigid-body reactions for the existing artist-made atlas.
 * Never distort the head, hair or limbs. Full walking/sitting animation
 * requires additional drawn frames and is deliberately not faked here.
 */
export function reactionAt(kind,age){
 const zero={shiftX:0,lift:0,body:0,head:0};
 if(age<0||age>4.2)return zero;
 const envelope=Math.sin(Math.PI*Math.min(age/3.5,1))**2;
 const wave=(f=1)=>Math.sin(age*Math.PI*2*f)*envelope;
 switch(kind){
  case 'hop': return {shiftX:0,lift:-25*Math.sin(Math.PI*Math.min(age/1.2,1))**2,body:rad(2)*wave(.5),head:rad(-2)*wave(.5)};
  case 'dance':return {shiftX:12*wave(.7),lift:-9*Math.abs(wave(1.2)),body:rad(3)*wave(.7),head:rad(-3)*wave(.7)};
  case 'celebrate':return {shiftX:6*wave(1),lift:-19*Math.abs(wave(.85)),body:rad(2)*wave(.65),head:rad(-1)*wave(1.2)};
  case 'nod':return {shiftX:0,lift:0,body:rad(.8)*wave(.6),head:rad(5)*wave(1.1)};
  case 'curious':return {shiftX:6*envelope,lift:0,body:rad(2)*envelope,head:rad(-5)*envelope};
  case 'shy':return {shiftX:-3*envelope,lift:1.5*envelope,body:rad(-2)*envelope,head:rad(4)*envelope};
  case 'surprised':return {shiftX:-12*envelope,lift:-6*envelope,body:rad(-3)*envelope,head:rad(6)*envelope};
  case 'summon':return {shiftX:8*wave(.4),lift:-11*Math.abs(wave(.6)),body:rad(2)*wave(.5),head:rad(-2)*wave(.7)};
  case 'search':return {shiftX:3*wave(.3),lift:0,body:rad(1)*wave(.3),head:rad(3)*wave(.45)};
  case 'photograph':return {shiftX:3*envelope,lift:-3*envelope,body:rad(-1)*envelope,head:rad(-3)*envelope};
  case 'sleep':return {shiftX:0,lift:2*envelope,body:rad(1.2)*envelope,head:rad(5)*envelope};
  case 'land':{
   const impact=Math.max(0,1-Math.abs(age-.65)/.48),settle=Math.sin(Math.PI*Math.min(age/1.9,1))**2;
   return {shiftX:0,lift:-12*Math.sin(Math.PI*Math.min(age/.68,1))**2+2*impact,body:rad(1.4)*settle,head:rad(-2)*settle};
  }
  case 'bow':return {shiftX:4*envelope,lift:3*envelope,body:rad(10)*envelope,head:rad(7)*envelope};
  case 'float':return {shiftX:5*Math.sin(age*1.4)*envelope,lift:-18*envelope-4*Math.sin(age*5)*envelope,body:rad(2.6)*wave(.43),head:rad(-2)*wave(.43)};
  case 'farewell':return {shiftX:-5*envelope,lift:-2*envelope,body:rad(-2.5)*wave(.65),head:rad(2)*envelope};
  // Frequently used human gestures. Safe whole-body translations/rotations only.
  // These do not claim to be additional painted full-body poses.
  case 'wave':return {shiftX:3*Math.sin(age*3.7)*envelope,lift:-3*envelope,body:rad(-2)*wave(.8),head:rad(2.2)*wave(.5)};
  case 'point':return {shiftX:8*envelope,lift:-2*envelope,body:rad(5)*envelope,head:rad(-4)*envelope};
  case 'present':return {shiftX:8*envelope,lift:-7*envelope,body:rad(4)*envelope,head:rad(-3)*envelope};
  case 'listen':return {shiftX:4*envelope,lift:1*envelope,body:rad(2)*envelope,head:rad(7)*envelope};
  case 'think':return {shiftX:-2*envelope,lift:1*envelope,body:rad(-2)*envelope,head:rad(4)*wave(.45)};
  case 'agree':return {shiftX:0,lift:1*envelope,body:rad(1.2)*wave(1),head:rad(7)*wave(1.1)};
  case 'disagree':return {shiftX:0,lift:0,body:rad(-1.5)*envelope,head:rad(9)*wave(1.3)};
  case 'peek':return {shiftX:12*envelope,lift:-3*envelope,body:rad(6)*envelope,head:rad(-7)*envelope};
  case 'proud':return {shiftX:0,lift:-5*envelope,body:rad(-4)*envelope,head:rad(5)*envelope};
  case 'thanks':return {shiftX:3*envelope,lift:3*envelope,body:rad(7)*envelope,head:rad(5)*envelope};
  case 'encourage':return {shiftX:5*wave(.65),lift:-10*Math.abs(wave(.9)),body:rad(3)*wave(.8),head:rad(-4)*wave(.8)};
  case 'relax':return {shiftX:0,lift:4*envelope,body:rad(-3)*envelope,head:rad(4)*envelope};
  case 'welcome':return {shiftX:8*wave(.65),lift:-9*Math.abs(wave(.75)),body:rad(-3)*wave(.7),head:rad(2)*wave(.5)};
  case 'reveal':return {shiftX:5*envelope,lift:-12*envelope,body:rad(3)*wave(.65),head:rad(-4)*envelope};
  case 'ponder':return {shiftX:-3*envelope,lift:1*envelope,body:rad(-2)*wave(.45),head:rad(5)*wave(.3)};
  case 'oh':return {shiftX:-14*envelope,lift:-7*envelope,body:rad(-6)*envelope,head:rad(8)*envelope};
  case 'greet':
  default:return zero;
 }
}

/** Forearm and wrist rotation, sampled separately from the full-body movement.
 * The existing greeting arm is a detached rigid texture, not a mesh warp.
 */
export function gestureAt(kind,age){
 if(!Number.isFinite(age)||age<0||age>4.2)return {elbow:0,wrist:0};
 if(kind==='greet')return {elbow:greetingAt(age).elbow,wrist:greetingAt(age).wrist};
 const e=Math.sin(Math.PI*Math.min(age/3.5,1))**2;
 if(kind==='farewell'){
  return {elbow:rad(3.5)*e*Math.sin(age*5.3),wrist:rad(10)*e*Math.sin(Math.max(0,age-.12)*6.4)};
 }
 if(kind==='celebrate'||kind==='summon'){
  return {elbow:rad(3.1)*e*Math.sin(age*3.2),wrist:rad(7.5)*e*Math.sin(age*4.4)};
 }
 if(['wave','welcome','encourage'].includes(kind))
  return {elbow:rad(6)*e*Math.sin(age*5.8),wrist:rad(12)*e*Math.sin(Math.max(0,age-.14)*7)};
 if(['present','reveal','point'].includes(kind))
  return {elbow:rad(-4.5)*e,wrist:rad(7)*e};
 if(kind==='thanks')return {elbow:rad(-2.5)*e,wrist:rad(5)*e*Math.sin(age*4)};
  if(kind==='photograph')return {elbow:rad(-2)*e,wrist:rad(4)*e};
 return {elbow:0,wrist:0};
}
