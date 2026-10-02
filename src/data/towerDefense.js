// ─────────────────────────────────────────────────────────────
//  Game 1 data: the path, tower slots, tower/enemy stats, and
//  waves. All tuning lives here — GameScene.js just reads it.
// ─────────────────────────────────────────────────────────────

// The lane enemies walk, in logical 1280×720 space. These are control
// points that trace the winding tile path painted into the board art
// (b01_kitchen_board.jpg, drawn at 0.8× so source row 287 sits at y=0);
// GameScene smooths them into a curve so enemies follow the painted tiles.
// The right-hand strip (x > ~1150) is reserved for the tower tray.
export const PATH = [
  { x: -32, y: 690 },
  { x: 48, y: 642 },
  { x: 176, y: 578 },
  { x: 304, y: 521 },
  { x: 432, y: 510 },
  { x: 560, y: 558 },
  { x: 688, y: 578 },
  { x: 768, y: 540 },
  { x: 800, y: 478 },
  { x: 768, y: 406 },
  { x: 708, y: 348 },
  { x: 640, y: 290 },
  { x: 560, y: 242 },
  { x: 480, y: 206 },
  { x: 416, y: 162 },
  { x: 424, y: 110 },
  { x: 496, y: 74 },
  { x: 592, y: 90 },
  { x: 696, y: 146 },
  { x: 792, y: 170 },
  { x: 832, y: 122 },
  { x: 880, y: 78 },
  { x: 948, y: 65 },
];

// Buildable pads on the open floor beside the lane. Each holds one tower.
// All are within reach of the starter towers.
export const TOWER_SLOTS = [
  { x: 330, y: 445 },
  { x: 560, y: 350 },
  { x: 690, y: 470 },
  { x: 895, y: 345 },
  { x: 880, y: 262 },
  { x: 320, y: 170 },
  { x: 560, y: 655 },
  { x: 830, y: 625 },
  { x: 940, y: 480 },
  { x: 965, y: 185 },
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

/** Gold bonus for clearing a wave — keeps the economy ahead of the curve. */
export const waveClearBonus = (waveNumber) => 12 + waveNumber * 3;

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

  // ── Elites (from wave 20) — each one asks a different question of the
  // defense. They aren't bosses, but leaking one costs 2 lives.
  // garlico: heavy armor shrugs off weak/rapid hits (Blender, Rolling Pin).
  garlico: {
    label: 'Garlico Knight', blurb: 'Heavy armor — weak hits barely scratch it', sprite: 'e08_garlico', color: 0xa78bd4,
    hp: 420, speed: 46, armor: 9, reward: 40, radius: 36, elite: true, leak: 2,
  },
  // cannolo: periodically bursts forward, slipping past slow, high-wind-up towers.
  cannolo: {
    label: 'Cannolo Dasher', blurb: 'Dashes forward in sudden bursts', sprite: 'e09_cannolo', color: 0xe8912d,
    hp: 150, speed: 80, armor: 0, reward: 24, radius: 34, elite: true, leak: 2,
    dash: { every: 3200, duration: 900, mult: 2.8 },
  },
  // tiramisu: heals every enemy near it — kill the medic first.
  tiramisu: {
    label: 'Tiramisu Medic', blurb: 'Heals nearby enemies — focus it down', sprite: 'e10_tiramisu', color: 0xe0699a,
    hp: 260, speed: 56, armor: 1, reward: 45, radius: 30, elite: true, leak: 2,
    heal: { radius: 170, pctPerSec: 0.07 },
  },
  // gelato: its chill slows the fire rate of every tower within reach.
  gelato: {
    label: 'Gelato Frostling', blurb: 'Chills towers nearby, slowing their fire rate', sprite: 'e11_gelato', color: 0x5ed3f0,
    hp: 300, speed: 62, armor: 2, reward: 45, radius: 34, elite: true, leak: 2,
    chill: { radius: 175, slow: 0.45 },
  },
  // prosciutto: slippery — a chunk of shots simply miss it.
  prosciutto: {
    label: 'Prosciutto Phantom', blurb: 'Slippery — many shots miss it', sprite: 'e12_prosciutto', color: 0xb8b4ee,
    hp: 210, speed: 84, armor: 0, reward: 32, radius: 34, elite: true, leak: 2,
    evade: 0.38,
  },
};

// ── Waves ───────────────────────────────────────────────────
// spawns: list of { type, count, intervalMs, delayMs }. delayMs is the
// gap before this group starts spawning, relative to the wave start.
export const WAVES = [
  { spawns: [{ type: 'pizzarino', count: 5, intervalMs: 1100, delayMs: 0 }] },
  { spawns: [{ type: 'pizzarino', count: 7, intervalMs: 800, delayMs: 0 }] },
  { spawns: [{ type: 'pizzarino', count: 6, intervalMs: 650, delayMs: 0 }, { type: 'spaghetto', count: 3, intervalMs: 600, delayMs: 2500 }] },
  { spawns: [{ type: 'meatballino', count: 3, intervalMs: 1400, delayMs: 0 }, { type: 'pizzarino', count: 6, intervalMs: 600, delayMs: 800 }] },
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
const SPAWN_CAPS = { pizzarino: 40, spaghetto: 30, meatballino: 24, saucezilla: 10, parmesano: 6, espresso: 6, garlico: 10, cannolo: 12, tiramisu: 6, gelato: 6, prosciutto: 10 };

// Elite mobs join the rotation at wave 20 (index 19). Two types per wave,
// cycling through all five, so a player meets every one within three waves.
export const ELITE_START_INDEX = 19;
const ELITES = ['garlico', 'cannolo', 'tiramisu', 'gelato', 'prosciutto'];

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
  if (i >= ELITE_START_INDEX) {
    const k = i - ELITE_START_INDEX;
    for (let j = 0; j < 2; j++) {
      const type = ELITES[(k * 2 + j) % ELITES.length];
      const count = cap(type, 2 + Math.floor(k / 2) + (type === 'cannolo' || type === 'prosciutto' ? 2 : 0));
      spawns.push({ type, count, intervalMs: type === 'garlico' ? 1300 : 900, delayMs: 1500 + j * 1200 });
    }
  }
  if (bossType) {
    spawns.push({ type: bossType, count: cap(bossType, Math.floor(n / 4)), intervalMs: 1500, delayMs: 500 });
  }

  return { spawns, hpScale: scale }; // GameScene multiplies enemy HP by this for endless waves
}
