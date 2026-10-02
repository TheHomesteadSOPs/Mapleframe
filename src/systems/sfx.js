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
  // ── Per-tower sounds. Each is a stack of layers (tone / filtered noise)
  // so they read as distinct kitchen tools, with a little random pitch
  // jitter so rapid fire doesn't sound machine-gunned. Rate-limited too.
  // Rolling Pin: wooden thwack.
  shoot_pin: { minGap: 0.06, jitter: 0.08, layers: [
    { type: 'sine', freq: 230, to: 90, dur: 0.10, vol: 0.13 },
    { type: 'noise', dur: 0.045, vol: 0.07, filter: ['bandpass', 1500, 1.2] },
    { type: 'triangle', freq: 640, to: 420, dur: 0.03, vol: 0.03 },
  ] },
  hit_pin: { minGap: 0.05, jitter: 0.1, layers: [
    { type: 'sine', freq: 150, to: 70, dur: 0.09, vol: 0.10 },
    { type: 'noise', dur: 0.04, vol: 0.05, filter: ['bandpass', 800, 1] },
  ] },
  // Grater: metallic scrape + tiny "ting".
  shoot_grater: { minGap: 0.08, jitter: 0.06, layers: [
    { type: 'noise', dur: 0.08, vol: 0.055, filter: ['highpass', 4500, 0.8] },
    { type: 'square', freq: 1250, to: 880, dur: 0.05, vol: 0.016 },
    { type: 'triangle', freq: 2600, to: 2000, dur: 0.05, vol: 0.02, delay: 0.015 },
  ] },
  hit_grater: { minGap: 0.06, jitter: 0.1, layers: [
    { type: 'noise', dur: 0.06, vol: 0.045, filter: ['highpass', 3000, 0.8] },
    { type: 'triangle', freq: 1900, to: 1300, dur: 0.07, vol: 0.03 },
  ] },
  // Ladle: heavy bloop + wet splat on landing.
  shoot_ladle: { minGap: 0.12, jitter: 0.07, layers: [
    { type: 'sine', freq: 430, to: 150, dur: 0.18, vol: 0.12 },
    { type: 'sine', freq: 680, to: 260, dur: 0.12, vol: 0.05, delay: 0.02 },
    { type: 'noise', dur: 0.10, vol: 0.04, filter: ['lowpass', 900, 0.7] },
  ] },
  hit_ladle: { minGap: 0.08, jitter: 0.1, layers: [
    { type: 'noise', dur: 0.2, vol: 0.10, filter: ['lowpass', 1300, 0.7] },
    { type: 'sine', freq: 320, to: 80, dur: 0.16, vol: 0.10 },
  ] },
  // Blender: whirring buzz (two detuned saws through a lowpass).
  shoot_blender: { minGap: 0.08, jitter: 0.1, layers: [
    { type: 'sawtooth', freq: 150, to: 270, dur: 0.09, vol: 0.04, filter: ['lowpass', 1000, 1] },
    { type: 'sawtooth', freq: 156, to: 282, dur: 0.09, vol: 0.035, filter: ['lowpass', 1000, 1] },
    { type: 'square', freq: 820, to: 1150, dur: 0.05, vol: 0.012 },
  ] },
  hit_blender: { minGap: 0.07, jitter: 0.12, layers: [
    { type: 'sawtooth', freq: 420, to: 200, dur: 0.06, vol: 0.035, filter: ['lowpass', 1400, 1] },
    { type: 'noise', dur: 0.04, vol: 0.035, filter: ['bandpass', 2500, 1.5] },
  ] },
  wave: { type: 'triangle', freq: 330, to: 495, dur: 0.30, vol: 0.12 },
  lose: { type: 'triangle', freq: 400, to: 100, dur: 0.7, vol: 0.14 },
};

class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;     // player setting
    this.suspended = false; // during ads / rotate prompt
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
    if (this.ctx.state === 'suspended' && !this.suspended) this.ctx.resume();
    return this.ctx;
  }

  _applyLevels() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.muted ? 0 : SFX_LEVEL;
    this.musicBus.gain.value = this.muted ? 0 : MUSIC_LEVEL;
  }

  setMuted(m) { this.muted = m; this._applyLevels(); }

  /** Called by the platform ad hooks / rotate prompt. */
  pauseForAd() { this.suspended = true; this.ctx?.suspend(); }
  resumeAfterAd() { this.suspended = false; this.ctx?.resume(); }

  play(name) {
    if (this.suspended) return;
    const p = PRESETS[name];
    const ctx = p && this._ensure();
    if (!ctx) return;
    this.startMusic(); // first interaction unlocks audio → start the loop
    if (this.muted) return;
    const t = ctx.currentTime;
    if (p.minGap && t - (this.lastPlayed[name] ?? -1) < p.minGap) return;
    this.lastPlayed[name] = t;

    const layers = p.layers ?? [p];
    const k = 1 + (p.jitter ? (Math.random() * 2 - 1) * p.jitter : 0);
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
      f.frequency.value = L.filter[1] * k;
      f.Q.value = L.filter[2] ?? 1;
      f.connect(gain);
      head = f;
    }
    gain.connect(this.sfxBus);
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
    if (!ctx || !this.music || this.suspended || ctx.state !== 'running') return;
    this.music.schedule(ctx.currentTime + 0.4);
  }
}

export const sfx = new Sfx();
