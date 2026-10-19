# Cozy UI — every menu in the top-down look (2026-10-19)

Owner: "build them nice and with the styles we are adapting … migrate everything to this, this is the future of the game."
References: `docs/design/refs/cozy/ref-1..6.jpg` (Tiles Survive: parchment quest scroll, round minimap, warm timber town).

## What changed
- **Palette:** `src/styles/tokens/_cozy.css` — wood ramp (`--cozy-wood-0…hi`), plank plate, sunk well, parchment + ink, brass,
  lantern glow, cream, three town accents; `--font-game` (the game's lettering, Inter today; one token to swap in a pixel face).
- **Window tokens** (`src/styles.css` "Pixel windows"): `--px-win-*` now draw a dark-plank plate with plank seams
  (`--px-win-planks`) inside an 11px square wood frame lit from the top-left; cells sink into the plate; `.px-parch` for parchment.
  Builds on the clean pixel windows from `wip/nice-menus` (merged here).
- **Remap inside windows** (side-scroller.component.css, the `.book, .places, .place, .anchor-sheet, .win-host, .story-card` block):
  obsidian → wood, violet → brass, gold → brass, ink → cream. Every hosted page and station kit inherits it, so no component needed
  its own restyle. The primary action button reads `--ab-top` (brass in windows, unchanged elsewhere).
- **HUD** (end of side-scroller.component.css, "Cozy HUD"): HUD tokens remapped on `.stage`; plates and buttons are wooden chips,
  the top-bar primary and the interact button are brass; the goal card is a parchment quest scroll with timber rods.
- **Lettering:** every `Orbitron` in `src/app/play` and `src/app/shared` CSS now reads `var(--font-game)` (canvas text untouched).

## Screenshots
`COZY_SHOTS=<prefix> PW_PORT=4652 npx playwright test --project=chromium --reporter=line e2e/cozy-shots` (optionally
`COZY_ONLY=satchel,vendor`) writes every menu at 390×844, 844×390, 1280×800 into `docs/handoff/cozy-ui/`.
Only the latest set is kept in git. `homestead` cannot open over the top-down square (Infernal town only) — expected.

## Next
- A pixel typeface (owner to approve adding an OFL font file) → set `--font-game`.
- Round minimap top-right (ref), parchment for help cards and notes.
- Desktop station windows are taller than their content (vendor): size to content.
