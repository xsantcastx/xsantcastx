# Lost Cabinets — handoff

2026-10-15. Roadmap "Later: Lost Cabinets (needs the Slate)". Owner: scan for them with the Mirror Slate. Lore:
`docs/world/lore-addendum.md`, "The Lost Cabinets" (shipped — owner reviews in play). Art sheet:
`docs/handoff/lost-cabinets/gallery.png` (regenerate: `node scripts/cabinet-gallery.cjs`, then render the SVG).
Play screenshots (e2e): `docs/handoff/lost-cabinets/*.png` (copied from `output/lost-cabinets/`).

## Decisions

- **Maker: the Archivist, carried by the Ridge Couriers.** Sixteen curios the Archive could not file, each sent home
  with a courier in a cabinet latched with a sliver of the Archive's moon mirror. Ties three canon threads: the
  Archivist "putting things down", the Ridge Couriers' caches (High Roads), and the Slate itself ("a palm of the
  Archive's moon mirror").
- **The Scan is tier I.** It is the glass (Lune's, the Archive's) that knows its own latches, not Kael's brass; and a
  treasure hunt that starts in the five towns belongs to the first Slate a Keeper earns (ten plays). Tier II keeps
  what it adds: the map and the bounties. `slateTabs(1)` = tables, factory, **scan**.
- **No marker, ever.** A cabinet is invisible until the glass is held near it; the Codex names a cabinet's place only
  once it is open (shut ones are a silhouette and "still shut").

## What a player gets

- **Scan face** on the Slate (home tile "Scan · n of 16 cabinets"): the glass's reading, ONE primary button
  (**Hold the glass up** / **Put the glass away**), the set and its bonuses, the clues held, Details (lore, the deep
  rule, the loupe). Holding it up folds the Slate so you walk with it; opening the Slate while scanning lands on the
  Scan face.
- **Hot / cold.** While held up, the HUD Slate button *is* the reading: its glass glows cold blue → violet → gold →
  ember → red (token ramps) and pulses faster as it warms (`--pulse`, 2.6 s → 0.4 s; reduced motion: colour only, no
  pulse), its label reads "Scan: warm", and a soft glassy ping plays at the same cadence, rising in pitch
  (`sound-director` cue `scan`). Height counts (distance is 2-D), so a High Road cabinet gets hotter as you climb.
  Within 150 px (110 in the Delve) the cabinet **shows itself**; it stays drawn for the session.
- **Glim's rare-find hook**: on a warm glass Glim brightens (OR'ed with the bond's sense brightening); once its
  *notice* ability is open (stage 4) it also says "Your glass is warm. Something rare is near…" once per cabinet.
- **Open** (E, or the prompt's 44 px button): once per save. A curio (a key item, no slot), Gold on the curve, and
  sometimes 3 **Courier's Honeycomb** (every pet eats it like its favourite, +2), the **Hatbox of Small Crowns**
  (carried: every hatched pet may wear its hat now), or a **clue** that tunes the glass to a deep cabinet. An open
  cabinet stays in the world, open and empty ("Its curio is in your Cabinet of Curios.").
- **Sixteen cabinets**: 5 towns (Seamworks — up on the camp's high ledge, a jump from the Vendor; Court, Archive,
  Orrery, Canopy on the street, each > `STATION_REACH` from any station), 3 hunting grounds (Ember Quarry,
  Unrecorded Corridors, Rootglass Thicket), 2 High Roads (Prism slab −270, Orrery canopy 290), the Ember Delve
  (Basalt Caverns, cell 30,21), the Underhearth (40,74), the four realm Delves (Ink 12,40 · Root 50,26 · Prism
  14,22 · Orrery 52,44). The five deep ones are silent until their clue's cabinet is open (Archive → Ink Deeps,
  Thicket → Root Deeps, Prism road → Prism Mines, Orrery road → Orrery Wells, forge-mines → Underhearth). Delve
  cabinets are set into rock: you dig to them.
- **Cabinet of Curios set** (Codex → Collection, under Pets): all sixteen with lore, Found in / Used for, the
  bonuses and the story. Bonuses (small, all about the hunt): **4 Warm Glass** — the Scan reads ×1.5 as far;
  **8 Pocketful of Crumbs** — every pet takes one more meal a day; **12 The Curator's Eye** — holding the glass up,
  Glim says which way the nearest audible cabinet lies; **16 The Last Page** — the Archivist's reward: 20 min of
  income and the **Curator's Loupe** (carried: in the Delve the Scan also warms, up to hot, to rift shrines no
  lantern has touched). The **arc**: one page per four cabinets (docket → Hollis → why she put them down → the last
  page).

## How it works

