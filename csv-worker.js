import {analyzeCSV} from './csv-statistics.js?v=data-mate-4';
self.onmessage=({data})=>{
  try{
    let text;
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{text=new TextDecoder('euc-kr',{fatal:true}).decode(data);}
    self.postMessage({result:analyzeCSV(text)});
  }catch(error){self.postMessage({error:error.message||'CSV를 읽지 못했습니다.'});}
};
