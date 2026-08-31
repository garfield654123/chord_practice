// piano-wide.js - 可橫向捲動的鋼琴鍵盤（練習頁跟查詢頁共用同一套元件）
//
// 兩種模式：
// - pitchClassMode: true（練習頁）— 只認 pitch class（跟音名 12 音無關八度），
//   點任何八度的同一個音都算選同一個音，API 相容原本的 PianoKeyboard
//   （selectedNotes / getSelectedNotes / setRootNote / showWrongNotes...），
//   這樣 app.js 幾乎不用改
// - pitchClassMode: false（查詢頁，預設）— 追蹤實際按下的音高（pitch class + 八度），
//   維持原本查詢頁需要的「知道低音是哪個八度」的行為

class PianoWide {
  static START_MIDI = 21;  // A0
  static END_MIDI   = 108; // C8
  static BLACK_PCS  = new Set([1, 3, 6, 8, 10]);

  constructor(containerId, options = {}) {
    this.container      = document.getElementById(containerId);
    this.audio           = options.audio || null;
    this.pitchClassMode  = !!options.pitchClassMode;
    this.onNoteClick     = options.onNoteClick || null; // 練習模式：同 PianoKeyboard 的 (note, octave, selected[]) 介面
    this.onChange        = options.onChange || null;    // 查詢模式：(heldNotes: [{pc,octave}]) => void

    this.held         = new Map(); // 查詢模式：實際按住的 {pc,octave}
    this.selectedNotes = new Set(); // 練習模式：已選的 pitch class
    this.rootNote      = null;      // 練習模式：根音 pitch class

    this.render();
  }

  render() {
    this.container.innerHTML = '';
    this.container.classList.add('pw-keys');

    for (let midi = PianoWide.START_MIDI; midi <= PianoWide.END_MIDI; midi++) {
      const pc     = midi % 12;
      const octave = Math.floor(midi / 12) - 1;
      const black  = PianoWide.BLACK_PCS.has(pc);

      const key = document.createElement('div');
      key.className = `pw-key ${black ? 'pw-black' : 'pw-white'}`;
      key.dataset.pc = pc;
      key.dataset.octave = octave;

      if (!black && pc === 0) {
        const label = document.createElement('div');
        label.className = 'pw-label';
        label.textContent = `C${octave}`;
        key.appendChild(label);
      }

      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._handleKeyPress(pc, octave, key);
      });

      this.container.appendChild(key);
    }

    this._updateKeyStates();
  }

  _handleKeyPress(pc, octave, keyEl) {
    if (this.audio) this.audio.playNote(pc, octave, 0.8);

    if (this.pitchClassMode) {
      if (this.selectedNotes.has(pc)) {
        this.selectedNotes.delete(pc);
      } else {
        this.selectedNotes.add(pc);
      }
      this._updateKeyStates();
      if (this.onNoteClick) this.onNoteClick(pc, octave, [...this.selectedNotes]);
    } else {
      const id = `${pc}-${octave}`;
      if (this.held.has(id)) {
        this.held.delete(id);
        keyEl.classList.remove('active');
      } else {
        this.held.set(id, { pc, octave });
        keyEl.classList.add('active');
      }
      if (this.onChange) this.onChange(this.getHeldNotes());
    }
  }

  // ── 練習模式（pitch class）狀態 ────────────────────────
  _updateKeyStates() {
    if (!this.pitchClassMode) return;
    this.container.querySelectorAll('.pw-key').forEach(key => {
      const pc = parseInt(key.dataset.pc, 10);
      key.classList.remove('active', 'root-note');
      if (pc === this.rootNote) key.classList.add('root-note');
      else if (this.selectedNotes.has(pc)) key.classList.add('active');
    });
  }

  setRootNote(note) {
    this.rootNote = note;
    this._updateKeyStates();
  }

  showCorrectAnswer(notes) {
    const set = new Set(notes);
    this.container.querySelectorAll('.pw-key').forEach(key => {
      if (set.has(parseInt(key.dataset.pc, 10))) key.classList.add('correct-highlight');
    });
  }

  showWrongNotes(selectedNotes, correctNotes) {
    const correctSet  = new Set(correctNotes);
    const selectedSet = new Set(selectedNotes);
    this.container.querySelectorAll('.pw-key').forEach(key => {
      const pc = parseInt(key.dataset.pc, 10);
      if (selectedSet.has(pc) && !correctSet.has(pc)) key.classList.add('wrong-highlight');
      if (correctSet.has(pc) && !selectedSet.has(pc)) key.classList.add('correct-highlight');
    });
  }

  clearHighlights() {
    this.container.querySelectorAll('.pw-key').forEach(k => k.classList.remove('correct-highlight', 'wrong-highlight'));
  }

  // ── 對外共用 API ───────────────────────────────────────
  getSelectedNotes() {
    return this.pitchClassMode ? [...this.selectedNotes] : this.getHeldNotes();
  }

  clearSelection() {
    if (this.pitchClassMode) {
      this.selectedNotes.clear();
      this._updateKeyStates();
    } else {
      this.held.clear();
      this.container.querySelectorAll('.pw-key.active').forEach(k => k.classList.remove('active'));
      if (this.onChange) this.onChange([]);
    }
  }

  // 舊名稱相容（查詢頁 lookup.js 用）
  clear() { this.clearSelection(); }

  // ── 查詢模式（實際音高）專用 ─────────────────────────────
  getHeldNotes() {
    return [...this.held.values()];
  }

  // 捲動到中央 C（C4），方便剛切換過來時操作
  scrollToMiddleC() {
    const target = this.container.querySelector('.pw-white[data-pc="0"][data-octave="4"]');
    if (target) target.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
}

window.PianoWide = PianoWide;
