// staff.js - 五線譜視覺化模組（VexFlow 引擎）
// - 作答前：即時顯示使用者目前已選的音符
// - 作答後：顯示和弦符號 + 標色（綠=選對／紅=選錯／黃=遺漏的正確音）

// ── 音樂理論常數 ──────────────────────────────────────
const LETTER_ORDER       = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_NATURAL_PC  = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 半音音程 → 音階字母跨度（0=同音、1=二度、2=三度…6=七度）
// CHORD_TYPES 裡每個半音音程在所有和弦中的音樂功能一致，可安全共用此表
const INTERVAL_TO_LETTERSTEP = { 0:0, 1:0, 2:1, 3:2, 4:2, 5:3, 6:4, 7:4, 8:4, 9:5, 10:6, 11:6 };

// 12 個調性（pitch class 0-11，對應大調主音）的調號：升記號 / 降記號數量
// 調性名稱字串對應 VexFlow 內建的 keySignatures 表（tables.js），兩者需保持一致
const KEY_ACCIDENTALS = {
  0:  { name: 'C',  sharps: 0, flats: 0 },
  1:  { name: 'Db', sharps: 0, flats: 5 },
  2:  { name: 'D',  sharps: 2, flats: 0 },
  3:  { name: 'Eb', sharps: 0, flats: 3 },
  4:  { name: 'E',  sharps: 4, flats: 0 },
  5:  { name: 'F',  sharps: 0, flats: 1 },
  6:  { name: 'Gb', sharps: 0, flats: 6 },
  7:  { name: 'G',  sharps: 1, flats: 0 },
  8:  { name: 'Ab', sharps: 0, flats: 4 },
  9:  { name: 'A',  sharps: 3, flats: 0 },
  10: { name: 'Bb', sharps: 0, flats: 2 },
  11: { name: 'B',  sharps: 5, flats: 0 },
};

// 升／降記號在譜表上出現的字母順序（標準五度圈順序，用來判斷調號本身是否已含該升降記號）
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

// ── 音符拼寫 ──────────────────────────────────────────
function useFlatSpelling(keyIndex) {
  return (KEY_ACCIDENTALS[keyIndex] || KEY_ACCIDENTALS[0]).flats > 0;
}

// 依調性挑選升號或降號拼寫系統（沿用 chord.js 既有的 NOTE_NAMES / NOTE_NAMES_FLAT）
function spellPitchClass(pc, flats) {
  const name = (flats ? NOTE_NAMES_FLAT : NOTE_NAMES)[pc];
  const letter = name[0];
  const accidental = name.length > 1 ? (name[1] === '#' ? 1 : -1) : 0;
  return { letter, accidental };
}

// 依和弦根音字母，用三度（或 sus 的二/四度）疊構推算每個和弦音的字母與升降記號，
// 讓和弦音有符合樂理慣例的拼法（例如 dim7 拼成 C-Eb-Gb-A 而非 C-D#-F#-A）
function spellChordTones(chord, keyIndex) {
  const flats = useFlatSpelling(keyIndex);
  const root  = spellPitchClass(chord.root, flats);
  const rootLetterIdx = LETTER_ORDER.indexOf(root.letter);
  const intervals = (CHORD_TYPES[chord.type] || {}).intervals || [0];

  return intervals.map(interval => {
    const letterStep = INTERVAL_TO_LETTERSTEP[interval % 12];
    const letter     = LETTER_ORDER[(rootLetterIdx + letterStep) % 7];
    const naturalPc  = LETTER_NATURAL_PC[letter];
    const targetPc   = (chord.root + interval) % 12;
    let accidental = ((targetPc - naturalPc) % 12 + 12) % 12;
    if (accidental > 6) accidental -= 12;
    return { letter, accidental, pc: targetPc };
  });
}

// 判斷某字母在目前調號下「本來」就帶有的升降記號，只有跟實際音不一致時才需要畫臨時記號
function keySignatureAccidental(letter, keyIndex) {
  const info  = KEY_ACCIDENTALS[keyIndex];
  const flats = info.flats > 0;
  const count = flats ? info.flats : info.sharps;
  const order = flats ? FLAT_ORDER : SHARP_ORDER;
  if (!order.slice(0, count).includes(letter)) return 0;
  return flats ? -1 : 1;
}

// 以和弦根音為錨點，將任意 pitch class 集合排成嚴格上行（依相對根音的音程距離排序，
// 0=根音、11=根音下方大七度），八度也依此決定，音域穩定不會因選取變動而跳動
function orderAroundRoot(pcs, root) {
  return [...pcs].sort((a, b) => ((a - root + 12) % 12) - ((b - root + 12) % 12));
}
function octaveAboveRoot(pc, root, baseOctave = 4) {
  return pc < root ? baseOctave + 1 : baseOctave;
}

