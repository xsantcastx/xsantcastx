# Pets — handoff

2026-10-15. Roadmap "Later: Pets". Owner: cute MapleStory-style, and everything needs meaning (a source, a use,
lore, visibility). Lore: `docs/world/lore-addendum.md`, "Pets" (shipped — owner reviews in play).
Gallery: `docs/handoff/pets/gallery-pets.png` (every pet, every frame, the hats and eggs, beside a Keeper at world
scale; regenerate with `node scripts/pet-gallery.mjs docs/handoff/pets gallery`).

## What a player gets

| Pet | Realm | Found (a real place, never bought or gifted) | Helper while it follows |
|---|---|---|---|
| Ember Newt | Infernal | an egg in the first **Seam Crate** you fish up and open | **glow**: a warm light of its own in the Delve (150 px) |
| Prism Moth-kit | Luminous | **rescued** after 6 Prism Foragers fall in the Reflection Channels | **xp**: +10 % skill XP (rounded up) in Luminous areas |
| Ink Pup | Umbral | **rescued** after 6 Mirror Substitutes fall in the Unrecorded Corridors | **warn**: barks at a creature winding up behind you, or a shade in reach |
| Star Owlet | Celestial | an egg from the **Board Herald** on your 3rd day of bounties | **scent**: ore within 16 cells marked as gold sparks on the Delve map/minimap |
| Moss Hedgehog | Verdant | **rescued** after 8 harvests in the Rootglass Thicket | **gather**: a Verdant hunting-ground harvest yields +1 one time in four |
| Rivet Maw hatchling (rare) | Underhearth | an egg when the **Banked Furnace** first falls | **fetch**: trots to loose drops up to 520 px away and carries them back |
| Shade-kit (rare) | Ink Deeps | an egg when the **Gloam Warden** falls | **fish**: bites come 1.25× sooner (under the engine's cap of 4) |

- **Visible**: the pet follows the Keeper in towns, hunts and the Delve (a bouncy hop behind you, turns when you
  turn, catches up, curls up asleep with drifting z's after 14 s still, a happy face on a pickup or a meal, a
  spinning trick, a "!" on the bark), its name on a small plate under its feet. Satchel → the doll's empty
  bottom-right corner is the **pet well** (44 px+, amber when something new waits); tap it for the pets sheet.
  Codex → Collection → **Pets**: all seven (silhouettes until met), Found in / Helps with, lore once met,
  "so far: 3 of 6" for the counted sources. Glim says one line about each pet, once ever. Sounds: a chirp (found,
  meal, trick), a yip (bark), a crack + chime (hatch).
- **Bond**: hatch an egg (one tap), name it (≤ 16 chars, rename any time), **Feed** with real satchel stacks
  (its favourite +2 affection, other liked foods +1, 3 meals a day per pet; a full pet waits for tomorrow).
  Affection 4 → a **trick** (button; it also spins when it learns it), 10 → a **hat** to wear or take off.
  The meter never decays: no streaks, no hunger, no leaving. One pet follows at a time (Follow me / Rest at home).
- **Sheet layout** (Diablo II clean): a row of wells, one card, one primary action (Hatch / Name it / Feed),
  secondary small buttons. Phone: all controls 44 px; the sheet fits 390 px wide.

## How it works

| File | What |
|---|---|
| `shared/pets/pets.model.ts` | `PETS` (sources, abilities, foods, English meaning), `PET_TUNING` (every helper's size), the bond's rules (`feedResult`, `mealsLeft`, `TRICK_AT`/`HAT_AT`), `earnedPets(state, ledger)`, `gatherBonus`/`xpBonus`. Pure. |
| `shared/pets/pets-save.model.ts` | the blob `godforge-pets` (synced `progress/pets`) + `coercePets` + `mergePets`. No imports (eager). |
| `shared/pets/pets.service.ts` | the only writer, through the gateway + LocalSaveRegistry. `count` (tallies), `find`, `hatch`, `name`, `follow`, `wearHat`, `feed` (consumes the stack first, keyed `pet-meal:<id>:<day>:<n>`). |
| `shared/pets/pet-art.ts` | the chibi pixel painter: 8 frames × (plain, hatted) per pet, **one outlined sheet canvas per pet type**, one blit per frame; egg + portrait data URLs (cached). |
| `play/engine/pet-sprite.ts` | the follow motion, sleep, happy/trick/alert, name plate. Reduced motion: no hop/spin/z's; it sits at its place. |
| `play/engine/engine.ts` | `setPet`, `petFeel`, `petView`, `petScent`, `updatePet` (fixed step: fetch, bark), the glow light in `drawDelveLight`, the draw before the Keeper. |
| `play/engine/delve-map.ts` | `MapSource.scent` → gold sparks (`SCENT_COLOR`). |
| `play/side-scroller.component.*` | `tickPets` (1/s: finds from tallies, `bounties.claimDays`, delve once-flags; toast, Glim line, push to engine), tally hooks (`hunted`, `petHarvest`, `openCrate`), the XP / gather / bite helpers, the pet well + `.pet-host`, `data-pet*` on the canvas. |
| `shared/pets/pet-sheet.component.ts`, `codex/codex-pets.component.ts` | the sheet; the Codex block. |
| `shared/pets/pets.i18n.ts` | every word, EN + ES (lazy). Keys `play.pet.*`. |
| `shared/sound/sound-director.ts` | cues `chirp`, `bark`, `hatch`. |
| `scripts/check-meaning.js` | pets block: source/use/lore/visible + every food real (and counted as a use: "pet food"). |
| `scripts/economy-sim.mjs --pets` | knobs capped (gather ≤ 25 %, XP ≤ 10 %, bite ≤ 1.25); the hedgehog's Thicket extra ≤ 5 % of forge income from 30 m on (it is ~0.00 %); in `--check`. |

**Merge** (`mergePets`): union of pets (never lost); per pet the earlier `got`/`hatched`, the later name (`nameAt`)
and hat (`hatAt`), max love, the later feed day (same day: more meals); max per tally key; the later follower
(an egg cannot follow). Commutative and idempotent (spec).

**Hook for the realm Delves** (Verdant Root Deeps, Luminous Prism Mines, being built in parallel): a new pet
from there is one `PETS` row with `source: { kind: 'hunt' | 'gather', tally: '<kind>:<area-id>', need }`, a
`this.pets.count('<kind>:<area-id>')` where that Delve books a kill or a harvest, its art in `LOOKS`
(`pet-art.ts`) and its `play.pet.*` words. No file of theirs was edited.

## Tests

- Karma `shared/pets/pets.spec.ts` (23): the table means something (7 pets, every realm, 2 rare, distinct helpers,
  real foods, EN + ES, Glim lines ≤ 120, no guilt copy); every source finds only its pet, never twice; feeding
  rules (egg, food, favourite ×2, full, next day); helpers small and the gather roll stable; coerce/name cleaning;
  merge both orders, idempotent, nothing lost; art inside its cell, every frame distinct; the service through the
  gateway (find → hatch → name → follow → reload; rescue; feeding spends a real stack, unlocks the trick, rests for
  the day; a cloud merge rehydrates). `cloud-save.model.spec.ts` lists the new key.
- E2E `e2e/play-pets.spec.ts` at 1280×800 and 390×844: seeded 3rd bounty day → the egg is filed → Satchel pet well
  (≥ 44 px) → Hatch → name "Hoot" → Feed (its favourite, +2) → it follows in town and keeps up on a walk → Glim's
  owlet line → reload into the Ember Delve → the owlet scents ore (`data-pet-scent` > 0) → the sheet still shows
  Hoot and the love. Screenshots: `output/pets/` (not committed).

## Not done / next

- Glow, warn, fetch, xp, gather and fish are wired and rule-tested but not driven in e2e (only scent is).
- Pets do not collide with Delve terrain: they float along with the Keeper's height (a cosmetic shortcut).
- No pet in the Homestead yet (a "rest at home" pet could sleep by the hearth there).
- Peers' pets are not broadcast (presence carries no pet).
