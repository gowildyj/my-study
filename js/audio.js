import { readProtected } from "./crypto.js";
import { getSettings } from "./settings.js";

/* ========================================
   Utilities
======================================== */

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text) node.textContent = text;

  return node;
}

function button(className, text, label, handler) {
  const node = element("button", className, text);

  node.type = "button";
  node.setAttribute("aria-label", label);
  node.addEventListener("click", handler);

  return node;
}

/* ========================================
   SVG icons
======================================== */

const ICONS = {
  volume: [
    "M11 5 6 9H3v6h3l5 4V5Z",
    "M15.5 8.5a5 5 0 0 1 0 7",
    "M19 5a10 10 0 0 1 0 14",
  ],
  headphones: [
    "M3 14v-3a9 9 0 0 1 18 0v3",
    "M3 13h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H3Z",
    "M21 13h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2Z",
  ],
  repeat: [
    "m17 2 4 4-4 4",
    "M3 11V9a3 3 0 0 1 3-3h15",
    "m7 22-4-4 4-4",
    "M21 13v2a3 3 0 0 1-3 3H3",
  ],
  rewind: ["m11 19-9-7 9-7v14Z", "m22 19-9-7 9-7v14Z"],
  forward: ["m13 19 9-7-9-7v14Z", "m2 19 9-7-9-7v14Z"],
  play: ["m8 5 12 7-12 7V5Z"],
  pause: ["M9 5H6v14h3Z", "M18 5h-3v14h3Z"],
  close: ["m6 6 12 12", "M18 6 6 18"],
};

function createIcon(name, size = 22) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");

  const attributes = {
    viewBox: "0 0 24 24",
    width: String(size),
    height: String(size),
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  };

  for (const [key, value] of Object.entries(attributes)) {
    svg.setAttribute(key, value);
  }

  for (const d of ICONS[name] ?? []) {
    const path = document.createElementNS(ns, "path");

    path.setAttribute("d", d);
    svg.append(path);
  }

  return svg;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";

  const total = Math.max(0, Math.floor(seconds));

  return [
    String(Math.floor(total / 60)).padStart(2, "0"),
    String(total % 60).padStart(2, "0"),
  ].join(":");
}

/* ========================================
   Audio controller
======================================== */

