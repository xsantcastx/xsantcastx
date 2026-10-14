# The Croupier's casino: Rune Drop, Seam Sweeper, Eclipse Ascent

Owner, 2026-10-13/14: "stake.com-style games themed on runes", Gold only. Three
more games on the shared kit (`docs/handoff/reels.md`), each an in-world
station in Umbral's Nocturne Archive run by the existing Croupier.

## What shipped

- **Places**: Umbral now reads west → east Waystone 360 · Gambler 760 ·
  (Croupier) · Reels 975 · **Rune Drop 1105 · Seam Sweeper 1235 · Eclipse
  Ascent 1365** · Exchange 1560 (moved from 1140) · shelf ledges 1760/2160 ·
  passage 2640. The Croupier `serves` all four games (no new names). Reach each
  by walking, from Places, or `/play?at=rune-drop|seam-sweeper|eclipse-ascent`.
  In-world only (no standalone route).
- Every game: one primary button ("Drop · N Gold" / "Dig · N Gold" → "Cash out
  ×N" / "Launch · N Gold" → "Cash out ×N"), ≥44 px steppers
  (`<app-game-stepper>`), bet ladder + cap from `GAMES_BET`, odds/pay
  tables/RTP/rules/history/lore under Details, `<app-win-celebration>` only
  when a play returns MORE than the bet (a ×0.4 bin is said as "4 of your 10
  Gold back", never dressed as a win), reduced-motion paths, EN + ES lazy tables.
  No bonus buy, no prizes (Gold only; the Reels keep the material/rune prizes).

### Rune Drop (Plinko) — `src/app/shared/rune-drop/`

8–16 rows × Low/Medium/High. At each pin the rune goes left/right on one fair
draw; the bin is the number of rights (chance C(n,k)/2^n). The stored path IS
the outcome and the board animates exactly those bits, one pin per 120 ms
beat for every pin and every outcome (no slowing near edges). Pays are tenths
of the bet → whole Gold at every bet.

Pay tables (× bet, edge → centre; mirrored):

| rows | Low | Medium | High |
|---:|---|---|---|
| 8 | 7.2 · 2.5 · 1.1 · 0.7 · 0.7 | 13 · 3.4 · 1.2 · 0.6 · 0.4 | 27 · 5 · 1.1 · 0.3 · 0.2 |
| 9 | 8.6 · 2.7 · 1.3 · 0.9 · 0.7 | 16 · 5 · 1.8 · 0.8 · 0.4 | 41 · 7.8 · 1.8 · 0.5 · 0.2 |
| 10 | 10 · 3.6 · 1.7 · 1 · 0.8 · 0.6 | 24 · 6.7 · 2.4 · 1.1 · 0.5 · 0.4 | 64 · 12 · 2.9 · 0.8 · 0.3 · 0.1 |
| 11 | 12 · 4.4 · 2 · 1.3 · 0.8 · 0.7 | 32 · 9.6 · 3.4 · 1.4 · 0.7 · 0.4 | 95 · 20 · 4.6 · 1.1 · 0.4 · 0.2 |
| 12 | 14 · 5.2 · 2.4 · 1.4 · 0.9 · 0.8 · 0.7 | 43 · 13 · 4.6 · 1.9 · 0.9 · 0.5 · 0.4 | 150 · 31 · 7.3 · 2 · 0.6 · 0.2 · 0.1 |
| 13 | 16 · 6.1 · 2.9 · 1.7 · 1.2 · 0.8 · 0.7 | 59 · 18 · 6.3 · 2.5 · 1.3 · 0.6 · 0.4 | 225 · 48 · 11 · 3 · 0.9 · 0.4 · 0.1 |
| 14 | 18 · 7.3 · 3.5 · 2 · 1.2 · 0.9 · 0.8 · 0.7 | 79 · 25 · 8.7 · 3.5 · 1.5 · 0.8 · 0.5 · 0.4 | 350 · 76 · 18 · 4.8 · 1.4 · 0.4 · 0.2 · 0.1 |
| 15 | 21 · 8.6 · 4.1 · 2 · 1.4 · 1 · 0.8 · 0.8 | 105 · 34 · 12 · 4.6 · 2 · 1.1 · 0.6 · 0.4 | 530 · 120 · 28 · 7.3 · 2 · 0.7 · 0.3 · 0.1 |
| 16 | 24 · 10 · 4.8 · 2.5 · 1.7 · 1 · 0.9 · 0.8 · 0.8 | 145 · 46 · 17 · 6.3 · 2.8 · 1.3 · 0.7 · 0.5 · 0.4 | 820 · 185 · 44 · 11 · 3.2 · 0.9 · 0.4 · 0.2 · 0.1 |

Exact RTP per board (Σ C(n,k)/2^n × pay): every one of the 27 is 94.84–95.13%
(low 94.89–95.13, medium 94.84–95.08, high 94.89–95.11). Max ×820.

### Seam Sweeper (Mines) — `src/app/shared/seam-sweeper/`

5×5 seam, 1–24 collapses. At the bet the WHOLE seam is drawn (partial
Fisher–Yates on the seed) plus one rounding draw `u`, and stored open with the
round; every dig is stored before it is shown; a reload resumes the same seam
(`SeamSweeperService.current()`). Multiplier after k ore with m collapses:
`0.95 × C(25,k)/C(25−m,k)` = 0.95 / P(k ore in a row), so cashing out after
ANY k returns exactly 95% for every m and every cell choice. A dig that would
pass ×5,000 is not offered (cash out instead), so no cash-out is ever capped
and the 95% holds for every allowed move (top multiplier offered ×3,805.54).
Finding every ore cashes out by itself. A collapse closes the round lost and
reveals every collapse. Cash-out needs ≥1 ore.

Sample ladder (× bet, chance to get there): 1 collapse: 1 ore ×0.99 (96%) ·
5 ×1.19 (80%) · 12 ×1.83 (52%). 3: 1 ×1.08 (88%) · 3 ×1.42 (67%) · 8 ×3.21
(29.6%). 5: 1 ×1.19 · 5 ×3.26 (29.2%) · 12 ×39.22 (2.4%). 24: 1 ore ×23.75 (4%).

### Eclipse Ascent (Crash) — `src/app/shared/eclipse-ascent/`

Multiplier ×1.00 → doubles every 6 s → ceiling ×1,000. Break point drawn at
launch: `crash = floor(100 × 0.95 / (1 − a))` hundredths, under ×1.01 → ×1.00.
So P(holds to ≥ ×x) = 0.95/x exactly on the hundredths grid, and a cash-out at
any ×x (manual or the optional auto target ×1.20…×1,000) returns exactly 95%.
1 − 0.95/1.01 = 5.94% of launches break at ×1.00. Single player. The round runs
on the wall clock from its stored launch time: leaving/reloading resumes it,
an auto target reached while away pays, a break passed while away closes it.
A manual cash-out pays the multiplier on screen, never above the clock and
never more than 250 ms stale (`CASH_LAG_MS`).

### Whole Gold

Mines and Crash pay `bet × multiplier`, a fraction of a Gold at low bets. The
kit's `wholeGold(value, u)` pays floor(value) + 1 with chance frac(value),
`u` drawn at the bet and stored: exact on average, so 95% holds even at the
10-Gold minimum (plain rounding would move it by several points there).
Stated in Details.

## RTP proof (`node scripts/economy-sim.mjs --plinko|--mines|--crash`)

```
plinko  every board 94.84%–95.13% exact; simulated 200k drops/board at bet 10:
        low/8 95.21±0.16 (95.08) · medium/12 95.13±0.35 (95.06) · high/16 97.32±1.72 (94.94)
        high/8 94.56±0.57 (95.00) · low/16 95.11±0.10 (95.00)
mines   exact 95.00% on all 248 (collapses, ore) cash-outs (max error 1e-16);
        1M rounds at bet 10, 1–8 collapses, cash-out after 1–5 ore: 95.04% ± 0.11%
crash   exact 95.00% at every target; P(≥×1.01/1.5/2/5/10) simulated 94.07/63.39/47.50/19.03/9.50%
        (exact 94.06/63.33/47.50/19.00/9.50); instant 5.93% (exact 5.94%);
        1M rounds at bet 10, log-uniform target ×1.01–×100: 94.93% ± 0.44%
```

`--check` (CI) runs the exact proofs + smaller simulations for all three and
fails on any board outside 94–96%, an exact identity off by > 1e-9, a
multiplier over the ceiling, or a simulation more than 4 s.e. from exact.

## The kit, extended (`src/app/shared/games/`)

- `PlayLedgerService.openRound / updateRound / closeRound / openRounds` with
  `RoundGame<O,S> { id, resolve(rng, bet), start(o), winOf(o, state, bet) }`:
  the outcome is drawn and the bet debited at `openRound` (record `open: true`,
  `state`), moves are stored by `updateRound`, `closeRound` prices the final
  state and pays once (a closed round, a replayed id, a reload, a cloud merge
  — paid copy wins — never pay twice). `play()` never settles an open round.
  `prunePlays` keeps open rounds (they are unpaid).
- `rtp-sim.ts`: `wholeGold(value, u)`.
- `game-stepper.component.ts`: `<app-game-stepper>` (− value +, ≥44 px).

## Tests

- Karma: `rune-drop.model.spec.ts` (band, symmetry, bin = rights, path =
  bits, 400k drops seed `karma:rune-drop` within ±1 pt, sd ≈ 0.25 pt),
  `seam-sweeper.model.spec.ts` (layouts, exact 95% on every cash-out,
  wholeGold, 300k rounds seed `karma:seam` within ±1 pt, sd ≈ 0.12 pt),
  `eclipse-ascent.model.spec.ts` (tail, cash-out math, clock/status, 400k
  rounds at ×2 seed `karma:ascent` within ±1 pt, sd ≈ 0.16 pt),
  `games/casino.service.spec.ts` (replay never pays twice, reload resumes a
  seam, crash cash-out never above the clock, auto target pays while away
  once, caps refused).
- Node: `seamworks-engine.test.cjs` (Umbral panels, Croupier serves the row in
  order), `economy-sim.mjs --check`.
- e2e `e2e/play-casino.spec.ts` at 1280×800 and 390×844: walk (desktop) /
  deep-link (phone) to Rune Drop and land a pinned drop, reload never re-pays;
  Seam Sweeper dig → reload mid-seam → resume → cash out → reload; Eclipse
  Ascent auto ×2.00 launch → reload in flight → paid once. Screenshots in
  `output/casino/` (not committed). `play-world` / `play-economy` walk to the
  Exchange at its new x=1560.

## Meaning

Three stations with blurbs and a keeper (`serves`); lore lines in
`docs/world/lore-addendum.md` ("shipped — owner reviews in play"). Art briefs:
`docs/art-commissions/world-sprites/11-casino.md` (three stalls, seam cells,
eclipse sky); until then the panels are procedural pixel SVG.

## Not done / follow-ups

- Real art; `commissions.csv` rows once approved. No sound (by design).
- Material/rune prizes were optional and are left out (Gold only here).
- The Croupier's chatter lines still talk about the Gambler only.
- Rune Drop drops one rune at a time (no multi-ball).
