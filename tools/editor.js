/* ========================================
   DOM utilities
======================================== */

const $ = (selector) => document.querySelector(selector);

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text) node.textContent = text;

  return node;
}

function button(label, className, handler) {
  const node = element("button", className, label);

  node.type = "button";
  node.addEventListener("click", handler);

  return node;
}

/* ========================================
   Editor state
======================================== */

const form = $("#editor-form");
const unitInput = $("#unit");
const subjectInput = $("#subject-id");
const titleInput = $("#title");
const audioInput = $("#audio-path");

const englishInput = $("#english");
const koreanInput = $("#korean");
const wordsInput = $("#words");

const previewSection = $("#preview-section");
const previewList = $("#preview-list");

const downloadButton = $("#download-json");
const copyButton = $("#copy-json");

let draft = null;
let dirty = false;

/* ========================================
   Common utilities
======================================== */

function pad(value) {
  return String(value).padStart(2, "0");
}

function lines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitParagraphs(text) {
  return text
    .trim()
    .split(/\r?\n[ \t]*(?:\r?\n[ \t]*)+/)
    .map((paragraph) => lines(paragraph))
    .filter((paragraph) => paragraph.length);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setStatus(message, error = false) {
  const status = $("#editor-status");

  status.textContent = message;
  status.classList.toggle("error", error);
}

function defaultAudioPath(unit) {
  const id=subjectInput.value.trim();
  return /^[a-z0-9-]+$/.test(id) ? `audio/${id}/unit-${pad(unit)}.mp3` : "";
}

function filename() {
  return `unit-${pad(draft.unit)}.json`;
}

function validateAudio(path) {
  if (path && !/^audio\/[a-z0-9/_-]+\.mp3$/i.test(path)) {
    throw new Error("오디오 경로가 올바르지 않습니다.");
  }
}

function isSingleLine(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !/[\r\n]/.test(value)
  );
}

/* ========================================
   Initialize basic fields
======================================== */

for (let i = 1; i <= 99; i++) {
  unitInput.append(new Option(`Unit ${i}`, String(i)));
}

unitInput.value = "1";
audioInput.value = defaultAudioPath(1);

subjectInput.addEventListener("change", () => {
  audioInput.value = defaultAudioPath(unitInput.value);
  markDirty();
});

unitInput.addEventListener("change", () => {
  audioInput.value = defaultAudioPath(unitInput.value);

  markDirty();
});

/* ========================================
   Input counts
======================================== */

function updateCounts() {
  $("#english-count").textContent = `${lines(englishInput.value).length}문장`;

  $("#korean-count").textContent = `${lines(koreanInput.value).length}문장`;

  $("#word-count").textContent = `${lines(wordsInput.value).length}개`;
}

function markDirty() {
  updateCounts();

  if (!draft) return;

  dirty = true;

  downloadButton.disabled = true;
  copyButton.disabled = true;

  setStatus(
    "입력 내용이 변경되었습니다. 자동 연결을 다시 실행해 주세요.",
    true,
  );
}

form.addEventListener("input", markDirty);

/* ========================================
   Parse vocabulary
======================================== */

function parseWords(text) {
  return lines(text).map((line, index) => {
    const separator = line.indexOf("|");

    if (separator === -1) {
      throw new Error(
        `단어장 ${index + 1}번째 줄: 영어 | 한국어 형식으로 입력해 주세요.`,
      );
    }

    const en = line.slice(0, separator).trim();
    const ko = line.slice(separator + 1).trim();

    if (!en || !ko) {
      throw new Error(
        `단어장 ${index + 1}번째 줄: 영어와 뜻을 모두 입력해 주세요.`,
      );
    }

    return {
      id: `w${String(index + 1).padStart(3, "0")}`,
      en,
      ko,
    };
  });
}

/* ========================================
   Automatic vocabulary matching
======================================== */

