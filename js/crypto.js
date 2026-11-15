const base=new URL('../vault/',import.meta.url);
const encoder=new TextEncoder();const decoder=new TextDecoder('utf-8',{fatal:true});
let activeKey=null, epoch=0;
function safePath(path){if(!/^(data|audio)\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.(json|mp3)$/i.test(path))throw new Error('잘못된 자료 경로');return path;}
async function fetchBytes(path,optional=false){
  const res=await fetch(new URL(path,base),{cache:'no-cache'});
  if(optional&&res.status===404)return null;
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
async function decrypt(path,key,optional=false){
  safePath(path);const bytes=await fetchBytes(`${path}.enc`,optional);if(bytes===null)return null;
  if(bytes.length<28)throw new Error('자료가 손상되었습니다.');
  return crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:encoder.encode(`my-study:v1:${path}`),tagLength:128},key,bytes.subarray(12));
}
export async function unlock(password){
  const attempt=++epoch;activeKey=null;
  const meta=JSON.parse(decoder.decode(await fetchBytes('manifest.json')));
  if(meta.version!==1||meta.kdf!=='PBKDF2-SHA256'||meta.iterations!==600000)throw new Error('지원하지 않는 자료 형식입니다.');
  const salt=Uint8Array.from(atob(meta.salt),c=>c.charCodeAt(0));if(salt.length!==16)throw new Error('자료 설정 오류');
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:meta.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const catalog=JSON.parse(decoder.decode(await decrypt('data/subjects.json',key)));
  if(attempt!==epoch)throw new Error('잠금 상태가 변경되었습니다.');
  if(!Array.isArray(catalog))throw new Error('과목 목록 오류');
  activeKey=key;return catalog;
}
export function lock(){activeKey=null;epoch++;}
export async function readProtected(path,optional=false){
  const key=activeKey, version=epoch;if(!key)throw new Error('잠금 상태입니다.');
  const result=await decrypt(path,key,optional);if(version!==epoch)throw new Error('잠금 상태입니다.');return result;
}
export async function readJson(path,optional=false){const bytes=await readProtected(path,optional);return bytes===null?null:JSON.parse(decoder.decode(bytes));}
