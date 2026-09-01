// tabs.js - 主導覽（練習／查詢／知識，左右滑動過渡）
// 通用寫法：讀 .sidebar-item 的 data-view，對應 #<data-view>View 的元素，
// 以後要加新頁面只要照這個命名規則加 HTML，這支不用改。
// 導覽本身一律可見（手機是貼底分頁列，桌面是左側常駐欄），不需要開關邏輯。

(function () {
  'use strict';

  const navItems = document.querySelectorAll('.sidebar-item');
  if (navItems.length === 0) return;

  const viewOrder = [...navItems].map(t => t.dataset.view);
  const views = {};
  viewOrder.forEach(name => {
    const el = document.getElementById(`${name}View`);
    if (el) views[name] = el;
  });

  let currentView = viewOrder.find(name => views[name] && !views[name].classList.contains('hidden')) || viewOrder[0];
  const shownListeners = {}; // { viewName: fn }，該頁第一次/每次顯示時要跑的事

  function switchView(target) {
    if (target === currentView || !views[target] || !views[currentView]) return;

    const fromEl = views[currentView];
    const toEl   = views[target];
    const dir    = viewOrder.indexOf(target) > viewOrder.indexOf(currentView) ? 1 : -1;

    navItems.forEach(t => t.classList.toggle('active', t.dataset.view === target));
    currentView = target;

    // 進場前：先移出畫面外、不套用 transition，避免出現閃一下的位移
    toEl.classList.remove('hidden');
    toEl.classList.remove('view-transitioning');
    toEl.style.transform = `translateX(${dir * 100}%)`;
    toEl.style.opacity = '0';
    void toEl.offsetWidth; // 強制 reflow，讓上面這行先生效

    requestAnimationFrame(() => {
      fromEl.classList.add('view-transitioning');
      toEl.classList.add('view-transitioning');
      fromEl.style.transform = `translateX(${-dir * 100}%)`;
      fromEl.style.opacity = '0';
      toEl.style.transform = 'translateX(0)';
      toEl.style.opacity = '1';
    });

    const cleanup = () => {
      fromEl.classList.add('hidden');
      [fromEl, toEl].forEach(el => {
        el.classList.remove('view-transitioning');
        el.style.transform = '';
        el.style.opacity = '';
      });
      fromEl.removeEventListener('transitionend', cleanup);
    };
    fromEl.addEventListener('transitionend', cleanup);

    if (shownListeners[target]) shownListeners[target]();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });

  // 供其他模組註冊「切到某頁面時要做的事」（例如查詢頁要捲到中央 C）
  window.AppTabs = {
    onShown(name, fn) { shownListeners[name] = fn; },
    switchView,
  };
})();
