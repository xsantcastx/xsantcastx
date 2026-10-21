# Effects — the visual spec (auras, spells, hits, loot)

Owner, 2026-10-20: "auras should be more nice … design stuff, then later on fix everything and make it real nice".
This is the design. Every aura, spell, hit and loot effect follows it, and a polish pass applies it everywhere at
once. Code: `src/app/play/td/td-engine.ts` (`drawEffects`), `td-mobs.ts` (effects, bolts, shots, spears).

## Rules (all effects)
1. **Pixel only.** Every effect is whole art pixels on the tile grid (1 art px = 1 tile/16). No smooth strokes
   or arcs (`ellipse`/`stroke` today in the nova wave and the ward break this): rings are drawn as dithered pixel
   dashes, glows as stepped squares (a 3-step falloff), never blurs.
2. **One palette per element**, three tones each (core · body · edge) plus a white-hot spark:
   | Element | Core | Body | Edge | Used by |
   |---|---|---|---|---|
   | Ember / fire | `#fff2a8` | `#ffb347` | `#e2552a` | Ember Bolt, Hellfire Nova, Aura of Embers, drake and Firecaller shots |
   | Shadow / curse | `#f0e0ff` | `#b06bff` | `#6b3aa0` | Ember Curse, Dark Ward, Raise Skeleton, minions' eyes |
   | Life / siphon | `#e6ffe9` | `#7fe08a` | `#3f8f4a` | Drain Life, Aura of Siphoning, heals |
   | Bone | `#ffffff` | `#e8e1cf` | `#a89f8a` | Bone Spear, bone arrows, the Ashbone Dragon |
   | Cold (future) | `#ffffff` | `#9fd8ff` | `#3f78b5` | wraiths' blows |
   An ally's effect may carry its caster's element; a foe's always has a dark edge (`#140c1c` outline pixel) so it
   reads as hostile.
3. **Layers.** *Ground* effects (aura rings, nova waves, sigils) draw under creatures and the Keeper; *air* effects
   (bolts, motes, hits, numbers) draw over them. A ground effect never paints over a creature's body.
4. **Budget — never hide a fight.** At most 40 effect pixels-groups alive round the Keeper; anything over a creature
   is ≤ 60% opaque; an aura's motes are ≤ 10 alive at once. Bosses' tells (a breath about to come) win over the
   Keeper's own flourishes.
5. **Timing.** Casts read in 0.15 s (a flash at the staff), travel in flight time, and resolve in 0.25–0.4 s (a burst
   of 6–10 pixels flying out then falling). Nothing lingers past 1 s except auras and wards.
6. **Reduced motion.** The same shapes, no travel: rings drawn still, motes fixed, bursts a single frame. Never "no
   effect" — the player must still see that a spell went off.

## Auras (the first pass)
An aura is a place, not a sparkle: the ground round the Keeper changes while it runs.
- **Ground ring** at the aura's radius: a dithered dash circle (every other pixel, two tones alternating), turning
  slowly (one full turn in ~12 s); a second, fainter ring at 60% radius turning the other way.
- **Floor tint**: inside the ring, a stepped disc of the element's edge tone at 10–12% opacity (three steps), so
  the area reads as claimed.
- **Motes**: 6–10 element pixels. *Embers* rise from the ground inside the ring, flicker, die at ~18 px up.
  *Siphoning* flows inward — motes spawn at foes inside the ring and drift to the Keeper's chest.
- **Pulse on use**: each time the aura does its work (Embers burns a foe, Siphoning heals), a short bright arc of
  the ring flashes at that foe's side (0.2 s).
- **HUD**: the running aura's icon sits on the portrait's corner (desktop) / beside the orbs (phone).

## Spells (second pass)
- *Ember Bolt*: violet halo, ember core, a 3-pixel trail that fades in steps; on hit, an 8-pixel ember burst.
- *Hellfire Nova*: a pixel ring (not a stroke) expanding to 3 tiles, two tones, leaving scorched dither for 0.5 s.
- *Drain Life*: the red thread stays; beads run to the Keeper and burst green on arrival.
- *Dark Ward*: a hex of violet pixels round the Keeper (6 points), turning; it cracks (pixels falling) as it absorbs.
- *Raise Skeleton*: a violet sigil on the ground (0.4 s), bones knitting up out of it.
- *Bone Spear*: keep; add a white flash at the release and bone chips at each pierce.

