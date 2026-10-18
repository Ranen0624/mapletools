import test from 'node:test';
import assert from 'node:assert/strict';
import {formatPower,safePortraitUrl,statCombat,userReadableError} from '../character-world.js';
import {reactionAt} from '../mate-motion.js';

test('official character image URLs only; never accept third-party or malformed avatar links',()=>{
 const source='https://open.api.nexon.com/static/maplestory/character/look/ABCDEFGHIJKLMNOP?action=A00&emotion=E00';
 const result=safePortraitUrl(source,'A02','E01',2);
 const url=new URL(result);
 assert.equal(url.searchParams.get('action'),'A02.2');
 assert.equal(url.searchParams.get('emotion'),'E01');
 assert.equal(url.searchParams.get('width'),'300');
 assert.equal(safePortraitUrl('https://evil.example/static/maplestory/character/look/test'),null);
 assert.equal(safePortraitUrl('http://open.api.nexon.com/static/maplestory/character/look/x'),null);
 assert.equal(safePortraitUrl('https://open.api.nexon.com/not-an-avatar'),null);
 assert.equal(safePortraitUrl(source,'A99'),null);
 assert.equal(safePortraitUrl(source,'A00','E99'),null);
 assert.equal(safePortraitUrl(null),null);
});
test('no invented power or union values on incomplete responses',()=>{
 assert.equal(formatPower(null),'확인 불가');assert.equal(formatPower(''),'확인 불가');
 assert.equal(formatPower('18,000,000'),'18,000,000');
 assert.equal(formatPower('not available'),'확인 불가');
 assert.equal(statCombat({final_stat:[{stat_name:'전투력',stat_value:'190000000'}]}),'190000000');
 assert.equal(statCombat({final_stat:[{stat_name:'STR',stat_value:'100'}]}),null);
 assert.equal(statCombat({}),null);
});
test('all mascot reactions are bounded and preserve rigid body elements',()=>{
 for(const kind of ['greet','hop','dance','celebrate','nod','curious','shy','surprised','summon','search','photograph','sleep']){
  for(let t=0;t<4;t+=.05){
   const p=reactionAt(kind,t);
   assert(Object.values(p).every(Number.isFinite),kind+' nonfinite');
   assert(Math.abs(p.shiftX)<=26,kind+' horizontal displacement');
   assert(Math.abs(p.lift)<=40,kind+' vertical displacement');
   assert(Math.abs(p.body)<.16,kind+' body rotation');
   assert(Math.abs(p.head)<.16,kind+' head rotation');
  }
  assert.deepEqual(reactionAt(kind,6),{shiftX:0,lift:0,body:0,head:0});
 }
 assert.match(userReadableError(new Error('API HTTP 429')),/한도/);
 assert.match(userReadableError(new Error('API HTTP 403')),/API 키/);
});
