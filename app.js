// =========================================================
// 全域變數宣告
// =========================================================
let sentences = [];
let currentIndex = 0;
let playMode = "single"; // "single", "continuous", "random"
let repeatLimit = 2;
let currentRepeatCount = 0;
let speechRate = 0.9;
let isPlaying = false;
let currentUtterance = null;

// 請依照您的 Google Apps Script 部署 URL 進行替換 (若使用同域網址可保留預設)
const GAS_API_URL = "YOUR_GAS_WEB_APP_URL"; 

// =========================================================
// 初始化
// =========================================================
window.onload = function() {
  loadData();
};

function loadData() {
  // 如果有連結 GAS Web App 則從後端抓取，否則載入預設範例
  if (typeof GAS_API_URL !== "undefined" && GAS_API_URL.startsWith("http")) {
    fetch(GAS_API_URL)
      .then(res => res.json())
      .then(data => {
        sentences = data;
        if (sentences.length > 0) {
          currentIndex = 0;
          renderSentence();
        }
      })
      .catch(err => {
        console.error("載入失敗，使用備用資料", err);
        loadDefaultData();
      });
  } else {
    loadDefaultData();
  }
}

function loadDefaultData() {
  sentences = [
    { en: "Hello, how are you?", zh: "你好，你好嗎？", meta: "熟悉度: 3" },
    { en: "Practice makes perfect.", zh: "熟能生巧。", meta: "熟悉度: 1" },
    { en: "Never give up on your dreams.", zh: "絕不放棄你的夢想。", meta: "熟悉度: 2" }
  ];
  currentIndex = 0;
  renderSentence();
}

// =========================================================
// 畫面渲染與設定
// =========================================================
function renderSentence() {
  if (sentences.length === 0) return;
  const item = sentences[currentIndex];
  document.getElementById("cardEn").innerText = item.en || "";
  document.getElementById("cardZh").innerText = item.zh || "";
  document.getElementById("cardMeta").innerText = item.meta ? `(${currentIndex + 1}/${sentences.length}) - ${item.meta}` : `(${currentIndex + 1}/${sentences.length})`;
}

function updateSettings() {
  repeatLimit = parseInt(document.getElementById("repeatSelect").value, 10);
  speechRate = parseFloat(document.getElementById("rateRange").value);
  document.getElementById("rateVal").innerText = speechRate;
}

// =========================================================
// 獨立且精準的播放模式高亮控制
// =========================================================
function updateModeHighlight() {
  const btnContinuous = document.getElementById("btnContinuous");
  const btnRandom = document.getElementById("btnRandom");

  // 重置連續播放按鈕狀態
  if (btnContinuous) {
    if (playMode === "continuous") {
      btnContinuous.style.backgroundColor = "#2563eb"; // 高亮藍色
      btnContinuous.style.color = "#ffffff";
    } else {
      btnContinuous.style.backgroundColor = "#10b981"; // 預設綠色
      btnContinuous.style.color = "#ffffff";
    }
  }

  // 重置隨機播放按鈕狀態
  if (btnRandom) {
    if (playMode === "random") {
      btnRandom.style.backgroundColor = "#2563eb"; // 高亮藍色
      btnRandom.style.color = "#ffffff";
    } else {
      btnRandom.style.backgroundColor = "#10b981"; // 預設綠色
      btnRandom.style.color = "#ffffff";
    }
  }
}

// =========================================================
// 播放控制邏輯
// =========================================================
function startSinglePlay() {
  stopPlay();
  playMode = "single";
  currentRepeatCount = 0;
  updateModeHighlight();
  speak();
}

function startContinuousPlay() {
  if (sentences.length === 0) return;
  stopPlay();
  playMode = "continuous";
  currentRepeatCount = 0;
  updateModeHighlight();
  speak();
}

function startRandomPlay() {
  if (sentences.length === 0) return;
  stopPlay();
  playMode = "random";
  currentRepeatCount = 0;
  updateModeHighlight();
  currentIndex = Math.floor(Math.random() * sentences.length);
  renderSentence();
  speak();
}

function stopPlay() {
  isPlaying = false;
  playMode = "single";
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  updateModeHighlight();
}

function prevSentence() {
  stopPlay();
  if (sentences.length === 0) return;
  currentIndex = (currentIndex - 1 + sentences.length) % sentences.length;
  renderSentence();
}

function nextSentence() {
  stopPlay();
  if (sentences.length === 0) return;
  currentIndex = (currentIndex + 1) % sentences.length;
  renderSentence();
}

// =========================================================
// 語音合成發音核心 (TTS)
// =========================================================
function speak() {
  if (sentences.length === 0) return;
  
  if (!('speechSynthesis' in window)) {
    alert("您的瀏覽器不支援語音合成功能");
    return;
  }

  window.speechSynthesis.cancel(); // 清空排隊

  const currentItem = sentences[currentIndex];
  currentUtterance = new SpeechSynthesisUtterance(currentItem.en);
  currentUtterance.lang = "en-US";
  currentUtterance.rate = speechRate;

  isPlaying = true;

  currentUtterance.onend = function() {
    if (!isPlaying) return;

    currentRepeatCount++;

    // 檢查目前句子是否已經達到重複播放次數
    if (currentRepeatCount < repeatLimit) {
      speak(); // 繼續重播當前句子
    } else {
      // 達到次數，準備切換下一首/下一句
      currentRepeatCount = 0;

      if (playMode === "continuous") {
        currentIndex = (currentIndex + 1) % sentences.length;
        renderSentence();
        speak();
      } else if (playMode === "random") {
        currentIndex = Math.floor(Math.random() * sentences.length);
        renderSentence();
        speak();
      } else {
        // 單次播放模式，播放完畢停止
        isPlaying = false;
        updateModeHighlight();
      }
    }
  };

  currentUtterance.onerror = function(e) {
    console.error("TTS 發音錯誤:", e);
    isPlaying = false;
    updateModeHighlight();
  };

  window.speechSynthesis.speak(currentUtterance);
}
