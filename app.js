/* =========================================================
   English Library - app.js
   包含：聽力卡片播放 + 閱讀模式清單 + 關鍵字搜尋 + 標籤/類型過濾
        + 排序機制 + 5星連動同步
========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbyL3VisnFbNnt5Sj-2_78kJxAsCD49LplNAQ3CyGvQipAwG1E3-M0Ea35HzTIensStz/exec";

let allSentences = [];      // 原始完整資料
let filteredSentences = []; // 篩選與排序後的資料
let currentIndex = 0;

let currentViewMode = "audio"; // "audio" 或 "read"
let isChineseHiddenInRead = false; // 閱讀模式中文隱藏狀態

let currentShowMode = "en";
let speechRate = 0.7;
let playbackInterval = 2000;

// 播放控制器狀態
let repeatTimesTarget = 1;
let currentRepeatCount = 0;
let playMode = "single";

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
let isSubmitting = false;

document.addEventListener("DOMContentLoaded", function () {
  loadVoices();
  updateShowHighlight();
  updateSpeedHighlight();
  updateIntervalHighlight();
  updateRepeatHighlight();
  updateModeHighlight();
  updatePauseButton();
  setupTranslationButton();
  loadData();
});

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// 載入資料並初始化情境選單
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

    allSentences = data.filter(function (item) {
      return item && String(item["英文"] || "").trim() !== "";
    });

    populateTagFilter();
    applyFilter();
  } catch (err) {
    console.error("資料載入失敗：", err);
    if (count) count.textContent = "資料載入失敗";
    showError("資料載入失敗：" + err.message);
  }
}

// 動態建立情境標籤下拉選單（自動拆解逗號隔開的多重標籤）
function populateTagFilter() {
  const tagSelect = document.getElementById("tagFilter");
  if (!tagSelect) return;

  const tagSet = new Set();
  allSentences.forEach((item) => {
    const rawTag = String(item["標籤(情境分類)"] || item["標籤"] || "");
    if (rawTag) {
      // 支援逗號隔開的多標籤
      const tags = rawTag.split(/[,，]/);
      tags.forEach(t => {
        const clean = t.trim();
        if (clean) tagSet.add(clean);
      });
    }
  });

  // 保留「全部分類」，清空舊項目
  tagSelect.innerHTML = '<option value="all">全部分類</option>';
  tagSet.forEach((tag) => {
    const opt = document.createElement("option");
    opt.value = tag;
    opt.textContent = tag;
    tagSelect.appendChild(opt);
  });
}

// 綜合篩選與排序邏輯
function applyFilter() {
  const searchVal = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
  const typeVal = document.getElementById("typeFilter")?.value || "all";
  const tagVal = document.getElementById("tagFilter")?.value || "all";
  const statusVal = document.getElementById("statusFilter")?.value || "all";
  const sortVal = document.getElementById("sortOrder")?.value || "default";

  const getStatus = (item) => {
    const rawVal = item["熟悉度"] !== undefined ? item["熟悉度"] : item["熟悉度 "];
    const parsed = Number(rawVal);
    return isNaN(parsed) || rawVal === "" ? 1 : parsed;
  };

  filteredSentences = allSentences.filter((item) => {
    const en = String(item["英文"] || "").toLowerCase();
    const zh = String(item["中文"] || "").toLowerCase();
    const type = String(item["類型"] || "句子");
    const rawTag = String(item["標籤(情境分類)"] || item["標籤"] || "");
    const status = getStatus(item);

    // 1. 搜尋框篩選
    if (searchVal && !en.includes(searchVal) && !zh.includes(searchVal)) {
      return false;
    }

    // 2. 類型篩選
    if (typeVal !== "all" && type !== typeVal) {
      return false;
    }

    // 3. 情境標籤篩選 (包含多重標籤判斷)
    if (tagVal !== "all") {
      const tags = rawTag.split(/[,，]/).map(t => t.trim());
      if (!tags.includes(tagVal)) return false;
    }

    // 4. 熟悉度篩選
    if (statusVal === "lte3" && status > 3) return false;
    if (statusVal !== "all" && statusVal !== "lte3" && status !== Number(statusVal)) return false;

    return true;
  });

  // 排序機制
  if (sortVal === "az") {
    filteredSentences.sort((a, b) => String(a["英文"] || "").localeCompare(String(b["英文"] || "")));
  } else if (sortVal === "za") {
    filteredSentences.sort((a, b) => String(b["英文"] || "").localeCompare(String(a["英文"] || "")));
  } else if (sortVal === "statusAsc") {
    filteredSentences.sort((a, b) => getStatus(a) - getStatus(b));
  } else if (sortVal === "statusDesc") {
    filteredSentences.sort((a, b) => getStatus(b) - getStatus(a));
  } else if (sortVal === "random") {
    filteredSentences.sort(() => Math.random() - 0.5);
  }

  currentIndex = 0;

  if (currentViewMode === "audio") {
    renderSentence();
  } else {
    renderReadList();
  }
}

function onFilterChange() {
  stopAllPlayback();
  applyFilter();
}

// 切換 聽力模式 / 閱讀模式
function switchViewMode(mode) {
  currentViewMode = mode;
  stopAllPlayback();

  const btnAudio = document.getElementById("btnModeAudio");
  const btnRead = document.getElementById("btnModeRead");
  const audioContainer = document.getElementById("audioModeContainer");
  const readContainer = document.getElementById("readModeContainer");
  const sortGroup = document.getElementById("sortGroup");

  if (mode === "audio") {
    btnAudio.classList.add("active");
    btnRead.classList.remove("active");
    audioContainer.style.display = "block";
    readContainer.style.display = "none";
    if (sortGroup) sortGroup.style.display = "none";
    renderSentence();
  } else {
    btnRead.classList.add("active");
    btnAudio.classList.remove("active");
    audioContainer.style.display = "none";
    readContainer.style.display = "block";
    if (sortGroup) sortGroup.style.display = "flex";
    renderReadList();
  }
}

/* =========================================================
   閱讀模式渲染與互動邏輯
========================================================= */
function renderReadList() {
  const container = document.getElementById("readList");
  const countInfo = document.getElementById("readCountInfo");
  if (!container) return;

  container.innerHTML = "";

  if (countInfo) {
    countInfo.textContent = `共 ${filteredSentences.length} 筆資料`;
  }

  if (filteredSentences.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px;">沒有符合條件的資料</div>`;
    return;
  }

  filteredSentences.forEach((item, index) => {
    const en = String(item["英文"] || "");
    const zh = String(item["中文"] || "");
    const type = String(item["類型"] || "句子");
    const rawTag = String(item["標籤(情境分類)"] || item["標籤"] || "");
    const statusRaw = item["熟悉度"] !== undefined ? item["熟悉度"] : item["熟悉度 "];
    const status = Number(statusRaw) || 1;
    const itemID = String(item["ID"] !== undefined ? item["ID"] : item["id"] || "").trim();

    const div = document.createElement("div");
    div.className = "read-item";
    div.id = `read-item-${index}`;

    // 處理標籤 Badge
    let tagHtml = "";
    if (rawTag) {
      const tags = rawTag.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      tagHtml = tags.map(t => `<span class="tag-badge">#${t}</span>`).join("");
    }

    // 產生 5 星星 HTML
    let starsHtml = "";
    for (let s = 1; s <= 5; s++) {
      const filled = s <= status ? "filled" : "";
      starsHtml += `<span class="star ${filled}" onclick="updateRatingInList('${itemID}', ${s})">★</span>`;
    }

    const zhClass = isChineseHiddenInRead ? "read-zh hidden-text" : "read-zh";

    div.innerHTML = `
      <div class="read-content">
        <div class="read-en" onclick="speakItemText('${en.replace(/'/g, "\\'")}', ${index})">${en}</div>
        <div class="${zhClass}" id="zh-text-${index}">${zh}</div>
        <div class="read-tags">
          <span class="tag-badge" style="background:#f1f5f9; color:#475569;">[${type}]</span>
          ${tagHtml}
        </div>
      </div>
      <div class="read-actions">
        <button class="speak-icon-btn" onclick="speakItemText('${en.replace(/'/g, "\\'")}', ${index})">🔊</button>
        <div class="star-container" style="font-size:1.1rem; gap:2px;">
          ${starsHtml}
        </div>
      </div>
    `;

    container.appendChild(div);
  });
}

