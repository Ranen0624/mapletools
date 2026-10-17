// Browser-local CSV analysis. No identifiers leave this worker.
export function parseCSV(text) {
  if (text.length > 5 * 1024 * 1024) throw Error('5MB 이하의 CSV를 선택하세요.');
  const rows=[]; let row=[],cell='',quoted=false,closed=false;
  text=text.replace(/^\uFEFF/,'');
  const push=()=>{row.push(cell);cell='';closed=false;};
  const line=()=>{push();if(row.some(v=>v.trim()))rows.push(row);row=[];if(rows.length>50001)throw Error('검색 결과 50,000행 이하의 CSV를 선택하세요.');};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c===','){push();continue;}
    if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();continue;}
    if(c==='"'){if(cell||closed)throw Error('CSV 따옴표 형식을 확인하세요.');quoted=true;continue;}
    if(closed){if(c===' '||c==='\t')continue;throw Error('CSV 따옴표 뒤의 구분자를 확인하세요.');}
    cell+=c;
  }
  if(quoted)throw Error('CSV의 닫히지 않은 따옴표를 확인하세요.');
  if(cell||row.length||closed)line();
  return rows;
}
export function analyzeCSV(text){
  const rows=parseCSV(text),headers=rows.shift()?.map(v=>v.trim().toLowerCase())||[];
  const column=aliases=>headers.findIndex(h=>aliases.includes(h));
  const name=column(['닉네임','본캐 후보','캐릭터명','name','character_name']);
  const world=column(['월드','서버','world','world_name']);
  const job=column(['직업','본캐 직업','job','class','character_class']);
  const level=column(['레벨','본캐 레벨','level','character_level']);
  if([name,world,job].some(i=>i<0))throw Error('닉네임·월드·직업 열이 있는 「전체 결과 CSV」를 선택하세요. 통계 CSV는 지원하지 않습니다.');
  const seen=new Set(),groups={job:new Map(),world:new Map(),level:new Map()};
  let duplicates=0,skipped=0,unknownLevels=0,conflicts=0;
  const previous=new Map();
  for(const row of rows){
    if(row.length!==headers.length){skipped++;continue;}
    const n=row[name].trim(),w=row[world].trim(),j=row[job].trim();
    if(!n||!w||!j||Math.max(n.length,w.length,j.length)>100){skipped++;continue;}
    const numeric=level<0?NaN:Number(row[level].trim().replace(/^(?:lv\.?\s*)/i,''));
    const lv=Number.isInteger(numeric)&&numeric>=1&&numeric<=300?numeric:null;
    const key=JSON.stringify([w,n]);
    if(seen.has(key)){duplicates++;const old=previous.get(key);if(old.job!==j||old.level!==lv)conflicts++;continue;}
    seen.add(key);previous.set(key,{job:j,level:lv});
    const band=lv===null?'레벨 미상':`${Math.floor(lv/10)*10}–${Math.floor(lv/10)*10+9}레벨`;
    if(lv===null)unknownLevels++;
    for(const [kind,value] of [['job',j],['world',w],['level',band]])groups[kind].set(value,(groups[kind].get(value)||0)+1);
  }
  if(!seen.size)throw Error('집계할 수 있는 캐릭터가 없습니다. 닉네임·월드·직업 값을 확인하세요.');
  const result={total:seen.size,rows:rows.length,duplicates,skipped,unknownLevels,conflicts};
  for(const kind of ['job','world','level'])result[kind]=[...groups[kind]].sort((a,b)=>kind==='level'?(parseInt(a[0])||999)-(parseInt(b[0])||999):b[1]-a[1]||a[0].localeCompare(b[0],'ko'));
  return result;
}
