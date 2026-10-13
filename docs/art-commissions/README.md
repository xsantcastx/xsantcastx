# Eclipse Realms — art commission pack

Every place the game shows a placeholder (a monogram orb, a rarity orb, an emoji, a flat rectangle) has a
brief in this folder: a ready-to-paste prompt, an export spec, and the **exact library filename** that makes
the importer wire it in. Nothing else has to change in code: drop the file, run the importer, done.

> **Make these first:** [00-first-test-set.md](00-first-test-set.md) — Keeper sprite (idle/run/attack),
> Rivet Maw sprite (idle/windup/strike) and an Infernal camp prop set. The owner is A/B-testing the sprite
> world layer on these before the rest of the world-sprite pack is commissioned.

## The two layers (art-direction decision, 2026-10-12)

Eclipse Realms uses a hybrid, Ragnarok-Online-style split:

| Layer | Style | What is in it | Folder |
|---|---|---|---|
| **World** | stylised 2D **sprites** | everything that stands or moves in the side-scroller and the towns: the Keeper and remote Keepers, NPC shopkeepers and townsfolk, hunting-ground creatures, buildings, stations and props, attachable weapons | [world-sprites/](world-sprites/) |
| **Menu** | the existing **painterly** style | item and collectible art, uniques, NPC dialogue portraits, explorer and Thrall portraits, Gambler reveals, Codex/Bestiary, paper doll, realm town backdrops | [menu-paintings/](menu-paintings/) |

Anything that appears in both (the Keeper, named NPCs, creatures) gets **both**: a painting for menus and a
sprite sheet for the world, with identical costume, colours and silhouette.

## Files

| File | What |
|---|---|
| [00-first-test-set.md](00-first-test-set.md) | the seven sheets to make first |
| [01-second-wave.md](01-second-wave.md) | what was added after the first pack (Delve tiles and kit, tools, gathering nodes, Homestead, Delve creatures) and the order to make it in |
| [INVENTORY.md](INVENTORY.md) | every missing asset: id, category, where it is used, what shows today, where to save it |
| [commissions.csv](commissions.csv) | the same, plus prompt and negative prompt, machine-readable (the importer's `--commissions` check reads it) |
| `menu-paintings/01-npc-portraits.md` … `07-tools-and-delve-items.md` | painterly briefs |
| `world-sprites/01-keeper.md` … `08-delve-creatures.md` | sprite briefs |

Totals: **229 files** — 99 menu paintings (6 NPC portraits, 18 explorer portraits, 6 Thralls, 23 uniques,
6 creature masters, 5 boss concept sheets, 5 town backdrops, 16 tool icons, 13 Delve kit and material icons,
1 quest item) and 130 world sprites (1 Keeper sheet, 14 attachable equipment sprites, 7 creature sheets,
12 NPC and automaton sheets, 16 buildings, 54 props, 26 Delve tiles). The six Delve-extras files (supports
and blasting charges) are listed at the end of [INVENTORY.md](INVENTORY.md). The 94 added in the second wave are
listed in [01-second-wave.md](01-second-wave.md). The tile strips are a new spec, W7, defined in
[world-sprites/05-delve-tiles.md](world-sprites/05-delve-tiles.md).

## How to use the pack

1. Pick an asset (start with `P0`; [INVENTORY.md](INVENTORY.md) is sorted by priority).
2. Paste the **Prompt** and **Negative** into your generator, or hand the section to an artist.
3. Export to the **spec** named in the section (below). Check the transparency rules.
4. Save it under `~/Documents/1. Projects/Eclipse Realms/Assets/` at the **exact** "Save as" path. Create the
   folder if it does not exist yet (`Characters/npcs/`, `Characters/explorers/`, `Market/Items/Thralls/`,
   `Locations/Towns/`, `Sprites/**` are new). Sprite sheets also need their sidecar `.json` next to them.
5. From the repo root:

   ```bash
   python3 scripts/import-assets.py --commissions          # what is still missing (needs no Pillow)
   python3 scripts/import-assets.py --check                # validate what you dropped, writes nothing
   python3 scripts/import-assets.py --only=Characters/npcs # import one family (or --only=Sprites)
   python3 scripts/build-scene-art.py --only=bg-town-infernal   # town backdrops only
   ```

6. Commit the new `src/assets/game/**` files and the regenerated `art-manifest.generated.ts` /
   `sprite-manifest.generated.ts`. The placeholder is gone; `ART_PENDING` retires the id by itself, and the
   importer prints the now-stale `ART_PENDING_DECLARED` lines so you can delete them (housekeeping only).

Filenames: lower-case kebab-case, the two/three-digit prefix is the library's order and is stripped from the
id, and a `-idle` suffix is stripped too (`101-unique-tinders-due-idle.png` → `unique-tinders-due`). Ids whose
model name differs from the person's name are already resolved in the paths here (for example
`explorer-meren-quiet-ledger`, not `meren-of-the-quiet-ledger`). Never save `-key`, `-chromakey`, `-source`,
`-draft` or `-v2` files into the library.

