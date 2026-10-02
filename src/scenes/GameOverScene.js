import * as Phaser from 'phaser';
import { GAME } from '../config.js';
import { platform } from '../platform/index.js';
import { save } from '../systems/save.js';
import { sfx } from '../systems/sfx.js';
import { button, textStyle, fmt, panel, burst, coinText } from '../ui/widgets.js';
import { hasArt, MENU_BG_KEY } from '../systems/sprites.js';

/**
 * End-of-run screen. Shows the two ad placements every game uses:
 *  • Rewarded: "Double coins" — player chooses to watch.
 *  • Midgame:  shown on "Play again" (platform enforces cooldown).
 */
export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create({ waveReached = 0, coins = 0, newBest = false }) {
    sfx.setMusicTheme("menu");
    const { width: W, height: H } = this.scale;
    if (hasArt(this, MENU_BG_KEY)) {
      const bg = this.add.image(W / 2, H / 2, MENU_BG_KEY);
      bg.setScale(Math.max(W / bg.width, H / bg.height));
      this.add.rectangle(W / 2, H / 2, W, H, 0x10141c, 0.62);
    }
    panel(this, W / 2, H / 2, 640, 520);

    this.add.text(W / 2, H / 2 - 200, newBest ? 'NEW BEST!' : 'THE KITCHEN WAS OVERRUN!',
      textStyle(newBest ? 56 : 34, newBest ? GAME.colors.gold : GAME.colors.cream)).setOrigin(0.5);
    this.add.text(W / 2, H / 2 - 130, `Reached wave ${fmt(waveReached)}`, textStyle(36)).setOrigin(0.5);
    const coinLine = coinText(this, W / 2, H / 2 - 80, 32, GAME.colors.gold, 0.5).setText(`+${fmt(coins)} coins`);

    const dbl = button(this, W / 2, H / 2 + 10, 'Watch ad: double coins', async () => {
      dbl.setEnabled(false);
      const ok = await platform.showRewardedAd();
      if (ok) {
        save.data.coins += coins;
        save.write();
        coinLine.setText(`+${fmt(coins * 2)} coins  (x2!)`);
        sfx.play('upgrade');
        burst(this, W / 2, H / 2 - 80, GAME.colors.gold, 24);
        dbl.setLabel('Claimed!');
      } else {
        dbl.setEnabled(true);
      }
    }, { width: 440, fontSize: 28, color: 0x2f8f5b });
    if (coins === 0) dbl.setEnabled(false);

    button(this, W / 2, H / 2 + 110, 'Play again', async () => {
      await platform.showMidgameAd();
      this.scene.start('Game');
    }, { width: 440 });

    button(this, W / 2, H / 2 + 200, 'Menu', () => this.scene.start('Menu'),
      { width: 200, height: 56, fontSize: 24, color: 0x3a4557 });
  }
}
