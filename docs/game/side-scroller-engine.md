# Seamworks 2D engine

`/play` is now the playable side-scrolling prototype. `/play/storyboard` keeps the earlier illustrated click-through loop available for comparison.

The engine is a small Canvas2D runtime in `src/app/play/engine/`. It owns fixed-step movement, gravity, one-way platform collision, camera tracking, attack cooldowns, a telegraphed Rivet Maw strike, dodge invulnerability, defeat retry, and landmark proximity. It deliberately does not write inventory or story state. Online play does not pause: there is no pause control, and blurring the tab does not freeze the Keeper.

The Angular surface owns those writes. Walking to the Cinder Ore, forge, beacon, and passage landmarks and pressing E calls the existing activity and inventory gateways. The first-craft tutorial Ember uses the existing idempotent starter grant; ordinary mining remains governed by the activity gateway. Basalt Edge is equipped through the explicit weapon slot.

The Keeper is the player identity. The 2D prototype does not call the scene “Chapter I” and does not introduce the unapproved proposed faction or narrative bible as public canon. The current reward is a browser-local Seamworks restoration marker, validated against the inventory era and reset stamp.

Controls: A/D or arrows move, Space/W/Up jumps, J attacks, K dodges, E interacts, and I opens the satchel. Touch controls sit on the play screen. The hearth, satchel, vitals, and objective are overlays, so the page itself does not scroll. Wearing and stowing from the satchel write through the local inventory; the hearth still carries only presence and chat. The existing Keeper illustration is a temporary posed runtime stand-in; the generated animation sheet remains a design reference until frame alignment and cleanup are complete.

## Repeatable hunting

Three Rivet Maws populate each area and respawn eight seconds after defeat. Each defeat leaves coin and Cinder Ore drops; walking over them collects them. Unarmed attacks deal 10 damage and an equipped Basalt Edge deals 20. Ore pickups use unique, idempotent inventory grants; rejected pickups remain available until the two-minute drop expiry. Hunt coins and kill counts are session totals, preserved during travel and restarts but reset on page reload; coins are not yet connected to a shop or shared wallet.

After the beacon is restored, the east portal opens Ember Quarry, a prototype hunting area. Its west portal returns to Seamworks. Neither transition ends the game or blocks movement. Return to camp and Restart hunt restore health, clear combat cooldowns, and reset monsters and uncollected drops while retaining collected rewards and equipment. Returning through portals also resets the area encounter.

The canvas runtime initializes with Angular's `afterNextRender` so it captures the live canvas after the initial render instead of drawing into an element replaced during hydration.

Verification: `node --test scripts/seamworks-engine.test.cjs` covers respawns, loot acceptance and duplicate protection, repeated portal travel, and restart state. `PW_PORT=4183 npx playwright test e2e/side-scroller.spec.ts --project=chromium` checks visible canvas rendering, keyboard movement through both portals, camp return, and restart in the production build.

## Animation and atmosphere

The Keeper is drawn large enough for the armor to read, and stays one figure: a breathing idle, a slight settle at the hearth, a stepped run with a moving contact shadow and foot dust, jump and fall stretch, a forward lunge with a weapon swing and a two-stroke slash, monster anticipation/stretch, spinning coins, pickup text, and short-lived hit/landing particles. The camp hearth has a rug, cushioned benches, cups, kindling, a copper kettle, and a fire whose glow and sparks breathe on the engine clock. Keepers near that fire take a warm light. The room still reports a resting Keeper as idle. Hanging lanterns and rising embers warm the rest of the Infernal environment. Effects are capped at 100 feedback particles. Reduced-motion preferences suppress decorative pose changes, fire sparks, and moving ambient embers. This remains posed illustration animation. The generated keeper sheet in `outputs/keeper-animation-design/` is a design reference and is not sliced into the runtime.
