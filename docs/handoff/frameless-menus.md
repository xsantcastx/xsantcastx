# Frameless pixel menus (roadmap item 1, fourth pass)

Owner, 2026-10-15: "that should be for all menus! no frames needed", "make the windows like pixel art as well … more precise, more
simple", "like the crafting menu, so much stuff, just make it like MapleStory simple", "I need to scroll down and stuff, we don't
like that as gamers, should be like two clicks or one."

Shots: `docs/handoff/frameless-menus/before-<menu>-<size>.png` (the Slate commit's base) and `after-…` at 390x844 and 844x390
(crafting, enchanting, runes, vendor, gambler, market, vault, satchel, the Menu, character, glass, sound, pets, waystone).
Regenerate: `MENUS_MEASURE=1 MENUS_SIZES=390x844,844x390 MENUS_ONLY=crafting,satchel MENUS_SHOTS=<dir>/<prefix> MENUS_OUT=<file>.json PW_PORT=<port> npx playwright test e2e/play-menus-orientation.spec.ts`.
The rule itself is in `docs/agents/BRIEF.md` ("Menus").

## What changed

- **No frame.** Positions are exactly menus-orientation's (portrait sheet, landscape side panel, desktop window); only the box goes:
  no corner brackets, dashed rules, framed title bar, outer panel, border or shadow. `.menu-scrim` (side-scroller) dims the world
  (70 %, a 3 px blur on desktop) behind any menu; a tap on it puts the menu away (`dismissMenu()`). Content gets a fade behind it
  (a soft gradient, never an edge) and a 2 px pixel text shadow for contrast. The Slate keeps its own veil (see `slate-phone-only.md`).
- **Pixel.** `--radius-*` and `--shadow-*` are 0 for everything hosted in a menu (the tokens inherit into the kit), controls use the
  2 px stepped edge (`box-shadow: 0 -2px …, 0 2px …, -2px 0 …, 2px 0 …`, no blur), art is `image-rendering: pixelated`. Global helpers in
  `src/styles.css`: `.px-x` (a 7 x 7 pixel ×, still a 44 px target), `.px-help` (the pixel ?), `.px-arrow` (page triangle). No pixel
  font is shipped (none in the repo); headings stay Orbitron, which is blocky enough, body stays readable.
- **MapleStory-simple stations** (every station built on `shared/station-ui`, i.e. Crafting, Enchanting, Rune Forge, Vault, Vendor,
  Gambler, Market, Kael's bind; the kit does it itself when it sits inside `.place`):
  - `JournalList` in the world is a paged **pixel icon grid** (5 x 3 upright, 4 x 2 sideways, ◀ ▶ + "1 / 3"), selected = gold edge,
    ready = green pixel, locked = greyed with a pixel padlock; the name lives on the result card. No scrolling list.
  - The **result card** is icon + rarity-coloured name, the ingredient icons with have/need (green met, red short; the name is the
    tooltip), and ONE big pixel button (a small − N + stepper; "ALL" only when it fits). No "required items" titles, no sentences.
  - `StationShell` in the world: one slim row (wallet, pixel ?), the level as a slim pixel bar, tabs as pixel tabs that wrap (never scroll),
    the sentence/details drawer behind the **?** (a card over a dim, `ss__more--help`), the decorative forge floor gone.
  - Sideways, the grid is the left column and the card the right; the wallet and ? ride the title bar.
- **The Satchel** bag is five across and pages (15 a page, ◀ ▶), not a scrolling column. The Menu (☰) is names only (two across upright,
  three sideways), the descriptions are tooltips / `aria-describedby`; Sound and Pets lose their frame, their sentences go behind a pixel ?
  (Sound) and the pixel ×; Lune's / Kael's Slate strip is one button row (the line is its tooltip); the story card is words on the dim.
- Not rebuilt (still their own screens, frame gone, pixel ×): Character hub, Glass of Becoming, Codex, Skills, Quests, Waystone,
  Homestead build, Account & settings, Rift anchors, Glim talk and story scenes. Character / Glass still scroll their long pages. See "Next".

## Tests (`e2e/play-menus-orientation.spec.ts`)

Unchanged hit-test / outside / clipped / covered / move-stick assertions at 844x390, 390x844, 360x740 for every menu, plus the turn test.
New: `noScroll: true` menus (Crafting, Rune Forge, Enchanting, Vendor, Gambler): the primary action exists, is in plain view at scrollTop 0
the moment the menu opens (so open + press = at most two taps), at every size. Slate menus close via the phone's home bar (`closeClicks`),
`modal` menus may cover the move stick. Added `slate-pets`. `MENUS_SIZES` limits the measure mode to some sizes.

## Next

Character, Glass, Codex, Skills, Quests, Homestead build and Account still scroll their long content: give each the same grid + card + page
treatment (each is its own template), and a `noScroll` entry in the spec.
