# One World — the Delve becomes the land

2026-10-15 · architect · design for the restructure the owner asked for. Base: `origin/main` dba1644f.

> Owner: "what if we made it like all in the delves?, like the delve be the main land, and here we find
> waypoints we unlock all these sections, make the stores nicer, the npcs, like one big world, like if it was
> maple story … when i log in, inside the village, then using waystone to another city doesnt feel that nice,
> but inside the delve, i find it very interesting".

**Decided direction.** Each realm is **one streamed, diggable world**, built on the engine the Delve already
uses (sectors, the 128-column ring, region saves, liquids, fog, the map):

- The realm's **town is a settlement built on the world's surface**. Its shops are real buildings made of cells,
  and its keepers live in them.
- The **hunting grounds are surface regions** of that world, and you walk into them.
- The **High Roads are in the sky band** above the surface. The **Underhearth / realm deeps** are below it.
- **Waystones are physical stones** in the world. You discover one and light it; lit stones are fast-travel doors,
  and the map fills in as you light them.

Each world has one realm and one underground:

| World | Realm | Underground |
|---|---|---|
| Ember | Infernal | Ember Delve |
| Ink | Umbral | Ink Deeps |
| Root | Verdant | Root Deeps |
| Prism | Luminous | Prism Mines |
| Orrery | Celestial | Orrery Wells |

You travel between worlds by Rift Gate (deep) or by lit Waystone (surface). There are zero players, so the save
format gets a clean break (v3).

This document makes every design call except the three in §6.

---

## 0. The five decisions everything else hangs on

1. **One scale: the Delve's.** Everything in a world uses the same grid:
   - a 32 px cell;
   - figures at `figureScale 0.5`;
   - 2 world px per art px.

   Stalls, signs, keepers and props are already cached pixel sheets drawn at 4 px. In the world they are blitted at
   2 px, an exact halving, so the pixels stay crisp. There is no camera zoom, because a non-integer zoom shimmers
   pixel art and invalidates the chunk cache. The owner likes how the Delve feels, and the Delve's scale is that feel.
2. **Row 0 stays the ground line, and rows go negative upward.** `Terrain` gains `rowLo`, mirroring the `colLo` the
   ring added for the west. As a result, every authored stamp, depth constant and golden hash at rows ≥ 0 keeps its
   meaning:
   - the Ember core (cols 0–119, rows 0–55);
   - the Underhearth (rows 56–117);
   - the Rift Gate cells;
   - `REALM_ARRIVAL`;
   - the Gate Hollow at rows 24–31.

   The sky band (settlement roofs, trees, the High Roads) lives in rows −40…−1. Today `row < 0` is hard-coded as air
   (`terrain.ts:715,720,749,856,893,897,901`); `inside()` will use `rowLo` instead.
3. **The world is a lens over the data that exists today.** It does not replace it.
   - `TOWNS[realm].stations` stays the authoritative list of places: ids, panels, blurbs. The settlement gives each
     station a building at a world cell.
   - Hunt `AreaDef`s become `RegionDef`s with the **same ids and names** ("Ember Quarry").
   - These all keep working with only a coordinate adapter:
     - `?at=<station>` deep links;
     - `placeForRoute()`, the place banner and `audit-nav.js`;
     - Found-in lines (`found-in.data.ts`);
     - Glim's "visit every area" quest (`glim-bond.ts:209`, `area:<id>`);
     - the heights find ids (`<area>:<name>`);
     - the cabinet ids.
   - **No route is added or removed**, so prerendering and the sitemap do not change.
4. **The five town Waystones are Sera's trunk line and are always lit.** A new Keeper can still reach the Croupier's
   tables (Umbral), the Market (Luminous), the Codex (Celestial) and the Quest Board/Sanctum (Verdant) in the first
   session. The economy and onboarding depend on that.

   What changes is that you arrive **in a living world**, not in a separate scene. Every other stone is wild and must
   be found and lit. (§6 Q1 asks the owner whether he wants this trunk line or a stricter "walk there first" rule.)
5. **Each realm world's underground stays behind its Rift Gate's attunement.**
   - Under every realm settlement and region, rows −2…−1 are a **Compact seal**: a band of a sealed node. It reuses the
     Banked seal pattern (`underhearth.md` §1).
   - The seal opens to a pick only once `rift-attuned:<realm>` is set.
   - The topsoil above it (rows −8…−3) is diggable, so you can make basements and cellars.

   Without the seal, walking to Umbral town and digging down would skip Delving 20 and the Umbral Sigil. The gate's
   attunement stays the progression lock. After attuning, both ways in work: down from the town, or through the gate.

---

## 1. Inventory — every current place and system, and where it goes

"P#" is the phase that moves it (§5). Paths are under `src/app/` unless noted.

### 1.1 Places