function isWordCharacter(character) {
  return /[\p{L}\p{N}\p{M}_'’]/u.test(character ?? "");
}

function hasOverlap(first, second) {
  return first.start < second.end && second.start < first.end;
}

function autoLink(text, words) {
  const candidates = [];
  const frequency = new Map();

  for (const word of words) {
    const key = word.en.toLowerCase();

    frequency.set(key, (frequency.get(key) ?? 0) + 1);
  }

  for (const word of words) {
    // 의미가 다른 동형어는 수동 연결 대상으로 처리
    if (frequency.get(word.en.toLowerCase()) > 1) {
      continue;
    }

    if (word.en.includes("]")) continue;

    const pattern = new RegExp(escapeRegExp(word.en), "giu");

    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;

      // 다른 단어의 일부만 일치하면 제외
      if (isWordCharacter(text[start - 1]) || isWordCharacter(text[end])) {
        continue;
      }

      candidates.push({
        start,
        end,
        wordId: word.id,
      });
    }
  }

  // 숙어처럼 길이가 긴 표현을 우선 연결
  candidates.sort((a, b) => {
    return b.end - b.start - (a.end - a.start) || a.start - b.start;
  });

  const result = [];

  for (const candidate of candidates) {
    if (!result.some((item) => hasOverlap(item, candidate))) {
      result.push(candidate);
    }
  }

  return result.sort((a, b) => a.start - b.start);
}

/* ========================================
   Create new unit data
======================================== */

function createDraft() {
  const unit = Number(unitInput.value);
  const title = titleInput.value.trim();
  const audio = audioInput.value.trim();

  if (!Number.isInteger(unit) || unit < 1 || unit > 99) {
    throw new Error("단원을 선택해 주세요.");
  }

  if (!title) {
    throw new Error("본문 제목을 입력해 주세요.");
  }

  validateAudio(audio);

  const english = splitParagraphs(englishInput.value);

  const korean = lines(koreanInput.value);

  const words = parseWords(wordsInput.value);

  const englishCount = english.flat().length;

  if (!englishCount) {
    throw new Error("영어 본문을 입력해 주세요.");
  }

  if (englishCount !== korean.length) {
    throw new Error(
      `문장 수가 일치하지 않습니다.\n영어: ${englishCount}문장 / 한국어: ${korean.length}문장`,
    );
  }

  let index = 0;

  const paragraphs = english.map((paragraph) => {
    return paragraph.map((en) => {
      if (en.includes("[[") || en.includes("]]")) {
        throw new Error(
          "영어 본문에는 단어 연결 기호 없이 원문만 입력해 주세요.",
        );
      }

      return {
        en,
        ko: korean[index++],
        links: autoLink(en, words),
      };
    });
  });

  return {
    unit,
    title,
    audio,
    paragraphs,
    words,
  };
}

/* ========================================
   Serialize linked sentences
======================================== */

function serializeSentence(sentence) {
  let result = "";
  let cursor = 0;

  const links = [...sentence.links].sort((a, b) => a.start - b.start);

  for (const link of links) {
    result += sentence.en.slice(cursor, link.start);

    const expression = sentence.en.slice(link.start, link.end);

    result += `[[${link.wordId}|${expression}]]`;

    cursor = link.end;
  }

  result += sentence.en.slice(cursor);

  return result;
}

function serializeDraft() {
  return {
    unit: draft.unit,
    title: draft.title,
    audio: draft.audio,

    paragraphs: draft.paragraphs.map((paragraph) =>
      paragraph.map((sentence) => ({
        en: serializeSentence(sentence),
        ko: sentence.ko,
      })),
    ),

    words: draft.words,
  };
}

function getJSON() {
  return JSON.stringify(serializeDraft(), null, 2) + "\n";
}

/* ========================================
   Link counts
======================================== */

function updateLinkCount() {
  if (!draft) return;

  const sentences = draft.paragraphs.flat();

  const links = sentences.flatMap((sentence) => sentence.links);

  const linkedIds = new Set(links.map((link) => link.wordId));

  $("#link-count").textContent =
    `${linkedIds.size}/${draft.words.length}개 단어 · ${links.length}곳 연결`;
}

/* ========================================
   Preview linked sentence
======================================== */

