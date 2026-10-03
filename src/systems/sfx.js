// ─────────────────────────────────────────────────────────────
//  Synthesized sound (Web Audio) — zero asset files.
//    sfx.play('coin')   sfx.setMuted(true)   sfx.startMusic()
//
//  Levels are kept deliberately low and consistent: every effect
//  goes through one master bus (SFX_LEVEL) and the music through
//  another (MUSIC_LEVEL), so nothing is jarringly loud and the
//  music never drowns the effects. Both buses are silenced by mute.
// ─────────────────────────────────────────────────────────────

import { Music, themeForWave } from './music.js';

const SFX_LEVEL = 0.8;
const MUSIC_LEVEL = 0.5;

/** A struck object: sine partials [ratio, relativeVol, decaySecs] over a base freq. */
function modal(f, parts, vol, delay = 0) {
  return parts.map(([r, v, d]) => ({ type: 'sine', freq: f * r, to: f * r * 0.99, dur: d, vol: vol * v, delay }));
}

const PRESETS = {
  click: { type: 'triangle', freq: 520, to: 700, dur: 0.06, vol: 0.10 },
  coin: { type: 'triangle', freq: 880, to: 1500, dur: 0.10, vol: 0.10, minGap: 0.05 },
  hit: { type: 'sawtooth', freq: 200, to: 90, dur: 0.12, vol: 0.09 },
  boom: { type: 'noise', dur: 0.30, vol: 0.14 },
  upgrade: { type: 'triangle', freq: 440, to: 1100, dur: 0.22, vol: 0.12 },
  place: { layers: [
    { type: 'sine', freq: 170, to: 80, dur: 0.14, vol: 0.18 },
    { type: 'noise', dur: 0.05, vol: 0.06, filter: ['bandpass', 1000, 1] },
    { type: 'triangle', freq: 660, to: 990, dur: 0.14, vol: 0.06, delay: 0.06 },
  ] },
  // ── Per-tower sounds ──────────────────────────────────────
  // Built from small physical-ish models rather than plain beeps:
  //   modal(): a struck object = several inharmonic partials, each with
  //            its own decay (wood block, metal pot, pan ring).
  //   noise layers with a swept filter [type, hz, q, hzTo] = whooshes/splashes.
  //   `am: [hz, depth]` = amplitude flutter (grating scrape, motor).
  // Every shot gets random pitch jitter and the tower's upgrade level adds
  // a slight pitch rise, so a maxed tower sounds "tighter" than a new one.
  shoot_pin: { minGap: 0.07, jitter: 0.09, layers: [
    // swing whoosh, then the knock of wood on dough
    { type: 'noise', dur: 0.10, vol: 0.04, filter: ['bandpass', 450, 1.4, 1800] },
    ...modal(330, [[1, 1, 0.10], [2.4, 0.55, 0.06], [4.1, 0.3, 0.035]], 0.07, 0.05),
    { type: 'sine', freq: 150, to: 68, dur: 0.09, vol: 0.09, delay: 0.05 },
    { type: 'noise', dur: 0.02, vol: 0.06, filter: ['bandpass', 2300, 1], delay: 0.05 },
  ] },
  hit_pin: { minGap: 0.06, jitter: 0.1, layers: [
    // dull "pof" of dough
    { type: 'sine', freq: 115, to: 50, dur: 0.13, vol: 0.13 },
    { type: 'noise', dur: 0.08, vol: 0.07, filter: ['lowpass', 700, 0.8] },
    ...modal(210, [[1, 1, 0.07], [2.2, 0.4, 0.05]], 0.05),
  ] },

  shoot_grater: { minGap: 0.09, jitter: 0.07, layers: [
    // rasping scrape + ringing metal
    { type: 'noise', dur: 0.12, vol: 0.12, filter: ['bandpass', 3200, 2, 6800], am: [70, 0.9] },
    { type: 'noise', dur: 0.05, vol: 0.05, filter: ['highpass', 6000, 0.7] },
    ...modal(2300, [[1, 1, 0.13], [1.52, 0.5, 0.09], [2.2, 0.3, 0.07]], 0.05, 0.02),
  ] },
  hit_grater: { minGap: 0.07, jitter: 0.12, layers: [
    // crumbling cheese: a few tiny ticks
    { type: 'noise', dur: 0.025, vol: 0.08, filter: ['bandpass', 5200, 1.5] },
    { type: 'noise', dur: 0.025, vol: 0.065, filter: ['bandpass', 4300, 1.5], delay: 0.03 },
    { type: 'noise', dur: 0.025, vol: 0.055, filter: ['bandpass', 6000, 1.5], delay: 0.055 },
    { type: 'triangle', freq: 1800, to: 900, dur: 0.06, vol: 0.02 },
  ] },

  shoot_ladle: { minGap: 0.13, jitter: 0.07, layers: [
    // clang of the metal bowl + rising gloop
    ...modal(600, [[1, 1, 0.24], [2.76, 0.5, 0.15], [5.4, 0.3, 0.08]], 0.09),
    { type: 'sine', freq: 260, to: 620, dur: 0.09, vol: 0.09, delay: 0.03 },
    { type: 'noise', dur: 0.08, vol: 0.03, filter: ['lowpass', 900, 0.7] },
  ] },
  hit_ladle: { minGap: 0.09, jitter: 0.1, layers: [
    // splash + bubbles popping
    { type: 'noise', dur: 0.26, vol: 0.11, filter: ['bandpass', 2500, 0.7, 500] },
    { type: 'sine', freq: 200, to: 70, dur: 0.16, vol: 0.10 },
    { type: 'sine', freq: 350, to: 900, dur: 0.05, vol: 0.06, delay: 0.04 },
    { type: 'sine', freq: 280, to: 760, dur: 0.05, vol: 0.05, delay: 0.09 },
    { type: 'sine', freq: 420, to: 1100, dur: 0.04, vol: 0.04, delay: 0.15 },
  ] },

  shoot_blender: { minGap: 0.09, jitter: 0.1, layers: [
    // motor spin-up (two detuned saws, fluttering) + ice rattle
    { type: 'sawtooth', freq: 80, to: 380, dur: 0.13, vol: 0.075, filter: ['lowpass', 1200, 1, 2500], am: [45, 0.6] },
    { type: 'sawtooth', freq: 83, to: 392, dur: 0.13, vol: 0.06, filter: ['lowpass', 1200, 1, 2500], am: [45, 0.6] },
    { type: 'noise', dur: 0.06, vol: 0.03, filter: ['highpass', 3500, 0.8], am: [90, 0.8] },
    { type: 'sine', freq: 900, to: 1400, dur: 0.04, vol: 0.012 },
  ] },
  hit_blender: { minGap: 0.08, jitter: 0.12, layers: [
    // chop-crunch + ice tinkle
    { type: 'noise', dur: 0.06, vol: 0.055, filter: ['bandpass', 1800, 2], am: [120, 0.9] },
    { type: 'sawtooth', freq: 300, to: 120, dur: 0.06, vol: 0.04, filter: ['lowpass', 900, 1] },
    { type: 'triangle', freq: 3200, to: 2400, dur: 0.05, vol: 0.016 },
  ] },
  wave: { type: 'triangle', freq: 330, to: 495, dur: 0.30, vol: 0.12 },
  lose: { type: 'triangle', freq: 400, to: 100, dur: 0.7, vol: 0.14 },
};

