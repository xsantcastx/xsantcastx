# World meaning audit

Owner rule (2026-10-13): *"Everything, every NPC, every block needs a meaning
in this world."* Every item, material, block, stat, NPC, creature and station
needs:

1. a **source**: a drop table, terrain yield, gathering node, recipe output,
   expedition, mission/quest/collection/arena reward or Gambler pool;
2. a **use**: a recipe/forge/refine/infusion input, a mission delivery, a
   placeable, a stat the game reads when the Keeper wears it, a tool that works
   a node, an NPC role that opens a station or gives a quest;
3. **world meaning**: a lore line or a canon tie;
4. **visibility**: a display name, a "Found in…" line, a description or a
   tooltip.

The game has **zero players** (owner, 2026-10-13), so removing or renaming
costs nothing: no save migration, and terrain node indices (the saved byte)
may be reordered. When something has no natural canon tie, this audit
recommends **remove** over inventing a use. No new canon names are proposed;
where a fix needs a name, it uses one that canon already has.

## How it is checked

`npm run check:meaning` (`scripts/check-meaning.js`) loads the real tables
(`ITEM_DEFINITIONS`, `CRAFTING_RECIPES`, `FORGE_EQUIPMENT_RECIPES`,
`REFINE_RECIPES`, `INFUSIONS`, `TERRAIN_NODE_LIST`, `PLACEABLES`, every
`TownDef` and hunt, the gathering tiers, the expedition material tables,
`VENDOR_SHELF`, `EXCHANGE_CATALOGUE`, `ARENA_SHOP`, `COLLECTION_REWARDS`,
`NPC_CHAINS`, `DELVE_MISSIONS`, `MYSTERY_BOXES`, `RUNES`, `RUNEWORDS`,
`SOCKET_CHANNEL`, `SOCKET_WORDS`, `ITEM_STAT_KEYS`, `STAT_DEFINITIONS`,
`NPCS`, `DIALOGUE`, `TOWN_KEEPERS`, `PANEL_REGISTRY`, the Codex Bestiary).
It transpiles them the way `seamworks-engine.test.cjs` does, builds the
source → thing → use graph and fails only on violations missing from
`scripts/meaning-baseline.json`. `--explain <id>` prints one thing's sources
and uses. `--update-baseline` accepts the current state; shrink the baseline
in the same commit as each fix below. It is **not in CI yet**.

Two kinds of source and use are counted separately: the simulated Exchange as
the only source (`market-only-source`: it sells from thin air) and selling as
the only use (`sell-only-use`).

## Current state

| Category | Things | Violations at `692c7f1` | Now |
|---|---:|---|---|
| block (Delve terrain) | 31 | no-yield-or-purpose 1 | none |
| material | 52 → 37 | not-visible 16, no-lore 6, no-use 3, sell-only-use 2, found-in-omits 1 | none |
| npc (canon, keepers, townsfolk) | 27 | no-role 5 | none |
| stat (item + allocated) | 11 → 10 | keeper-never-reads 1 | none |
| rune (Forge ledger) | 25 → 22 | none | none |
| item | 135 → 131 | twin-definition 5, no-source 2, market-only-source 1 | none |
| creature | 12 → 11 | never-spawns 5, no-lore 2 | never-spawns 4 (#16) |
| station / panel | 46 → 45 | never-placed 1 | none |
| **Total** | | **51** | **4** |

The fixes landed one commit each (the Fixed column); `scripts/meaning-baseline.json`
shrank with each. Owner decisions of 2026-10-13 settled #11, #12 and #14 (see
[lore-addendum.md](lore-addendum.md) for the rune merges and the lines written
for the game). The detail tables below are the audit as found at `692c7f1`.

## Prioritised fixes

Ordered by what a player meets first: the Delve, early materials, keepers and
townsfolk, the Keeper Stats sheet, then runes and sigils.

