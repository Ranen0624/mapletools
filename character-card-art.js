// Collectible-style export, kept independent of UI and network. No simulated stats.
export function cardTheme(job=''){
 const value=String(job);
 if(/비숍|아크메이지|에반|루미너스|라라|일리움|키네시스|배틀메이지|플레임위자드/.test(value))return {id:'magic',accent:'#c8b1ff',deep:'#4b319e'};
 if(/보우마스터|신궁|패스파인더|윈드브레이커|메르세데스|와일드헌터|카인/.test(value))return {id:'archer',accent:'#90f2cd',deep:'#116d73'};
 if(/나이트로드|섀도어|듀얼블레이드|나이트워커|팬텀|카데나|호영|칼리/.test(value))return {id:'thief',accent:'#ffc0e7',deep:'#76256c'};
 if(/바이퍼|캡틴|캐논마스터|스트라이커|은월|메카닉|엔젤릭버스터|아크|제논/.test(value))return {id:'pirate',accent:'#92ccff',deep:'#204b98'};
 return {id:'warrior',accent:'#ffdaa3',deep:'#905c49'};
}
export function prettyPower(value){
 if(value===null||value===undefined||value==='')return '확인 불가';
 const n=Number(String(value).replace(/,/g,''));
 if(!Number.isFinite(n)||n<0)return '확인 불가';
 if(n>=100000000){const units=n/100000000;return (Math.round(units*100)/100).toLocaleString('ko-KR')+'억';}
 if(n>=10000)return (Math.round(n/10000*10)/10).toLocaleString('ko-KR')+'만';
 return Math.round(n).toLocaleString('ko-KR');
}
export function drawCollectibleCard(ctx,info,image=null){
 const w=900,h=1200,theme=cardTheme(info?.job);
 ctx.save();
 const g=ctx.createLinearGradient(0,0,w,h);
 g.addColorStop(0,'#09102a');g.addColorStop(.38,theme.deep);g.addColorStop(1,'#070d23');
 ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 const halo=ctx.createRadialGradient(450,440,35,450,445,520);
 halo.addColorStop(0,theme.accent+'9c');halo.addColorStop(.43,theme.accent+'40');halo.addColorStop(1,'#03081700');
 ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
 // Repeating stars use no external assets and have deterministic positions.
 for(let i=0;i<110;i++){
  const x=(i*187+71)%w,y=(i*331+37)%h;
  ctx.fillStyle=i%5===0?theme.accent:'#e1ebff';
  ctx.globalAlpha=.22+(i%6)*.1;ctx.beginPath();ctx.arc(x,y,i%17===0?3:1.2,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
 ctx.strokeStyle=theme.accent;ctx.lineWidth=4;
 ctx.strokeRect(23,23,w-46,h-46);
 ctx.strokeStyle='#e8e3ff66';ctx.lineWidth=1.5;
 ctx.strokeRect(38,38,w-76,h-76);
 ctx.save();ctx.translate(w/2,432);
 for(const [r,width,alpha] of [[260,3,.45],[310,1.5,.25],[340,1,.2]]){
  ctx.globalAlpha=alpha;ctx.strokeStyle=theme.accent;ctx.lineWidth=width;
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
 }
 ctx.globalAlpha=.48;ctx.rotate(-.24);ctx.beginPath();ctx.ellipse(0,0,350,130,0,0,Math.PI*2);ctx.stroke();ctx.restore();
 ctx.fillStyle='#fff';ctx.font='bold 35px sans-serif';ctx.textAlign='left';
 ctx.fillText('MAPLETOOLS',72,106);
 ctx.font='19px sans-serif';ctx.fillStyle=theme.accent;
 ctx.fillText('CHARACTER · COLLECTOR EDITION',72,143);
 ctx.textAlign='right';ctx.font='bold 42px sans-serif';ctx.fillText('✦',820,110);
 if(image){
  // The official image is a 300px canvas with generous transparent padding.
  // Enlarging the full image preserves every pixel and avoids deforming limbs.
  ctx.drawImage(image,95,130,710,710);
 }else{
  ctx.textAlign='center';ctx.font='20px sans-serif';ctx.fillStyle='#dde4ff';
  ctx.fillText('캐릭터 이미지 미포함 (외부 이미지 정책)',450,530);
 }
 ctx.textAlign='center';ctx.fillStyle=theme.accent;ctx.font='24px sans-serif';
 ctx.fillText(String(info?.world||'WORLD'),450,812);
 const name=String(info?.name||'알 수 없음');
 let size=62;ctx.font='bold '+size+'px sans-serif';
 while(size>22&&ctx.measureText(name).width>760){size-=2;ctx.font='bold '+size+'px sans-serif';}
 ctx.fillStyle='#ffffff';ctx.fillText(name,450,884);
 ctx.fillStyle='#ebdfff';ctx.font='26px sans-serif';ctx.fillText(String(info?.job||''),450,930);
 ctx.strokeStyle='#ffffff55';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(75,971);ctx.lineTo(825,971);ctx.stroke();
 const items=[['LEVEL',info?.level??'—'],['COMBAT',prettyPower(info?.combat)],['UNION',info?.union??'—']];
 items.forEach(([label,value],index)=>{
  const x=80+index*260;
  ctx.textAlign='center';ctx.fillStyle='#c7c6e5';ctx.font='18px sans-serif';ctx.fillText(label,x+110,1022);
  ctx.fillStyle=index===1?theme.accent:'#ffffff';ctx.font='bold 30px sans-serif';
  let s=String(value),font=30;while(font>17&&ctx.measureText(s).width>240){font-=1;ctx.font='bold '+font+'px sans-serif';}
  ctx.fillText(s,x+110,1073);
 });
 ctx.textAlign='center';ctx.fillStyle='#c6cbe7';ctx.font='17px sans-serif';
 ctx.fillText('Data based on NEXON Open API · MapleTools',450,1142);
 ctx.restore();
 return {containsCharacter:Boolean(image),theme:theme.id};
}
