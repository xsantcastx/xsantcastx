# S7: the Infernal Reach as an act — handoff

Branch `s7reach` (off main `a4a2435d`), 2026-11-03. Spec: `docs/world/campaign.md` S7, `docs/design/world-acts.md`
§0, §1.2, §2.2; canon §3.4b, §8.2, §8.5.

## What a player gets
- **The Reach is a long road.** Out of Pyrehold's North Gate onto the Cinder Steppe, west to the Charwood, down the
  **Kiln Tunnels** (the only way into the Deep Charwood), over the East Pass into the Obsidian Badlands, through the
  **Glass Throat** −1…−2 (the only way to the Molten Fields), up the Switchbacks to the Pyre Peaks: the Ring of Pyres,
  the Bastion Road (the Ashen Bastion and its crypt), the Ember Altar, the Caldera Rim and the Molten Deep's mouth. Side
  ways: the Steppe's south-east road to **Cinderport**, its shore path to the **Ashen Shore and Glasswater** (fishing, a
  dead end), the Charwood's west road to **Ashgrove**. About 13 minutes' walk, plaza to rim (the spec computes 12.6).
- **Seams you walk through.** Every section ends in two blocks of rock or sea; its ways on are road gates and passes cut
  through it, each with two posts and a signpost (and a Map way pin). Two tiles past the gate the screen veils (0.4 s; at
  once under reduced motion) and the Keeper stands 6 tiles inside the far gate, on its road; nothing spawns within 8.
- **Waystones**, one a section (the Watch Cairn, Glasswater, Kiln, Clan, Spill, Drake, Pyre stones; the Plaza Stone in
  Pyrehold, the Harbour Stone in Cinderport, the Green Stone in Ashgrove). E at one records it (+15 Delving XP once) and
  opens the **Atlas**: the land's stones, the touched ones lit; one button travels free to the picked one.
- **Hot spots**: **Kettle Camp** (Deep Charwood: 8 orcs, 2 Firecallers, a Warlord round a stolen Watch kettle; the camp
  rises together 90 s after the last falls), **the Scorch Rings** (Badlands: a champion ground, elite packs 1 in 4),
  **the Drake Nests** (Molten Fields: a den, its drake always a unique pack), **the Watch's Last Cairn** (Pyre Peaks: 6
  Bone Walkers, 3 Bone Archers, an Ash Ghoul). All off the road.
- **The zone bible's check**: every section and connector floor has one thing to read, one sealed thing and one sound
  (canon §8.5 lists them; words in `td/td-reach.i18n.ts`, EN + ES; sounds are seven new synthesised cues).
- **The end of Act I**: Garrick Dross's board at Pyrehold holds the Verdant ship ("The captains will not sail until the
  Cinder Sovereign falls.") until the Bestiary has the Sovereign felled.

