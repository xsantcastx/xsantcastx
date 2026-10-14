# Handoff: Delve navigation, Terraria-style (2026-10-14)

Owner (2026-10-13): "navigation in the delves is pretty hard — build up, place blocks, etc. Let's use lots
of options that Terraria has." Terraria is the reference. Gameplay rules did not change: cell HP, tool
tiers, swing paces, the seam's reward rate limit, mutation ids and the save's cell diff are untouched.
Keyboard-only play keeps directional dig (J, S+J) and place (B, S+B).

## What a player can do now

| Feature | Desktop | Phone (touch) |
|---|---|---|
| **Smart cursor** | The mouse aims. The aimed cell gets a gold frame with corner ticks, and the cells within reach (4.5 cells from the Keeper's chest) are outlined faintly round the Keeper. Out of reach the frame is pale. | A finger aims while it is down. |
| **Dig at the cursor** | Hold the left button on a cell in reach: it is mined at the tool's swing pace for as long as it is held. A cell out of reach: the Keeper walks there, as before. | Hold a finger on a cell with the pick chosen. |
| **Place along a drag** | Hold the right button and drag: the chosen block (or any placeable) goes into the pressed cell and then every cell the drag crosses, one per 0.25 s, while there are some left and each cell is in reach. A right press on a placed thing (torch, ladder, chest…) takes it back. | Choose a placeable in the hotbar, then hold and drag a finger. |
| **Auto-step** | Walking into a one-cell ledge steps up it, with no jump (needs headroom: the Keeper is nearly three cells tall). Two cells still block. | Same. |
| **Platforms** | Down + Jump on a platform (or ladder top) drops through it with no hop. Holding Down still drops through, as before. Jumping up from below passes through. | ▼ then Jump. |
| **Ladders** | Up at a ladder the body overlaps steps onto it and climbs. The climb is 220 px/s (was 150; walking in a delve is 191). Up still never jumps off a ladder. | Jump button. |
| **Forgiving jumps** | Coyote time: a jump within 0.1 s of walking off a ledge still jumps. Jump buffer: a press up to 0.12 s before landing jumps on landing. Towns too. | Same. |
| **Minimap** | Under the satchel, always shown: the explored cells round the Keeper at 3 px a cell, with markers. Click it (or press M) for the full map. | A map toggle (44 px) at the top right of the world, under the goal line. The minimap sits at the top left. Both stay clear of the middle half and of the controls. Tap the minimap for the full map. The fold is remembered per device (`eclipse-delve-minimap`). |
| **Full map** | M (or Escape) toggles it. It shows the whole Delve fitted, or zoomed with − / +, the wheel and "On me". Drag pans. The world holds still while it is open. | Starts zoomed in on the Keeper (portrait fits the Delve at only 2 px a cell). Close is a button. |

**Map markers** use art-bible colours (style guide §5): the Keeper (an ivory plus), the camp (its fire
orange), chests, torches, carved inscriptions (rune violet) and the way out at the surface. Only explored
markers are drawn; the way out is always known.

**Way to camp.** The full map draws gold dots along the shortest way through explored open cells
(platforms and ladders count as open). The line under the map reads "Way to camp: N cells". With no
explored way it draws a sparse straight line and says "dig along the gold line". With no camp it says to
place one.

## Fog of war, and how it is saved

- One bit per cell. The Keeper reveals a circle of 6 cells round the chest, and only when the Keeper
  moves into a new cell (`revealAround`, `engine.revealMap`).
- It is saved in the Delve save next to the diff, under the same layout key, in the optional field
  `areas[id].seen` (`godforge-delve`, still version 1).
- Encoding (`encodeSeen` in `delve-save.model.ts`): blocks of 64 cells. A block with nothing explored is
  left out. A fully explored block is its base-36 number alone. Anything else is `n.<16 hex>`. The map
  walked in the node test is under 600 characters.
- Merge (cloud save): a union of the two devices' bits, when both are under the same layout. A
  different layout keeps whichever diff the existing rule keeps.
- `DelveSaveService.seenCells` hands the engine a live `Uint8Array` that the engine edits in place.
  `explored()` schedules a write on the same 1.5 s debounce as digs. `rehydrate` (cloud merge) reloads
  it through `setDelve`, as cells are reloaded.

## Where it lives

| File | What |
|---|---|
| `engine/engine.ts` | `REACH_CELLS` (4.5). Smart cursor: `aimAt`, `clearAim`, `aimCell`, `drawAim`. Held use: `useHold(x, y, 'dig' \| 'place')`, `useRelease()` (returns what the press did, so the click that follows does not repeat it), `updateHold`, `queueDrag` (a line, so a fast drag leaves no gaps). `swingAtCell` is factored out of `strikeCell`. Jumps: `pressJump`, `tryJump`, `grabLadder`, plus `jumpBuffer` / `airTime` / `dropTime`. Fog: `fogs`, `revealMap`, `mapSource()` |
| `engine/terrain.ts` | `CLIMB_SPEED` 150 → 220. Auto-step was already in `stepTerrainBody`, and is now tested |
| `engine/delve-map.ts` (new) | Pure: fog bits, `paintMap` (one pixel per cell), `mapMarkers`, `pathThrough` (breadth-first search). Also `drawDelveMap`, which draws the picture nearest-neighbour at a whole number of device px per cell, then the trail and the marker glyphs |
| `play/delve-map-view.ts` (new) | The HUD's map state: minimap fold, full-map zoom and pan, and the way-to-camp count. It draws on the play view's existing 200 ms HUD tick, never per frame |
| `side-scroller.component.*` | Pointer binding: a mouse move aims; pointerdown starts a held use (left = dig, right = place; a touch follows the pick/placeable choice); pointerup ends it. The 450 ms long-press timer is gone: holding now mines. Map markup, the M key, and CSS for the desktop minimap, the phone corners and the full map |
| `world/delve.i18n.ts`, `world/hud.i18n.ts` | `play.map.*` (EN + ES), `play.hud.key.map`. The Keys line now says hold click mines, the right button places, and S + Space drops |
| `shared/delve/delve-save.*` | `seen`, `encodeSeen` / `decodeSeen` / `mergeSeen`, `seenCells` / `explored` |

## Changed behaviour to know about

- **Reach is 4.5 cells** (was 2.7) for clicks, taps, right-clicks and the cursor. A click on rock 3 or 4
  cells away now swings instead of walking.
- **The long-press is gone.** Holding a finger with the pick chosen now mines. Placing by touch is
  "choose the placeable, then tap or hold". A right-click still places, or takes back what is there. It
  now acts on press, and holding it drags.
- The canvas swallows the context menu in the Delve (it already did).

## Tests

- `scripts/seamworks-engine.test.cjs`: 150 pass, 10 new:
  - smart cursor reach (3 away digs, 6 away does not, the Keeper never walks)
  - held swings never beat the pace (0.52 and 0.31) and pay exactly what clicks pay (the same events
    and mutation ids)
  - a 10 s hold gives about 10 / 0.52 swings
  - drag place: one per crossed cell, ≥ 0.25 s apart, stops at the count and at the reach; a press on a
    torch takes it back once
  - auto-step, and a two-cell wall still blocks
  - Down + Jump drop-through with no hop; jump-through from below
  - ladder grab and climb speed
  - coyote time (0.067 s jumps, 0.2 s does not) and the jump buffer (early press works, too early does not)
  - fog: revealed round the Keeper, no write while standing, compact, survives a reload
  - encode/decode/merge, `paintMap`, markers, `pathThrough`
- `e2e/play-delve-nav.spec.ts`, at 1280×800 with a mouse and 390×844 with touch, in one Delve built by
  `DelveFixture`:
  - aim and hold-dig a rock 3 columns from the camp
  - drag a 3-block bridge across a pit (the hotbar count drops 10 → 7), then walk across it
  - walk west and step up a one-cell ledge
  - open the map (M, or a tap on the minimap), count the explored pixels, reload and descend again: at
    least as many
- `e2e/play-mobile-hud.spec.ts` now counts `.map-toggle` and `.map-mini-open` as HUD pieces. They must
  meet no other piece, stay off the middle half, be named and take their own taps, and the world must
  stay ≥ 65% unobstructed.

Screenshots (not committed): `output/delve-nav/{desktop,phone}-{aim,bridge,map,minimap}.png`.

## Not done / next

- The map shows terrain colours and markers only. Creatures are not drawn (Terraria hides them too, except
  bosses).
- There is no pinch-zoom on the full map. Phones use − / + and drag.
- Light does not reveal the map. The fog is a circle round the Keeper, so a torch-lit cavern seen from
  afar stays dark until the Keeper walks near it.
- Smart cursor for keyboard-only players (Terraria's "smart cursor" toggle that auto-picks the nearest
  minable block) is not built. Directional J / B stay the keyboard path.