export function createUnitAudio(unit, container) {
  const synth = window.speechSynthesis;
  const media = new Audio();

  media.preload = "none";

  const rates = [0.8, 1, 1.2];

  let rateIndex = 1;
  let speechSession = null;
  let disposed = false;
  let playVersion = 0;
  let objectUrl = null;
  let audioLoading = null;

  const language = typeof unit.language === "string" ? unit.language : "en";
  const tracks = (Array.isArray(unit.audioTracks) && unit.audioTracks.length
    ? unit.audioTracks : [{src: unit.audio,title: "단원 전체 듣기"}])
    .filter(t => typeof t?.src === "string" && /^audio\/[a-z0-9/_-]+\.mp3$/i.test(t.src));
  let selectedTrack = 0;
  let audioPath = tracks[0]?.src ?? "";

  /* ========================================
     English voice selection
  ======================================== */

  function findVoice(accent) {
    const voices = synth.getVoices();

    const normalize = (value) => value.toLowerCase().replaceAll("_", "-");

    const target = normalize(accent);

    const exactVoices = voices.filter(
      (voice) => normalize(voice.lang) === target,
    );

    const languageVoices = voices.filter((voice) =>
      normalize(voice.lang).split("-")[0] === target.split("-")[0],
    );

    return (
      exactVoices.find((voice) => voice.default) ??
      exactVoices[0] ??
      languageVoices.find((voice) => voice.default) ??
      languageVoices[0] ??
      null
    );
  }

  /* ========================================
     Stop English TTS
  ======================================== */

  function stopSpeech() {
    if (!speechSession) return;

    const previous = speechSession;

    speechSession = null;

    clearTimeout(previous.timer);

    synth?.cancel();

    previous.onDone?.();
  }

  /* ========================================
     English TTS playback
  ======================================== */

  function startSpeech(texts, { repetitions = 1, interval = 0, onDone } = {}) {
    stopSpeech();

    const queue = texts
      .filter((text) => typeof text === "string")
      .map((text) => text.trim())
      .filter(Boolean);

    if (disposed || queue.length === 0) {
      onDone?.();
      return;
    }

    if (!synth || !window.SpeechSynthesisUtterance) {
      onDone?.();

      window.alert("이 브라우저에서는 음성 읽기를 사용할 수 없습니다.");

      return;
    }

    pauseMedia();

    const preferences = getSettings();

    const session = {
      index: 0,
      repetition: 0,
      timer: null,
      utterance: null,
      onDone,
    };

    speechSession = session;

    function isActive() {
      return speechSession === session && !disposed;
    }

    function finish() {
      if (!isActive()) return;

      speechSession = null;

      clearTimeout(session.timer);

      session.onDone?.();
    }

    function fail() {
      if (!isActive()) return;

      finish();
      synth.cancel();

      window.alert("해당 언어의 음성을 재생하지 못했습니다. 기기의 음성 설정을 확인해 주세요.");
    }

    function next() {
      if (!isActive()) return;

      if (session.index >= queue.length) {
        finish();
        return;
      }

      try {
        const utterance = new SpeechSynthesisUtterance(queue[session.index]);

        const accent = /^en(?:-|$)/i.test(language) ? preferences.accent : language;
        const voice = findVoice(accent);

        utterance.lang = voice?.lang ?? accent;

        utterance.rate = preferences.ttsRate;
        utterance.pitch = 1;
        utterance.volume = 1;

        if (voice) {
          utterance.voice = voice;
        } else if (synth.getVoices().length > 0) {
          fail();
          return;
        }

        session.utterance = utterance;

        utterance.onend = () => {
          if (!isActive()) return;

          session.repetition++;

          // Repeat the same word immediately.

          if (session.repetition < repetitions) {
            next();
            return;
          }

          // Move to the next word.

          session.repetition = 0;
          session.index++;

          if (session.index >= queue.length) {
            finish();
            return;
          }

          // Apply the interval between different words.

          if (interval > 0) {
            session.timer = setTimeout(next, interval * 1000);
          } else {
            next();
          }
        };

        utterance.onerror = fail;

        synth.speak(utterance);
      } catch (error) {
        console.error(error);
        fail();
      }
    }

    next();
  }

  /* ========================================
     Individual word and sentence playback
  ======================================== */

  function speak(text) {
    startSpeech([text]);
  }

  function speakButton(text, label = "발음 듣기") {
    const node = button("audio-icon-button", "", label, () => speak(text));

    node.title = label;
    node.append(createIcon("volume", 20));

    return node;
  }

  /* ========================================
     Sequential word playback
  ======================================== */

  function speakMany(texts, onDone) {
    const preferences = getSettings();

    startSpeech(texts, {
      repetitions: preferences.wordRepeat,
      interval: preferences.wordInterval,
      onDone,
    });
  }

  /* ========================================
     Unit audio player
  ======================================== */

  const player = element("section", "unit-audio-player");

  player.hidden = true;

  player.setAttribute("aria-label", "단원 오디오 플레이어");

  const unitButton = button(
    "unit-audio-button",
    "",
    "단원 전체 듣기",
    openPlayer,
  );

  unitButton.append(
    createIcon("headphones", 20),
    element("span", "", "단원 전체 듣기"),
  );

  if (!audioPath) {
    unitButton.disabled = true;
    unitButton.textContent = "등록된 단원 오디오 없음";
  }

  /* Player header */

  const header = element("div", "player-header");

  const title = element("span", "player-title", unit.audioTracks?.length && tracks.length ? tracks[0].title : `${unit.unitLabel || "Unit"} ${unit.unit}`);

  const close = button("player-close", "", "플레이어 닫기", closePlayer);

  close.append(createIcon("close", 22));

  header.append(createIcon("headphones", 20), title, close);

  /* ========================================
     Progress bar
  ======================================== */

  const progress = element("input", "player-progress");

  progress.type = "range";
  progress.min = "0";
  progress.max = "1";
  progress.step = "0.1";
  progress.value = "0";
  progress.disabled = true;

  progress.setAttribute("aria-label", "오디오 재생 위치");

  progress.addEventListener("input", () => {
    if (Number.isFinite(media.duration)) {
      media.currentTime = Number(progress.value);
    }

    syncPlayer();
  });

  const timeRow = element("div", "player-time");

  const currentTime = element("span", "", "00:00");
  const duration = element("span", "", "00:00");

  timeRow.append(currentTime, duration);

  /* ========================================
     Playback controls
  ======================================== */

  const controls = element("div", "player-controls");

  /* Repeat */

  const repeat = button("player-control player-repeat", "", "반복 재생", () => {
    media.loop = !media.loop;

    repeat.classList.toggle("active", media.loop);

    repeat.setAttribute("aria-pressed", String(media.loop));
  });

  repeat.title = "반복 재생";
  repeat.setAttribute("aria-pressed", "false");
  repeat.append(createIcon("repeat"));

  /* Previous 10 seconds */

  const backward = button("player-control player-seek", "", "10초 이전", () =>
    seek(-10),
  );

  backward.append(
    createIcon("rewind"),
    element("span", "player-seek-label", "10초"),
  );

  /* Play or pause */

  const play = button("player-play", "", "재생", () => {
    if (media.paused || media.ended) {
      playMedia();
    } else {
      pauseMedia();
    }
  });

  play.append(createIcon("play", 26));

  /* Next 10 seconds */

  const forward = button("player-control player-seek", "", "10초 이후", () =>
    seek(10),
  );

  forward.append(
    createIcon("forward"),
    element("span", "player-seek-label", "10초"),
  );

  /* MP3 playback speed */

  const speed = button(
    "player-control player-speed",
    "×1",
    "재생 속도 1배",
    changeSpeed,
  );

  function updateSpeed() {
    const rate = media.playbackRate;

    speed.textContent = `×${rate}`;

    speed.classList.toggle("active", rate !== 1);

    speed.setAttribute("aria-label", `재생 속도 ${rate}배`);
  }

  function changeSpeed() {
    const nextIndex = (rateIndex + 1) % rates.length;

    const rate = rates[nextIndex];

    try {
      media.defaultPlaybackRate = rate;
      media.playbackRate = rate;

      rateIndex = nextIndex;

      updateSpeed();
    } catch (error) {
      console.error(error);

      showError("이 기기에서는 해당 재생 속도를 지원하지 않습니다.");
    }
  }

  controls.append(repeat, backward, play, forward, speed);

  /* ========================================
     Player layout
  ======================================== */

  const feedback = element("p", "player-feedback");

  feedback.setAttribute("role", "status");
  feedback.hidden = true;

  player.append(header, progress, timeRow, controls, feedback, media);

  /* ========================================
     Player state
  ======================================== */

  function showError(message = "") {
    feedback.textContent = message;
    feedback.hidden = !message;
  }

  function syncPlayer() {
    const playing = !media.paused && !media.ended;

    const iconName = playing ? "pause" : "play";

    if (play.dataset.icon !== iconName) {
      play.replaceChildren(createIcon(iconName, 26));

      play.dataset.icon = iconName;
    }

    play.setAttribute("aria-label", playing ? "일시정지" : "재생");

    const hasDuration = Number.isFinite(media.duration) && media.duration > 0;

    progress.disabled = !hasDuration;

    progress.max = hasDuration ? String(media.duration) : "1";

    progress.value = hasDuration ? String(media.currentTime) : "0";

    currentTime.textContent = formatTime(media.currentTime);

    duration.textContent = formatTime(media.duration);
  }

  function seek(seconds) {
    if (!Number.isFinite(media.duration)) return;

    media.currentTime = Math.min(
      media.duration,
      Math.max(0, media.currentTime + seconds),
    );

    syncPlayer();
  }

  /* ========================================
     MP3 playback
  ======================================== */

  function pauseMedia() {
    playVersion++;

    media.pause();

    syncPlayer();
  }

  async function playMedia() {
    if (disposed || !audioPath) return;

    stopSpeech();
    showError();

    const version = ++playVersion;

    try {
      if (!media.getAttribute("src")) {
        showError("음원 잠금을 해제하는 중입니다…");
        if (!audioLoading) {
          const pending = readProtected(audioPath).finally(() => { if (audioLoading === pending) audioLoading = null; });
          audioLoading = pending;
        }
        const bytes = await audioLoading;
        if (disposed || version !== playVersion) return;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        media.src = objectUrl;
        showError();
      }
      if (disposed || version !== playVersion) return;
      media.defaultPlaybackRate = rates[rateIndex];

      media.playbackRate = rates[rateIndex];

      await media.play();
    } catch (error) {
      if (disposed || version !== playVersion || error.name === "AbortError") {
        return;
      }

      showError(error.name === "NotAllowedError" ? "재생 버튼을 한 번 더 눌러 주세요." : "오디오를 재생하지 못했습니다. 음원 파일을 확인해 주세요.");
    }

    syncPlayer();
  }

  function openPlayer() {
    if (disposed || !audioPath) return;

    player.hidden = false;

    container.classList.add("has-unit-player");

    playMedia();
  }

  function closePlayer() {
    pauseMedia();

    if (Number.isFinite(media.duration)) {
      media.currentTime = 0;
    }

    player.hidden = true;

    container.classList.remove("has-unit-player");

    showError();

    syncPlayer();
  }

  /* ========================================
     Media events
  ======================================== */

  for (const event of [
    "loadedmetadata",
    "durationchange",
    "timeupdate",
    "play",
    "pause",
    "ended",
  ]) {
    media.addEventListener(event, syncPlayer);
  }

  media.addEventListener("ratechange", updateSpeed);

  media.addEventListener("error", () => {
    if (disposed || player.hidden) return;

    showError("등록된 MP3 파일을 불러올 수 없습니다.");

    syncPlayer();
  });

  /* ========================================
     Cleanup
  ======================================== */

  function destroy() {
    disposed = true;

    stopSpeech();
    closePlayer();

    media.removeAttribute("src");
    media.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  let unitControl = unitButton;
  if (unit.audioTracks?.length && tracks.length) {
    const group = element("div", "audio-track-group");
    const trackButtons = [];
    function selectTrack(index) {
      if (disposed || !tracks[index]) return;
      if (index !== selectedTrack) {
        pauseMedia(); audioLoading = null;
        media.removeAttribute("src"); media.load();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null; selectedTrack = index; audioPath = tracks[index].src;
        title.textContent = tracks[index].title || `회화 ${index + 1}`;
        showError(); syncPlayer();
      }
      for (const [i, control] of trackButtons.entries()) {
        control.setAttribute("aria-pressed", String(i === selectedTrack));
      }
      openPlayer();
    }
    tracks.forEach((track, i) => {
      const label = `${track.title || `회화 ${i + 1}`} 듣기`;
      const control = button("unit-audio-button", "", label, () => selectTrack(i));
      control.append(createIcon("headphones", 20), element("span", "", label));
      control.setAttribute("aria-pressed", String(i === selectedTrack));
      trackButtons.push(control); group.append(control);
    });
    unitControl = group;
  }
  return {
    unitButton: unitControl,
    player,
    speak,
    speakButton,
    speakMany,
    stopSpeech,
    destroy,
  };
}
