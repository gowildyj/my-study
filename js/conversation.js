import {createVocabulary} from './vocabulary.js';
import {createUnitAudio} from './audio.js';
import {createExerciseView} from './study-extra.js';
import {plainText} from './reader.js';

const el = (tag, cls = '', text = '') => Object.assign(document.createElement(tag), {className: cls, textContent: text});
function button(text, cls, action) {
  const b = el('button',cls,text); b.type='button'; b.addEventListener('click',action); return b;
}
const displayWord = w => w.article ? `${w.article}${/[’']$/.test(w.article)?'':' '}${w.text}` : w.text;
const empty = () => el('p','empty-state','등록된 학습 자료가 없습니다.');
const langText = (tag,cls,text,lang) => Object.assign(el(tag,cls,text),{lang});

export function renderConversation(container,subject,unit) {
  const language=unit.language || subject.language || 'fr-FR';
  const label=subject.languageLabel || '원문';
  const audio=createUnitAudio({...unit,language,unitLabel:subject.unitLabel},container);
  const words=(unit.words??[]).map(w=>({...w,en:displayWord(w)}));
  const wordMap=new Map(words.map(w=>[w.id,w]));
  const heading=el('div','page-heading');
  const back=el('a','back-button','‹'); back.href=`#/${subject.id}`; back.setAttribute('aria-label','단원 목록으로 돌아가기');
  heading.append(back,el('h1','',`${subject.unitLabel||'Lesson'} ${unit.unit}`));
  const title=el('div','conversation-title'); title.append(langText('h2','',unit.title,language));
  if(unit.titleKo)title.append(langText('p','muted',unit.titleKo,'ko'));
  const tabs=el('nav','tabs conversation-tabs');tabs.setAttribute('aria-label','학습 방식');
  const content=el('section','reader-card vocabulary-view');
  const dialog=el('dialog','word-sheet');dialog.setAttribute('aria-labelledby','conversation-word-title');
  const sheet=el('div','sheet-content');dialog.append(sheet);
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>audio.stopSpeech());
  function openWord(word,line){
    const head=el('div','sheet-header'); const name=langText('h2','sheet-word',word.en,language);name.id='conversation-word-title';
    const nameRow=el('div','sheet-word-heading');nameRow.append(name,audio.speakButton(word.en,'단어 듣기'));
    const close=button('×','sheet-close',()=>dialog.close());close.setAttribute('aria-label','닫기');head.append(nameRow,close);
    sheet.replaceChildren(el('div','sheet-handle'),head,langText('p','sheet-meaning',word.ko,'ko'));
    if(word.pos||word.gender)sheet.append(el('p','muted',[word.pos,word.gender==='m'?'남성명사':word.gender==='f'?'여성명사':''].filter(Boolean).join(' · ')));
    if(word.note)sheet.append(el('p','sentence-ko',word.note));
    if(line){const ex=el('div','sheet-example');ex.append(el('p','muted','회화 속 문장'),exampleRow({text:plainText(line.text),ko:line.ko}));sheet.append(ex);}
    for(const ex of word.examples??[])sheet.append(exampleRow(ex));
    if(!dialog.open)dialog.showModal();
  }
  function exampleRow(ex){
    const row=el('div','extra-example');const line=el('div','sentence-audio-row');
    line.append(langText('p','sentence-en',ex.text,language),audio.speakButton(ex.text,'문장 듣기'));row.append(line);
    if(ex.ko)row.append(langText('p','sentence-ko',ex.ko,'ko'));return row;
  }
  function appendMarked(target,line){
    let cursor=0;for(const match of line.text.matchAll(/\[\[([^|\]]+)\|([^\]]+)\]\]/g)){
      target.append(document.createTextNode(line.text.slice(cursor,match.index)));const word=wordMap.get(match[1]);
      if(word){const b=button(match[2],'word-link',()=>openWord(word,line));b.setAttribute('aria-label',`${match[2]} 뜻 보기`);target.append(b);}else target.append(document.createTextNode(match[2]));
      cursor=match.index+match[0].length;
    }target.append(document.createTextNode(line.text.slice(cursor)));
  }
  function dialogueView(){
    const root=el('section','extra-stack dialogue-view');let translated=false;
    const toggle=button('번역 보기','vocabulary-control',()=>{translated=!translated;root.classList.toggle('show-dialogue-ko',translated);toggle.textContent=translated?'번역 숨기기':'번역 보기';toggle.setAttribute('aria-pressed',String(translated));});toggle.setAttribute('aria-pressed','false');root.append(toggle);
    const speakers=new Map();
    for(const line of unit.dialogue??[]){
      if(!speakers.has(line.speaker))speakers.set(line.speaker,speakers.size%4);
      const card=el('article',`dialogue-row speaker-${speakers.get(line.speaker)}`);
      const bubble=el('div','dialogue-bubble');bubble.append(el('p','dialogue-speaker',line.speaker));
      const text=langText('p','sentence-en','',language);appendMarked(text,line);
      const en=el('div','sentence-audio-row');en.append(text,audio.speakButton(plainText(line.text),'회화 문장 듣기'));bubble.append(en);
      if(line.ko)bubble.append(langText('p','sentence-ko dialogue-ko',line.ko,'ko'));
      card.append(bubble);root.append(card);
    }if(!(unit.dialogue??[]).length)root.append(empty());return root;
  }
  function conjugationView(){
    const root=el('section','extra-stack');let hidden=false;const formButtons=[];
    const toggle=button('변형 가리기','vocabulary-control',()=>{hidden=!hidden;toggle.textContent=hidden?'전체 보기':'변형 가리기';toggle.setAttribute('aria-pressed',String(hidden));formButtons.forEach(({b,update})=>{b.dataset.revealed='false';update();});});toggle.setAttribute('aria-pressed','false');root.append(toggle);
    for(const verb of unit.conjugations??[]){
      const card=el('article','extra-card');const header=el('div','extra-verb-head');header.append(langText('h3','extra-verb-title',verb.verb,language),audio.speakButton(verb.verb,'동사원형 듣기'));card.append(header,el('p','extra-meaning',[verb.ko,verb.group?`${verb.group}군 동사`:''].filter(Boolean).join(' · ')));
      for(const tense of verb.tenses??[]){
        card.append(el('h4','conjugation-tense',tense.name));const grid=el('div','conjugation-grid');
        const forms=tense.forms??[];const ordered=forms.length===6?[0,3,1,4,2,5].map(i=>forms[i]):forms;
        for(const form of ordered){
          const cell=el('div','conjugation-cell');cell.append(langText('span','muted',form.person,language));
          const line=el('div','conjugation-line');const b=button('','conjugation-form',()=>{if(hidden){b.dataset.revealed=String(b.dataset.revealed!=='true');update();}else audio.speak(spoken);});b.lang=language;b.dataset.revealed='false';
          const spoken=`${form.person.endsWith('’')?form.person:form.person+' '}${form.form}`.replace('il/elle','il').replace('ils/elles','ils');
          const speak=audio.speakButton(spoken,'동사 변형 듣기');
          function update(){const masked=hidden&&b.dataset.revealed!=='true';b.textContent=masked?'••••••':form.form;b.classList.toggle('masked',masked);b.setAttribute('aria-label',masked?`${form.person} 변형 보기`:`${form.person} ${form.form}`);speak.hidden=masked;}
          formButtons.push({b,update});update();line.append(b,speak);cell.append(line);grid.append(cell);
        }card.append(grid);if(tense.note)card.append(el('p','extra-notes',tense.note));
      }root.append(card);
    }if(!(unit.conjugations??[]).length)root.append(empty());return root;
  }
  function notesView(entries){
    const root=el('section','extra-stack');for(const entry of entries??[]){const card=el('article','extra-card');card.append(el('h3','extra-verb-title',entry.title));if(entry.rule)card.append(el('p','extra-notes',entry.rule));if(entry.description)card.append(el('p','',entry.description));for(const ex of entry.examples??[])card.append(exampleRow(ex));root.append(card);}if(!root.childElementCount)root.append(empty());return root;
  }
  const views=[['dialogue','회화',dialogueView],['vocabulary','어휘·표현',()=>createVocabulary(words,audio,{language,languageLabel:label})],['conjugations','동사 변형',conjugationView],['grammar','문법',()=>notesView(unit.grammar)],['expressions','유용한 표현',()=>notesView(unit.expressions)],['exercises','연습 문제',()=>{const wrap=el('section','extra-stack');if(unit.exerciseSource)wrap.append(el('p','muted',unit.exerciseSource));wrap.append(createExerciseView(unit.exercises,unit.loadError,{language,categories:[['vocabulary','어휘'],['conjugation','동사 변형'],['grammar','문법'],['practice','회화']]}));return wrap;}]];
  const buttons=new Map(),cache=new Map();
  function switchView(id){audio.stopSpeech();if(dialog.open)dialog.close();for(const [key,b] of buttons){b.classList.toggle('active',key===id);b.setAttribute('aria-pressed',String(key===id));}if(!cache.has(id))cache.set(id,views.find(v=>v[0]===id)[2]());content.replaceChildren(cache.get(id));}
  for(const [id,text] of views){const b=button(text,'tab-button',()=>switchView(id));buttons.set(id,b);tabs.append(b);}
  container.replaceChildren(heading,title,audio.unitButton,tabs,content,dialog,audio.player);switchView('dialogue');
  return ()=>{if(dialog.open)dialog.close();audio.destroy();cache.clear();};
}
