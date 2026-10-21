# Onboarding audit: new characters and new users (2026-10-21)

Owner: "We need to fix new character creation and onboarding to the game with new characters and new users".

## How it was played

Playwright against a production build (`ng build` → `scripts/serve-preview.js`, `PW_PORT=4695`), at **1280×800** and
**390×844** (touch, mobile UA). Storage was cleared from `/robots.txt` (no app booted, so no pagehide flush could write
a save back). Three flows:

- **(a) a brand-new visitor**: title → Play offline → New Keeper → each class (Warlock, Ashguard, Lanternwright) →
  enter the world → the first minutes (walk, press 1, Show me, the goal line, Glim).
- **(b) a returning player's second Keeper**: character #1 seeded lived-in (level 7, 4,321 Gold, a story beat, Glim
  met, a worn title, a tracked pin, a sound setting), then menu → Character select → New Keeper (Ashguard). A
  `Storage.prototype.setItem` spy on the new page listed every key it wrote; every unprefixed key that changed was a
  leak candidate.
- **(c) back to character #1**: its level, Gold, look, story and position read back.

Screenshots before: `docs/handoff/onboarding/before/*.jpg`; after: `docs/handoff/onboarding/*.jpg` (written by
`e2e/onboarding.spec.ts`).

## Punch list

