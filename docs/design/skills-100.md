# Skills to level 100: the four callings' books (design)

Written by the Dungeon Master on 2026-10-26, on branch `dm-design`. The owner's notes were:
- every class gets skills up to level 100;
- every attack gets an animation and a sound;
- better AoE, plus lightning, fire, ice and weather;
- some classes lean PvP, some lean levelling, some lean healing;
- bosses that need a healer, AoE and a tank.

**Companion pages.**
- `skill-book.md` is the book UI, the Spellstones and the save migration.
- `monsters-abilities.md` covers what these skills answer: auras, raisers, party mechanics.
- `world-acts.md` covers the weather these skills ride, and PvP.

**What this doc replaces.**
- It extends `skill-trees.md`. The shipped numbers there stay exactly as they are unless a row here says *rebalanced*.
- It replaces skill-trees.md's tier rule (1 · 6 · 12 · 18 · 24) with per-skill unlock levels.
- It replaces its standalone passives with **modifier nodes**, as in the owner's reference (`refs/skill-book-ref.jpg`).

**Canon.** Lore ties are in `docs/world/canon.md`:
- §4.2 for the callings and their roles;
- §6.1 for the new Cant roots *vor* and *rim*;
- §6.3 for Spellstones.

Every player-facing name is given here in EN / ES (house style: no diacritics, no ñ).

---

## 0. Rules (all four books)

### 0.1 Roles (canon decision, 2026-10-26)

| Calling | Role | In a party | PvP | Levelling alone |
|---|---|---|---|---|
| **Ashguard** | **the tank** | holds threat (Watch Cry, Brand Throw, Hold the Gate); soaks (Shield Oath, the Vow); party damage cut (Banner of the Watch, the Unbroken Line) | a strong duellist: stuns, a charge, a long fight | steady; his arc clears packs (his identity, kept) |
| **Lanternwright** | **the healer**, the party's only true one, and the bane of the dead | ally heals, Cleanse, Rekindle (revives a fallen ally), wards, Hearthsong | a weak killer who is hard to kill; reveals the hidden | slowest, except against the dead and the dark-born (×1.5) |
| **Warlock** | **AoE damage** (fire, rime, bone minions, curses) | clears the add waves; curses the boss (Weaken, Doom) | middling: drains and curses | fastest |
| **Thornstrider** | **single target** and **weather control**, with a PvP lean | burns the boss; interrupts; roots adds; calls rain, fog and thunder | the strongest: burst, roots, Fogwalk, Hunter's Mark | good, with the beast |

**Identities moved** (canon §4.2 is updated to match):
- The Lanternwright's Hearth tree now heals **allies**. Hearthlight targets the lowest ally in reach, and Hearth Circle mends the whole party inside it. It was self-only.
- The Ashguard gains the party tools (Banner, Intercept, Hold the Gate).
- The Thornstrider's third tree is retitled **Briar & Sky** / *Zarza y Cielo* (code id `briar` kept). The weather is the wild's too.
- The Warlock's Shadow tree gains **rime** (grave-cold). The cold of the dark is already the shade family's element.

### 0.2 The book: rows and nodes

**Rows.** Each tree is one spread of the book (`skill-book.md`). Each **row is one skill** of one of these kinds:
- Active skill / *Habilidad activa*
- Aura / *Aura*
- Basic attack / *Ataque basico*
- Utility / *Utilidad*

**Passives no longer have rows.** Every shipped passive becomes a **node** under the skill it fed (§6 lists each one).

**Ranks.** Ranks 1–20 per row, bought with skill points, as before:
- `value(rank) = base + grow × (rank − 1)`;
- whole numbers for damage, 0.1 for tiles and seconds;
- spell power multiplies damage and heals.

The rank needs the row's **unlock level**. There is **no prerequisite chain any more**: the book's order is the
prerequisite. A row opens at its level, and the first rank in it needs one rank in **any** earlier row of the same tree.
This keeps D2's "walk down the page" without dead skills.

**Nodes.** Six per row, as in the reference: **two branches of three**, drawn left to right under the row.
- **A, Edge** / *Filo*: what it does, harder.
- **B, Craft** / *Oficio*: how it does it (shape, reach, cost, rider).

Node rules:
- A node costs **1 skill point**.
- A node needs the row's rank: node 1 at rank 1, node 2 at rank 5, node 3 at rank 10.
- Nodes go in order along their branch (A1 before A2).
- **The two third nodes (A3★ and B3★) are a choice.** A row takes one star, never both, so a row holds at most **5 nodes**.
  The star is the build, and a Spellstone records it.

**Points.** `skillPointsEarned(level)` is unchanged: L − 1 plus the milestone bonus, so **105 at level 100**. A row
fully taken is 20 ranks + 5 nodes = 25 points. At 100 a Keeper fills about four rows, or spreads wider: a D2 choice.
Gear's `+skill ranks` adds ranks only, never nodes. **Respec stays free for now** (the book's Reset). After the
migration (skill-book.md §6), every Keeper gets a parchment note and an untouched book.

**Synergies.** The shipped D2 synergies stay, with the SYN_CAP of +100% kept. New rows list theirs. A synergy reads
**ranks only**, never nodes.

**Node grammar.** One `NodeDef` type covers every node in this doc, and the builder implements each verb once:

| Verb | Example | Field |
|---|---|---|
| `pct` | +15% damage / heal / absorb / radius / duration / count | `{ var, pct }` |
| `flat` | +1 tile, +2 s, +1 projectile | `{ var, add }` |
| `cd` | −2 s, or −20% cooldown | `{ cd: -2 }` / `{ cdPct: -20 }` |
| `mana` | −25% mana | `{ manaPct: -25 }` |
| `rider` | adds a status from §0.4 on hit | `{ status, secs, chance? }` |
| `shape` | +1 pierce / chain / split / second ring / ring becomes a line | `{ shape, n }` |
| `proc` | on kill / on cast / on crit / on block, do X | `{ on, effect }` |
| `party` | the self effect also lands on allies within N tiles | `{ party: N }` |
| `scale` | +X% per rank of this row (a folded passive keeps its growth) | `{ var, perRank }` |

### 0.3 Unlock ladder
Rows open at **1, 6, 12, 18, 24, 30, 36, 42, 50, 60, 70, 85, 100**.

The shipped rows keep their shipped levels. Content stops at 50 today (the Ink Abbess). Rows past 50 are buildable now,
but the sim shows them only against rule-level creatures (§7).

### 0.4 Statuses: the one table (monsters-abilities.md reads this)

| Status / ES | Effect | Default length | On bosses | Pip |
|---|---|---|---|---|
| Burn / *Quemadura* | fire every 0.5 s at the source's dps | source | full | ember |
| Chill / *Escarcha* | −30% move and attack speed | 3 s | slow full, length ⅕ | pale-blue pip and frost rim |
| Freeze / *Congelacion* | cannot move or act; then immune to Freeze 4 s | 1.5 s | 0.3 s, then Chill | ice block |
| Shock / *Descarga* | the next hit taken +20%, then jumps to 1 foe within 3 tiles (once) | 4 s | full | yellow spark |
| Wet / *Mojado* | lightning taken +25% and chains +1; fire it deals −15% and fire it takes −15%; a cold hit Freezes it | rain: while in it +5 s | full | droplet |
| Bleed / *Sangrado* | physical every 0.5 s, doubled while moving | source | full | rust-brown (never gore) |
| Root / *Enraizado* | cannot move, can act | source | ⅕ | thorn |
| Stun / *Aturdido* | cannot move or act | source | ⅕ | stars |
| Blind / *Ceguera* | 50% of blows and shots go astray | source | ⅕ | moth |
| Weaken / *Debilidad* | deals −X% | source | full | pale skull |
| Taunt / *Provocado* | must attack the taunter | source | ⅕, but the taunter jumps to top threat +10% | red ring |
| Mark / *Marcado* | takes +X% from the marker's party; seen through fog and Fogwalk | source | full | leaf |
| Hushed / *Silenciado* | cannot cast (an interrupt) | source | a boss cast in progress is cancelled; ⅕ after | quiet ring |

**Element rules.** These are design-bible §4.7's three, plus two:
- cold on a Burning target cancels both and shatters it for 30 × spell power;
- lightning on a Wet target chains +1;
- **a fire hit on a fresh corpse turns it to ash, which cannot be raised** (monsters-abilities.md §2).

**PvP** (world-acts.md §6). Between Keepers:
- damage is ×0.5;
- crowd-control lengths are ×0.5;
- heals received while *Hot Ember* are ×0.75;
- Freeze, Stun and Root on a Keeper leave 6 s of immunity to that status.

### 0.5 Threat (only in a party fighting a party boss)
Threat comes from:
- damage ×1;
- the **whole Ashguard book ×2**;
- healing ×0.5, split over the foes fighting the healed one;
- a Taunt, which sets the taunter to top threat +10% for its length.

A boss attacks its top threat unless a mechanic names someone else. The Lanternwright's heals carry **no threat while
Shuttered** (a node, below). The rules live in monsters-abilities.md §5.

### 0.6 Animation and sound: the kit every row uses

**Keeper animations.** These are chibi frames on the visible-gear rig. Each is 4–6 frames, at 80–100 ms a frame.

| Anim | Used by | Frames |
|---|---|---|
| `cast-raise` | a staff or lamp-staff raised, a flash at its head | 5 |
| `cast-push` | both hands forward (bolts, lances) | 4 |
| `cast-slam` | the staff struck on the ground (novas, rings, raises) | 5 |
| `channel` | the staff held up, a looping glow, 2 frames | 2 + loop |
| `swing` | the shipped Watch Blade arc | 5 |
| `heavy` | a two-beat overhead (Pyre Strike, the Five-Struck Blow) | 6 |
| `shield-up` | the shield raised, braced | 3 + hold |
| `throw` | an arm whip (Brand Throw, Moth Dust) | 4 |
| `draw` | the bow drawn, held, loosed (charged shots hold frame 3) | 5 |
| `whistle` | a hand to the mouth (Command, Call) | 4 |
| `kneel` | one knee down (Rekindle, Second Muster) | 4 + hold |

**FX kit** (`td-fx`: pixel shapes only, no blur):
- Projectiles are 3–6 px sprites with a 2–4 step trail.
- Rings are dashed or solid circles that grow over 0.25–0.4 s.
- Fields are ground decals with a pulsing alpha.
- Every hit adds a 2–3 frame impact spark in the element's colour (the `DAMAGE_COLORS` palette).
- A crit adds a white 1-frame outline.

**Reduced motion.** Rings stand still at full size, and no particles fly. Every tell stays.

**Sound** (`shared/sound/sound-director.ts`, all synthesised, no files). New `SfxCue` families, each with a recipe:

| Cue | Recipe (oscillators and noise, 60–400 ms) |
|---|---|
| `fire-cast` | noise burst, band-pass 800→300 Hz sweep, a low thump |
| `fire-hit` | short crackle (filtered noise, 90 ms) |
| `frost-cast` | high sine glissando 1.8→2.6 kHz, a glassy ping |
| `frost-hit` | ice crack (two noise clicks, high-pass 3 kHz) |
| `bone-cast` | hollow wood-block taps ×3 (triangle 400 Hz, fast decay) |
| `bone-hit` | dry rattle (noise gated at 30 Hz) |
| `shadow-cast` | a falling sine (500→120 Hz) under a whisper bed (the shipped `whisper`) |
| `light-cast` | a bell partial (sine 880 + 1320, 400 ms) |
| `light-hit` | a soft chime (sine 1760, 120 ms) |
| `lightning-cast` | a rising saw buzz (100→900 Hz) |
| `lightning-hit` | a sharp crack (white noise 40 ms) and a rumble (brown noise, low-pass 120 Hz, 600 ms) |
| `wind` | a band-passed noise swell |
| `rain` | a hiss bed (see world-acts.md §3.5) |
| `blade` | the shipped `clang`, pitched by weapon |
| `shield` | a wood-and-iron thud (triangle 180 Hz, a noise knock) |
| `arrow` | a string thrum (pluck: saw 220 Hz, fast decay) and a whistle |
| `beast` | the shipped `bark`, pitched by pet size |
| `heal` | a warm major third (sine 523 + 659, a slow swell) |
| `ward` | a glass hum (two detuned sines) |
| `revive` | a three-note rise (C, E, G at 200 ms each) |
| `ultimate` | the cast cue doubled an octave down, with a far bell (the shipped `farbell`) |

