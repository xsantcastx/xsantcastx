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

## 3. Affixes and rolls

Unchanged and respected: an item's stats roll inside its rarity band at **mint** and freeze, with the per-stat
grade (`rollQuality`) frozen beside them; temper never touches the grade; nothing back-fills it. Creature drops are
rolled as *(definition, rarity)* and minted **at pickup** by `LootService.grantDrop` with `mintEquipment`, seeded by
the drop id — so the grade is frozen exactly once, the same path every other source takes. Gap: there are still only
the five item stats (Gold/s, MF, XP, Strike, Ward); resists live on runes (§6), not as an item affix.

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

## 6. Damage types and resistances

`shared/loot/damage.model.ts`. Types: physical (the swing), fire, cold, lightning, arcane (the staff blast's light).
- Creature resists clamp to [−100, 100]; **≥ 100 is immune**. Conviction lowers resists; against an immunity it works
  at a fifth (D2), so an immunity breaks only when it is close to 100.
- Keeper resists: gear, minus the tier penalty (0 / −40 / −100), minus a curse, **capped at 75**. Physical is never
  resisted (Ward is health). Source of Keeper resists: **runes set in ARMOUR wells** (D2's armour-vs-weapon rule):
  Infernal runes fire, Nocturne cold, Verge lightning, Archivum arcane, the top three all (`aura-sources.ts`
  RUNE_ELEMENT/RUNE_RESIST, 6 → 40 by tier). Hell's −100 needs 175 from armour to sit at the 75 cap.
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

`shared/loot/drop-tables.ts`, on top of each area's coins/material table (which stays the Gold/material source):

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

## 10. Bosses and spells

Bosses are the guardians with mechanics (Drowned Lamp, Banked Furnace, Graftmother, Gloam Warden, Hollow Sun, Fallen
Ephemeris); their profile marks them `boss`: never a pack, always 3 rolls with a 2-step shift, the gate boss opens the
next tier. Spells today: the swing (physical), the staff blast (arcane cone, ×1.2), the dodge, and the nine auras.
`--combat` prints time-to-kill / time-to-die per creature, tier and Keeper stage (half of the blows dodged).

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

## 12. Gaps (owned, next)

1. Roles beyond melee have no behaviour yet (ranged shots, healers, shielders, summoners, exploders).
2. No resist affix on items; Ward stays HP, not physical reduction.
3. Minimap pip: the off-screen **edge pip** ships; the Delve map does not mark drops yet.
4. Packs of several creatures (a champion *pack* of 3–5) — today a champion is one creature.
5. Spells: no active skills beyond swing/blast; no mana. Auras are passive only (no hotkey switch beyond the sheet).
6. Boss loot tables are generic (no boss-specific uniques).
7. The keeper stat sheet on the Forge-keeper page ignores the Hunting bonus (the Satchel's does not).