// 閱讀模式：切換全頁中文隱藏/顯示
function toggleAllChineseReadView() {
  isChineseHiddenInRead = !isChineseHiddenInRead;
  const btn = document.getElementById("btnToggleChinese");
  if (btn) {
    btn.textContent = isChineseHiddenInRead ? "👁️ 顯示中文" : "👁️ 隱藏中文";
  }

  document.querySelectorAll(".read-zh").forEach((el) => {
    if (isChineseHiddenInRead) {
      el.classList.add("hidden-text");
    } else {
      el.classList.remove("hidden-text");
    }
  });
}

// 閱讀模式：點擊任何一列直接發音並亮起背景
function speakItemText(text, index) {
  if (!text) return;
  stopAllPlayback();

  try { window.speechSynthesis.cancel(); } catch (e) {}

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = speechRate;
  if (selectedVoice) utterance.voice = selectedVoice;

  const itemElem = document.getElementById(`read-item-${index}`);

  utterance.onstart = function () {
    if (itemElem) itemElem.classList.add("speaking");
    updatePlaybackStatus(`🔊 播放中: ${text}`);
  };

  utterance.onend = function () {
    if (itemElem) itemElem.classList.remove("speaking");
    updatePlaybackStatus("播放完成");
  };

  utterance.onerror = function () {
    if (itemElem) itemElem.classList.remove("speaking");
  };

  window.speechSynthesis.speak(utterance);
}

