# UI pass 3, Wave A: the portrait phone (branch `uiwa`)

Spec: `docs/design/ui-pass-3.md` §A.0–A.6. Screens: `output/uiwa/before/` (from the audit build at a4a2435d) and
`output/uiwa/after/` (not committed).

## What a player gets
- **Thumb-zone HUD** on a portrait phone (`.stage--thumb`, 900 px wide or less, portrait, no desktop bar). It comes in
  two size classes, regular and compact (`.stage--compact`: W < 380 or H < 700).
  - **Right thumb:** a round wooden disc (76 regular, 64 compact). It shows Attack while a hostile is near, else the
    verb in reach: Enter, Talk, Loot, Take, Read or Use. A long-press fans Attack and the verb when both apply.
  - **The skills:** four keys on an arc round the disc (52 regular, 48 compact). A long-press opens the Skill Book.
    The ⇅ chip swaps keys 1–4 and 5–8; it shows only when a key above 4 is set.
  - **Left thumb:** the belt as a column (Health, Mana, Spellstone) over the Bag · Map · More row.
  - **Top band:** the face chip (Character), Glim, the goal chip and the ticker.
    - The goal chip holds the tutorial step. A tap expands it for 8 s, with Skip inside.
    - The ticker is one stream for Glim's lines, the area title, what is in reach, loot and chat. A tap opens the
      Chat sheet.
    - The minimap opens the Map when tapped; the orbs drink when tapped; Soul is a "Soul N" chip.
  - **☰ More:** a tile sheet with the 12 tiles in the spec's order, plus Slate (when owned) and "All menus" (the Game
    Menu, which keeps the Glass, Controls and Character select reachable). Each tile shows a brass dot when it has news.
  - **What goes on portrait:** the chat box, the prompt bar, Glim's centre card, the area card, the toast, the
    top-right ☰ and the 2×2 dock.
- **The satchel** on a phone has three tabs: Bag | Worn | Nearby.
  - **Bag:** a belt strip, then ◀ Pocket 1 · Pocket 2 ▶ (each with a count), then the grid as two 5-column pages of
    64 px cells, then the foot. It fits 360×640 with no scrolling.
  - **Paging:** a sideways swipe flips the page. While a piece is held, resting it on an arrow for 400 ms flips.
  - **Item card:** a bottom card (docked to the top when the piece is low). It has a compare verdict with
    "vs <worn piece>" and one primary (Equip, Unequip, To belt, or Deposit at a Vault).
  - **Worn:** a 64 px doll; Stats sit behind a pixel ?. An empty slot filters the bag to what fits it.
  - **Landscape:** the grid is two pages of 44 px cells, and the doll panel's faces are Worn | Stats | Nearby.
    Desktop gets the same faces.
- **Touch drag:** a long-press of 250 ms lifts a piece. Moving the finger drags it, with the ghost 1.25× and 56 px
  above the finger. Rest the piece on the Worn chip to open the doll; its slot pulses. Drop it on the Nearby chip to
  lay it at your feet (rare and above asks first). Lift the finger without moving and it stays held for a tap, as
  before.
- **Nearby:** every corpse, own pile, room pile and online pile within 8 tiles, nearest first; piles within a tile
  merge.
  - **Each row:** a rot bar and the distance.
  - **In reach (≤ 48 art px):** Take all, or one piece's card with a −/+/Max stepper for a partial take.
  - **Farther off:** "Walk · N tiles". The Keeper walks there and takes on arrival, and the satchel dims while walking.
  - **Updates:** a gone row fades for 1 s ("Looted"). A full satchel greys Take and says `play.grid.full`.
  - **Opening:** the satchel opens on Nearby when a corpse fell within reach in the last 30 s. The chip shows the
    in-reach count, and the tab polls at 4 Hz only while open.
- **The Vault** on a portrait phone:
  - A Vault | Satchel switch shows one grid at a time, two pages of 64 px each. A tall tab scrolls inside its grid area.
  - The tabs are a row of wood chips with "+ · price" to buy the next.
  - The card's primary is Deposit or Take. A drag onto the other chip switches, or drops into the first free cell.
  - Deposit all is a secondary on a phone.

