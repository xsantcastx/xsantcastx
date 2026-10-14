# Handoff: a surface with height (2026-10-14)

Owner: "The surface is just flat — we should create parkour, going up to find items or rewards, climbing
trees, NPCs and monsters." Terraria + platformer feel. ROADMAP item 5.

## What a player gets

Every hunting ground (Ember Quarry, Reflection Channels, Unrecorded Corridors, Orrery Rings, Rootglass
Thicket) now has a **high road** above its floor, the same shape in each realm (so one engine test proves
all five climbable), drawn in that realm's palette:

| Step | Piece (x from the route start, 560) | How | Waiting there |
|---|---|---|---|
| 1 | Low rock shelf (0–150, top y 330) | jump at its side: the hands **catch the lip**, Jump (or keep pushing) **mantles** | **courier cache** (≈2 min of income + realm common material) |
| 2 | Tree (380; canopy y 290) | **Jump at the trunk climbs it** (hold Jump up, Down down) into the canopy | — |
| 3 | Floating ruin slab + **rope bridge** (560–1000, y 170) | jumps | **courier carving** (lore, re-readable) |
| 4 | Mesa (1000–1300, y 170) | walk off the bridge | **courier cache** (≈5 min + rare material), a **perched creature**, and one day in five **Hollis Fenn** |
| 5 | Dead snag (1400, top y 40) | climb; no canopy, so the Keeper holds on at the top | — |
| 6 | Ruin block (1530–1680, y −150) | **wall-jump**: a direction + Jump kicks off the snag, catch the block's lip | **look-out cairn**: every find left on that road shows a pale beam |
| 7 | Slab (1690–1880, y −270), spire (1900–2010, y −560) | jump, then catch the spire's lip and mantle | **summit cairn** — ≈15 min of income, 2 rare + 3 common, the realm's **title** (Cinder/Dawn/Unrecorded/Meridian/Canopy **Ridgewalker**) and its Codex entry |

Caches and summits pay **once per player**, receipt first (`godforge-heights`, synced, union merge); a
reload or second tab never pays twice. The Codex has a new block, **The High Roads** (`codex-heights`):
the five summits (dashed blanks until reached), the titles, the cairn texts, caches found n / 10.

## Movement (surface-body.ts; only in areas with `heights` — towns and the Delve are unchanged)

- **Jump arc:** same take-off (−680). Held Jump floats the apex (gravity ×0.55 under 150 px/s), letting go
  early cuts the rise (×2.1, a short hop), the fall is ×1.12, terminal 1150. Coyote time / jump buffer
  stay in the engine.
- **Solids** (rock shelves, ruin blocks): walls, floors, ceilings; all float above head height, so the
  floor is never blocked and click-to-walk keeps working.
- **Ledge grab:** airborne, near the apex or falling (vy > −220), touching a solid's side while pushing or
  facing into it, with the lip 110–188 px above the feet, and room to stand on top. Hang: Jump or keep
  pushing ≥0.12 s → mantle (0.24 s, up then over); Down or pushing away → let go (0.3 s no-regrab).
- **Climb:** Jump at a trunk (within 24 px) grabs it; held Jump climbs 230 px/s, Down 300 px/s; the top
  of a tree steps into its canopy; a snag holds on at its top; a direction held alone 0.2 s lets go.
  Vine-faced solids (`climb: true`) are supported by the code (none placed yet).
- **Wall-jump:** while climbing, a direction + Jump (vy −640, a 400 px/s kick decaying over 0.22 s); also
  within 0.14 s of touching a vine face in the air.
- **Down + Jump** on a canopy, bridge or ruin drops through it.
- **Touch:** no new buttons. The existing ▼ (Delve-only until now) also shows in hunts with height
  (`.stage--heights`, `--tb-n: 6`). Jump climbs, ▼ climbs down / lets go. `input()` now tolerates a
  pointer that cannot be captured.
- **Camera:** follows the Keeper up (frame top clamped to `heights.top`, never below 0, so standing on the
  floor is pixel-identical to before), with a smoothed look-ahead: −120 climbing up, −80 rising, +80
  falling fast. The backdrop sinks at 0.6 of the camera (as a delve's does) and the realm's W8 sky
  colours fill above it.

## Art (surface-render.ts)

Pixel art at the town scale (4 world px per art px, style guide §2), baked once per area entry into small
canvases from the realm palettes (§5.2: ground ramp for rock, bark + canopy ramps per realm) and the
shared Godforge obsidian + violet seam (§5.1) for ruins; brass courier strongboxes, a carving tablet, a
pennant cairn and the summit cairn (a violet ribbon once claimed). Laid nearest-neighbour; a frame does
one `drawImage` per visible piece, no gradient (the sky gradient is cached per context), no allocation.

## Life up there

- **Perched creatures:** each hunt's own creature stands on its mesa (`MonsterDef.floorY/range`, drops
  unchanged). Monsters in a hunt with height stand down while the Keeper is on another level (> 120 px).
- **Hollis Fenn, Last Ridge Courier** (new; lore-addendum "The High Roads"): one realm's mesa a day
  (`hollisRealm(day)`), name tag + title, three lines (two general, one per realm) as the Keeper comes
  near on the same level. Placeholder figure via `TownLife.drawAt` (art key `npc-hollis-fenn-figure`,
  unpainted).

## Files

`play/engine/surface-body.ts` (physics), `play/engine/surface-render.ts` (art), `play/world/heights.ts`
(routes, finds, rewards, Hollis), `play/world/heights.i18n.ts` (EN + ES, lazy), `shared/heights/`
(save model + service + spec), `codex/codex-heights.component.ts`; engine wiring in `engine.ts`
(`enterHeights`, `findInReach`/`useFind`, `drawFolk`, camera), `engine.model.ts` (`onHeightFind`,
`EngineState.height/climbing/y`), the five town files (`heights`, perched monsters; the hunts' old flat
ledges were removed), `side-scroller.*` (grant + toasts, prompt labels, ▼, `data-player-y`,
`data-climb`), `cloud-save.model.ts` (`godforge-heights`), `economy-sim.mjs --heights`.

## Tests

- Engine (`seamworks-engine.test.cjs`, 10 new): routes in every hunt (head room, summit on top,
  deterministic, Hollis rotation); ledge grab + mantle; hang → Down lets go; a tapped hop does not catch;
  jump-first-then-push catches; tree climb at 230 px/s into the canopy; the full summit route (snag,
  wall-jump, block, slab, spire); Jump with no direction clings at a snag top; 4000 frames of random
  input never inside a solid and identical twice; finds ask the host and read `found`; perched creatures
  never strike from another level.
- Karma `heights.service.spec` (pays once across a reload, summit title, union merge, rehydrate, every
  reward a catalogue material); cloud-save spec lists the new key.
- `economy-sim --heights` (in `--check`): caches in the quest band, summits in the daily band, a road
  ≤ 30 min, all five ≤ 150 min (110), floors under 30-minute income.
- e2e `play-surface.spec.ts` at 1280×800 (keyboard) and 390×844 (touch buttons by pointer events):
  mantle the shelf + open its cache, climb the tree, the summit route, the cairn, reload → cache stays
  opened, button disabled, Gold unchanged; summit saved.

## Not done / next

- The look-out "reveals the map" in-world (beams over the road's remaining finds), not on Glim's Delve
  map — the surface has no map yet.
- Titles live in the Codex; there is no title picker on the Character sheet.
- Town outskirts have no height yet (hunts only). Vine faces are supported but none are placed.
- Art is procedural pixel maps; commissioned tree/ruin/cache props and Hollis's figure would replace them.
