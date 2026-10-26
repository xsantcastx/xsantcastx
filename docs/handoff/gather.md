# Gathering skills and Weather v1 (branch `gather`, 2026-10-26)

Canon §6.5 and §6.7; design `docs/design/world-acts.md` §3 and §4; campaign S4. Screenshots: `docs/handoff/gather/`.

## What a player gets
- **Fishing at marked spots.** Lakes, rivers, the marsh and the sea have spots: a ripple with a red-and-white float
  half a tile out from the bank. The fish show as shadows circling under it (up to 14 on screen, 8 on a phone or Low).
  Each one jumps every 40–90 s; a jump at the spot being fished brings the next bite 2 s sooner.
  - Click or tap the float, or press E beside it. The Keeper walks to the bank, faces the water and casts. He keeps
    fishing until the satchel can't take the next catch ("Your satchel is full") or he moves.
  - Gates: lake Fishing 1 (the Worn Rod works), sea 5 (a Root Rod from the Fishing Store), river 10 and marsh 20 (a
    Seam Rod). Bait is optional; it is used one per catch and draws the better fish up.
  - Fish: Ash Perch (lakes, 1), Mirrorfin (sea, 5), Rootling Eel (rivers, 10), Mire Carp (marsh, 20), Lampfish (lakes
    and marsh by night, 25), Moonbelly (any water under an eclipse, 40).
- **Woodcutting.** A tree gives its land's log: Ashwood (Ember Isle, Woodcutting 1), Char-oak (Reach, 15), Rootglass
  Bough (Verdant, 30), Cypress (Marches, 45). It takes 4 swings, one fewer per 20 levels past the gate. A quarter of
  felled trees still give World-Root Bark.
- **Firemaking.** Click a log in the satchel and press **Light** (needs a Tinderbox from the General Store, never used
  up). The Keeper strikes it for 1.6 s, the fire catches at his feet and he steps aside.
  - Firemaking gates: 1, 15, 30 and 45. A fire burns 2 minutes; rain burns it twice as fast.
  - A fire lights the night. The Hush can't rise beside one, and the dark-born keep back from its light.
- **Cooking.** Click a fire or press E beside it, or press **Cook** on a raw fish's card near a fire or a lit town
  hearth. It cooks the best fish you can, one every 1.8 s, until none are left.
  - Burn chance is 55% at the fish's level and falls to 0 thirty levels on. A lit hearth (a "range") stops burning five
    levels sooner.
  - A burnt fish is the weakest bait.
- **Meals.** **Eat** from the satchel: the meal mends 40–240 life over 12 s, one meal at a time. Potions stay the
  fight's quick sip (50+ life a second). Meals are never sold in shops.
- **Skills panel.** Firemaking and Cooking are new skills; Fishing and Woodcutting gain the world's fish and logs. All
  use the game's one curve, floor(100·(L−1)^2.2) for 1–99, then the mastery steps. The unlock rows and the eight
  titles past 99 are filled in.
- **Shops.** The General Store sells the Tinderbox. The Fishing Store buys raw fish, meals and burnt fish, and already
  sells the Root Rod, the Seam Rod and Ember Grub bait. The Woodcutting Store buys the logs.
  - Every new item's card shows **Found in / Used for**, its lore (EN + ES) and its one action.