| Today | Code | One World | Phase |
|---|---|---|---|
| **Basalt Seamworks** (Infernal town, 3600 px flat) | `play/world/towns/infernal.ts` `INFERNAL_TOWN` | **Seamworks settlement** on the Ember world surface over the core, sectors 0–3 (cols 0–127). The shaft (`delve` station, today x 590) becomes the **mine head** at col 3, straight into the core's entry ledge (stamp col 0–5 row 0). | P1 |
| **Heliograph Court** (Luminous) | `towns/luminous.ts` | Court settlement on the **Prism** world surface; the Market is its centrepiece. | P3 |
| **Nocturne Archive** (Umbral) | `towns/umbral.ts` | Archive settlement on the **Ink** world: the Croupier's street (Gambler, Reels, Rune Drop, Seam Sweeper, Eclipse Ascent, Exchange). | P3 |
| **Meridian Orrery** (Celestial) | `towns/celestial.ts` | Orrery settlement on the **Orrery** world (Codex observatory, Leaderboards). | P3 |
| **Rootglass Canopy** (Verdant) | `towns/verdant.ts` | Canopy settlement on the **Root** world (Sanctum, Quest Board, Arena, Trials). | P3 |
| Ember Quarry (hunt) | `infernal.ts` `EMBER_QUARRY` | **Region** east of the Seamworks, sectors 4–6. The beacon and the east gate are kept as the onboarding beat (§2.4). | P2 |
| Reflection Channels / Unrecorded Corridors / Orrery Rings / Rootglass Thicket | the four town files | One region east of each settlement, sectors 4–6. | P3 |
| **Homestead** (separate area) | `play/world/homestead.ts`, `engine/homestead-render.ts` | **Your Plot**: a region west of the Seamworks, sectors −3…−1. It is the only surface region where you may build freely. The buildings stand as structures; the Home Forge anvil and circle are there. | P2 |
| High Roads (geometric route in each hunt) | `play/world/heights.ts`, `engine/surface-body.ts`, `surface-render.ts` | **Sky band over each hunting region**, made of cells: rock/ruin cells, climbable trunk cells with one-way canopy cells, one-way plank bridges. Find ids are unchanged. Ledge-grab, mantle and wall-jump are ported to terrain physics (§2.6). | P2 (Infernal), P3 |
| Ember Delve core + endless wings | `infernal.ts` `EMBER_DELVE`, `engine/sector-gen.ts`, `sector-world.ts` | **Unchanged below row 0.** It is the Ember world's underground. | P1 |
| Underhearth | `engine/underhearth-gen.ts` | Unchanged, rows 56–117 of the Ember world. | — |
| Realm Delves (Ink Deeps, Root Deeps, Prism Mines, Orrery Wells) | `towns/*-delve.ts`, `engine/{realm-kit,realm-gen,verdant-gen,luminous-gen,celestial-gen}.ts` | **The underground of each realm world.** Their 64 rows stay at rows 0–63, so all of their generators and goldens are unchanged. A surface is added above them: ground at row −8, topsoil −8…−3, Compact seal −2…−1, sky band −40…−9. | P3 |
| Starfall Deep (Phase 9, unbuilt) | `docs/world/delve-and-beyond.md` §2.2 | Rows 128+ of the Ember world, as specified. One World does not change that plan. | — |
| Echo regions (unbuilt) | `delve-and-beyond.md` §2.3 | Still the plan for the Ember world's far wings. The realm worlds are the real thing, so the echoes no longer need to stand in for them. | later |

### 1.2 Systems

