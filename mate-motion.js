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
