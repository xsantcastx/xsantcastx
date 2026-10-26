# Eclipse Realms — online (the plan for everything multiplayer)

Written 2026-10-21, the day the owner saw two Keepers meet: *"its working online! They can interact with each other!
… coop play, leveling activities, joining parties, guilds, all online things games have."* This page owns every
online feature: what it is, how it works **in our architecture**, who is the authority, what it needs deployed, and
in what order. `vision.md` still wins on what the game is; this page wins on how players share it.

**Hard rules for every phase.** Gold only, never real money. The **player market is owner-only** (not planned here).
Deploys (Cloud Run, Functions, Hosting, Firestore rules) are **always the owner's call**: every ⚑ below is a step
an agent prepares and the owner runs. Game state goes through `GameStateGateway` (never a new localStorage key).
Every menu scrolls and reaches its last control on a phone (390×844, 360×640, 844×390).

---

## 0. Where we stand

| Piece | Today |
|---|---|
| **Hearth room** (`scripts/social-server.mjs`, Cloud Run `eclipse-hearth`, us-central1) | One instance, in memory, **32 Keepers max**, anonymous guest names. SSE stream down, JSON POSTs up. Protocol 2 live (rev 00003). |
| **Presence** (protocol 2) | Area, x/y, the way faced, walking, class, compact look, level. Peers drawn as real sprites with plates (`td-peers.ts`, `peer-tracker.ts`). |
| **Chat** | One public channel, last 50 lines in memory, 5 lines/10 s. Always on (Settings → Chat → Ignore leaves). |
| **Wave** | An emote relayed to the room. |
| **Saves** | Firestore `users/{uid}/…` through the gateway when signed in; localStorage when not. |
| **Parties** (protocol 3) | **Built in this branch, not deployed** (§3, Phase 2). |

## 1. Architecture and scaling (the direction)

**Keep Firebase** for what it is good at: Hosting, Auth, saves (Firestore per-blob docs through the gateway), Cloud
Functions for anything that must be **atomic** (trades, guild writes, in Firestore transactions), and security rules.
No platform switch is needed now.

**Evolve the hearth** from "SSE + POST, an in-memory room on one Cloud Run instance" into an **authoritative room
server**: WebSocket transport, rooms per area or shard, Firebase ID-token auth, every verb validated server-side, and
later **server-simulated encounters** (Colyseus-style rooms). It stays on Cloud Run with session affinity.

**Move to a VM / Fly-style host only when concurrency or cost demands it.** Rough thresholds: Cloud Run is comfortable
up to **a few hundred concurrent players** (a handful of instances × 80–250 sockets each); past that, or once the bill
for always-open connections passes a small dedicated machine's monthly price, dedicated instances are cheaper.

**Never use Firestore for movement or any real-time state.** Positions, HP, chat lines in flight and encounters live in
the room server's memory; Firestore holds only what must survive a restart (friends, guilds, trade results,
leaderboards, mutes, bans).

**Costs to watch.** Cloud Run bills **CPU and memory for as long as an SSE/WebSocket connection is open** (a Keeper
idling in town is billed time), so the room must pause streams when the tab hides (it does) and drop idle sessions
(45 s). Firestore cost is driven by **reads**: a listener or a poller that re-reads a collection per client per minute
is what explodes the bill (see the memory *"/live drives the Firestore bill"*). Friends and guild rosters are read once
per session and pushed by the room, never polled.

---

## 2. Phases at a glance

| Phase | What | Size | Needs from the owner ⚑ |
|---|---|---|---|
| 1 ✓ | **Presence** — see each other, public chat, Wave | done | (live) |
| 2 | **Parties** — invite, frames, party chat, shared XP near a kill, Seek/minimap | M (built) | ⚑ redeploy the hearth (protocol 3) |
| 3 | **Social graph** — hearth auth, friends list, whispers, block/mute/report, privacy settings, profanity filter | M (live 2026-10-21: hearth protocol 4, rules deployed) | done |
| 4 | **Guilds** — create/join, ranks, guild chat, tag over the head; guild hall later | L | ⚑ rules + ⚑ Functions |
| 5 | **Co-op encounters** — party quests/dailies, group bosses (Seam Eater) with scaling, personal loot, host-authority dungeons | L | ⚑ hearth redeploy |
| 6 | **Trading** + **shared ground drops** — two-sided confirm window, atomic Gold/item swap; Tibia drops everyone sees | M–L (built, §4c) | ⚑ Functions + ⚑ rules + ⚑ hearth (protocol 6) |
| 7 | **Leaderboards** | S–M | ⚑ rules + ⚑ Functions (scheduled) |
| 8 | **The room simulates** (protocol 7, §4d): server-run creatures, loot and ground on the island (M1); then trades, more areas, WebSocket | L | ⚑ hearth redeploy only (no billing change) |

Moderation (§3.9) is not a phase of its own: each phase ships the moderation it needs (rate limits and validation now,
block/mute/report with friends, guild kick/ranks with guilds, ban checks once auth lands).

---

## 3. Feature by feature

Each entry: **data model · authority · rules · deploy ⚑ · risk · size**.

### 3.1 Presence (Phase 1 — done)
- **Data**: in-memory `sessions` on the hearth; `player = {id, name, x, y, zone, facing, animation, area, dir, moving, vocation, look, level}` (+ `hp, maxHp` in protocol 3).
- **Authority**: client-reported, server-validated shape only (regexes, bounds, rate limits). Positions are trusted.
- **Rules/deploy**: none / live. **Risk**: low (guest names are not identities). **Size**: done.

### 3.2 Parties (Phase 2 — built in branch `party`)
How it works now: a tap on a Keeper → card → **Invite to party**; the invitee gets a cozy toast (**Accept / Decline**,
lapses after a minute). Up to **4**. Leader invites and kicks; anyone leaves; the lead passes to the next member; under
two members the party disbands. **Party frames** (name, class · level, life bar, which way and how far) sit under the
Keeper's plate (a narrow column on phones). **Party chat**: a Party tab beside Chat, or `/p words` in Chat.
**Shared XP**: see §3.4. **Seek**: `lum vesh <member>` points at a member (any floor, "across the sea" on another
continent); the minimap shows members as gold marks, or a gold pip on its rim pointing their way; their name plates
turn gold.
- **Data (server, memory)**: `parties: Map<id, {id, leader, members[], messages[30]}>`, `invites: Map<id, {from, to, party, until}>`, `session.party`, `session.parties` (the client said `party: true` on join).
- **Protocol 3 verbs**: `POST /party/{invite|accept|decline|leave|kick|chat|kill}`; events `party`, `invite`, `party-chat`, `party-kill`, `party-note`. Rate limits: invites 5/30 s (≤3 open), answers 10/10 s, party lines 5/10 s, kills 20/5 s.
- **Authority**: the **server** owns membership (who is in which party, the cap, the lead). Shared XP is **client-side and trust-based** (§3.4).
- **Backwards compatible**: a v2 client never says `party: true`, so it is never invited and never sees party events. A v3 client against the live v2 room hides the Invite button (the card says *"Parties open when the hearth updates"*); presence, chat and Wave are unchanged. `hp/maxHp` ride along in presence and a v2 room ignores them.
- **Rules**: none (nothing persisted). **Deploy ⚑**: the hearth (Cloud Run) with all four `SOCIAL_ORIGINS`.
- **Risk**: low–medium — a hearth restart forgets every party (players re-invite); a lapsed session rejoins with a new id and loses its party. **Size**: M.

### 3.3 Co-op play — the honest limits, and the path
**Today every monster is simulated on each player's own client.** Two Keepers standing together see *different*
creatures in *different* places with different HP; a kill on one screen is not a kill on the other. That is why
Phase 2 shares **XP by announcement**, not kills. It is fine for "hunt in the same field together"; it is not real
co-op combat.

The path, cheapest first:
1. **Server-seeded spawns** (S–M): the room hands each area a seed and a respawn clock, so every client spawns the same
   creatures at the same spots and times. Kills are still local, but the world *looks* shared; a kill announcement can
   name the spawn key so the others' copies fall too ("despawn by announcement"). Trust-based.
2. **Host authority for instanced dungeons** (M–L): a party entering a dungeon floor elects the leader's client as
   **host**; the host simulates the floor's creatures and streams their positions/HP through the room (≤10 Hz);
   members send hits as intents; the host applies them and announces deaths and loot rolls. Simple to build on what we
   have (the engine already runs the sim), but the host can cheat and a host leaving needs migration (the next member
   takes over from the last snapshot).
3. **Server-simulated encounters** (L, Phase 8): the room server runs the creature sim for shared spaces (a Node port
   of `td-mobs`' pure core), clients render and send intents. Real anti-cheat; the most CPU on Cloud Run.

Recommended: (1) with Phase 5 for open-world hunting, (2) for party dungeons and group bosses, (3) only once the
player count justifies it.

### 3.4 Co-op levelling and activities (Phases 2 and 5)
- **Shared XP (Phase 2, built)**: when a member kills a creature, the room relays `{creature, level, hp, sky factor, area, killer's last x/y}`. Each other member's client (`play/social/party-share.ts`) checks: a member of my party; the creature exists **in my own table** at the announced level; HP no more than that creature has; same area; within **12 tiles**; creature level within **[my level − 20, my level + 12]**; at most **12 shared kills** and **200 + 40×level XP** a minute; each kill once. It then pays **60%** of the base Hunting XP through the same door as a kill of its own (`payHunt`: the Ember debt, the ledger's replay check, the toast). The killer keeps 100%: grouping is a bonus, never a tax. **Gold stays personal.**
  **This is trust-based, not authoritative**: a modified client can forge kills or pay itself. Real anti-cheat is Phase 5/8 (server-simulated or host-authority encounters, server-side XP grants via a Function).
