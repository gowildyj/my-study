import {readdir,mkdir,access,rename,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const input=process.argv[2],subject=process.argv[3];
if(!input||!subject||!/^[a-z0-9-]+$/.test(subject))throw new Error('사용법: node scripts/import-audio.mjs "원본 WAV 폴더" basic-french-2');
const out=join(root,'private','audio',subject);await mkdir(out,{recursive:true});
const files=(await readdir(resolve(input),{withFileTypes:true})).filter(e=>e.isFile()).flatMap(e=>{const m=e.name.normalize('NFC').match(/^회화(\d{2})(-\d+)?\.wav$/i);return m?[{src:join(resolve(input),e.name),target:join(out,`unit-${m[1]}${m[2]??''}.mp3`)}]:[];});
if(!files.length)throw new Error('회화01.wav 또는 회화01-1.wav 형식의 파일이 없습니다.');
for(const {src,target} of files){
  if(await access(target).then(()=>true,()=>false)){console.log('이미 있음:',target);continue;}
  const tmp=`${target}.tmp-${process.pid}.mp3`;
  try{await new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y','-i',src,'-map_metadata','-1','-vn','-ac','1','-ar','44100','-codec:a','libmp3lame','-b:a','96k',tmp],{stdio:'inherit'});p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(new Error(`ffmpeg 종료 코드: ${code}`)));});await rename(tmp,target);console.log('변환:',target);}finally{await rm(tmp,{force:true});}
}
