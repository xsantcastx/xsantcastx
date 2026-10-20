# Leveling — the Keeper's level, 1 to 10,000

Owner, 2026-10-20: *"leveling is getting better, but I just don't know what happens when I reach the next level or
milestones — we need someone working on leveling up to 10k, maybe it's going to be hard but yeah."*

This file is the design. Code: `src/app/shared/skills/keeper-level.ts` (the curve, stat growth, points),
`keeper-milestones.ts` (the table and the level-up summary), `keeper-milestones-save.model.ts` (the save),
`keeper-level.service.ts` (the moment and the one-time pay), `src/app/shared/keeper-look/skill-points.ts` (skill
points for the Warlock skill tree), the HUD in `play/side-scroller.component.*`, the light pillar in
`play/td/td-engine.ts`. Numbers are checked by `node scripts/economy-sim.mjs --leveling` (also in `--check`); when
this file and the sim disagree, the sim wins.

## 1. The curve

The Keeper's level is **Hunting XP read on its own curve**. The Hunting *skill* still reads the shared skill curve
(`mining-level.ts`, nine skills use it) and is untouched; the Keeper level is fed by the same XP — every kill
(`huntingXpFor`: HP ÷ 5) and every town task.

```
levels 1–50   xp(L) = floor(12 · (L−1)^2.6)
levels 50+    xp(L) = xp(50) + floor(A · ((L−1)^2.4 − 49^2.4)),  A = 13 · 49^0.2  (the step is continuous at 50)
```

| Level | Total XP | Hours, today's content | Hours, content at pace | Hours for one level (pace) |
|---|---|---|---|---|
| 10 | 3.6k | 0.6 | 0.6 | 0.13 |
| 30 | 76k | 5.8 | 5.8 | 0.35 |
| 50 | 298k | 16 | 14 | 0.5 |
| 100 | 1.72M | 81 | 45 | 0.7 |
| 500 | 85M | 3.9k | 474 | 1.35 |
| 1,000 | 448M | 20k | 1.3k | 1.8 |
| 5,000 | 21B | — | 12k | 3.4 |
| 10,000 | 113B | — | 32k | 4.5 |

Model (sim): 240 kills an hour including walking and looting; a top-down creature of level *m* has ~30 + 12.5·m HP
(Ash Wolf 45 at 1, Lava Hound 120 at 10, Thorn Weaver 380 at 28), so it pays ~6 + 2.5·m XP — **monster XP scales
with monster level through its HP**, and new continents must keep that rule. The first hour also hands in the
Seamworks' six tasks (360 XP).

- **Town bands fit:** Ember Isle 1–8 in the first hour; the Reach 8–30 over the next five; Verdant 15–40 and the
  Marches 25–50 by ~16 hours.
- **"Today's content" stops at level 34** (the Mossbound Colossus). Past ~60 the climb needs new continents: at a
  fixed level-34 creature, 100 takes 81 h and 1,000 takes 20k h. With creatures at the Keeper's level ("pace"), the
  XP a level costs grows like L^1.4 while a kill grows like L, so **a level never takes more than ~4.5 hours**, even at
  10,000 — long (32k hours in all: a lifetime, Tibia-hard) but each level stays humane.
- **The kill cap:** the gateway caps one action at 500 XP (`WORLD_ACTION_MAX_XP`); a creature past level ~160 would
  hit it. Content past 160 must chunk its grant like the town tasks' `xpGrantChunks` (or the cap is raised).

**Saves never drop.** Every level of this curve costs less XP than the same level on the skill curve (max ratio 0.71,
at 114), so any stored total reads as the **same or a higher** level than the Hunting level it showed before
(`keeper-level.spec.ts` walks all 10,000 levels; the sim checks it too). A Hunting-10 Keeper (12.6k XP) wakes at 15.

## 2. What a level gives

| | 1 → 100 | 100 → 1,000 | 1,000 → 10,000 |
|---|---|---|---|
| Life / mana / spell power | +8 / +6 / +5% per level (unchanged) | log taper: `99 + 50·ln(1 + (L−100)/50)` level steps | same taper |
| Attribute points | 5 a level (D2) | 1 a level | 1 per 10 levels |
| Skill points | 1 a level from 2 | 1 a level | 1 a level |

- **Stats stay bounded.** `levelSteps(L)` is exactly L−1 to 100 (today's balance holds, `levelStats(50)` is
  unchanged) and grows by a log past it: 1,000 → 246 steps, 10,000 → 364 (life ~3,000, power ~19×). Gear carries the
  rest. Spec: life < 5,000, power < 25× at 10,000.
- **Points taper after 100** (decided): a point keeps its meaning — one Vitality is always 6 life — but more points
  would make the sheet a wall of thousands. 495 at 100, 1,395 at 1,000, 2,295 at 10,000, plus the milestones' batches.
  The per-attribute save ceiling was raised from 999 to 99,999 so no spent point is ever dropped.
- **Skill points** live in `src/app/shared/keeper-look/skill-points.ts`: `skillPointsEarned(level)` = L−1 plus
  `MILESTONE_SKILL_POINTS` (the milestones' bonus rows). They are *spent* by the Warlock skill tree (branch
  `spelltree`), which owns spell ranks; leveling never changes a spell's numbers.

## 2b. Speed by level (Tibia; owner 2026-10-21: "the higher level the faster they move")

    pace(L) = 0.60 × (1 − e^(−(L − 1)/400))          keeper-level LEVEL_SPEED, levelSpeedBonus

