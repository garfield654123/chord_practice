// piano.js - 鋼琴鍵盤 UI 模組

class PianoKeyboard {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.startOctave = options.startOctave || 3;
    this.octaves = options.octaves || 2;
    this.selectedNotes = new Set(); // 儲存被選取的音符 (0-11)
    this.onNoteClick = options.onNoteClick || null;
    this.audio = options.audio || null;
    this.showLabels = options.showLabels !== false;
    this.render();
  }

  // 白鍵與黑鍵的佈局
  static KEY_LAYOUT = [
    { note: 0, type: 'white', label: 'C' },
    { note: 1, type: 'black', label: 'C#' },
    { note: 2, type: 'white', label: 'D' },
    { note: 3, type: 'black', label: 'D#' },
    { note: 4, type: 'white', label: 'E' },
    { note: 5, type: 'white', label: 'F' },
    { note: 6, type: 'black', label: 'F#' },
    { note: 7, type: 'white', label: 'G' },
    { note: 8, type: 'black', label: 'G#' },
    { note: 9, type: 'white', label: 'A' },
    { note: 10, type: 'black', label: 'A#' },
    { note: 11, type: 'white', label: 'B' },
  ];

  render() {
    this.container.innerHTML = '';
    this.container.classList.add('piano-keyboard');

    const keyboard = document.createElement('div');
    keyboard.className = 'piano-keys';

    for (let oct = this.startOctave; oct < this.startOctave + this.octaves; oct++) {
      const octaveDiv = document.createElement('div');
      octaveDiv.className = 'piano-octave';

      PianoKeyboard.KEY_LAYOUT.forEach(keyDef => {
        const key = document.createElement('div');
        key.className = `piano-key ${keyDef.type}-key`;
        key.dataset.note = keyDef.note;
        key.dataset.octave = oct;

        if (this.selectedNotes.has(keyDef.note)) {
          key.classList.add('selected');
        }

        if (this.showLabels) {
          const label = document.createElement('span');
          label.className = 'key-label';
          label.textContent = keyDef.label;
          key.appendChild(label);
        }

        // touch 和 click 事件
        key.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this._handleKeyPress(keyDef.note, oct);
        });

        if (keyDef.type === 'white') {
          octaveDiv.appendChild(key);
        } else {
          key.classList.add('black-key-overlay');
          octaveDiv.appendChild(key);
        }
      });

      keyboard.appendChild(octaveDiv);
    }

    this.container.appendChild(keyboard);
  }

  _handleKeyPress(noteIndex, octave) {
    // 播放音效
    if (this.audio) {
      this.audio.playNote(noteIndex, octave, 0.8);
    }

    // 切換選取狀態
    if (this.selectedNotes.has(noteIndex)) {
      this.selectedNotes.delete(noteIndex);
    } else {
      this.selectedNotes.add(noteIndex);
    }

    // 更新 UI
    this._updateKeyStates();

    // 回呼
    if (this.onNoteClick) {
      this.onNoteClick(noteIndex, octave, [...this.selectedNotes]);
    }
  }

  _updateKeyStates() {
    const keys = this.container.querySelectorAll('.piano-key');
    keys.forEach(key => {
      const note = parseInt(key.dataset.note);
      if (this.selectedNotes.has(note)) {
        key.classList.add('selected');
      } else {
        key.classList.remove('selected');
      }
    });
  }

  getSelectedNotes() {
    return [...this.selectedNotes];
  }

  clearSelection() {
    this.selectedNotes.clear();
    this._updateKeyStates();
  }

  // 高亮正確答案
  showCorrectAnswer(notes) {
    const keys = this.container.querySelectorAll('.piano-key');
    keys.forEach(key => {
      const note = parseInt(key.dataset.note);
      if (notes.includes(note)) {
        key.classList.add('correct-highlight');
      }
    });
  }

  clearHighlights() {
    const keys = this.container.querySelectorAll('.piano-key');
    keys.forEach(key => {
      key.classList.remove('correct-highlight');
      key.classList.remove('wrong-highlight');
    });
  }

  // 顯示錯誤標記
  showWrongNotes(selectedNotes, correctNotes) {
    const correctSet = new Set(correctNotes);
    const keys = this.container.querySelectorAll('.piano-key');
    keys.forEach(key => {
      const note = parseInt(key.dataset.note);
      if (this.selectedNotes.has(note) && !correctSet.has(note)) {
        key.classList.add('wrong-highlight');
      }
      if (correctSet.has(note) && !this.selectedNotes.has(note)) {
        key.classList.add('correct-highlight');
      }
    });
  }
}

window.PianoKeyboard = PianoKeyboard;
