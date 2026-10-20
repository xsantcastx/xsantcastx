# Skill trees — the Warlock's three pages (D2)

Owner, 2026-10-21: "spells — we need to work on spell trees or something". Code: `src/app/play/td/td-skills.ts`
(the skills, their tree / tier / column / prerequisite and per-rank growth), `src/app/play/td/td-tree.ts` (the rules),
`src/app/play/td/td-mobs.ts` (the fight), the Spellbook (K) in `side-scroller.component.*`.

## Rules (Diablo II)
- **Points**: one skill point per Hunting level from level 2 (`shared/keeper-look/skill-points.ts`
  `skillPointsEarned(level) = level − 1`; the leveling branch adds milestone bonuses). Points left = earned − spent.
- **Ranks** 1–20. A rank costs one point. A skill needs its **tier's level** (tiers open at 1 · 6 · 12 · 18 · 24) and
  **one rank in its prerequisite** (always the skill above it in the same tree).
- **Starting kit** (free rank 1, costs nothing, ignores gates): Ember Bolt, Hellfire Nova, Aura of Embers, Drain Life,
  Ember Curse, Dark Ward, Soul Harvest — a new Warlock fights exactly as before the trees.
- **Rank 0** = not learned: an active refuses ("Learn it in the Spellbook first"), it cannot be put on keys 1–4, an aura
  cannot run, a passive rests.
- **Respec**: free for now — the Reset button (asks once) returns every bought point; free ranks stay.

## Scaling
`value(rank) = base + grow × (rank − 1)` per var (`SkillDef.grow`); damage-like vars stay whole numbers, radii and
seconds round to 0.1, counts (`count`, `max`) take the whole part, so a skeleton or a spear arrives every few ranks.
Nothing ever shrinks with a rank (Karma checks every skill, ranks 1→20). Mana and cooldowns do not change with rank.
Spell power (level, Spirit, gear) multiplies the damage on top, as before.

## The trees

| Tier (level) | Ember (fire) | Bone (necromancy) | Shadow (curses & wards) |
|---|---|---|---|
| 1 (1) | **Ember Bolt** (passive staff bolt) 8–13 +2/+3 · **Hellfire Nova** 20–30, r3 +4/+6, r+0.1 · **Aura of Embers** 3 dps r3 +1 dps, r+0.1 | **Bone Spear** 22–32 +4/+6 · **Raise Skeleton** 2 (max 2), life 50, blow 7; count +0.15, max +0.25, life +10, blow +1 · **Soul Harvest** 8 mana a kill +1 | **Drain Life** 18–26, heal 50% +3/+5, +1% · **Ember Curse** 5 dps 8 s, −20% bites; +1 dps, +0.2 s, +1% · **Dark Ward** absorbs 40 for 12 s; +10, +0.5 s |
| 2 (6) | **Cinder Rain** ← Nova: 6–10 twice a second for 3 s in r2 around the target; +2/+3, +0.1 s, r+0.05 | **Corpse Burst** ← Bone Spear: the freshest corpse within 6 tiles bursts, 18–28 in r2; +4/+6 · **Skeleton Mastery** ← Raise: skeletons +10% life and blow, +5%/rank | **Aura of Siphoning** ← Drain Life: heal 2 per hit, +0.5 · **Weaken** ← Curse: foes within r2 of the target bite 25% weaker for 8 s; +1%, r+0.1, +0.3 s |
| 3 (12) | **Flame Wall** ← Rain: a 4-tile wall across the target, 8 dps for 5 s; +2 dps, +0.1 tile, +0.2 s | **Bone Armor** ← Soul Harvest: absorbs 30 for 15 s (before the ward); +8, +0.5 s | **Life Tap** ← Dark Ward: 20 life → 30 mana; +4 mana (never the last life) |
| 4 (18) | **Ember Mastery** ← Ember Bolt: +10% fire damage, +3%/rank | **Bone Storm** ← Corpse Burst: 5 spears in a fan (a ring with no foe), 14–22 each; +0.2 count, +3/+4 | **Doom** ← Weaken: after 4 s the target bursts for 50–80 to all within r2; +9/+13, r+0.05 |
| 5 (24) | **Meteor** ← Flame Wall: lands after 1 s for 60–90 in r2; +10/+14, r+0.05 | — | — |

Mana · cooldown: Cinder Rain 18 · 7 s, Flame Wall 22 · 10 s, Meteor 35 · 12 s, Corpse Burst 15 · 4 s, Bone Armor
18 · 16 s, Bone Storm 30 · 8 s, Weaken 12 · 8 s, Life Tap 0 · 10 s, Doom 28 · 14 s (the old skills unchanged).

Ember Mastery multiplies every fire hit: the bolt, the nova, the aura, the rain, the wall, the meteor and the Ember
Curse's burn. Weaken and the Ember Curse do not stack — a creature bites weaker by the stronger of the two.

## Saves
The tree lives on the Keeper look (`godforge-keeper-look`, synced): `tree: { spent, free, at }`. It merges on its own
clock — the newer tree wins **whole**, never a sum — and every read is clamped to the level (`clampTree`: unknown ids,
past rank 20, an unreached tier or a missing prerequisite drop; then, while over the level's points, the deepest tier
gives back first). A save from before the trees (no `tree`) is migrated: whatever sat on its bar and aura gets rank 1
free, so an old bar keeps working.

## Effects (docs/design/effects-spec.md, td-fx kit)
Cinder Rain: embers dropping out of the dark and bursting where they land. Flame Wall: a row of flickering flame
tongues. Meteor: a ground ring at the landing spot and a stone with a stepped fire tail falling from the upper left,
then the nova's ring and scorch at its radius. Corpse Burst: a bone-toned ring, a flash and bone chips. Bone Storm:
the Bone Spear's shafts. Bone Armor: four bone shards circling the chest. Weaken / Doom: the shadow ring; Doom marks
its target with a ticking pale skull.
