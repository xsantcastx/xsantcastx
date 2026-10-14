# The Mirror Slate (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

The Mirror Slate (`docs/handoff/mirror-slate.md`; lore: `docs/world/lore-addendum.md`, "The Mirror Slate") is a palm-sized pane of the Nocturne Archive's fractured moon mirror bound in Kael's brass. Lune Coyne hands it over after ten plays at her tables; Kael wakes its second face (tier II). What ships today is procedural:

- **Item icons** `mirror-slate` and `mirror-slate-ii` are 16 × 16 procedural pixel icons (`shared/art/pixel-icons.ts`, shape `SLATE`) that `artFor()` uses only until a painted file lands, so the importer replaces them with no code change.
- **The HUD button** and the **panel bezel** are CSS (`side-scroller.component.css`, "The Mirror Slate"): a 6 px aged-gold border with a 2 px inner gold line round a violet-washed obsidian glass. The style guide §9 frame sheet replaces them once it exists.

Not yet in `commissions.csv`: add the rows when the brief is approved. Priority P2 (the game reads without them). Palette: aged gold `#5a3c1a` `#a5793a` `#e8c898` `#f8e8c8` (the brass); Umbral black-violet `#0e0912` `#1a1220` `#33263a` `#4a3260`, moonlight `#8a90b0` `#d8dcf0` (the glass); amethyst `#7b4fc0` `#c9a0ff` only on the tier II glass.

Common negative (all briefs):

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo past the silhouette, text, letters, numbers, a modern phone, a touchscreen, app icons, a camera lens, buttons, watermark, signature, background, scenery, copied or traced sprites from any existing game
```

## `mirror-slate` — Mirror Slate (item icon, I1)

| | |
|---|---|
| Save as | `Assets/Sprites/Items/mirror-slate.png` + sidecar `.json` |
| Used in | the satchel (a key item, no slot), the Collection Log, Lune's counter strip |
| Shows today | the procedural `SLATE` icon (cracked pale glass in a brass bezel) |
| Size | 32 × 32 art px, export ×8 nearest-neighbour = 256 × 256; sidecar `{"scale": 2, "pixelArt": true}` |

```text
a small upright rectangular pane of cracked moon-mirror glass, palm-sized, held in a thick hand-riveted brass bezel with four round rivets at the corners, the glass pale moonlight silver at the upper left fading into deep black-violet at the lower right, one clean diagonal crack across the glass from the upper right towards the lower left, a one-pixel white shine at the top-left corner of the glass, the brass lit on its upper and left edges and shadowed on the right and bottom. Umbral glass palette, aged gold brass. hand-placed pixel art icon, every pixel on the art-pixel grid, a 1-pixel coloured outline (never pure black, floor #140a1f), light from the upper left, 3 to 4 hue-shifted tones per material plus one highlight, no anti-aliasing, no dithering; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

## `mirror-slate-ii` — Mirror Slate II (item icon, I1)

| | |
|---|---|
| Save as | `Assets/Sprites/Items/mirror-slate-ii.png` + sidecar `.json` |
| Used in | the satchel, the Collection Log, the Slate's tier II kicker |
| Shows today | the procedural `SLATE` icon with violet glass and a soft glow |

```text
the same palm-sized cracked moon-mirror pane in its riveted brass bezel as the Mirror Slate, but the glass woken: deep amethyst violet below the crack with three tiny moonlight dots like map pins scattered on it and a faint gold dotted line joining two of them, the crack itself edged in pale lilac light, the brass a step brighter on its lit edges. Umbral palette with amethyst only on the glass, aged gold brass. hand-placed pixel art icon, every pixel on the art-pixel grid, a 1-pixel coloured outline (never pure black, floor #140a1f), light from the upper left, 3 to 4 hue-shifted tones per material plus one highlight, no anti-aliasing, no dithering; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

## `ui-slate-bezel` — the open Slate's frame (9-slice, style guide §9)

| | |
|---|---|
| Save as | `Assets/Sprites/UI/slate-bezel.png` + sidecar `.json` |
| Used in | the open Slate (`.place--slate`): desktop modal and the phone's full-screen sheet |
| Shows today | a CSS border: 6 px `#a5793a`, a 2 px `#e8c898` inner line, obsidian glass |
| Size | 48 × 48 art px 9-slice, 8 art px border, corners 8 × 8 with one rivet each; export ×2 for `border-image` (the HUD frames' 2 logical px per art px) |

```text
a square 9-slice frame for a user interface panel: a thick aged-gold brass bezel 8 art pixels wide with a bevel (lit top and left #e8c898, shadowed bottom and right #5a3c1a), one round brass rivet in each corner, a 1-art-pixel moonlight-silver inner rim where the bezel meets the glass, and a hairline crack running into the glass from the top-right corner only; the centre is flat black-violet #1a1220 so it tiles. hand-placed pixel art UI frame, every pixel on the art-pixel grid, no anti-aliasing, no dithering, transparent outside the frame.
```
