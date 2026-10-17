// Fictional fixtures and small local predicates for the website demo.
// This module is not the desktop combat engine and never requests game data.
export const WORLDS=['루나','스카니아','크로아','에오스','핼리오스'];
export const GROUPS={전사:['아델','히어로','팔라딘','다크나이트','소울마스터','미하일','아란','블래스터','데몬슬레이어','데몬어벤져','카이저','제로','렌'],마법사:['비숍','아크메이지(불,독)','아크메이지(썬,콜)','플레임위자드','에반','루미너스','배틀메이지','키네시스','일리움','라라'],궁수:['보우마스터','신궁','패스파인더','윈드브레이커','메르세데스','와일드헌터','카인'],도적:['나이트로드','섀도어','듀얼블레이더','나이트워커','팬텀','카데나','호영','칼리'],해적:['바이퍼','캡틴','캐논마스터','스트라이커','은월','메카닉','엔젤릭버스터','아크','제논']};
const base={stars:22,totalStars:360,arcane:1350,authentic:660,union:9500,artifact:55,guild:'별빛길드',year:2018,liberation:'제네시스 해방',access:'최근 7일 접속',hexa:'마스터리 코어',hexaLevel:30,erda:100,fragments:12000,scissors:5,exceptional:0,soul:'위대한 루시드',scroll:81,potential:[{family:'STR',unit:'%',value:12},{family:'STR',unit:'%',value:9},{family:'STR',unit:'%',value:9}],additional:[{family:'공격력',unit:'%',value:12},{family:'STR',unit:'%',value:9},{family:'STR',unit:'%',value:6}],flame:{STR:150},preset:1,potentialGrade:'레전드리',additionalGrade:'레전드리',soulAmp:3,soulActive:'활성',soulAttack:15,soulMagic:0,soulOption:'공격력 +3%',soulGrade:'유니크',soulPotential:['공격력 +3%','STR +10','HP +100'],statErda:10,statFragments:150,statFragmentMin:100,statFragmentMax:200,scrollOptions:{Str:50,Dex:0,Int:0,Luk:0,Magic:0,Hp:0,Mp:0,Armor:0,Speed:0,Jump:0}};
export const EQUIPMENT=[
 {...base,id:1,name:'별빛아델',world:'루나',job:'아델',level:291,combat:340000000,item:'제네시스 튜너'},
 {...base,id:2,name:'별빛아델',world:'루나',job:'아델',level:291,combat:340000000,item:'아케인셰이드 나이트글러브'},
 {...base,id:3,name:'달빛여행',world:'스카니아',job:'아델',level:292,combat:280000000,item:'아케인셰이드 튜너',stars:17,totalStars:310,authentic:560,union:9000,artifact:48,hexaLevel:20,fragments:9000,preset:2,scissors:3,guild:'달빛길드'},
 {...base,id:4,name:'새벽기도',world:'루나',job:'비숍',level:290,combat:190000000,item:'제네시스 스태프',union:9200,potential:[{family:'INT',unit:'%',value:12}],additional:[{family:'마력',unit:'%',value:12}],flame:{INT:150}},
 {...base,id:5,name:'은하단검',world:'크로아',job:'듀얼블레이더',level:293,combat:480000000,item:'데스티니 대거',liberation:'데스티니 1차 해방',potential:[{family:'LUK',unit:'%',value:12}],flame:{LUK:150}},
 {...base,id:6,name:'푸른기계',world:'에오스',job:'제논',level:295,combat:240000000,item:'제네시스 에너지소드',potential:[{family:'올스탯',unit:'%',value:9}],flame:{STR:70,DEX:70,LUK:70}},
 {...base,id:7,name:'붉은달',world:'스카니아',job:'데몬어벤져',level:290,combat:180000000,item:'제네시스 데스페라도',potential:[{family:'HP',unit:'%',value:12}],flame:{HP:3000},access:'최근 7일 미접속'},
 {...base,id:8,name:'숲의영웅',world:'핼리오스',job:'히어로',level:298,combat:620000000,item:'데스티니 투핸드소드',liberation:'데스티니 1차 해방',guild:'숲속길드',year:2012}
];
export const CHAMPIONS=[
 {name:'별빛아델',world:'루나',job:'아델',level:291,members:[{job:'아델',level:291},{job:'비숍',level:280},{job:'나이트로드',level:275},{job:'메르세데스',level:260},{job:'은월',level:260},{job:'제로',level:250}]},
 {name:'달빛여행',world:'스카니아',job:'아델',level:292,members:[{job:'아델',level:292},{job:'비숍',level:280},{job:'히어로',level:275}]},
 {name:'반짝조합',world:'크로아',job:'아델',level:291,members:[{job:'아델',level:291},{job:'비숍',level:280},{job:'히어로',level:270}]}
];
export function parseNumber(input){
 const text=String(input??'').trim().replace(/[,\s]/g,'');if(!text)return null;
 const match=/^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)만)?(\d+(?:\.\d+)?)?$/.exec(text);
 if(!match||!match.slice(1).some(v=>v!==undefined))throw Error('수치는 1.8억, 5000만, 180,000,000처럼 입력하세요.');
 const value=Number(match[1]||0)*1e8+Number(match[2]||0)*1e4+Number(match[3]||0);
 if(!Number.isSafeInteger(value)||value<0)throw Error('수치는 0 이상의 안전한 정수로 입력하세요.');return value;
}
export function validateRange(min,max,label='수치'){if(min!==null&&max!==null&&min>max)throw Error(label+' 최소값이 최대값보다 큽니다.');}
const canonicalOption=name=>({'보스 데미지':'보스 몬스터 데미지','아이템 획득 확률':'아이템 드롭률','HP 회복 아이템 및 스킬 효율':'HP 회복 아이템 및 회복 스킬 효율'}[name]||name);
export function matchOptions(actual,conditions,ordered=false){
 const matches=(p,c)=>p&&canonicalOption(p.family)===canonicalOption(c.family)&&p.unit===c.unit&&(c.value===null||p.value===c.value);
 if(ordered)return conditions.every(c=>matches(actual[c.index],c));
 function visit(index,used){if(index===conditions.length)return true;return actual.some((p,i)=>!used.has(i)&&matches(p,conditions[index])&&visit(index+1,new Set([...used,i])));}
 return visit(0,new Set());
}
export function searchEquipment(filters,data=EQUIPMENT){
 for(const [key,range] of Object.entries(filters.ranges||{}))validateRange(range[0],range[1],key);
 if(filters.includeHexaStat)data=data.map(row=>({...row,erda:row.erda+row.statErda,fragments:row.fragments+row.statFragments,fragmentMin:row.fragments+row.statFragmentMin,fragmentMax:row.fragments+row.statFragmentMax,resourceStatus:'HEXA 스탯 포함 · 가상 추정 범위'}));
 return data.filter(row=>{
  if(filters.name&&!row.name.includes(filters.name))return false;
  for(const key of ['world','job','guild','liberation','access'])if(filters[key]&&row[key]!==filters[key])return false;
  if(filters.worldType&&((filters.worldType==='special')!==['에오스','핼리오스'].includes(row.world)))return false;
  if(filters.group&&!GROUPS[filters.group]?.includes(row.job))return false;
  if(filters.item&&!filters.item.split(',').map(x=>x.trim()).filter(Boolean).some(item=>filters.exact?row.item===item:row.item.includes(item)))return false;
  if(filters.stars!==null&&filters.stars!==undefined&&row.stars!==filters.stars)return false;
  if(!filters.includePresets&&row.preset!==1)return false;
  for(const [key,[min,max]] of Object.entries(filters.ranges||{})){if(key==='fragments'&&filters.includeHexaStat){if(!Number.isFinite(row.fragmentMin)||!Number.isFinite(row.fragmentMax)||min!==null&&row.fragmentMax<min||max!==null&&row.fragmentMin>max)return false;continue;}if((min!==null||max!==null)&&!Number.isFinite(row[key]))return false;if(min!==null&&row[key]<min||max!==null&&row[key]>max)return false;}
  for(const key of ['scissors','exceptional','scroll','year','hexaLevel'])if(filters[key]!==null&&filters[key]!==undefined&&row[key]!==filters[key])return false;
  if(filters.soul&&!row.soul.includes(filters.soul))return false;
  for(const key of ['potential','additional'])if(filters[key]&&!row[key].some(p=>canonicalOption(p.family)===canonicalOption(filters[key].family)&&p.unit===filters[key].unit&&(filters[key].value===null||p.value===filters[key].value)))return false;
  for(const key of ['potential','additional']){if(filters[key+'Grade']&&row[key+'Grade']!==filters[key+'Grade'])return false;if(filters[key+'Conditions']&&!matchOptions(row[key],filters[key+'Conditions'],filters[key+'Order']==='ordered'))return false;}
  for(const c of filters.flameConditions||[])if(row.flame[c.family]!==c.value)return false;
  for(const c of filters.hexaConditions||[])if((row.hexaLevels?.[c.core]??row.hexaLevel)!==c.level)return false;
  for(const [key,n]of Object.entries(filters.scrollOptions||{}))if(row.scrollOptions[key]!==n)return false;
  for(const key of ['soulAmp','soulAttack','soulMagic'])if(filters[key]!==null&&filters[key]!==undefined&&row[key]!==filters[key])return false;
  if(filters.soulActive&&row.soulActive!==filters.soulActive)return false;
  if(filters.soulGrade&&row.soulGrade!==filters.soulGrade)return false;
  if(filters.soulOption&&!String(row.soulOption||'').replace(/\s/g,'').includes(filters.soulOption.replace(/\s/g,'')))return false;
  if(filters.soulPotential?.some((v,i)=>v&&!String(row.soulPotential?.[i]||'').replace(/\s/g,'').includes(v.replace(/\s/g,''))))return false;
  if(filters.flame&&row.flame[filters.flame.family]!==filters.flame.value)return false;
  return true;
 });
}
export function searchUnion(requests,{world='',worldType='',perfect=true}={},data=CHAMPIONS){
 if(requests.length<2||requests.length>6)throw Error('조합 조건을 2~6개 입력하세요.');
 for(const r of requests)if(!r.job||!Number.isInteger(r.level)||r.level<1||r.level>300)throw Error('유니온 직업과 1~300 레벨을 함께 입력하세요.');
 const main=requests.reduce((a,b)=>a.level>=b.level?a:b);
 return data.filter(r=>(!world||r.world===world)&&(!worldType||(worldType==='special')===['에오스','핼리오스'].includes(r.world))&&r.job===main.job&&r.level===main.level).map(r=>{
  const used=new Set();const matches=requests.map(req=>{const i=r.members.findIndex((m,i)=>!used.has(i)&&m.job===req.job&&m.level===req.level);if(i>=0)used.add(i);return i>=0;});
  return {...r,score:used.size,total:requests.length,matches};
 }).filter(r=>perfect?r.score===r.total:r.score>0);
}
export function statistics(rows,{job='',world='',level='',group=''}={}){
 const unique=new Map();for(const row of rows){const key=row.world+'\0'+row.name;if(!unique.has(key))unique.set(key,row);}
 const all=[...unique.values()],members=all.filter(r=>(!job||r.job===job)&&(!world||r.world===world)&&(!level||r.level===Number(level))&&(!group||GROUPS[group]?.includes(r.job)));
 const counts={};for(const r of members)counts[r.job]=(counts[r.job]||0)+1;
 return {rows:rows.length,total:all.length,members,counts};
}
export function csv(rows){const safe=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\uFEFF'+[['구분','닉네임','월드','직업','레벨','장비','전투력'],...rows.map(r=>['가상 예시',r.name,r.world,r.job,r.level,r.item||'',r.combat||''])].map(r=>r.map(safe).join(',')).join('\r\n');}
export const TIMELINE=[{date:'2026-10-14',kind:'레벨',before:'Lv.290',after:'Lv.291',text:'291레벨 최초 확인'},{date:'2026-10-02',kind:'길드',before:'달빛길드',after:'별빛길드',text:'길드 변경'},{date:'2026-09-18',kind:'닉네임',before:'여행의시작',after:'별빛아델',text:'닉네임 변경'},{date:'2026-09-03',kind:'월드',before:'스카니아',after:'루나',text:'월드 변경'}];
