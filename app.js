/* =========================================================
   English Library - app.js (V3.2 完整對齊版)
========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbyL3VisnFbNnt5Sj-2_78kJxAsCD49LplNAQ3CyGvQipAwG1E3-M0Ea35HzTIensStz/exec";

let sentences = [];
let currentIndex = 0;
let currentShowMode = "en";
let speechRate = 0.7;
let playbackInterval = 2000;
let isContinuousPlaying = false;
let isRandomPlaying = false;
let isPaused = false;
let isSpeaking = false;
let isWaiting = false;
let currentUtterance = null;
let playbackTimer = null;
let playbackToken = 0;
let remainingWait = 0;
let waitStartedAt = 0;
let selectedVoice = null;
let currentGeneratedTags = [];

document.addEventListener("DOMContentLoaded", function () {
  loadVoices();
  updateShowHighlight();
  updateSpeedHighlight();
  updateIntervalHighlight();
  updatePauseButton();
  setupTranslationButton();
  loadData();
});

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

async function loadData() {
  const count = document.getElementById("count");
  const error = document.getElementById("errorMessage");

  if (count) count.textContent = "資料載入中...";
  if (error) error.textContent = "";

  try {
    const response = await fetch(API_URL + "?t=" + Date.now(), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error(data.error || "資料格式錯誤");

    sentences = data.filter(function (item) {
      return item && String(item["英文"] || "").trim() !== "";
    });

    if (sentences.length === 0) {
      currentIndex = 0;
      renderSentence();
      if (count) count.textContent = "目前沒有英文資料";
      return;
    }

    if (currentIndex >= sentences.length) currentIndex = sentences.length - 1;
    if (currentIndex < 0) currentIndex = 0;

    renderSentence();
  } catch (err) {
    console.error("資料載入失敗：", err);
    if (count) count.textContent = "資料載入失敗";
    showError("資料載入失敗：" + err.message);
  }
}

function renderSentence() {
  const english = document.getElementById("english");
  const chinese = document.getElementById("chinese");
  const count = document.getElementById("count");

  if (!english || !chinese) return;

  if (sentences.length === 0) {
    english.textContent = "目前沒有英文資料";
    chinese.textContent = "";
    return;
  }

  const item = sentences[currentIndex];
  const en = String(item["英文"] || "");
  const zh = String(item["中文"] || "");

  english.textContent = "";
  chinese.textContent = "";

  if (currentShowMode === "en") {
    english.textContent = en;
  } else if (currentShowMode === "zh") {
    chinese.textContent = zh;
  } else if (currentShowMode === "both") {
    english.textContent = en;
    chinese.textContent = zh;
  } else if (currentShowMode === "blind") {
    english.textContent = "";
    chinese.textContent = "";
  }

  if (count) {
    count.textContent =
      "第 " + (currentIndex + 1) + " / " + sentences.length + " 筆";
  }

  updateShowHighlight();
}

function changeShow(mode) {
  currentShowMode = mode;
  renderSentence();
}

function blindMode() {
  currentShowMode = "blind";
  renderSentence();
}

function updateShowHighlight() {
  const buttons = document.querySelectorAll(".toolbar button");
  buttons.forEach((button) => button.classList.remove("active"));

  const modeIndex = { en: 0, zh: 1, both: 2, blind: 3 };
  const index = modeIndex[currentShowMode];
  if (buttons[index]) buttons[index].classList.add("active");
}

function loadVoices() {
  if (!("speechSynthesis" in window)) return;

  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter(
    (voice) => voice.lang && voice.lang.toLowerCase().startsWith("en")
  );

  if (englishVoices.length === 0) return;

  const preferred = [
    "Samantha", "Alex", "Karen", "Daniel", "Moira",
    "Google US English", "Microsoft Jenny", "Microsoft Aria"
  ];

  for (const name of preferred) {
    const found = englishVoices.find((v) =>
      v.name.toLowerCase().includes(name.toLowerCase())
    );
    if (found) {
      selectedVoice = found;
      return;
    }
  }
  selectedVoice = englishVoices[0];
}

function speak() {
  if (sentences.length === 0) return;

  const text = String(sentences[currentIndex]["英文"] || "").trim();
  if (!text) return;

  clearPlaybackTimer();

  try {
    window.speechSynthesis.cancel();
  } catch (error) {
    console.error("取消舊語音失敗：", error);
  }

  isSpeaking = false;
  isPaused = false;
  currentUtterance = null;

  const token = ++playbackToken;
  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;

  utterance.lang = "en-US";
  utterance.rate = speechRate;
  utterance.pitch = 1;
  utterance.volume = 1;

  if (selectedVoice) utterance.voice = selectedVoice;

  utterance.onstart = function () {
    if (token !== playbackToken) return;
    isSpeaking = true;
    isPaused = false;
    updatePauseButton();
    updatePlaybackStatus(
      isContinuousPlaying
        ? isRandomPlaying ? "🔀 隨機播放中" : "▶️ 連續播放中"
        : "🔊 播放中"
    );
  };

  utterance.onpause = function () {
    if (token !== playbackToken) return;
    isPaused = true;
    updatePauseButton();
    updatePlaybackStatus("⏸ 已暫停");
  };

  utterance.onresume = function () {
    if (token !== playbackToken) return;
    isPaused = false;
    updatePauseButton();
    updatePlaybackStatus(isContinuousPlaying ? "▶️ 播放中" : "🔊 播放中");
  };

  utterance.onend = function () {
    if (token !== playbackToken) return;
    isSpeaking = false;
    isPaused = false;
    currentUtterance = null;
    updatePauseButton();
    if (isContinuousPlaying) scheduleNext();
    else updatePlaybackStatus("播放完成");
  };

  utterance.onerror = function (event) {
    if (token !== playbackToken) return;
    console.error("語音播放錯誤：", event);
    isSpeaking = false;
    currentUtterance = null;
    isPaused = false;
    updatePauseButton();
    if (isContinuousPlaying) scheduleNext();
    else updatePlaybackStatus("播放錯誤");
  };

  setTimeout(function () {
    if (token !== playbackToken) return;
    try {
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("開始語音失敗：", error);
    }
  }, 80);
}

function repeatSentence() {
  if (sentences.length === 0) return;
  isContinuousPlaying = false;
  isRandomPlaying = false;
  updatePlaybackStatus("🔂 單句重播");
  speak();
}

function previousSentence() {
  if (sentences.length === 0) return;
  stopAutoPlayback();
  currentIndex = currentIndex - 1 < 0 ? sentences.length - 1 : currentIndex - 1;
  renderSentence();
  setTimeout(speak, 100);
}

function nextSentence() {
  if (sentences.length === 0) return;
  stopAutoPlayback();
  currentIndex = currentIndex + 1 >= sentences.length ? 0 : currentIndex + 1;
  renderSentence();
  setTimeout(speak, 100);
}

function togglePause() {
  if (isSpeaking) {
    if (isPaused) {
      window.speechSynthesis.resume();
      isPaused = false;
    } else {
      window.speechSynthesis.pause();
      isPaused = true;
    }
    updatePauseButton();
    return;
  }

  if (isWaiting) {
    if (isPaused) resumeWaiting();
    else pauseWaiting();
  }
}

function pauseWaiting() {
  if (!isWaiting) return;
  const elapsed = Date.now() - waitStartedAt;
  remainingWait = Math.max(0, remainingWait - elapsed);
  clearPlaybackTimer();
  isWaiting = true;
  isPaused = true;
  updatePauseButton();
  updatePlaybackStatus("⏸ 間隔已暫停");
}

function resumeWaiting() {
  if (!isWaiting || !isPaused) return;
  isPaused = false;
  waitStartedAt = Date.now();
  playbackTimer = setTimeout(finishWaiting, remainingWait);
  updatePauseButton();
  updatePlaybackStatus("⏳ 等待下一句");
}

function stopAutoPlayback() {
  isContinuousPlaying = false;
  isRandomPlaying = false;
  playbackToken++;
  clearPlaybackTimer();
  try {
    window.speechSynthesis.cancel();
  } catch (error) {
    console.error(error);
  }
  isSpeaking = false;
  isPaused = false;
  currentUtterance = null;
  updatePauseButton();
}

function stopAllPlayback() {
  stopAutoPlayback();
  updatePlaybackStatus("⏹ 已停止");
}

function startContinuousPlay() {
  if (sentences.length === 0) return;
  isContinuousPlaying = true;
  isRandomPlaying = false;
  isPaused = false;
  playbackToken++;
  clearPlaybackTimer();
  speak();
}

function startRandomPlay() {
  if (sentences.length === 0) return;
  isRandomPlaying = true;
  isContinuousPlaying = true;
  isPaused = false;
  playbackToken++;
  clearPlaybackTimer();
  currentIndex = Math.floor(Math.random() * sentences.length);
  renderSentence();
  speak();
}

function scheduleNext() {
  clearPlaybackTimer();
  if (!isContinuousPlaying) return;
  isWaiting = true;
  isPaused = false;
  remainingWait = playbackInterval;
  waitStartedAt = Date.now();
  updatePlaybackStatus("⏳ 等待 " + playbackInterval / 1000 + " 秒");
  playbackTimer = setTimeout(finishWaiting, remainingWait);
}

function finishWaiting() {
  playbackTimer = null;
  isWaiting = false;
  remainingWait = 0;
  waitStartedAt = 0;
  if (!isContinuousPlaying || isPaused) return;

  if (isRandomPlaying) {
    currentIndex = Math.floor(Math.random() * sentences.length);
  } else {
    currentIndex = currentIndex + 1 >= sentences.length ? 0 : currentIndex + 1;
  }
  renderSentence();
  speak();
}

function clearPlaybackTimer() {
  if (playbackTimer !== null) {
    clearTimeout(playbackTimer);
    playbackTimer = null;
  }
  isWaiting = false;
}

function setSpeechRate(rate) {
  let value = Number(rate);
  if (isNaN(value)) return;
  speechRate = Math.max(0.3, Math.min(1.2, value));
  updateSpeedHighlight();

  if (isSpeaking && !isPaused) {
    const keepContinuous = isContinuousPlaying;
    const keepRandom = isRandomPlaying;
    playbackToken++;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    isSpeaking = false;
    currentUtterance = null;
    isContinuousPlaying = keepContinuous;
    isRandomPlaying = keepRandom;
    setTimeout(speak, 120);
  }
}

function updateSpeedHighlight() {
  document.querySelectorAll(".speed-button").forEach((button) => {
    const rate = Number(button.dataset.rate);
    button.classList.toggle("active-speed", Math.abs(rate - speechRate) < 0.001);
  });
}

function setPlaybackInterval(interval) {
  const value = Number(interval);
  if (!isNaN(value)) {
    playbackInterval = value;
    updateIntervalHighlight();
  }
}

function updateIntervalHighlight() {
  document.querySelectorAll(".interval-button").forEach((button) => {
    const interval = Number(button.dataset.interval);
    button.classList.toggle("active-interval", interval === playbackInterval);
  });
}

function updatePauseButton() {
  const button = document.getElementById("pauseButton");
  if (button) button.textContent = isPaused ? "▶ 繼續" : "⏸ 暫停";
}

function updatePlaybackStatus(text) {
  const element = document.getElementById("playbackStatus");
  if (element) element.textContent = text || "";
}

function showError(message) {
  const element = document.getElementById("errorMessage");
  if (element) element.textContent = "❌ " + message;
}

/* =========================================================
   新增表單與 logic
========================================================= */
function showAddForm() {
  const form = document.getElementById("addForm");
  if (form) form.style.display = "block";
  const input = document.getElementById("newEnglish");
  if (input) input.focus();
}

