# The Delve and Beyond: design bible and roadmap (Phase 6+)

**Status:** design proposal, 2026-10-14. Docs only; nothing here is built yet.
**Owner brief (2026-10-13):** "plan navigation in the delves: mini map, delve missions, an infinite
generated world; skills like fishing; lakes, lava and stuff; Terraria inspiration with a galactic mix:
universe, other dimensions, realms; read the lore and write better lore stories; everything we imagine
we can place in our world."
**Owner rules this obeys:** everything has a meaning (source, use, lore, visibility:
[meaning-audit.md](meaning-audit.md)); Terraria is the art and feel reference
([style-guide.md](../art/style-guide.md)); Gold only, never real money; AAA-quality decisions; phones are
first-class.

**Naming status.** Owner, 2026-10-14: "I trust the stories and lores you will write — I'll explore them
in game and approve them as I find them." So every **new** proper name in this document (strata, Reaches,
creatures, bosses, fish, items, structures) is **approved to ship**; the owner reviews them in play. They
are marked *(new)* only so a reader can tell them from names that already existed, which are cited where
they come from: the canon folder (`~/Documents/1. Projects/Eclipse Realms/docs/03-lore-and-design/`), the
in-game cast (`src/app/shared/npc/npc.model.ts`), in-game item lore (`src/app/shared/rpg/*.ts`), or a
shipped Delve system. New names still never contradict canon and still obey the meaning rule. The new
lore stories are in [lore-addendum.md](lore-addendum.md), section "The Delve and beyond", marked
"shipped — owner reviews in play".

