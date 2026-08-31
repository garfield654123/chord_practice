// knowledge.js - 和弦知識頁：和弦符號分類教學 + 可調整根音/低音範例 + 五線譜示範
// 內容（和弦名稱、結構說明、音程公式）直接沿用 chord.js 既有的 CHORD_TYPES / CHORD_HINTS，
// 分類方式參考常見和弦符號教學文章（大和弦系列／小和弦系列／屬和弦系列／特殊性質／掛留和弦）

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const els = {
    rootSelector: $('#knowledgeRootSelector'),
    bassSelect:   $('#knowledgeBassSelect'),
    symbol:       $('#knowledgeSymbol'),
    name:         $('#knowledgeName'),
    formula:      $('#knowledgeFormula'),
    desc:         $('#knowledgeDesc'),
    groups:       $('#knowledgeGroups'),
  };

  if (!els.rootSelector) return; // 頁面元素不存在就不初始化（防呆）

  // 分類方式：大和弦系列／小和弦系列／屬和弦系列／特殊性質／掛留和弦，
  // 涵蓋 CHORD_TYPES 全部 21 種和弦
  const SYMBOL_GROUPS = [
    { label: '大和弦系列',    desc: '字尾不寫或加 maj / ∆',   types: ['maj', '6', 'add9', 'maj7', 'maj9', '6/9', 'maj11'] },
    { label: '小和弦系列',    desc: '字尾加 m / −',           types: ['min', 'min6', 'min7', 'min9', 'mMaj7'] },
    { label: '屬和弦系列',    desc: '七和弦以上直接接數字',    types: ['7', '9', '11'] },
    { label: '特殊性質和弦',  desc: '減 / 增 / 半減七',        types: ['dim', 'dim7', 'm7b5', 'aug'] },
    { label: '掛留和弦 Sus', desc: '3 音被 2 或 4 音取代',    types: ['sus2', 'sus4'] },
  ];

  const state = { root: 0, type: 'maj7', bassPc: null };
  const staff = new StaffNotation('knowledgeStaffDisplay');

  function init() {
    buildGroups();

    els.rootSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.key-btn');
      if (!btn) return;
      state.root = parseInt(btn.dataset.key, 10);
      els.rootSelector.querySelectorAll('.key-btn').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });

    els.bassSelect.addEventListener('change', () => {
      state.bassPc = els.bassSelect.value === '' ? null : parseInt(els.bassSelect.value, 10);
      render();
    });

    render();
  }

  function buildGroups() {
    els.groups.innerHTML = '';
    SYMBOL_GROUPS.forEach(group => {
      const section = document.createElement('div');
      section.className = 'knowledge-group';

      const header = document.createElement('div');
      header.className = 'knowledge-group-header';
      header.innerHTML = `
        <span class="knowledge-group-label">${group.label}</span>
        <span class="knowledge-group-desc">${group.desc}</span>
      `;
      section.appendChild(header);

      const list = document.createElement('div');
      list.className = 'knowledge-list';

      group.types.forEach(type => {
        const info = CHORD_TYPES[type];
        if (!info) return;
        const row = document.createElement('button');
        row.className = 'knowledge-item';
        row.dataset.type = type;
        row.innerHTML = `
          <span class="knowledge-item-symbol">${getChordSymbol(0, type)}</span>
          <span class="knowledge-item-name">${info.name}</span>
        `;
        row.addEventListener('click', () => {
          state.type = type;
          render();
        });
        list.appendChild(row);
      });

      section.appendChild(list);
      els.groups.appendChild(section);
    });
  }

  function render() {
    const typeInfo = CHORD_TYPES[state.type] || CHORD_TYPES.maj;
    const notes = typeInfo.intervals.map(i => (state.root + i) % 12);
    const chord = { root: state.root, type: state.type, notes, name: getChordSymbol(state.root, state.type) };

    const bassPc = state.bassPc;
    const symbolText = (bassPc != null && bassPc !== state.root)
      ? `${chord.name}/${NOTE_NAMES[bassPc]}`
      : chord.name;

    els.symbol.textContent  = symbolText;
    els.name.textContent    = typeInfo.name;
    els.formula.textContent = `音程公式：${getIntervalFormula(state.type)}`;
    els.desc.textContent    = CHORD_HINTS[state.type] || '';

    // 同步分類清單裡的高亮狀態
    els.groups.querySelectorAll('.knowledge-item').forEach(el => {
      el.classList.toggle('active', el.dataset.type === state.type);
    });

    staff.renderReference(chord, { bassPc });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
