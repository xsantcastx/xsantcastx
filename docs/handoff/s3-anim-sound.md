# S3: an animation and a sound for every attack (handoff)
Built 2026-10-26 on branch `s5` (with S5). Design: `docs/design/skills-100.md` §0.6, `docs/world/campaign.md` S3.

## What a player gets
- **Every cast sounds and moves.** Each skill row plays its Keeper animation (one of eleven: cast-raise, cast-push,
  cast-slam, channel, swing, heavy, shield-up, throw, draw, whistle, kneel) and its cast cue; each blow it lands plays its
  hit cue and a 2–3 frame impact spark in the element's colour (a crit adds a 1-frame white outline).
- **Basic attacks** (Ember Bolt, Kindle, Thorn Shot, the Watch Blade) play their calling's animation and hit cue.
- **Creatures' blows read.** A bite hitches back, lunges 3 px in, settles (0.2 s), and sounds its family: maw clank
  (maws, prisms, orreries, grafts), beast snarl (beasts, the wild, the ember-born), bone rattle, orc grunt, shade hiss —
  pitched by size.
- **No noise.** At most 6 hit cues (hits and bites together) in any 100 ms; a 20-creature Nova sounds 6 and drops 14.
  Everything goes through the effects slider and mute.

## How
- `shared/sound/combat-cues.ts`: the cue families (cast, hit, bite) and `HitCap` (the sliding 6-per-100 ms gate).
- `shared/sound/sound-director.ts`: 25 new synthesised recipes (no files), `hitsDropped`.
- `play/td/td-skill-kit.ts`: `SKILL_KIT[id] = { anim, cast, hit, pitch, el }` for every row of all four callings and
  the Common page (S5's new rows included); `biteCueOf(creature)`, `bitePitch(h)`.
- `play/td/td-keeper-anim.ts`: the eleven animations as whole-pixel pose offsets + overlays (staff flash, slammed ring,
  shield brass, channel glow, note, knee glow) on the cached painter frame — no new frame sheets.
- `td-mobs.ts`: `castBody` → `castFx` (cast cue + `keeperAnim`); `hitFoe` → `hitFx` (hit cue + `impact`);
  `biteKeeper` → bite cue + `Mob.lungeAt`. Cues queue in `MobSystem.cues` (capped at 24 undrained: the room never piles
  them). `sfxCue(cue, pitch)` is public for any other moment (a heal landing on an ally, a ward, a revive).
- `td-engine.ts`: `fightFx` drains the cues to `options.onSfx({ kind, pitch })` every frame and runs the animation clock;
  `drawAnimOverlay`, the `impact` effect, the creature lunge in `drawMob`. `EngineSfx` carries `pitch`.

## Low and reduced motion
- **Low**: the impact is one frame, no flying pixels; an overlay draws its core only.
- **Reduced motion**: the figure does not move (no offsets), the overlay shows its key frame still and full size, the
  impact is the still cross, creatures do not lunge. Every tell stays.

## Tests
Karma: `td-skill-kit.spec.ts` (every SKILLS id has a kit; actives cast a cue; every creature a bite; frame counts and
timings; reduced motion; Low; the fight queues cast/hit/bite cues and the impact), `combat-cues.spec.ts` (the cap, every
cue rendered offline and heard, the 20-hit Nova does not clip, mute).

## Phone perf (390×844, DPR 3, CPU ×6, headless Chromium; frame mean / p95 / worst ms, frames over 33 ms)
| Scene | calm main, Normal | S3, Normal | S3, Low |
|---|---|---|---|
| Hot spot fighting (18 walkers) | 18.4 / 33.3 / 35.4, 9/273 | 16.6 / 18.6 / 33.3, 0/302 | 16.6 / 18.6 / 18.8, 0/302 |
| Hot spot walking | 18.4 / 33.3 / 35.3, 4/273 | 18.0 / 33.3 / 35.1, 4/279 | 16.6 / 18.5 / 18.7, 0/301 |
| Town walking | 18.3 / 33.3 / 48.1, 6/274 | 17.3 / 18.7 / 35.3, 5/289 | 16.6 / 18.6 / 18.7, 0/302 |
| Road walking | 17.9 / 33.3 / 35.3, 3/280 | 19.5 / 33.4 / 35.3, 9/258 | 16.6 / 18.5 / 18.7, 0/301 |
Fighting's engine update stays 0.25–0.28 ms a frame. Normal's remaining >33 ms frames are the software canvas raster on
walking ground bakes (calm.md), not the fight; the run shared the machine with another builder's work.
