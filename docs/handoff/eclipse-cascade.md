# Eclipse Cascade, the machines to discover, auto spin and higher bets — handoff

2026-10-16. Owner: *"the slot machine should be more like 10x10 and very nice — or are there other slot machines to
discover?"* (and Stake-style super bonuses), then *"we also need auto spin and higher bets."* Gold only, never real
money, **no bonus buy**. Lore: [`docs/world/lore-addendum.md`](../world/lore-addendum.md), "The Eclipse Cascade and the
machines to discover" (shipped — owner reviews in play). Screenshots: `docs/handoff/eclipse-cascade/*.png` (from the
e2e run, `output/eclipse-cascade/`).

## What a player gets

- **Eclipse Cascade** — a new Mirror Slate app beside the Reels (every Slate, tier I). A 10×10 board of pixel rune
  tablets (Ash, Ember, Thorn, Glint, Pulse, Sigil, Nexus, Fracture; the stone tinted by the rune's tier), a **moon-mirror
  shard** wild and **the Eclipse** scatter.
  - **Cluster pays**: 5+ of a kind joined up/down/left/right (never diagonally) pay by cluster size (5…15+, × bet; the
    pay table is under "?"). The wild joins any cluster (and can join two kinds at once).
  - **Tumble**: winners burst into pixel sparks, the rest fall, new runes fall in; it chains until nothing joins, and
    every tumble pays. The Eclipse only comes with the first fall (so the round's chance is exact and printed).
  - **Multiplier spots** (Sugar Rush style): a cell that bursts once is marked, twice it is a ×2 spot, and it doubles on
    every further burst, to ×1,024. A cluster pays × the sum of the spots under it. Spots clear on every paid spin.
  - **Bonus**: 3 Eclipses → 10 free spins with the spots **sticky** for the round; **4+ → Super Bonus**: every spot
    starts at ×2. 3 Eclipses in the round → +5 spins (to 50). Max win ×5,000 (economy-curve `GAMES_MAX_WIN_X`).
  - **Feel**: a falling film over the settled result (columns drop in, clusters light gold, spots glow violet/pink with
    their ×N, bursts spark, refills fall), tumble chimes that climb a step per tumble, Big (≥10×) / Mega (≥50×) /
    **Epic** (≥200×) win roll-up counters, a pixel board shake, a spark shower, and **Glim** cheering in a bubble.
    Reduced motion: the result at once, no shake, no sparks.
- **The Orrery Tumbler** (the realm machine built): a Meridian surveyors' brass machine in the **Orrery Wells**' Gate
  Hollow, west of the return gate (a pixel cabinet with a little orrery on top and a twinkling star screen, a blue pool
  of light and a plate). E (or Interact) → "You found the Orrery Tumbler…" (once) and it opens in the place panel;
  from then on it is also an app on the Mirror Slate. 7×7 board of brass and star things, the Pole Star wild, the Comet
  scatter. **Twist: the down turns after every tumble** (the new stars fall up, then down, …) and an **orbit ladder**
  multiplies each tumble of a spin (×1 ×2 ×3 ×5 ×8); in its round the ladder is **sticky** and climbs one rung a tumble
  for the whole round (to ×50), and the Super Bonus starts it on ×5.
- **Auto spin** on the Reels, the Cascade and the Tumbler: Auto → ×10 / ×25 / ×50 / ×100 / ∞ (two taps), with stop
  rules: on any bonus (on by default), on a single win ≥ ×10/×50/×200, keep 50% / 75% of my Gold; a big **Stop · N left**
  button replaces Spin while it runs. It **pauses** when the tab hides (Resume), and **ends** when the Slate or the panel
  closes. Each auto spin is an ordinary ledger play (own mutation id, paid once).
- **Higher bets**: quick-pick chips Min · ½ · ×2 · **Max** beside the stepper (Reels, Cascade, Tumbler). The cap is now
  `max(50, 2 min of income, min(1% of the purse, 1 h of income))` (`gamesBetCap(gps, purse)`); a bet above two minutes
  of income is a high stake and Max asks once more ("Max 2,000,000? Tap again"). Rune Drop, Seam Sweeper and Eclipse
  Ascent get the same cap (no chips there yet). RTP never depends on the bet.
- **≤ 2 taps to spin** (open the app, Spin); all help (pay table, per-cell odds, rules, RTP, record, recent spins, lore)
  behind "?". Frameless: no window chrome inside the machine, the board is the hero. Fits 390×844 portrait (cells ~34
  px) and 844×390 landscape (board left, controls right) without scrolling; every control ≥ 44 px.

## Proof (`node scripts/economy-sim.mjs --cascade`, 600k base spins, 80k free rounds, 20k Super rounds)

```
eclipse-cascade · 10×10, 8 kinds + wild + scatter, multiplier spots to ×1024
  base clusters   48.16% ± 0.10%   (0.50 tumbles a spin; pays 1 spin in 2.35)
  scatter pays    1.86% (exact)
  free spins      1 in 169.4 (exact), pays 41.54× (sd 45.7), 10.13 spins → 24.52%
  Super Bonus     1 in 1726 (exact), pays 340.50× (sd 236.1) → 19.73%
  RTP             94.28% ± 0.17%   stated 94.2% (a second seed: 94.02% ± 0.20%)   max round seen ×5,000 (cap)
  200k whole plays: 93.58%, Big 1 in 236, Mega 1 in 599, Epic 1 in 1,869
orrery-tumbler · 7×7, 6 kinds, orbit ladder ×1 ×2 ×3 ×5 ×8, the down turns each tumble
  base clusters   55.85% ± 0.17%;  scatter 1.85% (exact)
  free spins      1 in 167.2 (exact), 49.56× → 29.64%;  Super 1 in 1735, 118.26× → 6.82%
  RTP             94.16% ± 0.20%   stated 94.0% (a second seed: 93.85% ± 0.24%)
Autoplay ×100 at the cap with a day of income banked (1h / 1d / 7d stages): bet ≈ 8–10 min of income (0.56–0.69% of
the purse); every machine stays a sink — median run −3 to −7 h of income, mean −0.4 to −1.5 h, keep-half floor never
crossed; the Reels' and both cascades' RTP < 100% at every bet (Reels prizes fall toward 92.13% at huge bets).
```

`--check` (CI) runs a quick stratified proof per machine (fails > max(1 pt, 4 s.e.) from the stated RTP, a stated RTP
outside 93–95%, a round rarer than 1 in 400 or commoner than 1 in 80, a max win off the curve), the deep-purse cap rules
(never over an hour of income, never over 1% of the purse past the two-minute cap) for the Reels, and autoplay at the
cap (RTP < 1, median run loses, the floor holds). The house's targets: the Reels 92–94%, the other tables 95%; the
cascades sit between at ~94%.

## How it works

| File | What |
|---|---|
| `shared/cascade/cascade.model.ts` | pure engine: machines (`ECLIPSE_CASCADE`, `ORRERY_TUMBLER`), `findClusters`, `tumble` (down/up, refills never bring a scatter), `bumpSpot`/`spotMultiplier`, ladder, `spinCascade`, `cascadeRound`, `playCascade`, `summarize`/`replayCascade`, exact `scatterDistribution`/`roundChances`, `cascadeProof`, `CASCADE_STATS` |
| `shared/cascade/cascade.service.ts` | the machines on the shared play ledger (`PlayLedgerService.play`: seed `secret:nonce`, record stored unpaid BEFORE the payout, paid once per mutation id); stores a ~300-byte summary, re-derives the film from the seed; `found`/`find` for the realm machines |
| `shared/cascade/cascade.component.*` | the machine face (one canvas, sprites baked once, rAF only while animating, a timer backstop so a hidden tab never stalls), help sheet, Glim bubble, autoplay, chips |
| `shared/cascade/cascade-sprites.ts` | 14×14 pixel symbols for both machines (OUTLINE, upper-left light) |
| `shared/cascade/realm-machines.model.ts` | the four realm machines (one built, three spec'd), placement in the realm core's Gate Hollow |
| `shared/cascade/{cascade,realm-machines}.i18n.ts` | EN + ES (lazy; the play view only carries the 6 world lines) |
| `shared/games/autoplay.ts`, `auto-spin.component.ts`, `bet-chips.component.ts` | auto spin rules + UI; quick-pick chips with the Max confirm |
| `shared/games/play-ledger{,.service}.ts` | `found` map on the games ledger (union merge, earliest wins), `markFound` |
| `shared/economy/economy-curve.ts` | `GAMES_BET.purseShare/purseIncomeSeconds`, `gamesBetCap(gps, purse)`, `gamesHighStake`, `GAMES_MAX_WIN_X` |
| `play/engine/{engine,engine.model,machine-art}.ts` | `setMachines`, reach/E → `onMachine`, `nearby: 'machine'`, the pixel cabinet (2 frames, one sheet) |
| `play/side-scroller.component.*` | pushes the machine marks, `machineUsed` (find once → message, open the panel with `setInput('machine')`), the E prompt, `data-machine` |
| `shared/slate/*` | `SLATE_MACHINES` / `slateMachines` (Cascade always, realm machines once found; not Lune's four tables — they do not count toward her gift), icons, loading the cascade component with its machine |
| `shared/sound/sound-director.ts` | cues `tumble`, `cluster` (pitch per tumble), `bigwin` |
| `scripts/economy-sim.mjs` | `--cascade`, autoplay-at-the-cap checks (also for the Reels), deep-purse cap checks |
| `scripts/check-meaning.js` | realm machines: real area, lore (model + EN/ES words), found-in, a Slate app; spec'd ones need a twist + area |

## Tests

- Karma `shared/cascade/cascade.model.spec.ts` — clusters (orthogonal only, wilds join two kinds, min size, pay by
  size), tumble (down, up, no scatter in refills), spots (mark → ×2 → doubling → cap; sum under a cluster; per-spin
  clear, sticky in a round, Super at ×2), the ladder (per tumble, flip direction, sticky round, Super from ×5),
  triggers (exact binomial; pinned free/Super seeds; retriggers capped), payout determinism, whole Gold at every
  stake, summary size + mismatch refusal, the cap, a small stratified RTP proof, sprites, the machine art, placement.
- Karma `cascade.service.spec.ts` — a seeded multiplier cascade pays exactly once across a reload; a seeded bonus;
  refusals move no Gold; the Tumbler found once and merge-safe. `games/autoplay.spec.ts` — counts, every stop rule,
  the deep-purse cap, chips and the high stake. `slate.model.spec.ts` — the machines on the glass.
- e2e `e2e/play-cascade.spec.ts` (1280×800 keys, 390×844 touch, plus 844×390): pinned multiplier spin pays exactly
  once and a reload pays nothing; a pinned free-spins bonus; a pinned Super Bonus (all 100 spots ×2); auto spin ×10 with
  an exact purse; the Reels' chips + ×10 auto; the Orrery Tumbler: Celestial gate → walk to it → found → spin pays →
  Slate app → reload keeps it.

## The other three machines (spec, ready to build on the same engine or a sibling)

All: Gold only, no bonus buy, ~94% RTP proven in `economy-sim`, found once in the realm Delve's Gate Hollow (col 21,
floor row 31 of the shared core — `realm-machines.model.ts` already lists them), then a Slate app; ≤2 taps; "?" help.

1. **The Inkwell** (Umbral, the Ink Deeps) — *sticky wilds in the dark.* 6×5 reels, 20 lines. A **lamp row** sweeps the
   board one column per spin (lit columns are "day"). A wild that lands on an **unlit** cell stays (sticky) until the
   lamp reaches its column; wilds landing in the lit column pay once and fade. Bonus (3 Ink Blots): 8 spins in full dark
   (no lamp: every wild sticks for the round); 4+ = the **Unrecorded** round: starts with 3 random sticky wilds. World
   tie-in: during a real world-clock night or an eclipse, the base game's lamp is dimmer (one column shorter) — a
   *presentation-and-frequency* change that must be compensated in the pay table so RTP is identical by day and night
   (prove both in the sim). Symbols: Ink Lantern, quill, blot, ledger, the Unrecorded mask; scatter the Ink Blot.
2. **The Rootreel** (Verdant, the Root Deeps) — *growing reels.* 5 reels, ways-pays, 3 rows tall; every win **grows**
   each reel by one row (3 → 7: 243 → 16,807 ways) and re-spins the grown positions only (a respin chain, like the
   cascade's tumble); resets each paid spin. Bonus: 10 spins where growth is sticky. Rootwood, heart-amber, spore pods,
   the Graftmother's seed; wild = living vine (expands vertically on the reel it lands). Reuse the cascade's spin/film
   split (pure model + summary + seed replay).
3. **The Prism Lines** (Luminous, the Prism Mines) — *light-beam lines.* 6×6 grid; a sun-prism on the left fires a beam
   per row; **mirror** symbols ('/' '\\') bend it up or down; every matching symbol the beam crosses (≥3 of a kind,
   counted along the beam's path) pays; a beam that bends twice doubles. Bonus: "Hollow Sun" spins where mirrors are
   sticky. Prismite, dawnglass, sun-prism, shadow glass; wild = Dawn Lens. Pure trace function like `luminous.ts`
   `traceBeams` (re-use its turning rules for honesty with the world).

## Not done / follow-ups

- Real art: the symbols, the cabinet and the icons are procedural pixel art (no commission brief yet).
- Rune Drop / Seam Sweeper / Eclipse Ascent use the new deep-purse cap but have no chips or auto (their rounds are
  steered or single-shot; auto there needs its own stop rules).
- The machine's world plate is English (as every station plate); the panel title and the E line are EN + ES.
- The cascade film plays from the seed: if a future update changes the tables, an old record shows its settled
  result without the film (never a different one).
