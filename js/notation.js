// notation.js - 簡譜模式模組（鋼琴鍵盤 + 根音選擇列）

class NotationMode {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.currentKey = options.currentKey || 0;
    this.selectedNotes = new Set(); // 所有已選音符（含根音）
    this.rootNote = null;           // 單獨追蹤的根音
    this.onNoteClick = options.onNoteClick || null;
    this.audio = options.audio || null;
    this.render();
  }

  // 依鋼琴物理順序定義 12 音
  static KEY_LAYOUT = [
    { semitone: 0,  type: 'white', label: '1',  sub: 'Do'  },
    { semitone: 1,  type: 'black', label: '#1', sub: ''    },
    { semitone: 2,  type: 'white', label: '2',  sub: 'Re'  },
    { semitone: 3,  type: 'black', label: '#2', sub: ''    },
    { semitone: 4,  type: 'white', label: '3',  sub: 'Mi'  },
    { semitone: 5,  type: 'white', label: '4',  sub: 'Fa'  },
    { semitone: 6,  type: 'black', label: '#4', sub: ''    },
    { semitone: 7,  type: 'white', label: '5',  sub: 'Sol' },
    { semitone: 8,  type: 'black', label: '#5', sub: ''    },
    { semitone: 9,  type: 'white', label: '6',  sub: 'La'  },
    { semitone: 10, type: 'black', label: '#6', sub: ''    },
    { semitone: 11, type: 'white', label: '7',  sub: 'Si'  },
  ];

  setKey(keyIndex) {
    this.currentKey = keyIndex;
  }

  render() {
    this.container.innerHTML = '';
    this.container.classList.add('notation-mode');

    // ── 上方：鋼琴鍵盤（選擇和弦音） ──────────────────────
    const pianoSection = document.createElement('div');
    pianoSection.className = 'nk-piano-section';

    const keysRow = document.createElement('div');
    keysRow.className = 'nk-keys';

    NotationMode.KEY_LAYOUT.forEach(keyDef => {
      const noteIndex = (this.currentKey + keyDef.semitone) % 12;
      const key = document.createElement('div');
      key.className = `nk-key ${keyDef.type === 'white' ? 'nk-white' : 'nk-black'}`;
      key.dataset.semitone  = keyDef.semitone;
      key.dataset.noteIndex = noteIndex;

      const label = document.createElement('div');
      label.className = 'nk-label';
      label.textContent = keyDef.label;
      key.appendChild(label);

      if (keyDef.type === 'white' && keyDef.sub) {
        const sub = document.createElement('div');
        sub.className = 'nk-sub';
        sub.textContent = keyDef.sub;
        key.appendChild(sub);
      }

      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._handlePianoClick(noteIndex);
      });

      keysRow.appendChild(key);
    });

    pianoSection.appendChild(keysRow);

    // ── 下方：根音選擇列（兩排：升號在上、自然音在下） ────────
    const rootSection = document.createElement('div');
    rootSection.className = 'nk-root-section';

    const rootLabel = document.createElement('div');
    rootLabel.className = 'nk-root-label';
    rootLabel.textContent = '根音';
    rootSection.appendChild(rootLabel);

    // 分離自然音與升號音
    const sharpKeys   = NotationMode.KEY_LAYOUT.filter(k => k.type === 'black');
    const naturalKeys = NotationMode.KEY_LAYOUT.filter(k => k.type === 'white');

    const makeRootBtn = (keyDef) => {
      const noteIndex = (this.currentKey + keyDef.semitone) % 12;
      const btn = document.createElement('button');
      btn.className = 'nk-root-btn' + (keyDef.type === 'black' ? ' nk-root-sharp' : '');
      btn.dataset.noteIndex = noteIndex;
      btn.textContent = keyDef.label;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._handleRootClick(noteIndex);
      });
      return btn;
    };

    // 第一排：升號（#1 #2 #4 #5 #6）
    const sharpRow = document.createElement('div');
    sharpRow.className = 'nk-root-row nk-root-row--sharp';
    sharpKeys.forEach(k => sharpRow.appendChild(makeRootBtn(k)));

    // 第二排：自然音（1 2 3 4 5 6 7）
    const naturalRow = document.createElement('div');
    naturalRow.className = 'nk-root-row nk-root-row--natural';
    naturalKeys.forEach(k => naturalRow.appendChild(makeRootBtn(k)));

    rootSection.appendChild(sharpRow);
    rootSection.appendChild(naturalRow);

    this.container.appendChild(pianoSection);
    this.container.appendChild(rootSection);

    this._updateStates();
  }

  // ── 事件處理 ──────────────────────────────────────────────

  _handlePianoClick(noteIndex) {
    const octave = noteIndex < this.currentKey ? 5 : 4;
    if (this.audio) this.audio.playNote(noteIndex, octave, 0.8);

    if (this.selectedNotes.has(noteIndex)) {
      this.selectedNotes.delete(noteIndex);
      if (this.rootNote === noteIndex) this.rootNote = null; // 取消根音
    } else {
      this.selectedNotes.add(noteIndex);
    }
    this._updateStates();
    if (this.onNoteClick) this.onNoteClick(noteIndex, [...this.selectedNotes]);
  }

  _handleRootClick(noteIndex) {
    const octave = noteIndex < this.currentKey ? 4 : 3;
    if (this.audio) this.audio.playNote(noteIndex, octave, 0.8); // 低一個八度

    if (this.rootNote === noteIndex) {
      // 再點一次根音 → 取消根音並從選取中移除
      this.rootNote = null;
      this.selectedNotes.delete(noteIndex);
    } else {
      this.rootNote = noteIndex;
      this.selectedNotes.add(noteIndex);
    }
    this._updateStates();
    if (this.onNoteClick) this.onNoteClick(noteIndex, [...this.selectedNotes]);
  }

  // ── 狀態更新 ──────────────────────────────────────────────

  _updateStates() {
    // 鋼琴鍵
    this.container.querySelectorAll('.nk-key').forEach(key => {
      const n = parseInt(key.dataset.noteIndex);
      key.classList.remove('selected', 'root-note');
      if (n === this.rootNote) {
        key.classList.add('root-note');
      } else if (this.selectedNotes.has(n)) {
        key.classList.add('selected');
      }
    });

    // 根音按鈕
    this.container.querySelectorAll('.nk-root-btn').forEach(btn => {
      const n = parseInt(btn.dataset.noteIndex);
      btn.classList.toggle('active', n === this.rootNote);
    });
  }

  _updateKeyStates() { this._updateStates(); }

  // ── 對外 API ──────────────────────────────────────────────

  getSelectedNotes() {
    return [...this.selectedNotes];
  }

  clearSelection() {
    this.selectedNotes.clear();
    this.rootNote = null;
    this._updateStates();
  }

  showCorrectAnswer(notes) {
    this.container.querySelectorAll('.nk-key').forEach(key => {
      if (notes.includes(parseInt(key.dataset.noteIndex))) {
        key.classList.add('correct-highlight');
      }
    });
  }

  showWrongNotes(selectedNotes, correctNotes) {
    const correctSet = new Set(correctNotes);
    this.container.querySelectorAll('.nk-key').forEach(key => {
      const n = parseInt(key.dataset.noteIndex);
      if (this.selectedNotes.has(n) && !correctSet.has(n)) {
        key.classList.add('wrong-highlight');
      }
      if (correctSet.has(n) && !this.selectedNotes.has(n)) {
        key.classList.add('correct-highlight');
      }
    });
  }

  clearHighlights() {
    this.container.querySelectorAll('.nk-key, .nk-root-btn').forEach(el => {
      el.classList.remove('correct-highlight', 'wrong-highlight');
    });
  }
}

window.NotationMode = NotationMode;
