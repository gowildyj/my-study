/**
 * My Study — Theory Learning
 * 이론형 과목 공통 학습 모듈
 */

import { readJson } from "./crypto.js";
import { renderQuiz, shuffle, validateBank } from "./exam.js";

/* Common helpers */

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

function heading(title, href) {
  const row = el("div", "page-heading");
  const back = el("a", "back-button", "‹");

  back.href = href;
  back.setAttribute("aria-label", "돌아가기");

  row.append(back, el("h1", "", title));

  return row;
}

function empty(host, message = "등록된 학습 자료가 없습니다.") {
  host.replaceChildren(el("p", "empty-state", message));
}

function createTabs(labels, active, onChange) {
  const nav = el("nav", "theory-tabs");

  for (const label of labels) {
    const control = button(label, () => onChange(label));

    control.classList.toggle("active", label === active);
    control.setAttribute("aria-pressed", String(label === active));

    nav.append(control);
  }

  return nav;
}

/* Question bank */

function createBankLoader(subject) {
  let pending = null;

  return function loadBank() {
    if (!pending) {
      pending = readJson(`data/${subject.id}/question-bank.json`, true)
        .then((data) =>
          validateBank(
            data ?? {
              questions: [],
              materials: {},
              exams: [],
            },
          ),
        )
        .catch((error) => {
          pending = null;
          throw error;
        });
    }

    return pending;
  };
}

/* Content blocks */

export function renderBlocks(host, blocks = []) {
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;

    switch (block.type) {
      case "heading":
        host.append(el("h4", "theory-block-heading", block.text ?? ""));
        break;

      case "text":
        host.append(el("p", "theory-text", block.text ?? ""));
        break;

      case "note":
        host.append(el("p", "theory-note", block.text ?? ""));
        break;

      case "important":
        host.append(el("p", "theory-important", block.text ?? ""));
        break;

      case "list": {
        const list = el("ul", "theory-list");

        for (const item of block.items ?? []) {
          list.append(el("li", "", item));
        }

        host.append(list);
        break;
      }

      case "formula":
        host.append(el("pre", "theory-formula", block.text ?? ""));
        break;

      case "code":
        host.append(el("pre", "theory-code", block.text ?? ""));
        break;

      case "table":
        host.append(createTable(block));
        break;

      case "image":
        host.append(createImage(block));
        break;

      case "steps":
        host.append(createSteps(block));
        break;
    }
  }
}

/* Table */

function createTable(block) {
  const wrapper = el("div", "theory-table-wrap");
  const table = el("table", "theory-table");

  if (block.caption) {
    table.append(el("caption", "", block.caption));
  }

  const head = el("thead");
  const headerRow = el("tr");

  for (const value of block.headers ?? []) {
    const th = el("th", "", String(value));
    th.scope = "col";
    headerRow.append(th);
  }

  head.append(headerRow);
  table.append(head);

  const body = el("tbody");

  for (const values of block.rows ?? []) {
    const row = el("tr");

    for (const value of values) {
      row.append(el("td", "", String(value ?? "")));
    }

    body.append(row);
  }

  table.append(body);
  wrapper.append(table);

  return wrapper;
}

/* Images
 * Accept only embedded raster images.
 * External URLs and raw SVG/HTML are not permitted.
 */

function createImage(block) {
  const figure = el("figure", "theory-figure");
  const src = block.src;

  const valid =
    typeof src === "string" &&
    src.length <= 8 * 1024 * 1024 &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src);

  if (!valid) {
    figure.append(el("p", "muted", "이미지를 표시할 수 없습니다."));

    return figure;
  }

  const image = document.createElement("img");

  image.className = "theory-image";
  image.alt = block.alt || block.caption || "학습 자료 그림";
  image.loading = "lazy";
  image.decoding = "async";
  image.src = src;

  image.addEventListener(
    "error",
    () => {
      image.replaceWith(el("p", "muted", "이미지를 불러오지 못했습니다."));
    },
    { once: true },
  );

  figure.append(image);

  if (block.caption) {
    figure.append(el("figcaption", "muted", block.caption));
  }

  return figure;
}

/* Worked examples */

