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

## M2 — Hearth protocol 8 (branch `world-m2`, 2026-10-22; hearth revision 00011 live)

**What a player gets.** A dropped item lies on everyone's ground the moment the room hears it (the dropper sees it at
once), and the first Keeper to reach it has it. A trade is done on both screens the moment the second Keeper confirms.
A party survives logging out: the others see you greyed ("offline", still in the party; the leader can remove you), the
lead passes on, and logging back in puts you straight back in. The room budgets your blows from your own save (your
real level and worn gear), not from what your client claims.

**How.** The room carries the trade Function's own core (`functions-game/src/trade-core.ts`, bundled by
`scripts/world-sim-build.mjs` as `tradeCore`) and writes through Firestore's REST transactions with its service account
(`social-identity.mjs` `firestoreStore().db`). Trades: precheck when both accept (one batch read + the real checks on a
copy), settle from memory on the second Confirm (both windows close with what each gets), then ONE `settleTrade`
transaction (both saves, both ledgers, the trade, the audit) — the commit is the truth; a lost commit word is asked for
again (`/trade/status` → `closeTrade`, a transaction that can never both void and lose to a late commit). Drops: laid at
once (`pending`), escrowed behind with `dropItem` (waits for the dropper's `/ground/synced` if its save is behind;
handed back with a note on refusal); picks: first in memory wins, then `pickupItem`. Stats: `world/keeper-budget.ts`
from one `:batchGet` of activity, look and inventory on join (every 5 min after). Party: a roster by account, persisted
in `parties/{id}` + `users/{uid}/social/party` (room-only writes; no rules change). Client: `social-room.ts`
(`protocol: 8`, `character`, `groundLay/Pick/Synced`, `tradeStatus`), `trade-flow.ts` room mode, `trade-hud`, the HUD's
greyed frames. Design and the full authority table: `docs/design/online.md` §4d "M2 as built".

**Measured.** e2e (two browsers, local room): a drop on the other screen 3–4 ms after the click; a trade done on both
screens 3 ms after the second Confirm. Live (guests): POST round trip ~195 ms, another Keeper hears a POST ~190 ms after
it is sent; `/health` `economy` keeps the room's own commit/escrow/pick times.

**Tests.** `node --test scripts/social-m2.test.mjs` (8, now in CI's node line), `scripts/trade-core.test.mjs` (+3),
karma `trade-flow.spec`, `social-room.spec`, `keeper-budget.spec`; e2e `e2e/td-world-m2.spec.ts` (party, instant drop
picked up by the other, fast trade, relog keeps the party). The older `e2e/td-trade.spec.ts` now runs the room path too.

**Limits.** XP and Gold still credited by the client; a blow's size within the budget is the client's; the room's list
of player drops is memory (escrowed items still go home on time); a protocol-7 client keeps M1's trust until it
refreshes; the ~0.1 s before an escrow lands is the same small vendor-value window protocol 6 had.
