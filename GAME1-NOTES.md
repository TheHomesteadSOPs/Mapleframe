# Game 1 — design notes

*September 2026. Final name: **Nonna's Last Stand**.*

## Naming — locked in

Went with **Nonna's Last Stand** from the shortlist below — clean, funny, and tells you it's a defense game. `GAME.title` in `src/config.js` is updated everywhere the display name shows (menu, rotate-overlay text, etc).

| Name | Why |
|---|---|
| **Nonna's Last Stand** ✅ chosen | Clean, funny, and it tells you it's a defense game. |
| Sauce Boss | Short and punchy — works as a brand you could reuse for a sequel. |
| Kitchen Meltdown | Bigger "chaos" energy, less specifically Italian. |
| Mamma Mia! Tower Defense | Very on-the-nose but very clickable as a thumbnail/title. |
| Pasta Patrol | Playful, alliterative, slightly less punchy than the others. |

The code still uses the internal save-data id `nonnas-kitchen` (in `src/config.js` → `GAME.id`) — that's locked separately and staying as-is, since changing it after publishing would reset players' save data. Only the display title changed.

## What's in the game

**Setting:** an absurd horde of original food-monster characters — not existing "brainrot" characters, which are actively disputed in court (Mementum Lab vs. Do Big Studios over "Italian brainrot" ownership) — invades Nonna's kitchen to steal the lasagna. You defend with animated kitchen tools.

**Enemies:**
- **Pizzarino** — a pizza slice on a unicycle wheel. Fast, low HP swarmer.
- **Spaghetto** — a tangle of noodles with a mustache. Fast, low HP.
- **Meatballino** — a big meatball with a sauce cape. Tanky, armored.
- **Parmesano** — a wedge-of-parmesan golem boss. Very tanky, armored, appears from wave 8 on.

**Towers** (place on pads near the path, tap to upgrade in place, 3 levels each):
- **Rolling Pin** — cheap, fast, reliable starter tower.
- **Grater Cannon** — splash damage.
- **Ladle Catapult** — long range, big splash, slow.
- **Turbo Blender** — very rapid fire, short range.

**Nonna** stands at the end of the path as the character you're protecting (currently a placeholder circle — her reference art is in the first art batch).

**The loop:** waves auto-start every ~6 seconds; kill enemies for gold; spend gold placing and upgrading towers; survive as many waves as you can. When you run out of lives, gold converts to permanent "pantry coins," spent between runs on three permanent upgrades (more starting gold, more tower damage, an extra life) — the idle-game progression loop, matching Mage Castle Idle Defense's structure.

## One scope cut from the original pitch

The original idea was tapping two towers to **merge** them into a hybrid. I built **tap-to-upgrade-in-place** instead (spend gold, same tower gets stronger, up to level 3) — it's the standard, well-tested tower-defense pattern and was safely buildable in one pass. True drag-and-drop merging is a bigger feature (needs drag detection, matching rules, and merge-specific art per combination) — happy to add it in a v2 if playtesting says it's worth it. Tell me if this bothers you and we can revisit before art locks in.

## Playtested

I ran it headless: built towers, fought through multiple waves, watched gold/lives/wave-count behave correctly, confirmed the game-over → save → menu flow, and checked the coins persist through a page reload. One real bug I found and fixed: the path exited the right edge of the screen, taking Nonna with it — she's on-screen now.

## Art pipeline

Set up at `Mapleframe/art-pipeline/`, reusing your KidsBooksAutomation OpenRouter worker as-is. 10 reference-image jobs are queued (4 enemies, 4 towers, Nonna, one kitchen background), each a single 2K image via `google/gemini-3-pro-image`, on a solid magenta background so I can key out transparency. Cost should run about $1.50–2 total, based on the $0.13/image your book jobs showed.

**To run it:** double-click `art-pipeline/start_worker.bat` and leave the window open. It'll process all 10 jobs and can then sit there for future batches. Tell me when it's done and I'll pull the images, clean them up (transparent background, resized), and wire them into the game — no code changes needed on your end, since the game already prefers real art over placeholders automatically.

## Post-playtest changes (Ian's feedback)

- Fixed two tower pads that were out of range of the lane (one badly, one
  borderline) — both now sit ~80-90px from the path like the rest.
- Towers rendered 25% bigger on the board; enemies 10% bigger. Both scale
  off shared constants/data so future art will follow automatically.
- Added a speed toggle (1x/2x/3x) and persistent upgrade-cost labels on
  built towers (color-coded by affordability).
- Endless mode (past wave 8) now has real variety, not just bigger
  numbers: **Saucezilla** splits into 2 **Saucelings** on death, and the
  boss now alternates every 4 waves between **Parmesano** and a new
  **Espresso Golem** (fast bruiser vs. Parmesano's slow tank). Both new
  enemies render as placeholders until their art batch is run.
- Pre-launch pass: added a landscape-only rotate-device prompt (phones
  held portrait were getting a tiny letterboxed game), and a one-time
  "tap a tower, then tap a pad" hint for first-time players.

## Try it locally

```
npm install
npm run dev
```
Open http://localhost:5173 — click "Defend the Kitchen," tap a tower in the tray, then tap an empty pad to place it.
