/**
 * My Study — Shared Exam Engine
 * 공통 객관식 시험 및 채점 모듈
 */

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function button(label, handler, className = "vocabulary-control") {
  const node = el("button", className, label);
  node.type = "button";
  node.addEventListener("click", handler);
  return node;
}

/* Random order */

export function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/* Question bank validation */

export function validateBank(bank) {
  if (!bank || !Array.isArray(bank.questions)) {
    throw new Error("문제은행 형식이 올바르지 않습니다.");
  }

  const ids = new Set();

  for (const q of bank.questions) {
    if (
      !q ||
      typeof q.id !== "string" ||
      !q.id.trim() ||
      ids.has(q.id) ||
      typeof q.prompt !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      q.options.some((option) => typeof option !== "string") ||
      !Number.isInteger(q.answer) ||
      q.answer < 0 ||
      q.answer > 3 ||
      !Array.isArray(q.units) ||
      !q.units.length ||
      q.units.some((unit) => !Number.isInteger(unit) || unit < 1) ||
      !["practice", "past"].includes(q.source)
    ) {
      throw new Error(`잘못된 문항 데이터: ${q?.id ?? "unknown"}`);
    }

    if (q.materialId && !Object.hasOwn(bank.materials ?? {}, q.materialId)) {
      throw new Error(`공통 자료 누락: ${q.id}`);
    }

    ids.add(q.id);
  }

  for (const exam of bank.exams ?? []) {
    if (
      !Array.isArray(exam.questionIds) ||
      !exam.questionIds.length ||
      new Set(exam.questionIds).size !== exam.questionIds.length ||
      exam.questionIds.some((id) => !ids.has(id))
    ) {
      throw new Error("기출 시험 데이터가 올바르지 않습니다.");
    }
  }

  return bank;
}

/* Shared exam renderer */

