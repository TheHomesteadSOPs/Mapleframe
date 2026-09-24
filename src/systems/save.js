// ─────────────────────────────────────────────────────────────
//  Save system — one versioned JSON blob per game.
//
//    save.data.coins += 10;
//    save.write();            // or save.writeSoon() for frequent updates
//
//  Add new fields to DEFAULTS; old saves are merged automatically.
//  Bump SCHEMA and add a step in migrate() if you rename/restructure.
// ─────────────────────────────────────────────────────────────
import { GAME } from '../config.js';
import { platform } from '../platform/index.js';

const SCHEMA = 1;

const DEFAULTS = {
  schema: SCHEMA,
  coins: 0,
  bestScore: 0,
  upgrades: {},            // e.g. { damage: 3, fireRate: 1 }
  settings: { muted: false },
  stats: { runs: 0, playSeconds: 0 },
  lastSeen: 0,             // timestamp, for offline earnings / daily rewards
  lastDailyClaim: 0,
};

function migrate(data) {
  // Example for the future:
  // if (data.schema === 1) { data.gems = 0; data.schema = 2; }
  data.schema = SCHEMA;
  return data;
}

function deepMerge(base, extra) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(extra ?? {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object'
      ? deepMerge(out[k], v)
      : v;
  }
  return out;
}

class Save {
  constructor() {
    this.key = `mapleframe.${GAME.id}`;
    this.data = structuredClone(DEFAULTS);
    this._timer = null;
    this.loaded = false; // never write before load() — would wipe the real save
  }

  load() {
    try {
      const raw = platform.storage.getItem(this.key);
      if (raw) this.data = migrate(deepMerge(DEFAULTS, JSON.parse(raw)));
    } catch (e) {
      console.warn('[save] corrupt save, starting fresh', e);
      this.data = structuredClone(DEFAULTS);
    }
    this.loaded = true;
    return this.data;
  }

  write() {
    clearTimeout(this._timer);
    this._timer = null;
    if (!this.loaded) return;
    this.data.lastSeen = Date.now();
    platform.storage.setItem(this.key, JSON.stringify(this.data));
  }

  /** Debounced write — safe to call every frame/click. */
  writeSoon(ms = 1000) {
    if (this._timer) return;
    this._timer = setTimeout(() => this.write(), ms);
  }

  reset() {
    this.data = structuredClone(DEFAULTS);
    this.write();
  }

  /** Seconds since the player was last here (for offline rewards). */
  secondsAway() {
    return this.data.lastSeen ? Math.max(0, (Date.now() - this.data.lastSeen) / 1000) : 0;
  }
}

export const save = new Save();

// Save when the tab is hidden/closed so progress is never lost.
addEventListener('visibilitychange', () => { if (document.hidden) save.write(); });
addEventListener('pagehide', () => save.write());
