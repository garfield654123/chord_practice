// chord.js - 和弦產生與校驗模組

const NOTE_NAMES      = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTE_NAMES_FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

const JIANPU_MAP = {
  0:'1', 1:'#1', 2:'2', 3:'#2', 4:'3', 5:'4',
  6:'#4', 7:'5', 8:'#5', 9:'6', 10:'#6', 11:'7'
};

// ── 和弦分類 ─────────────────────────────────────────
const CHORD_CATEGORIES = {
  triad:     { label: '三和弦',   color: '#16a34a', desc: 'maj / min / dim / aug / sus' },
  seventh:   { label: '七和弦',   color: '#2563eb', desc: 'Maj7 / m7 / 7 / dim7 / m7b5' },
  extended:  { label: '延伸和弦', color: '#d97706', desc: '6 / add9 / 9 / 11 / 6-9' },
  inversion: { label: '轉位和弦', color: '#7c3aed', desc: '第一 / 第二 / 第三轉位' },
  borrowed:  { label: '借用和弦', color: '#dc2626', desc: '平行小調借用（bIII / bVI / bVII …）' },
};

// ── 和弦類型定義 ─────────────────────────────────────
const CHORD_TYPES = {
  // 三和弦
  'maj':    { name: '大三和弦',   category: 'triad',    intervals: [0, 4, 7] },
  'min':    { name: '小三和弦',   category: 'triad',    intervals: [0, 3, 7] },
  'dim':    { name: '減三和弦',   category: 'triad',    intervals: [0, 3, 6] },
  'aug':    { name: '增三和弦',   category: 'triad',    intervals: [0, 4, 8] },
  'sus2':   { name: '掛二和弦',   category: 'triad',    intervals: [0, 2, 7] },
  'sus4':   { name: '掛四和弦',   category: 'triad',    intervals: [0, 5, 7] },
  // 七和弦
  'maj7':   { name: '大七和弦',   category: 'seventh',  intervals: [0, 4, 7, 11] },
  'min7':   { name: '小七和弦',   category: 'seventh',  intervals: [0, 3, 7, 10] },
  '7':      { name: '屬七和弦',   category: 'seventh',  intervals: [0, 4, 7, 10] },
  'dim7':   { name: '減七和弦',   category: 'seventh',  intervals: [0, 3, 6, 9] },
  'm7b5':   { name: '半減七和弦', category: 'seventh',  intervals: [0, 3, 6, 10] },
  'mMaj7':  { name: '小大七和弦', category: 'seventh',  intervals: [0, 3, 7, 11] },
  // 延伸和弦
  '6':      { name: '大六和弦',   category: 'extended', intervals: [0, 4, 7, 9] },
  'min6':   { name: '小六和弦',   category: 'extended', intervals: [0, 3, 7, 9] },
  'add9':   { name: '加九和弦',   category: 'extended', intervals: [0, 2, 4, 7] },
  'maj9':   { name: '大九和弦',   category: 'extended', intervals: [0, 2, 4, 7, 11] },
  '9':      { name: '屬九和弦',   category: 'extended', intervals: [0, 2, 4, 7, 10] },
  'min9':   { name: '小九和弦',   category: 'extended', intervals: [0, 2, 3, 7, 10] },
  '6/9':    { name: '六九和弦',   category: 'extended', intervals: [0, 2, 4, 7, 9] },
  'maj11':  { name: '大十一和弦', category: 'extended', intervals: [0, 2, 4, 5, 7, 11] },
  '11':     { name: '屬十一和弦', category: 'extended', intervals: [0, 2, 4, 5, 7, 10] },
};

// ── 大調自然音階 ──────────────────────────────────────
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_SCALE_TRIADS    = ['maj','min','min','maj','maj','min','dim'];
const MAJOR_SCALE_SEVENTHS  = ['maj7','min7','min7','maj7','7','min7','m7b5'];

