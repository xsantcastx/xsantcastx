# S11 part 2: the Umbral Marches as an act — handoff

Branch `s11marches` (off `6a3b4c86`, main + the Verdant Wilds act), 2026-11-04. Spec: `docs/world/campaign.md` S11;
`docs/design/world-acts.md` §1.4, §2.4, §5.4; canon §3.4b, §8.4. The pattern is S7's and S11 part 1's
(`docs/handoff/s7reach.md`, `docs/handoff/s11wilds.md`): sections as `<land>-<section>` area ids, two-block rims with
walked seams and signposts, connectors, one Waystone a section, named hot spots off the road, a read / sealed thing /
sound per area.

## What a player gets
- **The Marches are a long road.** Old Corvane's pier at Mirewatch lands on **the Gloaming Shore**; its north boardwalk
  crosses into **the Gloaming Fen** (Lanternfen at the end of the north-west road, the Gloam Shrine off the road, the east
  boardwalk to **Gloamhaven**, its own safe section); the pilgrims' road climbs onto **the Pilgrims' Boardwalk**, which
  **breaks off in the black water** (its piles stand on out of the water, no boards on them). The way past is **the
  Sunken Belfry** lying on its side beside the break: in at the bell-chamber end, along the shaft, out at its foot onto
  **the Black Meres**; east over the Meres to **the Deep Fen**, down **the Peat-Cut** into **the Bog Galleries** −1, −2,
  up **the Cutters' Stair** into **the Drowned Ruins** and the Drowned Crypts' door. About 14 minutes' walk, pier to
  crypts' door (the spec says about 15; the test holds 13–16).
- **The edge reads as the fen.** A Marches section's rim (region `m`) is `blackwater` (`ContinentDef.rim`): the fen too
  deep to wade. The seams are boardwalks across it (the road ground is boardwalk end to end); each lands on a firm
  hummock (the arrival spot is never in the water beside the boards). The prompt says **Cross** for a ford or boardwalk
  seam (`reach.act.cross`; the Wilds' two fords too), **Walk on** for a gate.
- **The Sunken Belfry** (`sunken-belfry-1`, 30–32): louvres for a floor, the stair's newels along the wall, bell-ropes
  hanging sideways; **the fifth bell's door sealed** (a door with a bell-shaped keyhole, shut; the chamber behind never
  reached); one slow note under the water every 40 s; the ringers' rota to read (Cobb, Lisle, Teasel, Wyn, the fifth name
  rubbed out); hidden in a nook under the bell-chamber, a ringer's glove ("Pull on four. Never on five.").
