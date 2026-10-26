# The Skill Book: one skill a row, its marks beneath (UI design)

Written by the Dungeon Master on 2026-10-26, on branch `dm-design`.

**The owner's ask.** "Skill tree rework, like the image, as a book. One skill per row with its passives beneath. Extra
effects come from the modifier nodes. Next to each skill sits 'create Spellstone'. A Spellstone records the passive
abilities taken."

**The reference** is `docs/design/refs/skill-book-ref.jpg`, a Drakensang book. It has:
- tabs across the top;
- a ribbon title ("Battle mastery") on the left page;
- three rows a page, each an icon, a name and "Active skill" over six small diamond nodes;
- "Unused points", Accept and Cancel at the bottom right.

**The look** follows `docs/design/refs/cozy/` and `docs/handoff/cozy-ui.md`:
- `_cozy.css` tokens only (wood ramp, parchment and ink, brass, lantern glow);
- Pixelify Sans lettering (`--font-pixel`), Cormorant for lore lines.

**What it replaces.**
- The Spellbook (K) tree board in `play/spellbook/spellbook-page.component.*`.
- The hidden stone pouch (`shared/spellstones`).

The skill content and numbers are in `skills-100.md`. Its §0.2 holds the rules this UI draws: ranks, nodes, the star
choice and points.

---

## 1. Anatomy (desktop, ≥ 960 px wide)

```
 [Ember][Bone][Shadow][Common]                          [Stones][Keys][X]
 ┌───────────────────────────────┬───────────────────────────────┐
 │  ══ EMBER ══  "fire kept inside, and spent"│                   │
 │                               │                               │
 │ [ico] Ember Bolt   r 7/20  [◆+]│ [ico] Flame Wall  r 0/20 [◆+]│
 │       Basic attack   L1       │       Active skill   L12      │
 │  ◇─◇─◇   ◇─◇─◇                │  ◇─◇─◇   ◇─◇─◇              │
 │ ───────────────────────────── │ ─────────────────────────────│
 │ [ico] Hellfire Nova r 3/20 [◆+]│ [ico] Meteor     r 0/20 [◆+] │
 │  ...                          │  ...                          │
 │ (4 rows a page)               │        Unused points [ 3 ]    │
 │                               │        [ Accept ] [ Cancel ]  │
 └───────────────────────────────┴───────────────────────────────┘
```

### The frame
An open book drawn as a pixel 9-slice:
- covers: `--cozy-wood-1`, with brass corner studs;
- pages: parchment, with an `--ink` hairline margin;
- a dark spine shadow down the middle;
- a cloth bookmark ribbon hanging from the top edge, in the calling's colour: Warlock ember-violet, Ashguard Watch-red,
  Lanternwright cream-brass, Thornstrider moss-green.

At 1280×800 the window is ~1040×640 and hugs its content (the cozy-ui rule).

### Tabs (top, left)
- One tab per tree, in book order, then **Common**.
- Each tab is a 44×44 wooden chip holding the tree's icon, with the tree's name on hover.
- The open tab is raised, brass-rimmed, and joined to the page.
- A tab with points spent shows a small brass number.

### Tabs (top, right)
- **Stones** / *Piedras*: the Spellstone page (§4).
- **Keys** / *Teclas*: the bar (keys 1–4, the aura, the stone slot). Today's key picker moves here.
- **X**: close.

Escape closes the book and asks first if changes are pending (§3).

### The spread
- **A tree is one spread**, up to 8 rows: four on the left page, four on the right, in unlock order (skills-100.md
  lists them in order).
- The Warlock's Shadow tree has 9 rows, so the page's foot carries a pixel ◀ ▶ page-turn. Page 2 holds the 9th row and
  the tree's lore note.
- The left page opens with a **ribbon title**: the tree's name in Pixelify, and a one-line tagline in Cormorant italics.

