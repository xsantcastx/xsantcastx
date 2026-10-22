# The room simulates — Hearth protocol 7, M1 (handoff)

Branch `world`, 2026-10-22. Design and the authority table: `docs/design/online.md` §4d. Deploy: `scripts/social-deployment.md` § Protocol 7.

**What a player gets.** On the Seamworks island (`ember-isle`) everyone sees the same creatures, in the same places, with
the same life — party or not. A blow anyone lands shows on every screen; a creature dies once, for everyone; its loot is
rolled once and lies on everyone's ground (the ones who fought it may take it first for 20 s, then anyone; first wins —
the other is told "Someone else picked that up."). Walking over loot takes it at once on your screen; the room confirms
in one round trip. The Seam Eater rises at the island's rift under an eclipse for everyone, +60% life per extra Keeper
near it, and stays down that eclipse once felled. Everywhere else (caves, other islands) nothing changed.

**How.** `src/app/play/world/room-world.ts` (pure TS) is the room's world: the game's MobSystem with no Keeper of its own,
every Keeper as prey, one delta encoder per viewer, claims weighed (range by the room's record, sight, the level budget),
loot harvested from `MobSystem.spoils` onto the room's ground, `save()`/`load()` for sleep. The Hearth runs it through
`scripts/social-world.mjs` (areas, wake/sleep, 20 ticks/s, 8 snapshots/s, the `/world/*` verbs) — bundled for the image by
`scripts/world-sim-build.mjs`, compiled in memory for tests and a local room. The client is the protocol-5 member it
already was (`@room` is just a host id): `td-coop.ts` rolls no loot on a room kill and links the room's loot to the corpse;
`td-mobs.ts` room drops (`Drop.room`, `onRoomTake`, held while another Keeper's); `td-engine.ts` `setRoomGround`; the HUD
asks the room (`roomTake`) and grants through the one pickup door (`grantLoot`).

**Measured.** Take: client-perceived 0 ms (optimistic); the room answers in ~0.1 ms; round trip 4 ms on a local hearth
(e2e) — production is one HTTPS POST to us-central1 (see the final report for the live number). Simulation: ~0.03 ms a
tick for one Keeper, ~0.8 ms for 32 spread over the island; ~2 KB/s of snapshots to a lone Keeper in a crowd of 20.

**Tests.** `node --test scripts/social-world.test.mjs` (8: seeded determinism, loot and ownership, forged intents —
far, unseen, over budget, unknown, out of reach — sleep/wake, the Seam Eater, two clients over HTTP, protocol-6 compat,
sleep to the store and wake); karma `src/app/play/world/room-world.spec.ts`; e2e `e2e/td-world.spec.ts` (two browsers:
the same creature, the same death, the same drop, the first allowed take). `e2e/hearth-helpers.ts` starts rooms with the
world off (`SOCIAL_WORLD=0`) unless a spec asks: the older co-op specs test the party host on the island.

**Limits, stated.** XP and Gold are still credited by the client on the room's word (the save is client-written); an
item's affixes are minted at pickup from the player's seed; a blow's size within the budget is the client's; the level
is client-reported (rising at most 3 a minute in the room's eyes); the Keeper's own life is its screen's. The Seam
Eater's Glim warning line does not show for a member (the Eater itself does). Player drops still go through protocol 6's
escrow (a separate ground). A mixed party (protocol 6 and 7 clients) on the island does not share creatures.