Each row names its cue and a variation (pitch, length). One cue plays per cast, one per hit, and at most 6 hit cues
in any 100 ms, so AoE never becomes noise.

### 0.7 Reading a row in this doc
Each row gives:
- the name EN / ES, its unlock level, kind, element, mana · cooldown, and its Cant words;
- its numbers: rank 1, then `+grow` per rank, then **rank 20** in bold;
- its shape;
- synergies;
- nodes as `A1 · A2 · A3★ | B1 · B2 · B3★`;
- **Anim / FX / Sfx** in one line.

Damage and heals are × spell power. Shipped rows say *shipped*, and only their nodes and FX are new.

---

## 1. Warlock / Brujo: AoE damage

Trainer: Old Mother Cindle (Ember Inn back room). Trees: **Ember** / *Brasa* (fire), **Bone** / *Hueso* (necromancy),
**Shadow** / *Sombra* (curses, wards, rime).

**What changes.**
- Ember Mastery folds into Ember Bolt, Soul Harvest into Bone Spear, Skeleton Mastery into Raise Skeleton, and Life Tap
  into Dark Ward.
- Seven new rows: Kiln Breath, Rain of the Caldera, Raise Grave-Mage, Ossuary Golem, Second Muster, Rime Lance,
  Blizzard, and the capstone Noon Goes Black.

### 1.1 Ember / Brasa

**Ember Bolt / Rayo de brasa**: L1, basic attack, fire, *vael sha*. Shipped: 8–13, +4/+6 → **84–127**, 7 tiles,
every 0.9 s.
- Nodes:
  - A1 Hot Coal: +10% damage
  - A2 Kindling: hits Burn 2 s at 20% of the hit/s
  - A3★ **Ember Mastery**: every fire skill +1.5% per Ember Bolt rank (+30% at 20; folded passive)
  - B1 Long Ember: +2 tiles
  - B2 Split Spark: 25% chance to split into 2 at 50% on hit
  - B3★ Soulfire: each kill by the bolt refunds 3 mana
- Anim `cast-push`. FX: the shipped violet-orange bolt with a 3-step ember trail. Sfx `fire-cast` short, pitch +3,
  and `fire-hit`.

**Hellfire Nova / Nova infernal**: L1, active, fire, 25 · 9 s, *vael orum*. Shipped: 20–30, +4/+6 → **96–144**, ring
r3 (+0.1 → **4.9**). Syn: +5% / rank Aura of Embers.
- Nodes:
  - A1 Hotter Ring: +15%
  - A2 Scorched Earth: leaves burning ground r2 for 3 s at 15% of the hit/s
  - A3★ Twin Nova: a second ring 0.4 s later, 60%
  - B1 Wide Ring: +1 tile
  - B2 Quick Kindling: −2 s cooldown
  - B3★ Cinder Ward: each foe hit gives 4 absorb for 5 s (max 40)
- Anim `cast-slam`. FX: an orange ring with a cream inner edge, sparks thrown outward, scorch decal 2 s. Sfx `fire-cast`
  long and a low boom.

**Aura of Embers / Aura de brasas**: L1, aura, fire, *vael ka*. Shipped: 3 dps r3, +1 dps, r+0.1 → **22 dps, r4.9**.
Syn: +3% radius / rank Nova.
- Nodes:
  - A1 Banked Coals: +20% dps
  - A2 Flareback: a foe that strikes you Burns 2 s
  - A3★ Hearth-Heat: allies in reach +8% fire damage
  - B1 Warm Reach: +1 tile
  - B2 Ash to Ash: corpses in reach turn to ash (no raising)
  - B3★ Ember Shield: +15 fire resist while it runs
- FX: the shipped ember disc. A2 adds a spark arc to the striker. Sfx: the bed crackle, very low.

**Cinder Rain / Lluvia de ceniza**: L6, active, fire, 18 · 7 s, *vael dra*. Shipped: 6–10 twice a second for 3 s in r2,
+2/+3, +0.1 s, r+0.05 → **44–67, 4.9 s, r2.95**. Syn: +6% / rank Nova.
- Nodes:
  - A1 Heavier Ash: +15%
  - A2 Smouldering: hits Burn 1 s
  - A3★ Firestorm: the cloud follows the nearest foe at 1 tile/s
  - B1 Wider Cloud: +0.5 tile
  - B2 Long Rain: +1.5 s
  - B3★ Dry Season: no fire penalty from Wet or rain
- Anim `cast-raise`. FX: the shipped falling embers. B3★ shows a heat shimmer ring. Sfx: a soft `fire-hit` patter at
  4/s.

**Flame Wall / Muro de llamas**: L12, active, fire, 22 · 10 s, *vael mur*. Shipped: 8 dps, 4 tiles, 5 s; +2 dps,
+0.1 tile, +0.2 s → **46 dps, 5.9 tiles, 8.8 s**. Syn: +8% duration / rank Rain.
- Nodes:
  - A1 White Heat: +20% dps
  - A2 Caught Alight: crossing leaves Burn 3 s
  - A3★ Ring of Fire: the wall is a ring r2 round the target instead
  - B1 Long Wall: +2 tiles
  - B2 Firebreak: creatures will not path through it (they go round)
  - B3★ Twin Walls: two walls in an X, each 70%
- Anim `cast-slam`. FX: the shipped flame tongues. Ring of Fire bends them on a circle. Sfx: a sustained crackle bed for
  its life, quiet.

**Meteor / Meteoro**: L24, active, fire, 35 · 12 s, *vael dra*. Shipped: lands after 1 s, 60–90 in r2, +10/+14,
r+0.05 → **250–356, r2.95**.
- Nodes:
  - A1 Heavier Stone: +15%
  - A2 Burning Crater: a fire field r2 for 4 s at 10% of the hit/s
  - A3★ Twin Impact: a second meteor 0.5 s later, 1 tile off, 60%
  - B1 Quick Fall: lands after 0.6 s
  - B2 Starshard: −3 s cooldown
  - B3★ Splitting Stone: splits into 4 fragments r1 at 35% each, round the ring's edge
- Anim `cast-raise`. FX: the shipped stone with a stepped tail, landing ring, scorch. Twin Impact draws two tails. Sfx: a
  whistle falling in pitch for 1 s, then a deep boom and a crackle tail.

**Kiln Breath / Aliento de horno**: L42, active, fire, channel, 8 mana a second, max 4 s, cd 6 s, *vael sha mur*. A cone
of flame 5 tiles deep and 60° wide. Every 0.25 s, 18–26 (+3/+4) → **75–102** to all in it. You walk at 40% while
channelling. Syn: +4% / rank Flame Wall.
- Nodes:
  - A1 Forge Draught: +15%
  - A2 Melting: hits lower fire resist by 5 per tick (max 25)
  - A3★ Dragonmouth: the cone is 90° wide and 6 tiles deep
  - B1 Bellows: −25% mana a second
  - B2 Steady Hands: move at 70% while channelling
  - B3★ Kiln Seal: when it ends, a Flame Wall stands across the cone's mouth for 3 s at 50%
- Anim `channel`. FX: a pixel-flame cone of five stepped wedges, orange to cream at the root, embers at the tips. Sfx
  `fire-cast` held as a roaring band-passed loop; the pitch drops as the channel runs out.

**Rain of the Caldera / Lluvia de la caldera**: L70, active, fire, 60 · 30 s, *vael ul dra*. Six meteors over 3 s, each
landing in a random spot inside r5 of the target (never twice on one spot). Each 70–100 in r2 (+10/+14) →
**260–366**. Syn: +5% / rank Meteor.
- Nodes:
  - A1 Old Fire: +15%
  - A2 Crater Field: each landing leaves fire r1 for 3 s
  - A3★ Eight Stones: eight meteors over 3.5 s
  - B1 Guided Fall: each stone aims at a foe if one stands in r5
  - B2 Short Season: −8 s cooldown
  - B3★ The Mountain Answers: the last stone is twice the size (r3, ×2 damage)
- Anim `cast-raise` held 0.4 s. FX: the sky darkens 20% in r7, then the stepped tails fall one after another, each with
  its landing ring 0.6 s before. Sfx `ultimate` fire: six falling whistles, each pitched differently, the booms
  overlapping (≤ 6 cues).

### 1.2 Bone / Hueso

**Bone Spear / Lanza de hueso**: L1, active, arcane, 14 · 3 s, *osk sha*. Shipped: 22–32 pierce 8 tiles, +4/+6 →
**98–146**.
- Nodes:
  - A1 Sharpened: +15%
  - A2 Marrow-Splinter: the spear leaves Bleed 3 s at 10%/s
  - A3★ Twin Spear: two spears, 10° apart
  - B1 **Soul Harvest** (folded): each kill by any Warlock skill gives 8 mana; +1 Soul a kill per 5 Bone Spear ranks
  - B2 Long Shaft: +3 tiles
  - B3★ Return of the Bone: the spear flies back to you, hitting again at 50%
- Anim `cast-push`. FX: an ivory shaft, 6 px, with a two-step trail; chips on each pierce. Sfx `bone-cast` and
  `bone-hit` per foe.

**Raise Skeleton / Alzar esqueleto**: L1, active, arcane (summon), 30 · 12 s, *osk teth*. Shipped: 2 (max 2), life 50,
blow 7; count +0.15, max +0.25, life +10, blow +1 → **4–6 standing, life 240, blow 26**.
- Nodes:
  - A1 **Skeleton Mastery** (folded): skeletons +10% life and blow, +1% per rank of this row
  - A2 Ash-Bone: skeletons' blows are fire
  - A3★ Captain of the Dead: one skeleton is a Captain (×2 size, taunts r3 every 8 s)
  - B1 Quick Rise: −4 s cooldown
  - B2 From Ash Too: raises even where no corpse lies, at full strength
  - B3★ Ember Bones: a skeleton that crumbles bursts for 30% of its life as fire in r1.5
- Anim `kneel` then `cast-slam`. FX: bones clatter up out of the ground in 3 frames, tidy, never torn. Sfx `bone-cast`
  ×2 and a low hum.

**Corpse Burst / Estallido de cadaver**: L6, active, arcane, 15 · 4 s, *osk un*. Shipped: the freshest corpse within 6
tiles bursts, 18–28 in r2, +4/+6 → **94–142**.
- Nodes:
  - A1 Brittle: +15%
  - A2 Bone Shards: 4 shards fly 3 tiles from the burst at 30% each
  - A3★ Chain of Graves: the burst sets off the next corpse within 3 tiles (up to 3)
  - B1 Wide Burst: +0.5 tile
  - B2 Grave-Sense: reach 9 tiles
  - B3★ Lay to Rest: a burst corpse cannot be raised, and foes in it are Hushed 1 s (a raiser counter)
- Anim `cast-push`. FX: a bone-toned ring, a flash, chips. Sfx `bone-hit` thick and a dull pop.

**Bone Armor / Armadura de hueso**: L12, active, arcane, 18 · 16 s, *osk ka*. Shipped: absorbs 30 for 15 s, +8, +0.5 s
→ **182, 24.5 s**.
- Nodes:
  - A1 Thick Bone: +20% absorb
  - A2 Splinter Back: blows on it return 20% as arcane
  - A3★ Ossuary Coat: breaking, it raises 1 skeleton
  - B1 Long Ward: +5 s
  - B2 Light Bones: −4 s cooldown
  - B3★ Shared Bones: an ally within 6 tiles gets a copy at 50%
- FX: the shipped four shards circling the chest. Sfx `bone-cast` and a soft `ward`.