| System | Today | One World | Phase |
|---|---|---|---|
| **Stations** | `StationDef {x}` on a flat `FLOOR` (`world.model.ts`). `nearestStation` / `stationAt` are x-only. | `StationDef` gains `y?` (feet y; default `FLOOR`, so the legacy flat mode keeps working). Reach checks both x and y. The engine reads station positions from the settlement layout (§2.3). The panel registry and one-primary-action rule are unchanged. | P1 |
| **Passage stations** (`kind: 'passage'`) | town ↔ hunt ↔ Delve | **Removed.** You walk. The mine head is just a hole with a ladder. The east gate is a gate structure (§2.4). | P4 (delete) |
| **Waystone panel** (`kind: 'waystone'`, `side-scroller` `waystone` getter) | five-town list | Replaced by the **Travel map** (§3). | P1 (replace), P4 (delete) |
| **Rift Anchors** | anchor sheet (`side-scroller.component.ts:2972`) | Kept as player-placed doors. They appear as pins on the same Travel map, and the anchor sheet merges into it. | P1 |
| **Rift Gates** | `shared/delve/rift-gates.model.ts`, `engine.enterRealm/leaveRealm` | Unchanged mechanically. "Enter realm" now switches **world**, and the realm Delve is that world's underground. `leaveRealm` returns you beside the gate in the Ember world. The first step through also lights that world's Gate Hollow stone. | P3 |
| **NPC life** (keepers, townsfolk) | `engine/town-life.ts` `TownLife.enter(area, town)`, `play/world/life.ts` | **SettlementLife**: the same painters and lines (`keeper-lines.ts`, `life.i18n.ts`). Each keeper stands at their building's counter. Townsfolk walk the settlement's street cells. It only runs while the settlement's columns are within the ring ±1 sector of the camera. Routines are a **pure function of world-clock time** (§2.5), so nothing simulates off screen. | P1 |
| **Day/night clock** (in flight, `world-clock` worktree) | `shared/world-clock/*` (uncommitted); `WorldHour` on nodes/monsters | The world consumes its `Sky` state for skylight, night dimming, lit windows and keeper routines. `when: 'dark' \| 'eclipse'` on nodes and monsters moves into the region defs unchanged. | P1 consumes it |
| **Quests, missions, bounties** | `shared/npc/delve-missions.model.ts`, `shared/bounties/*`, the Quest Board (Verdant) | Unchanged. Givers are station keepers; `reach` objectives are rows (≥ 0, unchanged). Each keeper gets a MapleStory head mark: **!** when a mission is offered, **?** when one can be turned in, read from the missions model. | P1 (Infernal), P3 |
| **Story** (Act I/II beats, scenes) | `shared/story/*` | Unchanged. Beats key off flags and claims. Act I's forge → beacon → east passage beat maps to the forge building → beacon → the east gate opening (§2.4). | P2 |
| **First goals / onboarding** | `play/world/first-goals.ts` | Same steps, keyed by station id. `goToStation(id)` resolves world positions. A fresh Keeper spawns at the Seamworks town stone. | P1 |
| **Glim hints, map marks** | `shared/glim/*`, `glimShowMe({station})` (`engine.ts:1805`), `delve-map.ts` pins | `glimShowMe` returns a world point. If it is in another world, Glim points at the town stone instead ("Travel to the Court first"). Map pins are per world: this closes the `rift-gates.md` follow-up "per-world pins next". Glim quest 5 (`area:<id>`) fires on region entry, with the ids unchanged. | P1 |
| **Heights finds** (caches, carvings, look-out, summit, Hollis Fenn) | `heights.ts`, `shared/heights/*` | Same ids, rewards and `godforge-heights` blob. Positions become cells in the sky band. Hollis walks the mesa of the realm his day picks. The look-out's beams reveal the remaining finds on the **map** as well; this was a follow-up in `surface-height.md`. | P2/P3 |
| **Lost Cabinets** | `shared/cabinets/cabinets.model.ts` (area + x/feet-y) | Same 16 ids. The 8 surface cabinets (5 towns, 3 hunts) and the 2 High Roads cabinets get world cells. The 6 Delve and realm cabinets already have cells. `scripts/lost-cabinets.test.cjs` gains a check: every cabinet stands on a standable cell, more than `STATION_REACH` from any station. | P2/P3 |
| **Pets** | `shared/pets/*`, `engine/pet-sprite.ts` | Unchanged; they follow the Keeper. Hunt "rescues" key off creature tallies, which are region creatures with the same ids. | — |
| **Fishing lakes** | `shared/fishing/fishing.model.ts` `waterFor(biome, liquid)` | Lakes in the core are unchanged. **Each settlement gets a pond** (a stamped basin on the surface). `waterFor` maps the new surface biomes to a new `pond` table in P3; until then they map to `mere`. | P1 pond, P3 table |
| **Liquids** | `engine/liquids.ts` | Unchanged. The sky band is air plus the stamped ponds. The ring edge is still rock to the sim. | — |
| **Gather nodes** (herb, tree, outcrop) | `GatherNodeDef {x}` per hunt; `godforge-gathering` keyed `area:node` | Kept as **site entities** (not cells), with `y` added and placed in region defs. Respawn is unchanged. Save keys become `<world>:<node>`, and the old blob is dropped because it only holds respawn timers. | P2 |
| **Hunt monsters** | `MonsterDef.spawnXs` per area | Region monsters spawn when their columns load, through the same hook as the Delve's halls (`spawnHalls`, `engine.ts:805`). They use `floorY` = ground and `range` = region span (both fields exist today). They are capped by the existing 12-creature cap. | P2 |
| **Minimap / world map** | `play/engine/delve-map.ts`, `play/delve-map-view.ts` | Draws the sky band too. The sky is a flat colour, and buildings show as their cells. New layers: **Waystones** (lit = glowing, seen-but-unlit = grey), **Shops** (one glyph per building), **Anchors**. The full map gets one tab per visited world. | P1 |
| **Multiplayer Hearth presence** | `play/social/social-room.ts` (`zone` string), `engine.setPeers` filters `peer.area` by **area name** (`engine.ts:5168`) | `zone` = world id (`ember`, `ink`, …). Peers are drawn when they share the world and are in view. The Hearth list shows each peer's region, worked out client-side from their x/y. The server keeps an opaque string, so **no `functions/` change**. | P1 |
| **The Slate** (Mirror Slate; the phone "Map" app is in flight) | `shared/slate/*` | The Travel map (§3) **is** the Slate's Map app. If that app has not merged when P1 lands, P1 ships the Travel map behind **M** and the Slate adopts the component later. Contract in §3.5. | P1 |
| **SSR / prerender / nav audit** | `/play` (client-only engine); 58 prerendered routes; `scripts/audit-nav.js` over `worldPlaces()` (`shared/world/place-for-route.ts:79-84`) | No new routes. `placeForRoute` iterates settlement stations, then **region** stations (for example the Plot's Home Forge) instead of `town.hunts`. The audit stays green with the same reachability rule. The place banner text ("This place is in Heliograph Court · Luminous realm") is unchanged. | P1 |
| **Sound** | `shared/sound/sound-palette.ts` (`TOWN_BEDS`, Delve beds) | Beds are chosen by **band**: sky/surface uses the town bed, a region uses its own bed, underground uses the Delve beds. The "where am I" query becomes `regionAt()` (§2.2). | P1 |
| **Perf harness and guards** | `e2e/perf-play.spec.ts`: town guard (Infernal p95 < 70 ms), Furnace Hall guard (p95 < 70 / p50 < 45) | Adds a **Settlement guard**: p95 < 50 and p50 < 34 at 4× throttle, 390×844 @3. The Furnace Hall guard is kept. The town guard is retired in P4. | P1 |

### 1.3 E2E specs that encode old places

From a grep of `e2e/`. The **legacy** specs run with the One World gate off until the flip at the end of P3. In P4
each is either rewritten or deleted.

| Spec | Encodes | Fate |
|---|---|---|
| `play-world` | Waystone panel, town walks, `?at=` | Rewrite in P1 as `play-one-world` (Travel map, stones). The legacy spec is deleted in P4. |
| `play-hunting`, `play-surface` | passages into hunts; the High Roads at town scale | Rewritten in P2 (Ember Quarry region, the sky band route). |
| `play-homestead` | Homestead area + gate | Rewritten in P2 (the Plot region). |
| `play-first-session`, `play-life`, `play-missions`, `play-glim`, `play-glim-bond`, `play-story-act1`, `play-story-act2`, `play-economy`, `play-hud`, `play-mobile-hud`, `play-tool-tiers`, `play-world-feel`, `play-bounties`, `play-pets`, `play-minigames`, `play-update` | `?at=` deep links plus hard-coded town x positions | **Mostly survive**, because `?at=` keeps working. Every hard-coded town x is replaced with the new `stationPoint(page, id)` helper (it reads `data-stations` on the canvas). Done in P1 for Infernal and P3 for the rest. |
| `play-casino`, `play-reels`, `play-slate` | Umbral stations by x | P3 (Ink settlement). |
| `play-cabinets` | the Seamworks cabinet "on the camp's high ledge" | P2: re-placed and re-walked. |
| `play-delve*`, `play-underhearth`, `play-rift-gates`, `play-realm-delves`, `play-celestial-delve`, `play-liquids`, `play-fishing` | camps and cells at rows ≥ 0; seeds `godforge-delve` v2 | Cells are unchanged. **Fixtures** (`e2e/play-delve-fixtures.ts`) gain `withWorld()`, which writes v3. Specs switch over in P1 and P3. Entering the Delve no longer uses the `delve` passage: you walk into the mine head, or seed a position. |
| `perf-play` | town and hunt scenes, the `passage` station | Gains the Settlement scenes in P1. Town scenes are retired in P4. |
| `side-scroller`, `c8-infernal-seamworks`, `c9-first-loop`, `five-realm-foundation`, `game-only-cutover`, `art-shots*`, `chibi-shots`, `visual-snapshots` | legacy scene structure, x positions, screenshots | Reviewed in P4: delete the ones that test what no longer exists (memory: "E2E specs outlive the UI"), and re-shoot the rest. |

`data-area` keeps reporting **the region name** under the Keeper ("Basalt Seamworks", "Ember Quarry", "Ember Delve"),
so most assertions that read it keep their meaning. The canvas also gains `data-world`, `data-region`, `data-stone`
and `data-stations`.

---

## 2. World layout per realm

### 2.1 Coordinates

- Cell 32 px. Sector 32 × 32 cells. Region 8 × 8 sectors. Ring 128 columns. All unchanged.
- Rows run from `rowLo` (the top of the sky band) to the world's bottom, with row 0 = ground in the Ember world.
  - **Ember:** `rowLo = −32`, ground row 0, bottom row 119 (Underhearth bedrock 118–119).
  - **Realm worlds:** `rowLo = −40`, ground row −8, topsoil −8…−3, Compact seal −2…−1, realm Delve rows 0–63.
- The sky band is 24 rows above the highest authored ground. The High Roads summit is about 22 rows above the
  ground, which is the old route's 9.4 Keeper-heights at the new scale (§2.6).
- A ring holds `128 × (rows − rowLo)` cells: Ember 128 × 152 ≈ 19.5 k, realm worlds 128 × 104 ≈ 13.3 k. Today it is
  15.4 k for Ember, so this is about +27% on the typed arrays (about 40 kB). That is negligible.
- **Sector rows go negative**: `sy = floor(row / 32)`, so the sky band is `sy = −1` (Ember) or `sy ∈ {−2, −1}`
  (realms). Region keys are `rx_ry` with signed `ry`. The region model already uses signed `sx`, so this is the same
  code path.

### 2.2 The horizontal map

The same template for every realm, in sector columns (1 sector = 32 cells = 1024 px; walking pace is about 264 px/s,
so one sector takes about 4 s):

```
 sx:   ... -9 … -4 |  -3   -2   -1  |   0    1    2    3   |   4    5    6   |  7  | 8 … ∞
         wilds W   |   The Plot*    |    SETTLEMENT        |  HUNT REGION   | gate|  wilds E
         (proc.)   |  (Infernal) /  |  town stone at sx 1  |  + High Roads  | stone| (proc.)
                   |  realm 2nd     |  mine head (Ember)   |  in sky band   |      |
                   |  region        |                      |                |      |
 underground:  endless wings (unchanged) · core cols 0–119 (Ember) / 0–63 (realms) · wings
```

- **The Plot** (Ember only, sectors −3…−1). Your Homestead. Its buildings come from `HOMESTEAD_BUILDINGS`, with
  station ids `hs-*` unchanged. It is the one authored surface you may dig and build on freely.
- **Realm worlds' west region** (sectors −3…−1) gets the realm's second flavour space:
  - Ink: the **Moonlit Stacks** (shelf ledges, the Mirror pond).
  - Prism: the **Dawn Terraces**.
  - Orrery: the **Ring Garden**.
  - Root: the **Lodge Clearing**.

  Each is a gathering and fishing space with two wild nodes and a pond. No creatures, so it is safe ground. (Working
  names; §6 Q3.)
- **The settlement** spans sectors 0–3, exactly over the core.
- **The hunt region** spans sectors 4–6. Its High Roads route sits in the sky band above it.
- **Sector 7** holds the **region stone**, the first wild-ish stone, at the far end of the hunt.
- **Wilds**, east from sector 8 and west from sector −4, forever:
  - The ground line wanders between rows −6 and +2 relative to ground.
  - Procedural surface features: hills, groves, ruins, ponds, a **wild Waystone every 8 sectors** (§3.1).
  - Creatures from the region's table at a lower density.

`regionAt(world, col, row): RegionId` is pure:

- below row 0 (or below the seal): the underground biome name, as today;
- otherwise, by sector column: wilds / plot / settlement / region / wilds.

It drives `data-area`, presence labels, sound beds, the area-visit flag, the arrival toast and Hollis.

### 2.3 The settlement — buildings as cells

`play/engine/blueprints.ts` (pure, node-tested) is a tiny ASCII grid per building kind. Glyphs map to nodes:

- `#` wall block (realm material);
- `=` roof;
- `-` one-way floor or shelf;
- `D` door (an open frame: walk-through, it draws as a door);
- `W` window (lit at night);
- `C` counter (the station anchor);
- `S` sign;
- `.` back wall (new layer, below).

Each realm has one palette, mapping wall/roof/back to its art-bible ramps.

- **New terrain layer `back`**: a Uint8 back-wall id per cell, drawn baked into the chunk cache under the terrain
  pass, as Terraria draws walls. It is generated and **never saved** in P1. Player-placed back walls come later with
  their own diff field.
- **Settlement cells are protected** (the existing `protect` flag). A swing says "The town keeps its walls." That way
  a station can never be dug out from under its keeper. Building is free in the Plot and the wilds.
- **Building anatomy** (the "make the stores nicer" pass):
  - 8–14 cells wide, 6–9 rows tall, standing on the ground line.
  - An open front: the front wall is cut away at the counter, so the keeper is visible from the street in side view.
  - A pixel **sign** with the station's 16 px item icon (`item-icons.ts`).
  - An awning in the realm palette.
  - A **window display**: 3 icons of what the station deals in, read from the station's panel kind.
  - A chimney with smoke over the forge.
  - Lit windows at night.
  - Two floors for the large ones: the shop below, the keeper's room above, reached by a ladder.
- **The Infernal layout** (cols, west → east). It keeps the old order so muscle memory and onboarding carry over:

  | Building / feature | Cols |
  |---|---|
  | Vault (vault-house) | 6–15 |
  | **Mine head** (headframe over the core's entry ledge; ladder down) | 2–5 |
  | Cinder seam outcrop (the `ore` station, a protected vein face) | 17–19 |
  | Material Vendor | 21–30 |
  | **Seamworks Forge** (the quest station; Kael) | 33–46 |
  | Town square: the **town stone**, the Hearth fire, benches, the pond | 47–62 |
  | Crafting Bench | 63–74 |
  | Rune Forge (Kael's counter; the Slate tier II strip) | 75–86 |
  | Enchanting Table | 87–98 |
  | the street east | 99–110 |
  | **Eclipse Beacon** tower | 111–115 |
  | **East gate** | 120–124 |

  The Homestead gate station disappears: you walk west into the Plot.
- The station `x` used by the engine becomes `col × 32 + 16` of the counter cell, and `y` the counter's floor.
  `findStation`, `?at=` and `goToStation` are unchanged in signature.

### 2.4 The onboarding beat keeps its shape

The east gate is a **portcullis** structure of three protected `gate-bar` cells. It opens on the `beacon` flag.

- The Rivet Maws roam **outside the wall**, at the west end of the Quarry region (sector 4).
- The beacon tower stands inside. Its `requires: 'guardian'` / `'beacon'` rules are unchanged: they read the same
  flags.
- When the beacon is relit, the bars' cells become air. The story beat and first-goals step fire exactly as the
  passage did.

### 2.5 NPCs: living there, cheaply

- **Placement.** Each keeper stands at their building's counter (`life.ts` keeper→station mapping, unchanged).
  Townsfolk walk street segments, which are runs of ground cells between buildings, computed once from the blueprint.
- **Routines.** These are a pure function of the clock's in-game hour, so there is no simulation and no save:

  | Hours | Where the keeper is | Station prompt |
  |---|---|---|
  | 06–19 | counter | normal |
  | 19–20 | walks to the Hearth fire, mid-square | follows the keeper ("Kael is at the fire") |
  | 20–23 | at the Hearth (the canon "evening at the fire" lines) | follows the keeper |
  | 23–06 | upstairs room, window lit, then dark | **Ring the bell**; the panel opens as usual and a sleepy line plays |

  Position is computed when the settlement enters view, then advanced like a walking townsperson. **A station is
  never closed by time** (owner rule: stations are dummy-simple).
- **Head marks.** **!** / **?** come from the missions model, as above. A name tag plus role title anchors on
  `painter.top` (chibi rule).
- **Streaming.** `SettlementLife` is active only while any settlement column is within the ring ±1 sector (about 1.5
  screens). Out of range, it does no work at all. Townsfolk tick at 30 Hz, as in the play-perf background rule. There
  are at most 12 keepers and 4 townsfolk drawn, all cached pixel sheets: one blit each.

### 2.6 Heights in cells, and the physics port

The High Roads route is re-authored in cells over the hunt region:

| Piece | In cells |
|---|---|
| shelf | 5 × 3 rock cells, top about 5 rows up |
| tree | climbable `trunk` cells plus a one-way `canopy` row |
| floating ruin + rope bridge | `ruin-brick` cells and one-way `plank` cells, about 11 rows up |
| mesa | — |
| snag | trunk with no canopy |
| ruin block | needs a wall-jump |
| slab | — |
| spire | summit about 22 rows up |

**`engine/terrain-moves.ts`** (new, pure) ports `surface-body.ts`'s ledge-grab, mantle and wall-jump tuning onto
cells:

- A lip is a solid cell whose upper neighbour is air.
- The same windows apply: 110–188 px lip → **55–94 px** at the new scale; that is 2–3 cells.
- Climbing reuses the existing ladder/rope climb (`CLIMB_KIND`).
- These moves apply **everywhere**, the Delve included, which the owner asked for ("parkour").

Tests: `seamworks-engine.test.cjs`'s 10 surface tests are ported cell-for-cell, plus the 4000-frame random-input
"never inside a solid" test.

### 2.7 Streaming a populated surface

- **Generation.** `surface-gen.ts` (pure, deterministic per world spec plus the seed for wild features) writes the sky
  band and ground profile of a sector column. Authored sectors are stamped from blueprints and region stamps;
  everything else is procedural.

  Like `sector-gen`, it hashes integers only. Budget: **≤ 0.6 ms per column** on node, on top of the existing about
  1.4 ms per two sectors. A new golden-hash test pins rows < 0. **Rows ≥ 0 are byte-identical**: the
  `delve-endless`, `underhearth`, `rift-gates`, `realm-delves` and `celestial-delve` goldens stay green unchanged.
  That is the regression gate for the whole restructure.
- **Entities per column.** `loaded(column)` spawns that column's:
  - region creatures;
  - gather sites;
  - stone;
  - settlement life (when the column is in the settlement).

  `unloading` removes them. This is the existing hall-creature path, generalised.
- **Lighting.** Skylight (§0, clock) has two parts:
  - an open-sky column's cells down to the first solid get `sun` light;
  - the darkness overlay's surface alpha is `night × 0.55`.

  Lit windows, the Hearth and lanterns are ordinary light sources (`lighting.ts` slots). On phones, everything stays
  inside the half-res darkness overlay, as `delve-perf.md` fix 2 does today.
- **Backdrop.** The town's **pixel parallax** (`pixel-parallax.ts`) replaces the painted Delve sky on the surface.
  This also closes the one-art-style leftover "the Delve surface's painted sky". It is baked once per view on phones
  (`cacheBackdrop`) and hidden underground by the existing `maskBackdrop`.

### 2.8 Phone perf budget

The reference is 390×844 @3, 4× CPU, software raster (`delve-perf.md` method, alternating base/change runs, medians of
3).

| Scene | Today | Target | Guard |
|---|---|---|---|
| Settlement, midday, keepers in view (new) | n/a (town 35 / 50 in an old run) | p50 ≤ 17, p95 ≤ 34 | **p95 < 50, p50 < 34** |
| Settlement at night (overlay + windows) | n/a | p50 ≤ 17, p95 ≤ 34 | same guard, second scene |
| Wide traverse into the wilds | 16.7 / 18.4 | unchanged ± one vsync step | — |
| Furnace Hall (tightest deep scene) | 17.0 / 34.8 | unchanged | existing p95 < 70 / p50 < 45 |

Expected cost, unthrottled:

| Item | ms |
|---|---|
| sky-band chunks (mostly air; `terrain-render` must skip all-air chunks, which needs verifying in P1) | ≈ 0 |
| building chunks (baked) | ≈ 0.5 |
| figure blits, about 16 | ≈ 0.4 |
| baked parallax | ≈ 0.9 |
| night overlay | ≈ 1.9 (only at night, replacing nothing) |

These fit inside the wide-traverse budget that holds today.

---

## 3. Waystones

### 3.1 Which stones exist

| Kind | Where | Lit when | Count |
|---|---|---|---|
| **Town stone** (trunk) | each settlement square | always (Sera's Compact trunk line) | 5 |
| **Region stone** | the far end of each hunt region (sector 7) | lit by hand | 5 |
| **Deep stones** | the Underhearth Landing (Ember, row 65); each realm's **Gate Hollow** | the Landing by hand; a Gate Hollow on your first step through its gate | 1 + 4 |
| **Wild stones** | the surface, every 8 sectors from ±12 outward | lit by hand | ∞ |

Wild stones:

- `sx ≡ 4 (mod 8)` for |sx| ≥ 12.
- The column within the sector is hashed from the **world spec salt**, not the player's seed, so friends can say "the
  third stone east" and mean the same place.
- Id: `<world>:ws:<sx>`.

The 15 authored stones are the **Meridian Survey** set (§3.4).

### 3.2 Discovering and lighting

- **Discovered** when it enters view. It shows on the map as a grey stone, and Glim says the first one's line once.
- **Lit** by holding E for 1.2 s. One primary action: "Light the stone". There is a short ritual:
  - the stone's seams climb from violet to gold;
  - the `portal` sound cue plays;
  - a one-time grant of **+15 Delving XP** (the rift-shrine rate), keyed by mutation id `waystone:<id>`;
  - the map's fog clears within ±2 sectors of the stone, sky band and ground surface only, never the underground.
- The receipt is written first, through the gateway. Nothing else is paid: no Gold, so `economy-sim` is unaffected
  apart from the survey marks.

### 3.3 Travel

- **Stone to stone.** Standing at any lit stone (or at a Rift Anchor), E or a tap opens the **Travel map** on that
  world, with a world switcher across the top showing worlds whose town stone you have stood at.
  - Lit stones and anchors are pins. Tap one to see **"Travel to the Quarry Head stone"**: one primary button with no
  cost.
  - A 1.5 s channel, then a fade.
  - `SectorWorld.center()` on the target. The target column is prefetched during the channel, so the cold start is
  hidden.
- **Recall.** From **anywhere**, the Travel map offers one more row: "Return to <this world's town>". It is free, has
  a 3 s channel, and follows the Slate's busy rule (`slateRefusal`: not mid-fight, no line out, no story card). It
  replaces the "Return to Seamworks" passage and the anchor sheet's "home" row.
- **Cross-world travel** is only from stone to stone: town stones are always lit, and wild stones count once lit. A
  Rift Gate is the other door.
- **Login.** A per-world resume point `at: {world, col, row, t}` is saved every 10 s **only when the spot is safe**:
  grounded, not in a liquid, no creature within reach, not on a cart or grapple. Otherwise the last lit stone is used.
  This answers the owner's "when I log in, inside the village": you log in where you were.

### 3.4 Meaning and lore

- **Lore** (pre-approved; to log in `lore-addendum.md`). Every Waystone is a Meridian transit aperture of Sera Quill's
  Compact (canon, addendum line 793).
  - When the fracture moved "down", the wild apertures went dark. Act II has Sera "recalibrate nine to the new down";
    the rest wait for a Keeper's mark at "Keeper height" (Act II's sixth mark).
  - A lit stone agrees with every other lit stone. The rule echoes the Rift Anchor's "both ends agree".
  - The Ridge Couriers walked before the stones. Lighting one is walking their road once, so that nobody has to again.
- **Meridian Survey** (the Codex set, built on the Lost Cabinets pattern):

  | Stones lit | Mark |
  |---|---|
  | 4 | **Sera's Chart**: lighting a stone clears ±3 sectors of fog |
  | 8 | **Quick Hands**: the channel drops to 0.8 s |
  | 12 | **Couriers' Memory**: the High Roads finds of a region show on its map |
  | 15 | title **Meridian Surveyor** and 20 min of income (rule I daily band) |

  Wild stones lit are a tally on the Codex page, with no reward. Run `economy-sim --waystones` in `--check`.
- **check-meaning.** A Waystone is a feature, not an item, so it needs:
  - source: found in the world;
  - use: travel;
  - lore: Sera;
  - visible: the map and the Codex.

  The existing **Waystone Shard** keeps its use (Rift Anchors). Its lore line "a splinter from a waystone that was
  never built" now has stones to be a splinter *of*.

### 3.5 UI and the Slate Map app

- **One component**, `play/world-travel/travel-map.component.ts`: lazy, standalone, i18n in `world-travel.i18n.ts`,
  EN + ES. It is built over `delve-map.ts`'s world map with a `WaystoneLayer`.
- It is the **Slate's Map app**. The contract the in-flight Slate work should code against:
  - `WaystoneService.view$`: `{ world, stones: {id, col, row, lit, seen}[], anchors, here: stoneId | null }`;
  - `travel(stoneId)`;
  - `recall()`;
  - `canTravel(): string | null`, which wraps `slateRefusal`.
- Outside the Slate it opens on **M** or at a stone.
- Phone layout: map full-bleed, pins ≥ 44 px hit targets, one primary button pinned to the bottom. Details (survey
  progress, lore) sit behind a tap, the same rule as the station kit.

---

## 4. Save v3

### 4.1 Blobs

There are zero players, so v3 is a **new set of keys**, written only while the One World gate is on. v2 is untouched
until P4, so flipping the gate off returns you to the old game intact. That is what makes every phase safe to ship.

| Key → doc | Shape | Merge |
|---|---|---|
| `godforge-world` → `progress/world` | `{ version: 3, seed, createdAt, worlds: { ember\|ink\|root\|prism\|orrery: { core: {layout, cells, seen, wet, liquids} } }, claimed: string[], chests, at: {world, col, row, t} }` | the earliest seed wins (as today); per world, the v2 core rules; `claimed` and chests unioned; for `at`, the later `t` wins |
| `godforge-world-r0..23` → `progress/world-r0..23` | `{ v: 3, world, seed, rx, ry, t, sectors }` (ry signed) | `mergeRegionSlots`, extended so that two different (world, rx, ry) in one slot keep the later |
| `godforge-waystones` → `progress/waystones` | `{ lit: string[], seen: string[], marks: string[] }` | union (the cabinets pattern) |

- **24 shared slots replace 32.** Today there are 16 Ember slots plus 4 × 4 rift slots. The 24 regions changed most
  recently, across all worlds, ride in the cloud; the rest stay on the device. Reads per load drop from 32 to 24 + 2.
  **No `firestore.rules` change**: the new docs fall under the generic `users/{uid}/progress/{docId}` rule. I verified
  this at `firestore.rules:92-109`; its only special case is `docId == 'state'`.
- **Cell ids** become one scheme: `pack(sx, sy, local)`. That retires the "a core cell keeps its v1 index" special
  case (`SectorWorld.cellId`). Chest keys are `<world>:<cellId>`.
- **Device store**: IndexedDB `eclipse-world` / `regions`, key `world:seed:rx_ry`. The fallback is the
  localStorage key `godforge-world-far` through the gateway, with the same 750 k cap.
- **Registration**: every key goes through `cloud-save.model.ts` `SYNCED_BLOBS` and `LocalSaveRegistry` (flush +
  rehydrate), plus `save-reset`. Never through raw localStorage (memory: "Game state goes through the gateway").

### 4.2 Migration (v2 → v3, once, on first load with the gate on)

| What | Action | Why |
|---|---|---|
| `godforge-delve.claimed` | copied into `godforge-world.claimed` | guardians felled, fragments, `rift-attuned:*`, receipts: progress, not terrain |
| `godforge-delve.chests` | contents **returned to the Vault**: ledger holder `delve-chest:<born>` → vault, stacks granted with op id `v3-chest:<born>` | the owner's rule "nothing is ever deleted" (M3) |
| v2 dig diffs, regions, rift slots | **not migrated** | the world moved: a settlement now sits on the surface. Zero players. The owner's own digs are §6 Q2. |
| `godforge-gathering` | dropped | respawn timers only |
| `godforge-heights`, `godforge-cabinets`, pets, story, everything else | untouched | ids unchanged |

The migrator (`shared/delve/delve-migration-v3.ts`) is idempotent: a `migrated: 'v2'` marker sits inside
`godforge-world`. A Karma spec covers it: a seeded v2 save leads to claims kept, chest items in the Vault, and nothing
paid twice on reload.

### 4.3 What to delete (P4)

- **Save code**:
  - the keys `godforge-delve`, `godforge-delve-r0..15`, `godforge-rift-<realm>-r0..3`, `godforge-delve-far`;
  - the IndexedDB `eclipse-delve` database (deleted on load);
  - `mergeDelveSaves` v1/v2 and the v1-index cell-id path.

  The migrator keeps a v2 *reader* for one release, and P5 deletes it.
- **World code**:
  - `kind: 'passage' | 'waystone'`, and `TownDef.hunts` as areas (replaced by `regions`);
  - the flat-area render and physics paths for towns and hunts: `ground-strip.ts`, `surface-body.ts`,
    `surface-render.ts`, the `QUARTER` offsets, town `platforms`, `atmosphere.ts` hub scenery (its pieces become
    settlement props in `hub-pixel.ts`);
  - in `side-scroller`: the `WaystoneRow` panel and the anchor sheet;
  - the Homestead area, and the gate drawing in `homestead-render.ts`;
  - the town perf scenes.

---

## 5. Phased build plan

**The gate**: `oneWorld`, a per-device preview set three ways:

- Menu → "One World (preview)";
- `?oneworld=1` / `?oneworld=0`;
- read by a tiny eager `OneWorldFlag` (no imports).

It defaults off until the flip at the end of P3, and is deleted in P4. With the gate off, nothing in v3 runs and no v3
key is written.

**Order with in-flight work.** P1 starts from `main` **after** these merge, because they touch the same files:

| Branch | State | Overlaps P1 on |
|---|---|---|
| `world-clock` | uncommitted | `towns/*.ts`, `world.model.ts` (`WorldHour`), `keeper-lines.ts`, `cloud-save.model.ts` |
| `touch-and-tools` | committed | `engine.ts` +111, `side-scroller` +51, `keeper-paint.ts` |
| `menus-orientation` | uncommitted | the `side-scroller.component.{ts,html,css}` and `station-ui` |

If any of them is still open on P1's day, P1 does its engine-only work first (P1.a below), which overlaps only
`engine.ts`/`terrain.ts`. The Slate Map work is not visible on any branch here; the contract in §3.5 is the
integration point, and whichever lands second adapts.

**Agents** (`docs/agents/BRIEF.md`, budget memory: at most 2–3 at once, Opus for risky engine and save work, Sonnet for
well-specified content):

### P1 — Foundation + the Seamworks on the Ember surface + Waystones  *(L, Opus ×2 in sequence, then Sonnet)*

**P1.a engine (Opus).**
- `terrain.ts`: `rowLo`, `inside`, and the `row < 0` sites.
- New `surface-gen.ts` and `blueprints.ts`.
- `sector-world.ts`: signed `sy`, the per-column entity hook, `back` layer drawing in `terrain-render.ts`.
- Skylight in `lighting.ts`.
- `StationDef.y`; the station reach in `world.model.ts`.
- `regionAt`.
- New file `scripts/one-world.test.cjs`:
  - rows < 0 goldens;
  - rows ≥ 0 byte-identical on five seeds;
  - stations reachable from the street;
  - every Infernal station's counter reachable on foot from the stone;
  - the mine head reaches the core ledge;
  - generation time.

**P1.b save + travel (Opus).**
- `shared/delve/` v3 model, region model, service and migrator; `cloud-save.model.ts` registration.
- `shared/waystones/*`.
- `play/world-travel/travel-map.component.ts`.
- `delve-map.ts` layers.
- Presence `zone` = world.
- `place-for-route.ts` (regions).
- The `oneWorld` flag.

**P1.c settlement content (Sonnet).**
- `play/world/worlds/ember.world.ts`: layout, blueprints, the pond, stones.
- `engine/settlement-life.ts`, adapting `TownLife` with routines over the clock.
- Head marks.
- Lore addendum, i18n EN + ES.
- `e2e/play-one-world.spec.ts`:
  - spawn at the town stone;
  - walk to each Infernal station by id and open it;
  - enter the mine head and dig;
  - light the Landing stone (seeded Underhearth access);
  - travel back;
  - recall;
  - reload resumes the position;
  - presence zone.
- `e2e/play-delve-fixtures.ts` `withWorld()`.
- The Settlement perf scenes and guard.

**Ships:** with the gate on, the Infernal realm is one world. During P1 the old Ember Quarry and the Homestead are
reached by two **temporary arch structures** at the east gate and the west edge. They enter the legacy areas, so
nothing is lost. The trunk line's other four towns open their legacy scenes.

**Risks:**
- `engine.ts` (5.9 k lines) has about 96 `FLOOR` references; stations, life and sites assume a flat floor. Mitigation:
  `y` defaults to `FLOOR`, and only terrain-mode code reads the new fields.
- The settlement perf is unmeasured until P1.c.
- The all-air chunk skip needs verifying.

### P2 — Hunts become regions, the High Roads in cells, the Plot  *(L, Opus for physics, Sonnet for content)*

**Opus:**
- `engine/terrain-moves.ts`: ledge-grab, mantle, wall-jump on cells, everywhere.
- Region monster and site spawning per column.
- The east-gate portcullis.

**Sonnet:**
- The Ember Quarry region:
  - nodes with `y` and the clock's `when` nodes;
  - Maws;
  - the cells route in the sky band;
  - finds re-placed, ids kept;
  - Hollis.
- The Plot region: `homestead-render.ts` `FLOOR` → `baseY` (108 references), drawn at 2 px; the Home Forge stations.
- Cabinets re-placed (Seamworks, Ember Quarry), plus the node test.
- `godforge-gathering` re-keyed.

**Specs:** rewrite `play-hunting`, `play-surface`, `play-homestead`, `play-cabinets` (Infernal part), and
`play-first-session` with the portcullis.

**Ships:** the Infernal realm with no legacy areas left. The temporary arches are removed.

**Risks:**
- Parkour feel at half scale. Mitigation: port surface-body's numbers proportionally and pin them with the 10 ported
  tests; an owner play-check is the real gate.
- Ledge-grab inside the Delve could catch on dig edges. Mitigation: grab only while airborne near the apex, as in
  surface-body.

### P3 — The four realm worlds, then the flip  *(XL; one Opus for the world shell, then Sonnet ×2 in parallel, two realms each)*

**Opus (world shell):**
- Realm world specs:
  - ground −8;
  - the Compact seal node, gated on `rift-attuned:<realm>` + pick tier (the Banked-seal check path);
  - surface-gen palettes per realm.
- `enterRealm` / `leaveRealm` switch worlds; Gate Hollow stones light on first entry.
- The `pond` fishing table and `waterFor`.

**Sonnet ×2 (content, two realms each):**
- Settlements:
  - Ink: the Croupier's street + Exchange;
  - Prism: the Market court;
  - Orrery: the observatory, Codex, Leaderboards;
  - Root: the lodge — Sanctum, Quests, Arena, Trials.
- Regions plus the High Roads in cells; west regions; cabinets; keepers' routines and head marks.
- Specs: `play-casino`, `play-reels`, `play-slate`, `play-economy`, and the town parts of `play-life` and
  `play-missions`.

**Then the flip:** the gate defaults to **on**. The whole play suite runs gate-on; legacy specs are kept only under the
gate-off project until P4.

**Risks:**
- Realm rules near the surface: the Ink tide, Root regrowth and Orrery fields all sit under the seal, so the town is
  untouched. Node test: no realm rule cell above row 0.
- Four settlements' worth of perf, measured per realm.
- The casino and Market flows (Lune's 10-plays Slate award) must still find their stations by id.

### P4 — Delete the old world  *(M, Sonnet + one Opus review)*

- Remove everything in §4.3.
- Remove the gate and the legacy specs (§1.3).
- Retire the town perf guard.
- Update `docs/agents/SYSTEMS.md` (the World row → One World), `world-plan.md` and `ROADMAP.md`.
- Gate: the full BRIEF gate, plus a CSS/keyframe dangling-reference sweep (memory note), `audit-nav`, and the build
  < 1.85 MB. The initial bundle should **shrink**, since flat-area code is gone and `travel-map` is lazy.

**Risks:**
- Hidden readers of `TownDef.hunts`. 13 non-spec files reference `TOWNS`/`RealmTownId`, so grep them all.
- `found-in.data.ts` strings must still name real places. They will, because region names are unchanged.

### P5 — Make it MapleStory-nice  *(M, Sonnet; owner play-checks)*

- Interiors: two-floor shops, upstairs rooms, furniture props.
- Shop windows that show live stock.
- Settlement ambience: the Hearth crowd at night, street lamps lit at dusk by Tomas Rill (the Court).
- Busier wilds: wild-stone shrines, grove events tied to the eclipse.
- A world atlas map screen.
- Delete the v2 reader.
- Owner-requested tuning from play.

### Test strategy, across phases

- **Regression anchor**: every existing node golden for rows ≥ 0, unchanged, in every phase. A diff there is a bug.
- **Pure-first**: `surface-gen`, `blueprints`, `terrain-moves`, `regionAt`, waystone rules, routines and the v3 merge
  are pure modules with node or Karma tests before any engine wiring. The merge must be commutative and idempotent,
  as for cabinets and pets.
- **Reachability sweeps**: node, 5 seeds:
  - every station counter, stone, find and cabinet is reachable on foot from the town stone;
  - every surface cabinet stands clear of every station's reach;
  - no realm rule cell above row 0.
- **E2E per phase**: the new `play-one-world` / `play-waystones` at 1280×800 (keys) and 390×844 (touch), chromium and
  webkit, plus the specs listed for that phase. Before trusting a gate: an own `PW_PORT` (memory: shared port), the
  node_modules symlink, and clearing sync duplicates.
- **Perf**: alternate base and change runs, medians of 3, the Settlement guard in `perf-play.spec.ts`.
- **Gate discipline**: until the flip, the full suite runs gate-off, and the new specs run gate-on.

---

## 6. Open questions (owner's call only)

1. **The trunk line.**
   - Default: the five town Waystones are always lit, so a new Keeper can travel to any realm's town on day one and
     arrive in that living world.
   - Alternative: only the Seamworks stone is lit, and every other realm must first be reached through its Rift Gate
     or by walking to a lit stone. That is purer exploration, but it locks the casino, the Market, the Codex and the
     Quest Board behind Delving 20–36.
   - Proceeding with the default unless the owner says otherwise.
2. **The owner's own v2 Delve.** At the flip, v3 starts the terrain fresh. Felled guardians, attunements and other
   claims carry over, and chest contents go to the Vault, but **tunnels and builds dug in v2 do not**: the core and
   wings regenerate under the new surface. Is that acceptable, or should the migrator also copy the v2 cell diffs
   below row 0 into v3? That is possible for the Ember core and wings (same generator, same rows) at about 1 day of
   extra work and one more spec.
3. **New place names.** The working names need the owner's approval, since canon names are the owner's:
   - the four realm west regions: Moonlit Stacks, Dawn Terraces, Ring Garden, Lodge Clearing;
   - the five region stones, such as "Quarry Head stone";
   - "the Plot";
   - the "Meridian Survey" set and its marks.

   They ship as working names, logged in `lore-addendum.md` as "owner reviews in play", and can be renamed in
   one i18n table each.
