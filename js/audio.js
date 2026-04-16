// audio.js - 鋼琴音效模組（IndexedDB 快取 + Salamander 真實樣本 + 合成音 fallback）

class PianoAudio {
  constructor() {
    this.audioCtx      = null;
    this.masterGain    = null;
    this.reverb        = null;
    this.wetSend       = null;
    this.initialized   = false;
    this.buffers       = new Map();    // midi → AudioBuffer（解碼後）
    this.samplesLoaded = false;
    this._rawBuffers   = new Map();    // midi → ArrayBuffer（原始）
    this._fetchComplete = false;
    this._fetchPromise  = null;
    this._decodePromise = null;
  }

  // Salamander Grand Piano 採樣點（Tone.js 官方命名，每 3 半音一個）
  static SAMPLE_NOTES = [
    { name: 'A2',  midi: 45 },
    { name: 'C3',  midi: 48 },
    { name: 'Ds3', midi: 51 },
    { name: 'Fs3', midi: 54 },
    { name: 'A3',  midi: 57 },
    { name: 'C4',  midi: 60 },
    { name: 'Ds4', midi: 63 },
    { name: 'Fs4', midi: 66 },
    { name: 'A4',  midi: 69 },
    { name: 'C5',  midi: 72 },
    { name: 'Ds5', midi: 75 },
    { name: 'Fs5', midi: 78 },
    { name: 'A5',  midi: 81 },
    { name: 'C6',  midi: 84 },
  ];

  static BASE_URL = 'https://tonejs.github.io/audio/salamander/';
  static DB_NAME  = 'piano-samples-v2';   // v2：對應修正後的檔名
  static DB_STORE = 'samples';

  // ── 初始化 AudioContext（首次使用者互動後呼叫）────────

  init() {
    if (this.initialized) { this.resume(); return; }

    this.audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.65;

    // 乾聲直通
    this.masterGain.connect(this.audioCtx.destination);

    // 殘響（濕聲）路徑
    this.reverb  = this._createReverb();
    this.wetSend = this.audioCtx.createGain();
    this.wetSend.gain.value = 0.28;          // 28% 濕聲比例
    this.masterGain.connect(this.wetSend);
    this.wetSend.connect(this.reverb);
    this.reverb.connect(this.audioCtx.destination);

    this.initialized = true;
    this.resume();

    // AudioContext 就緒後立刻解碼已下載的樣本
    if (this._fetchComplete) this.decodeBuffers();
  }

  // ── 合成殘響（Convolution Reverb）────────────────────

