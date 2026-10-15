# Handoff: the Orrery Wells (the Celestial Rift Gate) — 2026-10-15

The last Rift Gate opens; the set is complete (Umbral `rift-gates.md`, Verdant + Luminous `realm-delves.md`).
Lore: `docs/world/lore-addendum.md`, "The Orrery Wells" (shipped — owner reviews in play).

## What a player gets

| | The Orrery Wells (Celestial) |
|---|---|
| Gate | Magma Halls, lattice cell 6 (stratum 3) |
| Attune | Delving 36 + **Celestial Sigil** (4 rift splinters, 2 Celestial Alloy, 2 Emberheart Ore; Smithing 58, 18k) |
| Broken rule | **Down is negotiable** |
| Bands (64 rows) | Brass Galleries (astral stone, Pick III) / Nadir Deep (nadir stone, Pick IV) |
| Ores | Starsteel (Mining 50), Meridian Glass (58); orrery scrap → Celestial Alloy (a world source at last) |
| Gear | **Orrery Key** (carried): E turns the field you stand in from anywhere in it; Down sinks you out of a star-well |
| Creature | Anchor Warden (warden galleries) — the Atlas creature that never spawned; baseline entry removed |
| Boss (once) | **The Fallen Ephemeris** (1400 HP) |
| Chain | Sera Quill (filed by the Archivist): *The Measure Underneath* → *Error Bars* (10 starsteel, 4 meridian glass) → *The Fallen Ephemeris* |
| Rewards (v2 floors, rule I) | 100k / 145k / 330k; Pulse / Hollow / Eclipse runes; Orrery Key recipe; 2 Waystone Shards |

**The rule** (`celestial.ts`, pure): **orrery fields** are open air (they glitter; silver chevrons point their
down). A field's **orrery rings** decide it: brass = falls up (stand and walk on the ceiling), blue = down. E at
any ring turns *every* ring of that connected field (one field, one state); turns are saved like a dig. A field
with no ring rests down. **Star-wells** always fall up; a **star-chain** (climbable, gravity ignored while
climbing) beside every one. The Keeper's down is the field at the middle of its body: walk out of a field and
the ordinary down returns. No fall damage, falls capped at `TERMINAL_FALL`, jumps push away from the ceiling.
In a liquid, down is down. Physics: `stepTerrainBodyUp` (terrain.ts) mirrors `stepTerrainBody`; the box is
unchanged (feet at `y`), only the contact flips, so digging/E/hits keep working. The Keeper is drawn hanging.

**Never a softlock** (generator promise, tested over 5 seeds × 20 sectors): every field has rings in the rows
the body covers standing on its floor AND on its ceiling (`unreachableStands`); every star-well has a chain the
length of it, a floor and a roof. Vault doors are plain air at floor level.

**Core**: Gate Hollow (return gate, starsteel outcrop) → the **Turning Room** in the east tunnel: a blue field
over a 3-row pit (starsteel in its floor) — walk in, drop in, turn the pit's ring, fall up, walk the ceiling
east out of the field. West tunnel: a star-chain down the shaft to the **Orrery Well**, all field, 8 brass rings
(near ceiling and near floor at cols 12/28/42/55).

**The Fallen Ephemeris**: while its hall falls up it rides the ceiling (drawn `lift`ed), drifts toward the
Keeper and swipes one on the ceiling (14); no blow lands ("in orbit"). Turn any hall ring → it drops (`fallen`,
9 s, frozen, blows land). 1.5 s before it rises it `gather`s (rings flash, a line), then turns the hall brass,
pulses (16 within 3 cells) and grows two Anchor Wardens. Glim says each rule once (`play.rift.rule.*`: orrery,
field, well, ring, turn, chain, ephemeris). Sound: `REALM_DELVE_BEDS.celestial` (thin air, far brass, few drips).

**For the pets agent**: `EngineState.gravity` (1 | -1), `engine.keeperGravity`, canvas `data-gravity`
(`down|up`). The Keeper's `x/y` keep their meaning (y = bottom of the box); when gravity is -1 the Keeper's
contact is `y - 90` (DELVE_BOX height) and it is drawn hanging — a follower should hang from that line.

## Code map

| File | What |
|---|---|
| `play/engine/celestial.ts` | the rule, pure: `fieldAt`, `fieldDown`, `downAt`, `turnField`, `unreachableStands`, tuning |
| `play/engine/celestial-gen.ts` | core (Turning Room, Orrery Well), wings (orrery vault, star-well, warden gallery) |
| `play/engine/terrain.ts` | 10 nodes (appended: indices of older nodes unchanged), `stepTerrainBodyUp`, `use: 'ring'` |
| `play/engine/engine.ts` | `keeperDown`/`setDown`, `turnRing`, `updateCelestial`, `stepEphemeris`, `drawFields`, hanging draw, Key |
| `play/engine/realm-creatures.ts` | chibi pixel Anchor Warden + Fallen Ephemeris |
| `play/world/towns/celestial-delve.ts` | the area (a hunt of the Infernal town; no passage) |

## Tests

- `node --test scripts/celestial-delve.test.cjs` — 9: model, generator determinism + core, wings, the
  no-softlock sweep, the pure rule, up-physics (ceiling, step, jump, terminal), engine: gate → pit → ring → fall
  up → walk ceiling → out; star-well + chain + Orrery Key; the Ephemeris (orbit/fallen/gather/rise/defeat).
  `rift-gates.test.cjs` / `realm-delves.test.cjs` updated (all four open).
- Karma: `play/engine/celestial.spec.ts` (rule, physics, gen), `shared/delve/rift-gates.model.spec.ts` (area,
  recipes, flag pinned, Sera's chain, sound, own save slots).
- e2e `e2e/play-celestial-delve.spec.ts` (1280×800 + 390×844): find gate → attune → enter → mine starsteel →
  fall into the pit → turn the ring (data-gravity up) → walk the ceiling across → walk back out beside the gate.
  Shots: `output/celestial-delve/` (`REALM_SHOTS=1`).
- Perf (`e2e/perf-play.spec.ts`): harness scenes `realm:prism-mines`, `realm:orrery-wells`; guards for both
  under the Delve ceilings (p95 70 / p50 45 at 4× CPU).

## Not done / next

- Gravity flips up/down only: no sideways ("walk on walls") — the Keeper's box is tall and narrow and every
  system reads it upright; a rotated box is a larger change.
- Creatures ignore gravity (they walk their floor). The Ephemeris's "well" is its hall floor (no pit art).
- Field telegraph chevrons are an overlay in the realm's draw pass; rings are the state light.
- A Keeper digging out of a field's ceiling into plain air bobs at the edge (field below pulls up, air above
  pulls down) — harmless, walk sideways; noted, not fixed.
