import * as Phaser from 'phaser';
import { GAME } from '../config.js';
import { platform } from '../platform/index.js';
import { save } from '../systems/save.js';
import { sfx } from '../systems/sfx.js';
import { textStyle } from '../ui/widgets.js';
import { ART_KEYS, registerLoadFailure } from '../systems/sprites.js';
import { TOWER_DEFS, ENEMY_DEFS } from '../data/towerDefense.js';

/**
 * Loads real art (if present in /public/assets/td/), generates
 * placeholder textures for anything missing, restores the save,
 * then tells the portal loading is done.
 */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add.graphics();
    this.add.text(width / 2, height / 2 - 50, GAME.studio, textStyle(28, GAME.colors.muted)).setOrigin(0.5);
    this.load.on('progress', (p) => {
      bar.clear().fillStyle(GAME.colors.maple).fillRect(width / 2 - 200, height / 2, 400 * p, 12);
    });

    // Real art — any of these that 404 just fail quietly; see sprites.js.
    this.load.on('loaderror', (file) => registerLoadFailure(file.key));
    for (const key of ART_KEYS) this.load.image(key, `assets/td/${key}.png`);
  }

  create() {
    this.makeTextures();
    save.load();
    sfx.setMuted(save.data.settings.muted);
    platform.loadingFinished();
    this.scene.start('Menu');
  }

  /** Placeholder art (colour-coded circles) — used until real art loads. */
  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // 'dot' — used by particle bursts
    g.fillStyle(0xffffff).fillCircle(8, 8, 8);
    g.generateTexture('dot', 16, 16);
    g.clear();

    // Enemy placeholders: filled circle + darker ring, sized by radius.
    for (const [id, d] of Object.entries(ENEMY_DEFS)) {
      const r = d.radius;
      const s = r * 2 + 8;
      g.fillStyle(d.color).fillCircle(s / 2, s / 2, r);
      g.lineStyle(4, 0x000000, 0.35).strokeCircle(s / 2, s / 2, r);
      g.generateTexture(`ph_${d.sprite}`, s, s);
      g.clear();
    }

    // Tower placeholders: rounded square in brand colour.
    for (const [id, d] of Object.entries(TOWER_DEFS)) {
      const s = 72;
      g.fillStyle(0x000000, 0.25).fillRoundedRect(4, 8, s - 8, s - 8, 14);
      g.fillStyle(d.color).fillRoundedRect(0, 0, s - 8, s - 8, 14);
      g.generateTexture(`ph_${d.sprite}`, s, s);
      g.clear();
    }

    // Nonna placeholder.
    g.fillStyle(GAME.colors.maple).fillCircle(40, 40, 38);
    g.lineStyle(5, 0xffffff, 0.8).strokeCircle(40, 40, 38);
    g.generateTexture('ph_h01_nonna', 80, 80);
    g.clear();

    // Projectile.
    g.fillStyle(GAME.colors.gold).fillCircle(6, 6, 6);
    g.generateTexture('projectile', 12, 12);
    g.destroy();
  }
}
