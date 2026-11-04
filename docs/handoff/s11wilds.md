# S11 part 1: the Verdant Wilds as an act — handoff

Branch `s11wilds` (off main `d2332166`, with `s8storm` merged in for the night-event frame), 2026-11-04. Spec:
`docs/world/campaign.md` S11; `docs/design/world-acts.md` §1.3, §2.3, §5.3 (the Verdant parts); canon §3.4b, §8.3, §9.
The pattern is S7's (`docs/handoff/s7reach.md`): sections as `<land>-<section>` area ids, two-block rims with road
gates and signposts, connectors, one Waystone a section, named hot spots off the road, a read / sealed thing / sound per
area.

## What a player gets
- **The Wilds are a long road.** Sail into Mossharbor (on **the Mossy Shore**), up the north road into **the
  Fernglades** (Thornwick at the end of its east road, the Moss Altar off the road, the west road to **Rootglass**, its
  own safe section), over the ford road to **the Rootwater Ford** (the planks across the river, the Drowned Aqueduct; the
  mere path east to **the Glassmere**, still water, fishing, a dead end), up the north road into **the Greenwood**. Its
  old road to the Deep Wilds is **grown shut with a thorn hedge** (two rows across the cut; the cairn beside it: "The wood
  closes what it forgets."). The way on is under it: the root-hole at the road's end into **the Root Hollows** −1, −2,
  −3, and **floor 3's new root-ramp** up into **the Deep Wilds**, then the east road to **the Sunken Courts** and the
  Overgrown Temple's gate. About 13 minutes' walk, pier to temple gate (the spec says about 14; the test holds 12–15).
- **The edge reads as the jungle.** A Wilds section's rim (region `m`) is `vinewall` (`ContinentDef.rim`), the temple's
  own wall of vine and root, not the Reach's rock; the seams are gates cut through it.
- **Waystones**: the Net, Bell-Post, Plank, Mere, Copy-Tree (between two identical jungle trees), Heartroot and Pillar
  Stones, and Rootglass's **Boardwalk Stone** (always touched, like Pyrehold's Plaza Stone). The Atlas lists the eight.
- **Hot spots**, each in its own clearing, no other pack within 18 tiles: **the Weaver Canopy** (the Greenwood, a den: a
  unique Thorn Weaver pack), **the Hart Meadow** (the Deep Wilds, a champion ground: Harts and Moss Stalkers, elites 1 in
  4), **the Bell-less Square** (the Courts, a camp: 6 Vine Lashers, 2 Moss Stalkers, 3 Sporecaps, rising together). The
  Ring of Thorns stands in the Courts (the Seam Eater 40, as before).
- **The zone bible's check**: every section and every Root Hollows floor has a thing to read, a sealed thing and a
  sound (canon §8.5; words in `td/td-wilds.i18n.ts`, EN + ES; eight new synthesised cues: birdstop, frogs, creak,
  chitter, hymn, chew, drip, heartbeat).
