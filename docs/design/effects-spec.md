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

## Order
1. Auras (this spec's first pass) — done. 2. Spells — done. 3. Loot — done. 4. Monsters' tells and bosses — done.
Each step screenshot-checked (e2e/td-fx-shots.spec.ts, e2e/td-fx2-shots.spec.ts → docs/handoff/cozy-ui/fx-*.jpg).