## How
- `td/maps/reach-sections.ts`: the ten section ContinentDefs (`infernal-reach-<section>`), drawn in blocks with
  `paint` (two-block rock rims) and `at(bx, by)`. `td/maps/kiln-tunnels.ts`, `td/maps/glass-throat.ts`: the connector
  floors; their far mouths are `TdExit.continent` exits. `td/td-levels.ts`: CONTINENTS takes the sections (the old
  `infernal-reach` is gone; `RENAMED_CONTINENTS` lands an old save in Pyrehold's square), `landOf()`.
- `td/continent.ts`: `land`, `title`, `townKind` (capital / village / camp: a camp has no hearth), `quiet`, `townWays`,
  `seams`, `stone`, `marks`, `camps`. `td/td-world.ts` lays them (stalls `seam:` / `tdstone:` / `read:` / `sealed:`,
  `stampSection`, the arrival rule in `nearWayIn`). `td/td-sections.ts`: the seam rules, REACH_BIBLE, REACH_ROUTE.
- `td/td-engine.ts`: `stepSeams` → `crossSeam` (veil, `switchWorld`, arrival), `walkInto` (connector mouths),
  `travelToStone`, `landStones`, `stepSectionSound`; the land (`landOfArea`) for weather, gathering, the Hush, pack auras
  and the Seam Eater. `__tdReach` test hook (webdriver only).
- `td/td-mobs.ts`: `den:` / `cg:` spawn keys roll their packs (always unique; 1 in 4); `camp:` keys rise together
  (CAMP_REST 90 s). `td/td-zones.ts`: a row per section region; `landOfArea`; `seamLevelFor` by land.
- `td/td-harbour.ts`: PIERS on the section ids, rows by land, `ACT_GATES_ENFORCED = { pyrehold: 'cinder-sovereign' }`;
  the Sailing Board takes `cleared` (the Bestiary's felled bosses). `play/atlas/`: the Atlas (cozy kit, 48 px rows, one
  brass button). `shared/waystones/waystones.model.ts`: `reach:` stone ids (union-merged, cloud-synced as before).
- World boss Gharak Emberjaw rises in `infernal-reach-badlands` (`h`).

## Tests
- karma `td/td-sections.spec.ts` (the accept-when list: one area each, seams paired and walked, the arrival rule, the
  bible's check, one stone a section, connectors the only way, 12–15 min, the hot spots, Garrick's lock); updated
  td-deep, td-hearth, td-harbour, td-seek, td-mobs, td-zones specs for the new ids.
- e2e `e2e/td-reach.spec.ts` (sail in, walk the north gate both ways, the Kiln Tunnels through, Kettle Camp's pack and
  the Drake Nests' unique, the Plaza Stone → Watch Cairn → travel back, a read, Garrick's locked row);
  `e2e/menus-reach.spec.ts` (the Atlas reaches its end at 390×844, 360×640, 844×390); `e2e/play-top-down.spec.ts` moved
  to the sections (`toSection` in play-helpers). Shots: `e2e/td-reach-shots.spec.ts` → `output/s7reach/`.
- `scripts/social-m3.test.mjs`: the room-cost test spreads its 12 surface Keepers by land (three sections of the Reach),
  not three on each of 13 surfaces (measured 2.05 ms a step; main 5.0 ms).

## Gate (2026-11-03, this branch)
check:meaning clean; tsc app + spec clean; `npm run test:ci` 4404/4404; CI's node line 336/336, delve-endless 31/31;
ds-adherence, i18n keys, nav audit, economy-sim and combat-sim --check pass; build initial 1.39 MB; CSP hashes match.
Chromium e2e (play-top-down, td-*, play-hud, play-mobile-hud, menus-reach, onboarding; PW_PORT=4695): 262 passed, 182
skipped (hearth specs), 11 failed on the first run — the Reach specs still walking to old places (td-map, td-fx-shots,
td-fx2-shots, menus-reach), fixed and green on rerun, plus `play-top-down` "a Rivet Maw fights back" and `td-coop`
"companions", which pass alone (Ember Isle; untouched).

## Deploy and limits
- **The hearth needs a redeploy** for the room to run the new areas (the world bundle carries the maps). Until then a
  room that does not know `infernal-reach-*` leaves those areas to each screen. `social-server.mjs` and
  `functions-game` are untouched.
- Area ids are `infernal-reach-<section>`, not `infernal-reach:<section>` as the spec wrote: the Hearth's AREA grammar
  and the drop/hearth id grammars are `[a-z0-9-]`; a colon would have meant a server change and a redeploy of both.
- Not built: the Kiln Tunnels' rail-junction carts and the Glass Throat's mirror-hall puzzle (the encounters), the
  hidden cache's light rule (the chest is there, no shutter yet), the Ring of Pyres' Eclipse-touched wraiths, "travel to
  the capital from anywhere"; the camp rises together only while its members are loaded. Ember Harbour's long-way ketch
  to Mossharbor is not held by the Sovereign (the spec names Garrick's board only): the DM's call.
- The Sailing Board's Escape also opens the Game Menu (its section and the window both handle the key; pre-existing).
  The Atlas only handles it once.
