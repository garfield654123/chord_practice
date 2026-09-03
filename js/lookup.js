// lookup.js - 和弦查詢頁：88 鍵鋼琴 + 即時五線譜 + 和弦辨識
// 頁籤切換邏輯在 js/tabs.js（練習/查詢/知識共用）

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // ========== 和弦查詢頁邏輯 ==========
  const els = {
    keyGroup:      $('#lookupKeyGroup'),
    keySelector:   $('#lookupKeySelector'),
    keySummary:    $('#lookupKeySummaryValue'),
    chordName:     $('#lookupChordName'),
    notesText:     $('#lookupNotesText'),
    clearBtn:      $('#lookupClearBtn'),
    centerBtn:     $('#lookupCenterBtn'),
    quickChords:   $('#lookupQuickChords'),
    secDomToggle:  $('#secondaryDominantToggle'),
    secDomDisplay: $('#lookupSecondaryDominant'),
  };

  if (!els.keySelector) return; // 頁面元素不存在就不初始化（防呆）

  // 大調順階三和弦的級數標示（對應 chord.js 的 MAJOR_SCALE_TRIADS：maj/min/min/maj/maj/min/dim）
  const ROMAN_TRIADS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

  const state = { keyIndex: 0, hasCentered: false, showSecondaryDominant: false };
  const audio = new PianoAudio();
  const staff = new StaffNotation('lookupStaffDisplay');
  let piano = null;
  let quickChordDefs = []; // [{ btn, pcs: Set }]，用來比對目前琴鍵組成音、決定哪個快速查詢按鈕要反白

  function init() {
    document.addEventListener('pointerdown', () => audio.init(), { once: true });

    piano = new PianoWide('pianoWideContainer', {
      audio, onChange: renderResult,
    });

    els.keySelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.key-btn');
      if (!btn) return;
      state.keyIndex = parseInt(btn.dataset.key, 10);
      els.keySelector.querySelectorAll('.key-btn').forEach(b => b.classList.toggle('active', b === btn));
      els.keySummary.textContent = NOTE_NAMES[state.keyIndex];
      if (els.keyGroup) els.keyGroup.open = false; // 選完自動收合
      buildQuickChords();
      renderResult(piano.getHeldNotes());
    });

    els.clearBtn.addEventListener('click', () => piano.clear());
    els.centerBtn.addEventListener('click', () => piano.scrollToMiddleC());

    if (els.secDomToggle) {
      els.secDomToggle.addEventListener('change', () => {
        state.showSecondaryDominant = els.secDomToggle.checked;
        renderResult(piano.getHeldNotes());
      });
    }

    buildQuickChords();

    if (window.AppTabs) window.AppTabs.onShown('lookup', onLookupShown);
    // 查詢頁現在是預設頁面，一開始就是顯示狀態的話不會觸發上面的 onShown
    // （那只在「切換」頁面時才會跑），所以載入當下就先檢查一次
    const viewEl = document.getElementById('lookupView');
    if (viewEl && !viewEl.classList.contains('hidden')) onLookupShown();

    renderResult([]);
  }

  // 第一次顯示查詢頁時（無論是預設就顯示，還是之後切過來），捲到中央 C4 方便操作
  function onLookupShown() {
    if (state.hasCentered) return;
    state.hasCentered = true;
    requestAnimationFrame(() => piano.scrollToMiddleC());
  }

  // ========== 快速查詢列：目前調性的順階三和弦 ==========

  // 建立快速查詢按鈕（I ~ vii°），按了直接在鋼琴上點亮該和弦的組成音
  function buildQuickChords() {
    if (!els.quickChords) return;
    els.quickChords.innerHTML = '';
    quickChordDefs = [];

    MAJOR_SCALE_TRIADS.forEach((type, degree) => {
      const root = (state.keyIndex + MAJOR_SCALE_INTERVALS[degree]) % 12;
      const pcs  = CHORD_TYPES[type].intervals.map(i => (root + i) % 12);

      const btn = document.createElement('button');
      btn.className = 'quick-chord-btn';
      btn.innerHTML = `
        <span class="quick-chord-symbol">${getChordSymbol(root, type)}</span>
        <span class="quick-chord-degree">${ROMAN_TRIADS[degree]}</span>
      `;
      btn.addEventListener('click', () => {
        audio.init();
        piano.selectHeld(resolveChordOctaves(pcs, root), { play: true });
      });
      els.quickChords.appendChild(btn);
      quickChordDefs.push({ btn, pcs: new Set(pcs) });
    });
  }

  // 反白目前跟琴鍵組成音完全相符的快速查詢按鈕（不管是按快速鈕選的、還是手動按鍵盤湊出來的都算）；
  // 直接比對「目前實際組成音」而不是記「上次按了哪個」，手動改琴鍵時反白會自動跟著消失，不會殘留
  function updateQuickChordSelection(pcs) {
    const set = new Set(pcs);
    quickChordDefs.forEach(({ btn, pcs: defPcs }) => {
      const matched = set.size > 0 && set.size === defPcs.size && [...set].every(pc => defPcs.has(pc));
      btn.classList.toggle('selected', matched);
    });
  }

  // 把一組 pitch class 排成以根音為準、嚴格上行的實際音高（八度），
  // 邏輯跟 app.js 的 resolveChordOctaves 相同，只是欄位改成 PianoWide 查詢模式吃的 {pc, octave}
  function resolveChordOctaves(pcs, root, baseOctave = 4) {
    let prevMidi = -1;
    return pcs.map(pc => {
      let octave = pc < root ? baseOctave + 1 : baseOctave;
      let midi   = pc + (octave + 1) * 12;
      while (midi <= prevMidi) { octave++; midi = pc + (octave + 1) * 12; }
      prevMidi = midi;
      return { pc, octave };
    });
  }

  // 副屬和弦（V7/x）：目標和弦根音往上一個純五度、蓋一個屬七和弦；
  // 開關開著且有辨識出和弦時才回傳 { root, label }，否則回傳 null
  // （文字說明列、五線譜要顯示的內容共用同一份計算結果，兩邊才不會兜不起來）
  function getSecondaryDominant(root) {
    if (root == null || !state.showSecondaryDominant) return null;
    const secRoot = (root + 7) % 12;
    return { root: secRoot, label: getChordSymbol(secRoot, '7') };
  }

  function updateSecondaryDominantText(secDom) {
    if (!els.secDomDisplay) return;
    if (!secDom) {
      els.secDomDisplay.classList.add('hidden');
      return;
    }
    els.secDomDisplay.textContent = `副屬和弦：${secDom.label}`;
    els.secDomDisplay.classList.remove('hidden');
  }

  function renderResult(heldNotes) {
    if (!heldNotes || heldNotes.length === 0) {
      els.chordName.textContent = '--';
      els.notesText.textContent = '尚未按任何琴鍵';
      // 顯示空白五線譜（而非整塊隱藏），維持版面穩定、也讓查詢頁隨時都看得到五線譜
      staff.renderEmpty(state.keyIndex);
      updateSecondaryDominantText(null);
      updateQuickChordSelection([]);
      return;
    }

    const sorted = [...heldNotes].sort((a, b) => (a.octave * 12 + a.pc) - (b.octave * 12 + b.pc));
    const bass   = sorted[0];
    const pcs    = [...new Set(heldNotes.map(n => n.pc))];
    const noteNames = sorted.map(n => `${NOTE_NAMES[n.pc]}${n.octave}`);
    els.notesText.textContent = noteNames.join(', ');

    let label = null;
    let spellMap = null;
    let matchedRoot = null;

    if (heldNotes.length >= 2) {
      const match = identifyChord(pcs, bass.pc);
      if (match) {
        const symbol = getChordSymbol(match.root, match.type);
        label = match.root === bass.pc ? symbol : `${symbol}/${NOTE_NAMES[bass.pc]}`;
        spellMap = new Map(
          window.MusicTheory.spellChordTones({ root: match.root, type: match.type }, state.keyIndex)
            .map(s => [s.pc, s])
        );
        matchedRoot = match.root;
      } else {
        label = '無法辨識';
      }
    }

    els.chordName.textContent = label || noteNames[0];
    const secDom = getSecondaryDominant(matchedRoot);
    staff.renderPitches(heldNotes, state.keyIndex, {
      label: heldNotes.length >= 2 ? label : null,
      spellMap,
      secondaryDominant: secDom,
    });
    updateSecondaryDominantText(secDom);
    updateQuickChordSelection(pcs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