## Loot (third pass — done 2026-10-20)
Drop beams and ground glints follow the item rarity ladder (`--cozy-loot-*`, docs/design/loot-and-combat.md §2),
pixel columns with stepped falloff, the rarer the taller; legendary and up get a slow rising mote column.
As built (`td-fx.ts` `LOOT`, `lootBeam`, `beamSteps`, `beamMotes`, `groundRing`; `td-engine.ts` `drawDrop`):
- **Tones**: each rung's body is its cozy token (common `#d8d2c2` · uncommon `#6fd36a` · rare `#5aa8ff` · epic
  `#b46bff` · legendary `#ff9a3c` · mythic `#ffd25a`; singular keeps the ladder's `#ff6dd7`), with a paler core and
  a deeper edge. The drop's name plate and the name that floats up on pick-up use the body.
- **Column**: common none (a four-point glint on its own beat); uncommon 10 px, rare 18, epic 28, legendary 38,
  mythic 44, singular 48. Five pixels wide (edge halo · body · one-pixel core), in up to three bands, each 60% of
  the one under it; the brightest band is 55% (it may stand over a creature). A gentle pulse (still under reduced
  motion). Legendary 3, mythic 4, singular 5 motes climb it, one climb per 3 s.
- **Ground ring** (ground layer): a flattened dithered ring, 4–8 px by rung, two tones, breathing ±1 px.
- **Light**: in the dark every piece is its own light, the rarer the further it reaches.
- **Pops**: as gear lands, a flash, a flat ring running out and 12 pixels thrown up and falling (0.4 s); as it is
  taken, the pixels gather up toward the satchel (0.45 s). Reduced motion: one still frame of each.

## Bosses' tells (fourth pass — done 2026-10-20)
A boss with a ranged attack (the Ashbone Dragon's breath, the Cinder Sovereign's) winds up for `BOSS_TELL` = 0.6 s
before it looses (`td-mobs.ts`; numbers in docs/design/loot-and-combat.md §10):
- **Ground warning**: a pixel cone from the boss toward where the prey stood, as wide as the breath's fan; ember edge
  tone, outlined in the hostile dark, its dither pulsing; a two-tone front runs from the boss to the cone's far
  edge in the 0.6 s — when it arrives, the breath leaves. Ground layer: under every creature.
