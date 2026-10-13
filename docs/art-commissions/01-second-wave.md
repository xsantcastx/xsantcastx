# Second wave - what to make first

Added 2026-10-13 for everything shipped after the first pack: Skills and tools, Ember Delve (engine, persistence and biomes, building, lore and missions), the Homestead and Home forge. **94 new files** (66 world sprites, 28 menu files; the pack then totalled 223, and 229 with the Delve extras). Every id below is the id the code uses, and every brief is in [INVENTORY.md](INVENTORY.md) and [commissions.csv](commissions.csv).

> **Rewritten for pixel art (2026-10-13).** The whole wave now follows the art bible, [docs/art/style-guide.md](../art/style-guide.md): tools and Delve kit are 32 x 32 I1 icons, tiles are 16 x 16 art px (W7a auto-tile sheets for terrain, W7 strips for features and back walls), placeables are W6 cell props. Ids and library paths did not change.

## Importer status (code, not art)

The `Sprites/Tiles` family now exists (`import_tiles` in `scripts/import-assets.py`, manifest `tile-manifest.generated.ts`), so W7 feature strips and W7b back walls import today. The **W7a auto-tile sheets** do not yet: the tile importer accepts only a one-row `tile` strip, and the terrain renderer does not read neighbours (style guide IMP-1, RND-1). Until then, import row 0 of a W7a sheet alone (256 x 64 with the one-action sidecar) to see the interiors. Everything else below imports today (`Sprites/Props`, `Sprites/Buildings`, `Sprites/NPCs`, `Sprites/Creatures`, `Items/**`, `Creatures/Masters`).

## Make these first (in this order)

The Delve is the part of the game a player is staring at the most, and its tiles and kit are currently flat colour fills and borrowed paintings. Eight tile sheets and four icons from this wave are already in the [first test set](00-first-test-set.md) (`tile-dirt`, `tile-rock`, `tile-hard-rock`, `tile-bedrock`, `tile-cinder-vein`, `tile-grotto-stone`, `tile-scorched-basalt`, `tile-basalt-block`; `pickaxe-1`, `torch`, `dirt-block`, `glowcap`, `kaels-hammer`). After the A/B verdict, in this order:

| # | Asset | Id | Save as | Why first |
|---|---|---|---|---|
| 1 | Torch (flame loop) | `tile-torch` | `Sprites/Props/22-tile-torch.png` | placed in the dark, always on screen |
| 2 | Ladder | `tile-ladder` | `Sprites/Props/23-tile-ladder.png` | must tile vertically |
| 3 | Pickaxe II..IV | `pickaxe-2`..`pickaxe-4` | `Items/ArtBible/Tools/125..127-pickaxe-N-idle.png` | the tiers every player forges next; they also replace hammers wearing a pickaxe's name |
| 4 | Chest (closed / open) | `tile-chest` | `Sprites/Props/25-tile-chest.png` | first Delve storage |
| 5 | Camp (fire loop) | `tile-camp` | `Sprites/Props/26-tile-camp.png` | the descend-to-your-camp anchor |
| 6 | Axe, Sickle, Staff I..IV | `axe-1`..`staff-4` | `Items/ArtBible/Tools/128..139-*` | the other 12 tool icons |
| 7 | Back walls | `tile-wall-*` | `Sprites/Tiles/22..25-tile-wall-*.png` | behind every dug cell; they import today |

Then, same batch if time allows: the other Delve tiles (P0 first: `tile-packed-dirt`, `tile-roots`, `tile-shadow-root`, `tile-glowcap`, `tile-ember-rock`, `tile-slag-vein`, `tile-heartstone-vein`, `tile-cracked-wall`, `tile-kaels-cache`, `tile-godforge-fragment`), `tile-platform`, and the remaining Delve kit and quest icons (`ladder`, `platform`, `chest`, `camp`, `basalt-block`, `shadow-root-cutting`, `godforge-fragment`).

## Priority summary

