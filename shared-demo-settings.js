export function bindDemoSettings({status,navigate}){
 const $=id=>document.getElementById(id),key='mapletools-demo-settings';let state={speed:'normal',startup:'home'};
 try{Object.assign(state,JSON.parse(sessionStorage.getItem(key)||'{}'));}catch{}
 function save(){try{sessionStorage.setItem(key,JSON.stringify(state));}catch{}}
 function render(){$('settings-speed').value=state.speed;$('startup-view').value=state.startup;$('speed-state').textContent=(state.speed==='fast'?'고속 모드':'일반 모드')+' (체험)';}
 render();$('configure-api').addEventListener('click',()=>$('api-settings-dialog').showModal());$('close-api-settings').addEventListener('click',()=>$('api-settings-dialog').close());
 $('save-api-settings').addEventListener('click',()=>{state.speed=$('settings-speed').value;save();render();$('api-settings-dialog').close();status('공통 검색 속도를 바꿨어요. 이 웹 체험에서는 실제 API를 호출하지 않아요.');});
 $('startup-view').addEventListener('change',()=>{state.startup=$('startup-view').value;save();status('첫 화면 선택을 이 체험 탭에 적용했어요.');});$('apply-startup').addEventListener('click',()=>navigate(state.startup));
}
