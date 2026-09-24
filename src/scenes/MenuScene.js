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

    this.add.text(W / 2, 90, GAME.title, textStyle(50, GAME.colors.cream)).setOrigin(0.5);
    this.add.text(W / 2, 140, `by ${GAME.studio}`, textStyle(22, GAME.colors.muted)).setOrigin(0.5);

    this.coinText = this.add.text(W / 2, 195, '', textStyle(30, GAME.colors.gold)).setOrigin(0.5);
    this.add.text(W / 2, 230, `Best wave: ${save.data.bestWave}`, textStyle(20, GAME.colors.muted)).setOrigin(0.5);

    button(this, W / 2, 310, '▶  DEFEND THE KITCHEN', () => this.scene.start('Game'),
      { width: 420, height: 78, fontSize: 32 });

    this.add.text(W / 2, 400, "Nonna's Pantry — permanent upgrades", textStyle(20, GAME.colors.muted)).setOrigin(0.5);
    panel(this, W / 2, 560, 1080, 220);
    this.shop = Object.keys(UPGRADE_DEFS).map((id, i) => {
      const x = W / 2 - 350 + i * 350;
      this.add.text(x, 480, UPGRADE_DEFS[id].label, textStyle(24)).setOrigin(0.5);
      const lvl = this.add.text(x, 512, '', textStyle(18, GAME.colors.muted)).setOrigin(0.5, 0.5).setWordWrapWidth(300, true);
      const btn = button(this, x, 610, '', () => {
        if (upgrades.buy(id)) { sfx.play('upgrade'); burst(this, x, 610); this.refresh(); }
      }, { width: 260, height: 64, fontSize: 24, color: 0x2f8f5b });
      return { id, lvl, btn };
    });

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
    this.coinText.setText(`🪙 ${fmt(save.data.coins)} pantry coins`);
    for (const { id, lvl, btn } of this.shop) {
      lvl.setText(`Lv ${upgrades.level(id)} · ${UPGRADE_DEFS[id].desc}`);
      if (upgrades.isMaxed(id)) btn.setLabel('MAX').setEnabled(false);
      else btn.setLabel(`🪙 ${fmt(upgrades.cost(id))}`).setEnabled(upgrades.canBuy(id));
    }
  }

  drawBackdrop(W, H) {
    for (let i = 0; i < 10; i++) {
      const dot = this.add.circle(Phaser.Math.Between(0, W), Phaser.Math.Between(-H, H), Phaser.Math.Between(4, 9), GAME.colors.maple, 0.12);
      this.tweens.add({
        targets: dot, y: H + 40, duration: Phaser.Math.Between(9000, 16000),
        repeat: -1, onRepeat: () => { dot.y = -40; dot.x = Phaser.Math.Between(0, W); },
      });
    }
  }
}
