# /play on a phone: the world gets the screen

2026-10-13. Owner report: `/play` was "not playable" on a real phone. At 375×812 in
the Ember Delve the top HUD stack covered about half the world, the Delve hotbar
floated across the middle with its Place/Take panel over its own slots, and the
touch controls wrapped to two rows.

The phone HUD is now the **Terraria-mobile** layout (the owner's chosen
reference). Everything is in `side-scroller.component.{html,css,ts}`; the CSS
lives in one block, "Phones", at the end of the stylesheet, driven by variables
on `.stage`. The desktop HUD (a mouse at any width, or a touch screen taller than 500px) did not change (see "Desktop" below).

## Which screens get it

The phone HUD is `(max-width: 900px), (hover: none) and (pointer: coarse) and
(max-height: 500px)`: anything up to 900px wide, plus a touch-first screen whose
short side is a phone's (≤ 500px), so 932×430 and 915×412 landscape phones get
it too. Every desktop-only `(min-width: 901px)` rule in the stylesheet is
written out to exclude that touch case (`… and (hover: hover), … and (pointer:
fine), … and (pointer: none), … and (min-height: 500.02px)`), so a mouse at any
width, and a touch screen taller than 500px (a 1024×600 tablet, a 1280×800
touch laptop), keep the desktop HUD. `homestead-column.component` uses the same
pair of queries. Tablets with a short side over 500px are deliberately left on
the desktop HUD; widening the cap is one number in each query.

## Layout (phones)

```
┌ top band, 56px + safe area ─────────────────────────────────────────┐
│ [Pick][slot][slot]…(scrolls) [Satchel·n]      Area name    [≡ menu] │
│                                               Keeper ▬▬▬▬ 100       │
│                                               (enemy ▬▬▬ when one)  │
└──────────────────────────────────────────────────────────────────────┘
  [‹ GOAL 1 OF 4  Buy your first building…   (2 lines)   SHOW ME ]   ← over the world, 46px, folds to a chip
        ( message toast: fades after ~4s )
                              … the world …
┌ context row, 52px ──────────────────────────────────────────────────┐
│ [● Hearth · Chat] [Take]                  [Forge Basalt Edge|INTERACT]│
├ touch row, 64px + safe area ────────────────────────────────────────┤
│ [◀][▶][▼]                         [Blast][Dodge][Attack/Place][Jump]│
└──────────────────────────────────────────────────────────────────────┘
```

- **Top band.** Delve hotbar top-left as one horizontally scrolling row, the
  pick first; the satchel is one 44px button with a badge (pockets filled) that
  opens the existing satchel book; area title (small), a slim health bar (and
  the enemy's under it) and the menu button top-right. The six satchel readings
  are not on screen on a phone (`.tally` is `display: none`; it is still in the
  DOM, so specs reading `.satchel .tally` text keep working).
- **Menu** (the Places button, ☰ on phones): the places list, then Return to
  camp, Restart hunt and Keys. The top bar's own Return / Restart are hidden on
  phones.
- **Goal line**: one row (text clamps at two lines) with Show me; the chevron
  folds it to its "Goal n of 4" chip (`guideFolded`, not persisted).
- **Message line** (`.objective`): on phones a toast under the goal line. The
  `<span class="objective-line">` is re-created per message (`@for … track
  line`), which restarts a 4.2s `hud-toast` fade; it never reserves space.
  Specs that read `.objective` text are unaffected (the text is the same).
- **Context row**: the folded Hearth pill, Take (Delve), and the Interact prompt
  only while something is interactable (the Keys toggle is in the menu).
- **Touch row**: one row. Movement left (◀ ▶, ▼ in the Delve), actions right
  (Blast, Dodge, Use, Jump — Jump in the corner). Buttons are
  `clamp(44px, (100vw − 28px − gaps) / n, 64px)` wide, 52px tall, so seven fit
  at 360px. Every button is an icon, no words: inline 24-unit SVGs in
  `currentColor` (Jump ↑ arrow, Use a sword, Place a block with a +, Dodge a
  roll arrow, Blast a starburst; the arrows are the existing CSS triangles).
  Each button's name is its `aria-label` from `hud.i18n.ts` (EN + ES); the
  old short-label keys are gone. The Delve's pick slot is the pick icon alone
  (its name is `play.hud.pickAria`).
- **Landscape** (≤ 500px tall): the context row rides in the touch band between
  the clusters, the goal line moves up into the top band (between the satchel
  and the health column; in the Delve the hotbar shows five slots and scrolls),
  and an open Hearth is a side panel instead of a band.
- **The Homestead's Gold list** (`app-homestead-column`). Folded it is the
  purse chip under the goal line (top-left of the world in landscape).
  Unfolded it never reaches the centre of the world (the middle half of the
  canvas across and down, where the Keeper stands): in portrait a **bottom
  sheet** over the lowest quarter of the canvas, just above the bottom band
  (`max-height: (canvas height) / 4 − 8px`; the purse and Strike share its first
  row, about two buildings show and the rest scroll); in landscape a **side
  drawer** down the left quarter (`width: 25% − 12px`, rows stacked with the Buy
  button under the name). A tap on the world (the canvas) or Escape folds it;
  taps on other HUD buttons (Show me, the touch row) leave it open, so the
  first-goal flow (Show me → Strike → Buy) still works. Only on the phone HUD:
  on desktop it is the same always-there column, and Escape / clicks do
  nothing to it. A touch-first short screen (the 932×430 case) also starts it
  folded, as ≤ 720px always did.
- **The canvas is the space between the bands** (`.viewport { inset:
  var(--hud-top) 0 var(--hud-bottom) 0 }`): nothing is drawn behind the touch
  row, and the open Hearth pushes the world up as before. The consent bar still
  shrinks the host from below (`--gf-consent-h`), so it docks under the touch
  row.

## Smart cursor (Terraria's tap-to-use)

`touchTool: 'pick' | 'place'` in the component. The hotbar's first slot (phones
only) is the pick, chosen by default.

