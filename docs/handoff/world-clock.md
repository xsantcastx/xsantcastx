# World clock — day, night, the eclipse, and the Slate as a phone

2026-10-15. Owner: *"the mirror slate could use some UI like if it was the phone, show the in-game time, we should have
day and night as well, or eclipse events."* Lore: [`docs/world/lore-addendum.md`](../world/lore-addendum.md), "Day,
night and the eclipse" (shipped — owner reviews in play). Screenshots: `docs/handoff/world-clock/*.png` (copied from
`output/world-clock/`, the e2e run).

## Decisions

- **One in-game day = 24 real minutes** (1 real second = 1 in-game minute; 1 real minute = 1 hour). A 20–40 minute
  session lives through a whole day *and* a whole night; the night (20:00–05:00) is nine real minutes, long enough to
  walk to a hunting ground for a Moonwake Bloom, short enough that nobody waits for it; Terraria's day (the owner's
  reference) is the same 24 minutes; and "a minute is an hour" is arithmetic a player does in their head.
- **Deterministic from real time.** Everything is a pure function of epoch milliseconds (`world-clock.model.ts`): no
  local time, no time zone, no DST, nothing saved, nothing to drift. Every device and every player read the same hour
  and the same eclipse. Epoch: 2026-01-01 00:00 UTC = Year 1, 1 Emberwane, Forgeday, 00:00.
- **Calendar.** A week of seven days (Forgeday, Lightday, Inkday, Starday, Rootday, Hearthday, Moonday), five months
  of fourteen days, one per realm (Emberwane, Brightmere, Inkfall, Starturn, Rootwake): a 70-day year (28 real hours).
  14 and 70 are whole weeks, so every month starts on a Forgeday and the Slate's calendar is a clean 2 × 7 grid.
- **Phases.** Dawn 05–07, day 07–18, dusk 18–20, night 20–05; a smooth daylight curve and a dawn/dusk gold.
- **Eclipses.** Every fifth in-game day from day 2 (two real hours apart), 10:00–18:00 (eight real minutes), the dark
  ramping in and out over 45 in-game minutes. Each one is aligned with a realm in turn (Infernal → Luminous → Umbral →
  Celestial → Verdant). Announced on the message line 12 in-game hours ahead and within the last hour; counted down on
  the Slate always.
- **Real-world resets stay real.** Pim's bounties, the quest board, the Banked Furnace once-a-day, pets' meals, the
  Ledger Catch: all still turn over at the player's local midnight. The night-owl easter egg still reads the real
  hour. Only the *world's* time moved to the clock: the ambience (was local 20:00–06:00), fishing's night (Glowcap
  bait, the Drowned Lamp — was local 20:00–06:00) and everything new.

## What a player gets

- **The sky turns.** Every town and hunting ground: a tint per realm and phase over the backdrop (dawn gold, dusk
  ember, night blue, eclipse violet), pixel stars and the cracked moon mirror at night, the eclipse's black disc with
  the mirror's four-spiked flare breathing round it. The world itself sits in a lighter shade of the dark; the hanging
  lanterns, every stall and the Keeper's own lantern light up. The Delve is the same at every hour underground; only
  the strip of sky above its surface (and up its shafts) follows.
- **Things that keep the dark** (night, or the night at noon an eclipse makes): the **Moonwake Bloom** in the Ember
  Quarry, the Unrecorded Corridors, the Orrery Rings and the Rootglass Thicket (Sickle I, Foraging 1; by day a shut
  bud that says "OPENS AT NIGHT"); the **Mirrorfin** in the seeps and the Grotto Mere (rarer without, far likelier on
  Moonwake bait, which goes on the hook first in the dark); the **Ink Lantern** drifting the Corridors (it rises when
  the dark comes and its idle ones fade with the dawn).
- **The eclipse.** The sky goes dark at noon, the moon mirror flares; an **Eclipse Glass** outcrop rises in every
  hunting ground (any pickaxe), two to a cut in the aligned realm's; **Afterimage Moths** rise in the Reflection
  Channels and drop it; a rift shrine first touched under it pays double Delving XP, shows twice as far and leaves a
  sliver of glass; the night things wake. Birds stop, chimes ring, the score goes minor over a drone. Glim says so.
