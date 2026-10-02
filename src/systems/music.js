// ─────────────────────────────────────────────────────────────
//  Procedural soundtrack (Web Audio, zero asset files).
//
//  Six themes: a calm menu theme plus five gameplay themes that
//  change every 5 waves (see themeForWave). Each gameplay theme is
//  a 16-bar form (A section + B section) with its own key, tempo,
//  feel, instruments and drum pattern. The melody is *composed live*:
//  every 4-bar phrase states a hook (kept for the whole theme), then
//  answers with a freshly generated line, so repeated loops keep
//  sounding different instead of replaying one short loop.
//
//  The Music class only needs an AudioContext + an output node, so
//  it also runs against an OfflineAudioContext (see renderOffline in
//  the test script) for previews and level checks.
// ─────────────────────────────────────────────────────────────

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { maj: [0, 4, 7], min: [0, 3, 7], dom7: [0, 4, 7, 10], min7: [0, 3, 7, 10] };
const SCALES = {
  majpent: [0, 2, 4, 7, 9],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harm: [0, 2, 3, 5, 7, 8, 11],
};

/** 'Am' → { pc: 9, notes: [pc offsets] } ; 'Bb', 'E7', 'Gm' … */
function parseChord(name) {
  const m = /^([A-G])([b#]?)(m)?(7)?$/.exec(name);
  if (!m) throw new Error(`bad chord ${name}`);
  const pc = (PC[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0) + 12) % 12;
  const q = m[3] ? (m[4] ? 'min7' : 'min') : (m[4] ? 'dom7' : 'maj');
  return { pc, tones: QUAL[q] };
}

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

// ── Theme definitions ───────────────────────────────────────
// spb = steps per beat, beats = beats per bar. Drum strings are one
// bar long: 'x' hit, 'o' ghost/soft hit, '.' rest.
export const THEMES = {
  menu: {
    name: "Nonna's Pantry", bpm: 88, beats: 4, spb: 4, tonic: 5, scale: 'majpent',
    bars: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C'],
    rhythms: [[0, 6, 8, 12], [0, 4, 10], [0, 3, 6, 10, 12], [2, 6, 8, 14]],
    lead: { wave: 'triangle', vol: 0.07, len: 3.2, base: 72, every: 1 },
    arp: { wave: 'sine', vol: 0.035, every: 2, pat: [0, 1, 2, 1], oct: 12 },
    bass: { style: 'root', wave: 'sine', vol: 0.10 },
    pad: { vol: 0.03, cutoff: 1400 },
    drums: null,
  },
  // 1–5: bright, bouncy kitchen morning.
  sunday: {
    name: 'Sunday Kitchen', bpm: 118, beats: 4, spb: 4, tonic: 0, scale: 'majpent',
    bars: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Am', 'Dm', 'G', 'C', 'F', 'Dm', 'G', 'G7'],
    rhythms: [[0, 3, 6, 8, 11, 14], [0, 2, 4, 8, 10, 12], [0, 3, 6, 10, 12, 14], [0, 4, 6, 8, 12, 15]],
    lead: { wave: 'square', vol: 0.032, len: 1.3, base: 74, every: 1, cutoff: 3200 },
    arp: { wave: 'triangle', vol: 0.04, every: 2, pat: [0, 1, 2, 1, 0, 2, 1, 2], oct: 0 },
    bass: { style: 'walk', wave: 'triangle', vol: 0.12 },
    pad: null,
    drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'o.o.o.o.o.o.o.o.' },
  },
  // 6–10: fast 6/8 tarantella.
  tarantella: {
    name: 'Tarantella', bpm: 118, beats: 2, spb: 3, tonic: 9, scale: 'harm',
    bars: ['Am', 'Am', 'E', 'Am', 'Am', 'Dm', 'E', 'Am', 'C', 'G', 'Dm', 'Am', 'F', 'E', 'Am', 'E7'],
    rhythms: [[0, 1, 2, 3, 4, 5], [0, 2, 3, 5], [0, 1, 3, 4, 5], [0, 3, 4, 5]],
    lead: { wave: 'sawtooth', vol: 0.03, len: 0.9, base: 76, every: 1, cutoff: 2600 },
    arp: { wave: 'triangle', vol: 0.035, every: 1, pat: [0, 1, 2, 1, 2, 1], oct: 0 },
    bass: { style: 'tarantella', wave: 'triangle', vol: 0.13 },
    pad: null,
    drums: { kick: 'x..x..', snare: '.o.o.o', hat: 'oxoxox' },
  },
  // 11–15: moodier, accordion pad, brush drums.
  midnight: {
    name: 'Midnight Pasta', bpm: 100, beats: 4, spb: 4, tonic: 2, scale: 'minor',
    bars: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'A', 'A7', 'Dm', 'Bb', 'Gm', 'A', 'Bb', 'F', 'Gm', 'A'],
    rhythms: [[0, 4, 7, 10, 12], [0, 3, 8, 11], [0, 6, 8, 12, 14], [2, 4, 8, 10, 14]],
    lead: { wave: 'sawtooth', vol: 0.034, len: 2.6, base: 70, every: 1, cutoff: 1500, detune: 8 },
    arp: { wave: 'sine', vol: 0.04, every: 2, pat: [0, 2, 1, 2], oct: 0 },
    bass: { style: 'walk', wave: 'sine', vol: 0.15 },
    pad: { vol: 0.05, cutoff: 1100 },
    drums: { kick: 'x.....x.........', snare: '....o.......o...', hat: '..o...o...o...o.' },
  },
  // 16–20: driving boss-fight energy.
  boss: {
    name: 'Basilico Boss Battle', bpm: 146, beats: 4, spb: 4, tonic: 4, scale: 'harm',
    bars: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'Am', 'B7', 'C', 'D', 'Em', 'Em', 'C', 'D', 'B7', 'B7'],
    rhythms: [[0, 2, 3, 6, 8, 10, 11, 14], [0, 3, 4, 7, 8, 12, 14], [0, 2, 6, 8, 10, 12, 15]],
    lead: { wave: 'square', vol: 0.03, len: 1.0, base: 76, every: 1, cutoff: 2800 },
    arp: { wave: 'sawtooth', vol: 0.02, every: 1, pat: [0, 2, 1, 2, 0, 2, 1, 2], oct: 0, cutoff: 1800 },
    bass: { style: 'pulse', wave: 'sawtooth', vol: 0.10, cutoff: 700 },
    pad: null,
    drums: { kick: 'x...x...x...x.x.', snare: '....x.......x..x', hat: 'xoxoxoxoxoxoxoxo' },
  },
  // 21+: epic, elite-era finale.
  finale: {
    name: 'Mamma Mia Finale', bpm: 156, beats: 4, spb: 4, tonic: 7, scale: 'minor',
    bars: ['Gm', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'Cm', 'D', 'Gm', 'Eb', 'Bb', 'F', 'Cm', 'D', 'Gm', 'D7'],
    rhythms: [[0, 3, 6, 8, 10, 12, 14], [0, 2, 4, 7, 8, 11, 12, 15], [0, 4, 6, 8, 12, 14]],
    lead: { wave: 'sawtooth', vol: 0.03, len: 1.8, base: 79, every: 1, cutoff: 3400, detune: 10, octDouble: true },
    arp: { wave: 'triangle', vol: 0.03, every: 1, pat: [0, 1, 2, 3, 2, 1, 2, 1], oct: 12 },
    bass: { style: 'pulse', wave: 'sawtooth', vol: 0.10, cutoff: 800 },
    pad: { vol: 0.04, cutoff: 1800 },
    drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'xxoxxxoxxxoxxxox' },
  },
};

