import * as Phaser from 'phaser';
import { GAME } from '../config.js';
import { save } from '../systems/save.js';
import { sfx } from '../systems/sfx.js';
import { upgrades, UPGRADE_DEFS } from '../systems/upgrades.js';
import { button, textStyle, fmt, panel, burst, coinText } from '../ui/widgets.js';
import { hasArt, MENU_BG_KEY } from '../systems/sprites.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    sfx.setMusicTheme("menu");
    const { width: W, height: H } = this.scale;
    this.drawBackdrop(W, H);

    const outline = (px) => ({ stroke: '#2a1a10', strokeThickness: Math.round(px / 6) });
    this.add.text(W / 2, 62, GAME.title, textStyle(58, GAME.colors.cream, outline(58))).setOrigin(0.5);
    this.add.text(W / 2, 108, `by ${GAME.studio}`, textStyle(20, GAME.colors.cream, outline(20))).setOrigin(0.5);

    this.coinText = coinText(this, W / 2, 150, 30, GAME.colors.gold, 0.5);
    this.bestText = this.add.text(W / 2, 184, `Best wave: ${save.data.bestWave}`,
      textStyle(20, GAME.colors.cream, outline(20))).setOrigin(0.5);

    button(this, W / 2, 246, 'DEFEND THE KITCHEN', () => this.scene.start('Game'),
      { width: 520, height: 70, fontSize: 32 });

    this.add.text(W / 2, 308, "Nonna's Pantry: permanent upgrades", textStyle(20, GAME.colors.cream, outline(20))).setOrigin(0.5);
    panel(this, W / 2, 514, 1190, 372, 0.88);
    const ids = Object.keys(UPGRADE_DEFS);
    const cols = 4, cw = 284, ch = 166;
    this.shop = ids.map((id, i) => {
      const x = W / 2 - ((cols - 1) * cw) / 2 + (i % cols) * cw;
      const y = 424 + Math.floor(i / cols) * (ch + 8);
      const card = this.add.graphics();
      card.fillStyle(0x2a3243, 0.9).fillRoundedRect(x - 130, y - ch / 2, 260, ch, 14);
      this.add.text(x, y - 58, UPGRADE_DEFS[id].label, textStyle(22)).setOrigin(0.5);
      const lvl = this.add.text(x, y - 18, '', textStyle(15, 0xb5bfd0, { align: 'center', wordWrap: { width: 240 } })).setOrigin(0.5);
      const btn = button(this, x, y + 46, '', () => {
        if (upgrades.buy(id)) { sfx.play('upgrade'); burst(this, x, y + 46); this.refresh(); }
      }, { width: 228, height: 44, fontSize: 18, color: 0x2f8f5b });
      return { id, lvl, btn };
    });

    const mute = this.add.image(W - 30, 30, 'icon_sound_on').setOrigin(1, 0).setInteractive({ useHandCursor: true });
    const setIcon = () => mute.setTexture(save.data.settings.muted ? 'icon_sound_off' : 'icon_sound_on');
    setIcon();
    mute.on('pointerdown', () => {
      save.data.settings.muted = !save.data.settings.muted;
      sfx.setMuted(save.data.settings.muted);
      save.write();
      setIcon();
    });

    this.add.text(20, H - 14, `v${GAME.version}`, textStyle(15, GAME.colors.cream, { stroke: '#2a1a10', strokeThickness: 3 })).setOrigin(0, 1);
    this.refresh();
  }

  refresh() {
    this.coinText.setText(`${fmt(save.data.coins)} pantry coins`);
    for (const { id, lvl, btn } of this.shop) {
      lvl.setText(`Level ${upgrades.level(id)} / ${UPGRADE_DEFS[id].max}\n${UPGRADE_DEFS[id].desc}`);
      if (upgrades.isMaxed(id)) btn.setLabel('MAX').setEnabled(false);
      else btn.setLabel(`Buy: ${fmt(upgrades.cost(id))} coins`).setEnabled(upgrades.canBuy(id));
    }
  }

  drawBackdrop(W, H) {
    if (hasArt(this, MENU_BG_KEY)) {
      const bg = this.add.image(W / 2, H / 2, MENU_BG_KEY);
      bg.setScale(Math.max(W / bg.width, H / bg.height));
      this.add.rectangle(W / 2, H / 2, W, H, 0x10141c, 0.5); // legibility scrim
      return;
    }
    for (let i = 0; i < 10; i++) {
      const dot = this.add.circle(Phaser.Math.Between(0, W), Phaser.Math.Between(-H, H), Phaser.Math.Between(4, 9), GAME.colors.maple, 0.12);
      this.tweens.add({
        targets: dot, y: H + 40, duration: Phaser.Math.Between(9000, 16000),
        repeat: -1, onRepeat: () => { dot.y = -40; dot.x = Phaser.Math.Between(0, W); },
      });
    }
  }
}
