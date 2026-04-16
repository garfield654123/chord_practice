// piano.js - 鋼琴鍵盤 UI 模組（上下兩排：高音在上、低音在下）

class PianoKeyboard {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.startOctave = options.startOctave || 3;
    this.octaves = options.octaves || 2;
    this.selectedNotes = new Set();
    this.onNoteClick = options.onNoteClick || null;
    this.audio = options.audio || null;
    this.showLabels = options.showLabels !== false;
    this.rootNote = null;
    this.render();
  }

  static KEY_LAYOUT = [
    { note: 0,  type: 'white', label: 'C'  },
    { note: 1,  type: 'black', label: 'C#' },
    { note: 2,  type: 'white', label: 'D'  },
    { note: 3,  type: 'black', label: 'D#' },
    { note: 4,  type: 'white', label: 'E'  },
    { note: 5,  type: 'white', label: 'F'  },
    { note: 6,  type: 'black', label: 'F#' },
    { note: 7,  type: 'white', label: 'G'  },
    { note: 8,  type: 'black', label: 'G#' },
    { note: 9,  type: 'white', label: 'A'  },
    { note: 10, type: 'black', label: 'A#' },
    { note: 11, type: 'white', label: 'B'  },
  ];

  render() {
    this.container.innerHTML = '';
    this.container.classList.add('piano-keyboard');

    // 從高到低排列：最高八度在最上方
    for (let oct = this.startOctave + this.octaves - 1; oct >= this.startOctave; oct--) {
      const row = document.createElement('div');
      row.className = 'piano-row';

      // 左側八度標籤
      const rowLabel = document.createElement('div');
      rowLabel.className = 'piano-row-label';
      rowLabel.textContent = `C${oct}`;
      row.appendChild(rowLabel);

      // 鍵盤本體
      const octaveDiv = document.createElement('div');
      octaveDiv.className = 'piano-octave';

      PianoKeyboard.KEY_LAYOUT.forEach(keyDef => {
        const key = document.createElement('div');
        key.className = `piano-key ${keyDef.type}-key`;
        key.dataset.note   = keyDef.note;
        key.dataset.octave = oct;

        if (this.rootNote === keyDef.note && oct === this.startOctave) {
          key.classList.add('root-note');
        }
        if (this.selectedNotes.has(keyDef.note)) {
          key.classList.add('selected');
        }

        if (this.showLabels) {
          const label = document.createElement('span');
          label.className = 'key-label';
          label.textContent = keyDef.label;
          key.appendChild(label);
        }

        key.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this._handleKeyPress(keyDef.note, oct);
        });

        octaveDiv.appendChild(key);
      });

      row.appendChild(octaveDiv);
      this.container.appendChild(row);
    }
  }

  _handleKeyPress(noteIndex, octave) {
    if (this.audio) {
      this.audio.playNote(noteIndex, octave, 0.8);
    }
    if (this.selectedNotes.has(noteIndex)) {
      this.selectedNotes.delete(noteIndex);
    } else {
      this.selectedNotes.add(noteIndex);
    }
    this._updateKeyStates();
    if (this.onNoteClick) {
      this.onNoteClick(noteIndex, octave, [...this.selectedNotes]);
    }
  }

  _updateKeyStates() {
    this.container.querySelectorAll('.piano-key').forEach(key => {
      const note   = parseInt(key.dataset.note);
      const octave = parseInt(key.dataset.octave);
      key.classList.toggle('root-note', note === this.rootNote && octave === this.startOctave);
      key.classList.toggle('selected', this.selectedNotes.has(note));
    });
  }

  setRootNote(note) {
    this.rootNote = note;
    this._updateKeyStates();
  }

  getSelectedNotes() {
    return [...this.selectedNotes];
  }

  clearSelection() {
    this.selectedNotes.clear();
    this._updateKeyStates();
  }

  showCorrectAnswer(notes) {
    this.container.querySelectorAll('.piano-key').forEach(key => {
      if (notes.includes(parseInt(key.dataset.note))) {
        key.classList.add('correct-highlight');
      }
    });
  }

  clearHighlights() {
    this.container.querySelectorAll('.piano-key').forEach(key => {
      key.classList.remove('correct-highlight', 'wrong-highlight');
    });
  }

  showWrongNotes(selectedNotes, correctNotes) {
    const correctSet = new Set(correctNotes);
    this.container.querySelectorAll('.piano-key').forEach(key => {
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
