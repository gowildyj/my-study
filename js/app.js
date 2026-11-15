import { renderReader } from "./reader.js";
import { renderConversation } from "./conversation.js";
import { renderTheory, renderTheorySubject } from "./theory.js";
import { unlock, lock, readJson } from "./crypto.js";

const app = document.querySelector("#app");
const actions = document.querySelector("#study-actions");

let subjects = [];
let unlocked = false;
let routeVersion = 0;
let disposeReader = null;
let category = "전체";

/* ========================================
   Common helpers
======================================== */

function el(tag, cls = "", text = "") {
  const node = document.createElement(tag);

  node.className = cls;
  node.textContent = text;

  return node;
}

function backHeading(title, href, label) {
  const row = el("div", "page-heading");
  const back = el("a", "back-button", "‹");

  back.href = href;
  back.setAttribute("aria-label", label);

  row.append(back, el("h1", "", title));

  return row;
}

function clearReader() {
  disposeReader?.();
  disposeReader = null;
}

/* ========================================
   Login
======================================== */

function login() {
  document.title = "My Study";
  actions.hidden = true;

  const box = el("section", "login-card");
  const title = el("h1", "", "My Study");
  const form = el("form", "login-form");

  const label = el("label", "", "입장 코드");
  label.htmlFor = "access-code";

  const input = el("input", "login-input");

  input.id = "access-code";
  input.type = "password";
  input.autocomplete = "current-password";
  input.required = true;
  input.placeholder = "입장 코드 입력";

  const submit = el("button", "login-primary", "입장하기");

  submit.type = "submit";

  const status = el("p", "login-status");

  status.setAttribute("role", "status");

  form.append(label, input, submit, status);

  box.append(title, el("p", "muted", "나만의 학습 공간"), form);

  app.replaceChildren(box);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submit.disabled) return;

    submit.disabled = true;
    input.disabled = true;

    status.textContent = "자료 잠금을 해제하는 중입니다…";

    try {
      subjects = (await unlock(input.value)).filter(
        (subject) =>
          subject &&
          /^[a-z0-9-]+$/.test(subject.id) &&
          subject.enabled !== false &&
          typeof subject.name === "string" &&
          Number.isInteger(subject.unitCount) &&
          subject.unitCount > 0 &&
          subject.unitCount <= 99,
      );

      input.value = "";
      unlocked = true;
      actions.hidden = false;
      category = "전체";

      await router();
    } catch (error) {
      status.textContent =
        error.name === "OperationError"
          ? "입장 코드가 올바르지 않거나 자료가 손상되었습니다."
          : "자료를 열 수 없습니다. 배포 파일을 확인해 주세요.";

      input.disabled = false;
      submit.disabled = false;

      input.focus();
      input.select();
    }
  });
}

/* ========================================
   Home — Subject catalog
======================================== */

function renderHome() {
  document.title = "My Study";

  const wrap = el("section", "study-home");

  wrap.append(
    el("h1", "", "나의 학습"),
    el("p", "muted", "학습할 과목 또는 교재를 선택하세요."),
  );

  /* Categories */

  const filters = el("nav", "study-filters");

  filters.setAttribute("aria-label", "학습 카테고리");

  const categories = [
    "전체",
    ...new Set(subjects.map((subject) => subject.category || "기타")),
  ];

  if (!categories.includes(category)) {
    category = "전체";
  }

  for (const name of categories) {
    const button = el(
      "button",
      `vocabulary-control${name === category ? " active" : ""}`,
      name,
    );

    button.type = "button";

    button.setAttribute("aria-pressed", String(name === category));

    button.addEventListener("click", () => {
      category = name;
      renderHome();
    });

    filters.append(button);
  }

  /* Subject cards */

  const grid = el("div", "study-grid");

  const filteredSubjects = subjects.filter(
    (subject) =>
      category === "전체" || (subject.category || "기타") === category,
  );

  for (const subject of filteredSubjects) {
    const link = el("a", "study-book");

    link.href = `#/${subject.id}`;

    link.append(
      el("p", "eyebrow", subject.category || "기타"),
      el("h2", "", subject.name),
      el("p", "muted", subject.description || `${subject.unitCount}개 단원`),
    );

    grid.append(link);
  }

  wrap.append(filters, grid);

  if (!grid.childElementCount) {
    wrap.append(el("p", "empty-state", "등록된 학습 자료가 없습니다."));
  }

  app.replaceChildren(wrap);
}

/* ========================================
   Subject — Language / Conversation
======================================== */

