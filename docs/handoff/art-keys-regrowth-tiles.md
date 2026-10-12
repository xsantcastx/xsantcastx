# Handoff: Delve creature art keys, saved gathering regrowth, `Sprites/Tiles` importer

## 1. The Delve's creatures have their own art keys

In `towns/infernal.ts`, the Magma Maw now spawns as `creature: 'magma-maw'` and the Rune-Warden as `creature: 'rune-warden'`. Nothing changes on screen yet:

- **Art.** `ART_ALIAS` in `art.ts` maps `rune-warden` → `mirror-substitute` and `magma-maw` → `rivet-maw`.
- **`artFor` change.** `artFor` now checks the id's own key first and only then its alias. Every alias is therefore a stand-in, so importing a `rune-warden` painting takes over with no code change, and the alias row becomes housekeeping. When this change was made, no aliased id had art of its own, so it changed nothing on screen. `art.spec.ts` pins this.
- **Rigs.** `creature-rigs.ts` adds `magma-maw` (a copy of `RIVET_MAW_CREATURE`) and `rune-warden` (a copy of the new exported `MIRROR_SUBSTITUTE_CREATURE`). Each copy has the same bones, pose, box and ground as the creature it stands in for. Give each its own spec when its painting lands.
- **Kill events.** `onKill` now reports the new keys. Nothing keys off the creature id yet: Hunting XP is paid by HP.

## 2. Gathering regrowth survives a reload

**Save format.** The save is a new blob, `godforge-gathering`. It is synced as `progress/gathering`, registered in `SYNCED_BLOBS` (the spec's pinned list includes it), and registered with `LocalSaveRegistry`:

```
{ version: 1, areas: { 'rootglass-thicket': { 'starlight-clump': 1760000000000 } } }   // epoch ms of the last harvest
```

- **Model.** `shared/skills/gather-save.model.ts` handles coerce, record, prune and merge, plus `regrowSecondsLeft`.
- **Service.** `gather-save.service.ts` writes through on each harvest, because harvests are rare. On rehydrate it fires `reloaded$`, and the play view calls `engine.setGathering()`.
- **Merge.** For each node, the later stamp wins. The merge is commutative and idempotent, and a replayed or older stamp never rewinds a node.
- **Pruning.** On write, stamps older than 24 h are dropped. The slowest node regrows in 75 s, so the blob never holds a history.
- **Size limits.** At most 64 areas, with at most 64 nodes in each.
- **Why it is not in the Delve save.** `godforge-delve` is one Delve: a seed, a dig diff keyed by layout, and a merge built on the rule that two seeds are two different Delves. Gathering nodes are in every realm's hunts and have nothing to do with that seed. Folding them in would make that merge carry a second, unrelated rule.

**Engine.** The new options are `gathering: GatherPersistence` (with `harvestedAt` and `harvested`) and `now()`, the wall clock, which tests fake.

- Each `GatherSite` stores only `at`, the harvest time. `ready` and `timer` are derived from `at` against the clock on every step, never counted down.
- So a reload, an open panel or another device all agree on how far along a node is.
- A stamp from the future (a fast clock on another device) counts as "just harvested", so a node is never locked for longer than one respawn.
- A refused grant saves nothing.
- Mutation ids are unchanged (`gather:<session>:<area>:<node>:<gen>`).

## 3. Importer: the `Sprites/Tiles` family (spec W7)

`scripts/import-assets.py` gained `import_tiles` and `write_tile_manifest`.

**What it accepts.**
- Opaque strips on the 32 px grid. The sidecar is optional, and without one the W7 layout is inferred from the sheet.
- Tiles skip the cut-out corner guard. That is the only guard they skip. In its place they get the opposite check: any pixel with alpha below 250 is rejected.
- The guard still applies to every other sprite family. A test pins this.

**What it emits.**
- Output is lossless, like the sprite path: `@2x` plus an exact `@1x` reduce, under `assets/game/sprites/tiles/`.
- Tiles are kept out of the sprite manifest. They go to `tile-manifest.generated.ts` instead, which defines `TILES` and `tileFor(nodeId)`, keyed `tile-<node id>`.
- `art.ts` re-exports both.
- `tileFor` returns null until a strip lands. The renderer is not wired to it yet and keeps drawing code tiles.

**Running it.**
- `--check` prints `tiles: N ok`, rejections and a pending folder. Today `Sprites/Tiles` does not exist yet, so it is reported as pending.
- `--manifest-only` also writes the tile manifest.

## Tests

- **Engine tests** (`node --test scripts/seamworks-engine.test.cjs`): 72 pass. Four are new: regrowth across a reload, refusal plus the cloud re-read plus the clock-skew clamp, the save model, and the creature keys and rigs. The old regrowth test now advances a fake clock.
- **Importer tests** (`python3 scripts/import-assets.test.py`): 7 tests, which need Pillow and are skipped without it. They cover acceptance of opaque tiles, lossless output, manifest and `tileFor` text, rejection of see-through, off-grid, misnamed and wrong-action tiles, check mode and the pending folder, and that props keep the corner guard.
- **Karma:** `art.spec` (stand-ins, `tileFor`), the cloud-save key list, and `shared/skills`: 109 of 109 pass.
- **Other checks that pass:** homestead (10), home-forge (7), ds-adherence, i18n, audit-nav, and `tsc` for app and spec.

## Open

- Wire `tileFor` into `terrain-render.ts`: pick a variant by cell hash and fall back to the code fill when it returns null.
- Paint `rune-warden` and `magma-maw` and give them their own rigs, then delete their `ART_ALIAS` rows.
- The plan's watch-list line about session-only regrowth can be closed. This change did not edit the plan doc.
