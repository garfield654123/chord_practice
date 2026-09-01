// layout.js - 手機版／電腦版版面手動切換
// 放在 <head> 盡早執行，在畫面畫出來之前就把 <html data-layout="..."> 設好，
// 避免先閃一下錯的版面（FOUC）。css/style.css 裡凡是 html[data-layout="desktop"] ... 開頭
// 的規則都靠這個屬性決定要不要套用，不是單純看螢幕寬度的 media query。
//
// 規則：
// - 使用者還沒手動切換過 → 用螢幕寬度自動判斷（≥860px 視為電腦版），
//   而且會持續跟著視窗縮放/轉向即時更新。
// - 使用者按過標題列的切換鈕之後 → 記住這次選的版面，之後都用這個，不再自動判斷。

(function () {
  'use strict';

  const STORAGE_KEY = 'chord-layout-mode-v1';
  const mq = window.matchMedia('(min-width: 860px)');

  function getSaved() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  function setSaved(mode) {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* 私密瀏覽等情境，不強求持久化 */ }
  }
  function detect() {
    return mq.matches ? 'desktop' : 'mobile';
  }

  function updateButton(mode) {
    const btn = document.getElementById('layoutToggleBtn');
    if (!btn) return;
    // 按鈕顯示「按下去會切換成什麼」，不是目前是什麼
    if (mode === 'desktop') {
      btn.textContent = '📱';
      btn.setAttribute('aria-label', '切換成手機版面');
      btn.title = '切換成手機版面';
    } else {
      btn.textContent = '🖥️';
      btn.setAttribute('aria-label', '切換成電腦版面');
      btn.title = '切換成電腦版面';
    }
  }

  function apply(mode) {
    document.documentElement.dataset.layout = mode;
    updateButton(mode);
  }

  apply(getSaved() || detect());

  // 使用者還沒手動切過的話，畫面寬度變化（轉螢幕、縮放視窗）要跟著即時更新
  const onViewportChange = () => { if (!getSaved()) apply(detect()); };
  if (mq.addEventListener) mq.addEventListener('change', onViewportChange);
  else if (mq.addListener) mq.addListener(onViewportChange); // 舊版 Safari 後援

  function init() {
    const btn = document.getElementById('layoutToggleBtn');
    if (!btn) return;
    updateButton(document.documentElement.dataset.layout);
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.layout === 'desktop' ? 'mobile' : 'desktop';
      setSaved(next);
      apply(next);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
