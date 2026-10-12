# Ember Delve — handoff

## Works
- `engine/terrain.ts`: a grid of 32px cells (node list `TERRAIN_NODE_LIST`: dirt, rock, hard-rock, cinder/slag/heartstone veins, cracked-wall, roots, bedrock, ember-rock, cache). It has per-cell HP, crack stages, seeded `generateTerrain(spec)`, `stepTerrainBody` collision (walls, a one-cell step-up, floors, ceilings, a cap on fall speed) and `coneCells`.
- `engine/terrain-render.ts`: chunks of 8×8 cells, each cached on an offscreen canvas (an LRU of 36) and repainted only when its revision changes. It also has a fixed pool of 140 debris and dust particles.
- `engine/lighting.ts`: one offscreen darkness layer at half resolution. Lights are cut out of it with `destination-out` and a single cached gradient, with at most 24 lights per frame. It also holds the pure math (`lightFalloff`, `darknessAt`, `selectLights`, `ambientDarkness`).
- Engine: in an area with `terrain`, the camera follows the Keeper vertically. Figures draw at half size (`figureScale`). J swings at the column in front of the Keeper, or below it while S/Down is held. Holding the button keeps swinging. Clicking or tapping a cell within reach swings at it (`strikeAt`). L fires the staff blast, a cone with a flash of light. Breaking a cell triggers hitstop, shake and crumble effects. Monsters use `floorY`/`range`, and drops have a `y`.
- Data: `EMBER_DELVE` in `towns/infernal.ts` is 120×40 cells. Its entrance is the `delve` station at x=590, next to the ore station. It contains a root tunnel, a Maw cavern on a bedrock floor, a cracked-wall pocket with a cache, and a deep heartstone vein.
- Host: `provisionalToolTiers()` (marked TODO(skills-agent)). Ore goes through `resolveMine`, which skips the call while the seam is recovering. There are touch buttons for Down and Blast.

## APIs
- `engine.setTools({ pickaxe?, axe?, sickle?, blade?, staff?, lanternRadius?, levels? })`. Tiers are numbers and 0 means no tool. `levels` (for example `{ mining: 8 }`) makes the engine clang before it asks the host.
- `onWorldAction(e: { kind: 'mine'|'chop'|'forage'|'cut'|'blast'; areaId; cellKey: 'col,row'; materialId?; qty?; discipline; xp; mutationId })` returns `boolean | void`. `false` means the cell stays standing, cracked at its last stage, and the next hit asks again. `mutationId` is the same for every retry on a given cell.
- Node format: `{ id, label, solid, hp, tools: {pickaxe: 1, ...}, discipline, xp, yield?: {materialId, qty, chance?}, minLevel?, glow? }`. Damage per hit is `1 + (tier - min) / 2`. Cells with no xp and no yield break without asking the host.

## Stubbed / not done
- Dug state is session-only and stays put while you move between areas. A page reload restores fresh rock. Nothing is persisted.
- XP for non-mining actions (roots, cache, cracked wall) is not granted. Only their material goes through `inventory.grantStack(mutationId:material)`. This needs `ActivityProgressionGateway.resolveWorldAction`, a sibling of `resolveMine` with the same idempotency, plus specs.
- With provisional tiers the pickaxe is always I, so slag (Pickaxe II) and heartstone (Pickaxe III) always clang. The staff is 1 only when a weapon whose name matches staff, wand, rod or sceptre is equipped.
- There are no specific tests for blast or render. Neither `ng build` nor any browser check has been run.

## Next steps
1. Play it: check how digging feels, how the lantern and glints read, and whether stepping up and falling feel right. Check the frame rate on a phone, since chunk resolution is capped at 2× and the darkness is drawn at half resolution.
2. Add `resolveWorldAction` and route chop/forage/cut/blast through it in `side-scroller.worldAction()`.
3. Replace `provisionalToolTiers` with the skills agent's `toolTiers()`.
4. If dug state should persist, write `{areaId: dug cell keys}` through GameStateGateway (register it with LocalSaveRegistry).
