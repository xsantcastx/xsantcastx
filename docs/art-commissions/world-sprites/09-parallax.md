# Parallax backgrounds (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

Spec **W8** (style guide §8): four layers per town or hunting ground, back to front `sky`, `far`, `mid`, `near`, each 480x192 art px, seamless left to right, exported x8. They replace the painted `bg-*` backdrops in the world. This pack briefs the **Basalt Seamworks** set only, for the A/B; the other four realms and the hunting grounds are briefed after the verdict, from the same template and the realm palettes in style guide §5.2.

### `parallax-infernal-sky` — Infernal parallax: Sky  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Parallax/01-parallax-infernal-sky.png` + sidecar `Assets/Sprites/Parallax/01-parallax-infernal-sky.json` |
| Spec | W8 parallax layer (pixel art) - 480x192 art px, seamless left to right, export x8 nearest-neighbour = 3840x1536, opaque |
| On screen | 1920 x 768 logical px per repeat (4 px per art px), tiled horizontally |
| Priority | P0 |
| Used in | Basalt Seamworks (Infernal town and hunting ground) in-world background, `sky` layer, scroll factor 0.0-0.05; replaces the painted bg-basalt-seamworks as soon as all four layers are imported (style guide IMP-2, RND-2) |
| Shows today | the painted bg-basalt-seamworks backdrop |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 3840, "h": 1536}, "actions": [{"name": "layer", "frames": 1, "fps": 0, "loop": false}]}` |

_Scroll factor 0.0-0.05. The `Sprites/Parallax` family imports it and the town draws it once all four layers have landed (style guide IMP-2, RND-2)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
the Basalt Seamworks sky: a low ember-dusk sky over the forge quarter in five flat colour bands from #120a0c at the top through #2a1210 and #4a1c14 to #7a2e1a at the horizon, one 2-tone checker row between bands, a dark eclipse disc with a thin #a855f7 and #ffd08a corona in the upper left, a few ash flecks #8a7468. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one parallax layer, 480x192 art px, seamless left to right, the bottom edge is the town ground line, opaque, atmospheric perspective towards the horizon colour. hand-placed pixel art for a 2D sandbox side-scroller background, every pixel on the art-pixel grid, flat colour shapes with 2 to 3 tones each, no outline except on the near layer, light from the upper left, colours pulled towards the horizon colour the further back the layer sits, no anti-aliasing, dithering only as one 2-tone checker row between sky bands; export with nearest-neighbour x8 to 3840x1536 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, characters, people, creatures, readable signs, light from the right, walkable platforms, foreground objects in the walk lane, outlines on far layers
```

### `parallax-infernal-far` — Infernal parallax: Far ridge  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Parallax/02-parallax-infernal-far.png` + sidecar `Assets/Sprites/Parallax/02-parallax-infernal-far.json` |
| Spec | W8 parallax layer (pixel art) - 480x192 art px, seamless left to right, export x8 nearest-neighbour = 3840x1536, transparent above the silhouette |
| On screen | 1920 x 768 logical px per repeat (4 px per art px), tiled horizontally |
| Priority | P0 |
| Used in | Basalt Seamworks (Infernal town and hunting ground) in-world background, `far` layer, scroll factor 0.15-0.25; replaces the painted bg-basalt-seamworks as soon as all four layers are imported (style guide IMP-2, RND-2) |
| Shows today | the painted bg-basalt-seamworks backdrop |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 3840, "h": 1536}, "actions": [{"name": "layer", "frames": 1, "fps": 0, "loop": false}]}` |

_Scroll factor 0.15-0.25. The `Sprites/Parallax` family imports it and the town draws it once all four layers have landed (style guide IMP-2, RND-2)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
the far horizon of the Infernal realm: a jagged basalt ridge with the silhouettes of great forge chimneys and the broken ring of a Godforge-era furnace, rim-lit along the top by the ember sky, at most 4 colours close to the horizon colour #7a2e1a, no outline. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one parallax layer, 480x192 art px, seamless left to right, the bottom edge is the town ground line, transparent above the silhouette, atmospheric perspective towards the horizon colour. hand-placed pixel art for a 2D sandbox side-scroller background, every pixel on the art-pixel grid, flat colour shapes with 2 to 3 tones each, no outline except on the near layer, light from the upper left, colours pulled towards the horizon colour the further back the layer sits, no anti-aliasing, dithering only as one 2-tone checker row between sky bands; export with nearest-neighbour x8 to 3840x1536 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, characters, people, creatures, readable signs, light from the right, walkable platforms, foreground objects in the walk lane, outlines on far layers
```

