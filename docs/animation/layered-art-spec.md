# Layered character art: what to commission

Today every character is one flat painting. The Seamworks engine fakes motion by
bending that painting with a mesh rig (`src/app/play/engine/rig.ts`). Bending can't
show what the painting hides: the back of an arm, a blade held behind the body, a
leg passing in front of the other. For real animation, an artist needs to deliver
**separate layers** (for a cut-out rig) or **frames** (for frame-by-frame). Brief them with this page.

## 1. Pose and view

- **Three-quarter side view, facing right.** The engine mirrors for left. A
  front-facing figure (like today's Keeper) can't run or swing convincingly.
- Neutral "T-ish" pose: arms about 20° away from the body, legs slightly apart,
  so no limb overlaps another limb.
- One canvas size per character, figure feet on a fixed baseline (bottom 4% of canvas).

## 2. Layers per character (cut-out rig)

Paint each part **whole**, including the parts covered by other layers (about 15% overpaint
at every joint), so nothing tears when a part rotates.

| # | Layer | Notes |
|---|-------|-------|
| 1 | `cape_back` | Cape/cloak behind the body. Split in 2–3 vertical strips if long |
| 2 | `arm_back_upper`, `arm_back_lower`, `hand_back` | Far arm, painted darker |
| 3 | `leg_back_upper`, `leg_back_lower`, `foot_back` | Far leg |
| 4 | `torso` | Chest to belt, no head or arms |
| 5 | `pelvis` | Belt, hips, top of skirt or tabard |
| 6 | `hem` / `tabard` | Hanging cloth below the belt, separate from the legs |
| 7 | `leg_front_upper`, `leg_front_lower`, `foot_front` | Near leg |
| 8 | `head` (+ `hood`, `jaw` if separate) | Hood as its own layer if it should lag behind |
| 9 | `weapon` | Separate file, grip centered on the pivot |
| 10 | `arm_front_upper`, `arm_front_lower`, `hand_front` | Near arm, drawn on top |
| 11 | `cape_front` | Cloth that drapes over the near shoulder, if any |

Creatures (e.g. Rivet Maw): `body`, `back_plates`, `head`, `jaw` (open-mouth interior
painted), `tail`, `leg_front_near/far`, `leg_back_near/far`, each split upper and lower.

## 3. Pivots

Mark each pivot in a separate `pivots` layer with a 3 px dot, named the same as its
part: shoulder (upper arm), elbow (lower arm), wrist (hand), hip, knee, ankle, neck
(head), waist (torso to pelvis), cape attach (top center), jaw hinge, weapon grip.
Also deliver a `pivots.json` with `{ "arm_front_upper": [x, y], ... }` in canvas pixels.

## 4. Files and naming

- Master: `<character-id>.psd` (e.g. `keeper-base.psd`), one layer per part, names exactly as in §2.
  Layer order in the PSD = draw order.
- Export: `<character-id>__<layer>.png`, RGBA, **untrimmed** (full canvas) at 2048 px
  tall, so every part keeps its position. We trim and pack in our pipeline (`scripts/import-assets.py`).
- No baked shadows or glows on the ground. The engine draws the contact shadow and rim light.
- Same palette and lighting direction (key light top-left) as the existing paintings.

## 5. If going frame-by-frame instead

Full-figure frames, same canvas and baseline, `<character-id>__<anim>_<nn>.png` (starting at `01`):

| Animation | Frames | Loop | Notes |
|-----------|-------:|:----:|-------|
| idle | 6 | yes | Breathing, cape drift |
| run | 8 | yes | Contact on frames 1 and 5 |
| jump (rise) | 3 | no | Takeoff, rise, apex |
| fall | 3 | yes | Last 2 loop |
| land | 2 | no | |
| attack | 6 | no | 2 anticipation, 1 strike (smear frame), 3 follow-through |
| dodge | 4 | no | |
| hurt | 3 | no | |
| death | 6 | no | |
| rest (seated at fire) | 4 | yes | Optional |

Creatures: idle 6, walk 8, windup 4, strike 3 (jaw open), recover 4, hurt 2, death 6.
Weapon-holding frames ship with and without the weapon, or with the weapon as its own layer per frame.

## 6. Acceptance

A delivery is complete when every part in §2 exists, every part with a joint has a pivot
in `pivots.json`, layers re-stack in the PSD to match the approved flat painting
exactly, and rotating any limb 45° about its pivot shows no hole or hard edge.