function renderLinkedText(container, sentence) {
  const fragment = document.createDocumentFragment();

  const wordMap = new Map(draft.words.map((word) => [word.id, word]));

  let cursor = 0;

  const links = [...sentence.links].sort((a, b) => a.start - b.start);

  for (const link of links) {
    fragment.append(
      document.createTextNode(sentence.en.slice(cursor, link.start)),
    );

    const expression = sentence.en.slice(link.start, link.end);

    const word = wordMap.get(link.wordId);

    const linkedWord = button(expression, "preview-word", () => {
      if (dirty) return;

      sentence.links = sentence.links.filter((item) => item !== link);

      renderLinkedText(container, sentence);
      updateLinkCount();
    });

    linkedWord.title = `${word.en} — ${word.ko} (눌러서 연결 해제)`;

    linkedWord.setAttribute(
      "aria-label",
      `${expression}, ${word.ko}, 연결 해제`,
    );

    fragment.append(linkedWord);

    cursor = link.end;
  }

  fragment.append(document.createTextNode(sentence.en.slice(cursor)));

  container.replaceChildren(fragment);
}

/* ========================================
   Manual linking editor
======================================== */

function createManualEditor(sentence, preview) {
  const editor = element("details", "manual-editor");

  editor.append(element("summary", "", "단어 수동 연결"));

  const textarea = element("textarea");

  textarea.value = sentence.en;
  textarea.readOnly = true;
  textarea.lang = "en";
  textarea.rows = 3;

  textarea.setAttribute("aria-label", "연결할 본문 표현 선택");

  let selectedRange = null;

  function rememberSelection() {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (end > start) {
      selectedRange = { start, end };
    }
  }

  textarea.addEventListener("select", rememberSelection);

  textarea.addEventListener("pointerup", rememberSelection);

  textarea.addEventListener("keyup", rememberSelection);

  const message = element("p", "manual-message");

  message.setAttribute("role", "status");

  /* Find an expression */

  const searchRow = element("div", "manual-search");

  const search = element("input");

  search.type = "text";
  search.placeholder = "또는 연결할 표현 입력";
  search.lang = "en";

  search.setAttribute("aria-label", "연결할 영어 표현 검색");

  const findButton = button("찾기", "editor-button", () => {
    const target = search.value.trim();

    if (!target) return;

    let start = sentence.en.indexOf(target, selectedRange?.end ?? 0);

    if (start === -1) {
      start = sentence.en.indexOf(target);
    }

    if (start === -1) {
      message.textContent = "본문에 해당 표현이 없습니다.";

      message.classList.add("error");
      return;
    }

    selectedRange = {
      start,
      end: start + target.length,
    };

    textarea.focus();

    textarea.setSelectionRange(selectedRange.start, selectedRange.end);

    message.classList.remove("error");

    message.textContent = `선택한 표현: ${target}`;
  });

  searchRow.append(search, findButton);

  /* Vocabulary selection */

  const select = element("select");

  select.setAttribute("aria-label", "연결할 단어장 항목");

  select.append(new Option("연결할 단어 선택", ""));

  for (const word of draft.words) {
    select.append(new Option(`${word.en} — ${word.ko}`, word.id));
  }

  const linkButton = button(
    "선택한 표현 연결",
    "editor-button primary manual-action",
    () => {
      message.classList.remove("error");

      if (dirty) {
        message.textContent = "먼저 자동 연결을 다시 실행해 주세요.";

        message.classList.add("error");
        return;
      }

      rememberSelection();

      if (!selectedRange) {
        message.textContent = "본문에서 연결할 표현을 먼저 선택해 주세요.";

        message.classList.add("error");
        return;
      }

      if (!select.value) {
        message.textContent = "연결할 단어장 항목을 선택해 주세요.";

        message.classList.add("error");
        return;
      }

      let { start, end } = selectedRange;

      // 선택 영역 양쪽 공백 제거
      while (start < end && /\s/.test(sentence.en[start])) {
        start++;
      }

      while (end > start && /\s/.test(sentence.en[end - 1])) {
        end--;
      }

      const expression = sentence.en.slice(start, end);

      if (!expression || expression.includes("]")) {
        message.textContent = "연결할 표현을 다시 선택해 주세요.";

        message.classList.add("error");
        return;
      }

      const newLink = {
        start,
        end,
        wordId: select.value,
      };

      // 선택 범위와 겹치는 기존 연결은 교체
      sentence.links = sentence.links.filter(
        (link) => !hasOverlap(link, newLink),
      );

      sentence.links.push(newLink);

      sentence.links.sort((a, b) => a.start - b.start);

      renderLinkedText(preview, sentence);

      updateLinkCount();

      message.textContent = `"${expression}" 연결 완료`;

      selectedRange = null;

      textarea.setSelectionRange(0, 0);
    },
  );

  linkButton.disabled = draft.words.length === 0;

  editor.append(
    element(
      "p",
      "editor-hint",
      "본문에서 표현을 드래그하거나 아래 검색 기능을 이용하세요.",
    ),
    textarea,
    searchRow,
    select,
    linkButton,
    message,
  );

  return editor;
}

