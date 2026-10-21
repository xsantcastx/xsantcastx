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

## The common page (design-bible §4.6)
A fourth tab, **Common**: the spells every vocation learns, bought with the same points, no element (the sky does not
touch them). **Light** (*lum*, level 1, free in the starting kit): +3 tiles of the Keeper's light and Glim's for 300 s;
+0.1 tile and +15 s a rank; 10 mana · 3 s. **Seek** (*lum vesh*, level 8 — `SkillDef.level` overrides the tier's): Glim
points at the fallen purse, the nearest boss or a task to hand in (`td-seek.ts`); the arrows hold 6 s, +0.5 s a rank;
20 mana · 8 s; nothing to seek spends nothing. Typed with a name (`lum vesh ember warden`) it seeks that one.

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

## The Ashguard's three pages (design-bible §4.4, 2026-10-21)
The second vocation: the Pyre Watch's melee knight. Code: `td-ashguard-skills.ts` (the book), `td-melee.ts` (the arc,
the blow, crowd control on bosses, the guard, the vow), `td-mobs.ts` (the blade and the spells), `td-ashguard-fx.ts`
(the pictures), `td-ashguard.i18n.ts` (EN + ES). Same rules as the Warlock's: tiers at 1 · 6 · 12 · 18 · 24, one rank
in the prerequisite, ranks 1–20, `clampTree` per class (another class's points never count), synergies only from
bought ranks. The basic attack is the **Watch Blade**: a swing in a 110° arc in front, 1.6 tiles deep, every 0.8 s
(Agility and cast speed quicken it), striking every creature in the arc — it replaces the staff's bolt.

| Tier (level) | Brand (fire on the blade) | Oath (shield, taunt, guard) | Ash (endurance) |
|---|---|---|---|
| 1 (1) | **Watch Blade** (passive swing) 9–14 +2/+3 · **Ember Brand** *brann vael sha* 8 s: blows +40% as fire and a 6 burn over 3 s; +5%, +1, +0.3 s · 12 · 12 s | **Shield Bash** *brann mur* 10–16 and a 1.2 s stun (bosses ⅕); +2/+3, +0.05 s · 8 · 6 s · **Shield Oath** *brann ka* 6 s: blocks 30% of blows whole; +1%, +0.2 s · 12 · 16 s | **Ash Stride** *brann sha* charge 3 tiles, 80% of a blow, knock back 1 tile (not bosses); +5%, +0.05 tile · 10 · 7 s · **Watchfire** (aura) *brann hesk ka* +10 Defense, 1 life/s; +3, +0.2 |
| 2 (6) | **Cinder Cleave** ← Brand *brann vael mur*: a 160° arc 2 tiles deep, 120% as fire; +6% · 14 · 5 s | **Watch Cry** ← Bash *brann orum*: taunts all within 4 tiles 3 s (bosses ⅕), you take 15% less; +0.1 s, +0.5% · 10 · 10 s | — |
| 3 (12) | — | **Hold the Line** ← Oath (passive): below 40% life, +20% Defense; +2% | **Ember Blood** ← Watchfire (passive): 3% of damage dealt heals; +0.2% |
| 4 (18) | **Whirl of Cinders** ← Cleave *vael orum brann*: 4 turns in 2 s, each 60% as fire in r2; +4%, r+0.05 · 26 · 10 s | — | — |
| 5 (24) | — | — | **Vow of the Last Watch** ← Ember Blood *brann ul ka*: 8 s you cannot fall below 1 life, then 25% of what it held heals; +0.2 s, +1% · 30 · 60 s |

Synergies (a tree, no loops): Ember Brand +4% duration / rank Ember Blood · Cinder Cleave +5% damage / rank Ember Brand
· Whirl +5% damage / rank Cinder Cleave · Shield Oath +5% duration / rank Hold the Line · Watch Cry +6% duration /
rank Shield Oath · the Vow +5% duration / rank Hold the Line.

**Starting kit** (free rank 1): Watch Blade, Shield Bash, Ember Brand, Ash Stride, Shield Oath, the Watchfire, Light;
keys 1–4 are Bash · Brand · Stride · Oath, the Watchfire runs. **The body**: life ×1.3 and mana ×0.6 of the Warlock's
at every level, and Defense of his own (8 + 1 a level) under the gear's (`td-skills VOCATION_BODY`).
**Gear**: items ask for a level and an attribute, never a class, so everything is wearable; the Ashguard keeps the
existing weapon slot — whatever is in hand is drawn in it, and the blow is the Watch Blade's (ranks × spell power).
**Saves**: a look with no `vocation` (every Keeper made before) is a Warlock; a made Keeper keeps the calling he was
made with (the Glass locks the other card).
