# Ember Delve: per-player persistence, biomes, inscriptions (handoff)

## What works now
- **Each player has their own Delve.** A uint32 seed is rolled once (on the first Delve entry) and saved. The engine runs `generateTerrain(spec, seed)` and then lays the saved diff over the result. Everything dug or placed stays. Hand stamps and carved walls are the same for everyone. With no save (SSR, tests) the spec's fixed seed is used.
- **Save blob `godforge-delve`** (`src/app/shared/delve/delve-save.model.ts`, owned by `DelveSaveService`). It is synced through `SYNCED_BLOBS` as `progress/delve` and registered with `LocalSaveRegistry` (flush + rehydrate):
  `{ version: 1, seed, createdAt, areas: { 'ember-delve': { layout: '120x56:v2:<seed>', cells: 'idx36.kind36,…' } }, claimed: [] }`.
  Cell changes are debounced 1.5 s, then written through the gateway. A diff saved under a different `layout` (grid shape, spec `version` or seed) is dropped on load, never misapplied. **Bump `terrain.version` whenever bands, veins or stamps change.**
  Merge: the earliest-rolled seed wins, diffs dug in the same layout are unioned (local wins a disagreeing cell), `claimed` is unioned.
- **Engine API:** `options.delve` / `engine.setDelve(p)` (a `DelvePersistence`: `seed`, `cells`, `changed`), `placeCell(col,row,nodeId)` (a stub: no cost or reach check yet), `onDiscover({kind:'inscription', id, biome})`. EngineState adds `biome` and `enemyName`.
- **Biomes** are data in `EMBER_DELVE.terrain.biomes`, which is now 56 rows deep. Each biome sets the tunnel wall palette, a darkness tint, a soft-light wash, ambient particles (pool of 48) and its own veins. Magma Halls also gets heat shimmer. Exposed glowing cells cast coloured additive halos. Reduced motion turns off the particles and freezes the shimmer.

| Biome | Rows | Band node | Nodes / features |
|---|---|---|---|
| Root Hollows | 0–11 | dirt, root-loam | roots, petrified trunks, **shadow-root** (sickle/blade, Foraging → `shadow-root-cutting` 75%) |
| Basalt Caverns | 12–25 | rock | Cinder, Slag, hard rock, Maw cavern, sealed cache pocket |
| Glowcap Grotto | 26–39 | grotto-stone | **glowcap** (sickle/blade, Foraging → `glowcap`), blue light, glowcap cavern |
| Magma Halls | 40–55 | scorched-basalt | Heartstone, ember-rock, shimmer, Magma Maws (110 HP), fragment chamber + **Rune-Warden** (Mirror Substitute art/rig, 260 HP), **godforge-fragment** node (Delving, once per player) |

- **Inscriptions** (`delve-lore.model.ts`, 8 ids with placeholder text): roots-inverse-tree, roots-keepers-tally, basalt-kaels-mark, basalt-sealed-pocket, grotto-light-through-the-crack, grotto-drowned-lamp, magma-the-fracture, magma-warden-oath. Each is a non-solid carved backdrop cell. Press E beside one, or tap it, to read it. `DelveLoreService` (`recordInscription`, `inscriptions()`, `inscription$`; blob `godforge-delve-lore`, synced) records the reading. The play view pays 15 Delving XP on the first reading only (mutation id `delve-inscription:<id>`).
- **Fragment once per player:** the dug cell persists in the diff. Separately, `claimed` makes the host pay nothing on a second break.
- **New materials** in `material-catalog.ts`: shadow-root-cutting, glowcap and godforge-fragment. Their art is stand-ins via `ART_ALIAS`: thornroot, nightbloom and godstone.
- **Header:** the h1 shows the area name ("Ember Delve") and the realm tag adds " · <biome>". The enemy bar names the nearest creature on the Keeper's level (within 900 px in a delve, 1500 px elsewhere) and hides when there is none.

## Art needed
- Material icons: shadow-root-cutting, glowcap, godforge-fragment.
- A Rune-Warden creature painting and rig.
- Optional: tile art for the new nodes.

## Not done
- Placing blocks has no satchel cost, reach check or UI. `placeCell` is only the engine seam.
- Monsters respawn after 8 s, the Rune-Warden included. It is not a real boss yet, and the fragment is not gated on the warden's death.
- The Codex and Archivist missions should read `DelveLoreService` and the new materials (that is the lore agent's work).

## Tests
`node --test scripts/seamworks-engine.test.cjs` now runs 50 tests. The 7 new ones cover:
- seeds vs. stamps
- the persistence round-trip
- layout drop
- merge
- biome bands and the enemy bar
- the fragment paying once
- inscriptions being recorded once

Karma: the cloud-save model spec pins the two new keys.
