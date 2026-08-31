// ios-pwa.js - iOS 專屬 PWA 補強：
// 1) 啟動畫面（splash screen）：iOS 沒辦法像 Android 一樣用 manifest 自動產生，且必須是
//    精確符合當下裝置解析度的靜態圖片才會生效。與其維護一份每年都會因新機型而過時的
//    裝置尺寸清單，改成用當下裝置的實際螢幕解析度即時畫出來，新機型也不用再更新。
// 2) 「加入主畫面」引導：iOS Safari 不支援 beforeinstallprompt，無法跳出安裝提示，
//    需要自己顯示「請手動加入主畫面」的說明。
// 這支必須盡早載入（在 <head> 內、不要加 defer/async），確保使用者點擊分享鍵之前，
// 啟動畫面的 <link> 標籤已經在 DOM 裡。

(function () {
  'use strict';

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (!isIOS) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  // ── 1) 啟動畫面：依目前裝置實際解析度即時產生 ──────────────
  function injectSplashScreen() {
    try {
      const dpr = window.devicePixelRatio || 2;
      const w = Math.round(window.screen.width * dpr);
      const h = Math.round(window.screen.height * dpr);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#1a1a2e'; // 與 manifest.json 的 background_color 一致
      ctx.fillRect(0, 0, w, h);

      const icon = new Image();
      icon.onload = () => {
        const size = Math.min(w, h) * 0.34;
        ctx.drawImage(icon, (w - size) / 2, (h - size) / 2, size, size);
        const link = document.createElement('link');
        link.rel = 'apple-touch-startup-image';
        link.href = canvas.toDataURL('image/png');
        document.head.appendChild(link);
      };
      icon.onerror = () => {}; // 啟動畫面非必要功能，圖示載入失敗就略過
      icon.src = 'icons/icon-512.png';
    } catch {
      // Canvas 或裝置不支援就略過，不影響其他功能
    }
  }

  if (!isStandalone) injectSplashScreen();

  // ── 2)「加入主畫面」引導 ─────────────────────────────────
  function initInstallBanner() {
    if (isStandalone) return; // 已經是安裝後的 App 模式，不用提示

    const DISMISS_KEY = 'chord-ios-banner-dismissed-v1';
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch { /* 無法存取 localStorage（例如私密瀏覽）就照樣顯示，只是關閉後不會記住 */ }

    const banner = document.getElementById('iosInstallBanner');
    const dismissBtn = document.getElementById('iosInstallDismiss');
    if (!banner || !dismissBtn) return;

    banner.classList.remove('hidden');
    dismissBtn.addEventListener('click', () => {
      banner.classList.add('hidden');
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInstallBanner);
  } else {
    initInstallBanner();
  }
})();
