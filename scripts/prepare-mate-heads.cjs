// Package the four detached heads without rectangular cuts through their hats.
// Input artwork is generated; this script only separates connected alpha masks.
const sharp=require(process.env.MATE_SHARP||'sharp');
(async()=>{
 const {data,info}=await sharp('assets/data-mate-heads.webp').raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height,n=w*h,labels=new Int16Array(n),queue=new Int32Array(n),components=[];
 let label=0;
 for(let p=0;p<n;p++){
  if(labels[p]||data[p*4+3]<100)continue;label++;let lo=0,hi=1;queue[0]=p;labels[p]=label;
  while(lo<hi){const k=queue[lo++],x=k%w,y=Math.floor(k/w);for(const q of [x?k-1:-1,x<w-1?k+1:-1,y?k-w:-1,y<h-1?k+w:-1])if(q>=0&&!labels[q]&&data[q*4+3]>=100){labels[q]=label;queue[hi++]=q;}}
  if(hi>100000)components.push({label,seed:p,count:hi});
 }
 components.sort((a,b)=>Math.floor(a.seed/w/600)-Math.floor(b.seed/w/600)||(a.seed%w)-(b.seed%w));
 const map=new Map(components.map((c,i)=>[c.label,i+1]));let lo=0,hi=0;
 for(let p=0;p<n;p++){labels[p]=map.get(labels[p])||0;if(labels[p])queue[hi++]=p;}
 while(lo<hi){const p=queue[lo++],x=p%w,y=Math.floor(p/w);for(const q of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(q>=0&&!labels[q]&&data[q*4+3]){labels[q]=labels[p];queue[hi++]=q;}}
 const blink=await sharp('assets/data-mate-heads-blink.webp').raw().toBuffer();
 for(let part=1;part<=4;part++)for(const [suffix,source]of [['',data],['-blink',blink]]){
  const output=Buffer.alloc(source.length);for(let p=0;p<n;p++)if(labels[p]===part)source.copy(output,p*4,p*4,p*4+4);
  await sharp(output,{raw:{width:w,height:h,channels:4}}).webp({lossless:true}).toFile(`assets/data-mate-head-${part-1}${suffix}.webp`);
 }
 console.log('Separated four intact heads and their blink variants.');
})();