| Calling | Tree | EN tagline | ES tagline |
|---|---|---|---|
| Warlock | Ember | *fire kept inside, and spent* | *fuego guardado dentro, y gastado* |
| Warlock | Bone | *the dead want one more watch* | *los muertos quieren una guardia mas* |
| Warlock | Shadow | *what the cold remembers* | *lo que recuerda el frio* |
| Ashguard | Brand | *the blade remembers the forge* | *la hoja recuerda la forja* |
| Ashguard | Oath | *struck by five, kept by one* | *forjado por cinco, guardado por uno* |
| Ashguard | Ash | *what is left still stands* | *lo que queda sigue en pie* |
| Lanternwright | Lamp | *light is a weapon too* | *la luz tambien es un arma* |
| Lanternwright | Hearth | *bring them home* | *traelos a casa* |
| Lanternwright | Moth | *the small lights know the way* | *las luces pequenas saben el camino* |
| Thornstrider | Thorn | *one arrow, well meant* | *una flecha, bien pensada* |
| Thornstrider | Wild | *the wild lets you through* | *lo salvaje te deja pasar* |
| Thornstrider | Briar & Sky | *ask the sky; sometimes it answers* | *pregunta al cielo; a veces responde* |
| (all) | Common | *what every Keeper learns* | *lo que aprende todo Guardian* |

### A row (the unit)
The row is 470×120 px on desktop.

**Line 1**
- the skill's 40×40 pixel icon in a brass bezel (a lit bezel once rank ≥ 1, dull and desaturated at rank 0);
- the name;
- the kind in small ink beneath it: *Active skill / Aura / Basic attack / Utility*;
- right-aligned: **rank `r 7/20`**, a **[+] rank** chip (44×44, brass when buyable), and the **Spellstone button**.

**Line 2: six node diamonds.** Two groups of three, joined by short ink strokes, with a 16 px gap between groups.
- A small "Edge" / *Filo* label sits over the first group, and "Craft" / *Oficio* over the second.
- Diamonds are 36×36 drawn, with a 44×44 hit area.
- Each diamond holds its own 16×16 glyph. The glyph vocabulary is a node-verb set:

| Glyph | Node verb (skills-100.md §0.2) |
|---|---|
| upward arrows | `pct` damage or heal |
| ring | radius |
| hourglass | duration |
| downward chevron | cooldown |
| droplet | mana |
| the status's own pip | `rider` |
| forked line | `shape` |
| spark | `proc` |
| two heads | `party` |

**Node states**, from the cozy tokens:

| State | Look |
|---|---|
| locked (rank too low) | parchment-dark diamond, ink outline at 40% |
| available | brass outline, soft lantern glow pulsing 2 s (static under reduced motion) |
| taken | filled brass, glyph in cream, the stroke to the next node turns brass |
| pending (taken this session, not yet Accepted) | filled brass with a dashed cream rim |
| blocked by the star rule | the other star shows a small ink cross |

**The stars.** A3 and B3 are drawn as 8-point **star** diamonds, so the choice is visible before the hover.

**Unlock level.** At rank 0, if the row is below the Keeper's level, its name is ink-grey and the line reads "Opens at
level 42" / "Se abre en el nivel 42". The [+] chip and nodes stay hidden. Rows never vanish: the book shows the whole
road to 100.

**Row divider.** A pixel ink rule with a small flourish in the middle, as in the reference.

### The bottom right (the right page's foot)
- **Unused points** / *Puntos sin usar*: a sunk wooden well with the number. It counts down live as pending choices
  spend points.
- **Accept** / *Aceptar*: brass, enabled only when changes are pending.
- **Cancel** / *Cancelar*: wood. It undoes every pending choice.
- When nothing is pending, the foot shows **Reset book** / *Reiniciar libro* as an ink text link, with one confirm. It is
  free for now (skills-100.md §0.2).

---

## 2. Hover cards (D2 style, small)

Hovering on desktop, or a long-press on a phone (§5), opens a parchment card, 320 px wide at most, in the shipped
D2-card manner.

**A row's icon card**
- name, kind, element pip;
- the Cant words in italics (*vael orum*);
- mana · cooldown, with cast speed already in;
- "Now (rank 7):" the line with live numbers, then "Next rank:" what changes, as the shipped card does;
- synergies, live or dim;
- the phase line ("Eclipse now: −15% power");
- "Gear adds +1 rank" when it does.

**A node's card**
- its name (*Twin Nova*);
- its branch and step ("Edge · 3, a star");
- one line of what it does, with the number;
- its need: "Needs rank 10" / "Necesita rango 10";
- for a star: "Choose one star a row. Taking this one closes Cinder Ward." / "Elige una estrella por fila. Tomar esta
  cierra Guarda de ceniza.";
