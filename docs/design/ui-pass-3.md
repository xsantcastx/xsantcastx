# UI pass 3: phones first, the satchel, and a Nearby panel (Director's audit, 2026-11-03)

Owner, 2026-11-03: "constantly improve the UIs — horizontal and vertical phone views, inventories, stores, the map
and skill selection; get inspiration from triple-A games." The owner added two notes while this audit was running:
- "The button placements on vertical are so annoying, the inventory, everything — we need experts here."
- "When we open the inventory we should be able to explore nearby corpses … like Tibia."

So **Wave A covers three things on a portrait phone**:
1. The HUD's button placement.
2. The satchel and Vault.
3. A Nearby panel inside the satchel.

Wave A is fully specified first, so a builder can start on it now. The audit of every screen and Waves B and C follow.

Evidence: `output/uiaudit/<screen>-<size>.png` (not in git) at 360×640, 390×844, 844×390 and 1280×800. The shots
were taken in the live default view (top-down Isometric, `?td=1`) from a build of `main` at a4a2435d. The spec that
takes them is `e2e/uiaudit-shots.spec.ts`, kept local, as is the HUD box probe (`output/uiaudit/hud-boxes-*.txt`). The
rules are `ui-system.md`, the window rules are `docs/agents/BRIEF.md` "Menus", and the only tokens are `_cozy.css`.

---

## Wave A — the portrait phone: thumb-zone HUD, satchel and Vault, Nearby

### A.0 What is wrong now (measured at 390×844, iso, a seeded Keeper in the Seamworks square)

Element boxes come from `output/uiaudit/hud-boxes-390x844.txt` and are given as x,y w×h.

1. **The skills sit at mid-left, out of thumb reach and away from the attack.** The skills are at 12,212 to 12,414,
   four 46 px keys. The attack is at the opposite side, 318,664, and only 64×52. Fighting takes two hands crossing
   the screen. Diablo Immortal, Albion and every mobile ARPG put the skills in an arc round a big attack button
   under the right thumb.
2. **The potions sit at mid-left too** (12,430 to 12,632), which is the part of the screen a right-handed player
   reaches least. Belt slot 4 is "Item names on the ground", a setting dressed as a potion.
3. **The menu grid is bottom-right, under the attack** (270,724, four 50 px icons with no labels). The thumb that
   attacks also opens the bag, so the two fight over one corner. The icons carry no labels, so the player has to
   learn them.
4. **The ☰ Menu floats alone** at 338,118, a fourth corner to learn.
5. **The interact prompt is a 292 px bar** at 90,608, inside the play centre's lower edge at 360×640. Its brass
   button is 87×42, under 44.
6. **The chat bar has three sub-44 controls** (Game 51×32, Chat 45×32, Hide 32×32). It sits bottom-centre, where the
   left thumb would rest.
7. **The top-left is a pile-up.** The tutorial card (8,8 210×90) covers the Glim button (60,6). Glim's line
   (72,172 310×61) and the area title (78,285 234×106, "Basalt Seamworks" in about 40 px type) both land in the play
   centre. At 844×390 Glim's line is drawn on top of the tutorial card and hides its text
   (`hud-844x390.png`).
8. **The satchel shows the doll first.** At 390×844 the paper doll takes 330 of the window's 709 px. At 360×640 only
   one row of the grid shows above the footer (`satchel-360x640.png`). The grid's cells are about 35 px (clamped
   24 to 38 px, `item-grid.component.ts --cell`), under 44. In landscape they are **24×24** (14 pocket buttons
   measured at 24 px, 844×390).
9. **The Vault hides the satchel.** At 360×640 the Vault's 10×12 grid fills the window and the satchel is entirely
   below the fold (`vault-360x640.png`). The player cannot see where a thing is going. The tab "General I" is a
   full-width brass bar that reads as the primary button.
10. **Corpses and ground piles take a tap on a tiny sprite.** A corpse opens only within `CORPSE_REACH` (26 art px,
    about 1.6 tiles), by E or a tap on it. Two bodies on one tile, or a body under a tree, are a guess.

### A.1 Principles for the phone HUD (stolen, then made cozy)

| Pattern | From | Ours |
|---|---|---|
| Skill arc round a big attack button under the right thumb | Diablo Immortal, Albion Online, Wild Rift | A wooden attack disc with four skill keys on a quarter arc, plus a 1–4 / 5–8 page chip |
| One context button that becomes the verb in reach (pick up, talk, enter) | Genshin (the F prompt), Diablo Immortal (interact replaces attack) | The attack disc turns into the verb ("Enter", "Talk", "Loot"). The long name goes on the ticker, not a bar over the world |
| Minimap and orbs top-right; chat collapsed into a ticker | OSRS mobile | Kept, made tighter |
| Everything rare behind one "more" button that opens a labelled tile sheet | Genshin's Paimon menu, OSRS mobile's tab stones | A ☰ More tile sheet from the bottom-left: labelled 64 px tiles |
| Consumables under the off thumb | Albion Online (left potion), Diablo Immortal | The belt as a column on the left edge, above the bag row |
| The play centre is sacred | All of them | Nothing persistent in the centre 50%. Toasts, Glim and titles live in the top band |

**Frequency drives place.**
- Every second: move (a tap or drag on the world), attack, skills.
- Every fight: potions.
- Every few minutes: Satchel, Map, interact.
- Rarely: Skill Book, Character, quests, chat, friends and party, settings, bestiary, lore, account.

The rare ones collapse into ☰ More.

### A.2 Zones (portrait, every width from 360 to 430)

All values are CSS px from the safe area: `env(safe-area-inset-*)` is added to every edge offset. **W** and **H** are
the viewport. There are two size classes:
- **Compact**: W < 380 or H < 700. Covers 360×640 and 375×667.
- **Regular**: everything else. Covers 390×844, 393×852 and 412×915.

**The play centre** is the rectangle from x = 0.25W to 0.75W and y = 0.25H to 0.75H:
- 97 to 292 × 211 to 633 at 390×844;
- 90 to 270 × 160 to 480 at 360×640.

No persistent HUD piece may intersect it. A toast may cross it for at most 2.5 s. An open window (satchel, map) is a
modal task and may cover it.

```
 390×844 (regular)                                   360×640 (compact)
 ┌───────────────────────────────────────┐           ┌─────────────────────────────────┐
 │[face][Glim]              (♥)( MINI  ) │ row A     │[face][Glim]         (♥)( MINI ) │
 │[ goal: Step 1/7 · walk ▸ ]  (◆)( MAP ) │ row B     │[ goal chip ▸ ]      (◆)(  MAP)  │
 │ ticker: Glim / loot / chat, 3 lines   │ row C     │ ticker (2 lines)               │
 │                              [party]  │           │                       [party]   │
 │        ·  ·  ·  ·  ·  ·  ·             │           │      play centre               │
 │        ·    play centre   ·            │           │                                 │
 │        ·  (nothing here)  ·            │           │ [St]                    (4)     │
 │        ·  ·  ·  ·  ·  ·  ·             │           │ [Ma]               (3)          │
 │ [St]                          (4)     │           │ [He]          (2)  (⇅)          │
 │ [Ma]                    (3)           │           │ [Sa][Mp][☰]  (1)       (ATTACK) │
 │ [He]              (2)  (⇅)            │           └─────────────────────────────────┘
 │ [Sa][Mp][☰]     (1)         ( ATTACK )│
 └───────────────────────────────────────┘
 He/Ma/St = belt (Health, Mana, Spellstone)  Sa = Satchel  Mp = Map  ☰ = More  (⇅) = skill page 1–4 / 5–8
```

#### Top band (read-only, rarely touched): rows A, B, C