/* ========================================
   Render preview
======================================== */

function renderPreview() {
  previewList.replaceChildren();

  const heading = element("h2", "preview-title", draft.title);

  heading.lang = "en";
  previewList.append(heading);

  let sentenceNumber = 0;

  for (const paragraph of draft.paragraphs) {
    const group = element("div", "preview-paragraph");

    for (const sentence of paragraph) {
      sentenceNumber++;

      const row = element("article", "preview-sentence");

      const en = element("p", "preview-en");

      en.lang = "en";

      renderLinkedText(en, sentence);

      const ko = element("p", "preview-ko", sentence.ko);

      row.append(
        element("p", "editor-count", `문장 ${sentenceNumber}`),
        en,
        ko,
        createManualEditor(sentence, en),
      );

      group.append(row);
    }

    previewList.append(group);
  }

  previewSection.hidden = false;

  downloadButton.disabled = false;
  copyButton.disabled = false;

  updateLinkCount();
}

/* ========================================
   Automatic generation
======================================== */

form.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    const nextDraft = createDraft();

    if (
      draft &&
      !window.confirm(
        "다시 자동 연결하면 이전 수동 연결이 초기화됩니다. 계속하시겠습니까?",
      )
    ) {
      return;
    }

    draft = nextDraft;
    dirty = false;

    renderPreview();

    setStatus(
      `${draft.paragraphs.flat().length}개 문장과 ${draft.words.length}개 단어를 불러왔습니다.`,
    );

    previewSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    setStatus(error.message, true);
  }
});

/* ========================================
   Parse existing linked text
======================================== */

function parseMarkedText(marked, wordIds) {
  const links = [];

  const pattern = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

  let result = "";
  let cursor = 0;

  function appendPlain(text) {
    if (text.includes("[[") || text.includes("]]")) {
      throw new Error("기존 JSON에 잘못된 단어 연결 기호가 있습니다.");
    }

    result += text;
  }

  for (const match of marked.matchAll(pattern)) {
    const [markup, wordId, expression] = match;

    if (!wordIds.has(wordId)) {
      throw new Error(`등록되지 않은 단어 ID: ${wordId}`);
    }

    appendPlain(marked.slice(cursor, match.index));

    const start = result.length;

    result += expression;

    links.push({
      start,
      end: result.length,
      wordId,
    });

    cursor = match.index + markup.length;
  }

  appendPlain(marked.slice(cursor));

  return {
    en: result,
    links,
  };
}

/* ========================================
   Validate imported JSON
======================================== */