| File | What |
|---|---|
| `shared/cabinets/cabinets.model.ts` | `CABINETS` (area, x/feet-y, curio, extras, gold, clue/needs), `CURIOS` + `CABINET_EXTRAS` (found in / sources / uses / lore — read by found-in and check-meaning), `SET_BONUSES`, `SCAN`, `PULSE`, `scanReading`, `warmthAt`, `tuned`, `eyeDirection`, `openClues`. Pure. |
| `shared/cabinets/cabinets-save.model.ts` | blob `godforge-cabinets` (synced `progress/cabinets`): `opened` + `rewards`, union merge. No imports (eager). |
| `shared/cabinets/cabinets.service.ts` | the only writer: `open` (receipt first; grants keyed `cabinet:<id>:<item>`; Gold via `earnIncome`; the 16th pays `cabinets:final` once), `payFinal`; session `scanning$` / `reading$` (not saved). |
| `shared/cabinets/cabinets.i18n.ts`, `curio-icons.ts` | every word EN + ES (lazy); 16×16 pixel icons spread into `pixel-icons.ts`. |
| `play/engine/cabinet-art.ts` | the chibi pixel cabinet: 12×16 art px, 3 frames on ONE cached sheet, 4 world px/art px (2 in the Delve). |
| `play/engine/engine.ts` (+ `engine.model.ts`) | `setCabinets(marks)`, `cabinetInReach` (72×80 / 56×64), E → `onCabinet`, `nearby: 'cabinet'` + `state.cabinet` (a shut shown cabinet outranks a station in reach; an open one never does), `drawCabinets` after the stalls, before the people. The engine never decides what is shown. |
| `play/side-scroller.component.*` | `tickScan` (on the 200 ms HUD timer): reading, show, ping, Glim, marks; `scanChanged` (fold the Slate, the Curator's Eye); `cabinetUsed` (toasts, sound `cabinet`, pickups); the HUD button's warmth; `data-scan` / `data-cabinet` on the canvas. |
| `shared/slate/*` | `SlateTab` + `'scan'` (tier I+); the Scan face. |
| `codex/codex-cabinets.component.ts` | the Codex block (deferred). |
| `shared/pets/*` | `PET_TREAT` = favourite for all; `hasHat(r, hatbox)`; `mealsLeft(r, day, extra)`; the sheet passes the hatbox and crumbs. |
| `scripts/check-meaning.js` | curios/extras: source, use, lore (model + i18n), a Found in; every cabinet's curio/clue/place real. |
| `scripts/economy-sim.mjs --cabinets` | in `--check`: each cabinet in the rule I quest band (surface 3 min, deep 8), the final in the daily band (20 min), all of it ≤ 2 h once (it is 93 min), floors under 30-min income. |

**Merge**: union of `opened` and `rewards`; commutative, idempotent (spec). A merge that completes the set pays the
final on the next open/payFinal; grants are idempotent op ids, so two devices opening the same cabinet offline get
one curio (the stack grant id is the same) but the Gold twice — harmless, the same as the High Roads caches.

## Tests

- Karma `shared/cabinets/cabinets.spec.ts` (24): the table (16, places, clue ↔ needs, High Roads pinned to
  `heights.ts ROUTE`, names/icons/key items/EN+ES lore), the Scan (bands, pulse monotonic, area-only, height,
  Warm Glass, deep silence + clues, Delve range/reach, Curator's Eye, bonuses + arc), merge, the service through the
  gateway (once, reload, clue, bonus, final once + loupe, rehydrate, scan not saved), pets (treat, crumbs, hatbox),
  the pixel cabinet. `slate.model.spec` (tabs) and `cloud-save.model.spec` (key list) updated.
- Node `scripts/lost-cabinets.test.cjs`: every area real; surface cabinets on a platform of their area or a High Road
  ledge, floor ones clear of every station's reach; a shut cabinet beside a station wins E, an open one does not; every Delve cabinet (and the cell beside it) diggable, non-bedrock, inside its core on five seeds
  (through the real engine and generators); the engine reaches/reports/E's a shown cabinet and ignores hidden or
  other-area ones; the warmth climbs cold → burning on a walk.
- e2e `e2e/play-cabinets.spec.ts` at 1280×800 and 390×844: Slate → Scan tile → Hold → the Slate folds, the HUD
  reads warm at the camp → cool walking east → hot walking back → burning only after climbing the camp's two
  ledges → the Seamworks cabinet shows → E opens it (curio stack, Gold,
  receipt; the glass goes quiet) → Codex lists it open with lore and place, the deep ones say "clue first" → reload
  → still open and empty, nothing paid twice. 44 px on the phone (Slate button, Scan tile, Hold).

## Not done / next

- Only the Seamworks cabinet is driven in e2e; the High Roads, Delve and realm cabinets are placement-tested in node.
- Pet treats are fed through the existing sheet (offered after the pet's own favourite); no special treat toast.
- No cabinet in the Homestead, and peers do not see your cabinets (presence carries none).
- Real art: the cabinet and the curios are procedural pixel art (no commission brief written yet).
