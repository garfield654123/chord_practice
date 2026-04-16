// app.js - 主應用程式邏輯

// ── 進度資料結構 ─────────────────────────────────────
const DEFAULT_PROGRESS = {
  triad:     { attempts: 0, correct: 0 },
  seventh:   { attempts: 0, correct: 0 },
  extended:  { attempts: 0, correct: 0 },
  inversion: { attempts: 0, correct: 0 },
  borrowed:  { attempts: 0, correct: 0 },
};

function loadProgress() {
  try {
    const s = localStorage.getItem('chord-progress-v1');
    const p = s ? JSON.parse(s) : null;
    if (!p) return JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
    // 確保所有分類都存在（向前相容）
    Object.keys(DEFAULT_PROGRESS).forEach(k => {
      if (!p[k]) p[k] = { attempts: 0, correct: 0 };
    });
    return p;
  } catch { return JSON.parse(JSON.stringify(DEFAULT_PROGRESS)); }
}

function saveProgress(prog) {
  localStorage.setItem('chord-progress-v1', JSON.stringify(prog));
}

function loadSettings() {
  try {
    const s = localStorage.getItem('chord-settings-v1');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveSettings(settings) {
  localStorage.setItem('chord-settings-v1', JSON.stringify(settings));
}

// ── 主應用邏輯 ────────────────────────────────────────
(function () {
  'use strict';

  // 狀態
  const state = {
    currentChord: null,
    inputMode:    'piano',       // 'piano' | 'notation'
    correct:      0,
    wrong:        0,
    streak:       0,
    answered:     false,
    enabledCategories: ['triad'],
    enabledKeys:  [0],           // 可多選調性（pitch class 0-11）
    listenMode:   'arpeggio',    // 'chord' | 'arpeggio'
    currentHint:  '',
    progress:     loadProgress(),
  };

  // 模組實例
  const audio    = new PianoAudio();
  const chordGen = new ChordGenerator();
  let piano    = null;
  let notation = null;

  const $ = (sel) => document.querySelector(sel);
  const els = {
    settingsBtn:      $('#settingsBtn'),
    settingsPanel:    $('#settingsPanel'),
    closeSettingsBtn: $('#closeSettingsBtn'),
    resetStatsBtn:    $('#resetStatsBtn'),
    keySelector:      $('#keySelector'),
    diatonicBtn:      $('#diatonicBtn'),
    allChordsBtn:     $('#allChordsBtn'),
    pianoModeBtn:     $('#pianoModeBtn'),
    notationModeBtn:  $('#notationModeBtn'),
    chordNameDisplay:  $('#chordNameDisplay'),
    chordTypeDisplay:  $('#chordTypeDisplay'),
    chordExtraDisplay: $('#chordExtraDisplay'),
    chordJianpuDisplay:$('#chordJianpuDisplay'),
    hintToggleBtn:     $('#hintToggleBtn'),
    hintModal:         $('#hintModal'),
    hintModalContent:  $('#hintModalContent'),
    hintModalClose:    $('#hintModalClose'),
    currentKeyDisplay: $('#currentKeyDisplay'),
    categoryBadge:     $('#categoryBadge'),
    feedback:         $('#feedback'),
    feedbackIcon:     $('#feedbackIcon'),
    feedbackText:     $('#feedbackText'),
    feedbackDetail:   $('#feedbackDetail'),
    correctCount:     $('#correctCount'),
    wrongCount:       $('#wrongCount'),
    streakCount:      $('#streakCount'),
    selectedNotesText:$('#selectedNotesText'),
    pianoContainer:   $('#pianoContainer'),
    notationContainer:$('#notationContainer'),
    clearBtn:         $('#clearBtn'),
    playSelectedBtn:  $('#playSelectedBtn'),
    listenBtn:        $('#listenBtn'),
    submitBtn:        $('#submitBtn'),
    nextBtn:          $('#nextBtn'),
    refreshBtn:       $('#refreshBtn'),
    chordPlayBtn:     $('#chordPlayBtn'),
    arpPlayBtn:       $('#arpPlayBtn'),
  };

  // ========== 初始化 ==========

  function init() {
    document.addEventListener('pointerdown', () => audio.init(), { once: true });

    // 還原上次設定
    const saved = loadSettings();
    if (saved) {
      if (saved.enabledCategories) state.enabledCategories = saved.enabledCategories;
      if (saved.inputMode)  state.inputMode  = saved.inputMode;
      if (saved.listenMode) state.listenMode  = saved.listenMode;
      // 多選調性（向下相容舊版單選 key）
      if (saved.enabledKeys)      state.enabledKeys = saved.enabledKeys;
      else if (saved.key != null) state.enabledKeys = [saved.key];
      if (saved.diatonic != null) chordGen.setDiatonicOnly(saved.diatonic);
    }

    chordGen.setEnabledCategories(state.enabledCategories);

    // 建立鋼琴鍵盤
    piano = new PianoKeyboard('pianoContainer', {
      startOctave: 4, octaves: 2,
      audio, onNoteClick: onNoteSelected,
    });

    // 建立簡譜面板
    notation = new NotationMode('notationContainer', {
      currentKey: chordGen.currentKey,
      audio, onNoteClick: onNoteSelected,
    });

    // 同步 UI 到設定
    syncSettingsUI(saved);

    // 建立分類列表
    buildCategoryList();
    updateAllAccuracy();

    bindEvents();
    generateNewChord();

    // 背景預載音效
    audio.prefetchSamples();

    registerServiceWorker();
  }

  function syncSettingsUI(saved) {
    if (!saved) return;
    // 輸入模式
    if (saved.inputMode === 'notation') {
      els.notationModeBtn.classList.add('active');
      els.pianoModeBtn.classList.remove('active');
      els.notationContainer.classList.remove('hidden');
      els.pianoContainer.classList.add('hidden');
    }
    // 聽和弦方式
    if (saved.listenMode === 'chord') {
      els.chordPlayBtn.classList.add('active');
      els.arpPlayBtn.classList.remove('active');
    }
    // 調內/所有
    if (saved.diatonic === false) {
      els.allChordsBtn.classList.add('active');
      els.diatonicBtn.classList.remove('active');
    }
    // 調性（多選）
    els.keySelector.querySelectorAll('.key-btn').forEach(b => {
      b.classList.toggle('active', state.enabledKeys.includes(parseInt(b.dataset.key)));
    });
  }

  function buildCategoryList() {
    const container = $('#categoryList');
    if (!container) return;
    container.innerHTML = '';

    Object.entries(CHORD_CATEGORIES).forEach(([cat, info]) => {
      const isEnabled = state.enabledCategories.includes(cat);
      const row = document.createElement('div');
      row.className = `category-row${isEnabled ? ' cat-on' : ' cat-off'}`;
      row.dataset.cat = cat;

      row.innerHTML = `
        <div class="cat-left">
          <span class="cat-dot" style="background:${info.color}"></span>
          <div>
            <div class="cat-name">${info.label}</div>
            <div class="cat-subdesc">${info.desc}</div>
          </div>
        </div>
        <div class="cat-right">
          <span class="cat-acc" id="acc-${cat}">--</span>
          <span class="cat-pill${isEnabled ? ' cat-pill-on' : ''}"
                style="${isEnabled ? '--pill-color:'+info.color : ''}">
            ${isEnabled ? '開' : '關'}
          </span>
        </div>
      `;

      row.addEventListener('click', () => {
        const enabled = state.enabledCategories.includes(cat);
        if (enabled) {
          if (state.enabledCategories.length <= 1) return; // 至少一個
          state.enabledCategories = state.enabledCategories.filter(c => c !== cat);
        } else {
          state.enabledCategories.push(cat);
        }
        chordGen.setEnabledCategories(state.enabledCategories);
        persistSettings();
        generateNewChord();
        buildCategoryList();   // 重新繪製列表
        updateAllAccuracy();
      });

      container.appendChild(row);
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // ========== 事件綁定 ==========

  function bindEvents() {
    // 提示彈窗
    els.hintToggleBtn.addEventListener('click', () => {
      els.hintModalContent.textContent = state.currentHint || '（尚未有題目）';
      els.hintModal.classList.remove('hidden');
    });
    els.hintModalClose.addEventListener('click', () => {
      els.hintModal.classList.add('hidden');
    });
    els.hintModal.addEventListener('click', (e) => {
      if (e.target === els.hintModal) els.hintModal.classList.add('hidden');
    });

    // 設定面板
    els.settingsBtn.addEventListener('click', () => {
      updateAllAccuracy();
      els.settingsPanel.classList.remove('hidden');
    });
    els.closeSettingsBtn.addEventListener('click', () => {
      els.settingsPanel.classList.add('hidden');
    });
    els.settingsPanel.addEventListener('click', (e) => {
      if (e.target === els.settingsPanel) els.settingsPanel.classList.add('hidden');
    });

    // 重置統計
    els.resetStatsBtn.addEventListener('click', () => {
      if (!confirm('確定要重置所有統計資料嗎？')) return;
      state.progress = JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
      saveProgress(state.progress);
      state.correct = 0; state.wrong = 0; state.streak = 0;
      updateScore();
      updateAllAccuracy();
    });

    // 調性選擇（多選 toggle，至少保留一個）
    els.keySelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.key-btn');
      if (!btn) return;
      const key = parseInt(btn.dataset.key);

      if (state.enabledKeys.includes(key)) {
        if (state.enabledKeys.length <= 1) return; // 至少保留一個
        state.enabledKeys = state.enabledKeys.filter(k => k !== key);
        btn.classList.remove('active');
      } else {
        state.enabledKeys.push(key);
        btn.classList.add('active');
      }

      persistSettings();
      generateNewChord();
    });

    // 刷新題目
    els.refreshBtn.addEventListener('click', generateNewChord);

    // 和弦範圍
    els.diatonicBtn.addEventListener('click', () => {
      els.diatonicBtn.classList.add('active');
      els.allChordsBtn.classList.remove('active');
      chordGen.setDiatonicOnly(true);
      persistSettings();
      generateNewChord();
    });
    els.allChordsBtn.addEventListener('click', () => {
      els.allChordsBtn.classList.add('active');
      els.diatonicBtn.classList.remove('active');
      chordGen.setDiatonicOnly(false);
      persistSettings();
      generateNewChord();
    });

    // 輸入模式切換
    els.pianoModeBtn.addEventListener('click', () => {
      state.inputMode = 'piano';
      els.pianoModeBtn.classList.add('active');
      els.notationModeBtn.classList.remove('active');
      els.pianoContainer.classList.remove('hidden');
      els.notationContainer.classList.add('hidden');
      syncSelection();
      persistSettings();
    });
    els.notationModeBtn.addEventListener('click', () => {
      state.inputMode = 'notation';
      els.notationModeBtn.classList.add('active');
      els.pianoModeBtn.classList.remove('active');
      els.notationContainer.classList.remove('hidden');
      els.pianoContainer.classList.add('hidden');
      syncSelection();
      persistSettings();
    });

    // 播放方式
    els.chordPlayBtn.addEventListener('click', () => {
      state.listenMode = 'chord';
      els.chordPlayBtn.classList.add('active');
      els.arpPlayBtn.classList.remove('active');
      persistSettings();
    });
    els.arpPlayBtn.addEventListener('click', () => {
      state.listenMode = 'arpeggio';
      els.arpPlayBtn.classList.add('active');
      els.chordPlayBtn.classList.remove('active');
      persistSettings();
    });

    // 操作按鈕
    els.clearBtn.addEventListener('click', clearSelection);
    els.playSelectedBtn.addEventListener('click', playSelected);
    els.listenBtn.addEventListener('click', listenChord);
    els.submitBtn.addEventListener('click', submitAnswer);
    els.nextBtn.addEventListener('click', nextQuestion);
  }

  // ========== 設定持久化 ==========

  function persistSettings() {
    saveSettings({
      enabledCategories: state.enabledCategories,
      enabledKeys: state.enabledKeys,
      inputMode:   state.inputMode,
      listenMode:  state.listenMode,
      diatonic:    els.diatonicBtn.classList.contains('active'),
    });
  }

  // ========== 核心功能 ==========

  function generateNewChord() {
    // 從已啟用的調性中隨機選一個
    const key = state.enabledKeys[Math.floor(Math.random() * state.enabledKeys.length)];
    chordGen.setKey(key);
    notation.setKey(key);
    notation.render();
    els.currentKeyDisplay.textContent = `Key: ${NOTE_NAMES[key]}`;

    state.currentChord = chordGen.generateRandom();
    state.answered = false;

    const chord = state.currentChord;
    const cat   = CHORD_CATEGORIES[chord.category] || CHORD_CATEGORIES.triad;

    // 分類徽章
    els.categoryBadge.textContent    = cat.label;
    els.categoryBadge.style.color    = cat.color;
    els.categoryBadge.style.background = cat.color + '22';
    els.categoryBadge.style.borderColor = cat.color + '66';

    // 和弦名稱 & 類型
    els.chordNameDisplay.textContent = chord.name;
    els.chordTypeDisplay.textContent = chord.typeName;

    // 額外提示（轉位 → 顯示低音音符）
    if (chord.category === 'inversion') {
      els.chordExtraDisplay.textContent = `低音：${chord.bassNoteName}`;
      els.chordExtraDisplay.classList.remove('hidden');
    } else if (chord.category === 'borrowed') {
      const keyName = NOTE_NAMES[chordGen.currentKey];
      els.chordExtraDisplay.textContent = `借自 ${keyName} 小調`;
      els.chordExtraDisplay.classList.remove('hidden');
    } else {
      els.chordExtraDisplay.classList.add('hidden');
    }

    // 簡譜（回答後才顯示）
    const jianpu = chordGen.getJianpuForChord(chord);
    els.chordJianpuDisplay.textContent = `簡譜：${jianpu.join(' - ')}`;
    els.chordJianpuDisplay.style.display = 'none';

    // 儲存提示文字（點擊 💡 時顯示）
    state.currentHint = buildHint(chord, key);

    // 清除狀態
    clearSelection();
    hideFeedback();
    els.nextBtn.classList.add('hidden');
    els.submitBtn.classList.remove('hidden');
  }

  function onNoteSelected(noteIndex, octaveOrSelected, maybeSelected) {
    const selected = Array.isArray(maybeSelected)    ? maybeSelected :
                     Array.isArray(octaveOrSelected)  ? octaveOrSelected : [];
    updateSelectedDisplay(selected);
  }

  function updateSelectedDisplay(selectedNotes) {
    if (!selectedNotes || selectedNotes.length === 0) {
      els.selectedNotesText.textContent = '尚未選擇';
      return;
    }
    els.selectedNotesText.textContent = selectedNotes.map(n => NOTE_NAMES[n]).join(', ');
  }

  function clearSelection() {
    if (piano)    { piano.clearSelection();    piano.clearHighlights(); }
    if (notation) { notation.clearSelection(); notation.clearHighlights(); }
    updateSelectedDisplay([]);
  }

  function syncSelection() {
    const active = state.inputMode === 'piano' ? piano    : notation;
    const other  = state.inputMode === 'piano' ? notation : piano;
    if (active && other) {
      const selected = other.getSelectedNotes();
      active.clearSelection();
      selected.forEach(n => active.selectedNotes.add(n));
      active._updateKeyStates ? active._updateKeyStates() : active._updateStates();
    }
  }

  // 將和弦音符解析為正確八度，確保所有音符嚴格升序排列。
  // 規則：
  //   1. pitch class < root → 先移到上一個八度
  //   2. 若仍 <= 前一個音的 MIDI → 繼續往上移，直到嚴格大於前音
  // 這樣無論幾個音（三和弦、七和弦、延伸和弦）都能正確呈現
  function resolveChordOctaves(notes, baseOctave = 4) {
    const root = notes[0];
    let prevMidi = -1;

    return notes.map(note => {
      let octave = note < root ? baseOctave + 1 : baseOctave;
      let midi   = note + (octave + 1) * 12;

      // 若仍未超過前一個音，持續往上移一個八度
      while (midi <= prevMidi) {
        octave++;
        midi = note + (octave + 1) * 12;
      }

      prevMidi = midi;
      return { note, octave };
    });
  }

  // ── 提示文字產生 ────────────────────────────────────────
  function buildHint(chord, key) {
    const keyName  = NOTE_NAMES[key];
    const jianpu   = chordGen.getJianpuForChord(chord).join(' - ');
    const noteStr  = chord.notes.map(n => NOTE_NAMES[n]).join(' - ');

    if (chord.category === 'inversion') {
      const formula = getIntervalFormula(chord.type);
      const desc    = CHORD_HINTS[chord.type] || CHORD_TYPES[chord.type].name;
      return [
        `${chord.typeName}`,
        `原位結構：${desc}`,
        `音程公式：${formula}`,
        `低音音符：${chord.bassNoteName}（${chord.inversionName}）`,
        `${keyName}調簡譜：${jianpu}`,
        `音名：${noteStr}`,
      ].join('\n');
    }

    if (chord.category === 'borrowed') {
      const formula = getIntervalFormula(chord.type);
      const desc    = CHORD_HINTS[chord.type] || '';
      return [
        `借自 ${keyName} 平行小調（${chord.degreeLabel}）`,
        desc ? `和弦結構：${desc}` : '',
        formula ? `音程公式：${formula}` : '',
        `${keyName}調簡譜：${jianpu}`,
        `音名：${noteStr}`,
      ].filter(Boolean).join('\n');
    }

    const desc    = CHORD_HINTS[chord.type] || '';
    const formula = getIntervalFormula(chord.type);
    return [
      desc ? `和弦結構：${desc}` : '',
      formula ? `音程公式：${formula}` : '',
      `${keyName}調簡譜：${jianpu}`,
      `音名：${noteStr}`,
    ].filter(Boolean).join('\n');
  }

  function playSelected() {
    const activeInput = state.inputMode === 'piano' ? piano : notation;
    const selected = activeInput.getSelectedNotes();
    if (selected.length === 0) return;
    audio.init();
    // 同時播放所有已選音符
    selected.forEach(noteIndex => {
      audio.playNote(noteIndex, 4, 0.7);
    });
  }

  function listenChord() {
    if (!state.currentChord) return;
    audio.init();
    const pairs = resolveChordOctaves(state.currentChord.notes);
    if (state.listenMode === 'chord') {
      pairs.forEach(({ note, octave }) => audio.playNote(note, octave));
    } else {
      pairs.forEach(({ note, octave }, i) => {
        setTimeout(() => audio.playNote(note, octave), i * 160);
      });
    }
  }

  function submitAnswer() {
    if (state.answered) return;

    const activeInput = state.inputMode === 'piano' ? piano : notation;
    const selected    = activeInput.getSelectedNotes();

    if (selected.length === 0) {
      showFeedback('error', '⚠️', '請先選擇音符', '點擊鍵盤或簡譜按鈕來選擇和弦組成音');
      return;
    }

    const isCorrect = chordGen.checkAnswer(state.currentChord, selected);
    state.answered  = true;

    // 更新進度
    const cat = state.currentChord.category;
    if (!state.progress[cat]) state.progress[cat] = { attempts: 0, correct: 0 };
    state.progress[cat].attempts++;
    if (isCorrect) state.progress[cat].correct++;
    saveProgress(state.progress);

    if (isCorrect) {
      state.correct++;
      state.streak++;
      const noteNames = state.currentChord.notes.map(n => NOTE_NAMES[n]).join(', ');
      showFeedback('success', '✅', '正確！', `${state.currentChord.name} = ${noteNames}`);
      resolveChordOctaves(state.currentChord.notes).forEach(({ note, octave }) => {
        audio.playNote(note, octave, 1.2);
      });
    } else {
      state.wrong++;
      state.streak = 0;
      const correctNames  = state.currentChord.notes.map(n => NOTE_NAMES[n]).join(', ');
      const selectedNames = selected.map(n => NOTE_NAMES[n]).join(', ');
      showFeedback('error', '❌', '再試試！',
        `正確答案：${correctNames}\n你的答案：${selectedNames}`);
      activeInput.showWrongNotes(selected, state.currentChord.notes);
    }

    // 顯示簡譜
    els.chordJianpuDisplay.style.display = 'block';
    updateScore();
    els.submitBtn.classList.add('hidden');
    els.nextBtn.classList.remove('hidden');
  }

  function nextQuestion() { generateNewChord(); }

  function showFeedback(type, icon, text, detail) {
    els.feedback.className = `feedback ${type}`;
    els.feedbackIcon.textContent  = icon;
    els.feedbackText.textContent  = text;
    els.feedbackDetail.textContent = detail;
  }

  function hideFeedback() { els.feedback.classList.add('hidden'); }

  function updateScore() {
    els.correctCount.textContent = state.correct;
    els.wrongCount.textContent   = state.wrong;
    els.streakCount.textContent  = state.streak;
  }

  // ========== 正確率顯示 ==========

  function updateAllAccuracy() {
    Object.keys(CHORD_CATEGORIES).forEach(cat => {
      const el   = document.getElementById(`acc-${cat}`);
      if (!el) return;
      const stat = state.progress[cat] || { attempts: 0, correct: 0 };
      if (stat.attempts === 0) {
        el.textContent = '--';
        el.style.color = 'var(--text-secondary)';
      } else {
        const pct = Math.round(stat.correct / stat.attempts * 100);
        el.textContent = pct + '%';
        el.style.color = pct >= 80 ? '#2ecc71' : pct >= 60 ? '#f39c12' : '#e74c3c';
      }
    });
  }

  // ========== 啟動 ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
