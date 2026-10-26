# Eclipse Realms UI system

The one reference for how a screen in the game is built. If a value is not here, take it from the nearest thing that
is, and add it here in the same change. Benchmarks: Diablo II Resurrected and PoE2 (orbs, tooltips, stash), Tibia
(compact panels), WoW (frames, bars), Stardew, Eastward and Sea of Stars (crisp pixel UI).

- **Tokens:** `src/styles/tokens/_cozy.css` (colours, fonts) and the window kit in `src/styles.css` ("Pixel windows",
  `--px-*`). There are no other tokens. A hex value in component CSS is a bug, except inside pixel-art SVG.
- **HUD layer:** `src/app/play/side-scroller.component.ui.css` loads last of the play view's sheets. It is where the
  HUD's type, spacing and lanes are settled; read it before adding a rule anywhere else.
- **Bottom bar:** `src/app/play/hud-bar/` (desktop only).

## 1. Principles

1. **Pixel art only, crisp.** `image-rendering: pixelated` on every raster. Scale pixel assets by whole steps only
   (1×, 2×, 3×). The HUD grows on big screens with `zoom: 1.25` on whole components, never a fractional scale on an
   image alone.
2. **The world is calm, so the chrome is too.** Wood and parchment, one brass accent per surface, no glows on idle
   things. Detail belongs to characters and effects.
3. **One primary per surface.** A station, card or dialog has exactly one brass button, and its label says the verb
   and the cost ("Forge · 120 Gold"). Everything else is a wood button or sits behind **Details**.
4. **Everything means something.** Every item, stat, currency and NPC shows where it is found and what it is used for,
   on hover (desktop) or tap (phone). A bare number with no label or tooltip is a bug: the Soul count in the unit frame
   reads "Soul 0" for this reason.
5. **Nothing overlaps.** Each HUD piece owns a lane (section 9). A tooltip opens into empty space, never over text.

## 2. Type

Two faces, and nothing else in the game UI.

| Role | Face | Token | Sizes |
|---|---|---|---|
| Names, titles, buttons, window heads | Pixelify Sans | `--font-pixel` / `--font-game` | 14, 16, 20, 24 |
| Numbers, stat lines, tooltips, body copy, anything 13 px or under | Inter | `--cozy-font-read` | 11 (meta only), 12, 13, 15 |
| Lore (books, letters, quest prose) | Cormorant Garamond | `--font-lore` | 15+, never for numbers |

Rules:
- **Sentence case everywhere.** Pixelify's capital C comes from Inter (`styles/tokens/fonts.css`, because Pixelify
  draws C like O), so CSS upper-casing set labels in two faces ("seleCCion"). `styles.css` forces
  `text-transform: none` under `app-play-shell`; keycaps (`kbd`, `.kc`) keep their own case. Hierarchy comes from size,
  weight and colour.
- **Numbers are Inter.** Pixelify's 2 and 5 read as 8 below 16 px, and Cormorant's old-style 1 reads as I ("I22"
  was 122 in the unit frame). Orb values, counts, prices and XP are Inter, or Pixelify only at 16 px and up.
- **Minimum 11 px**, and 11 px is for meta only (group heads, keycaps). Body text is at least 12 px; a phone's tap
  target label is at least 12 px.
- **Letter spacing 0** for Pixelify. Inter group heads may use `.08em`.
- No `text-shadow` blur. A 1 px wood-0 outline (`1px 1px 0`) is allowed on text that sits over the world.

## 3. Spacing

A **4 px grid**: 4, 8, 12, 16, 20, 24, 32. Gaps between slots are 4. Padding inside a chip is 8 horizontal. A window's
body padding is 12 (phone) or 16 (desktop). Groups inside a bar are 16 apart with a 2 px groove between them
(`.hb__skills::before`). Odd values (5, 6, 7, 14) are not used in new rules; the HUD layer replaces them as it goes.

## 4. Colour

All from `_cozy.css`.

| Use | Token |
|---|---|
| Window plate, bar plate | `--cozy-plate` with `--px-win-planks` |
| Frame wood (outline to lit edge) | `--cozy-wood-0` … `--cozy-wood-hi` |
| Sunk slot / well | `--cozy-well` |
| Body text on wood | `--cozy-cream` |
| Names, selected, lit | `--cozy-glow` |
| The one primary button | `--cozy-brass` (`-hi` top edge, `-lo` bottom edge) |
| Parchment and its ink | `--cozy-parch`, `--cozy-ink`, `--cozy-ink-soft` |
| Life / mana | `--cozy-berry` / `--cozy-mana` (`--cozy-mana-text` for mana words) |
| Good / bad deltas | `--cozy-leaf` / `--cozy-berry` |
| Loot rarity | `--cozy-loot-*` (common to mythic, socketed, runeword) |

Contrast: cream on plate is about 12:1; glow on plate about 11:1; ink on parchment about 10:1. Do not put cream text
on brass (use `--cozy-wood-0`), and do not dim body text below 80% opacity.

## 5. Frames and panels

One frame, two fills.

- **Window (wood):** `background: var(--px-win-planks), var(--px-win-bg); box-shadow: var(--px-win-rim),
  var(--px-win-inner), var(--px-win-drop);` A head row (`.win-head`): title in Pixelify 20 (16 on a phone), the close
  `×` at 44 × 44 on the right, a `--px-groove` under it. The body scrolls (`overflow: auto; overscroll-behavior:
  contain`), never the page.
