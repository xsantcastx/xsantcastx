# Art style upgrade — handoff

Owner, 2026-10-26: two reference shots (`docs/design/refs/art/`): "player and monsters and trees look more 3D … look at
that aura the player has and the details, that's what we need." Still pixel art (Terraria-crisp, one outline, light
from the upper left); the world is now richer, the figures finer and rounder.

## What a player gets

- **The ground**: dense clumped grass in six greens with lighter and darker meadow patches, scattered flowers (white,
  yellow, violet, blue, rose) and small shaded stones; worn dirt roads with grass growing in over a ragged edge and a
  dark lip of shade. Moss (Verdant), peat and black puddles (Umbral), sand with shells, and dark dungeon floors (grit,
  cracks, old bones) are painted the same way.
- **Trees**: round domed crowns made of many small lit leaf clusters over a dark heart, a crisp outline, a visible
  trunk, a soft shadow cast down and to the right. Pines in four tiers; jungle, giant and swamp crowns, bushes and
  boulders use the same clusters.
- **Shadows** under everything that stands (Keepers, townsfolk, other players, creatures, the raised, pets), drawn on
  the ground so they never cover a neighbour's feet.
- **Figures 1.5× finer** (more art pixels, not just zoom): the Keeper's front/back views are painted on a 42×60 fine
  grid (the layout is the old 28×40 grid grown by `FRONT_K`), with the face, hair strands, the blade and the cape's
  folds painted at the fine grid; one dark outline (heavier on the shaded side); a volume pass that lights the whole
  figure round. The side view takes a matching fine sheet whenever it is drawn at 1.5×. Creatures and pets are painted
  grown the same way (bosses grow less) with a darker outline and the volume pass; skeletons carry a proper sword and
  a round wooden shield (the Warlock's raised: violet, with a glowing rune). The Ashguard wears a wine-dark watch cape.
- **Auras**: the reusable aura look (`td-aura.ts`): a claimed floor in the aura's colour, three layered rings in 3/4
  view (bright dashes with dark gaps, turning, sparks running round), rising motes (≤ 10), and a rim-glow round the
  figure's outline. Every running aura skill uses it in its element; `AURA_LOOKS.arcane` is the owner's violet.
  Reduced motion: still rings, no motes.

## How it works

| File | What |
|---|---|
| `play/td/td-ground.ts` | Seamless 128-px textures of ramp indices, sampled at the world pixel; meadow noise dithered in; per-tile extras; ragged worn edges (`richEdge`). Baked into the engine's chunk cache. |
| `play/td/td-flora.ts` | `broadleafTree`, `pineTree`, the clump painter (`paintClump`, `clumpRamp`, `paintClumps`), `shadowSprite`. `td-art tree()` delegates; `flatTree` keeps the old look for galleries. |
| `play/td/td-shade.ts` | `castShadow`; the engine's `drawShadows` ground pass (objects' `Sprite.shadow`, then entities). |
| `play/td/td-aura.ts` | `AuraLook`, `AURA_LOOKS`, `auraFrom(tones)`, `AuraFx` (ground / air / motes), `rimGlow`. Engine: `auraLook()`, `window.__tdArt.aura()` (webdriver only). |
| `shared/keeper-look/keeper-volume.ts` | The volume pass (`volumize`, `volumizeData`): a relief from the silhouette lit from the upper left; outline, eye glints and pupils untouched. |
| `shared/keeper-look/keeper-front.ts` | `FRONT_K` = 1.5; `P` grows art-grid shapes, `F`/`FM` paint fine pixels; fine eyes/brows/nose/mouth, blade, cape, `strands`; `drawWornFront` grows the live particles. `FRONT_W/H/AX/AY` are now fine-grid values. |
| `shared/keeper-look/keeper-paint.ts` | `FIGURE_K`, `fineScale`; a second (fine) sheet per painter made only on a 1.5× draw; the live arm/weapon grown with it. Whole-number scales keep the art sheet exactly. |
| `play/td/td-mobs.ts` | `mobK`, `mobCell`: sheets painted grown; `w`/`h` (reach, hit boxes, where blows land) unchanged. `grown()` now composes. Darker selective outline + a second pixel on the shaded side. |
| `play/td/td-pet-art.ts` | Pets grown by 1.5 with the volume pass; `PET_W/H` are fine values. |
| `play/td/td-engine.ts` | Desktop camera 3 css px per art px (4 from 1040 px tall); head-height anchors and keeper tap boxes `up()`-grown; creatures drawn from `vis(def)` (their cell). |
| `play/lobby/camp-art.ts` | Campfire ring re-spaced for the taller figures; narrow stages take the tall ring. |

## Tools

- `node scripts/art-gallery.mjs <out.png> [scale] [keeper,mobs,trees,ground,aura,pets]` — every family, before/after.
- `ART_SHOTS=<prefix> PW_PORT=… npx playwright test e2e/td-art-shots` — the forest road at 1280×800 and 390×844
  (`ART_AT=c,r`, `ART_ROAD=0` to stand on a tile instead); shots in `docs/handoff/art/`.
- `ART_PERF=1 [ART_CPU=4] … e2e/td-art-perf` — frame times and the paint caches' canvas pixels.

## Performance (2026-10-26, headless Chromium)

| | before | after |
|---|---|---|
| Desktop 1280×800, frame mean / p95 | 16.62 / 18.30 ms | 16.64 / 17.80 ms |
| Phone 390×844, CPU ×4, mean / p95 | 16.65 / 18.40 ms | 16.60 / 18.40 ms |
| Phone, CPU ×10, mean / p95 | 16.58 / 18.50 ms | 16.73 / 18.50 ms |
| Canvases made (desktop / phone) | 249 / 188 | 248 / 194 |
| Canvas pixels, the paint caches (desktop / phone) | 4.42 / 2.39 Mpx | 5.46 / 3.54 Mpx (+≈4 MB each) |

Everything new is baked once (chunks, sprites, sheets); per frame there is only the aura (a few hundred pixels and ≤ 10
motes) and the rim-glow (one small scratch draw).

## Not done / next

- Monster auras (the DM's D2-style design) and gear auras: build them on `AuraFx` with `auraFrom(element tones, dark)`.
- The side view's face is the art grid's (only the front/back faces are painted at the fine grid).
- Houses, stalls and town props keep their art-grid look; the figures now stand about 3¼ tiles tall beside them.
- Phone zoom is unchanged (1.5): more would put creatures' sight beyond the visible half-width.
