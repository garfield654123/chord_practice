// piano-wide.js - 88 鍵可橫向捲動的鋼琴（和弦查詢頁用）
// 跟 piano.js 的 PianoKeyboard 不同：這裡追蹤的是實際音高（pitch class + 八度），
// 不是只有 pitch class，因為查詢頁需要知道實際按的音才能正確判斷低音/轉位。

class PianoWide {
  static START_MIDI = 21;  // A0
  static END_MIDI   = 108; // C8
  static BLACK_PCS  = new Set([1, 3, 6, 8, 10]);

  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.audio     = options.audio || null;
    this.onChange  = options.onChange || null; // (heldNotes: [{pc, octave}]) => void
    this.held      = new Map(); // "pc-octave" -> { pc, octave }
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
        this._toggle(pc, octave, key);
      });

      this.container.appendChild(key);
    }
  }

  _toggle(pc, octave, keyEl) {
    const id = `${pc}-${octave}`;
    if (this.held.has(id)) {
      this.held.delete(id);
      keyEl.classList.remove('active');
    } else {
      this.held.set(id, { pc, octave });
      keyEl.classList.add('active');
      if (this.audio) this.audio.playNote(pc, octave, 0.8);
    }
    if (this.onChange) this.onChange(this.getHeldNotes());
  }

  getHeldNotes() {
    return [...this.held.values()];
  }

  clear() {
    this.held.clear();
    this.container.querySelectorAll('.pw-key.active').forEach(k => k.classList.remove('active'));
    if (this.onChange) this.onChange([]);
  }

  // 捲動到中央 C（C4），方便剛切換到這頁時操作
  scrollToMiddleC() {
    const target = this.container.querySelector('.pw-white[data-pc="0"][data-octave="4"]');
    if (target) target.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
}

window.PianoWide = PianoWide;