function renderSubject(subject) {
  document.title = `${subject.name} | My Study`;

  const grid = el("nav", "unit-grid");

  grid.setAttribute("aria-label", "단원 목록");

  for (let i = 1; i <= subject.unitCount; i++) {
    const label = `${subject.unitLabel || "Unit"} ${i}`;

    const available =
      !Array.isArray(subject.availableUnits) ||
      subject.availableUnits.includes(i);

    if (!available) {
      const pending = el("div", "unit-card unit-pending", label);

      pending.append(el("span", "muted", "준비 중"));
      grid.append(pending);

      continue;
    }

    const link = el("a", "unit-card", label);

    link.href = `#/${subject.id}/unit-${String(i).padStart(2, "0")}`;

    grid.append(link);
  }

  app.replaceChildren(
    backHeading(subject.name, "#/", "학습 홈으로 돌아가기"),
    grid,
  );
}

/* ========================================
   Subject renderer
======================================== */

function renderSubjectHome(subject) {
  document.title = `${subject.name} | My Study`;

  if (subject.type === "theory") {
    disposeReader = renderTheorySubject(app, subject);
    return;
  }

  renderSubject(subject);
}

/* ========================================
   Unit renderer
======================================== */

function getUnitRenderer(subject) {
  switch (subject.type) {
    case "theory":
      return renderTheory;

    case "conversation":
      return renderConversation;

    default:
      return renderReader;
  }
}

/* ========================================
   Message
======================================== */

function renderMessage(message, subject) {
  app.replaceChildren(
    backHeading(
      subject?.name || "My Study",
      subject ? `#/${subject.id}` : "#/",
      "돌아가기",
    ),
    el("p", "empty-state", message),
  );
}

/* ========================================
   Router
======================================== */

async function router() {
  if (!unlocked) return;

  const version = ++routeVersion;

  clearReader();

  window.scrollTo(0, 0);

  /* Home */

  if (!location.hash || location.hash === "#/" || location.hash === "#") {
    renderHome();
    return;
  }

  /* Route validation */

  const match = location.hash
    .slice(1)
    .match(/^\/([a-z0-9-]+)(?:\/unit-(\d{2}))?$/);

  const subject = subjects.find((item) => item.id === match?.[1]);

  if (!subject) {
    renderMessage("등록되지 않은 과목입니다.");
    return;
  }

  /* Subject home */

  if (!match[2]) {
    renderSubjectHome(subject);
    return;
  }

  /* Validate unit */

  const number = Number(match[2]);

  if (number < 1 || number > subject.unitCount) {
    renderMessage("존재하지 않는 단원입니다.", subject);

    return;
  }

  if (
    Array.isArray(subject.availableUnits) &&
    !subject.availableUnits.includes(number)
  ) {
    renderMessage("아직 등록된 학습 자료가 없습니다.", subject);

    return;
  }

  app.replaceChildren(el("p", "empty-state", "학습 자료를 불러오는 중입니다."));

  const base = `data/${subject.id}/unit-${match[2]}`;

  try {
    /* Theory subjects use a separate question bank.
       Language subjects retain unit-extra.json. */

    const [unit, extra] = await Promise.all([
      readJson(`${base}.json`),

      subject.type === "theory"
        ? Promise.resolve(null)
        : readJson(`${base}-extra.json`, true).catch(() => ({
            loadError: true,
          })),
    ]);

    if (!unlocked || version !== routeVersion) {
      return;
    }

    const unitLabel =
      subject.type === "theory"
        ? `${number}${subject.unitLabel || "강"}`
        : `${subject.unitLabel || "Unit"} ${number}`;

    document.title = `${subject.name} ${unitLabel} | My Study`;

    const render = getUnitRenderer(subject);

    const data = {
      ...unit,

      language:
        unit.language ??
        subject.language ??
        (subject.type === "theory" ? "ko-KR" : "en"),

      conjugations: extra?.conjugations ?? unit.conjugations,

      grammar: extra?.grammar ?? unit.grammar,

      expressions: extra?.expressions ?? unit.expressions,

      exerciseSource: extra?.exerciseSource ?? unit.exerciseSource,

      verbs: extra?.verbs ?? unit.verbs,

      exercises: extra?.exercises ?? unit.exercises,

      loadError: Boolean(extra?.loadError),
    };

    disposeReader = render(app, subject, data);
  } catch (error) {
    if (!unlocked || version !== routeVersion) {
      return;
    }

    renderMessage(
      error.message === "HTTP 404"
        ? "아직 등록된 학습 자료가 없습니다."
        : "학습 자료를 불러오지 못했습니다.",
      subject,
    );
  }
}

/* ========================================
   Lock
======================================== */

document.querySelector("#lock-button").addEventListener("click", () => {
  unlocked = false;

  routeVersion++;

  lock();
  clearReader();

  subjects = [];

  document.querySelector("#settings-dialog")?.close();

  location.hash = "#/";

  login();
});

/* ========================================
   Browser navigation
======================================== */

window.addEventListener("hashchange", router);

/* Re-lock when the page is hidden for
   navigation or restored from browser cache. */

window.addEventListener("pagehide", () => {
  if (!unlocked) return;

  unlocked = false;

  routeVersion++;

  lock();
  clearReader();

  subjects = [];

  login();
});

/* Initialize */

login();