export function renderQuiz(
  host,
  questions,
  {
    mode = "study",
    mixOptions = false,
    materials = {},
    renderBlocks,
    onExit,
  } = {},
) {
  const originalQuestions = [...questions];

  let rows = [];
  let responses = new Map();
  let index = 0;
  let finished = false;

  function begin(list) {
    rows = list.map((q) => ({
      q,
      order:
        mixOptions && q.shuffleOptions === true
          ? shuffle([0, 1, 2, 3])
          : [0, 1, 2, 3],
    }));

    responses = new Map();
    index = 0;
    finished = false;

    render();
  }

  function isCorrect(q) {
    return responses.get(q.id) === q.answer;
  }

  function renderMaterial(parent, q) {
    if (typeof renderBlocks !== "function") return;

    if (q.materialId) {
      renderBlocks(parent, materials[q.materialId]?.blocks ?? []);
    }
  }

  function renderQuestionContent(parent, q) {
    renderMaterial(parent, q);

    parent.append(el("h3", "extra-question", q.prompt));

    if (typeof renderBlocks === "function") {
      renderBlocks(parent, q.blocks ?? []);
    }
  }

  /* Result screen */

  function renderResult(root) {
    const total = rows.length;
    const correct = rows.filter(({ q }) => isCorrect(q)).length;
    const wrong = rows.filter(({ q }) => !isCorrect(q)).map(({ q }) => q);

    const score = total ? Math.round((correct / total) * 100) : 0;

    const result = el("section", "theory-card exam-result");

    result.append(
      el("h2", "", "학습 결과"),
      el("p", "exam-score", `${score}점`),
      el(
        "p",
        "muted",
        `전체 ${total}문제 · 정답 ${correct} · 오답 ${wrong.length}`,
      ),
    );

    const actions = el("div", "theory-actions");

    if (wrong.length) {
      actions.append(button("틀린 문제 다시 풀기", () => begin(wrong)));
    }

    actions.append(button("전체 다시 풀기", () => begin(originalQuestions)));

    result.append(actions);
    root.append(result);

    /* Answer review */

    for (const [i, { q, order }] of rows.entries()) {
      const selected = responses.get(q.id);
      const correctAnswer = isCorrect(q);
      const card = el("article", "theory-card");

      card.append(el("p", "eyebrow", `QUESTION ${i + 1}`));

      renderQuestionContent(card, q);

      for (const [position, optionIndex] of order.entries()) {
        const option = el(
          "div",
          "extra-choice theory-option",
          `${position + 1}. ${q.options[optionIndex]}`,
        );

        option.classList.toggle("correct", optionIndex === q.answer);

        option.classList.toggle(
          "wrong",
          optionIndex === selected && optionIndex !== q.answer,
        );

        card.append(option);
      }

      const feedback = el(
        "div",
        `extra-feedback ${correctAnswer ? "correct" : "wrong"}`,
      );

      feedback.append(
        el("strong", "", correctAnswer ? "정답입니다." : "오답입니다."),
      );

      if (q.explanation) {
        feedback.append(el("p", "", q.explanation));
      }

      card.append(feedback);
      root.append(card);
    }

    if (onExit) {
      root.append(button("목록으로 돌아가기", onExit));
    }
  }

  /* Question screen */

  function render() {
    const root = el("section", "theory-stack");

    host.replaceChildren(root);

    if (!rows.length) {
      root.append(el("p", "empty-state", "등록된 문제가 없습니다."));

      if (onExit) {
        root.append(button("목록으로 돌아가기", onExit));
      }

      return;
    }

    if (finished) {
      renderResult(root);
      return;
    }

    const { q, order } = rows[index];
    const selected = responses.get(q.id);

    const graded = mode === "study" && selected !== undefined;

    /* Progress */

    const progress = document.createElement("progress");

    progress.className = "theory-progress";
    progress.max = rows.length;
    progress.value = responses.size;
    progress.setAttribute("aria-label", "문제 풀이 진행률");

    root.append(
      el(
        "p",
        "muted",
        `${index + 1} / ${rows.length}문제 · 응답 ${responses.size}개`,
      ),
      progress,
    );

    /* Question */

    const card = el("article", "theory-card");

    const sourceLabel =
      q.source === "past"
        ? q.sourceLabel || "기출 문제"
        : "강의록 기반 예상문제";

    card.append(el("p", "eyebrow", sourceLabel));

    renderQuestionContent(card, q);

    /* Options */

    order.forEach((optionIndex, position) => {
      const control = button(
        `${position + 1}. ${q.options[optionIndex]}`,
        () => {
          if (mode === "study" && responses.has(q.id)) return;

          responses.set(q.id, optionIndex);
          render();
        },
        "extra-choice theory-option",
      );

      control.setAttribute("aria-pressed", String(selected === optionIndex));

      control.classList.toggle("theory-selected", selected === optionIndex);

      if (graded) {
        control.disabled = true;

        control.classList.toggle("correct", optionIndex === q.answer);

        control.classList.toggle(
          "wrong",
          selected === optionIndex && optionIndex !== q.answer,
        );
      }

      card.append(control);
    });

    /* Immediate feedback */

    if (graded) {
      const correct = isCorrect(q);

      const feedback = el(
        "div",
        `extra-feedback ${correct ? "correct" : "wrong"}`,
      );

      feedback.setAttribute("role", "status");

      feedback.append(
        el("strong", "", correct ? "정답입니다." : "오답입니다."),
      );

      if (q.explanation) {
        feedback.append(el("p", "", q.explanation));
      }

      card.append(feedback);
    }

    root.append(card);

    /* Navigation */

    const navigation = el("div", "theory-actions");

    const previous = button("이전 문제", () => {
      index--;
      render();
    });

    const next = button("다음 문제", () => {
      index++;
      render();
    });

    previous.disabled = index === 0;
    next.disabled = index === rows.length - 1;

    navigation.append(previous, next);
    root.append(navigation);

    /* Finish */

    const submit = button(
      mode === "exam" ? "시험 제출" : "학습 결과 보기",
      () => {
        if (responses.size !== rows.length) return;

        finished = true;
        render();
      },
      "extra-primary",
    );

    submit.disabled = responses.size !== rows.length;

    root.append(submit);

    if (onExit) {
      root.append(button("문제 풀이 나가기", onExit));
    }
  }

  begin(originalQuestions);
}
