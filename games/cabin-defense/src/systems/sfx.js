// ─────────────────────────────────────────────────────────────
//  Tiny synthesized sound effects (Web Audio) — zero asset files,
//  so prototypes have "juice" from day one. Swap for real sounds
//  later via Phaser's loader if desired.
//
//    sfx.play('coin')   sfx.play('hit')   sfx.setMuted(true)
// ─────────────────────────────────────────────────────────────

const PRESETS = {
  click: { type: 'square', freq: 660, to: 880, dur: 0.06, vol: 0.12 },
  coin: { type: 'triangle', freq: 880, to: 1760, dur: 0.12, vol: 0.18 },
  hit: { type: 'sawtooth', freq: 220, to: 80, dur: 0.12, vol: 0.15 },
  boom: { type: 'noise', dur: 0.35, vol: 0.25 },
  upgrade: { type: 'square', freq: 440, to: 1320, dur: 0.25, vol: 0.12 },
  lose: { type: 'triangle', freq: 440, to: 110, dur: 0.6, vol: 0.2 },
};

class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;     // player setting
    this.suspended = false; // during ads
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended' && !this.suspended) this.ctx.resume();
    return this.ctx;
  }

  setMuted(m) { this.muted = m; }

  /** Called by the platform ad hooks. */
  pauseForAd() { this.suspended = true; this.ctx?.suspend(); }
  resumeAfterAd() { this.suspended = false; this.ctx?.resume(); }

  play(name) {
    if (this.muted || this.suspended) return;
    const p = PRESETS[name];
    const ctx = p && this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(p.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + p.dur);
    gain.connect(ctx.destination);

    if (p.type === 'noise') {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * p.dur), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      src.start(t);
    } else {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.setValueAtTime(p.freq, t);
      osc.frequency.exponentialRampToValueAtTime(p.to, t + p.dur);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + p.dur);
    }
  }
}

export const sfx = new Sfx();
