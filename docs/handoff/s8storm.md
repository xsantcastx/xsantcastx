# S8: Thunderstorms, the land weathers, night events batch 1 (branch `s8storm`, 2026-11-03)

Campaign S8; design `docs/design/world-acts.md` §3.2–3.7 and §5; canon §6.7, §9. Base: Weather v1 (`docs/handoff/gather.md`).

## What a player gets
- **Thunderstorm strikes.** Every 20–40 s in a storm a white pixel ring appears on open ground within 12 tiles of the
  Keeper and hums for 1.2 s (the tell). Then a stepped bolt, a scorch that fades in 20 s, and 8% of max life as
  lightning to whatever stands within a tile and a quarter.
  - A strike never takes a Keeper below a tenth of his life. Creatures take it in full, deeper if Wet.
  - Never on a town's safe ground.
  - Flash: 25% white for a near strike, 8% for one off screen, never two within 3 s. There is no flash or bolt under
    reduced motion or on Soft: the ring alone.
  - Thunder: `thunder-near` cracks 0.1 s after the strike, then rolls. `thunder-far` rolls 1.5–4 s late.
  - Glim calls the first tell of a session: "There! Off the ring, quick!" The dark-born step back from a strike's flash.
- **The land specials** (they no longer read as Overcast):
  - **Ashfall** on Ember Isle and the Reach: grey flakes drift down-left, the ground gets a 5% grey film, fire +10%.
  - **Spore drift** in the Wilds: pale motes rise and the land has a soft green tint. A fire hit on a creature makes
    the drift burst once round it (8 damage, 1 tile; creatures only).
  - **Mist-rain** in the Marches: half the rain, in finer streaks, and the fog is 0.1 thicker. It is Wet at half
    strength (fire −8%, lightning +10%), and fires gutter and fish bite as in rain.
  - Each special has a pip (ash flake, spore, droplet + fog) and EN + ES names.
- **What people say** (world-acts §3.6): each line plays once per weather window when the Keeper walks within 5 tiles
  of the speaker while their weather holds.
  - Odd Tarn: storm.
  - Maud Kiln: rain, storm or mist-rain.
  - Captain Brannoc Vey: storm.
  - Canopy Warden Ilsa Fenn: spore drift.
  - Old Corvane: fog or mist-rain.
  - Old Netter Pell's line (as you cast) and Glim's first-rain line shipped in S4.
- **Odette Pryor's forecast board** is on the wall of the Pyre Spire's Study (`pyre-spire-2`, 'B'). Read it and it
  gives one line about the next two windows over the Reach, from the same roll the sky uses: "Ash by the next bell.
  Then Rain."
- **Stormscale and the Thundercake.** One cast in 40 at sea in a thunderstorm lands a Stormscale (Fishing 5). Cook
  it into a Thundercake (Cooking 5): it mends 90 life, then lightning bites 5% less for 10 minutes. The Fishing
  Store buys both.
- **Night events.** Each is seeded per land and night (`hashSeed(land|event|night)` on the world clock, the room's
  clock in the room), so a party sees the same thing. Each runs at most once a night. None hurts, takes or chases.
  Walking away ends it. Following pays once a night, keyed `night:<event>:<night>:<item>`.

  | Event | Where | When | Following pays |
  |---|---|---|---|
  | **The Late Shift** | Ember Isle, the mine head on the Seamworks' west lane | night, 1 night in 3 | Six lamps walk up out of the shaft and go out one by one, and the beacon's light leans after them (the campaign #1 clue). Where the last goes out: a **Cold Miner's Pasty** (60 life, then +10% Mining XP for 10 min) and the scrap line "Shift done. Nobody signed us out." |
  | **The Count Goes On** | the Hushed Barrow's lych-gate (tile −46,−22) | night and fog | The bell counts 1–40 above the gate, with a 1.5 s beat, then falls silent for one beat and starts again. Stand within 3 tiles through a whole count: Wren's "You counted with me. Nobody does." and his thanks in Gold (three minutes of a level-6 hunt). This stands in for the spec's "+1 Sexton's favour": no favour system exists. |
  | **The Relief Column** | the Pyre Peaks' Bastion Road to the Ashen Bastion | night | A grey file of ten marches about 60 s to the gate. A voice calls "Present." twenty times. Walk at their side (within 5 tiles for 60% of the march) and be at the gate: the chalked last name, **Ensign Halden Rook**, and a **Margin Note Scrap** (a readable clue to the Ashen Crypt's sealed chapel). |
  | **The Kiln That Lights Itself** | the Deep Charwood's cold kiln (`sealed:deep-kiln`) | night and Ashfall | It glows for 2 minutes while the burners' shadows work it. Light it before it fades (needs a tinderbox): **Charcoal ×10** (a Firemaking fuel the Woodcutting Store buys) and a **Basalt Blank**, plus the tally line "Ten days. Leave the rest." |