- **Parchment:** `.px-parch` (`--cozy-parch`, `--px-parch-rim`) for quest scrolls, notes, the Skill Book's pages and
  help cards. Ink text.
- **HUD chip:** a small wooden plate (unit frame, currency strip, prompt): `--cozy-plate` + `--cozy-chip`.
- Square corners everywhere (`border-radius: 0`); the only circles are the orbs and the minimap.

## 6. Buttons

| Kind | Fill | Shadow | Use |
|---|---|---|---|
| Primary | `--cozy-brass`, wood-0 text | `--cozy-brass-chip` | One per surface. The verb and the cost. |
| Secondary | `--cozy-wood-2`, cream text | `--cozy-chip` | Every other action |
| Quiet | none, cream text, underline | none | Cancel, Reset, Details |
| Icon | `--cozy-wood-2` 34 to 50 px square | 2 px wood-0 ring | The dock, window close |

States: **hover / focus-visible** lifts the fill one wood step and rings it in `--cozy-glow`; **active** moves it down
2 px (none under reduced motion); **disabled** is `--cozy-wood-1` with cream at 40% and `cursor: default`;
**selected / pressed** is the brass fill. Every button is at least 44 px tall on touch; on desktop the dock's icon
buttons may be 34 px because they also carry a tooltip and a key.

## 7. Tooltips and cards

- **Tooltip** (`[data-tip]`, the XP strip): Inter 12/1.25, cream on `--cozy-wood-1`, ringed `0 0 0 2px wood-0, 0 0 0
  4px brass`. Name first, then the key after two spaces ("Satchel  I"). It opens above its anchor into the lane above
  the bar (section 9) and has `z-index` above every HUD piece.
- **Item card** (`.d2tip`, the D2 hover card): Inter throughout, the name in 15/800 in its rarity colour, then
  base, affixes, requirements (unmet in berry), **Found in** and **Used for** lines, then the compare block. A phone
  opens it on tap with the actions at its foot.
- **Stat line:** label left in cream at 80%, value right in glow, Inter 13.

## 8. Slots

44 × 44 (38 × 38 below 1000 px wide), `--cozy-well`, inset 2 px `--cozy-wood-1` ring, a 2 px shadow at the top-left.
The keycap sits bottom-right in Inter 10/700 cream with a 1 px wood-0 shadow; a count sits top-left in the same style.
Hover / focus: 2 px `--cozy-glow` ring. Cooldown: a conic wood-0 sweep (`--cd`). An empty slot shows the well only. A
belt slot's ring is tinted by its kind (berry for Health, mana blue for Mana, brass for the Spellstone).

**Keys:** the bottom bar has eight skill keys (1 to 8, two rows: 5–8 above, 1–4 below) and three belt keys (Health,
Mana, Spellstone). A skill stays on the key it was put on (`look.bar` keeps empty keys as `''`), so a skill on 7 is on
7 whatever 5 and 6 hold. The Skill Book's Keys tab lists all eight keys for each learnt skill and the belt's three keys,
with the caps from the keymap (rebinding shows at once).

## 9. HUD layout and lanes

Desktop (with the bottom bar, `.stage--bar`):

| Lane | Who | Where |
|---|---|---|
| Top left | Unit frame: face, level, name, title, Soul | 16, 64 |
| Top centre | Glim's line, place title card | under the top row |
| Top right | Places, Menu; currency strip; minimap | 16 from the edges |
| Bottom | The bar: life orb, menu dock, skills, belt, mana orb; the XP strip on its top edge | centred, 116 px tall |
| Above the bar, 0–56 px | The XP tooltip only | |
| Above that, from 184 px | The interact prompt; toasts from 240 px | centred |
| Bottom left, from 132 px | Chat | |
| Right | Docked windows (Menu, Character); they end 128 px above the bottom so the bar stays usable | |

The unit frame does not repeat life and mana while the orbs are on screen. From 1700 × 980 the whole HUD is
`zoom: 1.25`.

Phones (`max-width: 900px`, or a coarse pointer under 500 px tall):

- **Touch targets are at least 44 × 44.** No exceptions for the HUD.
- **Nothing covers the centre 50%** of the world for longer than a toast.
- **Lanes:** the spell column and belt own the left 64 px; the menu tabs, attack and Interact own the right column;
  the chat sits between them at the bottom; orbs and minimap top right; Glim's line under the minimap in portrait
  (starting right of the spell column) and along the top in landscape (between the column and the orbs).
- **Every menu scrolls** inside itself, and a 360 × 640 touch path reaches its last control
  (`e2e/menus-reach.spec.ts`).
- Text inputs are 16 px (iOS zooms anything smaller).

## 10. Motion

Steps, not easing, for anything pixel (`steps(4)`). 120 to 350 ms for UI. Every animation over 1 s, and every
`translate` on press, has a `prefers-reduced-motion` path that shows the end state.

## 11. Language

EN and ES must both fit. Design every label at Spanish length (about 25% longer). Labels wrap to two lines before they
ellipsize; a name may ellipsize, a verb never. Check both languages in the screenshot pass.

## 12. Review checklist

Shots at 1280 × 800, 1366 × 768, 1920 × 1080, 390 × 844, 360 × 640 and 844 × 390, EN and ES
(`UI2_SHOTS=<prefix> npx playwright test e2e/ui2-shots`). For each: spacing on the grid, type from section 2, contrast,
one frame style, one primary, no stale data, a visible response to every action, nothing overlapping, nothing under
44 px on touch.