function hideAddForm() {
  const form = document.getElementById("addForm");
  if (form) form.style.display = "none";

  const english = document.getElementById("newEnglish");
  const chinese = document.getElementById("newChinese");
  const message = document.getElementById("addMessage");
  const duplicateWarning = document.getElementById("duplicateWarning");
  const tagContainer = document.getElementById("aiTagsContainer");

  if (english) english.value = "";
  if (chinese) chinese.value = "";
  if (message) message.textContent = "";
  if (duplicateWarning) {
    duplicateWarning.textContent = "";
    duplicateWarning.style.display = "none";
  }
  if (tagContainer) tagContainer.innerHTML = "";
  currentGeneratedTags = [];
}

function checkDuplicateOnInput() {
  const input = document.getElementById("newEnglish");
  const warning = document.getElementById("duplicateWarning");
  if (!input || !warning) return;

  const text = input.value.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

  if (!text) {
    warning.textContent = "";
    warning.style.display = "none";
    return;
  }

  const match = sentences.find((item) => {
    const en = String(item["英文"] || "").trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
    return en === text;
  });

  if (match) {
    warning.textContent = "⚠️ 資料庫已有相似句子：" + match["英文"];
    warning.style.display = "block";
  } else {
    warning.textContent = "";
    warning.style.display = "none";
  }
}