- **The Walking Tree** (night, or the Greenwood's fog): in the Greenwood's glade one of the Copied Pair is somewhere else
  each time the Keeper looks away — only while it is off the screen, never within 6 tiles of him. After its third move
  Glim drifts to it and dims ("That one is the copy. Strike it."), and the prompt says **Strike the tree**. One blow: it is
  a plain tree for the night, and a **Copy-Seed** lies at its foot (once a night, `night:walking-tree:<n>`; its satchel
  card says where it was found and what it is for). The clue for campaign #7.
- **The end of Act II**: Sunny Pell's third ship, a **fen-barge to Mirewatch**, is held until the Elder Rootwyrm falls
  (`ACT_GATES_ENFORCED.mossharbor`); the board says so.

## How
- `td/maps/wilds-sections.ts`: the eight ContinentDefs (`verdant-wilds-<section>`), drawn with reach-sections'
  `paint` / `blocks` / `seam` (now exported) and a Verdant grove camp. `td/maps/verdant-wilds.ts` keeps only the three
  towns and the ship stations (the old single-area map is gone; `RENAMED_CONTINENTS['verdant-wilds']` lands an old save
  in Rootglass). `td-levels` CONTINENTS takes `WILDS_SECTIONS`.
- `continent.ts`: `rim` (the edge's ground), `SectionMark.look: 'hedge'` and `span` (rows of it across a road), `trees`
  (fixed trees: the copied tree's true twin) and `glades` (kept clear of the wilds' own trees). `td-world.ts` lays them;
  a lair (continent `hotspots`) keeps its heart 23 tiles off a named hot spot; `extra` objects (the walking copy) are
  drawn with the wilds' own. `td-art.ts` `thornHedge` and its iso twin in `td-iso-props.ts`.
- `maps/root-hollows.ts`: floor 1's root-hole opens onto the Greenwood, floor 3 gains the root-ramp (`/`) onto the Deep
  Wilds (`RAMP_IN` on the surface), each floor a read (`I`) and a sealed thing (`P`). The temple, the Bole and the two
  village houses name their section on the way out (`TdExit.continent`).
- `td-sections.ts`: `WILDS_BIBLE`, `WILDS_ROUTE`, `SECTION_BIBLE` (the engine's section sound reads both acts).
- Night event: `shared/night-events` gains `walking-tree` (night, or a day's fog: one seed for that day and the night
  after) and `WALKER`; `td-night-events.ts` walks it (`stepWalker`, `walker()`, `strikeWalker`) and draws the dimmed
  Glim; the engine moves the copy (`placeWalker`, a `TdObject` in `world.extra`), sees by the real view (`onScreen`, iso
  and classic), takes the blow in `interact` (and the E key), and reports `td-walker`. Copy-Seed:
  `gathering.model` `COPY_SEED_ID` + meaning, `material-catalog`, `gather-icons`, `gather-keys`, i18n, the satchel card.
- `td-harbour.ts`: Mossharbor's pier on `verdant-wilds-shore`, its third ship. `td-zones.ts`: a row per section region.
  `world-bosses.ts`: the Copied Hart rises in the Deep Wilds. `waystones.model.ts`: `wilds:` stone ids.
- Test hooks: `__tdReach.walker()` (webdriver only); `__tdS8.night('walking-tree')` forces it.

## Tests
- karma `td/td-wilds.spec.ts` (the accept-when list: one area each, seams paired and walked with the wood's wall
  beside every cut, the arrival rule, the bible's check on sections and floors, marks reachable, one stone a section,
  hearths only in towns and Rootglass's Shrine, the Hollows the only way into the Deep Wilds, the hedge wall to wall,
  12–15 min, the hot spots and their 18-tile clearings, the old ways still landing, the fen-barge's lock; the Walking
  Tree: unseen-only moves, never within 6, three moves, one blow, one seed, its spots in the glade). Updated
  td-verdant, td-harbour, night-events specs.
- e2e `e2e/td-wilds.spec.ts` (reach by the long-way ketch, the Shore↔Fernglades seam both ways, the hedge stops the
  Keeper and its cairn reads, the Hollows down and up the root-ramp and back, the Hart Meadow's and the Bell-less
  Square's packs, the Net Stone → Atlas (8 rows) → travel to Rootglass, the Walking Tree followed to its blow).
  `e2e/play-top-down.spec.ts`'s Verdant trips jump to their sections (`toSection`); `td-iso-props-shots` and
  `td-s8storm` name sections. Shots: `e2e/td-wilds-shots.spec.ts` → `output/s11wilds/`.

## Deploy and limits
- **The hearth needs a redeploy**: the room bundle carries the maps (eight new areas, the old `verdant-wilds` gone, the
  Root Hollows' floors changed). Until then a room that does not know `verdant-wilds-*` leaves those areas to each screen.
- The Walking Tree's moves are per Keeper (what each one's screen sees); the night, its start and its reward key are the
  land's, as S8's are.
- Not built (S11's rest): the **Umbral Marches** (all of part 2: the Pilgrims' Boardwalk, the Sunken Belfry's upper half
  with the fifth bell's door sealed, the Bog Galleries, its hot spots and night events); the Wilds' **Dusk Hymn** and
  **Spore Lights** (the spore-choked hollow in the Deep Wilds is their sealed promise); the Ring of Thorns' Eclipse-touched
  Canopy Bats; the Deep Wilds' "noon is dusk" light; the Storm-Struck Oak landmark; **Ember Isle's growth** (the rockslide,
  Slagstone Cave as the way east: the filler was not reached).

## Gate (2026-11-04, after merging origin/main d11376bc)
check:meaning clean; tsc app + spec clean; `npm run test:ci` 4646/4646 twice; CI's node line 337/337, delve-endless
31/31 (one timing test failed once while karma shared the CPU, passed alone); ds-adherence, i18n keys, nav audit,
economy-sim and combat-sim --check pass; build initial 1.39 MB; CSP hashes match. Chromium e2e (play-top-down, td-*,
play-hud, play-mobile-hud, menus-reach, onboarding, play-thumb-hud; PW_PORT=4696): 321 passed, 191 skipped, 2 failed on
the full run — play-top-down's Verdant trip still sailing home from Rootglass (fixed: it walks back to the Shore's pier;
green on rerun) and td-dirfix "a wolf behind a tree" (passes alone). `e2e/td-wilds.spec.ts` 5/5, shots 7/7.

## S10 merge and Director fixes (round 2)
- **S10 reconciled** (merged 1be211e2): the Storm-Struck Oak is a `storm-oak` place in `verdant-wilds-greenwood`
  (`STORM_OAK_AT` −10,−112: a clearing ≥14 tiles off every road, >40 from the Weaver Canopy, >30 from the Copied Pair's
  glade; its ring keeps every spawn out). The Antlered Storm's `area` is the Greenwood's id, so the room's `weatherBoss`
  raises it there; `__tdS10.oak` keys on the area; `social-s10.test.mjs` and `e2e/td-s10boss.spec.ts` use the section.
- **Strike the tree** on every surface: the phone disc has its own verb (`thumb.verb.strike`, a sword with a leaf), the
  walker's reach is 3 tiles, and the e2e asserts the prompt's words.
- **The hedge in iso**: each clump a tall bramble (a tile and a half), lighter leaf, a lit top edge, long pale thorns.
- **The Wilds' wall in iso**: on the surface a `vinewall` is drawn as the new `wild` material (td-iso-walls) — leaf-green
  bulges and root ropes, no courses or seams, a brighter lit lip, vines hanging 3+ rows. The temple keeps its masonry.
- **Plates**: a creature's plate is not drawn while it would print over the Keeper's body (`plateOnKeeper`, in the
  plate's own frame, iso and classic); the minimap is a `[data-world-avoid]` box, so plain plates slide clear of it as
  of the prompt (and of every HUD button); elite lines keep an 8 px margin round the corner box.
- Glim dimmed beside the Walking Tree: a pale dot with a slow ring breathing out (static on Low / reduced motion).
- Not done (nice-to-haves): Glim's chat line on phone during the event; a wanderer-free radius at hot-spot hearts;
  the Keeper's occlusion fade at the Bell-less Square's pillars.

Gate (round 2, after the S10 merge 1be211e2 and the Director fixes): check:meaning, i18n, ds clean; CI node line incl.
social-s10 340/340; delve-endless 31/31; combat-sim --check holds; karma 4652/4652 twice; build 1.39 MB, CSP match.
Chromium set (incl. td-s10boss): 324 passed, 191 skipped, 4 failed on the full run — onboarding (a) and td-coop
companions pass alone; td-quick-belt's iso badges were the plate rule hiding a creature two tiles beside the Keeper
(narrowed to the body; green). Rerun of quick-belt, dirfix, td-wilds, td-wilds-shots, td-s10boss, onboarding, td-coop:
32/32.