| Piece | Regular | Compact | Notes |
|---|---|---|---|
| Minimap | 96×96, right 8, top 8 | 88×88, right 8, top 8 | Round. The clock stays on its rim. Tap opens the Map |
| Life orb | 44×44, right 8+96+4 = 108, top 8 | 44×44, right 100, top 8 | Value in Inter 13/700. Tap drinks Health, the same as the belt key |
| Mana orb | 44×44, right 108, top 56 | 44×44, right 100, top 56 | Tap drinks Mana |
| Soul / Gold chip | under the minimap, right 8, top 108, 96×20, display only | the same, 88 wide | Replaces the `·0` chip at 228,118. Label plus number ("Soul 0") |
| Row A: face chip | left 8, top 8, 44×44: the face crop and a level badge on its corner | the same | Tap opens Character |
| Row A: Glim | left 56, top 8, 44×44 | the same | Moved out from under the tutorial card |
| Row B: goal chip | left 8, top 56, height 44, width = W − 8 − 160 (minimap, orbs and gaps), so 222 at 390 and 192 at 360 | the same | One line of Inter 13 plus a 4 px progress bar and a ▸ that walks to the goal. **The tutorial step goes here** ("Step 1/7 · Drag to walk"). Tap expands a parchment card downward for at most 8 s or until tapped away; Skip lives inside the expanded card |
| Row C: the ticker | left 8, right 8, top 108 (regular) or 104 (compact); 3 lines (regular) or 2 (compact) of Inter 12/16 on a `--cozy-plate` 70% strip; `pointer-events` only on the strip | | **One stream** for Glim's lines, loot, XP, level-ups, "Enter Edrin Kade's General Store" and chat. Each line fades after 6 s. Tap opens the Chat sheet. It replaces `.glim-say`, the bottom chat bar and the long interact bar |
| Area title | a single line in row C (Pixelify 16, "Basalt Seamworks · Safe ground") for 2.5 s | the same | Replaces the 234×106 centre title on phones. The big title card stays on desktop |
| Party frames | right 8, top 172 (regular) or 156 (compact); up to 4 rows of 132×36 (name, life bar); tap targets the member | the same, at 120 wide | Outside the centre's x range (x > 0.75W) |

#### Right thumb: the combat cluster (bottom-right)

| Piece | Regular | Compact |
|---|---|---|
| **Attack / context disc** | 76×76 round wooden disc (the only round control besides the orbs), right 16, bottom 16. Centre C = (W − 54, H − 54) = (336, 790) | 64×64, right 12, bottom 12. C = (W − 44, H − 44) = (316, 596) |
| Skills 1–4 | 52×52 square keys on an arc of radius 112 from C, at 180°, 150°, 120° and 90° (0° = right, counter-clockwise): 1 at (224,790), 2 at (239,734), 3 at (280,693), 4 at (336,678) (centres). The chord between neighbours is 58, so the gap is 6 | 48×48 on radius 104: 1 at (212,596), 2 at (226,544), 3 at (264,506), 4 at (316,492). Chord 54, gap 6 |
| Page chip ⇅ (keys 5–8) | 44×44 at 135°, radius 64: (291,745). It clears skills 2 and 3 by 4 px and the disc by 4 | 44×44 at 135°, radius 58: (275,555) |
| Cooldowns, keycaps | As now (`--cd` sweep, cap bottom-right in Inter 10/700) | |

- **The ⇅ chip** swaps the four arc keys between 1–4 and 5–8. The keys stay put; only their contents change. A small
  "5–8" badge shows while the second page is up. Long-press on a skill key opens its Skill Book row. It never casts.
- **The context rule.** The disc shows **Attack** (a sword icon) while a hostile is targeted or within sight. When no
  hostile is near and something is armed (a station, NPC, door, corpse or ground pile), it shows that verb's icon
  plus the verb in Pixelify 12 under it: "Enter", "Talk", "Loot", "Take", "Read". The armed thing's full name shows
  as a ticker line and as the existing world label over the thing. Long-press the disc shows a 2-item fan (Attack /
  the verb) for the rare case of both. This replaces `.prompt` and the 87×42 Interact button on phones; desktop keeps
  the prompt.
- A tap on the world still walks or targets. A drag still walks.

#### Left thumb: the belt and the bag row (bottom-left)

| Piece | Regular | Compact |
|---|---|---|
| Bag row: **Satchel**, **Map**, **☰ More** | Three 52×52 icon buttons at left 16, bottom 16; x = 16, 72, 128 (4 px gaps), right edge 180, which clears skill 1's left edge (198) by 18 | 48×48 at left 12, bottom 12; x = 12, 64, 116, right edge 164, clearing skill 1 (188) by 24 |
| Labels | A 12 px Pixelify label under each icon **inside** the 52 px (icon 32 + label), so the button is self-explaining: "Bag", "Map", "More" (ES "Bolsa", "Mapa", "Más") | Icons only at 48. The label shows on press-and-hold |
| Belt: **Health**, **Mana**, **Spellstone** | A column of 52×52 slots at left 16, rising from the bag row with an 8 px gap: Health at bottom 76, Mana at bottom 132, Spellstone at bottom 188 (y = 716, 660, 604 at 390×844). Each slot is ringed in its kind's tint (ui-system §8) and shows its count | 48×48 at left 12: bottom 68, 120, 172 (y = 524, 472, 420) |
| "Item names on the ground" | **Leaves the belt.** It becomes a toggle in ☰ More (and Settings) | |

The belt column's x range (16 to 68) is outside the play centre's x range (from 97, or 90 compact). The top slot's
y (604 regular, 420 compact) may sit beside the centre band.

#### ☰ More: the tile sheet

Tapping More opens a **tile sheet**: a wooden window anchored bottom-left.

- **Placement:** left 8, bottom 8 + 52 + 8, width min(W − 16, 3 × 96 + 2 × 8 + 24). It covers the bag row's upper
  neighbour space and never the combat cluster.
- **Tiles:** 96×72, each a 32 px icon over a 12 px label, in 3 columns.
- **Tile order (fixed):** Skill Book (K), Character (C), Journal / quests, Chat, Friends and party, Bestiary,
  Settings, Loot filter, Item names (toggle), Lore, Account and character select, Feedback.
- **Behaviour:** the sheet scrolls inside itself if taller than 50% H. It closes on a tap outside, on ×, or after
  choosing.
- **Badges:** a brass dot on a tile when it has news (unspent skill points, an unread whisper, a finished quest). The
  More button itself shows the dot when any tile has one.

This replaces the 2×2 `.td-dock` and the lone `.places-toggle` on portrait phones. Landscape keeps its own layout
until Wave B.

#### What leaves the portrait HUD

- The bottom chat bar (`.td-chat--quiet`) goes; it becomes the ticker plus a Chat sheet.
- The `.prompt` bar goes; it becomes the context disc plus a ticker line.
- `.glim-say` as a centre card goes; it becomes ticker lines. Tapping Glim's line opens his talk window as now.
- The centre area card goes on phones only.
- The top-right ☰ goes; it moves into More.

#### Reduced motion, Spanish

- **Reduced motion:** the disc's verb swap is instant. The ticker does not slide; lines appear and fade by opacity
  steps.
- **Spanish:** every label is designed at ES length. "Más" fits. Ticker lines wrap to two lines and never ellipsize a
  verb.

### A.3 The satchel on a portrait phone (Diablo Immortal / D4 / PoE2 mobile)

**The rule.** The bag comes first, the doll second, and every target is at least 44 px. The data model stays one
10-wide grid (`inventory-grid.md`); only the phone draws it differently.

**The window.**
- A full-screen sheet: left 8, right 8, top 8 + safe area, bottom 8.
- It covers the HUD on purpose (a modal task, as in Diablo Immortal).
- Head: 52 px.
  - "Satchel" in Pixelify 16.
  - Tabs **Bag | Worn | Nearby** (A.4): wooden chips at least 76×44. The open tab is brass-rimmed. A tab label
    never ellipsizes ("Bolsa | Equipo | Cerca").
  - Stats sits behind a pixel ? card in the Worn tab's head, not as a third head tab.
  - The × is 44×44 at the right.

**The Bag tab** has five parts, top to bottom.

