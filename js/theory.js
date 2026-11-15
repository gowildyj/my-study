import {readJson} from './crypto.js';
import {createExamView} from './exam.js';

function el(tag, cls = '', text = '') {
  const n = document.createElement(tag); n.className = cls; n.textContent = text; return n;
}
function button(text, action) {
  const b = el('button', 'vocabulary-control', text); b.type = 'button'; b.addEventListener('click', action); return b;
}
export function renderTheory(app, subject, unit, {loadPage = readJson} = {}) {
  let disposed = false, generation = 0;
  const root = el('section', 'theory-stack');
  const heading = el('div', 'page-heading'); const back = el('a', 'back-button', '‹');
  back.href = `#/${subject.id}`; back.setAttribute('aria-label', '강의 목록으로');
  heading.append(back, el('h1', '', `${unit.number}강 · ${unit.title}`));
  const notice = el('p', 'theory-notice', unit.reviewNotice ?? '원본 강의록과 AI 보충 설명을 구분하여 학습하세요.');
  const tabs = el('nav', 'theory-tabs'); tabs.setAttribute('aria-label', '강의 학습 메뉴');
  const panel = el('section', 'theory-stack');
  const dialog = el('dialog', 'theory-image-dialog');
  const close = button('닫기', () => dialog.close());
  const imageScroll = el('div', 'theory-image-scroll'); dialog.append(close, imageScroll);
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  root.append(heading, notice, tabs, panel, dialog); app.replaceChildren(root);
  function imageView(data, label) {
    if (typeof data !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(data)) {
      throw new Error('Only embedded study images are supported');
    }
    const figure = el('figure', 'theory-figure');
    const b = button('', () => {
      imageScroll.replaceChildren(); const large = el('img'); large.src = data; large.alt = label;
      imageScroll.append(large); dialog.showModal();
    });
    b.className = 'theory-image-button'; b.setAttribute('aria-label', `${label} 확대`);
    const img = el('img'); img.src = data; img.alt = label; img.loading = 'lazy';
    b.append(img); figure.append(b, el('figcaption', '', `${label} · 클릭하여 확대`)); return figure;
  }
  function card(item, supplementary = true) {
    const c = el('article', supplementary ? 'theory-card theory-supplement' : 'theory-card');
    c.append(el('p', 'eyebrow', supplementary ? 'AI 보충 설명' : '강의록 원본'), el('h3', '', item.title));
    if (item.sourcePages?.length) c.append(el('p', 'muted', `관련 원본 ${item.sourcePages.join(', ')}쪽`));
    for (const text of item.paragraphs ?? []) c.append(el('p', 'theory-text', text));
    if (item.expression) c.append(el('pre', 'theory-formula', item.expression));
    if (item.table) {
      const scroll = el('div', 'theory-table-scroll');
      scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', item.title);
      const table = el('table', 'theory-table'); table.append(el('caption', '', item.table.caption ?? item.title));
      const head = el('thead'), header = el('tr');
      for (const value of item.table.headers) { const th = el('th', '', value); th.scope = 'col'; header.append(th); }
      head.append(header); table.append(head);
      const body = el('tbody');
      for (const row of item.table.rows) { const tr = el('tr'); for (const value of row) tr.append(el('td', '', value)); body.append(tr); }
      table.append(body); scroll.append(table); c.append(scroll);
    }
    for (const text of item.steps ?? []) c.append(el('p', 'theory-text', text));
    return c;
  }
  function concepts() {
    const wrap = el('div', 'theory-stack'), controls = el('div', 'extra-switch'), list = el('div', 'theory-stack');
    let hidden = true, terms = [...(unit.concepts ?? [])];
    function draw() {
      list.replaceChildren();
      for (const term of terms) {
        const c = el('article', 'theory-card'); c.append(el('h3', '', term.ko), el('p', 'muted', term.en));
        const definition = el('div', 'theory-stack'); definition.hidden = hidden;
        definition.append(el('p', '', term.definition), el('p', 'theory-supplement', `구분: ${term.difference}`), el('p', 'muted', `AI 작성 · 관련 원본 ${term.sourcePages.join(', ')}쪽`));
        const toggle = button(hidden ? '정의 보기' : '정의 가리기', () => { definition.hidden = !definition.hidden; toggle.textContent = definition.hidden ? '정의 보기' : '정의 가리기'; toggle.setAttribute('aria-expanded', String(!definition.hidden)); });
        toggle.setAttribute('aria-expanded', String(!hidden)); c.append(toggle, definition); list.append(c);
      }
    }
    controls.append(button('전체 정의 보기/가리기', () => { hidden = !hidden; draw(); }), button('랜덤 순서', () => {
      for (let i = terms.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [terms[i], terms[j]] = [terms[j], terms[i]]; } draw();
    })); wrap.append(controls, list); draw(); return wrap;
  }
  async function sourcePage(meta, target, token) {
    target.replaceChildren(el('p', '', '원본 페이지를 불러오는 중…'));
    try {
      const data = await loadPage(meta.path);
      if (disposed || token !== generation || !target.isConnected) return;
      target.replaceChildren(imageView(data.image, `${meta.label ?? unit.title} ${meta.page}쪽`));
      const text = el('details'); text.append(el('summary', '', '텍스트 추출본 보기 · 수식과 표는 원본 이미지 우선'), el('pre', 'theory-source-text', data.text)); target.append(text);
    } catch {
      if (!disposed && token === generation && target.isConnected) target.replaceChildren(el('p', 'theory-notice', '원본 페이지를 불러오지 못했습니다.'), button('다시 시도', () => sourcePage(meta, target, token)));
    }
  }
  function pageDetails(meta, token) {
    const details = el('details', 'theory-source-page');
    details.append(el('summary', '', `${meta.page}쪽 · ${meta.title ?? meta.label ?? '원본 문제'}`));
    const body = el('div', 'theory-stack'); details.append(body);
    details.addEventListener('toggle', () => {
      if (details.open && !body.childElementCount) sourcePage(meta, body, token);
    }); return details;
  }
  function theory(token) {
    const wrap = el('div', 'theory-stack'), search = el('input', 'theory-search'), list = el('div', 'theory-stack');
    search.type = 'search'; search.placeholder = '소주제 또는 원본 텍스트 검색'; search.setAttribute('aria-label', '상세 이론 검색');
    const toc = el('nav', 'theory-toc'); toc.setAttribute('aria-label', '상세 이론 목차');
    for (const section of unit.sections ?? []) {
      const a = el('button', 'vocabulary-control', section.title); a.type = 'button';
      a.addEventListener('click', () => { search.value = ''; draw(); const target = list.querySelector(`[data-page="${section.startPage}"]`); if (target) { target.open = true; target.scrollIntoView({block:'start'}); } }); toc.append(a);
    }
    function draw() {
      list.replaceChildren(); const query = search.value.toLocaleLowerCase();
      for (const p of unit.pages ?? []) {
        if (query && !`${p.title}\n${p.searchText}`.toLocaleLowerCase().includes(query)) continue;
        const details = pageDetails(p, token); details.dataset.page = String(p.page); list.append(details);
      }
      if (!list.childElementCount) list.append(el('p', '', '검색 결과가 없습니다.'));
    }
    search.addEventListener('input', draw);
    if (unit.detailedTheory?.length) {
      wrap.append(el('h2', '', '상세 이론 정리'));
      for (const item of unit.detailedTheory) wrap.append(card(item, item.origin !== 'source'));
    }
    wrap.append(el('h2', '', '강의록 전체 페이지'), toc, search, list, el('h2', '', '보충 설명'));
    for (const item of unit.supplements ?? []) wrap.append(card(item)); draw(); return wrap;
  }
  const menu = [
    ['핵심 요약', () => { const v = el('div', 'theory-stack'); for (const s of unit.summary ?? []) v.append(card(s, s.origin !== 'source')); return v; }],
    ['상세 이론', theory], ['개념 암기', concepts],
    ['공식·계산', () => { const v = el('div', 'theory-stack'); for (const f of unit.formulas ?? []) v.append(card(f)); if (!v.childElementCount) v.append(el('p', '', '별도 정리한 공식은 없습니다. 원본 페이지의 표와 수식은 상세 이론에서 확인하세요.')); return v; }],
    ['연습 문제', () => createExamView(unit.practice ?? [])],
    ['기출 문제', token => {
      const v = el('div', 'theory-stack'); v.append(el('p', 'theory-notice', '제공된 실제 시험지 원본입니다. 문항별 전사·해설 검수는 진행 중이며, 확인되지 않은 정답은 생성하지 않습니다.'));
      for (const exam of unit.officialExams ?? []) {
        const c = el('article', 'theory-card'); c.append(el('h3', '', `${exam.year}년 ${exam.semester}학기 · ${exam.type}`));
        if (exam.officialAnswers) {
          const key = el('details'); key.append(el('summary', '', '제공된 공식 정답표 확인'));
          key.append(el('p', 'theory-text', exam.officialAnswers.map((a, i) => `${i + 1}번 ${a}`).join(' · ')), el('p', 'muted', exam.answerSource)); c.append(key);
        }
        for (const p of exam.pages) c.append(pageDetails({...p, label:`${exam.year} ${exam.type}`}, token)); v.append(c);
      } return v;
    }]
  ];
  const buttons = [];
  function select(index) {
    generation++;
    buttons.forEach((b, i) => { b.classList.toggle('active', i === index); b.setAttribute('aria-pressed', String(i === index)); });
    panel.replaceChildren(menu[index][1](generation));
  }
  menu.forEach(([label], i) => { const b = button(label, () => select(i)); buttons.push(b); tabs.append(b); }); select(0);
  return () => { disposed = true; generation++; if (dialog.open) dialog.close(); root.remove(); };
}