- **The Bog Galleries** (`bog-galleries-1` the Cutters' Hall, `-2` the Flooded Cut; 35–38): the long cut, the galleries,
  empty lantern-hooks every twenty tiles, peat pillars, the tally board, a flooded cut boarded across; −2's flooded cut
  crossed on peat blocks, the cutters' cache at a side gallery's end, a wick-tag "Merrin Sedge. Gone up for oil.", the
  abbey's sluice bricked from the other side. Ink Hounds and Mire Lurkers.
- **Waystones**: the Corvane, Wick, Prayer-Board, Mere-Lamp, Lost-Lantern and Abbey-Slab Stones (canon's names) on
  boardwalk hummocks with one lantern (no townsfolk: camps), and Gloamhaven's **Square Stone** (always touched, like
  Pyrehold's and Rootglass's). The Atlas lists the seven.
- **Hot spots**, each in its own clearing ≥8 tiles off every road, no other pack within 18 tiles, the bog firm round
  it: **the Lure Pools** (the Meres, a camp of 8 Mire Lurkers rising together; a boardwalk spur out toward it),
  **the Knights' Causeway** (the Deep Fen, a champion ground: Drowned Knights and Ink Hounds, elites 1 in 4), **the
  Witch's Island** (the Ruins, a den: a unique Gloam Witch pack; a boardwalk spur over the water). **The Lantern Ring**
  stands in the Ruins (the Seam Eater 55's rift, as before).
- **The zone bible's check**: every section and connector floor has a thing to read, a sealed thing and a sound (canon
  §8.5 lists them; words in `td/td-marches.i18n.ts`, EN + ES; six new synthesised cues: boards, bubbles, voice,
  underbell, seep, spade).
- **The Bell Under the Water** (the Black Meres, under an eclipse): a minute or two into the eclipse (seeded: the same
  moment for a party) the fifth bell rings once over the Belfry's roof, a pale ripple spreads over the water, and every
  Lampfish in the Meres goes dark for a minute. Glim, on the roof's boards beforehand: "Don't move. It's listening."
  A Keeper within 10 tiles who stays put through the ringing (12 s) sees the keyhole glow under the roof and takes a
  **Keyhole Rubbing** (once an eclipse, `night:bell-under-water:<eclipse day>`; its satchel card says where it was found
  and that the fifth bell's door has a keyhole this shape). Moving ends it ("You moved. It stopped."). Campaign #12's clue.
- **The Wilds**: the Deep Wilds' "noon is dusk" (`ContinentDef.dim`: the land there is never lit brighter than a dusk).
- **Elite plates** keep clear of the minimap's whole foot (its clock row too): the corner box's height is now measured
  from the shown `[data-world-avoid]` boxes, not a fixed 190 px.

## How
- `td/maps/umbral-sections.ts`: the seven ContinentDefs (`umbral-marches-<section>`), drawn with reach-sections'
  `paint` / `seam` and a boardwalk Waystone hummock. `td/maps/umbral-marches.ts` keeps only the three towns and Mirewatch's
  ship (the single-area map is gone; `RENAMED_CONTINENTS['umbral-marches']` lands an old save in Gloamhaven).
  `td/maps/sunken-belfry.ts`, `td/maps/bog-galleries.ts`: the connector floors (their mouths `TdExit.continent` exits).
  The Lantern Tower's door and the Drowned Crypts' way out now name their section.
- `continent.ts`: place kind `belfry` (the tower's end out of the water: its louvred mouth, broken stonework, an old lamp
  post); mark look `piles`; `dim`. `td-world.ts`: the Marches' bog holds firm round camps, glades, marks and seam
  arrivals (`firmAt`), the water past a broken boardwalk is deep all round (`pastBreak`), the belfry's stamp; a named hot
  spot now keeps other packs out to 19 tiles (it was 18: a spawn's foot sat 17.9 off by its pixel centre).
- `td-sections.ts`: `MARCHES_BIBLE`, `MARCHES_ROUTE`; `SECTION_BIBLE` reads all three acts. `td-zones.ts`: a row per
  section region and the connectors' bands. `td-levels.ts`: CONTINENTS takes `MARCHES_SECTIONS`, LEVELS the three
  floors and their lairs. `td-pack-aura.ts`: the floors are the Marches'.
- Night event: `shared/night-events` gains `bell-under-water` (`eclipse: true`: it runs for the eclipse, its "night" is
  the eclipse's day), `UNDERBELL`, `underbellRing`; `td-night-events.ts` walks and draws it (`stepUnderbell`,
  `lampsOut`, `underbell`), the engine puts the Lampfish out (`GatherRuntime.lampsOut`). Keyhole Rubbing:
  `gathering.model` `KEYHOLE_RUBBING_ID` + meaning, `material-catalog`, `gather-icons`, `gather-keys`, i18n, the
  satchel card.
- `td-harbour.ts`: Mirewatch's pier on `umbral-marches-shore`; Pyrehold's and Mossharbor's ships land there.
  `world-bosses.ts`: Ser Wickless rises in the Ruins. `waystones.model.ts`: `marches:` stone ids.
- Test hooks: `__tdS8.night('bell-under-water')` forces it (the note 3 s in); `__tdS8.underbell()` (webdriver only).

## The Fogmother (S10b, merged d6d56adc) and the Director's round 2
- **Reconciled**: the Three Posts (`mere-posts`) stand in `MERES_SECTION.places` at (96, −52); the Fogmother rises in
  `umbral-marches-meres` there, its posts (96, −62), (105, −47), (87, −47); Old Corvane's boards run out to the pool's
  edge (it was unreachable over the black water); Ser Wickless in `umbral-marches-ruins`. `td-s10b` and
  `social-s10b` point at the Meres section.
- **Atlas title**: the Marches' land key, and a land may have its own short title (`atlas.title.<land>`): "Marches
  Waystones", one line at 360 px.
- **Elite plates** clamp as one (bar, affixes, name) clear of every HUD box by a few px — the minimap and its clock row,
  the chat and its tab, the hotbar, the belt, the dock, the prompt and the HUD buttons (`eliteClamp`, the elite plate's
  own list; plain plates unchanged): a box in the top half is passed sideways, one lower lifted over.
- **The Bell Under the Water**: by the roof, before and through its note, the prompt says **Stand still — listen**
  (no disc verb; E does nothing, never a step down into the Belfry then); the ripple is bright 3×2 dots on the water.
- The fifth bell's door prompts **Sealed: The Fifth Bell's Door**; the shots spec has a 1920×1080 pass.
- A seam's arrival keeps whole packs off (a leader SEAM_CLEAR + 4 away): a follower stood within 8 tiles once.

## Tests
- karma `td/td-marches.spec.ts` (the accept-when list: one area each, zones in band, seams paired and walked with black
  water beside every boardwalk, the arrival rule, the bible's check EN + ES, every stall reachable from the Waystone, one
  stone a section, hearths only in towns, the broken boardwalk with no seam past it, the Belfry the only way and its
  fifth door sealed and unreachable behind, the Galleries the only way to the Ruins, 13–16 min, the hot spots, the Three
  Posts' pool kept, the old ways; the Bell Under the Water: eclipse only, one note, the Lampfish dark, stand still and it
  pays once, move and it ends). Updated td-seek, night-events specs.
- e2e `e2e/td-marches.spec.ts` (sail Pyrehold → Mirewatch, the Shore↔Fen seam both ways, the broken boardwalk stops the
  Keeper and reads, down the Belfry, its fifth door and the glove read, out onto the Meres and back, the Galleries through
  to the Ruins and back, the three hot spots' packs, the Corvane Stone → Atlas (7 rows) → Gloamhaven, the Bell Under the
  Water followed to the rubbing). `e2e/play-top-down.spec.ts`'s Marches trips jump to their sections; `td-s8storm`,
  `td-iso-props-shots`, `td-iso-fx-shots`, `td-iso-walls-shots` name sections; `scripts/social-m3.test.mjs` moves its far
  Keeper to Gloamhaven. Shots: `e2e/td-marches-shots.spec.ts` → `output/s11marches/`.

## Deploy and limits
- **The hearth needs a redeploy**: the room bundle carries the maps (seven new areas, three new floors, the old
  `umbral-marches` gone). Until then a room that does not know `umbral-marches-*` leaves those areas to each screen.
- Not built (S11's rest): the Sisters' Procession and A Voice Calls a Name (the Marches' other night events); the Bog
  Galleries' hooks lit with Firemaking and −2's sinking peat blocks (the blocks are firm ground); the cutters' cache's
  named contents (it is a plain chest); the Lantern Ring's Eclipse-touched Lantern Wisps; Old Corvane's boat north (Act
  IV is not built); the Fog Shepherd and the bell-rope of campaign #3 in the Belfry; the Wilds' Dusk Hymn, Spore Lights
  and the Ring of Thorns' bats; Ember Isle's growth (the rockslide, Slagstone Cave as the way east): not reached.
- The Witch's Island's den is one unique Gloam Witch pack (its minions are its own kind); the spec's two Drowned
  Acolytes would have been two more unique packs under the den rule, so they were left out.