| Priority | Count | What |
|---|---:|---|
| P0 | 51 | 16 tools, 11 Delve kit / material / quest icons, 16 core tiles, 5 placeables, `node-cinder-ore`, `hs-anvil-1`, `hs-circle-1` |
| P1 | 32 | the rest of the tiles and back walls, `tile-inscription`, Homestead buildings and automatons, `homestead-forge`, the Delve creatures and Rune-Warden master, the Slag, Heartstone, World-Root and Starlight nodes, `hs-anvil-2..4`, `hs-circle-2..4` |
| P2 | 11 | ten gathering nodes (realm herbs, trees, crystals, Emberheart) and `homestead-workshop-hammer` |

The first test set (2026-10-13) moved `tile-grotto-stone` and `tile-scorched-basalt` from P1 to P0 (they prove the Glowcap Grotto and Magma Halls palettes); the counts above are as the wave was added.

## The rules for tiles

1. **16 x 16 art px, exported x4.** Interiors (W7a row 0, W7 strips, back walls) are seamless on four edges and opaque to every edge; no baked glow past the cell (the engine draws halos and crack stages over the tile).
2. **Edges belong to the sheet, not the interior.** Top faces get a 2 art px lit lip, sides and bottoms a 1 px outline and bevel, outer corners round off (transparent there only). Layout and neighbour rules: style guide §7.1.
3. **Four variants per row**, picked by cell hash, all repeating cleanly next to each other.
4. **Distinct at 32 px.** Cinder (orange seams), Slag (teal glass) and Heartstone (rose-red facets) must be told apart at a glance; placed blocks (`tile-packed-dirt`, `tile-basalt-block`) must read as laid masonry against the natural wall.

## Verified, nothing to commission

- **NPC shopkeepers** are all already in [world-sprites/03-npcs.md](world-sprites/03-npcs.md): the material buyback clerk is `npc-material-vendor` ("MATERIAL VENDOR", it buys and does not sell), plus `npc-croupier`, `npc-exchange-broker` and `npc-expedition-steward`. These four are marked "proposed role, name TBD": **their names still need owner approval** before they speak or are named in any art file.
- **Fracture rune** (`fracture`, `Items/Runes/14-fracture`) and **Codex Solarii** (`codex-solarii`, `Items/Artifacts/32-codex-solarii`) are already painted and in the manifest.
- Material icons for the 15 gathering nodes (`cinder-ore`, `starlight-herb`, `void-crystal`, ...) are already painted; they are re-iconed in the later pixel re-icon wave. The node sprites match the material's realm palette.

## ART_ALIAS rows that retire as files land

`src/app/shared/art/art.ts` currently stands in for these ids. Delete the row when its file is imported: `pickaxe-1..4`, `axe-1..4`, `sickle-1..4`, `staff-1..4` (16), `shadow-root-cutting`, `glowcap`, `godforge-fragment`, `kaels-hammer`, `dirt-block`, `basalt-block`, `torch`, `ladder`, `platform`, `chest`, `camp` (11). Note `staff-1` and `staff-2` both alias `keeper-staff` today. Delve extras (added later): `timber-support`, `basalt-support`, `blast-charge` (3) borrow `world-root-bark`, `godforge-slag` and `ember-stoker`; briefs at the end of `menu-paintings/07` and `world-sprites/05`.

## Id and path notes (code vs. canon)

- Delve tile ids follow the terrain node ids in `src/app/play/engine/terrain.ts`: **Basalt is `rock`, Hard basalt is `hard-rock`**, and the placed Dirt block is the node `packed-dirt` while its item stack is `dirt-block`. The tile art is `tile-packed-dirt`; the menu icon is `dirt-block`.
- The Delve's two enemies borrow other creatures: the engine spawns `creature: 'mirror-substitute'` named Rune-Warden and `creature: 'rivet-maw'` named Magma Maw (`towns/infernal.ts`). The new `rune-warden` and `magma-maw` sprites need the engine to switch to those keys; until then the old sprites keep working.
- `kaels-hammer` is a quest stack key with no `ItemDefinition`; its art resolves through `artFor` only.
- Numbering: tools continue the Art Bible after unique 123 (`124`-`139`); `Items/Materials` continues from 14; `Items/Quest` from 05; `Creatures/Masters` from 11; the sprite families continue each family's own count.
