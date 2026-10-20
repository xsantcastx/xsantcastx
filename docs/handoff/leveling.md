# Handoff — Leveling to 10,000 (2026-10-21)

Design: `docs/design/leveling.md` (the curve, what a level gives, the milestone table, the moment, the save).
Sim: `node scripts/economy-sim.mjs --leveling` (in `--check`). Branch `leveling`.

## What a player gets
- **A Keeper level that moves**: Hunting XP on a dedicated curve — level 10 in the first hour, 50 in ~16 h, 1,000 and
  10,000 for the long haul (≤ 4.5 h a level with content at pace). Old saves read the same or higher, never lower.
- **The level-up moment**: a cozy banner ("Level 12!") listing exactly what came (+life, +mana, +power, attribute
  points, skill points, each milestone and the Gold it actually paid), Spend points (C) / Spellbook (K) buttons; a
  pixel light pillar on the Keeper (`td-engine levelPillar`, `td-fx LEVEL_UP`); the `levelup` chime; the badge hops.
- **28 milestones** (5 … 10,000): titles worn under the name, portrait frames (copper → starlit), small passives on
  the sheet's totals, attribute/skill-point batches, one-time Gold and three gear pieces (iL 10/30/50).
- **The sheet (C)**: XP to the next level, the next milestone and its rewards, tabs Attributes | Milestones (5 a page,
  Reached / Next / Later, the title pick).

## Code
- `shared/skills/keeper-level.ts` — curve, `levelSteps` (stat taper past 100), `levelAttributePoints`, `LEVEL_GROWTH`.
- `shared/skills/keeper-milestones.ts` — `MILESTONES`, derived rewards, `levelUpSummary`.
- `shared/skills/keeper-milestones-save.model.ts` + `keeper-level.service.ts` — `godforge-keeper-level` (synced
  progress/keeper-level): receipts first, unioned; title picks.
- `shared/keeper-look/skill-points.ts` — `skillPointsEarned(level)` = L−1 + `MILESTONE_SKILL_POINTS` (for the
  Warlock skill tree on `spelltree`; leveling does not touch spell numbers).
- `SkillActionService.act` → `KeeperLevelService.check` for every Hunting grant (kills and town tasks).
- `td-skills levelStats` reads `levelSteps`; `keeper-look pointsLeft(level, stats, earned?)`; attribute save ceiling
  999 → 99,999.

## Tests
- Karma: `keeper-level.spec.ts` (monotone, all 10,000 levels ≤ the skill curve, inverse, bounded stats, points),
  `keeper-milestones.spec.ts` (table, words, summary, skill points, merge, pays once, backlog, titles).
- e2e: `e2e/td-leveling.spec.ts` — seeded 25 XP short of 10, Mara Voss's hand-in crosses it; banner, receipt, sheet,
  title; desktop + phone. Screenshots `docs/handoff/cozy-ui/levelup-{desktop,phone}.jpg`, `levelup-sheet-*.jpg`.

## Not done
- Title on the in-world nameplate; hood/staff/aura cosmetics (portrait frame only).
- Content past level ~34; creatures past level ~160 need the 500-XP kill cap chunked.
