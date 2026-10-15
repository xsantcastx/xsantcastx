# The Living World — handoff

2026-10-15. Branch `living-world` (base `origin/main` f3717279). Owner, playing on a phone: "I traveled over 2m kms,
didn't even find one tree, or an NPC, or monsters or animals spawn, looks very boring, also mined over 2k blocks,
didn't find anything interesting except the fishing spots, nothing mysterious." Lore: `docs/world/lore-addendum.md`,
"The Living World" (shipped — owner reviews in play). Screenshots (not committed): `output/living-world/`.

## Measured first (`node scripts/living-world-survey.cjs [--sectors N] [--json]`)

64 sector columns east of the authored span and 64 west, five seeds (1, 424242, 0x5eedde1e, 77, 0xdeadbeef), the
One World Ember spec (its sky band over the endless Delve's shipped strata). Per sector column, averaged. "Interesting"
= a structure, a point of interest or Waystone, a monster pack or den, a find, a carved note, a mystery. Walking pace in
a world with terrain is 191 px/s (engine: 265 × .72), so a sector is 5.4 s; digging sideways is taken as a column a
second (a Keeper-tall tunnel, tier-1 pick). "structures" also counts the Underhearth's deep ones (unchanged).

| per sector column | before | after |
|---|---|---|
| creatures (packs, dens, halls) | 1.34 | 4.04 |
| surface monster packs | 0 | 0.61 |
| flora cells (ashwoods, bushes) / trees | 0 / 0 | 8.2 / 1.88 |
| points of interest (incl. wild Waystones) | 0.13 | 0.81 |
| NPCs (hermits) | 0 | 0.11 |
| underground finds | 0 | 2.47 |
| carved notes (secrets) | 0.62 | 1.36 |
| ores of note (slag, heartstone, glowcap, shadow-root cells) | 26.4 | 35.8 |
| liquid cells | 10.9 | 15.2 |
| critters (noon/midnight average) | 0 | 6.56 |
| the day's mysteries | 0 | 0.25 |
| sector columns with nothing at all | **13 %** | **0 %** |

| longest stretch with nothing interesting | before | after | target (guard) |
|---|---|---|---|
| surface (walking the wilds) | 269 cells = 8.4 sectors ≈ **45 s** | 56 cells = 1.75 sectors ≈ 9 s | ≤ 64 cells |
| Root Hollows (digging sideways) | 515 cells = 16 sectors ≈ 8.6 min | 81 cells ≈ 81 s | ≤ 96 cells |
| Basalt Caverns | 325 cells = 10 sectors | 91 cells | ≤ 96 |
| Glowcap Grotto | 346 cells = 11 sectors | 90 cells | ≤ 96 |
| Magma Halls | 260 cells = 8 sectors | 86 cells | ≤ 96 |

Before: the surface had nothing but a wild Waystone every 8 sectors, and a stratum had one structure per 64 columns
at best — exactly the owner's report. (Before numbers were taken on f3717279 with the same script, no living-world.ts.)

## The rules (`play/engine/living-world.ts`, `LIVING_TARGET`) and what a player meets

**Surface (One World's wilds; gate on).** Every wild sector column has ≥ 1 ashwood (`ashwood-trunk` climbed like a
rope, `ashwood-crown` stood on like a platform, `ashwood-burl` flush with the ground: axe, World-Root bark) and
0–2 ashberry bushes (sickle: Ember Grubs). A point of interest at least every 3 sectors (never three empty in a row;
a wild Waystone counts): a ruin (sometimes an old strongbox: a Root Crate), an abandoned camp (a waycache: torches), a
hermit (Orla / Tobb / Mira: a name tag, a hello bubble, words on the door, a gift once ever), a wayside shrine (the rift
shrine: map round it, as underground), a well sunk into a hill (still water: buckets, a line), a signpost. Every column
holds a Waystone, a POI or a pack. Carved words are `living:<id>` notes (EN + ES, a field note's 8 Delving XP once).

**Packs on a budget.** `packFor`: a pack on the longest level run of a wild column, more often and bigger with the
area level (`areaLevel` = sectors from town / 2, + 4 per stratum down), HP × `packScale(level)` (1 + 0.06/level, cap 3).
Rivet Maws by day, Cinder Bailiffs by night (`SectorHall.night`, chosen at spawn). None at a hermit's door or a
shrine. The plain endless Delve (gate off) gets the same packs on its surface ledge past the core. **All Living World
packs and dens wait** (`SectorHall.near`) until the Keeper is within 1400 × 900 px, and wake only while at most
`WILD_BUDGET` = 12 wild creatures are up (engine `wakeHalls`, 4×/s). They leave with their column. Drop tables are the
area's own (untouched: the loot/combat agent owns them); `packScale`/`areaLevel` are the one hook for their curve.

**Underground finds** (`findsInto`, both gate states, the four shipped strata, never the core): each stratum of each
sector column holds a find unless the column before had one and the roll says no (never two empty in a row), clear of
every structure (rift gates included) and inside its own column. Root Hollows: fossil beds (Rusted Rivets), hidden
cellars (ruin stone, an old strongbox, a note), cache nooks. Basalt: geodes (slag), sealed vaults (a cracked-wall door,
the staff's blast; the riddle cut beside it), Maw dens, fossil beds. Grotto: glowcap geodes, seam-engines (readable
brass on old rail), hidden pools (fishable). Magma: Bailiff dens, a **Bailiff elder** (one Bailiff, HP × 2.2 × level,
guarding a Bailiff's strongbox: a Seam Crate), seam-engines, heartstone geodes. Strongboxes are receipts (once each).

**Critters** (`crittersFor`, `wild-life.ts`, `critter-art.ts`): cinder finch (crowns; flocks over POIs), ash hare
(burrows over cellars/vaults), ember beetle (catch: Ember Grub), dusk moth (night; catch: Glowcap), glowworm (cave
ceilings, a small light of its own), leaping fish (over water). Shy ones fly or bolt; a swing catches the two with a
drop (`onCatch`, once a day per creature: `living-catch:<day>:<id>`). Chibi pixel, one cached sheet per type, one blit.

**The day's mysteries** (`mysteryAt`, per UTC day, one column in four, none in town): a wisp (drifts ahead of a follower,
settles; E: 12 Delving XP + 2 Glowcap), a whisper (walk into it: 6 XP and a line), a door that was not there yesterday
(on a cave floor; E: 15 XP + Ember Residue). Paid once a day each (`living-mystery:<id>`); Glim says a line (bond line).

## Files

| File | What |
|---|---|
| `play/engine/living-world.ts` | the rules, `surfacePlan`/`stampSurface`, `packFor`, `findsInto`, `crittersFor`, `mysteryAt`, tables (CRITTERS, HERMITS, NOTE_POOL, MYSTERY_REWARD), `WILD_BUDGET`. Pure. |
| `play/engine/surface-gen.ts` | `livingPlan`, `groundMemo`; `SurfaceColumn.notes/pois/plan`. |
| `play/engine/sector-gen.ts` | calls `findsInto` after the structures; `SECTOR_NODES` += `LIVING_NODES`. `SectorColumnGen.finds`. |
| `play/engine/sector-world.ts` | surface packs into the column's halls (both gate states); the sky band's notes; `gen.living`. |
| `play/engine/engine.ts` | `wakeHalls` (near + budget + night + scale), `loadWild`/`placeMystery`, catch on a swing, mystery E, whispers, lights, `wildCounts()`, `setMysteriesFound`; `living:` notes go to the host. |
| `play/engine/wild-life.ts`, `critter-art.ts` | the critters, hermits and mysteries in the world; the pixel sheets. |
| `play/engine/terrain.ts`, `tile-art.ts`, `terrain-render.ts` | 10 nodes appended; trunk/crown/bush/signpost/seam-engine pixel maps; solid props (`SOLID_PROPS`). |
| `play/side-scroller.component.ts`, `play/world/living-world.i18n.ts` | `livingNote`, `mysteryFound`, `critterCaught`; every word EN + ES (lazy). |
| `scripts/living-world-survey.cjs`, `scripts/living-world.test.cjs` | the survey; the guard (11 tests, incl. engine). |
| `scripts/check-meaning.js`, `scripts/economy-sim.mjs` | Living World block (critters, hermits, notes, mysteries); `--living` (in `--check`). |

**Generator version.** The finds are an additive pass with their own salt; nothing else the generator lays moves.
`SECTOR_GV` stays 1: a diff dug before re-applies cell for cell (zero players, see memory). Goldens moved deliberately:
`delve-endless` (5 columns) and `one-world` (wild sky columns −13, 12, 20); rows ≥ 0 stay byte-identical with the sky
band on. Two old tests needed a line: the liquids reload counts the channel's own water (a pool may share the ring),
and a solid prop has one pixel map (no variants).

## Gate (this branch)

check:meaning (no new violations; critters/hermits/mysteries now checked) · tsc app + spec · node: seamworks-engine,
homestead, home-forge, delve-endless (237/238 run concurrently with a build: the generation-time test read 8 ms under
load; alone it passes, and the finds cost ~0.1 ms of the ~2.0 ms column, sky band 0.13 ms ≪ 0.6), living-world (11),
one-world, underhearth, rift-gates, realm-delves, celestial-delve, lost-cabinets (all green serially) · ds-adherence ·
i18n · audit-nav · economy-sim --check (living: walking ≈ 1.2 k Gold/h, digging ≈ 1.5 k Gold/h at most: < 0.1 % of the
forge at 30 min) · build (initial 1.23 MB) · CSP hashes · perf guards (below) · e2e play suite on the merged build
(origin/main 881d3b72): 199/203 passed; the 4 `play-vault` specs failed in the full run and pass alone (6/6) · node
suite re-run serially at a normal machine load: 274/274, the generation-time tests included. Wild packs and critters
follow the world clock's dark (`setSky`: night or an eclipse), falling back to the One World hour.

## Perf (PLAY_PERF=1, 390×844 @3, 4× CPU, 20 s, chromium)

| Scene | p50 / p95 / max | long tasks | script ms/frame | alloc KB/frame |
|---|---|---|---|---|
| guard: town (Infernal) | 33.3 / 50.2 / 215.7 | 10 | 4.72 | 48.4 |
| guard: Furnace Hall | 33.3 / 51.0 / 84.3 | 42 | 7.32 | 35.0 |
| guard: Settlement midday | 16.7 / 33.3 / 133.3 | 1 | 4.20 | 60.1 |
| guard: Settlement night | 16.7 / 33.3 / 134.2 | 1 | 4.49 | 77.8 |
| wide traverse east (Delve wings: finds, packs, critters) | 16.7 / 33.3 / 34.2 | 0 | 3.69 | 27.9 |

All guards green (town p95 < 70; Furnace Hall p95 < 70, p50 < 45; Settlement p95 < 50, p50 < 34). The wide traverse is
at or under endless-delve.md's numbers (18.2–18.6 / 34.6–35.1). Critters and hermits only step within 1500 px and
draw on screen; packs and dens spawn near the Keeper only.

## Not done / next

- No e2e for the wilds yet (the node engine tests drive packs, catches, a hermit's door and a door mystery).
- Tameable critters: not built (pets are their own system; a hare or finch pet would be a `PETS` row).
- The hermits give once; a small repeatable quest per hermit (bring Mira a fish) is the next step.
- Realm worlds (P3) get their own critters/finds tables (the module is Ember-shaped: creature ids, notes).
- A wilds perf scene (needs a resume point in the wilds under the gate; prod builds have no `ng` global).