- **The boss**: a stepped ember glow gathering at its jaws (≤ 60% over its body); the jaws and the cone light the dark.
- **Summons** (a boss's call at half life): a hostile ember sigil — a flat ring and a turning three-point mark
  closing in — where each creature will stand, for `CALL_TELL` = 0.6 s; then it climbs out in a burst.
- The Glass Sentinel's single shot and the Magma Tyrant / Anvil-Warden's bites stay untold (no big attack to read).

## The eclipse (2026-10-21)
- **Eclipse-touched** (`td-elite-fx.ts`): a ring of eclipse-dark pixels (`#140c1c`, 55%) round the body's middle, a
  dithered pale corona (`#f0e0ff`) one pixel outside it, four violet flares (`#b06bff`, dark-edged) turning slowly on the
  rim; the body tinted dusk-violet (`#6b3aa0`, 30%). Reduced motion: the same ring, the flares still.
- **The sky**: under an eclipse the darkness pass is violet, not the night's blue, deepening with the eclipse.

## The night (2026-10-21, `td-night.ts`, `td-engine.ts` drawLight / drawNightEyes)
- **The pass**: one colour over the world, never pure black. Night `#100e2c` at 86%, the eclipse `#220c3a` at 93%
  (blended in by its depth), a dark floor `#0a081a` at 90% at any hour. Outdoors its opacity is tone × max(darkness,
  eclipse depth), darkness being 1 − the clock's daylight, so dusk (18–20) and dawn (05–07) slide; noon is clear.
- **Lights are holes with stepped pixel falloff**: a clear core to 45% of the radius, then 80% and 50% steps, then a
  dithered rim (30% / 8% on the world's checker) — three steps, no blur. The Keeper's own light is 56 art px (3.5
  tiles), Glim's 64 in the open (112 / 150 below ground), hearths 90, a light pet 84, the lantern 46.
- **Warm wash**: lamps, windows, hearths, the lantern and beacons lay stepped Hearth-palette bands inside their light
  (`#ffd27a` heart, `#ffb347` body; 26% · 17% · 9%), so a town at midnight is a warm island.
- **The buffer**: one buffer pixel = 2×2 art pixels, its origin on an even art pixel (the steps and the dither never
  crawl as the camera moves), hole sprites cached per radius and never scaled, scaled up once with pixelated sampling.
- **Fair fights**: a creature past the light is a faint `#4a4480` silhouette (≤ 28%) with its own eye colour lit one
  pixel per eye (found in its sprite, `findEyes`), fading as a light reaches it. HP bars and names are drawn after the
  pass; the HUD is DOM and is never darkened.
- **Night darkness** (Menu → Sound, saved with the Hush): Softer drops the pass to 72% / 80% / 78%.
- Reduced motion: no flicker (an omen dims every light once, then holds); the falloff is static.

## The dark-born (2026-10-21, `td-dark-layer.ts`)
- Drawn **over** the night pass (they are what only the dark shows), in the shadow palette with the hostile dark: a shape
  is 12×22 px of `#140c1c` with a `#6b3aa0` rim at 35% and two `#f0e0ff` eye pixels, its foot dithering into the floor;
  prints are 2-px `#e8e1cf` pairs at 42%; a shy chest is dark wood with violet bands and a dithered violet ring; an open
  Nightroad shows pale `#f0e0ff` nail pixels at its plank corners so it reads across the water.
- Budget: ≤ 2 shapes, ≤ 12 prints, one whisper line. Whispers are 7-px pixel text, cream over an ink drop-shadow.
- The Hush's deepest band dithers the screen edge inward 2 art pixels (≤ 54% ink).
- Reduced motion: shapes fade where they stand (no stepping back), the whisper holds still, the road appears at once,
  the edge dither and the HUD band's omen hold still.

## The Ashguard (2026-10-21, `td-ashguard-fx.ts`)
Two palettes join rule 2 for the second vocation (design-bible §4.4); the blade's fire stays the shipped Ember.
| Element | Core | Body | Edge | Used by |
|---|---|---|---|---|
| Brass (the Pyre Watch's oaths) | `#fff2c8` | `#e0b25a` | `#8a6a2a` | a plain swing's arc, Shield Bash, Shield Oath, Watch Cry, the Vow, the Watchfire ring |
| Ash (endurance) | `#efe6dc` | `#a89a90` | `#5e5450` | Ash Stride's afterimages and dust |
- **The swing** (air, ≤ 60% over a body): a three-ring pixel crescent at the blade's reach, sweeping across its arc in
  the first 60% of 0.24 s with three white-hot pixels at the leading edge; brass for a plain swing, ember while the Ember
  Brand burns or the blow is fire (Cinder Cleave's 160° arc, the Whirl's full ring each half second). Each foe struck
  gets the shipped slash strokes — the hit tell.
- **Ember Brand**: an ember burst at the hand and a short climb of fire up the steel; while it burns, three ember pixels
  climb the blade. **Shield Bash**: a brass flash and burst on the struck foe, impact lines thrown back; the stunned wear
  three brass stars circling over the head (the CC pip). **Shield Oath**: a dashed brass square rim springs out round the
  Keeper and stays (its dashes running) while the oath holds; a blocked blow flashes the rim and floats a brass "0".
- **Watch Cry** (ground): a ring of brass dashes running out to the cry's reach; each taunted creature wears a brass
  "!" edged in the hostile dark. **Ash Stride**: three ash afterimages along the charge, dust where it began.
- **Vow of the Last Watch**: a brass bell over the head tolls once (it swings) and a brass ring runs out at the feet;
  while the vow holds, brass corners frame the Keeper. **Watchfire** (aura): the aura rules' ring and floor in brass.
- Reduced motion: the crescent is drawn whole, the ring at its full reach, the bell and the stars still.

## The Lanternwright (2026-10-21, `td-lantern-fx.ts`)
Three palettes join rule 2 for the third vocation (design-bible §4.3 asked to reuse the level-up light for the Lamp).
| Element | Core | Body | Edge | Used by |
|---|---|---|---|---|
| Lamp (the lamp-keepers' light) | `#fffbe8` | `#ffd27a` | `#c99a3e` | Kindle's flare, Blinding Flash, Banish, the Lantern Ward, Last Light, the dawn |
| Hearth (the warm stones' fire) | `#fff2c8` | `#ffb347` | `#8a5a34` | Hearthlight's glow, the Hearth Circle's fire |
| Moth (the kin's pale wings) | `#fffbe8` | `#e8dcc0` | `#8a6a3a` | the Lamp-Wisp, the wisp's call |
- **Kindle** (air): a cream mote with a stepped brass tail and a white heart; a small cream burst where it lands (≤ 60%
  over a body). The wisps' and the beacon's motes are the same flare.
- **Blinding Flash**: a white-hot square at the lantern and eight rays thrown out (air), a cream ring running out on the
  floor (ground); the stunned wear three cream stars over the head. **Banish**: a white-hot column three pixels wide on
  the foe, its pixels falling up.
- **Hearthlight**: warm stepped squares rising from the feet and a pale green cross. **Hearth Circle** (ground, lasts):
  a faint warm floor, grey stones round the rim, a small campfire whose flame steps between two heights.
- **Lantern Ward** (lasts): a dashed brass frame with a lit lamp at each corner; it breaks in a cream burst and a ring.
  **Last Light**: a cream flare and a rising ring; while untouchable, cream corners frame the Keeper.
- **Lamp-Wisp** (lasts): a pale moth round a little lamp, two-frame wings, circling the shoulders. **Beacon** (y-sorted,
  lasts): a dark pole, a brass cap, a lantern that breathes.
- **Dawn at Noon** (ground, lasts): the disc steps up to near-white at its core (three stepped discs), a sun-ring of twelve
  brass-and-cream pixels turns at its rim, and the night pass is opened over the whole disc (it is day inside).
- **The lantern itself**: the lamp-staff's glass is cream with a white heart; at night it is its own light (a hole in the
  night pass and a warm glow) unless shuttered — the shutters swing shut over it as two dark slats.
- Reduced motion: the rings drawn at full reach, the column and the motes still, the wings not beating.

## The Thornstrider (2026-10-21, `td-thorn-fx.ts`)
Three palettes join rule 2 for the fourth vocation (design-bible §4.5 asked for Life tones with a rot edge; the bow and
the briar wanted their own green and bark, the beasts the Verdant's rootglass light, which already ships in td-mobs).
| Element | Core | Body | Edge | Used by |
|---|---|---|---|---|
| Thorn (the bow's green) | `#e8f5b0` | `#8fc25a` | `#4a6b2a` | an arrow's tip, its hit tell, the bow's twang |
| Wild (the beasts' spirit light) | `#f0fff8` | `#9af0d0` | `#4cb898` | the spirit beast, a called beast, the Stampede, Pack Bond's ring and thread |
| Briar (bark and thorn) | `#c9a66b` | `#7a5a32` | `#3e2a18` | the Thornroot Snare, a Bramble Trap, the roots at a rooted creature's feet |
| Blood (a barb's bleed) | `#f08070` | `#c43a3a` | `#6a1a1a` | Barbed Shot's drops, a bleeding creature's pip |
- **Thorn Shot** (air): an arrow in flight — a pale-green tip, a bark shaft, a pale nock, a green fletch either side of the
  tail and a dark line under it so it reads on grass and stone. It strikes with splinters thrown back along the flight
  and a white pixel where it bit (≤ 60% over a body); the creature is knocked a quarter tile back (a boss a fifth of it).
  The bow's twang is three pale pixels of string snapping back. **Volley**: five (+) of the same arrows in a fan.
- **Barbed Shot**: the same arrow; the barb leaves blood drops falling and a red pip by the creature while it bleeds.
- **Command** (lasts while sent): a green chevron over the sent-at foe, bobbing; the beast runs to it.
- **Pack Bond** (aura): the floor ring in the wild's tones; while the beast is near, a dotted thread of spirit light runs
  from the Keeper to it.
- **The spirit beast** (y-sorted, lasts): a fox-wolf of rootglass light (td-pet-art `spiritBeast`), drawn as a pet. A
  **called beast** and the **Stampede** are its kin, drawn half-seen (78% / 62%) with a mint shadow; the stampede raises
  hoof-dust behind it; a beast steps in and out of the green in a spiral of leaf pixels.
- **Thornroot Snare** (ground, lasts): one clump a tile — thorned roots out of torn earth, their tips stepping between
  two heights; rising, they push up two steps. A rooted creature wears a fringe of thorns at its feet.
- **Bramble Trap** (ground, lasts): a closed jaw of bramble on a dark mat, a faint ring of its reach; springing, a ring of
  thorns snaps out to it. Leaves settle over it as it is hidden. **Rootwalk**: moss filling in the footprints behind.
- **The look**: a moss-green hood, a bark-brown leather coat, wrapped hands, the hunting bow (the kit weapon, the
  painter's own `bow`) and a leather quiver on the back with three green fletchings over the shoulder — on the back from
  behind, peeking past the hood from the front, behind the head from the side.
- Reduced motion: the arrows and the beasts still move (they are the game), but every burst is one still frame, the
  thorns stand at full height, the thread does not crawl.

## Order
1. Auras (this spec's first pass) — done. 2. Spells — done. 3. Loot — done. 4. Monsters' tells and bosses — done.
Each step screenshot-checked (e2e/td-fx-shots.spec.ts, e2e/td-fx2-shots.spec.ts → docs/handoff/cozy-ui/fx-*.jpg).