function importDraft(data) {
  if (
    !data ||
    !Number.isInteger(data.unit) ||
    data.unit < 1 ||
    data.unit > 99 ||
    !isSingleLine(data.title) ||
    !Array.isArray(data.words) ||
    !Array.isArray(data.paragraphs) ||
    !data.paragraphs.length
  ) {
    throw new Error("지원하지 않는 단원 JSON 형식입니다.");
  }

  const audio = data.audio ?? "";

  if (typeof audio !== "string") {
    throw new Error("오디오 경로 형식이 올바르지 않습니다.");
  }

  validateAudio(audio);

  const wordIds = new Set();

  const words = data.words.map((word) => {
    if (
      !word ||
      typeof word.id !== "string" ||
      !/^[a-z0-9_-]+$/i.test(word.id) ||
      wordIds.has(word.id) ||
      !isSingleLine(word.en) ||
      !isSingleLine(word.ko) ||
      word.en.includes("|")
    ) {
      throw new Error("단어 형식 또는 단어 ID가 올바르지 않습니다.");
    }

    wordIds.add(word.id);

    return {
      id: word.id,
      en: word.en,
      ko: word.ko,
    };
  });

  const paragraphs = data.paragraphs.map((paragraph) => {
    if (!Array.isArray(paragraph) || !paragraph.length) {
      throw new Error("문단 구조가 올바르지 않습니다.");
    }

    return paragraph.map((sentence) => {
      if (
        !sentence ||
        !isSingleLine(sentence.en) ||
        !isSingleLine(sentence.ko)
      ) {
        throw new Error("영어 또는 한국어 문장이 올바르지 않습니다.");
      }

      const parsed = parseMarkedText(sentence.en, wordIds);

      return {
        en: parsed.en,
        ko: sentence.ko,
        links: parsed.links,
      };
    });
  });

  return {
    unit: data.unit,
    title: data.title,
    audio,
    paragraphs,
    words,
  };
}

/* ========================================
   Load existing JSON file
======================================== */

function fillForm(data) {
  unitInput.value = String(data.unit);
  titleInput.value = data.title;
  audioInput.value = data.audio;

  englishInput.value = data.paragraphs
    .map((paragraph) => paragraph.map((sentence) => sentence.en).join("\n"))
    .join("\n\n");

  koreanInput.value = data.paragraphs
    .map((paragraph) => paragraph.map((sentence) => sentence.ko).join("\n"))
    .join("\n\n");

  wordsInput.value = data.words
    .map((word) => `${word.en} | ${word.ko}`)
    .join("\n");

  updateCounts();
}

$("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("2MB 이하의 JSON 파일을 선택해 주세요.");
    }

    const data = JSON.parse(await file.text());

    const nextDraft = importDraft(data);

    if (
      (draft ||
        titleInput.value.trim() ||
        englishInput.value.trim() ||
        koreanInput.value.trim() ||
        wordsInput.value.trim()) &&
      !window.confirm("현재 작성 중인 내용을 불러온 파일로 교체하시겠습니까?")
    ) {
      return;
    }

    draft = nextDraft;
    dirty = false;

    fillForm(draft);
    renderPreview();

    setStatus(`${file.name} 파일을 불러왔습니다.`);
  } catch (error) {
    setStatus(`JSON 불러오기 실패: ${error.message}`, true);
  } finally {
    event.target.value = "";
  }
});

/* ========================================
   Copy JSON
======================================== */

copyButton.addEventListener("click", async () => {
  if (!draft || dirty) return;

  const json = getJSON();

  try {
    if (!navigator.clipboard) {
      throw new Error("Clipboard unavailable");
    }

    await navigator.clipboard.writeText(json);

    setStatus(`${filename()} 내용을 복사했습니다.`);
  } catch {
    // 내부 IP 및 HTTP 환경에서 클립보드 API가
    // 제한되는 경우 직접 복사할 수 있도록 표시
    let output = $("#json-copy-fallback");

    if (!output) {
      output = element("textarea");

      output.id = "json-copy-fallback";
      output.readOnly = true;
      output.rows = 12;

      output.setAttribute("aria-label", "생성된 JSON 내용");

      previewSection.append(output);
    }

    output.value = json;

    output.focus();
    output.select();

    setStatus("자동 복사가 제한되었습니다. 표시된 JSON을 직접 복사해 주세요.");
  }
});

/* ========================================
   Download JSON
======================================== */

downloadButton.addEventListener("click", () => {
  if (!draft || dirty) return;

  const blob = new Blob([getJSON()], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename();

  document.body.append(link);

  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  setStatus(`${filename()} 다운로드를 요청했습니다.`);
});

updateCounts();
