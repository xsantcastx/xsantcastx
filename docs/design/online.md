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
| 3 | **Social graph** — friends list, whispers/DMs, block/mute/report, privacy settings, profanity filter | M | ⚑ rules; ⚑ hearth redeploy (ID-token auth) |
| 4 | **Guilds** — create/join, ranks, guild chat, tag over the head; guild hall later | L | ⚑ rules + ⚑ Functions |
| 5 | **Co-op encounters** — party quests/dailies, group bosses (Seam Eater) with scaling, personal loot, host-authority dungeons | L | ⚑ hearth redeploy |
| 6 | **Trading** — two-sided confirm window, atomic Gold/item swap | M–L | ⚑ Functions + ⚑ rules |
| 7 | **Leaderboards** | S–M | ⚑ rules + ⚑ Functions (scheduled) |
| 8 | **Scale-out** — WebSocket, per-area rooms/shards, persistence, moderation tooling | L | ⚑ Cloud Run config, maybe a new host |

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
- **Group bosses with scaling (Phase 5, L)**: the **Seam Eater** eclipse event as the first. Host-authority (§3.3 step 2): the host's boss gets **HP × (1 + 0.75 × (members − 1))** and damage × (1 + 0.1 × (members − 1)); its tells and CC rules unchanged.
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

## 5. Next phase recommended

**Phase 3, with auth first**: verify Firebase ID tokens on the hearth (one ⚑ redeploy), then friends + whispers +
block/mute/report + privacy together. Auth unlocks everything after it (guilds, trading, bans), and moderation must
land before the room is promoted publicly. In parallel, a small Phase 5 slice — **server-seeded spawns** — would make
party hunting look shared for very little code.
