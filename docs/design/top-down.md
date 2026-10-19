# Top-down — Eclipse Realms as a cozy 3/4 pixel RPG

Owner decision, 2026-10-19 (final): *"this is the direction we want to move forward with the 2D game"* — switch
from the side-scroller to a top-down 3/4 view like the reference screenshots (`docs/references/owner-ui/topdown-*`,
kept out of git: a snowy Christmas-market village, an autumn harvest fair, a river town with a mill, a lantern night
market round a fountain with named stalls, a monastery garden, a forest ruin pool; a parchment quest scroll top-left
and a round minimap top-right). Everything we built that is not "how the world is drawn and walked" carries over.

This doc is the plan of record. It supersedes `docs/design/one-world.md` for anything about the view; One World's
*ideas* (one connected world per realm, settlements built into it, Waystones you discover) carry over unchanged.

---

## 1. What carries over, what is rebuilt

**Carries over untouched (the game's substance):**

| System | Where | Note |
|---|---|---|
| Save gateway, LocalSaveRegistry, cloud save + merges, storage budget | `shared/save`, `shared/cloud-save` | New blobs only for the top-down world (§6). |
| Items, inventory, Vault, loot tiers, auras, runes/runewords, difficulty, resists | `shared/rpg`, `shared/loot` | Combat *rules* stay; only the engine's hit geometry changes. |
| Economy curve, `economy-sim --check` | `shared/economy`, `scripts/economy-sim.mjs` | Unchanged; new scenarios only if income changes. |
| Skills, levels, titles, tools | `shared/skills` | Tool use maps to the new interactions (§4). |
| Story, keepers, NPC looks + lines, quests, bounties, cabinets data, codex data | `shared/story`, `shared/npc`, `play/world/keeper-lines.ts`, … | Placement changes, content does not. |
| Pets (roles, levels, commands), Glim (bond, reactions, chat) | `shared/pets`, `shared/glim` | Followers re-implemented on the 2D grid; their brains/rules reused. |
| Mirror Slate phone + every app, casino (Reels, Cascade, Tumbler, Rune Drop…) | `shared/slate`, `shared/reels`, … | Untouched. |
| Menus (pixel windows), HUD chrome, Glim HUD icon, sound director, world clock, eclipses | `shared/*`, `play/*.css` | HUD adds the two reference widgets: quest scroll + round minimap. |
| Keeper painter (chibi), NPC looks, creature pixel sheets, item icons | `shared/keeper-look`, `play/engine/*-pixel.ts` | Characters gain **4 facings** (down/up/side) — the only art change for people. |
| i18n EN+ES, meaning check, nav audit, game-only shell | — | Unchanged rules. |

**Rebuilt for top-down:**

| Today (side view) | Becomes (top-down) |
|---|---|
| `engine.ts` side-scroller (7.4k lines): gravity, jump, platforms, ladders | `play/td/` engine: free 8-way walking on a tile grid, no gravity. Jump, ladders, ledge-grab, mantle, wall-jump, gravity flips **retire**. |
| Terrain columns you dig downward | **Floors**: a mine is a stack of top-down floors; you mine rocks *on* the floor and take ladders/stairs down (Stardew-style). |
| Surface / parallax backdrops / sky band | Tile maps with layers; the sky becomes **lighting + tint** (day/night/season/eclipse) over the whole map. |
| High Roads parkour | **Cliffs, ramps and hidden paths** in regions (look-outs and summit cairns become hilltops reached by winding paths). |
| Liquids (cellular water/lava flow) | Water/lava **tiles** with animated edges; fishing from any water edge; lava = hazard tile. |
| Creature AI (left/right patrol, wind-up, lunge) | 2D chase/patrol/flee on the grid with the same wind-up/strike/telegraph timings and the loot-and-combat rules. |
| Fishing (cast arc, line tension) | Cast a target onto water in front of you; same bite/tension/catch rules and fish shadows (top-down is *better* for this). |
| Building/placing (cells) | Place on the grid in front of / next to the Keeper (torches, chests, camps, supports); the Plot is a farm grid. |

---

## 2. The engine (`src/app/play/td/`)

**Scale.** Art tiles are **16×16 art px**. On phones the world draws at **2 CSS px per art px** (1 tile = 32 CSS px ≈
12 tiles across a 390 px portrait screen, ~26 in landscape); desktop ≥1280 px uses 3×. The canvas renders at device
pixels with integer scaling and `imageSmoothingEnabled = false` — crisp pixels at every DPR. The chibi Keeper (31 art
px tall) stands ~2 tiles tall, matching the references' proportions.

**Layers (draw order).**
1. *Ground* — grass, dirt, cobbles, snow, water, sand, autotiled (§4), baked per 16×16-tile **chunk** into an
   offscreen canvas once and blitted; animated water edges on a separate thin pass.
2. *Ground decor* — flowers, footprints, crop beds, rugs, paths overlays (also baked into the chunk).
3. *Y-sorted objects* — buildings, trees, fences, stalls, lamps, wagons, crates, NPCs, creatures, pets, the Keeper,
   drops — sorted by their **foot y** each frame (only those inside the camera rect + margin).
4. *Roofs / canopies* — building roofs and tree crowns are separate sprites drawn after their objects; they **fade to
   30%** when the Keeper is behind or inside them.
5. *Weather & particles* — chimney smoke, snow, leaves, fireflies, rain (pooled, capped).
6. *Lighting* — a half-resolution darkness canvas tinted by `WorldClockService` (day → dusk → night → eclipse) with
   light holes for lamps, windows, torches, the Keeper's lantern and Glim; season tint per realm.
7. *World-space UI* — name plates, "!" / "?" marks, drop beams and labels (loot-and-combat), interaction prompts.

**Streaming.** Maps are chunked (16×16 tiles). Chunks within the camera + 1 chunk margin are baked/kept; others are
dropped. Entities outside the active chunks are simulated cheaply (clock-driven NPC routines are a pure function of
time — §3) or frozen.

**Movement & input.**
- Phones: **drag-anywhere floating joystick** (appears where the thumb lands; 8-way + analogue speed) and **tap-to-walk**
  with A* pathfinding over the walkability grid (tap a keeper → walk there and talk; tap a node → walk and gather).
- A single context **Action** button (talk / open / gather / mine / fish / attack) chooses by what is in front of the
  Keeper; an Attack button; desktop: WASD/arrows + E/Space + click-to-walk.
- Collision: a small foot box (≈10×6 art px) against a tile walkability grid + object footprints (so you walk *behind*
  houses and lamps, not through them).

**Performance budget (unchanged bar).** ≤17 ms p50 / ≤33 ms p95 at 4× CPU throttle on 390×844; one cached sheet per
sprite type (play-memory must stay flat); chunks baked once; y-sort only visible entities; lighting at half resolution.
New `PLAY_PERF` scenes: Seamworks square (midday/night), forest region, mine floor.

**Contract with the app.** `TopDownEngine` implements the same `EngineOptions` callbacks the side-scroller uses
(`onStation`, `onState`, `onInteract`, `onLoot`, `rollLoot`, `onKill`, `onFish`, `onPlace`, `onWorldAction`,
`onDiscover`, …) and the same setters (`setKeeperLook`, `setHeldTools`, `setCombatRules`, `setSky`, `setPeers`,
`setChat`, `setPaused`, `goToStation`, `moveTo`…). The side-scroller component keeps all its service wiring and picks
the engine by the `topDown` gate — so stations, Satchel, Slate, quests, pets, Glim, loot and saves work on day one.

---

## 3. The world

**One connected world per realm** (One World's design, now top-down): the realm's **town** in the middle, **regions**
around it (forest, fields, river, ruins, cliffs), the **Homestead plot** to the west, **mine entrances** and the
**Rift Gate** placed in the world, Waystones you discover and light, the travel map on the Slate.

**Seamworks (Infernal) — first, hand-authored, at the reference density.** A town square with the Hearth fire and a
fountain-equivalent (a forge-fed brazier fountain), cobbled streets, **named stalls with awnings and string lights**
(Bench, Rune Forge, Enchanting, Vault, Vendor, Gambler, Market, Quest Board — each keeper at their stall), timber and
basalt houses with **chimney smoke** and lit windows at night, Kael's forge with a water wheel on the ember river,
bridges, gardens, benches, lamps, carts, barrels, townsfolk walking clock-driven routines, the mine head at the edge of
town. Every NPC and station keeps its id, so quests, `?at=` deep links, the nav audit and the meaning check still hold.

**Other realms** follow with their own palettes and landmarks: Umbral (ink canals, lantern night market — the
reference's night market is our model), Verdant (monastery-style gardens, root bridges), Luminous (glass glasshouses,
light wells), Celestial (observatory town, star-chart plazas).

**Seasons.** The world clock gains a season per real week (spring → summer → autumn → winter): palette swaps, snow,
falling leaves, seasonal stalls/festivals (the harvest fair and the winter market from the references become **seasonal
events** with their own stalls, music and rewards).

**Mines / Delves.** Floor-by-floor top-down mines: rocks/ore you break on the floor, monsters, ladders down (found by
breaking rocks), elevators every 5 floors, treasure rooms, cabinets, rift shrines, the Living World density guard
(something interesting on every floor). The Underhearth = floors 50+; each realm's mine keeps its **broken rule**:
Ink Deeps — rooms go dark and rearrange when unseen; Root Deeps — broken rock regrows; Prism Mines — light beams are
walkable bridges over chasms; Orrery Wells — gravity rooms reinterpreted as rotating floors/conveyor currents. Bosses
(Banked Furnace, Gloam Warden, Graftmother, Hollow Sun, Fallen Ephemeris) get top-down arenas with telegraphed attacks.

**Living World** carries over as density rules for the new maps: trees/flora per region, critters, wandering hermits,
ruins, camps, daily mysteries.

---

## 4. Art pipeline and style guide

- **Style:** warm, saturated, Stardew-like top-down pixel art; 16 px tiles; 1 px dark outlines on objects, none on
  ground tiles; light from the top-left; chibi characters (existing keeper painter) in 4 facings; cozy props everywhere.
  **Never copy the reference game's assets** — the references set the bar, not the pixels.
- **Procedural first:** extend the existing pixel painters (`keeper-paint`, `prop-pixel`, `creature-pixel`,
  `item-icons`) with a **tile painter** (grass/dirt/cobble/snow/water/sand + variants) and a **building kit**
  (walls × roofs × doors × windows × chimneys × awnings, per realm palette) so towns are composed, not hand-painted.
- **Autotiling:** 47-tile blob rules for grass↔dirt↔cobble↔water↔snow edges, generated from the base tiles.
- **Commissioned art path:** the existing manifest pipeline (`scripts/import-assets.py` → `art-manifest.generated.ts` →
  `artFor()`) gains tile/building sheets; any painted sheet replaces its procedural twin by id.
- **Seasonal palettes** as palette maps over the same tiles.

---

## 5. Phases (each ships behind the `topDown` gate; side-view stays default until P5)

| Phase | Scope | Done when |
|---|---|---|
| **P1 Engine + Seamworks square** | `play/td/` engine (chunks, layers, y-sort, roof fade, lighting/day-night), Keeper 4-facing walk (joystick + tap-to-walk + WASD), collision, camera; tile painter + building kit v1; the Seamworks square + 2 streets hand-authored; keepers at stalls; stations open through the existing panels; Glim + pet follow; HUD quest scroll + round minimap. | Walk the square on a phone at the reference quality bar, talk to every keeper, open every station, day/night works, perf guard green. |
| **P2 Whole town + Homestead** | All of Seamworks (river, mill, bridges, gardens, houses), townsfolk routines, Homestead farm plot (crops grid), Waystones, Slate map app top-down. | Town feels alive at noon and night; the plot grows something. |
| **P3 Combat + regions** | Top-down combat (melee arcs, telegraphs, ranged/roles from loot-and-combat), creatures, drops/beams, pets fight, Glim reacts; forest/fields/ruins regions with Living World density; fishing top-down. | A loop: walk out, fight, gather, fish, come back, craft. |
| **P4 Mines** | Floor-by-floor Ember mine to the Underhearth, ladders/elevators, ores, bosses, cabinets, rift shrines, save migration of Delve progress. | Reach the Banked Furnace top-down. |
| **P5 Flip** | Top-down becomes the default for new and existing saves; first-session/tutorial re-authored; e2e retargeted. | Every play spec green on top-down. |
| **P6 Other realms** | Umbral, Verdant, Luminous, Celestial towns + regions + their realm mines with broken rules; Rift Gates. | All five realms walkable. |
| **P7 Seasons & festivals** | Season clock, palettes, harvest fair, winter market, music per season. | A season turns and the town changes. |
| **P8 Retire side-view** | Delete the side-scroller engine, terrain digging, parallax, parkour, old specs. | Bundle and code shrink; one engine. |

**Saves.** New blobs: `godforge-td-world` (positions, opened/unlocked things, placed objects, farm plot) and
`godforge-td-mines` (deepest floor, elevator stops, floor states). Delve/One-World v2/v3 blobs migrate claims, chests
(→ Vault) and deepest depth (→ elevator unlocks); dug terrain is dropped (zero players — accepted earlier).

**Testing.** Node tests for the engine core (collision, pathfinding, y-sort, chunk streaming, mine generation);
Karma for models; e2e at 390×844 / 844×390 / 1280×800 per phase (walk, talk, open a station, fight, fish, mine);
`PLAY_PERF` scenes; play-memory flat. Specs are retargeted to top-down at P5, not deleted.

**In-flight branches.** `wip/nice-menus` — keep (menus are view-agnostic) and ship. `wip/perf-regression` — ship (cheap,
side-view still default until P5). `wip/one-world-p2` — parked; its ideas live on here.

---

## 6. Decisions (made) and owner questions

Decided: 16 px tiles at 2× on phones; 4-facing chibi Keeper; drag-anywhere joystick + tap-to-walk; procedural tiles +
building kit with a commissioned-art path; one world per realm; mines floor-by-floor; seasons weekly; gate then flip at
P5; side-view retired at P8.

Owner questions (defaults in bold, used unless told otherwise):
1. Season length — **one real week per season**, or one real day?
2. Farming on the Homestead plot — **yes, simple crops (plant / water / harvest) feeding cooking and the economy**, or
   decoration only?
3. Multiplayer in towns — **show other Keepers walking the town (existing Hearth presence)**, or solo for now?
