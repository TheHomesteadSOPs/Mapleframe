// ─────────────────────────────────────────────────────────────
//  Game 2 data: the path, tower slots, tower/enemy stats, and
//  waves. All tuning lives here — GameScene.js just reads it.
//
//  Two mechanics beyond a straight Game-1 reskin:
//   - Geese spawn in real "V" formation squads (lateral offset +
//     a temporal stagger so they visibly fly as a group down the
//     lane — see `formation: 'v'` spawn groups and GameScene's
//     expandSpawnGroup()).
//   - Beavers pause near a built tower and chew it: if not killed
//     in time the tower drops a level (see `chewsTowers` and
//     GameScene's beaver-vs-tower handling).
// ─────────────────────────────────────────────────────────────

// The lane critters walk, in logical 1280×720 space. The HUD reserves
// the top ~100px, so keep waypoints below y=130.
export const PATH = [
  { x: -40, y: 150 },
  { x: 320, y: 150 },
  { x: 320, y: 400 },
  { x: 680, y: 400 },
  { x: 680, y: 140 },
  { x: 1000, y: 140 },
  { x: 1000, y: 500 },
  { x: 1220, y: 500 },
];

// Buildable pads, placed off the lane. Each holds at most one tower.
// Distances verified against PATH (~80-115px, clear of the bottom tray).
export const TOWER_SLOTS = [
  { x: 150, y: 250 },  // ~100px
  { x: 420, y: 280 },  // ~100px
  { x: 420, y: 480 },  // ~80px
  { x: 560, y: 500 },  // ~100px
  { x: 780, y: 240 },  // ~100px
  { x: 900, y: 240 },  // ~100px
  { x: 1080, y: 320 }, // ~80px
  { x: 1120, y: 610 }, // ~110px
];

// ── Towers ──────────────────────────────────────────────────
const LEVEL_MULT = [1, 1.9, 3.2]; // damage & value multiplier at levels 1/2/3
const LEVEL_COST_MULT = [1, 2.2, 4]; // upgrade cost multiplier