## Where it lives
- HUD: `play/thumb-hud/` (component and `thumb.i18n.ts`) and `side-scroller.component.thumb.css`. The thumb CSS loads
  last and moves the host's minimap, orbs, Glim, the goal chip, party, pet, the satchel and the Vault place.
- Grid pages: `shared/inventory-grid/grid-pages.ts` (+ spec), with `item-grid` `[page]` and `(flip)`.
- Drag: `item-drag.service.ts` (finger drag).
- Nearby:
  - Model: `play/td/td-nearby.ts` (+ spec).
  - Engine: `nearbyContainers`, `nearbySignature`, `takeNearby`, `splitDrop`, `mergeDrop`, `hostileNear` and
    `handVerb` in `td-engine.ts`.
  - Constants: `NEARBY_REACH` (48) and `NEARBY_LIST` (128) in `td-corpse.ts`.
  - `Drop.by`, set from the room's `by`, names online piles.
- Vault: `shared/vault/vault-station.*`, using the new `InventoryService.movePieceInto`.

## Takes (merged with polish2, 9ce0ea9b)
- **The engine:** Nearby's take is `engine.takeNearby` behind the host's `takeNear` / `takeNearPick`.
- **polish2's reusable takes:**
  - The Keeper's own stack piles go through the engine option `onTakeOwnStack`, which calls the host's
    `takeOwnStack(token, n)` and so `trimOwn`.
  - Another Keeper's pieces go through `onTakeShared`. A stack uses `TradeHudComponent.takeFromPile(id, qty)` with an
    explicit amount, so Take all never opens a picker. An item uses `pickup(id)`.
- **What Nearby still does itself:** a partial take of a corpse's or the fight's own stack splits the drop
  (`splitDrop`) and takes the split part.
- **Nameplates:** every new HUD button is `data-world-rail` and the ticker is `data-world-avoid`.

## Departures from the spec
- **The arc:** the spec's centres (radius 112 at 150° and 120°) are drawn for round keys. Square keys there overlap at
  the corners, which breaks Accept 3. So:
  - Keys 2 and 3 sit at (110,56) and (56,110) from the disc's centre; the chip is at radius 66.
  - Compact: key 3 drops to clear the centre (its top is 480) and the chip sits at radius 62.
- **The ticker** runs from left 8 to right 112 (104 compact), not right 8. Right 8 would collide with the Soul chip,
  which the spec also puts at right 8, top 108.
- **Not built:**
  - The XP strip is a thin bar under Soul.
  - The minimap's clock label is hidden on portrait.
  - The Item names toggle is in More, but not also in Settings.
  - Long-press labels on the compact bag row.
  - Hold-to-flip on the Bag chip from Nearby, and dragging a piece out of Nearby (it takes by tap).
  - "Take and equip".
  - Desktop's Shift-click to take, and the V key.
- **Screenshots:** they are in `output/uiwa/` (coordinator's instruction), not `docs/handoff/uiwa/` as Accept 20 asks.

## Tests
- **Phone specs updated:** specs that reached for the dock, the corner ☰, the chat box, the side-by-side Vault or
  the left skill rail now use the thumb HUD's Bag, Map and More and the Vault | Satchel switch. The files are td-grid,
  td-loot-ground, td-chat-phone, td-friends, td-party, td-keys, td-leveling, td-map, td-quests, td-sexton,
  td-ux-notes, td-book, td-bestiary, td-quick-belt, onboarding and play-top-down.
- **td-dirfix:** its camera-clears-the-rail test is skipped on portrait, because the rail is gone (the skills sit
  under the right thumb).
- **Watch:** the level-up banner can open over the satchel, for example after a Nearby take crosses a level.
- `e2e/play-thumb-hud.spec.ts` (Accept 1–7): 360×640 and 390×844, Isometric and Classic, EN and ES, the square and a
  hunt, plus 844×390 unchanged.
- `e2e/td-satchel-phone.spec.ts` (Accept 8–13).
- `e2e/td-nearby.spec.ts` (Accept 14–18, with 17 online).
- `e2e/menus-reach.spec.ts` gains the Wave A targets (Accept 19).
- Unit: `grid-pages.spec.ts` and `td-nearby.spec.ts`.