// ── 借用和弦（平行小調借用）────────────────────────────
const BORROWED_CHORD_PATTERNS = [
  { degree: 'bIII',     offset: 3,  type: 'maj',  label: '降三級大三和弦' },
  { degree: 'bVI',      offset: 8,  type: 'maj',  label: '降六級大三和弦' },
  { degree: 'bVII',     offset: 10, type: 'maj',  label: '降七級大三和弦' },
  { degree: 'iv',       offset: 5,  type: 'min',  label: '四級小三和弦' },
  { degree: 'bII',      offset: 1,  type: 'maj',  label: '降二級大三和弦（拿坡里）' },
  { degree: 'bIIIMaj7', offset: 3,  type: 'maj7', label: '降三級大七和弦' },
  { degree: 'bVIMaj7',  offset: 8,  type: 'maj7', label: '降六級大七和弦' },
  { degree: 'bVII7',    offset: 10, type: '7',    label: '降七級屬七和弦' },
  { degree: 'iv7',      offset: 5,  type: 'min7', label: '四級小七和弦' },
  { degree: 'ivm7b5',   offset: 5,  type: 'm7b5', label: '四級半減七和弦' },
];

const INVERSION_NAMES = ['根音位置', '第一轉位', '第二轉位', '第三轉位'];

// ── ChordGenerator ────────────────────────────────────
class ChordGenerator {
  constructor() {
    this.currentKey       = 0;
    this.enabledCategories = new Set(['triad']);
    this.useDiatonicOnly  = true;
  }

  setKey(k)               { this.currentKey = k; }
  setDiatonicOnly(v)      { this.useDiatonicOnly = v; }
  setEnabledCategories(c) { this.enabledCategories = new Set(c); }

  generateRandom() {
    const cats = this.enabledCategories.size > 0
      ? [...this.enabledCategories]
      : ['triad'];
    const cat = cats[Math.floor(Math.random() * cats.length)];

    switch (cat) {
      case 'inversion': return this._generateInversion();
      case 'borrowed':  return this._generateBorrowed();
      default:          return this._generateByCategory(cat);
    }
  }

  // ── 依分類產生 ────────────────────────────────────────
  _generateByCategory(category) {
    // 延伸和弦不限調性（過於複雜的調內映射）
    if (category === 'extended') {
      return this._randomFromCategory('extended');
    }
    if (this.useDiatonicOnly) {
      return this._generateDiatonic(category);
    }
    return this._randomFromCategory(category);
  }

  _randomFromCategory(category) {
    const types = Object.entries(CHORD_TYPES)
      .filter(([, v]) => v.category === category)
      .map(([k]) => k);
    const root = Math.floor(Math.random() * 12);
    const type = types[Math.floor(Math.random() * types.length)];
    return this._buildChord(root, type, category);
  }

  _generateDiatonic(category) {
    const degree   = Math.floor(Math.random() * 7);
    const root     = (this.currentKey + MAJOR_SCALE_INTERVALS[degree]) % 12;
    const typeList = category === 'seventh' ? MAJOR_SCALE_SEVENTHS : MAJOR_SCALE_TRIADS;
    return this._buildChord(root, typeList[degree], category, degree + 1);
  }

  // ── 轉位和弦 ──────────────────────────────────────────
  _generateInversion() {
    const useSeventhBase = Math.random() < 0.4;
    const baseCategory   = useSeventhBase ? 'seventh' : 'triad';

    const types = Object.entries(CHORD_TYPES)
      .filter(([k, v]) => v.category === baseCategory && k !== 'sus2' && k !== 'sus4')
      .map(([k]) => k);

    const root  = Math.floor(Math.random() * 12);
    const type  = types[Math.floor(Math.random() * types.length)];
    const notes = this._getChordNotes(root, type);

    // 隨機選一個轉位（1 ~ notes.length - 1）
    const inversion    = Math.floor(Math.random() * (notes.length - 1)) + 1;
    const bassNote     = notes[inversion];
    const bassNoteName = NOTE_NAMES[bassNote];
    const baseName     = this._getChordName(root, type);

    return {
      root, type, category: 'inversion', inversion,
      inversionName: INVERSION_NAMES[inversion],
      notes, bassNote, bassNoteName,
      name:     `${baseName}/${bassNoteName}`,   // slash 標記
      baseChordName: baseName,
      typeName: `${CHORD_TYPES[type].name}（${INVERSION_NAMES[inversion]}）`,
    };
  }

