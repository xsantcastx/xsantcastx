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
- **Auras** (owner 2026-10-26: "only have light auras flashing around, like the radius use effect, not a constant
  circle"; docs/handoff/edges/): the reusable aura look (`td-aura.ts`) leaves nothing standing on the ground. A rim-glow
  round the figure's outline, motes and white-hot flickers rising round the body (≤ 10), and a brief light ring that
  runs out to the aura's reach when it starts, on a tick that reaches a foe, and as a 3.2 s heartbeat. Pack-aura bearers
  keep only their small sigil underfoot, with the same brief reach pulse (Lightless: a small dark smudge). Low: a faint
  one-pixel rim, no motes. Reduced motion: no pulses, no motes; the rim only.
- **Terrain edges** (`td-terrain.ts`, docs/handoff/edges/): grass, flowers, moss, dirt roads, sand, bog, cobble and
  water meet along curved, noisy, blended edges with round corners; wet sand, two lines of foam lapping over the water's
  frames, shallows paling to the deep. Baked into the ground chunks at the art grid; Low keeps the square painters.

## How it works

| File | What |
|---|---|
| `play/td/td-ground.ts` | Seamless 128-px textures of ramp indices, sampled at the world pixel; meadow noise dithered in; per-tile extras; ragged worn edges (`richEdge`). Baked into the engine's chunk cache. |
| `play/td/td-flora.ts` | `broadleafTree`, `pineTree`, the clump painter (`paintClump`, `clumpRamp`, `paintClumps`), `shadowSprite`. `td-art tree()` delegates; `flatTree` keeps the old look for galleries. |
| `play/td/td-shade.ts` | `castShadow`; the engine's `drawShadows` ground pass (objects' `Sprite.shadow`, then entities). |
| `play/td/td-terrain.ts` | `paintFieldTile` (the organic edges, per pixel from the 3×3 neighbourhood and per-class noise) and `organic(ground)`; the engine's `bakeRows` calls it first and skips `paintEdge` between two organic grounds. |
| `play/td/td-aura.ts` | `AuraLook`, `AURA_LOOKS`, `auraFrom(tones)`, `AuraFx` (pulse / waves / air / motes), `auraWave`, `rimGlow`. Engine: `auraLook()`, `window.__tdArt.aura()` / `.pulse()` (webdriver only). |
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

## Stage 4 (2026-10-26): structures, roofs, interiors, dungeon dressing, water

What a player gets: dungeon fronts and doors that stand a head over the fine-grid Keeper (the Ashen Crypt's columns and
skull pediment with violet grave-lights, the cave mouth's shaded boulders and timber props, iron-banded Barrow doors in
basalt jambs, the Forge gate's broken lintel and braziers, the temple's mossy stepped front), stairs that recede into
the dark, the tower drawn round, ruins with ragged tops and ivy, three ships with billowing shaded sails, rigging,
a stern cabin and foam at the waterline. Roofs in courses (clay scallops, cut slate, combed thatch) lit on the far
slope, a ridge cap, bargeboards, moss. Inside: walls two tiles tall (plaster over a panelled wainscot, a ceiling beam,
the odd picture), staggered boards with nails, woven rugs with a border and fringe, the inn's furniture repainted at the
fine scale. Dungeons: rock faces two tiles tall in rough ledges, damp at the foot, a shadow on the floor under them.
Water: deeper away from the shore, wavelets rocking a pixel over the four frames, lapping foam, the bank's and a pier's
shadow, pilings with a ring of foam; piers lay their planks across, bridges along.

