// Shared multiple-choice practice. Content is supplied by the decrypted unit.
export function createExamView(questions = []) {
  const root = document.createElement('section');
  root.className = 'theory-stack';
  const records = new Map();
  let wrongOnly = false;
  const summary = document.createElement('p');
  summary.setAttribute('role', 'status');
  const controls = document.createElement('div');
  controls.className = 'extra-switch';
  const list = document.createElement('div');
  list.className = 'theory-stack';
  function button(label, action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vocabulary-control'; b.textContent = label;
    b.addEventListener('click', action); return b;
  }
  controls.append(button('전체 다시 풀기', () => { records.clear(); wrongOnly = false; render(); }),
    button('오답 복습', () => { wrongOnly = true; render(); }));
  function render() {
    list.replaceChildren();
    for (const [index, q] of questions.entries()) {
      const record = records.get(index);
      if (wrongOnly && (record === undefined || record === q.answer)) continue;
      const card = document.createElement('article'); card.className = 'theory-card';
      const label = document.createElement('p'); label.className = 'eyebrow';
      label.textContent = `${q.sourceKind === 'official' ? '실제 기출' : 'AI 제작 연습 문제 · 기출 아님'} · ${index + 1}`;
      const title = document.createElement('h3'); title.textContent = q.prompt;
      card.append(label, title);
      if (q.sourcePages?.length) {
        const source = document.createElement('p'); source.className = 'muted';
        source.textContent = `관련 원본 ${q.sourcePages.join(', ')}쪽`; card.append(source);
      }
      q.options.forEach((option, choice) => {
        const b = button(`${choice + 1}. ${option}`, () => { records.set(index, choice); render(); });
        b.className = 'extra-choice'; b.disabled = record !== undefined && !wrongOnly;
        b.setAttribute('aria-pressed', String(record === choice));
        if (record !== undefined) {
          b.classList.toggle('correct', choice === q.answer);
          b.classList.toggle('wrong', choice === record && choice !== q.answer);
        }
        card.append(b);
      });
      if (record !== undefined) {
        const feedback = document.createElement('div'); feedback.className = 'theory-supplement';
        const result = document.createElement('strong');
        result.textContent = `${record === q.answer ? '정답' : '오답'} · 정답 ${q.answer + 1}번`;
        feedback.append(result);
        const explanation = document.createElement('p'); explanation.textContent = q.explanation; feedback.append(explanation);
        for (const [i, reason] of (q.optionExplanations ?? []).entries()) {
          const p = document.createElement('p'); p.textContent = `${i + 1}번: ${reason}`; feedback.append(p);
        }
        card.append(feedback);
        card.append(button('이 문제 다시 풀기', () => { records.delete(index); render(); }));
      }
      list.append(card);
    }
    const correct = [...records].filter(([i, answer]) => answer === questions[i].answer).length;
    summary.textContent = `전체 ${questions.length}문제 · 풀이 ${records.size} · 정답 ${correct} · 오답 ${records.size - correct}`;
    if (!list.childElementCount) { const p = document.createElement('p'); p.textContent = wrongOnly ? '복습할 오답이 없습니다.' : '등록된 문제가 없습니다.'; list.append(p); }
  }
  root.append(controls, summary, list); render(); return root;
}