## Where it lives
- `shared/weather/weather.model.ts`:
  - `LAND_SPECIAL`, and the special in `stateFor`'s sixth column;
  - `wetStrength`, `ASHFALL`, `SPORE_BURST`;
  - `STRIKE`, `strikeOnKeeper` and `strikeOnCreature`;
  - `forecast`, which Odette's board reads.
- `shared/night-events/night-events.model.ts` is pure: the night (20:00–05:00), seeds, starts, `nightEventsAt`, the
  Count's clock and the rewards.
- `play/td/td-night-events.ts` walks and draws the events, tracks whether this Keeper followed, and sends news.
- `play/td/td-weather-fx.ts`:
  - strikes: ring, bolt, scorch and news;
  - the specials' motes and films;
  - the finer Mist-rain streaks.
- `play/td/td-sky-lines.ts` holds the barks and the board's place.
- `td-engine.ts`:
  - `updateSky`: strikes, the special rules, barks and night news;
  - `drawSkyOver`, in both iso and classic, after the night pass, so a tell is never lost in the dark;
  - `readBoard` and `lightKiln`;
  - `fixedLights` (strike flash, lamps, kiln);
  - test hooks under `__tdS8`;
  - `?weather=` now accepts `ashfall`, `spores` and `mistrain`.
- `td-mobs.ts`: `stormStrike`, `wetHalf`, `skyFire`, `sporeSky` and `sporeBurst`, plus `mealLightning` in
  `biteKeeper`.
- Host (`side-scroller`):
  - `skySaw`: Glim's strike line, the kiln's tinderbox, and whether a reward is already booked;
  - meal buffs on eat;
  - the board's words;
  - satchel cards for the new things.
- `shared/gathering/meal-buffs.service.ts`: the pasty's Mining XP, read by `SkillActionService.act` for skill
  `mining`.
- Sound: `strike-hum`, `thunder-near`, `thunder-far`, `count-bell`, `present`.
- Words: `gathering.i18n.ts` (`weather.*`, `nightev.*`, `gather.*`), EN + ES.

## Server
None needed. The night events and the board are deterministic from the world clock and the land's weather rolls,
which the room already sends (`world-weather`). Strikes are seeded per Keeper. A creature the room owns takes a
strike through the usual claim path (`hurtMob` on a replica claims to the host). **No Hearth deploy.**

## Not done / known gaps
- Ashfall's cold −10%: the game has no single cold multiplier to hang it on.
- Rain and Storm's "lightning skills +20% / +35%". S9's Thornstrider rows read the storm; there is no general
  lightning-skill multiplier.
- Ash Wolves hunting by day in Ashfall; dark-born showing by day in fog; fish darting from a strike.
- The weather sound beds (rain, wind) and the music's warmth filter. Only the cues ship.
- The Count's "Sexton's favour" is Gold from Wren, not a favour counter.
- The Late Shift walks the Seamworks' west lane, because the built mine head is in the square, not out in the
  Ashfields as canon's zone line has it.
