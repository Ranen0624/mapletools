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
  case 'greet':
  default:return zero;
 }
}
