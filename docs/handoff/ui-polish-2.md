# UI polish, second pass — subtract, then frame the Keeper (roadmap item 1)

Continues `ui-clean-pass.md` and `make-your-keeper.md`. Owner: "improve the UI UX it just doesnt feel nice ... look
at diablo 2 inventory, its just the slots and worn items". Nothing was added to any screen except the Keeper figure
in the Satchel doll; everything else is removal. Existing tokens only. Before/after shots (390×844 and 1280×800) are
in `docs/handoff/ui-polish-2/` (`before-*` = base 215bab4f, `after-*` = this branch).

## 1. The dark shape behind the Keeper

It was not the Keeper. It was a **townsperson** (the hooded/robed "folk" in `play/world/life.ts`, drawn by
`engine/town-life.ts`) that happened to be standing on the spawn point by the Vault. Folk only yielded when *walking*
toward the Keeper; one already standing there stayed put, so the new pixel Keeper always had a dark robe behind it.

Fix (`TownsfolkCrowd.update`): a townsperson **standing** within `TOWNSFOLK_CLEAR` (50 px) of the Keeper walks off to the
far side; if that side of its floor is too short (a stall or a keeper is there) it passes behind the Keeper to the open
side (`passing`, no yielding until it arrives). Two node tests in `scripts/seamworks-engine.test.cjs` pin both cases;
the old yield test is unchanged. Shots: `before-390-01-world` vs `after-390-01-world`.

## 2. The Satchel doll, Diablo II-style

`play/side-scroller.component.*`: the worn wells now frame **the player's own pixel Keeper** (`KeeperPainter.still`,
painted to a data URL whenever look or gear changes, `dollFigure`):

```
 .       head    trinket
 weapon  KEEPER  off-hand
 chest   KEEPER  hands
 legs    feet    .
 charm1  charm2  charm3      (only once a charm is owned)
```

No well sits on the figure; every well is square (`width: var(--cell)`) whatever column it stands in. Phone cells stay
50 px, desktop 58 px. Shots: `*-02-satchel`, `*-03-satchel-item`.

On **/character** (`shared/rpg/equipment-panel`) the item medallions ("sockets") that floated over the figure are no
longer drawn on the pixel Keeper — the gear is painted on the body now. They still exist for the painted fallback
figure (no canvas). `e2e/loadout-socket-targets.spec.ts` tested those medallions' hit pads and is removed with them.

## 3. Clean-pass leftovers

- **Desktop HUD tally**: the plate paints Coins · Ore · Ember (one row). Edge, Damage and Defeated are still in the DOM,
  visually hidden (`.tally-quiet`), so screen readers and the specs that read `.satchel .tally` keep them; the doll and
  Stats already show them.
- **Phone satchel button**: the "9/40" pill stacked on the corner is gone; the count sits inside the 44 px button under
  the bag (amber when full). The Overflow dot moved to the top-right corner.
- **Station kit hero line** (`app-detail-head [line]`): removed where it only repeated the button — the Material Vendor
  ("Sell 1 X for N Gold" over "Sell for N Gold · 1 X") and the Gambler box ("Open 1 X"). Keys `vendor.sellLine`,
  `gambler.openLine` deleted. Benches keep theirs (the line carries the batch count the button does not).

## 4. /character loadout fold

The **Keeper stats** fold printed "Keeper stats" twice (summary + the sheet's own heading): `app-keeper-stat-sheet` got
`showHeading` (default true; the heading stays as the aria-label). The charm hint ("No charms yet…") moved from the top
of the fold to the bottom, after the build card. The locked Feet well read "Awaiting a c…"; `loadout.slot.locked` is now
"None yet" / "Aún nada". Shots: `*-05-character`, `*-06-character-fold`.

## 5. Phone sweep (390×844, every station via `?at=`)

- `requirement-grid`: on phones (≤480 px) no hatched filler cells, and a box with nothing in it and nothing to say is not
  drawn (the Enchanting table showed four hatched wells and an empty "Required items" title). Wider panels keep the
  journal-page shape. The have/need count breaks after the slash, not mid-number ("52,020/6 00" on the Rune Forge).
- `journal-list` phone strip: tile captions ("9 held · 1 Gold each") clamp to two lines with no letter-spacing (they
  wrapped to three and pushed the tiles uneven).
- Skills panel: its "Skills" heading under the place head "Keeper · Skills" is visually hidden (kept for
  `aria-labelledby`).
- Looked fine / left alone: Vault, Exchange, Crafting, Quests, Waystone, Glass of Becoming, Character place, Hearth.

## Not done / found

- `/character` at 1280×800: the global **Kael chat bubble** sits over the Weapon well, and the **Self-Aware** easter-egg
  toast ("Rediscovered") pops on every visit and covers the right column. Both are site chrome, not the loadout.
- The **Feet** slot accepts nothing (`item.model.ts` `accepts: []`) although feet items exist (Astral Striders): the well
  can never fill. A content decision, not a layout one.
- Enchanting with no runes says "You have no runes yet" twice (in the Additive box and under the button).