- **Party quests / dailies (Phase 5, M)**: a town board posts a daily "the party fells 40 Ash Mites" goal. Data: `dailies/{yyyy-mm-dd}` (Function-written, read once); progress counted from party-kill announcements in the room; the reward is claimed per player through the gateway (a `party-daily:{date}` mutation id, so it pays once). Trust-based like shared XP.
- **Shared creatures (Phase 5, built 2026-10-21; Hearth protocol 5)**: owner's report — *"my friends cant see my monsters and i cant see theirs"*. Within a party, **per area** (a continent's surface or a floor), the room elects a **host**: the earliest-joined member present, **sticky** while it stays (re-elected when it changes area, leaves the party or the room, or goes quiet for 3 s — a hidden tab stops simulating). Others there are **members**: they spawn and simulate nothing; they draw the host's creatures. Alone in an area, or against an older room (v3 live, or v4 with friends), everything is as before.
  - **Host → members**: `POST /coop/snap` at **8 Hz** — the creatures within **24 tiles** of any member (≤ 48, nearest first): id (short base-36, kept for the creature's life and across a host change), type, spawn key, x/y, facing, life/most, level, elite rank/role/affixes/name, a boss's wind-up and aim, flags (halved, summoned, chanting); **delta-compressed** (changed fields only; unchanged creatures dropped; vanished ones in `gone`), a **keyframe** every 2 s and whenever someone arrives or a send fails; a member out of step (a gap in `seq`, a new term) waits for the next keyframe. Events ride along: `kill`, `bite` (a creature struck a member), `shot` and `burst` (pictures only). Members **interpolate** (a glide of 1.2 snapshot intervals from where the creature is drawn to where the host says; a jump > 160 px is placed; reduced motion places). Code: `play/social/coop-protocol.ts`, `coop-interp.ts`, `play/td/td-coop.ts`.
  - **Member → host**: a member's blows resolve on its own screen as visuals and a **claim** `{id, damage, element, crit, skill}`, batched at 8 Hz (`POST /coop/hits`); the room adds where the member last stood and its level and hands it to that area's host only. The host's **ClaimGate** (`coop-rules.ts`): the creature exists and lives; the member within **16 tiles** of it; at most **40 + 20 × level damage a second** over a rolling 3 s (an over-budget claim is clipped). It then lands through the creature's own path (`MobSystem.applyClaim` → `hurtMob`: Stone Skin, its call, its half-life change, its fall) — the part of `hitFoe` that belongs to the creature; the member's own power, crits and gear were already in its number.
  - **Creatures → members**: the host's creatures hunt every member in the area (nearest prey); a blow, a shot or a burst that reaches a member travels as a `bite`, which the member applies through its **own** defenses, resists, wards and blessings (`MobSystem.coopBite` → `biteKeeper`), plus Mana Burn / Cursed.
  - **Kills and loot**: the host's creature falls → a `kill` event naming who **fought** it (a claim landed, or it struck them). Each member there (≤ 24 tiles) who fought it is paid **in full, as if it had felled it**: its own Hunting XP through `hunted()` and its **own personal loot** rolled on its own screen. One who was there but did not fight takes the **60% party share** (`party-share.ts`). The host is paid as the killer when it fought; if only members fought it, the host takes the share and no loot. **No double rewards**: each kill pays once, one way (`CoopRewards`); a shared kill is never re-announced to the party; and the host's protocol-3 `party-kill` of a kill in a shared area is ignored by its members (a v3 member still gets its share from it).
  - **Bosses**: bosses and the Seam Eater are shared too; **life +60% per extra member present** (loot-and-combat.md §10 "Party bosses"). XP and loot follow the boss's own life.
  - **Host migration**: the new host **adopts** the replicas as its own creatures — ids, spawn keys, life, elite tags, the half-life change and a boss's unscaled life kept — and their AI resumes; respawn timers of shared kills were recorded on every member, so nothing rises twice. A host with a menu open keeps the shared creatures running for the others (it is not their prey meanwhile).
  - **Bandwidth** (measured by the encoder's rules): a keyframe entry is ~123 bytes, a moving creature's delta ~29, the envelope ~150; 20 creatures in range with half walking ≈ 0.44 KB a snapshot ≈ **3.6 KB/s down per member** (the same up from the host), plus a ~2.6 KB keyframe every 2 s (+1.3 KB/s) — about 5 KB/s all in; a standing crowd costs only the envelope (~1.2 KB/s). Hard caps (server-side, `COOP` in social-server.mjs): 48 creatures, 24 events, 64 gone ids, 24 claims a message; 8 KB a body; 12 snapshots and 12 claim batches a second per session; 40 co-op requests a second per party.
  - **Companions** (owner: *"I can't see the hunter's pets, and he can't see my skeletons"*; `play/social/coop-pals.ts`): each owner's client is the authority for its own — the pet (or a Thornstrider's spirit beast), the beasts of Call of the Wilds and a stampede, raised skeletons, Lamp-Wisps and the Beacon, and Glim. To the party in its area (any role) it sends the whole list ~5 times a second when anything moved, a heartbeat a second otherwise (`POST /coop/pals`: id, kind, type, place, facing, life, fighting); the others glide them and draw them with the same painters, and forget an owner silent for 2.5 s. Their blows on the host's creatures are claims like the owner's own (everything lands in `hurtMob`). Everyone else in the room sees the pet and Glim only, as offsets in presence (`pals`), riding on updates that go anyway; summons are party-only. Limit: the host's creatures do not target other members' companions.
  - **The host is an interface (toward a room-run world, Tibia-style; not built)**: clients know the host only as the id the room's election names and the `from` on `coop-snap`; claims go to "whoever hosts this area"; bites name the member; kills name who fought; companions are each owner's own. So the room can take the host's job **without a client change** by electing a reserved id (`@room`, never a player) and emitting the same `coop-snap`/consuming the same `coop-hits` itself (td-coop.spec.ts drives a member from an `@room` host). What ports to node as-is: `MobSystem` (AI, shots, bursts, elites, bosses, calls, claims through `applyClaim`, `selfAway` for "no player of its own"), the host half of `TdCoop` (encoder, ClaimGate, events), `coop-protocol`/`coop-rules`, and the world's spawn tables (`TdWorld.spawnsIn`) — roughly 80–85% of the host loop. New code: the spawner/Seam-Eater glue now in `td-engine.updateFight`/`updateSeam` (~60 lines), a per-area world registry and tick loop in the room, all players as `others` (the room has no Keeper of its own), and moving ground drops/corpses into the snapshot (today loot is personal and rolled on each screen, which a room-run world can keep). The cost is CPU and one instance's memory per active area.
  - **Trust-based, not authoritative**: the host is a player's browser. A modified host can grant kills, bite members or invent creatures; a modified member can claim damage up to its level's budget. The gate bounds the cheap abuse; real authority means the room simulating (Phase 8). Latency: a member's hits show at once as numbers but the bar moves on the next snapshot (~125–250 ms); creatures chase where the room last saw a member (presence goes every 150 ms while sharing), so a bite can land a step behind a fast mover. Crowd control a member casts (stun, root, taunt, slow) is visual on its own screen only — the host's creatures do not feel it yet. Difficulty is the host's: a member on a harder tier gets the host's creatures (and its own tier's loot table).
- **Party loot rules**: **personal loot** — every member near the kill rolls their own drop table on their own client (the boss's roll is seeded by `bossKillId + playerId`, so a reload cannot re-roll). Nothing to steal, nothing to split, no "need/greed" UI. Never shared drops until trading exists.
- **Rules**: none for shared XP. Dailies: read-only `dailies` rule ⚑. **Risk**: medium (XP inflation if abused — the caps bound it). **Size**: S (XP, done) / M (dailies) / L (bosses).

### 3.5 Friends list (Phase 3, M)
- **Data**: `users/{uid}/social/friends` (one doc: `{ids: [uid…≤200], updatedAt}`) and `friendRequests/{toUid}_{fromUid}` `{from, to, at}`. Requires **signed-in** players (guests have no stable id).
- **Authority**: Firestore rules (a request may be created only by `from == auth.uid`; only `to` may delete/accept; accepting writes both lists in a **Function transaction** so they stay symmetric). Online status comes from the room (the hearth knows which uids are present once auth lands, §3.12) — never by polling Firestore.
- **UI**: a Friends page in the Character hub; "Add friend" on the peer card; online dot; Seek finds friends too.
- **Rules ⚑ / Functions ⚑**. **Risk**: low–medium (spam requests → rate-limit by rule `request.time` and a cap of 20 pending). **Size**: M.

### 3.6 Whispers / DMs (Phase 3, S–M)
- **Live whispers**: `POST /whisper {to, text}` relayed by the room to one session (same validation as chat, 5/10 s), never stored. Tibia's `*name* text` in Chat.
- **Offline DMs** (later): `mail/{toUid}/inbox/{id}` written by a Function (rate-limited, profanity-filtered), read once on login, deleted after 30 days. Friends only by default.
- **Authority**: server relay; block list consulted server-side. **Rules ⚑** for mail. **Risk**: harassment → block/mute (§3.9) ships *with* whispers. **Size**: S live / M mail.

### 3.7 Guilds (Phase 4, L)
- **Data**: `guilds/{gid}` `{name, tag (2–4 A–Z), leader, createdAt, members: {uid: rank}}` (≤ 50, one doc), `guildNames/{lowercased}` for uniqueness, `users/{uid}/social/guild` `{gid, rank}`. Ranks: Leader, Officer, Member, Initiate.
- **Authority**: **Cloud Functions** (create — costs Gold, deducted through the economy ledger in the same transaction; invite/accept/kick/promote/disband) in **Firestore transactions**; rules make `guilds/*` read-only to clients. The room is told a Keeper's guild on join (from the verified ID token's uid) and carries the **tag** in presence (`[EMBR] Aster` over the head) and a **guild chat** channel (like party chat, keyed by gid).
- **Guild hall** (later, L): a hand-drawn instanced floor, upgrades bought with pooled Gold (a guild bank is a trading-class problem — after Phase 6).
- **Rules ⚑ + Functions ⚑**. **Risk**: medium (name squatting/profanity → filter + owner rename tool in /admin). **Size**: L.

### 3.8 Trading (Phase 6, M–L)
- **Flow**: the peer card's **Trade** → both get a window; each puts in items and Gold; any change clears both "ready"; both **Confirm** → the swap happens **atomically on the server**.
- **Authority**: a **Cloud Function** `executeTrade(tradeId)` (or the hearth calling the Admin SDK) runs one **Firestore transaction** that reads both players' inventory and economy blobs, checks every offered item/Gold is still owned, moves them, stamps `trades/{id}` `{a, b, items, gold, at, status:'done'}`, and bumps both blobs' versions. The room only carries the window's live state; it never moves items.
- **Anti-dupe**: item instance ids (not counts) for gear; the transaction fails if any id is missing; a `trades/{id}` doc is the idempotency key (a retry finds `done`); both clients re-pull their blobs from Firestore after the trade (the gateway's merge must treat the server copy as winning for these two blobs — "admin writes must speak the merge"). Untradeable: quest items, soulbound uniques.
- **Gold only, never real money.** The player market (async listings) is **owner-only** and not planned here.
- **Rules ⚑ + Functions ⚑**. **Risk**: **high** — dupes destroy the economy; ship behind a flag with an /admin audit view. **Size**: M–L.
- **Built 2026-10-21** (branch `trade`), with shared ground drops: see §4c for how it really works.

### 3.9 Moderation (every phase)
- **Now (built)**: validation (names, markup, lengths), per-session and per-IP rate limits, room cap, idle drop.
- **Phase 3**: **block** (client hides their chat/whispers/invites; server refuses whispers/invites from a blocked uid), **mute** (local), **report** (`reports/{id}` `{from, about, lastLines, at}` — create-only rule ⚑, read in /admin), a **profanity filter** (a shared word list applied by the room to names and lines; masks, never rejects silently).
- **Banned accounts**: firestore.rules already has an `isBanned` check; once the room verifies ID tokens (§3.12) it refuses `/join` for a banned uid (read once at join via the Admin SDK) and kicks a live session when /admin bans.
- **Risk**: real — anonymous chat is the first thing abused. Phase 3 should land before any public promotion.

### 3.10 Privacy settings (Phase 3, S)
- Settings → Online: **Appear offline to friends**, **Who can whisper** (everyone / friends / nobody), **Who can invite** (everyone / friends), **Show my level** (presence omits it). Stored in `users/{uid}/social/privacy` (one doc, gateway-synced), sent to the room on join; the room enforces invites/whispers. Chat → Ignore (exists) stays the "fully solo" switch.

### 3.11 Leaderboards (Phase 7, S–M)
- **Data**: `leaderboards/{board}` (one doc per board: top 100 `{uid, name, value}`), rebuilt by a **scheduled Function** every 15 min from `users/*/progress/state` (Keeper level, Hunting XP, bosses felled, deepest floor). Clients read **one doc** per view (cheap). Opt-out by the privacy setting.
- **Authority**: the Function; the monotonic-XP rule already guards the source. **Rules ⚑ + Functions ⚑**. **Risk**: cheated values from client-trusted progress → show only signed-in, add an /admin strike. **Size**: S–M.

### 3.12 Scaling and auth (Phase 8, and the auth piece earlier)
- **Auth (lands with Phase 3)**: the client sends its **Firebase ID token** on `/join` (`Authorization: Firebase <idToken>`); the room verifies it with `firebase-admin` (cached public keys, no per-request cost) and binds the session to the uid (name from the profile). Guests may still join, marked as guests (no friends/guilds/trade). ⚑ hearth redeploy (adds `firebase-admin`).
- **Per-area rooms / shards**: one room object per area id (continent surface, floor), max 64 per room; a Keeper's presence and chat go to their area's room; party/guild/whisper channels route by id across rooms in the same process. Past one instance: **shard by realm** (one Cloud Run service or instance per continent, the client picks by area) with a tiny Redis/Memorystore pub-sub for cross-shard whispers, party and guild lines. Session affinity is required while state is in memory.
- **Transport**: WebSocket replaces SSE+POST (one socket each way, binary-friendly, fewer requests billed).
- **Persistence**: Firestore for friends, guilds, trades, reports, bans, leaderboards — never for movement.
- **Size**: L. **Risk**: medium (a rewrite of the transport; keep the protocol versioned and the client degrading, as Phase 2 does).

---

## 4. Phase 2 as built (parties) — the reference

| | |
|---|---|
| Server | `scripts/social-server.mjs` PROTOCOL 3 (`PARTY_MAX` 4, `INVITE_MS` 60 s); tests `scripts/social-server.test.mjs` (12) |
| Client room | `src/app/play/social/social-room.ts` — `invite`, `answer`, `leaveParty`, `kick`, `partyChat`, `partyKill`, `canParty`; spec `social-room.spec.ts` |
| Shared XP | `src/app/play/social/party-share.ts` (+ spec) — 60%, 12 tiles, band −20/+12, 12 kills and 200+40×lvl XP a minute |
| Engine | `td-engine.ts` `setParty` (gold plates, minimap marks/rim pips, Seek kind `party`), `?fxparty=1` test hook `window.__tdParty` |
| HUD | `side-scroller.component.*` — peer card Invite/Remove, invite toast, party frames, Party tab and `/p` |
| e2e | `e2e/td-party.spec.ts` — three browsers (one a phone): invite, accept, frames, life, party chat, shared XP, leave; and a v2-room degrade check |
| Deploy ⚑ | `scripts/social-deployment.md` § Protocol 3 — the owner's command, all four origins |

## 4b. Phase 3 as built (the social graph, protocol 4) — the reference

Built 2026-10-21 in branch `friends`. **Not deployed** (⚑ below).

| Piece | How it works |
|---|---|
| **Identity** | The client sends `Authorization: Firebase <ID token>` on `/join` when signed in (`CloudSaveService.idToken()`). The room verifies it with **no dependencies** (`scripts/social-identity.mjs`: RS256 against Google's securetoken certificates, cached; `aud`/`iss` = the project; expiry; subject). Anonymous Firebase users and anyone without a token are **guests** (`guest: true` on the player; the card shows a Guest tag). The uid never leaves the server. One account = one Keeper in the room (a second join replaces the first; the first window is told and stops rejoining). A refused token joins as a guest rather than not at all. |
| **Bans** | The room reads `users/{uid}/meta/ban` (the same doc `isBanned()` in firestore.rules reads, written by the GM console) on every signed-in join and again every 10 minutes for Keepers already in; a banned account gets 403 and the client stops its always-on loop. |
| **Friends** | Both Keepers signed in. Peer card → **Add friend** → the other gets a toast (Accept/Decline; requests live 5 min in memory). Accepting writes **both** `users/{uid}/social/friends` docs in **one Firestore commit** (`{ids, names, updatedAt}`; `appendMissingElements` / `removeAllFromArray`), via the service account. **Menu → Friends**: each friend online/offline, "in your area", Whisper, Remove; the block list with Unblock. Status is pushed by the room (on join/leave/area change/privacy), never polled — 2 Firestore reads per signed-in join (friends + blocks) and 1 ban read; writes only on accept/remove/block. Max 200. |
| **Whispers** | `/w Name text` (or `/w "Two Words" text`) in Chat, or Whisper on a card / in the Friends list (prefills `/w Name `). Relayed to one session and echoed to the sender, never stored; violet lines in the Chat tab. 5 / 10 s. |
| **Block** | Server-side: the blocker's stream stops receiving the blocked Keeper's presence (they vanish from the world), public and party lines, whispers, party invites and friend requests (the blocked one is never told). Persisted per account in `users/{uid}/social/blocks`; a guest's block lasts the session. |
| **Mute** | Client-only, this session: hides a Keeper's lines (card → Mute / Unmute). |
| **Report** | Card → Report → one reason (spam, abuse, cheating, bad name, other). The room files `player-reports/{id}` with the reported Keeper's **own last 10 public lines as the room heard them** (raw), who reported, the area, and `status: 'open'`. 3 per 10 min. The **GM console → Logs** now lists reports (open count, Resolve). |
| **Privacy** | Settings → Friends see: Online / Offline (appear offline to friends); Invites: Everyone / Friends. Saved with the other settings (synced through the gateway as part of `godforge-sound`), sent on join and on change. Friends-only refuses party invites from non-friends with the same words as a block. |
| **Profanity** | `scripts/social-words.mjs`, server-side: masks a short EN+ES list (first letter kept) through case, accents, l33t, repeated letters and spaced letters, in public chat, party chat and whispers; a rude name is shown as "Keeper". Innocent words (class, assume, Scunthorpe, cockatoo, conocer) pass. |
| **Compatibility** | v3 and older clients send no token: guests, everything else unchanged. This client against the live v3 room: no social buttons on the card, the Friends sheet says "Friends open when the hearth updates", parties/presence/chat unchanged. Before `SOCIAL_FIREBASE_PROJECT` is set, a v4 room treats every Keeper as a guest (friends need sign-in; whispers/block/report/privacy/filter all work). |
| **Tests** | `scripts/social-server.test.mjs` (9 new: identity, ban, friends, privacy, whispers, block, report, profanity, the verifier with a real RSA cert + the REST shapes); karma `social-room.spec` (3 new), `gm-reports.spec`; e2e `e2e/td-friends.spec.ts` (three browsers, fake tokens on localhost only: `SOCIAL_FAKE_AUTH=1`, refused on Cloud Run). |

⚑ **Owner steps** (scripts/social-deployment.md § Protocol 4): rebuild and redeploy the hearth with `SOCIAL_FIREBASE_PROJECT=xsantcastx-1694b` added **beside** the four origins; deploy the two new rules blocks (`users/{uid}/social/*` read-own/no-write, `player-reports` owner-only) by hand — CI's rules step 403s. IAM: none needed today — the service runs as the default compute service account, which holds `roles/editor` (includes Firestore read/write). Optional hardening: a dedicated service account with only `roles/datastore.user`.

## 4c. Phase 6 as built (trading and shared ground drops, protocol 6) — the reference

Built 2026-10-21 in branch `trade`. **Not deployed** (⚑ scripts/social-deployment.md § Protocol 6: Functions, rules,
hearth, Hosting — in that order). Owner's notes: *"trading needs to be included"*; *"drag and drop items to drop items
should appear for everybody like in tibia"*. Both dupe-proof.

**Who is the authority.**

| Piece | Owns | Never does |
|---|---|---|
| Hearth (protocol 6) | who trades with whom: it verified both ID tokens, so it writes `trades/{id}` `{a:{uid,player,name}, b:{…}, status:'open', expiresAt}` (create-only); relays offers, Accepts, confirms; tells an area what lies on its ground — after reading `ground-items/{id}` | move an item or a coin; show a ground item the escrow does not hold; hide one it still holds |
| `tradeApi` Function (functions-game/src/trade.ts → trade-core.ts) | every move, each in **one Firestore transaction**: `execute`, `cancel`, `drop`, `pickup`; `groundSweep` every 5 min | trust the client's word on what it holds (it re-reads the save) |
| The client (play/trade) | the window and the flows; pushing its save before (`gateway.syncNow()`) and adopting the server's write after (`gateway.pullKeys()`) | write `trades`, `ground*` or the audit (rules: no client writes) |

**A trade.** Card → **Trade** → the other's toast → **Trade** → one window on both screens (Tibia / D2): what you offer,
what they offer, your satchel (tap to offer, tap again to take back; worn, soulbound, quest and starter pieces are
greyed with why), a Gold field. Any change clears both **Accept**s (`rev`). Both accepted the same `rev` → **Confirm**.
Each Confirm pushes the save, then calls `execute {trade, character, terms}` with the exact terms that window shows.
The first records `confirms[side] = {key: canonical(terms), character}` and answers `waiting`; the second, if its key is
the same, reads both inventories and (if Gold moves) both ledgers, re-checks everything, and swaps it all in the same
transaction, writing both saves, `trades/{id}` `status:'done'` with the terms, and `trade-audit/trade-{id}`. Then it
tells the room `done`; the room closes both windows; the first Keeper's client calls `execute` again (idempotent: it
answers `done` and what arrived) and adopts the write. Refused (→ `void`, nothing moved, the reason in both windows):
an item gone, moved off the satchel, bound, quest or starter, **changed since it was offered** (id, definition, stats,
roll grade, item level, upgrade, sockets, reforges), Gold the purse or its replay cannot cover, the receiver at the
700-record budget, a save from another era/version (open the game once), different terms in the two calls, the trade
expired (10 min), or both sides the same account. A window closed after its Keeper confirmed calls `cancel`, so that
confirmation can never complete later. Guests cannot trade (the room refuses the ask; the Function refuses anonymous
tokens), banned accounts cannot (the Function reads `meta/ban`; the room already bars them), blocked pairs cannot
(either direction, the same words as a busy Keeper).

**A ground drop.** In the satchel, an item's card has **Drop** (phones), or drag the item out of the satchel onto the
world (desktop). `drop` takes it out of the save into `ground-items/{gid}` `{item record, area, x, y, owner
{uid, character}, expiresAt: +10 min}` and bumps `ground/{area}.count`; then the room is told and checks that document
before showing it to **everyone in the area** (not just the party), drawn like loot — the rung's light column, a plate
in its rarity colour (td-engine `setSharedGround`). A tap walks there and calls `pickup`: one transaction reads the
ground document, so **only one picker can win**; the other is told "Someone else picked that up". After 10 minutes the
sweep (or the next reach for it, lazily) returns it to its dropper's save. Caps: 60 items per area (`ground/{area}`
count, in the transaction), 10 drops a minute per account (`ground-rate/{uid}`, in the transaction), plus the room's
own per-session limits.

**How the server's writes speak the merge** (memory *"Admin writes must speak the merge"*; trade-core's header):
- An item **leaves** a save as a tombstone at `hlc = Number.MAX_SAFE_INTEGER` (device `trade`). The merge drops any
  record its tombstone outranks, and nothing a device stamps later can outrank it — a stale phone that still holds the
  record, even one that re-equips or tempers it after the trade, loses it on its next merge (trade-merge.spec). The
  ledger's own `hlc` is not raised (the merge computes it from records and folds), so device clocks are untouched.
- An item **arrives** as a new record under a **new id** derived from the trade or ground id (a retry writes the same
  id), at `max(now, hlc+1)`, in the satchel, with its frozen roll grade (memory *"Item rolls carry a frozen grade"*).
  The new id is what lets an item come back to a Keeper who once gave it away (the old id's MAX tombstone would eat it).
- **Gold** leaves as `spend-gold` and arrives as the new `receive-gold` op (a credit that is not "earned": passing Gold
  back and forth must not farm `totalGoldEarned`), ids `trade:<seq>` above every `trade` op and watermark the ledger has,
  at `nextHlc(ledger.hlc)`, the snapshot moved in step, and the first op on a ledger freezes its `origin` (as a device
  does). Ops union by id, so each lands exactly once everywhere. The debit is checked against the **replayed** balance
  (`replayGold`: origin + ops, a debit skipped when unaffordable), because that is what every device will compute — a
  debit the replay skips would mint Gold.
- **`serverSeq`** on the inventory ledger goes up on every server write; the merge keeps the max; firestore.rules
  refuses a client write of `progress/inventory` (root and per character) whose `v.serverSeq` is lower than the stored
  one. That closes the one real race: the gateway pushes the inventory with read-merge-`setDoc` (not a transaction), so
  a push that read the document a moment before the Function wrote it would put the traded item back. Refused, the
  gateway keeps the key dirty and retries with a fresh read, which merges the move in. The economy document needs no
  guard: the client already writes it in a transaction, which Firestore retries on contention.
- After a move, `gateway.pullKeys([inventory, economy])` reads those two documents at once (owners flushed first),
  merges, caches and rehydrates the owners in the same tick, and re-queues anything the cloud lacks.

**Anti-dupe guarantees.** One transaction per move (all reads before writes); idempotent retries (stable ids for
everything written: trade results, received ids, ground ids, picked ids); both players' consent bound to the exact
terms (`canonical` JSON compared server-side); items re-checked unchanged by id and roll; Gold checked against the
replay; the trade and drop paths both refuse what is not loose in the satchel; one pickup wins; the room cannot invent
or hide ground items (it reads the escrow); clients cannot write any of the documents involved. Node tests prove the
swap, the refusal on a changed item, the double-pickup race (optimistic-concurrency retry in the in-memory Db), expiry
returning home, and **conservation of Gold and item count across 60 random trades** (some sabotaged); karma proves the
client merges honour every server write (trade-merge.spec) and drives the client flows against the real core.

**Limits, stated.**
- A device holding unsynced **Gold spends with an earlier clock** than the trade's debit (another device of the same
  account, offline, behind the lease) can make the trade's debit replay as unaffordable on merge — the receiver keeps
  the Gold, the giver keeps it too. The window is small (the trading device pushes right before it confirms; the device
  lease means one device writes at a time), but it is not zero. Fix if it matters: fold the debit into the ledger's
  `origin` under a watermark instead of an op (the Gold-era technique).
- Tombstones are capped at 512 and age out after 30 days (inventory-ops). A device that has not synced for longer than
  that and still holds a traded item could bring it back. The same limit applies to every deletion in the save today.
- Rules need deploying with the Functions; until then the inventory guard is absent and the gateway's push could, in
  the read→write window, overwrite a trade (the trading device pushes before and pulls after, so the window is its own
  4-second debounce).
- The ground list in the room is memory: a hearth restart forgets what is drawn (the escrow still returns every item
  home on time). A late joiner sees the area's ground from the room, never from Firestore (no per-player reads).
- Crowd behaviour of Firestore transactions (contention on `ground/{area}` in a busy area) is untested — the area doc
  serialises drops and pickups there by design.

**Not testable without real Firebase** (no Java here, so no emulator): the rules themselves (only the serverSeq guard is
mirrored by the fake), `verifyIdToken` / anonymous / ban refusals in trade.ts, the Admin SDK transaction's own retry
behaviour, the scheduled sweep's Cloud Scheduler trigger, and the hearth's REST writes of `trades/{id}` (the REST shape
mirrors the existing friends writes). The e2e (e2e/td-trade.spec.ts) runs the real core behind a fake endpoint on the
local hearth: two browsers (one a phone) trade, then drop and pick up.

**Rules reasoning** (firestore.rules, "Trades and ground drops"): `trades`, `ground-items`, `ground`, `ground-rate`,
`trade-audit` are `write: if false` for every client — a client that could write `trades/{id}` could confirm for the
other side; one that could write `ground-items` could mint an item. Reads: a trade by its two parties only; ground
items and area counts by any signed-in Keeper (anyone may see and pick up — the pickup is the Function's); a drop
window by its owner; the audit by the owner only. The inventory update rule gains `serverSeqHolds(docId)`
(`v.serverSeq` may not go down), which an honest client always satisfies because the merge keeps the max; the
monotonic-XP guard on `progress/state` is unchanged.

| Code | Where |
|---|---|
| Server core (pure) | `functions-game/src/trade-core.ts`; Functions `functions-game/src/trade.ts` (`tradeApi`, `groundSweep`) |
| Hearth | `scripts/social-server.mjs` protocol 6; `social-identity.mjs` `openTrade`/`groundItem`; fake: `scripts/trade-fake.mjs` |
| Client | `play/trade/` (`trade-items`, `trade-flow`, `trade-backend.service`, `trade-hud.component`, `trade.i18n`); `social-room.ts` verbs; td-engine `setSharedGround`; gateway `syncNow`/`pullKeys`; inventory `serverSeq`; economy `receive-gold` |
| Tests | `scripts/trade-core.test.mjs` (13), `social-server.test.mjs` (3 new), karma `trade-merge.spec` (5) + `trade-flow.spec` (5), e2e `e2e/td-trade.spec.ts` |

## 4d. Phase 8: the room simulates (protocols 7–10) — design, M1, M2, M3 and M4 as built

Owner, 2026-10-22: *"the server owns the world, so everyone sees the same monsters and cheating is hard."* Hosting
stays **option A**: Cloud Run `eclipse-hearth`, us-central1, 1 vCPU / 512 MiB, request-based billing, min 0, max 1,
session affinity. Nothing billed changes; a ~2 s cold start is accepted.

**Transport: SSE down + JSON POST up, kept (not WebSocket yet).** Cloud Run does carry WebSockets, but: the room has no
dependencies and Node ships no WebSocket server (a hand-rolled RFC 6455 framer is risk for no gain at 8 Hz); every
deployed client, the protocol-6 trade flow and the CSP already speak SSE+POST; and billing is the same (an open SSE
stream and an open socket both hold the instance's CPU). Latency of an intent is one HTTPS POST on a kept-alive
HTTP/2 connection to `run.app` — the same RTT a socket frame would pay. Revisit when per-message overhead shows up in
the bill or the profile (M3).

**The room is the host.** The client already treats "the host" as an id the room names (§3.4): in a **world area** the
room names the reserved id `@room` and plays the host's part itself, on the protocol-5 wire, so a client draws the
room's creatures exactly as a party member draws its host's. The simulation is the game's **own** code, not a port:
`src/app/play/world/room-world.ts` runs `MobSystem` (AI, shots, bursts, elites, calls, the damage path), the island's
spawn tables (`TdWorld.spawnsIn`), zone levels, the sky, `MobSystem.spoils` (Gold, materials, potions, Blanks) and the
gear table (`drop-tables`). `scripts/world-sim-build.mjs` bundles that module and its imports into one plain ES module
for the image (`world-sim.generated.mjs`, built at deploy, git-ignored); tests and a local room compile it in memory.

**Protocol 7 (new on top of 6).**

| | |
|---|---|
| join | `world: true` (an older client never says it) → the reply's `world: true` when the room runs the world |
| `coop` event | as protocol 5; in a world area the entry is `{host: '@room', term, members: [everyone of the world there]}` — party or not |
| `coop-snap` | from `@room`, **one delta encoder per Keeper** (the creatures within 24 tiles of *that* Keeper, ≤48, nearest first), 8 Hz; its bites, the kills near it, shots and bursts near it |
| `POST /coop/hits` | a Keeper's blows as claims `{area, hits}` → weighed by the room (below); `/coop/snap` from a Keeper in a world area → 409 |
| `world-ground` event | `{area, items}` on arrival / stream open, else `{add}` / `{gone}`; each piece `{id, x, y, m (its creature), coins / material+qty / item / rune, label, color, own[], free ms}` |
| `POST /world/take {id}` | the first allowed Keeper wins, answered from memory → `{ok, drop}` or `{ok:false, why: gone/owned/far/area}`; 40 / 5 s |
| `POST /world/return {id}` | a satchel too full to hold it: it lies again (the taker only, within a minute) |
| `/health` | `protocol: 7`, `world: {areas, awake: [{area, keepers, creatures, ground}]}` |

**Rooms per area.** `WORLD_AREAS` names the areas the room runs (**M1: `ember-isle`**, the Seamworks island's surface).
Each awake area is one `RoomWorld` (20 ticks a second, 8 snapshots a second to each Keeper). Everywhere else nothing
changed: party co-op (protocol 5) elects a player host as before; in a world area a Keeper of the world is never elected.

**The authority boundary.**

| Now (M1) — the room decides | Still client-trusted (M2+) |
|---|---|
| creature life, AI, movement, spawns and respawn timers on the island | the Keeper's own life (bites land through its own defenses on its screen) |
| every hit on a creature: a claim is bounded by the room's own record — within 16 tiles of where the room last saw the Keeper, a clear line of sight beyond 2.5 tiles, at most `40 + 20 × level` a second over a rolling 3 s (clipped) | the size of a blow within that budget (the client computes it from its gear; the room only bounds it) |
| deaths, and who fought (who may take the loot first) | Hunting XP and Gold credited to the save (paid by the client on the room's kill / take, through the same idempotent doors) |
| **loot rolls** (once per kill, from the room's seeded stream: the pile, materials, potions, Blanks, gear rarity and base) and the **ground** (who may take, first come) | an item's affixes (minted at pickup from the player's seed + the room's drop id, as every drop is) |
| the level the room believes: what the Keeper reports, but rising at most 3 a minute | the reported level itself (M2: read the save's XP at join) |

**Speed.** A pick removes the piece from the screen at once and floats its label (client-perceived 0 ms); the room
answers from memory (measured below); a yes grants it through the normal pickup door, a no puts it back (or says
*"Someone else picked that up."*). Ground persistence is written in the background, never on the take's path.

**Sleep and persist.** An area with no Keeper streaming for 30 s goes to sleep: its ground (absolute expiry) and its
resting spawns (absolute end) are written to `world-rooms/{area}` (one document, one JSON field, by the service account;
firestore.rules' deny-all already refuses every client) and the world is dropped from memory. The next Keeper wakes it
(one read). While awake it is written at most once a minute when it changed, and on SIGTERM (Cloud Run's scale-to-zero
gives ten seconds). Creatures themselves are not kept: they rise again from the spawn tables.

**Anti-cheat, M1.** Unknown keys refused, ids and numbers bounded (the protocol-5 validators); claims: range, sight,
budget, the creature must live; takes: the id format, reach (10 tiles of the room's record, the coin magnet's 8 + slack),
ownership window (20 s for its fighters), first wins; snapshots from a Keeper in a world area refused; the level rise cap;
the room's ground ids never collide with a client's (`td:surface:w.<area>.<boot>.<n>`). Rate limits as protocol 5/6.

**Old clients.** A protocol-6 client never says `world: true`: it is never hosted by the room, never sent `@room`
snapshots or `world-ground`, and keeps simulating its own creatures on the island exactly as before. It still sees the
world's Keepers as peers (presence is unchanged) and can party, trade and drop. A party mixing old and new clients on
the island: the old ones elect among themselves; the new ones are the room's.

**Migration of what exists.** Protocol 5 (party host authority) stays for every area the room does not run, and its
wire *is* the world's. Protocol 6 (trades, player ground drops through `tradeApi` escrow) is unchanged in M1: a player's
own dropped item still goes through the Function's transaction (dupe-proof); the room's loot is a separate ground the
room owns. M2 moves trades into the room (settled from memory, one atomic Firestore commit for durability) and player
drops onto the room's ground with the same escrow write in the background.

**M2 as built (protocol 8, 2026-10-22, branch `world-m2`; hearth revision 00011 live).** A client says `protocol: 8`
and names its `character` on `/join`; the reply says `settles: true` when the room carries the trade core. Older
clients never say it and keep protocol 6/7's paths unchanged (the room serves both until they refresh).

| | |
|---|---|
| **The trade core aboard** | `scripts/world-sim-build.mjs` bundles `functions-game/src/trade-core.ts` (as `tradeCore`) and `world/keeper-budget.ts` into the image beside the world — the Function's own code, not a copy. The room's writes go through trade-core's `Db`: Firestore's REST transactions in production (`social-identity.mjs` `firestoreStore().db`: `:beginTransaction`, reads inside it by `:batchGet`, one `:commit`; an ABORTED commit runs the whole function again), an in-memory optimistic store in tests and the local e2e. Service account as protocol 4; no new IAM. |
| **Trades settled in the room** | A trade between two protocol-8 Keepers is `room: true`. Accept pushes the save first (`TradeFlow.beforeAccept`); when both accept the room **prechecks**: one `:batchGet` of the trade, both inventories and both ledgers, and `settleTrade` run on a throwaway copy. Confirm goes to the room only. The second Confirm **settles from memory**: both windows close at once with what each receives (`trade-end {settled, received}`), then **ONE** transaction (`trade-core settleTrade`, the same `swap` the Function's `execute` runs) re-reads and re-checks everything and writes both inventories, both ledgers, `trades/{id}` `status: 'done', room: true` and the audit. `trade-commit {ok}` follows; only then does the client re-read its save (`pullKeys`). A precheck refusal is told before anything settles; a commit refusal ("changed since it was offered") says nothing moved. |
| **Crash between settle and commit** | The commit is the truth: until it lands nothing has moved. A client whose commit word never comes asks `/trade/status` after 8 s (or when its stream returns); a room that does not hold the trade (it restarted) runs `closeTrade` — a transaction on `trades/{id}`: `done` stays done (the client re-reads), anything still open becomes `void` ("interrupted, nothing moved"). Because both the late commit and the close are transactions on the same document, exactly one can win (node test: 8 races, Gold and items conserved). |
| **Drops laid by the room** | `/ground/drop {area, x, y, item}` from a protocol-8 Keeper: the room lays it **at once** (`pending: true`) on everyone's ground (`ground {add}`), answers, and escrows it behind with trade-core `dropItem` (one transaction: out of the dropper's save under a MAX tombstone, into `ground-items/{gid}`, the area cap and the per-account rate). A save that does not hold it yet (looted a moment ago) waits for the dropper's `/ground/synced` (sent after its push) or a timer, up to 12 s / 8 tries; then — or on any other refusal (worn, soulbound, changed) — it goes **back**: off everyone's ground, `ground-note {returned, why}` to the dropper (the item never left its save). Landed: `ground-note {escrowed}` and the dropper re-reads its save. Nobody can have a pending drop. |
| **Picks** | `/ground/pick {id}`: the first Keeper the room hears (within 10 tiles of its record) wins in memory — off everyone's screen at once — and the room runs trade-core `pickupItem` (one transaction; a pick of a still-pending drop waits for its escrow). Yes → `{ok, item}` and the picker re-reads its save; a picker whose save is not in the cloud yet is told `no-save`, pushes and reaches once more; any refusal puts it back. A protocol-6 `/ground/take` cannot clear a drop the room laid while it escrows or is being picked. Guests can neither drop nor pick. |
| **Server-known stats** | On join (signed in, character named) the room reads `activity`, `keeper-look` and `inventory` in ONE `:batchGet` (`store.readSave`) and computes `keeperBudget`: the level its Hunting XP reads as (keeper-level.ts — not the presence's), and the worn gear's lift ((1 + damage%)(1 + crit%)(1 + speed%), capped). Re-read every 5 minutes while in the world. The claim gate's budget is `max(40 + 20·L, 4 × REF_DPS(L) × gear lift / 1.4)` (REF_DPS: combat-sim's best sustained single-target DPS by level; ×4 for blows on a crowd; lift ≤ 3) — ≥ 3× the simulated Keeper at every level, so honest play is never clipped, and a level-5 save cannot claim level-40 damage. Guests: `40 + 20·L` with L the reported level rising ≤ 3/min **capped at 30**. A protocol-7 signed-in Keeper (no character named): M1's level budget until it refreshes. |
| **Party across a relog (WoW)** | A party is a roster by account. A signed-in member logging out (or replaced by its own new window) stays in it **offline**: the others' `party` event carries `offline: [{id, name}]` (greyed frames; the leader can remove one by its row id); the lead passes to an online member. Logging back in rejoins it with no invite — from memory, or from the store after a restart: `parties/{id}` `{leader, members: [{key: uid, name, rid, offlineAt?}], updatedAt}` and `users/{uid}/social/party` `{party}`, written only by the room (the pointer is its owner's to read; `parties` falls to the deny-all — no rules change). Leaving or being kicked clears the pointer; under two members the party disbands and every pointer is cleared; a party with nobody online for 2 h is disbanded at the next login. Guests' places end with their session, as before. Notes `offline`/`back` go to protocol-8 clients only. |
| **`/health`** | `protocol: 8`, plus `economy: {settled, committed, voided, commitMs, escrowed, escrowFailed, escrowMs, picked, pickMs}` — the room's own running averages of its Firestore writes. |

**The authority boundary after M2.**

| The room decides (M1 + M2) | Still client-trusted |
|---|---|
| creatures, hits within a budget **from the save** (level and gear), deaths, loot rolls, the room's ground | the size of each blow within that budget; the Keeper's own life (bites land on its screen) |
| **trades**: both consents, the precheck, the settle, the one commit (both saves, both ledgers, the audit) | what the window shows before Accept (re-checked by the commit anyway) |
| **player drops and picks**: on the ground at once, escrowed and picked in its own transactions, first come | — |
| **party membership across relogs** (persisted) | XP and Gold credited to the save (paid by the client on the room's kill / take, through the idempotent doors) |
| | an item's affixes (minted at pickup from the player's seed + the room's drop id) |

**Measured.** Local (node tests, `scripts/social-m2.test.mjs`): settle 0.8 ms after the second Confirm reaches the room;
a drop on the other Keeper's stream 0.9 ms after it was sent; a pick's transaction 0.1 ms in memory. e2e (two
browsers, `e2e/td-world-m2.spec.ts`): the drop on the other screen **3–4 ms** after the Drop click; a trade `done` on
both screens **3 ms** after the second Confirm. Live (revision 00011, guests, from the owner's machine): a POST round trip
**~195 ms** median (145–230), another Keeper's stream hears a Keeper's POST **~190 ms** after it is sent — so live, the
dropper sees the drop at 0 ms (optimistic), others at ~190 ms; a trade shows done ~200 ms after the second Confirm; the
commit/escrow/pick write times show in `/health economy` once signed-in players use them (no live sample yet: the site
still serves the protocol-7 client until it is pushed).

**Limits, stated.** XP and Gold are still credited by the client on the room's word; a blow's size within the budget is
the client's; the Keeper's own life is its screen's. The room's list of player drops is memory: a hearth restart forgets
what is drawn (each escrowed item still goes home on time through `groundSweep`). A sale of a dropped item in the
~0.1 s before its escrow lands could keep that item's vendor value (the satchel hides a pending drop from the trade
window and from a second Drop; the shop does not check) — as protocol 6. The budget's gear lift reads worn records'
`stats` (upgrade multipliers, sets and uniques ride inside the ×4 headroom). A protocol-7 client keeps M1's trust until
it refreshes.

**M3 as built (protocol 9, 2026-10-26, branch `m3`; hearth revision 00016 live).** Owner: *"the game server and all zones should be on at the same
time … monsters respawn at random times … bosses once an hour … world bosses for OP items … more monsters, hot spots."*

| | |
|---|---|
| **Every area in the room** | A client that says `protocol: 9` is hosted by the room in **every** area: the four continents' surfaces and all 47 hand-drawn levels (`room-world.ts WORLD_AREAS_ALL` = `td-levels` CONTINENTS + LEVELS; the level tables moved out of td-engine into the pure `td/td-levels.ts`). A floor's RoomWorld is its `HandLevel`: all of it lives at once (Tibia), never pruned; its ground ids are `td:<floor>:w.<area>.…` (grave-goods reads the floor from them). Elite packs are on in the room as on every screen. |
| **All zones on at once** | While any Keeper is anywhere in the world, every area stays loaded: the ones with Keepers tick at 20 Hz; the rest take a **dormant tick** once a second (`RoomWorld.idle`: the fallen rest on, the ground crumbles, world bosses keep their clocks; nothing moves). With nobody in the world for `sleepMs` (30 s) the room writes each changed area to `world-rooms/{area}` and drops them all (Cloud Run scales to zero as before). The first Keeper back wakes **all** areas (one read each); resting spawns and the ground carry absolute times, world-boss clocks are fast-forwarded (`fastForward`: a rising slept through came and went), so life looks continuous. A late step simulates at most ¼ s but the rest clocks run on real time. |
| **Respawns** (`world/respawn.ts`) | Each fall draws its own rest from the room's stream (`MobSystem.respawnOf`): ordinary **60–90 s**; elite leaders and champions **3–5 min**; floor bosses **51–69 min**; the story's gate bosses (Ember Warden, the Uncounted, Cinder Sovereign, Elder Rootwyrm) **8–12 min** so no Keeper waits an hour to sail on. A solo screen keeps RESPAWN 75 s. |
| **World bosses** (`world/world-bosses.ts`, data per boss) | Old Greymaw (Ember Isle F/f, L12, every 3–5 h), Gharak Emberjaw (Reach h/F, L32, 4–6 h), the Copied Hart (Verdant J, L42, 5–7 h), Ser Wickless (Umbral x/Q, L55, 6–8 h); each stays 2 h unfound. A named unique leader of an existing creature (its art) ×6 life, ×1.35–1.4 blows, its affixes and pack, bound so it is never pruned; a random walkable spot in one of its regions, 14 tiles clear of every way down. Its fall rolls the elite's loot + 3–5 unique-rank rolls + at 40–50 % one of its three uniques (at the unique's rarity). `world-omen {boss, name, area, at: rise/fall/gone, level}` to every protocol-9 Keeper in the world; the client's line (`world-bosses.i18n.ts`, EN+ES) adds "Dangerous for your level" when it stands 4+ above. Clocks persist in the area document (`wb`). |
| **Density and lairs** | Wild packs 2–4 a chunk (were 1–3) and higher region chances; continent **hot spots** (`ContinentDef.hotspots`: per region, a chance per chunk, ≤5 of the region's lairing creatures round bones in a tree-free ring); every dungeon floor a **lair** (`td-levels FLOOR_LAIRS`, ≤5 round its bones/ore/boulder, 8 tiles from the stairs, 10 from the boss). Filler trees thinned (Deep Emberwood .34→.26, Emberwood .14→.10, jungle .30/.15→.23/.12, fens .10/.055→.08/.045). The sims' rule: a lair of five at the ~75 s mean rest sustains exactly the sims' 240 kills an hour (combat-sim TRAVEL), so XP and Gold per hour stay what the sims band; both sims are green unchanged. |
| **Old clients** | A protocol 7/8 client keeps M1's island only (`isWorldArea(area, s)`), simulates its own creatures everywhere else and never hears an omen, until it refreshes. The ground-id pattern widened on both sides (`td:<level>:w.`); the island's ids are unchanged, so an open protocol-8 client still takes its loot. |
| **`/health`** | `protocol: 9`; `world: {areas, every, loaded, awake[], creatures, ground, resting, bosses[], step {avgMs, maxMs}, rssMB, heapMB}`. |

**Measured (M3).** The deploy bundle in its own process, all 51 areas loaded, 120 s simulated at 20 Hz with snapshots
and blows: 4 Keepers → 0.04 ms a step, rss 87 MB; 20 Keepers (245 creatures) → 0.39 ms a step (≈1.2 % of one vCPU),
rss 147 MB, heap 42 MB; 60 Keepers (658 creatures) → 1.3 ms a step (≈3.4 %), rss 287 MB, heap 91 MB. Loading every
area costs ~12 MB. Inside 1 vCPU / 512 MiB with a wide margin (the instance's cap is 80 concurrent requests).

**Later (noted, not built).** Party-private dungeon instances (a floor copied per party, Diablo-style) — every floor is
shared and persistent for now, Tibia-style. The Keeper's own life on the room, XP/Gold credited by the room, WebSocket.

**M4 as built (protocol 10, 2026-10-26, branch `m4`; not deployed — the owner deploys the hearth once from the merged
code).** Owner: *"statuses on room creatures; the room tells me what it refused; XP and Gold credited server-side;
Keeper life on the room."* A client says `protocol: 10`; the `/join` reply adds `life` (the room keeps this Keeper's
life) and `credits` (the room pays this Keeper — signed in, a character named, a store to write to). A protocol 7–9
client keeps every earlier path unchanged until it refreshes.

| | |
|---|---|
| **Statuses on room creatures** (`world/room-status.ts`) | `/coop/hits` carries `st: [{i, k, s, m?, t, d?, n?}]` beside the blows (≤ 16; a status alone needs no blow): the creature, the kind (stun, root, chill, fear, blind, hush, taunt, slow, pull, burn, bleed, strip), the skill and mark it came from, its seconds in tenths, a burn's or bleed's damage a second, a pull's tiles or a slow's share. The room checks, in order: **legal** — `statusLegal(skill, mark, kind)` from the game's own data (td-marks MARKS: riders and the flags that lay a status, FLAG_STATUS; the eight skills that lay one unmarked, BASE_STATUS, kept honest by room-status.spec), never the claim's word; the creature lives; **reach and sight** by the room's record (as a blow); **rate** ≤ 24 a second. It then applies it with **its own numbers** (`STATUS_CAP` per kind, a boss a fifth through `ccSecs`) and **immunity** (a stun, root or fear lands at most once per its seconds + `CC_IMMUNE` 2 s — no endless chain), through the creature's own path (`MobSystem.roomStatus` → `applyStatus`): a stun or hush in a tell cancels the cast (`interruptCast`, as solo); a taunt turns the creature on that Keeper (`tauntBy`), a fear sends it away from it (`fearFrom`); a burn or bleed is ticked **by the room** at ≤ ½ the Keeper's budget a second, each tick charged to that budget (`ClaimGate.spend`) and that Keeper's blow (its kill credit). Every screen sees them: `CoopMobState.st` (a bitmask, `ST_BIT`; absent = none). The client detects what it laid by the replica's timers rising since the room's last word (td-coop `watchStatuses`; pulls and strips through `CoopLink.laid`), names the skill it holds that lays it (`MobSystem.statusSkill`: the one being cast, else the last cast, else any held), and shows it at once (optimistic; the room's bitmask confirms or clears it after 0.7 s). |
| **Refusals told** | Protocol 10's `/coop/hits` answer adds `no: [{i, why}]` and `st: {landed, refused, no}` — `far`, `sight`, `cap` (over budget), `gone`, `dead`, `illegal`, `immune`, `rate`, `bad`. The screen floats a small line over the creature for far / sight / cap / immune ("too far", "out of sight", "blocked", "shrugs it off"; EN+ES, `world.i18n.ts`), one at a time per creature. |
| **Keeper life on the room** (`world/keeper-life.ts`, `world/life-mirror.ts`) | The room keeps `KeeperLife` per protocol-10 session (it outlives area changes). **Bites**: every blow, shot, burst and ability the room's creatures land is cut here by the level gap (`gapHurt`) and the guard (`incomingDamage`, the screen's own function) and taken off at once. **Guard**: what the screen declares (`/world/life {g: {m, d, r[4]}}`: most life, base Defense, resists), never above the ceiling — the save's own (`keeper-budget saveGuard`: fightStats on the level its XP reads as, its attributes, its worn gear with set bonuses) ×1.5 + slack; a guest's, its level's (`guestGuard`). **Claims** `/world/life {c: [{q, k, n, p?}]}`, each numbered and acked (`me.q`): `heal` (regen, leech, a skill: free out of a fight, ≤ 50 % of the most a second while in one), `soak` (a ward, block or mark took part of a blow the room cut whole: ≤ the bites of the window), `potion` (its id; ≤ what that potion gives; one per `POTION_COOLDOWN`), `hurt` (harm the room did not deal: always believed), `wake` (only when down: whole). **Death**: at zero the Keeper is dying for 700 ms (a soak in flight still saves it), then **down**: a `down` event to everyone near (and `me.d`), its creatures stop hunting it, bites stop; the screen runs its fall and corpse run on that word; the hearth's wake is a `wake` claim. **The screen** (td-engine): a room bite lands through its own wards at once and the difference from the room's cut is claimed (`roomBite`); regen and heals are claimed every second (every 150 ms in a fight; a potion or a wake at once); each snapshot's `me` is the truth plus the claims not yet taken (`LifeMirror.reconcile`) — so a reconcile never undoes what the Keeper just saw unless the room refused it; its own prediction never takes the last point (death is the room's). Potions pour at once while the room keeps the life. |
| **XP and Gold paid by the room** (`world/room-credit.ts`) | A kill's event carries `cr` (`k.<boot>.<nid>`). For a signed-in protocol-10 Keeper: each fighter the room saw is **owed** the kill's base (`fighterXp`: its life's XP × the sky × the zone's level gap at the level the save reads); a pile it takes from the room's ground is owed its coins (the take answers `pays: true`). The screen asks for **its own number** (`/world/credit {c: [{id, n, s?}]}`: its worn XP, pet, the Hush; its Gold Find and Gold potion) and is given it, never past `XP_CAP` 2.5 × the base / `goldCap` (Gold Find at its cap × the potion's most); without an ask within 2.5 s the base is paid. A party mate's share (`s: 1`) is owed only when it stood within 24 tiles of a kill one of its party fought. **One transaction per batch** (≤ one per Keeper every **20 s** while it hunts — the Firestore bill; paid at once instead when it changes area, leaves the world, falls, loses its stream, the room sleeps, or the Gold owed passes 250; the screen shows the XP and Gold owed at once — the level bar and purse carry them as pending — and drops them when the commit is pulled back) through trade-core's `Db` (`creditRoom`): reads the credit ring (`users/{uid}/social/credits-<character>`), the activity ledger, the hearth and the purse; skips any id already in the ring; pays the Ember debt first (`payDebt`, hearth `ledgerAt` later); writes ONE activity op (`room:<batch>`, device `room`, the hunting total raised, the op window kept at 256) and ONE `credit-gold` op (trade-core `moveGold`, which now also counts earned Gold in the run and all-time totals as `applyOp` does); the ring keeps the last 600 hashed ids. An id whose document is not written yet is **kept** and tried again (never ringed); an answer lost on the way retries **the same batch** (the ring makes it pay nothing more). The commit sends `world-credit {ok, xp, gold, debt, ids}`; the screen pulls activity, purse and hearth back in (`pullKeys`). The screen no longer writes XP for those kills or Gold for those piles; guests and protocol 7–9 clients pay themselves as before. |
| **Old clients** | Protocol 7–9: no `st`, no `no`, no `me`, no credit; their bites land on their own screens; their claims are answered with M3's shape. The new fields they receive (`cr`, `st`) are ignored by their decoders. |

**The authority boundary after M4.**

| The room decides (M1–M4) | Still client-trusted |
|---|---|
| creatures, hits within a budget from the save, deaths, loot rolls, the room's ground, trades, player drops and picks, parties across relogs | the size of each blow within its budget |
| **statuses on its creatures**: legality by the data, reach, sight, rate, its own seconds, immunity, the ticks of burns and bleeds | which (held) skill laid a status, and that the screen's skill really fired (the data bounds what it can lay) |
| **the Keeper's life**: every creature's blow cut by the room, death and the down state, wakes, potions by id and cooldown, heals and soaks within bounds | the guard (≤ the save's × 1.5), heals and soaks within those bounds, harm the room did not deal (only ever against itself) |
| **Hunting XP and hunt Gold credited to the save** (signed in), once per kill or pile, the Ember debt first | the bonus over the base (≤ 2.5 × XP; ≤ Gold Find's cap × the potion's most) |
| | an item's affixes (minted at pickup); guests' XP and Gold (no save) |

**Measured (M4).** Node (`scripts/social-m4.test.mjs`, 9). e2e (`e2e/td-world-m4.spec.ts`, two browsers, local room):
Aster's Shield Bash → the creature stunned on Bryn's screen **82–143 ms** later (the next 8 Hz snapshot after one
POST); life claims acked in **5–9 ms** (local); a kill's XP in the save ~1.3 s after the first blow (the wolf's death,
then the batch window, then one transaction — ~20 s with the deploy's window; the screen shows it at once as pending.
Firestore's REST transaction adds ~100–250 ms live). **Cost:** a Keeper hunting nonstop makes ≤ 180 credit transactions
an hour (one per 20 s window, plus one per area change / fall / big pile), each ≤ 4 reads (ring, activity, hearth,
purse — the purse only with Gold, activity and hearth only with XP) and ≤ 4 writes (ring, activity, purse, hearth only
while an Ember debt is owed): ≤ ~720 reads and ~540 writes per player-hour (typically 3 writes), down from ~9,600 / ~7,200. Live, the feel is M2's: every bite, heal and potion shows at once on the screen;
the room's word on life follows ~200 ms later (one POST + the next snapshot) and only moves the bar when it disagrees.

**Later (noted, not built).** Party-private dungeon instances (a floor copied per party, Diablo-style) — every floor is
shared and persistent for now, Tibia-style. PvP (world-acts §6) now has its prerequisite: Keeper life, deaths and
claims are the room's. WebSocket once the bill or the profile asks.

**Next.** PvP on the room (Keeper-to-Keeper claims through the same gate and KeeperLife); retire protocol 7–9's
trust once old clients are gone; party-private instances if the shared floors crowd.

| Code | Where |
|---|---|
| The world (pure) | `src/app/play/world/room-world.ts`; wire `src/app/play/social/world-protocol.ts` |
| The room | `scripts/social-world.mjs` (areas, wake/sleep, ticks, verbs); `social-server.mjs` protocol 7; bundle `scripts/world-sim-build.mjs` |
| Client | `social-room.ts` (`world: true`, `worldTake`/`worldReturn`, `world-ground`); `td-coop.ts` (`@room` kills roll no loot; corpse ids); `td-mobs.ts` (`roomLoot`, room drops, `onRoomTake`); `td-engine.ts` (`setRoomGround`); HUD `roomTake` |
| Tests | `scripts/social-world.test.mjs` (7: determinism, loot/ownership, forged intents, sleep/wake, two clients over HTTP, v6 compat, the store); karma `room-world.spec.ts`; e2e `e2e/td-world.spec.ts` |
| M2 (protocol 8) | room: `social-server.mjs` (precheck/settle/commitTrade, layDrop/escrow/pickDrop, `/trade/status`, `/ground/{drop,synced,pick}`, the party roster + rejoinParty, readStats); `social-identity.mjs` (REST `db`, `readMany`, `readSave`, `partyRead/Write`); `social-world.mjs` (`keeperOf`: the save's budget); core `trade-core.ts` (`settleTrade`, `closeTrade`, `receivedBy`, the shared `swap`); `world/keeper-budget.ts`; client `social-room.ts` (`groundLay/Pick/Synced`, `tradeStatus`, `canSettle`, `offline`), `trade-flow.ts` (room mode), `trade-hud`, the HUD's greyed frames |
| M4 (protocol 10) | pure: `world/room-status.ts` (legality, caps, immunity, wire), `world/keeper-life.ts` (the room's KeeperLife, guards, claims), `world/life-mirror.ts` (the screen's mirror), `world/room-credit.ts` (`creditRoom`, caps, the ring), `keeper-budget.ts` (`saveGuard`, `wornTotals`); room: `room-world.ts` (`statuses`, refusals, `life` option, `downed`, `flushKills`, `cr`, `st`), `social-world.mjs` (lives, owed credit, `/world/life`, `/world/credit`, `collectKills`, `payOwed`), `social-server.mjs` (`PROTOCOL = 10`, `coopStatus`, the verbs); client: `td-coop.ts` (`watchStatuses`, `laid`, cues, `st` mirror, `me`, `down`), `td-mobs.ts` (`roomStatus`, `statusSkill`, `slowShare`, `roomTicks`/`dotGate`, `tauntBy`/`fearFrom`/`slowT`, `coopBite` → `lifeBite`), `td-engine.ts` (LifeMirror, `roomBite`, `lifeFrame`, `lifeHeard`, `fallNow`), `social-room.ts` (`protocol: 10`, `coopHits` reply, `worldLife`, `worldCredit`, `world-credit`), the HUD (credit asks, `pullKeys`, cues, a Keeper's fall) |
| M4 tests | `scripts/social-m4.test.mjs` (9, in CI's node line: legality and forged statuses, the room's seconds and immunity, a cast cancelled, the life rules, a death on the room seen by others, refusals over HTTP and protocol-9 shape, two Keepers' stun and fall, XP/Gold once with a lost answer and a replay, a room dying mid-commit, guests and protocol 9); karma `room-status.spec`, `keeper-life.spec`; e2e `e2e/td-world-m4.spec.ts` |
| M2 tests | `scripts/social-m2.test.mjs` (8: the settle and its commit, precheck/forged/mixed, the crash race, the instant drop and first pick, escrow waits and hand-backs, the party across relog and restart, the save's budget, the REST transaction shapes); `trade-core.test.mjs` (+3: settleTrade, refusals, closeTrade races); karma `trade-flow.spec` (+3), `social-room.spec` (+1), `keeper-budget.spec` (4); e2e `e2e/td-world-m2.spec.ts` |

### Summons on the room (2026-10-26, branch `minions`; protocol stays 10)

| What | Authority |
|---|---|
| A summon exists, where it stands | its owner's screen, weighed by the room: only `skel` (life of its own), count ≤ Raise Skeleton's cap at the owner's level (+2 gear), within the leash of the owner by the room's record |
| Its life | the room's after the first word (≤ its definition at that level; the owner's number only lowers it, or heals it ≤ 25%/s); a bite is the room's, the owner applies it; it falls on the room's word |
| Who a creature goes for | the room (td-threat `pickKin`): a summon out-threatening the Keeper it holds, or guarding the Keeper it would go for; a Captain's taunt names the Captain |
| Threat of a summon's blow | the summon's own (`CoopHit.k`), none to its owner |
| Seeing others' summons | everyone in the world area (relayed owner's word), not only the party |

Handoff: `docs/handoff/minions.md`.

## 5. Next phase recommended

*(Superseded: Phase 3 is built, §4b.)* **Phase 3, with auth first**: verify Firebase ID tokens on the hearth (one ⚑ redeploy), then friends + whispers +
block/mute/report + privacy together. Auth unlocks everything after it (guilds, trading, bans), and moderation must
land before the room is promoted publicly. In parallel, a small Phase 5 slice — **server-seeded spawns** — would make
party hunting look shared for very little code.

_2026-10-22: Phase 6 trading and ground drops are live: game:tradeApi + game:groundSweep (functions-game), rules with the serverSeq guard, hearth protocol 6._
