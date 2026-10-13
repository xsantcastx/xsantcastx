# Watch-list polish (handoff)

Five items from `docs/roadmap/world-plan.md` "Known issues / watch list". One commit each, plus one e2e follow-up. Not pushed, not deployed; no changes to `firestore.rules`, `functions/` or the market flags. Tick the plan's watch list in the merge that ships this (lines for the NPC bubble, the enemy bar, panel focus and "Delve hotbar text is English-only").

## 1. NPC bubble covered the mini-game's Skip at 390 px (`6997da9`)

- New `src/app/shared/minigames/minigame-presence.service.ts`: a counter signal. `AnvilGameComponent` and `RuneRitualComponent` call `enter()` in the constructor and `leave()` in `ngOnDestroy`.
- `NpcDialogueComponent` renders nothing while `active()` is true (`@if (!yielding() && presence(); as p)`). Its `--npc-lift` drops to 0 while hidden, so the install prompt moves down with it.
- The NPC widget is eager, so it imports the service file directly and never the minigames `index.ts`.
- E2E: `/forge/crafting` at 390x844 shows Kael, he goes away while the anvil is open, Skip is the element under its own centre, and he comes back after Skip. The `/play` panel variant passes too.

## 2. Enemy bar named the creature by guessing (`73af5db`)

- The engine already sent `enemyName`. It now also sends `enemyId` (the MonsterDef `creature` key) for the nearest foe it measured.
- `SideScrollerComponent.enemyName` translates `play.creature.<id>`. It falls back to the engine's English name, then to `play.creature.unknown`. The spawn-position guess is gone.
- There are 7 creature keys plus `unknown` in `src/app/play/world/life.i18n.ts`, EN and ES. A harness test checks that every creature in every town and hunt has a tag whose English matches its MonsterDef `name`. Add a key whenever you add a creature.

## 3. Focus after closing an in-world panel (`6671e9e`)

- `focusWorld()` (the canvas-after-render fix from `973e3fb`) now takes an opener. When `showPanel` runs, it records the focused control if that control has `:focus-visible` and is not the canvas. On close, focus goes back to that control if it is still connected and visible, and otherwise to the canvas. It never stays on `<body>`.
- Also fixed:
  - Choosing a row in the Places list focuses the canvas; the row unmounts.
  - Escape on the Places list focuses the Places toggle.
  - Closing the satchel while focus is inside it focuses the clasp.
- E2E: Escape on `?at=crafting` leaves `document.activeElement` as the CANVAS. Escape on the Places list returns focus to its toggle.

## 4. Delve strings EN and ES (`c026dcc`)

- The hotbar's labels and placeable names (`play.hotbar.*`, `play.place.*`) were already translated.
- What was English-only:
  - every engine line for placing and taking back, supports, charges, loose rock, the camp and inscriptions
  - chest refusals
  - the chest panel and its gear sections
  - the camp panel title and kicker
  - the prompt labels (chest, camp, inscription, enter the Delve)
  - the Delve objective
- Engine: `say(key, en, vars)` sets `message` and a key. `report()` publishes `messageKey` and `messageVars` only while `message` still equals that English, so any other `this.message = ...` retires the key and a stale translation can never show. `vars.item` is a placeable id; the HUD (`engineMessage`) fills in `name` and `lname` from `play.place.*`.
- `DelveChestService` refusals carry `key` and `vars`; the component translates them through `chestRefusal()`.
- New lazy table `src/app/play/world/delve.i18n.ts` (`play.delve.*`, about 65 keys), registered by the side-scroller. Nothing was added to the eager table.
- Harness:
  - every `play.delve.*` key used in the engine, chest service and HUD has EN and ES
  - for sampled lines (choose first, placed, needs a staff, fuse lit), the EN template filled like the HUD fills it equals the engine's English exactly
- Still English (outside this scope): item and material names from `material-catalog` (as everywhere else in the game), inscription lore text, and the non-Delve /play HUD (Places, satchel, the Seamworks tutorial lines).

## 5. Art commission briefs (`1f92088`)

- **Already there:**
  - tool tiers: `pickaxe-1..4`, `axe-1..4`, `sickle-1..4`, `staff-1..4` in `menu-paintings/07-tools-and-delve-items.md`
  - Delve tiles in `world-sprites/05-delve-tiles.md`: `tile-rock`, `tile-dirt`, `tile-hard-rock`, `tile-cinder-vein`, `tile-slag-vein`, `tile-heartstone-vein`, `tile-cracked-wall`, `tile-roots` and the rest
- **Added in the existing format**, with CSV and INVENTORY rows (totals 223 → 229; `import-assets.py --commissions` reads all 229):
  - menu icons: `timber-support`, `basalt-support`, `blast-charge` → `Items/Materials/24..26`
  - world props: `tile-timber-support`, `tile-basalt-support`, `tile-blast-charge` → `Sprites/Props/52..54`; the charge has a 4-frame fuse loop
- Loose rock needs no tile: it is the biome's own rock, and the engine draws its cracks.

## Gate

| Check | Result |
|---|---|
| `tsc -p tsconfig.app.json` and `tsconfig.spec.json` | clean |
| `seamworks-engine`, `homestead` and `home-forge` node tests | 111/111 |
| `check-ds-adherence`, `check-i18n-keys`, `audit-nav` | pass |
| `ng build` | Initial total 1.73 MB, under the 1.85 MB limit |
| `verify-csp-hashes` | pass |
| Karma: `shared/minigames/**` and `shared/npc/**` | 101/101 |
| Playwright chromium (`PW_PORT=4297`): `play-minigames`, `play-delve`, `play-hunting` | all pass after the one test-assertion fix |

## Not verified

- I did not play the Delve in Spanish in a browser. Coverage there comes from the harness and the i18n check.
- WebKit was not run.