  _createReverb() {
    const convolver  = this.audioCtx.createConvolver();
    const sampleRate = this.audioCtx.sampleRate;
    const duration   = 2.6;                  // 殘響尾音時長（秒）
    const length     = Math.floor(sampleRate * duration);
    const impulse    = this.audioCtx.createBuffer(2, length, sampleRate);

    // 雙聲道脈衝響應：指數衰減 + 輕微漫射
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        // 自然指數衰減，加入輕微早期反射特性
        const decay = Math.exp(-4.2 * t);
        const earlyBoost = i < sampleRate * 0.02 ? 1.4 : 1.0;
        data[i] = (Math.random() * 2 - 1) * decay * earlyBoost;
      }
    }
    convolver.buffer = impulse;
    return convolver;
  }

  resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // ── IndexedDB 操作 ───────────────────────────────────

  _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(PianoAudio.DB_NAME, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(PianoAudio.DB_STORE);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  _dbGet(db, key) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(PianoAudio.DB_STORE, 'readonly')
                    .objectStore(PianoAudio.DB_STORE).get(key);
      req.onsuccess = e => resolve(e.target.result ?? null);
      req.onerror   = e => reject(e.target.error);
    });
  }

  _dbPut(db, key, value) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(PianoAudio.DB_STORE, 'readwrite')
                    .objectStore(PianoAudio.DB_STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  // ── 第一階段：fetch ArrayBuffer（不需 AudioContext）──

  prefetchSamples(onProgress) {
    if (this._fetchPromise) return this._fetchPromise;
    this._fetchPromise = this._doFetch(onProgress);
    return this._fetchPromise;
  }

  async _doFetch(onProgress) {
    let db;
    try { db = await this._openDB(); } catch (e) {
      console.warn('[PianoAudio] 無法開啟 IndexedDB:', e);
    }

    const notes = PianoAudio.SAMPLE_NOTES;
    let done = 0;

    for (const note of notes) {
      try {
        let ab = db ? await this._dbGet(db, note.name) : null;
        if (!ab) {
          const url = PianoAudio.BASE_URL + note.name + '.mp3';
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          ab = await res.arrayBuffer();
          if (db) await this._dbPut(db, note.name, ab.slice(0));
        }
        this._rawBuffers.set(note.midi, ab);
      } catch (e) {
        console.warn(`[PianoAudio] 無法載入 ${note.name}:`, e.message);
      }
      done++;
      if (onProgress) onProgress(done, notes.length);
    }

    if (db) db.close();
    this._fetchComplete = true;
    if (this.initialized) this.decodeBuffers();
  }

  // ── 第二階段：decode AudioBuffer（需要 AudioContext）──

  decodeBuffers() {
    if (this._decodePromise) return this._decodePromise;
    this._decodePromise = this._doDecode();
    return this._decodePromise;
  }

  async _doDecode() {
    for (const [midi, ab] of this._rawBuffers) {
      try {
        const buf = await this._decodeAB(ab.slice(0));
        this.buffers.set(midi, buf);
      } catch (e) {
        console.warn(`[PianoAudio] 解碼失敗 midi=${midi}:`, e.message);
      }
    }
    if (this.buffers.size > 0) this.samplesLoaded = true;
  }

  // 相容舊版 Safari（callback 式 decodeAudioData）
  _decodeAB(ab) {
    return new Promise((resolve, reject) => {
      this.audioCtx.decodeAudioData(ab, resolve, reject);
    });
  }

  async clearCache() {
    await new Promise((res, rej) => {
      const req = indexedDB.deleteDatabase(PianoAudio.DB_NAME);
      req.onsuccess = res;
      req.onerror   = e => rej(e.target.error);
    });
    this._rawBuffers.clear();
    this.buffers.clear();
    this.samplesLoaded   = false;
    this._fetchComplete  = false;
    this._fetchPromise   = null;
    this._decodePromise  = null;
  }

  // ── 音符播放 ─────────────────────────────────────────

  midiToFreq(midi)           { return 440 * Math.pow(2, (midi - 69) / 12); }
  noteToMidi(noteIndex, oct) { return noteIndex + (oct + 1) * 12; }

  _nearestSampleMidi(targetMidi) {
    let best = null, bestDist = Infinity;
    for (const [midi] of this.buffers) {
      const d = Math.abs(midi - targetMidi);
      if (d < bestDist) { bestDist = d; best = midi; }
    }
    return best;
  }

  playNote(noteIndex, octave = 4, duration = 4.0) {
    if (!this.initialized) this.init();
    this.resume();
    if (this.samplesLoaded) {
      this._playSample(noteIndex, octave, duration);
    } else {
      this._playSynth(noteIndex, octave, duration);
    }
  }

  // 使用真實採樣 + playbackRate 音高移調
  _playSample(noteIndex, octave, duration) {
    const targetMidi = this.noteToMidi(noteIndex, octave);
    const sampleMidi = this._nearestSampleMidi(targetMidi);
    if (sampleMidi === null) return;

    const buffer = this.buffers.get(sampleMidi);
    if (!buffer) return;

    const now          = this.audioCtx.currentTime;
    const playbackRate = Math.pow(2, (targetMidi - sampleMidi) / 12);
    // 自然衰減：用樣本原始長度，不超過 duration 上限
    const playDuration = Math.min(buffer.duration / playbackRate, duration);
    const fadeStart    = Math.max(now + playDuration - 0.18, now + 0.05);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.setValueAtTime(1.0, fadeStart);
    gain.gain.linearRampToValueAtTime(0, now + playDuration);
    gain.connect(this.masterGain);

    const src = this.audioCtx.createBufferSource();
    src.buffer        = buffer;
    src.playbackRate.value = playbackRate;
    src.connect(gain);
    src.start(now);
    src.stop(now + playDuration);
  }

  // 合成音 fallback（真實樣本載入前使用）
  _playSynth(noteIndex, octave, duration) {
    const midi = this.noteToMidi(noteIndex, octave);
    const freq = this.midiToFreq(midi);
    const now  = this.audioCtx.currentTime;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(7000, now);
    filter.frequency.exponentialRampToValueAtTime(500, now + duration);
    filter.Q.value = 0.6;
    filter.connect(this.masterGain);

    const env = this.audioCtx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.38, now + 0.006);
    env.gain.exponentialRampToValueAtTime(0.14, now + 0.12);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    env.connect(filter);

    [[1, 1.0], [2, 0.42], [3, 0.18], [4, 0.10], [5, 0.06]].forEach(([r, g]) => {
      const osc = this.audioCtx.createOscillator();
      const hg  = this.audioCtx.createGain();
      const hd  = duration / Math.sqrt(r);
      osc.type = 'sine';
      osc.frequency.value = freq * r;
      hg.gain.setValueAtTime(g * 0.28, now);
      hg.gain.exponentialRampToValueAtTime(0.001, now + hd);
      osc.connect(hg); hg.connect(env);
      osc.start(now); osc.stop(now + hd);
    });
  }

  playChord(noteIndices, octave = 4, duration = 4.0) {
    noteIndices.forEach(n => this.playNote(n, octave, duration));
  }

  playArpeggio(noteIndices, octave = 4, interval = 0.16, duration = 4.0) {
    noteIndices.forEach((n, i) => {
      setTimeout(() => this.playNote(n, octave, duration), i * interval * 1000);
    });
  }
}

window.PianoAudio = PianoAudio;