Severity: **Blocker** (dead end / wrong save), **High** (teaches the wrong game), **Medium** (friction), **Low** (polish).

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| 1 | High | Prologue (top-down) | The first goals were "go down the mine shaft and defeat a Rivet Maw", "mine Cinder Ore", "cut a tree" — and **Show me** on the first one only said "The mines below are being dug: soon" (`play.td.soon.delve`), though the mine exists. Nothing taught movement, the hearth, the class's attack/keys, Gold pickup, the Spellbook, the Satchel or the Sexton. (`before/desk-05-warlock-spawn.jpg`) | **Fixed**: a new 7-step prologue (below) |
| 2 | High | Glim's goal hints | The goal row's Glim button refused every top-down goal ("This one's yours to find"): the hint ladder only knew the side view's goals. | **Fixed**: in the prologue Glim repeats the step's tip and its chevrons point the way |
| 3 | High | Story journal (Prologue) | The Prologue's leads and beats were the side view's: "Buy your first building on Your Homestead", "Forge the Basalt Edge at the Seamworks Forge", "Dig in the Ember Delve" — systems a top-down Keeper never sees, so the chapter could never fill. | **Fixed**: the beats read the island (a hearth lit, first fight, a seam mined) and their texts/leads say so (EN + ES) |
| 4 | High | Glim lines | Glim's "edge" line ("A blade made to show where a boundary is… Wear it well") fired for a fresh Warlock with a staff; the "maws" line pointed at "the Delve shaft". | **Fixed**: class-neutral line; "the mine shaft" (EN + ES) |
| 5 | Medium | The Glass (1280×800) | The maker in the lobby was a long single column: **Become this Keeper** sat at y≈1255 in an 800px window, under the name, under a 240px preview — a scroll inside a scroll, with the cookie bar over the bottom. (`before/desk-03-create.jpg`) | **Fixed**: the lobby uses the maker's compact game-window layout — class cards, then figure + name + Become, looks in a grid; Become in view without scrolling (asserted) |
| 6 | Medium | The Glass (390×844) | Same on a phone: Become at y≈1316 under the cookie banner. (`before/phone-03-create.jpg`) | **Fixed**: Become at y≈452 (asserted ≤ viewport, ≥44px) |
| 7 | Medium | The Glass, compact | The name field overflowed its column in the compact layout. | **Fixed** (`min-width: 0`, full width) |
| 8 | Medium | Experienced players | No way to skip a tutorial on an alt. | **Fixed**: "I've played before: skip the tutorial" on the Glass, and "Skip tutorial" on the prologue card; per Keeper |
| 9 | Medium | Leak: "while you were away" | `godforge-away` (the away stamp) and the blobs the offline summary reads were raw unscoped localStorage: a second Keeper read character #1's quest/challenge/thrall blobs and shared one away stamp. | **Fixed**: `activeCharacterKey()` scopes them; deleted with the character |
| 10 | Medium | Leak: worn title | `godforge-worn-title` was one device key: a new Keeper wore the first one's title choice. | **Fixed**: per character |
| 11 | Low | Leak: tracked map pin | `eclipse-delve-track` was shared between Keepers. | **Fixed**: per character |
| 12 | Low | Pixel font | "Win a first fight" rendered "Win a Arst Aght": Pixelify Sans's fi/fl ligatures draw the wrong glyph. | **Fixed**: `font-variant-ligatures: no-common-ligatures` on body (site-wide) |
| 13 | Low | Phone goal card | The goal text was clamped to one line next to the buttons ("Drag on th…"). | **Fixed**: the prologue card wraps — the line gets the full width (up to 3 lines), Show me + Skip under it, both 44px; the pet chip moves down under it (e2e/td-pets keeps them apart) |
| 14 | Info | Save scoping | The gateway's per-character namespace held: a new Keeper is level 1, 0 Gold, an empty story, Glim met afresh, no hearth lit, no Sexton chain, its own position and pet; the sound setting is shared; switching back restores #1 whole. (`before/b-03-char2.jpg`) | OK (now pinned by specs) |
| 15 | Info | Class bars at level 1 | Each class's default bar (slots 1–4) fires at level 1 (Warlock/Ashguard: "No foe in reach" with nothing near; the Lanternwright's heal works anywhere). | OK |
| 16 | Medium | First visit, both sizes | The cookie banner still covers the bottom of the lobby and the world until answered (an old owner call: consent UI). | Not fixed (owner call) |
| 17 | Low | Hearth Shrine | The Hearth Shrine stands one tile from the town hearth; a tap meant for the fire can open the Shrine ("Kindle · 80 Gold") instead. Show me always walks to the fire. | Not fixed (placement is td-hearth's) |
| 18 | Low | Show me from far | Show me on the Sexton step from deep in the wilds can take >15 s of walking with only the walk as feedback. | Not fixed |
| 19 | Low | Side view | The side view (`?td=0`) keeps its old four goals (Homestead, Basalt Edge, Rivet Maw, Delve); it is retired, so it was left. | Left |

## The new onboarding flow

1. **Title** → *Sign in with Google* or *Play offline*.
2. **Character list** (empty for a new visitor) → *New Keeper*.
3. **The Glass**: class cards (Warlock / Ashguard / Lanternwright; Thornstrider will slot in as one more card), the
   live figure, the name, *Become this Keeper* — all on one screen, phone included. Optional: *I've played before:
   skip the tutorial*.
4. **The world** (Basalt Seamworks square). Glim lands ("Hello. I'm Glim…"). The quest scroll reads
   **Prologue · The Fresh Mark**, seven ticks, one goal at a time; Glim says a short tip as each step begins, and
   for steps with a place its Seek-style chevrons point at the nearest one. **Show me** walks there and uses it.
   1. **Look around** — "Walk with W A S D (or the arrow keys), or click where to go." / phone: "Drag on the ground
      to walk, or tap where to go." (3 tiles walked)
   2. **Light the hearth** — "walk to the fire and press E. You wake here if you fall." / "tap the fire". Chevrons →
      the hearth; Show me walks there and lights it.
   3. **Win a first fight** — class-aware, naming the bar's key-1 spell:
      Warlock "click a creature: your staff casts at range (or hold J). Press 1 for Drain Life";
      Ashguard "walk up to a wolf and hold J to swing your blade. Press 1 for Shield Bash";
      Lanternwright "click a creature: your lantern burns it (or hold J). Press 1 to cast {key-1 spell}";
      phones "tap a creature … Tap {spell} on the left"; any other class reads a plain line. Chevrons → the nearest
      creature (or its spawn, out in the wilds); Show me walks out and targets it.
   4. **Pick up the Gold** — "walk over the coins … Gold only comes from the hunt." Chevrons → the pile.
   5. **Open the Spellbook** — K / "Tap Spells": "your skills, and where level-up points go."
   6. **Open the Satchel** — I / "Tap the Satchel": "loot lands here. Click an item to wear it."
   7. **Meet the Sexton** — "Sexton Aldous Wren has a "!" over him." Show me walks to him and opens his talk; taking
      *The Sexton's Count* ends the prologue ("Prologue done. The Sexton's Count is your story now"), and the
      scroll shows the chain's row.
5. **Skip tutorial** on the card (or the Glass checkbox) ends it for that Keeper only. A Keeper at level 4+ never sees it.

Per character: what the save shows counts by itself (a hearth lit, Hunting XP, Gold earned, the Sexton's chain
taken); walk/book/bag and the skip are filed in that Keeper's story record (`godforge-story`: `tut`, `skip`;
merged by union, so devices agree). Code: `src/app/play/td/td-prologue.ts` (pure), `td-prologue.i18n.ts` (EN + ES),
`TopDownEngine.setGuide/guideGo` (the chevrons and Show me), `SideScrollerComponent.tickPrologue`.

