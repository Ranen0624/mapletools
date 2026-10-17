const TAU=Math.PI*2;
export function blinkAt(time){
 const cycle=time%7.9;
 // A brief blink, then an occasional double blink; no regular metronome.
 for(const start of [1.8,5.35,5.73]){
  const t=cycle-start;
  if(t>=0&&t<.09)return t/.09;
  if(t>=.09&&t<.14)return 1;
  if(t>=.14&&t<.27)return 1-(t-.14)/.13;
 }
 return 0;
}
function star(ctx,x,y,size,angle=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();
 for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?size*.24:size;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
 ctx.closePath();ctx.fill();ctx.restore();
}
function heart(ctx,x,y,size,angle){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size,size);ctx.beginPath();ctx.moveTo(0,.5);ctx.bezierCurveTo(-1.7,-.5,-.8,-1.8,0,-.9);ctx.bezierCurveTo(.8,-1.8,1.7,-.5,0,.5);ctx.fill();ctx.stroke();ctx.restore();
}
export function drawEffects(ctx,time,state,reaction=0){
 ctx.save();
 // The orbit and core have independent periods, so the orb never looks frozen.
 if(state!==3){
  const [ox,oy]=state===1?[408,292]:state===2?[412,270]:[422,272];
  const pulse=(Math.sin(time*2.7)+1)/2,glow=ctx.createRadialGradient(ox,oy,2,ox,oy,62);
  glow.addColorStop(0,`rgba(228,252,255,${.18+pulse*.28+reaction*.15})`);glow.addColorStop(.45,`rgba(129,170,255,${.12+pulse*.14})`);glow.addColorStop(1,'rgba(131,95,255,0)');
  ctx.globalCompositeOperation='screen';ctx.fillStyle=glow;ctx.fillRect(ox-64,oy-64,128,128);
  ctx.strokeStyle=`rgba(194,225,255,${.25+pulse*.25})`;ctx.lineWidth=1;
  ctx.save();ctx.translate(ox,oy);ctx.rotate(time*.6);ctx.beginPath();ctx.ellipse(0,0,48,18,.35,0,TAU);ctx.stroke();ctx.restore();
  ctx.fillStyle='#e5fdff';ctx.shadowColor='#99aaff';ctx.shadowBlur=9;
  for(let i=0;i<7;i++){const a=time*(.7+i*.025)+i*TAU/7,r=36+10*Math.sin(time*.8+i);ctx.globalAlpha=.3+.7*(.5+.5*Math.sin(time*3+i));star(ctx,ox+Math.cos(a)*r,oy+Math.sin(a)*r*.72,2.2+1.6*Math.sin(time+i)**2,a);}
  ctx.globalAlpha=1;star(ctx,ox,oy,5+pulse*4,time*.3);ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
 }
 if(state===1){
  ctx.save();ctx.translate(456+Math.sin(time*1.8)*5,152+Math.sin(time*2.5)*8);ctx.rotate(Math.sin(time*1.7)*.14);const scale=1+.07*Math.sin(time*3);ctx.scale(scale,scale);
  ctx.font='bold 57px Georgia, serif';ctx.textAlign='center';ctx.strokeStyle='#9a88f1';ctx.lineWidth=5;ctx.fillStyle='#eef4ff';ctx.shadowColor='#9b8cff';ctx.shadowBlur=17;ctx.strokeText('?',0,0);ctx.fillText('?',0,0);ctx.restore();
  ctx.fillStyle='#c0bbff';star(ctx,453+Math.sin(time)*7,185+Math.sin(time*2.2)*5,5,time);
 }
 if(state===2){
  for(let i=0;i<5;i++){
   const age=(time*.55+i*.21)%1,x=94+Math.sin(age*3+i)*20+(i%2)*40,y=265-age*145;
   ctx.globalAlpha=Math.sin(age*Math.PI)*.9;ctx.fillStyle=i%2?'#ff9ad9':'#ff6fc0';ctx.strokeStyle='#ffe9ff';ctx.lineWidth=.12;ctx.shadowColor='#ff8ada';ctx.shadowBlur=11;heart(ctx,x,y,9+6*Math.sin(age*Math.PI),Math.sin(age*4+i)*.25);
  }
  ctx.globalAlpha=1;ctx.shadowBlur=0;
 }
 if(state===3){
  // The spine stays fixed; a lit page lifts from right, curls, and settles left.
  const phase=(time%4.6)/4.6;
  if(phase>.47&&phase<.84){
   const t=(phase-.47)/.37,spineX=310,spineY=319,tipX=spineX+68*Math.cos(t*Math.PI),lift=Math.sin(t*Math.PI)*43;
   ctx.save();ctx.beginPath();ctx.moveTo(spineX,spineY);ctx.bezierCurveTo(spineX+18,spineY-lift,tipX,spineY-24-lift,tipX,spineY-23);ctx.lineTo(tipX,spineY-9);ctx.quadraticCurveTo((spineX+tipX)/2,spineY-lift*.3,spineX,spineY+9);ctx.closePath();
   const paper=ctx.createLinearGradient(Math.min(spineX,tipX)-1,0,Math.max(spineX,tipX)+1,0);paper.addColorStop(0,'#b69770');paper.addColorStop(.45,'#fff1cb');paper.addColorStop(1,'#dcc397');ctx.fillStyle=paper;ctx.fill();ctx.strokeStyle='#d7b577';ctx.lineWidth=1;ctx.stroke();ctx.restore();
  }
  ctx.fillStyle='#e8c990';
  for(let i=0;i<3;i++){const age=(time*.18+i*.33)%1;ctx.globalAlpha=Math.sin(age*Math.PI)*.65;star(ctx,290+Math.sin(time*.7+i)*45,309-age*52,2.5,time*.3+i);}
 }
 ctx.restore();
}
