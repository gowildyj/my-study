import {readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const path=resolve(root,'private/data/subjects.json');
const input=process.argv[2];
if(!input)throw new Error('사용법: node scripts/register-subject.mjs private/basic-french-2-subject.json');
const subject=JSON.parse(await readFile(resolve(root,input),'utf8'));
if(!/^[a-z0-9-]+$/.test(subject.id)||typeof subject.name!=='string'||!Number.isInteger(subject.unitCount)||subject.unitCount<1||subject.unitCount>99)throw new Error('과목 데이터 오류');
const subjects=JSON.parse(await readFile(path,'utf8'));
if(!Array.isArray(subjects))throw new Error('기존 과목 목록 오류');
const index=subjects.findIndex(s=>s.id===subject.id);
if(index>=0){const existing=subjects[index];subjects[index]={...existing,...subject,availableUnits:[...new Set([...(existing.availableUnits??[]),...(subject.availableUnits??[])])].sort((a,b)=>a-b)};}
else subjects.push(subject);
const tmp=`${path}.tmp-${process.pid}`;await writeFile(tmp,JSON.stringify(subjects,null,2)+'\n');await rename(tmp,path);
console.log(`${subject.name} 등록 완료 (기존 과목 유지).`);
