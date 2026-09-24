# Working conventions — Mapleframe Games

## Roles
- **Ian:** creator/designer. Picks concepts, playtests, makes decisions, handles accounts, portal uploads and payouts.
- **Claude:** developer. Writes the code, produces each build, and keeps these docs current.

## Repo layout
- Shared systems live in `src/platform`, `src/systems`, `src/ui`. Improve them in place so every game benefits.
- Each game gets its own copy of the template, either as a folder under `games/<game-id>/` or as its own repo cloned from this one. We'll decide when Game 2 starts.

## Versioning
- `GAME.version` in `src/config.js` is the source of truth. The zip name uses it.
- Bump the **patch** version for fixes and tuning, the **minor** version for new content or features, and the **major** version for relaunches.
- Commit messages start with the game id, e.g. `game1: add wave 10 boss`.

## Before every upload (checklist)
1. `npm run dev` → play a full run: menu → game → game over → rewarded → replay → menu.
2. Reload the page. Progress (coins, upgrades, best score) must survive.
3. Check the browser console for errors.
4. Try it on a phone (or a mobile-sized browser window).
5. Run `npm run build:<platform>` and confirm the zip size is under 20 MB.
6. Upload the zip from `release/`.

## Targets (CrazyGames Basic Launch)
- Average playtime **10+ min** · Day-1 retention **10–15%** · **80%+** of players still playing after 1 minute
- Basic Launch runs 7–21 days and needs at least 500 plays before Full Launch (ads on).

## Rules of thumb
- Players should be *playing* within 5 seconds of the page loading. No long intros.
- Call `platform.gameplayStart()` / `gameplayStop()` whenever real play begins or pauses.
- Never show a midgame ad during play. Rewarded ads are always the player's choice.
- Save often (`save.writeSoon()`); progress loss kills retention.
