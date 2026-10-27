# Isometric ground dressing (trees, props, ground items), handoff

Branch `isoprops`. Art: `src/app/play/td/td-iso-props.ts`. Spec: `td-iso-props.spec.ts`. Camera: `e2e/td-iso-props-shots.spec.ts`
(`PROPS_SHOTS=1 PROPS_TAG=after PW_PORT=… npx playwright test e2e/td-iso-props-shots --project=chromium`, which writes to `output/iso-props/`).
Committed shots: `docs/handoff/iso-props/`.

## What a player gets (Isometric only; Classic is unchanged)
- **Every tree is iso-native HD**, built on the Keepers' sculptor and light. Covered: oak, fruit tree, pine (Emberwood),
  jungle broadleaf, palm and giant (Verdant), and cypress, living and dead (Marches). Each has a trunk and a volumetric
  crown, a cast shadow down and to the right, and a gentle sway (three frames, each tree on its own slow beat, never
  under reduced motion). The crown eases to 45% while the Keeper, his target or a hostile within six tiles stands
  behind it.
- **Props are iso-native.** Covered: barrel, crate, bench, lamp, signpost, cart, fountain, hearth ring, forge, anvil,
  waystone, beacon, torch, root lamp, Marches lantern post, Great Lantern, chest, bones, stump, boulder, standing
  stone, grave, temple pillar, ore seam, flowerbed, bush, fern, reeds and gloomcap.
- **Fences** are laid a tile at a time, each tile sorted at its own depth, and a run joins the next across a one-tile gap.
- **Ground items:** a loot icon lies tipped back onto the floor at 1.25× the satchel icon, with a light rim, a pixel of
  thickness and a contact shadow. Gold piles and sacks get the contact shadow too. Beams, halos, plates, Alt labels,
  the ×N pile badge and taps are unchanged.
- **The Sexton's chalk marks** are sheared onto the grave's face.
- **Pets and Glim** are HD in Isometric at every detail level. Before, Low (the default on ≤4-core or ≤4 GB phones)
  fell back to the classic pets and Glim. The HUD pet face follows.

## How
- Each painter is found by the top-down sprite's cache key: `td-art spriteKey()`, a WeakMap filled in `cached()`. The
  maps and builders are untouched.
- Six seeds of a tree kind fold onto three sculpts (`canonKey`), each tinted a half-step apart.
- **Baking:** a sculpt is baked once, on first sight. It bakes one a frame while the Keeper stands; while he walks, a
  sculpt waits for a spare frame, or for 24 frames at most. Until it bakes, the old sprite is drawn.
- Low uses fewer, larger clusters, one frame and no sway.
- Engine edits in `td-engine.ts` (the iso branches only):
  - the `K.art` queue kind and its draw
  - the shadow pass
  - the fade points
  - the drop icons
  - the chalk shear
  - the pet and Glim `hdFigures()`
  - the `__tdArt.isoProps()` probe

## Numbers
- **Bake cost:** about 4 ms a tree on desktop after warm-up (the giant about 10 ms).
- **Memory:** about 0.4 Mpx of baked canvas for a whole wood.
- **Phone perf:** see the report for the A/B (`TD_PERF=1 ARTOPT=iso TD_WEATHER=clear`). Weather and machine load move
  the numbers by several ms, so pin `TD_WEATHER` and run A and B back to back.

## Left
- **First walk into a new wood on a slow phone:** a bake that falls due mid-walk still costs one long frame (about
  25–40 ms at ×6). Possible fixes: pre-baking the next chunk's keys while standing, or slicing the bake (sculpt, then
  render) across frames.
- **Not covered, so they still draw top-down:**
  - walls, buildings, stalls and ships (another builder's scope)
  - ruin walls
  - the dungeon dressing (altar, brazier, cage, chains, statue, cobweb)
  - stairs and ladders
- **Director notes not done:** trimming forest density at the map level, and a rune line on the harbour standing stone.
