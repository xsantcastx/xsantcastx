# Handoff: World feel — the sound of the world, catch & craft (2026-10-15)

Owner: *"we are also missing sounds ambience noise music that peaceful stuff that minecraft has"* and *"when fishing,
where are the fish? … when crafting, where do the items go?"*. Roadmap item 6.

## What a player gets

| | |
|---|---|
| **A score** | Sparse, peaceful generative music per realm (C418-style): a phrase of 2–8 soft notes, then a long silence (6–30 s), then another. Each realm keeps its own mode, register and voice. The Delve plays the same realm lower, quieter and further apart; a guardian near (`once` creature) turns the third minor and lays a low, soft drone under it. |
| **Glim hums** | With Glim met, about one phrase in three is answered: Glim hums its last notes back an octave up, with a little vibrato (lore below). |
| **Ambience** | Town: wind, far-off murmur, birds by day / crickets by night (20:00–05:59 local), Luminous and Celestial chimes, Verdant leaves. Delve: cave drips with an echo, a distant rumble (louder near a guardian). Near water: lapping; near lava: hiss and crackle; near ink: the ink tide's deep swell. |
| **Effects** | Footsteps by what is underfoot (stone, earth, wood, ore, crystal, metal, grass; a town street by realm), landing, dig and break by material (ore rings as it comes free), a clang on a refused block, the pickup blip (a quick run climbs a little scale), coin, the craft chime, equip, cast / bite plop / reel ratchet / splash / catch, the portal shimmer (Waystone travel, Rift Gates), panel open/close, and a soft tick under every HUD button. The level-up ding, station chimes and rarity stingers are the older services; the world's Effects slider (0) and Mute all quiet them while the world is open. |
| **Menu → Sound** | Music / Ambience / Effects sliders + Mute all. Saved per player through the save gateway (`godforge-sound`, synced `progress/sound`, later edit wins), so it is the same on every device. First visit is quiet (35 / 40 / 50 %). Nothing sounds until the first tap or key in the world (autoplay rules; the iOS unlock is a silent buffer in that gesture). A hidden tab pauses everything. |
| **Fish you can see** | Every deep water body shows dark pixel fish shadows slipping about under the surface (one home in ~9 deep cells; never the surface row or a puddle; none in lava or ink). Near a cast line, one in three, and they drift toward the bob; on the bite the nearest darts to it, and pixel ripples ring out from the bob. |
| **The catch** | The landed fish arcs out of the water into the Keeper (silver, flipping, droplets), "+1 Blindfin" rises where it lands, a splash and a two-note chime, and the Satchel button pulses. The catch banner carries the fish's picture. |
| **Pickups** | Every "+N item" banner floats up out of its slot with the item's picture (stacked, three at most, 1.8 s), the Satchel pulses, a blip sounds. |
| **Crafting** | The made thing pops up over the bench's reward card in a framed pixel tile with four sparkles, then flies to the Satchel; a toast says **"Crafted Pickaxe I — in your Satchel"** with one **Open** (44 px) that closes the bench and opens the Satchel on it. A craft made under a panel pulses the Satchel when the panel closes. |

All reduced-motion safe: no flights, no arcs (the label still rises), fish rest still at home, ripples off, no pulse
animation (the count still ticks).

## Files

| File | What |
|---|---|
| `shared/sound/sound-settings.model.ts` | The blob: levels, mute, quiet defaults, coerce, merge (eager-safe, no imports). |
| `shared/sound/sound-palette.ts` | **The tuning table.** Realm → score (`BASE`), Delve/boss variants (`paletteFor`), the phrase composer, ambience beds per realm and time (`TOWN_BEDS`, `ambienceFor`), node id → material (`materialOf`). Pure. |
| `shared/sound/sound-director.ts` | The Web Audio graph (lazy chunk): voices, beds, cues. |
| `shared/sound/sound.service.ts` | Settings through the gateway; arms on the world, unlocks on the first gesture, imports the director, pauses on a hidden tab. Every director call runs outside Angular. |
| `shared/sound/sound-sheet.component.ts` | Menu → Sound. |
| `shared/sound/world-feel.bus.ts` | The bench says what it made; the world flies it. |
| `shared/sound/sound.i18n.ts` | EN + ES (lazy). |
| `play/engine/fish-shadows.ts` | Where the fish are (pure placement + pixel draw). |
| `play/engine/engine.ts` | `onSfx` cues (step, land, dig, break, clang, splash, cast, bite, catch), `state.boss` / `state.near` / `state.fishShadows`, bite ripples, the catch arc (`landFish(recastIn, label)`), `keeperScreen()`. |
| `play/side-scroller.component.*` | Scene → sound, `gotItem` (banner + pulse + blip), the craft fly + toast, Menu → Sound, the canvas's `data-fish-shadows`. |

