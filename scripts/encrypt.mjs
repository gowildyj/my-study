import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rm, rename, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
const root=fileURLToPath(new URL('../',import.meta.url));
const raw=join(root,'private');
const vault=join(root,'vault');
const tmp=join(root,`vault.tmp-${process.pid}`);
const iterations=600000;
async function prompt(label){
  if(!process.stdin.isTTY) throw new Error('터미널에서 실행하거나 MY_STUDY_PASSWORD 환경변수를 사용하세요.');
  process.stdout.write(label);
  const muted=new Writable({write(_chunk,_enc,cb){cb();}});
  const r=createInterface({input:process.stdin,output:muted,terminal:true});
  try{return await r.question('');}finally{r.close();process.stdout.write('\n');}
}
async function files(dir, prefix){
  const list=[];
  for(const e of await readdir(dir,{withFileTypes:true})){
    if(e.name.startsWith('.'))continue;
    if(!/^[a-z0-9._-]+$/i.test(e.name)) throw new Error(`파일명 오류: ${e.name}`);
    const rel=`${prefix}/${e.name}`;
    if(e.isDirectory())list.push(...await files(join(dir,e.name),rel));
    else if(e.isFile() && ((prefix.startsWith('data')&&e.name.endsWith('.json'))||(prefix.startsWith('audio')&&e.name.endsWith('.mp3'))))list.push(rel);
    else throw new Error(`지원하지 않는 파일: ${rel}`);
  }return list;
}
async function main(){
  let password=process.env.MY_STUDY_PASSWORD;
  if(password===undefined){password=await prompt('입장 코드 (16자 이상): ');if(password!==await prompt('입장 코드 확인: '))throw new Error('입장 코드가 일치하지 않습니다.');}
  if(password.length<16)throw new Error('16자 이상의 강력한 입장 코드를 사용하세요.');
  const subjects=JSON.parse(await readFile(join(raw,'data/subjects.json'),'utf8'));
  if(!Array.isArray(subjects)||!subjects.length)throw new Error('subjects.json이 비어 있습니다.');
  const paths=await files(join(raw,'data'),'data');
  try{await stat(join(raw,'audio'));paths.push(...await files(join(raw,'audio'),'audio'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const salt=randomBytes(16);const key=pbkdf2Sync(password,salt,iterations,32,'sha256');password='';
  await mkdir(tmp,{recursive:false});
  try{
    for(const rel of paths){
      const plain=await readFile(join(raw,rel));if(rel.endsWith('.json'))JSON.parse(plain.toString('utf8'));
      const iv=randomBytes(12);const aad=Buffer.from(`my-study:v1:${rel}`);
      const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad);
      const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);const tag=cipher.getAuthTag();
      const check=createDecipheriv('aes-256-gcm',key,iv);check.setAAD(aad);check.setAuthTag(tag);
      if(!Buffer.concat([check.update(encrypted),check.final()]).equals(plain))throw new Error(`검증 실패: ${rel}`);
      const out=join(tmp,`${rel}.enc`);await mkdir(dirname(out),{recursive:true});await writeFile(out,Buffer.concat([iv,encrypted,tag]));
    }
    await writeFile(join(tmp,'manifest.json'),JSON.stringify({version:1,kdf:'PBKDF2-SHA256',iterations,salt:salt.toString('base64')})+'\n');
    // Preserve previous vault until replacement is ready.
    const backup=join(root,`vault.tmp-backup-${process.pid}`);let moved=false;
    try{await rename(vault,backup);moved=true;}catch(e){if(e.code!=='ENOENT')throw e;}
    try{await rename(tmp,vault);}catch(e){if(moved)await rename(backup,vault);throw e;}
    if(moved)await rm(backup,{recursive:true,force:true});
    console.log(`${paths.length}개 파일 암호화 및 복호화 검증 완료. vault/만 배포합니다.`);
  }finally{key.fill(0);await rm(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
