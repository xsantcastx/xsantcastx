# Homestead — handoff

A plot you can see, off the Basalt Seamworks. The gate "YOUR HOMESTEAD" stands at x 1075 in the Infernal town.

## What is real
- **The Forge**, clickable, in the middle of the plot. Clicking it, tapping it or pressing E strikes it through the same calls the Forge Flame makes
  (`IdleService.strike` → `EconomyService.strike` → `ComboService.strike`). Each strike plays a squash, sparks and a "+N", and coins arc to the Treasury.
- **Buildings column** (`homestead-column.component`): one row for every FORGE_UPGRADES and AUTO_CLICKERS rung, cheapest first. Each row shows the owned
  count, the true "+X Gold/s" (goldPerSecond with one more level), the live `nextCost` and the shortfall. One "??? — unlocks at" row comes next.
  Buying calls `purchaseListing`, and the action id is kept until the purchase settles.
- **Plot buildings**, all drawn from real state:
  - Treasury: Gold held and multipliers owned.
  - Furnace: forge rungs.
  - Automatons: one figure per level.
  - Explorer Camp: one tent per slot. Explorers walk out and back from `startedAt+duration` (works-map maths).
  - Thrall Workshop: the hammer angle is `cycleAt(lastRollAt, rollInterval)`.

  An unbuilt plot shows a plain "Unlock: … · cost" sign.
- **Collect by walking**: a receipt for this session, built from `gain$` (idle Gold, split by the real breakdown), `returned$` and `find$`.
  The services have already credited all of it. Walking past only clears the receipt and plays the animation, so nothing is credited twice.
- **Building panel** (`homestead` PanelId): one sentence and ONE button. The button buys the rung with the best gain per Gold, or the next slot.
  A locked button says why in plain words. Details holds the rest.

## Engine hook contract (`engine/homestead-render.ts`)
- `engine.setHomesteadView(view | null)` plugs the view in or removes it.
- `view.draw(ctx, frame)` runs every frame in world space, after the ground and before the stations.
- `view.paints(areaId, stationId)`: when true, the engine draws only the station's label and prompt.
- `view.interact(areaId, stationId)`: when true, the view has handled E.
- The engine.ts change is about 13 lines and imports only types.

## Rebalance hooks
- Prices and rates are read live (`nextCost`, `levelOf`, `goldPerSecond`, `perClick`). The rung lists in `homestead.service.ts` come from the catalogue arrays.
- `REVEAL_SHARE` in `homestead.model.ts` sets when a column row appears.
- `HomesteadService.goldenSpark()` / `goldenSpark$` only plays the effect. Credit any bonus through EconomyService first.

## Next steps
- Not yet checked in a browser, and `ng build` has not been run. To play: /play, then walk to the gate.
- The art is placeholder drawn in code. Swap in sprites through `frame.art(key, …)`.
- The receipt lasts only for the session and is lost on reload. Offline earnings stay with the existing summary.
- Side-scroller changes: imports and inject, `start/stop`, `setHomesteadView`, a click line for the Forge, the objective and action labels, one template line.
