# UI pass 3, Wave B part 1 — shops, the Glass, the map, the station kit (branch `uiwb`)

Spec: `docs/design/ui-pass-3.md` → Waves → Wave B, with §4 (shops), §5 (station kit), §8 (map), §14 (the Glass).
Out of scope here (branch `uiwa`): the portrait HUD, satchel/Vault, Nearby, corpse window, Skill Book keys, landscape
HUD, trade, chat. The satchel grid inside a shop is still `app-item-grid` (Wave A owns its cell size).

## What a player gets

**Shops** (`shared/shops/shop.component.*`, all five: General, Fishing, Woodcutting, Smith, Alchemist share it)
- The shelf is a grid of priced tiles: the icon, then a coin and the price under it (Inter 12/700 glow; berry when the
  Keeper cannot afford it). No corner count that reads as a stack.
- A tap (or a click) opens ONE buy card: the icon, the name in its rarity colour, "13 Gold each · You have 3", the
  stats, a 44 px **1 · 5 · 10 · Max** row (Max = what the purse covers, capped at 99), and one brass
  **"Buy 5 · 65 Gold"**. Short of Gold, Buy turns the ui-system disabled wood and says "Need N more Gold" under it.
- Narrow windows (a phone, either way) switch **Shelf | Satchel** (lit-wood segments, never brass); the card is sticky
  at the window's foot, so Buy is in view at scrollTop 0 at 360×640, 390×844, 844×390 and 1280×800. Sideways the
  card is two columns (the item | the row and Buy).
- Desktop: shelf and satchel side by side; hover shows the whole card at the pointer with "Click to buy · Shift-click
  buys 5"; shift-click buys five; a click opens the buy card under the shelf.
- The keeper's line and "Buys: …" moved behind the window's **?** (the satchel head keeps "Buys: …").
- Sell cards read "Sell · 2 Gold" / "Sell all 24 · 48 Gold".

**The Glass / New Keeper** (`shared/keeper-look/keeper-maker.component.*`, `play/lobby/play-shell.component.css`)
- Four portrait chips (icon + name, 64 px, four abreast at every width), then the chosen calling's card: name, one
  line of role, three tags ("Range · Fire · Curses") — new keys `look.class.<v>.role|tags`, EN + ES; the full blurb is
  the card's tooltip.
- Then the name (16 px), the looks two by two in 44 px steppers (Figure and Build first), and a sticky foot with the
  brass **Become this Keeper** (52 tall) and **Surprise me** as a quiet link (above it on a tall screen, beside it on
  a short one).
