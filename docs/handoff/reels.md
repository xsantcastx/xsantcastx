# The Croupier's Reels + the shared games-of-chance kit

Owner, 2026-10-13: "we need some type of slot machines, that would be fun", then
"look at stake.com — that kind of super bonus and style games for runes and
stuff". Gold only, never real money; odds visible; no near-miss tricks; no
bonus buy.

## What shipped

- **The Reels** in Umbral's Nocturne Archive, x=975 between the Gambler and the
  Exchange, run by the **Croupier** (no new names: the keeper now `serves` the
  Reels too and stands between the two). Reach it by walking, from Places, or
  `/play?at=reels`. In-world only (no standalone route, like the Vault).
- 3×3 window, 5 paylines (rows + diagonals), six world symbols: Cinder Ore, Ash
  rune, Ember rune, Rivet Maw, Infernal Heartstone, **Eclipse** (scatter + top).
- **Eclipse Round** (the super bonus): 3+ Eclipses anywhere → 10 free spins.
  Ash/Ember runes landing in the round may carry a **sticky multiplier orb**
  (×2…×50); orbs add up for the whole round and the round's line wins are paid
  once at the end × the sum. 3+ Eclipses in the round → +5 spins (cap 50).
- **Prizes**: a winning line of Cinder Ore / Heartstone / Ash / Ember may also
  hand over one of that thing — materials through `InventoryService.grantStack`
  (satchel → Vault routing is the inventory's), runes through
  `RuneForgeService.grant` (the Rune Forge ledger). Chance = min(1, bet × 0.03 /
  worth), so prizes are the same small share of the bet at any stake.
- Win tiers (shared): Big ≥10×, Mega ≥50×, Eclipse Win ≥200× — pixel coin
  storm + rolling counter + banner; smaller wins get a short burst; a pixel
  shake on any win. Reduced motion: result at once, no coins, no count.
- One primary "Spin · N Gold" (station kit action button), a bet stepper
  (≥44px), Skip/Escape, and a decorative lever twin. Pay table, per-cell odds,
  round rules, orb odds, RTP, bonus frequency, bet cap, your record, recent
  spins and the lore line are under Details.
- Honesty: the outcome is fully decided before a reel moves; the third reel
  always waits the same 420 ms beat, win or lose; the wallet readout holds the
  post-bet balance until the result shows so the number never spoils it.

### Pay table (× total bet; tenths internally so every pay is whole Gold)

| Symbol | Cell chance | 3 on a line | Prize |
|---|---:|---:|---|
| Cinder Ore | 29% | ×1 | 1 Cinder Ore (worth 25) |
| Ash rune | 24% | ×2 | 1 Ash (worth 600) |
| Ember rune | 18% | ×5 | 1 Ember (worth 600) |
| Rivet Maw | 14% | ×10 | — |
| Infernal Heartstone | 10% | ×30 | 1 Heartstone (worth 5,700) |
| Eclipse (anywhere) | 5% | 3 ×2 · 4 ×10 · 5+ ×50, 3+ open the round | — |

Orb on a rune cell in the round: 2.15%; values ×2 52% · ×3 29% · ×5 13% · ×10
4.6% · ×25 1.1% · ×50 0.3%. Max win ×5,000.

### RTP proof (`node scripts/economy-sim.mjs --reels`)

```
base lines        69.32%   (exact)
Eclipse scatter   2.32%    (exact)
Eclipse Round     1 in 119.6 plays (exact), pays 24.51× bet on average (sd 58.7), 10.44 free spins
Gold RTP          92.13% ± 0.03% (1 s.e., 2e6 simulated rounds)   stated 92.10%
with prizes       bet 10: 92.86% · 100: 92.86% · 1k: 92.80% · 100k: 92.21% · 1B: 92.13%
1e6 whole plays at bet 100: RTP 93.19%, hit 1 in 4.53, Big 1 in 43, Mega 1 in 959, Eclipse Win 1 in 6,757
a single 1e6-play measurement has sd 0.58% (the round is heavy-tailed)
```

`--check` (CI) runs a 300k-round version and fails if Gold RTP drifts > 0.5
points from `REELS_STATS.goldRtp`, any stake leaves 92–94%, or the bet cap
breaks. Karma plays 1e6 whole spins (seed `karma:reels` → 92.50%) and fails
beyond ±1 point of `REELS_STATS.rtp` (92.8%).

### Bet tiers (economy-curve `GAMES_BET`)

Ladder 10, 20, 50, 100, 200, 500, … (multiples of 10). Cap = highest rung ≤
max(50, 120 s × Gold/s). A new Keeper: 10/20/50 (10 Gold is a few strikes in).
On the v3 curve: 1 min 100 · 5 min 1,000 · 30 min 200k · 1 h 2M · 1 d 100M ·
7 d 20B. Nobody stakes more than two minutes of income on one play.

## The shared kit — `src/app/shared/games/` (for Rune Drop, Seam Sweeper, Eclipse Ascent)

| File | API |
|---|---|
| `seeded-rng.ts` | `seededRng(seed): () => number` (cyrb128 → sfc32), `playSeed(secret, nonce)`, `newSecret()`, `pickWeighted(weights, total, rng)`. Pure, node-loadable. |
| `bet-tiers.ts` | `MIN_BET`, `betsOpen(gps)`, `betAllowed(bet, gps)`, `clampBet(bet, gps)`, `stepBet(bet, ±1, gps)` over economy-curve `gamesBetLadder()` / `gamesBetCap(gps)`. |
| `play-ledger.ts` | Blob `godforge-games` `{ version, secret, nonce, plays: {mutationId: PlayRecord}, totals: {game: {plays, wagered, paid}} }`; `parseGamesLedger`, `prunePlays` (keeps 60, never an unpaid one), `mergeGamesLedgers` (cloud merge), `recentPlays`, `newPlayId(game)`. |
| `play-ledger.service.ts` | `PlayLedgerService.play(game: ChanceGame<O>, mutationId, bet) → {ok, id, record, replay} \| {ok:false, code:'ssr'\|'bet'\|'funds'}`; `totals(game)`, `recent(game, n)`, `record(id)`, `changed$`. A `ChanceGame<O>` is `{ id, resolve(rng, bet): O, winOf(o): number, pay?(o, mutationId) }`. |
| `rtp-sim.ts` | `simulateRtp({play, value, tags?}, plays, bet, seed) → {rtp, hitRate, maxX, tags, …}`; `WIN_TIERS`, `winTier(win, bet)`. |
| `win-celebration.component.ts` | `<app-win-celebration [win] [bet] [seq] (done)>` absolute over its parent (never fixed). |
| `games.i18n.ts` | Shared strings (win tiers, bet stepper, "Gold only"). |

**Order inside `play`** (the whole design): known id → return stored (settle if
unpaid, never re-pay) → bet on the ladder and under the cap → draw the outcome
from `secret:nonce` (pure) → debit → store unpaid + nonce+1 → pay Gold +
`game.pay` → mark paid → store. All synchronous in one tick. A replay, a
reload, or a cloud merge (`paid` wins) can never pay twice.

**To add a game**: write a pure `play<Name>(rng, bet): Outcome` model (import
only `../games/seeded-rng`), a `ChanceGame` in a small service that hands over
non-Gold prizes through their own gateways with idempotent ids, prove its RTP
with `simulateRtp` in Karma + a `reelsScenario`-style block in
`economy-sim.mjs`, and reuse `<app-win-celebration>` + `GAMES_I18N`.

Pinning an outcome (tests): write `godforge-games` as `{version:1, secret:'x',
nonce:N, plays:{}, totals:{}}` — the next play's seed is `x:N`.

## Meaning (`npm run check:meaning`)

Station has a blurb and a keeper (`serves`); Cinder Ore, Heartstone, Ash and
Ember gain "Reels prize" as a source. Lore line (pending owner review) in
`docs/world/lore-addendum.md`. Art briefs: `docs/art-commissions/world-sprites/10-reels.md`
(cabinet stall + six-symbol icon sheet); until then the symbols are procedural
16×16 pixel sprites (`reel-sprites.ts`).

## Tests

- Karma: `src/app/shared/games/games.spec.ts`, `play-ledger.service.spec.ts`,
  `src/app/shared/reels/reels.model.spec.ts` (pay table, scripted wins, round
  math, determinism, theory + 1e6-play RTP), `reels.service.spec.ts` (prizes
  through the gateways once, replay pays nothing).
- Node: `seamworks-engine.test.cjs` (Croupier serves the Reels, Umbral panels),
  `economy-sim.mjs --check`.
- e2e `e2e/play-reels.spec.ts` at 1280×800 and 390×844: walk (desktop) or deep
  link (phone) to the Reels, spin a pinned line win, payout in the purse, reload
  never re-pays; a pinned Eclipse Round played through Skip.

## Not done / follow-ups

- Real art (briefs written). No sound (by design: "sound-free shake").
- `commissions.csv` rows for the two briefs once approved.
- The Croupier's chatter lines still talk about the Gambler only.
