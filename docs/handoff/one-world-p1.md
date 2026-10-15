# One World — Phase 1 (handoff)

Design: `docs/design/one-world.md`. Branch `one-world-p1`. Behind a **per-device preview gate**, OFF by default:
main stays the old game until the P3 flip.

**Turn it on:** Menu (☰ Places) → **One World (preview)** (reloads), or open `/play?oneworld=1` once
(`?oneworld=0` turns it off). The flag is the device key `eclipse-oneworld`. `?hour=<0-24>` pins the world
clock for a page (tests, screenshots).

## What a player gets (gate on)

- **The Basalt Seamworks stands on the Ember Delve's surface.** One streamed world: walk the street, dig
  down anywhere (the Delve is under your feet; the mine head sits over the old entry ledge, its C/anchor
  buttons as the shaft had). Same stations, ids, panels; each in a building made of cells (walls, slate roofs,
  timber floors, a ladder to the keeper's room upstairs), with an awning, a hanging sign with the station's
  icon, a window display of three things it deals in, a counter in front of the keeper, smoke from the forge
  chimney, windows lit at night. The square: the town stone, the Hearth fire, benches. The town keeps its
  walls (a swing gets the refusal; no block can be placed inside a shop; charges never clear them).
- **Keepers keep the clock** (06–19 counter, 19–20 walk to the fire, 20–23 at the Hearth, 23–06 upstairs).
  A station is never closed: at night the prompt is "Ring the bell" and the panel opens as always. Kael (and
  any canon keeper) wears MapleStory `!`/`?` from the Quest Board's own states. Townsfolk wander the square.
- **Waystones.** The five town stones are lit (owner decision: the trunk line). The **Quarry Head stone**
  (sector 7) and a **wild stone every 8 sectors from ±12** (`ember:ws:<sx>`, hashed from the world, not the
  seed) are found dark: hold E (or hold the prompt button) 1.2 s → seams climb to gold, +15 Delving XP once
  (receipt first, mutation id `waystone:<id>`), fog clears ±2 sectors (±3 with Sera's Chart).
- **Travel map** (E at a lit stone, M anywhere in the world, `?at=waystone`): pins (≥ 44 px) and a list, one
  primary button "Travel to …" (1.5 s channel; Quick Hands 0.8), **Return to the Seamworks stone** (recall,
  3 s, free, from anywhere), the trunk line's other towns (their legacy scenes), the Meridian Survey behind
  Details, and "Full map" (the old full map with pins).
- **Temporary arches** (P1 only): east gate → the old Ember Quarry (opens on the beacon, as the passage did);
  west → the Homestead. Both legacy areas' "back" passages land at their arch. The Rivet Maws roam the Quarry
  Road (sectors 4–5) so the onboarding beat (a Maw → the beacon → the arch) keeps its shape.
- **Log in where you stood**: a resume point every 10 s, only when the spot is safe (grounded, dry, no foe
  within 400 px, no cart/grapple/ladder).
- **Presence**: the room's zone is the world id (`ember`), so peers meet anywhere in the world.

## Engine (P1.a)

- `Terrain.rowLo` (`terrain.ts`): row 0 stays the ground; rows go negative. Index = (row − rowLo) × cols +
  slot, so `index + cols` is still the cell below. Chunk rows run `[chunkRowLo, chunkRows)`. `back` (Uint8 per
  cell, generated, never saved) holds back walls; `skyBiome` the surface's look. With rowLo 0 everything is
  as before (the plain Delve, the realm Delves, gate off).
- `surface-gen.ts` (pure): the sky band per sector column — flat authored span, buildings stamped from
  `blueprints.ts` (ASCII grids: `# = T - H . w D C l p c`), the basin's water, hills (−6…0 rows; never below
  row 0), boulders, wild stones; `regionAt`, `groundAt`, `stonesIn`, `wildStoneAt`.
- `sector-world.ts`: columns carry the sky band (local index from rowLo); sky sectors save as `sy = −1`;
  `cellId` gives sky cells their own range (`SKY_ID`); the map paints from `row0` (sky a flat colour).
- `terrain-render.ts`: negative chunk rows, the back-wall pass (masonry, timber, windows, door frames),
  **all-air chunks are never blitted** (the open sky costs nothing). `lighting.ts`: skylight per column
  (`Skylight`: sky dark = night × 0.55, `nightShare(hour)`), eased under the skyline.
- `settlement-life.ts` (keepers at 2 px per art px, routines from `world/routines.ts`, marks), `settlement-
  render.ts` (dressing, stones). Both stream: updated/drawn only while the settlement's columns are within a
  sector of the view.
- `world/worlds/ember.world.ts`: `EMBER_SURFACE`, `EMBER_WORLD` (= the Ember Delve + surface + stations,
  area id stays `ember-delve`), `INFERNAL_WORLD_TOWN` (`TownDef.home = 'ember-delve'`: entering the town
  enters the world). `StationDef.y`, `AreaDef.world`, y-aware `nearestStation`.

## Save v3 (P1.b) — new keys, gate on only

`godforge-world` (progress/world), `godforge-world-r0..23` (24 shared slots, each names its world),
`godforge-waystones`; device store IndexedDB `eclipse-world` / fallback `godforge-world-far`. All in
`SYNCED_BLOBS` with merges (`world-save.model.ts`, `waystones.model.ts`); no `firestore.rules` change (the
generic `progress/{docId}` rule). `DelveSaveService` keeps the same in-memory shapes and converts on disk
(`oneWorld` read once per page). **Migration** (`delve-migration-v3.ts`, owner decision): v2 claims copied,
chest stacks granted back (`v3-chest:<born>:<stack>`, the Satchel; a full one overflows to the Vault), chest
gear stowed in the Vault, **digs not migrated**; marker `migrated: 'v2'`; v2 keys untouched.
`WaystoneService` (the Slate Map app contract): `view$`, `travel(id)`, `recall()`, `canTravel()`,
`channel$`; the play view is its `WaystoneHost`.

## Clock

`shared/world/world-hour.ts` is a small adapter (a 48-minute in-game day from the epoch; `?hour=` pins it).
**When the world-clock branch lands**, call `setWorldHourSource({ hour: now => clock.hour(now) })` (or point
`worldHour` at its Sky state); routines, lit windows and the night dark already read only `worldHour()`.

## Tests

- `node --test scripts/one-world.test.cjs` (22): rowLo, **rows ≥ 0 byte-identical on five seeds**, sky goldens,
  ≤ 0.6 ms a column, every station reachable on the street from the town stone, protected walls, the mine
  head on the ledge, the basin, wild stones and hills, `regionAt`, sky-sector streaming and ids, the map's
  sky band, routines, marks, Waystone rules; engine: spawn, walk to counters, light/travel/recall, the clock,
  the arches, the walls' refusal. Existing goldens unchanged.
- Karma `world-save.model.spec.ts` (8): v3 coerce/merge (commutative, idempotent), slots, registration,
  Waystone merges, migration (claims kept, chests returned, v2 untouched, nothing paid twice on reload,
  nothing written with the gate off).
- e2e `play-one-world.spec.ts` (desktop keys + 390×844 touch, chromium + webkit): spawn in the settlement,
  walk to counters, resume beside the Quarry Head, see + light it, travel, M, recall, the night bell.
- Perf guard (`PLAY_PERF=1`): Settlement midday / night, 390×844 @3, 4× CPU: **p50 16.7 / p95 17.6–33.3 ms** (two runs)
  (guard p95 < 50, p50 < 34).

## Screenshots

`output/one-world/` (not committed): `desktop-settlement-12h.png`, `desktop-shops-22h.png`,
`desktop-dark-stone.png`, `desktop-lit-stone.png`, `desktop-travel-map.png`, and the same for `phone-*`
(390×844) and `phone-landscape-*` (844×390).

## Not in P1 / follow-ups

- The Underhearth Landing and Gate Hollow stones (deep stones), the per-world map tabs, Survey marks 12/15's
  rewards (P2/P3; economy-sim `--waystones` with the income at 15).
- Ledge-grab/mantle on cells, the Quarry as a region with the High Roads in cells, the Plot as the Homestead
  (P2; the arches go then). The pond's fishing table (P3).
- Presence list showing each peer's region (client side) — the zone is the world now; the label is next.
- `play-world` and the other legacy specs run gate-off as before (unchanged).
