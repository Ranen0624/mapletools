import assert from 'node:assert/strict';
import {EQUIPMENT,parseNumber,searchEquipment,searchUnion,statistics,csv,matchOptions} from '../demo-engine.js';
let count=0;const test=(label,fn)=>{fn();count++;console.log('PASS '+label);};
const defaults={includePresets:true};
test('Korean decimal units and comma input',()=>{assert.equal(parseNumber('1.8억'),180000000);assert.equal(parseNumber('1억 8000만'),180000000);assert.equal(parseNumber('340,000,000'),340000000);assert.equal(parseNumber('0'),0);assert.equal(parseNumber(''),null);});
test('Reject invalid, negative and unsafe numbers',()=>{for(const v of ['NaN','Infinity','-1','0.1','1억x','99999999999999999999'])assert.throws(()=>parseNumber(v),v);});
test('Combined character, equipment and growth filters',()=>{const rows=searchEquipment({...defaults,job:'아델',item:'튜너',ranges:{level:[290,300],combat:[180000000,null],authentic:[500,null]}});assert.deepEqual(rows.map(r=>r.id),[1,3]);});
test('Preset inclusion changes results',()=>{assert.equal(searchEquipment({...defaults,item:'튜너'}).length,2);assert.equal(searchEquipment({includePresets:false,item:'튜너'}).length,1);});
test('Exact name and multiple names',()=>{assert.deepEqual(searchEquipment({...defaults,item:'제네시스 튜너,데스티니 대거',exact:true}).map(r=>r.id),[1,5]);});
test('Explicit zero starforce is not unrestricted',()=>{assert.equal(searchEquipment({...defaults,stars:0}).length,0);});
test('Reversed range is rejected',()=>{assert.throws(()=>searchEquipment({...defaults,ranges:{combat:[300000000,100000000]}}));});
test('Potential, additional, flame, scroll and scissors match together',()=>{assert.deepEqual(searchEquipment({...defaults,potential:{family:'STR',unit:'%',value:12},additional:{family:'공격력',unit:'%',value:12},flame:{family:'STR',value:150},scroll:81,scissors:5,job:'아델',ranges:{level:[291,291]}}).map(r=>r.id),[1,2]);});
test('Growth, social and HEXA conditions apply',()=>{assert.deepEqual(searchEquipment({...defaults,guild:'달빛길드',year:2018,hexaLevel:20,scissors:3,ranges:{union:[9000,9000],fragments:[9000,9000]}}).map(r=>r.id),[3]);});
test('Unknown filters do not invent matches',()=>{assert.deepEqual(searchEquipment({...defaults,job:'없는직업'}),[]);});
const req=[{job:'아델',level:291},{job:'비숍',level:280},{job:'나이트로드',level:275}];
test('Perfect union and partial union differ',()=>{assert.deepEqual(searchUnion(req).map(r=>[r.name,r.score]),[['별빛아델',3]]);assert.deepEqual(searchUnion(req,{perfect:false}).map(r=>[r.name,r.score]),[['별빛아델',3],['반짝조합',2]]);});
test('A member cannot satisfy duplicate conditions twice',()=>{assert.deepEqual(searchUnion([{job:'아델',level:291},{job:'비숍',level:280},{job:'비숍',level:280}]),[]);});
test('Union limits and main candidate are enforced',()=>{assert.throws(()=>searchUnion([]));assert.throws(()=>searchUnion(Array(7).fill(req[0])));assert.throws(()=>searchUnion([{job:'비숍',level:300}]));assert.deepEqual(searchUnion([{job:'비숍',level:300},{job:'아델',level:291}]),[]);});
test('Statistics deduplicate equipment but preserve total rows',()=>{const s=statistics(EQUIPMENT);assert.equal(s.rows,8);assert.equal(s.total,7);assert.equal(s.counts.아델,2);});
test('Statistics distinguish same nickname across worlds',()=>{assert.equal(statistics([{name:'같은이름',world:'루나',job:'아델',level:291},{name:'같은이름',world:'스카니아',job:'아델',level:291}]).total,2);});
test('Statistics filters and empty results',()=>{assert.deepEqual(statistics(EQUIPMENT,{world:'루나',job:'아델',level:291}).members.map(r=>r.id),[1]);assert.equal(statistics([]).total,0);});
test('CSV escapes quotes, newlines and formula prefixes',()=>{const text=csv([{name:'=SUM(A1)',world:'루나',job:'"아델"\n예시',level:291}]);assert(text.startsWith('\uFEFF'));assert(text.includes("'=SUM(A1)"));assert(text.includes('""아델""\n예시'));});
test('Three potential lines enforce order and duplicate counts',()=>{const a=[{family:'STR',unit:'%',value:12},{family:'STR',unit:'%',value:9},{family:'STR',unit:'%',value:9}],c=[{family:'STR',unit:'%',value:9,index:0},{family:'STR',unit:'%',value:12,index:1}];assert(!matchOptions(a,c,true));assert(matchOptions(a,c,false));assert(!matchOptions(a,Array(3).fill({family:'STR',unit:'%',value:12}),false));});
test('Unordered wildcard matches do not consume an exact line',()=>{assert(matchOptions([{family:'STR',unit:'%',value:12},{family:'STR',unit:'%',value:9}],[{family:'STR',unit:'%',value:null},{family:'STR',unit:'%',value:12}],false));});
test('Grade, three lines, and all four flame conditions are applied',()=>{const rows=searchEquipment({...defaults,job:'아델',potentialGrade:'레전드리',potentialOrder:'ordered',potentialConditions:[{family:'STR',unit:'%',value:12,index:0},{family:'STR',unit:'%',value:9,index:1},{family:'STR',unit:'%',value:9,index:2}],flameConditions:[{family:'STR',value:150}]});assert.equal(rows.length,3);assert.equal(searchEquipment({...defaults,potentialGrade:'잠재없음'}).length,0);});
test('World type limits standard and special worlds',()=>{assert.equal(searchEquipment({...defaults,worldType:'special'}).length,2);assert.equal(searchEquipment({...defaults,worldType:'normal'}).length,6);});
test('HEXA exact levels and scroll increases respect explicit zero',()=>{assert.equal(searchEquipment({...defaults,hexaConditions:[{core:'마스터리 코어:1',level:20}],scrollOptions:{Dex:0}}).length,1);assert.equal(searchEquipment({...defaults,scrollOptions:{Dex:1}}).length,0);});
test('Soul activation and amplification filter together',()=>{assert.equal(searchEquipment({...defaults,soulActive:'활성',soulAmp:3,soulAttack:15}).length,8);assert.equal(searchEquipment({...defaults,soulActive:'비활성'}).length,0);});

