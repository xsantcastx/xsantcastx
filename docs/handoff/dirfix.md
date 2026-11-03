# Director notes: rails, prompt, crowns (branch `dirfix`)

Three Art & UX Director notes on the Isometric world, fixed in a general way (not per creature). Both views (Isometric
and Classic) share the camera and plate code.

## 1. The camera clears the phone's side rails

The phone HUD's skill column (`.td-skills`) and potion belt (`.td-belt`) stand over the left of the world, and a big
creature (the Lava Hound) could hide under them.

- HUD pieces that stand over the side of the world carry `data-world-rail`: the skill column, the potion belt, and
  the attack button. The engine measures them four times a
  second (`measureHud`, a couple of rects, never per frame). A rail is one that hugs the canvas's left or right edge
  across its middle third. A desktop bottom bar never counts, and neither does a portrait phone's bottom-right cluster.
  In landscape the attack button counts as the right-hand rail.
- The follow point moves by half the rails' difference (`followShift` in `td-zoom.ts`). The Keeper stands in the middle
  of the world the rails leave: about 31 css px right of centre on a 360 px phone.
- While a target stands under a rail (or past the far edge), the view moves further, by as much as brings its body out,
  never more than a fifth of the view. The move is eased and snaps under reduced motion.
- Taps, `clientOf` and every plate go through the same `cam` and `isoCam`, so hit tests are unchanged.

## 2. Name plates never sit under the Interact prompt

The prompt is a docked HUD panel (bottom-centre on desktop, right-hand side on phones). Any plate in the world could
slide under it: the stall's own plate in landscape, a creature's name, a peer's.

- The armed prompt carries `data-world-avoid`. The engine keeps its box (`hud.avoid`, up to 4 boxes), and `hudLift`
  raises any plate that would meet it until the plate sits just above it. This covers `plate()` (stalls, keepers,
  peers, the fallen purse) and each creature's bar, name and badges.
- The prompt stays where the phone HUD rules want it, off the centre of the world. Only the plate moves, and only
  while the two would meet.

## 3. A crown fades for every hostile that wears its bar

Before, a tree's crown faded for the Keeper, the target, and hostiles within six tiles (96 px). Bars are drawn out to
150 px (240 px for elites), so a wolf seven to nine tiles off, behind a tree, showed only its bar.

- The crown now fades for every hostile in view that wears a bar (`inBarReach` in `td-iso-props.ts`). It is the same
  test `drawFightUi` uses, so the two can no longer drift apart.
- No cost in towns (no hostiles). In a hunt the list stays capped at 32 points.

## Tests

- `src/app/play/td/td-zoom.spec.ts`: `followShift` (rails, target framing, the cap, no rails means no chase).
- `src/app/play/td/td-iso-props.spec.ts`: `inBarReach`.
- `e2e/td-dirfix.spec.ts`: covers all three notes in Chromium. Phones at 360×640 and 390×844 test the rail and the
  Lava Hound. 844×390 and 1280×800 test the prompt and plates. 1280×800 tests a wolf behind a tree eight tiles off.
  Set `SHOTS=<dir>` to save before/after pictures (the "before" removes the HUD markers, which is the old behaviour).
- Webdriver hooks: `__tdArt.view()`, `aim()`, `plates()`, `behindTree()`.