function createSteps(block) {
  const root = el("div", "theory-steps");

  for (const [index, step] of (block.items ?? []).entries()) {
    const row = el("div", "theory-step");

    row.append(
      el("span", "theory-step-number", String(index + 1)),
      el("p", "", step),
    );

    root.append(row);
  }

  return root;
}

/* Study cards */

function renderCards(host, items = []) {
  host.replaceChildren();

  if (!items.length) {
    empty(host);
    return;
  }

  for (const item of items) {
    const card = el("article", "theory-card");

    if (item.title) {
      card.append(el("h3", "theory-card-title", item.title));
    }

    renderBlocks(
      card,
      item.blocks ?? [
        {
          type: "text",
          text: item.text ?? "",
        },
      ],
    );

    const pages = item.source?.pages;
    const page = item.source?.page;

    if (Array.isArray(pages) && pages.length) {
      card.append(el("p", "theory-source", `강의록 ${pages.join(", ")}쪽`));
    } else if (page) {
      card.append(el("p", "theory-source", `강의록 ${page}쪽`));
    }

    host.append(card);
  }
}

/* Concept memorization */

function renderConcepts(host, concepts = []) {
  if (!concepts.length) {
    empty(host);
    return;
  }

  let masked = false;
  let randomOrder = false;
  let order = [...concepts];

  const controls = el("div", "theory-actions");
  const list = el("div", "theory-stack");

  const orderButton = button("순서대로", () => {
    randomOrder = !randomOrder;

    order = randomOrder ? shuffle(concepts) : [...concepts];

    orderButton.textContent = randomOrder ? "랜덤" : "순서대로";

    orderButton.classList.toggle("active", randomOrder);

    paint();
  });

  const maskButton = button("정의 가리기", () => {
    masked = !masked;

    maskButton.textContent = masked ? "정의 보기" : "정의 가리기";

    maskButton.classList.toggle("active", masked);

    paint();
  });

  controls.append(orderButton, maskButton);

  host.replaceChildren(
    controls,
    el("p", "muted", `전체 ${concepts.length}개 개념`),
    list,
  );

  function paint() {
    list.replaceChildren();

    for (const concept of order) {
      const card = el("article", "theory-card");

      const definition = el("p", "theory-definition", concept.definition ?? "");

      const reveal = button(
        "터치하여 정의 확인",
        () => {
          definition.hidden = false;
          reveal.hidden = true;
          term.setAttribute("aria-expanded", "true");
        },
        "theory-reveal",
      );

      const term = button(
        concept.term,
        () => {
          definition.hidden = !definition.hidden;
          reveal.hidden = !definition.hidden;

          term.setAttribute("aria-expanded", String(!definition.hidden));
        },
        "theory-term",
      );

      term.setAttribute("aria-expanded", String(!masked));

      definition.hidden = masked;
      reveal.hidden = !masked;

      card.append(term, definition, reveal);
      list.append(card);
    }
  }

  paint();
}

/* Quiz settings */

function createSelect(label, options) {
  const wrapper = el("label", "theory-field");
  const select = document.createElement("select");

  for (const [value, text] of options) {
    const option = el("option", "", text);
    option.value = value;
    select.append(option);
  }

  wrapper.append(el("span", "", label), select);

  return { wrapper, select };
}

function createCheck(label, value, checked = false) {
  const wrapper = el("label", "theory-check");
  const input = document.createElement("input");

  input.type = "checkbox";
  input.value = String(value);
  input.checked = checked;

  wrapper.append(input, document.createTextNode(label));

  return { wrapper, input };
}

/* Launch shared exam engine */

function startQuiz(host, questions, bank, options = {}) {
  renderQuiz(host, questions, {
    mode: options.mode ?? "study",
    mixOptions: options.mixOptions ?? false,
    materials: bank.materials ?? {},
    renderBlocks,
    onExit: options.onExit,
  });
}

/* Unit-specific questions */

