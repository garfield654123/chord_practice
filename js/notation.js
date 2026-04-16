// notation.js - 簡譜模式模組

class NotationMode {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.currentKey = options.currentKey || 0;
    this.selectedNotes = new Set();
    this.onNoteClick = options.onNoteClick || null;
    this.audio = options.audio || null;
    this.render();
  }

  // 簡譜按鈕定義
  static NOTATION_BUTTONS = [
    { degree: '1', semitone: 0, label: '1', sublabel: 'Do' },
    { degree: '#1', semitone: 1, label: '#1', sublabel: '' },
    { degree: '2', semitone: 2, label: '2', sublabel: 'Re' },
    { degree: '#2', semitone: 3, label: '#2', sublabel: '' },
    { degree: '3', semitone: 4, label: '3', sublabel: 'Mi' },
    { degree: '4', semitone: 5, label: '4', sublabel: 'Fa' },
    { degree: '#4', semitone: 6, label: '#4', sublabel: '' },
    { degree: '5', semitone: 7, label: '5', sublabel: 'Sol' },
    { degree: '#5', semitone: 8, label: '#5', sublabel: '' },
    { degree: '6', semitone: 9, label: '6', sublabel: 'La' },
    { degree: '#6', semitone: 10, label: '#6', sublabel: '' },
    { degree: '7', semitone: 11, label: '7', sublabel: 'Si' },
  ];

  setKey(keyIndex) {
    this.currentKey = keyIndex;
  }

  render() {
    this.container.innerHTML = '';
    this.container.classList.add('notation-mode');

    const grid = document.createElement('div');
    grid.className = 'notation-grid';

    NotationMode.NOTATION_BUTTONS.forEach(btn => {
      const noteIndex = (this.currentKey + btn.semitone) % 12;
      const button = document.createElement('button');
      button.className = 'notation-btn';
      if (btn.label.includes('#')) {
        button.classList.add('sharp-btn');
      }
      button.dataset.semitone = btn.semitone;
      button.dataset.noteIndex = noteIndex;

      if (this.selectedNotes.has(noteIndex)) {
        button.classList.add('selected');
      }

      const mainLabel = document.createElement('div');
      mainLabel.className = 'notation-label';
      mainLabel.textContent = btn.label;

      const subLabel = document.createElement('div');
      subLabel.className = 'notation-sublabel';
      subLabel.textContent = btn.sublabel;

      button.appendChild(mainLabel);
      if (btn.sublabel) {
        button.appendChild(subLabel);
      }

      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._handleClick(noteIndex, btn);
      });

      grid.appendChild(button);
    });

    this.container.appendChild(grid);
  }

  _handleClick(noteIndex, btnDef) {
    // 播放音效
    if (this.audio) {
      this.audio.playNote(noteIndex, 4, 0.8);
    }

    // 切換選取
    if (this.selectedNotes.has(noteIndex)) {
      this.selectedNotes.delete(noteIndex);
    } else {
      this.selectedNotes.add(noteIndex);
    }

    this._updateStates();

    if (this.onNoteClick) {
      this.onNoteClick(noteIndex, [...this.selectedNotes]);
    }
  }

  _updateStates() {
    const buttons = this.container.querySelectorAll('.notation-btn');
    buttons.forEach(btn => {
      const noteIndex = parseInt(btn.dataset.noteIndex);
      if (this.selectedNotes.has(noteIndex)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  getSelectedNotes() {
    return [...this.selectedNotes];
  }

  clearSelection() {
    this.selectedNotes.clear();
    this._updateStates();
  }

  showCorrectAnswer(notes) {
    const buttons = this.container.querySelectorAll('.notation-btn');
    buttons.forEach(btn => {
      const noteIndex = parseInt(btn.dataset.noteIndex);
      if (notes.includes(noteIndex)) {
        btn.classList.add('correct-highlight');
      }
    });
  }

  showWrongNotes(selectedNotes, correctNotes) {
    const correctSet = new Set(correctNotes);
    const buttons = this.container.querySelectorAll('.notation-btn');
    buttons.forEach(btn => {
      const noteIndex = parseInt(btn.dataset.noteIndex);
      if (this.selectedNotes.has(noteIndex) && !correctSet.has(noteIndex)) {
        btn.classList.add('wrong-highlight');
      }
      if (correctSet.has(noteIndex) && !this.selectedNotes.has(noteIndex)) {
        btn.classList.add('correct-highlight');
      }
    });
  }

  clearHighlights() {
    const buttons = this.container.querySelectorAll('.notation-btn');
    buttons.forEach(btn => {
      btn.classList.remove('correct-highlight');
      btn.classList.remove('wrong-highlight');
    });
  }
}

window.NotationMode = NotationMode;
