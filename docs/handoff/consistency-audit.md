# Consistency audit: what the player reads vs what the game does

Branch `truth`, 2026-10-21. Owner's ask: "skills says thing like i can summon 3 skeletons, we need to make sure what is
said is consistent in game, that spells and items and stats are actually real consistent and working".

Rule applied: whichever side was wrong was fixed — the code, the text, or (where a stat did nothing) it was wired up.
No stat was retired; no stored item was rewritten (frozen rolls and grades untouched).

## The skeleton truth

Raise Skeleton at rank r raises `floor(2 + 0.15·(r−1))` skeletons and keeps at most `floor(2 + 0.25·(r−1))`:

| rank | raised per cast | most at once |
|---|---|---|
| 1–4 | 2 | 2 |
| 5–7 | 2 | 3 |
| 8 | 3 | 3 |
| 9–12 | 3 | 4 |
| 13–14 | 3 | 5 |
| 15–16 | 4 | 5 |
| 17–20 | 4 | 6 |

+1 at once for the **Ashbone Phylactery**, +1 for the **Ossuary Watch** 3-piece. Skeleton Mastery lifts life and blow,
not the count. The fight was right; the **card** was wrong: it showed the bare rank's cap, so a Keeper wearing the
Phylactery and three Ossuary pieces read "at most 2" while 4 stood. The card now reads the fight's own numbers
(`td-skills castVars`), and the var is renamed `max` → `cap` so the sky's damage multiplier (which moves `min`/`max`)
can never touch the cap.

## Mismatches found and how each was resolved

### Skills (16)

| # | What the player read | What the game did | Resolution |
|---|---|---|---|
| 1 | Raise Skeleton "at most {{max}} at once" | +1 Phylactery, +1 Ossuary 3-piece were applied but not shown | **text**: card reads `castVars` (gear in) |
| 2 | Bone Storm "Looses {{count}} spears" | Splinterbow's +2 spears not shown | **text** (castVars) |
| 3 | Bone Spear "flies {{range}} tiles" | Splinterbow's +3 tiles not shown | **text** (castVars) |
| 4 | Card numbers at the tree's rank | Warden's Ember (+1 Ember Bolt), Hammer (+2 Nova), Ossuary 4 (+2 Skeleton Mastery), Abbey 4 (+2 Dark Ward) cast at a higher rank | **text**: card casts at `castRank`, says "+N from worn gear" |
| 5 | Cooldown "{{cd}}s" = the spell's base | Tyrant's Crucible −2 s and worn Cast Speed shortened it | **text**: card shows the real wait (`cooldownNow`) |
| 6 | Drain Life "heals you for 50% of it" | healed 50% of the bare roll, before spell power and crits | **code**: heals % of the life the hit really took |
| 7 | Ember Brand "burning for {{burn}} over 3 seconds" | paid 3 × round(burn/3) (rank 5: 9, not 10) | **code**: the whole burn is paid over the ticks |
| 8 | Ember Curse "{{dps}} a second for {{secs}} seconds" | whole ticks only (9.6 s burned 9 s) | **code**: the last part-second burns its share |
| 9 | Flame Wall "{{length}} tiles long" (4.8) | 5 clumps of fire | **number**: `length` counts whole (4, 4, … 5) |
| 10 | Damage numbers on every card | every hit × spell power (level, Spirit, Spell Damage), × fire (Ember Mastery, worn fire), + weapon flat, crits — none shown | **text**: new "In the fight now: every hit ×k · +n from your weapon · c% crit ×1.75" line |
| 11 | Blinding Flash, Banish, Lamp-Wisp, Beacon: "light damage" | half again on the dead and the dark-born (only Kindle said so) | **text** (en + es) |
| 12 | Banish "(a boss takes half again instead)" | a boss of the dead takes the light's half again *and* Banish's | **text** |
| 13 | Lamp-Wisp "Call {{count}} lamp-wisp … it flicks" | from rank 11 two wisps, each flicking | **text** ("lamp-wisp(s) … each") |
| 14 | Ash tree's night/eclipse power (1.05 / 1.1 in td-phases) | moved nothing (no Ash skill has damage vars); no card ever showed it | **code**: the sky lifts the Watchfire's Defense and life back (`skyVars('ash')`), which now shows its phase line |
| 15 | Cinder Cleave, Whirl, Ash Stride, Ember Brand: no phase line | their blows are the Watch Blade's, which the Brand's hour moves | **text**: they show the blade's phase line |
| 16 | Soul Harvest "gives you back {{mana}} mana" | also +1 Soul a kill per 5 ranks for the Spellstones | **text** + a `soul` var (the harness checks it against `soulForKill`) |