function renderUnitQuizMenu(host, questions, bank, onExit) {
  if (!questions.length) {
    empty(host);
    return;
  }

  const card = el("section", "theory-card");

  const mode = createSelect("채점 방식", [
    ["study", "학습 모드 · 즉시 채점"],
    ["exam", "시험 모드 · 일괄 채점"],
  ]);

  const mix = createCheck("선택지 섞기", "mix");

  function launch(random) {
    startQuiz(host, random ? shuffle(questions) : questions, bank, {
      mode: mode.select.value,
      mixOptions: mix.input.checked,
      onExit,
    });
  }

  const actions = el("div", "theory-actions");

  actions.append(
    button("순서대로 풀기", () => launch(false)),
    button("랜덤으로 풀기", () => launch(true)),
  );

  card.append(
    el("h3", "", `전체 ${questions.length}문제`),
    mode.wrapper,
    mix.wrapper,
    actions,
  );

  host.replaceChildren(card);
}

/* Previous examinations */

function renderPastExams(host, bank, onExit) {
  host.replaceChildren();

  const byId = new Map(bank.questions.map((q) => [q.id, q]));

  const exams = [...(bank.exams ?? [])].sort(
    (a, b) => Number(b.year ?? 0) - Number(a.year ?? 0),
  );

  if (!exams.length) {
    empty(host, "등록된 기출문제가 없습니다.");
    return;
  }

  let currentYear = null;

  for (const exam of exams) {
    if (exam.year !== currentYear) {
      currentYear = exam.year;

      if (currentYear != null) {
        host.append(el("h3", "theory-year", `${currentYear}학년도`));
      }
    }

    const questions = exam.questionIds.map((id) => byId.get(id));

    const card = el("article", "theory-card");

    const actions = el("div", "theory-actions");

    actions.append(
      button("학습 모드", () => {
        startQuiz(host, questions, bank, {
          mode: "study",
          onExit,
        });
      }),

      button("시험 모드", () => {
        startQuiz(host, questions, bank, {
          mode: "exam",
          onExit,
        });
      }),
    );

    card.append(
      el("h3", "", exam.title),
      el("p", "muted", `${questions.length}문제`),
      actions,
    );

    host.append(card);
  }
}

/* Mock examination */

function renderMockExam(host, subject, bank, onExit) {
  const card = el("section", "theory-card");
  const field = el("fieldset", "theory-fieldset");

  field.append(el("legend", "", "출제 범위"));

  const unitGrid = el("div", "theory-unit-select");
  const inputs = [];

  for (let n = 1; n <= subject.unitCount; n++) {
    if (!bank.questions.some((q) => q.units.includes(n))) {
      continue;
    }

    const check = createCheck(`${n}강`, n, true);

    inputs.push(check.input);
    unitGrid.append(check.wrapper);
  }

  const selectAll = button("전체 해제", () => {
    const allChecked = inputs.every((input) => input.checked);

    for (const input of inputs) {
      input.checked = !allChecked;
    }

    update();
  });

  field.append(selectAll, unitGrid);

  const source = createSelect("문제 유형", [
    ["all", "기출 + 예상 문제"],
    ["past", "기출 문제만"],
    ["practice", "예상 문제만"],
  ]);

  const count = createSelect("출제 문항 수", [
    ["10", "10문제"],
    ["20", "20문제"],
    ["30", "30문제"],
    ["50", "50문제"],
  ]);

  count.select.value = "30";

  const mode = createSelect("채점 방식", [
    ["study", "학습 모드 · 즉시 채점"],
    ["exam", "시험 모드 · 일괄 채점"],
  ]);

  mode.select.value = "exam";

  const mix = createCheck("선택지 섞기", "mix");

  const status = el("p", "muted");
  status.setAttribute("role", "status");

  function getPool() {
    const selected = new Set(
      inputs
        .filter((input) => input.checked)
        .map((input) => Number(input.value)),
    );

    return bank.questions.filter((q) => {
      const unitMatches = q.units.some((unit) => selected.has(unit));

      const sourceMatches =
        source.select.value === "all" || q.source === source.select.value;

      return unitMatches && sourceMatches;
    });
  }

  const start = button(
    "시험 시작",
    () => {
      const pool = getPool();

      if (!pool.length) return;

      const selected = shuffle(pool).slice(0, Number(count.select.value));

      startQuiz(host, selected, bank, {
        mode: mode.select.value,
        mixOptions: mix.input.checked,
        onExit,
      });
    },
    "extra-primary",
  );

  function update() {
    const total = getPool().length;
    const requested = Number(count.select.value);
    const actual = Math.min(total, requested);

    status.textContent = `출제 가능 ${total}문제 · ${actual}문제 출제`;

    selectAll.textContent = inputs.every((input) => input.checked)
      ? "전체 해제"
      : "전체 선택";

    selectAll.disabled = inputs.length === 0;
    start.disabled = total === 0;
  }

  card.append(
    field,
    source.wrapper,
    count.wrapper,
    mode.wrapper,
    mix.wrapper,
    status,
    start,
  );

  card.addEventListener("change", update);

  host.replaceChildren(card);

  update();
}

