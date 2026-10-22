# Two damage families, affixes by item family (branch `affix`, 2026-10-22)

Owner: "all weapons are giving spell damage? If im a warrior? … only staffs or mage items related should do it, or maybe
rings or amulets … could give mage damage but like rings and that could roll for warriors or archer etc.. consistency in items".

Design and the full tables: `docs/design/loot-and-combat.md` §3.6.

## What a player gets
- A staff, a wand or a focus rolls **Spell Damage**, Cast Speed, mana and **+Spells**; a sword, an axe, a mace rolls its
  own **+min–max Damage**, **Martial Damage**, Attack Speed and **Life Steal**; a bow or crossbow the same with **Pierce**
  instead of Life Steal; a quiver Martial Damage and Pierce (and a little ward); a shield Defense and **Block**; armour
  Defense, life, resists (boots Move Speed, gloves either speed); rings and amulets either family, lower, plus Gold Find.
- The Warlock and Lanternwright read Spell Damage / Cast Speed; the Ashguard and Thornstrider read Martial Damage /
  Attack Speed. The Thornstrider's skills use Martial Damage; his beast bites by half of it (td-thorn BEAST_DAMAGE_SHARE).
- The item card: "Favoured by: Ashguard" (green when it is you), greyed lines "unused by your calling", a weapon's own
  damage as "+18–35 Damage [16–19 / 31–36]", and an old roll's note. Screenshots: `docs/handoff/cozy-ui/affix-*.jpg`.

## Where it lives
- `src/app/shared/rpg/item-affixes.ts` — `FAMILY_RULES` (pools, implicits, scales, gloves/boots-only keys),
  `affixFamilyOf` (a definition's family from its slot and name), `rollAffixes` (family pools; the flat pair on one sample).
- `src/app/shared/rpg/item-calling.ts` — who reads what (`statUse`, `FAMILY_FAVOURED`), the old-roll rule (`oldRollTwins`).
- `src/app/play/td/td-skills.ts` `fightStats` — `power`/`castSpeed` from the calling's family; `leech`, `pierce`,
  `block`, `ranks`, `damagePct`. `castRank(…, allRanks)` adds +Spells.
- `src/app/play/td/td-melee.ts` — `weaponSwing` (`blade` for a melee weapon, `arrow` for a bow), `meleeBlow`, `arrowBlow`.
- `src/app/play/td/td-mobs.ts` — small: Life Steal in `hitFoe`, Block in `biteKeeper`, gear Pierce in `looseArrow`, the
  beast's bite ×(1 + half the Martial Damage), arrows through `arrowBlow`, `gearRanks`.
- The card: side-scroller `itemTip` + template + `side-scroller.component.c.css` (`.d2tip__calling`, `.dim`, `.d2tip__old`).

## Old items (decision)
Rolls are frozen. A Spell Damage / Cast Speed roll on a piece whose family can no longer roll it (every old weapon's
implicit, old helms and gloves) counts **in the wearer's own family** — read at wear time, never rewritten. An old sword
swings exactly as before for an Ashguard. Edge: old rings/staves keep their Spell Damage for casters only (those
families still roll it), and old gloves' Cast Speed is now the casters' (gloves roll both speeds). A reforge re-rolls
under the new families.

## Uniques reviewed
Hammer of the First Watch (maul) → Cinder Cleave +2; Splinterbow (bow) → Volley +2 and 2 more arrows; Bone Spear +3
tiles moved to the Ashbone Phylactery. Nine misfit authored roll-key lists fixed (`item-calling.spec.ts` guards them).

## Tests
- Karma: `item-calling.spec.ts` (families vs icon base, authored keys, fresh mints, pools, class reading, old rolls,
  boss uniques' named skills), `td-truth-gear.spec.ts` (every key of every family moves the card's number for the
  callings it is for and nothing for the rest; Spell Damage on a sword; rings roll both), `item-affixes.spec.ts`.
- `node scripts/combat-sim.mjs --check` — all bands hold with class-appropriate gear (`GEAR_FAMILY`, `WANT_BY`).
- e2e `td-affix-shots.spec.ts` — the cards as an Ashguard, a Thornstrider and a Warlock.
