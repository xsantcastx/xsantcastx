# Iso spells, combat effects, dungeon dressing and the standing-pass perf: handoff (branch `isofx`, 2026-11-02)

This branch changes Isometric (the live default) only. Classic is unchanged: every new path is behind `this.iso`, and
the top-down painters keep their own squash.

## What a player gets
- **Spells and the fight read at the iso angle** (`td-iso-fx.ts`):
  - **The ground effects.** The aura's pulse, Hellfire Nova, the S6 ability rings and tells, hazards, a boss's breath
    cone, a charge lane, a summons' sigil, Fire Enchanted's ring, the loot rings and the class zones used to be drawn
    under a rotated transform. Every pixel became a soft tilted diamond, and the rings that were already squashed for
    the 3/4 view came out squashed twice and tipped over. Now a floor projector (`IsoFloorFx`) stands in for the canvas
    during that pass:
    - each world pixel lands as the 2 × 1 iso pixel it covers, axis-aligned and crisp;
    - a world line is the classic 2:1 iso step, and a world circle is a true iso ellipse;
    - a reach (an aura's, a tell's) shows its true radius;
    - a dressing ring (under a creature, under loot, a summons' sigil) keeps its old on-screen size (`deco`).
  - **Uprights stand.** The thorns of a Snare or Trap and the Hearth Circle's little fire stand upright (`standAt`).
  - **Height.** A spark, slash or hit on a foe's body now stands on that creature's foot (`airFoot`). Before, it slid
    half the creature's height off to the right.
  - **Shadows.** Bolts, creatures' shots, Bone Spears, arrows and a falling meteor cast a small soft shadow on the
    floor, down and to the right of their foot. It moves further out and fades the higher they fly.
- **Dungeon dressing, ruins, stairs and ladders** as HD iso twins (`td-iso-props.ts`, found by spriteKey):
  - altar, brazier (cold and lit), hanging cage, wall chains, broken statue, corner cobweb;
  - the three ruin walls;
  - stairs down (cut into the floor) and stairs up (into a shaft of light);
  - ladder up.

  The stairs down, the cobweb and the chains sort behind what stands on their tile (`IsoArt.back`).
- **Polish from the iso-walls review:**
  - **Posts.** A free-standing post or one-tile pillar in the wedge in front of the Keeper drops to its stub. It no
    longer shows as a dithered ghost column.
  - **Stall goods.** These are now small HD pieces: bottles and tied jars, loaves and buns, cut gems on a cloth, stacked
    books, laid fish and a hammer. Before, they were coloured bars.
  - **The fog edge.** On desktop, the iso light map is one buffer px per iso px. Its steps and rim fade through a 4×4
    Bayer dither pinned to the world (`isoLightOpen`, `isoWarmAt`). Phones and Low keep the half-resolution map, with
    flat steps instead of the coarse checker. That also smooths the blocky light-pool bands.
  - **The unlit Cold Hearth** has a warm ember-ash bed under its logs and a two-step dark contact shadow under the ring.
  - **The translucent blue box in dungeons** was the night silhouette. It was cut from the classic sheet's frame (a
    different size; a filled cell for some kinds) under an HD creature. Iso now cuts it from the HD cell itself.

## Perf (item 0)
- **Where the town's time went:** the HD townsfolk. Their cell bakes, at about 20+ ms a cell at CPU ×6, ran on nearly
  every frame. The 16-ms budget window reset each frame on a slow phone. The structure strips cost 0.2–0.6 ms a frame
  and the tree and prop twins 1–2 ms (probe `__tdArt.isoKinds`).
- **What changed:**
  - **HD bakes** (`td-hd-keeper` budget, `td-hd-mob` `nextAt`) are now a share of the wall clock (a twentieth for figures, a thirteenth for creatures), banked to
    3 ms. A long bake is paid back before the next one starts. A figure with no baked cell still bakes at once.
  - **Structure strips** blit only their painted rows (`IsoStruct.rows`), and strips off the view's sides are not
    queued.
  - **Structure paint steps** on a frame already over budget run only every 4th frame (`STRUCT_STARVE`).
  - **Iso twin bakes** are two steps on two frames (shapes, then shading). While the Keeper stands, the spare frames
    bake the twins a screen ahead (`isoPropsBusy` look-ahead).
- **Numbers** (`TD_PERF=1 ARTOPT=iso TD_WEATHER=clear`, phone ×6, run back to back against 8071ca89, the pre-walls and
  pre-props baseline, on a quiet machine). Mean frame ms walking, this branch vs the baseline:

  | Scene | This branch | Baseline |
  |---|---|---|
  | road | 19.8 | 34.7 |
  | town | 24.1 | 29.4 |
  | harbour | 18.9 | 19.3 |
  | dungeon | 19.8 | 21.5 |
  | hot spot | 21.2 | 24.3 |
  | many kinds | 22.3 | 25.5 |

  Standing is level, 16.7–18.8 against 16.7–22.0. Engine work per frame, walking: town 11.1 vs 16.7 ms, road 8.5 vs
  19.0 ms. Earlier runs under load from other sessions were 3–6× noisier, so read the engine's `work mean`, not the
  frame mean.

## Low (Environment detail)
- The floor projector draws what Low already drew: the same pixels, just placed crisply.
- Projectile shadows draw their core only.
- The light map stays at half resolution, in flat steps.
- Stall goods drop their glints and string.
- The cold hearth's ember bed stays (it is one shape); its breathing coal is already Normal-only.

## Tools
- `ISO_FX_SHOTS=1 ISO_FX_TAG=after [ISO_FX_DETAIL=low] PW_PORT=… npx playwright test e2e/td-iso-fx-shots --project=chromium`
  writes `output/iso-fx/<tag>/<scene>-<size>.png`. The scenes are combat, boss, dungeon, stalls, hearth, crypt and inn.
- The camera hooks (webdriver only) are `__tdArt.fight()`, `boss()`, `dress()` and `freeze(on)` (`td-iso-fx-show.ts`).
- The perf probe: `__tdArt.isoKinds()` gives ms and count per queue kind, plus `structBake`. `td-perf-phone` prints
  it as `kinds …`.

## Not done
- The lit brazier's fire is a static sculpt, not an animated flame.
- The dungeon dressing is still on no map; the atmosphere pass places it.
- Air effects drawn in the world-UI pass (hit numbers, plates) are unchanged.