function setupTranslationButton() {
  const englishInput = document.getElementById("newEnglish");
  const chineseInput = document.getElementById("newChinese");

  if (!englishInput || !chineseInput) return;
  if (document.getElementById("translateButton")) return;

  const button = document.createElement("button");
  button.id = "translateButton";
  button.type = "button";
  button.textContent = "✨ 自動翻譯";
  button.onclick = translateNewSentence;

  chineseInput.parentNode.insertBefore(button, chineseInput);
}

async function translateNewSentence() {
  const englishInput = document.getElementById("newEnglish");
  const chineseInput = document.getElementById("newChinese");
  const message = document.getElementById("addMessage");
  const button = document.getElementById("translateButton");

  if (!englishInput || !chineseInput) return;
  const english = englishInput.value.trim();

  if (!english) {
    if (message) message.textContent = "請先輸入英文句子";
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "⏳ 翻譯中...";
  }
  if (message) message.textContent = "正在翻譯與產生標籤...";

  try {
    const urlTrans = API_URL + "?action=translate&英文=" + encodeURIComponent(english) + "&t=" + Date.now();
    const resTrans = await fetch(urlTrans, { method: "GET", cache: "no-store" });
    const resultTrans = await resTrans.json();

    if (resultTrans.success) {
      chineseInput.value = resultTrans.chinese || "";
    }

    await fetchAITags(english);

    if (message) message.textContent = "✅ 翻譯與標籤已生成";
  } catch (err) {
    console.error("翻譯或標籤產生失敗：", err);
    if (message) message.textContent = "❌ 處理失敗：" + err.message;
  }

  if (button) {
    button.disabled = false;
    button.textContent = "✨ 自動翻譯";
  }
}

