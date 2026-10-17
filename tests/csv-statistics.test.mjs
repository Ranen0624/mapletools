import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,analyzeCSV} from '../csv-statistics.js';
test('PC equipment exports deduplicate by world and name while preserving different worlds',()=>{
 const r=analyzeCSV('\uFEFF닉네임,월드,레벨,직업,장비명\r\n별빛,루나,285,아델,검\r\n별빛,루나,285,아델,모자\r\n별빛,스카니아,275,비숍,완드\r\n달빛,루나,290,아델,검');
 assert.equal(r.total,3);assert.equal(r.duplicates,1);assert.deepEqual(r.job,[['아델',2],['비숍',1]]);assert.deepEqual(r.level,[['270–279레벨',1],['280–289레벨',1],['290–299레벨',1]]);
});
test('union candidate exports and absent level columns are supported',()=>{
 assert.equal(analyzeCSV('일치,본캐 후보,월드,본캐 직업,본캐 레벨,랭킹,매칭 상세\n2/2,별빛,루나,아델,285,1,조합').total,1);
 assert.equal(analyzeCSV('name,world,job\nAlice,Luna,Adele').unknownLevels,1);
});
test('quoted commas, multiline values and escaped quotes are parsed',()=>{
 assert.deepEqual(parseCSV('a,b\r\n"hello, world","a""b\nc"'),[['a','b'],['hello, world','a"b\nc']]);
});
test('invalid rows are counted and conflicting duplicates use the first row',()=>{
 const r=analyzeCSV('닉네임,월드,직업,레벨\n별빛,루나,아델,285\n별빛,루나,비숍,284\n,루나,아델,280\n달빛,루나,아델,abc\n다섯,열,너무,많이,있음');
 assert.equal(r.total,2);assert.equal(r.skipped,2);assert.equal(r.conflicts,1);assert.equal(r.unknownLevels,1);assert.deepEqual(r.job,[['아델',2]]);
});
test('malformed CSV, empty input and aggregate statistics files give useful errors',()=>{
 for(const text of ['a,b\n"unclosed','a,b\n"a"x,b','a,b\na"b,c'])assert.throws(()=>parseCSV(text),/따옴표/);
 assert.throws(()=>analyzeCSV(''),/전체 결과 CSV/);
 assert.throws(()=>analyzeCSV('레벨,세부 직업,인원\n280,아델,8'),/전체 결과 CSV/);
 assert.throws(()=>analyzeCSV('닉네임,월드,직업\n,,아델'),/집계할 수/);
});
test('large input is capped and unusual labels stay data',()=>{
 assert.throws(()=>parseCSV('x'.repeat(5*1024*1024+1)),/5MB/);
 assert.throws(()=>parseCSV('a\n'.repeat(50002)),/50,000/);
 const r=analyzeCSV('닉네임,월드,직업\na,루나,__proto__\nb,루나,<img onerror=alert(1)>');
 assert.equal(r.total,2);assert.equal(r.job.length,2);
});
test('worker executes UTF-8 and CP949 imports without returning identifiers',async()=>{
 const {Worker}=await import('node:worker_threads');
 const url=new URL('../csv-worker.js',import.meta.url).href;
 for(const bytes of [Buffer.from('닉네임,월드,직업,레벨\n별빛,루나,아델,285'),Buffer.from('tNCz18DTLL/5teUswfe+9yy3ubqnCrqwuvsst+ezqiy+xrWoLDI4NQ==','base64')]){
  const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:data=>parentPort.postMessage(data)};import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage('ready');});`,{eval:true});
  try{
   const value=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('worker timeout')),5000);
    worker.on('error',error=>{clearTimeout(timer);reject(error);});
    worker.on('message',data=>{if(data==='ready'){const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);worker.postMessage(buffer,[buffer]);}else{clearTimeout(timer);resolve(data);}});
   });
   assert.equal(value.result.total,1);assert.deepEqual(value.result.job,[['아델',1]]);assert(!JSON.stringify(value).includes('별빛'));
  }finally{await worker.terminate();}
 }
});