## Tests

- Karma: `src/app/play/td/td-prologue.spec.ts` (order, out-of-order, skip, veteran, guide targets, class/touch keys,
  every line in EN + ES); `src/app/shared/save/character-onboarding.spec.ts` (a second Keeper reads an empty story,
  an unmet Glim, no worn title, the shared sound; its prologue marks land in its own namespace; worn title and away
  stamp per character; delete takes the device-side keys; story merge of `tut`/`skip`).
- E2E: `e2e/onboarding.spec.ts` — (a) a first visit plays the whole prologue as an Ashguard at 1280×800, (b) a
  Lanternwright second Keeper starts at level 1/0 Gold/step 1 with its own class line and skips, (c) the first is
  intact; phone: the Glass fits, the touch words, a tap walks, "played before" skips for one Keeper only.
  `e2e/play-lobby.spec.ts` now also asserts the new Keeper's prologue and none for the level-7 one.

## Not done

- No firestore.rules change (the story record already syncs per character; `tut`/`skip` are new optional fields).
- The cookie banner (16), the Shrine placement (17), the long Show me walk (18), the side view (19).
- Signed-in cloud flows were not played (no test account); the per-character cloud paths are unchanged.

## P0 (owner, from an Android phone): menus that could not scroll, and New Keeper that made a Keeper on exit

**What blocked the scroll.** `.lobby` is a grid with `place-items: center` and an implicit `auto` row. The wood window
says `max-height: 100%`, but against an auto track that percentage resolves to the window's own content, so the
window grew past the screen, the lobby's `overflow: hidden` clipped it, and the window's body — the only scroller —
never had anything to scroll. On a 360×640 Android the Glass's looks, name and Become sat below the fold with no way
to reach them. Fix: `grid-template-rows: minmax(0, 1fr)` on the lobby and `min-height: 0` on the window and its
body (+ `touch-action: pan-y`, `-webkit-overflow-scrolling: touch`). The class cards also fold on narrow screens
(two to a row, only the chosen one shows its blurb), so Become stays near the top even with four callings.

The guard (`e2e/menus-reach.spec.ts`, Android Chrome emulation: touch, mobile viewport, Android UA; 390×844,
360×640 and 844×390) found and fixed four more:
- **Spellbook** (phones): the window was `overflow: hidden` with a fixed-row tree — the lower tiers and the skill
  card were cut off at 360×640; and the tree's own scroller (`overscroll-behavior: contain`, nothing to scroll)
  swallowed the finger. Now the window is the one scroller on a phone.
- **Map** (sideways): the map took the whole height and the key below it (every place, Sexton Wren) had zero height.
  Now the body scrolls: the map, then its key.
- **Settings sheet**: Escape did not fold it when the focus was elsewhere, and it stayed up over a place opened after
  it (it covered the Hearth Shrine's buttons). Escape folds it; opening a place folds it.
Menus checked (each: a real touch swipe moves it if it scrolls; every scroller taken to its end; its last control on
screen and hit by `elementFromPoint`): the title, the character list, the Glass, the delete confirm, the Spellbook,
the Satchel, the character sheet, the Bestiary, the Map, the settings sheet, the Hearth Shrine, Sexton Wren's talk
window, the Sexton's journal.

**New Keeper made a Keeper on exit.** The roster row was written when *New Keeper* was pressed, before the Glass
opened, and the page then booted into the new id (its services write `<key>@<id>` at once). Only "Back to the list"
cleaned up; a refresh, the browser's back or a closed tab left an "Unnamed" Keeper on the list. Now the row is
written only by **Become this Keeper**; the Glass has an ×, Escape and the phone's back (a history entry) as ways
out, and every one of them deletes the page's `@<id>` save and reloads onto the list as it was. A page that boots
into a Keeper on no list (a Glass left by refresh/back/close, or a deleted Keeper) discards it the same way.
Spec: `e2e/lobby-glass-exit.spec.ts` (×, Back, Escape, browser back, leaving the page, a first Keeper, phone tap
and phone back): the list is unchanged and no `@` keys remain.

Not fixed: an abandoned Glass while signed in can leave its documents under `users/{uid}/characters/{id}` if the
cloud was not attached yet when it was discarded (no roster row points at them, so nothing shows them).