async function fetchAITags(englishText) {
  try {
    const url = API_URL + "?action=autoTag&英文=" + encodeURIComponent(englishText) + "&t=" + Date.now();
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    const result = await response.json();

    if (result.success && result.tags) {
      currentGeneratedTags = result.tags;
      renderTags(result.tags);
    }
  } catch (err) {
    console.error("AI 標籤產生失敗", err);
  }
}

function renderTags(tags) {
  const tagContainer = document.getElementById("aiTagsContainer");
  if (!tagContainer) return;

  tagContainer.innerHTML = "";
  tags.forEach((tag) => {
    const badge = document.createElement("span");
    badge.className = "tag-badge";
    badge.style.cssText =
      "background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 6px; display: inline-block; margin-top: 4px;";
    badge.textContent = "# " + tag;
    tagContainer.appendChild(badge);
  });
}

async function addSentence() {
  const englishInput = document.getElementById("newEnglish");
  const chineseInput = document.getElementById("newChinese");
  const message = document.getElementById("addMessage");
  const addBtn = document.querySelector("#addForm button[onclick*='addSentence']");

  if (!englishInput || !chineseInput) return;

  const english = englishInput.value.trim();
  const chinese = chineseInput.value.trim();

  if (!english) {
    if (message) message.textContent = "請輸入英文句子";
    return;
  }

  if (!chinese) {
    if (message) message.textContent = "請先自動翻譯或輸入中文";
    return;
  }

  if (addBtn) addBtn.disabled = true;
  if (message) message.textContent = "正在儲存...";

  try {
    const tagsString = currentGeneratedTags.join(",");
    const url =
      API_URL +
      "?action=add" +
      "&英文=" + encodeURIComponent(english) +
      "&中文=" + encodeURIComponent(chinese) +
      "&類型=" + encodeURIComponent("句子") +
      "&熟悉度=1" +
      "&標籤=" + encodeURIComponent(tagsString) +
      "&t=" + Date.now();

    const response = await fetch(url, { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);

    const result = await response.json();
    if (!result.success) throw new Error(result.error || "新增失敗");

    const newId = Number(result.id);
    if (message) message.textContent = "✅ 新增成功";

    await loadData();

    const newIndex = sentences.findIndex((item) => Number(item.ID) === newId);
    if (newIndex !== -1) {
      currentIndex = newIndex;
      renderSentence();
    }

    setTimeout(hideAddForm, 800);
  } catch (err) {
    console.error("新增句子失敗：", err);
    if (message) message.textContent = "❌ 新增失敗：" + err.message;
  } finally {
    if (addBtn) addBtn.disabled = false;
  }
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && event.target && event.target.id === "newEnglish") {
    event.preventDefault();
    translateNewSentence();
  }
});

window.changeShow = changeShow;
window.blindMode = blindMode;
window.previousSentence = previousSentence;
window.nextSentence = nextSentence;
window.speak = speak;
window.repeatSentence = repeatSentence;
window.togglePause = togglePause;
window.stopAllPlayback = stopAllPlayback;
window.setSpeechRate = setSpeechRate;
window.startContinuousPlay = startContinuousPlay;
window.startRandomPlay = startRandomPlay;
window.setPlaybackInterval = setPlaybackInterval;
window.showAddForm = showAddForm;
window.hideAddForm = hideAddForm;
window.checkDuplicateOnInput = checkDuplicateOnInput;
window.addSentence = addSentence;
window.translateNewSentence = translateNewSentence;