  // ── 借用和弦 ──────────────────────────────────────────
  _generateBorrowed() {
    const pattern = BORROWED_CHORD_PATTERNS[
      Math.floor(Math.random() * BORROWED_CHORD_PATTERNS.length)
    ];
    const root = (this.currentKey + pattern.offset) % 12;
    return {
      root, type: pattern.type, category: 'borrowed',
      degree: pattern.degree,
      notes:    this._getChordNotes(root, pattern.type),
      name:     this._getChordName(root, pattern.type),
      typeName: `${pattern.label}（${pattern.degree}）`,
      degreeLabel: pattern.degree,
    };
  }

  // ── 工具方法 ──────────────────────────────────────────
  _buildChord(root, type, category, degree = null) {
    return {
      root, type, category, degree,
      notes:    this._getChordNotes(root, type),
      name:     this._getChordName(root, type),
      typeName: CHORD_TYPES[type].name,
    };
  }

  _getChordNotes(root, type) {
    return CHORD_TYPES[type].intervals.map(i => (root + i) % 12);
  }

  _getChordName(root, type) {
    const rootName = NOTE_NAMES[root];
    const suffix   = type === 'maj' ? '' : type === 'min' ? 'm' : type;
    return rootName + suffix;
  }

  checkAnswer(correctChord, selectedNotes) {
    const cs = new Set(correctChord.notes);
    const ss = new Set(selectedNotes);
    if (cs.size !== ss.size) return false;
    for (const n of cs) if (!ss.has(n)) return false;
    return true;
  }

  getJianpuForNote(noteIndex) {
    return JIANPU_MAP[(noteIndex - this.currentKey + 12) % 12];
  }

  getJianpuForChord(chord) {
    return chord.notes.map(n => this.getJianpuForNote(n));
  }
}

// ── 音程度數名稱（半音 → 唱名）────────────────────────────
const DEGREE_NAMES = ['1','♭2','2','♭3','3','4','♭5','5','♯5','6','♭7','7'];

// ── 和弦提示文字 ──────────────────────────────────────────
const CHORD_HINTS = {
  'maj':   '大三度＋純五度',
  'min':   '小三度＋純五度',
  'dim':   '小三度＋減五度',
  'aug':   '大三度＋增五度',
  'sus2':  '大二度＋純五度（以 2 代替 3 音）',
  'sus4':  '純四度＋純五度（以 4 代替 3 音）',
  'maj7':  '大三和弦＋大七度',
  'min7':  '小三和弦＋小七度',
  '7':     '大三和弦＋小七度（屬七）',
  'dim7':  '減三和弦＋減七度（全減）',
  'm7b5':  '減三和弦＋小七度（半減）',
  'mMaj7': '小三和弦＋大七度',
  '6':     '大三和弦＋大六度',
  'min6':  '小三和弦＋大六度',
  'add9':  '大三和弦＋大九度（無七音）',
  'maj9':  '大七和弦＋大九度',
  '9':     '屬七和弦＋大九度',
  'min9':  '小七和弦＋大九度',
  '6/9':   '大三和弦＋大六度＋大九度',
  'maj11': '大九和弦＋純十一度',
  '11':    '屬九和弦＋純十一度',
};

// 根據 CHORD_TYPES 的 intervals 計算音程公式字串，例如 "1 - ♭3 - 5 - ♭7"
function getIntervalFormula(type) {
  const intervals = (CHORD_TYPES[type] || {}).intervals || [];
  return intervals.map(i => DEGREE_NAMES[i]).join(' - ');
}

// 匯出
window.ChordGenerator          = ChordGenerator;
window.NOTE_NAMES              = NOTE_NAMES;
window.NOTE_NAMES_FLAT         = NOTE_NAMES_FLAT;
window.CHORD_TYPES             = CHORD_TYPES;
window.CHORD_CATEGORIES        = CHORD_CATEGORIES;
window.JIANPU_MAP              = JIANPU_MAP;
window.BORROWED_CHORD_PATTERNS = BORROWED_CHORD_PATTERNS;
window.CHORD_HINTS             = CHORD_HINTS;
window.DEGREE_NAMES            = DEGREE_NAMES;
window.getIntervalFormula      = getIntervalFormula;
