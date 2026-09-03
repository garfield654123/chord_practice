// tabs.js - 側邊欄導覽（練習／查詢／知識，左右滑動過渡）
// 通用寫法：讀 .sidebar-item 的 data-view，對應 #<data-view>View 的元素，
// 以後要加新頁面只要照這個命名規則加 HTML，這支不用改。

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

  // ========== 頂部標題列：標題文字 + 專屬按鈕，跟著目前頁面切換 ==========
  // 標題文字直接沿用側邊欄該項目的 icon + 文字（單一資料來源，不用每加一頁就多改一處）；
  // 換一題／設定只跟練習頁有關，用 view-page 元素上的 data-header-actions="true" 標記
  // 哪個頁面要顯示這排按鈕，之後要加新頁面／改變哪頁該顯示，改 HTML 就好，這支不用改。
  const appTitle      = document.getElementById('appTitle');
  const headerActions = document.querySelector('.header-actions');

  function applyChrome(name) {
    const viewEl = views[name];
    const navBtn = document.querySelector(`.sidebar-item[data-view="${name}"]`);
    if (appTitle && navBtn) {
      const icon  = navBtn.querySelector('.sidebar-item-icon')?.textContent || '';
      const label = navBtn.lastElementChild?.textContent || '';
      appTitle.textContent = [icon, label].filter(Boolean).join(' ');
    }
    if (headerActions) {
      headerActions.classList.toggle('hidden', !viewEl || viewEl.dataset.headerActions !== 'true');
    }
  }
  applyChrome(currentView);

  function switchView(target) {
    if (target === currentView || !views[target] || !views[currentView]) return;

    const fromEl = views[currentView];
    const toEl   = views[target];
    const dir    = viewOrder.indexOf(target) > viewOrder.indexOf(currentView) ? 1 : -1;

    navItems.forEach(t => t.classList.toggle('active', t.dataset.view === target));
    currentView = target;
    applyChrome(target);

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

  // ========== 側邊欄開關 ==========
  const sidebar     = document.getElementById('sidebar');
  const overlay     = document.getElementById('sidebarOverlay');
  const toggleBtn   = document.getElementById('sidebarToggle');
  const closeBtn    = document.getElementById('sidebarClose');

  function openSidebar() {
    if (sidebar)  sidebar.classList.add('open');
    if (overlay)  overlay.classList.add('open');
  }
  function closeSidebar() {
    if (sidebar)  sidebar.classList.remove('open');
    if (overlay)  overlay.classList.remove('open');
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
  if (closeBtn)  closeBtn.addEventListener('click', closeSidebar);
  if (overlay)   overlay.addEventListener('click', closeSidebar);

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      switchView(item.dataset.view);
      closeSidebar();
    });
  });

  // 供其他模組註冊「切到某頁面時要做的事」（例如查詢頁要捲到中央 C）
  window.AppTabs = {
    onShown(name, fn) { shownListeners[name] = fn; },
    switchView,
  };
})();