- a folded passive says so: "Was the passive Ember Mastery." / "Era la pasiva Maestria de brasa."

**The Spellstone button's card**: the recipe (§4.2), Soul held, Blanks held.

Cards never cover the row being read. They open to the side with more room, and on desktop stay open while the pointer
is inside them.

---

## 3. Choosing (pending, Accept, Cancel)

The book is **staged**, as in the reference. Every [+] rank and node tap is pending until **Accept**.
- **Tap [+]**: rank +1, pending. Tap the rank number: a small ◀ ▶ stepper for −1 / +1 over pending ranks only.
- **Tap an available node**: pending taken.
- **Tap a pending node**: un-take it.
- **Taking a star while the other star is taken** (already accepted) asks: "Swap Cinder Ward for Twin Nova? The point
  moves." / "Cambiar Guarda de ceniza por Nova doble? El punto se mueve." This is free while respec is free.
- **Taking a rank in a row** that needs "one rank in any earlier row" is refused with the reason in the row's foot:
  "Learn a skill above it first." / "Aprende antes una habilidad de arriba."
- **Accept** writes the tree once (one save write, §6). There is a soft brass flash along every row that changed and a
  `levelup`-family chime, quiet.
- **Cancel** or close-with-discard returns to the saved tree.
- **A level-up while the book is open** adds its point to Unused live, and keeps the pending choices.

**Starter kits** (skills-100.md §6) stay free rank 1. Nodes are never free.

---

## 4. Spellstones: real satchel items

### 4.1 What changes
Today a Spellstone lives in a hidden **pouch**, keyed `skill@rank` (`spellstones.model.ts`). It becomes a **satchel
item**:
- **Keyed** by `skill@rank#nodes`, where `nodes` is the 6-bit mask of the row's taken nodes **at the moment it was cut**
  (bits A1 A2 A3 B1 B2 B3).
- **One unit = one charge.** A stack's quantity is its charges. The recipe still yields its charges (2–10,
  `stoneRecipe`), as that many units.
- **Stacking.** Identical keys stack, to 100 a stack. Different nodes, or a different rank, make a different stack.
  This is the owner's "stacking by identical recipe".
- **Tradeable.** It goes through the trade window, the room's ground, and the player market if it is ever opened (the
  market flags are the owner's; not touched).
- **Droppable and sellable.** The vendor buys at half a Blank's price a charge, so cutting stones is never a Gold
  machine.
- **Death.** In the soft world a stone is never lost (nothing is). In Tibia scope (Realms, Nightmare, Hell, PvP bags) a
  stone is a satchel stack like any other.
- **Level to use.** `max(unlock level, unlock level + rank − 1)`: the lowest level at which anyone could hold that rank.
  So a level-1 alt cannot fire a rank-20 Meteor. Any calling may use any stone, as today.
- **Casting.** The belt's Spellstone slot (F) casts at the stone's rank **with its recorded nodes**, whatever the user's
  own book holds. There is no mana and no cooldown of its own, and the 1 s stone exhaust remains (2 s in PvP:
  world-acts.md §6.4).

### 4.2 The "create Spellstone" button on each row
Each row's line 1 ends with a 44×44 **Spellstone button**: a small basalt-grey stone glyph with a "+".
- **Shown on** active rows only. Auras, basic attacks, utilities and the Common page's Waygate do not take stones. Light
  and Seek do, as shipped.
- **Enabled** when the row has rank ≥ 1, the satchel holds a Basalt Blank, and Soul ≥ the recipe's.
- **Tap**: a parchment confirm card, one plain action:

  > **Cut a Spellstone: Hellfire Nova** (rank 7 · Hotter Ring · Scorched Earth · Twin Nova)
  > 1 Basalt Blank + 5 Soul → 4 charges
  > [ Cut it ] / [ Not now ]
  >
  > ES: **Tallar una Piedra de hechizo: Nova infernal** (rango 7 · …) / 1 Piedra de basalto + 5 Alma → 4 cargas /
  > [ Tallar ] / [ Ahora no ]

- **Disabled**: the reason in the card: "No Basalt Blank. Edrin Kade sells them, and creatures drop them." / "No tienes
  Piedra de basalto. Edrin Kade las vende, y las criaturas las sueltan." Or: "Needs 5 Soul (you hold 3)." / "Necesita 5
  Alma (tienes 3)."