| File | What |
|---|---|
| `play/td/td-build.ts` | The structure kit (`blocks`, `boards`, `strap`, `doorway`, `column`, `flame`, `plinth`, `paintCone`, `paintRoof`, `paintChimney`) and every structure painter; td-art's `caveMouth`, `cryptDoor`, `forgeGate`, `templeGate`, `barrowDoor`, `stairsDown/Up`, `ladderUp`, `mineShaft`, `tower`, `ruinWall`, the ships, `table`/`bed`/`shelf`/`counter` and `house`'s roof delegate here. `ruin`, `table`, `bed`, `shelf`, `counter` left `GROWN` (painted at the fine size, same anchors). |
| `play/td/td-floors.ts` | `paintFloor` for `plank`, `rug`, `wall`, `rock`, `water` (called first by `paintRichGround`, which now takes the water frame); `floorEdge` (these painters own their edges). Water's frame-independent shore distances are cached per tile. Fish-shadow hook: `fishShadow(len)`, `openWater(nb)` (nothing swims yet). |
| `play/td/td-dressing.ts` | campaign #4's props. td-art: `altar()`, `brazier(lit)`, `cage()`, `chains()`, `brokenStatue()`, `inscription()`, `cobweb(corner)`, `ritualCircle()`, `oldStain()`, `rime()`, `sealedDoor(n)`. MapObject ids (td-level): `altar`, `brazier`, `brazier-lit` (light r 64 = four tiles), `cage`, `chains`, `statue-broken`, `cobweb`, `circle`, `inscription`, `stain`, `rime`; blocking: altar, both braziers, cage, statue. Chains and inscription hang on a wall's face tile; the inscription's station and i18n line are the builder's. |
| `Sprite.floor` | A floor decal drawn in the ground pass (engine `drawShadows`), under everything that stands. |
| engine `chunk()` | A liquid chunk bakes frame 0 at once and frames 1–3 one a draw (`frameBudget`), so crossing onto water never stacks four bakes in one frame. |

Cameras: `node scripts/art-gallery.mjs <out> 4 structures,harbour,interior,dungeon`; `ART_SHOTS=<prefix> … e2e/td-art-shots`
now also photographs the Barrow vault's doors, Ember Harbour, the Ember Inn and Ember Mine −1 (`__tdArt.visit(level, c,
r, continent)`, webdriver only); `ART_PERF=1 ART_VISIT=level,c,r,continent ART_PAN=1 … e2e/td-art-perf` measures any spot,
`ART_PAN` stepping the Keeper a tile six frames so chunks bake mid-run (prints the worst frame too).
Shots: `docs/handoff/art/art4-gallery-before.png` / `art4-gallery-after.png`, `art4-{barrow-door,harbour,inn,mine,town}-{desktop,phone}.png`.

Performance (headless Chromium, mean / p95 / worst frame ms; the paint caches' canvas pixels):

| Scene | Desktop 1280×800 | Phone 390×844, CPU ×4 |
|---|---|---|
| Forest road (stage 3 scene) | 16.63 / 17.80 / 18.6, 5.49 Mpx | 16.60 / 18.50 / 18.7, 3.57 Mpx |
| Ember Harbour (water, pier, ship) | 16.63 / 18.30 / 18.6, 6.53 Mpx | 16.64 / 18.60 / 18.7, 4.60 Mpx |
| Ember Mine −1 (rock faces) | 16.65 / 18.10 / 18.6, 6.16 Mpx | 16.63 / 18.40 / 18.7, 4.23 Mpx |
| Ember Inn (walls, boards, furniture) | 16.66 / 18.10 / 18.7, 5.89 Mpx | 16.64 / 18.40 / 18.8, 3.96 Mpx |
| Walking the harbour shore (chunks baking) | 16.65 / 18.10 / 18.6 | 16.90 / 18.50 / 50.8 (was 116.5 before the one-frame-a-draw bake) |
| Walking the forest (chunks baking, for comparison) | 16.65 / 18.10 / 18.7 | 16.97 / 18.50 / 68.4 |

Not done (stage 4): the Lantern Tower, vinewall/drownwall/flagstone/wetstone/cobble faces and the stalls keep their
older paint; the lit brazier's flame is still (no flicker frames); lighting an unlit brazier and placing any of the new
props is the atmosphere pass's work.

## Not done / next

- Monster auras (the DM's D2-style design) and gear auras: build them on `AuraFx` with `auraFrom(element tones, dark)`.
- The side view's face is the art grid's (only the front/back faces are painted at the fine grid).
- Houses, stalls and town props keep their art-grid look; the figures now stand about 3¼ tiles tall beside them.
- Phone zoom is unchanged (1.5): more would put creatures' sight beyond the visible half-width.
