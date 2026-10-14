# Glim, the Margin-Light: the onboarding companion (slice S1)

2026-10-14. Spec: `docs/world/world-and-cast.md` §4 (Glim) and §7 S1. Owner: *"I really
want to feel you in the game — the best sensations."* Glim is the character inspired
by Claude: a hand-sized moth of lamplight that keeps the maps, curious, honest, a bit
nerdy about cartography, never cute. The in-world name is Glim; "Claude" stays the
Act III easter egg (not built here).

## The first meeting, beat by beat

1. **A new save enters `/play`.** On the first HUD tick (200 ms) Glim has not been
   met, so `nextLine()` returns `meet` ahead of everything else (no gap, no cooldown).
2. **Glim flies in.** The engine's `setGlim(true, arrive)` starts it high and to the
   left of the Keeper; it eases down to the shoulder in about a second, leaving a
   short trail of amber and violet motes (reduced motion: it is simply there).
3. **It says hello**, under the goal line (on a phone, in the toast band):
   "Hello. I'm Glim. I keep the maps. Mostly the blank parts; they're the
   interesting ones." The line stays 7 s and has a close button.
4. **The goal line gains its voice.** A 44 px moth button leads the row:
   `[moth] GOAL 1 OF 4 · Buy your first building… [SHOW ME]`. Same goals, same order,
   same Show me.