- **On cut**: the stone flies from the row into a small satchel glyph in the book's corner (`craft` cue). The first
  stone ever cut goes on the belt by itself, as today.
- **Pending changes** must be Accepted first: "Accept your changes first. A stone records the book as it is saved."

### 4.3 The stone's item card (satchel, hover)
- **Name**: "Spellstone: Hellfire Nova" / "Piedra de hechizo: Nova infernal". The icon is the tree family's stone
  (`stoneIcon`), with up to 5 tiny brass node pips along its bottom edge.
- **Lines**:
  - "Rank 7. Marks: Hotter Ring, Scorched Earth, Twin Nova."
  - "Casts Hellfire Nova at rank 7 with its marks. No mana."
  - "Needs level 7."
- **Found in / Used for** (the meaning rule):
  - Found in: "cut in the Skill Book from a Basalt Blank and Soul; traded; dropped by Keepers in Tibia-scope falls".
  - Used for: "the belt's Spellstone slot (F)".
- **Lore** (canon §6.3, kept): "A spell held in stone keeps the hand that cut it. Lend it to a friend and it still
  speaks in your voice." / "Un hechizo guardado en piedra conserva la mano que lo tallo. Prestaselo a un amigo y seguira
  hablando con tu voz."

### 4.4 The Stones tab (top right)
One parchment page. It is not a second inventory: it reads the satchel.
- the **Soul** meter: the shipped pale-flame pips, with "Soul 42 / 102";
- the Blanks held;
- every Spellstone stack in the satchel, as rows: icon, name, rank, node pips, charges and a **Belt** button;
- the line: "Soul comes from creatures no more than 10 levels below you. Bone Spear's Soul Harvest mark adds more." / "El
  Alma viene de criaturas que no esten mas de 10 niveles por debajo de ti. La marca Cosecha de almas de Lanza de hueso
  da mas."

---

## 5. Phones (≤ 760 px wide, and 360×640 as the floor)

**One page at a time.** The spread becomes a single parchment page that scrolls vertically inside the window (the
"every menu must scroll on phone" rule: its own scroll, and an e2e reaching the last control at 360×640).

**Top.**
- a horizontal strip of tree tabs (44×44), scrollable sideways if it overflows;
- Stones, Keys and X on the strip's right end, pinned;
- the ribbon title under it.

**Rows.** Full width.
- **Line 1**: icon 40, name and kind (2 lines), rank, [+] 44, Spellstone 44.
- **Line 2**: the six nodes **in one line**: 6 × 44 hit areas + 5 gaps of 6 px + a 12 px group gap ≈ 306 px. This fits
  360 − 2 × 16 gutters = 328 px.
- Labels "Edge" and "Craft" drop to 9 px over each group, or hide under 340 px.

**Hover becomes a long-press** (400 ms) on an icon or a node. It opens the card as a bottom sheet, half-height at most,
with a [Take] / [Tomar] button for a node and [+1 rank] for an icon. The sheet's close is 44 px, and the sheet never
covers the centre 50% of the world (the window is modal anyway).

**A plain tap on a node** selects it, with a brass rim. A second tap takes it. Two taps keep fat-finger taps from
spending points.

**The foot is sticky** at the bottom of the window: Unused points, Accept and Cancel, each at 44 px height. The scroll
area sits above it.

**Landscape phones (844×390)** use the two-page spread at 0.8 scale with **2 rows a page**, turning with ◀ ▶. If the
window's height is under 360 it falls back to the portrait layout.

---

## 6. Saves and migration

### 6.1 The tree save (on the Keeper look, `godforge-keeper-look`)
Today: `tree: { spent, free, at }` (skill-trees.md "Saves"). It becomes:

```ts
tree: {
  spent: Partial<Record<SkillId, number>>,   // ranks bought, as today
  free:  Partial<Record<SkillId, number>>,   // starter ranks, as today
  nodes: Partial<Record<SkillId, number>>,   // NEW: the 6-bit mask per row (A1=1 A2=2 A3=4 B1=8 B2=16 B3=32)
  book: 2,                                   // NEW: the book version; absent = 1 (the tree board)
  at: number,
}
```

The merge rule is unchanged: the newer tree wins **whole**.

