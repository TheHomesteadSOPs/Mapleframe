// ─────────────────────────────────────────────────────────────
//  Meta upgrade system — permanent, persists across runs, bought
//  with coins earned from waves (converted from in-run gold at
//  Game Over). This is the "idle" progression loop.
//
//    upgrades.level('startGold')     → current level
//    upgrades.value('startGold')     → effective stat value
//    upgrades.cost('startGold')      → coins for next level
//    upgrades.buy('startGold')       → true if purchased
// ─────────────────────────────────────────────────────────────
import { save } from './save.js';

export const UPGRADE_DEFS = {
  startGold: {
    label: 'Pantry Stock',
    desc: '+10 starting gold per run',
    base: 15, growth: 1.55, max: 10,
    value: (lvl) => 40 + lvl * 10,
  },
  towerDamage: {
    label: "Nonna's Recipe",
    desc: '+8% tower damage',
    base: 30, growth: 1.7, max: 12,
    value: (lvl) => 1 + lvl * 0.08,
  },
  extraLife: {
    label: 'Extra Helping',
    desc: 'Start with one more life',
    base: 80, growth: 2.4, max: 5,
    value: (lvl) => 3 + lvl,
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