// 閱讀模式：清單內點擊星星改分數同步
async function updateRatingInList(itemID, newRating) {
  if (!itemID) return;

  const targetItem = allSentences.find(i => {
    let idCheck = i["ID"] !== undefined ? i["ID"] : i["id"];
    return String(idCheck).trim() === itemID;
  });

  if (targetItem) targetItem["熟悉度"] = newRating;

  applyFilter(); // 重新渲染列表
  updatePlaybackStatus(`✨ 已將熟悉度改為 ${newRating} 星 (同步中...)`);

  try {
    const baseUrl = String(API_URL).trim();
    const cleanId = encodeURIComponent(itemID);
    const cleanStatus = encodeURIComponent(String(newRating));

    const fullUrl = `${baseUrl}?action=updateStatus&id=${cleanId}&status=${cleanStatus}&t=${Date.now()}`;
    const response = await fetch(fullUrl, { method: "GET", cache: "no-store" });
    const result = await response.json();

    if (result && result.success) {
      updatePlaybackStatus(`✅ 熟悉度 ${newRating} 星已儲存至 Sheet`);
    } else {
      throw new Error((result && result.error) || "儲存失敗");
    }
  } catch (err) {
    console.error("更新熟悉度失敗：", err);
    updatePlaybackStatus(`❌ 儲存失敗：${err.message}`);
  }
}

/* =========================================================
   聽力模式卡片渲染邏輯
========================================================= */
function renderSentence() {
  const english = document.getElementById("english");
  const chinese = document.getElementById("chinese");
  const count = document.getElementById("count");

  if (!english || !chinese) return;

  if (filteredSentences.length === 0) {
    english.textContent = "沒有符合條件的資料";
    chinese.textContent = "";
    if (count) count.textContent = "無資料";
    renderStars(0);
    return;
  }

  if (currentIndex >= filteredSentences.length) currentIndex = filteredSentences.length - 1;
  if (currentIndex < 0) currentIndex = 0;

  const item = filteredSentences[currentIndex];
  const en = String(item["英文"] || "");
  const zh = String(item["中文"] || "");
  const type = String(item["類型"] || "句子");
  const tag = String(item["標籤(情境分類)"] || item["標籤"] || "");
  
  const statusRaw = item["熟悉度"] !== undefined ? item["熟悉度"] : item["熟悉度 "];
  const status = Number(statusRaw) || 1;

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
    let extraInfo = `第 ${currentIndex + 1} / ${filteredSentences.length} 筆 [${type}]`;
    if (tag) extraInfo += ` | #${tag}`;
    count.textContent = extraInfo;
  }

  renderStars(status);
  updateShowHighlight();
}

