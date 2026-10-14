# Uncapped levels, Tibia-style (owner, 2026-10-14)

> "levels shouldn't be capped, we should do it like Tibia, I loved that game."

## The curve (`src/app/shared/activity/mining-level.ts`)

- Levels 1–99 are unchanged to the XP: `floor(100·(L−1)^2.2)`. Stored XP reads as the same level.
- Past 99, each level costs the 98→99 step (`MASTERY_STEP` = 53,607) × (L/99)². The step grows with the
  square of the level and the total with its cube (Tibia's own curve is cubic). Closed form:
  `xp(L) = xp(99) + floor(53,607 · (S(L) − S(99)) / 99²)`, `S(n) = Σk²`.
- 99→100 costs 1.02× the step to 99, so the curve is continuous. Totals: 99 2.40M · 100 2.46M · 150 6.82M ·
  200 15.3M · 300 50.1M · 1,000 1.83B. All exact integers up to `LEVEL_SEARCH_LIMIT` (10,000). That limit
  is a bound for the binary search, not a cap: reaching it would take about 100,000 years.
- `MAX_SKILL_LEVEL` is gone. `MASTERY_LEVEL` (99) is the mastery row. `miningLevelView().next` is always set
  (null only at the search limit). `levelForXp()` walks levels to 99, then binary-searches.
- `formatXp()` prints "53,607", then "240K", "2.4M" and "1.83B". It is used by the skills panel and the
  Current Work tile.

## Time to level (`node scripts/economy-sim.mjs --levels`; also part of `--check`)

Active hours past 99, at the best rate a level-99 Keeper has. Rates are capped, so level 300 earns XP as fast as 99.

| skill | XP/min | →100 | →150 | →200 | →300 |
|---|---|---|---|---|---|
| Mining | 443 | 2.1 h | 166 h | 485 h | 1.8k h |
| Foraging | 554 | 1.6 h | 133 h | 388 h | 1.4k h |
| Prospecting | 456 | 2.0 h | 162 h | 471 h | 1.7k h |
| Fishing | 227 | 4.0 h | 324 h | 946 h | 3.5k h |
| Woodcutting · Smithing · Delving · Enchanting · Hunting | ≈450 (median) | 2.0 h | 164 h | 478 h | 1.8k h |

The sim checks three things. Levels 1–99 match the old formula. The 99→100 step is within 3% of the step
to 99 and takes under 5 h even at Fishing's rate. Level 300 takes between 500 and 5,000 h at the fastest
rate. The five skills marked ≈ have no per-minute model of their own yet, so the table uses the median of
the four measured skills.

## Tools (`src/app/shared/skills/tool-level.ts`)

- Up to 99, nothing changes: up to −25% swing time and ×1.5 power.
- Past 99, each level adds `beyond = n/(n+100)` (n = levels past 99) of a further −10% swing and +0.5 power:
  - level 199: −30% swing, ×1.75 power
  - level 299: −31.7% swing, ×1.83 power
  - the limit, never reached: −35% swing, ×2.0 power (`MAX_LEVEL_POWER`)
- The engine's `MAX_POWER` clamp is now 2.
- The 0.25 s swing floor (tools.ts and the engine's `MIN_SWING`) is untouched. Pickaxe IV already hits it at 99.
- `levelGain` prints two decimals below 0.1 points. When a level's power gain rounds to 0, the level-up
  banner drops the tool line.
- Rewards are capped. Node tests prove that paid Delve XP per minute is identical at 300 and 99, and that
  Woodcutting harvests in two minutes are identical at 300 and 99.

## Titles (`skill-titles.ts`, `skill-titles.i18n.ts` lazy, EN+ES)

- A title at 100, then every 25 levels: 8 per skill (100…275). From 300, every 25 levels adds "+1", "+2"…
  to the last title, forever.
- The list is in the i18n table and in `docs/world/lore-addendum.md`. Every ladder ends with "Eclipse …".
- In `skill-unlocks.ts` they are `kind: 'title'` rows, the only rows above 99, so nothing is gated past 99.
  `nextUnlock` never returns null now: past the last authored title it names the next "+N".
  - `describeUnlock` returns a `nameKey` for title rows. Translate them with `unlockText` / `wordsText`.
- Where titles show up:
  - The skills panel shows the title under the skill name, plus an "into / span XP to level N" line in K/M.
  - Character → Stats has a new **Titles** block (`app-skill-titles`), with one Wear / Take off button per title.
  - The worn title shows beside the rank line (`.ht__worn`). This is the name-tag flourish.
    - It is a device preference (`WornTitleService`, key `godforge-worn-title`) that stores only the skill id.
      The title is re-derived from XP, so it can't outrun progress.
  - The level-up banner gives every title level the milestone treatment (fanfare, bigger card) and adds a
    "Title earned: …" line. The words are lazy-loaded.

## Tests

- Node (`seamworks-engine.test.cjs`):
  - curve continuity, monotonic and exact to level 1000, the `levelForXp` round trip, `formatXp`
  - the tool asymptote and the floor at every level from 100 to 1000
  - the engine clamp at 2
  - rewards per minute at 300 equal those at 99
- Karma: `mining-level.spec`, `skills.spec` (titles, EN/ES, nothing gated past 99, `nextUnlock` past 300),
  `level-up.service.spec` (title milestones and stars), `fishing.model.spec`.
- e2e (`play-tool-tiers.spec.ts`):
  - A Mining 120 save swings 0.38 s (0.39 at 99) with ×1.59 power. It has Vein-Reader and can wear it.
    Tools reads −27%.
  - A phone at 375 px with a Mining 300 card shows "300", "Eclipse Hewer +1", "1,234 / 496K XP to level 301",
    and no overflow.