---

## Menu layer — painterly

### Style block (shared by every menu painting)

Distilled from the canon (`03-lore-and-design/eclipse-realms-lore-and-art-direction-canon.md`) and from the
approved library files sampled for this pack (Keeper avatar and portrait, Rivet Maw master, Cindergnaw,
Verrin's Requiem, Duskmail Hauberk, Aurumleaf Pendant, Merchant's Scale, Forge Golem, Hire an Explorer, and
the Infernal, Umbral and Market scenes).

- **Rendering:** dark-fantasy digital painting, ornate and highly detailed, crisp edges on the subject, soft
  painted glow only where something emits light. Not photoreal, not glossy 3D, not cartoon or anime.
- **Base values:** deep charcoal and obsidian. Every approved collectible sits dark-on-transparent and relies on
  rim light and one emissive accent to read at 64 px.
- **Materials (use at least two):** obsidian, carved metal, fractured crystal, runic light, ancient masonry,
  living rootwork, smoky void, stardust. Gold/brass filigree is the shared trim (Keeper robe, pendant,
  Merchant's scale).
- **Light:** key light upper left, crisp rim light on the far edge. **Violet** is the shared Eclipse/Godforge
  energy (the Keeper's medallion, rune glows, the Market hall), never a substitute for a realm colour.
- **Realm accents:** Celestial midnight blue / star silver / brass; Infernal ember red, iron black, furnace
  orange seams (Cindergnaw's lava cracks, the Rivet Maw's mouth seams); Luminous warm gold / ivory / dawn
  crystal; Umbral amethyst / black-violet / obsidian / moonlight; Verdant moss / amber / rootwood /
  bioluminescence. The code's three renamed realms map as Verge = Celestial, Nexus = Infernal,
  Archivum = Verdant.
- **Rarity aura (items, explorers, Thralls):** a thin halo in the tier colour — Common #8f8aa1, Uncommon
  #9db8a8, Rare #00d4ff, Epic #a855f7, Legendary #e8c898, Mythic #f8e8c8, Singular #ff6dd7.
- **Never:** text or letters (runes are shapes, not writing), cards, frames, borders, vignettes, baked UI,
  skull piles, horns, random wings, halos, real-world religious iconography, cottagecore, castles for their
  own sake.

### Specs

| Spec | Size | Background | Framing |
|---|---|---|---|
| **S1 collectible** | 1254 × 1254 PNG | transparent | one object, three-quarter view; long items on the lower-left → upper-right diagonal (as every Art Bible weapon is); fills ~80% of the frame, 8% safe margin; no floor, no cast shadow |
| **S2 portrait** | 1254 × 1254 PNG | transparent | head-and-shoulders bust cut at mid-chest (match `Characters/avatars/01-neutral-keeper-avatar.png`); face in the upper-middle; must still read cropped to a circle and shrunk to an 80 px orb |
| **S3 figure** | 1254 × 1254 PNG | transparent | full body, three-quarter view facing right, feet near the bottom |
| **S6 scene** | 1536 × 1024 PNG (3:2) | opaque, no alpha | eye-level side view; landmark in the centre third (the phone crop is the centre 3:4); a calm walkable ground plane across the bottom fifth; no people |
| **S7 concept** | 1122 × 1402 PNG (4:5) | opaque | review sheet, never shipped |

### Transparency and opacity — read this before exporting

- **Cut-outs must have fully transparent corners.** The importer rejects any S1–S3 file whose four corners are
  opaque (`opaque corners — backdrop is baked into the art`). A painted near-white card behind the subject is
  the classic failure (`01-keeper-paper-doll.png`). Today `Currencies/void.png` fails this check.
- **Characters and creatures must be OPAQUE inside the figure.** A previous Keeper export was 97% translucent
  and read as a ghost over every scene; it had to be rescued with `SOLIDIFY` in the importer. Paint the body,
  clothing and armour at full alpha; only true glows, smoke and wing membranes may be semi-transparent, and
  only at the edges. The importer now rejects a portrait, figure, creature master or Thrall where less than
  **50%** of the painted area is solid (approved avatars measure 95–98%, creature masters 81–98%).
  Do not rely on `SOLIDIFY` for new work.
- Note: the three `Market/Items/Automatons/*.png` masters and `hire-an-explorer.png` measure only 7–16% opaque
  (they are outside the new guard, which covers figure families only); worth re-exporting.

---

## World layer — sprites

### Sprite style guide

The canon's palette and mood, translated to something that reads at 60–200 px over a painted backdrop.

- **Form:** stylised 2D, chibi-leaning. Humanoids are **2.5–3 heads tall** (the Keeper 2.75), with big hands,
  heads and props so silhouettes read at a glance. Creatures keep their atlas anatomy, simplified to 3–5 big
  shapes.
- **View:** side-scroller three-quarter side view, **facing right only** (the engine mirrors). Props and
  buildings: side elevation with a slight high angle so their tops read.
- **Line:** a clean, even outline in near-black violet (`#140a1f`), **4 px at the authored 2× scale** (2 px on
  screen), a little heavier on the outer silhouette than on inner detail. The outline must be darker than any
  value in the backdrops so a sprite never sinks into the painting behind it.
- **Shading:** cel-shaded, 2–3 tone steps per material plus one highlight; no brush texture, no airbrush
  gradients, no noise. Emissive parts (violet eclipse glow, ember seams, crystal light) may use one soft glow.
- **Palette:** limited — about 24 colours per sprite before glows. Shared obsidian / aged gold / violet
  `#a855f7` system energy, plus the realm accent: Infernal ember `#E8752A` on iron black; Luminous gold
  `#E8D44D` on ivory; Umbral amethyst `#A855F7` on black-violet; Celestial blue / star silver `#00d4ff`
  glints; Verdant moss and amber.
- **Light:** top-left key, the same as the paintings; rim highlight on the right edge.
- **Against painterly backdrops:** sprites sit in front of painterly town scenes. Keep the outline; keep the
  sprite a step more saturated and higher-contrast than the backdrop. **Props and buildings** carry a baked
  soft contact shadow (an ellipse under the base, ≤ 35% opacity, inside the cell). **Characters and creatures
  do not** — the engine draws theirs because it must follow jumps.
- **Never:** pixel-art dithering or jagged aliasing (these are smooth, anti-aliased sprites), soft painterly
  texture, text on signs, baked UI, front-facing walk cycles.

### Scale (keep every sprite relative to the Keeper)

All sizes are **on-screen logical pixels at 1×** (the play canvas' world units at zoom 1). Author at **2×**.

| Thing | On screen (1×) | Authored cell (2×) | Pivot in cell (2×) |
|---|---|---|---|
| **Keeper** (and remote Keepers) | **160 px tall** | 384 × 384 | (192, 368) |
| NPC shopkeepers | 150–170 px tall | 320 × 384 | (160, 368) |
| Rivet Maw | 150 long, 105 tall | 384 × 288 | (192, 272) |
| Prism Forager / Mirror Substitute | 165 tall | 320 × 384 | (160, 368) |
| Ephemeris Leech | 110 long, 70 tall | 320 × 224 | (160, 208) |
| Rootglass Stag | 200 long, 215 tall | 512 × 480 | (256, 464) |
| One-handed weapon | 64–96 long | 64–96 × 128–192 | grip centre |
| Staff / polearm | 160 long | 96 × 320 | grip centre |
| Bench / campfire | 50–60 tall | 128–256 wide | bottom-centre |
| Crafting bench / anvil / enchanting table | 90–110 tall | 256–320 wide | bottom-centre |
| Waystone / lamp posts / beacon | 180–240 tall | 96–192 × 384–480 | bottom-centre |
| Stalls | 260 tall | 512 × 544 | bottom-centre |
| Buildings | 400–480 tall | 640–832 × 832–992 | bottom-centre |

The pivot is the **ground contact**: between the feet for characters, the middle of the base for props. It
sits 16 px (2×) above the bottom of the cell so feet never touch the cell edge. Keep the same pivot in every
frame — bobbing and jumping happen around it, not by moving it.

### Specs

| Spec | What |
|---|---|
| **W1 character sheet** | the Keeper. Uniform grid, one row per action, frames left to right; sheet width = longest action × cell width, height = actions × cell height; unused cells transparent. Empty hands — see anchors. |
| **W2 creature sheet** | same grid rules; actions `idle 6, walk 8, windup 4, strike 4, hurt 3, death 6` |
| **W3 NPC sheet** | same grid rules; actions `idle 6, talk 4`, optional `walk 8` |
| **W4 attachable equipment** | single frame, drawn pointing straight up, grip at the bottom; sidecar `pivot` = grip centre |
| **W5 building** / **W6 prop** | single frame (no sidecar needed — pivot defaults to bottom-centre), or a 4–6 frame `ambient` loop for fire, glow, turning rings |

Every sheet: PNG, RGBA, transparent background (corners must be transparent), **no resizing after export**,
opaque body (the 50% solidity guard applies to Characters, Creatures, NPCs and Buildings; sprites are never
SOLIDIFIED), cell sizes divisible by the scale.

### The sidecar JSON (one per sheet, same name, `.json`)

```jsonc
{
  "id": "keeper",              // optional; default = filename minus the NN- prefix
  "scale": 2,                  // authored scale (1-4). The importer emits this and an exact 1x reduction.
  "frame": { "w": 384, "h": 384 },   // one cell, authored pixels
  "pivot": { "x": 192, "y": 368 },   // ground contact inside a cell; default bottom-centre
  "actions": [                 // one sheet row each, top to bottom, in this order
    {
      "name": "idle",          // unique; the engine plays actions by name
      "frames": 6,             // cells used in this row, from the left
      "fps": 8,                // 0 = still
      "loop": true,
      "anchors": {             // optional; one point per frame, cell-relative, authored pixels
        "hand_front": [[236, 236, 150], ...],  // [x, y, deg] — deg = held item's angle, clockwise from up
        "hand_back":  [[150, 232], ...]        // [x, y]
      }
    }
  ]
}
```

The importer rejects a sheet whose size does not equal `max(frames) × frame.w` by `len(actions) × frame.h`,
an anchor list whose length is not `frames`, repeated action names, or a cell not divisible by `scale`. A prop
saved **without** a sidecar is imported as one still frame with a bottom-centre pivot.

**What the importer does with sprites** (`scripts/import-assets.py`, "World-layer sprites"): no width ladder,
no lossy encoding, no SOLIDIFY. Each sheet is written as **lossless WebP** at its authored scale and at 1×,
reduced by an exact integer factor in premultiplied alpha (no dark fringes), to
`src/assets/game/sprites/<family>/NN-<id>@{1x,2x}.webp`, with a normalised copy of the sidecar beside it.
The sidecars are folded into `src/app/shared/art/sprite-manifest.generated.ts` in 1× units:

```ts
spriteFor('keeper') // { src, src2x, frameW: 192, frameH: 192, pivotX: 96, pivotY: 184,
                    //   actions: { idle: { row: 0, frames: 6, fps: 8, loop: true, anchors: { hand_front: [[118, 118, 150], …] } }, … } }
```

`spriteFor()` (re-exported from `src/app/shared/art/art.ts`) returns null until a sheet is imported, so the
engine keeps its current fallback until then.

---

## Library structure (new folders in bold)

```text
Assets/
├── Characters/
│   ├── npcs/                  NN-npc-<id>.png            S2 portraits (menu)
│   └── explorers/             NN-explorer-<id>.png       S2 portraits (menu)
├── Creatures/
│   ├── Masters/               06-10-<creature>.png       S3 masters (menu, Codex)
│   └── Concepts/              11-15-<boss>-concept.png   S7 review sheets (not imported)
├── Items/ArtBible/<Family>/   101-123-unique-<id>-idle.png   S1 uniques
├── Market/Items/Thralls/      thrall-<tier>.png, thrall-slot.png
├── Locations/Towns/           <realm>-town.png           S6 backdrops (build-scene-art.py)
└── Sprites/                   (world layer, lossless path)
    ├── Characters/            01-keeper.png + .json
    ├── Creatures/             NN-<creature>.png + .json
    ├── NPCs/                  NN-npc-<id>.png + .json
    ├── Buildings/             NN-<realm>-<building>.png [+ .json]
    ├── Props/                 NN-<realm>-<prop>.png [+ .json]
    └── Equipment/             NN-equip-<class>.png + .json
```

## The ten to make first (by how often a player sees the placeholder)

World-sprite test set aside (it is its own first batch), the menu placeholders a player hits most:

1. `npc-kael` — onboarding for every new player, then `/world`, `/forge`, `/character`, `/sanctum`.
2. `npc-merchant` — `/market`, `/gambler`, `/exchange`.
3. `npc-archivist` — `/codex`, `/world/quests`.
4. `explorer-tobin-ashfoot` — starter explorer, on the Works map from the first visit.
5. `explorer-marda-quell` — the other starter.
6. `thrall-common` — first Thrall shelf row in the Market.
7. `thrall-slot` — the "Lengthen the Shift" row beside it.
8. `npc-verrin` — Umbral realm and `/world/trials`.
9. `npc-aureth` — Luminous realm.
10. `unique-copper-witness` / `unique-tinders-due` — the uncommon uniques, the ones that actually drop
    early (all four uncommons are P1).

## Pipeline notes

- `artFor()` reads only the manifest, so a painting resolves the moment it is imported.
  `ART_PENDING` is now `ART_PENDING_DECLARED` minus anything painted, so `art.spec.ts` stays green on the
  import commit; the importer lists the stale declared lines to delete afterwards.
- The Codex Bestiary lists all ten atlas creatures and shows a creature as soon as its master resolves;
  the "N more sighted" count is computed.
- New import families: `Characters/npcs`, `Characters/explorers` (96/256/512 ladder), `Market/Items/Thralls`
  (collectible ladder), and the six `Sprites/*` families. All are optional: a missing folder is reported as
  "pending", not as a broken library.
- Town backdrops are scenes, so they belong to `scripts/build-scene-art.py`, which now reads the library
  (it used to read a Desktop folder that no longer exists) and builds `bg-town-<realm>-{768,1280,1536}.webp`
  + `-1536.jpg`; missing towns are skipped.
- Wiring sprites into the play engine (`src/app/play/**`) is owned by the world-foundation work, not by this
  pack.
