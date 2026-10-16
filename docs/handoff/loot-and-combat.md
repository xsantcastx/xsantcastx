# Loot & Combat — handoff (2026-10-15)

Spec and numbers: `docs/design/loot-and-combat.md` (single source of truth; this agent owns loot, items, monsters,
bosses and spells). Code: `src/app/shared/loot/*`, engine `setCombatRules` / `setFallenPurse` / `pickDrop`,
host wiring in `play/side-scroller.component.ts`, Codex entry `codex/codex-loot.component.ts`.

## What a player gets
- **Kills drop gear and runes**, D2 style, on top of the old coins/ore: ~1 blue an hour on the first hunt, purples and
  golds deeper and on harder tiers, named uniques at their own rarity, runes capped by difficulty.
- **Drops announce themselves**: a beam per rung (taller and brighter going up), pixel sparkles, a crown on a named
  unique, a coloured name plate, a sound per rung (the big legendary chime), and a pip on the screen edge for rare+
  off-screen. Gear waits on the ground: **tap its plate** (phones) or **press E beside it**; out of reach, the tap
  walks you there. Coins and materials still come to your feet.
- **Menu → Loot & Combat**: loot filter (show all / hide commons / rare and better), the aura to run, difficulty
  (Normal; Nightmare and Hell open when the Fallen Ephemeris falls), your four resistances.
- **Nine auras** on Socket Words (6 new aura words + 5 existing words gained one) and 4 uniques: a sigil ring under the
  Keeper; marked creatures show a pip. Conviction lowers resists, Holy Fire/Freeze/Shock pulse, Might, Fanaticism,
  Prayer, Redemption, Vigor.
- **A real fight**: creature levels, families with resists, blow types, champion/unique packs with modifiers (blue and
  gold names), three difficulty tiers; runes in armour give resists; the Hunting level is the Keeper's level.
- **Death costs**: 5/10/15% of the purse left where you fell; walk back for it. Nothing else is lost.

## Screenshots (`docs/handoff/loot-and-combat/`, regenerate with `LOOT_SHOTS=1`)
beam-rare-desktop / beam-rare-phone (Cinderwake, a rare unique), beam-epic, beam-legendary (Phantom Toll),
beam-mythic (Godforge Gauntlets), aura-conviction-desktop / -phone (ring + the marked Maw), aura-might, aura-holy-shock.

## Tests
- Karma `src/app/shared/loot/loot.spec.ts`: tiers/colours, filter, odds/gates/MF monotonicity, seeded rolls, uniques at
  authored rarity, pool, rune ceilings, sampler vs analytic, Conviction math and immunities, Keeper resist cap, aura
  numbers, aura pick, Socket Word aura assembly (order matters, temper levels), armour-rune resists, packs, difficulty,
  save coerce/merge.
- Node `scripts/seamworks-engine.test.cjs` "loot & combat": legacy vs Normal vs Hell numbers, rare drop beam/sound/
  report/pickup lifecycle, full satchel + filter, Holy Fire through resist, Conviction, Prayer/Redemption/Might/
  Fanaticism, the purse, resists, edge pips and sparkles.
- e2e `e2e/play-loot.spec.ts` at desktop and 390×844 phone: seeded rare beam + blue plate + tap to pick up into the
  satchel; worn Verdict → `data-aura=conviction:3` + `data-aura-debuffed`; the filter hides commons.
- `economy-sim --loot` and `--combat` (both in `--check`).

## For the living-world agent
Place creatures freely; give each new key a `CREATURE_PROFILES` row (else it fights as a level-1 brute and
check-meaning flags it). Drops come from `rollCreatureLoot` via the host — don't author gear in zone tables. The API
list is §11 of the design doc and is stable.

## Saves
`godforge-loot` (synced, progress/loot): filter, aura, tier, unlocked, seed, rolls, purse — merge in
`loot-save.model.ts` (later choice wins, tiers union, rolls max, later purse event wins).

## Not done / gaps
See design doc §12 (non-melee roles, item resist affixes, map pips, multi-creature packs, active skills, boss-specific
tables). Not verified on a real phone or in webkit.
