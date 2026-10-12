# Sprite-sheet renderer (world layer)

The side-scroller can now draw world-layer sprite sheets (spec W1–W3, `docs/art-commissions/README.md`).
It uses a sheet for any figure whose sprite id is in `sprite-manifest.generated.ts`. Every other figure is
drawn as before: the mesh rig, or the code placeholder. **The manifest ships empty, so nothing on screen has
changed yet.**

## Put a sheet in the game (owner steps)

1. Save the sheet and its sidecar at the exact library path from the brief. For example, the Keeper:
   `~/Documents/1. Projects/Eclipse Realms/Assets/Sprites/Characters/01-keeper.png` +
   `01-keeper.json`. Rivet Maw goes in `Sprites/Creatures/01-rivet-maw.*` and Kael in `Sprites/NPCs/01-npc-kael.*`.
   The sidecar schema is in the commission README. Rows follow the order of the sidecar's `actions` list.
   You can list only some of the actions; the first test set lists idle/run/attack only.
2. From the repo root, run:
   ```bash
   python3 scripts/import-assets.py --check --only=Sprites   # validate only, writes nothing
   python3 scripts/import-assets.py --only=Sprites           # writes src/assets/game/sprites/** + the manifest
   ```
3. Run `npm start` and open `/play`.
   - **Keeper:** the player and every remote Keeper switch to the sheet.
   - **Rivet Maw:** it switches to the sheet in Basalt Seamworks.
   - **Kael:** he switches to the sheet at the Rune Forge in the Infernal town.
   - **Hard reload** if the old figure is still showing. The service worker caches assets.
4. Commit the new `src/assets/game/sprites/**` files and the regenerated `sprite-manifest.generated.ts`.

To roll back one figure, remove its entry from `sprite-manifest.generated.ts`. That figure goes back to the
rig. Remove the sheet from the library too, or the next import puts the entry back.

## Which sheet each figure looks for

| Figure | Sprite id | Library file |
|---|---|---|
| Player + remote Keepers | `keeper` | `Sprites/Characters/NN-keeper.png` |
| Creatures | the MonsterDef's `creature` key (`rivet-maw`, `prism-forager`, …) | `Sprites/Creatures/NN-<key>.png` |
| NPC keepers | world/life.ts `art` minus `-figure` (`npc-kael-figure` → `npc-kael`) | `Sprites/NPCs/NN-npc-<id>.png` |
| Townsfolk | `townsfolk-<realm>` | `Sprites/NPCs/NN-townsfolk-<realm>.png` |

## How game states map to actions

If an action is missing from the sheet, the renderer tries the fallback, then `idle`, then the top row.

- **Keeper:**
  - `idle`, `run` (fallback: walk), `jump` (fallback: fall), `fall` (fallback: jump), `dodge` (fallback: run), `hurt`.
  - `death` while the Keeper is down (fallback: hurt).
  - The resting pose by the fire uses `idle`.
  - **`attack`** plays its frames across the game's own 0.4 s attack window (`frameAtProgress`), not at
    the sheet's fps. The strike frame always lines up with the hit.
  - Loops run on the sheet's fps. One-shots (jump, hurt) run from when the action started, using a clock
    on each figure, and hold their last frame.
- **Creatures:**
  - `idle`; `recover` reads as idle.
  - **`windup`** and **`strike`** are timed to the game's windup (0.85 s) and strike (0.2 s) windows.
  - `hurt` shows while the hit recoil lasts.
  - `death` plays across the dissolve. A sheet with death frames skips the squash; the fade and embers stay.
- **NPC keepers:** `talk` while that keeper's line is showing, otherwise `idle`.
- **Townsfolk:** `walk` while moving, otherwise `idle`.
- **Reduced motion:** every figure holds frame 0. A dead creature holds its last death frame.

## What stays the same on sprites

- **Facing:** sheets face right, and the engine mirrors around the pivot. Creature paintings that face left
  keep their old `facesLeft` handling; sheets ignore it.
- **Hit flash:** a white copy of each frame, made with `source-atop`, is built the first time that frame
  flashes and cached for every later flash. This replaces the per-draw `filter: brightness()`.
- **Hitstop:** it freezes `elapsed`, so the frames freeze with it.
- **Knockback:** it still comes from the existing translate.
- **Keeper effects:**
  - The dodge smear draws two after-image copies.
  - The rim light on strike or wound draws an additive offset copy.
  - The wound flicker uses alpha.
  - The ground shadow, aura, name tag and step dust are unchanged.
- **Gear (`setLoadout`):**
  - The weapon sits on the frame's `hand_front` point and turns to its angle (degrees clockwise from up).
  - A frame with no angle swings the way the rig did.
  - A sheet with no anchors puts the weapon at the rig's old hand point.
  - The off-hand sits on `hand_back`.
  - The quest Basalt Edge rides the same anchor.

## API (`src/app/play/engine/sprite.ts`)

```ts
new SpriteRenderer(entry)                  // one per sheet, shared by all figures using it
  .action(wanted, fallbacks?)              // → resolved action name | null
  .draw(c, image, action, frame, { scale?, mirror?, flash?, offsetX?, offsetY? })  // pivot on origin; false = not drawable
  .anchor(action, 'hand_front', frame, mirror, out, scale?)  // pivot-relative point + canvas rotation
frameAt(action, seconds)                   // loops wrap, one-shots hold, fps 0 = still
frameAtProgress(action, 0..1)              // frames across a game-owned window
anchorAt / frameRect / imageScaleOf / resolveAction / tickClock / figureSpriteId   // pure
```

**Engine:** `EngineOptions.sprite?: (id) => SpriteEntry | null`. It defaults to `spriteFor` from the generated
manifest; tests inject fixtures. `readySprite(id)` returns the renderer only when the entry exists **and** its
image has loaded:

- The 2× sheet is used when `pixelScale > 1.25`, the 1× otherwise. Either one stands in while the other loads.
- While a sheet is listed but still loading, the rig draws.

**Town life:** `LifeFrame.sprite` and `LifeFrame.spriteImage` are optional.

**Crispness:** a sidecar with `"pixelArt": true` turns image smoothing off and snaps the draw to whole pixels.
The importer passes the flag through to the manifest entry (`pixelArt: true`) and rejects a non-boolean
value. The style guide asks for smooth sprites, so leave it out unless a sheet really is pixel art.

## Tests

`scripts/seamworks-engine.test.cjs` has ten new `sprite:` tests. They use a test sheet built in code (no PNG
shipped; images are faked by their dimensions). They cover:

- frame timing for loops, one-shots and stills
- the game-window timing of attack, windup and strike
- action fallbacks
- anchors: pivot-relative, mirrored, angle
- source and destination rects for 1× and 2× sheets
- mirror with offset
- pixel-art smoothing
- the flash cache: one canvas per frame, never rebuilt
- with a sheet: the engine's Keeper attack and weapon placement, and creature timing and facing
- with no sheet: the rig still draws
- NPC idle and talk, and townsfolk lookup
