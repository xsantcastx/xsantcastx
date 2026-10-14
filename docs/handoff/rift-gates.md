# Handoff: the Rift Gates + the Ink Deeps (the Umbral's underside) — 2026-10-14

Owner: "inside the delves portals to other realms … we are in Eclipse Realms"; "the realms are like deeper
delves or crazy". Lore: `docs/world/lore-addendum.md`, "The Rift Gates and the Ink Deeps" (shipped — owner
reviews in play). Art brief: `docs/art-commissions/rift-gates.md`. Canon: §1.2 (not a sixth realm, not the
Void), §2.3 (each gate stands where its realm's Echo colour will begin).

## What a player gets

- **Four Rift Gates** in every Ember Delve, each in a fixed lattice cell (so every seed has them):
  | Realm | Where | State | Delving |
  |---|---|---|---|
  | Umbral | the Underhearth, lattice cell −4 (cols −256..−193), rows 59–83 | **open** | 20 |
  | Verdant | Root Hollows, cell −2 (cols −128..−65) — the first a new player meets | settling | 32 |
  | Luminous | Glowcap Grotto, cell 4 (cols 256..319) | settling | 28 |
  | Celestial | Magma Halls, cell 6 (cols 384..447) | settling | 36 |
  A chamber of the stratum's rock, a rift-stone floor and lintel, the 2×3 opening in the realm's colour, six
  **rift splinters** in the frame (Pickaxe IV, Mining 40), a field note. Map marker `gate`. First sighting:
  Glim names it (open or settling) and it pays 25 Delving XP once (`rift-seen:<realm>`); stage-4 bond
  *notice* also points gates out (`GLIM_RARE_KINDS`).
- **Attune**: E at the Umbral gate needs Delving 20 and an **Umbral Sigil** (4 rift splinters, 2 Umbral Ink
  from expeditions/Vault, 1 emberheart ore; Smithing 50, 12k Gold fee). The gate keeps the sigil
  (`rift-attuned:umbral`) and stays open. Settling gates say "still settling". First step through: 120 XP.
- **The Ink Deeps** — its own endless world: seed `realmSeed(delveSeed,'umbral')`, 64 rows (Ink Shallows /
  Gloam Deep), Pickaxe III–IV rock. Core (cols 0–63): the **Gate Hollow** (return gate, an inkstone outcrop,
  a shallow ink basin, a drift pocket in the east tunnel, Rook's chalk) and under it the **Gloam Warden's hall**.
  Wings: ink pools with seeps, drift pockets, mirror caverns, shade dens with nightglass.
- **The broken rule — the dark is unreliable** (each said once by Glim, `rift-rule:umbral:<rule>`):
  ink-blind lantern (×0.5/×0.42, ×0.35 under ink; Veil Lantern softens it); **drift pockets** fill/open
  every 24 s only while unseen, unlit and unheld (a torch pins one for good; never a trap: shell is
  ordinary rock); **the ink tide** (50 s clock: low 22 s → rise → 2 rows high 14 s → fall; HUD meter with
  countdown; puts braziers out; never drowns); **mirrored ceilings** (your reflection walks upside down on
  the ceiling a step behind); **shades** frozen in strong light, 210 px/s in the dark, lunge 18 dmg.
- **Ink**: liquid type 3, half water's pace, heavier than water (sinks under it, water rests on it), never
  mixes, ink+lava → obsidian, buckets refuse it, no fishing.
- **Gloam Warden** (1100 HP, once): takes no blow unless lit — light the three braziers with torches (E, one
  torch each, 30 s, the tide puts them out); unlit it calls two shadelings every 16 s.
- **Verrin's chain**: *What the Light Leaves* (reach) → *Ink and Glass* (10 inkstone, 4 nightglass) →
  *The Unlit Warden* (defeat). Rewards on the curve (70k/100k/240k v2 floors; Rift/Veil/Eclipse runes;
  Veil Lantern recipe; 2 Waystone Shards so anchors work there). Rift Anchors work per world; the anchor
  sheet's home row in the Ink Deeps is "Back through the rift".

## Code map

| File | What |
|---|---|
| `shared/delve/rift-gates.model.ts` | realms table, placement, flags, `attuneCheck`, `realmSeed`, slot keys, stack ids |
| `play/engine/realm-gen.ts` | `realmColumn` (the Ink Deeps), `realmPlans`, `stampGate` (gate chambers in the Ember Delve) |
| `play/engine/umbral.ts` | pure rule: `tideAt`, `inInk`, `pocketPhase`, `litBy`, tuning constants |
| `play/engine/sector-gen.ts` / `underhearth-gen.ts` | gates replace one stratum's plan in their cell; `spec.realm` dispatches to realm-gen |
| `play/engine/engine.ts` | `enterRealm` / `leaveRealm` / `gateNear` / `lightBrazier`, `updateRealm`, `stepShade`, tide/reflection/eyes drawing |
| `shared/delve/delve-save.service.ts` | **worlds**: Ember Delve + one per realm (own seed, own slots, device records by seed); routing by area id |
| `play/world/towns/umbral-delve.ts` | `UMBRAL_DELVE` (a hunt of the Infernal town, no passage) |
| `play/side-scroller.component.*` | `useGate`, `lightBrazier`, `tickGates`, tide vital, `data-gate`/`data-realm`/`data-ink-blind` |
| `play/world/rift.i18n.ts` | every line, EN + ES |

Saves: realm core cells in the Delve index under `areas['umbral-delve']`; wing sectors in
`godforge-rift-<realm>-r0..3` (`progress/rift-<realm>-r0..3`, existing `progress/{docId}` rule — no rules
change), merged by `mergeRegionSlots`; all four realms' slot keys exist now. Ember Delve goldens unchanged.

**Fixed on the way** (pre-existing): the Delve's mining path booked every ore outside `MINING_TIERS` as
**Cinder Ore** (the Underhearth's emberheart/pyrite too). Seam ores still go through the seam; other ores now
pay themselves through `skillActions.act`.

## Spec for the three settling realms (content only — no plumbing needed)

For each: set `open: true` + `area`, add `<realm>-delve.ts` hunt (spec `realm: '<realm>'`), a branch in
`realmColumn` (or a sibling generator), its sigil recipe (4 splinters + its realm material + a deep core),
a 3-mission chain, a rule module like `umbral.ts`, i18n, bestiary, art brief.
- **Luminous — the Light-Mines** (gate: Glowcap Grotto). *Broken rule: light is solid.* Lit air is a floor
  (torches and lantern pools become platforms that fade when the light moves); the dark is where you fall.
  Prism veins, dawn-glass, mirror-water; Afterimage Moths lead to uncopied carvings. NPC: Aureth.
- **Celestial — the Star-Wells** (gate: Magma Halls). *Broken rule: down is negotiable.* Gravity turns with
  an hour-hand clock; each well has its own down; starlight liquid rises. Astral veins, Anchor Wardens.
- **Verdant — the Root-Depths** (gate: Root Hollows). *Broken rule: dug rock grows back while you watch.*
  Tunnels close behind you unless something living (a planted root, a lit sap-lamp) holds them; Graftlings
  join placed things into odd shapes. Rootglass, verdant sap.

## Tests

- `node --test scripts/rift-gates.test.cjs` — 12: all four gates per seed (cell, stratum, node, splinters),
  model rules, Ink Deeps determinism + core set pieces, every structure/ore/den + ink at rest, ink vs water,
  the tide, enter/leave beside the same gate, realm saves apart, tide/ink-blind/Veil Lantern, drift pockets
  (unseen flip, held in view, torch pins, saved), shades and the Warden, no Underhearth flag in the realm.
- Karma `shared/delve/rift-gates.model.spec.ts` — model, slot blobs, the save service's realm world
  (own seed, own slots/device records, reload, foreign-seed slot ignored). `cloud-save.model.spec` updated.
- e2e `e2e/play-rift-gates.spec.ts` (1280×800 + 390×844): camp at the gate → Glim notices → attune → Ink Deeps
  (low tide) → mine the inkstone outcrop → walk back out beside the gate. Perf scenes in `e2e/perf-play.spec.ts`.

## Not done / next

- Shades and the Warden are procedural pixel figures; no audio; no Ink Lantern creature yet (spec §2.3).
- Mirror reflection is drawn, but no "tunnel only in the reflection" puzzle yet (Veil Draught, Phase 10.3).
- Map pins are hidden and refused in a realm Delve (they still file into the Ember Delve's regions): per-world pins next.
- Reloading inside the Ink Deeps starts in town as everywhere; way back is the camp/anchor + the gate.
