# Iso walls, buildings and landmarks — handoff (branch `isowalls`, 2026-10-27)

Isometric (Beta) only; Classic is unchanged.

## What a player gets
- **Walls** (`td-iso-walls.ts`): each material is a painted set at the HD pixel, lit from the upper left — the inn's
  plaster over a board wainscot under a timber beam; the mine's hewn stone in staggered courses (cracks, an ember
  glint); the temple's mossy blocks hung with vines; the crypts' wet stone with a tide line and drips; the Bole's ridged
  bark under a moss cap. Cap lip and lit rim, quoins and an inked edge where a run ends, an arris on outer corners, a
  **lintel** over every one-tile doorway (a one-wide tunnel is not a doorway). Courses line up across tiles; four stone
  variants. Walls in the wedge in front of the Keeper are **dithered** (see-through); a room's camera-side walls still
  drop to stubs.
- **Houses and stalls** (`td-hd-structures.ts`): td-art `house()`/`stall()` now tag their sprite `iso` (an `IsoSpec`),
  and iso builds them at the angle: south front with door, step and windows (flower boxes), east side, east gable with a
  vent, shingled/thatched/slate roof over both slopes, stone chimney (smoke spawns at its mouth), a contact shadow.
  Stalls: counter of goods, posts, striped awning high enough that the stallkeeper's face shows, string lights. Strips
  sort at the footprint's front edge. **Keeper behind** (his body over the picture's solid pixels, his foot behind the
  front edge): the roof lifts off (a plank floor shows the room), the walls within 28 px of him dither, and nothing is drawn over
  his own figure, so he stays solid. Windows and string lights are night lights.
- **Landmarks**: the Cold Hearth (fieldstone ring, crossed logs, tripod and kettle; cold = ash and a breathing coal;
  lit = stepped HD flame and embers), the Hearth Shrine (plinth, five pips, brass bowl, flame when blessed), the purse,
  the Beacon, the waygate on a stone dais with its oval at the HD pixel.

## Perf
Structures are painted by generators a step at a time in the frame's spare time (`stepStructures`), queued a screen
ahead every 8th frame; until ready the old sprite stands in. Phone profile (×6 CPU, mean frame ms, walking) before →
after: road 17.48 → 16.89, town 17.60 → 17.62, harbour 16.74 → 16.69, dungeon 16.99 → 16.84.

## Low (Environment detail)
Walls: plain set (no moss/vines/drips/cracks/mottling); the wedge cuts to stubs instead of dithering. Structures: no
mottling/shingle noise/flower boxes, no wall dither (the roof still lifts), no stall light pools. Landmarks: no embers
or motes.

## Tools
`ISO_WALLS_SHOTS=1 ISO_WALLS_TAG=after PW_PORT=… npx playwright test e2e/td-iso-walls-shots --project=chromium` →
`output/iso-walls/<tag>/` (town, dungeon, harbour, hearth, inn, behind, crypt × desktop/phone; fails on a page error).

## Not done
- Towers, lantern towers, gates, temple gates, ships and other realm buildings still stand as top-down sprites.
- A lifted roof shows the ground inside (no interior floor/furniture).
- Smoke drifts in world space (diagonal on screen).
- Art & UX Director review (FIX; blockers 1–2 done: Keeper solid behind a house, plank floor under a lifted roof;
  walls and structures share keeper-paint `OUTLINE`). Open polish: (3) inn — drop occluding posts/one-tile pillars to
  stubs instead of dithering; (4) stall goods as small bottles/jars/produce, not coloured bars; (5) dungeon/crypt fog
  edge — 1-art-px Bayer or a flat step instead of the coarse checker; (6) unlit Cold Hearth — warm ash centre and a
  darker contact shadow. Not this branch: blocky dungeon light-pool bands; a translucent blue box (a mob bbox?) in the
  dungeon shot. Colours are `rampOf` seeds near the art-bible tones, not named bible entries.
