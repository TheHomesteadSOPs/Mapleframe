// ─────────────────────────────────────────────────────────────
//  Game 1 data: the path, tower slots, tower/enemy stats, and
//  waves. All tuning lives here — GameScene.js just reads it.
// ─────────────────────────────────────────────────────────────

// The lane enemies walk, in logical 1280×720 space. The HUD reserves
// the top ~100px, so keep waypoints below y=110.
export const PATH = [
  { x: -40, y: 200 },
  { x: 280, y: 200 },
  { x: 280, y: 440 },
  { x: 620, y: 440 },
  { x: 620, y: 170 },
  { x: 960, y: 170 },
  { x: 960, y: 540 },
  { x: 1200, y: 540 },
];

// Buildable pads, placed off the lane. Each holds at most one tower.
export const TOWER_SLOTS = [
  { x: 150, y: 300 },  // ~100px from path — reachable by every starter tower
  { x: 380, y: 320 },  // ~100px
  { x: 460, y: 530 },  // ~90px
  { x: 730, y: 280 },  // ~90px
  { x: 840, y: 560 },  // ~100px
  { x: 1040, y: 320 }, // ~80px
  { x: 1120, y: 620 }, // ~80px
  { x: 780, y: 590 },  // ~187px — ladle only, a deliberate "advanced" pad
];

// ── Towers ──────────────────────────────────────────────────
// Cost/damage/range are for level 1. Tapping a built tower upgrades it
// in place (spend gold, no drag-merge) up to LEVEL_MULT.length.
const LEVEL_MULT = [1, 1.9, 3.2]; // damage & value multiplier at levels 1/2/3
const LEVEL_COST_MULT = [1, 2.2, 4]; // upgrade cost multiplier

export const TOWER_DEFS = {
  rollingpin: {
    label: 'Rolling Pin',
    desc: 'Cheap, fast, reliable',
    sprite: 't01_rollingpin', color: 0xc98a4b,
    cost: 20, damage: 9, range: 130, fireRateMs: 420, projectileSpeed: 520,
  },
  grater: {
    label: 'Grater Cannon',
    desc: 'Splash damage',
    sprite: 't02_grater', color: 0xb8c2cc,
    cost: 40, damage: 15, range: 175, fireRateMs: 700, projectileSpeed: 460, splash: 45,
  },
  ladle: {
    label: 'Ladle Catapult',
    desc: 'Long range, big splash',
    sprite: 't03_ladle', color: 0xd9482b,
    cost: 60, damage: 28, range: 235, fireRateMs: 1150, projectileSpeed: 340, splash: 75,
  },
  blender: {
    label: 'Turbo Blender',
    desc: 'Very rapid fire',
    sprite: 't04_blender', color: 0xdedede,
    cost: 50, damage: 6, range: 140, fireRateMs: 160, projectileSpeed: 620,
  },
};

export function towerStatsAtLevel(id, level) {
  const d = TOWER_DEFS[id];
  const m = LEVEL_MULT[level - 1];
  return {
    damage: Math.round(d.damage * m),
    range: d.range + (level - 1) * 14,
    fireRateMs: Math.max(80, d.fireRateMs - (level - 1) * 25),
    splash: d.splash ? d.splash + (level - 1) * 10 : 0,
  };
}

export function upgradeCost(id, level) {
  if (level >= LEVEL_MULT.length) return null; // maxed
  return Math.round(TOWER_DEFS[id].cost * LEVEL_COST_MULT[level]);
}

export const MAX_TOWER_LEVEL = LEVEL_MULT.length;

// ── Enemies ─────────────────────────────────────────────────
export const ENEMY_DEFS = {
  pizzarino: { label: 'Pizzarino', sprite: 'e01_pizzarino', color: 0xe0582f, hp: 18, speed: 95, armor: 0, reward: 3, radius: 22 },
  meatballino: { label: 'Meatballino', sprite: 'e02_meatballino', color: 0x8a4a2c, hp: 75, speed: 52, armor: 2, reward: 8, radius: 26 },
  spaghetto: { label: 'Spaghetto', sprite: 'e03_spaghetto', color: 0xf2c94c, hp: 30, speed: 122, armor: 0, reward: 4, radius: 20 },
  parmesano: { label: 'Parmesano', sprite: 'e04_parmesano', color: 0xe0c05a, hp: 320, speed: 38, armor: 5, reward: 30, radius: 36, boss: true },
};

// ── Waves ───────────────────────────────────────────────────
// spawns: list of { type, count, intervalMs, delayMs }. delayMs is the
// gap before this group starts spawning, relative to the wave start.
export const WAVES = [
  { spawns: [{ type: 'pizzarino', count: 6, intervalMs: 700, delayMs: 0 }] },
  { spawns: [{ type: 'pizzarino', count: 8, intervalMs: 600, delayMs: 0 }, { type: 'spaghetto', count: 3, intervalMs: 500, delayMs: 1500 }] },
  { spawns: [{ type: 'meatballino', count: 4, intervalMs: 1200, delayMs: 0 }, { type: 'pizzarino', count: 6, intervalMs: 500, delayMs: 800 }] },
  { spawns: [{ type: 'spaghetto', count: 12, intervalMs: 400, delayMs: 0 }] },
  { spawns: [{ type: 'pizzarino', count: 10, intervalMs: 450, delayMs: 0 }, { type: 'meatballino', count: 5, intervalMs: 1000, delayMs: 1000 }, { type: 'spaghetto', count: 5, intervalMs: 400, delayMs: 2500 }] },
  { spawns: [{ type: 'meatballino', count: 9, intervalMs: 750, delayMs: 0 }] },
  { spawns: [{ type: 'spaghetto', count: 14, intervalMs: 350, delayMs: 0 }, { type: 'meatballino', count: 6, intervalMs: 900, delayMs: 1500 }] },
  { spawns: [{ type: 'parmesano', count: 1, intervalMs: 0, delayMs: 500 }, { type: 'pizzarino', count: 12, intervalMs: 400, delayMs: 0 }] },
];

/** Waves past the scripted list scale up forever (idle-game endless mode). */
export function waveForIndex(i) {
  if (i < WAVES.length) return WAVES[i];
  const n = i - WAVES.length + 1;
  const scale = 1 + n * 0.22;
  const boss = n % 4 === 0;
  return {
    spawns: [
      { type: 'pizzarino', count: Math.round(8 * scale), intervalMs: 380, delayMs: 0 },
      { type: 'spaghetto', count: Math.round(5 * scale), intervalMs: 350, delayMs: 1200 },
      { type: 'meatballino', count: Math.round(4 * scale), intervalMs: 900, delayMs: 2000 },
      ...(boss ? [{ type: 'parmesano', count: Math.floor(n / 4), intervalMs: 1500, delayMs: 500 }] : []),
    ],
    hpScale: scale, // GameScene multiplies enemy HP by this for endless waves
  };
}