+0.15 % a level at first: +1.3 % at 10, +7 % at 50, +13 % at 100, +24 % at 200, +38 % at 400, +55 % at 1,000, +60 %
(the cap) from ~3,000. It multiplies the rest of the Keeper's speed — walk = 74 px/s × (1 + pace) × (1 + Agility and
worn Move Speed, capped 40 %) × Haste — so it never eats the gear cap. The pet and the raised skeletons move by the
same factor, so they keep up; the camera is locked to the Keeper. The sheet's **Speed** row shows the total.

## 3. Milestones

| Level | Gives |
|---|---|
| 5 | title *the Kindled* · 206 Gold (3 min of a level-5 hunt) |
| 10 | +1 skill point · **copper** portrait frame · an Uncommon Keeper's Cowl (iL 10) |
| 15 | title *Ash-Walker* · +1% spell damage |
| 20 | +5 attribute points · 2,560 Gold (10 min) |
| 25 | title *Warden of the Reach* · +1% movement speed |
| 30 | +1 skill point · **bronze** frame · a Rare Keeper's Staff (iL 30) |
| 40 | title *Wildstrider* · +1% crit chance · 8,640 Gold (15 min) |
| **50** | title *Keeper of the Eclipse* · +2 skill points · **silver** frame · +10 points · ~23k Gold (30 min) · an Epic Infernal Cuirass (iL 50) |
| 75 | title *Lord of the Marches* · +5 points · +1% cast speed |
| **100** | title *the Hundredfold* · +2 skill points · **gold** frame · +10 points · +2 All Resist · ~121k Gold (60 min) |
| 200–900 (every 100) | +1 skill point each, alternating +1% passives (200 spell dmg, 400 speed, 600 spell dmg, 800 crit) and +5 points (300, 500, 700, 900); titles *Emberbound* (300), *Lantern-Bearer* (500, + ~2.7M Gold, 90 min) |
| **1,000** | title *the Thousandfold* · +3 skill points · **eclipse** frame · +20 points · +3 All Resist · ~13.2M Gold (120 min) |
| 1,500–4,500 (every 500) | +1 skill point each, alternating +1% passives and +10 points; title *Starwright* (2,000) |
| **5,000** | title *Who Walks the Eclipse* · +2 skill points · +20 points · ~612M Gold (240 min) |
| **10,000** | title *Keeper of the Long Night* · +5 skill points · **starlit** frame · +50 points · +5% spell damage · ~4.85B Gold (480 min) |

Every reward is used and visible: titles are worn under the name on the portrait (picked in the sheet), frames recolour
the portrait, passives add to the sheet's totals (under the gear caps), points are spent in the sheet, skill points in
the Spellbook, Gold as a fixed sum — N minutes of a steady hunt at that level, `huntGold(L, N·60)`, since the forge's income is off — through `EconomyService.earnGold` (source `keeper:level-<L>`), gear through
`mintEquipment` under a fixed id `keeper-milestone-<L>` (existing item definitions only — no new item, so
`check:meaning` has nothing new to judge). Lore for the titles: `docs/world/lore-addendum.md`.

## 4. The level-up moment

When Hunting XP crosses a Keeper level (`SkillActionService` → `KeeperLevelService.check`, so kills and town tasks
both announce; never on page load):

- **The banner** — a cozy wooden window at the top centre (full-width under the vitals on phones) titled
  *"Level 12!"*, listing exactly what came: *"+8 life · +6 mana · +5% spell power"*, *"+5 attribute points"*,
  *"+1 skill point"*, and each milestone crossed with its rewards (the Gold line shows what was actually paid). Buttons:
  **Spend points** (opens the sheet, C) and **Spellbook** (K), both ≥ 44 px. It stays 10 s (16 s for a big one) or
  until closed. A multi-level jump announces once, at the level reached, summing everything.
- **The light pillar** — a stepped column of warm light (cream core, lantern glow, brass edge: `td-fx LEVEL_UP`) stands
  on the Keeper for 1.3 s (1.8 s and taller for a big milestone), motes climbing it and an 8–10-pixel spark ring at his
  feet; it lights the night. Effects-spec rules: pixel only, ≤ 60% opacity over the body, reduced motion draws it still.
- **The sound** — the sound director's `levelup` cue.
- **The badge** — the portrait's level badge hops (stepped, still under reduced motion) and takes the frame's metal.

**The sheet (C)** shows *"N XP to level L+1"*, the next milestone and what it gives, and two tabs: **Attributes**
(the points, with the skill points earned beside them) and **Milestones** — five a page with pixel ◀ ▶, each
*Reached* / *Next* / *Later*, and the title pick (◀ name ▶). No scrolling column at 390×844.

## 5. The save

`godforge-keeper-level` (synced: `progress/keeper-level`), written only by `KeeperLevelService` through the
`GameStateGateway`, registered with `LocalSaveRegistry`:

```
{ version: 1, claimed: [milestone levels whose Gold/gear was paid], title: '<id>' | '', titleAt }
```

- **Receipt first:** every due milestone is written to `claimed` before any coin moves; the merge **unions** `claimed`,
  so two devices that both cross 50 pay it once. A save that passed milestones before they existed is paid once when
  /play opens.
- **Everything else is derived from the level** (points, skill points, passives, frames, titles earned), so it can
  never be granted twice nor lost in a merge. The worn title: the later pick wins whole.
- The level itself is never stored — it is Hunting XP (the activity ledger) read on the curve.

## Not yet

- Titles on the in-world nameplate (the engine's name tag) — HUD portrait only for now.
- Cosmetics beyond the portrait frame (hood colour, staff glow) — the painter belongs to the art pass.
- Content past level ~34: the curve is ready to 10,000; the world is not.
