import * as Phaser from 'phaser';
import { GAME } from './config.js';
import { platform } from './platform/index.js';
import { sfx } from './systems/sfx.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

async function start() {
  // 1. Portal SDK first (falls back to local if blocked).
  await platform.init();
  platform.loadingStart();

  // 2. Boot Phaser.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: GAME.colors.bg,
    width: GAME.width,
    height: GAME.height,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [BootScene, MenuScene, GameScene, GameOverScene],
  });

  // 3. Mute + pause the whole game while ads play (portal requirement).
  platform.setAdHooks({
    onAdStart: () => { sfx.pauseForAd(); game.loop.sleep(); },
    onAdEnd: () => { sfx.resumeAfterAd(); game.loop.wake(); },
  });

  // Handy for debugging in the browser console: __game, __platform
  if (import.meta.env.DEV) Object.assign(window, { __game: game, __platform: platform });
}

start();
