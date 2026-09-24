// ─────────────────────────────────────────────────────────────
//  Per-game settings. When starting a new game from this
//  template, this is the first file to edit.
// ─────────────────────────────────────────────────────────────

export const GAME = {
  id: 'template',            // used as the save-data key — change per game!
  title: 'Mapleframe Template',
  studio: 'Mapleframe Games',
  version: '0.1.0',

  // Logical resolution. Phaser scales this to fit any screen.
  width: 1280,
  height: 720,

  // House colour palette (hex numbers for Phaser, strings for text).
  colors: {
    bg: 0x10141c,
    panel: 0x1c2330,
    maple: 0xd9482b,   // brand red
    gold: 0xf2b134,
    cream: 0xf4ecd8,
    muted: 0x7d8799,
  },
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

// Which portal SDK to load. Set automatically by the build command
// (`npm run build:crazygames` → "crazygames"). `npm run dev` = "local".
// You can also force one in the browser with ?platform=crazygames
const urlPlatform = new URLSearchParams(location.search).get('platform');
const PORTALS = ['crazygames', 'poki', 'itch'];
const buildMode = import.meta.env.MODE; // set by `vite build --mode <portal>`
export const PLATFORM = urlPlatform || (PORTALS.includes(buildMode) ? buildMode : 'local');

// Minimum gap between interstitial (midgame) ads. CrazyGames enforces
// ~3 minutes and returns "adCooldown" if you ask sooner.
export const MIDGAME_AD_COOLDOWN_MS = 3 * 60 * 1000;
