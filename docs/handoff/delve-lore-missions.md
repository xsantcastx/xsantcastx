# Handoff: Delve lore and missions (Phase 2.6)

## Missions (data: `src/app/shared/npc/delve-missions.model.ts`)

| Id | Giver | Ask | Reward | Opens |
|---|---|---|---|---|
| `delve-verrin-shadow` | Verrin | 3 `shadow-root-cutting` (Root Hollows) | 20k Gold, 150 Delving XP | `craft-nullthorn-staff` recipe |
| `delve-kael-seam` | Kael | 10 `slag-fragment` + 1 `kaels-hammer` (Basalt Caverns cache) | 40k Gold, 200 Delving XP | `craft-pickaxe-3-seam` (Kael's Seam Pick: Pickaxe III from Delve ore, Smithing 25) |
| `delve-merchant-glowcaps` | Merchant | 5 `glowcap`, repeatable | max(3,000, 90 s of income) Gold | standing order |
| `delve-archivist-words-1/2/3` | Archivist | copy 3 / 6 / all inscriptions | 10k/30k/80k Gold + Delving XP; final mints an epic Codex Solarii | each needs the previous |
| `delve-fracture` | Kael + Archivist | 1 `godforge-fragment` (Magma Halls) | 150k Gold, 600 Delving XP, Fracture rune, lore reveal | needs Verrin, Kael and one Glowcap order |

## How it works

- `NpcQuestService` holds the missions next to the six chains, in the same `eclipse-npc` blob. One-off receipts go in `claimed`. Repeat counts go in a new `repeats` map; the cloud's structural merge takes the max per key, so no merge change was needed.
- Claim order: consume the delivery (`InventoryService.consumeStacks`, mutation id `npc-mission:<id>:<n>`, so a replay is safe), then write the receipt, then pay. Delving XP goes through `SkillActionService` (lazy import, idempotent mutation id).
- Recipe gate: `CraftingGateway.blocker` returns the new `'locked'` code until the mission is claimed. A recipe the player has already crafted stays open. Note that this now gates the existing Nullthorn Staff recipe for new players.
- UI: a "Delve Missions" section on the Quest Board (`delve-missions-board.component.ts`), mission lines and Claim in the NPC dialogue (a `?` badge when one is ready), and a tracker chip (`delve-mission-chip.component.ts`) on the Quest Board and the Skills panel.

## Codex

The Lore tab has a new "Delve Inscriptions" section, one shelf per biome. Entries stay locked until copied. The text is in `src/app/shared/delve/delve-inscription-lore.ts` (12 entries, canon-checked), keyed by id.

## Found in

- `src/app/shared/world/found-in.ts` is pure; `found-in.data.ts` builds the index. Sources: gathering tiers, every town and hunt drop table (including monster overrides), Delve terrain nodes (bands, veins and stamps mapped to their yields), and the vendor shelf plus its expedition source. A static biome map covers the four contract materials.
- Shown in the Skills panel (under each "Gather X" unlock row) and on Codex Collection material and consumable cards.
- When the Delve engine adds biome data to `TerrainSpec`, replace `DELVE_MATERIALS` in `found-in.data.ts` with a read of that data.

## Contract stubs (the Delve agent's version wins)

- `src/app/shared/delve/delve-lore.model.ts`: biome ids, 12 inscription ids, and the material ids `shadow-root-cutting`, `glowcap`, `godforge-fragment`.
- `src/app/shared/delve/delve-lore.service.ts`: `recordInscription`, `inscriptions()`, `inscription$`. It is local-only and has no cloud registration.
- On merge, align the inscription ids with `DELVE_INSCRIPTION_LORE` keys. The spec `delve-missions.model.spec.ts` fails if an id has no text.

## For the engine agent

- Place a one-time cache in the Basalt Caverns that yields `kaels-hammer`. It is a quest stack key with no `ItemDefinition` (adding one would fan out to four catalogues).
- Nodes for `shadow-root-cutting` (Root Hollows), `glowcap` (Glowcap Grotto, sickle) and `godforge-fragment` (Magma Halls, behind the rune-warden).
- These materials have no art yet. `DELVE_MATERIAL_NAMES` gives their names to the mission UI.
- The Nullthorn Staff is a weapon definition. Whether wielding it counts as a staff tool for cracked walls is decided in the engine or loadout.

## Checks

- tsc (app and spec) is clean.
- Karma: 202/202 for npc/world/crafting/collection/skills, and 11/11 for codex/quests/app.
- Engine node tests: 59/59.
- i18n, ds-adherence and audit-nav pass.
- `ng build` passes with an initial total of 1.71 MB.
