// Fictional browser examples. Matching follows the recovered Coordi Finder 0.5.1.
import {GROUPS} from './demo-engine.js?v=ui-2267-1';

export const SAMPLE_DATE='2026-10-14';
const cash=(part,name)=>({part,name,kind:'cash',aliases:[name]});
const beauty=(part,name,aliases=[name])=>({part,name,kind:'beauty',aliases});
const hat=cash('모자','밤의 엘로디'),robe=cash('한벌옷','메르헨 판타지'),cape=cash('망토','라벤더 멜로디');
const hair=beauty('헤어','검은색 엘로디 헤어',['엘로디 헤어','검은색 엘로디 헤어']);
const face=beauty('성형','조용한 눈 얼굴');
const config=(label,items,current=false,preset=0)=>({label,current,preset,items:[...items,beauty('피부','뽀송 꽃잎 피부')]});
export const COORDI_CHARACTERS=[
 {name:'별빛아델',world:'루나',job:'아델',level:291,configs:[config('기본',[hat,robe,cape,hair,face],true),config('프리셋 2',[hat,robe,hair,face],false,2)]},
 {name:'달빛여행',world:'스카니아',job:'아델',level:292,configs:[config('기본',[cash('모자','가을 모자'),hair,face],true),config('프리셋 1',[hat,robe,hair,face],false,1)]},
 {name:'새벽기도',world:'루나',job:'비숍',level:290,configs:[config('기본',[cape,hair,face],true),config('추가 프리셋 3',[hat,robe,beauty('헤어','빨간색 엘로디 헤어',['엘로디 헤어','빨간색 엘로디 헤어']),face],false,3)]},
 {name:'푸른기계',world:'에오스',job:'제논',level:295,configs:[config('추가 기본',[hat,cash('반지 1','별빛 반지'),cash('반지 2','별빛 반지'),hair,face],true)]},
 {name:'은하단검',world:'크로아',job:'듀얼블레이더',level:293,configs:[config('기본',[hat,hair,face],true),config('프리셋 3',[robe,cape,hair,face],false,3)]},
];

export const normalizeName=value=>String(value??'').normalize('NFKC').replace(/\[\s*공용\s*\]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ko-KR');
export const parseQuery=text=>String(text??'').split(/[,;\n\r]+/).map(s=>s.trim()).filter(Boolean);

// Each requested occurrence consumes one item. Configurations are never combined.
export function matchOutfit(items,wanted,mode='contains'){
 if(!wanted.length)return null;
 if(!['contains','exact'].includes(mode))throw Error('지원하지 않는 검색 방식입니다.');
 const key=name=>normalizeName(name).replace(/ /g,''), owners=new Map();
 const edges=wanted.map(name=>items.flatMap((item,i)=>key(name)&&(item.aliases||[item.name]).some(alias=>key(alias).includes(key(name)))?[i]:[]));
 if(mode==='exact'){if(wanted.length>items.length)return null;const beauty=items.flatMap((item,i)=>item.kind!=='cash'?[i]:[]);for(let i=wanted.length;i<items.length;i++)edges.push(beauty);}
 const assign=(q,seen)=>{for(const i of edges[q]){if(seen.has(i))continue;seen.add(i);if(!owners.has(i)||assign(owners.get(i),seen)){owners.set(i,q);return true;}}return false;};
 for(const q of edges.map((_,i)=>i).sort((a,b)=>edges[a].length-edges[b].length))if(!assign(q,new Set()))return null;
 const matched=Array(wanted.length);for(const [i,q]of owners)if(q<wanted.length)matched[q]=items[i];
 if(mode==='exact'&&items.filter(i=>i.kind==='cash').length!==matched.filter(i=>i.kind==='cash').length)return null;
 return matched;
}

export function searchCoordi(filters,characters=COORDI_CHARACTERS){
 const wanted=parseQuery(filters.query);
 if(!wanted.length)throw Error('찾을 코디 이름을 하나 이상 입력해 주세요.');
 if(!['contains','exact'].includes(filters.mode))throw Error('검색 방식을 선택해 주세요.');
 const min=Number(filters.min),max=Number(filters.max),pages=Number(filters.pages);
 if(!String(filters.min).trim()||!String(filters.max).trim()||!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<1||max<min)throw Error('레벨 범위를 확인해 주세요.');
 if(!Number.isSafeInteger(pages)||pages<1||pages>1000)throw Error('최대 랭킹 페이지는 1~1000으로 입력해 주세요.');
 if(!filters.normal&&!filters.special)throw Error('월드 유형을 하나 이상 선택해 주세요.');
 if(filters.date!==SAMPLE_DATE)throw Error('웹 체험에는 2026-10-14의 가상 기록만 있어요. 예시 날짜로 바꿔 주세요.');
 const server=String(filters.server||'').trim();
 return characters.filter(c=>{
  const special=['에오스','핼리오스'].includes(c.world);
  return (special?filters.special:filters.normal)&&(!server||c.world.includes(server))&&c.level>=min&&c.level<=max&&(!filters.group||GROUPS[filters.group]?.includes(c.job))&&(!filters.job||c.job===filters.job);
 }).flatMap(c=>{
  const matches=c.configs.map(conf=>({...conf,matched:matchOutfit(conf.items,wanted,filters.mode)})).filter(conf=>conf.matched).sort((a,b)=>Number(b.current)-Number(a.current)||a.preset-b.preset);
  return matches.length?[{...c,matches,chosen:matches[0]}]:[];
 });
}

export function coordiCsv(rows){
 const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
 return '\ufeff'+[['닉네임','월드','레벨','직업','검출 위치','구성 수','외형 모드','일치 구성'],...rows.map(r=>[r.name,r.world,r.level,r.job,r.matches.map(c=>c.label+(c.current?' · 사용중':'')).join(' / '),r.chosen.items.length,r.chosen.label.startsWith('추가')?'추가 외형':'기본 외형',r.chosen.items.map(i=>i.part+':'+i.name).join(' · ')])].map(row=>row.map(cell).join(',')).join('\r\n');
}
