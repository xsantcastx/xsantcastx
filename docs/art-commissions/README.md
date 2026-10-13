# Eclipse Realms — art commission pack

Every place the game shows a placeholder (a monogram orb, a rarity orb, an emoji, a flat rectangle, a code-drawn
tile) has a brief in this folder: a ready-to-paste prompt and negative prompt, an export spec, and the **exact
library filename** that makes the importer wire it in. Nothing else has to change in code: drop the file, run
the importer, done (the few exceptions are listed under [Pipeline gaps](#pipeline-gaps)).

> **Art direction (owner, 2026-10-13): Terraria-style pixel art for the whole game.** It replaces the
> 2026-10-12 "hybrid, Ragnarok-style sprites + paintings" split. The art bible is
> **[docs/art/style-guide.md](../art/style-guide.md)**: pixel scale, sizes, outline and shading, palettes,
> animation, auto-tiles, parallax, UI frames, export and the sidecar. Every brief here follows it.
>
> **Make these first:** [00-first-test-set.md](00-first-test-set.md): the Keeper (idle, run, attack),
> Rivet Maw, Kael, eight Delve tile sheets, six item icons and the Basalt Seamworks parallax set. The owner
> A/B-tests them in the Seamworks before the full pass.

## What is pixel art and what stays a painting

| Style | What | Count | Where the briefs are |
|---|---|---:|---|
| **Pixel art, world** | the Keeper and equipment, creatures, keeper NPCs and automatons, town buildings and props, gathering nodes, Homestead, Delve tiles and placeables, parallax | 134 | [world-sprites/](world-sprites/) `01`–`09` |
| **Pixel art, menus** | item and tool icons (I1), NPC and explorer portraits (I2), Thralls (I1) | 83 | [menu-paintings/](menu-paintings/) `01`–`04`, `07` |
| **Paintings (kept)** | Codex Bestiary creature masters (6), boss concept sheets (5, review only), realm town key art (5, menus and loading cards only) | 16 | [menu-paintings/](menu-paintings/) `05`, `06` |

Why these 16 stay paintings, and what the new direction retires (the Keeper mesh rig, the painted in-world
backdrops, the painted bag icons, the paper doll), is in [style guide §1](../art/style-guide.md#1-what-is-pixel-art-and-what-stays-a-painting).
The folder names `menu-paintings/` and `world-sprites/` are kept so existing links do not break; "menu" now
means "shown in a panel", not "painted".

A named NPC who appears in both places gets **both**: a W3 world sprite and an I2 portrait, with identical
costume, colours and outline.

## Files

| File | What |
|---|---|
| [00-first-test-set.md](00-first-test-set.md) | the 21 files to make first, with their full briefs |
| [01-second-wave.md](01-second-wave.md) | what was added after the first pack (Delve tiles and kit, tools, gathering nodes, Homestead, Delve creatures) and the order to make it in |
| [INVENTORY.md](INVENTORY.md) | every missing file: id, category, style, priority, where it is used, what shows today, where to save it |
| [commissions.csv](commissions.csv) | the same plus spec, prompt and negative, machine-readable (the importer's `--commissions` check reads it) |
| `menu-paintings/01-npc-portraits.md` … `07-tools-and-delve-items.md` | I1 icons, I2 portraits, and the kept paintings (`05`, `06`) |
| `world-sprites/01-keeper.md` … `09-parallax.md` | world pixel art |

Totals: **233 files**: 217 pixel art (134 world, 83 menu) and 16 paintings. 229 are the original pack, every id
and library path unchanged; the 4 new files are the Basalt Seamworks parallax layers
([world-sprites/09-parallax.md](world-sprites/09-parallax.md)). `layer` in the CSV is `world-sprite`,
`menu-pixel` or `menu-painting`.

## How to use the pack

1. Pick an asset (start with the first test set, then `P0`; [INVENTORY.md](INVENTORY.md) is sorted by priority).
2. Paste the **Prompt** and **Negative** into a generator for the design, or hand the section to a pixel artist.
   Generator output is a draft: snap it to the art-pixel grid and clean it by hand
   ([style guide §14](../art/style-guide.md#14-working-from-an-image-generator)).
3. Export to the **spec** in the section: the art-pixel canvas, scaled up with **nearest-neighbour** by the
   stated factor (x8 for figures, props, icons, portraits and parallax; x4 for Delve tiles and cell props).
4. Save it under `~/Documents/1. Projects/Eclipse Realms/Assets/` at the **exact** "Save as" path, with its
   sidecar `.json` beside it for every `Sprites/**` sheet (the brief gives the sidecar; it always has
   `"pixelArt": true`). Create the folder if it does not exist yet.
5. From the repo root:

   ```bash
   python3 scripts/import-assets.py --commissions          # what is still missing (needs no Pillow)
   python3 scripts/import-assets.py --check --only=Sprites # validate sprite sheets, writes nothing
   python3 scripts/import-assets.py --only=Sprites         # import the world layer (or --only=Items/ArtBible/Tools …)
   python3 scripts/build-scene-art.py --only=bg-town-infernal   # town key art only
   ```

6. Commit the new `src/assets/game/**` files and the regenerated `art-manifest.generated.ts`,
   `sprite-manifest.generated.ts` and `tile-manifest.generated.ts`. The placeholder is gone; `ART_PENDING`
   retires the id by itself, and the importer prints the now-stale `ART_PENDING_DECLARED` lines so you can
   delete them (housekeeping only).

Filenames: lower-case kebab-case, the two/three-digit prefix is the library's order and is stripped from the
id, and a `-idle` suffix is stripped too (`101-unique-tinders-due-idle.png` → `unique-tinders-due`). Ids whose
model name differs from the person's name are already resolved in the paths here (for example
`explorer-meren-quiet-ledger`). Never save `-key`, `-chromakey`, `-source`, `-draft` or `-v2` files into the
library, and never a `name 2.png` copy (the synced folder makes them by itself). Keep the `.aseprite` source
outside the library.

---

## Specs at a glance

Full rules, sizes and palettes are in the [style guide](../art/style-guide.md). One art pixel = 2 logical px in
the Delve, 4 in towns ([§2](../art/style-guide.md#2-pixel-scale-and-grid)).

| Spec | What | Art-pixel canvas | Export | Sidecar |
|---|---|---|---|---|
| **W1** character sheet | the Keeper | 48 x 48 per frame; rows idle 4, run 8, jump 2, fall 2, attack 4, dodge 3, hurt 2, death 5 | x8 (384 x 384 per frame) | yes, with `hand_front` / `hand_back` anchors |
| **W2** creature sheet | hunting-ground and Delve creatures | 40 x 28 to 64 x 60; idle 4, walk 6, windup 3, strike 3, hurt 2, death 5 | x8 | yes |
| **W3** NPC sheet | keeper NPCs, townsfolk, automatons | 40 x 48; idle 4, talk 2 (walk 6 for wanderers; automatons idle 4, strike 4) | x8 | yes |
| **W4** attachable | held weapons and off-hands, pointing straight up | 8 x 16 to 16 x 32 (staff 12 x 40) | x8 | yes, `pivot` = grip |
| **W5** building / **W6** prop | town buildings, props, gathering nodes, Homestead | per brief; ambient loops 4–6 frames | x8 | optional (none = one still frame, bottom-centre pivot) |
| **W6** cell prop | Delve placeables (torch, ladder, chest, camp, supports, charge) | 16 x 16 | x4 (64 x 64) | yes, pivot (32, 64) |
| **W7a** auto-tile | solid Delve terrain | 16 x 16 cells, 4 x 7 grid = 64 x 112 | x4 (256 x 448) | yes (7 actions) |
| **W7 / W7b** strip | features set in rock, back walls, the inscription overlay | 16 x 16 cells, 4 in a row = 64 x 16 | x4 (256 x 64) | yes (action `tile`) |
| **W8** parallax | sky, far, mid, near per town | 480 x 192, seamless | x8 (3840 x 1536) | yes |
| **I1** item icon | items, tools, Delve kit, materials, Thralls | 32 x 32 | x8 (256 x 256) | no |
| **I2** portrait | NPC and explorer dialogue portraits | 64 x 64 | x8 (512 x 512) | no |
| **S3 / S6 / S7** | kept paintings (below) | | | no |

### The sidecar JSON (one per `Sprites/**` sheet, same name, `.json`)

```jsonc
{
  "id": "keeper",               // optional; default = filename minus the NN- prefix
  "scale": 2,                   // always 2 in this pack; the importer also emits an exact 1x reduction
  "pixelArt": true,             // always true: the renderer turns smoothing off and snaps to whole pixels
  "frame": { "w": 384, "h": 384 },   // one cell in authored pixels (art px x export factor)
  "pivot": { "x": 192, "y": 368 },   // ground contact inside a cell; default bottom-centre
  "actions": [                  // one sheet row each, top to bottom, in this order
    { "name": "idle", "frames": 4, "fps": 6, "loop": true,
      "anchors": { "hand_front": [[196, 236, 150], ...], "hand_back": [[156, 236], ...] } }  // one point per frame
  ]
}
```

The importer rejects a sheet whose size is not `max(frames) x frame.w` by `len(actions) x frame.h`, an anchor
list whose length is not `frames`, repeated action names, a cell not divisible by `scale`, or a non-boolean
`pixelArt`. A prop saved **without** a sidecar is imported as one still frame with a bottom-centre pivot (and
without `pixelArt`, so it draws smoothed: always ship the sidecar). Each sheet is written as lossless WebP at
its authored scale and at 1x to `src/assets/game/sprites/<family>/`, and folded into
`sprite-manifest.generated.ts` (tiles into `tile-manifest.generated.ts`) in 1x units:

```ts
spriteFor('keeper') // { src, src2x, frameW: 192, frameH: 192, pivotX: 96, pivotY: 184, pixelArt: true,
                    //   actions: { idle: { row: 0, frames: 4, fps: 6, loop: true, anchors: { … } }, … } }
```

`spriteFor()` returns null until a sheet is imported, so the engine keeps its current fallback until then. How
the engine maps game states to actions is in [docs/handoff/sprite-renderer.md](../handoff/sprite-renderer.md).

### Transparency and opacity

- **Cut-outs need fully transparent corners** (every sprite, icon and portrait). The importer rejects a file
  whose four corners are opaque.
- **Bodies are opaque.** The importer rejects a figure (Characters, Creatures, NPCs, Buildings, portraits,
  Thralls, masters) where under **50%** of the painted area is solid. In pixel art that means: no
  semi-transparent pixels except glass, wing membrane and smoke, inside the silhouette.
- **Opaque on purpose:** W7a row 0, W7 feature strips, W7b back walls and the W8 `sky` layer. The tile importer
  rejects any see-through pixel in a W7 strip.

---

## The kept paintings (S3, S6, S7)

These 16 briefs keep the painterly house style; their prompts only gained the style guide's palette hexes and
a note on what they are for now.

**Style block (paintings only).** Dark-fantasy digital painting, ornate and highly detailed, crisp edges on
the subject, soft painted glow only where something emits light; not photoreal, not glossy 3D, not cartoon.
Deep charcoal and obsidian base values; at least two of obsidian, carved metal, fractured crystal, runic light,
ancient masonry, living rootwork, smoky void, stardust; gold/brass filigree trim; key light upper left with a
crisp rim light; violet `#a855f7` is the shared Eclipse energy, never a realm colour; realm accents from
[style guide §5.2](../art/style-guide.md#52-realms). Never: text or letters, frames, borders, vignettes, baked
UI, skull piles, horns, random wings, halos, real-world religious iconography.

| Spec | Size | Background | Framing |
|---|---|---|---|
| **S3 figure** (Codex masters) | 1254 x 1254 PNG | transparent | full body, three-quarter view facing right; silhouette and colour blocks match the creature's pixel sprite when one exists |
| **S6 scene** (realm key art) | 1536 x 1024 PNG (3:2) | opaque | eye-level side view, landmark in the centre third; menus and loading cards, never behind sprites |
| **S7 concept** (boss review) | 1122 x 1402 PNG (4:5) | opaque | review sheet, never shipped |

S1 (painted collectible) and S2 (painted portrait) are retired for new work: use I1 and I2.

---

## Library structure (new folders in bold)

```text
Assets/
├── Characters/
│   ├── npcs/                  NN-npc-<id>.png            I2 pixel portraits
│   └── explorers/             NN-explorer-<id>.png       I2 pixel portraits
├── Creatures/
│   ├── Masters/               06-11-<creature>.png       S3 paintings (Codex)
│   └── Concepts/              11-15-<boss>-concept.png   S7 review sheets (not imported)
├── Items/ArtBible/<Family>/   101-139-<id>-idle.png      I1 icons (uniques, tools)
├── Items/Materials/           14-26-<id>.png             I1 icons (Delve kit and materials)
├── Items/Quest/               05-kaels-hammer.png        I1 icon
├── Market/Items/Thralls/      thrall-<tier>.png, thrall-slot.png   I1 icons
├── Locations/Towns/           <realm>-town.png           S6 key art (build-scene-art.py)
└── Sprites/                   (world layer, lossless path, sidecar per sheet)
    ├── Characters/            01-keeper.png + .json
    ├── Creatures/             NN-<creature>.png + .json
    ├── NPCs/                  NN-npc-<id>.png + .json
    ├── Buildings/             NN-<realm>-<building>.png + .json
    ├── Props/                 NN-<id>.png + .json        (town props, gathering nodes, Homestead, Delve cell props)
    ├── Equipment/             NN-equip-<class>.png + .json
    ├── Tiles/                 NN-tile-<node id>.png + .json   (W7 / W7a / W7b)
    └── **Parallax/**          NN-parallax-<realm>-<layer>.png + .json   (W8; no importer family yet)
```

## Pipeline gaps

The art can be made now. These code changes (none in this pack; ids from
[style guide §12](../art/style-guide.md#12-what-the-pipeline-cannot-do-yet)) are needed before parts of it show:

- **IMP-1 / RND-1** auto-tiles: the tile importer accepts only a one-row `tile` strip and the terrain renderer
  knows no neighbours. Until then, import row 0 of a W7a sheet alone (256 x 64) to see the interiors.
- **IMP-2 / RND-2** parallax: no `Sprites/Parallax` family and no layered background renderer.
- **IMP-3** pixel icons and portraits: the width ladder resizes with Lanczos, so the 96 px rung is slightly soft;
  the 256 / 512 rungs are exact.
- **RND-3** in-world HUD frames ([style guide §9](../art/style-guide.md#9-in-world-ui-slots-and-panels)).
- **ENG-1** the Delve still spawns `mirror-substitute` / `rivet-maw` for its two enemies.

## The ten menu files to make first (by how often a player sees the placeholder)

Test set aside, the menu placeholders a player hits most:

1. `npc-kael` portrait — onboarding for every new player, then `/world`, `/forge`, `/character`, `/sanctum`.
2. `npc-merchant` — `/market`, `/gambler`, `/exchange`.
3. `npc-archivist` — `/codex`, `/world/quests`.
4. `explorer-tobin-ashfoot` — starter explorer, on the Works map from the first visit.
5. `explorer-marda-quell` — the other starter.
6. `axe-1`, `sickle-1`, `staff-1` — the first forged tier of each tool family (Pickaxe I is in the test set), on the Crafting Bench and in Character → Stats early on.
7. `thrall-common` — first Thrall shelf row in the Market.
8. `thrall-slot` — the "Lengthen the Shift" row beside it.
9. `npc-verrin` — Umbral realm and `/world/trials`.
10. `unique-copper-witness` — the uncommon uniques are the ones that actually drop early.

## Pipeline notes

- `artFor()` reads only the manifest, so an icon or portrait resolves the moment it is imported.
  `ART_PENDING` is `ART_PENDING_DECLARED` minus anything imported, so `art.spec.ts` stays green on the import
  commit; the importer lists the stale declared lines to delete afterwards.
- The Codex Bestiary lists all ten atlas creatures and shows one as soon as its master resolves.
- Import families: `Characters/npcs`, `Characters/explorers` (96/256/512 ladder), `Market/Items/Thralls`
  (collectible ladder), the six `Sprites/*` sprite families and `Sprites/Tiles`. All are optional: a missing
  folder is reported as "pending", not as a broken library.
- Realm key art belongs to `scripts/build-scene-art.py`, which builds `bg-town-<realm>-{768,1280,1536}.webp`
  + `-1536.jpg`; missing towns are skipped.
- Wiring sprites into the play engine is done (`docs/handoff/sprite-renderer.md`): a sheet shows the moment
  `spriteFor(id)` resolves.
