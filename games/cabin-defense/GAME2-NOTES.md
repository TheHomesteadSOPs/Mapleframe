# Game 2 — design notes

*September 2026. Working title: **Garbage Day**. Lives at `games/cabin-defense/` in the Mapleframe monorepo (Game 1 is unchanged, at the repo root).*

## What's in the game

**Setting:** defend a lakeside cabin's garbage bin from Canadian wildlife — same tower-defense skeleton as Nonna's Last Stand (Game 1), reskinned with a strong, distinct Mapleframe identity: forest greens/browns instead of Game 1's warm kitchen reds, a dirt path instead of a tile counter, Gary the Cottager instead of Nonna.

**Enemies:**
- **Raccoon** — a bandit-masked heist crew member. Fast, low HP swarmer (same role as Pizzarino in Game 1).
- **Beaver** — slow and tanky, and the game's first genuinely new mechanic: a beaver that gets close to a built tower **pauses and chews on it**. If you don't kill it in time (~2.2s), the tower drops a level. Kill the beaver mid-chew and the tower is safe.
- **Goose** — the second new mechanic: geese always spawn in real **V-formation squads**, not single file. A lead goose flies the centerline; the rest peel off left/right at increasing lateral offsets and staggered timing, so the squad visibly flies as a wedge down the lane.
- **Momma Bear** — tanky boss, appears wave 8 and alternates with Bull Moose in endless mode.
- *(Endless-mode variety, past wave 8, mirroring Game 1's pattern):* **Mama Raccoon** splits into 2 **Kit Raccoons** on death; **Bull Moose** is a fast-bruiser boss alternating with Momma Bear.

**Towers** (place on pads near the path, tap to upgrade in place, 3 levels each):
- **Bear Spray** — cheap, fast, reliable starter tower.
- **Air Horn Blaster** — splash damage.
- **Bear Trap Launcher** — long range, big splash, slow.
- **Leaf Blower** — very rapid fire, short range.

**Gary the Cottager** stands at the end of the path as the character you're protecting (placeholder art until the art batch lands).

**The loop:** identical to Game 1 — waves auto-start every ~6 seconds; kill critters for gold; spend gold placing/upgrading towers; survive as many waves as you can; gold converts to permanent "shed coins" at Game Over, spent between runs on three permanent upgrades (more starting gold, more tower damage, an extra life).

## The two "not just a reskin" mechanics

Ian's brief specifically asked for genuine new mechanics, not stat-reskinned enemies. Implementation, both in `src/scenes/GameScene.js`:

- **V-formation geese** — `WAVES` entries can use `{ formation: 'v', squadSize, laneSpacing, staggerMs, squadGapMs, ... }` instead of a plain `{ count, intervalMs }` group. `expandSpawnGroup()` turns that into individual spawn entries, each with a `lateralOffset` (perpendicular distance from the path centerline) and a staggered spawn time. Every frame, `positionEnemy()` computes the path's perpendicular direction at the enemy's current distance (`perpAtDistance()`) and offsets the sprite sideways by `lateralOffset` — so the squad actually renders as a V, not just a timing trick.
- **Tower-chewing beavers** — a beaver with `chewsTowers: true` that gets within `CHEW_RANGE` of an unclaimed built tower stops advancing and starts chewing (`slot.chewedBy` / `slot.chewProgress`). A chewed tower stops firing. After `CHEW_DURATION_MS` (2.2s) the tower's level drops by 1 (never below 1) and the beaver moves on. Killing the beaver mid-chew releases the tower with no penalty — verified with a headless test (see Playtested, below).

## Playtested

Headless via Playwright, driving `GameScene` directly (build/upgrade a tower, expand a V-formation spawn group and confirm alternating lateral offsets + staggered timing + visually distinct render positions, run a beaver through a full chew cycle and confirm the tower drops exactly one level and stops firing while chewed, and confirm killing a beaver mid-chew releases the tower with the level unchanged). All checks passed, no console/page errors beyond the expected 404s for art that hasn't been generated yet (placeholders cover those automatically, same as Game 1 pre-art).

## Art pipeline

Reusing the **same OpenRouter worker that's already running** for Game 1 (`Mapleframe/art-pipeline/`, `openai/gpt-image-2`, magenta `#FF00FF` background) — no need to start a second worker. 13 jobs were queued into that same `jobs/` folder (4 towers, 7 enemies, Gary, one cabin-background board), with `output_file` pointed at a `output/cabin/` subfolder so they don't mix with Nonna's finished art. Once the worker finishes them I'll pull the images from there, run them through the same chroma-key + spill-suppression cleanup used for Game 1, and drop the finished PNGs into `games/cabin-defense/public/assets/cd/` — no code changes needed, since this game's art loader already prefers real art over placeholders automatically (same `hasArt()`/`textureFor()` system as Game 1).

## .gitignore fix (monorepo)

Game 1's original `art-pipeline/jobs|output|results/` patterns in the root `.gitignore` were anchored to the repo root (a pattern with a slash in the middle is relative to where the `.gitignore` lives), so they wouldn't have matched `games/cabin-defense/art-pipeline/...`. Fixed by prefixing those patterns with `**/` in the root `.gitignore` so they match at any depth. (Belt-and-suspenders: `games/cabin-defense/.gitignore` also has its own copy of the same patterns, correctly scoped to that folder on its own.)

## Try it locally

```
cd games/cabin-defense
npm install
npm run dev
```
Open the printed localhost URL — click "Defend the Bin," tap a tower in the tray, then tap an empty pad to place it.
