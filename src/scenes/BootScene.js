import * as Phaser from 'phaser';
import { GAME } from '../config.js';
import { platform } from '../platform/index.js';
import { save } from '../systems/save.js';
import { sfx } from '../systems/sfx.js';
import { textStyle } from '../ui/widgets.js';

/**
 * Loads assets, generates placeholder textures, restores the save,
 * then tells the portal loading is done.
 *
 * Real art: put files in /public/assets and load them in preload(),
 * e.g. this.load.image('hero', 'assets/hero.png');
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
    // this.load.image(...) etc. go here.
  }

  create() {
    this.makeTextures();
    save.load();
    sfx.setMuted(save.data.settings.muted);
    platform.loadingFinished();
    this.scene.start('Menu');
  }

  /** Placeholder art drawn in code — replace with real sprites later. */
  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // 'dot' — used by particle bursts
    g.fillStyle(0xffffff).fillCircle(8, 8, 8);
    g.generateTexture('dot', 16, 16);
    g.clear();

    // 'leaf' — a simple stylised maple leaf (demo game sprite)
    const s = 64;
    g.fillStyle(0xffffff);
    const pts = [];
    const spikes = [0, 0.9, 0.55, 1, 0.55, 0.9, 0, 0.35, 0.2, 0.35];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = (s / 2 - 2) * (0.45 + 0.55 * spikes[i]);
      pts.push(new Phaser.Math.Vector2(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r));
    }
    g.fillPoints(pts, true);
    g.fillRect(s / 2 - 3, s / 2, 6, s / 2 - 2); // stem
    g.generateTexture('leaf', s, s);
    g.destroy();
  }
}