function renderStars(rating) {
  const stars = document.querySelectorAll("#starContainer .star");
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add("filled");
    } else {
      star.classList.remove("filled");
    }
  });
}

// 聽力模式改星級同步
async function updateCurrentRating(newRating) {
  if (!filteredSentences || filteredSentences.length === 0) return;

  const currentItem = filteredSentences[currentIndex];
  let rawID = currentItem["ID"] !== undefined ? currentItem["ID"] : currentItem["id"];
  if (rawID === undefined || rawID === null) rawID = "";
  const itemID = String(rawID).trim();

  if (!itemID) {
    updatePlaybackStatus(`❌ 錯誤：無法取得資料 ID`);
    return;
  }

  currentItem["熟悉度"] = newRating; 
  const targetInAll = allSentences.find(i => {
    let idCheck = i["ID"] !== undefined ? i["ID"] : i["id"];
    return String(idCheck).trim() === itemID;
  });
  if (targetInAll) targetInAll["熟悉度"] = newRating;

  renderStars(newRating);
  updatePlaybackStatus(`✨ 已將熟悉度改為 ${newRating} 星 (同步中...)`);

  try {
    const baseUrl = String(API_URL).trim();
    const cleanId = encodeURIComponent(itemID);
    const cleanStatus = encodeURIComponent(String(newRating));
    const fullUrl = `${baseUrl}?action=updateStatus&id=${cleanId}&status=${cleanStatus}&t=${Date.now()}`;

    const response = await fetch(fullUrl, { method: "GET", cache: "no-store" });
    const result = await response.json();

    if (result && result.success) {
      updatePlaybackStatus(`✅ 熟悉度 ${newRating} 星已儲存至 Sheet`);
    } else {
      throw new Error((result && result.error) || "儲存失敗");
    }
  } catch (err) {
    console.error("更新熟悉度失敗：", err);
    updatePlaybackStatus(`❌ 儲存失敗：${err.message}`);
  }
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
  if (filteredSentences.length === 0) return;

  const text = String(filteredSentences[currentIndex]["英文"] || "").trim();
  if (!text) return;

  clearPlaybackTimer();

  try { window.speechSynthesis.cancel(); } catch (error) {}

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

    let repText = repeatTimesTarget === 999 ? "無限" : `${currentRepeatCount + 1}/${repeatTimesTarget}`;
    let modeText = "🔊 單句播放";
    if (playMode === "continuous") modeText = "▶️ 連續播放";
    if (playMode === "random") modeText = "🔀 隨機播放";

    updatePlaybackStatus(`${modeText} (${repText})`);
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
    updatePlaybackStatus("🔊 播放中");
  };

  utterance.onend = function () {
    if (token !== playbackToken) return;
    isSpeaking = false;
    isPaused = false;
    currentUtterance = null;
    updatePauseButton();

    currentRepeatCount++;

    if (repeatTimesTarget === 999 || currentRepeatCount < repeatTimesTarget) {
      scheduleNext(true);
    } else {
      currentRepeatCount = 0;
      if (playMode === "single") {
        updatePlaybackStatus("播放完成");
      } else {
        scheduleNext(false);
      }
    }
  };

  utterance.onerror = function (event) {
    if (token !== playbackToken) return;
    isSpeaking = false;
    currentUtterance = null;
    isPaused = false;
    updatePauseButton();
    updatePlaybackStatus("播放錯誤");
  };

  setTimeout(function () {
    if (token !== playbackToken) return;
    try { window.speechSynthesis.speak(utterance); } catch (error) {}
  }, 80);
}

function startSinglePlay() {
  playMode = "single";
  currentRepeatCount = 0;
  updateModeHighlight();
  speak();
}

function startContinuousPlay() {
  if (filteredSentences.length === 0) return;
  playMode = "continuous";
  currentRepeatCount = 0;
  updateModeHighlight();
  speak();
}

function startRandomPlay() {
  if (filteredSentences.length === 0) return;
  playMode = "random";
  currentRepeatCount = 0;
  updateModeHighlight();
  currentIndex = Math.floor(Math.random() * filteredSentences.length);
  renderSentence();
  speak();
}

