import {createHash} from 'node:crypto';
export const PUBLIC_ID_POLICY='mapletools-public-character-v1';
export const isPublicCharacterId=value=>typeof value==='string'&&/^mt_[a-f0-9]{64}$/.test(value);
export function publicCharacterId(value){
  if(value===null||value===undefined||value==='')return '';
  if(typeof value!=='string'||value.length>100||/[\u0000-\u001f]/.test(value))throw Error('공개 캐릭터 키 형식을 확인하세요.');
  if(isPublicCharacterId(value))return value;
  return 'mt_'+createHash('sha256').update(PUBLIC_ID_POLICY+'\0'+value).digest('hex');
}
export const publicCharacter=row=>({...row,ocid:publicCharacterId(row.ocid)});
