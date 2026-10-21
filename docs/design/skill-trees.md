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
existing weapon slot — whatever is in hand is drawn in it, and it lends the swing its damage (below).

**The weapon in the swing** (2026-10-21, `td-melee weaponSwing`). A blow is `(Watch Blade roll min..max + weapon flat) × mult × pct%`,
then the Brand's %, then spell power (level, Spell Damage worn). The weapon's *power* is its Strike (the legacy head stat)
plus a quarter of its Spell Damage % (the affixed head stat): `flat = round(3 × max(0, power − 1))`, `mult = 1`.
The starter Basalt Edge (Strike 1) is power 1, so it adds nothing and swings exactly the numbers the book shows. With
**nothing in hand** the Keeper fights bare-handed: `flat = 0`, `mult = 0.85` (a fifth lighter, still a swing).
Examples, Watch Blade rank 5 (17–26 base, power ×1): bare hands 14–22 · Basalt Edge 17–26 · Dawnrender (Strike 1.7)
19–28 · a rare with 12% Spell Damage (power 3, flat +6) 23–32, and its 12% lifts the spell power on top. Cinder Cleave,
the Whirl and Ash Stride roll the same blow (their % of it), so the weapon counts in all of them. Shield Bash is the shield's
and keeps its own roll.

**The sky** (`td-phases` PHASE_RULES): Brand keeps Ember's hours (+10% day, −10% night, −15% eclipse), Ash gains a little
after dark (+5% night, +10% eclipse), Oath is neutral (the shield keeps no hour). It scales the tree's damage numbers (the
Watch Blade's roll, hence every blow built on it) and the Spellbook card's phase line shows it like the Warlock's
("Eclipse now: −15% power") on any skill that has a damage number.
**Saves**: a look with no `vocation` (every Keeper made before) is a Warlock; a made Keeper keeps the calling he was
made with (the Glass locks the other card).

## The Lanternwright's three pages (design-bible §4.3, 2026-10-21)
The third vocation: the lamp-keepers' own, Glim's order — support, healer, the undoing of the dead. Code:
`td-lantern-skills.ts` (the book), `td-lantern.ts` (light on the dead, heals in whole ticks, Banish's unmaking, Last Light,
the carried light and its shutters), `td-mobs.ts` (the flare and the spells), `td-lantern-fx.ts` (the pictures),
`td-lantern.i18n.ts` (EN + ES). Same rules as the other two: tiers at 1 · 6 · 12 · 18 · 24, one rank in the prerequisite,
ranks 1–20, `clampTree` per class, synergies only from bought ranks. The basic attack is **Kindle**: a flare of light
thrown at a foe within 4 tiles every second (Agility and cast speed quicken it) — shorter than the Warlock's 7-tile bolt.

**Light on the dead.** Every light blow (Kindle, the Flash, Banish, the wisps' and the beacon's motes, the dawn) lands
×1.5 on the dead and the dark-born: the `bone` and `shade` families (creature-families.ts) and the night's wraiths,
ghouls, wisps and drowned (`td-lantern shadowBorn`).