function updateModeHighlight() {
  const btnContinuous = document.getElementById("btnContinuous");
  const btnRandom = document.getElementById("btnRandom");

  if (btnContinuous) {
    btnContinuous.style.backgroundColor = playMode === "continuous" ? "#2563eb" : "#10b981";
    btnContinuous.style.color = "#ffffff";
  }

  if (btnRandom) {
    btnRandom.style.backgroundColor = playMode === "random" ? "#2563eb" : "#10b981";
    btnRandom.style.color = "#ffffff";
  }
}

function setRepeatTimes(times) {
  repeatTimesTarget = Number(times);
  updateRepeatHighlight();
}

function updateRepeatHighlight() {
  document.querySelectorAll(".repeat-button").forEach((button) => {
    const times = Number(button.dataset.repeat);
    button.classList.toggle("active-repeat", times === repeatTimesTarget);
  });
}

function previousSentence() {
  if (filteredSentences.length === 0) return;
  stopAutoPlayback();
  currentIndex = currentIndex - 1 < 0 ? filteredSentences.length - 1 : currentIndex - 1;
  renderSentence();
  startSinglePlay();
}

function nextSentence() {
  if (filteredSentences.length === 0) return;
  stopAutoPlayback();
  currentIndex = currentIndex + 1 >= filteredSentences.length ? 0 : currentIndex + 1;
  renderSentence();
  startSinglePlay();
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
  playbackToken++;
  clearPlaybackTimer();
  try { window.speechSynthesis.cancel(); } catch (error) {}
  isSpeaking = false;
  isPaused = false;
  currentUtterance = null;
  currentRepeatCount = 0;
  updatePauseButton();
}

function stopAllPlayback() {
  stopAutoPlayback();
  playMode = "single";
  updateModeHighlight();
  updatePlaybackStatus("⏹ 已停止");
}

function scheduleNext(repeatSame = false) {
  clearPlaybackTimer();
  isWaiting = true;
  isPaused = false;
  remainingWait = playbackInterval;
  waitStartedAt = Date.now();
  updatePlaybackStatus(`⏳ 等待 ${playbackInterval / 1000} 秒`);
  
  playbackTimer = setTimeout(() => finishWaiting(repeatSame), remainingWait);
}

function finishWaiting(repeatSame = false) {
  playbackTimer = null;
  isWaiting = false;
  remainingWait = 0;
  waitStartedAt = 0;
  if (isPaused) return;

  if (repeatSame) {
    speak();
  } else {
    if (playMode === "random") {
      currentIndex = Math.floor(Math.random() * filteredSentences.length);
    } else if (playMode === "continuous") {
      currentIndex = currentIndex + 1 >= filteredSentences.length ? 0 : currentIndex + 1;
    }
    renderSentence();
    speak();
  }
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
    playbackToken++;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    isSpeaking = false;
    currentUtterance = null;
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
   新增項目與自動判定邏輯
========================================================= */
function showAddForm() {
  const form = document.getElementById("addForm");
  if (form) form.style.display = "flex";
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

function autoDetectTypeAndCheckDuplicate() {
  const input = document.getElementById("newEnglish");
  const typeSelect = document.getElementById("newType");
  const warning = document.getElementById("duplicateWarning");
  if (!input) return;

  const rawText = input.value.trim();
  const words = rawText.split(/\s+/).filter(Boolean);

  if (typeSelect) {
    if (words.length <= 1) {
      typeSelect.value = "單字";
    } else if (words.length <= 4) {
      typeSelect.value = "片語";
    } else {
      typeSelect.value = "句子";
    }
  }

  if (!warning) return;
  const cleanText = rawText.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

  if (!cleanText) {
    warning.textContent = "";
    warning.style.display = "none";
    return;
  }

  const match = allSentences.find((item) => {
    const en = String(item["英文"] || "").trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
    return en === cleanText;
  });

  if (match) {
    warning.textContent = "⚠️ 資料庫已有相似項目：" + match["英文"];
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
  button.textContent = "✨ 自動翻譯與產生標籤";
  button.style.cssText = "margin-bottom: 8px; width: 100%;";
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
    if (message) message.textContent = "請先輸入英文內容";
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "⏳ 分析與翻譯中...";
  }
  if (message) message.textContent = "正在翻譯與產生 AI 標籤...";

  try {
    const urlTrans = API_URL + "?action=translate&英文=" + encodeURIComponent(english) + "&t=" + Date.now();
    const resTrans = await fetch(urlTrans, { method: "GET", cache: "no-store" });
    const resultTrans = await resTrans.json();

    if (resultTrans.success) {
      chineseInput.value = resultTrans.chinese || "";
    }

    await fetchAITags(english);

    if (message) message.textContent = "✅ 翻譯與標籤完成";
  } catch (err) {
    console.error("翻譯失敗：", err);
    if (message) message.textContent = "❌ 翻譯失敗：" + err.message;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "✨ 自動翻譯與產生標籤";
    }
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
    badge.textContent = "# " + tag;
    tagContainer.appendChild(badge);
  });
}