/** Which theme plays on a given wave number (1-based). Changes every 5 waves. */
export function themeForWave(wave) {
  const order = ['sunday', 'tarantella', 'midnight', 'boss', 'finale'];
  const block = Math.max(0, Math.floor((wave - 1) / 5));
  if (block < order.length) return order[block];
  // After wave 25, rotate through the three hardest themes.
  return order[2 + ((block - order.length) % 3)];
}

export class Music {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    this.theme = null;
    this.pendingKey = 'menu';
    this.nextTime = 0;
    this.step = 0;       // step within the current loop of the theme
    this.hook = null;
    this.noise = this._makeNoise();
    this.currentKey = null;
  }

  setTheme(key) { if (key !== this.currentKey) this.pendingKey = key; }

  _makeNoise() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Schedule every step that starts before `until` (audio-context seconds). */
  schedule(until) {
    if (this.nextTime < this.ctx.currentTime) this.nextTime = this.ctx.currentTime + 0.05;
    for (let guard = 0; this.nextTime < until && guard < 400; guard++) {
      const th = this.theme;
      const stepsPerBar = th ? th.beats * th.spb : 16;
      const atBarStart = !th || this.step % stepsPerBar === 0;
      if (atBarStart && this.pendingKey && this.pendingKey !== this.currentKey) this._switchTo(this.pendingKey);
      this._playStep(this.nextTime, this.step);
      const t = this.theme;
      this.nextTime += 60 / t.bpm / t.spb;
      this.step += 1;
    }
  }

  _switchTo(key) {
    const hadTheme = !!this.theme;
    this.theme = THEMES[key];
    this.currentKey = key;
    this.pendingKey = null;
    this.step = 0;
    this._newHook();
    if (hadTheme && key !== 'menu') this._crash(this.nextTime); // mark the change
  }

  // ── Composition ─────────────────────────────────────────
  _scaleNote(th, pcOfChordRoot, degree, base) {
    const sc = SCALES[th.scale];
    // index of the scale tone nearest the chord root (relative to tonic)
    const rel = (pcOfChordRoot - th.tonic + 12) % 12;
    let idx = 0, best = 99;
    sc.forEach((s, i) => { const d = Math.min(Math.abs(s - rel), 12 - Math.abs(s - rel)); if (d < best) { best = d; idx = i; } });
    const total = idx + degree;
    const oct = Math.floor(total / sc.length);
    const within = ((total % sc.length) + sc.length) % sc.length;
    let midi = th.tonic + sc[within] + 12 * oct;
    while (midi < base - 6) midi += 12;
    while (midi > base + 12) midi -= 12;
    return midi;
  }

  _makePhraseLine(th, rhythm, startDeg) {
    let deg = startDeg;
    return rhythm.map((s, i) => {
      if (i > 0) deg += pick([-2, -1, -1, 1, 1, 2, 0]);
      deg = Math.max(-3, Math.min(5, deg));
      return { s, deg };
    });
  }

  _newHook() {
    const th = this.theme;
    this.hook = this._makePhraseLine(th, pick(th.rhythms), pick([0, 2, 4]));
  }

  _leadBar(th, barIdx, chordPc) {
    const posInPhrase = barIdx % 4;
    if (posInPhrase === 0 || posInPhrase === 2) return this.hook;      // state the hook
    const line = this._makePhraseLine(th, pick(th.rhythms), pick([0, 2, 3]));
    if (posInPhrase === 3) line[line.length - 1].deg = pick([0, 2, 4]); // resolve to a chord tone
    return line;
  }

  // ── Per-step playback ───────────────────────────────────
  _playStep(t, step) {
    const th = this.theme;
    const stepsPerBar = th.beats * th.spb;
    const barAbs = Math.floor(step / stepsPerBar);
    const barIdx = barAbs % th.bars.length;
    const s = step % stepsPerBar;
    const chord = parseChord(th.bars[barIdx]);
    const stepDur = 60 / th.bpm / th.spb;
    const barDur = stepDur * stepsPerBar;

    // Pad: one sustained chord per bar.
    if (th.pad && s === 0) {
      for (const tone of chord.tones) {
        const m = 48 + chord.pc + tone;
        this._tone('sawtooth', mtof(m), t, barDur * 0.98, th.pad.vol, { attack: 0.25, cutoff: th.pad.cutoff, detune: 7 });
      }
    }

    // Bass.
    this._bass(th, chord, s, t, stepDur, stepsPerBar);

    // Arpeggio.
    const arp = th.arp;
    if (arp && s % arp.every === 0) {
      const tones = [...chord.tones, chord.tones[0] + 12];
      const n = arp.pat[(s / arp.every) % arp.pat.length];
      const midi = 60 + chord.pc + tones[n % tones.length] + arp.oct;
      this._tone(arp.wave, mtof(midi), t, stepDur * arp.every * 0.9, arp.vol, { attack: 0.006, cutoff: arp.cutoff });
    }

    // Lead melody.
    const line = this._leadBar(th, barAbs, chord.pc);
    for (const note of line) {
      if (note.s !== s) continue;
      const midi = this._scaleNote(th, chord.pc, note.deg, th.lead.base);
      const dur = stepDur * th.lead.len;
      const opts = { attack: 0.01, cutoff: th.lead.cutoff, detune: th.lead.detune };
      this._tone(th.lead.wave, mtof(midi), t, dur, th.lead.vol, opts);
      if (th.lead.octDouble) this._tone(th.lead.wave, mtof(midi - 12), t, dur, th.lead.vol * 0.6, opts);
    }

    // Drums.
    const d = th.drums;
    if (d) {
      const hit = (pat) => pat[s % pat.length];
      const k = hit(d.kick), sn = hit(d.snare), h = hit(d.hat);
      if (k === 'x') this._kick(t);
      if (sn === 'x') this._snare(t, 1); else if (sn === 'o') this._snare(t, 0.35);
      if (h === 'x') this._hat(t, 1); else if (h === 'o') this._hat(t, 0.5);
    }
  }

  _bass(th, chord, s, t, stepDur, stepsPerBar) {
    const b = th.bass;
    const root = 36 + chord.pc;           // octave 2
    const fifth = root + 7;
    const note = (m, dur, v = 1) => this._tone(b.wave, mtof(m), t, dur, b.vol * v, { attack: 0.01, cutoff: b.cutoff });
    if (b.style === 'root') {
      if (s === 0) note(root + 12, stepDur * stepsPerBar * 0.5);
      if (s === stepsPerBar / 2) note(fifth, stepDur * stepsPerBar * 0.45, 0.8);
    } else if (b.style === 'walk') {
      const q = th.spb;
      if (s % q === 0) {
        const beat = s / q;
        const third = root + (chord.tones[1]);
        const seq = [root, third, fifth, third + 12 - 12 + 0];
        const m = [root, third, fifth, root + 12][beat % 4];
        note(m, stepDur * q * 0.85, beat === 0 ? 1.1 : 0.9);
      }
    } else if (b.style === 'pulse') {
      if (s % 2 === 0) note(root + (s % 8 === 6 ? 12 : 0), stepDur * 1.7, s % 8 === 0 ? 1.15 : 0.8);
    } else if (b.style === 'tarantella') {
      if (s === 0) note(root + 12, stepDur * 2.6);
      if (s === 3) note(fifth, stepDur * 2.4, 0.85);
    }
  }

  // ── Voices ──────────────────────────────────────────────
  _tone(type, freq, t, dur, vol, { attack = 0.01, cutoff, detune = 0 } = {}) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let dest = this.out;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
      f.connect(dest); dest = f;
    }
    g.connect(dest);
    const voices = detune ? [-detune, detune] : [0];
    for (const dt of voices) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = freq; o.detune.value = dt;
      o.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  _noiseHit(t, dur, vol, hp) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  _kick(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + 0.25);
  }

  _snare(t, v) {
    this._noiseHit(t, 0.14, 0.12 * v, 1400);
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 190;
    g.gain.setValueAtTime(0.06 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + 0.12);
  }

  _hat(t, v) { this._noiseHit(t, 0.04, 0.05 * v, 7000); }
  _crash(t) { this._noiseHit(t, 0.9, 0.09, 4500); }
}
