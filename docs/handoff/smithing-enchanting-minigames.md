# Smithing anvil mini-game + Enchanting ritual: handoff

Folder: `src/app/shared/minigames/` (lazy only; imported by the Crafting Bench and Enchanting Table, both of which are lazy routes and lazy in-world panels).

## Files
- `anvil.model.ts`: pure. `gradeStrike`, `markerAt`, `anvilPeriod`, `anvilQuality`, `anvilExponent`, `anvilBiasRoll`, `anvilRng`, `expectedAnvilRoll`, `anvilVerdict`.
- `ritual.model.ts`: pure. `pulseAt`, `pulseWindow`, `gradePulse`, `RITUAL_CONFIRM_QUALITY`.
- `anvil-game.component.ts` (`<app-anvil-game>`): emits `done(quality 0..1 | null)`; null means "skipped".
- `rune-ritual.component.ts` (`<app-rune-ritual>`): emits `done(quality 0..1)` and `cancel()`.
- `minigames.css`, `minigames.i18n.ts` (namespace `minigame.*`, EN + ES), `index.ts`.
- Specs: `anvil.model.spec.ts`, `ritual.model.spec.ts`.

## Anvil: how quality maps to the roll
- 4 strikes on a sweeping heat bar. Perfect = 1, Good = 0.6, Off = 0.15. Quality is the mean.
- The mint draws `r` in [0, 1) per roll key and maps it to `min + r * (max - min)` in the rarity band. The anvil changes only the RNG handed to `CraftingGateway.craft(id, mutationId, rng)`. That parameter already existed, so the gateway, the band, mint and the stored `rollQuality` are untouched:
  `r' = r ^ e`, with `e = 1 - 0.2 * quality`, so `e` is in [0.8, 1].
- **Ceiling proof:** for r in [0, 1) and 0 < e <= 1, r^e is also in [0, 1), and `anvilBiasRoll` clamps to `1 - EPSILON` anyway. So the biased roll stays inside today's band and can never reach a stat today's RNG couldn't. Mastery's `masteryRng` wraps the result and clamps at the band max itself. A spec mints every rolled recipe with a perfect game and the best possible RNG, and checks no stat goes over the ceiling.
- **Expected value:** E[r^e] = 1/(1+e). That's 0.5 today and 0.556 for a perfect game, so the grade rises by at most about 5.6 points on average. A typical game (quality about 0.6) adds about 3.2.
- **Today's behaviour, bit-identical:** Craft all, a stepper batch (quantity > 1), the "Skip the anvil game" toggle, the in-game Skip link, and recipes whose output has no roll keys (consumables) all call `gateway.craft` with its default RNG and grant no bonus XP. The toggle is session-only module state and is never saved.
- **XP:** after a successful, non-replayed craft, `SkillActionService.grantSmithingXp(quality, 'anvil:<craftId>')` pays 8 to 40 Smithing XP (`craftSkillXp`). This is on top of the bench's own recordCraft XP, which hasn't changed. The reward card shows "+N Smithing XP".
- A played game skips the `craftTime` countdown, since the game is the work. `craftTime` was already UI-only.

## Ritual
- "Add rune" opens the ritual in the detail pane. Nothing is spent until it succeeds.
- Beat 1: drag the rune onto the glowing circle. Tapping the rune or the circle also works, and so do Enter and Space.
- Beat 2: a violet ring shrinks toward the gold socket ring, and you tap the circle when they meet. Hitting dead centre scores quality 1 and the edge of the window scores 0.4. A miss says "Almost, nothing was lost", widens the window (0.14, then +0.05 per miss, capped at 0.3) and starts the pulse again.
- On a hit, `gateway.socket(...)` runs exactly as before, then `grantEnchantingXp(quality, 'ritual:<item>:<well>:<rune>:<id>')` pays 8 to 40 Enchanting XP.
- Cancel, or picking another item or rune, closes the ritual.
- Reduced motion: one "Set the rune" button, quality 0.5.

## Feel / perf
- The sweep and the pulse run in requestAnimationFrame outside the Angular zone and write a single CSS custom property each frame, so they never trigger change detection. A press reads the clock, not the last frame.
- Presses go through pointerdown, not click, because click lands on pointer-up and can be about 100 ms late.
- Feedback: a grade ring, sparks (10, 6 or 2 depending on grade), a grade pop and pips. The panel itself does a small nudge, never `<html>`. Under reduced motion the nudge, sparks and pops are off and the anvil sweep runs 1.4x slower. No fixed overlays.

## Not done / ideas
- Smithing tool tier or level could widen the Perfect zone (`skillPerks` quality %).
- A trace-the-glyph variant of the ritual for rarer runes.
- e2e specs for the forge pages: a Craft press on equipment now opens the game. Specs that press Craft and expect an item need to tick the skip toggle or press Skip.
