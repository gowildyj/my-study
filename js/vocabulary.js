/* ========================================
   Utilities
======================================== */

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text) element.textContent = text;

  return element;
}

/* Fisher-Yates shuffle */

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  // 직전 순서와 동일하면 한 칸 이동
  if (
    result.length > 1 &&
    result.every((item, index) => item === items[index])
  ) {
    result.push(result.shift());
  }

  return result;
}

/* ========================================
   Vocabulary study
======================================== */

export function createVocabulary(words, audio) {
  const originalOrder = words.map((_, index) => index);

  const state = {
    order: [...originalOrder],
    random: false,

    hideEnglish: false,
    hideMeaning: false,

    revealedEnglish: new Set(),
    revealedMeaning: new Set(),

    listening: false,
  };

  /* ========================================
     Layout
  ======================================== */

  const section = createElement("section", "vocabulary-section");

  const toolbar = createElement("div", "vocabulary-toolbar");

  const count = createElement(
    "p",
    "vocabulary-count",
    `전체 ${words.length}개 단어`,
  );

  const list = createElement("div", "vocabulary-list");

  /* ========================================
     Study controls
  ======================================== */

  function createControl(label, handler) {
    const button = createElement("button", "vocabulary-control", label);

    button.type = "button";

    button.addEventListener("click", handler);

    return button;
  }

  function resetRevealed() {
    audio.stopSpeech();

    state.revealedEnglish.clear();
    state.revealedMeaning.clear();
  }

  /* 순서대로 */

  const orderedButton = createControl("순서대로", () => {
    state.order = [...originalOrder];
    state.random = false;

    resetRevealed();
    update();
  });

  /* 랜덤 */

  const randomButton = createControl("랜덤", () => {
    state.order = shuffle(state.order);
    state.random = true;

    resetRevealed();
    update();
  });

  /* 영어가리기 */

  const englishButton = createControl("영어가리기", () => {
    state.hideEnglish = !state.hideEnglish;

    state.revealedEnglish.clear();

    update();
  });

  /* 뜻가리기 */

  const meaningButton = createControl("뜻가리기", () => {
    state.hideMeaning = !state.hideMeaning;

    state.revealedMeaning.clear();

    update();
  });

  toolbar.append(orderedButton, randomButton, englishButton, meaningButton);

  /* ========================================
     Control states
  ======================================== */

  function setActive(button, active) {
    button.classList.toggle("active", active);

    button.setAttribute("aria-pressed", String(active));
  }

  function updateControls() {
    setActive(orderedButton, !state.random);
    setActive(randomButton, state.random);
    setActive(englishButton, state.hideEnglish);
    setActive(meaningButton, state.hideMeaning);
  }

  /* ========================================
     Individual word cell
  ======================================== */

  function createCell(word, index, language) {
    const isEnglish = language === "en";

    const hide = isEnglish ? state.hideEnglish : state.hideMeaning;

    const revealed = isEnglish ? state.revealedEnglish : state.revealedMeaning;

    const value = isEnglish ? word.en : word.ko;

    const className = isEnglish ? "word-en" : "word-ko";

    const label = isEnglish ? "영어 단어" : "한국어 뜻";

    const cell = createElement(
      hide ? "button" : "span",
      `vocabulary-cell ${className}`,
    );

    const text = createElement("span", "vocabulary-cell-text", value);

    text.lang = isEnglish ? "en" : "ko";

    cell.append(text);

    if (!hide) return cell;

    cell.type = "button";

    function updateMask() {
      const masked = !revealed.has(index);

      cell.classList.toggle("is-masked", masked);

      text.setAttribute("aria-hidden", String(masked));

      cell.setAttribute(
        "aria-label",
        masked ? `${label} 보기` : `${value}, ${label} 다시 가리기`,
      );
    }

    cell.addEventListener("click", () => {
      if (revealed.has(index)) {
        revealed.delete(index);
      } else {
        revealed.add(index);
      }

      updateMask();
    });

    updateMask();

    return cell;
  }

  /* ========================================
     Word list
  ======================================== */

  function renderWords() {
    const fragment = document.createDocumentFragment();

    if (words.length === 0) {
      list.replaceChildren(
        createElement("p", "empty-state", "아직 등록된 단어가 없습니다."),
      );

      return;
    }

    state.order.forEach((index, position) => {
      const word = words[index];

      const row = createElement("div", "word-row");

      const number = createElement(
        "span",
        "word-number",
        String(position + 1).padStart(2, "0"),
      );

      const englishCell = createCell(word, index, "en");

      const meaningCell = createCell(word, index, "ko");

      const audioButton = audio.speakButton(word.en, "영어 단어 듣기");

      row.append(number, englishCell, audioButton, meaningCell);

      fragment.append(row);
    });

    list.replaceChildren(fragment);
  }

  /* ========================================
     Sequential audio
  ======================================== */

  const sequenceButton = createControl("▶ 전체 단어 연속 듣기", () => {
    if (state.listening) {
      audio.stopSpeech();
      return;
    }

    const texts = state.order.map((index) => words[index].en);

    setListening(true);

    audio.speakMany(texts, () => {
      setListening(false);
    });
  });

  sequenceButton.className = "vocabulary-audio-button";

  sequenceButton.disabled = words.length === 0;

  function setListening(active) {
    state.listening = active;

    sequenceButton.classList.toggle("active", active);

    sequenceButton.textContent = active
      ? "■ 연속 듣기 중지"
      : "▶ 전체 단어 연속 듣기";

    sequenceButton.setAttribute("aria-pressed", String(active));
  }

  /* ========================================
     Update
  ======================================== */

  function update() {
    updateControls();
    renderWords();
  }

  /* ========================================
     Initialize
  ======================================== */

  section.append(toolbar, count, list, sequenceButton);

  setListening(false);

  update();

  return section;
}
