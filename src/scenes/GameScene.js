import * as Phaser from 'phaser';
import { GAME } from '../config.js';
import { platform } from '../platform/index.js';
import { save } from '../systems/save.js';
import { sfx } from '../systems/sfx.js';
import { upgrades } from '../systems/upgrades.js';
import { textStyle, fmt, floatText, burst, shake } from '../ui/widgets.js';

/**
 * DEMO GAME — "Leaf Catch". Tap falling maple leaves before they
 * hit the ground. It exists only to exercise the template's
 * systems (SDK events, upgrades, save, juice, ads). Replace this
 * scene with Game 1's real core loop.
 */
export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const { width: W, height: H } = this.scale;
    this.score = 0;
    this.coinsEarned = 0;
    this.lives = upgrades.value('extraLife');
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.over = false;

    this.add.rectangle(W / 2, H - 20, W, 40, 0x2b3a2e); // ground
    this.leaves = this.add.group();

    this.scoreText = this.add.text(24, 20, '', textStyle(34)).setDepth(10);
    this.coinText = this.add.text(24, 64, '', textStyle(26, GAME.colors.gold)).setDepth(10);
    this.livesText = this.add.text(W - 24, 20, '', textStyle(34, GAME.colors.maple)).setOrigin(1, 0).setDepth(10);
    this.updateHud();

    platform.gameplayStart();
    this.events.once('shutdown', () => platform.gameplayStop());
  }

  update(_, dtMs) {
    if (this.over) return;
    const dt = dtMs / 1000;
    this.elapsed += dt;
    save.data.stats.playSeconds += dt;

    // Difficulty ramp: faster spawns + faster falling over time.
    const interval = Math.max(0.35, 1.2 - this.elapsed * 0.012);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnLeaf(); this.spawnTimer = interval; }

    const fall = 140 + this.elapsed * 4;
    for (const leaf of this.leaves.getChildren()) {
      leaf.y += fall * leaf.getData('speed') * dt;
      leaf.x += Math.sin(this.elapsed * 2 + leaf.getData('phase')) * 40 * dt;
      leaf.angle += leaf.getData('spin') * dt;
      if (leaf.y > this.scale.height - 40) this.missLeaf(leaf);
    }
  }

  spawnLeaf() {
    const W = this.scale.width;
    const size = upgrades.value('leafSize');
    const golden = Math.random() < 0.08;
    const leaf = this.add.image(Phaser.Math.Between(60, W - 60), -40, 'leaf')
      .setTint(golden ? GAME.colors.gold : GAME.colors.maple)
      .setScale(size * (golden ? 0.9 : 1.1))
      .setInteractive({ useHandCursor: true });
    leaf.setData({ speed: Phaser.Math.FloatBetween(0.8, 1.3), phase: Math.random() * 6, spin: Phaser.Math.Between(-90, 90), golden });
    leaf.on('pointerdown', () => this.catchLeaf(leaf));
    this.leaves.add(leaf);
  }

  catchLeaf(leaf) {
    if (this.over) return;
    const golden = leaf.getData('golden');
    const coins = upgrades.value('coinValue') * (golden ? 5 : 1);
    this.score += golden ? 5 : 1;
    this.coinsEarned += coins;
    sfx.play('coin');
    burst(this, leaf.x, leaf.y, golden ? GAME.colors.gold : GAME.colors.maple);
    floatText(this, leaf.x, leaf.y, `+${fmt(coins)}`);
    leaf.destroy();
    this.updateHud();
  }

  missLeaf(leaf) {
    leaf.destroy();
    this.lives -= 1;
    sfx.play('hit');
    shake(this);
    this.cameras.main.flash(120, 120, 20, 20);
    this.updateHud();
    if (this.lives <= 0) this.endRun();
  }

  endRun() {
    this.over = true;
    sfx.play('lose');
    platform.gameplayStop();

    const d = save.data;
    d.coins += this.coinsEarned;
    d.stats.runs += 1;
    const newBest = this.score > d.bestScore;
    if (newBest) { d.bestScore = this.score; platform.happyTime(); }
    save.write();

    this.time.delayedCall(700, () =>
      this.scene.start('GameOver', { score: this.score, coins: this.coinsEarned, newBest }));
  }

  updateHud() {
    this.scoreText.setText(`Score ${fmt(this.score)}`);
    this.coinText.setText(`🪙 +${fmt(this.coinsEarned)}`);
    this.livesText.setText('♥'.repeat(Math.max(0, this.lives)));
  }
}
