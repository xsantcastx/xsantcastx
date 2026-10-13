# Second wave - what to make first

Added 2026-10-13 for everything shipped after the first pack: Skills and tools, Ember Delve (engine, persistence and biomes, building, lore and missions), the Homestead and Home forge. **94 new files** (66 world sprites, 28 menu paintings); the pack now totals **223**. Same format, style blocks, transparency rules and library paths as the rest of the pack (see [README.md](README.md)); every id below is the id the code uses, and every briefing is in [INVENTORY.md](INVENTORY.md) and [commissions.csv](commissions.csv).

## Importer prerequisite (code, not art)

`scripts/import-assets.py` has no `Sprites/Tiles` family, and the sprite path rejects any sheet whose four corners are opaque. The 25 opaque Delve tiles (`Sprites/Tiles/`) therefore **cannot be imported yet**; the art can be made now. The fix is small: add `('Sprites/Tiles', 'sprites/tiles')` to `SPRITE_FAMILIES` and skip the `corners_opaque` check for that family. Everything else below imports today (`Sprites/Props`, `Sprites/Buildings`, `Sprites/NPCs`, `Sprites/Creatures`, `Items/**`, `Creatures/Masters`).

## Make these first (in this order)

The Delve is the part of the game a player is staring at the most, and its tiles and kit are currently flat colour fills and borrowed paintings.

| # | Asset | Id | Save as | Why first |
|---|---|---|---|---|
| 1 | Loose dirt tile | `tile-dirt` | `Sprites/Tiles/01-tile-dirt.png` | the most-seen tile; sets the Delve look |
| 2 | Basalt tile | `tile-rock` | `Sprites/Tiles/04-tile-rock.png` | the default wall of the Delve |
| 3 | Bedrock tile | `tile-bedrock` | `Sprites/Tiles/07-tile-bedrock.png` | floor of every cavern |
| 4 | Cinder Ore vein tile | `tile-cinder-vein` | `Sprites/Tiles/15-tile-cinder-vein.png` | the first thing a new player digs |
| 5 | Torch (flame loop) | `tile-torch` | `Sprites/Props/22-tile-torch.png` | placed in the dark, always on screen |
| 6 | Ladder | `tile-ladder` | `Sprites/Props/23-tile-ladder.png` | must tile vertically |
| 7 | Pickaxe I..IV | `pickaxe-1`..`pickaxe-4` | `Items/ArtBible/Tools/124..127-pickaxe-N-idle.png` | every player gets Pickaxe I; the four also replace hammers wearing a pickaxe's name |
| 8 | Chest (closed / open) | `tile-chest` | `Sprites/Props/25-tile-chest.png` | first Delve storage |
| 9 | Camp (fire loop) | `tile-camp` | `Sprites/Props/26-tile-camp.png` | the descend-to-your-camp anchor |
| 10 | Axe, Sickle, Staff I..IV | `axe-1`..`staff-4` | `Items/ArtBible/Tools/128..139-*` | the other 12 tool icons |

Then, same batch if time allows: the other Delve tiles (P0 first: `tile-packed-dirt`, `tile-basalt-block`, `tile-hard-rock`, `tile-roots`, `tile-shadow-root`, `tile-glowcap`, `tile-ember-rock`, `tile-slag-vein`, `tile-heartstone-vein`, `tile-cracked-wall`, `tile-kaels-cache`, `tile-godforge-fragment`), `tile-platform`, and the Delve kit and quest icons (`torch`, `ladder`, `platform`, `chest`, `camp`, `dirt-block`, `basalt-block`, `shadow-root-cutting`, `glowcap`, `godforge-fragment`, `kaels-hammer`).

## Priority summary

| Priority | Count | What |
|---|---:|---|
| P0 | 51 | 16 tools, 11 Delve kit / material / quest icons, 16 core tiles, 5 placeables, `node-cinder-ore`, `hs-anvil-1`, `hs-circle-1` |
| P1 | 32 | the rest of the tiles and back walls, `tile-inscription`, Homestead buildings and automatons, `homestead-forge`, the Delve creatures and Rune-Warden master, the Slag, Heartstone, World-Root and Starlight nodes, `hs-anvil-2..4`, `hs-circle-2..4` |
| P2 | 11 | ten gathering nodes (realm herbs, trees, crystals, Emberheart) and `homestead-workshop-hammer` |

## The three-part rule for tiles

1. **Seamless on four edges**, opaque to every edge, no baked border or glow past the cell (the engine draws halos and crack stages over the tile).
2. **Four variants per strip**, picked by cell hash, all repeating cleanly next to each other.
3. **Distinct at 32 px.** Cinder (orange seams), Slag (teal glass) and Heartstone (rose-red facets) must be told apart at a glance; placed blocks (`tile-packed-dirt`, `tile-basalt-block`) must read as laid masonry against the natural wall.

## Verified, nothing to commission

- **NPC shopkeepers** are all already in [world-sprites/03-npcs.md](world-sprites/03-npcs.md): the material buyback clerk is `npc-material-vendor` ("MATERIAL VENDOR", it buys and does not sell), plus `npc-croupier`, `npc-exchange-broker` and `npc-expedition-steward`. These four are marked "proposed role, name TBD": **their names still need owner approval** before they speak or are named in any art file.
- **Fracture rune** (`fracture`, `Items/Runes/14-fracture`) and **Codex Solarii** (`codex-solarii`, `Items/Artifacts/32-codex-solarii`) are already painted and in the manifest.
- Material icons for the 15 gathering nodes (`cinder-ore`, `starlight-herb`, `void-crystal`, ...) are already painted; the node sprites only need to match them.

## ART_ALIAS rows that retire as files land

`src/app/shared/art/art.ts` currently stands in for these ids. Delete the row when its file is imported: `pickaxe-1..4`, `axe-1..4`, `sickle-1..4`, `staff-1..4` (16), `shadow-root-cutting`, `glowcap`, `godforge-fragment`, `kaels-hammer`, `dirt-block`, `basalt-block`, `torch`, `ladder`, `platform`, `chest`, `camp` (11). Note `staff-1` and `staff-2` both alias `keeper-staff` today. Delve extras (added later): `timber-support`, `basalt-support`, `blast-charge` (3) borrow `world-root-bark`, `godforge-slag` and `ember-stoker`; briefs at the end of `menu-paintings/07` and `world-sprites/05`.

## Id and path notes (code vs. canon)

- Delve tile ids follow the terrain node ids in `src/app/play/engine/terrain.ts`: **Basalt is `rock`, Hard basalt is `hard-rock`**, and the placed Dirt block is the node `packed-dirt` while its item stack is `dirt-block`. The tile art is `tile-packed-dirt`; the menu icon is `dirt-block`.
- The Delve's two enemies borrow other creatures: the engine spawns `creature: 'mirror-substitute'` named Rune-Warden and `creature: 'rivet-maw'` named Magma Maw (`towns/infernal.ts`). The new `rune-warden` and `magma-maw` sprites need the engine to switch to those keys; until then the old sprites keep working.
- `kaels-hammer` is a quest stack key with no `ItemDefinition`; its art resolves through `artFor` only.
- Numbering: tools continue the Art Bible after unique 123 (`124`-`139`); `Items/Materials` continues from 14; `Items/Quest` from 05; `Creatures/Masters` from 11; the sprite families continue each family's own count.
