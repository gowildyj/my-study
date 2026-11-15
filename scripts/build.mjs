import { cp, mkdir, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await access(join(root,'vault/data/subjects.json.enc')).catch(()=>{throw new Error('먼저 npm run encrypt를 실행하세요.');});
const dist=join(root,'dist');await rm(dist,{recursive:true,force:true});await mkdir(dist);
for(const name of ['index.html','.nojekyll','css','js','tools','assets','vault']){
  await cp(join(root,name),join(dist,name),{recursive:true,filter:src=>!src.endsWith('.DS_Store')});
}
console.log('dist/ 생성 완료 (private/ 제외).');
