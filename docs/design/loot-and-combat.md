# Loot & Combat — the single source of truth

Owner of this file: the loot-and-combat agent (items, drops, monsters, bosses, auras, spells).
Owner asks it answers (2026-10-15): *"drop effects when good items drop like in Diablo 4 … purple and legendary
items in different colors … aura effects like D2's Redemption or Conviction … D2-style drops with the runes … make it
as hard as Diablo 2."*

Code lives in `src/app/shared/loot/` (pure modules + `LootService` + the Loot & Combat sheet), the engine
(`play/engine/engine.ts`, `loot-fx.ts`) and the host (`play/side-scroller.component.ts`). Every number below is in
code; when they disagree, the code and `node scripts/economy-sim.mjs --loot --combat` win and this file is stale.

---

## 1. Audit — what existed on 2026-10-15

| Area | Existed | State |
|---|---|---|
| Rarity | One 7-rung ladder (`RuneTier`: common…singular) shared by runes, items, charms, achievements | Good; kept, not forked |
| Item rolls | Per-rarity bands, frozen `stats` + per-stat `rollQuality` grade at mint (`item-definition.ts`, `item-quality.ts`) | Good; drops mint through it |
| Uniques | 44 named objects (`unique-items.ts`) at authored rarity, with a passive tag nothing read | Good; 4 now carry auras |
| Runes | 22 Forge runes, drop budget per tier, MF curve (`rune.model.ts`) | Forge-only source; now creatures drop them too |
| Runewords | Two kinds: Forge Runewords (consumed, account bonus) and **Socket Words** (ordered runes in an item's wells, `socket-words.ts`) | Socket Words are D2 runewords; now they carry auras |
| Creatures | 21 creature keys, `MonsterDef` = HP + drop table; every creature walked, wound up 0.85 s, hit for a flat **12** | No levels, no types, no resists, no packs |
| Drops | Area/creature tables of coins + materials, optional rarity (beam colour only) | No gear or runes ever dropped from a kill |
| Drop look | Beam + ground ring by rarity, hover caption, flight to the satchel | Thin beams, no labels, no sound, no filter |
| Combat | Keeper damage 10–60 (`strikePower`), HP 100–250 (`ward`), dodge, the staff blast | No damage types, no resists, no auras, death cost nothing |
| Bosses | Guardians with mechanics (furnace vents, light, heart-roots, prism beam, orrery field) | Good; they are bosses here |

## 2. Rarity tiers and colours (one ladder, read the Diablo way)

`shared/loot/loot-tiers.ts` maps each rung; colours are the ladder's own (`RUNE_TIERS`), never a second palette.

| Rung | Colour | D2/D4 reading | On the ground |
|---|---|---|---|
| common | `#8f8aa1` grey-white | Normal | a glint only, no sound; hidden by the filter |
| uncommon | `#9db8a8` sage | Magic | short beam, small blip |
| rare | `#00d4ff` blue | Rare | beam ×1 (150 px), 3 sparkles, chime, **edge pip** |
| epic | `#a855f7` purple | D4 purple | beam ×1.35, 5 sparkles, horn |
| legendary | `#e8c898` gold | Unique gold | beam ×1.8, 7 sparkles, **the legendary chime** |
| mythic | `#f8e8c8` white-gold | Set / ancient | beam ×2.2, 9 sparkles, impact chime |
| singular | `#ff6dd7` void pink | Runeword-grade | beam ×2.6, 12 sparkles |

A **unique** (named object) drops at its authored rarity and adds a crown of four pixels and a top rule on its
plate, so a gold *name* reads differently from a gold *roll*.

## 3. Affixes and rolls — every item is a roll (owner, 2026-10-20)

Owner: *"other stats like defense, faster cast speed, movement speed on boots … all items can be good with nice
stats that range, perfect item rolls, every item is a roll, like an RPG dungeon crawler."* Reference card:
`docs/design/refs/cozy/top-heroes-items.jpg`.

Unchanged and respected: stats roll at **mint** and freeze with a per-stat grade (`rollQuality`, 0..1 inside the
range that item could roll); temper never touches the grade; nothing back-fills it; drops mint at pickup in
`LootService.grantDrop`, seeded by the drop id.

**What an item is now:** a base (its definition: slot, look, name, lore), an **item level** (where it dropped: the
monster's level; a shop or Forge mint uses its own), a rarity, an **implicit** the base always has, and
**affixes** drawn from its slot's pool without repeats. Every number rolls inside a range set by item level and
rarity, and the card shows the range beside the roll (`+7 Defense [4–9]`), D4-style.

| Rarity | Affixes | Range multiplier |
|---|---|---|
| common | 0 | ×1.0 |
| uncommon | 1 | ×1.15 |
| rare | 2 | ×1.35 |
| epic | 3 | ×1.55 |
| legendary | 4 | ×1.8 |
| mythic | 5 | ×2.2 |
| singular | 5 | ×2.8 |

**Implicits:** weapon → Spell Damage %; armour (head, chest, hands, legs, feet, off-hand) → Defense; trinket → Life.

**The combat stats** (`ItemStats`, each read by the top-down fight through `equippedTotals`):

| Stat | Range at item level 1 (×rarity) | Growth per item level | Cap (worn total) | Slots that roll it | What it does |
|---|---|---|---|---|---|
| Life | 4–8 | +0.9 | — | all but weapon | max life |
| Mana | 3–6 | +0.6 | — | weapon, head, trinket, off-hand | max mana |
| Defense | 2–5 | +0.8 | — | armour | blows reduced by Defense ÷ (Defense + 40 + 6×level) |
| Spell Damage % | 3–6 | +0.25 | 150 | weapon, head, trinket, off-hand | multiplies every spell and the staff bolt |
| Cast Speed % | 3–6 | +0.1 | 40 | weapon, hands, trinket | shortens spell cooldowns and the bolt's pace |
| Movement Speed % | 4–7 | +0.1 | 40 (with Agility) | **feet only** | faster on foot |
| Critical Chance % | 1–3 | +0.05 | 40 | weapon, hands, trinket | a crit hits ×1.75 |
| Life Regen /s | 0.2–0.6 | +0.03 | — | chest, legs, trinket | life back each second |
| Mana Regen /s | 0.2–0.6 | +0.03 | — | head, weapon, off-hand, trinket | mana back each second |
| Magic Find % | 2–4 | +0.1 | — | every slot | loot odds (D2's MF gear) |
| XP % | 1–3 | +0.05 | — | weapon, head, chest, legs, feet, trinket | Hunting XP |
| Fire / Cold / Lightning / Arcane Resist % | 3–6 | +0.15 | 75 each | armour + trinket | cuts that element's blows and shots (§6) |
| All Resist % | 2–4 | +0.08 | 75 (per element, with the element's own) | trinket | adds to all four resists |

Every slot has at least five affixes to draw from, so a mythic always gets its five. Gold/sec, Strike and Ward stay
on old saves and the Forge, but new mints no longer roll them; nor does gear roll anything off a definition's old list (owner: the idle
gold-per-second is out of the game for now).

**Perfect rolls:** every number carries its grade; an item whose every grade is ≥ 95% is **Perfect** and ≥ 99.9%
**Flawless** (the thresholds in `item-quality.ts`), named on the card and priced ×3 / ×5 at the till.

Resists (2026-10-20): the four elements of `DamageType` (fire, cold, lightning, arcane — arcane is the world's
"shadow"/light school) roll as their own affixes on armour and the trinket, never on the weapon; All Resist is the
trinket's smaller prismatic roll. They share the slot's draw, so boots now roll Movement Speed less often (a
legendary's four picks come from ten, not six). The card pips wear the element (fire `--cozy-loot-legendary`, cold
`--cozy-loot-rare`, arcane `--cozy-loot-epic`, lightning `--cozy-loot-mythic`, all `--cozy-brass-hi`); the stat sheet
(C) lists each element's worn total once a piece carries it.

### 3.4 Requirements (owner, 2026-10-21: "items need requirements")

Every piece of gear asks for a **Keeper level** — the Hunting level the HUD shows — and some bases also for an
**attribute**. One file owns the rules: `src/app/shared/rpg/item-requirements.ts`.

| Rule | Value |
|---|---|
| Required level | `max(1, itemLevel − 5)` + rarity bonus, never above the item level |
| Rarity bonus | legendary +2, mythic +3, singular +4 (uniques are legendary or better, so they inherit it) |
| No item level (old saves, starters, forged tools) | level 1, no attribute |
| Attribute minimum | from required level 6: `floor(requiredLevel / 2)` points in the base's attribute |
| Vitality | plate, helm, greaves (legs), shield, hammer, mace, greatsword, axe |
| Spirit | staff, wand, tome |
| Agility | bow, crossbow, dagger |
| Energy | robe, hood |
| Level only | sword, spear, gloves, boots, belt, coat, crown, circlet, ring, amulet, trinket, charm, tools |

A drop from a creature up to five levels above the Keeper is wearable at once; a level-30 legendary staff asks for
level 27 and 13 Spirit. The base comes from `item-base.ts` (the same table the icon painter reads).

**Where it shows:** the hover and pinned item card list `Requires Level N` / `Requires N Spirit` above the foot, in
berry red when unmet; Equip is disabled with the reason under the card ("You need level 27 to wear …"). The paper doll
refuses too: the play screen hands `InventoryService.setWearCheck` the Keeper's standing, so every equip path checks it.
**Already-worn pieces are never stripped** — the check gates putting a piece *on*, not keeping it. Compare rows are
unchanged.

## 4. Monster families and roles

`shared/loot/creature-families.ts`: one profile per creature key — family (shared resists, blow type), role, level.

| Family | Resists | Blow | Members |
|---|---|---|---|
| maw | fire 25, lightning −15 | physical | Rivet Maw, Cinder Bailiff, Seam Eater, Ironwood Sentinel |
| beast | fire −10 | physical | Rootglass Stag, Prism Forager (lightning) |
| ember | fire 75, cold −25 | fire | Banked Ember, Drowned Lamp, Banked Furnace |
| shade | physical 30, cold 50, arcane −30 | cold | Mirror Substitute, Ink Lantern, Shadeling, Gloam Warden |
| graft | lightning 50, cold 20, fire −20 | physical | Graftling, Graftmother |
| prism | arcane 60, lightning 25, physical −10 | lightning | Afterimage Moth, Prismling, Hollow Sun (fire) |
| orrery | cold 40, physical 15, lightning −20 | arcane | Ephemeris Leech, Anchor Warden, Fallen Ephemeris |
| bone | cold 40, fire −20 | physical | Bone Walker (6), Bone Archer (8, ranged), Ash Ghoul (9), Cinder Wraith (12, cold), the Ashbone Dragon (25, boss, fire) |
| orc | fire 20, cold −10 | physical | Cinder-clan Orc (10), Orc Firecaller (13, ranged fire), Orc Warlord (16, champion) |

The top-down world's new creatures (2026-10-20, `play/td/td-mobs.ts`; owner: "lots of scary monsters like skeletons,
dragons, orcs, undead stuff"): the **bone** family is the Ashen Bastion's dead garrison (the Ashen Crypt under its
ruins in Infernal Reach, a few Bone Walkers in the Hushed Barrow on Ember Isle); the **orc** family is the Cinder clans
of the Deep Charwood and the Obsidian Badlands; the **Ember Drake** (ember family, 18) hunts the Molten Fields. Ranged
creatures (Bone Archer, Orc Firecaller, Ember Drake, the dragon's breath) loose a shot that flies straight at where the
Keeper stood, so a step aside dodges it; archers and firecallers back off to keep their distance. The Cinder Wraith
drifts over lava and flickers half-seen. The Ashbone Dragon breathes a fan of three fire shots and, once, at half its
life, calls two Bone Walkers to its side. Drops are the realm's materials (cinder ore, ember residue, infernal
heartstone, world-root bark) and Gold; the dragon's `boss` rank rolls the boss gear.

Roles: melee, ranged, healer, shielder, summoner, exploder (each profile names one). **Only melee has its own engine
behaviour today**; the others are data for the living-world agent and the next combat pass (gap §12).
Levels: base (Rivet Maw 1 … Fallen Ephemeris 20) + 1 per 40 Delve rows (max +12) + the difficulty offset.
Blow: `12 × (1 + 0.12 × (level − 1))` × pack × tier. HP: authored × (1 + 0.08 per depth level) × pack × tier.
An unknown key is a level-1 'wild' melee brute (never crashes).

## 5. Champions and uniques (packs)

`shared/loot/champions.ts`. Per spawn, seeded from the player's loot seed + area + spawn + respawn count:

| | Normal | Nightmare | Hell | HP | Blow | Mods | Name |
|---|---|---|---|---|---|---|---|
| champion | 6% | 9% | 12% | ×2.5 | ×1.3 | 1 | blue |
| unique | 2% | 3% | 4% | ×3.5 | ×1.5 | 2–3 | gold, "Sootjaw the Seam Eater" |

Never below level 3 on its own tier's scale (the tutorial Maw stays the tutorial Maw), never a boss, a trait creature
or a minion. Mods (pip colour on the name): **Extra Fast** (×1.6 speed, shorter wind-up), **Extra Strong** (×1.5),
**Stone Skin** (+50 physical), **Fire/Cold/Lightning Enchanted** (its blow takes that type, +50 to it), **Cursed**
(its blows take 25 off every Keeper resist for 4 s — D2's Amplify), **Staff Burn** (its blows add 2 s to the staff
blast — D2's Mana Burn; the Keeper has no mana). **Phones:** the wind-up never drops below 0.55 s, and the `!` and
ground band still show — every blow is telegraphed.

**Top-down elite packs (2026-10-21, roadmap §10 item 3, `play/td/td-elites.ts`).** In the top-down world a spawn
rolls on its own key, deaths and a session salt: 1 in 16 eligible spawns comes up a pack, a quarter of them uniques.
Never in a town or the clear ground round one (`TdWorld.safeAt`), never a boss or an authored champion, never under
level 3, and only within the Keeper's level −10 … +6. A **champion pack** is 2–4 copies (×2.5 life, ×1.3 blow, one
shared affix, a blue aura and tint, blue framed bars); a **unique** is a named leader ("Grimfang the Hollow", from
lore name parts) with 1–3 affixes (×3.5, ×1.5, gold aura and framed bar with studs) and 2–4 ordinary minions.
Affixes: Extra Strong (×1.5 blow), Extra Fast (×1.6 walk, bites ×1.3 sooner), Stone Skin (takes 60% of each hit),
Cursed (blows: −25 every resist and +15% taken for 4 s), Fire Enchanted (fire blows ×1.25; bursts r 26 px 0.6 s after
it falls, its ring on the ground first), Cold Aura (cold blows; −30% to the Keeper's step within 3 tiles, a frost ring
shows the reach), Spectral Hit (each blow a random element, ×1.2), Mana Burn (blows take 14 mana), Teleport (blinks to
the Keeper's side when he stands 4+ tiles off, 0.45 s wind-up, every 5 s), Lightning Enchanted (lightning blows ×1.2);
never two element affixes on one creature. Loot: the rank goes to `rollHuntGold` and `rollCreatureLoot` (Gold ×4/×6,
2×45% / 3×60% item rolls, +1/+2 ladder steps); an elite's ordinary gear never drops common (floored to magic); a unique
leader always leaves at least one magic-or-better piece. A unique's minions drop as normal creatures.

**Eclipse-touched (2026-10-21, design-bible §5.2, `td-phases.ts`).** Under an eclipse, in the open wilds, 1 in 8 wild
spawns comes up Eclipse-touched: a lone creature becomes a champion (×2.5 life, ×1.3 blow, no followers) with the
`eclipse-touched` affix (×1.1 blow) and one ordinary affix; a pack it already leads gains the affix. Its drops climb one
ladder step (`lootRank`: a touched champion drops as a unique — Gold ×6, 3 rolls at 60%; never a boss). Night and the
eclipse also raise every kill's Hunting XP (×1.1 / ×1.2) and Gold pile (×1.1 / ×1.25) in the wilds; the economy sim's
bands are the day's.

## 6. Damage types and resistances

`shared/loot/damage.model.ts`. Types: physical (the swing), fire, cold, lightning, arcane (the staff blast's light).
- Creature resists clamp to [−100, 100]; **≥ 100 is immune**. Conviction lowers resists; against an immunity it works
  at a fifth (D2), so an immunity breaks only when it is close to 100.
- Keeper resists: gear, minus the tier penalty (0 / −40 / −100), minus a curse, **capped at 75**. Physical is never
  resisted (Ward is health). Source of Keeper resists: **runes set in ARMOUR wells** (D2's armour-vs-weapon rule):
  Infernal runes fire, Nocturne cold, Verge lightning, Archivum arcane, the top three all (`aura-sources.ts`
  RUNE_ELEMENT/RUNE_RESIST, 6 → 40 by tier). Hell's −100 needs 175 from armour to sit at the 75 cap.
- **The top-down fight** (`play/td/td-mobs.ts`, 2026-10-20): every creature's blows and shots carry a type —
  `MobDef.hits` if set, else its profile's/family's `creatureHits()`, else physical (`mobHits`). Fire: Lava Hound,
  Cinder Imp, the Ember Warden, the Magma Tyrant (own `hits`), the Ember Drake, Orc Firecaller, Glass Sentinel, the
  Ashbone Dragon, the Cinder Sovereign (profiles); cold: the Cinder Wraith; physical: skeletons, orcs, wolves, golems,
  maws. Incoming (`td-skills.ts` `incomingDamage`): physical is cut by Defense only (D ÷ (D + 40 + 6×level));
  an element by its worn resist only — `dmg × (1 − min(75, resist) / 100)`, never under 1. The worn resist is the
  element's affix total + All Resist, capped at 75 (`fightStats().resists`, read via `equippedTotals.<key>` in
  `wornCombat`). Runes' armour resists and the tier penalty belong to the side view's rules and are not added here
  yet. The floating number takes the type's `DAMAGE_COLORS` (physical stays red); the Bestiary card says "Hits with
  Fire" in the element's colour.
- The Keeper's damage gains the **Hunting level** (D2's character level): +0.5% damage and +2 HP per level past the
  first, capped at 99 (`keeper-combat.ts`). Level 1 adds nothing.

## 7. Auras

`shared/loot/auras.ts` (math), `aura-sources.ts` (who grants them). One runs at a time: the one picked on the Loot &
Combat sheet if worn, else the strongest (highest level). Reach 300 px (× figure). Levels: Socket Word → its rarest
rune's tier (common 1, uncommon 2, rare 3, epic 5, legendary 7, mythic 9, singular 12); unique → its rarity; +1 per
three tempers. Max 20.

| Aura | Effect at level L | Granted by |
|---|---|---|
| Might | +15% + 5%/L damage | Brandoath (Thorn·Scorch, weapon), Worldsplitter |
| Conviction | −(20 + 4/L) to every resist in reach, max 85; marks them | Verdict (Hollow·Sigil, weapon), Eclipse Blade |
| Redemption | +8 + 2/L HP per creature that falls in reach | Mercyroot (Thorn·Veil, armour), Lastwarden |
| Holy Fire | 5 + 3/L fire to all in reach every 1.5 s | Emberseam (Ember·Scorch, weapon), Cinderwake |
| Holy Freeze | 3 + 2/L cold per pulse, slows 30% → 60% | Rimeveil (Veil·Shade, armour) |
| Holy Shock | 6 + 4/L lightning per pulse | Stormglass (Glint·Pulse, weapon) |
| Fanaticism | swing +15% + 3%/L faster, max 60% | Godforge Seal |
| Prayer | 1.5 + 0.5/L HP per second | Vigil (Shade·Ash, armour), Daybreak, Heartwood of the Verge |
| Vigor | move +12% + 2%/L, max 40% | Riftwalk |

Seen: a pixel sigil disc and a dashed reach ring under the Keeper in the aura's colour, rising motes, a flash per
pulse; every creature it marks shows a small sigil pip by its HP bar. Item cards say "Aura: Conviction 3".
Reduced motion: the ring stands still, no motes.

## 8. Difficulty — Normal → Nightmare → Hell

`shared/loot/difficulty.model.ts`. Picked on Menu → Loot & Combat; a tier opens when the **Fallen Ephemeris** (the
bottom of the Orrery Wells) falls on the tier below; stepping down is always allowed.

| | HP | Blow | Level | Keeper resist | Creature resist | Item chance | Ladder shift | Rune cap | Fall |
|---|---|---|---|---|---|---|---|---|---|
| Normal | ×1 | ×1 | +0 | 0 | +0 | ×1 | 0 | Rare | 5% |
| Nightmare | ×2.5 | ×2 | +20 | −40 | +15 | ×1.35 | +1 | Legendary | 10% |
| Hell | ×4 | ×3 | +40 | −100 | +30 | ×1.7 | +2 | Singular | 15% |

**Death (the corpse run):** a fall takes the tier's share of the purse and leaves it, glowing gold with a plate, where
the Keeper fell (`LootService.fall`). Walk back and it comes home. Fall again first and the earlier purse is lost.
No item, rune or stack is ever lost. The fall card says how much.

## 9. Drop tables and the curve

`shared/loot/drop-tables.ts`, on top of each creature's Gold pile (§9b) and material table:

- Item rolls per kill: normal 1 × 8%, champion 2 × 45%, unique 3 × 60%, boss 3 × 100% (× the tier's item chance).
- Rarity: D2's top-down tries — singular, mythic, … uncommon each get a chance; the first success is the rung, none is
  common. Base per-mille: 280 / 80 / 30 / 8 / 1.8 / 0.2. Level lifts rare+ by (1 + level/30); each ladder step
  (tier + rank: champion 1, unique/boss 2) ×1.6. Gates: epic from level 5, legendary 8, mythic 15, singular 25
  (bosses ignore them). Magic Find: full on uncommon, 600/(MF+600) on rare/epic, 250/(MF+250) on legendary+.
- Named uniques: 12% (× unique MF) of a roll on a rung that has them, at their authored rarity — the only path.
- Base pool: the Gambler's (equipment and charms that roll, not soulbound, uniques excluded wholesale).
- Runes: per kill 2% / 12% / 25% / 60% by rank; tier ladder 1 : .16 : .012 : .002 : .0003 : 4e-5 : 2e-6, capped by
  the tier's rune cap and by level (uncommon 3, rare 8, epic 20, legendary 30, mythic 45, singular 55).

`--loot` (150 trash kills/h, 0% MF): the first hunt (Rivet Maw) ≈ 1 rare an hour and never a legendary; a Normal
Delve hunt ≈ 1.2 rare, 0.45 epic, 0.12 legendary an hour; Hell trash ≈ 8 rare, 4 epic, 1.1 legendary, 0.26 mythic,
0.03 singular an hour; a Normal gate boss pays ≥ 1 rare+. Selling an hour of Hell drops is half a minute of 30-minute
income — gear is for wearing, not a Gold farm.

### 9b. Gold from the hunt (owner, 2026-10-21: "monsters drop more gold like in d2")

The forge no longer makes Gold by the second (`economy-curve IDLE_INCOME = false`: no furnace/automaton income, no
offline settlement; the Slate's Homestead face is gone). Gold comes from killing things. Every kill drops a pixel Gold
pile on the ground (`td-engine drawGoldPile`: a stepped coin mound, three sizes by the sum, a glint; "38 Gold" plate
nearby). The Keeper's pull brings it in from 8 tiles, a pet fetches it, and pickup floats "+38 Gold" into the same
ledger (`EconomyService.earnGold`, source `hunt`).

    mean(L, rank) = (4 + 2.5·L·(1 + L/100)) × rank       rank: normal 1 · champion 4 · unique 6 · boss 15
    pile          = mean × uniform(0.6, 1.4), whole Gold, ≥ 1          (economy-curve HUNT_GOLD, rollHuntGold)

| Level | Normal pile | Boss pile | An hour (240 kills) |
|---|---|---|---|
| 1 | 4–9 | 59–137 | ~1.6k |
| 10 | 19–44 | 284–662 | ~7.6k |
| 20 | 38–90 | 576–1,344 | ~15k |
| 40 | 86–202 | 1.3k–3.0k | ~35k |
| 100 | 302–706 | 4.5k–10.6k | ~121k |

Fixed rewards that used to be "N minutes of income" are now N minutes of a steady hunt at their own level
(`huntGold(level, seconds)`): town tasks and dailies, the level milestones. Rewards written as max(floor, seconds of
income) (bounties, heights, cabinets, eclipse marks, fishing lodge, expeditions, collection, challenges) read those
seconds in the hunt at the Keeper's level (`huntRate`, `EconomyService.setHuntLevel`); the bet cap, the respec and the
craft fees too (`economy-sim --reprice`; docs/handoff/gold-from-the-hunt.md).
`economy-sim --hunt` prints it; `--check` holds the bands. The Gold wipe (`GOLD_ERA`): see economy-ops `enterGoldEra`.

## 10. Bosses and spells

Bosses are the guardians with mechanics (Drowned Lamp, Banked Furnace, Graftmother, Gloam Warden, Hollow Sun, Fallen
Ephemeris); their profile marks them `boss`: never a pack, always 3 rolls with a 2-step shift, the gate boss opens the
next tier. Spells today: the swing (physical), the staff blast (arcane cone, ×1.2), the dodge, and the nine auras.

The top-down Warlock's book (`play/td/td-skills.ts`, the Spellbook reads it) adds two spells, not on the default bar
(keys 1–4 keep Drain Life, Ember Curse, Hellfire Nova, Dark Ward; the Spellbook puts any spell on a key):
- **Bone Spear** (14 mana, 3 s): a spear of bone flies 8 tiles toward the target and pierces every creature in its
  line, 22–32 each (× spell power, may crit).
- **Raise Skeleton** (30 mana, 12 s): raises 2 skeletons from the fresh dead (kills in the last 20 s) within 5 tiles,
  or from the ground at the Keeper's side; at most 2 stand at once (a new cast replaces the oldest). Life 50 and a
  7-ish blow, × (1 + 10% / 6% per level above 1) × spell power. They follow the Keeper, fight the nearest creature
  within 6 tiles that is also within 9 of him, never strike the Keeper, crumble after 40 s or when killed — and
  creatures turn on them when they stand closer than the Keeper.
`--combat` prints time-to-kill / time-to-die per creature, tier and Keeper stage (half of the blows dodged).

**Skill trees (2026-10-21, `docs/design/skill-trees.md`).** The Warlock's 21 skills now sit in three D2 trees —
**Ember** (fire), **Bone** (necromancy), **Shadow** (curses and wards) — in tiers that open at levels 1, 6, 12, 18 and
24, each behind one rank in the skill above it. Each Hunting level from 2 gives one skill point (`skillPointsEarned`);
a point buys one rank (1–20), and every rank grows the skill's numbers by a per-skill step (`SkillDef.grow`, read by
`skillVars`; rank 1 is exactly the numbers above, so a new Warlock is unchanged — the kit of Ember Bolt, Drain Life,
Ember Curse, Hellfire Nova, Dark Ward, the Aura of Embers and Soul Harvest holds rank 1 free). A skill at rank 0 cannot
sit on the bar or run as the aura. Eleven new skills: Cinder Rain, Flame Wall, Ember Mastery, Meteor; Corpse Burst,
Skeleton Mastery, Bone Armor, Bone Storm; Weaken, Life Tap, Doom. Ember Mastery multiplies every fire hit (the bolt, the
nova, the aura, the rain, the wall, the meteor, the curse's burn); Weaken and the Ember Curse do not stack (the
stronger one counts); Bone Armor soaks before the Dark Ward. The respec is free for now.

**Bosses' tells (2026-10-20, docs/design/effects-spec.md fourth pass).** The top-down bosses with a ranged attack
(the Ashbone Dragon's 3-gout breath, the Cinder Sovereign's 5-gout breath) wind up for **0.6 s** (`BOSS_TELL`)
before each breath: the shot timer starts at the wind-up, so the breath's cadence (3.4 s / 3.2 s) is unchanged and
only the first breath of a fight comes 0.6 s later. The breath is aimed when the wind-up starts — at where the prey
stood then — so a Keeper who steps aside in the tell is missed. During the wind-up the boss stands still and does
not bite. A boss's call at half life now shows a sigil for **0.6 s** (`CALL_TELL`) where each summons will stand
before it appears; the count, the threshold and the creatures are unchanged. Damage, rates, ranges and life are
untouched.

## 11. API for the world (stable)

```ts
creatureProfile(key) / monsterLevel(key, depthRows, tier) / creatureResists(key, tier) / creatureHits(key)
rollCreatureLoot({ creature, level, tier, magicFind, rank }, rng) → LootDrop[]   // gear + runes on top of the area table
lootEntry(drop, id) → world.model DropEntry ('item' | 'rune')
rarityOdds(level, mf, shift, boss?) / runeOdds(level, tier) / expectedDropsPerHour(ctx, kph)
rollPack(key, level, isBoss, tier, spawnKey) → { rank, mods, title }
engine: setCombatRules(rules|null), setFallenPurse(p|null), pickDrop(clientX, clientY), options.rollLoot, onLoot{item,rune}, onPurse
```
A new creature: add a `CREATURE_PROFILES` row (the meaning check flags a spawn without one).
The Living World (`play/engine/living-world.ts`): `packScale(level)` IS this curve's `depthHpScale` (+8% HP per area
level, capped ×3), and every pack/den/elder hall carries `SectorHall.level`; the engine levels the creature from it
(blow, packs, drops) instead of from depth, and does not scale its HP twice. Scripted fights (guardians, trait
creatures, minions) keep their authored HP and the legacy 12 blow on Normal; Nightmare and Hell multiply them.
`hurtMonster(monster, damage, type = 'physical', byPet = false)`: pets pass `byPet` (pets-and-glim-alive).

## 12. Gaps (owned, next)

1. Roles beyond melee have no behaviour yet (ranged shots, healers, shielders, summoners, exploders).
2. No resist affix on items yet (§3).
3. Minimap pip: the off-screen **edge pip** ships; the Delve map does not mark drops yet.
4. Packs of several creatures (a champion *pack* of 3–5) — today a champion is one creature.
5. Spells: no active skills beyond swing/blast; no mana. Auras are passive only (no hotkey switch beyond the sheet).
6. Boss loot tables are generic (no boss-specific uniques).
7. The keeper stat sheet on the Forge-keeper page ignores the Hunting bonus (the Satchel's does not).
