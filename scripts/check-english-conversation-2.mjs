import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const p=async name=>JSON.parse(await readFile(join(root,name),'utf8'));
const subject=await p('private/english-conversation-2-subject.json');
if(subject.id!=='english-conversation-2'||subject.type!=='conversation'||subject.unitCount!==15||JSON.stringify(subject.availableUnits)!=='[4,5]')throw Error('과목 정의 오류');
const required={4:["I've heard that ~.","You do know ~, don't you?","All I need is ~.","Do you know where the best place is to ~?"],5:["I wish I could ~.","You might as well ~.","That's a little on the steep side.","What makes you ~?"]};
for(const n of [4,5]){
  const data=await p(`private/data/english-conversation-2/unit-0${n}.json`);
  if(data.unit!==n||data.language!=='en-US'||!data.dialogue.length||!data.words.length)throw Error(`${n}강 기본 구조 오류`);
  const words=new Set(data.words.map(w=>w.id));
  for(const line of data.dialogue){
    if(!line.speaker||!line.text||!line.ko)throw Error(`${n}강 빈 대화문/번역`);
    for(const match of line.text.matchAll(/\[\[([^|\]]+)\|([^\]]+)\]\]/g))if(!words.has(match[1]))throw Error(`${n}강 잘못된 어휘 링크 ${match[1]}`);
  }
  for(const title of required[n])if(!data.expressions.some(e=>e.title===title))throw Error(`${n}강 필수 표현 누락: ${title}`);
  const questions=data.exercises.practice;
  for(const q of questions)if(q.type!=='choice'||!Array.isArray(q.options)||q.answer<0||q.answer>=q.options.length||!q.explanation)throw Error(`${n}강 연습 문제 오류`);
  console.log(`${n}강 검증 완료: 대화 ${data.dialogue.length}개 · 어휘 ${data.words.length}개 · 필수 표현 ${required[n].length}개 · 문제 ${questions.length}개`);
}
try{await stat(join(root,'private/data/subjects.json'));console.log('기존 과목 목록 확인. 아래 등록 명령을 실행할 수 있습니다.');}catch{console.log('주의: 기존 private/data/subjects.json이 없습니다. 기존 vault 복구 후 과목을 등록하세요.');}
