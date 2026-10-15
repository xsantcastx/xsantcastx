# Touch & tools: no text selection on a hold, and the right tool in hand

Owner, 2026-10-15, playing on a phone:

1. "when pressing buttons or interacting on the phone, sometimes when I hold, it selects the text — block that."
2. "when fishing I still have the sword equipped; when doing activities it should use the correct tool if we have it."

## 1. A hold is a game gesture

- `src/styles.css` (after the `gf-play-route` gesture rules): on /play (`html.gf-play-route body`, and
  `app-side-scroller` itself so it holds before the route class lands) — `user-select: none`,
  `-webkit-touch-callout: none` (no iOS callout or magnifier), `-webkit-tap-highlight-color: transparent`.
  Buttons, links, labels and summaries get `touch-action: manipulation` (no double-tap zoom) through
  `:where()`, so any component's own `touch-action` (the joystick's `none`, the map's pan) still wins.
  The stage was already `touch-action: none`.
- Exempt (still selectable and copyable): `input`, `textarea`, `select`, `[contenteditable]` and anything
  marked `[data-selectable]` — today the Hearth's chat log. So the Keeper name, the Hearth chat and a map
  pin name take a selection as before.
- `SideScrollerComponent.onHoldGesture` (`@HostListener` `contextmenu` + `selectstart` on the host):
  `preventDefault()` unless the target is in the exempt set. Covers the canvas (before, only in the
  Delve), the HUD, the Satchel, the Slate, stations, casino screens, dialogue, Glim talk, the pet card
  and the cabinets — everything renders inside the /play host.
- **Decision — reading pages:** the Codex, lore books and every page outside /play keep normal
  selection. There a long press is how you copy a passage; in /play it is always a control.
- Focus outlines, keyboard play and screen readers are untouched (no `pointer-events`, `tabindex` or
  `outline` changes; `user-select` does not affect accessibility trees).

## 2. The right tool in hand

**Model (investigated first):** tools already *work from the satchel* (`skills/tools.ts`, nothing is
equipped — the satchel slip says so), and the equipped weapon lives in `equipped.weapon`. So the swap
is **purely visual**: no item ever moves between slots, the save never changes, a reload still wears
the weapon. The engine draws the Keeper with the weapon layer swapped for the tool while the work lasts.

- `shared/skills/held-tool.ts` (pure): `bestTool(family, ids, level)` — the highest tier the wielding
  skill allows (`TOOL_TIER_LEVEL`), a forged tool over the Worn starter of the same tier, the lowest held
  one when every one is above the cap; `bestRod(has, fishingLevel)` — the same against each rod's own
  level; `heldToolPieces()` → per activity (`pickaxe`, `axe`, `sickle`, `rod`) the painter's weapon layer
  (family realm style, tier → rarity colour; starter = neutral/common); `heldToolsKey()`.
- `keeper-gear.ts` / `keeper-paint.ts`: a new weapon kind `rod` (spec + sprite: cork butt, reel, thin
  pole, pale tip). Never read from an item name — a "Rod" weapon is still a staff. `KeeperPainter.weaponTip()`
  says where the held tip was last drawn; the fishing line now hangs from the rod's tip.
- Engine (`engine.ts`): `setHeldTools(pieces)`, `heldTool`, option `onHeldTool(tool | null)`.
  - Takes the tool: a swing at rock that bit (`toolBit`: pickaxe / axe / sickle, from `swingTool`), a
    gathering node worked (`workSite`), a cast (`cast` → rod).
  - Puts it away (weapon back): a live foe within 260 px × figure (`FOE_NEAR`; melee reach is 145) —
    and no tool comes out while one is near; a blow that lands on a foe; an attack that bit nothing (a
    swing at the air / a refused cell); 3 s after the last use (`TOOL_HOLD_SECONDS`) — the rod stays
    while the line is out or a recast is pending; entering a new place; falling.
  - No tool of that family held and any tier would do: once a session the HUD line says
    `play.hud.tool.missing.<kind>` ("No axe in your satchel: the Crafting Bench forges one.", EN + ES in
    `world/hud.i18n.ts`), and the weapon stays. A cast with no rod keeps its existing `play.fish.noRod`.
  - One painter per tool look, cached (≤ 6), so each still holds a single frame sheet.
- Host (`side-scroller.component.ts`): `pushHeldTools()` on the HUD tick (bag + worn, not Delve-chest
  items; levels Mining / Woodcutting / Foraging / Fishing), pushed only when `heldToolsKey` changes.
  `heldToolSwapped()` plays the new `swap` cue (`sound-director.ts`: a soft shuffle + tick, 0.2 s gap)
  and writes `data-keeper-held` on the canvas (`''` = the weapon).
- Not done: the realm-Delve keys (Billhook, Dawn Lens, Orrery Key) are used by interacting, not swung,
  so they stay out of the hand; the staff keeps its blast (L) without a swap.

## Tests

- Karma `shared/skills/held-tool.spec.ts`: best tier by level, forged over starter, over-cap fallback,
  missing family, rod rule, pieces + key.
- Node `scripts/seamworks-engine.test.cjs` "tool in hand" ×4: node → sickle/axe, 3 s idle → weapon,
  swing at air → weapon; foe near → weapon and no tool while it stays; dig → pickaxe, cast → rod held
  while the line is out, new place → weapon; missing tool → weapon + hint once.
- e2e `e2e/play-touch-and-tools.spec.ts`: desktop 1280×800 and phone 390×844 (touch) — dig → `pickaxe`,
  idle → `''`, cast → `rod` (still after 3.6 s with the line out), attack → `''`, `data-keeper-gear` keeps
  the maul throughout, reload: maul still `equipped` in the save. Phone long-press (CDP touch, 900 ms) on
  the canvas and HUD controls: `getSelection()` empty, `contextmenu`/`selectstart` prevented,
  `user-select: none`; a drag over the title selects nothing; the Hearth name field takes `selectstart`
  and a selection, chat field `user-select: text`. `TT_SHOTS=1` saves screenshots to
  `output/touch-and-tools/`.

## Unverified

Real iOS Safari (callout/magnifier) and Android Chrome long-press were not tried on a device; the CSS
and listeners are the standard set for both.