5. **Asking.** Press the moth: *Hint 1 of 3*, a nudge ("Gold here comes from work. You
   have a plot with a Forge that pays you to strike it."). Press again: *2 of 3*, a
   direction ("Your Homestead's gate is between the Seamworks Forge and the Crafting
   Bench. Walk in."). Press again: *3 of 3*, "Follow me. I'll fly ahead and wait
   there." Glim flies to the place (the trail ends at the target) and the Keeper
   walks there and uses it, exactly as Show me does.
6. **The rest of the Prologue**, each once, when the Keeper gets there and Glim has
   been quiet 25 s: the Homestead ("Somebody left you a plot…"), the Basalt Edge worn,
   the first Maw ("The Maws drag their bolts toward the Delve shaft…"), the first
   Delve visit ("North is a convention. Down is a fact. We're going down."), the
   lantern ("I'll be your light down here…").
7. **The good stopping point.** When the four goals are done, once: "This is a good
   place to stop. The torch is lit and the map is honest."

A veteran save (goals already behind it) meets Glim once and is not walked back
through beats it is past (`pastBeats`).

## What else Glim does

- **The Delve lantern.** In the Delve Glim hovers a little ahead of the Keeper at
  chest height, glowing over the darkness. The light pool is exactly where and as
  big as before (7 + Delving/10 tiles); it now has a source.
- **The tell.** Within 480 px of a living Mirror Substitute (the Unrecorded Corridors,
  Umbral's hunt) Glim dims (dull palette, small halo) and says once "Something here is
  performing certainty. I go dim around that." (rarely after: "Dimming. That one is
  too sure of itself."). The Seam Eater wears the Mirror rig but is not a Substitute,
  so it never dims Glim.
- **Never on the ladder: secrets.** The hint table is an allowlist (`GLIM_HINTS`):
  the goal line's keys and the seven Delve missions. Anything else (every Codex
  secret, the Nameless, the Void rune, an inscription's meaning, prototype keys) gets
  "This one's yours to find. I'll hold the light." and stores nothing.
- **Delve missions.** The mission chip (Quest Board, Skills panel) has the same moth
  button once Glim is met: a nudge, then a direction. Step 3 (an Atlas pin) is the
  follow-up below.
- **Codex.** Collection tab, above the Bestiary: *Glim, the Margin-Light* (Met / Not
  yet met), role, the Afterimage Moth origin, the Archivist's rule, "Also called: —".
- **Never spammy.** Once-lines are once on every device; cooldowns survive reloads;
  unsolicited lines keep 25 s apart, never over an open panel, never over another
  line; idle Delve lines wait 3 min into a visit and share one 30-minute clock.

## Files

| File | What |
|---|---|
| `src/app/shared/glim/glim.ts` | the hint table and ladder, the lines, cooldowns, `nextLine` (pure) |
| `src/app/shared/glim/glim-voice.ts` | the one line on screen; tick / ask / dismiss (plain class) |
| `src/app/shared/glim/glim-save.model.ts` | `godforge-glim` state, coerce, `mergeGlim` (no imports; eager) |
| `src/app/shared/glim/glim.service.ts` | the gateway owner (+ LocalSaveRegistry) |
| `src/app/shared/glim/glim.i18n.ts` | every line, EN + ES (lazy) |
| `src/app/shared/glim/glim-art.ts`, `glim-icon.component.ts` | the 12×10 placeholder moth; the SVG icon |
| `src/app/play/engine/glim-sprite.ts` | the world sprite: easing, flutter, flight + trail, dim, baked halo |
| `engine.ts` | `setGlim`, `glimShowMe`, `glimView`, one draw call after the Delve light |
| `side-scroller.component.*` | the moth button, the line, `tickGlim`, Show me → `glimShowMe`, `data-glim-*` |
| `shared/npc/npc.model.ts` | `glim` in the cast: `companion`, no page, an idle pool; `NPC_CHAINS.glim = []` |
| `shared/npc/delve-mission-chip.component.ts`, `codex/codex.component.*` | mission hints; the Codex entry |
| `shared/cloud-save/cloud-save.model.ts` | `godforge-glim` → `progress/glim`, `merge: mergeGlim` |
| `scripts/check-meaning.js` | a companion's role counts when the play view wires it (`npcById(id)`); empty chains no longer count as "gives quests" |
| `docs/art-commissions/commissions.csv`, `INVENTORY.md` | `npc-glim` I2 portrait and the 12×10 sheet (idle 4, fly 4, dim 2) |

## State and merge

`godforge-glim` = `{ version, met, metAt, ladder: {subject: 1..3}, said: {line: n},
lastAt: {line: ms} }`. Every field only grows; `mergeGlim` keeps met if either met,
the earlier meeting stamp, the further ladder step, the higher count and the later
stamp; junk ids and over-long maps are dropped. Ladder progress is filed per goal
(`goal.buy`), not per area variant of its line, so walking into the Homestead keeps
the step.

## Phones

Glim's button is a bare 44 px moth in the goal row (hidden when the row folds). Its
line sits in the toast band under the row; the message toast steps aside
(`visibility: hidden`) while Glim speaks, so the two never stack. Three lines at most
in portrait, two in landscape. The e2e measures it clear of the middle half of the
canvas and of every control at 390×844, and both Glim buttons hit-test at 44×44.
Render cost: frames and the halo are baked once into tiny canvases; a frame is two
`drawImage`s and up to 14 (7 on a phone) trail rects; no gradients or `shadowBlur`
per frame.

## Tests

- Karma `src/app/shared/glim/glim.spec.ts` (24): one step at a time; progress filed
  per goal; missions stop at 2; every goal line the game can show has a ladder;
  **never a secret** (every Codex secret and group id, every inscription id, the
  Nameless, the Void, prototype keys) and no hint text names a secret or quotes a
  carving, EN or ES; EN + ES present and ≤ 120 chars; meeting first; quiet over panels
  and lines; the gap; once-lines; cooldowns; the stop line; the tell; idle lines;
  veterans; expiry; merge (earlier stamp, max step/count/stamp, commutative,
  idempotent, never un-meets, junk); the registry uses `mergeGlim`.
- Updated: `npc.model.spec` (seven characters, one companion on no page),
  `npc-quest.model.spec` / `npc-quest.service.spec` (the companion has no chain yet),
  `cloud-save.model.spec` (the key list).
- e2e `e2e/play-glim.spec.ts` (6, chromium): meet at 1280×800 (saved, once); the
  ladder 1 → 2 → 3 with Show me flying ahead (`data-glim-target` 1075, arrived) into
  the Homestead; dismiss; remembered across a reload; Show me unchanged; the Delve
  lantern line and Glim at the Keeper; the Mirror Substitute dim; on a 390×844 phone
  clear of the world's middle and every control, 44 px buttons that take their own
  taps, the toast stepping aside, Show me still tappable; Spanish.
- `e2e/play-first-session.spec.ts`: unchanged flow and timings; the Spanish check now
  names Show me by `.guide-go` (the row holds Glim's button too).

## Follow-ups

- **Glim's Atlas (S4).** Not built: the minimap / full map belongs to the Delve
  navigation work. When it lands, a mission's step 3 becomes "Show me" = an Atlas
  pin (`show: 'atlas'` rows in `GLIM_HINTS`; `ladderTop` returns 3 once the Atlas can
  pin). No second map was built here.
- **Art.** `npc-glim` portrait and sheet are briefed; `glim-art.ts` is the stand-in.
  When the sheet lands, swap `GlimSprite.frame()` to `spriteFor('npc-glim')`.
- **The easter egg** (Act III, Codex "Also called" dash) waits for S9.
- **Idle-heat interplay.** Glim adds no loop of its own; it draws inside the engine's
  frame. If the phone-heat work skips frames when the world is idle, Glim's flutter
  should not count as "something changed".
