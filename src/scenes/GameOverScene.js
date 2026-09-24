import * as Phaser from 'phaser';
import { GAME } from '../config.js';
import { platform } from '../platform/index.js';
import { save } from '../systems/save.js';
import { sfx } from '../systems/sfx.js';
import { button, textStyle, fmt, panel, burst } from '../ui/widgets.js';

/**
 * End-of-run screen. Shows the two ad placements every game uses:
 *  • Rewarded: "Double coins" — player chooses to watch.
 *  • Midgame:  shown on "Play again" (platform enforces cooldown).
 */
export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create({ score = 0, coins = 0, newBest = false }) {
    const { width: W, height: H } = this.scale;
    panel(this, W / 2, H / 2, 640, 520);

    this.add.text(W / 2, H / 2 - 200, newBest ? 'NEW BEST!' : 'GAME OVER',
      textStyle(56, newBest ? GAME.colors.gold : GAME.colors.cream)).setOrigin(0.5);
    this.add.text(W / 2, H / 2 - 130, `Score ${fmt(score)}`, textStyle(36)).setOrigin(0.5);
    const coinLine = this.add.text(W / 2, H / 2 - 80, `🪙 +${fmt(coins)}`, textStyle(32, GAME.colors.gold)).setOrigin(0.5);

    const dbl = button(this, W / 2, H / 2 + 10, '📺  Double coins', async () => {
      dbl.setEnabled(false);
      const ok = await platform.showRewardedAd();
      if (ok) {
        save.data.coins += coins;
        save.write();
        coinLine.setText(`🪙 +${fmt(coins * 2)}  (x2!)`);
        sfx.play('upgrade');
        burst(this, W / 2, H / 2 - 80, GAME.colors.gold, 24);
        dbl.setLabel('Claimed ✓');
      } else {
        dbl.setEnabled(true);
      }
    }, { width: 360, color: 0x2f8f5b });
    if (coins === 0) dbl.setEnabled(false);

    button(this, W / 2, H / 2 + 110, '↻  Play again', async () => {
      await platform.showMidgameAd();
      this.scene.start('Game');
    }, { width: 360 });

    button(this, W / 2, H / 2 + 200, 'Menu', () => this.scene.start('Menu'),
      { width: 200, height: 56, fontSize: 24, color: 0x3a4557 });
  }
}