class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;     // player setting
    this.suspended = false; // during ads / rotate prompt
    this.focusLost = false; // tab hidden / window not focused
    this.musicPaused = false; // pause menu
    this.sfxBus = null;
    this.musicBus = null;
    this.lastPlayed = {};
    this.musicTimer = null;
    this.musicWanted = false;
    this.music = null;
    this.themeKey = 'menu';
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.ctx.destination);
      this.musicBus.connect(this.ctx.destination);
      this._applyLevels();
    }
    if (this.ctx.state === 'suspended' && !this.suspended && !this.focusLost) this.ctx.resume();
    return this.ctx;
  }

  _applyLevels() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.muted ? 0 : SFX_LEVEL;
    const target = this.muted || this.musicPaused ? 0 : MUSIC_LEVEL;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
  }

  setMuted(m) { this.muted = m; this._applyLevels(); }

  /** Called by the platform ad hooks / rotate prompt. */
  pauseForAd() { this.suspended = true; this._syncRunning(); }
  resumeAfterAd() { this.suspended = false; this._syncRunning(); }

  /** Window/tab focus: silence everything while the player is elsewhere. */
  setFocus(has) {
    if (this.focusLost === !has) return;
    this.focusLost = !has;
    this._syncRunning();
  }

  _syncRunning() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.suspended || this.focusLost) ctx.suspend();
    else { ctx.resume(); if (this.music) this.music.nextTime = 0; }
  }

  /** Pause menu: music stops (UI clicks still sound); resumes on the next beat. */
  setMusicPaused(p) {
    if (this.musicPaused === p) return;
    this.musicPaused = p;
    if (!p && this.music) this.music.nextTime = 0; // don't replay what we skipped
    this._applyLevels();
  }

  play(name, pitch = 1) {
    if (this.suspended || this.focusLost) return;
    const p = PRESETS[name];
    const ctx = p && this._ensure();
    if (!ctx) return;
    this.startMusic(); // first interaction unlocks audio → start the loop
    if (this.muted) return;
    const t = ctx.currentTime;
    if (p.minGap && t - (this.lastPlayed[name] ?? -1) < p.minGap) return;
    this.lastPlayed[name] = t;

    const layers = p.layers ?? [p];
    const k = pitch * (1 + (p.jitter ? (Math.random() * 2 - 1) * p.jitter : 0));
    for (const L of layers) this._layer(ctx, L, t + (L.delay ?? 0), k);
  }

  _layer(ctx, L, t, k) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(L.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + L.dur);
    let head = gain;
    if (L.filter) {
      const f = ctx.createBiquadFilter();
      f.type = L.filter[0];
      f.frequency.setValueAtTime(L.filter[1] * k, t);
      if (L.filter[3]) f.frequency.exponentialRampToValueAtTime(L.filter[3] * k, t + L.dur);
      f.Q.value = L.filter[2] ?? 1;
      f.connect(gain);
      head = f;
    }
    gain.connect(this.sfxBus);
    if (L.am) {
      // Amplitude flutter: gain node whose gain is modulated by an LFO.
      const am = ctx.createGain();
      am.gain.value = 1 - L.am[1] / 2;
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = L.am[0];
      lg.gain.value = L.am[1] / 2;
      lfo.connect(lg); lg.connect(am.gain);
      lfo.start(t); lfo.stop(t + L.dur + 0.02);
      am.connect(head);
      head = am;
    }
    if (L.type === 'noise') {
      const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * L.dur)), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(head);
      src.start(t);
    } else {
      const osc = ctx.createOscillator();
      osc.type = L.type;
      osc.frequency.setValueAtTime(L.freq * k, t);
      osc.frequency.exponentialRampToValueAtTime(L.to * k, t + L.dur);
      osc.connect(head);
      osc.start(t);
      osc.stop(t + L.dur + 0.02);
    }
  }

  // ── Music ───────────────────────────────────────────────
  startMusic() {
    this.musicWanted = true;
    const ctx = this.ctx;
    if (!ctx || this.musicTimer) return;
    if (!this.music) { this.music = new Music(ctx, this.musicBus); this.music.setTheme(this.themeKey); }
    this.musicTimer = setInterval(() => this._tickMusic(), 120);
  }

  stopMusic() {
    this.musicWanted = false;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  /** Request a theme by key; takes effect at the next bar line. */
  setMusicTheme(key) {
    this.themeKey = key;
    this.music?.setTheme(key);
  }

  /** Every 5 waves the soundtrack changes. */
  musicForWave(n) { this.setMusicTheme(themeForWave(n)); }

  _tickMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.music || this.suspended || this.focusLost || this.musicPaused || ctx.state !== 'running') return;
    this.music.schedule(ctx.currentTime + 0.4);
  }
}

export const sfx = new Sfx();

// Pause audio whenever the player leaves the tab or the window loses focus.
// Hidden and blurred are tracked separately (and any click/keypress counts as
// focus) so audio can't get stuck off inside a portal's iframe.
if (typeof window !== 'undefined') {
  let hidden = false, blurred = false;
  const apply = () => sfx.setFocus(!hidden && !blurred);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; apply(); });
  window.addEventListener('blur', () => { blurred = true; apply(); });
  window.addEventListener('focus', () => { blurred = false; apply(); });
  for (const ev of ['pointerdown', 'keydown']) {
    window.addEventListener(ev, () => { if (blurred) { blurred = false; apply(); } }, true);
  }
}