| Tier (level) | Lamp (light as a weapon) | Hearth (mending, wards) | Moth (the lantern's kin) |
|---|---|---|---|
| 1 (1) | **Kindle** (passive flare) *lum sha* 7–11 +2/+3, 4 tiles · **Blinding Flash** *lum orum* 8–12 to all within 3 tiles, the dead stunned 2 s (bosses ⅕); +2/+3, r+0.05, +0.1 s · 14 · 8 s · **Lantern Aura** (aura) *lum ka* light +2 tiles, foes within 3 bite 10% weaker; +0.1, +0.05, +0.5% | **Hearthlight** *hesk ka* 30 life over 3 s; +6 · 12 · 6 s | **Lamp-Wisp** *lum teth* 1 wisp (+0.1 a rank) 30 s, a 4–7 mote each second at 5 tiles; +1/+2, +1 s · 18 · 12 s |
| 2 (6; the shutters at 1) | **Shutter the Lantern** *lum un ka* (level 1): shut, the lantern's and the aura's light go and the Light spell goes out; again, open · 0 · 1 s | **Hearth Circle** ← Hearthlight *hesk orum* r3 for 10 s: you mend 4/s inside, foes walk 20% slower, the Hush cannot rise; +1/s, r+0.05 · 24 · 14 s | **Moth-Kin** ← Wisp (passive): the kin's motes +10%; +3% |
| 3 (12) | **Banish** ← Flash *lum un* 30–46 to one within 6 tiles; one of the dead at ≤ 25% life after it is unmade (a boss of the dead takes ×1.5 instead); +6/+9 · 22 · 6 s | **Lantern Ward** ← Hearthlight *lum hesk ka* absorbs 50 for 12 s; breaking, it blinds all within 3 tiles 2 s (bosses ⅕); +10, +0.3 s · 20 · 18 s | **Beacon** ← Wisp *lum dra* a lantern on a pole 12 s, a 6–10 mote each second at 5 tiles, a fixed light; +2/+3, +0.3 s · 26 · 16 s |
| 4 (18) | — | **Last Light** ← Hearth Circle (passive): once every 600 s a fatal blow leaves you at 1 life, 3 s untouchable; +0.1 s | — |
| 5 (24) | **Dawn at Noon** ← Banish *lum ul orum* a disc of daylight r4 for 8 s where you stand: the night opens over it, the dead and the dark-born inside burn 14/s, the dark layer's shapes inside are unveiled and leave, every foe inside takes +15%; r+0.05, +0.2 s, +3/s · 40 · 45 s | — | — |

Synergies (a forest, no loops): Lantern Aura +2% radius / rank Kindle · Blinding Flash +4% radius / rank Lantern Aura ·
Banish +6% damage / rank Kindle · Dawn at Noon +5% damage / rank Banish, +4% radius / rank Blinding Flash · Hearth
Circle +4% heal / rank Hearthlight · Lantern Ward +5% absorb / rank Hearth Circle · Lamp-Wisp +6% damage / rank Moth-Kin
· Beacon +5% duration / rank Lamp-Wisp.

**Starting kit** (free rank 1): Kindle, Hearthlight, Blinding Flash, Lamp-Wisp, Shutter the Lantern, the Lantern Aura,
Light; keys 1–4 are Hearthlight · Flash · Wisp · Shutter, the Lantern Aura runs. **The body**: life ×0.9 and mana ×1.4 of
the Warlock's at every level, no Defense of its own (`td-skills VOCATION_BODY`). **The light**: the lantern on its pole is
+2 tiles of the Keeper's own light (`td-lantern VOCATION_LIGHT`), the aura adds its own, the Light spell stacks on top.
**The look**: a cream wool hood, a brass-buttoned coat, soft boots and the lamp-staff (a pole with a lit lantern on its
head, `GearPiece.variant 'lamp'`); a worn staff becomes a lamp-staff, any other worn weapon leaves the lantern to the
off-hand.

**The sky** (`td-phases` PHASE_RULES): the light is needed most when it is darkest — Lamp −5% by day, +15% at night, +30%
under an eclipse; Moth +10% / +15%; Hearth +5% / +10%, and on the Hearth the sky moves the **heal** (`skyVars`), so the
Spellbook card's phase line shows on Hearthlight and the Hearth Circle too.

**The dark** (td-dark): a shy chest shows only while the Keeper's raised light is none, and a Lanternwright always carries
some. *Shutter the Lantern* puts it all out but a worn unique's (and the Light spell with it); a closed chest tells him
so ("Shutter the Lantern to let your light burn low"). Speaking *lum* again opens the shutters. The Hearth Circle counts
as a lit hearth for the Hush (it cannot rise inside); a Beacon and a disc of Dawn are fixed lights the dark-born shy from.