- **Sera Quill's Eclipse Ledger** (the reward track): every eclipse you are in the world for is written down once (an
  observation pays 100 s of income); marks at 1, 3, 5, 8 observations pay 10–20 min of income and 2/3/4/6 Eclipse
  Glass. Nothing expires; a missed eclipse is never a loss: the next one counts the same.
- **Uses.** Moonwake: bait (the Mirrorfin's), three press into Lampfish Oil, the Star Owlet eats it. Mirrorfin: two
  Lampfish Oil, the Ink Pup and the Shade-kit eat it. Eclipse Glass + bark: eight Eclipse torches.
- **People notice the hour** (lines said first while it is that hour): Tomas at night, Sera under the eclipse (the
  ledger), Rook at night, the Arena gatekeeper at dawn, the Trials Warden under the eclipse (merged around Act II's
  new lines: every keeper stays within 4–8 lines). Glim at
  nightfall, the eclipse and dawn (once Glim is met).
- **The Slate is a phone** (the Archive's moon-mirror glass): a status bar (realm, time, sky); the lock clock big
  (time, "Lightday, 2 Emberwane", the sky's pixel icon and name; "underground: the sky goes on above" in a Delve); a
  **next eclipse** widget counting down (or "Eclipse now · ends in…", aligned realm) that opens the Eclipse app; a
  **now playing** widget (the realm's theme by name and how the score hears the world — by day / by night /
  underground / a guardian near / under the eclipse) with **next phrase** and **mute**; the **app grid** with pixel
  icons and notification dots (Lune's four tables, Homestead, Map & bounties at tier II, Scan, Pets, Codex, Eclipse);
  **page dots** (page 2: this month's calendar with eclipse days marked, and Sera's ledger; swipe or tap); a **dock**
  (Homestead, Scan, Eclipse, Codex). One tap opens an app, Back returns home, every face's bar carries the time.
  Pets and the Codex are places of their own: the Slate asks the play view, which folds the Slate and opens them.
  Portrait by default (a phone in the hand, centred on desktop); a short landscape phone gets two columns.

## How it works

| File | What |
|---|---|
| `shared/world-clock/world-clock.model.ts` | the clock: `worldTime`, `phaseAt`, `daylight`, `sunGlow`, `isEclipseDay`, `eclipseRealm`, `eclipseAt`, `nextEclipse`, `eclipseDepth`, `skyAt`, `clockText`, `worldSpan`, `msAt`. Pure, no imports. |
| `shared/world-clock/world-clock.service.ts` | Angular reader (`now/time/sky/eclipse/nextEclipse/dark`) and the test hook `window.__eclipseClock` (`skew`, `to(day, minute)`, `toEclipse(minute?)`, `reset`), only under automation or a dev build; the skew lives in sessionStorage (`eclipse-clock-skew`), never in the save |
| `shared/world-clock/eclipse.model.ts` | `CLOCK_ITEMS` (Moonwake, Mirrorfin, Eclipse Glass: found in / sources / uses / lore — read by found-in and check-meaning), `OBSERVATION`, `LEDGER_MARKS`, `ECLIPSE_EFFECTS`, `ECLIPSE_SHRINE`, `ALIGNED_GLASS`, `REALM_HUNT` |
| `shared/world-clock/eclipse-save.model.ts` + `eclipse.service.ts` | blob `godforge-eclipse` (synced `progress/eclipse`): `seen` (eclipse ids = their in-game day; the receipt, written first), `older`, `marks`; union/max merge. `witness` pays the observation and new marks once; `catchUp` pays marks a merge crossed |
| `shared/world-clock/world-clock.i18n.ts`, `clock-icons.ts` | every word EN + ES (lazy); 16 × 16 pixel icons for the three items |
| `play/engine/sky-light.ts` | `SkyLight`: colour strings rebuilt only when the light moves a visible step; `drawSky` (tint, stars, moon / eclipse sprites baked once), `drawShade` (one fillRect), `drawLamp` (a baked glow; `lighter` on full tier, plain alpha on lite) |
| `play/engine/engine.ts` | `setSky(EngineSky)`: tint + lamps, opens/shuts `when` nodes (`areaSites` → `sites`), raises/fades `when` creatures, doubles the aligned glass, widens an eclipse shrine (`onDiscover … eclipse`); state `timed`, `gather.shut` |
| `play/world/clock-nodes.ts` | `moonwakeNode(x)`, `eclipseGlassNode(x)`, `INK_LANTERN`, `AFTERIMAGE_MOTH` (+ `AFTERIMAGE_DROPS`); the town files spread them into their hunts; `GatherNodeDef.when` / `MonsterDef.when` (`world.model.ts`) |
| `play/side-scroller.component.ts` | `tickClock` on the 200 ms HUD timer, working once per world minute: `setSky`, `data-sky` / `data-world-time` / `data-world-day` (and `data-timed` from state), announcements, Glim lines, the ledger's `witness`; keepers' `hour`; the sound scene's hour + eclipse; the eclipse shrine; `slateLaunch` (Pets, Codex) |
| `play/world/keeper-lines.ts` | `KeeperLine.hour` / `KeeperContext.hour`: an hour line is open only at its hour and said first |
| `shared/sound/*` | `SoundScene.eclipse`, `scoreHour`, `paletteFor(realm, mode, hour)` (night: an octave down, sparser; eclipse: minor + drone), eclipse ambience; `SoundService.skip()` / `nowScene` |
| `shared/fishing/*` | `CatchDef.when: 'dark'` (the Mirrorfin's own share), `CatchContext.dark/moonBait`, `bestBait(…, dark)`; `FishingService.isNight()` = the world clock (`dark`, replaceable in tests) |
| `shared/slate/*` | the phone face (`slate.component.*`), `slate-app-icons.ts` (pixel app + sky icons), `SlateService.launch$` |
| `scripts/economy-sim.mjs --eclipse` | in `--check`: a real day of eclipses (12) all witnessed ≤ 20 min of income; each mark in the daily band; marks ≤ 90 min once (65) |

**Perf.** Nothing new runs per frame except: one fillRect of tint (+ ≤ 36 star rects + one sprite) under the world,
one fillRect of shade over it, and ≤ ~10 cached glow blits at night. No gradient or string is built per frame; the
sky's strings change at most once a real second and only on a visible step. The clock tick allocates one small sky
object a second. The Slate ticks its face once a second outside Angular while it is open.

**Meaning.** `check:meaning` clean and the baseline is now empty: the Ink Lantern and the Afterimage Moth were in the
Bestiary but never in the world (`never-spawns`), and now spawn at their hour.

## Tests

- Karma `shared/world-clock/world-clock.spec.ts`: the epoch, a second = a minute, the week/month/year, **time-zone
  and DST proof** (the same instant through four offsets, an hour across a DST change), negative days; phases and the
  light curve; the eclipse schedule (days, realms, windows, deterministic `nextEclipse` from 50 instants, depth);
  the items (names, icons, EN/ES lore, sources/uses/found in), nodes and creatures in the hunts; the Mirrorfin's
  table (dark only, bait); keeper hour lines; the score and ambience by hour; the save merge/cap; the service through
  the gateway (once, reload, skipped eclipses cost nothing, merge + catchUp).
- Node `scripts/seamworks-engine.test.cjs`: the Moonwake shut by day / open at night / cut; the eclipse outcrop absent
  by day, present under the eclipse, two a cut when aligned; the Ink Lantern rising and fading; the Moth only under
  an eclipse. Updated: the cue test accepts "OPENS AT NIGHT" and skips eclipse-only nodes; the Court's hunt counts
  its own creature.
- e2e `e2e/play-world-clock.spec.ts` (1280×800 keys, 390×844 touch): the Slate's phone face shows 12:0x, Lightday,
  Day and the countdown (44 px targets), page 2's calendar and ledger; the Thicket's Moonwake shut by day; dusk; night
  opens it and it is cut; `toEclipse` darkens the sky, raises the glass, the ledger writes it down once (mark 1 + 2
  glass) and the outcrop is mined; the Slate reads "Eclipse now" and the Eclipse app lists the ledger and six effects;
  a reload keeps the eclipse and pays nothing twice.

## Not done / next

- The town backdrops' painted windows are not lit (the hanging lanterns, stalls and the Keeper's lantern are). A
  window mask per pixel-parallax layer would do it.
- No in-HUD clock outside the Slate (the Slate is the phone; a tiny HUD clock is an easy add if the owner wants one).
- The Pets app has no notification dot (no "hungry" signal exists yet).
- A player who changes the device clock moves their own sky (the world is real time by design); eclipse rewards are
  receipt-keyed per eclipse, so this is no worse than any other real-time game.
- Real art: the moon, the eclipse disc, the app icons and the two creatures are procedural pixel art.
