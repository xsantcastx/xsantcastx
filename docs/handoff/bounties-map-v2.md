# Handoff: the Board Herald's daily bounties and map v2 (Phase 7.4–7.5) — 2026-10-14

Spec: [docs/world/delve-and-beyond.md](../world/delve-and-beyond.md) §6.1 (map v2), §7.2 (recurring bounties),
§9 Phase 7 slices 7.4 and 7.5; [world-and-cast.md](../world/world-and-cast.md) §5 (no punishing streaks);
[glim.md](glim.md) (the hint ladder's step 3). Lore: [lore-addendum.md](../world/lore-addendum.md), "The Board
Herald's bounties and the map tools" (shipped — owner reviews in play). Built on the endless Delve
([endless-delve.md](endless-delve.md)).

## What a player can do now

### Pim Larkin's bounties (Quest Board, Rootglass Canopy)

- **Three Delve bounties a day**, on a new **Bounties** tab of the Quest Board (first after Ready), read out by
  Pim Larkin, Board Herald. Same station kit: the journal list, the selected bounty, ONE Claim button with its
  reward; story, rules and counts behind Details.
- **Drawn for you alone**: a pure function of your Delve's seed, the calendar day, the deepest stratum you have
  reached and the explored frontier east and west of the core (`drawBounties`). Drawn on the first read of the day
  and frozen (a reach target is set against the frontier at the draw). Two players see different boards; one player
  sees the same board on every device that draws it that day.
- **Every bounty sends you into the endless Delve**:

  | Kind | Asks | Counts (once per token) |
  |---|---|---|
  | reach (always slot 1) | "Reach sector N east/west of the core", 1–3 sector columns past your frontier | the explored frontier in the save (no event; read each second in the Delve and on the board) |
  | dig | break 3–10 of one stratum's veins: shadow-root, petrified trunk, Cinder Ore, Glowcap, ember-veined basalt | a generated cell broken at that depth (its cell is the token) |
  | structure | find a Keepers' ruin, Kael's waycache, Maw den, flooded shaft, wing lake, rift shrine, lava basin or Bailiff hall | standing in the structure's room (its id is the token) |
  | catch | land 2–4 fish in a lake past the core's walls | a landed catch from water outside the core (the cast is the token) |
  | torch | light 3–5 torches in a stratum | a torch placed at that depth (its cell is the token) |

  Only strata you have reached are named (the deepest row you have stood on, saved, only grows). Slots 2 and 3 are
  two different kinds, deeper strata a little likelier.
- **Rewards on rule I**: tier 1/2/3 pay **5/10/15 minutes of income** (floor 240/480/840 Gold for a brand-new save)
  and **40/70/110 Delving XP**. A day of bounties is at most 45 minutes of income.
- **Gifts**: the **Broken Astral Compass** with the first bounty you ever claim; a **Rift Map Fragment** every
  seventh *day* you claim one (days, not a streak: months apart count).
- **No streaks.** A missed day costs nothing: the board turns over to three new bounties. The only counts are
  **days visited** and **bounties claimed** (Details, and the Codex).
- When a bounty is finished in the Delve, the message line says "Bounty done: … Claim it at the Quest Board."
- **Pim** has a new line once you have claimed one; his Codex entry names the bounties.
- **Codex** (Collection tab, after People of the Realms): *The Board Herald's bounties*: counts, today's three with
  their standing, and what the two map tools do.

### Map v2 (the Delve's full map, M)

- **Pins**: "Add pin (n/12)", then tap or click the map where it goes. The selected pin opens an editor under the
  map: eight icons (Dig, Fish, Chest, Danger, Star, Way on, Rest, Unknown; colour swatches on phones, named on
  desktop), a name (up to 24 characters; blank shows the icon's word), Track / Stop tracking, Remove. Tap a pin on
  the map or its chip under the map to select it. Up to 12.
- **Waypoint**: a tracked pin is the map's goal: the gold dotted way runs to it through explored cells across the
  loaded sectors ("Way to Lake: 23 cells"); with no explored way, a straight dotted line ("dig along the gold
  line"). On the minimap a goal off its edge gets an arrow on the edge pointing at it. The tracked pin is a
  per-device view choice (`eclipse-delve-track`), like the minimap's fold.
- **Glim's mark**: a lamplight diamond, the map's goal while no pin is tracked (below).
- **The Broken Astral Compass** (held in the satchel): a short violet ray from the Keeper toward the nearest
  structure no lantern has touched, or carving in the core not yet copied, whichever is nearer.
- **The Rift Map Fragment**: "Read a Rift Map Fragment (n)" under the map spends one and draws the nearest unvisited
  structure (its room and surroundings) into your explored map, for good. With none near enough, nothing is spent.
  Found behind each rift shrine (the first touch) and from Pim every seventh bounty day.
- Legend: Your pin, Glim's mark, Compass.

### Glim's hint ladder, step 3 for Delve missions

The mission chip (Skills Lodge) asks Glim; the third answer is now "I'll mark it on your Delve map. Open the map (M)
and look for my light." The mark sits on the map for **30 minutes** at the mission's target (`GLIM_MARKS`): the
nearest shadow-root, Kael's cache (else a slag vein), a Glowcap, the nearest uncopied carving, the fragment, the
Grotto Mere, the drowned carving's place, a seep, lava. A place, never what a carving says; asking again re-marks.

## How it works

| File | What |
|---|---|
| `shared/bounties/bounty-save.model.ts` | `godforge-bounties` (synced `progress/bounties`): board, progress tokens, receipts, gifts, counts; `coerceBounties`, `mergeBounties` (no imports; eager via cloud-save) |
| `shared/bounties/bounty.model.ts` | templates, `drawBounties`, `BOUNTY_REWARDS`, `bountyGold`, `bountyCounts`, `bountyObserved`, `bountyLine` (pure; the economy sim loads it) |
| `shared/bounties/bounty.service.ts` | the only writer: `board()`, `refresh()`, `observe()`, `reached()`, `claim()` (receipt first) |
| `shared/bounties/bounties.i18n.ts` | every bounty string, EN + ES (lazy) |
| `quests/quests.component.*` | the Bounties tab, the claim, Details counts |
| `codex/codex-bounties.component.ts` | the Codex entry (`@defer`) |
| `shared/delve/map-pins.model.ts` | icons, colours, `MAX_PINS`, `cleanPinName`, `newPinId` |
| `shared/delve/delve-region.model.ts` | `p` (pins) on a region: `coercePin`, `mergePins` (later edit wins, a removal wins a tie) |
| `shared/delve/delve-save.service.ts` | `pins()`, `setPin()`, `removePin()` (tombstones), `exploredSpan()` (never rolls a seed) |
| `shared/delve/map-tools.model.ts` | the compass and the fragment: Found in, sources, uses (read by `found-in.data.ts` and `check-meaning.js`) |
| `play/engine/delve-map.ts` | `MapSource.pins/goal/pointer`, the overlays (pins, Glim's diamond, the compass ray, the minimap edge arrow), `findMark`, `terrainReader` |
| `play/engine/sector-world.ts` | `structuresNear`, `structureAt`, `seenAt`, `structureSeen`, `nearestUnseen`, `revealArea`, `coreReader` |
| `play/engine/engine.ts` | `keeperCell`, `structureHere`, `compassTarget`, `readRiftMap(spend)`, `findMark`; `WorldActionEvent.node` |
| `play/delve-map-view.ts` | taps (a press that moved ≤ 8 px) → `onTap(col, row)`; the drawn transform (`data-view` on the full map's canvas) |
| `play/side-scroller.component.*` | the bounty events (dig, torch, catch, structure, depth), the pins UI, the mark and compass tick (once a second), the fragment, the shrine's fragment grant; `data-glim-mark`, `data-compass`, `data-pins` |
| `shared/glim/glim.ts`, `glim.service.ts` | `show: 'atlas'` → step 3 `mark`; `GLIM_MARKS`, `GLIM_MARK_MS`, `activeMark`; `GlimService.mark()` stamps `lastAt['mark.<id>']` (the existing merge: the later stamp) |

**Replay safety.** A bounty's progress is a set of tokens (a cell, a cast, a structure id), so a replayed event never
counts twice and two devices merge by union. A claim writes its receipt (the bounty id) through the gateway before a
coin moves; Gold goes through `EconomyService.earnGold`, Delving XP through the skill gateway keyed
`bounty:<id>:xp`, gifts through `grantStack` keyed `bounty-kit:<receipt>` (compass, `seventh:<n>`). A merged-in
receipt from another device blocks the claim there too. The fragment's spend is keyed `rift-map:<structure id>`;
a shrine's fragment `delve-shrine:<id>:fragment`.

**Pins and the slots.** A pin is stored in the region of its cell (`{ id, c, r, i, n, t, d? }`), so it rides the
IndexedDB store and the 16 cloud slots with the digs there; placing, editing or removing one marks the region
changed (its slot goes up within 30 s, or at once on a flush). Removals are tombstones so they reach other devices;
a moved pin leaves one behind in its old region. No rules change: the region slots' documents already exist.

**Meaning.** The compass and the fragment have names, art (canon masters, `art-manifest`), lore (Collection Log
seed lore), Found in lines and sources/uses (`MAP_TOOLS`); `check:meaning` holds at the baseline (4, unchanged).

## Tests

- `node --test scripts/delve-endless.test.cjs` — **31** (8 new): the draw (deterministic per player and day, three
  kinds, a reach first, only strata reached, ids survive the save), rewards on rule I and token reading, the save's
  merge (commutative, idempotent, receipts and tokens unioned, the later board), pins (coerce, merge, region
  ownership), the way to a pin across a sector border, structures / the compass / a fragment read (refused spend
  draws nothing; a spend reveals and saves), Glim's marks for every Delve mission (wherever the ring is), the dig
  event's node.
- Karma: `bounty.service.spec.ts` (9): the draw frozen per day, days counted (never a streak), tokens once, claims
  paid once (twice, after a reload, after a merged receipt), gifts (compass once, a fragment every 7th claim day),
  strata, rehydrate, the synced blob. `delve-save.service.spec.ts` (+3): pins round-trip, edit/move/remove/cap,
  another device's pins and removals through the slot, `exploredSpan` never rolls a seed. `glim.spec.ts`: step 3 is a
  mark for every mission, marks expire and merge. `cloud-save.model.spec.ts` pins the key.
- `node scripts/economy-sim.mjs --bounties` (in `--check`): tiers inside the daily band, a day ≤ 60 min of income,
  the floor never beats the income after 30 min, a day's XP 4% of a level at Delving 20, 2,400 draws (determinism,
  kinds, strata, reach past the frontier).
- e2e (chromium): `play-bounties.spec.ts` (1280×800: a torch counts, three claims, the compass, nothing twice after a
  reload; 390×844: 44 px tab and Claim on screen, the seventh-day fragment, Details counts),
  `play-delve-nav.spec.ts` (+1 per size: place, icon, name, track, the way, reload, remove; every pin control 44 px),
  `play-glim.spec.ts` (+1 per size: the third hint marks a shadow-root; the map leads to Glim's mark).

Screenshots (not committed): `output/bounties/*.png` (`BOUNTY_SHOTS=1`, `DELVE_NAV_SHOTS=1`).

## Not done / next

- **Bounty kinds the spec lists that need systems not built yet**: defeat N creatures of a stratum (no per-stratum
  kill ledger), deliver N of a material (Quest Board deliveries are the missions' job), reveal N sectors (the reach
  covers it). Lava catches wait for Seam Rods being common; the catch template is water only.
- **The crate for every 7th day** (spec §7.2) became the Rift Map Fragment (it needed a source; the crate tiers are
  fishing's). Revisit when Hearth crates exist per stratum.
- The compass is **held**, not worn: equipment slots for charms do not exist yet (the Lodge charms work the same way).
- The fragment reveals the nearest unvisited structure outright; the spec's "only where it overlaps fog you have
  revealed nearby" partial reading was simplified (it reads *beside* your map: the target is chosen from your own
  explored frontier outward).
- Pins have no pinch-zoom placement aid; phones place at the zoomed map's scale (6 px a cell).
- Glim's Atlas (S4) as its own surface is still not built: the mark lives on the Delve map.