test('API option aliases and different damage kinds stay distinct',()=>{
 const actual=[{family:'데미지',unit:'%',value:12},{family:'보스 몬스터 데미지',unit:'%',value:40},{family:'아이템 드롭률',unit:'%',value:20}];
 assert(matchOptions(actual,[{family:'보스 데미지',unit:'%',value:40}],false));
 assert(matchOptions(actual,[{family:'아이템 획득 확률',unit:'%',value:20}],false));
 assert(!matchOptions(actual,[{family:'데미지',unit:'%',value:40}],false));
});
test('Mixed combat and cumulative HEXA ranges retain exact boundaries',()=>{
 const filters={...defaults,item:'튜너',job:'아델',stars:22,soul:'루시드',potentialGrade:'레전드리',ranges:{combat:[340000000,340000000],erda:[100,100],fragments:[12000,12000]}};
 assert.deepEqual(searchEquipment(filters).map(r=>r.id),[1]);
 assert.equal(searchEquipment({...filters,ranges:{...filters.ranges,fragments:[12001,null]}}).length,0);
 const missing={...EQUIPMENT[0],erda:undefined};assert.equal(searchEquipment(filters,[missing]).length,0);
});
test('Soul magic, option, grade and individual lines are applied together',()=>{
 const f={...defaults,soulMagic:0,soulOption:'공격력 +3%',soulGrade:'유니크',soulPotential:['공격력 +3%','','HP +100']};assert.equal(searchEquipment(f).length,8);assert.equal(searchEquipment({...f,soulMagic:1}).length,0);assert.equal(searchEquipment({...f,soulPotential:['HP +100']}).length,0);
});
test('Scroll detail fields keep exact zero and reject a mismatch',()=>{assert.equal(searchEquipment({...defaults,scrollOptions:{Hp:0,Speed:0,Jump:0}}).length,8);assert.equal(searchEquipment({...defaults,scrollOptions:{Hp:1}}).length,0);});
test('Optional HEXA stat sample costs use an overlap range without changing fixtures',()=>{
 const f={...defaults,item:'제네시스 튜너',includeHexaStat:true,ranges:{erda:[110,110],fragments:[12100,12100]}};const rows=searchEquipment(f);assert.equal(rows.length,1);assert.equal(rows[0].fragments,12150);assert.equal(rows[0].fragmentMin,12100);assert.equal(rows[0].fragmentMax,12200);assert.equal(searchEquipment({...f,ranges:{fragments:[12201,null]}}).length,0);assert.equal(EQUIPMENT[0].erda,100);assert.equal(EQUIPMENT[0].fragments,12000);
});
console.log(JSON.stringify({passed:count}));
