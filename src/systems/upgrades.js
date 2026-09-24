// ─────────────────────────────────────────────────────────────
//  Upgrade system — the backbone of idle / launch / survivor games.
//
//  Define upgrades as data. Cost grows exponentially per level
//  (the standard idle-game curve), value grows linearly or
//  multiplicatively — tune `growth` and `step` per upgrade.
//
//    upgrades.level('leafSize')     → current level
//    upgrades.value('leafSize')     → effective stat value
//    upgrades.cost('leafSize')      → coins for next level
//    upgrades.buy('leafSize')       → true if purchased
// ─────────────────────────────────────────────────────────────
import { save } from './save.js';

export const UPGRADE_DEFS = {
  leafSize: {
    label: 'Bigger Leaves',
    desc: 'Leaves are easier to tap',
    base: 10, growth: 1.6, max: 10,
    value: (lvl) => 1 + lvl * 0.12,          // size multiplier
  },
  coinValue: {
    label: 'Golden Touch',
    desc: '+1 coin per leaf',
    base: 25, growth: 1.8, max: 20,
    value: (lvl) => 1 + lvl,                  // coins per leaf
  },
  extraLife: {
    label: 'Extra Life',
    desc: 'Start with one more life',
    base: 60, growth: 2.5, max: 3,
    value: (lvl) => 3 + lvl,                  // starting lives
  },
};

export const upgrades = {
  level(id) { return save.data.upgrades[id] ?? 0; },
  isMaxed(id) { return this.level(id) >= UPGRADE_DEFS[id].max; },
  value(id) { return UPGRADE_DEFS[id].value(this.level(id)); },
  cost(id) {
    const d = UPGRADE_DEFS[id];
    return Math.ceil(d.base * Math.pow(d.growth, this.level(id)));
  },
  canBuy(id) { return !this.isMaxed(id) && save.data.coins >= this.cost(id); },
  buy(id) {
    if (!this.canBuy(id)) return false;
    save.data.coins -= this.cost(id);
    save.data.upgrades[id] = this.level(id) + 1;
    save.write();
    return true;
  },
};
