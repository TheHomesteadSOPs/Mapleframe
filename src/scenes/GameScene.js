import * as Phaser from 'phaser';
import { GAME } from '../config.js';
import { platform } from '../platform/index.js';
import { save } from '../systems/save.js';
import { sfx } from '../systems/sfx.js';
import { upgrades } from '../systems/upgrades.js';
import { textureFor, hasArt, MENU_BG_KEY } from '../systems/sprites.js';
import { textStyle, fmt, floatText, burst, shake, button, coinText } from '../ui/widgets.js';
import {
  PATH, TOWER_SLOTS, TOWER_DEFS, ENEMY_DEFS, towerStatsAtLevel, upgradeCost,
  MAX_TOWER_LEVEL, waveForIndex, waveClearBonus,
} from '../data/towerDefense.js';

const NEXT_WAVE_DELAY_MS = 8000;
const SPEED_STEPS = [1, 2, 3];
const TOWER_DISPLAY_SIZE = 84;   // longest side of a built tower, px
const ENEMY_SIZE_MULT = 1.55;    // sprite height = radius * 2 * this (readable on the 120px-wide lane)
const NONNA_HEIGHT = 130;
const BOARD_SCALE = 0.8;         // painted board drawn at 0.8x...
const BOARD_OFFSET_Y = -287 * BOARD_SCALE; // ...with source row 287 at the top of the screen
const TRAY_X = 1210;             // right-hand tower tray column
const HIT_SFX = { rollingpin: 'hit_pin', grater: 'hit_grater', ladle: 'hit_ladle', blender: 'hit_blender' };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
// Hard cap on simultaneous alive enemies — each one owns a Graphics
// object redrawn every frame for its HP bar, and every tower checks
// distance to every alive enemy each frame, so this is the main lever
// for keeping very late endless waves smooth on low-end phones. Queued
// spawns just wait a beat once this is hit (see update()) rather than
// being dropped, so nothing is skipped, it's just paced out.
const MAX_ALIVE_ENEMIES = 60;