| # | What | Fix | Type | Fixed |
|---|---|---|---|---|
| 1 | **Ember-veined basalt** (`ember-rock`) is the most common Delve vein (38 vein blobs + 5 stamps, rows 6–54) and gives **nothing** when broken: no yield, no block, 0 XP | **Wire it:** `yield: { materialId: 'ember-residue', qty: 1, chance: 0.25 }`, `xp: 1`. In-game lore for Ember Residue: "What the strike leaves when the ore has already given its heat." Ember Residue is the scarce input of the Basalt Edge (goal 2 of the first session), and today the Delve grants it only from the Keeper's cache. "Found in…" picks it up on its own | data (`play/engine/terrain.ts`) | `9562a0a` |
| 2 | **World-Root Bark**: "Found in…" never names the Ember Delve, though petrified trunks in the Root Hollows yield it | `found-in.data.ts` `terrainNodes()` reads only the top-level `bands/veins/stamps` and misses `biomes[].veins`. Add them. Then the hand-kept `DELVE_MATERIALS` map only needs Kael's Hammer (a stamp in no vein) | code (one line) | `3608471` |
| 3 | **Sigils**: every rune find mints a `"<Rune> Sigil"` item with empty stats (`mintRuneItem`). Socketing reads the Forge ledger, not the sigil, so the sigil's only use is a 300 Gold sale. They fill the satchel (see `docs/inventory/inventory-spec.md` §1.2) | **Remove:** stop minting sigils in `RuneForgeService.mintFor`; the ledger rune is the thing. Clean up `mintRuneItem`, the `sigil:<runeId>` stack key planned in inventory S2, the Bank's rune rows, `collectionIdForItem`'s rune branch. **Coordinate with the inventory agent**: S2 plans to stack sigils, and under this rule they should go | code | open (Sigils agent) |
| 4 | **Endurance** (Keeper allocated stat) says "+10% mission length" per point, but the number feeds the expedition **reward** `yieldMultiplier` (`explorer.service.ts:424`). Duration never changes | Fix the words, not the formula: `unit` "expedition haul", `format` "+N% expedition haul". The flavour ("They simply stop turning back") already fits | data (`player-stats.model.ts` + any i18n copy) | `a89928f` |
| 5 | **Loot quality** (`lootBonus`) is on the Keeper Stats sheet and on 4 charms (Sunstone Dowser, Starweaver's Thread, Thornseeker Beetle, Cinder Compass) and 3 runes (Seam, Ledger, Codex socket into it). **Worn by the Keeper it changes nothing.** The only formula that reads it, `explorerLootBonus` (`explorer-roster.model.ts:247`), adds it to Magic Find | **Remove the stat; fold it into Magic Find**, the only formula that reads it already adds the two together. Clean up: `ITEM_STAT_KEYS` / `ITEM_STAT_LABELS` / `ITEM_STAT_IS_PERCENT`, `SOCKET_CHANNEL` (seam, ledger, codex → `magicFind`), `SOCKET_LADDER.lootBonus`, `socket-words.ts`, `STYLE_LOOT` in `item-definition.ts`, charm `rollKeys` in `artbible-items.ts` and `unique-items.ts`, `thrall.model.ts`, `explorer-progression.ts`, `build-identity.ts`, the bench and equipment panel labels | code | `0be5bfc` |
| 6 | **Townsfolk** (15 wanderers in 5 towns) have no line, station or quest | **Wire them as guides**, no new canon: each townsperson speaks one line naming where a local material is found, generated from `foundInWorld()` ("Sunbloom grows in the Reflection Channels"). This uses the data the game already has. Faction lines would need the narrative bible's faction names, which are **proposals pending owner approval** (e.g. "The Crucible Covenant (proposed). Smiths, salvagers, and heatwardens…"). Otherwise remove them: `TOWNSFOLK_COUNT` → 0 and delete `TownsfolkCrowd` | code + i18n | `bdea7c1` |
| 7 | **Rift Key** (Foraging discovery, about 1 in 1,000) has no use; it only sells on the Exchange, and has no "Found in…" | Canon codex: "A shaped absence that opens a route only when the route's two ends acknowledge each other." The world has no locked route for it to open, and the Waystone is free. **Remove** unless a sealed route is built. Clean up: `RIFT_KEY_ID` + discovery roll in `foraging.model.ts` / `foraging-ops.ts`, the result union in `activity.model.ts`, `activity-ops.ts`, `CONSUMABLE_SEEDS` + `SEED_LORE` + names in `collection.model.ts`, `MATERIAL_NAMES`, the Exchange row, `rootglass-canopy.component.ts` + `canopy.discovery.*` keys | code (remove) | `820801b` |
| 8 | **Clarity Elixir** (Prospecting discovery, about 1 in 1,500): no use, only sells; no "Found in…" | Canon codex: "sharpens a single observation while muting the temptation to turn it into a total explanation." **Wire it** like Ember Elixir: an `ITEM_DEFINITIONS` consumable (`type: 'charm'`, `rollKeys: ['magicFind']`). The discovery then mints that item instead of a stack. Add the discovery to "Found in…" (Meridian Orrery) | data + code | `3c6dafd` |
| 9 | **Ember Elixir**: equippable charm whose only source is the simulated Exchange | Canon (narrative bible): "It lets a bearer endure a moment of heat distortion." **Wire a source:** a `craft-ember-elixir` consumable recipe (Ember Residue + Infernal Heartstone), matching the Collection hint "brewed from what a hot seam leaves behind". Change its `rollKeys` to `['ward']` so the stat matches "endure" | data | `9475558` |
| 10 | **Fourteen expedition materials have no "Found in…"** (Void Crystal and the 13 "Rune of …" reagents) | `buildFoundInIndex()` names expedition sources only from `VENDOR_SHELF`. Read `REALM_EXCLUSIVE_MATERIALS` and `REALM_ARTBIBLE_MATERIALS` too ("Umbral expeditions") | code (small) | `89e79e2` |
| 11 | **"Rune of …" reagents** (13 Art Bible materials). Three are used by **nothing**: Rune of Dawn's Edge, Rune of the Root, Rune of Overgrowth. All 13 duplicate the canon idea of a rune: the item lore codex calls runes "compact principles of the Godforge", the 22 on the Forge ledger | **Remove the three unused ones** (`artbible-items.ts`, `REALM_ARTBIBLE_MATERIALS`; the Collection catalogue follows). **Owner call** on the other ten (canon): rename them away from "Rune of", or replace each recipe reagent with a ledger rune. The second option needs recipes that consume ledger runes (code) | data (3) + canon (10) | `59a3981` (3 removed), `c4a18ac` (10 merged into Forge runes) |
| 12 | **Rune ledger names outside canon**: Mote, Seam, Ledger are on the anvil but not in the codex's rune table (Ash … Void, 22 runes) | Owner call (canon). They are wired (sockets, socket words) and have lore. Either approve them into canon, or remove them and move their socket words (mothlight, wayfarer, archivists-ledger, codex-of-the-unmade) to canon runes | canon | `90c0341` (all three removed) |
| 13 | **Artifacts with two meanings**: Obsidian Heart, Mirrorblade of Kael, Relic of the Third Dawn, Codex Solarii and Fragment of the First Sun are both an Essence-shop flag (`ARTIFACTS`, e.g. Obsidian Heart: "the forge keeps earning while the tab is hidden") and an equippable item with different stats (Obsidian Heart: +12 Gold/sec). Mirrorblade and Fragment items have **no source** at all | **One meaning per name.** The codex files them under "Singular artifacts", and one of each is what the flag models. Keep the Essence flags; delete the five item definitions; make `aureth-2`, `verrin-2`, `archivist-2` and `delve-archivist-words-3` grant the flag instead of an item. Clean up the uniques' `ART_ALIAS` and the Collection catalogue rows for the items | code | `472f521` |
| 14 | **Magma Maw and Rune-Warden** (Delve creatures): not in the creature atlas, no Bestiary entry, and both drop only coins + Cinder Ore (the area table). The Rune-Warden is the one-per-player fragment guardian | Use atlas names, as every other creature does (the atlas marks names non-canon until owner approval). Rune-Warden → **Seam Eater**, the Infernal boss that "Rises from the deepest failed repairs". Magma Maw → **Cinder Bailiff** ("stamps heat debts onto shortcuts"), which also fixes Cinder Bailiff never spawning. Give each a drop table (Bailiff: Infernal Heartstone, Ember Residue) and a Bestiary entry. Rename the art keys, `play.creature.*`, the rigs and `ART_ALIAS` | data + canon | `639aa89` |
| 15 | **Delve materials without lore**: Shadow-Root Cutting, Glowcap, Godforge Fragment, Kael's Hammer, plus the Dirt and Basalt blocks | Add `SEED_LORE` rows. Reuse in-game text, no new canon: Verrin's mission ("Under the Godforge a tree grows downward, toward the crack."), the Grotto inscription ("The glowcaps do not make their light…"), Kael's ("My hammer is still down there."), and canon for the fragment: the Keeper is "capable of safely carrying Godforge fragments" (lore and art-direction canon). One functional line for each block | data | `eb48264` |
| 16 | **Bestiary creatures that never spawn**: Afterimage Moth, Anchor Warden, Ink Lantern, Graftling (and Cinder Bailiff until #14) | Atlas creatures; `BESTIARY` hides them until painted, so the player does not see them yet. When the art lands, add each as the second creature of its atlas haunt with a zone drop table (data). Until then, leave them | data (later) | open (until their art and spawns land) |
| 17 | **Panel `character`** is a `PanelId` with a registry loader, but no station opens it and nothing deep-links to it | **Remove** it from `PanelId`, `PANEL_IDS` and `PANEL_REGISTRY` (the Character page stays a route and the HUD overlay) | code (small) | `d0da60d` |

## Full list by category

The script output is the source of truth. This table only adds the fix
number.

### Blocks (Delve terrain)

| Node | Violation | Fix |
|---|---|---|
| `ember-rock` | no yield or purpose | #1 |

All other 30 nodes are generated or placeable and yield a material, give a
block, are placeable, or have a structural role (`air`, `bedrock`,
`cracked-wall`, a staff gate, `inscription`, the Archivist's walls).
`hard-rock` and `petrified-trunk` only appear in biome veins.

### Materials

| Id | Violations | Fix |
|---|---|---|
| `world-root-bark` | found-in-omits (Ember Delve) | #2 |
| `rift-key` | no "Found in…", sell-only-use | #7 |
| `clarity-elixir` | no "Found in…", sell-only-use | #8 |
| `void-crystal` | no "Found in…" | #10 |
| `rune-of-dawns-edge`, `rune-of-root`, `rune-of-overgrowth` | no use, no "Found in…" | #11 (remove) |
| `rune-of-radiance`, `rune-of-the-solstice`, `rune-of-hollow`, `rune-of-erasure`, `rune-of-starfire`, `rune-of-void-navigation`, `rune-of-the-world-root`, `rune-of-the-forge`, `rune-of-cinder`, `rune-of-the-underhearth` | no "Found in…" | #10, then #11 |
| `shadow-root-cutting`, `glowcap`, `godforge-fragment`, `kaels-hammer`, `dirt-block`, `basalt-block` | no lore | #15 |

### NPCs

| Id | Violation | Fix |
|---|---|---|
| `townsfolk:infernal` (3), `:luminous` (4), `:umbral` (2), `:celestial` (3), `:verdant` (3) | no role | #6 |

All 6 canon NPCs have dialogue and a station or quest. The Nameless is hidden
and has no station; its role is dialogue only (`priority 100`). All 16 station
keepers (canon and role-titled) open a station or the Waystone, or give
quests.

### Stats

| Stat | Violation | Fix |
|---|---|---|
| `lootBonus` (Loot quality) | Keeper never reads it | #5 |
| `forgePower`, `luck`, `endurance`, `wisdom`, `charisma` | all read (`rpg-wiring`, `magic-find`, `explorer.service`, `economy-wiring`) | Endurance's words are wrong: #4 |
| `goldPerSec`, `magicFind`, `xpBonus`, `strikePower`, `ward` | all read for the Keeper and shown on the sheet | none |

### Runes (Forge ledger)

All 25 have a source (the anvil), a use (socket channel, socket word or
runeword) and lore. Canon gaps are #12. Socketing Seam, Ledger or Codex adds
`lootBonus`, which does nothing on the Keeper (#5); they are still used,
through socket words.

### Items

| Id | Violations | Fix |
|---|---|---|
| `mirrorblade-kael`, `fragment-first-sun` | no source, twin definition | #13 |
| `obsidian-heart`, `relic-third-dawn`, `codex-solarii` | twin definition | #13 |
| `ember-elixir` | only the Exchange sells it | #9 |

### Creatures

| Id | Violations | Fix |
|---|---|---|
| `magma-maw`, `rune-warden` | no Bestiary entry (and not in the atlas) | #14 |
| `cinder-bailiff` | never spawns | #14 |
| `afterimage-moth`, `anchor-warden`, `ink-lantern`, `graftling` | never spawn | #16 |

### Stations

| Id | Violation | Fix |
|---|---|---|
| `panel:character` | no station opens it | #17 |

## Not statically checked

These need judgement or runtime, so the script cannot gate them:

- **Sigils** (#3): a minted `GameItem` with empty stats. The script reads
  definition tables, not what services mint at runtime.
- **Labels that do not match the formula** (#4, Endurance). The script sees
  that a stat is read, not what the number does.
- **Boss drop quality**: Magma Maw and the Rune-Warden pay the same coins +
  Cinder Ore as a Rivet Maw (#14). The script only checks that a creature
  drops at least one material.
- **Tool tiers**: a tool counts as used if any node accepts its family. The
  script does not check that each tier opens something new; higher tiers
  only hit harder and swing faster (another agent is changing swing cooldowns
  now).
- **Lore quality and canon ties**: the script checks that a lore line
  exists. When the canon folder
  (`~/Documents/1. Projects/Eclipse Realms/docs/03-lore-and-design/`) is on
  disk, it also prints **info only** for creatures, runes and Delve materials
  not named there. CI has no such folder, so canon never gates.
- **NPC chain objectives that are page visits** (`aureth-1`, `verrin-1` walk
  `/world/realms/*` and `/world/trials`): since the World-only navbar, unchecked
  whether those routes still count as a visit.
- **Daily/weekly quests** keyed to the old tools site (`tool-use`
  conditions): filtered by `isPlayableQuest`, not audited here.
- **Spanish copy** for any new line (#6, #15).
- **Canon items with no game presence**: the codex's Veil Draught, Broken
  Astral Compass and Rift Map Fragment are painted with lore, but the game
  has no definition for them. That is the inverse of this rule, so it is
  only reported here.
