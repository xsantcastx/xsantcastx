# One World — Phase 2 and the flip (handoff)

Design: `docs/design/one-world.md` (§2.2, §2.4, §2.6, §5 P2 and "the flip"). Branch `one-world-p2`, on top of P1
(`docs/handoff/one-world-p1.md`) and the Living World merge. Owner: "we need to make the preview the definitive place
to start and play." Manager's call: build P2 and flip One World on now, not after P3.

## The flip

- `OneWorldFlag.on` is **true for everyone**, new saves and old (`play/one-world/one-world-flag.ts`). The P1
  per-device key `eclipse-oneworld` is ignored and removed on read, so a device that once turned the preview off is
  not stranded in the old game.
- `?oneworld=0` is a **developer's escape hatch** for one browser tab (sessionStorage `eclipse-oneworld-off`; reloads
  keep it, a new tab does not; `?oneworld=1` clears it). It is not in the menu: the "One World (preview)" row, its
  toggle and its three i18n keys are gone.
- The first session runs in the world: Make your Keeper → Glim's hello → goal 1 walks **west along the street** to the
  plot's Forge → the blade → **a Maw on the Quarry Road** → the beacon → the Quarry Gate lifts → goal 4 digs **beside
  the mine head** (its own ledge is bedrock). The goals never say "head back" in the world (`first-goals.ts`: the plot
  and the Quarry fall through to the town's logic; a new key `play.goal.delve.world`, EN + ES, with Glim's two hints).
- Existing saves migrate as P1 built it (v2 claims copied, chest stacks → Satchel, overflow → Vault, chest gear →
  Vault, v2 digs not migrated, marker `migrated: 'v2'`). Verified on a heavy save in Karma
  (`world-save.model.spec.ts`: 60 claims, 40 chests, 120 stacks, granted once, nothing again on reload).
- The other four realms keep working: their towns are reached from the Seamworks stone's Travel map (the trunk
  line), and each of their stones opens the same Travel map with the Seamworks stone on it; their Rift Gates are as
  they were.

## What a player gets (P2)

- **The Ember Quarry is a region** (`ember-quarry`, sectors 5–7) east of the Seamworks. Between them, the **Quarry
  Road** (sector 4) where the onboarding Maws roam, and the **Quarry Gate** (cols 160–164): a gatehouse wall too tall
  to climb, its portcullis (`gate-bar` cells) barred until the beacon burns (the same `restored` the old east passage
  read), then lifted (the engine clears the cells each frame they are loaded: a regenerated column is lifted again).
  A swing at the bars: "Barred. The Eclipse Beacon lifts the Quarry Gate". No arches, no passage stations.
- **The Quarry's contents**: its five nodes (same ids, so the harvest save and found-in lines are unchanged) on the
  street at cols 166–175, drawn at the world's half scale with readable cues; its own three Maws under the High Roads;
  the eclipse's aligned glass now reads the region (`alignedHunt` vs the region id); the Lost Cabinet `cab-quarry`
  under the rope bridge (col 192).
- **The High Roads in cells** over the Quarry (`blueprints.ts` `HIGH_ROADS`, laid by surface-gen from col 178): a
  floating ridge-rock shelf, a ridge tree (trunk climbed like a ladder, canopy one-way), a floating courier-ruin slab
  and the Couriers' rope bridge, a floating mesa (the perched Maw, Hollis Fenn one day in five), a snag, a ruin block
  you reach by **kicking off the snag**, a slab and the spire: the **summit 23 rows over the street**. Every piece
  floats or is a trunk, so the street under it runs clear. Same find ids, rewards and texts
  (`EMBER_HIGH_ROADS` in `ember.world.ts`; the finds drawn at 2 world px per art px). The route's rock and ruins
  refuse a pick ("The Couriers' road holds"), so it stays climbable for everyone.
- **Your Homestead is a region** (`homestead`, sectors −4…−1) west of the Seamworks: its buildings, the Forge and the
  Home Forge drawn at the world's scale from `PLOT_X` (`homestead-render.ts` `setWorldPlacement`: one transform, the
  plot's own layout), its stations by their `hs-*` ids at their world x; walking past still collects; the Gold list
  column shows in the region (`placeId`). The pond moved to the plot's west end (cols −60…−55).
- **Parkour on cells, everywhere** (`engine/terrain-moves.ts`, pure): a lip 10–112 px over the feet is caught near
  the apex or falling while pushing into it (room to hang and to stand checked), Jump or a held push mantles (up,
  then over: never through the corner), Down or away lets go; touching a wall in the air (or within 0.14 s), Jump
  away kicks off; on a ladder or a ridge trunk a direction + Jump kicks off. Not in liquids, on a cart or grapple, or
  under the Orrery's up-gravity. A pit seven rows deep is still a pit; six rows is a mantle.
