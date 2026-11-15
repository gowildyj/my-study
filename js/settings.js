/* ========================================
   Settings configuration
======================================== */

const STORAGE_KEY = "study-settings-v1";

const DEFAULT_SETTINGS = Object.freeze({
  accent: "en-US",
  ttsRate: 1,
  wordRepeat: 1,
  wordInterval: 2,
  fontOffset: 0,
});

const ALLOWED_VALUES = {
  accent: ["en-US", "en-GB", "en-AU"],
  ttsRate: [0.8, 1, 1.2],
  wordRepeat: [1, 2, 3, 5],
  wordInterval: [0, 1, 2, 3, 5],
  fontOffset: [-2, 0, 4, 8],
};

let storageAvailable = true;

/* ========================================
   Validation
======================================== */

function normalizeSettings(values) {
  const result = { ...DEFAULT_SETTINGS };

  for (const [key, allowed] of Object.entries(ALLOWED_VALUES)) {
    const matched = allowed.find(
      (value) => String(value) === String(values?.[key]),
    );

    if (matched !== undefined) {
      result[key] = matched;
    }
  }

  return result;
}

/* ========================================
   Local storage
======================================== */

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    return saved
      ? normalizeSettings(JSON.parse(saved))
      : { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.warn("설정을 불러오지 못했습니다.", error);

    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();

export function getSettings() {
  return { ...settings };
}

function saveSettings(values) {
  settings = normalizeSettings(values);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    storageAvailable = true;
  } catch (error) {
    storageAvailable = false;

    console.warn("설정을 저장하지 못했습니다.", error);
  }

  applySettings();
}

/* ========================================
   Apply settings
======================================== */

function applySettings() {
  document.documentElement.style.setProperty(
    "--reader-font-offset",
    `${settings.fontOffset}px`,
  );
}

/* ========================================
   Settings UI
======================================== */

function initSettings() {
  applySettings();

  const dialog = document.querySelector("#settings-dialog");
  const form = document.querySelector("#settings-form");

  const openButton = document.querySelector("#settings-button");
  const closeButton = document.querySelector("#settings-close");
  const resetButton = document.querySelector("#settings-reset");
  const doneButton = document.querySelector("#settings-done");

  const firstPreview = document.querySelector("#preview-word-first");
  const secondPreview = document.querySelector("#preview-word-second");
  const intervalPreview = document.querySelector("#preview-interval");
  const status = document.querySelector("#settings-status");

  if (!dialog || !form || !openButton) return;

  /* Sync stored values with form */

  function syncForm() {
    for (const control of form.elements) {
      if (!control.name || !Object.hasOwn(settings, control.name)) {
        continue;
      }

      const value = String(settings[control.name]);

      if (control.type === "radio") {
        control.checked = control.value === value;
      } else {
        control.value = value;
      }
    }

    updatePreview();
  }

  /* Preview */

  function updatePreview() {
    firstPreview.textContent = Array.from(
      { length: settings.wordRepeat },
      () => "journey",
    ).join(" · ");

    secondPreview.textContent = Array.from(
      { length: settings.wordRepeat },
      () => "discover",
    ).join(" · ");

    intervalPreview.textContent = `↓ ${settings.wordInterval}초 대기`;

    status.textContent = storageAvailable
      ? "변경 사항은 자동으로 저장됩니다."
      : "브라우저 저장 공간을 사용할 수 없어 현재 페이지에만 적용됩니다.";
  }

  /* Open and close */

  function openSettings() {
    syncForm();

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function closeSettings() {
    if (dialog.open) {
      dialog.close();
    }
  }

  openButton.addEventListener("click", openSettings);

  closeButton.addEventListener("click", closeSettings);

  doneButton.addEventListener("click", closeSettings);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeSettings();
    }
  });

  /* Automatic save */

  form.addEventListener("change", () => {
    const values = Object.fromEntries(new FormData(form));

    saveSettings(values);
    syncForm();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  /* Reset */

  resetButton.addEventListener("click", () => {
    saveSettings(DEFAULT_SETTINGS);
    syncForm();
  });

  syncForm();
}

initSettings();
