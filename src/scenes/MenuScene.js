import * as Phaser from 'phaser';
import { GAME } from '../config.js';
import { save } from '../systems/save.js';
import { sfx } from '../systems/sfx.js';
import { upgrades, UPGRADE_DEFS } from '../systems/upgrades.js';
import { button, textStyle, fmt, panel, burst } from '../ui/widgets.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const { width: W, height: H } = this.scale;
    this.drawBackdrop(W, H);

    this.add.text(W / 2, 110, GAME.title, textStyle(64, GAME.colors.cream)).setOrigin(0.5);
    this.add.text(W / 2, 170, `by ${GAME.studio}`, textStyle(24, GAME.colors.muted)).setOrigin(0.5);

    this.coinText = this.add.text(W / 2, 230, '', textStyle(34, GAME.colors.gold)).setOrigin(0.5);
    this.add.text(W / 2, 270, `Best: ${fmt(save.data.bestScore)}`, textStyle(22, GAME.colors.muted)).setOrigin(0.5);

    button(this, W / 2, 360, '▶  PLAY', () => this.scene.start('Game'), { width: 320, height: 84, fontSize: 38 });

    // Upgrade shop — shows the pattern every game in the portfolio will reuse.
    panel(this, W / 2, 560, 1040, 200);
    this.shop = Object.keys(UPGRADE_DEFS).map((id, i) => {
      const x = W / 2 - 340 + i * 340;
      this.add.text(x, 490, UPGRADE_DEFS[id].label, textStyle(24)).setOrigin(0.5);
      const lvl = this.add.text(x, 522, '', textStyle(18, GAME.colors.muted)).setOrigin(0.5);
      const btn = button(this, x, 590, '', () => {
        if (upgrades.buy(id)) { sfx.play('upgrade'); burst(this, x, 590); this.refresh(); }
      }, { width: 260, height: 64, fontSize: 24, color: 0x2f8f5b });
      return { id, lvl, btn };
    });

    // Mute toggle (top-right)
    const mute = this.add.text(W - 30, 30, '', textStyle(34)).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    const setIcon = () => mute.setText(save.data.settings.muted ? '🔇' : '🔊');
    setIcon();
    mute.on('pointerdown', () => {
      save.data.settings.muted = !save.data.settings.muted;
      sfx.setMuted(save.data.settings.muted);
      save.write();
      setIcon();
    });

    this.add.text(20, H - 20, `v${GAME.version}`, textStyle(16, GAME.colors.muted)).setOrigin(0, 1);
    this.refresh();
  }

  refresh() {
    this.coinText.setText(`🪙 ${fmt(save.data.coins)}`);
    for (const { id, lvl, btn } of this.shop) {
      lvl.setText(`Lv ${upgrades.level(id)} · ${UPGRADE_DEFS[id].desc}`);
      if (upgrades.isMaxed(id)) btn.setLabel('MAX').setEnabled(false);
      else btn.setLabel(`🪙 ${fmt(upgrades.cost(id))}`).setEnabled(upgrades.canBuy(id));
    }
  }

  drawBackdrop(W, H) {
    // Drifting leaves in the background — cheap ambient motion.
    for (let i = 0; i < 12; i++) {
      const leaf = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(-H, H), 'leaf')
        .setTint(GAME.colors.maple).setAlpha(0.12).setScale(Phaser.Math.FloatBetween(0.5, 1.2));
      this.tweens.add({
        targets: leaf, y: H + 80, angle: 360, duration: Phaser.Math.Between(9000, 16000),
        repeat: -1, onRepeat: () => { leaf.y = -80; leaf.x = Phaser.Math.Between(0, W); },
      });
    }
  }
}