async function addSentence() {
  if (isSubmitting) return;

  const englishInput = document.getElementById("newEnglish");
  const chineseInput = document.getElementById("newChinese");
  const typeSelect = document.getElementById("newType");
  const statusSelect = document.getElementById("newStatus");
  const message = document.getElementById("addMessage");
  const addBtn = document.querySelector("#addForm button[onclick*='addSentence']");

  if (!englishInput || !chineseInput) return;

  const english = englishInput.value.trim();
  const chinese = chineseInput.value.trim();
  const type = typeSelect ? typeSelect.value : "句子";
  const status = statusSelect ? statusSelect.value : "1";

  if (!english) {
    if (message) message.textContent = "請輸入英文內容";
    return;
  }

  if (!chinese) {
    if (message) message.textContent = "請先翻譯或輸入中文";
    return;
  }

  isSubmitting = true;
  if (addBtn) addBtn.disabled = true;
  if (message) message.textContent = "正在儲存至 Google Sheet...";

  try {
    const tagsString = currentGeneratedTags.join(",");
    const url =
      API_URL +
      "?action=add" +
      "&英文=" + encodeURIComponent(english) +
      "&中文=" + encodeURIComponent(chinese) +
      "&類型=" + encodeURIComponent(type) +
      "&熟悉度=" + encodeURIComponent(status) +
      "&標籤=" + encodeURIComponent(tagsString) +
      "&t=" + Date.now();

    const response = await fetch(url, { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);

    const result = await response.json();
    if (!result.success) throw new Error(result.error || "新增失敗");

    if (message) message.textContent = "✅ 新增成功！";

    await loadData();
    setTimeout(hideAddForm, 600);
  } catch (err) {
    console.error("新增失敗：", err);
    if (message) message.textContent = "❌ 新增失敗：" + err.message;
  } finally {
    isSubmitting = false;
    if (addBtn) addBtn.disabled = false;
  }
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && event.target && event.target.id === "newEnglish") {
    event.preventDefault();
    translateNewSentence();
  }
});

// 暴露全域函式供 HTML 呼叫
window.switchViewMode = switchViewMode;
window.changeShow = changeShow;
window.blindMode = blindMode;
window.previousSentence = previousSentence;
window.nextSentence = nextSentence;
window.startSinglePlay = startSinglePlay;
window.setRepeatTimes = setRepeatTimes;
window.togglePause = togglePause;
window.stopAllPlayback = stopAllPlayback;
window.setSpeechRate = setSpeechRate;
window.startContinuousPlay = startContinuousPlay;
window.startRandomPlay = startRandomPlay;
window.setPlaybackInterval = setPlaybackInterval;
window.showAddForm = showAddForm;
window.hideAddForm = hideAddForm;
window.autoDetectTypeAndCheckDuplicate = autoDetectTypeAndCheckDuplicate;
window.addSentence = addSentence;
window.translateNewSentence = translateNewSentence;
window.updateCurrentRating = updateCurrentRating;
window.updateRatingInList = updateRatingInList;
window.speakItemText = speakItemText;
window.toggleAllChineseReadView = toggleAllChineseReadView;
window.onFilterChange = onFilterChange;
