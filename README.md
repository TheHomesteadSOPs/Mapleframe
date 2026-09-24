# Mapleframe Games

Small, replayable browser games for CrazyGames, Poki, and itch.io.
Built with **Phaser 4** + **Vite**, written by Ian (design) and Claude (code).

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install          # once
npm run dev          # play locally at http://localhost:5173
```

## Ship a build

| Command | Output (in `release/`) | Upload to |
|---|---|---|
| `npm run build:crazygames` | `<game>-crazygames-v<ver>.zip` | CrazyGames Developer Portal |
| `npm run build:poki` | `<game>-poki-v<ver>.zip` | Poki for Developers |
| `npm run build:itch` | `<game>-itch-v<ver>.zip` | itch.io (HTML game) |

Every zip has `index.html` at its root, uses relative paths, and prints its size (CrazyGames asks for under 20 MB).

## What the template gives every game

| File | What it does |
|---|---|
| `src/config.js` | Game id, title, version, resolution, colours. **Edit first for each new game.** |
| `src/platform/index.js` | One interface for the CrazyGames and Poki SDKs: loading events, gameplay start/stop, midgame and rewarded ads, happy time, cloud save. Falls back to local if an ad blocker stops the SDK. |
| `src/systems/save.js` | A versioned save file with auto-merge of new fields, a debounced save, save-on-tab-close, and "seconds away" for offline earnings. |
| `src/systems/upgrades.js` | Data-driven upgrades with exponential cost curves (the idle-game standard). |
| `src/systems/sfx.js` | Synthesised sound effects (no audio files needed), mute, auto-pause during ads. |
| `src/ui/widgets.js` | Buttons, floating "+5" text, particle bursts, screen shake, panels, and `fmt()` for 1.2K / 3.4M numbers. |
| `src/scenes/` | Boot → Menu (with upgrade shop) → Game → GameOver (rewarded "double coins" + midgame ad on replay). |

`GameScene.js` currently holds **"Leaf Catch"**, a demo that exercises every system. Game 1 replaces it.

## Ad rules built in
- Game audio and the game loop pause while any ad plays (a portal requirement).
- Midgame ads show only at natural breaks, at most once every 3 minutes.
- Rewarded ads only give the reward when the ad actually completes.

See `PROJECT.md` for working conventions.
