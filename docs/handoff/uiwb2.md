# UI pass 3, Wave B part 2: sideways phones, the Keys picture, the Chat sheet, trade (branch `uiwb2`)

Spec: `docs/design/ui-pass-3.md` → Waves → Wave B (§1c, §2c, §3c, §6, §9c, §13c), plus the leftovers from the
Wave A and Wave B part 1 reviews. Screens: `output/uiwb2/before/` and `output/uiwb2/after/` (not committed), EN and ES
at 360×640, 390×844, 844×390 and 932×430; the trade window from a real two-Keeper room in `output/uiwb2/trade-*`.
No server code changed.

## What a player gets

**Sideways phones: the thumb HUD's mirror** (`side-scroller.component.ts` `thumbLand` / `thumbHud`, `.stage--land`)
- A phone held sideways (landscape, at most 500 px tall, and at most 1000 px wide or a touch screen) gets the thumb HUD
  instead of the old dock, touch row, prompt bar and chat box. Always the compact sizes.
- **Right thumb:** the same disc and four-key arc, and the ⇅ chip.
- **Left thumb:** the belt is a row along the foot (Health, Mana, Spellstone, then up to three item hotkeys); Bag ·
  Map · More sits on it.
- **Top band:** the face chip, Glim, and the goal chip beside them on row A; the ticker under them (two lines across
  the screen, Glim's line clamped to two). It ends at y 96, above the play centre (97.5 at 390). The chapter tag that
  would hang over the screen edge is hidden here.
- **Left column:** party frames, the pet chip and the aura under the top band, clear of the arc.
- **☰ More:** a side sheet of five tiles a row; every tile in view without scrolling.
- `thumb` still means a portrait phone (the satchel sheet, the bottom card, corpses opening Nearby). `thumbHud` is
  the HUD standing either way.

**The satchel sideways** (`.stage--land .book--paged`, `side-scroller.component.thumb.css`)
- One window across the screen. The left panel (40%, at least 300 px) holds the doll and its faces (Worn | Stats |
  Nearby), the belt and the purse.
- The right panel holds ◀ 1 · 2 ▶ and the grid in 5-column pages. The cell is `clamp(44, (100dvh − 124) / 6, 52)`:
  44 at 390 tall, 50 at 430.
- A tapped piece's card docks inside the left panel, over the doll, so the grid and the piece stay in view.
- The side view's hearth (td=0) also pages its grid on a sideways phone (`gridPaged`), so no pocket there is 31 px. It
  keeps its old window (it has a move stick to clear).

**The Vault** (`shared/vault/vault-station.*`)
- **Sideways:** the Vault on the left and the satchel on the right, each in two 5-column pages at 44 px. The Vault's
  tab chips (and "+ · price") head its column; the satchel's column heads with its name. Each grid scrolls inside its
  own area.
- **Portrait:** the Vault | Satchel switch is sticky under the title row. The grid is centred under its pages, and its
  area is as tall as the screen leaves (at most six rows), so 360×640 fits with no outer scroll.
- **Everywhere on a phone:** the foot keeps Deposit all (brass) and Take all and sticks to the window's bottom.
- **Sort:** Sort tab and Sort satchel moved behind the ? (the station's help card), on every size.

**The Skill Book's Keys tab** (`play/spellbook/skill-book.*`; Diablo Immortal's model)
- **The picture:** the top is a picture of the Keeper's own layout.
  - A portrait phone sees the arc round the disc, with keys 1–4 or 5–8 by its page chip, the HUD's own geometry.
  - A sideways phone and a desktop see the bar's eight keys.
  - The belt's three keys (Health, Mana, Spellstone) sit beside it, with their caps.
- **The skills:** under the picture, the learnt skills as 64 px tiles. A skill on a key shows "on 3".
- **Putting a skill on a key:** tap a skill, then a key (or a key, then a skill); a hint line says what to tap next.
  Or drag the skill onto a key: a mouse drags at once, and a finger lifts it after a 250 ms press, so a swipe still
  scrolls.
- **The tab row:** the trees scroll sideways (snap, a fade at the edge), and Keys is a chip of its own, always whole, at
  the right beside the ?.
- **"Unused points":** keeps its words on a phone, on two short lines beside the number.
- Aura switches stay under the grid. The old 8-button grid per skill is gone.

**The Chat sheet** (portrait and sideways)
- One wooden window anchored to the foot, 60% of the screen tall in portrait. Sideways it is the left 62% of the
  screen, so the Keeper stays in sight.
- Tabs at 44 px, lit wood when chosen (never brass); the × at 44.
- The log fills the middle and scrolls.
- A 16 px input with a brass Send, and the Join button at 44. It rides over the keyboard (`--kb-inset`).
- The sheet opens from the ticker or More → Chat.

**The trade window** (`play/trade/trade-hud.*`). Reviewed first with a real two-Keeper room (local Hearth,
SOCIAL_FAKE_TRADE) at 360×640, 390×844, 844×390 and 932×430.
- **What the review found:** the window already fits every size without scrolling, nothing is under 44 px, sideways is
  already your offer | their offer with the satchel strip below, and their ✓ Accepted plate exists. So the layout
  stays.
- **What changed:**
  - Accept, Confirm and Close are brass, the one primary (they were leaf green).
  - The confirm stage shows "You give | You get" in words, with the Gold in big numbers (RuneScape's second screen),
    instead of the satchel strip, so the stage that settles the trade reads differently from the one that builds it.
- New keys: `trade.sum.give|get`.

**Leftovers**
- **More sheet (portrait):** tall enough for five rows of three, so the 13th tile's label is never clipped at the
  foot; it still scrolls on a shorter phone.
- **Worn tab:** on a portrait phone it always shows the charm row (charm slots are never locked; an empty row says
  where charms go).
- **The settings sheet** in `play-menus-orientation`: it was never out of reach. The spec measured `.sound-host .ss`,
  whose scroll container is the host outside it, so it now measures `.sound-host`, the window a thumb scrolls.

## Director FIX round (review of d9a4645a)
1. **Sideways satchel carry bar.** "Holding … Put back" docks at the foot of the left panel, and the card shortens
   above it; the grid's rows are never covered. The grid's height is a whole number of rows (`round(down, 100%,
   --cell)`), and "3 / 60 slots" is 12 px. The card's lines sit at the top of the card (no stretched gaps).
2. **The Keys picture's belt** draws what the HUD's belt draws: the potion or Spellstone art (or the HUD's empty
   flask) with its count (`[beltPics]="bookBelt"`).
3. **Keys tab sideways.** The picture is sticky at the scroller's top, the hint words and the tagline step aside, and
   the keys are 48 px, so the first row of skills is in view at 844×390. The Skill Book is full width under the
   sideways thumb HUD.
4. **Chat sheet sideways:** `min(400px, 50% − 32px)`, short of the Keeper at the centre.
5. **Trade confirm on a short screen** (≤ 460 px tall): the offer rows hide, leaving the summary, the status and the
   buttons.
6. **Evidence:** `output/uiwb2/after/`
   - `chat-tab-{390x844,844x390,360x640}.png`: connected, a 16 px input, a 44 px brass Send;
   - `chat-join-*.png`: the 44 px Join;
   - `worn-*.png`: the charm row.
- **Vault grids** are whole rows too (sideways and at 360).
- **The enchanting 844×390 red** ("body scrolled 192px") was checked on the base build: see the report.

## Tests
- `e2e/play-wave-b2.spec.ts` (new). It checks:
  - the sideways satchel (panel ≥ 300, cells 44–52, the card in the left panel, the piece uncovered);
  - the sideways Vault (side by side at 44, chips over the Vault, the foot, Sort behind ?);
  - the portrait Vault (sticky switch, the grid centred, the foot in view);
  - the Keys tab at 360×640, 390×844 and 844×390 (Keys whole, "Unused points" shown, arc or bar, the belt, tap-assign,
    the arc's second page), and a desktop mouse drag;
  - the Chat sheet at three sizes.
- `e2e/play-thumb-hud.spec.ts`:
  - the sideways HUD at 844×390 and 932×430, EN and ES, with the zones, sizes, overlap, thumb reach, the belt row,
    the top band above the centre and a hunt;
  - sideways More with all tiles in view;
  - portrait More now asserts no scrolling is needed.
- `e2e/menus-reach.spec.ts`:
  - More, the Chat sheet and the Keys tab at all three sizes;
  - the sideways control test reads the thumb HUD and opens the Game Menu via More → All menus.
- `e2e/td-trade.spec.ts`: the confirm summary (both sides, the Gold).
- `e2e/td-book.spec.ts` and `play-helpers.putOnKey`: the Keys picture (tap a skill, then a key; the page chip for 5–8).
- `e2e/td-loot-ground.spec.ts`: Sort through the ?.
- `e2e/play-menus.ts`: the sound sheet's root is `.sound-host`.

## Not done / notes
- "Book slot" on the Worn tab: no such slot exists. The charm row is done; the belt (and its Spellstone slot) stays on
  the Bag tab.
- The Skill Book "one page wide" sideways (§9c) and the character sheet in two columns (§10c) are untouched.
- Dragging a skill onto the arc's hidden page (rest on the page chip to flip) is not built; tap the chip first.
- The trade window's portrait segments (Your offer | Their offer | Satchel) were not built: the review found the
  single view fits and reads at every size.
