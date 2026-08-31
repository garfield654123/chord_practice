// lookup.js - 和弦查詢頁籤：頁籤切換 + 88 鍵鋼琴 + 即時五線譜 + 和弦辨識

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // ========== 頁籤切換 ==========
  const tabs = document.querySelectorAll('.view-tab');
  const views = {
    practice: $('#practiceView'),
    lookup:   $('#lookupView'),
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.view;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      Object.entries(views).forEach(([name, el]) => {
        if (el) el.classList.toggle('hidden', name !== target);
      });
      if (target === 'lookup') onLookupShown();
    });
  });

  // ========== 和弦查詢頁邏輯 ==========
  const els = {
    keySelector: $('#lookupKeySelector'),
    chordName:   $('#lookupChordName'),
    notesText:   $('#lookupNotesText'),
    clearBtn:    $('#lookupClearBtn'),
    centerBtn:   $('#lookupCenterBtn'),
  };

  if (!els.keySelector) return; // 頁面元素不存在就不初始化（防呆）

  const state = { keyIndex: 0, hasCentered: false };
  const audio = new PianoAudio();
  const staff = new StaffNotation('lookupStaffDisplay');
  let piano = null;

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
      renderResult(piano.getHeldNotes());
    });

    els.clearBtn.addEventListener('click', () => piano.clear());
    els.centerBtn.addEventListener('click', () => piano.scrollToMiddleC());

    renderResult([]);
  }

  // 第一次切到查詢頁時，捲到中央 C4 方便操作
  function onLookupShown() {
    if (state.hasCentered) return;
    state.hasCentered = true;
    requestAnimationFrame(() => piano.scrollToMiddleC());
  }

  function renderResult(heldNotes) {
    if (!heldNotes || heldNotes.length === 0) {
      els.chordName.textContent = '--';
      els.notesText.textContent = '尚未按任何琴鍵';
      staff.clear();
      return;
    }

    const sorted = [...heldNotes].sort((a, b) => (a.octave * 12 + a.pc) - (b.octave * 12 + b.pc));
    const bass   = sorted[0];
    const pcs    = [...new Set(heldNotes.map(n => n.pc))];
    const noteNames = sorted.map(n => `${NOTE_NAMES[n.pc]}${n.octave}`);
    els.notesText.textContent = noteNames.join(', ');

    let label = null;
    let spellMap = null;

    if (heldNotes.length >= 2) {
      const match = identifyChord(pcs, bass.pc);
      if (match) {
        const symbol = getChordSymbol(match.root, match.type);
        label = match.root === bass.pc ? symbol : `${symbol}/${NOTE_NAMES[bass.pc]}`;
        spellMap = new Map(
          window.MusicTheory.spellChordTones({ root: match.root, type: match.type }, state.keyIndex)
            .map(s => [s.pc, s])
        );
      } else {
        label = '無法辨識的和弦組合';
      }
    }

    els.chordName.textContent = label || noteNames[0];
    staff.renderPitches(heldNotes, state.keyIndex, {
      label: heldNotes.length >= 2 ? label : null,
      spellMap,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