// ── StaffNotation ─────────────────────────────────────
class StaffNotation {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  clear() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.container.classList.add('hidden');
  }

  // 即時預覽（作答前）：只顯示目前已選的音，不透露和弦名稱、不標色
  renderPreview(selectedPcs, chord, keyIndex) {
    if (!chord || !selectedPcs || selectedPcs.length === 0) { this.clear(); return; }
    const notes = this._buildNotes(selectedPcs, chord, keyIndex);
    this._draw(notes, keyIndex, { label: null, colorMap: null });
  }

  // 送出答案後：顯示和弦符號，並標色（綠=選對／紅=選錯／黃=遺漏的正確音）
  renderResult(chord, selectedPcs, keyIndex) {
    if (!chord) { this.clear(); return; }
    const correctSet  = new Set(chord.notes);
    const selectedSet = new Set(selectedPcs);
    const allPcs = [...new Set([...selectedSet, ...correctSet])];
    const notes  = this._buildNotes(allPcs, chord, keyIndex);

    const colorMap = new Map();
    notes.forEach(n => {
      const inCorrect  = correctSet.has(n.pc);
      const inSelected = selectedSet.has(n.pc);
      colorMap.set(n.pc, inCorrect && inSelected ? 'correct' : inSelected ? 'wrong' : 'missing');
    });

    this._draw(notes, keyIndex, { label: chord.name, colorMap });
  }

  // 直接依「實際按下的音高」繪製（和弦查詢頁用）：不重排八度、不強制擠在同一音域，
  // pitches 需已含 {pc, octave}；spellMap 可傳入辨識到的和弦拼字（讓拼法更道地），
  // 沒有的音則退回一般調性拼字
  renderPitches(pitches, keyIndex, { label = null, spellMap = null, colorMap = null } = {}) {
    if (!pitches || pitches.length === 0) { this.clear(); return; }
    const flats  = useFlatSpelling(keyIndex);
    const sorted = [...pitches].sort((a, b) => (a.octave * 12 + a.pc) - (b.octave * 12 + b.pc));
    const notes  = sorted.map(p => {
      const spelled = (spellMap && spellMap.get(p.pc)) || spellPitchClass(p.pc, flats);
      return { pc: p.pc, letter: spelled.letter, accidental: spelled.accidental, octave: p.octave };
    });
    this._draw(notes, keyIndex, { label, colorMap });
  }

  // ── 內部：音符資料組裝 ──────────────────────────────────
  _buildNotes(pcs, chord, keyIndex) {
    const flats    = useFlatSpelling(keyIndex);
    const spellMap = new Map(spellChordTones(chord, keyIndex).map(s => [s.pc, s]));
    const ordered  = orderAroundRoot(pcs, chord.root);

    return ordered.map(pc => {
      const spelled = spellMap.get(pc) || spellPitchClass(pc, flats);
      return {
        pc,
        letter: spelled.letter,
        accidental: spelled.accidental,
        octave: octaveAboveRoot(pc, chord.root),
      };
    });
  }

  // ── 內部：VexFlow 繪製 ──────────────────────────────────
  _draw(notes, keyIndex, { label, colorMap }) {
    if (!this.container || !window.Vex || notes.length === 0) { this.clear(); return; }
    const { Renderer, Stave, StaveNote, Accidental, Annotation, Formatter } = Vex.Flow;

    this.container.innerHTML = '';
    this.container.classList.remove('hidden');

    const keyInfo  = KEY_ACCIDENTALS[keyIndex] || KEY_ACCIDENTALS[0];
    const sigCount = Math.max(keyInfo.sharps, keyInfo.flats);

    const keys = notes.map(n => {
      const acc = n.accidental === 1 ? '#' : n.accidental === -1 ? 'b' : '';
      return `${n.letter.toLowerCase()}${acc}/${n.octave}`;
    });

    const staveNote = new StaveNote({ keys, duration: 'w', clef: 'treble' });

    notes.forEach((n, i) => {
      // 臨時記號：只在跟調號本身不同時才畫（含還原記號）
      const sigAcc = keySignatureAccidental(n.letter, keyIndex);
      if (n.accidental !== sigAcc) {
        const code = n.accidental === 1 ? '#' : n.accidental === -1 ? 'b' : 'n';
        staveNote.addModifier(new Accidental(code), i);
      }
      // 標色
      if (colorMap) {
        const category = colorMap.get(n.pc);
        const color = category === 'correct' ? '#059669'
                    : category === 'wrong'   ? '#dc2626'
                    : category === 'missing' ? '#c9a227'
                    : null;
        if (color) staveNote.setKeyStyle(i, { fillStyle: color, strokeStyle: color });
      }
    });

    if (label) {
      const annotation = new Annotation(label)
        .setVerticalJustification(Annotation.VerticalJustify.TOP)
        .setFont('Arial, sans-serif', 15, 'bold');
      staveNote.addModifier(annotation, 0);
    }

    // 畫布尺寸先粗抓，繪製完後再依實際內容自動裁切 viewBox
    const width  = 220 + sigCount * 11;
    const height = label ? 190 : 160;

    const renderer = new Renderer(this.container, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    const stave = new Stave(10, label ? 32 : 12, width - 20);
    stave.addClef('treble');
    stave.addKeySignature(keyInfo.name);
    stave.setContext(context).draw();

    Formatter.FormatAndDraw(context, stave, [staveNote]);

    this._autoFitViewBox(width, height);
  }

  // 依實際繪製內容自動裁切 SVG viewBox，避免加線很多的和弦被裁到或留白過多
  _autoFitViewBox(fallbackW, fallbackH) {
    const svg = this.container.querySelector('svg');
    if (!svg) return;
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    try {
      const bbox = svg.getBBox();
      const pad = 8;
      if (bbox.width > 0 && bbox.height > 0) {
        svg.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
      }
    } catch {
      svg.setAttribute('viewBox', `0 0 ${fallbackW} ${fallbackH}`);
    }
    svg.classList.add('staff-svg');
  }
}

window.StaffNotation = StaffNotation;

// 提供給其他模組（例如和弦查詢頁）重用的樂理工具
window.MusicTheory = { KEY_ACCIDENTALS, useFlatSpelling, spellPitchClass, spellChordTones };