- Meal buffs last for the session (a reload ends them, as it ends a meal's heal).
- The pasty's Mining XP covers every Mining step through `SkillActionService.act`, which includes ore pickups and
  world nodes. It does not cover the Seamworks seam's `resolveMine`.
- The Count and the Kiln read the weather with fixed regions (`F`), so they are the same for everyone on the land.

## Gate and perf (2026-11-04, after merging main a295087d)
- Passing:
  - tsc (app and spec);
  - `npm run test:ci`, 4606/4607. The one failure is `td-truth-marks` `thornrain.b3:wetWood`, a stochastic
    12-sample mean from S9. It fails about 2 runs in 5 here and passes on rerun. 4/4 clean on main is too few runs
    to rule out the same flake there; S8 touches nothing it reads.
  - the build: initial 1.39 MB;
  - check:meaning;
  - CI's `node --test` line, 337/337;
  - ds, i18n, nav, economy and combat sims, and the CSP hashes;
  - chromium e2e play-top-down, td-*, play-hud, play-mobile-hud, menus-reach and onboarding: 280 passed. The one
    failure, `td-world` "the room runs the island", passes alone.
- `e2e/td-s8storm.spec.ts`: 8 passed.
- Phone profile: `TD_PERF=1 ARTOPT=iso`, CPU ×6, run interleaved against a build of main, engine work per frame
  (ms). The machine was shared with other agents' builds and e2e, so it is noisy:

  | Scene | s8 run 1 | main run 1 | s8 run 2 | main run 2 |
  |---|---|---|---|---|
  | road, standing | 6.55 | 14.42 | 11.26 | 10.12 |
  | road, walking | 16.94 | 21.26 | 16.59 | 15.50 |
  | town, standing | 22.08 | 23.75 | 21.16 | 22.26 |
  | town, walking | 26.33 | 29.33 | 25.13 | 20.26 |

  These show no systematic regression; the swings are the shared machine and the night-pass "light" share. A pinned
  storm on s8 with strikes landing measured road 5.91 / 13.32 and town 8.94 / 13.57 (standing / walking). The night
  events ask the model twice a second, and a strike's ring is about 120 fillRects for 1.2 s.
- Screenshots are in `output/s8storm/` (not committed):
  - storm tell and scorch, iso and classic, plus a phone shot;
  - Ashfall, Spore drift, Mist-rain, plus Mist-rain on a phone;
  - Odette's board;
  - the Late Shift, plus a phone shot;
  - the Count, the Relief Column (marching and at the gate), the Kiln.
- For the Director: the self-lit kiln reads small among the Deep Charwood's trees, and the Late Shift's lamps are
  subtle in the lit Seamworks square.

## Director fixes (2026-11-04, after the first review)
- **Kiln:**
  - warm ground three tiles round, a light column over the mouth, a white-hot heart;
  - sparks and a slow pulse (1.6 rad/s), held still on Low and under reduced motion;
  - the light radius it gives the night pass is 96.
- **Late Shift:**
  - lamps rise 2.5 s apart at 1 tile/s, so all six are on the lane at once (about 12.5–14 s in);
  - each lamp has a 2-tile halo and warm light on the ground, drawn with additive blending so it reads in the lit
    square;
  - each flares as it goes out, and leaves a curl of smoke.
- **The Count:** a solid ring at the lych-gate and a large count on a dark plate with a bell mark.
- **Relief Column:** brighter figures. **Ashfall and Spore drift:** 48 / 28 / 16 motes (Normal / phone / Low), each
  with a dark under-edge so it shows on light ground, and stronger films. **Scorch:** a tile-wide burn with cracks and
  early embers.
- **Odette's board:**
  - reads on its own parchment card (`[data-board-card]`, a pixel ×, closes itself after 12 s);
  - in reach, the prompt says **Read the board**.
- The soft green circle round the Keeper in storm, count and kiln shots is the night pass's own light round the
  Keeper (td-night, existing). It is not S8's.
- Shots are taken in iso (`artopt=iso`; the e2e browser's default is classic), with the area name card faded and the
  scene's creatures held calm (`__tdS8.calm`, webdriver only).
