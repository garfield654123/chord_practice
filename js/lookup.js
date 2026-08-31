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
      els.keySummary.textContent = NOTE_NAMES[state.keyIndex];
      if (els.keyGroup) els.keyGroup.open = false; // 選完自動收合
      renderResult(piano.getHeldNotes());
    });

    els.clearBtn.addEventListener('click', () => piano.clear());
    els.centerBtn.addEventListener('click', () => piano.scrollToMiddleC());

    if (window.AppTabs) window.AppTabs.onShown('lookup', onLookupShown);

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