1. **Belt strip** (height 56). The six belt keys (Q R F 9 0 −) as 48×48 wells with caps, plus the "Belt" label at
   meta 11. A piece dropped here goes on that key.
2. **The grid, drawn as two 5-column pages.**
   - **Pages.** Page 1 is columns 0 to 4 and page 2 is columns 5 to 9 of the same 10-wide grid, so a piece's stored
     cell never changes.
   - **Cell size** = min(64, floor((W − 16 − 24) / 5)): 64 at 360, 390 and 412. Six rows are 384 tall; bought rows
     add rows (up to 11) and the grid area scrolls inside itself.
   - **Page header (44 tall).** ◀ Pocket 1 · Pocket 2 ▶ (`.px-arrow`), each half 44 tall, plus a dot per page with
     a count of pieces on that page.
   - **Changing page.** A horizontal swipe on the grid flips the page when nothing is held. While a piece is held,
     resting it on ◀ or ▶ for 400 ms flips (PoE stash-tab hover).
   - **Above 430 px of grid width** (tablets, landscape) the grid is the full 10 columns at
     min(44, width / 10). Below that it is never 10 columns.
3. **The no-room strip**, as now, only when not empty.
4. **The foot (56).** Gold (coin + Inter 15/700), **Sort** (secondary wood), and slots "14 / 60" with its bar. There
   is no primary on the Bag tab.
