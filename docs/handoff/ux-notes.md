# The owner's player notes (2026-10-21): HUD fixes

Branch `uxnotes`. Spec: `e2e/td-ux-notes.spec.ts`. Unit: `src/app/play/ux-notes.spec.ts`. Words: `play/td/td-ux.i18n.ts` (lazy, EN + ES).

| Note | What a player gets | Where |
|---|---|---|
| Equip unreachable | Item cards (hover and pinned) are measured and placed inside the window. They flip left or up near an edge, are never taller than the window, and the pinned card scrolls inside with its actions in a sticky foot. | `play/fit-viewport.directive.ts`, `.d2tip` rules at the end of `side-scroller.component.c.css` |
| Esc closes everything | Escape closes the topmost HUD menu wherever the focus is, in this order: pinned card, peer card, loot, settings, friends, pets, Bestiary, Map, Spellbook, sheet, satchel. I/K/C/B/M toggle. | `closeTopMenu()` in `side-scroller.component.ts` (OverlayStackService still takes Escape first through its capture listener) |
| Prologue keys | A key cap beside each prologue row, plus a keys strip (I K C M E 1-4 Esc) on a computer. Phones show a tap line instead. The dock shows I/K/C/M. | `proKeys` / `hudKeys` / `keyCaps` |
| XP bars | A Diablo II bar across the HUD's foot with a hover or tap tooltip. The character sheet has a **Skills** tab: nine skills, each with its level, bar and XP to the next. Smithing counts the bench XP. | `xpBar`, `skillRows` |
| Draggable HUD | On a computer, the party frames, goal card, chat, minimap and plate each get a grip on hover. Positions are kept in `eclipse-hud-layout`, a plain localStorage device preference behind try/catch. Settings → Reset HUD layout puts them back. Phones keep the fixed layout. The party frames sit under the plate and pet chip (measured `--party-top`). | `play/hud-drag.directive.ts`, grip CSS in `src/styles.css`, `tickPartyTop()` |
| Minimap creatures | Creatures show as red dots: champions blue, uniques gold, bosses big with a pale heart. In the dark only what your light reaches shows. Capped at 40. | td-engine `miniMobs` |
| The Map (M) | Every section of the continent: the surface plus every cave, dungeon and floor. Parchment on wood, region names with level bands, pins by kind at a fixed size that never move on hover, and a tooltip. Wheel or pinch zoom, drag pan, + / − / centre on me. A folded key and a search. Far out, the town's stalls fold into the town name. | `play/td-map-window.component.*`, `play/td/td-map.ts`, td-engine `mapView(section)` / `mapSections()` |
| Chat keys | Enter opens the chat and focuses its line. Enter sends and hands the keyboard back; Enter on an empty line or Escape just hands it back. While any field has focus (target, `document.activeElement`, IME), the world ignores every key, and held keys are released on focus. | td-engine `bindInput`, `typing()` / `openChatLine()` |

Hooks left:
- Level bands come from the creatures each region or floor is drawn with. When `zones` lands `td-zones.ts`, pass its bands as `bandOverride` to `mapSections` / `zoneLabels`.
- The specs that travelled via the old right-hand list now type into the Map's search first, which opens a results list with the same `.td-map__key` buttons.
