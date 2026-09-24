// ─────────────────────────────────────────────────────────────
//  Platform adapter — the ONLY place that talks to portal SDKs.
//
//  Game code calls `platform.*` and never touches CrazyGames/Poki
//  directly, so one codebase ships to every portal.
//
//    await platform.init()
//    platform.loadingFinished()
//    platform.gameplayStart() / gameplayStop()
//    await platform.showMidgameAd()          // natural breaks only
//    const ok = await platform.showRewardedAd()  // true = give reward
//    platform.happyTime()                    // big wins (CrazyGames)
//    platform.storage.getItem/setItem        // save data
// ─────────────────────────────────────────────────────────────
import { PLATFORM, MIDGAME_AD_COOLDOWN_MS } from '../config.js';

const SDK_URLS = {
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
  poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
};

function loadScript(src, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    const t = setTimeout(() => reject(new Error('SDK load timeout')), timeoutMs);
    s.onload = () => { clearTimeout(t); resolve(); };
    s.onerror = () => { clearTimeout(t); reject(new Error('SDK load failed')); };
    document.head.appendChild(s);
  });
}

// Safe wrapper around localStorage (it can throw in private mode / iframes).
const localStore = {
  getItem(k) { try { return localStorage.getItem(k); } catch { return null; } },
  setItem(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

class Platform {
  constructor() {
    this.name = 'local';
    this.storage = localStore;
    this._lastMidgame = 0;
    this._inGameplay = false;
    this._hooks = { onAdStart: () => {}, onAdEnd: () => {} };
  }

  /** Game registers how to mute/pause while an ad plays. */
  setAdHooks({ onAdStart, onAdEnd }) {
    if (onAdStart) this._hooks.onAdStart = onAdStart;
    if (onAdEnd) this._hooks.onAdEnd = onAdEnd;
  }

  async init() {
    const target = PLATFORM;
    if (!SDK_URLS[target]) {
      this.name = target; // 'local' or 'itch' — no SDK, no ads
      console.info(`[platform] ${this.name} (no SDK)`);
      return;
    }
    try {
      await loadScript(SDK_URLS[target]);
      if (target === 'crazygames') {
        await window.CrazyGames.SDK.init();
        this.sdk = window.CrazyGames.SDK;
        // CrazyGames' data module mirrors localStorage and syncs across devices.
        this.storage = this.sdk.data ?? localStore;
      } else if (target === 'poki') {
        await window.PokiSDK.init().catch(() => {}); // Poki: always continue
        this.sdk = window.PokiSDK;
      }
      this.name = target;
      console.info(`[platform] ${this.name} SDK ready`);
    } catch (err) {
      // Ad blockers often block SDKs. The game must still run.
      console.warn('[platform] SDK unavailable, running local:', err.message);
      this.name = 'local';
    }
  }

  loadingStart() {
    if (this.name === 'crazygames') this.sdk.game.loadingStart();
  }

  loadingFinished() {
    if (this.name === 'crazygames') this.sdk.game.loadingStop();
    if (this.name === 'poki') this.sdk.gameLoadingFinished();
  }

  gameplayStart() {
    if (this._inGameplay) return;
    this._inGameplay = true;
    if (this.name === 'crazygames') this.sdk.game.gameplayStart();
    if (this.name === 'poki') this.sdk.gameplayStart();
  }

  gameplayStop() {
    if (!this._inGameplay) return;
    this._inGameplay = false;
    if (this.name === 'crazygames') this.sdk.game.gameplayStop();
    if (this.name === 'poki') this.sdk.gameplayStop();
  }

  happyTime() {
    if (this.name === 'crazygames') this.sdk.game.happytime();
  }

  /** Interstitial at a natural break (between levels, after game over). */
  async showMidgameAd() {
    const now = Date.now();
    if (now - this._lastMidgame < MIDGAME_AD_COOLDOWN_MS) return;
    this._lastMidgame = now;
    await this._runAd('midgame');
  }

  /** Player-initiated reward. Resolves true only if the ad completed. */
  async showRewardedAd() {
    return this._runAd('rewarded');
  }

  async _runAd(type) {
    const wasPlaying = this._inGameplay;
    if (wasPlaying) this.gameplayStop();
    let rewarded = false;

    try {
      if (this.name === 'crazygames') {
        rewarded = await new Promise((resolve) => {
          this.sdk.ad.requestAd(type, {
            adStarted: () => this._hooks.onAdStart(),
            adFinished: () => resolve(true),
            adError: (e) => { console.info('[platform] ad error', e); resolve(false); },
          });
        });
      } else if (this.name === 'poki') {
        if (type === 'rewarded') {
          rewarded = await this.sdk.rewardedBreak({ onStart: () => this._hooks.onAdStart() });
        } else {
          await this.sdk.commercialBreak(() => this._hooks.onAdStart());
        }
      } else {
        // Local/itch: simulate so the flow can be tested in dev.
        this._hooks.onAdStart();
        console.info(`[platform] (simulated ${type} ad)`);
        await new Promise((r) => setTimeout(r, 600));
        rewarded = true;
      }
    } finally {
      this._hooks.onAdEnd();
      if (wasPlaying) this.gameplayStart();
    }
    return type === 'rewarded' ? rewarded : true;
  }
}

export const platform = new Platform();