**Bone Storm / Tormenta de hueso**: L18, active, arcane, 30 · 8 s, *osk orum sha*. Shipped: 5 spears in a fan, 14–22
each; +0.2 count, +3/+4 → **8 spears, 71–98**.
- Nodes:
  - A1 Heavier Spears: +15%
  - A2 Pierce: each spear pierces 1 foe
  - A3★ Full Circle: the spears fly in a full ring
  - B1 Wider Fan: +2 spears
  - B2 Cheap Bone: −25% mana
  - B3★ Spiralling: the fan sweeps 90° over 0.6 s, a turning fan
- Anim `cast-push`. FX: the Bone Spear's shafts in a fan. Spiralling animates the sweep. Sfx `bone-cast` then a
  layered whistle.

**Raise Grave-Mage / Alzar mago de tumba**: L30, active, summon, 40 · 14 s, *osk vael teth*. Raises one mage (max 2,
+0.1 a rank → **3** at 20). Its bolt carries the Warlock's highest-ranked element tree: fire (Ember) or arcane (Bone).
If Rime Lance outranks both, the bolt is cold and Chills 1 s. The mage casts every 1.6 s at 6 tiles, 16–24 (+3/+4) →
**73–100**. Life 120 (+15) → **405**. It lasts 45 s.
- Nodes:
  - A1 Old Learning: +15% bolt
  - A2 Grave-Curse: each mage's 4th bolt applies the Warlock's Weaken (if he has a rank)
  - A3★ Choir of Bones: the mages' bolts chain once at 50%
  - B1 Long Service: +20 s
  - B2 Twin Mage: raises 2 at once
  - B3★ The Bastion's Archers: the mages become archers: physical, pierce 2, 8 tiles
- Anim `kneel` then `cast-raise`. FX: a robed skeleton in tattered cream with a small lantern of the element's colour,
  bolt to match. Sfx `bone-cast`, then a `light-cast` pitched low. Lore: the Ashen Bastion's war-mages. They "kept
  standing the watch"; the Warlock gives them a reason.

