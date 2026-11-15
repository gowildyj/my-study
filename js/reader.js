import { createVocabulary } from './vocabulary.js';
import { createUnitAudio } from './audio.js';
import { createVerbView, createExerciseView } from './study-extra.js';
function el(tag, className='', text='') { const node=document.createElement(tag); node.className=className; node.textContent=text; return node; }
export function plainText(text) { return text.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g,'$2'); }
function appendMarkedText(container,text,renderWord) {
  let cursor=0;
  for(const match of text.matchAll(/\[\[([^|\]]+)\|([^\]]+)\]\]/g)) {
    container.append(document.createTextNode(text.slice(cursor,match.index)),renderWord(match[1],match[2])); cursor=match.index+match[0].length;
  }
  container.append(document.createTextNode(text.slice(cursor)));
}
export function renderReader(container,subject,unit) {
  let currentView='english';
  const audio=createUnitAudio(unit,container);
  const wordMap=new Map(unit.words.map(word=>[word.id,word]));
  const heading=el('div','page-heading'); const back=el('a','back-button','‹'); back.href=`#/${subject.id}`; back.setAttribute('aria-label','단원 목록으로 돌아가기'); heading.append(back,el('h1','',`${subject.unitLabel||'Unit'} ${unit.unit}`));
  const tabs=el('nav','tabs extended-tabs'); tabs.setAttribute('aria-label','학습 방식');
  const content=el('section','reader-card');
  const views=[['english','영어보기'],['translation','번역보기'],['words','단어보기'],['verbs','동사 활용'],['exercises','연습 문제']];
  const tabButtons=new Map();
  for(const [id,label] of views){const button=el('button','tab-button',label);button.type='button';button.addEventListener('click',()=>{currentView=id;updateView();});tabButtons.set(id,button);tabs.append(button);}
  const dialog=el('dialog','word-sheet');dialog.setAttribute('aria-labelledby','sheet-word-title'); const sheetContent=el('div','sheet-content');dialog.append(sheetContent);
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>audio.stopSpeech());
  function openWord(word,sentence){
    const handle=el('div','sheet-handle');handle.setAttribute('aria-hidden','true');const header=el('div','sheet-header');const close=el('button','sheet-close','×');close.type='button';close.setAttribute('aria-label','닫기');close.addEventListener('click',()=>dialog.close());
    const title=el('h2','sheet-word',word.en);title.id='sheet-word-title';title.lang='en';const wordHeading=el('div','sheet-word-heading');wordHeading.append(title,audio.speakButton(word.en,'영어 단어 듣기'));header.append(wordHeading,close);
    sheetContent.replaceChildren(handle,header,el('p','sheet-meaning',word.ko));
    if(sentence){const example=el('div','sheet-example');const en=el('p','sheet-example-en');en.lang='en';appendMarkedText(en,sentence.en,(id,value)=>id===word.id?el('span','word-highlight',value):document.createTextNode(value));const line=el('div','sentence-audio-row');line.append(en,audio.speakButton(plainText(sentence.en),'영어 문장 듣기'));example.append(el('p','muted','본문 속 문장'),line,el('p','sentence-ko',sentence.ko));sheetContent.append(example);}
    if(!dialog.open)dialog.showModal();
  }
  function renderReading(){
    content.append(el('p','eyebrow',`UNIT ${String(unit.unit).padStart(2,'0')}`),el('h2','reader-title',unit.title));
    for(const [index,paragraph] of unit.paragraphs.entries()){
      const group=el('div','paragraph');group.append(el('p','paragraph-number',String(index+1)));
      for(const sentence of paragraph){const row=el('div','sentence');const en=el('p','sentence-en');en.lang='en';appendMarkedText(en,sentence.en,(id,value)=>{const word=wordMap.get(id);if(!word)return document.createTextNode(value);const btn=el('button','word-link',value);btn.type='button';btn.setAttribute('aria-label',`${value} 단어 뜻 보기`);btn.addEventListener('click',()=>openWord(word,sentence));return btn;});const line=el('div','sentence-audio-row');line.append(en,audio.speakButton(plainText(sentence.en),'영어 문장 듣기'));row.append(line);if(currentView==='translation')row.append(el('p','sentence-ko',sentence.ko));group.append(row);}content.append(group);
    }
  }
  const vocabulary=createVocabulary(unit.words,audio);
  const verbs=createVerbView(unit.verbs,audio,unit.loadError);
  const exercises=createExerciseView(unit.exercises,unit.loadError);
  function updateView(){audio.stopSpeech();if(dialog.open)dialog.close();for(const [id,button] of tabButtons){const active=id===currentView;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}content.classList.toggle('vocabulary-view',currentView==='words'||currentView==='verbs'||currentView==='exercises');content.replaceChildren();if(currentView==='words')content.append(vocabulary);else if(currentView==='verbs')content.append(verbs);else if(currentView==='exercises')content.append(exercises);else renderReading();}
  container.replaceChildren(heading,audio.unitButton,tabs,content,dialog,audio.player);updateView();
  return ()=>{if(dialog.open)dialog.close();audio.destroy();};
}
