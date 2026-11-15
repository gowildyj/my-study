import {renderReader} from './reader.js';
import {unlock,lock,readJson} from './crypto.js';
const app=document.querySelector('#app');const actions=document.querySelector('#study-actions');
let subjects=[],unlocked=false,routeVersion=0,disposeReader=null,category='전체';
function el(tag,cls='',text=''){const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;}
function backHeading(title,href,label){const row=el('div','page-heading');const back=el('a','back-button','‹');back.href=href;back.setAttribute('aria-label',label);row.append(back,el('h1','',title));return row;}
function clearReader(){disposeReader?.();disposeReader=null;}
function login(){
  document.title='My Study';actions.hidden=true;
  const box=el('section','login-card');const title=el('h1','','My Study');const form=el('form','login-form');
  const label=el('label','','입장 코드');label.htmlFor='access-code';const input=el('input','login-input');input.id='access-code';input.type='password';input.autocomplete='current-password';input.required=true;input.placeholder='입장 코드 입력';
  const submit=el('button','login-primary','입장하기');submit.type='submit';const status=el('p','login-status');status.setAttribute('role','status');
  form.append(label,input,submit,status);box.append(title,el('p','muted','나만의 학습 공간'),form);app.replaceChildren(box);
  form.addEventListener('submit',async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;input.disabled=true;status.textContent='자료 잠금을 해제하는 중입니다…';try{
    subjects=(await unlock(input.value)).filter(s=>s&&/^[a-z0-9-]+$/.test(s.id)&&s.enabled!==false&&typeof s.name==='string'&&Number.isInteger(s.unitCount)&&s.unitCount>0&&s.unitCount<=99);input.value='';unlocked=true;actions.hidden=false;category='전체';await router();
  }catch(error){status.textContent=error.name==='OperationError'?'입장 코드가 올바르지 않거나 자료가 손상되었습니다.':'자료를 열 수 없습니다. 배포 파일을 확인해 주세요.';input.disabled=false;submit.disabled=false;input.focus();input.select();}});
}
function renderHome(){
  document.title='My Study';const wrap=el('section','study-home');wrap.append(el('h1','','나의 학습'),el('p','muted','학습할 과목 또는 교재를 선택하세요.'));
  const filters=el('nav','study-filters');filters.setAttribute('aria-label','학습 카테고리');const categories=['전체',...new Set(subjects.map(s=>s.category||'기타'))];if(!categories.includes(category))category='전체';
  for(const c of categories){const b=el('button',`vocabulary-control${c===category?' active':''}`,c);b.type='button';b.setAttribute('aria-pressed',String(c===category));b.addEventListener('click',()=>{category=c;renderHome();});filters.append(b);}
  const grid=el('div','study-grid');for(const s of subjects.filter(s=>category==='전체'||(s.category||'기타')===category)){const a=el('a','study-book');a.href=`#/${s.id}`;a.append(el('p','eyebrow',s.category||'기타'),el('h2','',s.name),el('p','muted',s.description||`${s.unitCount}개 단원`));grid.append(a);}
  wrap.append(filters,grid);if(!grid.childElementCount)wrap.append(el('p','empty-state','등록된 학습 자료가 없습니다.'));app.replaceChildren(wrap);
}
function renderSubject(subject){
  document.title=`${subject.name} | My Study`;const grid=el('nav','unit-grid');grid.setAttribute('aria-label','단원 목록');
  for(let i=1;i<=subject.unitCount;i++){const link=el('a','unit-card',`${subject.unitLabel||'Unit'} ${i}`);link.href=`#/${subject.id}/unit-${String(i).padStart(2,'0')}`;grid.append(link);}
  app.replaceChildren(backHeading(subject.name,'#/','학습 홈으로 돌아가기'),grid);
}
function renderMessage(message,subject){app.replaceChildren(backHeading(subject?.name||'My Study',subject?`#/${subject.id}`:'#/','돌아가기'),el('p','empty-state',message));}
async function router(){
  if(!unlocked)return;const version=++routeVersion;clearReader();window.scrollTo(0,0);
  if(!location.hash||location.hash==='#/'||location.hash==='#'){renderHome();return;}
  const match=location.hash.slice(1).match(/^\/([a-z0-9-]+)(?:\/unit-(\d{2}))?$/);const subject=subjects.find(s=>s.id===match?.[1]);if(!subject){renderMessage('등록되지 않은 과목입니다.');return;}
  if(!match[2]){renderSubject(subject);return;}const number=Number(match[2]);if(number<1||number>subject.unitCount){renderMessage('존재하지 않는 단원입니다.',subject);return;}
  app.replaceChildren(el('p','empty-state','학습 자료를 불러오는 중입니다.'));const base=`data/${subject.id}/unit-${match[2]}`;
  try{const [unit,extra]=await Promise.all([readJson(`${base}.json`),readJson(`${base}-extra.json`,true).catch(e=>({loadError:true}))]);if(!unlocked||version!==routeVersion)return;document.title=`${subject.name} ${subject.unitLabel||'Unit'} ${number} | My Study`;disposeReader=renderReader(app,subject,{...unit,verbs:extra?.verbs??unit.verbs,exercises:extra?.exercises??unit.exercises,loadError:Boolean(extra?.loadError)});}catch(e){if(unlocked&&version===routeVersion)renderMessage(e.message==='HTTP 404'?'아직 등록된 학습 자료가 없습니다.':'학습 자료를 불러오지 못했습니다.',subject);}
}
document.querySelector('#lock-button').addEventListener('click',()=>{unlocked=false;routeVersion++;lock();clearReader();subjects=[];document.querySelector('#settings-dialog')?.close();location.hash='#/';login();});window.addEventListener('hashchange',router);
// Re-lock pages restored from the browser back/forward cache.
window.addEventListener('pagehide',()=>{if(unlocked){unlocked=false;routeVersion++;lock();clearReader();subjects=[];login();}});login();