Reviewed and consistent: every other skill of the four vocations and the common page (Light, Seek) — counts, damage
ranges, radii, reaches, arcs, durations, stuns, roots, knock-backs, absorbs, heals, weakens, pierce, synergies and the
phase line — is now measured by the harness (below) at ranks 1, 9 (synergies bought, gear worn) and 20.
Dawn at Noon's burn is lifted 15% by its own unveiling, as its line says ("every foe inside takes 15% more").

### Items and stats (16)

| # | What the player read | What the game did | Resolution |
|---|---|---|---|
| 17 | "+X% XP" | nothing in the top-down game (only the retired account XP) | **code**: worn XP lifts every kill's Hunting XP (`gearXp`) |
| 18 | Satchel "Keeper stats": Damage / Max HP rows | the side-view's formulas (10 + 10·Strike, 100 + 10·Ward), used by nothing | **text**: rows removed; the panel is "Worn gear, before caps" |
| 19 | Old "+36.9% Gold Find" (retired Gold/sec) on two pieces | paid 42.4% together, not 73.8% (log of the summed raw roll) | **code**: read piece by piece (`wornGoldFind`, `equippedGoldFind`) |
| 20 | Compare slip "Gold Find +500%" on an old piece | compared the raw Gold/sec | **code**: compares as Gold Find |
| 21 | Item card numbers | the bare roll; runes in its wells and a Socket Word (×1.5 … ×2.5) were paid but not shown | **text**: the card prints what the piece pays; the compare slip compares worn stats |
| 22 | Weapon "+N Strike" / Spell Damage for the Ashguard's swing | the swing read the bare roll (runes, a Socket Word ignored) | **code**: the swing reads the weapon as worn |
| 23 | "Aura: Might 3" on Socket Words and uniques; the Loot sheet's aura lines | the top-down fight applied no item aura at all | **code**: all nine wired (Might, Conviction, Redemption, Holy Fire/Freeze/Shock, Fanaticism, Prayer, Vigor) as their lines say, reach 4 tiles |
| 24 | Loot sheet resistances from armour runes | never reached the fight; shown with a difficulty penalty the fight never applies | **code**: rune resists join the worn resists; **text**: sheet shows them unpenalised, note says the C sheet holds the capped total |
| 25 | Curse/whisper lines "+14 Spell Damage", "−12 Movement Speed", "−15 All Resist" | percent stats | **text**: "%" added |
| 26 | Hollow Ward / a whisper "−15% All Resist" | every resist floored at 0, so with none worn it cost nothing | **code**: resists may fall below 0 (to −100) and that element bites harder; the C sheet shows it |
| 27 | "+0.4 Life Regen" / "Mana Regen" | per second | **text**: "Life a second", "Mana a second" |
| 28 | "+2 Strike", "+1 Ward" | not fight stats (the Ashguard's swing and forge/pick; safer tempering) | **text**: the card says what each does |
| 29 | C sheet "Life back" | left out the Mossbound Heart, the Rootcradle, Prayer and the "×2 standing still"; hid a curse's drain | **text** (sheet computes what the engine pays) |
| 30 | C sheet: no Magic Find, Gold Find, Hunting XP; Speed without Vigor | — | **text**: rows added, Vigor in Speed |
| 31 | Spirit "+2% spell and staff damage a point"; Agility "of the staff" | Spirit lifts *every* hit (blade, bow, beasts); Agility speeds every class's basic attack | **text** |
| 32 | Ossuary 2-piece "+10% Defense" | +10% of the gear's Defense, not the class base | **text** |

Reviewed and consistent: life, mana, defense, spell damage (cap 150), cast speed, move speed, crit (cap 40, ×1.75),
life/mana regen, the four resists and All Resist (cap 75), Magic Find (the uncommon rung exactly; the top rungs with
D2's diminishing returns), Gold Find (cap 150), requirements (level = Hunting level, attributes = spent points; the
Wear button and the card agree), every boss unique's line vs its signature, every set tier's line vs its data.

### Pets, consumables, the dark (3)

| # | What the player read | What the game did | Resolution |
|---|---|---|---|
| 33 | Pet card: Bite stuns every third, Dash darts through a line, Chomp cracks armour, Forage/Scout/Kindle/Guide, all eight "At level 3" second moves, Ink Pup barks, Star Owlet shows ore, Sunling heals when quiet, Ember Newt lights the Delve only | none of it exists in the top-down world (each pet has one job there: fetch, fight, mend or light) | **text**: the card shows the pet's real job with the world's numbers (blow and rest from `petBlow`, the mend's 70% / 4% / 7 s, fetch reach 8 tiles); the four wrong "Helps with" lines rewritten; the "learned a second move" toast removed |
| 34 | Hush "Off: the dark stays only dark" | shapes and hollow footsteps still came | **code**: Off stops them |
| 35 | — | — | (potions, Spellstones, hearth blessings, whispering stages, elites, night: reviewed, consistent) |

**Totals: 34 mismatches — 16 skills, 16 items/stats, 2 pets/dark** (the pet row covers 17 separate dead lines).
By resolution: code fixed 12, text fixed 21, data fixed 1 (#9), stat retired 0.

## The harness (fails CI on future drift)

- `src/app/play/td/td-truth.spec.ts` (≈200 specs)
  - **A** every skill's line (en and es) renders at every rank, with synergies and all gear worn, with no `{{…}}`
    left and no NaN; quotes only its own vars; en and es quote the same numbers; every var has a "next rank" label;
    counts are whole.
  - **B** one **probe per skill** (all 62; a skill without one fails) casts it in a real `MobSystem` and measures:
    minions counted, damage over hundreds of rolls (range and centre), radii/reaches/arcs by a dummy just inside and
    just outside, durations timed, stuns/roots/knocks read off the creature, absorbs and weakens by a weighed bite,
    pierce by 1,500 arrows. Every number the card quotes must equal the measurement — at rank 1, rank 9 with every
    synergy bought and every gear signature worn, and rank 20.
  - **C** what the fight reads is the card under the sky (td-phases), and every sky multiplier a tree carries shows
    on some card.
  - **D** each item aura does what its Loot-sheet line says.
- `src/app/play/td/td-truth-gear.spec.ts`
  - every `ItemStats` key: one piece with only that stat → the place it lives moves by the card's printed number
    (a key with no entry fails); old Gold/sec pieces add up as printed; negative resist is real;
  - every boss unique's and set tier's line quotes only numbers its data carries, and every set tier reaches the fight;
  - the engine re-applies the build when any worn stat it reads changes (`GEAR_KEYS`).

The card and the fight share one call: `td-skills castRank / castVars / castCd / cooldownNow` (gear signatures in),
used by both `MobSystem.v` and the Spellbook.

## Not resolved (left on purpose, for the owner)

- **Ordinary unique passives** (`unique-items.ts`, 10 effect kinds on ~44 uniques: strike-double, gold-surge, …):
  no code reads them, but nothing in the reachable game shows them either (the Gambler page is unrouted). Wire or
  delete when uniques come back to a page.
- **Difficulty tiers**: the Nightmare/Hell blurbs ("twice as tough", "resistances −40/−100") are not applied by the
  top-down fight, and the gate boss (the Fallen Ephemeris) is not in the top-down world, so only legacy saves hold
  those tiers. Drops and the fall share do follow the tier.
- **The Ashguard's weapon Spell Damage counts twice** (a quarter of it in the swing's flat, all of it in spell
  power) — deliberate in `td-melee`, now visible on the card's power line.
- **Caps** (Spell Damage 150, Cast/Crit/Move 40, resists 75, Gold Find 150) are not printed on item cards; the C
  sheet shows the capped totals.
- **Wild sky line** (+15% at twilight) lifts Command's, Pack Bond's and Wild Heart's own % by 15% (60% → 69%), which is
  what the line says of that card's number; kept.
- **Grave-cold's drain** is real but the out-of-combat mend (+6/s after 4 s unhurt) outruns it.
- **Small numbers under the sky** round (Kindle 7–11 at −5% stays 7–10).
- **`/character`** equips without the requirement check, but the route is unreachable.
- Pet strings `play.pet.move.*` / `play.pet.second.*` are now unreferenced (the i18n check lists them, not an error).
