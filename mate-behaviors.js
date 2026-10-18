// Choreography deliberately reuses four APPROVED mascot paintings.
// These are stage directions/gestures, NOT newly painted full-body sprites.
export const MASCOT_BEHAVIORS=Object.freeze([
 {id:'wave',label:'손 흔들기',icon:'👋',pose:'greet',mood:'cheerful',spoken:'어서 와! 반가워!',group:'daily'},
 {id:'point',label:'여기 가리키기',icon:'👉',pose:'hover',mood:'curious',spoken:'이쪽을 봐!',group:'daily'},
 {id:'present',label:'소개하기',icon:'✨',pose:'greet',mood:'cheerful',spoken:'짜잔! 소개할게!',group:'daily'},
 {id:'listen',label:'집중해서 듣기',icon:'👂',pose:'hover',mood:'curious',spoken:'응, 이야기해 줘!',group:'daily'},
 {id:'think',label:'곰곰이 생각',icon:'📖',pose:'read',mood:'focused',spoken:'잠시만 생각해 볼게.',group:'daily'},
 {id:'agree',label:'고개 끄덕',icon:'🙂',pose:'idle',mood:'gentle',spoken:'응! 좋은 생각이야.',group:'daily'},
 {id:'disagree',label:'고개 절레절레',icon:'🙅',pose:'hover',mood:'curious',spoken:'음, 다시 확인해 볼까?',group:'daily'},
 {id:'peek',label:'살짝 들여다보기',icon:'🔎',pose:'hover',mood:'curious',spoken:'뭐가 있을까?',group:'daily'},
 {id:'proud',label:'당당한 자세',icon:'⭐',pose:'idle',mood:'gentle',spoken:'나만 믿어!',group:'daily'},
 {id:'thanks',label:'감사 인사',icon:'💐',pose:'greet',mood:'cheerful',spoken:'정말 고마워!',group:'daily'},
 {id:'encourage',label:'응원하기',icon:'💪',pose:'greet',mood:'cheerful',spoken:'할 수 있어!',group:'daily'},
 {id:'relax',label:'잠깐 쉬기',icon:'🌙',pose:'read',mood:'focused',spoken:'잠깐 쉬었다 갈까?',group:'daily'},
 {id:'welcome',label:'환영하기',icon:'🎊',pose:'greet',mood:'cheerful',spoken:'드디어 왔구나!',group:'event'},
 {id:'reveal',label:'결과 공개',icon:'🎁',pose:'greet',mood:'cheerful',spoken:'결과를 공개할게!',group:'event'},
 {id:'ponder',label:'검색 고민',icon:'💭',pose:'read',mood:'focused',spoken:'마법책을 찾는 중이야.',group:'event'},
 {id:'oh',label:'화들짝 놀라기',icon:'❕',pose:'hover',mood:'curious',spoken:'앗! 깜짝이야!',group:'event'}
]);
export const MASCOT_MOODS=Object.freeze({
 gentle:{pose:'idle',label:'기본',artwork:'original-idle'},
 curious:{pose:'hover',label:'호기심',artwork:'original-hover'},
 cheerful:{pose:'greet',label:'밝음',artwork:'original-greet'},
 focused:{pose:'read',label:'차분함',artwork:'original-read'}
});
export const BEHAVIORS_BY_ID=Object.freeze(Object.fromEntries(MASCOT_BEHAVIORS.map(x=>[x.id,x])));
export const DEFAULT_AMBIENT_BEHAVIORS=Object.freeze(['think','peek','proud','relax','wave','listen','agree','ponder','thanks']);
export function mascotPoseFor(kind){
 return BEHAVIORS_BY_ID[kind]?.pose??({sleep:'read',search:'read',curious:'hover',surprised:'hover',greet:'greet',celebrate:'greet',summon:'greet',farewell:'greet'}[kind]??null);
}
export function mascotMoodFor(kind){return BEHAVIORS_BY_ID[kind]?.mood??'gentle'}