export const TOWER_DEFS = {
  bearspray: {
    label: 'Bear Spray',
    desc: 'Cheap, fast, reliable',
    sprite: 't01_bearspray', color: 0x5a8f3d,
    cost: 20, damage: 9, range: 130, fireRateMs: 420, projectileSpeed: 520,
  },
  airhorn: {
    label: 'Air Horn Blaster',
    desc: 'Splash damage',
    sprite: 't02_airhorn', color: 0xf2b134,
    cost: 40, damage: 15, range: 175, fireRateMs: 700, projectileSpeed: 460, splash: 45,
  },
  beartrap: {
    label: 'Bear Trap Launcher',
    desc: 'Long range, big splash',
    sprite: 't03_beartrap', color: 0x8a8f94,
    cost: 60, damage: 28, range: 235, fireRateMs: 1150, projectileSpeed: 340, splash: 75,
  },
  leafblower: {
    label: 'Leaf Blower',
    desc: 'Very rapid fire',
    sprite: 't04_leafblower', color: 0xd9482b,
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
  raccoon: { label: 'Raccoon', sprite: 'e01_raccoon', color: 0x5a5a5a, hp: 18, speed: 95, armor: 0, reward: 3, radius: 24 },
  // Beavers pause near a built tower within CHEW_RANGE and, if not
  // killed within CHEW_DURATION_MS, knock it down a level (see
  // GameScene.updateBeavers()). `chewsTowers` flags which enemy types
  // do this — only beavers, so raccoons/geese never trigger it.
  beaver: { label: 'Beaver', sprite: 'e02_beaver', color: 0x8a5a2c, hp: 70, speed: 48, armor: 2, reward: 8, radius: 28, chewsTowers: true },
  // Geese are always spawned via formation:'v' spawn groups (see WAVES)
  // rather than plain count/interval groups, which is what gives them
  // their lateral offset and the V shape.
  goose: { label: 'Goose', sprite: 'e03_goose', color: 0xe8e2d0, hp: 22, speed: 130, armor: 0, reward: 4, radius: 22 },
  mommabear: { label: 'Momma Bear', sprite: 'e04_mommabear', color: 0x4a3220, hp: 320, speed: 36, armor: 5, reward: 30, radius: 40, boss: true },

  // ── Endless-mode variety (past wave 8) ──
  mamaraccoon: {
    label: 'Mama Raccoon', sprite: 'e05_mamaraccoon', color: 0x6b6b6b,
    hp: 140, speed: 58, armor: 1, reward: 10, radius: 33,
    splitOnDeath: 'kitraccoon', splitCount: 2,
  },
  kitraccoon: { label: 'Kit Raccoon', sprite: 'e06_kitraccoon', color: 0x7a7a7a, hp: 20, speed: 145, armor: 0, reward: 2, radius: 15 },
  bullmoose: {
    label: 'Bull Moose', sprite: 'e07_bullmoose', color: 0x5c4530,
    hp: 230, speed: 74, armor: 3, reward: 35, radius: 37, boss: true,
  },
};

// ── Waves ───────────────────────────────────────────────────
// spawns: list of { type, count, intervalMs, delayMs } for a normal
// group, or { type, formation:'v', count, squadSize, laneSpacing,
// staggerMs, squadGapMs, delayMs } for a goose V-formation group —
// GameScene.expandSpawnGroup() turns either into pendingSpawns entries.
export const WAVES = [
  { spawns: [{ type: 'raccoon', count: 6, intervalMs: 700, delayMs: 0 }] },
  { spawns: [
    { type: 'raccoon', count: 8, intervalMs: 600, delayMs: 0 },
    { type: 'goose', formation: 'v', count: 5, squadSize: 5, laneSpacing: 26, staggerMs: 90, delayMs: 1500 },
  ] },
  { spawns: [{ type: 'beaver', count: 4, intervalMs: 1200, delayMs: 0 }, { type: 'raccoon', count: 6, intervalMs: 500, delayMs: 800 }] },
  { spawns: [{ type: 'goose', formation: 'v', count: 10, squadSize: 5, laneSpacing: 26, staggerMs: 90, squadGapMs: 1800, delayMs: 0 }] },
  { spawns: [
    { type: 'raccoon', count: 10, intervalMs: 450, delayMs: 0 },
    { type: 'beaver', count: 5, intervalMs: 1000, delayMs: 1000 },
    { type: 'goose', formation: 'v', count: 5, squadSize: 5, laneSpacing: 26, staggerMs: 90, delayMs: 2500 },
  ] },
  { spawns: [{ type: 'beaver', count: 9, intervalMs: 750, delayMs: 0 }] },
  { spawns: [
    { type: 'goose', formation: 'v', count: 15, squadSize: 5, laneSpacing: 26, staggerMs: 90, squadGapMs: 1600, delayMs: 0 },
    { type: 'beaver', count: 6, intervalMs: 900, delayMs: 1500 },
  ] },
  { spawns: [{ type: 'mommabear', count: 1, intervalMs: 0, delayMs: 500 }, { type: 'raccoon', count: 12, intervalMs: 400, delayMs: 0 }] },
];

// Per-group spawn caps for endless mode — see Game 1's towerDefense.js
// for why (unbounded counts get rough on low-end phones past wave ~50).
const SPAWN_CAPS = { raccoon: 40, goose: 30, beaver: 24, mamaraccoon: 10, mommabear: 6, bullmoose: 6 };

/**
 * Waves past the scripted list scale up forever (idle-game endless mode).
 * Past wave ~10 this introduces Mama Raccoon (a splitter — killing it
 * spawns 2 Kit Raccoons) and alternates the boss every 4 waves between
 * Momma Bear (slow tank) and Bull Moose (fast bruiser).
 */
export function waveForIndex(i) {
  if (i < WAVES.length) return WAVES[i];
  const n = i - WAVES.length + 1;
  const scale = 1 + n * 0.22;
  const bossWave = n % 4 === 0;
  const bossType = bossWave ? (((n / 4) % 2 === 1) ? 'mommabear' : 'bullmoose') : null;
  const cap = (type, count) => Math.min(count, SPAWN_CAPS[type] ?? count);

  const spawns = [
    { type: 'raccoon', count: cap('raccoon', Math.round(8 * scale)), intervalMs: 380, delayMs: 0 },
    { type: 'beaver', count: cap('beaver', Math.round(4 * scale)), intervalMs: 900, delayMs: 2000 },
    { type: 'goose', formation: 'v', count: cap('goose', Math.round(5 * scale)), squadSize: 5, laneSpacing: 26, staggerMs: 90, squadGapMs: 1600, delayMs: 1200 },
  ];
  if (n >= 3) {
    spawns.push({ type: 'mamaraccoon', count: cap('mamaraccoon', Math.max(1, Math.round(n / 3))), intervalMs: 1400, delayMs: 2800 });
  }
  if (bossType) {
    spawns.push({ type: bossType, count: cap(bossType, Math.floor(n / 4)), intervalMs: 1500, delayMs: 500 });
  }

  return { spawns, hpScale: scale }; // GameScene multiplies enemy HP by this for endless waves
}
