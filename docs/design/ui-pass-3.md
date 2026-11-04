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

*(The full per-screen audit and Waves B and C follow in the next commit on this branch.)*
