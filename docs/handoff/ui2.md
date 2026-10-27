# UI clean pass (ui2), 2026-10-26

Owner: "We need to improve the user interface! They do not look nice, some texts overlap, for example the exp bar.
We need nice clean styles as well." The design system it follows is `docs/design/ui-system.md`, new in this pass.

## Pass 1: the HUD and the main menus

| # | Was | Now | Where |
|---|---|---|---|
| 1 | The XP tooltip covered the Interact prompt on desktop; on a phone it clipped under the dock ("8,188 XP" cut) | Desktop: a lane is reserved above the bar, with the prompt from 184 px and toasts from 240 px. Phone: the tip opens above the menu tabs, wraps inside the screen and sits above everything | `side-scroller.component.ui.css` |
| 2 | Unit frame numbers in Cormorant old-style ("I22", "7o"); 8 px capitals; a bare "▯0" | Name in Pixelify 14; Soul reads "Soul 0"; life and mana are not repeated next to the orbs | template spans `vital__name`, `vital__what`, `vital__soul-word` |
| 3 | The prompt was 8 px letter-spaced capitals | Inter 13, sentence case | ui.css |
| 4 | Menu labels upper-cased in Pixelify with Inter's C ("seleCCion"), at 10 px | Sentence case everywhere in the game (`styles.css`, `app-play-shell`), menu labels 13 to 14 px, two columns at most, Resume full width, a wider window on desktop | styles.css, ui.css |
| 5 | The bottom bar was a 920 px plank with the controls floating in the middle on odd gaps (5, 6, 14) | The bar hugs its contents on the 4 px grid, with grooves between menu, skills and belt; 1.25× from 1700 × 980 | `hud-bar.component.css` |
| 6 | The quiet chat dropped to 35% opacity and its tabs vanished | 82%, and an empty log takes no room | ui.css |
| 7 | The Skill Book's Keys tab showed keys 1–4 while the bar has 8, and the bar compacted, so a skill could never sit on 5–8 with gaps | All eight keys (caps from the keymap) and the belt's three keys; `look.bar` keeps empty keys as `''`, so a skill stays on the key it was put on | `skill-book.*`, `keeper-look.model.ts trimBar`, `td-engine.ts setSkillLoadout/abilities`, `hud-bar ability()` |
| 8 | Phone prompt crossed the spell column at 360 px; in landscape Glim's line covered the belt and the prompt | The prompt and Glim's line start right of the column; in landscape Glim's line moves to the top lane | ui.css |
| 9 | The Menu and Character windows ran down over the bar, the belt and the mana orb | They end 128 px (160 px at 1.25×) above the bottom | ui.css |
| 10 | The character sheet's tabs clipped on a phone ("Attribu…") | They wrap in Inter 12 | ui.css |
| 11 | A 1080p screen showed an 8 to 10 px HUD | The whole HUD is 1.25× from 1700 × 980 | ui.css, hud-bar css |

## Screenshots

`docs/handoff/ui2/before/` (live 05ad60f0) and `after/` show hud, xp, menu, keys and sheet at 1280 × 800,
1920 × 1080, 1366 × 768, 390 × 844, 360 × 640 and 844 × 390, in EN and ES. `compare-*.jpg` are the labelled
side-by-sides.

    UI2_SHOTS=after PW_PORT=4711 npx playwright test --project=chromium --reporter=line e2e/ui2-shots
    UI2_COMPOSE=1 PW_PORT=4711 npx playwright test --project=chromium --reporter=line e2e/ui2-compose

## After merging loot (84b7e739) and the Graphics Beta (ad2c7716)

| Was | Now | Where |
|---|---|---|
| Settings rows (Graphics among them): 12 px Pixelify capitals with wide tracking; explanations in Cormorant italic | Names in Inter 13, choices in Pixelify 13 in sentence case, explanations in Inter 12 | `sound-sheet.component.ts` |
| Vault actions: the primary was `--gold-bright` (a retired token) and the others were thin outlines | Deposit all is brass with the brass chip; Take all and both Sorts are wood chips; all 44 px, Pixelify 14 | `vault-station.component.css` |
| Satchel Sort was a flat 12 px box | A wood secondary with the chip edge, Pixelify 14 | ui.css |
| A fourth belt slot (the labels toggle) pushed the phone column off a 640 px screen | Spells and belt stand as one column on the screen's middle; the toggle lights with a brass ring while on | ui.css |
| The ground list showed a bare count beside its close button | The title says what it is; rows in Inter 13 | ui.css |

`e2e/ui2-shots` now pins Classic graphics, because Isometric (the new default) layers extra canvases and the before
set was Classic. Before shots of the new bits are under `docs/handoff/ui2/merged/`.
