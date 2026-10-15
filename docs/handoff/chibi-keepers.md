# Chibi Keepers — handoff

Owner, 2026-10-15: "make the character a bit more tender smaller like very cute type style of maple story".
Still pixel art on the one grid (4 world px per art px, 2 in the Delve) with the one outline; the proportions and the
feel moved to chibi. The style rule now lives in `docs/agents/BRIEF.md` ("Art").

## What a player gets

- **Their Keeper is chibi**: a big round head (15×14 art px) over a small soft body (15 rows), about 31 art px tall —
  74% of the old 42 (124 world px instead of ~168). Big 2×3 eyes with a white highlight (round, calm half-lidded, or
  bright with a lash), a small mouth, rounder hair domes for all eight styles, tiny mitten hands, little rounded feet,
  a soft bell of a torso. **Rosy cheeks** is a new face mark in the Glass ("Rosy cheeks" / "Mejillas sonrosadas");
  freckles come with a blush too.
- **It feels alive**: idle breathing (the body settles a pixel, the cape stirs), a blink every ~3.7 s (offset per
  person so a crowd never blinks in unison), a bouncy run (two pixels of hop, the head lagging a pixel behind), a little
  hop in the townsfolk's walk, a **landing squash** (wider and shorter for 0.18 s), and a **happy face** on picking up
  loot and on any level up (LevelUpService). The surprised face exists in the painter (`face: 'surprised'`) for a
  rare find later.
- **Gear still reads**: weapons keep their sprite sizes, so on the smaller body they are MapleStory-oversized; the
  arm is shorter (ARM_LENGTH 8 → 6), so every grip, swing and cast arc still lands on the hand. Helms are round caps
  with the crest above the big head, hoods are soft and pointed, crowns/circlets/hats sit on the head, mantles trail
  and scallop at the hem, coats/robes/aprons/sashes, boots, gauntlets, pendants and charm beads all still layer.
- **Every NPC changed with the player** (one painter) and keeps their lore: Kael's grey beard, burning forge eye,
  cracked plate under the apron and missing left hand; Verrin's hooded mirror face; Aureth's dawn-glass shards (never a
  halo); the Archivist's loupe and floating book; the Merchant's hat and scales; Tomas's lantern; Lune's cards…
  Townsfolk can roll rosy cheeks.
- **Creatures match the cuter world**: all eight pixel creatures are rounder (pixel ellipses lit from the upper left)
  with big white eyes; on the wind-up and the lunge the eyes glare (a brow and a lit pupil) and the mouth/weapon comes
  out, and they squeeze their eyes shut when hit. Same seven frames, same white flash.
- **Anchors follow the head**: name plates, the "You" plate, peer labels and every speech bubble sit on the figure's
  own top (`KeeperPainter.top`: hair, hat, helm crest, hood, crown, topknot, shards) instead of a fixed 196 px. Glim
  hovers by the big head in towns (−118) and at chest height in the Delve (−64). The creator preview frames 40 art px
  (6× on its 240 canvas); the paper doll and portraits use the new default crop.

## How it works

| File | What changed |
|---|---|
| `shared/keeper-look/keeper-paint.ts` | New body geometry (FOOT 47, HIP 40, SHOULDER 33, head 15×14 from row 19); `BodyFrame.nod`; bouncier `bodyFrame`; `blinking()`, `KeeperFace`, `faceAt()`; `PaintState.squash` / `face`; `top`; `FIGURE_TOP`, `STILL_CROP`; **one frame sheet per painter** (8 slots per row, grows by doubling rows; idle and talk share bodies) so the live-canvas count stays flat (`e2e/play-memory`). |
| `shared/keeper-look/keeper-gear.ts` | `ARM_LENGTH` 6. |
| `shared/keeper-look/keeper-look.model.ts`, `keeper-look.i18n.ts` | `rosy` face mark (appended: old saves and seeds keep their marks), EN + ES label. |
| `shared/keeper-look/npc-looks.ts` | Townsfolk can roll rosy cheeks. |
| `shared/keeper-look/keeper-maker.component.ts` | Preview zoom (integer 6×). |
| `play/engine/creature-pixel.ts` | `blob` / `orb` / `eye` helpers; the eight creatures redrawn round. |
| `play/engine/engine.ts` | `keeperFeel(face, seconds)`; squash + face passed to the player's painter; "You" plate, peer labels and bubbles on `painter.top`; Glim show-me height. |
| `play/engine/town-life.ts` | `tagBottom(painter)`: name plates and bubbles on each figure's top. |
| `play/engine/glim-sprite.ts` | Glim's anchor at the chibi head / chest. |
| `play/side-scroller.component.ts` | Level ups light the Keeper's face. |
| `scripts/keeper-gallery.mjs` | The people + creature galleries (esbuild + Playwright, no app build). |
| `e2e/chibi-shots.spec.ts` | Camera for this page (skipped unless `CHIBI_SHOTS=<prefix>`). |

`still()` keeps its signature (the NPC portraits on `one-art-style-2` call it); its default crop is now the chibi
(`STILL_CROP`) and it snaps to whole pixels per art pixel and centres. Hit boxes, interaction ranges, the keeper
click box (`keeperAt`, floor−175: now generous over a shorter figure) and every `data-*` attribute are unchanged.

Frame cost is unchanged: one cached blit + the live arm/weapon per person; a blink or a face flash is another cached
slot. The squash is a canvas scale on the blit.

## Tests

- `keeper-gear.spec.ts` — new "chibi proportions and feel": height 29–34 art px with head:body in 1 : 0.85–1.3; blinks
  happen (and never under reduced motion); happy/surprised change the pixels; the squash keeps the soles on row 47;
  `top` rises with a hat and a helm crest and covers the painted hair. Existing grip/swing/frame/pixel-diff specs
  still pass with the shorter arm.
- `npc-looks.spec.ts` — unchanged and passing (22 distinct people, creature frames differ, pure white flash).
- `e2e/play-keeper-look`, `play-memory` and the full play suite in the gate.

## Screenshots (`docs/handoff/chibi-keepers/`)

`before-*` / `after-*` at `phone` (390×844) and `desktop` (1280×800): `town-infernal`, `town-luminous`, `hunt-verdant`,
`delve`, `creator`, `paper-doll`; plus `*-gallery-people.png` (player looks, all 22 named people, every action) and
`*-gallery-creatures.png` (8 creatures × 7 frames). Best pairs: `gallery-people`, `town-infernal-desktop`,
`creator-phone`, `gallery-creatures`, `hunt-verdant-desktop`.

## Not done / next

- The surprised face is wired in the painter but not triggered (a rare/legendary find is the natural hook).
- Homestead figures (`homestead-render.ts`) are still vector stick figures; at chibi size a pixel figure is ~124 px
  instead of 168, which makes that layout pass easier.
- The Underhearth's deep creatures (`drawEmber/drawSentinel/drawShade/drawFurnace`) were already pixel on the Delve grid
  and were not reshaped.