5. **The item card as a bottom card** (D4 mobile, Diablo Immortal).
   - **Opening.** Tap a piece: it gets a 2 px `--cozy-glow` ring and the card slides up from the window's foot (no
     slide under reduced motion).
   - **Height.** At most 55% of H. If the selected cell is in the lower half of the visible grid, the card docks to
     the window's top instead, so the piece stays visible.
   - **Contents.** The `.d2tip` content: the name in its rarity colour (Inter 15/800), base, affixes, requirements
     (unmet in berry), Found in, Used for.
   - **Compare (wearables).** A **compare strip** against the worn piece in that slot: one line per stat that
     changes, "+12 Fire damage" in leaf, "−4 Armour" in berry, and a one-line verdict at the top ("Better for
     you: +18 damage per second") in glow. This follows PoE2's and D4's delta lines. Tapping the worn piece's name
     in the strip opens its own card (WoW shift-compare, as a tap).
   - **Actions (foot).** One brass primary, full card width, 52 tall: the most likely verb. **Equip** for gear,
     **Drink** for a potion, **To belt** for a Spellstone, **Sell · 40 Gold** when a shop is open, **Deposit**
     when the Vault is open. Under it, a row of secondary 44 px wood buttons: Drop, Split (stacks), Socket (when
     a table is open), Details. Destroy is never on the card.
   - **Closing.** Tap outside, swipe the card down, or press ×.
6. **Drag.**
   - **Lift.** A long-press of 250 ms lifts the piece, with `navigator.vibrate(8)` where allowed. The tap-to-lift
     path stays for players who cannot long-press: tap, then "Move" on the card, then tap a cell.
   - **The ghost.** The lifted piece's ghost draws at 1.25× (whole pixels: 64 to 80), 56 px above the finger, so
     the finger never hides it.
   - **Targets.** The target cell lights brass when the piece fits, berry when it does not.
   - **Where it can go.** A grid cell, a belt well, the **Worn** tab chip (rest there for 400 ms: it opens the doll
     and the right slot pulses), the **Nearby** tab (drops it on the ground at the Keeper's feet, after a confirm
     for rare and above), or ◀ / ▶ (flips the page).

**The Worn tab.**
- **The doll.** As today, but drawn with 64 px slots round a 2× Keeper (keeper-front with worn gear).
- **An empty slot.** Tapping it **filters the Bag** to what fits there: a strip of 64 px wells under the doll,
  scrolling sideways, listing every piece in the satchel for that slot, best first. This is Diablo Immortal's
  slot-filter. A tap on a well opens the item card, with Equip as its primary.
- **A worn slot.** Tapping it opens its card, with **Unequip** as the primary.
- **Charms.** The charm row keeps its 6 wells at 52 px in a row that scrolls sideways.

**Landscape phone (844×390), satchel.** Wave B follows the same rules: the doll and the card in a left panel
(40% W), the grid on the right at a 44 px cell in two 5-column pages, never 24 px cells.

### A.4 The Nearby tab: corpses and ground within reach (Tibia's open containers, Diablo Immortal's loot list)

The owner: "it's hard to click on the item I want or on nearby bodies." Tibia lets you open many containers at once
in side panels; Diablo Immortal lists nearby loot in a tap list. Ours is a third tab of the satchel, so you can loot
from the bag view without touching a world sprite.

**What it lists.** Every container near the Keeper, nearest first:
- each **corpse** (`mobs.remains`);
- each **ground pile** of the Keeper's own drops (a ground stack);
- each **online ground pile** the Hearth relays (`shared` drops, protocol 6/7).

Piles lying within one tile of each other merge into one entry, as Tibia stacks a tile.

**Distances** are measured from the Keeper's feet in art px (TILE = 16).

| Band | Distance | Row state | A tap on Take |
|---|---|---|---|
| In reach | ≤ 48 (3 tiles) | Full colour, contents shown as a grid | Takes now (the same grant path as the corpse window, one replay-safe press id per take) |
| Near | 48 to 128 (3 to 8 tiles) | Greyed contents, a "Walk · 5 tiles" chip on the row | The Keeper walks to it (`walkTo`, the same path as tapping the corpse), and the take happens on arrival. While walking, the row shows "Walking…" and the satchel stays open (a 60% scrim, so the Keeper's walk is visible) |
| Beyond | > 128 | Not listed | |

In-reach is wider than `CORPSE_REACH` (26) on purpose. Today the corpse window closes at 2.4 × reach (62 px), so a
take from 48 px is no further than what the window already honours. The engine's take check must use the same 48
(`td-truth.spec.ts` is updated to match).

**A row (a container).**
- **Head (52 tall).**
  - The container's icon (the corpse's creature face, a pile's top item) at 32 px.
  - Its name ("Ash Wolf", "Your drop", "Bryn's drop" for an online pile).
  - Its age as a rot bar: the `corpseStage` progression, in berry when it is about to crumble.
  - The distance ("2 tiles").
  - **Take all**, a brass 44 px button. This is the row's one primary; it takes everything that fits.
- **Body.** The contents as a grid of 52 px cells (5 columns at 390, 5 at 360 with a 52 cell). Rarity rings use the
  `--cozy-loot-*` tokens. Gold shows as a coin cell with its amount.
- **Expanding.** Rows start expanded when there are at most 3 containers. With more, only the nearest is expanded and
  the others collapse to their head, with a ▸ to expand.
- **Empty containers.** An empty one drops off the list after 1 s, with a "Looted" fade.

**Taking pieces.**
- **Tap a piece.** The item card opens (A.3). Its primary is **Take** (or **Take and equip** when it is better than
  the worn piece and the compare says so). A stack's card has a quantity stepper (−, the number, +, Max; 44 px each)
  for a partial take; the default is all.
- **Drag a piece** onto the **Bag** tab chip (rest 400 ms: it switches to the Bag at the drop cell), onto a belt
  well (potions), or onto the Worn chip (equip).
- **A full satchel** greys the take buttons. The row shows the existing line, "Too much baggage — your satchel is
  full …" (`play.grid.full`), and nothing leaves the ground.

**Live updates.**
- **The engine** exposes `nearbyContainers(radius = 128)`: a list of `{ id, kind: 'corpse' | 'ground' | 'room',
  name, x, y, dist, stage, items }`, with a cheap signature string. This follows the `corpseSig` pattern: the HUD
  re-renders only when the signature changes.
- **Polling.** The HUD polls at 4 Hz while the tab is open, and never when it is closed.
- **Rot.** A rotting corpse's bar steps with `corpseStage`. When it crumbles, its row fades and goes.
- **Moving.** Walking re-sorts the list. Rows move by a 2-step slide, or instantly under reduced motion.

**The tab's badge.** The Nearby chip shows a count of in-reach containers that still hold something. When the
satchel opens and a fresh corpse (killed in the last 30 s) is in reach, it **opens on Nearby**; otherwise it opens on
Bag.

**Empty state.** One line of Inter 13, "Nothing lying near you. Bodies and dropped things within 8 tiles show here.",
with the pixel ? card behind it.

**Desktop (1280×800).**
- Nearby is a third pane beside the satchel window (Tibia's side containers): 280 px wide, the same rows, opened by
  the Nearby chip or by the **V** key.
- Drag and drop between it and the grid works with the mouse.
- Shift-click a piece takes it.

**Landscape phone.** Nearby is a tab of the left panel (Worn | Stats | Nearby), and the grid stays on the right, so a
drag goes left to right.

### A.5 The Vault on a portrait phone

- **One grid at a time,** with a segmented switch **Vault | Satchel**: two 44 px wood chips under the head, the
  active one brass-rimmed (Diablo Immortal's stash).
- **Both grids** use the A.3 two-page drawing at 64 px.
- **Moving a piece.** Tap a piece: the card's primary is **Deposit** (from the Satchel) or **Take** (from the Vault).
  A drag onto the other segment's chip (rest 400 ms) switches and drops at the first free cell, or at the cell the
  finger then picks.
- **Vault tabs** (General I, II, …) are a sideways row of 44 px wood chips under the switch, with the active one
  brass-rimmed. **They are not a full-width brass bar** (today's bar reads as the primary). A + chip buys a tab and
  shows its price ("+ · 5,000 Gold").
- **Foot.** "Deposit materials" (secondary) and Sort (secondary). There is no primary until a piece is selected.
- **Portrait never shows two stacked grids.**

### A.6 Wave A — Accept when

**HUD (portrait).**
1. At 360×640 and 390×844 (Android emulated, iso and classic graphics, EN and ES), no persistent HUD element's
   bounding box intersects the play centre (0.25W to 0.75W × 0.25H to 0.75H).
   - Assert it over: `.td-skills`, the belt, the bag row, the disc, minimap, orbs, the face chip, Glim, the goal
     chip, the ticker and the party frames.
   - Pass one Keeper in the Seamworks square and one in a hunt with a target.
2. Every control in the HUD is ≥ 44×44. Pieces on the arc are 52 (regular) or 48 (compact). The disc is 76 or 64.
3. No two HUD controls overlap (an elementFromPoint hit test at the centre and four inner corners of each, as in
   `menus-reach.spec.ts`'s sideways test, extended to portrait).
4. Thumb zone: the attack disc, the arc and the ⇅ chip lie inside a 300 px radius of the bottom-right corner. The belt
   and the bag row lie inside a 300 px radius of the bottom-left corner.
5. The disc shows Attack with a hostile near, and the station's verb when standing at Edrin Kade's stall. A tap on it
   opens the General Store. The ticker shows the stall's name.
6. ☰ More opens the tile sheet. Every tile opens its window. The sheet scrolls at 360×640 and its last tile is
   reachable (the `menus-reach` rule).
7. The tutorial step lives in the goal chip. The Glim button is never covered. Glim's line and the area title show
   in the ticker, not in the centre.

**Satchel and Vault (portrait).**

8. At 360×640 the Bag tab shows the whole first page (5 × 6 cells at 64 px), the belt strip and the foot without
   scrolling. At 390×844 likewise.
9. Every pocket, well, tab and button in the satchel and Vault is ≥ 44 px at 360, 390 and 844×390. Today it is 24 px
   in landscape and about 35 px in portrait.
10. The pages are the stored grid. Put a piece at cell 7 on desktop: on the phone it is on page 2, column 2, row 0.
    Drag it to page 1: its `pos` is cell 2. Unit test the page ↔ cell mapping.
11. Tap a wearable: the card opens without hiding the piece. It shows a compare strip against the worn piece, and its
    primary says Equip. Pressing it equips (the verb matrix row for Equip passes).
12. A long-press drag from page 1 to page 2 via the ▶ hover, and from the Bag onto the Worn chip, both work by touch
    (CDP touch events).
13. The Vault at 360×640: switching Vault | Satchel shows each full grid. A deposit by card and by drag-onto-the-chip
    both land. The tab row is wood chips, not a brass bar.

**Nearby.**

14. Kill two creatures (`__tdParty.smite`) and drop a stack (the ground-stacks path). Opening the satchel opens on
    Nearby with 3 rows, nearest first. Take all on one row empties it and the satchel gains its pieces. A partial
    take of a stack (stepper set to 2) leaves the rest on the ground.
15. A corpse 5 tiles away is greyed with "Walk · 5 tiles". Take walks the Keeper there and takes on arrival.
16. Walk away past 8 tiles and its row goes. Let a corpse crumble (time skip) and its row fades and goes.
17. Online: a Hearth room's shared ground pile (td-grid-online fixture) lists as "Bryn's drop", and taking it removes
    it for both pages.
18. A full satchel refuses with the `play.grid.full` line and leaves the pieces on the ground.

**Every Wave.**

19. `e2e/menus-reach.spec.ts` gains these targets at 390×844, 360×640 and 844×390: the satchel's Bag, Worn and Nearby
    tabs, the Vault (both segments), and the More sheet. Each scrolls by a touch swipe and its last control is
    reachable.
20. Before/after screenshots under `docs/handoff/<branch>/`, at 360×640, 390×844, 844×390 and 1280×800, EN and ES.
    The Director reviews them before merge.

**Files the builder will touch.**
- `src/app/play/side-scroller.component.ui.css` (the phone HUD lanes).
- The HUD markup in `side-scroller.component.html` (the dock, the prompt, the chat and the belt).
- `src/app/shared/inventory-grid/item-grid.component.ts` (the pages and the cell size).
- The satchel book in the side-scroller template.
- `td-engine.ts` (`nearbyContainers` and the take path).
- `td-corpse.ts` (the reach constant).
- EN and ES keys in the play i18n table.

The desktop layout (`.stage--bar`, `hud-bar/`) is untouched in Wave A.

---

## The audit, screen by screen

**Format.** Each screen gets four parts:
- **(a)** What is wrong now. Shot paths are `output/uiaudit/<screen>-<size>.png`; "−end" is the same screen scrolled
  to its end.
- **(b)** What to steal, and from whom.
- **(c)** The target layout, portrait and landscape.
- **(d)** Priority: P0 blocks play on a phone, P1 hurts every session, P2 is polish.

**Metrics** come from `output/uiaudit/metrics.json`:
- targets under 44 px on touch;
- text under 11.5 px;
- the last control's reach after scrolling.

### 1. World HUD (`hud-*`, `hud-town-night-*`)

**(a) Phones.** Wave A §A.0 lists them.

**(a) Desktop, 1280×800.**
- The top-right strip reads **Gold 0** while the satchel's purse reads **5,000**, on the same save, in the same frame
  (`hud-1280x800.png` against `satchel-1280x800.png`). This is stale or contradictory data: the strip reads another
  ledger or never refreshes after load.
- **Places** and **Menu** are both brass, so there are two primaries in one corner.
- The tutorial checklist (1000,300 260×390) is the biggest thing on screen and pushes against the minimap.
- Glim's line and the area title both sit in the top-centre over the play view.
- The dock's 8 icons have no labels, only tooltips.
- With a window open, the unit frame draws **"Mana 60"** over **"Soul 0"** (`shop-card-1280x800.png`, top-left).
- 9 px text appears 3 times (keycaps under the 1–8 keys).

**(b) What to steal.**
- **WoW and D2R:** one action bar with the orbs on the sides. We have that; keep it.
- **PoE2:** the quest tracker collapses to a 3-line list with a chevron.
- **Lost Ark:** one primary, the menu, in the top-right corner; everything else is quiet wood.

**(c) Target.**
- **Places** becomes quiet wood; **Menu** stays brass.
- **The tutorial** collapses to 3 lines under the minimap (the current step plus two), 240 wide, with a ▾ to
  expand it.
- **Glim and toasts** move to the ticker lane over the chat box, so the top-centre is left for the area title only
  (2.5 s).
- **The dock** shows its key under each icon ("I", "K") in Inter 10/700. The label stays on hover.
- **Fix the Gold strip**, so one ledger feeds both.
- **The unit frame** hides Mana whenever the orbs are hidden by a window, or lays it out on its own row.
- **Landscape phone (844×390)**, the mirror of Wave A:
  - The combat arc sits bottom-right at the compact sizes.
  - The belt is a row bottom-left (3 × 48), and the bag row sits above it.
  - The ticker runs along the top, between the face chip and the orbs.
  - Chat stays out of the bottom centre (today it is 380 px wide at 180,330, right under the Keeper).
  - The play centre for landscape is 211 to 633 × 98 to 293. The skill column at 8,90 and the belt at 66,195 already
    clear it; the chat (180 to 560 at y 330) and the interact bar (544,154) cross it.

**(d)** P0 on phones (Wave A), P1 on desktop and landscape (Wave B). The Gold strip is P0, a data bug.

### 2. Satchel and inventory grid (`satchel-*`, `satchel-card-*`)

**(a) Portrait.** Wave A §A.0, items 8 and 9.

**(a) Landscape, 844×390.**
- Cells are **24×24** (14 pockets measured).
- The doll takes the left 290 px, and the window is only 63% of the screen.
- The belt row is cut at the window's foot.
- The grid fills column by column, so a fresh satchel is a 3-wide stripe of items against 7 empty columns. That
  reads as broken on every size (`satchel-1280x800.png`).

**(a) Everywhere.**
- The **Worn | Stats** tabs sit in the head as if they ruled the whole window, but they only switch the doll pane.
- The item card on a phone covers the whole grid, including the piece it describes (`satchel-card-360x640.png`).
- The card's compare says "Against an empty Charm II": good. Keep it.

**(b) What to steal.**
- **D4 and PoE2:** the compare card's delta lines, and the verdict line on top.
- **Diablo Immortal:** filtering by slot.
- **PoE:** dragging onto a stash tab to change tabs.
- **Tibia:** loose piles under the bag (Nearby).
- **D2R controller UI:** the card docks on the opposite side to the selected cell.

**(c) Target.**
- **Portrait:** Wave A §A.3.
- **Landscape:** the left panel (38% of W, at least 300) holds the tabs **Worn | Stats | Nearby**. The right panel
  holds the grid in two 5-column pages at a 52 px cell (5 × 52 = 260, 6 rows = 312, which fits 390 tall with a 44
  head and a 44 page bar inside a scrolling body). The card opens in the left panel over the doll, so it never
  covers the grid.
- **Desktop:** the grid fills **row by row**, as Diablo II and Tibia do. Change the arrival order in `inventory-grid`
  from column-major to row-major (a one-line order change; `pinLoose` keeps existing pieces where they are).

**(d)** P0 (Wave A portrait, Wave B landscape).

### 3. Vault (`vault-*`)

**(a)**
- At 360×640 the satchel is entirely below the fold (`vault-360x640.png`), and at 390×844 only 2 rows of it show.
- The single tab "General I" is a full-width **brass** bar, so it reads as the primary.
- Landscape cells are 38 px (14 pockets measured).
- Desktop: the 10×12 Vault and the 10×6 satchel are stacked, so the window is 674 tall and only just fits 800.

**(b) What to steal.**
- **Diablo Immortal:** the Vault | Bag switch.
- **D2R:** the shared stash's tabs as small chips.
- **PoE:** "ctrl-click moves to the other grid", as our tap card's primary.

**(c) Target.**
- **Portrait:** Wave A §A.5.
- **Landscape:** side by side. The Vault on the left and the satchel on the right, each in 5-column pages at 44 px,
  with the tab chips above the Vault.
- **Desktop:** side by side at 38 px (2 × 10 × 38 = 760 plus a gutter, so the window is 820 wide and about 520
  tall), never stacked.

**(d)** P0 (Wave A portrait).

### 4. Shops: General Store, Tackle Shed, Woodcutting Store, Smith, Alchemist (`shop-*`)

The Smith and Alchemist stand in Pyrehold, and `?at=` cannot reach them from the Seamworks. They share the
`shop` panel, so these findings hold for them too.

**(a)**
- **On a portrait phone, no price shows on the shelf.**
  - The price sits as a corner number that the cell clips ("1", "2", "90" at 390), and it reads as a stack count.
    The satchel uses the same corner for counts.
  - In landscape and on desktop the number shows ("7", "13", "25"), but with no coin, so it is still ambiguous.
- **A tap on an offer:**
  - On a phone, it opens a slim strip at the window's foot, "Platform · 13 Gold each" (`shop-card-360x640.png`), and
    the Buy button is below the fold. Its reach check passed only after scrolling: "Buy 5 for 65 Gold".
  - In landscape, nothing visible opens (`shop-card-844x390.png`).
  - On desktop, the hover card is a bare two-line box with no icon, stats or Buy (`shop-card-1280x800.png`).
  - This breaks the station rule: one plain primary action with its cost.
- **Layout:**
  - The shelf is 12 cells; the satchel is 60.
  - The bottom third of the portrait window is empty plate (`shop-general-390x844.png`).
  - Landscape cuts the satchel at its third row.
- The keeper's blurb and "Buys: …" take two lines in two faces (Cormorant plus Pixelify) at the top.

**(b) What to steal.**
- **RuneScape mobile shops:** a big icon grid with the price under every icon, then tap, then a quantity row
  (1 / 5 / 10 / X), then Buy.
- **Albion Online:** a buy panel with a quantity slider and the total in big numbers.
- **Diablo Immortal:** the vendor sell tab filters the bag to what this vendor buys and dims the rest.

**(c) Target.**
- **The shelf**, portrait first:
  - **Shelf | Satchel** is a segmented switch, the same as the Vault.
  - The shelf is a 4-column grid of 76 px tiles: an icon at 2× and the price under it ("🪙 13" in Inter 12/700 glow).
  - A tile the Keeper cannot afford shows its price in berry.
  - A tile has no corner count, except a stock limit ("×3 left").
- **The buy card** (bottom card, A.3 rules):
  - The full item card.
  - A quantity row of 44 px steps: **1 · 5 · 10 · Max**.
  - One brass primary, **"Buy 5 · 65 Gold"**.
  - "You have 3" shows in the meta line.
- **The Satchel segment** dims what this shop will not buy. A tap shows **"Sell · 2 Gold"**; for a stack, **"Sell all
  24 · 48 Gold"**.
- **The keeper's line** moves behind a pixel ? card in the head. The head shows the shop's name and the Gold only.
- **Landscape:** the shelf on the left (tiles at 64) and the satchel pages on the right. The buy card opens over
  the shelf.
- **Desktop:** the shelf and satchel side by side, as now. Hover shows the full `.d2tip` with the price and "Click to
  buy, shift-click 5". Click opens the same buy card as the phone, beside the shelf.

**(d)** P0. A shop that hides its price and Buy button is a broken station. Wave B, first item.

### 5. Other stations: Kael's Anvil (crafting), Enchanting, Gambler, Godforge Market (`crafting-*`, `enchanting-*`, `gambler-*`, `market-*`)

**(a)**
- **Crafting.**
  - The tab "Ready now" is a brass fill, the same colour as **Craft** (two primaries).
  - Requirements read "5,000/2" and "24/2" (have/need, with the bigger number first): it is easy to misread.
  - The result name "Torch" is grey-violet on wood (low contrast).
  - The ± steppers are 40×52 in landscape.
- **Gambler.**
  - "Buy the Slate · 4,000 Gold" is a brass-framed bar **above the window title**, so there are two primaries.
  - The window's own icon sits alone top-left.
  - In portrait the sticky **Open** footer covers "What can come out" (`gambler-360x640.png`).
- **Market.**
  - Ten category tabs in four rows take 220 of 536 px at 360×640.
  - The selected tab is brass.
  - The sticky Buy footer covers the result name ("Iron Hammer", `market-360x640.png`).
- **Enchanting.**
  - The empty state is good ("You have no gear with rune slots yet").
  - The disabled **Add a rune** is a full-width slab that still reads as live.
  - Landscape pockets are 38 px.
- The Rune Forge (`?at=runes`) no longer exists in the top-down town; the shot failed, as expected.

**(b) What to steal.**
- **MapleStory crafting** (already our template in BRIEF): one result card, have/need in green/red.
- **Stardew:** "need 2 · have 24" laid out as ingredient icons with a check.
- **Genshin:** filter chips as one sideways-scrolling row, never stacked rows of tabs.

**(c) Target.**
- **Tabs** are one row of 44 px wood chips that scrolls sideways (snap). The selected tab is cream text on wood-hi
  with a 2 px glow underline, **never brass**. This is a kit rule: `shared/station-ui` tabs.
- **Requirements** are icon chips reading "need 2 · have 24", in leaf when met and berry when short.
- **A sticky footer** (the primary row) reserves its height in the body (`padding-bottom` = footer height), so it
  never covers content.
- **The Slate offer** moves into the Gambler's body as a card with a wood button; Open is the only brass.
- **Disabled primaries** use the ui-system §6 disabled state (wood-1, cream at 40%), with the reason in one line
  under them.

**(d)** P1 (Wave B).

### 6. Trade window (not shot)

The trade window needs a private Hearth room (`e2e/td-trade.spec.ts` runs one with SOCIAL_FAKE_TRADE). This audit
did not start one. The latest committed shots are `docs/handoff/cozy-ui/trade-{window,window-phone}.jpg`.

**(a), by code read and those shots.**
- Two grids (yours and theirs) plus the satchel make three grids on a phone.
- The same 33 to 38 px cell problem applies.
- Accept and Confirm are two separate stages, which is correct, but they look alike.

**(b) What to steal.**
- **RuneScape's** two-screen trade: offer, then a confirm screen listing both sides in words, and a "value" line.
- **Albion:** a lock icon per side once accepted.

**(c) Target.**
- **Portrait:** segments **Your offer | Their offer | Satchel**, each in the A.3 two-page grid. Their side shows a
  ✓ "Accepted" plate when they accept.
- **Confirm:** a full-window parchment list of both sides in words, with the Gold in big numbers, and one brass
  **Confirm trade**. Any change after Accept resets both sides (as now) and flashes the changed cell in berry.
- **Landscape:** your offer on the left and theirs on the right; the satchel opens as a pull-up drawer.

**(d)** P1 (Wave B). A Director review with real shots comes before the build.

### 7. Corpse / loot window (`corpse-*`)

**(a)**
- The window opens top-centre and covers the play centre on every phone. At 844×390 it is drawn over Glim's line
  and the tutorial card.
- Rows are words, not items:
  - "Pyreclast Wand" is in cream, not its rarity colour;
  - there is no icon;
  - "ember residue ×2" is lower case while the other row is title case.
- You cannot see an item's card before taking it.
- Opening it needs a tap on the sprite, or E, within 26 art px.

**(b) What to steal.**
- **Tibia:** a corpse is a small container grid.
- **Diablo Immortal:** a loot list of icons and names in rarity colours.
- **PoE2:** the loot label colours.

**(c) Target.**
- The corpse window becomes the **Nearby** tab (Wave A §A.4).
- On phones a tap on a corpse opens the satchel on Nearby, scrolled to that corpse.
- On desktop a small container window stays, but as an icon grid (52 px cells, rarity rings, hover for the
  `.d2tip`, Take all as its brass), anchored beside the corpse and never over the Keeper.

**(d)** P0 (Wave A).

### 8. World map and minimap (`map-*`, `map-search-*`)

**(a)**
- **The map is a fixed rectangle inside a cream frame**, with about 40% of the frame left as empty cream:
  - top and bottom in portrait (`map-360x640.png`);
  - left and right on desktop and in landscape (`map-1280x800.png`, `map-844x390.png`).
- **Labels collide:**
  - "Ashwater Lake" over "Slagstone Hills";
  - "Cinder Meadows" over "Basalt Seamworks";
  - "The Burning Sea" clipped under the zoom buttons at 360.
  - 10 px text appears 8 times (the level lines).
- **Pins are bare coloured squares** (violet, cream, orange) with no legend on screen. The legend is behind **Key**.
- The **−** zoom button is drawn grey (disabled) at the fit zoom, which reads as broken.
- **Search results drop over the zoom buttons** (`map-search-360x640.png`). Three rows read "A Chalk-Marked Stone"
  with nothing to tell them apart.
- The floor switch is a dropdown labelled "Ember Isle · Surface · You are here". Floors are a pillar of the game
  (vision.md), so they deserve their own control.

**(b) What to steal.**
- **Genshin's map:**
  - pins with icons by category;
  - a **filter rail** down one edge;
  - tap a pin for a card ("Teleport", "Track").
- **Zelda TotK:**
  - layers (Sky / Surface / Depths) as a vertical layer switch on the right edge;
  - a stamp/pin you can place.
- **Tibia:** the floor up/down arrows beside the map.
- **Albion:** zone tier colours on the map.

**(c) Target.**
- **The map fills its frame** (cover, not contain), drawn at a whole-pixel zoom (1×, 2×, 3× of the map art; never
  fractional). It pans by drag and zooms by pinch or by the ± buttons.
- **The floor rail** sits on the right edge: a column of 44 px chips (+3 … 0 … −6) for the floors that exist here,
  with the current floor brass-rimmed. It replaces the dropdown's floor part. The continent stays in the head.
- **The filter rail** sits on the left edge: 44 px icon chips for Towns, Shops, Stations, Quest givers, Dungeons,
  Harbours and Waystones. Each toggles its pins. Pins become 20 px pixel icons per category (an anvil, a coin, an
  anchor, a "!" for quests) in a 2 px dark outline.
- **Labels** use collision culling: draw region labels first, then town labels, and skip any label whose box
  overlaps one already drawn. Level lines are Inter 11 at least, and show only at zoom ≥ 2.
- **Tap a pin:** a parchment card shows the name, the zone band ("Lv 3–5", in berry when dangerous), a distance,
  and one brass **Walk here** (or **Sail · 40 Gold** at a harbour).
- **Search results** are a list sheet *under* the search field that pushes the map down, never over the controls.
  Each row has a category icon, the name, the area and a distance ("A Chalk-Marked Stone · Slagstone Hills · 120 m").
- **The minimap** stays round. Tapping it opens the map; long-press shows only the filter rail's quest pins (Genshin's
  quick-track).
- **Portrait:** the head, then the search, then the map (all remaining height), with the rails inside the map's
  edges.
- **Landscape:** the map at full height. The search and the pin card sit in a right panel of 260 px.

**(d)** P1 (Wave B). The owner named the map.

### 9. Skill Book, skill selection, belt and hotkeys (`skillbook-*`, `skillbook-keys-*`)

**(a)**
- **Tabs at 360×640.** The tab row overflows: the **Keys** tab is cut to "Ke" and the help ? floats on its own. No
  scroll affordance shows that more tabs exist.
- **"Unused points"** loses its label in portrait: a bare "0" box sits by Accept (`skillbook-360x640.png`).
  Landscape and desktop say "Unused points 0".
- **The Spellstone button** on Hellfire Nova is an unlabeled icon.
- **The Keys tab** is a long list of 4×2 number grids, one per learnt skill. Two learnt skills already scroll a
  360×640 screen. It does not show the bar the keys are on, so the mapping from "3" to "the third key on my arc" is
  left to the player.
- **Locked skills** ("Cinder Rain, opens at level 6") sit on the right page with their icon nearly invisible
  (wood-on-parchment). A one-line "what it does" would sell the level.
- **Landscape:** the two-page spread shows **one** skill row per page above the fold (`skillbook-844x390.png`).

**(b) What to steal.**
- **WoW's talent preview:** hover or tap a node and the tooltip shows this rank and the next, side by side, plus the
  cost.
- **Diablo Immortal:** skill assignment by **dragging a skill onto a picture of the combat arc**, with an
  "Equipped" badge on the skill.
- **PoE2:** the "allocate on confirm" pending state, which we have; keep it.
- **D4:** the skill tree's "points to spend" pill always lives next to the primary.

**(c) Target.**
- **The tab row** scrolls sideways with a fade edge and a ▸ hint. The tabs are tree icons at 44. **Keys** becomes a
  right-aligned chip that is always visible, outside the scrolling tabs, beside the ?.
- **The foot:** "Unused points **3**" (label plus number, always), Accept (brass when pending), and Reset (quiet).
- **The Keys tab** becomes Diablo Immortal's model:
  - The top half is a **pixel picture of the player's own combat layout**: the phone arc from Wave A, or the desktop
    bar's 8 keys. The belt sits beside it.
  - The bottom half is a scrolling grid of learnt skills at 64 px.
  - Drag a skill onto a key, or tap a skill and then a key. A key holding a skill shows its icon. A skill on a key
    shows an "on 3" badge.
  - There is no grid of 8 number buttons per skill.
- **The Spellstone button** gets the label "Stone" under its icon, and the ? card explains it.
- **Locked rows** show the icon at 60% and one line of what the skill does.
- **Landscape:** one page at a time, using the full width (two rows of skills visible), with page arrows.

**(d)** P1 (Wave B). The Keys picture ships with Wave A's arc, because the arc is what it draws.

### 10. Character sheet (`character-*`)

**(a)**
- **Tab labels break mid-word** at 360×640: "Attribute / s" and "Milestone / s". The ES labels will be worse.
- **The disabled "+"** on every attribute row looks like an empty slot.
- **Landscape** is portrait shrunk: one attribute row visible above the fold, with tabs stretched 200 px wide each
  (`character-844x390.png`).
- **Gold** shows here as "206 Gold" while the purse holds 5,000. If this counts something else (Gold earned, or a milestone's reward), it must say so ("206 Gold earned"). Otherwise it is a third Gold number; see §1.

**(b) What to steal.**
- **D2R's character screen:** attributes in a two-column table with the "+" only when points exist.
- **PoE2:** a stat sheet with groups and a search.

**(c) Target.**
- **Tabs** are icon plus short label (Stats, Skills, Goals, Lore) at Spanish length, and never break a word. They
  shrink to icon-only below 360.
- **The "+"** shows only when points are unspent (D2R).
- **Landscape:** two columns, with the Keeper portrait and XP on the left and the tab body on the right.
- **Reconcile the Gold figure** with the purse.

**(d)** P1 (Wave B).

### 11. Settings, controls, loot filter (`settings-*`, `controls-*`, `loot-filter-*`)

**(a)**
- **Settings** are solid: segmented choices and sliders.
- **The title** "The sound of the world" heads a sheet that also holds Graphics and Night darkness, so it is
  mislabelled.
- **A checkbox** is 22×44 (22×22 in landscape).
- **Sliders** have 44 px rows, but the thumb is about 16 px.

**(b) What to steal.** **Genshin's settings:** a left rail of categories (Sound, Graphics, Controls, Loot, Account)
and the options on the right.

**(c) Target.**
- **The title** becomes "Settings".
- **Category tabs** (Sound, Graphics, Controls, Loot) sit as a sideways chip row in portrait and as a left rail in
  landscape and on desktop. Today Controls and Loot are separate Game Menu items; they fold in here, so the Game
  Menu shrinks.
- **Checkboxes** are 44 px toggles. **Slider thumbs** are 24 px with a 44 px hit area.

**(d)** P2 (Wave C).

### 12. Game Menu (`game-menu-*`)

**(a)**
- **A tall list of text buttons** with no icons, at 72% to 80% of a phone. The list scrolls at 360×640.
- **"Map" appears here as well as** in the dock and the top-right Places, so the Map has three ways in.
- **"Resume" is a whole row.**

**(b) What to steal.** **Genshin's Paimon menu:** an icon grid with labels and badges.

**(c) Target.** On phones the Game Menu *is* the Wave A ☰ More sheet. On desktop, the same tile grid sits in a
window: Map is removed (the dock has it) and Resume is removed (the × and Esc do it).

**(d)** P1 (folded into Wave A on phones).

### 13. Chat and party (`chat-*`, `friends-*`)

**(a)**
- **Chat tabs** are Game 51×32, Chat 45×32 and Hide 32×32: all three under 44.
- **The open chat** sits bottom-centre over the Keeper's feet in landscape.
- **Solo-mode copy** ("Solo — join the hearth to meet other Keepers") is clear.
- **Party frames** need a Hearth room and were not shot. By code they are `[data-party-frames]` at the left.

**(b) What to steal.**
- **OSRS mobile:** chat collapsed to a ticker, and a full chat as a sheet.
- **WoW:** party frames as a compact left stack, with debuff pips.

**(c) Target.**
- **Phones:** the Wave A ticker plus a Chat sheet:
  - bottom 60% of the screen;
  - tabs Game / Local / Party / Whisper at 44;
  - a 16 px input (iOS zoom rule) with Send as its brass.
- **Party frames:** on the right under the minimap on phones (A.2); on desktop at the left under the unit frame.
- **Desktop chat** keeps its box; its tabs become 44 tall.

**(d)** P1 (Wave A gives the ticker; the sheet comes in Wave B).

### 14. Onboarding: title, the Glass (New Keeper), the tutorial (`lobby-title-*`, `new-keeper-*`)

**(a)**
- **The title screen** is good: two clear choices, the eclipse art. Star particles drift over the copy ("hearth",
  "Play offline"); they should stay behind the text.
- **The Glass is the worst screen in the audit at 844×390** (`new-keeper-844x390.png`):
  - The class card is squeezed to about 70 px wide, so its description runs one word per line.
  - Ashguard, Lanternwright and Thornstrider are 33×48 chips.
  - The name field is off the fold.
  - "More callings will co…" is clipped.
- **The Glass in portrait:**
  - The action row (Surprise me / Become this Keeper) sits in the middle of the class list.
  - The name field is not visible without scrolling.
- **The Glass on desktop:**
  - The class column takes half the window and the other half is empty but for one line.
  - The **Figure / Build** steppers are cut by the checkbox band.
- **Text and buttons everywhere:**
  - 8 px text appears 10 times; 9 px twice.
  - The checkbox is 22 px wide.
  - The primary **Become this Keeper** is pale cream instead of brass.
  - **Surprise me** is a navy fill that matches no `_cozy.css` wood token.
- **The tutorial** (§1, Wave A) covers the Glim button and the top-left of the world.

**(b) What to steal.**
- **Diablo Immortal and Lost Ark** character creation: the figure large on one side; on the other, class chips as a
  row of portraits, then the selected class's card, then the name, then one big primary at the bottom.
- **Stardew:** name and look on one card.

**(c) Target.**
- **Portrait:**
  - the campfire figure (the top 30%);
  - a row of 4 class portraits at 64 px;
  - the class card (name, one line of role, 3 tags such as "Range · Fire · Curses");
  - the name field, 16 px;
  - Figure and Build as two 44 px steppers side by side;
  - a sticky foot with **Become this Keeper** in brass (52 tall) and Surprise me as a quiet link above it.
  - The skip-tutorial checkbox becomes a 44 px toggle row.
- **Landscape:** the figure on the left 45%, and the right panel scrolls with the same order.
- **Desktop:** the same as landscape, with a 4 × 1 portrait row.
- **All text** is at least 11 px.

**(d)** P0 for landscape. It is the first screen a sideways phone player sees. Wave B, first item.

### 15. Bestiary (`bestiary-*`)

**(a)**
- Good: silhouettes, bands and "Not yet met".
- The intro paragraph is four lines before the first card.
- 11 px text appears 11 times (the meta lines; allowed, but dense).

**(c) Target.** The intro moves behind the ?. The cards use a 2-column grid of 160 px at 360 (as now).

**(d)** P2 (Wave C).

---

## Top problems, ranked

1. **The portrait HUD has no thumb logic.**
   - Skills and potions sit mid-left; the attack is bottom-right, small.
   - The menus share the attack's corner, unlabeled.
   - Glim, the area title and the tutorial sit over the play centre and over each other.
   - (Wave A)
2. **The satchel on a phone is doll-first with sub-44 cells:** about 35 px in portrait, 24 px in landscape. At
   360×640 only one grid row shows. (Wave A, then B)
3. **Looting means tapping a tiny sprite within 1.6 tiles.** There is no list of what lies near.
   - The corpse window is a word list without icons or rarity colours.
   - It covers the centre.
   - (Wave A, Nearby)
4. **The Vault hides the satchel below the fold on a phone.** Its tab reads as the primary. (Wave A)
5. **Shops hide the price and the Buy button.** No prices show on the shelf in portrait. A tap gives a slim strip
   whose Buy is off-screen; nothing opens in landscape; the desktop hover card is bare. (Wave B)
6. **The Glass (New Keeper) breaks in landscape.**
   - The class text runs one word per line, and the name is off the fold.
   - The primary is not brass.
   - 8 px text.
   - (Wave B)
7. **Gold disagrees across screens:** 0 in the top strip, 5,000 in the satchel, 206 on the character sheet, for one
   save. Either it is stale data or the labels are missing. (Wave A, as a data and label fix)
8. **The map wastes 40% of its frame**, its labels collide, its pins have no categories, and search covers the zoom
   buttons. Floors hide in a dropdown. (Wave B)
9. **Station tabs use the primary's brass**, and sticky footers cover content: Crafting, Market and Gambler. Market's
   10 tabs eat 40% of a phone. (Wave B)
10. **The Skill Book's Keys tab is a wall of 8-button grids** with no picture of the bar. Its tab row clips "Keys" at
    360. "Unused points" loses its label in portrait. (Wave B)

---

## Waves

Every wave ends with the same e2e gate:
- `menus-reach` at 360×640, 390×844 and 844×390: every overlay scrolls by a touch swipe, and its last control passes
  an elementFromPoint hit.
- A no-overlap hit test of every HUD and window control.
- A ≥ 44 px sweep of every visible control on touch.
- A play-centre check for the HUD.
- Before/after shots at four sizes, EN and ES, under `docs/handoff/<branch>/`, then a Director review.

### Wave A — the portrait phone (one builder, L)

Spec: §A.0 to §A.6 above.
- the thumb-zone HUD (arc, context disc, belt column, bag row, ☰ More, top band and ticker);
- the satchel as two 64 px pages with the bottom card and compare;
- the Nearby tab;
- the Vault switch;
- the Gold-strip data fix.

**Accept when:** §A.6 items 1 to 20 pass, and the three Gold figures agree on one seeded save at every size.

**New e2e.**
- `e2e/play-phone-hud.spec.ts`: the zones, the centre, 44 px, overlap and the context disc.
- `e2e/play-nearby.spec.ts`: two corpses and a stack, Take all, partial take, walk-to, rot, full satchel, and an
  online pile (hearth fixture).
- `menus-reach` targets: the More sheet, the satchel's three tabs and the Vault's two segments.
- A unit spec for the page ↔ cell mapping.

### Wave B — landscape phones, shops, map, Skill Book keys, the Glass, station kit (one to two builders, L)

1. **Shops (§4):**
   - the price under every shelf tile;
   - Shelf | Satchel in portrait;
   - the buy card with 1 / 5 / 10 / Max and "Buy N · X Gold";
   - the sell-filter dimming;
   - the desktop click card.
2. **The Glass (§14):** portrait order, the landscape split, brass primary, no text under 11 px, the 44 px toggle.
3. **Landscape layouts:**
   - the HUD mirror (§1c);
   - satchel and Vault side by side at 44 to 52 px pages (§2c, §3c);
   - character in two columns (§10c);
   - Skill Book one page wide (§9c).
4. **Map (§8):** fill the frame at whole-pixel zoom, the floor rail, the filter rail with category pins, label
   culling, the pin card with Walk here, search that pushes rather than covers.
5. **Skill Book:** the always-visible Keys chip, "Unused points N", the Keys picture of the real arc or bar with
   drag-to-key.
6. **Station kit (`shared/station-ui`):** non-brass tabs, a sideways tab row, sticky footers reserving their height,
   have/need chips. This fixes Crafting, Market, Gambler and Enchanting together.
7. **The chat sheet** and 44 px chat tabs. Trade's segmented layout (§6) after a shot review.

**Accept when:**
- At 844×390 and 932×430, no window control is under 44 px. Today satchel, Vault, shop and enchanting pockets are
  24 to 38 px, and the crafting steppers 40 px.
- Every shop shelf tile shows its price.
- A tap on an offer opens a card whose Buy is in view at scrollTop 0 at all four sizes (the `noScroll` rule in
  `play-menus-orientation.spec.ts` for every `shop-*` station).
- The Glass at 844×390 shows the class card at ≥ 300 px wide and the name field above the fold.
- The map's empty frame area is under 5% at every size. No two map labels intersect (a DOM-box or canvas-rect check
  at fit zoom).
- The floor rail switches floors in the Ember Mine.
- No station tab uses `--cozy-brass` as its fill (a computed-style check over `.place [role=tab]`).
- Every sticky footer leaves the body's last element fully visible at scrollTop max.

**e2e:**
- extend `play-menus-orientation` (`noScroll` for shops, the Glass);
- extend `menus-reach` (the map with a search open, the Keys tab, the chat sheet);
- add `e2e/play-map-labels.spec.ts`.

### Wave C — polish and consistency (one builder, M)

1. **Settings** becomes one sheet with category tabs (it absorbs Controls and Loot); title "Settings"; 44 px
   toggles; 24 px slider thumbs.
2. **The Game Menu on desktop** becomes the tile grid, without Map or Resume.
3. **Grid arrival order** is row-major on every size (§2c), plus the empty grid's look: no light plate behind
   occupied columns only.
4. **The Bestiary intro** moves behind the ?. Locked Skill Book rows get one line of what they do.
5. **Lobby particles** draw behind the text.
6. **The unit frame's Mana/Soul overlap** at 1280×800 with a window open.
7. **A type sweep:** no text under 11 px in any window. Today the map has 10 px ×8 and the Glass 8 px ×10; 9 px
   appears in the satchel's keycaps and the shop's counts. Keycaps go to 11.
8. **EN/ES length pass** on every new label from Waves A and B, at 360×640.

**Accept when:**
- The text sweep finds no text under 11 px in any `.place`, `.win-host` or `#satchel-book` at four sizes.
- Settings has one entry in the Game Menu.
- On a fresh satchel the first 10 pickups fill the top row, left to right.
- The `hud-1280x800` shot with a window open shows no overlapping text in the unit frame.

---

## How to re-take the shots

`e2e/uiaudit-shots.spec.ts` is kept out of git; it lives in the ui3 worktree.

```
PW_PORT=<free port> UIA_GFX=iso npx playwright test e2e/uiaudit-shots.spec.ts --project=chromium
```

- `UIA_ONLY=hud,satchel` narrows the run to the listed screens.
- The run writes `output/uiaudit/<screen>-<size>.png` and `metrics.json`: per screen, the targets under 44 px, the
  text under 11.5 px, the scrollers, the page overflow, and the last control's reach.