- Landscape: the fire on the left 45%, the Glass on the right 55%; the class card is ≥300 px wide and the name is above
  the fold. The skip-tutorial checkbox is a 44 px pixel toggle (still a real checkbox). On phones the foot keeps only
  that toggle (the head's × already leaves without making anyone); desktop keeps "Back to the list".
- No text under 11 px in the window. Also applies to the in-game Glass (Places → Glass).

**World map** (`play/td-map-window.component.*`, `td-engine.ts` adds `TdMapView.tiles`)
- The map FILLS its frame: drawn at a whole-pixel scale (1×, 2×, … or ½, ⅓ … of the art; `coverScale`), never
  letterboxed; opens on the Keeper. Wheel, pinch and ± move in whole steps (± ≈1.6× a press, at least one step).
- Filter rail (left edge): a 44 px chip per kind of pin on this map — Towns, Shops (new `shop` category), Stations,
  Tasks, Townsfolk, Dungeons, Harbours, Hearths, Ways; each toggles its pins (towns: the town labels).
- Pins are 20 px tiles in their kind's colour with a dark pixel glyph (CSS masks, no emoji).
- Floor rail (right edge): on a cave or dungeon floor, a chip per floor (0, −1, −2 …), the shown floor brass-rimmed,
  the Keeper's floor with a berry pip. The area picker stays (tests and the continent read from it).
- Labels: collision culling (`cullLabels`) — regions first, then towns — skips any label overlapping one already
  kept or one of the map's own controls; level lines are 11 px and show from two steps in. Town names draw over pins.
- Tap a pin: a parchment card (name, nearest area + band, berry when dangerous, distance in metres, the blurb) with one
  brass **Walk here**. Double-click goes at once on a desktop. Search results now list *under* the field and push the
  map down (icon, name, area · distance).
- Landscape / wide: the search and the card sit in a 260 px right panel.

**Station kit** (`shared/station-ui/*`)
- Tabs (`app-station-tabs`): `role=tablist/tab` + `aria-selected`; in the world ONE row of 44 px wood chips that
  scrolls sideways (snap); the chosen tab is lit wood with a glow underline, never brass. Market's ten tabs are one row.
- Requirements read "need 2 · have 24" (leaf / berry) — new key `stationUi.needHave`.
- A blocked primary is the ui-system §6 disabled wood (cream at 40%).
- Steppers are 44 px sideways (were 40). Detail-head names lift toward cream (Torch was grey-violet on wood).
- The Slate offer (Lune) and Kael's binding moved from above the window title into the body, under the station, as a
  wood card with a wood button (one brass per window). One-line move in `side-scroller.component.html`.

## Tests

- New `e2e/play-wave-b.spec.ts` (the Accept checks): prices on every tile; Buy in view at scrollTop 0 at four sizes;
  1/5/10/Max and a 5-buy; desktop hover + shift-click; no shop control <44 px at 844×390 and 932×430 (satchel grid
  pockets excluded — Wave A); the Glass at 844×390 (card ≥300 wide, name above the fold, brass Become, no text <11 px,
  44 px toggle); map empty frame <5% + no label intersections + whole scale at four sizes + filter toggles + a brass
  Walk here; the floor rail switches Ember Mine floors and back to the surface; no brass/gradient tab, one tab row,
  sticky footers leave the last element in view (crafting, market, gambler, enchanting, shop) at 360×640 and 844×390.
- `play-menus.ts`: `shop-general|fishing|wood-card` menus with `noScroll` (Buy in view at scrollTop 0), the Glass
  `noScroll` on `.km__keep`.
- `menus-reach`: the Map with a search open and with a pin card open.
- Pin clicks now open the card: `play-helpers.sail`, `harbour.spec`, `menus-reach`, `td-ux-notes` dispatch the pin's
  click, then press `[data-map-walk]`. `crafting-bench.spec` reads "need 6 · have 18".
- Unit: `ux-notes.spec` (wholeScale/coverScale/stepScale, cullLabels, the `shop` pin), `shops.spec` (maxAffordable).

## Gate (after merging origin/main 9ce0ea9b)

check:meaning ✓ · tsc app + spec ✓ · CI node --test line 337/337 ✓ · ds / i18n / nav / economy / combat sims ✓ ·
build ✓ (initial 1.39 MB) · CSP ✓ · test:ci 4386/4386 ✓ · chromium e2e (play-top-down, td-*, play-hud,
play-mobile-hud, menus-reach, onboarding, orientation, wave-b, lobby, harbour, crafting-bench, economy, slate):
332 passed; the remaining reds all fail identically on the base build 18ff0bdc (crafting-bench "18/6" not found,
play-menus-orientation sound/runes/vendor/enchanting + satchel pockets 31 px, play-slate-phone, one td-dirfix crown/plate
and the two-Keeper td-world, which passes alone).

## Not done / next

- Satchel dimming of what a shop will not buy (needs a per-piece dim in `app-item-grid`, Wave A's component).
- Landscape shop as shelf-left / satchel-right needs the satchel at 44–52 px pages (Wave A); it is Shelf | Satchel.
- Map: long-press the minimap for quest pins; "Sail · 40 Gold" on a harbour card (it says Walk here; the board prices).
- Station primaries (`.ab__btn`) are still the remapped pale gold, not `--cozy-brass` — a Director call.
- The floor part of the area picker remains alongside the floor rail (kept for compatibility).
- At 844×390 the sticky Become row brushes the bottom of the name field (about 10 px); the name stays tappable.