- Pick chosen: a tap on a cell runs the engine's existing click-to-strike, so it
  digs (no engine change; the dig rules are untouched).
- A placeable chosen: the Use button becomes **Place** (`placeHere()`, same as B)
  and a **tap** on a cell calls the engine's existing `placeAtClient` (the
  long-press path; it also takes back a placed thing there). Out of reach the
  Keeper walks toward the tap instead of digging.
- Only taps read it (`pointerType !== 'mouse'`), so mouse play is unchanged. B,
  X, 1–0 and the long-press behave as before.

## Numbers

Unobstructed world = canvas rect minus every HUD rect over it, as a share of
the whole viewport (sampled on a 2px grid; `e2e/play-mobile-hud.spec.ts`
`measure()`), after the message toast has faded. Chromium, `isMobile`, touch.

| Scene | 360×740 | 375×812 | 390×844 | 430×932 | 844×390 |
|---|---|---|---|---|---|
| Town (Basalt Seamworks), before → after | 45.3 → **70.8** | 50.0 → **73.2** | 52.0 → **74.4** | 56.7 → **76.8** | 18.5 → **69.2** |
| Hunt (Ember Quarry), before → after | 43.3 → **70.8** | 48.2 → **73.2** | 50.2 → **74.4** | 55.1 → **76.8** | 16.8 → **69.2** |
| Delve, before → after | 37.1 → **70.8** | 42.6 → **73.2** | 44.8 → **74.4** | 50.1 → **76.8** | 18.5 → **69.2** |

Landscape phones wider than 900px (second pass, 2026-10-13; "before" is the
build of `60da5dc`, which gave them the desktop HUD):

| Scene | 932×430 | 915×412 |
|---|---|---|
| Town, before → after | 58.9 → **72.1** | 57.0 → **70.8** |
| Hunt, before → after | 57.3 → **72.1** | 55.3 → **70.8** |
| Delve, before → after | 39.2 → **72.1** | 37.3 → **70.8** |

The smaller sizes are unchanged by the second pass (same numbers as above).

"Before" is the build of `32b6b22`. The same spec measured both builds:

```bash
# measure only, with screenshots (output/ is not committed)
PW_PORT=4288 MOBILE_HUD_MEASURE=1 MOBILE_HUD_OUT=output/mobile-hud/after.json \
  MOBILE_HUD_SHOTS=output/mobile-hud/after npx playwright test e2e/play-mobile-hud.spec.ts --project=chromium
```

## Tests

`e2e/play-mobile-hud.spec.ts`, at every size, in a town, a hunt and the Delve:
no HUD piece meets another; none is over the middle half of the canvas; every
touch control is ≥ 44×44, on one row, shows an icon (≥ 14px) and no text, has
an `aria-label`, is on screen and takes its own tap; every HUD button (touch row,
menu, satchel, goal buttons, hotbar slots, Hearth pill, Interact, Take) has an
accessible name; the menu, satchel, Show me, Hearth pill, Interact and Take take
their own taps; the world ends above the touch row; unobstructed world ≥ 65%
(portrait and landscape). Also: the menu holds Return / Restart / Keys; the goal
folds; a placeable turns Use into Place; pick-tap digs and block-tap places
(pinned Delve seed); the touch controls are named in Spanish and fit at 360px;
the first-visit consent bar covers no control at 360×740. Sizes: 360×740,
375×812, 390×844, 430×932, 844×390, 932×430, 915×412. The Homestead Gold list,
unfolded at six sizes, meets neither the centre of the canvas nor the touch row,
health or menu, and Strike and the first Buy take their own taps; a world tap and
Escape fold it. A mouse at 1280×800 and at 932×430 keeps the desktop HUD (no
phone variables, full-bleed canvas, wordmark, tally, Return / Restart shown,
no touch row).

Updated for the new layout: `play-first-session` (the phone goal line is now
*under* the top band holding health and satchel, and it has two buttons, so it
taps `.guide-go`), `play-hud` and `play-consent` (the touch row is measured by
its clusters, `.touch` is `display: contents` on phones).

## Desktop

Second pass: a DOM snapshot of every rendered node under `.stage` (rect relative
to the stage, font size, colour, visibility, opacity, background) was compared
between `60da5dc` and this build with a mouse at 905×800, 1280×800, 1920×1080
and 932×430, and with a touch screen at 1280×800 and 1024×600, in a town and the
Delve: identical (0 nodes differ in all twelve).

First pass: from 901px nothing moved: a DOM snapshot of every HUD rect, display, font size
and colour at 905 / 1280 / 1920px, in a town and the Delve, with and without a
touch screen, is identical between the two builds except for the new phone-only
nodes, which are `display: none` there. The touch grid on a coarse-pointer
desktop keeps its order (Left Right Jump Attack Dodge / Down Blast): the cluster
wrappers are `display: contents` there and the Delve's Down has a desktop copy
in its old place.

## Not done / follow-ups

- Done in the second pass: landscape phones wider than 900px, the Homestead's
  Gold list over the middle of the world, and the 8–11px touch labels (now icons).
- Still small text on phones: the Hearth pill, the Interact prompt's name and
  button, the goal line's label, the health labels. They are readings, not
  controls with an icon to hand; the next pass could raise them to 11px.
- Tablets with a short side over 500px keep the desktop HUD (by design here).
- A thin purple line at the canvas's bottom edge (and top-left in landscape) is
  in the before build too; it is not part of the HUD.