/** Catmull-Rom spline through the control points → smooth dense polyline. */
function smoothPath(points, perSeg = 12) {
  const P = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    sfx.musicForWave(1);
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
    this.projectiles = [];   // plain objects, see fireFrom()
    this.pendingSpawns = [];
    this.slots = [];         // { x, y, pad, built: null|{type,level}, art, pips }
    this.over = false;
    this.quitting = false;
    this.runGold = 0;
    this.dmgMult = upgrades.value('towerDamage');
    this.goldMult = upgrades.value('goldBonus');
    this.rateMult = upgrades.value('fireRate');
    this.rangeMult = upgrades.value('towerRange');
    this.critChance = upgrades.value('crit');
    this.costMult = upgrades.value('discount');
    this.auraTick = 0;
    this.chillers = [];
    this.bannerToken = 0;
    this.speedMult = 1;    // player-controlled game-speed multiplier (see buildHud)
    this.gameNow = 0;      // internal clock that respects speedMult (this.time.now doesn't)
    this.hudTick = 0;

    this.precomputePath();
    this.drawBoard(W, H);
    this.buildSlots();
    this.buildHud(W);
    this.buildTray(W, H);
    this.buildTutorial(W, H);

    platform.gameplayStart();
    this.events.once('shutdown', () => platform.gameplayStop());

    this.scheduleNextWave(2500);
    this.refreshHud();
  }

  /** Prices after the 'Nonna's Coupons' discount. */
  costOf(base) { return Math.max(1, Math.round(base * this.costMult)); }
  upgradeCostFor(type, level) {
    const c = upgradeCost(type, level);
    return c == null ? null : this.costOf(c);
  }

  // ── Path helpers ───────────────────────────────────────────
  precomputePath() {
    this.path = smoothPath(PATH);
    this.cum = [0];
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1], b = this.path[i];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.totalLength = this.cum[this.cum.length - 1];
  }

  posAtDistance(dist) {
    const d = Phaser.Math.Clamp(dist, 0, this.totalLength);
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= d) lo = mid; else hi = mid;
    }
    const a = this.path[lo], b = this.path[hi];
    const seg = this.cum[hi] - this.cum[lo];
    const t = seg === 0 ? 0 : (d - this.cum[lo]) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  // ── Visuals ─────────────────────────────────────────────
  drawBoard(W, H) {
    if (hasArt(this, MENU_BG_KEY)) {
      // The painted kitchen board — enemies walk its tile path.
      this.add.image(0, BOARD_OFFSET_Y, MENU_BG_KEY).setOrigin(0, 0).setScale(BOARD_SCALE).setDepth(-20);
    } else {
      // Fallback if the art is missing: flat counter + drawn lane.
      this.add.rectangle(W / 2, H / 2, W, H, 0x2b2016).setDepth(-20);
      const g = this.add.graphics().setDepth(-10);
      g.lineStyle(60, 0x1c140d, 1); this.strokePath(g);
      g.lineStyle(48, 0xd9b98a, 1); this.strokePath(g);
    }
    // Nonna guards the lasagna at the end of the lane.
    const end = PATH[PATH.length - 1];
    const nonnaKey = textureFor(this, 'h01_nonna', 'ph_h01_nonna');
    this.nonna = this.add.image(end.x + 70, end.y + 28, nonnaKey).setDepth(5);
    this.nonna.setScale(NONNA_HEIGHT / this.nonna.height);
    this.tweens.add({
      targets: this.nonna, y: this.nonna.y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.rangeGfx = this.add.graphics().setDepth(2);
  }

  strokePath(g) {
    g.beginPath();
    g.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i++) g.lineTo(this.path[i].x, this.path[i].y);
    g.strokePath();
  }

  buildSlots() {
    for (const pos of TOWER_SLOTS) {
      const pad = this.add.image(pos.x, pos.y, 'pad').setDepth(2).setInteractive({ useHandCursor: true });
      const slot = { x: pos.x, y: pos.y, pad, built: null, art: null, pips: null };
      pad.on('pointerdown', () => this.onSlotTapped(slot));
      pad.on('pointerover', () => this.showRangeFor(slot));
      pad.on('pointerout', () => this.clearRange());
      this.slots.push(slot);
    }
  }

  buildHud(W) {
    // Top-left status panel.
    const panelG = this.add.graphics().setDepth(19);
    panelG.fillStyle(0x10141c, 0.72).fillRoundedRect(14, 14, 214, 112, 16);
    this.goldText = coinText(this, 30, 38, 30).setDepth(20);
    this.livesText = this.add.text(30, 72, '', textStyle(24, GAME.colors.maple, { stroke: '#000000', strokeThickness: 4 }))
      .setOrigin(0, 0.5).setDepth(20);
    this.waveText = this.add.text(30, 104, '', textStyle(20, GAME.colors.cream, { stroke: '#000000', strokeThickness: 4 }))
      .setOrigin(0, 0.5).setDepth(20);

    // Banner for "next wave" / "boss incoming".
    this.waveBanner = this.add.text(700, 8, '', textStyle(22, GAME.colors.gold, {
      backgroundColor: '#10141ccc', padding: { x: 14, y: 6 }, align: 'center',
    })).setOrigin(0.5, 0).setDepth(20).setVisible(false);

    // Sound toggle (top-right).
    const mute = this.add.image(W - 14, 14, 'icon_sound_on').setOrigin(1, 0)
      .setInteractive({ useHandCursor: true }).setDepth(20);
    const setIcon = () => mute.setTexture(save.data.settings.muted ? 'icon_sound_off' : 'icon_sound_on');
    setIcon();
    mute.on('pointerdown', () => {
      save.data.settings.muted = !save.data.settings.muted;
      sfx.setMuted(save.data.settings.muted);
      save.write();
      setIcon();
    });

    // Speed toggle — cycles 1x → 2x → 3x → 1x, speeds up enemies/towers/
    // waves together so the whole run just plays out faster.
    this.speedBtn = button(this, TRAY_X, 78, 'Speed 1x', () => {
      const i = SPEED_STEPS.indexOf(this.speedMult);
      this.speedMult = SPEED_STEPS[(i + 1) % SPEED_STEPS.length];
      this.speedBtn.setLabel(`Speed ${this.speedMult}x`);
    }, { width: 116, height: 40, fontSize: 17, color: GAME.colors.panel });
    this.speedBtn.setDepth(20);

    // Pause button (left of the sound toggle) + Esc / P hotkeys.
    this.pauseBtn = button(this, W - 82, 32, 'II', () => this.togglePause(),
      { width: 44, height: 40, fontSize: 20, color: GAME.colors.panel });
    this.pauseBtn.setDepth(20);
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard?.on('keydown-P', () => this.togglePause());
    this.paused = false;
  }

  togglePause() {
    if (this.over || this.quitting) return;
    if (this.paused) this.resumeGame(); else this.pauseGame();
  }

  pauseGame() {
    this.paused = true;
    this.time.paused = true;
    platform.gameplayStop();
    const { width: W, height: H } = this.scale;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive(); // blocks clicks
    const box = this.add.graphics();
    box.fillStyle(0x10141c, 0.96).fillRoundedRect(W / 2 - 230, H / 2 - 190, 460, 380, 24);
    box.lineStyle(3, GAME.colors.gold, 1).strokeRoundedRect(W / 2 - 230, H / 2 - 190, 460, 380, 24);
    const title = this.add.text(W / 2, H / 2 - 135, 'PAUSED', textStyle(54, GAME.colors.gold)).setOrigin(0.5);
    const info = this.add.text(W / 2, H / 2 - 80, `Wave ${this.waveIndex}`, textStyle(24, GAME.colors.muted)).setOrigin(0.5);
    const resume = button(this, W / 2, H / 2 - 10, 'RESUME', () => this.resumeGame(), { width: 320, height: 66, fontSize: 30, color: 0x2e9e5b });
    const quit = button(this, W / 2, H / 2 + 80, 'QUIT TO MENU', () => this.askQuit(), { width: 320, height: 66, fontSize: 28 });
    const hint = this.add.text(W / 2, H / 2 + 150, 'Esc to resume', textStyle(18, GAME.colors.muted)).setOrigin(0.5);
    c.add([dim, box, title, info, resume, quit, hint]);
    this.pauseUi = { c, resume, quit, info, title, hint };
  }

  askQuit() {
    const ui = this.pauseUi;
    if (!ui || ui.confirm) return;
    ui.confirm = true;
    const { width: W, height: H } = this.scale;
    const coins = this.runCoins();
    ui.resume.setVisible(false); ui.quit.setVisible(false);
    ui.resume.disableInteractive(); ui.quit.disableInteractive();
    ui.title.setText('QUIT RUN?').setFontSize(46);
    ui.hint.setVisible(false);
    ui.info.setText(`You keep the ${coins} coin${coins === 1 ? '' : 's'}\nearned so far.`)
      .setAlign('center').setColor(hex(GAME.colors.cream)).setFontSize(26).setY(H / 2 - 55);
    const yes = button(this, W / 2, H / 2 + 40, 'YES, QUIT', () => this.quitToMenu(), { width: 320, height: 62, fontSize: 28 });
    const no = button(this, W / 2, H / 2 + 120, 'KEEP PLAYING', () => this.resumeGame(), { width: 320, height: 62, fontSize: 26, color: 0x2e9e5b });
    ui.c.add([yes, no]);
  }

  resumeGame() {
    if (!this.paused) return;
    this.pauseUi?.c.destroy();
    this.pauseUi = null;
    this.paused = false;
    this.time.paused = false;
    platform.gameplayStart();
  }

  runCoins() {
    return Math.max(1, Math.floor(this.runGold / 4) + this.waveIndex * 2);
  }

  /** Bank the coins earned so far and return to the main menu. */
  quitToMenu() {
    if (this.quitting) return;
    this.quitting = true;
    this.time.paused = false;
    const d = save.data;
    d.coins += this.runCoins();
    d.stats.runs += 1;
    if (this.waveIndex > d.bestWave) d.bestWave = this.waveIndex;
    save.write();
    platform.gameplayStop();
    this.scene.start('Menu');
  }

  setBanner(text, color = GAME.colors.gold) {
    this.bannerToken += 1;
    this.waveBanner.setText(text).setColor(hex(color)).setVisible(!!text);
  }

  /** Banner that clears itself after ms unless something else replaced it. */
  flashBanner(text, color, ms) {
    this.setBanner(text, color);
    const token = this.bannerToken;
    this.time.delayedCall(ms, () => { if (token === this.bannerToken && this.waveActive) this.setBanner(''); });
  }

  buildTray() {
    const ids = Object.keys(TOWER_DEFS);
    const top = 166, gap = 98;
    this.trayButtons = {};
    ids.forEach((id, i) => {
      const def = TOWER_DEFS[id];
      const y = top + i * gap;
      const c = this.add.container(TRAY_X, y).setDepth(20);
      const bg = this.add.graphics();
      const drawBg = (selected) => {
        bg.clear();
        bg.fillStyle(0x000000, 0.4).fillRoundedRect(-58, -44, 116, 94, 14);
        bg.fillStyle(selected ? 0x2f8f5b : 0x1c2330, 0.96).fillRoundedRect(-58, -48, 116, 94, 14);
        bg.lineStyle(selected ? 3 : 1.5, selected ? GAME.colors.gold : 0x39445a, 1).strokeRoundedRect(-58, -48, 116, 94, 14);
      };
      drawBg(false);
      const icon = this.add.image(0, -24, textureFor(this, def.sprite, `ph_${def.sprite}`));
      icon.setScale(46 / Math.max(icon.width, icon.height));
      const name = this.add.text(0, 8, def.label.split(' ')[0], textStyle(14, GAME.colors.cream)).setOrigin(0.5);
      const cost = coinText(this, 0, 30, 18, GAME.colors.cream, 0.5).setText(this.costOf(def.cost));
      c.add([bg, icon, name, cost]);
      c.setSize(116, 94);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => this.selectTower(this.selectedTowerType === id ? null : id));
      this.trayButtons[id] = { drawBg, id, cost };
    });

    // Short description of the selected tower.
    this.towerDesc = this.add.text(TRAY_X, top + ids.length * gap - 36, '', textStyle(14, GAME.colors.cream, {
      align: 'center', wordWrap: { width: 120 }, stroke: '#000000', strokeThickness: 3,
    })).setOrigin(0.5, 0).setDepth(20);

    // Skip the wait between waves.
    this.nextWaveBtn = button(this, TRAY_X, 652, 'Start wave', () => this.callNextWave(),
      { width: 116, height: 52, fontSize: 17, color: 0x2f8f5b });
    this.nextWaveBtn.setDepth(20);
  }

  selectTower(id) {
    sfx.play('click');
    this.selectedTowerType = id;
    for (const [bid, b] of Object.entries(this.trayButtons)) b.drawBg(bid === id);
    if (id) {
      const d = TOWER_DEFS[id];
      this.towerDesc.setText(`${d.label}\n${d.desc}`);
    } else {
      this.towerDesc.setText('');
    }
    this.clearRange();
    if (id && this.tutorialStep === 0) this.setTutorialStep(1);
  }

  // ── Range preview ───────────────────────────────────────
  showRangeFor(slot) {
    let range = 0;
    if (slot.built) range = towerStatsAtLevel(slot.built.type, slot.built.level).range;
    else if (this.selectedTowerType) range = TOWER_DEFS[this.selectedTowerType].range;
    if (!range) return;
    this.drawRange(slot.x, slot.y, range);
  }

  drawRange(x, y, r) {
    this.rangeGfx.clear();
    this.rangeGfx.fillStyle(0xffffff, 0.14).fillCircle(x, y, r);
    this.rangeGfx.lineStyle(3, 0xffffff, 0.75).strokeCircle(x, y, r);
  }

  clearRange() { this.rangeGfx.clear(); }

  // ── First-run tutorial ──────────────────────────────────
  /** Three short steps (pick a tower → place it → how upgrades/economy work).
   *  Only shown on a player's very first run; steps advance on the real
   *  action, so it can't time out before they've read it. */
  buildTutorial(W, H) {
    this.tutorialStep = -1;
    if (save.data.settings.tutorialSeen) return;
    this.tutorialText = this.add.text(W / 2 - 40, H - 36, '', textStyle(22, GAME.colors.cream, {
      backgroundColor: '#10141cdd', padding: { x: 16, y: 9 }, align: 'center',
    })).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: this.tutorialText, alpha: 0.82, duration: 700, yoyo: true, repeat: -1 });
    this.setTutorialStep(0);
  }

  setTutorialStep(n) {
    if (this.tutorialStep === -1 && n !== 0) return;
    this.tutorialStep = n;
    const msgs = [
      '1. Pick a tower from the panel on the right',
      '2. Now tap a glowing pad to build it',
      'Tap a built tower to upgrade it. Defeated food drops gold!',
    ];
    if (n >= msgs.length) return this.endTutorial();
    this.tutorialText.setText(msgs[n]);
    if (n === 2) this.time.delayedCall(9000, () => this.endTutorial());
  }

  endTutorial() {
    if (this.tutorialStep === -1) return;
    this.tutorialStep = -1;
    this.tweens.add({
      targets: this.tutorialText, alpha: 0, duration: 300,
      onComplete: () => this.tutorialText?.destroy(),
    });
    save.data.settings.tutorialSeen = true;
    save.write();
  }

  // ── Interaction ─────────────────────────────────────────
  onSlotTapped(slot) {
    if (this.over) return;
    if (!slot.built) {
      if (!this.selectedTowerType) { this.nudgeSelectTower(); return; }
      const def = TOWER_DEFS[this.selectedTowerType];
      const price = this.costOf(def.cost);
      if (this.gold < price) { this.flashNoGold(slot); return; }
      this.gold -= price;
      slot.built = { type: this.selectedTowerType, level: 1, cooldown: 0 };
      const key = textureFor(this, def.sprite, `ph_${def.sprite}`);
      slot.art = this.add.image(slot.x, slot.y - 12, key).setDepth(3);
      slot.baseScale = TOWER_DISPLAY_SIZE / Math.max(slot.art.width, slot.art.height);
      slot.art.setScale(slot.baseScale);
      slot.pad.setAlpha(0.7);
      slot.pips = this.add.text(slot.x, slot.y + 36, '', textStyle(14, GAME.colors.gold, { stroke: '#000000', strokeThickness: 4 }))
        .setOrigin(0.5).setDepth(3);
      // Little drop-in pop.
      slot.art.setScale(slot.baseScale * 0.4);
      this.tweens.add({ targets: slot.art, scale: slot.baseScale, duration: 180, ease: 'Back.easeOut' });
      this.updateSlotInfo(slot);
      sfx.play('place');
      burst(this, slot.x, slot.y, def.color, 10);
      if (this.tutorialStep === 1) this.setTutorialStep(2);
      this.refreshHud();
      this.showRangeFor(slot);
      this.time.delayedCall(900, () => this.clearRange());
    } else {
      const { type, level } = slot.built;
      const cost = this.upgradeCostFor(type, level);
      if (cost == null) { floatText(this, slot.x, slot.y - 50, 'MAX', GAME.colors.muted, 22); return; }
      if (this.gold < cost) { this.flashNoGold(slot); return; }
      this.gold -= cost;
      slot.built.level += 1;
      slot.baseScale *= 1.1;
      this.tweens.add({ targets: slot.art, scale: slot.baseScale, duration: 160, ease: 'Back.easeOut' });
      this.updateSlotInfo(slot);
      sfx.play('upgrade');
      burst(this, slot.x, slot.y, GAME.colors.gold, 16);
      this.refreshHud();
      this.showRangeFor(slot);
      this.time.delayedCall(900, () => this.clearRange());
    }
  }

  nudgeSelectTower() {
    for (const b of Object.values(this.trayButtons)) b.drawBg(false);
    floatText(this, TRAY_X - 90, 280, 'Pick a tower first', GAME.colors.cream, 18);
  }

  /** Keeps each built tower's level dots + next-upgrade cost visible and
   *  colour-coded (white = affordable, red = can't afford yet, gold = maxed)
   *  so players always know what an upgrade tap will cost. */
  updateSlotInfo(slot) {
    if (!slot.built || !slot.pips) return;
    const { type, level } = slot.built;
    const dots = '●'.repeat(level);
    const cost = this.upgradeCostFor(type, level);
    if (cost == null) {
      slot.pips.setText(`${dots} MAX`).setColor(hex(GAME.colors.gold));
    } else {
      const afford = this.gold >= cost;
      slot.pips.setText(`${dots}  upgrade ${fmt(cost)}`).setColor(hex(afford ? GAME.colors.cream : GAME.colors.maple));
    }
  }

  flashNoGold(slot) {
    sfx.play('hit');
    floatText(this, slot.x, slot.y - 50, 'Not enough gold', GAME.colors.cream, 20);
  }

  // ── Waves ───────────────────────────────────────────────
  scheduleNextWave(delayMs = NEXT_WAVE_DELAY_MS) {
    this.waveActive = false;
    this.nextWaveAt = this.gameNow + delayMs;
    this.nextWaveBtn?.setEnabled(true).setLabel('Start wave');
  }

  /** Player skips the countdown; early callers get a small gold bonus. */
  callNextWave() {
    if (this.waveActive || this.over) return;
    const remain = Math.max(0, this.nextWaveAt - this.gameNow);
    const bonus = Math.floor(remain / 1000);
    if (bonus > 0) {
      this.gold += bonus;
      floatText(this, TRAY_X - 90, 610, `+${bonus} early bonus`, GAME.colors.gold, 18);
    }
    this.nextWaveAt = this.gameNow;
    this.refreshHud();
  }

  startWave() {
    this.waveActive = true;
    this.nextWaveBtn.setEnabled(false).setLabel('In progress');
    const wave = waveForIndex(this.waveIndex);
    this.hpScale = wave.hpScale ?? 1;
    this.pendingSpawns = [];
    let boss = false;
    for (const group of wave.spawns) {
      if (ENEMY_DEFS[group.type].boss) boss = true;
      for (let i = 0; i < group.count; i++) {
        this.pendingSpawns.push({ at: this.gameNow + group.delayMs + i * group.intervalMs, type: group.type });
      }
    }
    this.pendingSpawns.sort((a, b) => a.at - b.at);
    this.waveIndex += 1;
    sfx.musicForWave(this.waveIndex);
    sfx.play('wave');

    // First time the player meets an elite type: introduce it.
    const seen = save.data.settings.seenEnemies ?? (save.data.settings.seenEnemies = []);
    const fresh = [...new Set(wave.spawns.map((g) => g.type))].filter((t) => ENEMY_DEFS[t].elite && !seen.includes(t));
    if (fresh.length) {
      seen.push(...fresh);
      save.write();
      const lines = fresh.map((t) => `NEW ENEMY: ${ENEMY_DEFS[t].label}\n${ENEMY_DEFS[t].blurb}`);
      this.flashBanner(lines.join('\n'), GAME.colors.cream, 6000);
    } else if (boss) {
      this.flashBanner('Boss incoming!', GAME.colors.maple, 2500);
    } else {
      this.setBanner('');
    }
    this.refreshHud();
  }

  /** atDistance lets splits (Saucezilla → Saucelings) spawn where the
   *  parent died instead of back at the start of the lane. */
  spawnEnemy(type, { atDistance = 0 } = {}) {
    const def = ENEMY_DEFS[type];
    const pos = this.posAtDistance(atDistance);
    const key = textureFor(this, def.sprite, `ph_${def.sprite}`);
    const sprite = this.add.image(pos.x, pos.y, key).setDepth(4);
    const size = def.radius * 2 * ENEMY_SIZE_MULT;
    sprite.setScale(size / Math.max(sprite.width, sprite.height));
    const hpBar = this.add.graphics().setDepth(5);
    const hp = Math.round(def.hp * this.hpScale);
    this.enemies.push({
      type, def, sprite, hpBar, hp, maxHp: hp, distance: atDistance,
      speed: def.speed, radius: def.radius, size, alive: true, phase: Math.random() * 6,
      dashClock: def.dash ? Math.random() * def.dash.every : 0,
    });
  }

  // ── Combat ──────────────────────────────────────────────
  fireFrom(slot, dtMs) {
    const stats = towerStatsAtLevel(slot.built.type, slot.built.level);
    stats.range *= this.rangeMult;

    // Gelato Frostlings chill towers in reach: slower fire rate + blue tint.
    let chill = 1;
    for (const c of this.chillers) {
      if (Phaser.Math.Distance.Between(slot.x, slot.y, c.sprite.x, c.sprite.y) <= c.def.chill.radius) {
        chill = Math.min(chill, 1 - c.def.chill.slow);
      }
    }
    const chilled = chill < 1;
    if (chilled !== !!slot.chilled) {
      slot.chilled = chilled;
      if (chilled) slot.art.setTint(0x8fd8ff); else slot.art.clearTint();
    }

    slot.built.cooldown -= dtMs * this.rateMult * chill;
    if (slot.built.cooldown > 0) return;

    let target = null, bestDist = -1;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Phaser.Math.Distance.Between(slot.x, slot.y, e.sprite.x, e.sprite.y);
      if (d <= stats.range && e.distance > bestDist) { target = e; bestDist = e.distance; }
    }
    if (!target) return;

    slot.built.cooldown = stats.fireRateMs;
    const p = this.add.image(slot.x, slot.y - 12, 'projectile').setDepth(6);
    const crit = Math.random() < this.critChance;
    if (crit) p.setScale(1.7).setTint(0xfff2a0);
    this.projectiles.push({
      sprite: p, tower: slot.built.type, target, speed: TOWER_DEFS[slot.built.type].projectileSpeed,
      damage: Math.round(stats.damage * this.dmgMult) * (crit ? 2 : 1), splash: stats.splash,
    });
    // Tiny recoil + shot sound.
    this.tweens.add({ targets: slot.art, scale: slot.baseScale * 1.08, duration: 50, yoyo: true });
    const sound = { rollingpin: 'shoot_pin', grater: 'shoot_grater', ladle: 'shoot_ladle', blender: 'shoot_blender' }[slot.built.type];
    if (sound) sfx.play(sound);
  }

  damageEnemy(e, amount) {
    if (e.def.evade && Math.random() < e.def.evade) {
      floatText(this, e.sprite.x, e.sprite.y - e.size / 2, 'Miss', GAME.colors.cream, 16);
      return;
    }
    const dealt = Math.max(1, amount - e.def.armor);
    e.hp -= dealt;
    if (e.alive && e.sprite.active) {
      e.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(55, () => {
        if (e.sprite.active) e.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      });
    }
    if (e.hp <= 0 && e.alive) this.killEnemy(e);
  }

  killEnemy(e) {
    e.alive = false;
    const reward = Math.round(e.def.reward * this.goldMult);
    this.gold += reward;
    this.runGold += reward;
    burst(this, e.sprite.x, e.sprite.y, e.def.color, 12);
    floatText(this, e.sprite.x, e.sprite.y - e.size / 2, `+${reward}`, GAME.colors.gold, 20);
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

  // ── Main loop ───────────────────────────────────────────
  update(_, dtMsRaw) {
    if (this.over || this.paused) return;
    const dtMs = dtMsRaw * this.speedMult;
    this.gameNow += dtMs;

    if (!this.waveActive) {
      const remain = Math.max(0, this.nextWaveAt - this.gameNow);
      this.setBanner(`Next wave in ${Math.ceil(remain / 1000)}s`);
      if (remain <= 0) this.startWave();
    } else {
      let aliveCount = this.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
      while (this.pendingSpawns.length && this.pendingSpawns[0].at <= this.gameNow) {
        if (aliveCount >= MAX_ALIVE_ENEMIES) break; // wait for room — nothing is dropped, just paced out
        this.spawnEnemy(this.pendingSpawns.shift().type);
        aliveCount += 1;
      }
      if (!this.pendingSpawns.length && this.enemies.every((e) => !e.alive)) {
        this.enemies = [];
        this.onWaveCleared();
      }
    }

    // Enemies advance + reach-end check.
    for (const e of this.enemies) {
      if (!e.alive) continue;
      let speed = e.speed;
      if (e.def.dash) { // Cannolo: periodic burst of speed
        e.dashClock += dtMs;
        if (e.dashClock % e.def.dash.every < e.def.dash.duration) speed *= e.def.dash.mult;
      }
      e.distance += speed * (dtMs / 1000);
      if (e.distance >= this.totalLength) { this.enemyReachedEnd(e); continue; }
      const pos = this.posAtDistance(e.distance);
      e.sprite.setPosition(pos.x, pos.y);
      e.sprite.setAngle(Math.sin(this.gameNow / 170 + e.phase) * 5); // little waddle
      e.hpBar.clear();
      const w = e.size * 0.7, frac = Math.max(0, e.hp / e.maxHp);
      const by = pos.y - e.size / 2 - 6;
      e.hpBar.fillStyle(0x000000, 0.6).fillRect(pos.x - w / 2 - 1, by - 1, w + 2, 8);
      e.hpBar.fillStyle(frac > 0.5 ? 0x2f8f5b : frac > 0.25 ? GAME.colors.gold : GAME.colors.maple, 1)
        .fillRect(pos.x - w / 2, by, w * frac, 6);
      const aura = e.def.heal ?? e.def.chill; // show the area an aura mob affects
      if (aura) {
        const col = e.def.heal ? 0x5fe08a : 0x8fd8ff;
        const pulse = 0.5 + 0.5 * Math.sin(this.gameNow / 260);
        e.hpBar.fillStyle(col, 0.06 + 0.03 * pulse).fillCircle(pos.x, pos.y, aura.radius);
        e.hpBar.lineStyle(2, col, 0.35 + 0.2 * pulse).strokeCircle(pos.x, pos.y, aura.radius);
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive || e.sprite.active);

    // Tiramisu Medics heal everything near them (a few times a second).
    this.auraTick += dtMs;
    if (this.auraTick >= 250) {
      const sec = this.auraTick / 1000;
      this.auraTick = 0;
      for (const m of this.enemies) {
        if (!m.alive || !m.def.heal) continue;
        for (const o of this.enemies) {
          if (!o.alive || o === m || o.hp >= o.maxHp) continue;
          if (Phaser.Math.Distance.Between(m.sprite.x, m.sprite.y, o.sprite.x, o.sprite.y) <= m.def.heal.radius) {
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * m.def.heal.pctPerSec * sec * (o.def.boss ? 0.4 : 1));
          }
        }
      }
    }

    // Towers fire.
    this.chillers = this.enemies.filter((e) => e.alive && e.def.chill);
    for (const slot of this.slots) if (slot.built) this.fireFrom(slot, dtMs);

    // Projectiles move + hit.
    for (const p of this.projectiles) {
      if (!p.target.alive) { p.sprite.destroy(); p.dead = true; continue; }
      const dx = p.target.sprite.x - p.sprite.x, dy = p.target.sprite.y - p.sprite.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * (dtMs / 1000);
      if (dist <= step + 10) {
        this.damageEnemy(p.target, p.damage);
        sfx.play(HIT_SFX[p.tower]);
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

    // Pads pulse while a tower is selected, so "tap a pad" is obvious.
    const pulse = this.selectedTowerType ? 1 + 0.07 * Math.sin(this.time.now / 160) : 1;
    for (const s of this.slots) if (!s.built) s.pad.setScale(pulse);

    // Wave progress readout (cheap, throttled).
    this.hudTick += dtMsRaw;
    if (this.hudTick > 250) { this.hudTick = 0; this.refreshWaveText(); }
  }

  onWaveCleared() {
    const bonus = waveClearBonus(this.waveIndex);
    this.gold += bonus;
    this.runGold += bonus;
    floatText(this, 120, 150, `Wave cleared! +${bonus}`, GAME.colors.gold, 24);
    this.scheduleNextWave();
    this.refreshHud();
  }

  enemyReachedEnd(e) {
    e.alive = false;
    const loss = e.def.leak ?? (e.def.boss ? 3 : 1);
    this.lives = Math.max(0, this.lives - loss);
    sfx.play('hit');
    shake(this, 0.006, 100);
    this.cameras.main.flash(100, 120, 20, 20);
    e.sprite.destroy(); e.hpBar.destroy();
    this.refreshHud();
    if (this.lives <= 0) this.endRun();
  }

  refreshWaveText() {
    if (this.waveIndex === 0) { this.waveText.setText('Get ready!'); return; }
    if (!this.waveActive) { this.waveText.setText(`Wave ${this.waveIndex} cleared`); return; }
    const left = this.pendingSpawns.length + this.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
    this.waveText.setText(`Wave ${this.waveIndex}  ·  ${left} left`);
  }

  refreshHud() {
    this.goldText.setText(fmt(this.gold));
    this.livesText.setText('♥ ' + this.lives);
    this.refreshWaveText();
    for (const slot of this.slots) this.updateSlotInfo(slot);
  }

  endRun() {
    this.over = true;
    sfx.play('lose');
    platform.gameplayStop();

    const waveReached = this.waveIndex;
    const coinsEarned = Math.max(1, Math.floor(this.runGold / 4) + waveReached * 2);
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
