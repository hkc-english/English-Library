/* =========================================================
   English Library - app.js 最終整合版
========================================================= */


/* =========================================================
   Google Apps Script Web App URL
   目前實際部署且測試成功的版本
========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbyL3VisnFbNnt5Sj-2_78kJxAsCD49LplNAQ3CyGvQipAwG1E3-M0Ea35HzTIensStz/exec";


/* =========================================================
   全域變數
========================================================= */

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


/* =========================================================
   初始化
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function () {

    loadVoices();

    updateShowHighlight();

    updateSpeedHighlight();

    updateIntervalHighlight();

    updatePauseButton();

    setupTranslationButton();

    loadData();

  }
);


if (
  "speechSynthesis" in window
) {

  window.speechSynthesis.onvoiceschanged =
    loadVoices;

}


/* =========================================================
   載入 Google Sheet 資料
========================================================= */

async function loadData() {

  const count =
    document.getElementById(
      "count"
    );

  const error =
    document.getElementById(
      "errorMessage"
    );


  if (count) {

    count.textContent =
      "資料載入中...";

  }


  if (error) {

    error.textContent =
      "";

  }


  try {

    const response =
      await fetch(
        API_URL +
        "?t=" +
        Date.now(),
        {
          method: "GET",
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const data =
      await response.json();


    if (
      !Array.isArray(data)
    ) {

      throw new Error(
        data.error ||
        "資料格式錯誤"
      );

    }


    sentences =
      data.filter(
        function (item) {

          return (
            item &&
            String(
              item["英文"] || ""
            ).trim() !== ""
          );

        }
      );


    if (
      sentences.length === 0
    ) {

      currentIndex =
        0;

      renderSentence();


      if (count) {

        count.textContent =
          "目前沒有英文資料";

      }

      return;

    }


    if (
      currentIndex >=
      sentences.length
    ) {

      currentIndex =
        sentences.length - 1;

    }


    if (
      currentIndex < 0
    ) {

      currentIndex =
        0;

    }


    renderSentence();


  } catch (error) {

    console.error(
      "資料載入失敗：",
      error
    );


    if (count) {

      count.textContent =
        "資料載入失敗";

    }


    showError(
      "資料載入失敗：" +
      error.message
    );

  }

}


/* =========================================================
   顯示目前句子
========================================================= */

function renderSentence() {

  const english =
    document.getElementById(
      "english"
    );

  const chinese =
    document.getElementById(
      "chinese"
    );

  const count =
    document.getElementById(
      "count"
    );


  if (
    !english ||
    !chinese
  ) {

    return;

  }


  if (
    sentences.length === 0
  ) {

    english.textContent =
      "目前沒有英文資料";

    chinese.textContent =
      "";

    return;

  }


  const item =
    sentences[currentIndex];


  const en =
    String(
      item["英文"] || ""
    );


  const zh =
    String(
      item["中文"] || ""
    );


  english.textContent =
    "";

  chinese.textContent =
    "";


  if (
    currentShowMode === "en"
  ) {

    english.textContent =
      en;

  }


  else if (
    currentShowMode === "zh"
  ) {

    chinese.textContent =
      zh;

  }


  else if (
    currentShowMode === "both"
  ) {

    english.textContent =
      en;

    chinese.textContent =
      zh;

  }


  else if (
    currentShowMode === "blind"
  ) {

    english.textContent =
      "";

    chinese.textContent =
      "";

  }


  /* ======================================
     永遠顯示句子位置
     例如：第 37 / 148 筆
  ====================================== */

  if (count) {

    count.textContent =
      "第 " +
      (currentIndex + 1) +
      " / " +
      sentences.length +
      " 筆";

  }


  updateShowHighlight();

}


/* =========================================================
   顯示模式
========================================================= */

function changeShow(
  mode
) {

  currentShowMode =
    mode;

  renderSentence();

}


function blindMode() {

  currentShowMode =
    "blind";

  renderSentence();

}


/* =========================================================
   顯示模式高亮
========================================================= */

function updateShowHighlight() {

  const buttons =
    document.querySelectorAll(
      ".toolbar button"
    );


  buttons.forEach(
    function (button) {

      button.classList.remove(
        "active"
      );

    }
  );


  const modeIndex = {

    en: 0,

    zh: 1,

    both: 2,

    blind: 3

  };


  const index =
    modeIndex[
      currentShowMode
    ];


  if (
    buttons[index]
  ) {

    buttons[index].classList.add(
      "active"
    );

  }

}


/* =========================================================
   載入英文語音
========================================================= */

function loadVoices() {

  if (
    !("speechSynthesis" in window)
  ) {

    return;

  }


  const voices =
    window.speechSynthesis
      .getVoices();


  const englishVoices =
    voices.filter(
      function (voice) {

        return (
          voice.lang &&
          voice.lang
            .toLowerCase()
            .startsWith("en")
        );

      }
    );


  if (
    englishVoices.length === 0
  ) {

    return;

  }


  const preferred = [

    "Samantha",

    "Alex",

    "Karen",

    "Daniel",

    "Moira",

    "Google US English",

    "Microsoft Jenny",

    "Microsoft Aria"

  ];


  for (
    const name of preferred
  ) {

    const found =
      englishVoices.find(
        function (voice) {

          return voice.name
            .toLowerCase()
            .includes(
              name.toLowerCase()
            );

        }
      );


    if (found) {

      selectedVoice =
        found;

      return;

    }

  }


  selectedVoice =
    englishVoices[0];

}


/* =========================================================
   播放目前句子
========================================================= */

function speak() {

  if (
    sentences.length === 0
  ) {

    return;

  }


  const text =
    String(
      sentences[currentIndex]["英文"] ||
      ""
    ).trim();


  if (!text) {

    return;

  }


  clearPlaybackTimer();


  try {

    window.speechSynthesis.cancel();

  } catch (error) {

    console.error(
      "取消舊語音失敗：",
      error
    );

  }


  isSpeaking =
    false;

  isPaused =
    false;

  currentUtterance =
    null;


  const token =
    ++playbackToken;


  const utterance =
    new SpeechSynthesisUtterance(
      text
    );


  currentUtterance =
    utterance;


  utterance.lang =
    "en-US";


  utterance.rate =
    speechRate;


  utterance.pitch =
    1;


  utterance.volume =
    1;


  if (selectedVoice) {

    utterance.voice =
      selectedVoice;

  }


  utterance.onstart =
    function () {

      if (
        token !==
        playbackToken
      ) {

        return;

      }


      isSpeaking =
        true;

      isPaused =
        false;


      updatePauseButton();


      if (
        isContinuousPlaying
      ) {

        updatePlaybackStatus(
          isRandomPlaying
            ? "🔀 隨機播放中"
            : "▶️ 連續播放中"
        );

      }

      else {

        updatePlaybackStatus(
          "🔊 播放中"
        );

      }

    };


  utterance.onpause =
    function () {

      if (
        token !==
        playbackToken
      ) {

        return;

      }


      isPaused =
        true;


      updatePauseButton();

      updatePlaybackStatus(
        "⏸ 已暫停"
      );

    };


  utterance.onresume =
    function () {

      if (
        token !==
        playbackToken
      ) {

        return;

      }


      isPaused =
        false;


      updatePauseButton();


      updatePlaybackStatus(
        isContinuousPlaying
          ? "▶️ 播放中"
          : "🔊 播放中"
      );

    };


  utterance.onend =
    function () {

      if (
        token !==
        playbackToken
      ) {

        return;

      }


      isSpeaking =
        false;

      isPaused =
        false;

      currentUtterance =
        null;


      updatePauseButton();


      if (
        isContinuousPlaying
      ) {

        scheduleNext();

      }

      else {

        updatePlaybackStatus(
          "播放完成"
        );

      }

    };


  utterance.onerror =
    function (event) {

      if (
        token !==
        playbackToken
      ) {

        return;

      }


      console.error(
        "語音播放錯誤：",
        event
      );


      isSpeaking =
        false;

      currentUtterance =
        null;

      isPaused =
        false;


      updatePauseButton();


      if (
        isContinuousPlaying
      ) {

        scheduleNext();

      }

      else {

        updatePlaybackStatus(
          "播放錯誤"
        );

      }

    };


  /*
    Safari 有時 cancel() 後立即 speak()
    會吃掉第一個 utterance。
  */

  setTimeout(
    function () {

      if (
        token !==
        playbackToken
      ) {

        return;

      }


      try {

        window.speechSynthesis.speak(
          utterance
        );

      } catch (error) {

        console.error(
          "開始語音失敗：",
          error
        );

      }

    },
    80
  );

}


/* =========================================================
   上一句
========================================================= */

function previousSentence() {

  if (
    sentences.length === 0
  ) {

    return;

  }


  stopAutoPlayback();


  currentIndex =
    currentIndex - 1;


  if (
    currentIndex < 0
  ) {

    currentIndex =
      sentences.length - 1;

  }


  renderSentence();


  setTimeout(
    function () {

      speak();

    },
    100
  );

}


/* =========================================================
   下一句
========================================================= */

function nextSentence() {

  if (
    sentences.length === 0
  ) {

    return;

  }


  stopAutoPlayback();


  currentIndex =
    currentIndex + 1;


  if (
    currentIndex >=
    sentences.length
  ) {

    currentIndex =
      0;

  }


  renderSentence();


  setTimeout(
    function () {

      speak();

    },
    100
  );

}


/* =========================================================
   暫停 / 繼續
========================================================= */

function togglePause() {

  if (
    isSpeaking
  ) {

    if (
      isPaused
    ) {

      window.speechSynthesis.resume();

      isPaused =
        false;

    }

    else {

      window.speechSynthesis.pause();

      isPaused =
        true;

    }


    updatePauseButton();


    return;

  }


  if (
    isWaiting
  ) {

    if (
      isPaused
    ) {

      resumeWaiting();

    }

    else {

      pauseWaiting();

    }

  }

}


/* =========================================================
   暫停等待
========================================================= */

function pauseWaiting() {

  if (
    !isWaiting
  ) {

    return;

  }


  const elapsed =
    Date.now() -
    waitStartedAt;


  remainingWait =
    Math.max(
      0,
      remainingWait -
      elapsed
    );


  clearPlaybackTimer();


  isWaiting =
    true;

  isPaused =
    true;


  updatePauseButton();


  updatePlaybackStatus(
    "⏸ 間隔已暫停"
  );

}


/* =========================================================
   繼續等待
========================================================= */

function resumeWaiting() {

  if (
    !isWaiting ||
    !isPaused
  ) {

    return;

  }


  isPaused =
    false;


  waitStartedAt =
    Date.now();


  playbackTimer =
    setTimeout(
      finishWaiting,
      remainingWait
    );


  updatePauseButton();


  updatePlaybackStatus(
    "⏳ 等待下一句"
  );

}


/* =========================================================
   停止自動播放
========================================================= */

function stopAutoPlayback() {

  isContinuousPlaying =
    false;

  isRandomPlaying =
    false;


  playbackToken++;


  clearPlaybackTimer();


  try {

    window.speechSynthesis.cancel();

  } catch (error) {

    console.error(
      "停止語音失敗：",
      error
    );

  }


  isSpeaking =
    false;

  isPaused =
    false;

  currentUtterance =
    null;


  updatePauseButton();

}


/* =========================================================
   完全停止
========================================================= */

function stopAllPlayback() {

  stopAutoPlayback();


  updatePlaybackStatus(
    "⏹ 已停止"
  );

}


/* =========================================================
   連續播放
========================================================= */

function startContinuousPlay() {

  if (
    sentences.length === 0
  ) {

    return;

  }


  isContinuousPlaying =
    true;

  isRandomPlaying =
    false;

  isPaused =
    false;


  playbackToken++;


  clearPlaybackTimer();


  speak();

}


/* =========================================================
   隨機播放
========================================================= */

function startRandomPlay() {

  if (
    sentences.length === 0
  ) {

    return;

  }


  isRandomPlaying =
    true;

  isContinuousPlaying =
    true;

  isPaused =
    false;


  playbackToken++;


  clearPlaybackTimer();


  currentIndex =
    Math.floor(
      Math.random() *
      sentences.length
    );


  renderSentence();


  speak();

}


/* =========================================================
   下一句排程
========================================================= */

function scheduleNext() {

  clearPlaybackTimer();


  if (
    !isContinuousPlaying
  ) {

    return;

  }


  isWaiting =
    true;

  isPaused =
    false;


  remainingWait =
    playbackInterval;


  waitStartedAt =
    Date.now();


  updatePlaybackStatus(
    "⏳ 等待 " +
    (
      playbackInterval /
      1000
    ) +
    " 秒"
  );


  playbackTimer =
    setTimeout(
      finishWaiting,
      remainingWait
    );

}


/* =========================================================
   完成等待
========================================================= */

function finishWaiting() {

  playbackTimer =
    null;


  isWaiting =
    false;

  remainingWait =
    0;

  waitStartedAt =
    0;


  if (
    !isContinuousPlaying
  ) {

    return;

  }


  if (
    isPaused
  ) {

    return;

  }


  if (
    isRandomPlaying
  ) {

    currentIndex =
      Math.floor(
        Math.random() *
        sentences.length
      );

  }

  else {

    currentIndex =
      currentIndex + 1;


    if (
      currentIndex >=
      sentences.length
    ) {

      currentIndex =
        0;

    }

  }


  renderSentence();


  speak();

}


/* =========================================================
   清除計時器
========================================================= */

function clearPlaybackTimer() {

  if (
    playbackTimer !== null
  ) {

    clearTimeout(
      playbackTimer
    );

    playbackTimer =
      null;

  }


  isWaiting =
    false;

}


/* =========================================================
   播放速度
========================================================= */

function setSpeechRate(
  rate
) {

  let value =
    Number(rate);


  if (
    isNaN(value)
  ) {

    return;

  }


  value =
    Math.max(
      0.3,
      Math.min(
        1.2,
        value
      )
    );


  speechRate =
    Number(
      value.toFixed(1)
    );


  updateSpeedHighlight();


  if (
    isSpeaking &&
    !isPaused
  ) {

    const keepContinuous =
      isContinuousPlaying;

    const keepRandom =
      isRandomPlaying;


    playbackToken++;


    try {

      window.speechSynthesis.cancel();

    } catch (error) {

      console.error(error);

    }


    isSpeaking =
      false;

    currentUtterance =
      null;


    isContinuousPlaying =
      keepContinuous;

    isRandomPlaying =
      keepRandom;


    setTimeout(
      function () {

        speak();

      },
      120
    );

  }

}


/* =========================================================
   速度高亮
========================================================= */

function updateSpeedHighlight() {

  const buttons =
    document.querySelectorAll(
      ".speed-button"
    );


  buttons.forEach(
    function (button) {

      const rate =
        Number(
          button.dataset.rate
        );


      if (
        Math.abs(
          rate -
          speechRate
        ) < 0.001
      ) {

        button.classList.add(
          "active-speed"
        );

      }

      else {

        button.classList.remove(
          "active-speed"
        );

      }

    }
  );

}


/* =========================================================
   設定句子間隔
========================================================= */

function setPlaybackInterval(
  interval
) {

  const value =
    Number(interval);


  if (
    isNaN(value)
  ) {

    return;

  }


  playbackInterval =
    value;


  updateIntervalHighlight();

}


/* =========================================================
   間隔高亮
========================================================= */

function updateIntervalHighlight() {

  const buttons =
    document.querySelectorAll(
      ".interval-button"
    );


  buttons.forEach(
    function (button) {

      const interval =
        Number(
          button.dataset.interval
        );


      if (
        interval ===
        playbackInterval
      ) {

        button.classList.add(
          "active-interval"
        );

      }

      else {

        button.classList.remove(
          "active-interval"
        );

      }

    }
  );

}


/* =========================================================
   暫停按鈕
========================================================= */

function updatePauseButton() {

  const button =
    document.getElementById(
      "pauseButton"
    );


  if (!button) {

    return;

  }


  button.textContent =
    isPaused
      ? "▶ 繼續"
      : "⏸ 暫停";

}


/* =========================================================
   播放狀態
========================================================= */

function updatePlaybackStatus(
  text
) {

  const element =
    document.getElementById(
      "playbackStatus"
    );


  if (
    element
  ) {

    element.textContent =
      text || "";

  }

}


/* =========================================================
   顯示錯誤
========================================================= */

function showError(
  message
) {

  const element =
    document.getElementById(
      "errorMessage"
    );


  if (
    element
  ) {

    element.textContent =
      "❌ " +
      message;

  }

}


/* =========================================================
   新增表單
========================================================= */

function showAddForm() {

  const form =
    document.getElementById(
      "addForm"
    );


  if (form) {

    form.style.display =
      "block";

  }


  const input =
    document.getElementById(
      "newEnglish"
    );


  if (input) {

    input.focus();

  }

}


function hideAddForm() {

  const form =
    document.getElementById(
      "addForm"
    );


  if (form) {

    form.style.display =
      "none";

  }


  const english =
    document.getElementById(
      "newEnglish"
    );


  const chinese =
    document.getElementById(
      "newChinese"
    );


  const message =
    document.getElementById(
      "addMessage"
    );


  if (english) {

    english.value =
      "";

  }


  if (chinese) {

    chinese.value =
      "";

  }


  if (message) {

    message.textContent =
      "";

  }

}


/* =========================================================
   自動翻譯按鈕
========================================================= */

function setupTranslationButton() {

  const englishInput =
    document.getElementById(
      "newEnglish"
    );

  const chineseInput =
    document.getElementById(
      "newChinese"
    );


  if (
    !englishInput ||
    !chineseInput
  ) {

    return;

  }


  if (
    document.getElementById(
      "translateButton"
    )
  ) {

    return;

  }


  const button =
    document.createElement(
      "button"
    );


  button.id =
    "translateButton";


  button.type =
    "button";


  button.textContent =
    "✨ 自動翻譯";


  button.onclick =
    translateNewSentence;


  chineseInput.parentNode.insertBefore(
    button,
    chineseInput
  );

}


/* =========================================================
   自動翻譯
   使用目前正確的 Web App URL
========================================================= */

async function translateNewSentence() {

  const englishInput =
    document.getElementById(
      "newEnglish"
    );

  const chineseInput =
    document.getElementById(
      "newChinese"
    );

  const message =
    document.getElementById(
      "addMessage"
    );

  const button =
    document.getElementById(
      "translateButton"
    );


  if (
    !englishInput ||
    !chineseInput
  ) {

    return;

  }


  const english =
    englishInput.value.trim();


  if (!english) {

    if (message) {

      message.textContent =
        "請先輸入英文句子";

    }

    return;

  }


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "⏳ 翻譯中...";

  }


  if (message) {

    message.textContent =
      "正在翻譯...";

  }


  try {

    const url =
      API_URL +
      "?action=translate" +
      "&英文=" +
      encodeURIComponent(
        english
      ) +
      "&t=" +
      Date.now();


    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const result =
      await response.json();


    if (
      !result.success
    ) {

      throw new Error(
        result.error ||
        "翻譯失敗"
      );

    }


    chineseInput.value =
      result.chinese ||
      "";


    if (message) {

      message.textContent =
        "✅ 翻譯完成";

    }

  } catch (error) {

    console.error(
      "自動翻譯失敗：",
      error
    );


    if (message) {

      message.textContent =
        "❌ 翻譯失敗：" +
        error.message;

    }

  }


  if (button) {

    button.disabled =
      false;

    button.textContent =
      "✨ 自動翻譯";

  }

}


/* =========================================================
   新增句子
========================================================= */

async function addSentence() {

  const englishInput =
    document.getElementById(
      "newEnglish"
    );

  const chineseInput =
    document.getElementById(
      "newChinese"
    );

  const message =
    document.getElementById(
      "addMessage"
    );


  if (
    !englishInput ||
    !chineseInput
  ) {

    return;

  }


  const english =
    englishInput.value.trim();


  const chinese =
    chineseInput.value.trim();


  if (!english) {

    if (message) {

      message.textContent =
        "請輸入英文句子";

    }

    return;

  }


  if (!chinese) {

    if (message) {

      message.textContent =
        "請先自動翻譯或輸入中文";

    }

    return;

  }


  if (message) {

    message.textContent =
      "正在儲存...";

  }


  try {

    const url =
      API_URL +
      "?action=add" +
      "&英文=" +
      encodeURIComponent(
        english
      ) +
      "&中文=" +
      encodeURIComponent(
        chinese
      ) +
      "&熟悉度=" +
      encodeURIComponent(
        "陌生"
      ) +
      "&t=" +
      Date.now();


    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const result =
      await response.json();


    if (
      !result.success
    ) {

      throw new Error(
        result.error ||
        "新增失敗"
      );

    }


    const newId =
      Number(
        result.id
      );


    if (message) {

      message.textContent =
        "✅ 新增成功";

    }


    await loadData();


    const newIndex =
      sentences.findIndex(
        function (item) {

          return (
            Number(item.ID) ===
            newId
          );

        }
      );


    if (
      newIndex !== -1
    ) {

      currentIndex =
        newIndex;

      renderSentence();

    }


    setTimeout(
      function () {

        hideAddForm();

      },
      800
    );


  } catch (error) {

    console.error(
      "新增句子失敗：",
      error
    );


    if (message) {

      message.textContent =
        "❌ 新增失敗：" +
        error.message;

    }

  }

}


/* =========================================================
   Enter 自動翻譯
========================================================= */

document.addEventListener(
  "keydown",
  function (event) {

    if (
      event.key === "Enter" &&
      event.target &&
      event.target.id ===
        "newEnglish"
    ) {

      event.preventDefault();

      translateNewSentence();

    }

  }
);


/* =========================================================
   HTML onclick
========================================================= */

window.changeShow =
  changeShow;

window.blindMode =
  blindMode;

window.previousSentence =
  previousSentence;

window.nextSentence =
  nextSentence;

window.speak =
  speak;

window.togglePause =
  togglePause;

window.stopAllPlayback =
  stopAllPlayback;

window.setSpeechRate =
  setSpeechRate;

window.startContinuousPlay =
  startContinuousPlay;

window.startRandomPlay =
  startRandomPlay;

window.setPlaybackInterval =
  setPlaybackInterval;

window.showAddForm =
  showAddForm;

window.hideAddForm =
  hideAddForm;

window.addSentence =
  addSentence;

window.translateNewSentence =
  translateNewSentence;
