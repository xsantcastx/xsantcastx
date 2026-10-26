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

## M3 — Hearth protocol 9 (branch `m3`, 2026-10-26; hearth revision 00016 live)

**What a player gets.** Every island, every cave and every dungeon floor is the room's, for everyone at once: a kill
on Ember Mine −1 stays dead when you climb out and come back, and the Keeper who stayed sees the same. Creatures come
back on their own clocks (about a minute; elites a few minutes; floor bosses about an hour, the story's gate bosses
about ten minutes). Four world bosses rise every few hours somewhere in their wilds, the whole world hears the omen,
and they carry their own uniques. There are more creatures everywhere, lairs (bones in a cleared ring with a pack
round them) in every wild region and on every dungeon floor, and fewer filler trees.

**How.** `room-world.ts` takes any area: a continent (TdWorld) or a floor (`HandLevel` from the new pure
`td/td-levels.ts`); `idle(dt)` is the dormant tick; `respawnOf` (td-mobs) draws each rest (`world/respawn.ts`); world
bosses in `world/world-bosses.ts` (data per boss, clocks persisted as `wb`, `fastForward` on wake, omens flushed to the
room). `social-world.mjs`: every area wakes with the first Keeper in the world and stays awake (members → 20 Hz,
others → 1 Hz idle) until nobody is in the world for 30 s, then each dirty area is written and all sleep;
`world-omen` to protocol-9 sessions; `/health` reports cost and memory. `social-server.mjs`: `PROTOCOL = 9`,
`session.p9`, the per-session world-area check (and fixes' stream-never-idles line). Client: `social-room.ts`
(`protocol: 9`, the wider ground-id pattern, `onWorldOmen`), `side-scroller` `worldOmen` (a toast + the game log).
Density: `continent.ts ContinentHotspot`, `td-world.ts` (hot spots, 2–4 packs, thinner trees), the four maps' chances
and hotspots, `td-level.ts` lairs. Canon: §5.6 world bosses (DM-reviewed), lore-addendum.

**Measured.** All 51 areas loaded from the bundle, 20 Keepers: 0.39 ms a 50 ms step (~1 % of a vCPU), rss 147 MB;
60 Keepers: 1.3 ms, rss 287 MB. Live (00015): one Keeper's stream woke all 51 areas, rss 107 MB. Density (spawns per 16×16 chunk, before → after): Deep Emberwood 2.2→5.8, Emberwood
1.2→3.4, Slagstone Hills 0.7→3.7, Ashfields 0.9→3.4, Cinder Meadows 0.05→0.5; Badlands 0.9→1.9, Molten Fields 1.3→3.1,
Deep Charwood 0.5→2.5, Steppe 0.3→0.5; Greenwood 0.8→2.7, Deep Wilds 1.3→3.0, Sunken Courts 1.9→4.1, Fernglades
0.2→0.6; Gloaming Fen 0.6→2.2, Deep Fen 1.4→3.5, Drowned Ruins 1.6→6.3, Black Meres 0.3→1.7. Floors 155 → 249 spawns.

**Tests.** `node --test scripts/social-m3.test.mjs` (8, in CI's node line: areas, respawn bands, dormant tick and
wake fast-forward, world bosses, the sims' lair rule, floor kill/leave/return over HTTP with a protocol-8 client,
omens, the all-areas CPU budget); e2e `e2e/td-world-m3.spec.ts` (two browsers on Ember Mine −1: kill, leave, return,
still dead for both). The M1 sleep test now asserts M3's rule (awake while anyone is in the world).

**Limits.** World bosses are surface-only. Every floor is shared (party-private instances: a later option). The
client still raises a floor's own creatures for the moment before the room's view lands (fixes' branch removes it).
Per-tier difficulty is not applied to room creatures (as M1). XP/Gold still credited by the client.

## M4 — Hearth protocol 10 (branch `m4`, 2026-10-26; NOT deployed — the owner deploys the hearth once, merged)

**What a player gets.** A Keeper's stun, root, hush, fear, taunt, slow, pull, burn, bleed or strip on a room creature is
the room's: the creature stands stunned on every screen (another Keeper's mark-bonuses against stunned foes work too),
a hush or stun in a cast's tell cancels it, burns and bleeds tick on the room. A blow or status the room refuses floats
"too far", "out of sight", "blocked" or "shrugs it off" over the creature instead of nothing. Your life is the room's:
bites, potions and heals still show at once; the room's word follows ~200 ms later; you fall only when the room says so,
and everyone near sees it ("Bryn has fallen."). Signed in, your Hunting XP and hunt Gold are written by the room, once
per kill or pile, Ember debt first, in batches ~20 s apart (sooner on an area change, a fall, leaving, or a big
pile); your toast, purse and level bar still show it at once.

**How.** `world/room-status.ts` (legality from td-marks/td-skills data, caps, immunity), `world/keeper-life.ts` (the
room's KeeperLife: guard ceiling from the save, claims, death grace), `world/life-mirror.ts` (the screen's optimistic
mirror), `world/room-credit.ts` (`creditRoom`: one trade-core transaction per batch; the ring `users/{uid}/social/
credits-<character>`). Room: `room-world.ts` `statuses`/refusals/`life`/`downed`/`flushKills`; `social-world.mjs`
lives, owed credit, `/world/life`, `/world/credit`; `social-server.mjs` `PROTOCOL = 10`. Client: td-coop
(`watchStatuses`, `laid`, cues, `st`, `me`, `down`), td-mobs (`roomStatus`, `statusSkill`, `lifeBite`), td-engine
(LifeMirror, `fallNow`), social-room, the HUD (credit asks, `pullKeys`). Full design and authority table:
`docs/design/online.md` §4d "M4 as built". Deploy: `scripts/social-deployment.md` § Protocol 10.

**Measured.** e2e: a stun on the other screen 82–143 ms after the cast; life claims acked in 5–9 ms locally; a kill's
XP in the save at the batch window's end (~20 s; shown at once as pending in the level bar and purse). Firestore:
≤ ~180 credit transactions per hunting player-hour (≤ 720 reads, ~540 writes).

**Tests.** `node --test scripts/social-m4.test.mjs` (9, in CI's node line); karma `room-status.spec`,
`keeper-life.spec`; e2e `e2e/td-world-m4.spec.ts` (stun seen by both, XP credited once, a death seen by both).

**Limits.** Which held skill laid a status, and the bonus over the room's XP/Gold base (≤2.5× / Gold Find's cap ×
the potion's most), are the screen's word; heals and soaks are bounded, not simulated; the guard may stand ≤1.5× the
save's. Ember Brand's ticks, Night Shroud, Moth Hours and Quiet Hands (Keeper-side) and item auras' slows stay on the
screen. Guests pay themselves; gathering XP (fishing, woodcutting, firemaking, cooking) stays client-side. A Keeper's
life starts from its presence on join (a relog refills it — no worse than today). The activity write races a
client's own read-modify-write for ~one round trip (the client pulls right after the commit).