Contents:
[1 Vision](#1-vision) ·
[2 The layer cake](#2-the-layer-cake) ·
[3 The endless Delve (generation and saves)](#3-the-endless-delve-generation-and-saves) ·
[4 Liquids](#4-liquids) ·
[5 Fishing](#5-fishing) ·
[6 Navigation and exploration](#6-navigation-and-exploration) ·
[7 Missions, bounties, events and bosses](#7-missions-bounties-events-and-bosses) ·
[8 Lore (where it lives)](#8-lore-where-it-lives) ·
[9 Phased roadmap](#9-phased-roadmap) ·
[10 Owner questions](#10-owner-questions)

---

## 1. Vision

**The Delve is the heart of the game.** Towns are where you trade, craft and talk; the Delve is where the
world is. It is the Godforge's fracture, followed all the way down.

The canon gives us the spine. The Godforge is "the primordial engine that turns will, matter, memory, and
possibility into real things"; its fracture "produced the Eclipse and scattered its workings as runes,
artifacts, rifts, and volatile resources" (lore canon, *The Godforge*). The Eclipse "thins the boundaries
between the five realms and the Void" and "reveals hidden paths" (canon, *The Eclipse*). The Void is
"unbound possibility, not a sixth realm, and must always feel alluring, immense, and unsafe" (canon,
*Runes and artifacts*). The game already says the Delve is "the way down the Godforge's fracture beneath
the Seamworks" (world plan, Phase 2.6) and that the crack "broke along a line someone had already drawn"
(`delve-fracture` lore reveal).

So the Delve keeps going. Under the four shipped biomes the fracture goes on through the Infernal realm's
oldest furnace, then through the floor of the world itself, into places that are **not realms**: a sky
underneath everything, the shore of the Void, and at the bottom, the Unmade. We call these deep places
**Reaches** *(new)*: places the fracture reaches into. That keeps canon's line: the Void is never a
sixth realm, and neither is any Reach. A Reach is where the realms' substance pooled after it fell, or
where possibility has not yet decided what to be.

Three axes make it Terraria with a galactic mix:

1. **Depth is the story.** Each stratum is a chapter of what the fracture did, told by inscriptions, NPC
   missions and the things you dig. Going down is progression: new ore, new liquids, new tools, a boss
   with a summon item at each step.
2. **Width is the world.** Left and right of the authored shaft, the Delve is generated without end from
   the player's own seed. Further out, the upper strata take on the colour of the other four realms
   (Echo regions, §2.3): the Terraria jungle and snow, but they are the realms' shadows underground.
3. **The deep is the universe.** Below the Underhearth the rock opens onto stars, then onto the Void sea
   with broken pieces of all five realms floating on it, then the Unmade, which has no bottom. The
   Nameless's own line becomes the design of the endgame: "There is one more. There is always one more."
   (`npc.model.ts`, the Nameless).

What makes it AAA rather than "more caves": every layer adds **one new verb or rule** (swim and fish, cross
lava, float in low gravity, hold the Void back with light, finish the unfinished), not only a palette swap;
every resource has a use and a "Found in…" line on day one; the phone is the reference device.

### 1.1 Canon ties this is built on

| Tie | Source | How the Delve uses it |
|---|---|---|
| The World-Root's shadow, "the inverse tree that grows downward beneath the Godforge" | Nullthorn Staff lore, `artbible-items.ts`; inscription `roots-inverse-tree` | Root Hollows (shipped). Its roots point at the crack in every stratum below |
| Kael's forge-mines; "Kael was the fifth Keeper and the only one who stayed. The other four are still in the walls" | `npc-quest.model.ts` (Kael chain reveal); inscription `basalt-sealed-pocket` | Basalt Caverns (shipped); the Underhearth is where the other four went (§2.2) |
| The Underhearth: "fire is a predator"; Cindergnaw "was made to fell the ironwood pillars that held up the ceiling of the Underhearth"; "a place so deep that even fire is compressed into something else" | `artbible-items.ts` (Cindergnaw); the removed Rune of the Underhearth's text, merged into **Nox** (lore addendum) | The first new stratum (§2.2) |
| Nox: "The depth in a system that lets it retain what light would wash away" | Item lore codex, rune table | The Underhearth's principle; Nox runes drop there |
| The Luminous realm "cracked open the void's ceiling and let light spill into Eclipse Realms for the first time" | `artbible-items.ts` (First Dawn weapon lore) | Starfall Deep sees that ceiling from underneath |
| Aureth: "There are crystals in the deep hall that only answer to a hand as practised as yours." | `npc.model.ts` (Aureth, high level) | Aureth's Starfall chain |
| Void Shard: "offers several plausible shapes and must not be mistaken for a neutral ingredient" | Item lore codex | Void creatures and Void fish have several outlines |
| "The Shattering" (the World-Root's oldest branch fell during it) | `artbible-items.ts` | The shattered realm-islands on the Void Shore |
| Codex of the Unmade: "The page they voted to forget" | Socket word, lore addendum | The Unmade's name |
| The Nameless: "There is one more. There is always one more." | `npc.model.ts` | The Unmade's endless depth ("One More") |
| Atlas creatures that never spawn: Afterimage Moth, Anchor Warden, Ink Lantern, Graftling | meaning audit #16 | Each gets a home in an Echo region or Starfall (closes #16) |
| Canon items with no game presence: Broken Astral Compass, Rift Map Fragment, Veil Draught | meaning audit, "Not statically checked" | Navigation and hazard tools (§6) |
| Expedition-only materials (Orichalcum Ore, Emberheart Ore, Pyrite Dust, Godforge Slag, Void Crystal, Celestial Quartz, Moonpetal Herb) | `material-vendor.model.ts` `VENDOR_SHELF`, `artbible-items.ts` | Each gets a **world source** in a deep stratum: no new ores where an existing one fits |

### 1.2 What it must never become

- **No sixth realm.** No Reach is selectable, has a town, or is "the Void realm". The Void is a sea you
  stand beside and fish in, never a place with a capital.
- **No canon answers by accident.** The canon leaves open the cause of the fracture, the antagonist and
  the ending (canon, *Intentionally provisional*). In-game lore already calls the Nameless "the one who
  split the world" (`unique-items.ts`); nothing new confirms or denies it. The Unmade is written so it works
  whether or not the owner approves the narrative bible's Unbound Pattern (§1.2, §8).
- **No horror, no generic hell.** Infernal is "transformation through pressure and cost", never "demonic
  horror or simple fire-land" (canon realm table). The Underhearth is a furnace, not an underworld.
- **No wings, skull piles or castles for their own sake** (canon, *Tone and story constraints*). No
  Rootglass Stag mount: the atlas says it "cannot be domesticated without harming the root network".
- **No real money anywhere.** Every price is Gold; Essence stays untouched.

---

## 2. The layer cake

Rows are cell rows (32 px). Rows 0–55 are today's authored Ember Delve (`EMBER_DELVE` in
`src/app/play/world/towns/infernal.ts`, `version: 2`). Everything below row 55 and left or right of
col 0–119 is new.

```
 surface   Basalt Seamworks (town)           Echo regions left and right (§2.3)
  0–11     Root Hollows        shipped        ┐
 12–25     Basalt Caverns      shipped        │ "the realm's underside"
 26–39     Glowcap Grotto      shipped + lake │ depth 1 (Delving 1)
 40–55     Magma Halls         shipped + lava ┘
 56–119    The Underhearth     new            depth 2 (Delving 15)
120–127    The Breach          transition     the floor of the world gives way
128–223    Starfall Deep       Reach          depth 3 (Delving 35)
224–287    The Void Shore      Reach          depth 4 (Delving 55)
288– ∞     The Unmade          Reach          depth 5 (Delving 75), "One More" every 64 rows
```

**Depth gates.** The Skills panel already promises "Delve to depth N" at Delving 1/15/35/55/75
(`skill-unlocks.ts`, the `depth` rows); nothing enforces it today. Phase 8 makes it true: each crossing
(the Breach, the Shore's edge, the Unmade's door) is a narrow passage that "holds" only for a Keeper whose
Delving level meets the depth. Below the level the passage shows its requirement in plain words, the same
way a tier-locked node clangs "Needs Mining 20". Each crossing **also** needs the stratum's story key (a
boss down or a mission done), so the gate is earned in two ways: skill and story. Neither blocks digging
anywhere above the crossing (the AAA rule "in the Delve the dig is never blocked").

### 2.1 Shipped strata, and what Phase 6 adds to them

| Stratum | Shipped (see `docs/handoff/delve-persistence-biomes.md`) | Added in this plan |
|---|---|---|
| **Root Hollows** (0–11) | dirt, root-loam, roots, petrified trunk, shadow-root; Verrin's mission | rain-seep puddles (shallow water); **Ember Grub** bait from dirt (§5.4); Echo variants (§2.3) |
| **Basalt Caverns** (12–25) | rock, hard rock, Cinder, Slag, Maws, Kael's cache; Kael's mission | **flooded shafts** of Kael's old mines (water, §4); **Seam Rails** (§6.4) |
| **Glowcap Grotto** (26–39) | grotto stone, glowcaps; Merchant orders | **Grotto Mere** *(new)*, the first lake: the fishing tutorial and its mini-boss (§7.4) |
| **Magma Halls** (40–55) | scorched basalt, Heartstone, ember-rock, Cinder Bailiffs, Seam Eater, fragment | **lava pools** on cavern floors; obsidian where water meets them; lava fishing (§5) |

### 2.2 New strata and Reaches

Each row: identity, palette (style guide §5; new ramps are proposed here and land in §5.3 of the style
guide with the slice that builds them), terrain nodes, liquids, creatures, resources, what it unlocks.

#### The Underhearth (rows 56–119): "where fire is compressed into something else"

*The Infernal realm's oldest furnace. Its ceiling was held up by ironwood pillars until Cindergnaw felled
them; the Magma Halls' floor is that fallen ceiling. Below it, heat has been under pressure so long it has
turned into something else: black glass, cold coals, a forge that banked itself.* Story: "The Four Who Went
Down" (lore addendum).

| | |
|---|---|
| **Palette** | obsidian (shared ramp) `#1e1428` `#2e2238` `#463650` `#6a5878`; iron black `#171116` `#2a2027` `#443540` `#57474f`; seams ember `#c4501e` `#E8752A` and white-hot `#ffd08a`. Back wall `#0e0a12` `#1c1420` `#241a28`; darkness `4,2,6`; wash `#c4501e` α 0.10; particles `ember`. Godforge violet `#7b3fc4` only on fracture seams (violet is the shared Godforge energy, style guide §5.1) |
| **Nodes** (appended to `TERRAIN_NODE_LIST`) | `obsidian` (pick IV, 6 HP, block `obsidian`), `ironwood-pillar` (axe IV, petrified, yields Ironwood), `emberheart-vein` (pick IV, Mining 45 → **Emberheart Ore**), `pyrite-seam` (pick III → **Pyrite Dust**), `cold-coal` (pick IV → Ember Residue ×2; dark until struck, then glows: a node that lights *after* you hit it), `fracture-seam` (unbreakable violet line, a light source, marks the crack: lore only) |
| **Liquids** | lava lakes; water seeps from above meet them and leave obsidian shores |
| **Creatures** | **Rivet Maw** (atlas) at the top; **Banked Ember** *(new, small)*: a creature of compressed fire, cold until hit, and each hit releases heat it took from the tunnels (Cinder Ore codex: "heat taken from one place must appear somewhere else"); **Ironwood Sentinel** *(new, large)*: a petrified pillar that still walks to where the ceiling should be and shoulders loose rock down (a cave-in maker, §7.3) |
| **Boss** | **The Banked Furnace** *(new)*: the four Keepers' forge, still burning without them; it pulls, never chases (§7.4) |
| **Resources** | Emberheart Ore and Pyrite Dust get their **first world source** (today Exchange/vendor-only); Obsidian; Ironwood *(new material)*; Nox runes (ledger) from the boss |
| **Unlocks** | Pickaxe/Axe V recipes (Smithing 60), Rod IV, Rift Anchors (§6.3), the Breach crossing |

#### The Breach (rows 120–127)

A transition band, not a biome: bedrock shattered into floating slabs, the fracture seam widening into
open space, the first **rift shrine** (§3.6). The world's floor ends here. The Banked Furnace's defeat and
Delving 35 open the crossing.

#### Starfall Deep (rows 128–223): the sky under the world

*The first Reach. Below the floor of the world there is sky: the underside of the "void's ceiling" the
Luminous realm once cracked. Stars that fell when the Godforge broke are lodged in floating rock.* Story:
"The Light Under the World" (Aureth).

| | |
|---|---|
| **Palette** | Celestial midnight `#0a1428` `#14284a` `#24406e` `#3a5a8a`; star silver `#6a7890` `#a8b8cc` `#d8ecff`; orbit blue `#5fb6ff`; brass `#8a6a3a` `#e8c47a` for fallen-star cores. Back wall: none in open sky (the parallax is a starfield), `#0a1020` `#121a30` `#18223a` in rock. Darkness `3,6,15`; particles `mote` (star glints) |
| **Rule** | **Low gravity** (×0.45 fall acceleration, ×1.6 jump) in open sky; **gravity shear** pulses (the narrative bible's Celestial hazard, *proposal*): every 20–40 s a band of rows flips to ×0.15 or ×1.6 for 3 s, shown 1 s ahead by a ripple in the stars |
| **Nodes** | `skystone` (pick IV, floating-island rock), `orichalcum-vein` (pick V, Mining 60 → **Orichalcum Ore**), `star-iron` (pick IV → **Celestial Alloy**), `celestial-geode` (pick V → **Celestial Quartz**), `fallen-star` (pick V, once per crater; → Celestial Alloy ×3 + a chance of an **Aether** rune on the ledger), `moonpetal` gathering node (sickle III → **Moonpetal Herb**), `starglass` (made by lava + starlight; a light-giving building block) |
| **Liquids** | **Starlight** (rises, pools on ceilings, §4) |
| **Creatures** | **Ephemeris Leech** and **Anchor Warden** (atlas, Celestial; the Warden finally spawns: meaning audit #16), **Lodestar Drift** *(new, small)*: a star-silver float that pulls loose drops and the Keeper gently toward itself |
| **Boss** | **The Unlit Star** *(new)*: a star that fell and has not decided whether to burn (§7.4) |
| **Resources** | world source for Orichalcum Ore, Celestial Quartz, Moonpetal Herb; Aether runes |
| **Unlocks** | Pickaxe V use, Rod V, Starlight Jar (light), Anchor Ring drift hold (§6.5), the Shore's edge |

#### The Void Shore (rows 224–287): where possibility has not decided

*The fracture ends at a sea. It is the Void: not a realm, not evil, "inviting, immense, and unsafe" (codex,
Void rune). On it float pieces of all five realms that broke off in the Shattering, still deciding whether
to be what they were.* Story: "What Washes Up" (the Merchant).

| | |
|---|---|
| **Palette** | Void accent `#050308` `#0a0610` `#160f22`, edge `#ff6dd7` (style guide §5.1: the magenta is the Singular colour and the Void edge, and nothing else). The sea surface shows a starfield *through* it (§4.5). Islands wear **their own realm's palette** (§5.2), so all five realms appear in one view |
| **Rule** | The sea is **void liquid**: no gravity inside it, the lantern shrinks, slow "unmaking" damage; light holds it back (§4.2) |
| **Islands** *(new names)* | **Ember Shard** (Infernal: basalt, cinder), **Dawn Shard** (Luminous: sunlit stone, Luminous Prism, sunbloom), **Ink Shard** (Umbral: black-violet stone, Umbral Ink, nightbloom), **Orbit Shard** (Celestial: brass, Celestial Alloy), **Root Shard** (Verdant: rootwood, Verdant Sap, thornroot). Each yields its realm's material from the realm's own node look |
| **Nodes** | `void-glass` (pick VI; generated veins on island undersides → **Void Crystal**; made by void + lava as a block only), `void-scar` (non-solid; a **Void Shard** gathering node, sickle IV, regrows) |
| **Creatures** | **Plausibles** *(new)*: shoal creatures with several outlines at once; a hit makes one "choose" a shape and become killable (codex Void Shard). They copy the last tool you swung |
| **Boss** | **The Undertow** *(new)*: a current in the Void that pulls every possibility toward one shape; summoned by fishing (§7.4) |
| **Resources** | world source for Void Crystal and Void Shard; all five realm materials from islands (a second source each, at expedition-like rates) |
| **Unlocks** | Pickaxe VI (Smithing 80), Rod VI (void fishing), Hollow Flask (§4.4), the Unmade's door |

#### The Unmade (rows 288 and below, no bottom)

*What the Godforge began and nobody finished. Cells here are outlines, construction lines in mask ivory on
the dark. When you light one, it finishes into something real, and it is never the same thing twice.*
Story: "One More" (the Nameless).

| | |
|---|---|
| **Palette** | outline floor `#140a1f`; mask ivory `#8c7a58` `#c9b98f` `#efe4c4` for construction lines; finished cells take the palette of whatever they became; the Nameless's `#c9c4d6` (`npc.model.ts`: "Deliberately not a realm colour") for its marks only |
| **Rule** | **Witnessing.** An `unmade` cell is walk-through and drawn as an outline. Light it (lantern core, a torch, a Starlight Jar) for 2 s and it **finishes** into a solid cell rolled from the deep tables by `hash(seed, cell)`: rock, an ore of any realm, or rarely a `godstone-node`. Finished cells mine and pay like generated ones (they were generated, only late). So the Unmade is built by the light you bring: you make your own floor |
| **"One More"** | Every 64 rows deeper is a new band. The band counter is the Nameless's tally, shown as tally marks in the HUD. Each band: +8% creature HP and damage, +1 crate tier chance step, the finished-cell table shifts rarer. No end. The deepest band reached is a per-player record (Leaderboards may show it later) |
| **Creatures** | **Drafts** *(new)*: half-drawn figures that copy the shape of the last creature you met; they finish (and become killable) only in light |
| **The Nameless** | appears as a figure only here, at band thresholds, and only says its existing kind of line (§10, owner question 1) |
| **Resources** | Godstone runes (ledger) at a low rate; every realm's material through finishing; Delving XP that scales with the band |
| **Unlocks** | the endgame: depth records, titles, the "One More" mission line |

### 2.3 Echo regions (horizontal)

Left and right of the authored shaft, the procedural wings (§3) repeat the four shipped depth bands. Every
**macro-region** (16 sectors wide, §3.1) the realm whose underside you are under changes. The Infernal core
(the shaft) is in the middle; further out, the upper strata (rows 0–55) take on another realm's colour and
creatures. These are where the atlas's small creatures finally live.

| Echo *(new)* | Re-skins | Signature node / liquid | Atlas creature it homes | Resource |
|---|---|---|---|---|
| **Prism Shelf** (Luminous) | sunlit stone, dawn-glass veins | `dawn-glass` vein (pick II → Luminous Prism); still mirror-water pools | **Afterimage Moth** (leads you to an uncopied inscription) | Luminous Prism, Sunbloom, Solar Resin |
| **Ink Deeps** (Umbral) | black-violet stone, obsidian | `ink-seep` (sickle III → Umbral Ink); mirror pools where a tunnel exists only in the reflection | **Ink Lantern** (goes dark beside an uncertain statement: beside an *unread* inscription) | Umbral Ink, Nightbloom, Shadowthread Silk |
| **Orrery Underworks** (Celestial) | brass counterweights, astral stone | `astral-vein` (pick II → Celestial Alloy); mild gravity shear | **Anchor Warden** (also in Starfall), **Ephemeris Leech** | Celestial Alloy, Starlight Herb |
| **Rootglass Depths** (Verdant) | rootwood, living crystal | `rootglass` (axe II → Verdant Sap); sap-water pools | **Graftling** (joins nearby placed things into odd shapes, harmlessly) | Verdant Sap, Thornroot, World-Root Bark |

Rules: an Echo replaces palette, band nodes and creature table, never the depth structure (Root Hollows is
still 0–11 everywhere), so a player learns one vertical grammar. Order outward from the shaft:
Infernal core → (east) Prism Shelf → Orrery Underworks → … repeating; (west) Ink Deeps → Rootglass Depths
→ …, with a 1-sector blended border. This closes meaning audit #16 for all four non-spawning atlas
creatures.

---

## 3. The endless Delve (generation and saves)

### 3.1 Coordinates and units

| Unit | Size | Why |
|---|---|---|
| Cell | 32 px (`CELL`) | unchanged |
| Render chunk | 8 × 8 cells (`CHUNK`) | unchanged (`terrain-render.ts`, LRU 36) |
| **Sector** *(new)* | **32 × 32 cells** (4 × 4 render chunks, 1024 px square) | generation, simulation and save unit |
| **Region** *(new)* | 8 × 8 sectors (256 × 256 cells) | one cloud document |
| **Macro-region** | 16 sectors wide | Echo region width (§2.3) |

World cell coordinates are `(wx, wy)`: `wy ≥ 0` is depth from the surface, `wx` is unbounded (int32;
practically ±1M cells). Sector `(sx, sy) = (floor(wx/32), floor(wy/32))`. The authored core occupies
cols 0–119, rows 0–55; the sectors overlapping it (`sx` 0–3, `sy` 0–1) generate their core cells from the
core spec and the rest procedurally.

### 3.2 Generation: deterministic per sector

Today's `generateTerrain` walks veins across the whole grid with one RNG stream, so a cell depends on every
vein before it. That cannot scale to an infinite world. The new generator is **sector-local**:

```
sectorSeed(seed, sx, sy, gv) = mix32(seed ^ mix32(sx * 0x9E3779B1) ^ mix32(sy * 0x85EBCA77) ^ gv)
```

1. **Stratum** from `wy` (§2 table), with the band edges jittered by 1-D value noise of `wx` (continuous
   across sectors, unlike today's per-band knots).
2. **Echo** from `sx` (§2.3 macro-region), blended over one sector.
3. **Caves:** 2-octave value noise sampled per cell in world coordinates (so caves cross sector borders
   without seams); the threshold and scale come from the stratum (Root Hollows: narrow tunnels; Basalt:
   long horizontal galleries; Grotto: big round caverns; Underhearth: vertical shafts and lava basins;
   Starfall: mostly open sky with floating islands, inverted; Void Shore: islands over a sea line;
   Unmade: everything `unmade`).
4. **Veins:** each sector rolls its own vein blobs from `sectorSeed` and clips them to the sector. A vein
   never crosses a border, which costs nothing visible at 32-cell sectors.
5. **Structures** (§3.6) on a coarser lattice: 4 × 4 sectors per lattice cell, ≤1 structure per lattice
   cell, footprint ≤ 2 × 2 sectors. A sector asks the ≤4 lattice cells that overlap it for their structure
   and stamps only its clipped part, so structures straddle borders deterministically.
6. **Liquids** fill cave basins below a stratum-specific level (water in Grotto basins, lava in Magma and
   Underhearth basins, starlight against Starfall ceilings, the void sea under row ~240).
7. **Core override:** inside the core rectangle, today's generator output is used as is (the shipped
   stamps, inscriptions, caches, the fragment chamber). The core's bottom bedrock (rows 54–55) gets one
   gap under the fragment chamber, `sealed` until the Seam Eater flag, which is the way down. That is a
   stamp change, so the core's `version` goes 2 → 3 in Phase 8 (zero players: nothing to migrate but the
   owner's own dig; §3.4 keeps tunnels where it can).

Generation runs on demand, ≤ 1 sector per frame, time-sliced; target **≤ 2 ms per sector on the phone
tier** (1024 cells × ~3 noise samples). If it misses the budget, move it into a Web Worker (the generator
is pure TS with no DOM, and a sector is one transferable `Uint8Array` pair). Golden tests pin a hash per
`(seed, sx, sy, gv)` for a fixed set of sectors.

### 3.3 The loaded window and simulation

- **Loaded:** the 3 × 3 sectors around the Keeper on phones, 4 × 3 on desktop (a 1280 × 800 view spans
  ~1.3 sectors). Each sector is ~7 KB in memory (kind, HP, liquid type and level), so 12 sectors ≈ 84 KB;
  an LRU of 32 generated sectors keeps backtracking instant.
- **Simulated:** only loaded sectors run liquids, creatures and regrowth. Outside, the world is frozen
  (Terraria does the same off-screen). Creatures spawn per sector from the stratum table when a sector
  loads, capped at **12 active creatures** in the window.
- **Today's `Terrain` class** keeps its typed arrays; a `World` wrapper maps world cells to sector
  `Terrain` instances, so collision, `coneCells`, lighting and the renderer keep working on a cell API.
  `HP` moves from `Float32Array` to `Uint8Array` (no node has more than 8 HP; Infinity becomes 255) to cut
  memory 4×.

### 3.4 Persistence: a compact diff per sector

The save keeps today's idea: regenerate from the seed, store only what the player changed.

```
progress/delve (index doc, ≤ 64 KB)
  { version: 2, seed, createdAt, core: { layout, cells }, claimed: [...], chests: {...},
    anchors: [...], pins: [...], regions: { 'rx,ry': { n, t } }, records: { deepestBand } }

progress/delve-r-<rx>_<ry> (one per touched region, 8 × 8 sectors)
  { sectors: { 'sx,sy': { g: gv, t: lastChange, c: '<rle>', l?: '<rle>', f?: '<fog>', h?: healedAt } } }
```

- `c` is the changed cells as `(localIndex, kind)` runs, run-length encoded and base64'd. A sector you
  tunnelled through is typically 100–400 bytes; a fully rebuilt sector is at most ~1.4 KB. `l` is the same
  for settled liquid levels (§4.6). `f` is the fog-of-war mask: 64 bits (one per 4 × 4 cells), 11 base-36
  characters.
- **Budgets:** a region doc's worst case is 64 × ~1.5 KB ≈ 96 KB, far under Firestore's 1 MiB. The index
  doc is bounded because procedural finds use **the dug cell as the receipt** (a procedural cache pays
  once because the diff keeps it dug); `claimed` holds only authored once-per-player things (bosses' first
  defeat, the fragment, story caches).
- **Locally**, region docs live in **IndexedDB**, not localStorage: localStorage's ~5 MB per origin is
  shared by every save blob, and an explorer could fill it. This is the biggest dependency (§9, Phase 7).
- **Cloud:** the docs sit under `users/{uid}/progress/{docId}`, which `firestore.rules` already matches
  with a wildcard, so **no rules deploy** is needed (memory: a rules deploy 403 has blocked hosting
  before). Region docs load lazily when the Keeper is within one region of them; dirty regions are
  written at most once per 30 s, and `settleForReload()` flushes them.
- **Merge:** per sector, today's rule (cells unioned; local wins a disagreeing cell); fog is OR'd; `t` is
  max; a heal (below) wins over any change older than `h`. The seed rule is unchanged (earliest wins).
- **Generator changes:** each sector diff stores its `g`. On a mismatch the sector is regenerated with the
  current generator and only the diff's **air and placed** cells are re-applied: tunnels and builds
  survive, ore may move. Never re-grant a once-per-player find.

**Healing (archival without deleting anything you own).** Lore: *the Delve keeps what is held* (lore
addendum, "What the Delve Keeps"). A procedural sector's diff is dropped (the rock grows back, with fresh
ore) when **all** hold: it is outside the core; it holds no placed thing (torch, block, chest, camp,
anchor, rail); it has not changed for **14 days of real time**; it is more than 4 sectors from any camp,
anchor or chest. Its fog stays (the map remembers you were there, drawn in a "regrown" tint). Items are
never touched: chests and their gear are placed things and hold their sector. This bounds the save, makes
far tunnels a renewable resource, and is visible (the map tint and a one-time line the first time you see
it).

### 3.5 Performance budgets (phone tier is the reference)

Measured today (`docs/handoff/play-perf.md`, `terraria-terrain.md`): phone Delve p50 ~32–50 ms under the
4× CPU software-raster harness, 16.7 ms on GPU raster. The endless Delve must not move those numbers by
more than its own slices below.

| Budget | Phone | Desktop | How |
|---|---|---|---|
| Sector generation | ≤ 2 ms, ≤ 1 per frame | ≤ 1 ms | time-sliced; Worker if missed |
| Liquid sim | ≤ 1 ms per frame, ≤ 256 cell updates per tick | ≤ 2 ms | 10 Hz ticks, sleeping cells (§4.3) |
| Lights | ≤ 24 per frame (today's cap) | same | lava surfaces add emissive *cells* to the light grid, not lights |
| Active creatures | ≤ 12 in the loaded window | ≤ 16 | per-sector spawn tables |
| Particles | 48 pool (today) | same | |
| Minimap | ≤ 0.3 ms per frame | | sector thumbnails cached; repaint only dirty sectors |
| Memory (terrain + liquids) | ≤ 400 KB | ≤ 600 KB | sector LRU 32 |
| Save writes | local 1.5 s debounce (today); cloud ≤ 1 per region per 30 s | | |

The opt-in harness (`PLAY_PERF=1 e2e/perf-play.spec.ts`) gets three new scenes: a lake, a lava basin and
a wide procedural traverse (walk 10 sectors east). Each slice reports before/after alternated runs as the
terrain passes did.

### 3.6 Structures

| Structure *(new names)* | Strata | Contents | Meaning |
|---|---|---|---|
| **Kael's waycaches** | Basalt band (all Echoes) | small chest loot (Cinder, Slag, a Torch bundle, sometimes a Seam Rail kit) | Kael marked "every tunnel you open" (inscription `basalt-kaels-mark`); the dug cache is the receipt |
| **Flooded shafts** | Basalt band | water, an old Seam Rail line, a waycache at the bottom | the mines flooded when Kael closed them |
| **The Four's outposts** | Underhearth | a ruined forge corner, one **hammer-mark** (story item, 4 in the world, placed within 6 sectors of the shaft for every seed), a lore inscription, a chest | Kael's chain (§7.1) |
| **Rift shrines** | Breach and below, rarely in Echoes | a **Waystone Shard** (§6.3) the first time; opens a short-lived rift during an Eclipse surge (§7.3) | the canon rifts "scattered" by the fracture |
| **Fallen-star craters** | Starfall (and event-spawned, §7.3) | a `fallen-star` node in a ring of `starglass` | Aureth's chain |
| **Shattered islands** | Void Shore | five kinds (§2.2) | the Shattering |
| **Field-note walls** | every stratum | one authored inscription from that stratum's pool (§8) | the Archivist's new set |
| **Lakes and lava basins** | Grotto, Magma, Underhearth | liquid, fish, a crate chance | fishing everywhere |

---

## 4. Liquids

### 4.1 The four liquids

| Liquid | Where | Moves | On the Keeper | Light | Look (pixel art) |
|---|---|---|---|---|---|
| **Water** | Root seeps, flooded shafts, Grotto Mere, Echo pools | falls, then spreads | swim (×0.6 speed, soft jump); **breath** 8 s, then 6% max HP per s | none; the surface catches light | body `#0e2a3a` `#1e4a6a` `#2e6e9a` at α 0.6, surface lip `#86d2e6`, sparkle `#d0f6ff` (from the Grotto ramp; proposed for style guide §5.3) |
| **Lava** | Magma Halls floors, Underhearth lakes | falls and spreads at **1/3 speed** | 15% max HP per s and 2 s of burning; **Ember Elixir** gives 10 s of immunity and leaves its "visible ember line" (codex) | **emissive**: each surface cell adds to the light grid | body `#7a2a12` `#c4501e` `#E8752A` (Infernal ember), surface `#ffd08a`, flecks `#ff9b4f`; 2-frame surface churn |
| **Starlight** *(new name)* | Starfall ceilings, crater pools | **rises**: pools against ceilings, falls upward through open air | buoyant (drifts up), **breathable**, lantern +3 tiles inside | soft emissive (half of lava) | star silver `#6a7890` `#a8b8cc` at α 0.5, flecks `#d8ecff`, orbit-blue lip `#5fb6ff` |
| **Void** | the Void Shore sea, rift seeps | neither falls nor rises; **creeps** sideways and down into empty cells next to void at 1/6 speed, never gains volume; **stops where light is** | no gravity (drift); lantern 2 tiles; "unmaking" 4% max HP per s; the **Void Buckler** (canon equipment: "turns an incoming possibility aside") halves it | absorbs: −0.2 light per cell | body `#050308` `#0a0610` with a **starfield window** (a parallax star pattern at ×0.1 drawn *inside* void cells, so the sea looks like a hole in the world), edge `#ff6dd7` 1 art px |

Starlight's rising is Aether's codex line made physical: "the lift in a system that makes it reach
beyond its present form". Void's light rule is Glint's: "the smallest visible proof that an event
occurred". A lit torch within 3 cells stops void creep into its radius, so **you hold the Void back with
light**, and the Unmade's witnessing rule (§2.2) is the same idea one Reach deeper.

### 4.2 Interactions (reactions are cheap, local and farm-proof)

| Meets | Result | Notes |
|---|---|---|
| water + lava | the smaller volume's cell becomes **obsidian** (solid); the other loses that volume | Terraria's rule. Obsidian is a placeable building block and a recipe input |
| starlight + lava | **starglass** *(new)*: solid, translucent, a dim light source | a decorative building block that lights your base |
| water + starlight | no reaction: starlight rises through water as bubbles | a pretty layered look |
| void + water | the water is gone ("unmade"); the void is unchanged | the Void does not care |
| void + lava | **void-glass** (solid) | made void-glass gives the block only, never Void Crystal |
| void + starlight | both vanish in a flash of light | no item: nothing to farm |
| lava + a wooden placeable (torch, ladder, platform, timber support, chest, camp) | chars it after 3 s and **returns it to the satchel** with a toast | owner rule: nothing is ever destroyed |

**Farm-proofing rule: only generated cells pay.** A cell that was not in the generated grid (placed by the
player, or made by a reaction) breaks into its block and pays **no XP and no yield**, exactly like placed
dirt and basalt blocks today (`block`, `xp: 0`). The host can tell from `terrain.base[i] !== kind[i]`.
So an obsidian generator builds walls; it does not mint ore.

### 4.3 Flow model (Terraria-like, cheap)

- **Data:** two `Uint8Array`s per sector: `liqType` (0 none, 1 water, 2 lava, 3 starlight, 4 void) and
  `liqLevel` (0–8; 8 is a full cell). Eight levels map onto the 16-art-px cell as 2 art px per level, so a
  liquid surface is always on the pixel grid.
- **Tick:** 10 Hz, not per frame; lava every 3rd tick, void every 6th. The renderer only draws levels, so a
  10 Hz sim reads as smooth with a 2-frame surface shimmer.
- **Per active cell, bottom-up (top-down for starlight):** (1) *fall*: move as much as fits into the cell
  below (above for starlight) if it is open or the same liquid; a different liquid there reacts (§4.2);
  (2) *spread*: if it cannot fall, even out with the left and right neighbours (move `floor((a − b) / 3)`
  toward the lower one), alternating scan direction each tick so water never drifts one way;
  (3) *settle*: a cell whose level did not change for 2 ticks, with settled neighbours, **sleeps** (leaves
  the active set). Any dig, place, reaction or neighbour change wakes its 3 × 3.
- **Budget:** at most 256 cell updates per tick on phones; the rest wait for the next tick. A lake that is
  draining into a new tunnel takes longer, never costs more.
- **Volume** is conserved except at reactions and the void rule; an engine test checks it.
- **Off-screen:** sectors outside the loaded window are frozen. A half-drained lake resumes when you come
  back.

### 4.4 Buckets, flasks and pumps

| Tool *(new)* | Recipe | Does |
|---|---|---|
| **Seam Bucket** | 2 Slag Fragment + 1 Cinder Ore + 40 Gold (Smithing 5) | scoop or pour one full cell of water, lava or starlight. It cannot hold void: "a bucket is a promise to keep a shape; the Void declines" |
| **Hollow Flask** | 1 Void Crystal + 1 Celestial Quartz + a **Hollow** rune from the ledger (Smithing 80) | carries one cell of void. Codex, Hollow: "the useful absence that prevents a vessel from becoming a prison" |
| **Seam Siphon** (inlet and outlet pair) | Ironwood + Slag + Obsidian (Smithing 50) | moves one level per tick from inlet to outlet while switched on (E). Drain a lava lake into a pit to reach the Emberheart under it |

### 4.5 Rendering

- Liquids draw in their own pass after terrain, cached per render chunk like tiles and repainted when the
  chunk's liquid revision moves. The surface row is drawn per cell from the level; a 1-art-px lip in the
  surface colour; the shimmer is 2 frames on surface pixels only. **Reduced motion:** the shimmer and the
  void starfield drift stop; the levels still update.
- Lava and starlight surfaces write emissive values into the existing `lightGrid` (one sample every 16
  world px), so a lava lake lights a cavern without spending any of the 24 light slots.
- New art spec **W7L** (style guide §7, added in Phase 6): per liquid, a 16 × 16 body tile (2 variants) and
  a 16 × 4 surface strip × 4 frames. Code draws flat fills from the palettes until the art lands, as tiles
  did before W7a.

### 4.6 Saving liquids

Liquid is saved per sector **only when settled** and different from what the generator would place
(`l` in §3.4). A lake you drained saves as "these cells are now empty"; a pit you flooded saves its levels.
Moving liquid is never saved; on reload it settles from the last saved state.

---

## 5. Fishing

A new skill, **Fishing** (1–99 on the shared curve, `xpForLevel(L) = 100 · (L − 1)^2.2`; about 523k XP to
50 and 2.4M to 99). It is the **calm loop** of the Delve: it reads every liquid, rewards exploration (a new
lake is a new catch table), feeds the light and potion economy, and gives the phone a one-thumb activity.

### 5.1 How it plays

1. **Cast:** stand at a liquid's edge with a rod and press Use (the touch Use button). Hold to throw
   further (up to 6 cells). A rod works only on the liquid its tier allows (§5.2).
2. **Wait:** the bob floats; a bite comes after 3–9 s (shorter with bait power and Fishing level). The
   bob dips, the rod shakes, a soft tick plays, and the phone vibrates when the device allows it.
3. **Hook:** tap within 0.6 s of the dip. A miss loses nothing: the fish nibbles again.
4. **Reel: "Line Tension"** *(the mini-game)*. One bar: a fish marker drifts; hold to raise the catch
   window, release to let it fall; keep the marker inside to fill a ring (2.5–4 s). Grade by time inside:
   **Perfect** (≥ 90%), **Good** (≥ 60%), **Off** (less). **The fish is always landed once hooked**; the
   grade only adds: Perfect +50% XP and one crate-tier step, Good +20% XP. This copies the anvil's
   contract: playing can only improve the result, never fail it (`docs/handoff/smithing-enchanting-minigames.md`).
5. **Auto ("Fish here"):** hold Use to keep casting and reeling at the Off grade, the baseline, so idle
   and one-thumb play stay honest. Like "Craft all", auto pays no mini-game bonus.

Feel and access follow the mini-game kit: rAF outside the zone, one CSS custom property per frame,
`pointerdown` presses, sparks by grade, no fixed overlays. **Reduced motion:** a single "Reel" button,
quality 0.5. **Phones:** the bar is horizontal along the bottom, above the touch row; the whole loop is one
button.

### 5.2 Rods and bait

Rods follow the tool-tier ladder (`TOOL_TIER_LEVEL` 1/10/25/45) and extend it with V and VI, which the
deep pickaxes need too (Phase 8 adds `5: 60, 6: 80`; swing paces 0.28 and 0.25 s, inside today's
[0.25, 0.52] clamp). Rods are tools: they work from the satchel, show power and "works as tier N until
Fishing L", like the other tools (`docs/handoff/tool-tiers.md`).

| Rod *(new)* | Fishing | Liquids | Recipe (Crafting Bench, Delve kit) |
|---|---|---|---|
| **Worn Rod** | 1 | water | free, soulbound, given once like the Worn Pickaxe |
| **Root Rod** (I) | 1 | water | 3 World-Root Bark + 1 Thornroot + 20 Gold |
| **Seam Rod** (II) | 10 | water, Magma Halls lava | 4 Slag Fragment + 2 Cinder Ore + 1 World-Root Bark + 300 Gold |
| **Glowline Rod** (III) | 25 | water, all lava (Underhearth too) | 4 Glowcap + 2 Infernal Heartstone + 2 Slag + 4k Gold |
| **Obsidian Rod** (IV) | 45 | water, lava; +25% bite speed, +0.5% crates | 6 Obsidian + 2 Ironwood + 1 Emberheart Ore + 40k Gold |
| **Starline Rod** (V) | 60 | + starlight | 3 Celestial Alloy + 2 Orichalcum Ore + 1 Starlight Jar + 400k Gold |
| **Hollow Line** (VI) | 80 | + void | 2 Void Crystal + 1 Hollow Flask + 1 Celestial Quartz + 4M Gold |

Each rod's lore line is in the lore addendum. Gold costs are first-pass and sit on the rebalance curve's craft-fee scale (`rebalance-spec.md` §3, rule S);
the economy sim (§5.7) places them.

| Bait *(new unless noted)* | Power | Source | Note |
|---|---|---|---|
| **Ember Grub** | 10% | 5% chance when digging dirt or root-loam | gives dirt a second meaning |
| **Glowcap** (exists) | 20% | Glowcap Grotto | +rare chance at night (local time, as dialogue uses `timeOfDay`) |
| **Blindfin** (a catch) | 25% | Grotto water | live bait |
| **Starlight Herb** (exists) | 30% | gathering everywhere | starlight fish favour it |
| **Shadow-Root Cutting** (exists) | 35% | Root Hollows | Rootling Eel and quest fish favour it |
| **Rift Lure** | n/a | crafted: 1 Void Shard + 1 Glowcap + 1 Starlight Herb | summons the Undertow in the Void sea (§7.4) |

### 5.3 Catch tables

Every liquid body has a table keyed by **stratum × liquid × Echo**. Rarity ladder: common 70%, uncommon 22%,
rare 6%, junk 1.5%, crate 0.4–2% (bait and Perfect raise it), legendary 0.1% (once caught, 0.02%).
XP per catch rises with the **tier of the water, not with your level** (the progression spec's
non-negotiable rule: "XP per action must rise with the tier of the thing you are gathering").

| Water | Tier | XP (common / legendary) | Fish *(all new)* | Legendary |
|---|---|---|---|---|
| Root seeps, flooded shafts | 1 | 6 / 60 | **Blindfin** (live bait, Gill Draught), **Rootling Eel** (Thornroot-sweet; Verrin likes them) | |
| Grotto Mere | 1 | 8 / 80 | **Glowcap Minnow** (Lampfish Oil), **Mere Perch**, **Tallyfish** (quest only) | **The Kept Morning**: a lampfish whose light is what morning looked like before the Eclipse |
| Magma Halls lava | 2 | 18 / 180 | **Emberling** (an Ember Elixir input), **Slagjaw Eel** | **The Unpaid Debt**: stamped on the flank with a heat seal nobody has paid |
| Underhearth lava | 3 | 30 / 300 | **Cold Coalfish** (glows only after you strike the bucket it sits in), **Pressure Pike** | **The Fifth Ember**: it swims in fours, and there is always one gap in the shoal |
| Echo pools | 1–2 | as their depth | one realm fish each: **Prism Dace** (Luminous), **Inkfin** (Umbral), **Orbit Loach** (Celestial; swims in circles), **Sapling Carp** (Verdant) | one each (lore addendum) |
| Starfall starlight | 4 | 45 / 450 | **Perigee Minnow**, **Lodestar Ray** (pulls your bob), **Orbitfish** | **The Fallen Sign**: a small constellation that fell into a pool and kept its shape |
| Void sea | 5 | 70 / 500 (the per-action cap) | **Maybe** (several outlines until landed), **Unchosen Shoal** (a catch of 2–4) | **The Other Answer**: you are never sure afterwards that you caught it |

**Junk** (each has a use, or it is not in the game): **Rusted Rivet** (3 smelt to 1 Slag Fragment at the
Bench: the Rivet Maw's hoard, atlas), **Waterlogged Ledger Page** (the Archivist takes it: a lore line and
Delving XP; a page from Kael's seam ledger, inscription `basalt-seam-ledger`).

**Crates** *(new)*: **Root Crate** (tier 1), **Seam Crate** (2), **Hearth Crate** (3), **Star Crate**
(4), **Void Crate** (5). Contents: that stratum's materials, bait, a chance of a Torch/Rope bundle, a
rare Forge rune from the stratum's rune (Ash for Seam, Nox for Hearth, Aether for Star, Void for Void
crates; runes go to the ledger, never minted as items). Opened for free in the satchel; never sold by
NPCs; crate EV stays below the time it took to fish it at the forge's income (sim check, §5.7).

### 5.4 What fish are for (the meaning rule)

| Use | Fish | Where |
|---|---|---|
| **Lampfish Oil** (light) | Glowcap Minnow, The Kept Morning | Bench: 3 minnows → 1 oil; oil refuels the **Oil Lantern** (§6.6) |
| **Gill Draught** (breath ×3 for 3 min) | Blindfin | Enchanting Table infusion |
| **Ember Elixir** (second recipe) | Emberling | Bench: Emberling + Ember Residue; the existing elixir, new source |
| **Starbreath Tonic** (+30% low-gravity jump for 3 min) | Perigee Minnow | Enchanting Table |
| Bait | Blindfin, minnows | §5.2 |
| Quest deliveries | every species | Lodge Warden, Merchant, Verrin (§7) |
| **Catalogue of Strange Fish** | every species and legendary | the Archivist's new Codex shelf: a silhouette until caught, then the lore line |
| Sell | every species | the Buyback counter at the floor (8% of base worth): never the reason to fish |

### 5.5 Who gives fishing quests

No new named NPC (personal names stay the owner's). The **Lodge Warden** (approved role title; Skills
Lodge, Rootglass Canopy) posts one **Ledger Catch** a day: a quest-only species (the Tallyfish family,
~20 species rotating, each appearing only while it is the day's quest, Terraria's Angler model),
deterministic from the date and the player's seed. Rewards on the rule-I scale: 10 min of income, Fishing
XP, and a ladder every 5th/10th/25th turn-in (Tackle Box: a bait slot; **Angler's Patience**: +10% bite
speed charm; a Rod part). The **Merchant** gets a standing fish order like the Glowcap order
(`delve-merchant-glowcaps`: max(180 Gold, 90 s of income)). **Verrin** asks for Rootling Eels once (§7.1).

### 5.6 Fishing perks (Skills panel rows)

Every ~10 levels, as the other skills: bite speed (+5% steps), crate chance (+0.2% steps), double-catch
chance, the Perfect window widening (+0.04 at 30/60/90), lava (10), starlight (60) and void (80) access
lines mirroring the rods, and Mastery at 99 ("the line stops shaking in your hand").

### 5.7 Economy placement (simulate before shipping)

Fishing is a **materials, XP and discovery** loop, not a Gold strategy. The rebalance's rule R (item
values on the ρ = 0.06 scale) and rule I (rewards as N seconds of income) set every number. Add a scenario
to `scripts/economy-sim.mjs`:

```
node scripts/economy-sim.mjs --fishing [--days=7] [--check]
```

It models, per stage of the existing simulation: catch rate by level and rod (active at the Good grade, and
auto at Off), fish and crate values at the vendor floor, the Merchant's standing order, the daily Ledger
Catch reward, and rod costs. `--check` fails when:

1. fishing's Gold per minute (selling everything plus orders) exceeds **10%** of the forge's Gold per
   minute at any stage after the first 10 minutes;
2. any crate's expected vendor value exceeds the Gold the forge earns in the minutes it took to fish it;
3. any rod is affordable before the Fishing level that wears it (no "buy past the gate");
4. 99 Fishing takes less than 60 or more than 250 active hours (the band the other skills sit in).

Wire `--fishing --check` into CI next to the existing `--check` once Phase 6 lands.

---

## 6. Navigation and exploration

### 6.1 Minimap and full map v2

v1 is being built by another agent now. v2 builds on it:

- **Fog of war per sector** (`f`, 64 bits, §3.4): cells reveal in 4 × 4 blocks as your lantern touches
  them. Torches and Starlight Jars reveal their radius once.
- **Sector thumbnails:** 1 px per cell (32 × 32), colour from each node's `base`, liquids by type,
  cached per sector and repainted only when that sector's revision moves (≤ 0.3 ms per frame).
- **Full map** (M, or the map button; phones: full-screen sheet, pinch to zoom, drag to pan, 44 px pins):
  pins for camps, Rift Anchors, chests, read inscriptions, structures seen, bosses, mission targets,
  the Lodge's quest lake, and the stratum names down the side as a depth ruler.
- **Waypoints:** up to 12 player pins, chosen by **icon** (pick, fish, chest, danger, star…) rather than
  typed text, so they need no translation and cannot hold personal data. A pin can be "tracked": a small
  arrow at the screen edge.
- **Broken Astral Compass** (canon item, codex: "points toward the nearest fact omitted by the active
  model"): an equippable charm. On the map it draws an arrow to the nearest **unread** inscription or
  unopened structure. Source: the Orrery Underworks Echo (a structure find).
- **Rift Map Fragment** (canon item, codex: "a partial route that is legible only beside another keeper's
  incompatible observation"): found in rift shrines and Kael's waycaches; using it reveals the fog of one
  random **unvisited** structure's region *only where it overlaps fog you have already revealed nearby*,
  then the whole structure. Legible beside your own observation.
- **Regrown sectors** (§3.4) show in a muted tint with the line "the Delve took this back".

### 6.2 Getting down and across

| Tool *(new unless noted)* | Unlock | Does |
|---|---|---|
| Ladders, platforms (shipped) | | unchanged |
| **Bark Rope** | Smithing 3: 2 World-Root Bark → 8 rope | placed at a ledge, it **spools down** to the floor below in one action (up to 24 cells); climbable like a ladder |
| **Thornroot Grapple** | Smithing 20: 4 Thornroot + 2 Slag + 1 Shadow-Root Cutting | aim and tap (phones: tap a cell within 10 cells); the line grows to it and pulls you. Codex, Thornroot: "remembers the direction of its last growth" |
| **Seam Rails and the Seam Cart** | Kael's chain (§7.1); rails 1 Cinder + 1 Bark → 4 | Kael's old rail lines are generated in the Basalt band (some broken); place rails, ride the cart at 3× walk speed, rail junctions with E |
| **Anchor Ring** (canon equipment: "a four-point band used to mark a temporary boundary") | Starfall chain | in low gravity and in void: hold Jump in the air to **anchor** in place for 1.5 s (the Terraria double-jump role, without wings) |

No mounts beyond the cart. The atlas forbids the obvious one (the Rootglass Stag "cannot be domesticated
without harming the root network"); low gravity and the grapple fill the role.

### 6.3 Fast travel inside the Delve

- **Camps** (shipped: one per Delve) become **one per stratum** (each placed camp still opens the bench on
  "Ready now", and the shaft's "Descend to your camp" lists them).
- **Rift Anchors** *(new)*: a placeable crafted from 1 **Waystone Shard** (one per rift shrine, first
  visit) + 4 Ironwood + 2 Obsidian. Up to 8. Using one opens a travel list (anchors, camps, the
  Seamworks Waystone) and moves you there (a short fade; nothing is simulated in between). The town
  Waystone's panel gets a "Delve anchors" tab. Lore: the canon shape grammar's "four-point anchors" and
  Rift's codex line ("a passage created by difference").
- Anchors and camps are placed things, so their sectors never heal (§3.4).

### 6.4 Gravity and the deep

- **Starfall:** low gravity (×0.45), gravity-shear bands (§2.2), starlight that lifts you.
- **Void Shore:** no gravity in the sea; on islands normal gravity. Falling off an island drops you into
  the sea, never out of the world; the shore line always has a ledge back up within 6 cells.
- **The Unmade:** normal gravity, but you stand only on what you have witnessed; walking into the dark is
  walking on nothing (outline cells are walk-through until lit).

### 6.5 Light progression

Light is the Delve's real currency of safety, so it gets a ladder.

| Step | Source | Effect |
|---|---|---|
| Lantern | Delving level (shipped: 7 + Delving/10 tiles) | always on |
| Torch (shipped) | Bench | placed, permanent, 150 px |
| **Glowcap Lamp** *(new)* | 3 Glowcap + 1 Bark | placed; cool blue light that does not wake Banked Embers |
| **Oil Lantern** *(new)* | Bench, Smithing 15; Lampfish Oil as fuel | +2 lantern tiles while fuelled (1 oil = 10 min of Delve time) |
| **Heartstone Brazier** *(new)* | 2 Infernal Heartstone + 4 basalt blocks | placed; 300 px; scares Banked Embers |
| **Starlight Jar** *(new)* | Seam Bucket of starlight + 1 Celestial Quartz | placed or held; works underwater and holds back void in 4 cells |
| **Glint** socket | Enchanting (exists) | on a helm: +1 lantern tile per Glint (the merged Rune of Radiance "literally adds light to items", lore addendum) |

---

## 7. Missions, bounties, events and bosses

Missions use the shipped `DelveMission` shape (`src/app/shared/npc/delve-missions.model.ts`: deliver or
inscriptions objectives, `requires`, rewards on rule I). New objective kinds, one each, added when a
mission needs them: `catch` (a species), `defeat` (a boss flag), `reach` (a depth band), `map` (sectors
revealed), `place` (a placeable at a depth).

### 7.1 Mission chains per stratum

| Chain *(new titles)* | Giver (canon) | Steps | Reward | Opens |
|---|---|---|---|---|
| **Grotto Mere: The Drowned Lamp** | the Archivist | catch 3 Glowcap Minnows → read the `grotto-drowned-lamp` inscription → fish the Mere at night with Glowcap bait (the mini-boss, §7.4) | Fishing and Delving XP; the Catalogue shelf | the Catalogue of Strange Fish |
| **Flooded Seams** | Kael | find and drain a flooded shaft (Seam Bucket) → recover 3 Rusted Rivets from it → ride the old rail | 40 min of income; Seam Rail recipe | Seam Rails and the Cart |
| **The Four Who Went Down** | Kael (Verrin on step 3) | open the Breach in the Halls floor (needs the Seam Eater) → find the 4 hammer-marks at the Four's outposts → (Verrin) "let it end": face the Banked Furnace | Pickaxe/Axe V recipes; a Nox rune; Kael's reveal line | the Underhearth's crossing to the Breach; Rift Anchors |
| **Endings Kept Warm** | Verrin | bring 5 Rootling Eels and 1 Cold Coalfish | Verrin's line; the Hollow rune once (ledger) | the Hollow Flask recipe (later) |
| **The Light Under the World** | Aureth | reach Starfall Deep → read 3 star-walls (field notes) → light a fallen star with a Starlight Jar → face the Unlit Star | Aether rune; Starline Rod recipe | the Shore's edge; Anchor Ring |
| **Star-charts** | the Archivist | copy the 6 Starfall field notes | the Codex star shelf; Delving XP | |
| **What Washes Up** | the Merchant | fish 10 Maybes → bring one piece of each realm from the five islands → summon and survive the Undertow | Rod VI recipe; a standing Void order | the Unmade's door |
| **One More** | the Nameless (hidden) | reach band 1, 3, 7, 13 … (each next is "one more" than the gap before) | titles; the band record | endless |

### 7.2 Recurring bounties

The **Board Herald** (approved role title, Quest Board) posts **three Delve bounties a day**, deterministic
from the date and the seed, drawn from templates: defeat N of a creature in a stratum; deliver N of a
stratum's material; reveal N sectors; catch a species; light N torches at a depth. Each pays 5–20 min of
income (rule I) and Delving XP; a 7-day streak adds a crate of the deepest stratum reached. Bounties only
name strata the player has reached.

### 7.3 World events (only while playing; nothing ever destroys a build)

| Event *(new)* | When | What | Canon |
|---|---|---|---|
| **Eclipse Surge** | every 90–150 min of **Delve play time** (not wall clock, so offline time cannot stack it); 4 min | HUD banner; rift shrines open short rifts to a random sector of the next stratum; void seeps up one stratum; rare spawns; crates +1 tier step | canon: the Eclipse "thins the boundaries … reveals hidden paths, awakens artifacts" |
| **Starfall** | at local night (`timeOfDay`), a chance per 10 min of play once Starfall Deep is reached | a fallen star lands in a nearby sector of the upper strata or Starfall; a map pin; it fades in 10 min if not mined | Aureth's chain |
| **Cave-in** | the Ironwood Sentinel walks; Underhearth loose rock | the shipped loose-rock and support rules (`isLoose`, supports) extended to the Underhearth | |
| **Gravity storm** | Starfall, 1 in 5 shear pulses | a wider band flips for 6 s | narrative bible (proposal): gravity shear |
| **Breach Tide** | after the Undertow falls, a chance per surge | Plausibles pour up a rift toward your nearest camp for 90 s; defend it. They put torches **out** (relight with E), never take them | the Void as unbound possibility, unsafe |

### 7.4 Bosses and summon items

Every boss falls once per player for its story flag (`MonsterDef.once`, as the Seam Eater does), then can
be fought again with its summon item for its drop table.

| Boss *(new unless atlas)* | Stratum | Summon (repeat fights) | Fight in one line | First-defeat key |
|---|---|---|---|---|
| **The Drowned Lamp** (mini-boss) | Grotto Mere | fish at night with Glowcap bait after the Archivist's step 2 | a lampfish the size of a cart that dims every light in the cavern; relight torches to expose it | the Catalogue |
| **Seam Eater** (atlas, shipped) | Magma Halls | **Unfinished Brace**: 4 Slag + 2 Cinder + 1 Ember Residue | as shipped | the fragment (shipped); the Breach seal |
| **The Banked Furnace** | Underhearth | **The Four Hammer-Marks** (the chain's items, kept after the first fight) | it never moves; it pulls you and loose drops toward its mouth while Banked Embers spill out; douse its four vents with water (buckets) to open its core | the Underhearth crossing |
| **The Unlit Star** | Starfall Deep | a lit **Fallen Star** core | it drains your light; you win by lighting it (Starlight Jars, torches on skystone) until it decides to burn, then it is beatable | the Shore's edge |
| **The Undertow** | Void Shore | **Rift Lure** bait in the void sea | a current that drags islands together; cut the anchor-lines it throws between them before two islands merge | the Unmade's door |
| *(none)* | The Unmade | | "One More" bands instead of a boss; the Nameless is never fought | |

---

## 8. Lore (where it lives)

The stories, inscriptions, item lines and NPC lines are in [lore-addendum.md](lore-addendum.md), section
**"The Delve and beyond (Phase 6+)"**, each citing the canon passage it builds on. Summary:

| Story | Stratum | Voice |
|---|---|---|
| **The Drowned Lamp** | Grotto Mere | the Archivist |
| **Flooded Seams** | Basalt Caverns | Kael |
| **The Four Who Went Down** | the Underhearth | Kael, Verrin |
| **The Light Under the World** | Starfall Deep | Aureth |
| **Four Undersides** | the Echo regions | townsfolk-style Found-in lines |
| **What Washes Up** | the Void Shore | the Merchant |
| **What the Delve Keeps** | healing (§3.4) | an inscription |
| **One More** | the Unmade | the Nameless |

Inscription pools: 6 field-note walls per new stratum (Underhearth, Starfall, Void Shore, the Unmade) and
2 for the Grotto Mere, 26 in all, authored and finite; the Archivist's existing "all 12" set stays the
core's, and the field notes are a second set ("Field Notes", Codex Lore tab, one shelf per stratum).

---

## 9. Phased roadmap

Each phase is independently shippable, ordered by what fits the current engine first. Sizes: **S** ≤ 1
agent-day, **M** 2–3, **L** 4–6, **XL** 7+ (split it). Every slice passes the world plan's gates
(`seamworks-engine.test.cjs`, `check-ds-adherence`, `check-i18n-keys`, `audit-nav`, `ng build`,
`npm run check:meaning` with no new violations) and the phone perf harness when it touches the frame.

### Phase 6: Water, lava and Fishing v1 (fits today's engine)

| Slice | Scope | Depends on | Size |
|---|---|---|---|
| **6.1 Liquids v1** | `liqType`/`liqLevel` on today's single `Terrain`; water and lava; fall/spread/sleep at 10 Hz; water + lava → obsidian; lava chars wooden placeables back to the satchel; the Seam Bucket; swim, breath, lava damage, Ember Elixir immunity; render pass (flat fills), lava in the light grid; liquid diff in the save (`l`); reduced motion | nothing | L |
| **6.2 Lakes in the core** | Grotto Mere in the glowcap cavern; lava pools on Magma cavern floors; flooded shafts in two Basalt pockets. Liquids fill **existing stamped air**, so no cell changes and **no `version` bump** (no dig is dropped) | 6.1 | S |
| **6.3 Fishing v1** | `fishing` skill + discipline (ledger, Skills panel, unlock rows), Worn/Root/Seam/Glowline rods, bait (Ember Grub, Glowcap, Blindfin, Shadow-Root), catch tables for seeps, shafts, the Mere and Magma lava, junk and Root/Seam crates, the Line Tension mini-game (kit style), auto-fish, Lampfish Oil and Gill Draught, Catalogue shelf, Lodge Warden Ledger Catch, Merchant fish order, the Drowned Lamp chain and mini-boss, EN+ES | 6.1, 6.2 | L |
| **6.4 Fishing economy** | `economy-sim.mjs --fishing` + `--check` in CI; place rod and quest numbers | 6.3 | S |

**Risks:** liquids fighting the Delve's frame budget on phones (mitigated by 10 Hz ticks and sleeping
cells; measure before 6.3); the Keeper drowning feels unfair (breath bar always visible underwater, never
lethal beyond the existing defeat flow); a liquid farm (the "only generated cells pay" rule, with an engine
test). **Tests:** engine node tests for flow determinism, volume conservation, sleep and wake, every
reaction, the char-and-refund rule, save round-trip of settled liquid; Karma for the fishing model (tables
sum to 1, XP by tier, rods gate by level, the mini-game grade only ever adds); e2e `play-fishing.spec.ts`
(cast, hook, reel, a catch in the satchel, Ledger Catch turn-in) on chromium and webkit at 390 and 1280 px;
`check:meaning` covers every fish, bait, rod and crate; perf harness with the Mere on screen.
**Art briefs** (`docs/art-commissions/`): W7L water and lava (body + surface strip); W7a `obsidian`;
I1 icons: Seam Bucket (empty, water, lava), 4 rods, 4 bait, ~12 fish, 2 junk, 2 crates, Lampfish Oil,
Gill Draught; gathering-style bob sprite (4 frames); the Drowned Lamp (large
creature sprite + a boss concept sheet, painting, review only); Catalogue silhouettes reuse the icons.

### Phase 7: The endless Delve (horizontal first)

| Slice | Scope | Depends on | Size |
|---|---|---|---|
| **7.1 Sector world** | the `World` wrapper over sector `Terrain`s, sector-local generator (noise caves, clipped veins, jittered bands), the loaded window, per-sector creature spawns, HP as `Uint8Array`; the core stays exactly as generated today | nothing (6.x optional) | XL → split: 7.1a generator + tests (L), 7.1b engine wiring + window (L) |
| **7.2 Save v2** | index doc + region docs, IndexedDB local store registered with `LocalSaveRegistry`, RLE sector diffs, merge rules, healing, `settleForReload` flush, a migration that moves today's core diff into `core` | 7.1, the save gateway owners | L |
| **7.3 Structures v1** | lattice placement; Kael's waycaches, flooded shafts, lakes in the wings, field-note walls (Grotto and Basalt pools) | 7.1 | M |
| **7.4 Map v2** | fog per sector, thumbnails, full map with pins and waypoints, the Broken Astral Compass and Rift Map Fragment as items | 7.1, minimap v1 | M |
| **7.5 Bounties** | the Board Herald's three daily Delve bounties | 7.1 | S |

**Risks:** the save gateway and `SYNCED_BLOBS` are a fixed list of single documents; region docs are a new
shape (dynamic doc ids) and need the gateway owners' design review first. IndexedDB under Safari private
mode and the PWA must fall back to memory with an honest "not saved" banner. Firestore cost: reads grow
with exploration (bounded by lazy region loads); see owner question 2. Generator determinism across
browsers (integer hashing only, no `Math.random`, no float accumulation in noise beyond fixed precision).
**Tests:** golden sector hashes; seam continuity (a cave crossing a sector border has no step); save
round-trip and merge (two devices, heal vs late change, the property-test style the inventory used);
size-budget test (a synthetic worst-case region doc < 128 KB); e2e walk 10 sectors east, dig, reload,
tunnel still there; perf harness "wide traverse" scene.
**Art briefs:** W8 parallax far/near for the wings is the existing per-biome set (no new art); I1 icons
for the Broken Astral Compass and Rift Map Fragment already exist as canon masters (re-icon to pixel);
map pin icon sheet (12 icons, UI SVG per canon "Interface icon"), regrown-tint is code.

### Phase 8: The Underhearth (depth, the first new stratum)

| Slice | Scope | Depends on | Size |
|---|---|---|---|
| **8.1 Stratum** | rows 56–119 in the sector generator; nodes (obsidian, ironwood pillar, emberheart, pyrite, cold coal, fracture seam); lava lakes; the core's bedrock gap (`version` 2 → 3) sealed until the Seam Eater flag; the depth gate (Delving 15) | 7.1, 6.1 | L |
| **8.2 Creatures and boss** | Banked Ember, Ironwood Sentinel (cave-ins via loose rock), the Banked Furnace (vents, pull, douse with buckets) | 8.1 | L |
| **8.3 Kael and Verrin** | The Four Who Went Down, Endings Kept Warm, Flooded Seams; Four's outposts; field notes ×6; tool tier V for pick/axe (`TOOL_TIER_LEVEL` 5: 60) and Rod IV | 8.1, 8.2 | M |
| **8.4 Getting around** | Bark Rope, Thornroot Grapple, Seam Rails and Cart, camps per stratum, Rift Anchors + Waystone Shards + the Waystone "Delve anchors" tab; Seam Siphon | 7.1 | L |

**Risks:** the bedrock gap changes the core layout (the owner's own dig drops once; zero players);
pulling mechanics on phones (test the Furnace at 390 px); rails need a small physics mode. **Tests:**
engine tests for pull, douse, cave-in with supports, rope spooling, grapple targeting, cart on rails;
missions spec (ids, objectives, rewards on rule I); e2e: Breach gate refuses below Delving 15 with the
reason, anchors travel and return.
**Art briefs:** W7a obsidian, ironwood pillar, emberheart vein, pyrite seam, cold coal; W7b
`tile-wall-underhearth`; W8 `parallax-delve-underhearth-far/near`; creatures: Banked Ember (small),
Ironwood Sentinel (large), the Banked Furnace (boss sprite + concept sheet, painting, review only); W6
props: rope, rail, cart, Rift Anchor, Glowcap Lamp, Heartstone Brazier, Seam Siphon pair; I1: Ironwood,
hammer-marks ×4, Seam Bucket, Waystone Shard, Rod IV, Pickaxe V, Axe V, Hearth crate, 3 fish.

### Phase 9: Starfall Deep, the first Reach

| Slice | Scope | Depends on | Size |
|---|---|---|---|
| **9.1 Reach** | the Breach band and rows 128–223; skystone islands in open sky; low gravity and shear bands; the starfield parallax; starlight liquid (rises) and starglass; the depth gate (Delving 35) | 8.1, 6.1 | L |
| **9.2 Life** | Ephemeris Leech and Anchor Warden spawn (meaning audit #16 for both), Lodestar Drift, the Unlit Star (light it to win) | 9.1 | L |
| **9.3 Aureth and the Archivist** | The Light Under the World, Star-charts; fallen-star craters and the Starfall event; Pickaxe V use, Rod V, Starlight Jar, Anchor Ring, Starbreath Tonic; starlight fishing; Eclipse Surge v1 | 9.1, 9.2, 6.3 | M |

**Risks:** low gravity changes the platforming feel everywhere it touches (contain it to open-sky cells;
islands keep normal gravity); rising liquid is novel (a dedicated test that it never escapes upward past a
ceiling). **Tests:** gravity per cell, shear telegraph timing, starlight conservation upward, Unlit Star
state machine, event determinism per play-time.
**Art briefs:** W7a skystone, orichalcum vein, star-iron, celestial geode, fallen star (feature strip),
starglass; W7L starlight; W8 starfield sky + far/near island layers; creatures: Ephemeris Leech and Anchor
Warden sprites (both already have atlas briefs; check `docs/art-commissions/` before adding), Lodestar
Drift, the Unlit Star (boss sprite + concept sheet); I1: Starlight Jar, Rod V, Anchor Ring (canon master
re-icon), Star crate, 4 fish, Starbreath Tonic.

### Phase 10: Echo regions

| Slice | Scope | Depends on | Size |
|---|---|---|---|
| **10.1 Two Echoes** | Prism Shelf and Ink Deeps: palettes, band nodes, mirror pools; Afterimage Moth and Ink Lantern spawn | 7.1 | L |
| **10.2 Two Echoes** | Orrery Underworks and Rootglass Depths; Graftling spawns (meaning audit #16 closed) | 10.1 | L |
| **10.3 Echo fish** | four realm fish and their legendaries; Veil Draught as the Ink Deeps' counter to mirror-route confusion (canon: "blurs the Keeper from echo substitution") | 10.1, 6.3 | S |

**Art briefs:** per Echo: 3–4 W7a tiles, 1 W7b wall, a W8 far/near pair; creatures: Afterimage Moth,
Ink Lantern, Graftling (check existing atlas briefs first); I1: realm fish ×4, Veil Draught re-icon.

### Phase 11: The Void Shore

| Slice | Scope | Depends on | Size |
|---|---|---|---|
| **11.1 Reach** | rows 224–287; the void sea (void liquid, light holds it back), five shattered-island kinds, void-glass and void-scar; the depth gate (Delving 55) | 9.1 | L |
| **11.2 Life** | Plausibles (outline-choosing), the Undertow (summoned by Rift Lure), Breach Tide events | 11.1 | L |
| **11.3 The Merchant** | What Washes Up; void fishing; Rod VI, Pickaxe VI (`TOOL_TIER_LEVEL` 6: 80), Hollow Flask, Void Crate | 11.1, 6.3 | M |

**Art briefs:** W7L void (with the starfield window pattern), W7a void-glass, void-scar node; island tiles
reuse each realm's town/Echo tiles; W8 void horizon; creatures: Plausibles, the Undertow (boss); I1:
Hollow Flask, Rift Lure, Rod VI, Pickaxe VI, Void crate, 3 fish.

### Phase 12: The Unmade

| Slice | Scope | Depends on | Size |
|---|---|---|---|
| **12.1 Witnessing** | `unmade` outline cells, finishing by light, the finished-cell tables, "One More" bands and their scaling, the band record | 11.1 | L |
| **12.2 Drafts and the Nameless** | Drafts (finish in light), the Nameless at band thresholds (owner question 1), One More chain, field notes ×6 | 12.1 | M |

**Art briefs:** the outline cell style (a W7 overlay, mask-ivory lines), Drafts (large creature, with a
"half-drawn" frame set), a Nameless world sprite only if the owner approves it appearing (question 1).

### Order and parallelism

Phase 6 and Phase 7 can run in parallel (disjoint files: liquids and fishing touch `terrain.ts` cells,
the engine's tick and a new `shared/fishing/`; the sector world touches generation, the save and a new
`World` wrapper). Merge 6.1 first: 7.1 then carries liquid arrays per sector from the start. After that the
order is strict by depth (8 → 9 → 11 → 12), with Phase 10 any time after 7.

---

## 10. Owner questions

Only the decisions that are truly the owner's (canon and cost). New names, layers, creatures and stories
are not among them: the owner approves those in play (naming status, top of this document).

1. **The Nameless in the world.** Today it is hidden in the UI and only speaks behind its combo gate. May
   it appear as a figure at the Unmade's band thresholds (it speaks; it is never fought; it never explains
   the fracture)? The canon keeps the antagonist and the fracture's cause open, and the Nameless sits
   close to both. If not, the Unmade keeps its tally marks and its lines with no figure.
2. **Cloud cost.** The endless Delve adds one Firestore document per explored 256 × 256-cell region per
   player (reads lazy, writes at most once per 30 s per region). A heavy explorer might hold 20–40 such
   documents. OK to spend that, or should region docs past a cap stay local-only (and not follow the
   player to another device)?