## Tuning a realm's music

Everything is one row in `BASE` (`sound-palette.ts`):

- `root` (MIDI) and `scale` (semitones): the key and mode. Dorian = warm with a lift, Lydian = bright, Aeolian =
  sad and low, pentatonic = can never sound wrong (airy), Ionian = plain and folk-like.
- `lead` / `under`: the voices (`piano` felt-hammer, `bell` glass, `marimba` wood, `pluck` string, `flute` breath,
  `pad` two detuned saws, slow). Add a voice in `SoundDirector.voice()`.
- `beat` (s per beat), `notes` [min, max] per phrase, `rest` [min, max] seconds of silence after it — **the silence
  is the style**; shorten it and it stops sounding like Minecraft.
- `span` (scale degrees the melody may wander), `bright` (lowpass Hz: warmth ↔ air), `space` (reverb send),
  `level` (loudness here before the slider), `chord` (chance of a held chord under a phrase).
- Delve / boss are derived in `paletteFor`; change the multipliers there, not per realm.
- Ambience: `TOWN_BEDS` per realm (0..1 each), `BED_VOLUME` in the director (the absolute ceiling per bed).
- The specs (`sound.spec.ts`) pin the *shape* (Luminous brighter than Infernal, Umbral lower and sparser, the
  Delve quieter, a boss drone), not the numbers, so tuning does not break them unless it inverts a character.

## Perf

Nothing runs on the render loop. The score and the event beds (birds, crickets, drips, chimes, crackle) are
setTimeout clocks (~4 Hz) started outside Angular; the continuous beds are looped noise buffers modulated by
oscillators (no JS per sample or frame); a cue is a handful of nodes that stop themselves; repeated cues are
rate-limited (`CUE_GAP`). The engine's only per-frame addition is the fish scan over visible cells (a hash per cell,
capped at 24 fish, 10 on the lite tier) and the ripples/arc (a few rects). `liquidsNear` samples 45 cells at the
10 Hz report rate. The director is a lazy chunk fetched on the first tap; the eager bundle gains only the settings
merge.

## Lore

**Glim hums** (shipped — owner reviews in play): the Margin-Light remembers every tune sung in the margins of the
realms. When the realm plays, Glim sometimes hums the end of the phrase back — an octave up, slightly wavering, as
if it is not sure it is allowed to. Logged in `docs/world/lore-addendum.md`.

## Tests

- Unit: `shared/sound/sound.spec.ts` (quiet defaults, coerce/merge, the cloud registry, realm → palette, Delve and
  boss variants, phrases in scale and deterministic, ambience by realm/time/place, materials, the service saving
  through the gateway, rehydrate, waiting for the first tap), `play/engine/fish-shadows.spec.ts`.
- E2E `e2e/play-world-feel.spec.ts` (1280×800 keys, 390×844 touch): sliders + mute persist across a reload; the
  Grotto Mere shows fish; a craft shows the toast, the icon flies, Open shows the pickaxe in the Satchel and the
  clasp pulsed.

## Not done / next

- No footsteps on the town's painted props (a town street has one material per realm).
- Lava fish are not drawn (lava is opaque); a magma glint could show them.
- The older audio services (forge, rarity, level-up, celebration) keep their own AudioContexts; folding them into
  the director's effects bus would let one slider own everything.
- Music does not yet change by time of day (night could drop the lead an octave).
