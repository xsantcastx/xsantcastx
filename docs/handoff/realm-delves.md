# Handoff: the Root Deeps + the Prism Mines (two more Rift Gate realms) — 2026-10-15

Owner: portals inside the Delve to other realms "like deeper delves or crazy". The Ink Deeps shipped first
(`rift-gates.md`); this opens the **Verdant** and **Luminous** gates. The Celestial gate still settles.
Lore: `docs/world/lore-addendum.md`, "The Root Deeps and the Prism Mines" (shipped — owner reviews in play).

## What a player gets

| | The Root Deeps (Verdant) | The Prism Mines (Luminous) |
|---|---|---|
| Gate | Root Hollows, lattice cell −2 (west of the shaft) | Glowcap Grotto, lattice cell 4 |
| Attune | Delving 32 + **Verdant Sigil** (4 rift splinters, 2 Verdant Sap, 1 Infernal Heartstone; Smithing 55, 16k) | Delving 28 + **Luminous Sigil** (4 splinters, 2 Luminous Prism, 1 Emberheart Ore; Smithing 52, 14k) |
| Broken rule | **Dug rock grows back** | **Light is solid** |
| Bands (64 rows) | Root Tangle (rootwood, Pick III) / Heartwood Deep (heartwood, Pick IV) | Prism Galleries (prism-stone, Pick III) / Dawnglass Deep (dawnstone, Pick IV) |
| Ores | Rootglass (Mining 50), Heart-amber (58); Verdant Sap from spore pods (sickle) | Prismite (50), Dawnglass (58); Luminous Prism from prism blooms (sickle) |
| Gear | **Rootsever Billhook** (carried): what you dig stays dug | **Dawn Lens** (carried): your lantern lights shadow glass round you |
| Creatures | Graftling (warrens) | Prismling (galleries) |
| Boss (once) | **The Graftmother** (1300 HP) | **The Hollow Sun** (1200 HP) |
| Chain | Kesh Arbo & Siv Moss (filed by the Archivist): *The Wood That Remembers* → *What Grows Back* (10 rootglass, 4 heart-amber) → *The Graftmother* | Aureth, with Lune Coyne: *Where the Sun Goes Down* → *Odds on the Light* (10 prismite, 4 dawnglass) → *The Hollow Sun* |
| Rewards (v2 floors, rule I) | 90k / 130k / 300k; Thorn / Nexus / Fracture runes; billhook recipe; 2 Waystone Shards | 80k / 115k / 270k; Glint / Sigil / Forge runes; lens recipe; 2 Waystone Shards |

**Regrowth** (`verdant.ts`): a cell dug out of living wood (rootwood, heartwood, its ores, a heart-root, a spore
pod) fills again 18 s later; roots visibly creep in over the last 6 s. It waits while the Keeper or a creature is
in the cell (never a trap). Held open by: a placed light within 2 cells (burnt), a support within its reach or
anything placed beside it (held), or the billhook (cut clean). Ore grows back as the wood round it. Heart-roots and
spore pods come back as themselves and are never saved as gone. Living vines (climb + one-way top) hang from
roofs; the core's vine shaft (west tunnel, col 10) is the way down to the Graftmother. Spore pods burst under the
feet or against the head (8 dmg); struck from the side with a sickle they give sap.
**The Graftmother**: while any heart-root (three 2-cell pillars on her floor) stands she heals 14/s, takes a
quarter of each blow and grows two graftlings every 18 s. Cut the pillars and torch the stumps.