- **Weather v1.** Each land rolls Clear, Overcast, Rain, Thunderstorm or Fog every 6 real minutes from §3.3's weights,
  per region (Ember Isle's low ground never storms).
  - An eclipse allows Clear or Overcast only. Indoors never has weather.
  - The land specials (Ashfall, Spore drift, Mist-rain) read as Overcast until S8.
  - The pip sits after the hour under the minimap.
  - **Wet** (in rain, and for 5 s after): lightning taken +25%, fire dealt and taken −15%, a cold hit freezes the Keeper
    for 1 s. A chill laid on a creature standing in the rain freezes it a moment.
  - Rain makes fish bite 25% sooner, and Old Netter Pell's line plays as you cast. Glim's first-rain line plays once
    a session.
  - Looks:
    - rain streaks in two depths (half on phones, 16 on Low);
    - splash ticks and puddles on roads (Normal only, drying 60 s after the rain);
    - fog thickens the fog bank and shrinks the clear patch round the Keeper (Low uses a flat wash);
    - a storm dims the day and flashes now and then. The flash is never above 25% white, never twice within 3 s, and
      never under reduced motion or on Soft.
  - **Menu → Settings → Weather: Full / Soft / Off.** This is a device preference. Reduced motion counts as Soft.

## Where it lives
- `shared/gathering/`:
  - `gathering.model.ts`: the logs, fish, meals, gates, bite and burn maths, the engine↔host words, and `GATHER_MEANING`;
  - `gathering.service.ts`: every write, through `SkillActionService.act` keyed by mutation id;
  - `gather-keys.ts`: these items pile 20 to a cell, so a satchel fills;
  - `gather-icons.ts` and `gathering.i18n.ts`.
- `shared/weather/weather.model.ts`: the weights, the roll, `weatherAt`, the rules. `weather-show.ts` is the setting.
- `play/td/td-gather.ts` is the runtime: loops, floats, shadows, jumps, fires and the meal.
  - `td-weather-fx.ts` draws the weather.
  - `td-world.ts` places the spots (`spotsIn`, `waterKind`), at most one per 16×16 chunk, by the chunk's roll per water.
- In `td-engine.ts`:
  - `onGather` asks the host;
  - `setWeatherClock`, `weatherView`, `setWeatherShow`, `lightFire`, `startCooking` and `eat`;
  - the fire's light in `fixedLights`, `darkFrame` and `drawLight`;
  - fog in `drawFog`;
  - Wet on `mobs.kst.wet` and `mobs.weatherWet`.
- In `td-mobs.ts`: the Wet rules in `biteKeeper`, `fireMult` and `applyStatus('chill')`. The old aura-only ×1.25 is
  removed, so it isn't applied twice.
- Host (`side-scroller`): `gathered`, `eatPicked`, `lightPicked`, `cookPicked`, `tickWeather`, `gatherSlip`, and the
  pip in the template.
- Skills: `firemaking` and `cooking` are new `DisciplineId`s and `SkillId`s (ops validator, gateway list).
  `skill-unlocks.ts` has their rows; the titles are in `skill-titles.i18n.ts`.
- Shops: `shops.model.ts` (the Tinderbox; the FISHED and WOOD buy lists; `stackWorth` reads `gatherAnchor`).
- Mirrorfin's anchor dropped 3,200 → 1,000: it is now the sea's Fishing 5 common, not a Delve rare.

## Server: the room owns the roll (needs a Hearth deploy, not done)
- `scripts/social-world.mjs`: every protocol-9 Keeper in the world hears
  `{ type: 'world-weather', window, now, lands }` when they join or their stream opens, and again each time the
  6-minute window turns.
  - The rolls come from the bundled `weatherRolls` (re-exported from `play/world/room-world.ts`) on the room's own
    clock.
  - The client (`social-room.ts` `onWorldWeather`) uses the room's window and rolls while it has heard them in the
    last 7 minutes. Otherwise it uses its own world clock: the same function, so the same sky unless the clock is
    skewed.
- Test: `scripts/social-m3.test.mjs`, "weather v1: the room owns the sky's roll".
- **Deploy:** run `world-sim-build`, then the usual Hearth deploy with all four `SOCIAL_ORIGINS` read from the live env.
  - No protocol bump: older clients ignore the new event.
  - Not deployed from this branch.
- No `functions/`, `functions-game/` or `firestore.rules` change. The new disciplines are plain keys in
  `xpByDiscipline`.

## XP credit (with m4)
Every gathering step is one keyed world action through `SkillActionService.act`, credited client-side as every skill is
today. When m4 moves XP credit to the room, these calls move behind it unchanged (each already carries a stable
`mutationId`: `td-fish:…`, `td-chop:…`, `td-fire:…`, `td-cook:…`).

## Numbers
- **economy-sim --gathering** (in `--check`): fishing and selling at each fish's own level pays 29–72% of the hunt's
  Gold a minute (Ash Perch 72%, Moonbelly 29%). Meals mend 3.3–20 life/s against a Minor Potion's 50/s. No meal sells
  back for a potion's price, and no shop sells a fish, log or meal.
- **Phone profile** (`TD_PERF=1 TD_CPU=6`, 390×844 DPR 3; new `TD_WEATHER=rain|storm|fog`): engine work per frame,
  Low, clear vs rain:

  | Scene | Clear (ms) | Rain (ms) |
  |---|---|---|
  | road | 2.53 | 2.29 |
  | town | 4.02 | 4.14 |
  | harbour | 2.85 | 2.92 |
  | dungeon (no weather) | 2.61 | 3.24 |
  | hot spot | 3.78 | 3.46 |

  Frame means, Low clear vs Low rain: road standing 16.69 vs 16.70, harbour standing 16.79 vs 17.46. Rain adds no
  measurable cost. The machine was shared with other agents' builds, so walking scenes sat near 30 ms in both columns
  (baking, not weather).

## Tests
- Karma `shared/gathering/gathering.spec.ts`:
  - the skill curve, the unlock rows, names, piles and meaning;
  - fishing gates, the night and eclipse fish;
  - the bite with rain and the jump;
  - the loop stopping on a full satchel (nothing written);
  - the burn chance (falls with level; a range burns less);
  - fire life (120 s, 60 in the rain); a meal over 12 s;
  - weather weights sum to 100; the roll is deterministic and the room's rolls agree; an eclipse hushes; the flash
    limits.
  - `hub-skills.component.spec` now lists eleven skills.
- e2e `e2e/td-gather.spec.ts`:
  - walk to a lake spot and fish until full;
  - light a fire, cook, eat;
  - the weather visible (rain, fog, a night storm);
  - a 360×640 touch path: tap the float to fish in the rain, then tap Light (≥ 44 px).
- Node: `social-m3.test.mjs` (the room's roll).

## Not done
- **S8:** thunder strikes (the 1.2 s ring, never below 10% life), the land specials, the thunder cues, Stormscale and
  Thundercake, and Odette Pryor's forecast board.
- Deep-water flavour shadows (world-acts §4.1, "too deep to reach"): only the spots have fish.
- Spot stock regrowth (fished out = 1 shadow): spots never run dry.
- Weather sounds (the rain bed), the music's warmth filter in rain, and dark-born showing by day in fog.
- Campfires are local to this Keeper: others in the room don't see them.
- Firemaking and Cooking perks are data only, like the other gathering skills' perks.