`clampTree` grows four checks:
1. drop a node whose row has too few ranks (node 2 needs rank 5, node 3 needs rank 10);
2. drop a node whose earlier node on its branch is not taken;
3. if both stars are set, drop B3 (A3 kept);
4. while over the level's points, give back nodes first (the deepest row's B3, B2 … then A), then ranks as today.

### 6.2 Migrating a book-1 save (once, on load, when `book` is absent)
1. **Folded passives refund.** Ranks bought in Ember Mastery, Soul Harvest, Skeleton Mastery, Life Tap, Hold the Line,
   Ember Blood, Last Light, Moth-Kin, Heartwood and Wild Heart go back to Unused. The folded node is **not** taken for
   them: a node costs one point, and the player chooses. Free ranks in Soul Harvest (the Warlock's starter kit) are
   simply dropped.
2. **Prerequisites relax.** The new "one rank in any earlier row" rule admits every shipped tree, so no rank is lost.
3. **The bar.** A key holding Life Tap is emptied. Nothing else on the bar changes.
4. **`book: 2`** is written with the next save (through the gateway; no special write at load).
5. **The first open** shows a parchment note over the book, once:
   > "Your book has been rebound. The old passives are marks under their skills now. The points they held are yours to
   > spend: N unused." [ Read the book ]
   >
   > ES: "Tu libro ha sido reencuadernado. Las antiguas pasivas ahora son marcas bajo sus habilidades. Los puntos que
   > tenian son tuyos para gastar: N sin usar." [ Leer el libro ]

### 6.3 Migrating the stone pouch (`godforge-spellstones`)
The SpellstoneSave keeps `soul`, `inscribed`, `at`, and `slot` (re-keyed). Then:
1. **Each pouch entry** `skill@rank → charges` becomes a satchel stack `spellstone:skill@rank#0`, qty = charges (node
   mask 0: the old stones had no marks).
2. **The satchel is full?** The rest wait in a **"Stones to collect"** / *"Piedras por recoger"* line on the Stones tab
   (the pouch, read-only, emptied as room appears). This is the "nothing is ever lost" rule.
3. **The pouch field** is written back as `{}` with `version: 2`, only after the satchel write has landed. Same tick,
   through LocalSaveRegistry: the pagehide trap in MEMORY.
4. **The belt `slot`** becomes the satchel stack's key.
5. **Merge.** A version-1 remote blob that still holds a pouch, met by a version-2 local, migrates the same way. An
   entry already migrated (the same `skill@rank`, with `inscribed` not higher) is skipped. Two devices cannot make the
   same stones twice: migration runs only when `version` < 2 **on the winning blob** (the later `at`). The loser's pouch
   is discarded, as today's whole-blob rule already does.

The item model gains a stack type `spellstone`, with key, qty ≤ 100 and no affixes. Its mint is the Spellstone service's
`cut()`, never a drop table.

### 6.4 Meaning check
`npm run -s check:meaning` must find a Spellstone's sources, uses and lore (§4.3), the Basalt Blank's (unchanged), and
Soul's (unchanged, plus the Bone Spear B1 line).

---

## 7. Sound and motion in the book
- Opening: a book thump (`open`) and a page rustle (noise, band-pass 2 kHz, 180 ms).
- Turning a tab or page: a rustle.
- Taking a node: a soft brass tick (triangle 1.2 kHz, 40 ms), its pitch rising along the branch. A star is a two-note
  chime.
- Accept: a quiet `levelup` chime. Cancel: a page rustle backwards.
- Reduced motion: no node pulse, no flash along changed rows, and the page-turn is a cut.

---

## 8. Build order (the book's share)
1. NodeDef and `nodes` in the tree save, `clampTree`'s four checks, the migration (§6.2), specs. (M)
2. The book component: the spread, rows, nodes, tabs, the staged Accept/Cancel. It replaces the tree board. Desktop, then
   phone, then the e2e at 360×640 reaching Accept. (L)
3. The fight reads nodes: the verbs of skills-100.md §0.2, one at a time, each with a truth spec in the
   `td-truth-*.spec.ts` style. (L)
4. Spellstones as satchel items: the stack type, cut(), the pouch migration (§6.3), the Stones tab, the button per
   row. (M)
5. combat-sim PATHS with nodes (skills-100.md §7). (S)