**Solid light** (`luminous.ts`): a sun-prism (in a roof) shines down; open air in the beam becomes a **light
shaft** (climb + one-way) going down and a **light bridge** (one-way floor) going across. Prism mirrors ('/', '\')
turn it; E turns a mirror (also one set in the floor under you). Beams stop at rock, placed things, liquid, or 48
cells. **Shadow glass** is a hole until lit (a placed light within 4 cells, a beam through it, or the Dawn Lens
within 3 cells of the feet). No fall damage; every shadow pit has stairs out. Light-made cells are worked out every
0.15 s round the Keeper (±40 cols, beams traced ±88) and are never saved; a column leaving the ring keeps none.
Mirror turns are saved. **The Core's Sunwell Crossing**: the east tunnel's pit, the mirror on its west lip — turn
it and the beam bridges the pit. **The Hollow Sun**: blows pass through it unless a beam crosses its body (then it
cannot move); the west tunnel's sun is a ladder of light down the shaft into its hall, ending on a mirror: turn it
and the beam crosses the hall. Every 12 s near it, it flares: the hall's mirrors turn back, 20 dmg within 4 cells.

Glim says each rule once, the first time it applies (`play.rift.rule.*`: roots, regrow, cut, burn, held, spore,
vine, graft; light, bridge, glass, fall, mirrors, mirror.turn, prism). Sound: `REALM_DELVE_BEDS` (Root Deeps:
leaves + murmur; Prism Mines: chimes + air), footsteps on vines/glass/prism by material.

## Code map

| File | What |
|---|---|
| `play/engine/realm-kit.ts` | shared realm generator: banded column, vein roller, plan roller, the core hollow/hall/shaft every realm shares |
| `play/engine/verdant-gen.ts` / `luminous-gen.ts` | each realm's core, wings (spore hollow, vine shaft, graft warren / sunwell, shadow hall, prism gallery), dressing |
| `play/engine/verdant.ts` / `luminous.ts` | the rules, pure (regrowsAs, heldOpen; traceBeams, lightPanes, applyLight) |
| `play/engine/realm-gen.ts` | dispatches `realmColumn`/`realmPlans` by `spec.realm`; the Umbral generator unchanged |
| `play/engine/engine.ts` | `updateRealm` dispatch → `updateVerdant` / `updateLuminous`; `rootDug` hook in `recordCell`; `relight`, `turnMirror`, `drawRegrowth`; boss traits `graft`, `prism` |
| `play/engine/realm-creatures.ts` | chibi pixel graftling, Graftmother, prismling, Hollow Sun (spread into `CREATURE_ART`) |
| `play/engine/tile-art.ts` | pixel art for vines, bridges, shafts, glass, mirrors; rootwood/heartwood patterns |
| `play/world/towns/{verdant,luminous}-delve.ts` | the two areas (hunts of the Infernal town; no passage) |
| `shared/delve/rift-gates.model.ts` | both gates `open`, areas, new stack ids |

Saves: unchanged plumbing — each realm's core under its area id, wings in `godforge-rift-<realm>-r0..3`.

## Tests

- `node --test scripts/realm-delves.test.cjs` — 13: model; both generators deterministic + their cores; wings;
  beams/mirrors/bridges and shadow glass (pure); regrowth rules (pure); engine: through the Verdant gate, a dug ore
  grows back as wood, back out beside the gate; torch/billhook/never-on-the-Keeper; spore sting + regrowth, the
  Graftmother held/unrooted; through the Luminous gate, sun shafts, turning the mirror lays the bridge, walking it,
  back out; the Hollow Sun caught/free/flare. `rift-gates.test.cjs` updated (Celestial is the one settling).
- Karma `shared/delve/rift-gates.model.spec.ts` — three open gates, both areas/recipes/flags/missions pinned,
  each realm's sectors in its own slots, realm delve sound beds.
- e2e `e2e/play-realm-delves.spec.ts` (1280×800 + 390×844, each realm): camp at the gate → Glim notices → attune →
  enter → mine the ore → Root Deeps: the hole grows back / Prism Mines: turn the mirror, cross the pit on light →
  walk back out beside the gate. Shots: `output/realm-delves/` (`REALM_SHOTS=1`).

## Not done / next

- Regrowth is session-only: holes dug and left before a reload stay open (the dig diff is saved; the timer is not).
- Graftlings "join placed things into odd shapes" (spec) is not built; the Graftmother's call is the graft.
- Afterimage Moths / uncopied carvings (Luminous spec) not built. No new audio synthesis (beds reuse leaves/chimes).
- No perf scene added for these realms in `e2e/perf-play.spec.ts`; both are 64 rows like the Ink Deeps and the light
  pass is bounded (one Map, ≤ 176×64 reads per 0.15 s).
- The Celestial Star-Wells: spec in `rift-gates.md`; `realm-kit.ts` makes it a generator + a rule module.
