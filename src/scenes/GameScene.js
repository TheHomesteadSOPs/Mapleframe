import * as Phaser from 'phaser';
import { GAME } from '../config.js';
import { platform } from '../platform/index.js';
import { save } from '../systems/save.js';
import { sfx } from '../systems/sfx.js';
import { upgrades } from '../systems/upgrades.js';
import { textureFor } from '../systems/sprites.js';
import { textStyle, fmt, floatText, burst, shake, button } from '../ui/widgets.js';
import { PATH, TOWER_SLOTS, TOWER_DEFS, ENEMY_DEFS, towerStatsAtLevel, upgradeCost, MAX_TOWER_LEVEL, waveForIndex } from '../data/towerDefense.js';

const NEXT_WAVE_DELAY_MS = 6000;
const SPEED_STEPS = [1, 2, 3];
const TOWER_DISPLAY_SIZE = 75; // 60px base * 1.25 — Ian wanted towers ~25% bigger
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const { width: W, height: H } = this.scale;

    // ── Run state ──────────────────────────────────────────
    this.gold = upgrades.value('startGold');
    this.lives = upgrades.value('extraLife');
    this.maxLives = this.lives;
    this.waveIndex = 0;
    this.waveActive = false;
    this.nextWaveAt = 0;
    this.selectedTowerType = null;
    this.enemies = [];       // plain objects, see spawnEnemy()
    this.projectiles = [];   // plain objects, see fire()
    this.slots = [];         // { x, y, zone, built: null|{type,level}, art, pips }
    this.over = false;
    this.dmgMult = upgrades.value('towerDamage');
    this.speedMult = 1;    // player-controlled game-speed multiplier (see buildHud)
    this.gameNow = 0;      // internal clock that respects speedMult (this.time.now doesn't)

    this.precomputePath();
    this.drawBoard(W, H);
    this.buildSlots();
    this.buildHud(W);
    this.buildTray(W, H);
    this.buildTutorialHint(W, H);

    platform.gameplayStart();
    this.events.once('shutdown', () => platform.gameplayStop());

    this.scheduleNextWave(1500);
    this.refreshHud();
  }

  // ── Path helpers ───────────────────────────────────────────
  precomputePath() {
    this.segLengths = [];
    this.totalLength = 0;
    for (let i = 0; i < PATH.length - 1; i++) {
      const a = PATH[i], b = PATH[i + 1];
      const len = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      this.segLengths.push(len);
      this.totalLength += len;
    }
  }

  posAtDistance(dist) {
    let d = Phaser.Math.Clamp(dist, 0, this.totalLength);
    for (let i = 0; i < this.segLengths.length; i++) {
      const len = this.segLengths[i];
      if (d <= len || i === this.segLengths.length - 1) {
        const a = PATH[i], b = PATH[i + 1];
        const t = len === 0 ? 0 : d / len;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      d -= len;
    }
    return PATH[PATH.length - 1];
  }

  // ── Visuals ─────────────────────────────────────────────
  drawBoard(W, H) {
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b2016).setDepth(-20);
    // Subtle counter-tile texture: alternating stripes.
    const tiles = this.add.graphics().setDepth(-19);
    tiles.fillStyle(0x2f2419, 1);
    for (let x = 0; x < W; x += 64) tiles.fillRect(x, 0, 32, H);

    const g = this.add.graphics().setDepth(-10);
    g.lineStyle(46, 0x1c140d, 1);
    this.strokePath(g);
    g.lineStyle(34, 0xd9b98a, 1);
    this.strokePath(g);
    g.lineStyle(3, 0xc9a679, 0.6);
    this.strokePath(g);

    // Door marker at the start.
    this.add.circle(PATH[0].x + 40, PATH[0].y, 26, 0x000000, 0.3).setDepth(-9);

    // Nonna at the end.
    const end = PATH[PATH.length - 1];
    const nonnaKey = textureFor(this, 'h01_nonna', 'ph_h01_nonna');
    this.nonna = this.add.image(end.x - 10, end.y, nonnaKey).setDepth(5);
    this.nonna.setScale(Math.min(1, 90 / this.nonna.width));
  }

  strokePath(g) {
    g.beginPath();
    g.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i++) g.lineTo(PATH[i].x, PATH[i].y);
    g.strokePath();
  }

  buildSlots() {
    for (const pos of TOWER_SLOTS) {
      const zone = this.add.circle(pos.x, pos.y, 34, 0xffffff, 0.06)
        .setStrokeStyle(2, 0xffffff, 0.25).setDepth(2).setInteractive({ useHandCursor: true });
      const slot = { x: pos.x, y: pos.y, zone, built: null, art: null, pips: null };
      zone.on('pointerdown', () => this.onSlotTapped(slot));
      this.slots.push(slot);
    }
  }

  buildHud(W) {
    this.goldText = this.add.text(24, 20, '', textStyle(30, GAME.colors.gold)).setDepth(20);
    this.livesText = this.add.text(24, 58, '', textStyle(24, GAME.colors.maple)).setDepth(20);
    this.waveText = this.add.text(W / 2, 24, '', textStyle(30, GAME.colors.cream)).setOrigin(0.5, 0).setDepth(20);
    this.waveBanner = this.add.text(W / 2, 100, '', textStyle(26, GAME.colors.gold))
      .setOrigin(0.5).setDepth(20);

    const mute = this.add.text(W - 24, 20, '', textStyle(30)).setOrigin(1, 0)
      .setInteractive({ useHandCursor: true }).setDepth(20);
    const setIcon = () => mute.setText(save.data.settings.muted ? '🔇' : '🔊');
    setIcon();
    mute.on('pointerdown', () => {
      save.data.settings.muted = !save.data.settings.muted;
      sfx.setMuted(save.data.settings.muted);
      save.write();
      setIcon();
    });

    // Speed toggle — cycles 1x → 2x → 3x → 1x, speeds up enemies/towers/
    // waves together so the whole run just plays out faster.
    this.speedBtn = button(this, W - 76, 72, '1x ⏩', () => {
      const i = SPEED_STEPS.indexOf(this.speedMult);
      this.speedMult = SPEED_STEPS[(i + 1) % SPEED_STEPS.length];
      this.speedBtn.setLabel(`${this.speedMult}x ⏩`);
    }, { width: 96, height: 44, fontSize: 22, color: GAME.colors.panel });
  }

  buildTray(W, H) {
    const ids = Object.keys(TOWER_DEFS);
    const y = H - 56;
    const spacing = 148;
    const startX = W / 2 - ((ids.length - 1) * spacing) / 2;
    this.trayButtons = {};
    ids.forEach((id, i) => {
      const def = TOWER_DEFS[id];
      const x = startX + i * spacing;
      const c = this.add.container(x, y).setDepth(20);
      const bg = this.add.graphics();
      const drawBg = (selected) => {
        bg.clear();
        bg.fillStyle(0x000000, 0.4).fillRoundedRect(-64, -38, 128, 76, 14);
        bg.fillStyle(selected ? 0x2f8f5b : GAME.colors.panel, 1).fillRoundedRect(-64, -42, 128, 76, 14);
        if (selected) bg.lineStyle(3, GAME.colors.gold, 1).strokeRoundedRect(-64, -42, 128, 76, 14);
      };
      drawBg(false);
      const icon = this.add.image(0, -12, textureFor(this, def.sprite, `ph_${def.sprite}`)).setScale(0.5);
      const cost = this.add.text(0, 22, `🪙${def.cost}`, textStyle(18, GAME.colors.cream)).setOrigin(0.5);
      c.add([bg, icon, cost]);
      c.setSize(128, 84);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        sfx.play('click');
        this.selectedTowerType = this.selectedTowerType === id ? null : id;
        for (const bid of ids) this.trayButtons[bid].drawBg(this.trayButtons[bid].id === this.selectedTowerType);
      });
      this.trayButtons[id] = { drawBg, id, cost };
    });
  }

  /** One-time nudge for first-time players: tap a tower, then tap a pad.
   *  Shown once ever (tracked in save data), dismissed on first tower
   *  build or automatically after a few seconds either way. */
  buildTutorialHint(W, H) {
    if (save.data.settings.tutorialSeen) return;
    this.tutorialHint = this.add.text(W / 2, H - 130,
      '👆 Tap a tower below, then tap a glowing pad to build it',
      textStyle(20, GAME.colors.cream, { backgroundColor: '#000000aa', padding: { x: 14, y: 8 } }))
      .setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: this.tutorialHint, y: H - 140, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.delayedCall(6000, () => this.dismissTutorialHint());
  }

  dismissTutorialHint() {
    if (!this.tutorialHint) return;
    this.tweens.add({
      targets: this.tutorialHint, alpha: 0, duration: 300,
      onComplete: () => { this.tutorialHint?.destroy(); this.tutorialHint = null; },
    });
    if (!save.data.settings.tutorialSeen) {
      save.data.settings.tutorialSeen = true;
      save.write();
    }
  }

  // ── Interaction ─────────────────────────────────────────
  onSlotTapped(slot) {
    if (this.over) return;
    if (!slot.built) {
      if (!this.selectedTowerType) return;
      const def = TOWER_DEFS[this.selectedTowerType];
      if (this.gold < def.cost) { this.flashNoGold(slot); return; }
      this.gold -= def.cost;
      slot.built = { type: this.selectedTowerType, level: 1, cooldown: 0 };
      const key = textureFor(this, def.sprite, `ph_${def.sprite}`);
      slot.art = this.add.image(slot.x, slot.y, key).setDepth(3);
      slot.art.setScale(Math.min(1, TOWER_DISPLAY_SIZE / slot.art.width));
      slot.pips = this.add.text(slot.x, slot.y + 40, '', textStyle(13, GAME.colors.gold)).setOrigin(0.5).setDepth(3);
      this.updateSlotInfo(slot);
      sfx.play('upgrade');
      burst(this, slot.x, slot.y, def.color, 10);
      this.dismissTutorialHint();
      this.refreshHud();
    } else {
      const { type, level } = slot.built;
      const cost = upgradeCost(type, level);
      if (cost == null) { floatText(this, slot.x, slot.y - 40, 'MAX', GAME.colors.muted, 22); return; }
      if (this.gold < cost) { this.flashNoGold(slot); return; }
      this.gold -= cost;
      slot.built.level += 1;
      slot.art.setScale(slot.art.scale * 1.12);
      this.updateSlotInfo(slot);
      sfx.play('upgrade');
      burst(this, slot.x, slot.y, GAME.colors.gold, 16);
      this.refreshHud();
    }
  }

  /** Keeps each built tower's level dots + next-upgrade cost visible and
   *  colour-coded (white = affordable, red = can't afford yet, gold = maxed)
   *  so players always know what an upgrade tap will cost. */
  updateSlotInfo(slot) {
    if (!slot.built || !slot.pips) return;
    const { type, level } = slot.built;
    const dots = '●'.repeat(level);
    const cost = upgradeCost(type, level);
    if (cost == null) {
      slot.pips.setText(`${dots} MAX`).setColor(hex(GAME.colors.gold));
    } else {
      const afford = this.gold >= cost;
      slot.pips.setText(`${dots} ⬆${fmt(cost)}`).setColor(hex(afford ? GAME.colors.cream : GAME.colors.maple));
    }
  }

  flashNoGold(slot) {
    sfx.play('hit');
    floatText(this, slot.x, slot.y - 40, 'Need gold', GAME.colors.muted, 20);
  }

  // ── Waves ───────────────────────────────────────────────
  scheduleNextWave(delayMs = NEXT_WAVE_DELAY_MS) {
    this.waveActive = false;
    this.nextWaveAt = this.gameNow + delayMs;
    this.waveBanner.setText(`Next wave in ${Math.ceil(delayMs / 1000)}s`);
  }

  startWave() {
    this.waveActive = true;
    this.waveBanner.setText('');
    const wave = waveForIndex(this.waveIndex);
    this.hpScale = wave.hpScale ?? 1;
    this.pendingSpawns = [];
    for (const group of wave.spawns) {
      for (let i = 0; i < group.count; i++) {
        this.pendingSpawns.push({ at: this.gameNow + group.delayMs + i * group.intervalMs, type: group.type });
      }
    }
    this.pendingSpawns.sort((a, b) => a.at - b.at);
    this.enemiesRemaining = this.pendingSpawns.length;
    this.waveIndex += 1;
    this.refreshHud();
  }

  /** atDistance lets splits (Saucezilla → Saucelings) spawn where the
   *  parent died instead of back at the start of the lane. */
  spawnEnemy(type, { atDistance = 0 } = {}) {
    const def = ENEMY_DEFS[type];
    const pos = this.posAtDistance(atDistance);
    const key = textureFor(this, def.sprite, `ph_${def.sprite}`);
    const sprite = this.add.image(pos.x, pos.y, key).setDepth(4);
    sprite.setScale(Math.min(1, (def.radius * 2) / sprite.width));
    const hpBar = this.add.graphics().setDepth(5);
    const hp = Math.round(def.hp * this.hpScale);
    this.enemies.push({
      type, def, sprite, hpBar, hp, maxHp: hp, distance: atDistance,
      speed: def.speed, radius: def.radius, alive: true,
    });
  }

  // ── Combat ──────────────────────────────────────────────
  fireFrom(slot, dtMs) {
    const stats = towerStatsAtLevel(slot.built.type, slot.built.level);
    slot.built.cooldown -= dtMs;
    if (slot.built.cooldown > 0) return;

    let target = null, bestDist = -1;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Phaser.Math.Distance.Between(slot.x, slot.y, e.sprite.x, e.sprite.y);
      if (d <= stats.range && e.distance > bestDist) { target = e; bestDist = e.distance; }
    }
    if (!target) return;

    slot.built.cooldown = stats.fireRateMs;
    const p = this.add.image(slot.x, slot.y, 'projectile').setDepth(6);
    this.projectiles.push({
      sprite: p, target, speed: TOWER_DEFS[slot.built.type].projectileSpeed,
      damage: Math.round(stats.damage * this.dmgMult), splash: stats.splash,
    });
  }

  damageEnemy(e, amount) {
    const dealt = Math.max(1, amount - e.def.armor);
    e.hp -= dealt;
    if (e.hp <= 0 && e.alive) this.killEnemy(e);
  }

  killEnemy(e) {
    e.alive = false;
    this.gold += e.def.reward;
    this.wavesScoreAdd(e.def.reward);
    burst(this, e.sprite.x, e.sprite.y, e.def.color, 12);
    sfx.play('coin');
    const atDistance = e.distance;
    e.sprite.destroy(); e.hpBar.destroy();
    if (e.def.splitOnDeath) {
      for (let i = 0; i < (e.def.splitCount ?? 1); i++) {
        this.spawnEnemy(e.def.splitOnDeath, { atDistance });
      }
    }
    this.refreshHud();
  }

  wavesScoreAdd(gold) { this.runGold = (this.runGold ?? 0) + gold; }

  // ── Main loop ───────────────────────────────────────────
  update(_, dtMsRaw) {
    if (this.over) return;
    const dtMs = dtMsRaw * this.speedMult;
    this.gameNow += dtMs;

    if (!this.waveActive) {
      const remain = Math.max(0, this.nextWaveAt - this.gameNow);
      this.waveBanner.setText(`Next wave in ${Math.ceil(remain / 1000)}s`);
      if (remain <= 0) this.startWave();
    } else {
      while (this.pendingSpawns.length && this.pendingSpawns[0].at <= this.gameNow) {
        this.spawnEnemy(this.pendingSpawns.shift().type);
      }
      if (!this.pendingSpawns.length && this.enemies.every((e) => !e.alive)) {
        this.enemies = [];
        this.scheduleNextWave();
      }
    }

    // Enemies advance + reach-end check.
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.distance += e.speed * (dtMs / 1000);
      if (e.distance >= this.totalLength) { this.enemyReachedEnd(e); continue; }
      const pos = this.posAtDistance(e.distance);
      e.sprite.setPosition(pos.x, pos.y);
      e.hpBar.clear();
      const w = e.radius * 1.6, frac = Math.max(0, e.hp / e.maxHp);
      e.hpBar.fillStyle(0x000000, 0.5).fillRect(pos.x - w / 2, pos.y - e.radius - 14, w, 6);
      e.hpBar.fillStyle(frac > 0.5 ? 0x2f8f5b : frac > 0.25 ? GAME.colors.gold : GAME.colors.maple, 1)
        .fillRect(pos.x - w / 2, pos.y - e.radius - 14, w * frac, 6);
    }
    this.enemies = this.enemies.filter((e) => e.alive || e.sprite.active);

    // Towers fire.
    for (const slot of this.slots) if (slot.built) this.fireFrom(slot, dtMs);

    // Projectiles move + hit.
    for (const p of this.projectiles) {
      if (!p.target.alive) { p.sprite.destroy(); p.dead = true; continue; }
      const dx = p.target.sprite.x - p.sprite.x, dy = p.target.sprite.y - p.sprite.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * (dtMs / 1000);
      if (dist <= step + 10) {
        this.damageEnemy(p.target, p.damage);
        if (p.splash) {
          for (const e of this.enemies) {
            if (e.alive && e !== p.target) {
              const d = Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, e.sprite.x, e.sprite.y);
              if (d <= p.splash) this.damageEnemy(e, Math.round(p.damage * 0.6));
            }
          }
        }
        p.sprite.destroy(); p.dead = true;
      } else {
        p.sprite.x += (dx / dist) * step;
        p.sprite.y += (dy / dist) * step;
        p.sprite.rotation += 0.3;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  enemyReachedEnd(e) {
    e.alive = false;
    const loss = e.def.boss ? 3 : 1;
    this.lives = Math.max(0, this.lives - loss);
    sfx.play('hit');
    shake(this, 0.006, 100);
    this.cameras.main.flash(100, 120, 20, 20);
    e.sprite.destroy(); e.hpBar.destroy();
    this.refreshHud();
    if (this.lives <= 0) this.endRun();
  }

  refreshHud() {
    this.goldText.setText(`🪙 ${fmt(this.gold)}`);
    this.livesText.setText('♥ ' + this.lives);
    this.waveText.setText(`Wave ${this.waveIndex}`);
    for (const slot of this.slots) this.updateSlotInfo(slot);
  }

  endRun() {
    this.over = true;
    sfx.play('lose');
    platform.gameplayStop();

    const waveReached = this.waveIndex;
    const coinsEarned = Math.max(1, Math.floor((this.runGold ?? 0) / 4) + waveReached * 2);
    const d = save.data;
    d.coins += coinsEarned;
    d.stats.runs += 1;
    const newBest = waveReached > d.bestWave;
    if (newBest) { d.bestWave = waveReached; platform.happyTime(); }
    save.write();

    this.time.delayedCall(500, () =>
      this.scene.start('GameOver', { waveReached, coins: coinsEarned, newBest }));
  }
}
