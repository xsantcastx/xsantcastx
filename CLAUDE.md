# Eclipse Realms — operating manual

xsantcastx.com is now **one product: the browser RPG Eclipse Realms** (Angular 21 SSR on Firebase
Hosting, installable PWA). The old tools website (126 tools, galaxy map, cosmic engine, /live, MCP,
embeds, ads) was removed in October 2026; its URLs 301 into the game. Do not rebuild any of it.

**Read first, every session:** `docs/roadmap/world-plan.md` — the live build tracker: decisions,
phases, what's shipped, what's in flight, the watch list, and the working rules. Update it in the
same commit that lands the work.

---

## 1. What the game is

Every page is a **place in a walkable world**: five realm towns (Infernal · Luminous · Umbral ·
Celestial · Verdant) joined by Waystones, hunting grounds, the player's **Ember Delve** (a
persistent, diggable, buildable tile mine with four biomes) and the **Homestead** (the
Cookie-Clicker idle economy as buildings). Stations (Market, Gambler, Exchange, Crafting Bench,
Enchanting, Rune Forge, Vault, Codex, …) open as in-world panels; standalone URLs still prerender
for SEO and open into the world. The navbar is just Play + Character.

Core systems: tools are verbs (pickaxe/axe/sickle/staff tiers, scaled by skill level), one 1–99
skill curve, crafting with Smithing/Enchanting mini-games, a stacking inventory with the Vault,
canon NPCs and keepers, the Rune Forge, and a (flagged-off) player auction house.

## 2. Rules the owner set (non-negotiable)

1. **Everything needs a meaning.** Every item, material, block, stat, NPC, creature and station has
   a source, a use, a canon/lore tie and player-visible Found in / Used for. Wire it up or remove it.
   `npm run check:meaning` (baseline-gated, runs in CI) enforces it.
2. **Decide like a AAA game.** The owner delegates design calls; make them (with the reasoning), don't
   bounce options back. References: **Terraria** for art, HUD and feel (mobile HUD = Terraria mobile);
   POE2 for inventory/stash; Zelda/Souls/Minecraft onboarding norms.
3. **Art = Terraria-style pixel art.** 16×16 art-pixel tiles at 2× on 32 px cells, auto-tiling,
   saturated biome palettes, parallax, chunky outlined sprites. Bible: `docs/art/style-guide.md`;
   briefs: `docs/art-commissions/`; importer: `scripts/import-assets.py` (never hand-write `assets/`
   paths — use `artFor()` / `spriteFor()`).
4. **Gold only, never real money** for anything game-like (reels, gambler, market). No path from
   donations to in-game currency. Show odds; no deceptive near-misses; RTP < 100% (a Gold sink).
5. **"For dummies" stations:** one plain primary action with its cost; everything else behind Details.
6. **Phones are first-class:** ≥44 px targets, nothing over the centre 50% of the world, measured
   unobstructed-world ≥65%. Desktop with a mouse must stay pixel-identical when phone work lands.
7. **Zero players today** — breaking save changes are fine; still build for future players: never
   delete items on overflow/merge, all saved state through the save gateway, merge-safe.

## 3. Working rules (for agents)

- Simplest thing that works; surgical diffs; every changed line traces to the task.
- Work in an isolated git worktree (several agent sessions commit here concurrently).
- The repo sits in a synced folder: never `git add` files named `<name> 2.*`; if `git fetch` fails
  with `bad object refs/... 2`, move the duplicate ref aside (see memory).
- Never deploy the player market (rules/indexes/functions/flags) without the owner. CI deploys only
  hosting + Firestore rules/indexes, never Cloud Functions.

## 4. The merge gate

```bash
npm run -s check:meaning
npx tsc --noEmit -p tsconfig.app.json
node --test scripts/seamworks-engine.test.cjs scripts/homestead.test.cjs scripts/home-forge.test.cjs
node scripts/check-ds-adherence.js
node scripts/check-i18n-keys.js
node scripts/audit-nav.js
node scripts/economy-sim.mjs --check
npm run build            # initial total must stay < 1.85 MB; revert src/sitemap.xml afterwards
node scripts/verify-csp-hashes.js
PW_PORT=<own port> npx playwright test e2e/play- --project=chromium
```

`npm run build` (not `npx ng build`) also stamps the build id the update prompt relies on.
New player-facing text goes in **lazy** i18n tables (EN + ES), never the eager table.

## 5. Where things live

```
src/app/play/                 the world: side-scroller host, HUD, engine/ (terrain, tile-art,
                              lighting, parallax, sprite, rigs), world/ (towns, stations, panels, i18n)
src/app/shared/               game systems: rpg/ (inventory, layout, item groups), vault/, skills/,
                              crafting/, economy/, rune-forge/, minigames/, npc/, save/, pwa/, games/
scripts/                      gates, importer, economy sim, meaning check
docs/roadmap/world-plan.md    the tracker — start here
docs/handoff/*.md             one handoff per shipped feature
docs/world/                   meaning audit, lore addendum (new lore pending owner review)
docs/inventory/, docs/economy/, docs/art/, docs/cleanup/
e2e/play-*.spec.ts            the playtest suite (run with your own PW_PORT)
```

Canon lore lives outside the repo: `~/Documents/1. Projects/Eclipse Realms/docs/03-lore-and-design/`.
