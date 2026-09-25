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
  { x: 730, y: 280 },  // ~110px
  { x: 1060, y: 460 }, // ~80px — moved in from (840,560)/~122px (was out of
                        // range for rolling pins), then off (870,555)/~90px
                        // (visually overlapped the blender tray icon)
  { x: 1040, y: 320 }, // ~80px
  { x: 1120, y: 620 }, // ~80px
  { x: 700, y: 480 },  // ~90px — moved in from (780,590)/~187px, was out of
                        // range for every tower except the ladle
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
// Radii are 10% bigger than the original design (Ian's request) — e.g.
// pizzarino was 22, 22*1.1=24.2 -> 24. Rounded to whole pixels.
export const ENEMY_DEFS = {
  pizzarino: { label: 'Pizzarino', sprite: 'e01_pizzarino', color: 0xe0582f, hp: 18, speed: 95, armor: 0, reward: 3, radius: 24 },
  meatballino: { label: 'Meatballino', sprite: 'e02_meatballino', color: 0x8a4a2c, hp: 75, speed: 52, armor: 2, reward: 8, radius: 29 },
  spaghetto: { label: 'Spaghetto', sprite: 'e03_spaghetto', color: 0xf2c94c, hp: 30, speed: 122, armor: 0, reward: 4, radius: 22 },
  parmesano: { label: 'Parmesano', sprite: 'e04_parmesano', color: 0xe0c05a, hp: 320, speed: 38, armor: 5, reward: 30, radius: 40, boss: true },

  // ── Endless-mode variety (past wave 8) — not just bigger numbers.
  // Saucezilla splits into two fast Saucelings on death, so towers that
  // one-shot it don't actually clear the lane; Espresso Golem is a
  // second boss archetype (fast + tanky vs. Parmesano's slow + armored),
  // so a wall built to counter one boss type struggles against the other.
  saucezilla: {
    label: 'Saucezilla', sprite: 'e05_saucezilla', color: 0xc0392b,
    hp: 140, speed: 60, armor: 1, reward: 10, radius: 33,
    splitOnDeath: 'sauceling', splitCount: 2,
  },
  sauceling: { label: 'Sauceling', sprite: 'e06_sauceling', color: 0xe74c3c, hp: 20, speed: 150, armor: 0, reward: 2, radius: 15 },
  espresso: {
    label: 'Espresso Golem', sprite: 'e07_espresso', color: 0x3e2723,
    hp: 230, speed: 74, armor: 3, reward: 35, radius: 37, boss: true,
  },
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

// Per-group spawn caps for endless mode. Without these, wave size keeps
// growing forever (at wave ~58 the raw formula wants 96 pizzarinos alone)
// which is rough on low-end phones — lots of simultaneous sprites + HP
// bars. Capping counts keeps difficulty scaling through HP/armor (via
// hpScale, uncapped) instead of unbounded enemy counts. Saucezilla is
// capped lower since each one becomes 2 Saucelings on death.
const SPAWN_CAPS = { pizzarino: 40, spaghetto: 30, meatballino: 24, saucezilla: 10, parmesano: 6, espresso: 6 };

/**
 * Waves past the scripted list scale up forever (idle-game endless mode).
 * Past wave ~10 this also introduces Saucezilla (a splitter — killing it
 * spawns 2 fast Saucelings) and alternates the boss every 4 waves between
 * Parmesano (slow tank) and Espresso Golem (fast bruiser), so the late
 * game asks for a different defense, not just a bigger one.
 */
export function waveForIndex(i) {
  if (i < WAVES.length) return WAVES[i];
  const n = i - WAVES.length + 1;
  const scale = 1 + n * 0.22;
  const bossWave = n % 4 === 0;
  const bossType = bossWave ? (((n / 4) % 2 === 1) ? 'parmesano' : 'espresso') : null;
  const cap = (type, count) => Math.min(count, SPAWN_CAPS[type] ?? count);

  const spawns = [
    { type: 'pizzarino', count: cap('pizzarino', Math.round(8 * scale)), intervalMs: 380, delayMs: 0 },
    { type: 'spaghetto', count: cap('spaghetto', Math.round(5 * scale)), intervalMs: 350, delayMs: 1200 },
    { type: 'meatballino', count: cap('meatballino', Math.round(4 * scale)), intervalMs: 900, delayMs: 2000 },
  ];
  if (n >= 3) {
    spawns.push({ type: 'saucezilla', count: cap('saucezilla', Math.max(1, Math.round(n / 3))), intervalMs: 1400, delayMs: 2800 });
  }
  if (bossType) {
    spawns.push({ type: bossType, count: cap(bossType, Math.floor(n / 4)), intervalMs: 1500, delayMs: 500 });
  }

  return { spawns, hpScale: scale }; // GameScene multiplies enemy HP by this for endless waves
}