**Ossuary Golem / Golem del osario**: L50, active, summon, 60 · 60 s, *osk mur teth*. One golem built of bones (one at a
time). Life 600 (+60) → **1,740**. It strikes 3 tiles round itself for 30–45 (+5/+7) → **125–178**, every 1.4 s. It
**taunts** everything in r4 every 6 s (the Warlock's own tank, solo only: in a party its threat is halved). It stands
until it falls.
- Nodes:
  - A1 Dense Bone: +20% life
  - A2 Bonemeal: each blow heals it 5%
  - A3★ Forty Strong: the golem bears forty bones, and each foe it slays adds +1% (max +40%) until it falls. A Barrow
    echo (canon: forty graves).
  - B1 Quick Build: −20 s cooldown
  - B2 Thorny Ribs: strikers take 15% of their blow back
  - B3★ Funeral Pyre: at 0 life it burns for 6 s as a Flame Wall ring r2 at 50% of its blow
- Anim `cast-slam`. FX: bones stream from the corpses within 6 tiles and assemble in 0.8 s (stepped). The golem is a
  3×3-tile chibi of tidy ivory ribs. Sfx: a thudding assembly (`bone-hit` ×6 climbing in pitch), then a deep `shield`.

**Second Muster / Segunda leva**: L85, active, revive, 80 · 120 s, *osk ul teth*. The last 3 creatures slain within 10
tiles (never a boss, never a world boss) rise **on your side** for 60 s. They keep their affixes and their **pack
aura**. They hit at 60% (+2% a rank) → **98%**. They are a muster, not a slave: the line says "they want one more
watch". Syn: +3% / rank Raise Skeleton.
- Nodes:
  - A1 Loyal Dead: +20% life
  - A2 Old Orders: they keep any aura at +2 levels
  - A3★ Champion Muster: a champion or unique can rise too (one), at 50%
  - B1 Long Muster: +30 s
  - B2 Four Rise: 4 creatures
  - B3★ Lay Them Down: when the muster ends, each bursts as Corpse Burst
- Anim `kneel`, 1 s. FX: each corpse lifted by threads of cream light, a pale tally mark over each one's head. Sfx
  `revive` low, `bone-cast` per riser.

### 1.3 Shadow / Sombra (curses, wards, rime)

**Drain Life / Drenar vida**: L1, active, arcane, shipped. 18–26, heals 50%; +3/+5, +1% → **75–121, heals 69%**.
- Nodes:
  - A1 Deep Draw: +15%
  - A2 Grave Thirst: overhealing becomes absorb (max 30)
  - A3★ Leech Chain: jumps to 2 more foes at 50%
  - B1 Long Reach: +2 tiles
  - B2 Quiet Draw: −20% mana
  - B3★ Share the Cup: 50% of the heal goes to the lowest ally within 6 tiles
- Anim `cast-push`. FX: a pale-violet tether from foe to hand, beads drawn along it. Sfx `shadow-cast` and a soft
  `heal`.

**Ember Curse / Maldicion de brasa**: L1, active, fire curse, shipped. 5 dps 8 s, −20% bites; +1 dps, +0.2 s, +1% →
**24 dps, 11.8 s, −39%**.
- Nodes:
  - A1 Deep Brand: +25% dps
  - A2 Spreading: on death it jumps to the nearest foe in 3 tiles
  - A3★ Hex Ring: curses all within r2 of the target
  - B1 Long Curse: +4 s
  - B2 Mark of Ash: cursed foes leave ash-corpses (no raising)
  - B3★ Fear of Fire: the cursed flee 1.5 s on cast (bosses ⅕)
- FX: an ember sigil over the head, ticking. Sfx `fire-cast` muted and a whisper.

**Dark Ward / Guarda oscura**: L1, active, shipped. Absorbs 40 for 12 s, +10, +0.5 s → **230, 21.5 s**.
- Nodes:
  - A1 Thick Dark: +20%
  - A2 **Life Tap** (folded): casting it turns 10% of your life into 15 mana (+1 per rank), never the last life
  - A3★ Night Shroud: while it holds, foes beyond 4 tiles lose you (no ranged aim)
  - B1 Long Ward: +5 s
  - B2 Quick Ward: −3 s cooldown
  - B3★ Ward the Fellowship: an ally within 6 tiles gets 50%
- FX: an ink-violet hex shell. Sfx `ward` and a low hum.

**Aura of Siphoning / Aura de sifon**: L6, aura, shipped. Heal 2 per hit, +0.5 → **11.5**.
- Nodes:
  - A1 Deeper Siphon: +25%
  - A2 Mana Siphon: also 1 mana per hit
  - A3★ Siphon Kin: allies in r4 heal 50% of it
  - B1 Reach: r4 → r5
  - B2 Vampire's Patience: ×2 while below 40% life
  - B3★ Grave Purse: kills in reach heal 3% max life
- FX: thin pale threads from each struck foe to you. Sfx: none (aura; a soft draw on kills only).

**Weaken / Debilitar**: L6, active curse, shipped. −25% in r2 for 8 s; +1%, r+0.1, +0.3 s → **−44%, r3.9, 13.7 s**.
- Nodes:
  - A1 Deeper: +5% (absolute)
  - A2 Brittle: the weakened take +10% physical
  - A3★ Withering: the weakened are Chilled
  - B1 Wide: +1 tile
  - B2 Cheap: −30% mana
  - B3★ Lingering: lasts 4 s after the foe leaves the cursed ground
- FX: the shadow ring and pale pips. Sfx `shadow-cast` short.

**Doom / Condena**: L18, active curse, shipped. After 4 s the target bursts for 50–80 to all within r2; +9/+13, r+0.05
→ **221–327, r2.95**.
- Nodes:
  - A1 Heavy Doom: +15%
  - A2 Doomed Together: also curses one foe within 3 tiles
  - A3★ **Unmaking**: the burst ends the target's **pack aura** for 6 s (bosses ⅕) and strips one elite affix for 10 s
    (monsters-abilities.md §3)
  - B1 Quick Doom: bursts after 2.5 s
  - B2 Cheap Doom: −25% mana
  - B3★ Hour of Doom: if the target dies before it bursts, the burst still happens, ×1.5
- FX: the ticking pale skull. Unmaking shows the target's aura sigil cracking. Sfx: a clock-tick ×4, then a hollow boom.

**Rime Lance / Lanza de escarcha**: L30, active, cold, 18 · 2.5 s, *rim sha*. A lance of rime, 9 tiles, piercing,
26–38 (+5/+7) → **121–171**. It Chills 3 s. Syn: +5% / rank Weaken, +3% / rank Dark Ward.
- Nodes:
  - A1 Colder: +15%
  - A2 Deep Chill: a foe Chilled twice is Frozen 1 s
  - A3★ Frost Nova (folded idea): on its first hit, a ring r2 bursts for 60% and Chills
  - B1 Long Lance: +3 tiles
  - B2 Grave-Frost: −20% mana and fire foes take +20%
  - B3★ Splintering: at the end of its flight it splits in 3, 30° apart, for 4 tiles at 50%
- Anim `cast-push`. FX: a pale-blue lance of 6 px, three-step frost trail, rime decals where it passes (1 s). Sfx
  `frost-cast` and a `frost-hit` per foe.

**Blizzard / Ventisca**: L60, active, cold, 55 · 14 s, *rim vor dra*. A blizzard in r4 round the target for 4 s
(+0.2 s): ice shards fall at 8 a second on random tiles inside it, each 22–32 in r1 (+3/+5) → **79–127**. All inside
are Chilled. **Wet** foes inside are Frozen. Syn: +5% / rank Rime Lance.
- Nodes:
  - A1 Bitter Cold: +15%
  - A2 Snowbound: the ground stays icy 3 s after; creatures slide (−40% move)
  - A3★ Whiteout: r5 and 6 s, but −15% damage per shard
  - B1 Eye of Snow: you stand inside it unhurt and +20% cold
  - B2 Cheap Winter: −20% mana
  - B3★ Called Weather: if it is raining or storming outdoors, +40% and the blizzard follows the target
- Anim `cast-raise` and `channel` 0.3 s. FX: a grey-blue cloud disc, slanted white streaks, shard sparks, a frost decal
  that fades. Sfx: a `wind` swell for its length, with `frost-hit` ticks (≤ 6 per 100 ms).

**Noon Goes Black / El mediodia se oscurece**: L100, active, the eclipse, 120 · 180 s, *ul nyr orum*. For 12 s a small
eclipse stands r6 round the Keeper:
- his fire, cold and shadow +40%;
- every curse he lays spreads on death;
- his skeletons, mages and golem +30%;
- creatures inside cannot raise the dead.

Light inside drops to night's (the dark-born may show; they never ambush). Glim says once: "I can see the seam
breathing." Ranks add +1% and +0.2 s → **+59%, 15.8 s**.
- Nodes:
  - A1 Darker Noon: +10%
  - A2 Corona: foes at the edge Burn
  - A3★ Totality: +4 tiles, but the Hush rises (party: everyone)
  - B1 Short Wait: −60 s cooldown
  - B2 Eclipse Glass: during it, each kill adds 0.5 s (max +6 s)
  - B3★ Let It Breathe: when it ends, a ring of the seam (arcane 200% of Doom) bursts r6
- Anim `cast-raise` held 0.6 s. FX: a violet-black disc closes over the sun-tint, a cream corona ring at r6, the screen
  edges dim. Sfx `ultimate`: a sine drone falling from A3 to A1 over 1 s, and a far bell.

---

## 2. Ashguard / Guardiceniza: the tank

Trainer: Captain Brannoc Vey (Pyre Watch). Trees: **Brand** / *Marca* (fire on the blade), **Oath** / *Juramento*
(shield, taunt, guard), **Ash** / *Ceniza* (endurance).

**What changes.**
- Hold the Line folds into Shield Oath, and Ember Blood into the Watchfire.
- New rows: Brand Throw, Pyre Strike, the Five-Struck Blow, Banner of the Watch, Intercept, Hold the Gate, the Unbroken
  Line, Cinder Skin, Second Wind, Watchquake, and the capstone Kept by One.
- Every Ashguard skill makes threat ×2 (§0.5).
- Blows are % of the **weapon blow** (skill-trees.md, "the weapon in the swing").

### 2.1 Brand / Marca

**Watch Blade / Hoja de la guardia**: L1, basic attack, physical, shipped. 9–14, +1/+3 → **28–71**, a 110° arc 1.6
tiles deep, every 0.8 s.
- Nodes:
  - A1 Whetted: +10%
  - A2 Cleaving Edge: arc 140°
  - A3★ Fifth Strike: every 5th swing is a heavy at 180% that Stuns 0.5 s
  - B1 Guard's Rhythm: +8% swing speed
  - B2 Sure Footing: blows on Chilled foes +15%
  - B3★ Iron Lesson: each blow gives 2 absorb for 4 s (max 20)
- Anim `swing`. FX: the shipped crescent arc. A3★'s heavy is a doubled arc with an ember edge. Sfx `blade` pitched by
  weapon.

**Ember Brand / Marca de brasa**: L1, active, fire, shipped. 8 s: blows +40% as fire and a 6 burn over 3 s; +4%, +1,
+0.3 s → **+116%, 25 burn, 13.7 s**.
- Nodes:
  - A1 Brighter Brand: +10% (absolute)
  - A2 Brand Spreads: the burn jumps once on a kill
  - A3★ Kept Fire: always on while you stand still (the Watch holds)
  - B1 Long Brand: +4 s
  - B2 Cheap Oath: −30% mana
  - B3★ Shield-Brand: blocks also deal the brand's burn
- FX: the shipped ember edge on the blade. Sfx `fire-cast` short, metallic.

**Brand Throw / Lanzar la marca**: L12, active, fire, 12 · 6 s, *brann vael vesh*. Throws the branded blade 7 tiles. It
hits the first foe at 120% of the blow (+4% → **196%**) and Taunts it 3 s. Then it flies back, hitting again at 50%.
The tank's pull.
- Nodes:
  - A1 Heavy Throw: +15%
  - A2 Burning Path: leaves a fire strip 3 s
  - A3★ Ricochet: bounces to 2 more foes, taunting each
  - B1 Long Arm: +3 tiles
  - B2 Quick Catch: −2 s cooldown
  - B3★ Hook and Haul: pulls the first foe 3 tiles toward you (not bosses)
- Anim `throw`. FX: a spinning blade sprite with an ember trail; a red taunt ring on hit. Sfx: a whirring loop, `blade`
  on hit.

**Cinder Cleave / Tajo de ceniza**: L6, active, fire, shipped. A 160° arc 2 tiles deep, 100% as fire; +4% → **176%**.
Syn: +5% / rank Ember Brand.
- Nodes:
  - A1 Heavier: +15%
  - A2 Ash Wake: leaves cinders that Burn 2 s
  - A3★ Full Turn: a 360° cleave at 80%
  - B1 Long Edge: +0.5 tile
  - B2 Cheap: −25% mana
  - B3★ Sunder: each hit takes 5 off the foe's physical resist for 6 s (stacks 3)
- FX: the shipped wide arc with ember flecks. Sfx `blade` low and `fire-hit`.

**Whirl of Cinders / Remolino de ceniza**: L18, active, fire, shipped. 4 turns in 2 s, each 60% as fire in r2; +4%,
r+0.05 → **136%, r2.95**. Syn: +5% / rank Cleave.
- Nodes:
  - A1 Faster Turns: +1 turn
  - A2 Pull of the Fire: foes in r3 are drawn 1 tile in
  - A3★ Walking Whirl: you move at full pace while it turns
  - B1 Wide Whirl: +0.5 tile
  - B2 Cheap: −25% mana
  - B3★ Taunting Whirl: each turn Taunts what it hits 1 s
- Anim: `swing` looping, the sprite turns. FX: the shipped ember ring spinning. Sfx: a whoosh per turn.

**Pyre Strike / Golpe de pira**: L36, active, fire, 22 · 8 s, *vael dra brann*. Leaps up to 4 tiles and comes down with
an overhead blow: 220% (+8% → **372%**) to the target and 100% fire in r2. Stuns 1 s (bosses ⅕). Syn: +4% / rank
Whirl.
- Nodes:
  - A1 Heavier Fall: +15%
  - A2 Pyre Ground: the ring Burns 3 s
  - A3★ Meteor of the Watch: a 1.5 s charge, then ×2 damage and r3
  - B1 Long Leap: +2 tiles
  - B2 Shield First: you take −30% for 2 s after landing
  - B3★ Rallying Fall: allies within r4 gain 10% absorb of their life
- Anim `heavy` and a leap arc (sprite rises 12 px). FX: an ember arc and a ground ring with cracks. Sfx: a rising
  whoosh, then a `shield` thud and a `fire-hit` ring.

**The Five-Struck Blow / El golpe de los cinco**: L70, active, fire, 40 · 25 s, *brann ul sha*. One blow, charged 1 s
(you stand still). It deals 600% of the blow (+15% → **885%**) to one foe and ignores half its Defense. A column of
fire stands on it for 2 s (100%/s). Lore: the Watch's hammer, "struck by five, kept by one". The Keeper strikes it in
their name.
- Nodes:
  - A1 Fifth Mark: +15%
  - A2 Sundered Oath: the foe takes +15% from all sources for 6 s
  - A3★ Struck by Six: if the foe is a boss, its next Fixate goes to you and lasts double
  - B1 Quick Charge: 0.6 s charge
  - B2 Column of the Watch: the column is r1.5 and taunts
  - B3★ Echo: 50% of it strikes again 1 s later on the nearest other foe
- Anim `heavy` held 1 s (five ember motes gather on the blade). FX: five tally strokes light one by one over the blade,
  then a white flash and a fire column. Sfx: five ascending anvil `clang`s, then a big `ultimate`.

### 2.2 Oath / Juramento

**Shield Bash / Golpe de escudo**: L1, active, physical, shipped. 10–16 and a 1.2 s stun; +2/+3, +0.05 s → **48–73,
2.15 s**.
- Nodes:
  - A1 Heavy Shield: +15%
  - A2 Concussion: the stunned are Hushed 2 s after (an interrupt)
  - A3★ Shield Rush: bash after a 3-tile dash
  - B1 Quick Bash: −1.5 s cooldown
  - B2 **Grave-Stamp**: a bash on a corpse breaks it (no raising), and each foe within 1 tile is Stunned 0.5 s
  - B3★ Wide Bash: hits a 90° arc 1.5 tiles
- Anim `shield-up` and a push. FX: a shield-face flash, stars pip. Sfx `shield`.

**Shield Oath / Juramento de escudo**: L1, active, shipped. 6 s, blocks 30% of blows whole; +1%, +0.2 s → **49%,
9.8 s**.
- Nodes:
  - A1 **Hold the Line** (folded): below 40% life, +20% Defense, +1% a rank of this row
  - A2 Counterblow: each block returns 50% of a Watch Blade blow
  - A3★ The Shield Remembers: blocks also stop shots and breaths aimed at allies within 2 tiles behind you
  - B1 Long Oath: +3 s
  - B2 Cheap Oath: −30% mana
  - B3★ Oathbound: each block gives 3 mana
- FX: a cream-brass rim on the shield; a flash per block. Sfx `shield` per block.

**Watch Cry / Grito de la guardia**: L6, active, shipped. Taunts all within 4 tiles 3 s (bosses ⅕); you take 15% less;
+0.1 s, +0.5% → **4.9 s, 24.5%**. Syn: +6% duration / rank Shield Oath.
- Nodes:
  - A1 Louder: r5
  - A2 Rally: allies within 6 take −10% for the duration
  - A3★ Call to the Gate: taunted foes are pulled 1 tile toward you
  - B1 Quick Cry: −3 s cooldown
  - B2 Steady Voice: +2 s
  - B3★ Fearsome: non-boss foes weaker than you flee 1.5 s instead
- Anim: a raised fist. FX: a red ring expanding to r4, a red pip on each taunted foe. Sfx: a horn-like saw swell
  (200 Hz, 400 ms).

**Banner of the Watch / Estandarte de la guardia**: L24, aura, *brann orum ka*. While it runs, **allies within 6 tiles
take −8% damage** (+0.5% → **−17.5%**). You take −4% more. One aura at a time: the Ashguard picks this or the
Watchfire.
- Nodes:
  - A1 Thicker Ranks: +3% (absolute)
  - A2 Steadfast: allies within 6 cannot be knocked back
  - A3★ Standard-Bearer: allies within 6 regenerate 0.5% life a second
  - B1 Long Shadow: r8
  - B2 Iron Will: allies resist Fear and Taunt (players)
  - B3★ Watchfire Banner: also carries the Watchfire at 50%
- FX: a small pixel banner on the back (Pyre Watch red and brass), a dashed red-brass ring at r6. Sfx: none (aura).
  Cloth flaps when you stop.

**Intercept / Interceptar**: L30, active, 14 · 12 s, *brann sha ka*. Dash to an ally within 8 tiles. For 6 s (+0.2 s →
**9.8 s**) you take 50% of the damage that ally takes, through your own Defense, and they take the rest.
- Nodes:
  - A1 Shield-Brother: 60% instead of 50%
  - A2 Rescue: the dash knocks foes in its path 1 tile aside
  - A3★ Guardian's Bond: the ally also gets your Shield Oath while bonded
  - B1 Long Reach: 11 tiles
  - B2 Quick Hand: −4 s cooldown
  - B3★ Two Wards: bond 2 allies (each 35%)
- Anim: a dash. FX: a brass tether between you and the ally for the duration. Sfx `shield` and a soft `ward`.

**Hold the Gate / Defender la puerta**: L42, active, 30 · 25 s, *brann mur orum*. Plant the shield for 6 s (+0.1 s →
**7.9 s**). During it:
- you cannot move;
- all foes within r5 are Taunted 3 s, renewed every 2 s;
- you take −40%;
- shots and breaths aimed at allies within 3 tiles behind you strike your shield instead.

This is **the party tank's answer** to monsters-abilities.md's Burn the Room and Spread.
- Nodes:
  - A1 Deeper Roots: −50% instead of −40%
  - A2 Spiked Wall: strikers take 30% of their blow
  - A3★ Gate of the Bastion: allies within 4 tiles also take −20%
  - B1 Wider Gate: r7
  - B2 Mobile Gate: walk at 40% while it holds
  - B3★ The Gate Opens: when it ends, a Watch Cry and a Cinder Cleave at 150%
- Anim `shield-up` hold, a ground plant. FX: a brass half-wall of light in front, a red taunt ring pulsing every 2 s.
  Sfx `shield` deep and a sustained low drone.

**The Unbroken Line / La linea inquebrantable**: L85, active, 60 · 180 s, *brann ul mur*. For 8 s (+0.2 s → **11.8 s**),
allies within 6 tiles take −35%, and 30% of what is left is moved onto you, through your Defense.
- Nodes:
  - A1 Stronger: −40%
  - A2 Held Ground: allies cannot be Stunned or Rooted
  - A3★ Last Line: no ally within 6 can fall below 1 life for its first 3 s
  - B1 Long Line: +3 s
  - B2 Short Watch: −60 s cooldown
  - B3★ The Line Marches: it follows you, and you move at full pace
- Anim `shield-up`, the shield raised high. FX: a brass line of five small shields standing on the ground round the
  party (tally marks again). Sfx `ultimate` and five `shield` knocks.

### 2.3 Ash / Ceniza

**Ash Stride / Paso de ceniza**: L1, active, shipped. Charge 3 tiles, 80% blow, knock back 1 tile; +5%, +0.05 tile →
**175%, 3.95 tiles**.
- Nodes:
  - A1 Heavier: +15%
  - A2 Ash Trail: the path Burns 2 s
  - A3★ Double Stride: a second charge within 2 s, free
  - B1 Long Stride: +2 tiles
  - B2 Quick: −2 s cooldown
  - B3★ Through the Ranks: passes through foes, hitting all
- Anim: a dash. FX: a grey ash streak. Sfx: a whoosh and `blade`.

**Watchfire / Fuego de guardia**: L1, aura, shipped. +10 Defense, 1 life/s; +3, +0.2 → **+67, 4.8/s**.
- Nodes:
  - A1 **Ember Blood** (folded): 3% of damage dealt heals, +0.1% a rank of this row
  - A2 Warm Ground: allies within 3 get 50% of the regeneration
  - A3★ Banked Fire: double regeneration while below 40% life
  - B1 Wide Fire: allies in r4 get +50% of the Defense
  - B2 Kindled: +10 fire resist
  - B3★ Hearth of the Watch: counts as a hearth for the Hush (it cannot rise in r3)
- FX: the shipped hearth glow at the feet. Sfx: a soft crackle bed.

**Cinder Skin / Piel de ceniza**: L12, active, fire, 16 · 18 s, *vael ka*. 10 s: +30 fire resist (+1 → **49**). Melee
strikers take 20% of their blow back as fire (+1% → **39%**), which is D2's Thorns.
- Nodes:
  - A1 Hotter: +10% reflect
  - A2 Cold Ash: also +20 cold resist
  - A3★ Molten Skin: strikers Burn 2 s
  - B1 Long Skin: +5 s
  - B2 Shared Skin: allies within 3 get 50% of the resist
  - B3★ Ash Shell: casting it removes Burn and Chill
- FX: a grey-orange crackle texture on the sprite's outline. Sfx `fire-cast` and a hiss.

**Second Wind / Segundo aliento**: L24, active, 20 · 30 s, *hesk ka brann*. Heals 20% of max life over 4 s (+0.5% →
**29.5%**).
- Nodes:
  - A1 Deep Breath: +5% (absolute)
  - A2 Steady: removes one status on cast
  - A3★ Last Breath: below 25% life it heals instantly instead of over time
  - B1 Quick Breath: −8 s cooldown
  - B2 Breathing Room: foes in r2 are knocked back 1 tile
  - B3★ Battle Breath: heals 1% more for each foe within 3 tiles (max 6)
- Anim: shoulders rise, a pause. FX: a warm cream puff and rising motes. Sfx `heal` short, low.

**Vow of the Last Watch / Voto de la ultima guardia**: L24, active, shipped. 8 s you cannot fall below 1 life, then 25%
of what it held heals; +0.2 s, +1% → **11.8 s, 44%**. Syn: +5% duration / rank Hold the Line. That passive is now
Shield Oath's node, so the synergy reads Shield Oath's ranks.
- Nodes:
  - A1 Deeper Vow: 35% heals back
  - A2 Vow's Wrath: +20% damage during it
  - A3★ Vow for Two: also an ally within 6 (their copy lasts 4 s)
  - B1 Long Vow: +2 s
  - B2 Kept Oath: −15 s cooldown
  - B3★ Taunting Vow: taunts r4 every 2 s during it
- FX: the shipped brass halo. Sfx `ward` and a far `farbell`.

**Watchquake / Temblor de la guardia**: L50, active, physical, 28 · 12 s, *brann orum dra*. Stamp the ground: r3 Stun
1.2 s (bosses ⅕), 150% of the blow (+5% → **245%**). Interrupts every cast in reach (Hushed 1 s).
- Nodes:
  - A1 Heavier: +15%
  - A2 Aftershock: a second ring r4 at 50% 0.6 s later
  - A3★ Fault Line: a line 6 tiles long instead, ×1.3
  - B1 Wide: r4
  - B2 Quick: −3 s cooldown
  - B3★ Unsteady Ground: foes hit are Chilled 3 s
- Anim `heavy` without a weapon swing, a foot stamp. FX: a cracked ground ring, dust pixels. Sfx: a deep thud and a
  rubble rattle.

**Kept by One / Guardado por uno**: L100, active, 100 · 240 s, *brann hesk ul*. For 15 s the Keeper stands as the
Watch's last. Lore: the Watch's oath-hammer is "struck by five, kept by one".
- +50% max life (the current share kept);
- taunts are free and cool 50% faster;
- every Watch Blade swing is a Whirl turn;
- allies within 6 tiles cannot be Fixated by a boss except onto you.

Ranks add +1% life → **+69%**.
- Nodes:
  - A1 Taller: +10% life
  - A2 Oathfire: every blow Burns
  - A3★ Struck by Six: when it ends, the Five-Struck Blow lands free
  - B1 Short Watch: −60 s cooldown
  - B2 Long Watch: +5 s
  - B3★ The Watch Holds: for its length, no ally within 6 falls below 1 life
- Anim `shield-up` then the sprite scales ×1.25 over 0.4 s. FX: a brass corona outline; the Banner flies even when
  unworn. Sfx `ultimate` and a slow drum.

---

## 3. Lanternwright / Farolero: the healer

Trainer: Tomas Rill (the lamp-keepers). Trees: **Lamp** / *Lampara* (light and lightning as weapons), **Hearth** /
*Hogar* (mending and wards, now **for allies**), **Moth** / *Polilla* (the lantern's kin, revealing).

**What changes.**
- Hearthlight and Hearth Circle heal allies. Moth-Kin folds into Lamp-Wisp, and Last Light into Lantern Ward.
- New rows: Chain of Lamps, Lighthouse, Cleanse, Rekindle, Hearthsong, Warmth That Stays, Moth Dust, Moth Swarm, Glim's
  Margin, and the capstone the Sixth Light.
- The light-on-the-dead ×1.5 rule is unchanged.

**Ally targeting** (one rule, every heal):
- a heal with "ally" goes to the **lowest-life party member** (by share) within its reach, the Keeper included;
- a tap or click on an ally's name plate or party frame picks them instead, for 3 s;
- with no party, every heal is the Keeper's own, as today.

### 3.1 Lamp / Lampara

**Kindle / Prender**: L1, basic attack, light (arcane), shipped. 9–14, +3/+4 → **66–90**, 4 tiles, every 0.9 s.
- Nodes:
  - A1 Brighter: +10%
  - A2 Tallow Burn: hits Burn 2 s at 15%/s
  - A3★ Kindling Light: every 4th flare heals the lowest ally 15% of its hit
  - B1 Long Flare: +2 tiles
  - B2 Searching Light: the flare seeks a foe within 1 tile of the aim
  - B3★ Lamp-Lightning: the flare is lightning and chains once at 50% (Wet: +1)
- Anim `cast-push` with the lamp-staff. FX: a cream flare with a 2-step glow trail. Sfx `light-cast` short and
  `light-hit`.

**Blinding Flash / Destello cegador**: L1, active, light, shipped. 28–42 to all within 3, the dead stunned 2 s;
+2/+3, r+0.05, +0.1 s → **66–99, r3.95, 3.9 s**.
- Nodes:
  - A1 Harsh Light: +15%
  - A2 Afterimage: all hit are Blind 2 s
  - A3★ **Consecrate**: corpses in the flash are laid to rest (no raising), and the dead stand stunned 1 s longer
  - B1 Wide Flash: +1 tile
  - B2 Quick Flash: −2 s cooldown
  - B3★ Lantern Burst: allies in the flash heal 10% of the damage dealt
- Anim `cast-slam`. FX: a white-cream ring with a 1-frame screen flash, capped at 20% (reduced motion: no flash).
  Sfx: a bright `light-cast` with a swell.

**Lantern Aura / Aura de farol**: L1, aura, shipped. Light +2 tiles, foes within 3 bite 10% weaker; +0.1, +0.05, +0.5%
→ **+3.9 tiles, r3.95, −19.5%**.
- Nodes:
  - A1 Steady Flame: +5% (absolute)
  - A2 Warm Light: allies in reach regenerate 0.5% life/s
  - A3★ Shield of Light: allies in reach +15 to every resist
  - B1 Wide Glow: +1 tile
  - B2 Fog-Lamp: fog cuts your party's sight 20% less
  - B3★ Lantern Against the Lightless: halves the Lightless aura and affix in reach
- FX: the shipped warm disc. Sfx: none.

**Shutter the Lantern / Cerrar el farol**: L1, utility, shipped. Toggles the light (td-dark's shy chests).
- Nodes:
  - A1 Dark Step: shuttered, +10% move
  - A2 Quiet Hands: shuttered, your heals make **no threat**
  - A3★ Moth Hours: shuttered, the dark-born do not mind you, and the Hush rises 50% slower
  - B1 Swift Shutter: toggling is free of the 1 s cooldown
  - B2 Kept Ember: shuttered, a worn unique's light stays at 1 tile
  - B3★ Flare Open: opening the shutter flashes as a Blinding Flash at 50%
- FX: the lantern's glass darkens and an amber pinhole remains. Sfx: a shutter click.

**Banish / Desterrar**: L12, active, light, shipped. 30–46 to one within 6. One of the dead at ≤ 25% after it is unmade
(a boss of the dead ×1.5 instead). +6/+9 → **144–217**. Syn: +6% / rank Kindle.
- Nodes:
  - A1 Sterner: +15%
  - A2 Unmade Twice: the unmaking threshold is 35%
  - A3★ Banish the Bearer: on the bearer of a dead pack, it ends the pack aura 6 s (monsters-abilities.md §3)
  - B1 Long Sight: +3 tiles
  - B2 Quick Word: −2 s cooldown
  - B3★ Lay Them All: the unmaking ends every raise channel within 4 tiles (Hushed 2 s)
- Anim `cast-push`. FX: a cream beam, the dead dissolving into motes upward (no gore). Sfx: a bell partial and a soft
  "hush".

**Chain of Lamps / Cadena de faroles**: L36, active, **lightning**, 20 · 4 s, *lum vor sha*. A lamp-lightning bolt
jumps between up to 4 foes (+0.15 → **6**), each 3 tiles apart at most. 28–40 (+5/+7) → **123–173** each, −10% a jump.
Shocks each. Syn: +5% / rank Kindle.
- Nodes:
  - A1 Brighter Arc: +15%
  - A2 Static: Shock lasts 6 s and +30%
  - A3★ Storm Lantern: in rain or storm, +2 jumps and no falloff
  - B1 Long Arc: 4 tiles between
  - B2 Healing Arc: each jump heals the lowest ally 10% of it
  - B3★ Grounded: the last jump bursts r2 at 60%
- Anim `cast-push`. FX: a jagged 1-px white-yellow line in 3 segments, redrawn each frame for 0.15 s; sparks at each
  foe. Sfx `lightning-cast` and a `lightning-hit` crack per jump (≤ 6).

**Dawn at Noon / Alba al mediodia**: L24, active, light, shipped. A disc of daylight r4 for 8 s: the dead and the
dark-born burn 14/s, all inside take +15%; r+0.05, +0.2 s, +3/s → **r4.95, 11.8 s, 71/s**. Syn: as shipped.
- Nodes:
  - A1 High Noon: +15%
  - A2 Healing Sun: allies inside regenerate 1.5% life/s
  - A3★ Moving Sun: the disc follows you
  - B1 Wide Dawn: +1 tile
  - B2 Long Day: +3 s
  - B3★ No Shadow: creatures inside cannot raise or be raised
- FX: the shipped daylight disc. Sfx: a held major chord at low volume.

**Lighthouse / Faro**: L70, active, light and lightning, 60 · 30 s, *lum orum dra*. Plants a lighthouse lantern for
10 s (+0.2 s → **13.8 s**). Its beam sweeps a full circle every 2 s, 8 tiles long. It hits whatever it passes for 40–58
(+6/+8) → **154–210**: lightning to the living, light (×1.5) to the dead. Allies the beam passes heal 3% of max life.
- Nodes:
  - A1 Brighter Beam: +15%
  - A2 Twin Beam: two beams, opposite
  - A3★ Storm Light: in rain, every sweep calls a strike on the Marked or the strongest foe
  - B1 Long Beam: +3 tiles
  - B2 Harbour Light: allies near it +10% move
  - B3★ Keeper's Light: the Hush cannot rise within 8 tiles, and Lightless is ended there
- Anim `cast-slam`. FX: a 2-tile pixel tower with a turning lantern, a long cream wedge rotating. Sfx: a low foghorn
  swell (saw 90 Hz) and a `light-hit` per creature passed.

### 3.2 Hearth / Hogar

**Hearthlight / Luz del hogar**: L1, active, heal, ally, 12 · 6 s, shipped, *rebalanced*. Heals the **lowest ally**
within 8 tiles 30 over 3 s (+6 → **144**). Since it now carries the party, it heals at **×(1 + 0.03 × level)** on top
of spell power. Heals are the healer's damage, and must keep pace with creature blows (leveling.md's 4 + 0.7·L).
- Nodes:
  - A1 Warmer: +15%
  - A2 Quick Mend: half of it lands at once
  - A3★ Twin Lights: also heals a second ally at 60%
  - B1 Long Reach: 12 tiles
  - B2 Cheap: −30% mana
  - B3★ Hearth Bond: the healed gain +10% Defense 5 s
- Anim `cast-raise`. FX: a cream lantern-mote that flies to the ally and blooms in a warm ring round their feet. Sfx
  `heal`.

**Hearth Circle / Circulo del hogar**: L6, active, heal, party, shipped, *rebalanced*. r3 for 10 s: **every ally
inside** mends 4/s (+1/s → **23/s**) × the same level factor. Foes walk 20% slower, and the Hush cannot rise. Syn: +4%
heal / rank Hearthlight.
- Nodes:
  - A1 Brighter Hearth: +20%
  - A2 Warded Ground: allies inside take −10%
  - A3★ Moving Hearth: it follows you
  - B1 Wide Circle: +1 tile
  - B2 Long Fire: +4 s
  - B3★ Mend the Mind: removes one status from each ally entering
- FX: the shipped hearth ring. Sfx `heal` bed, slow.

**Lantern Ward / Guarda de farol**: L12, active, ward, ally, shipped. Absorbs 50 for 12 s; breaking, it blinds all
within 3 for 2 s. +10, +0.3 s → **240, 17.7 s**. It now goes on an ally (the lowest, or the one picked).
- Nodes:
  - A1 Thicker Glass: +20%
  - A2 Shatter-Light: breaking also heals the ally 25% of the absorb
  - A3★ **Last Light** (folded): once every 600 s, a fatal blow on a warded ally leaves them at 1 life, 3 s untouchable
  - B1 Long Ward: +5 s
  - B2 Two Wards: −35% mana
  - B3★ Self-Ward Too: it lands on you at 50% as well
- FX: a glass-lantern shell round the ally, cream lines. Sfx `ward` and glass chimes on breaking.

**Cleanse / Purificar**: L18, active, ally, 14 · 8 s, *hesk un*. Removes every status of §0.4 from one ally except
Wet, Mark and Taunt. It also removes a boss's **Brand** (monsters-abilities.md §5). Then 2 s of immunity to the removed
statuses. Ranks: −0.2 s cooldown → **4.2 s**.
- Nodes:
  - A1 Warm Hands: heals 8% of max life too
  - A2 Lasting Grace: 4 s immunity
  - A3★ Cleansing Circle: all allies within 3 of the target too
  - B1 Long Reach: 12 tiles
  - B2 Free Hands: −50% mana
  - B3★ Dry Cloak: also removes Wet and protects from it 10 s
- Anim `cast-raise`. FX: cream motes wash over the ally from head to feet, each removed pip popping. Sfx: a rising
  two-note `light-hit`.

**Rekindle / Reavivar**: L30, active, revive, 50 · 120 s, *hesk ul teth*. Channel 3 s, kneeling, beside a **fallen
party member**. They wake where they fell with 40% life and 40% mana (+1% → **59%**). **Only where a fall costs
something**: Realms, Nightmare, Hell, and PvP deaths. This skips the wake walk. In Tibia scope it **cancels the death's
XP and item loss** (the bag is never dropped) when it lands within 30 s of the fall. Not on a Struck Keeper. Lore: "the
first five didn't come home; the sixth brings people home" (design-bible §5.8 blessing line).
- Nodes:
  - A1 Warm Wake: 60% life
  - A2 Steady Hands: the channel cannot be interrupted by damage
  - A3★ Long Memory: within 90 s of the fall instead of 30
  - B1 Quick Kindle: 2 s channel
  - B2 Short Wait: −40 s cooldown
  - B3★ Two Lamps: a second ally within 3 tiles is rekindled too
- Anim `kneel` and `channel`. FX: a small hearth fire lights on the fallen one's spot and a lantern-moth circles them;
  they stand up through the light. Sfx `revive` and a soft crackle.

**Hearthsong / Cancion del hogar**: L42, active, heal, party, channel, 10 mana a second, up to 4 s, cd 30 s, *hesk orum
lum*. Every 0.5 s, all allies within 6 tiles heal 3% of their max life (+0.15% → **5.85%**) plus 20 × spell power. A
full channel is 8 pulses. This is **the healer's answer to Burn the Room**. You cannot move during it.
- Nodes:
  - A1 Fuller Voice: +15%
  - A2 Steady Song: damage does not break the channel
  - A3★ Choir of One: the song carries 2 tiles further and cleanses one status per pulse from the lowest ally
  - B1 Walking Song: move at 40%
  - B2 Breath Control: −30% mana a second
  - B3★ Kept Note: the last pulse leaves a Hearth Circle for 4 s
- Anim `channel` with the lantern held up. FX: cream notes (3 px) rising from the Keeper and drifting to each ally, a
  soft ring per pulse. Sfx: a hummed melody, 3 notes, looping (synth voice in sound-palette), one `heal` per pulse.

**Warmth That Stays / El calor que queda**: L85, active, party, 80 · 240 s, *hesk ul orum*. For 10 s, every ally within
8 tiles who would fall is **held at 1 life and healed 30%** instead (once each). The Hush is 0 inside. +0.2 s →
**13.8 s**.
- Nodes:
  - A1 Stronger Hold: heals 45%
  - A2 Brave Hearth: allies inside +15% damage
  - A3★ Twice Held: twice each
  - B1 Wider: 11 tiles
  - B2 Short Wait: −60 s cooldown
  - B3★ Embers Kept: when it ends, everyone inside gains a Lantern Ward at 50%
- Anim `cast-raise` held. FX: a hearth-coloured dome at r8 with slow motes; a held ally flashes cream. Sfx `ultimate`,
  a warm chord.

### 3.3 Moth / Polilla

**Lamp-Wisp / Fuego fatuo**: L1, active, summon, light, shipped. 1 wisp (+0.1) for 30 s, an 8–12 mote each second at 5
tiles; +1/+2, +1 s → **2 wisps, 27–50, 49 s**.
- Nodes:
  - A1 **Moth-Kin** (folded): the kin's motes +10%, +1.5% a rank of this row
  - A2 Healing Wisps: each mote heals the lowest ally 1% of max life
  - A3★ Lantern Swarm: +2 wisps at 50%
  - B1 Long Life: +15 s
  - B2 Cheap Light: −30% mana
  - B3★ Wisp Ward: wisps orbit you and absorb one shot each
- FX: the shipped wisps. Sfx: a tiny chime per mote, at low volume.

**Moth Dust / Polvo de polilla**: L6, active, 10 · 6 s, *lum un sha*. Throws moth dust in a cone 3 tiles deep: Blind 2 s
(+0.05 s → **2.95 s**), and the blinded deal −20% for 4 s.
- Nodes:
  - A1 Thicker Dust: +1 s
  - A2 Itching: blinded foes take +10% light
  - A3★ Dust Storm: a full ring r3
  - B1 Long Throw: 5 tiles
  - B2 Cheap: −40% mana
  - B3★ Glim's Dust: blinds even the Blind-immune for half the time
- Anim `throw`. FX: a cream-grey puff of 12 pixels that drifts and fades. Sfx: a soft "pff" noise burst, high-passed.

**Beacon / Baliza**: L12, active, light, shipped. A lantern on a pole for 12 s, a 6–10 mote a second at 5 tiles, a
fixed light; +2/+3, +0.3 s → **44–67, 17.7 s**.
- Nodes:
  - A1 Brighter Pole: +15%
  - A2 Warm Pole: allies within 3 regenerate 1% life/s
  - A3★ Two Beacons: two may stand
  - B1 Long Burn: +6 s
  - B2 Waymark: allies within 4 +10% move
  - B3★ Hush-Light: counts as a hearth for the Hush
- FX: the shipped lantern on a pole. Sfx: a soft click on planting.

**Moth Swarm / Enjambre de polillas**: L30, active, light, 24 · 12 s, *lum teth orum*. 12 moths (+0.3 → **17**) circle
r3 round you for 6 s. Each foe inside is Blinded 1 s on entry and nibbled 6–9 (+1/+2) → **25–47** a second.
- Nodes:
  - A1 Hungrier: +15%
  - A2 Glim's Cousins: moths reveal the hidden inside (stealth, Mirrored)
  - A3★ Follow the Light: the swarm goes to the target, r3 round it
  - B1 Long Swarm: +4 s
  - B2 Gentle Wings: allies inside heal 0.5%/s
  - B3★ Moth Wall: the swarm blocks shots that cross it
- FX: 12–17 cream moth sprites (3×2 px, 2-frame flap) on a slow orbit. Sfx: a soft flutter bed.

**Glim's Margin / El margen de Glim**: L50, active, 30 · 20 s, *lum vesh ka*. Glim flies a circle of 8 tiles round you.
For 6 s (+0.2 s → **9.8 s**) everything hidden inside is **revealed**:
- stealthed creatures;
- Mirrored copies (Glim dims beside the copy, the canon tell);
- Keepers in Fogwalk (PvP);
- shy chests.

Allies +15% crit against the revealed. Lore: Glim keeps the map's blanks and dims beside false things.
- Nodes:
  - A1 Keener Eye: +20% crit
  - A2 Marked Page: revealed foes are Marked 6 s
  - A3★ Margin Note: reveals a hidden cache or sealed door within 12 tiles once a day (a ping on the minimap)
  - B1 Wider Margin: 11 tiles
  - B2 Quick Margin: −8 s cooldown
  - B3★ Glim Stays: the reveal follows you for its length
- Anim `cast-raise`. FX: Glim's sprite flies a ring trailing cream dust; revealed things get a cream outline. Sfx `glim`
  (the shipped glassy two-note hum) and a page-turn rustle.

**The Sixth Light / La sexta luz**: L100, active, 120 · 240 s, *lum ul hesk*. For 15 s the Keeper is lit from inside
(the sixth tally mark):
- every heal +50%, and it also lands on 2 more allies at 50%;
- Kindle becomes a Chain of Lamps;
- light radius ×2;
- allies within 8 cannot be Hushed or Branded.

+1% → **+69%**.
- Nodes:
  - A1 Brighter Still: +10% heals
  - A2 Light Through: allies within 8 take −15%
  - A3★ A Fresh Mark: when it ends, every ally within 8 heals to full once
  - B1 Short Wait: −60 s cooldown
  - B2 Long Light: +5 s
  - B3★ The Lamp Carries: you move +20% and carry the Hearth Circle with you
- FX: the sprite glows cream from inside, six small tally lights orbit, the sixth brightest. Sfx `ultimate` and a
  bright bell.

---

## 4. Thornstrider / Caminaespinas: single target, weather, PvP

Trainer: Canopy Warden Ilsa Fenn. Trees: **Thorn** / *Espina* (the bow), **Wild** / *Salvaje* (the beast), **Briar &
Sky** / *Zarza y Cielo* (the ground and the weather).

**What changes.**
- Heartwood folds into Thorn Shot, and Wild Heart into Pack Bond.
- New rows: Hunter's Mark, Pinning Shot, Heartseeker, Thornrain, the Hundred-Year Shot, Feral Leap, Elder Beast, the
  Wild Lets Through, Call the Rain, Fogwalk, Lightning Call, Gale, and the capstone Eye of the Storm.
- **The weather skills read the world's weather** (world-acts.md §3). Each gains in the matching sky and can make a
  small one where there is none.

### 4.1 Thorn / Espina

**Thorn Shot / Disparo de espina**: L1, basic attack, physical, shipped. 6–10, +2/+3 → **44–67**, 6 tiles, pierce 15%
+0.5 → **24.5%**.
- Nodes:
  - A1 **Heartwood** (folded): every arrow +10%, +1.5% a rank of this row
  - A2 Barbed Tips: 20% to Bleed 2 s
  - A3★ Hunter's Rhythm: every 4th shot crits
  - B1 Long Bow: +2 tiles
  - B2 Thorn Through: +10% pierce
  - B3★ Mark-Seeker: shots curve to a Marked foe within 2 tiles of the aim
- Anim `draw`. FX: the shipped arrow, a 3-step green trail. Sfx `arrow`.

**Barbed Shot / Disparo de pua**: L1, active, physical, shipped. 8–12 and a bleed 4/s for 5 s; +2/+3, +1 → **46–69,
23/s**. Syn: +5% / rank Heartwood. Heartwood is now Thorn Shot's node, so the synergy reads Thorn Shot's ranks.
- Nodes:
  - A1 Deeper Barbs: +20% bleed
  - A2 Festering: the bled take +10% from you
  - A3★ **Hushing Barb**: Hushes 1.5 s (an interrupt; bosses: cancels the cast in progress)
  - B1 Quick Draw: −1.5 s cooldown
  - B2 Twin Barb: a second arrow at 50%
  - B3★ Spreading Barbs: on death, the bleed jumps to 2 foes within 3 tiles
- FX: a barbed arrow, a rust pip. Sfx `arrow` and a tearing noise, soft.

**Volley / Andanada**: L1, active, physical, shipped. 5 arrows (+0.1) in a fan, 5–8 each (+1/+2) → **6 arrows,
24–46**. Syn: +4% / rank Thorn Shot.
- Nodes:
  - A1 Heavier Shafts: +15%
  - A2 Pierce: each arrow pierces 1
  - A3★ Ring Volley: a full ring
  - B1 Wide Fan: +2 arrows
  - B2 Cheap: −25% mana
  - B3★ Rolling Volley: three small volleys over 0.6 s at 45% each
- FX: the shipped fan. Sfx: layered `arrow`s.

**Hunter's Mark / Marca del cazador**: L6, active, 8 · 6 s, *thar vesh*. Marks one foe within 10 tiles for 12 s. It
takes +12% from your party (+0.5% → **21.5%**) and is seen through fog and Fogwalk. One mark at a time.
- Nodes:
  - A1 Deeper Mark: +5% (absolute)
  - A2 Hunter's Share: hitting the Marked heals you 2% of the hit
  - A3★ **Strip**: marking a pack's aura bearer ends the pack aura 6 s (bosses ⅕) (monsters-abilities.md §3)
  - B1 Long Mark: +8 s
  - B2 Moving Mark: on the Marked's death the mark moves to the nearest foe
  - B3★ Beast's Prey: your beast always attacks the Marked, +25%
- Anim `whistle` and a point. FX: a green leaf sigil over the head, slowly turning. Sfx: a two-note whistle.

**Pinning Shot / Disparo clavado**: L12, active, physical, 12 · 8 s, *thar mur sha*. An arrow at 110% of Thorn Shot
(+4% → **186%**). It Roots 1.5 s (+0.05 s → **2.45 s**) and Hushes 1 s.
- Nodes:
  - A1 Heavier Pin: +15%
  - A2 Nailed: rooted foes take +15% from arrows
  - A3★ Pin Two: the arrow pierces and pins a second foe
  - B1 Long Pin: +1 s root
  - B2 Quick: −2 s cooldown
  - B3★ Thorn Ground: the pinned spot grows a Thornroot Snare 3 s
- FX: an arrow that stays in the ground, thorns curling round the foe's feet. Sfx `arrow` and a woody thunk.

**Heartseeker / Buscacorazones**: L24, active, physical, 20 · 6 s, *thar vesh sha*. Draw 1 s, then one arrow at 400%
of Thorn Shot (+12% → **628%**) that pierces everything in its line (12 tiles). ×2 on the Marked.
- Nodes:
  - A1 True Aim: +15%
  - A2 Deep Wound: Bleed 4 s at 10%/s
  - A3★ Through the Heart: crits always on the Marked
  - B1 Quick Draw: 0.6 s
  - B2 Steady: moving does not cancel the draw (you walk at 50%)
  - B3★ Windborne: in wind or storm, +40% and +4 tiles
- Anim `draw` held. FX: a glow gathers at the arrowhead during the draw; the shot leaves a 1-px white line for 0.2 s.
  Sfx: a string creak rising, then a sharp `arrow`.

**Thornrain / Lluvia de espinas**: L42, active, physical, 28 · 10 s, *thar dra*. Arrows rain in r3 round the target for
3 s, 8 arrows a second on random tiles. Each 12–18 in r0.75 (+2/+3) → **50–75**. Syn: +4% / rank Volley.
- Nodes:
  - A1 Heavier Rain: +15%
  - A2 Thorn Ground: the ground stays thorny 3 s (Root 0.5 s on entry, once)
  - A3★ Storm of Thorns: r4, 4 s
  - B1 Follow the Prey: centres on the Marked and moves with it
  - B2 Cheap: −25% mana
  - B3★ Wet Wood: in rain, every arrow is also lightning at 30%
- Anim `draw` upward. FX: a volley lofted high, then green streaks falling, thorn sparks. Sfx: a soft hiss of falling
  arrows and thunks.

**The Hundred-Year Shot / El disparo de cien anos**: L70, active, physical, 45 · 30 s, *thar ul sha*. Draw 2 s, then
one arrow at 1200% of Thorn Shot (+30% → **1,770%**). A creature (never a boss, never a Keeper) at ≤ 15% after it
falls outright. Lore: a Canopy Warden "draws for a hundred years"; nine generations have kept the Bole (canon:
Ilsa Fenn).
- Nodes:
  - A1 Old Wood: +15%
  - A2 Heartwood Arrow: the shot ignores half of physical resist
  - A3★ Ninth Generation: the execute threshold is 25%
  - B1 Patient Draw: 1.3 s
  - B2 The Wood Watches: during the draw you are Fogwalked
  - B3★ Echoing Shot: 30% of it strikes the next foe in line
- Anim `draw` held 2 s, leaves drifting round the Keeper. FX: the bow grows rootglass light, the arrow a long green
  streak with a slow trail. Sfx: wood creaking, a long breath, a deep `arrow` and an echo.

### 4.2 Wild / Salvaje

**Command / Orden**: L1, active, shipped. The beast runs to a foe within 10 for 6 s (+0.2 s), bites 60% (+6%) harder,
and a tired beast rises → **9.8 s, +174%**.
- Nodes:
  - A1 Fierce: +15%
  - A2 Hamstring: commanded bites Chill 1 s
  - A3★ Hold Them: the commanded beast Taunts its foe (a pet tank, solo)
  - B1 Long Command: +3 s
  - B2 Quick Whistle: −2 s cooldown
  - B3★ Pack Command: also the second beast (Call of the Wilds)
- FX: a green arrow line from Keeper to foe, the pet's dash. Sfx: a whistle and `beast`.

**Pack Bond / Lazo de manada**: L1, aura, shipped. Within 4 tiles of the beast: you and it take 10% (+0.5) less, beasts
bite 15% (+2) harder → **19.5%, 53%**.
- Nodes:
  - A1 **Wild Heart** (folded): every beast +10%, +1.5% a rank of this row
  - A2 Shared Hurt: 20% of the damage you take goes to the beast instead
  - A3★ One Pack: allies within 4 of the beast get the damage cut too
  - B1 Long Leash: 6 tiles
  - B2 Fur and Leaf: +10 to every resist for you and the beast
  - B3★ Wild Blood: the beast's bites heal you 5% of the bite
- FX: a thin green line between Keeper and beast. Sfx: none.

**Call of the Wilds / Llamada de lo salvaje**: L6, active, shipped. A second beast for 20 s (+1), 5–8 a bite (+2/+3) →
**39 s, 43–65**.
- Nodes:
  - A1 Bigger Beast: +20%
  - A2 Wolf, Bear or Hart: choose its kind by the land (Reach: ash wolf, fast; Verdant: hart, knocks back; Umbral:
    marsh hound, Chills)
  - A3★ Two Called: two at once at 60%
  - B1 Long Stay: +15 s
  - B2 Cheap Call: −30% mana
  - B3★ Spirit Beast: the called one is a spirit and cannot be hit
- Anim `whistle`. FX: a beast trots in from off-screen. Sfx: a howl, short.

**Feral Leap / Salto feral**: L18, active, 10 · 8 s, *thar sha ka*. Leap 4 tiles away from the nearest foe (or the aim)
and the beast bites the nearest foe for 100%. Roots the foe you left 0.5 s.
- Nodes:
  - A1 Bitter Bite: +30% bite
  - A2 Parting Shot: a free Thorn Shot at the top of the leap
  - A3★ Double Leap: a second leap within 2 s, free
  - B1 Long Leap: +2 tiles
  - B2 Quick: −3 s cooldown
  - B3★ Into the Leaves: 1.5 s of Fogwalk on landing
- Anim: a crouch and a jump arc. FX: a leaf burst at both ends. Sfx: a whoosh, a soft land.

**Stampede / Estampida**: L24, active, shipped. 5 (+0.1) spectral beasts charge 7 tiles, 40–60 (+8/+12), knock back →
**6 beasts, 192–288**. Syn: as shipped (+5% / rank Call, +4% / rank Wild Heart, which reads Pack Bond's ranks).
- Nodes:
  - A1 Heavier Hooves: +15%
  - A2 Trampled: knocked foes are Stunned 0.5 s
  - A3★ Return Charge: they run back through at 50%
  - B1 Long Run: +4 tiles
  - B2 Cheap: −20% mana
  - B3★ The Herd Remembers: every beast passing an ally heals them 2%
- FX: the shipped spectral beasts. Sfx: a hoofbeat roll.

**Elder Beast / Bestia anciana**: L50, active, 40 · 60 s, *thar teth ka*. The beast grows ×1.5 for 15 s (+0.3 s →
**20.7 s**): +60% life, +40% bite, its bites strike r1.5. It Taunts on each bite. This is the pet off-tank: in a party
its threat is halved.
- Nodes:
  - A1 Older Still: +20% bite
  - A2 Thick Hide: −20% taken
  - A3★ Wake the Wood: its first bite calls a Stampede at 50%
  - B1 Long Age: +8 s
  - B2 Quick: −20 s cooldown
  - B3★ Mossback: it heals 2% a second
- FX: the pet sprite scales ×1.5, moss and small antlers drawn on. Sfx: a deep growl.

**The Wild Lets Through / Lo salvaje deja pasar**: L85, active, party, 60 · 180 s, *thar ul vesh*. For 10 s (+0.2 s →
**13.8 s**), you and allies within 6:
- pass through creatures;
- cannot be Rooted, Chilled or Frozen;
- move +30%;
- beasts +50%.

This is the canon line made a skill.
- Nodes:
  - A1 Faster: +15% move
  - A2 Brambles Part: foes you pass through are Rooted 1 s
  - A3★ Wild Path: leaves a 10-tile path where allies keep +30% move for 10 s after
  - B1 Wider: 9 tiles
  - B2 Short Wait: −60 s cooldown
  - B3★ Unseen Passage: allies are Fogwalked for its first 3 s
- FX: green leaves streaming behind each ally. Sfx `wind` warm and a bird call.

### 4.3 Briar & Sky / Zarza y Cielo

**Thornroot Snare / Lazo de raiz espinosa**: L1, active, shipped. A 3-tile thorn line for 8 s: 6–10 (+2/+3) and Root
1.5 s (+0.05) → **44–67, 2.45 s**. Syn: +4% duration / rank Rootwalk.
- Nodes:
  - A1 Sharper: +20%
  - A2 Grasping: roots again after 3 s
  - A3★ Ring of Thorns: a ring r2 instead
  - B1 Long Line: +2 tiles
  - B2 Long Wait: +4 s
  - B3★ Mud and Thorn: in rain the root is 1 s longer
- FX: the shipped thorns. Sfx: a creak of wood.

**Bramble Trap / Trampa de zarzas**: L6, active, shipped. A trap 30 s, two at most, 20–30 (+5/+7) to all within 1.5
tiles, root 2 s → **115–163**. Syn: +5% / rank Snare.
- Nodes:
  - A1 Heavier: +15%
  - A2 Thorn Cloud: bursting, it Bleeds 3 s
  - A3★ Three Traps: three may stand
  - B1 Wide Burst: +0.5 tile
  - B2 Throw Trap: placed up to 5 tiles away
  - B3★ Storm Trap: in rain it is lightning and Shocks
- FX: the shipped bramble. Sfx: a snap.

**Rootwalk / Paso de raiz**: L12, active, shipped. 4 s (+0.1): +30% (+1%) walk, creatures lose your track → **5.9 s,
+49%**.
- Nodes:
  - A1 Quicker: +10% move
  - A2 Leaf-Shadow: the first shot after it crits
  - A3★ Rootwalk Party: allies within 4 too
  - B1 Long Walk: +2 s
  - B2 Quick: −4 s cooldown
  - B3★ Mossfoot: no footsteps (the Hush rises 50% slower)
- FX: the shipped leaf trail. Sfx: soft steps.

**Call the Rain / Llamar la lluvia**: L18, active, weather, 20 · 20 s, *vor dra*. A rain cloud r4 over a spot for 10 s
(+0.3 s → **15.7 s**): all inside are **Wet** (§0.4). Fire inside −15%. Fire fields (burning ground, Flame Walls,
creature fire) there go out in 2 s. If the world is already raining there, the cloud **thunders**: one strike every 2 s
on a random foe inside, 30–44 lightning (+4/+6) → **106–158**.
- Nodes:
  - A1 Heavy Rain: thunders even in clear weather, at 50%
  - A2 Cold Rain: inside, foes are Chilled every 3 s
  - A3★ Squall: r6
  - B1 Long Rain: +5 s
  - B2 Cheap Sky: −30% mana
  - B3★ Moving Cloud: it follows the Marked
- Anim `cast-raise`, the bow pointed up. FX: a grey pixel cloud disc over the spot, slanted blue-white rain streaks
  inside its circle, puddle decals. Sfx: the `rain` bed localised (fades with distance) and `lightning-hit` on strikes.

**Fogwalk / Paso de niebla**: L30, active, weather, 22 · 24 s, *vor nyr*. A fog bank r4 where you stand for 10 s
(+0.3 s → **15.7 s**):
- creatures lose allies inside past 2 tiles, and ranged creatures cannot aim in;
- **in PvP, Keepers inside are hidden from Keepers outside** (a faint shape only), unless revealed by Glim's Margin or
  Hunter's Mark;
- your first shot out of it +50%.

In world fog it costs no mana.
- Nodes:
  - A1 Deep Fog: hidden past 1 tile
  - A2 Fog-Arrows: arrows from inside Chill
  - A3★ Fog Follows: the bank follows you
  - B1 Wide Bank: r6
  - B2 Long Fog: +5 s
  - B3★ Hush in the Fog: the Hush cannot rise inside (it is your fog)
- FX: two layers of the engine's fog bank at 70% opacity in a soft-edged disc; a faint outline of the hidden. Sfx: a
  muffled `wind`, and the world's sounds low-passed inside.

**Lightning Call / Llamar el rayo**: L42, active, lightning, 24 · 5 s, *lum vor dra*. A 0.6 s ring tell at the target,
then a strike r1.5: 50–72 lightning (+8/+11) → **202–281**. On a **Wet** foe it chains to 2 more (3 when storming).
In a thunderstorm the cooldown is halved. Syn: +5% / rank Call the Rain.
- Nodes:
  - A1 Brighter Bolt: +15%
  - A2 Afterclap: everything in r3 is Shocked
  - A3★ Fork: two strikes, 1 tile apart, 70% each
  - B1 Quick Sky: no tell in a storm (it lands at once)
  - B2 Cheap: −25% mana
  - B3★ Bolt of the Mark: always lands on the Marked first, wherever it moves in the tell
- Anim `cast-raise` with the bow. FX: a white ring tell, then a 3-segment vertical bolt from the top of the screen, a
  1-frame flash (capped at 25% and not under reduced motion), a scorch decal. Sfx `lightning-cast` during the tell,
  then a `lightning-hit` crack and a long rumble.

**Gale / Vendaval**: L60, active, weather, 30 · 12 s, *vor orum*. A ring of wind r3. It knocks foes back 2 tiles (bosses
⅕) for 20–30 (+3/+5) → **77–125**. It puts out Burn on allies. It clears world fog,
Fogwalk and the rain's Wet in r6 for 6 s (nothing in that ring is Wet, and new Wet cannot land there). Projectiles
inside are turned aside for 2 s.
- Nodes:
  - A1 Harder Wind: +3 tiles knockback
  - A2 Cold Wind: Chills
  - A3★ Whirlwind: a moving whirlwind 6 tiles along the aim, knocking everything it passes
  - B1 Wide Gale: r4
  - B2 Quick: −3 s cooldown
  - B3★ Tailwind: allies +20% move for 4 s
- FX: curved white wind lines spiralling out, leaves swept. Sfx: a loud `wind` swell and a whoosh.

**Eye of the Storm / El ojo de la tormenta**: L100, active, weather, 100 · 240 s, *vor ul orum*. For 20 s (+0.3 s →
**25.7 s**) the Keeper calls a thunderstorm r10 round themselves. Everything inside is Wet. A strike lands every 1.5 s
on the Marked or the nearest foe, at Lightning Call's numbers. Allies' lightning +35%. The world's weather sound
follows. Glim: "Whoever asked the sky, it said yes."
- Nodes:
  - A1 Fiercer: a strike every 1 s
  - A2 Hail: strikes also drop hail (cold, r1, Chill)
  - A3★ The Calm: you and allies within 3 of you take −30%
  - B1 Short Wait: −60 s cooldown
  - B2 Wide Sky: r14
  - B3★ Storm Rider: you move +30% and Gale is free in it
- Anim `cast-raise` held 0.8 s. FX: the sky dims 30% in r10, a ring of dark cloud at the edge, rain streaks and strike
  bolts. Sfx `ultimate`, the `rain` bed and thunder.

---

## 5. The Common page (every calling): unchanged

Light, Seek and Waygate are shipped and keep their rows and numbers. **They have no nodes.** The row shows six grey
lantern-glass circles and the line "Common spells take no marks." / "Los hechizos comunes no llevan marcas."

---

## 6. Every shipped skill: where it goes

| Shipped skill | Now |
|---|---|
| Ember Bolt, Hellfire Nova, Aura of Embers, Cinder Rain, Flame Wall, Meteor | rows (Ember) |
| **Ember Mastery** (passive) | Ember Bolt A3★ |
| Bone Spear, Raise Skeleton, Corpse Burst, Bone Armor, Bone Storm | rows (Bone) |
| **Soul Harvest** (passive) | Bone Spear B1 (its Soul rule kept: +1 Soul a kill per 5 ranks, now of Bone Spear) |
| **Skeleton Mastery** (passive) | Raise Skeleton A1 |
| Drain Life, Ember Curse, Dark Ward, Aura of Siphoning, Weaken, Doom | rows (Shadow) |
| **Life Tap** (active) | Dark Ward A2 (a bar key that held it is emptied, skill-book.md §6) |
| Watch Blade, Ember Brand, Cinder Cleave, Whirl of Cinders | rows (Brand) |
| Shield Bash, Shield Oath, Watch Cry | rows (Oath) |
| **Hold the Line** (passive) | Shield Oath A1 |
| Ash Stride, Watchfire, Vow of the Last Watch | rows (Ash) |
| **Ember Blood** (passive) | Watchfire A1 |
| Kindle, Blinding Flash, Lantern Aura, Shutter, Banish, Dawn at Noon | rows (Lamp) |
| Hearthlight, Hearth Circle, Lantern Ward | rows (Hearth), now ally heals |
| **Last Light** (passive) | Lantern Ward A3★ |
| Lamp-Wisp, Beacon | rows (Moth) |
| **Moth-Kin** (passive) | Lamp-Wisp A1 |
| Thorn Shot, Barbed Shot, Volley | rows (Thorn) |
| **Heartwood** (passive) | Thorn Shot A1 |
| Command, Pack Bond, Call of the Wilds, Stampede | rows (Wild) |
| **Wild Heart** (passive) | Pack Bond A1 |
| Thornroot Snare, Bramble Trap, Rootwalk | rows (Briar & Sky) |

**Synergies that named a folded passive** now read the ranks of the row that holds it:
- Hold the Line → Shield Oath;
- Ember Blood → Watchfire;
- Heartwood → Thorn Shot;
- Wild Heart → Pack Bond;
- Moth-Kin → Lamp-Wisp.

**Spellstones' Soul.** Soul Harvest's +1 Soul per 5 ranks (spellstones.model `SOUL_HARVEST_STEP`) now reads the Bone
Spear rank, **only when the B1 node is taken**.

**Row counts:** Warlock 25, Ashguard 21, Lanternwright 21, Thornstrider 21, plus the Common page's three.

---

## 7. Balancing in combat-sim

Builder notes for `scripts/combat-sim.mjs` and loot-and-combat.md §13:
- **PATHS** gain nodes. A simulated Keeper takes his main row's A1 → A2 → (A3★ or B3★, by role) as soon as the ranks
  allow, then the basic attack's nodes, then the second row's. Each calling's sim path names its star choices, so the
  sim reads the build players will copy.
- **The folded passives' values move.** Ember Mastery capped at +30% (was +67% at 20), Heartwood +10% + 1.5%/rank (was
  +10% + 3%), and so on. The ±25% vocation band on one foe must be re-run first. If one calling falls out, tune that
  row's **A1** (one number), never the rule.
- **New cells.** Levels 50, 70 and 100 against rule-level creatures (leveling.md's life 30 + 12.5·L, blow 4 + 0.7·L), so
  the late rows can be banded before their content exists. Bands are the same as at 40.
- **Party cells** (new, `--party`): a party of the four callings against a party-form boss (monsters-abilities.md
  §5.3).
  - The healer's heals per second must cover ≥ 120% of the boss's sustained damage on the tank when the tank is in
    Shield Oath and Banner.
  - Without the healer the party falls in ≥ 70% of runs. This proves the boss **needs** a healer.
  - Without the tank, a non-tank Fixated dies in ≤ 3 boss blows. This proves it needs a tank.
  - Without AoE, the add wave overruns the party (≥ 50% falls).
- **Heals scale with level** (Hearthlight, Hearth Circle: ×(1 + 0.03·L)). This must keep a level-50 healer's single heal
  at 25–40% of a level-50 Keeper's life.
- **PvP is not simulated** until online M3. The ×0.5 rules are a starting point.

---

## 8. Build order (this doc's share; the full queue is campaign.md §4)

1. **The book and nodes** (skill-book.md): NodeDef, the save, the folds, the migration. No new rows yet. (L)
2. **Animation and sound for every shipped row** (§0.6 kit and each row's line). (M)
3. **Healer and tank kit to 30**: ally targeting, Cleanse, Rekindle, Banner, Intercept, Brand Throw, Hunter's Mark and
   Pinning Shot, with the party sim cells. (M)
4. **Rows 30–50**: Rime Lance, Raise Grave-Mage, Kiln Breath, Pyre Strike, Hold the Gate, Watchquake, Chain of Lamps,
   Hearthsong, Moth Swarm, Glim's Margin, Fogwalk, Call the Rain, Lightning Call, Thornrain, Elder Beast, Ossuary
   Golem. (L)
5. **Rows 60–100** (as content reaches them): Blizzard, Rain of the Caldera, the Five-Struck Blow, Lighthouse, the
   Hundred-Year Shot, Gale, the L85 party skills, and the four capstones. (L)
