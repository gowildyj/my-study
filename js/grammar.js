/**
 * My Study — French Basic Grammar reader.
 * All content is decrypted by existing readJson; never fetch public slide URLs.
 */
const el = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};
const btn = (label, onClick, className = 'fg-button') => {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
};
const section = () => el('section', 'fg-section');

/** An independent, compact view so existing language/conversation renderers stay untouched. */
export function renderGrammar(app, subject, unit) {
  let active = '표현 따라읽기';
  let translationsVisible = false;
  let page = 0;
  let zoomed = false;
  let dead = false;
  let selected = new Map();
  const slides = Array.isArray(unit.slides) ? unit.slides : [];
  const tabs = ['표현 따라읽기', '주요 어휘 따라읽기', '문법 해설', '동사 변형', '연습 문제', '원본 강의록'];
  const root = el('div', 'fg-root');
  const heading = el('div', 'page-heading');
  const back = el('a', 'back-button', '‹');
  back.href = `#/${encodeURIComponent(subject.id)}`;
  back.setAttribute('aria-label', '과목 목록으로');
  heading.append(back, el('h1', '', `${unit.unit}강`));
  const title = el('h2', 'fg-title', unit.title || `${unit.unit}강`);
  const summary = el('p', 'fg-caption', '강의록의 핵심 표현 1~10번을 듣고 따라 읽으세요. 번역은 필요할 때만 펼쳐 볼 수 있습니다.');
  const tabBar = el('nav', 'fg-tabs');
  tabBar.setAttribute('aria-label', '강의별 학습 메뉴');
  const content = section();
  root.append(heading, title, summary, tabBar, content);
  app.replaceChildren(root);

  const speak = (value) => {
    if (!value || dead || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };
  const voice = (value) => btn('🔊', () => speak(value), 'fg-voice');

  function goSource(pageNumber) {
    const next = Number(pageNumber) - 1;
    if (!Number.isInteger(next) || next < 0 || next >= slides.length) return;
    page = next;
    active = '원본 강의록';
    paint();
    root.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function pageLink(pageNumber, label = null) {
    return btn(label ?? `${pageNumber}쪽`, () => goSource(pageNumber), 'fg-page-link');
  }
  function paintTabs() {
    tabBar.replaceChildren();
    for (const tab of tabs) {
      const b = btn(tab, () => {
        active = tab;
        selected = new Map();
        paint();
      }, `fg-tab${active === tab ? ' active' : ''}`);
      b.setAttribute('aria-pressed', String(active === tab));
      tabBar.append(b);
    }
  }
  function pageReader() {
    const reader = el('div', 'fg-reader');
    if (!slides.length) {
      reader.append(el('p', 'fg-note', '원본 페이지 데이터가 없습니다.'));
      return reader;
    }
    const searchBox = el('div', 'fg-search');
    const search = el('input', 'fg-search-field');
    search.type = 'search';
    search.placeholder = '원본 강의록의 텍스트 검색';
    search.setAttribute('aria-label', '강의록 내용 검색');
    const hits = el('div', 'fg-search-results');
    search.addEventListener('input', () => {
      hits.replaceChildren();
      const q = search.value.trim().toLocaleLowerCase();
      if (q.length < 2) return;
      const results = slides.filter(s => (s.text || '').toLocaleLowerCase().includes(q)).slice(0, 40);
      hits.append(el('p', 'fg-caption', `검색 결과: ${results.length}${results.length === 40 ? '개 이상' : '개'} 페이지`));
      for (const slide of results) {
        const lines = (slide.text || '').split('\n').filter(Boolean);
        const match = lines.find(line => line.toLocaleLowerCase().includes(q)) || slide.title;
        hits.append(pageLink(slide.page, `${slide.page}쪽 · ${match.slice(0, 85)}`));
      }
    });
    searchBox.append(search, hits);
    reader.append(searchBox);

    const row = el('div', 'fg-page-nav');
    const previous = btn('← 이전', () => { if (page > 0) { page--; paint(); } });
    const next = btn('다음 →', () => { if (page < slides.length - 1) { page++; paint(); } });
    const pageSelect = document.createElement('select');
    pageSelect.className = 'fg-page-select';
    pageSelect.setAttribute('aria-label', '페이지 선택');
    slides.forEach((slide, idx) => {
      const opt = el('option', '', `${slide.page} / ${slides.length}쪽 · ${slide.section || '강의'}`);
      opt.value = String(idx);
      pageSelect.append(opt);
    });
    pageSelect.value = String(page);
    pageSelect.addEventListener('change', () => { page = Number(pageSelect.value); paint(); });
    previous.disabled = page === 0;
    next.disabled = page === slides.length - 1;
    row.append(previous, pageSelect, next);
    const current = slides[page];
    const card = el('article', 'fg-page');
    card.append(el('p', 'fg-kicker', `${current.section || '강의'} · 원본 ${current.page}쪽`));
    if (current.title) card.append(el('h3', 'fg-page-title', current.title));
    const imageWrap = el('div', `fg-slide${zoomed ? ' fg-zoom' : ''}`);
    const img = document.createElement('img');
    img.className = 'fg-slide-image';
    img.alt = `${unit.unit}강 ${current.page}쪽 원본 슬라이드`;
    img.loading = 'eager';
    img.decoding = 'async';
    img.src = current.image;
    imageWrap.append(img);
    const zoom = btn(zoomed ? '원래 크기로' : '확대해서 보기', () => { zoomed = !zoomed; imageWrap.classList.toggle('fg-zoom', zoomed); zoom.textContent = zoomed ? '원래 크기로' : '확대해서 보기'; });
    const sourceText = el('details', 'fg-source-text');
    const toggle = el('summary', '', '원문 텍스트 펼치기 · 복사 가능');
    sourceText.append(toggle, el('pre', '', current.text || '텍스트 추출이 지원되지 않는 페이지입니다. 원본 이미지를 확인하세요.'));
    card.append(imageWrap, zoom, sourceText);
    reader.append(row, card);
    const rowBottom = el('div', 'fg-page-nav');
    const prevBottom = btn('← 이전 페이지', () => { if (page > 0) { page--; paint(); window.scrollTo({ top: 0, behavior: 'instant' }); } });
    const nextBottom = btn('다음 페이지 →', () => { if (page < slides.length - 1) { page++; paint(); window.scrollTo({ top: 0, behavior: 'instant' }); } });
    prevBottom.disabled = page === 0;nextBottom.disabled = page === slides.length - 1;
    rowBottom.append(prevBottom, nextBottom);
    reader.append(rowBottom);
    return reader;
  }
  function grammarGuide() {
    const wrap = section();
    wrap.append(el('p', 'fg-caption', '강의 핵심 문법과 추가 해설을 예문과 함께 학습합니다.'));
    for (const topic of unit.guide || []) {
      const card = el('article', 'fg-card');
      card.append(el('h3', 'fg-card-title', topic.title));
      if (topic.rule) {
        const block = el('div', 'fg-rule');
        block.append(el('span', 'fg-kicker', '강의록 내용 정리'), el('p', '', topic.rule));
        card.append(block);
      }
      if (topic.supplement) {
        const block = el('div', 'fg-explain');
        block.append(el('span', 'fg-kicker', '보충 설명'), el('p', '', topic.supplement));
        card.append(block);
      }
      for (const ex of topic.examples || []) {
        const box = el('div', 'fg-example');
        const head = el('div', 'fg-example-head');head.append(el('p', 'fg-french', ex.fr), voice(ex.fr));
        box.append(head, el('p', 'fg-meaning', ex.ko));card.append(box);
      }
      wrap.append(card);
    }
    if (!unit.guide?.length) wrap.append(el('p', 'fg-note', '원본 강의록을 확인하세요.'));
    return wrap;
  }
  function conjugations() {
    const wrap = section();
    wrap.append(el('p', 'fg-caption', '단수/복수 순서로 직설법 현재를 정리했습니다. 원본 변화표가 없는 항목은 임의로 표시하지 않습니다.'));
    const names = ['je','tu','il/elle/on','nous','vous','ils/elles'];
    for (const verb of unit.conjugations || []) {
      const card = el('article', 'fg-card');
      const h = el('div', 'fg-verb-head');h.append(el('h3', 'fg-verb-title', verb.verb),voice(verb.verb));
      card.append(h,el('p', 'fg-meaning', `${verb.ko} · ${verb.group}군${verb.participle ? ' · 과거분사: '+verb.participle : ''}`));
      const list = el('div', 'fg-verb-list');
      verb.forms.forEach((form,i) => {
        const line = el('div', 'fg-verb-line');
        const phrase = (i===0 && /^[aàâäeéèêëiîïoôöuùûühyœæ]/i.test(form) ? 'j’' : names[i].split('/')[0]+' ')+form;
        line.append(el('span', 'fg-pronoun', names[i]),el('strong', 'fg-form', form),voice(phrase));
        list.append(line);
      });
      card.append(list);
      wrap.append(card);
    }
    if (!unit.conjugations?.length) wrap.append(el('p', 'fg-note', '이번 강의에는 별도의 동사 변화표가 없습니다. 원본 강의록의 관사·표현 학습을 확인하세요.'));
    return wrap;
  }
  /** All "주요 어휘 따라읽기" rows, in the lecturer's original order. */
  function vocabulary() {
    const wrap = section();
    const sourceRows = Array.isArray(unit.vocabularyReading) ? unit.vocabularyReading : [];
    const previousRows = Array.isArray(unit.vocabulary) ? unit.vocabulary : [];
    const exactSourceTerms = new Set(sourceRows.map(row => row.fr.normalize('NFC').toLocaleLowerCase()));
    const supplemental = previousRows.filter(row => !exactSourceTerms.has(row.fr.normalize('NFC').toLocaleLowerCase()));
    const total = sourceRows.length + supplemental.length;
    const filter = el('input', 'fg-search-field');
    filter.type = 'search';
    filter.placeholder = '프랑스어 단어·품사·한국어 뜻 검색';
    filter.setAttribute('aria-label', '전체 어휘 검색');
    const results = el('div', 'fg-vocab-list');
    const count = el('p', 'fg-caption', `강의록 ‘주요 어휘 따라읽기’ ${sourceRows.length}개 · 기존 보충 어휘 ${supplemental.length}개`);
    if (!sourceRows.length) {
      wrap.append(el('p', 'fg-note', '원본 주요 어휘를 등록하지 않았습니다. update-french-grammar-vocabulary.mjs를 실행하고 다시 암호화해 주세요.'));
    }
    const appendWord = (row) => {
      const line = el('div', 'fg-vocab-row');
      const left = el('div', 'fg-vocab-left');
      const name = el('strong', 'fg-french', row.fr);
      name.lang = 'fr';
      left.append(name);
      if (row.partOfSpeech) left.append(el('span', 'fg-kicker', row.partOfSpeech));
      left.append(el('span', 'fg-meaning', row.ko));
      const play = voice(row.fr);
      play.setAttribute('aria-label', `${row.fr} 발음 듣기`);
      line.append(left, play);
      results.append(line);
    };
    function refresh() {
      results.replaceChildren();
      const q = filter.value.toLocaleLowerCase().trim();
      const matches = row => !q || `${row.fr} ${row.partOfSpeech ?? ''} ${row.ko}`.toLocaleLowerCase().includes(q);
      const sources = sourceRows.filter(matches);
      const extras = supplemental.filter(matches);
      if (sources.length) {
        const title = el('h3', 'fg-vocab-subtitle', `강의록 주요 어휘 ${sources.length}개`);
        results.append(title);
        for (const word of sources) appendWord(word);
      }
      if (extras.length) {
        results.append(el('h3', 'fg-vocab-subtitle', `기존 보충 어휘 ${extras.length}개`));
        for (const word of extras) appendWord(word);
      }
      if (!sources.length && !extras.length) results.append(el('p', 'fg-note', '검색 결과가 없습니다.'));
    }
    filter.addEventListener('input', refresh);
    wrap.append(count, filter, results);
    refresh();
    return wrap;
  }
  /** The ten original "표현 따라읽기" groups are the primary learning view. */
  function readingPractice() {
    const wrap = section();
    const groups = Array.isArray(unit.expressionReading) ? unit.expressionReading : [];
    if (!groups.length) {
      wrap.append(el('p', 'fg-note', '표현 따라읽기 데이터가 없습니다. 학습 데이터 업데이트 스크립트를 실행한 뒤 다시 암호화해 주세요.'));
      return wrap;
    }

    const totalSentences = groups.reduce((total, group) => total + group.lines.length, 0);
    const controls = el('div', 'fg-reading-controls');
    const overview = el('p', 'fg-caption', `표현 ${groups.length}묶음 · 문장 ${totalSentences}개`);
    const reveal = btn(translationsVisible ? '번역 가리기' : '번역 보기', () => {
      translationsVisible = !translationsVisible;
      reveal.textContent = translationsVisible ? '번역 가리기' : '번역 보기';
      reveal.setAttribute('aria-pressed', String(translationsVisible));
      for (const meaning of translationNodes) meaning.hidden = !translationsVisible;
    }, 'fg-translation-toggle');
    reveal.setAttribute('aria-pressed', String(translationsVisible));
    controls.append(overview, reveal);

    const filter = el('input', 'fg-search-field');
    filter.type = 'search';
    filter.placeholder = '프랑스어 문장·한국어 해석 검색';
    filter.setAttribute('aria-label', '표현 따라읽기 문장 검색');
    const results = el('div', 'fg-reading-list');
    let translationNodes = [];

    function refresh() {
      results.replaceChildren();
      translationNodes = [];
      const query = filter.value.trim().toLocaleLowerCase();
      let matched = 0;
      for (const group of groups) {
        const hasMatch = !query || group.lines.some(({fr, ko}) => `${fr} ${ko}`.toLocaleLowerCase().includes(query));
        if (!hasMatch) continue;
        matched++;
        const card = el('article', 'fg-reading-group');
        card.append(el('h3', 'fg-reading-number', `${group.number}번`));
        for (const line of group.lines) {
          const item = el('div', 'fg-reading-line');
          const head = el('div', 'fg-example-head');
          const french = el('p', 'fg-french', line.fr);
          french.lang = 'fr';
          const play = voice(line.fr);
          play.setAttribute('aria-label', `${group.number}번 프랑스어 문장 듣기`);
          head.append(french, play);
          const meaning = el('p', 'fg-meaning fg-reading-translation', line.ko);
          meaning.lang = 'ko';
          meaning.hidden = !translationsVisible;
          translationNodes.push(meaning);
          item.append(head, meaning);
          card.append(item);
        }
        results.append(card);
      }
      if (!matched) results.append(el('p', 'fg-note', '검색 결과가 없습니다.'));
    }

    filter.addEventListener('input', refresh);
    wrap.append(controls, filter, results);
    refresh();
    return wrap;
  }
  function quiz() {
    const wrap=section(),questions=unit.exercises?.questions||[],list=el('div','fg-section');
    const status=el('p','fg-caption');
    const reset=btn('처음부터 다시 풀기',()=>{selected=new Map();fill();});
    function fill(){
      list.replaceChildren();const correct=questions.filter(q=>selected.get(q.id)===q.answer).length;
      status.textContent=`${questions.length}문제 · 응답 ${selected.size}개 · 정답 ${correct}개`;
      questions.forEach((q,i)=>{
        const card=el('article','fg-card');card.append(el('p','fg-kicker',`${i+1} / ${questions.length} · 강의록 기반 자체 제작 문제`),el('h3','fg-quiz-title',q.prompt));
        const answer=selected.get(q.id);
        q.options.forEach((value,n)=>{
          const b=btn(`${n+1}. ${value}`,()=>{if(selected.has(q.id))return;selected.set(q.id,n);fill();},'fg-quiz-option');
          if(answer!==undefined){b.disabled=true;if(n===q.answer)b.classList.add('is-correct');if(n===answer&&n!==q.answer)b.classList.add('is-wrong');}
          card.append(b);
        });
        if(answer!==undefined){
          const result=el('div','fg-answer');result.append(el('strong','',answer===q.answer?'정답입니다.':'오답입니다.'));
          if(q.explanation)result.append(el('p','',q.explanation));card.append(result);
        }
        list.append(card);
      });
    }
    wrap.append(el('p','fg-note','이 문제들은 강의 내용을 활용해 새로 만든 학습용 객관식입니다. 실제 기출문제 또는 강의록 원문 문제라고 표시하지 않습니다.'),status,reset,list);fill();return wrap;
  }
  function paint() {
    if (dead) return;
    paintTabs();
    const build = active === '표현 따라읽기' ? readingPractice : active === '문법 해설' ? grammarGuide : active === '동사 변형' ? conjugations : active === '주요 어휘 따라읽기' ? vocabulary : active === '연습 문제' ? quiz : pageReader;
    content.replaceChildren(build());
  }
  paint();
  return () => { dead = true; window.speechSynthesis?.cancel(); root.replaceChildren(); };
}
