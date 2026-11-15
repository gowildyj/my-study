function el(tag,className='',text=''){const node=document.createElement(tag);node.className=className;node.textContent=text;return node;}
function btn(label,className,handler){const node=el('button',className,label);node.type='button';node.addEventListener('click',handler);return node;}
function empty(error){return el('p','empty-state',error?'추가 학습 자료를 불러오지 못했습니다.':'아직 등록된 학습 자료가 없습니다.');}
export function createVerbView(verbs,audio,error=false){
  const root=el('section','extra-stack');if(!Array.isArray(verbs)||!verbs.length){root.append(empty(error));return root;}
  root.append(el('h2','extra-heading','How to Use Verbs in Sentences'));
  for(const [i,verb] of verbs.entries()){
    const card=el('article','extra-card');const head=el('div','extra-verb-head');const title=el('h3','extra-verb-title',`${i+1}. ${verb.en}`);title.lang='en';head.append(title,audio.speakButton(verb.en,'영어 동사 듣기'));card.append(head,el('p','extra-meaning',verb.ko));
    for(const example of verb.examples??[]){const row=el('div','extra-example');const line=el('div','sentence-audio-row');const en=el('p','sentence-en',example.en);en.lang='en';line.append(en,audio.speakButton(example.en,'영어 예문 듣기'));row.append(line,el('p','sentence-ko',example.ko));card.append(row);}
    if(verb.notes?.length){const notes=el('div','extra-notes');for(const note of verb.notes)notes.append(el('p','',note));card.append(notes);}root.append(card);
  }return root;
}
function normalize(value){return String(value??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ').replace(/[.!?]+$/,'');}
function matches(value,accepted){return (Array.isArray(accepted)?accepted:[accepted]).some(answer=>normalize(value)===normalize(answer));}
export function createExerciseView(exercises,error=false){
  const root=el('section','extra-stack');if(!exercises||!['vocabulary','practice'].some(k=>exercises[k]?.length)){root.append(empty(error));return root;}
  const tabs=el('div','extra-switch');const summary=el('p','extra-summary');summary.setAttribute('aria-live','polite');const list=el('div','extra-stack');const actions=el('div','extra-switch');
  const state={vocabulary:new Map(),practice:new Map()};let category=exercises.vocabulary?.length?'vocabulary':'practice',wrongOnly=false,showTranslations=false;
  function addTranslation(parent,value,tag='p'){if(typeof value!=='string'||!value.trim())return;const node=el(tag,'extra-translation',value);node.lang='ko';parent.append(node);}
  const categories=[['vocabulary','어휘 연습'],['practice','연습 문제']];const buttons=new Map();
  for(const [key,label] of categories){if(!exercises[key]?.length)continue;const control=btn(label,'vocabulary-control',()=>{category=key;wrongOnly=false;render();});buttons.set(key,control);tabs.append(control);}
  const reset=btn('전체 다시 풀기','vocabulary-control',()=>{state[category].clear();wrongOnly=false;render();});const retry=btn('틀린 문제 다시 풀기','vocabulary-control',()=>{wrongOnly=true;render();});actions.append(reset,retry);
  const translationToggle=btn('번역 보기','vocabulary-control extra-translation-toggle',()=>{showTranslations=!showTranslations;root.classList.toggle('show-translations',showTranslations);translationToggle.textContent=showTranslations?'번역 숨기기':'번역 보기';translationToggle.setAttribute('aria-pressed',String(showTranslations));});
  translationToggle.setAttribute('aria-pressed','false');root.append(tabs,translationToggle,summary,list,actions);
  function stats(){const all=exercises[category]??[];const records=[...state[category].values()];const correct=records.filter(r=>r.status==='correct').length;const wrong=records.filter(r=>r.status==='wrong').length;const manual=records.filter(r=>r.status==='review'||r.status==='revealed').length;summary.textContent=`전체 ${all.length}문제 · 정답 ${correct} · 오답 ${wrong} · 직접 확인 ${manual}`;retry.disabled=wrong===0;}
  function renderQuestion(q,index){
    const card=el('article','extra-card');card.append(el('p','eyebrow',`QUESTION ${String(index+1).padStart(2,'0')}`),el('h3','extra-question',q.prompt));addTranslation(card,q.promptKo);
    const body=el('div','extra-stack');const feedback=el('div','extra-feedback');feedback.hidden=true;feedback.setAttribute('role','status');const store=state[category];let record=store.get(index);
    const controls=[];const choices=[];
    function showFeedback(){if(!record){feedback.hidden=true;return;}feedback.hidden=false;feedback.className=`extra-feedback ${record.status}`;const title=record.status==='correct'?'정답입니다.':record.status==='wrong'?'오답입니다.':record.status==='revealed'?'정답을 확인해 보세요.':'모범 답안과 비교해 보세요.';feedback.replaceChildren(el('strong','',title));if(q.type==='choice'){if(record.status!=='correct')feedback.append(el('p','',`${String.fromCharCode(65+q.answer)}. ${q.options[q.answer]}`));}else if(q.type==='manual'){feedback.append(el('p','',q.sample??''));addTranslation(feedback,q.sampleKo);}else {const answers=q.answers??[];const display=q.unordered&&q.distinct?`가능한 정답 (서로 다른 ${answers.length}개): ${[...new Set(answers.flat())].join(' / ')}`:answers.map((a,i)=>`${answers.length>1?`${i+1}) `:''}${Array.isArray(a)?a.join(' / '):a}`).join('\n');feedback.append(el('p','',display));}if(q.explanation)feedback.append(el('p','',q.explanation.replace(/^정답:\s*/,'')));}
    function paintChoices(){for(const [i,control] of choices.entries()){control.classList.toggle('correct',Boolean(record)&&i===q.answer);control.classList.toggle('wrong',record?.status==='wrong'&&i===record.value);control.setAttribute('aria-pressed',String(record?.value===i));control.disabled=Boolean(record);}}
    function submit(value,status){record={value,status};store.set(index,record);for(const control of controls)control.disabled=true;paintChoices();showFeedback();stats();}
    if(q.type==='choice'){
      for(const [i,option] of q.options.entries()){const control=btn(`${String.fromCharCode(65+i)}. ${option}`,'extra-choice',()=>submit(i,i===q.answer?'correct':'wrong'));addTranslation(control,q.optionsKo?.[i],'span');choices.push(control);body.append(control);}paintChoices();
    }else{
      const prompts=q.items?.length?q.items:['답안'];const inputs=[];
      for(const [i,prompt] of prompts.entries()){const label=el('label','extra-input-label',prompt);const input=el(q.type==='manual'?'textarea':'input','extra-input');if(input.tagName==='INPUT'){input.type='text';input.autocomplete='off';}else input.rows=3;input.lang='en';input.spellcheck=false;input.value=record?.value?.[i]??'';addTranslation(label,q.itemsKo?.[i],'span');label.append(input);body.append(label);inputs.push(input);controls.push(input);}
      const check=btn(q.type==='manual'?'모범 답안 보기':'정답 확인','extra-primary',()=>{const values=inputs.map(input=>input.value);if(q.type!=='manual'&&values.some(v=>!v.trim())){if(category==='vocabulary'){submit(values,'revealed');return;}feedback.hidden=false;feedback.className='extra-feedback';feedback.textContent='답안을 모두 입력해 주세요.';return;}let correct=false;if(q.type!=='manual'){if(q.distinct && new Set(values.map(normalize)).size!==values.length){correct=false;}else if(q.unordered){const remaining=[...(q.answers??[])];correct=values.length===remaining.length&&values.every(v=>{const i=remaining.findIndex(a=>matches(v,a));if(i<0)return false;remaining.splice(i,1);return true;});}else correct=values.length===(q.answers??[]).length&&values.every((v,i)=>matches(v,q.answers[i]));}submit(values,q.type==='manual'?'review':correct?'correct':'wrong');});controls.push(check);body.append(check);for(const control of controls)control.disabled=Boolean(record);
    }
    const again=btn('이 문제 다시 풀기','extra-retry',()=>{store.delete(index);card.replaceWith(renderQuestion(q,index));stats();});card.append(body,feedback,again);showFeedback();return card;
  }
  function render(){for(const [key,control] of buttons){control.classList.toggle('active',key===category);control.setAttribute('aria-pressed',String(key===category));}list.replaceChildren();const all=exercises[category]??[];const target=all.map((q,i)=>[q,i]).filter(([,i])=>!wrongOnly||state[category].get(i)?.status==='wrong');if(!target.length)list.append(el('p','empty-state',wrongOnly?'다시 풀 오답이 없습니다.':'등록된 문제가 없습니다.'));for(const [q,i] of target){if(wrongOnly)state[category].delete(i);list.append(renderQuestion(q,i));}stats();}
  render();return root;
}