### `parallax-infernal-mid` — Infernal parallax: Foundry terraces  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Parallax/03-parallax-infernal-mid.png` + sidecar `Assets/Sprites/Parallax/03-parallax-infernal-mid.json` |
| Spec | W8 parallax layer (pixel art) - 480x192 art px, seamless left to right, export x8 nearest-neighbour = 3840x1536, transparent above the silhouette |
| On screen | 1920 x 768 logical px per repeat (4 px per art px), tiled horizontally |
| Priority | P0 |
| Used in | Basalt Seamworks (Infernal town and hunting ground) in-world background, `mid` layer, scroll factor 0.4-0.5; replaces the painted bg-basalt-seamworks as soon as all four layers are imported (style guide IMP-2, RND-2) |
| Shows today | the painted bg-basalt-seamworks backdrop |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 3840, "h": 1536}, "actions": [{"name": "layer", "frames": 1, "fps": 0, "loop": false}]}` |

_Scroll factor 0.4-0.5. The `Sprites/Parallax` family imports it and the town draws it once all four layers have landed (style guide IMP-2, RND-2)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
mid-distance foundry terraces: stepped basalt walls, iron gantries and cranes, furnace mouths seen as small #E8752A windows, two thin heat-haze bands; at most 6 colours, no outline. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one parallax layer, 480x192 art px, seamless left to right, the bottom edge is the town ground line, transparent above the silhouette, atmospheric perspective towards the horizon colour. hand-placed pixel art for a 2D sandbox side-scroller background, every pixel on the art-pixel grid, flat colour shapes with 2 to 3 tones each, no outline except on the near layer, light from the upper left, colours pulled towards the horizon colour the further back the layer sits, no anti-aliasing, dithering only as one 2-tone checker row between sky bands; export with nearest-neighbour x8 to 3840x1536 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, characters, people, creatures, readable signs, light from the right, walkable platforms, foreground objects in the walk lane, outlines on far layers
```

### `parallax-infernal-near` — Infernal parallax: Smokestacks  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Parallax/04-parallax-infernal-near.png` + sidecar `Assets/Sprites/Parallax/04-parallax-infernal-near.json` |
| Spec | W8 parallax layer (pixel art) - 480x192 art px, seamless left to right, export x8 nearest-neighbour = 3840x1536, transparent above the silhouette |
| On screen | 1920 x 768 logical px per repeat (4 px per art px), tiled horizontally |
| Priority | P0 |
| Used in | Basalt Seamworks (Infernal town and hunting ground) in-world background, `near` layer, scroll factor 0.65-0.75; replaces the painted bg-basalt-seamworks as soon as all four layers are imported (style guide IMP-2, RND-2) |
| Shows today | the painted bg-basalt-seamworks backdrop |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 3840, "h": 1536}, "actions": [{"name": "layer", "frames": 1, "fps": 0, "loop": false}]}` |

_Scroll factor 0.65-0.75. The `Sprites/Parallax` family imports it and the town draws it once all four layers have landed (style guide IMP-2, RND-2)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
the near background behind the walk lane: thick iron-black smokestacks, slag heaps with #ff9b4f ember seams, a hanging chain and a cold crane hook; the bottom 24 art px low, dark and flat so nothing looks walkable; at most 8 colours, a 1 px outline lighter than any play-layer outline. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one parallax layer, 480x192 art px, seamless left to right, the bottom edge is the town ground line, transparent above the silhouette, atmospheric perspective towards the horizon colour. hand-placed pixel art for a 2D sandbox side-scroller background, every pixel on the art-pixel grid, flat colour shapes with 2 to 3 tones each, no outline except on the near layer, light from the upper left, colours pulled towards the horizon colour the further back the layer sits, no anti-aliasing, dithering only as one 2-tone checker row between sky bands; export with nearest-neighbour x8 to 3840x1536 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, characters, people, creatures, readable signs, light from the right, walkable platforms, foreground objects in the walk lane, outlines on far layers
```
