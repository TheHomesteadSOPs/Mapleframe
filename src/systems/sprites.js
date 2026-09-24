// ─────────────────────────────────────────────────────────────
//  Real-art loader with a placeholder fallback.
//
//  BootScene tries to load every PNG in ART_KEYS from
//  /public/assets/td/<key>.png. Any that don't exist yet (art
//  pipeline hasn't produced them) fail silently and the game
//  falls back to a generated placeholder circle in that entity's
//  brand colour — so the game is playable before any art exists,
//  and upgrades automatically once real PNGs land in that folder.
// ─────────────────────────────────────────────────────────────
import { TOWER_DEFS, ENEMY_DEFS } from '../data/towerDefense.js';

export const ART_KEYS = [
  ...Object.values(TOWER_DEFS).map((d) => d.sprite),
  ...Object.values(ENEMY_DEFS).map((d) => d.sprite),
  'h01_nonna',
];

const failed = new Set();

export function registerLoadFailure(key) { failed.add(key); }

/** True once BootScene has attempted the load and the file was found. */
export function hasArt(scene, key) {
  return !failed.has(key) && scene.textures.exists(key);
}

/** Returns the real texture key if available, else the placeholder key. */
export function textureFor(scene, key, placeholderKey) {
  return hasArt(scene, key) ? key : placeholderKey;
}
