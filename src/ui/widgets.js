// ─────────────────────────────────────────────────────────────
//  Reusable UI + "juice" helpers so every game feels polished
//  without re-writing the same code.
// ─────────────────────────────────────────────────────────────
import { GAME } from '../config.js';
import { sfx } from '../systems/sfx.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export const textStyle = (size = 32, color = GAME.colors.cream, extra = {}) => ({
  fontFamily: GAME.font,
  fontSize: `${size}px`,
  color: hex(color),
  fontStyle: 'bold',
  ...extra,
});

/** 1234 → "1.2K", 5_600_000 → "5.6M" (idle games need this). */
export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return (n >= 100 ? n.toFixed(0) : n.toFixed(1)).replace(/\.0$/, '') + units[i];
}

/**
 * Rounded button with hover + press feedback.
 * Returns a Container; call `.setEnabled(false)` to grey it out,
 * `.setLabel('text')` to change the label.
 */
export function button(scene, x, y, label, onClick, opts = {}) {
  const w = opts.width ?? 280;
  const h = opts.height ?? 72;
  const color = opts.color ?? GAME.colors.maple;
  const c = scene.add.container(x, y);

  const bg = scene.add.graphics();
  const draw = (fill) => {
    bg.clear();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 16);
    bg.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
  };
  draw(color);

  const txt = scene.add.text(0, 0, label, textStyle(opts.fontSize ?? 30)).setOrigin(0.5);
  c.add([bg, txt]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });

  let enabled = true;
  c.on('pointerover', () => enabled && scene.tweens.add({ targets: c, scale: 1.05, duration: 80 }));
  c.on('pointerout', () => scene.tweens.add({ targets: c, scale: 1, duration: 80 }));
  c.on('pointerdown', () => {
    if (!enabled) return;
    sfx.play('click');
    scene.tweens.add({ targets: c, scale: 0.94, duration: 50, yoyo: true });
    onClick?.();
  });

  c.setEnabled = (on) => { enabled = on; draw(on ? color : GAME.colors.muted); c.setAlpha(on ? 1 : 0.7); return c; };
  c.setLabel = (s) => { txt.setText(s); return c; };
  c.label = txt;
  return c;
}

/** "+5" style text that floats up and fades. */
export function floatText(scene, x, y, str, color = GAME.colors.gold, size = 34) {
  const t = scene.add.text(x, y, str, textStyle(size, color, { stroke: '#000', strokeThickness: 5 }))
    .setOrigin(0.5).setDepth(1000);
  scene.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
}

/** Particle burst using the 'dot' texture generated in BootScene. */
export function burst(scene, x, y, tint = GAME.colors.gold, count = 14) {
  const p = scene.add.particles(x, y, 'dot', {
    speed: { min: 120, max: 360 },
    angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0 },
    lifespan: 500,
    tint,
    emitting: false,
  }).setDepth(900);
  p.explode(count);
  scene.time.delayedCall(700, () => p.destroy());
}

export function shake(scene, intensity = 0.008, ms = 120) {
  scene.cameras.main.shake(ms, intensity);
}

/** Simple dark panel behind groups of UI. */
export function panel(scene, x, y, w, h, alpha = 0.9) {
  return scene.add.graphics()
    .fillStyle(GAME.colors.panel, alpha)
    .fillRoundedRect(x - w / 2, y - h / 2, w, h, 20);
}