/* Subject home */

export function renderTheorySubject(app, subject) {
  const root = el("section", "theory-stack");
  const content = el("section", "theory-stack");

  const loadBank = createBankLoader(subject);

  let alive = true;
  let revision = 0;

  const labels = ["강의별 학습", "기출 문제", "모의고사"];

  app.replaceChildren(heading(subject.name, "#/"), root);

  async function select(label) {
    const version = ++revision;

    root.replaceChildren(createTabs(labels, label, select), content);

    content.replaceChildren();

    /* Lecture list */

    if (label === "강의별 학습") {
      for (let n = 1; n <= subject.unitCount; n++) {
        const available =
          !Array.isArray(subject.availableUnits) ||
          subject.availableUnits.includes(n);

        const card = el(
          available ? "a" : "div",
          `theory-card${available ? "" : " theory-pending"}`,
        );

        if (available) {
          card.href = `#/${subject.id}/unit-${String(n).padStart(2, "0")}`;
        }

        card.append(
          el("p", "eyebrow", `${n}${subject.unitLabel ?? "강"}`),
          el("h3", "", subject.unitTitles?.[n - 1] ?? `${n}강`),
        );

        if (!available) {
          card.append(el("p", "muted", "준비 중"));
        }

        content.append(card);
      }

      return;
    }

    /* Question bank */

    empty(content, "문제은행을 불러오는 중입니다.");

    try {
      const bank = await loadBank();

      if (!alive || version !== revision) return;

      const onExit = () => select(label);

      if (label === "기출 문제") {
        renderPastExams(content, bank, onExit);
      } else {
        renderMockExam(content, subject, bank, onExit);
      }
    } catch (error) {
      if (!alive || version !== revision) return;

      console.error("Question bank load failed:", error);

      empty(content, "문제은행을 불러오지 못했습니다.");
    }
  }

  select(labels[0]);

  return () => {
    alive = false;
    revision++;
    root.replaceChildren();
  };
}

/* Individual lecture */

export function renderTheory(app, subject, unit) {
  const root = el("section", "theory-stack");
  const content = el("section", "theory-stack");

  const loadBank = createBankLoader(subject);

  let alive = true;
  let revision = 0;

  const labels = [
    "핵심 요약",
    "상세 이론",
    "개념 암기",
    "공식·계산",
    "연습 문제",
    "기출 문제",
  ];

  app.replaceChildren(
    heading(`${unit.unit}${subject.unitLabel ?? "강"}`, `#/${subject.id}`),
    el("h2", "theory-lesson-title", unit.title),
    root,
  );

  async function select(label) {
    const version = ++revision;

    root.replaceChildren(createTabs(labels, label, select), content);

    content.replaceChildren();

    switch (label) {
      case "핵심 요약":
        renderCards(content, unit.summary ?? []);
        return;

      case "상세 이론":
        renderCards(content, unit.sections ?? []);
        return;

      case "개념 암기":
        renderConcepts(content, unit.concepts ?? []);
        return;

      case "공식·계산":
        renderCards(content, unit.formulas ?? []);
        return;
    }

    empty(content, "문제를 불러오는 중입니다.");

    try {
      const bank = await loadBank();

      if (!alive || version !== revision) return;

      const source = label === "기출 문제" ? "past" : "practice";

      const questions = bank.questions.filter(
        (q) => q.units.includes(unit.unit) && q.source === source,
      );

      renderUnitQuizMenu(content, questions, bank, () => select(label));
    } catch (error) {
      if (!alive || version !== revision) return;

      console.error("Question load failed:", error);

      empty(content, "문제를 불러오지 못했습니다.");
    }
  }

  select(labels[0]);

  return () => {
    alive = false;
    revision++;
    root.replaceChildren();
  };
}