- **The Living World in the regions**: the Quarry and the Homestead grow the wilds' ashwoods and bushes from authored
  columns (`SurfaceRegion.flora` → `regionPlan` → the Living World's own `stampSurface`), and their critters come
  with them (`crittersFor` treats a planted column as wild). No packs or mysteries in them.
- The touch HUD shows **Down** in the move row anywhere on a world's cells (`data-climb` reports the move state
  there: `free` / `climb` / `hang` / `mantle`).

## How it is built

| File | What |
|---|---|
| `play/one-world/one-world-flag.ts` | the flip; the tab-only escape hatch |
| `play/engine/terrain-moves.ts` | `findLip`, `touchingWall`, `TerrainMover` (hang, mantle, wall-jump, kick velocity) |
| `play/engine/terrain.ts` | nodes `ridge-rock`, `courier-ruin`, `ridge-trunk`, `ridge-canopy`, `rope-bridge`, `gate-bar` (appended after the Living World's); flags `HIGH_ROADS_FLAG`, `QUARRY_GATE_FLAG` |
| `play/engine/blueprints.ts` | glyphs `R U \| ^ ~ B`; kinds `quarry-gate`, `high-roads` (`HIGH_ROADS`, `highRoadsGrid()`); the arch is gone |
| `play/engine/surface-gen.ts` | `SurfaceSpec.gate`; `SurfaceRegion.flora` + `regionPlan` |
| `play/engine/engine.ts` | parkour wiring (`parkour()`, press, step, hold), `liftGate`, world-scale nodes/Hollis/finds, nodes worked before the ground is dug, `cameraAt`, camp descent faces east |
| `play/engine/homestead-render.ts` | `setWorldPlacement`, `playerY` on the frame |
| `play/world/worlds/ember.world.ts` | the layout: regions, gate, High Roads, Quarry nodes/Maws, `EMBER_HIGH_ROADS`, plot stations, `placeOfRegion` |
| `play/side-scroller.component.*` | `placeId` (region → old place ids for Glim, goals, the column), the plot placement, `data-camera` |
| `play/world/first-goals.ts`, `shared/glim/glim*.ts` | world goals and hints |
| `shared/cabinets/cabinets.model.ts` | `cab-seamworks` in the Vendor's loft, `cab-quarry` in the Quarry, both area `ember-delve` |

## Tests

- Node `scripts/one-world.test.cjs` (27): +5 — no arches (the plot's stations in the world, the gate barred, its
  refusal, walked through once lifted), the Quarry and Homestead flora and nodes, `terrain-moves` (catch, mantle,
  let go, wall-jump), **every piece of the High Roads climbed by scripted input to the summit** with every find on a
  top, a pit climbed out of in the Delve, and 4000 random frames on the route never inside a solid. Sky goldens
  bumped (−2, 3, 7: the pond, the arch gone, the route); rows ≥ 0 byte-identical (unchanged test, green).
- Node `scripts/lost-cabinets.test.cjs`: the two world cabinets stand on a floor with room, clear of every station.
- Karma: `first-goals.spec.ts` (+3 world), `world-save.model.spec.ts` (the flip default, the hatch, the heavy save).
- e2e: new `play-one-world-p2.spec.ts` (the gate beat, the Homestead walk, a Delve pit mantle, the phone HUD);
  `play-surface` rewritten for the cells route; `play-hunting`, `play-homestead`, `play-world`, `play-life`,
  `play-cabinets`, `play-first-session`, `play-glim`, `play-hud`, `play-delve`, `play-delve-endless` retargeted;
  `play-helpers.seed()` converts a spec's v2 Delve blobs to v3 (`asWorldSave`), `delveSave()` reads them back,
  `digIntoDelve`, `travelToTown`, `loginAt`, `SHAFT_X`.
- Perf guard: + a Quarry scene under the Settlement ceilings.

## Not done / next

- P3 (the four realm worlds) and P4 (delete the legacy scenes, the gate, `?oneworld=0`).
- The two old surface cabinets' positions moved for the world; the dev hatch's legacy scenes no longer hold them.
- Ledge-grab is generous on purpose (the owner's "parkour"); tune `GRAB_HI` from play if pits feel too easy.
- The High Roads route is Infernal only; the other realms' routes come with their worlds (P3).
