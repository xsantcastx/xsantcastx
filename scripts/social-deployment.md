# Eclipse Realms guest social room

The room relays guest names, positions and chat. It does not synchronize combat,
inventory, coins or rewards. Sessions and the last 50 messages live in memory;
restarting the server clears them. Guest names are not verified identities.

## Local development

Run `node scripts/social-server.mjs` alongside the Angular development server.
The default bind is `127.0.0.1:4320`; allowed browser origins are localhost and
127.0.0.1 on ports 4317 and 4183. Tests: `node --test scripts/social-server.test.mjs`.

Configuration: `SOCIAL_HOST`, `SOCIAL_PORT`, and comma-separated `SOCIAL_ORIGINS`.
The standard `PORT` variable takes priority and defaults binding to `0.0.0.0`.
Browser origins must match exactly. Do not include trailing slashes.

## Prepared Cloud Run deployment (not executed)

The existing Firebase/Google Cloud project is `xsantcastx-1694b`. Choose the same
Cloud Run region as the Firebase Hosting rewrite (the example uses `us-central1`).
Build only the social server into the image, then deploy a single instance:

```sh
gcloud builds submit --project xsantcastx-1694b --config scripts/social-cloudbuild.yaml --ignore-file scripts/social-gcloudignore .
gcloud run deploy eclipse-hearth \
  --project xsantcastx-1694b \
  --region us-central1 \
  --image gcr.io/xsantcastx-1694b/eclipse-hearth:latest \
  --allow-unauthenticated \
  --max-instances 1 \
  --concurrency 80 \
  --timeout 3600 \
  --session-affinity \
  --set-env-vars '^|^SOCIAL_ORIGINS=https://xsantcastx.com,https://www.xsantcastx.com,https://xsantcastx-1694b.web.app,https://xsantcastx-1694b.firebaseapp.com'
```

These commands publish a guest endpoint and may incur Google Cloud charges;
review before executing. Add any actual secondary site origin explicitly.
Firebase Hosting should rewrite `/social/**` to service `eclipse-hearth` in
`us-central1`, ahead of its SPA catch-all. The server accepts both `/join` and
`/social/join` style paths. Hosting/Cloud Run provides HTTPS; no browser token or
message should pass through an unencrypted public connection.

Cloud Run connections can time out and Firebase Hosting has a 60-second request
timeout ([Firebase documentation](https://firebase.google.com/docs/hosting/cloud-run));
the client reconnects with the same session after ordinary stream interruptions (up to five attempts with bounded backoff). Expired sessions require joining again. If the Hosting
proxy cannot sustain SSE, configure the client with the direct HTTPS service URL
and keep its website origin in SOCIAL_ORIGINS. Verify this after deployment with
two independent browsers before calling it online-ready.

Keep max instances at one while rooms are in memory. Session affinity is best
effort and does not make multiple instances share state. Cold starts, rollouts,
and instance replacement clear the room. This is a bounded guest prototype (32
players), not a persistent MMO backend. Public launch still needs authenticated
identities, moderation/reporting, abuse controls beyond process-local limits,
and shared persistence before increasing instance count.

## Protocol

POST JSON `/join` `{name}` returns `{id,token,players,messages}`. Keep tokens in
memory, never display or log them. GET `/events` with `Authorization: Bearer TOKEN` is an SSE stream of
JSON `{type:'snapshot',players,messages}`, `{type:'players',players}`, and
`{type:'chat',message}`. Subsequent POSTs require `Authorization: Bearer TOKEN`:
`/update` `{x,y,facing,animation,zone}`, `/chat` `{text}`, and `/leave` `{}`.
Positions are any finite x/y within ±1,000,000; `zone` is any 1–60 character
name without markup or control characters. Send updates at least every 20
seconds, including while idle (the client sends at most one per 250 ms while
moving and a heartbeat every 10 s standing still). The server rate-limits
`/update` to 8 a second per session and coalesces the resulting `players`
broadcasts to at most one per 100 ms.

### Protocol 2 (top-down presence, 2026-10-21)

`/health` and the `/join` reply carry `protocol: 2`. `/join` and `/update` accept
these optional fields; each one, when present, must be valid or the request is
refused with 400, and players carry them in every `players`/`snapshot` event:

| field | accepted |
|---|---|
| `area` | `[a-z0-9_-]{1,40}` — the top-down area id (a continent or a floor) |
| `dir` | `side`, `down` or `up` |
| `moving` | boolean |
| `vocation` | `[a-z]{1,16}` |
| `look` | `[a-z0-9.]{1,48}` — the compact look (play/social/peer-look.ts) |
| `level` | integer 1–999 |

POST `/emote` `{kind:'wave', to?: playerId}` relays `{type:'emote', emote:{id,
from, name, to, kind, at}}` to the room (4 per 5 s per session; `to` must be a
Keeper in the room). v1 clients ignore the extra fields and the new event; the
client degrades against a v1 server (Keepers line up by `zone`, which it sets to
the area id, and drawn in the default look; a Wave shows only on the waver's
screen).
Sessions expire after 45 seconds without a client request. Render names and
messages as text, never HTML. Chat is limited to 240 characters and five sends
per ten seconds. The server limits request bodies, room size, updates and joins.

### Protocol 3 (parties, 2026-10-21 — built, NOT deployed)

`/health` and `/join` report `protocol: 3`. A client that knows parties says
`party: true` on `/join`; only such sessions can invite or be invited, so a v2
client never sees a party event and nothing it does changes. Presence also
accepts `hp` and `maxHp` (integers, both or neither, `0 ≤ hp ≤ maxHp ≤ 1e6`).

| verb | body | effect |
|---|---|---|
| POST `/party/invite` | `{to}` | leader (or no party yet) invites a Keeper not in a party; lapses after 60 s; ≤ 3 open; 5 / 30 s |
| POST `/party/accept` · `/party/decline` | `{invite}` | accept joins (creating the party on the first yes); refused when full (4), lapsed, or the host has gone; 10 / 10 s |
| POST `/party/leave` | `{}` | leaves; the lead passes on; under two members the party disbands |
| POST `/party/kick` | `{member}` | leader only |
| POST `/party/chat` | `{text}` | 1–240 chars to members only; last 30 kept with the party; 5 / 10 s |
| POST `/party/kill` | `{creature, level, hp, xp?, area}` | relayed to the other members with the killer's last presence x/y; never stored or paid by the server; 20 / 5 s |

Events: `{type:'party', party:{id,leader,members}|null, messages?}`,
`{type:'invite', invite:{id,from,name,to,until}}`, `{type:'party-chat', message}`,
`{type:'party-kill', kill}`, `{type:'party-note', note:{kind:'joined'|'left'|'kicked'|'declined', name, id}}`.
A reopened stream gets its party (with its lines) and any standing invite after the snapshot.
Leaving the room (or idling out) leaves the party. Shared XP is decided by each
recipient's client (src/app/play/social/party-share.ts) and is trust-based.

**Deploy (the owner's call — not executed).** Read the live origins first and
keep all four (the values contain commas, hence the `^|^` delimiter):

```sh
gcloud run services describe eclipse-hearth --project xsantcastx-1694b --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)'
gcloud builds submit --project xsantcastx-1694b --config scripts/social-cloudbuild.yaml --ignore-file scripts/social-gcloudignore .
gcloud run deploy eclipse-hearth \
  --project xsantcastx-1694b \
  --region us-central1 \
  --image gcr.io/xsantcastx-1694b/eclipse-hearth:latest \
  --allow-unauthenticated \
  --max-instances 1 \
  --concurrency 80 \
  --timeout 3600 \
  --session-affinity \
  --set-env-vars '^|^SOCIAL_ORIGINS=https://xsantcastx.com,https://www.xsantcastx.com,https://xsantcastx-1694b.web.app,https://xsantcastx-1694b.firebaseapp.com'
curl -s https://eclipse-hearth-773269119730.us-central1.run.app/health   # expect "protocol":3
```

The redeploy restarts the room: everyone online is dropped and rejoins on their
own within seconds (always-on); chat history (in memory) is cleared.

### Protocol 4 (the social graph, 2026-10-21 — built, NOT deployed)

The image now holds three files: `social-server.mjs`, `social-identity.mjs`
(ID-token verification and Firestore over REST, no npm dependencies) and
`social-words.mjs` (the profanity mask). Dockerfile.social, its dockerignore and
scripts/social-gcloudignore list all three.

`/join` takes an optional `Authorization: Firebase <idToken>`. With
`SOCIAL_FIREBASE_PROJECT` set, the room verifies it (RS256, Google's securetoken
certificates, `aud`/`iss` = the project), binds the session to the uid, and
refuses a banned account (`users/{uid}/meta/ban` with `banned: true`) with 403;
every other Keeper is a guest (`guest: true` on the player). Without the env var
every Keeper is a guest and Firestore is never touched. `SOCIAL_FAKE_AUTH=1`
(tokens `fake.<uid>`, in-memory store) is for the local e2e and refuses to start
on Cloud Run.

| verb | body | effect |
|---|---|---|
| POST `/friend/request` | `{to: playerId}` | both signed in; the other gets `friend-request`; lapses in 5 min; 6 / 30 s |
| POST `/friend/accept` · `/friend/decline` | `{request}` | accept writes both `users/{uid}/social/friends` docs in one commit |
| POST `/friend/remove` | `{uid}` | both sides, one commit |
| POST `/whisper` | `{to: playerId, text}` | to that session and back to the sender, masked; never stored; 5 / 10 s |
| POST `/block` · `/unblock` | `{player}` · `{key}` | hides presence, lines, whispers, invites and requests from the blocked; kept in `users/{uid}/social/blocks` for an account; 10 / min |
| POST `/report` | `{player, reason, note?}` | files `player-reports/{id}` with the reported Keeper's last 10 public lines; 3 / 10 min |
| POST `/privacy` | `{offline, invites}` | also accepted as `privacy` on `/join` |

Events: `friends`, `friend-request`, `whisper`, `blocks`, `social-note`,
`banned` and `replaced` (this account joined from another window: the client
stops rejoining). Public chat, party chat and whispers pass the mask.

**IAM.** Firestore is reached with the service's own identity from the metadata
server. The service runs as `773269119730-compute@developer.gserviceaccount.com`,
which holds `roles/editor` today (checked 2026-10-21), so nothing needs granting.
Optional hardening, the owner's call:

```sh
gcloud iam service-accounts create eclipse-hearth --project xsantcastx-1694b --display-name "Eclipse Hearth room"
gcloud projects add-iam-policy-binding xsantcastx-1694b \
  --member serviceAccount:eclipse-hearth@xsantcastx-1694b.iam.gserviceaccount.com --role roles/datastore.user
# then add --service-account eclipse-hearth@xsantcastx-1694b.iam.gserviceaccount.com to the deploy below
```

**Rules (owner, by hand — CI's rules step 403s).** firestore.rules adds
`users/{uid}/social/{doc}` (read own, no client write) and `player-reports/{id}`
(owner read/delete, owner may only flip `status`/`resolvedAt`, no client
create). The room's writes do not depend on them (service-account requests skip
the rules); the GM console's report list does. Diff the live ruleset first
(memory: "Live rules drift from the repo"), then:

```sh
firebase deploy --only firestore:rules --project xsantcastx-1694b
```

### Protocol 5 (shared creatures and companions, 2026-10-21 — built, NOT deployed)

`/health` and `/join` report `protocol: 5`. A client that shares creatures says `coop: true` (with `party: true`) on
`/join`; only such sessions are elected, sent co-op events or allowed the co-op verbs, so an older client sees nothing new.
Per party and per area (presence `area`), the room elects a host: the earliest-joined co-op member present, sticky
while it stays; re-elected when it changes area, leaves the party or the room, or sends no snapshot for 3 s while
others share its area. It announces `{type:'coop', areas:{[area]:{host, term, members}}}` to the party's co-op members
on every change (and to a reopened stream); one dropped from the party hears `areas: {}`.

| verb | who | body | relayed |
|---|---|---|---|
| POST `/coop/snap` | that area's host | `{area, seq, kf, mobs[≤48], gone[≤64]?, ev[≤24]?, tier?}` | `{type:'coop-snap', from, area, term, seq, kf, mobs, gone, ev}` to the party's other co-op members in that area |
| POST `/coop/hits` | a member with a host there | `{area, hits[1–24]:{i, d, el, c?, s?}}` | `{type:'coop-hits', from, area, x, y, level, hits}` (x/y/level: the room's own presence record) to that host only |
| POST `/coop/pals` | any co-op member (each owner its own) | `{area, pals[≤16]:{i, k: pet\|beast\|stampede\|skel\|wisp\|beacon\|glim, t?, x, y, f?, h?, m?, a?}}` | `{type:'coop-pals', from, area, pals}` to the party's other co-op members in that area; 6 / s per session |

Every creature, event and claim field is validated (unknown keys refused; ids `[a-z0-9]{1,10}`, keys
`[a-z0-9:,~._-]{1,80}`, creature ids as `/party/kill`, whole numbers in bounds, a `bite`/`kill` may only name party
members other than the host). Caps: 8 KB a body (413), 12 snapshots and 12 claim batches a second per session, 40 co-op
requests a second per party for snapshots and claims (429). Blocks (protocol 4) are honoured both ways: no snapshot,
claim or companion list travels between a blocked pair. Presence also accepts `pals` (`[a-z0-9:,-]{0,96}`: a pet and
Glim as offsets from the Keeper, cosmetic, relayed to everyone in `players`). Never stored; the room never simulates. See docs/design/online.md §3.4.

**Deploy (the owner's call — not executed).** `--set-env-vars` replaces every
variable, so the four origins and the project go in one `^|^` string:

```sh
gcloud run services describe eclipse-hearth --project xsantcastx-1694b --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)'
gcloud builds submit --project xsantcastx-1694b --config scripts/social-cloudbuild.yaml --ignore-file scripts/social-gcloudignore .
gcloud run deploy eclipse-hearth \
  --project xsantcastx-1694b \
  --region us-central1 \
  --image gcr.io/xsantcastx-1694b/eclipse-hearth:latest \
  --allow-unauthenticated \
  --max-instances 1 \
  --concurrency 80 \
  --timeout 3600 \
  --session-affinity \
  --set-env-vars '^|^SOCIAL_ORIGINS=https://xsantcastx.com,https://www.xsantcastx.com,https://xsantcastx-1694b.web.app,https://xsantcastx-1694b.firebaseapp.com|SOCIAL_FIREBASE_PROJECT=xsantcastx-1694b'
curl -s https://eclipse-hearth-773269119730.us-central1.run.app/health   # expect "protocol":5
```

To check the identity path after the deploy: two browsers, both signed in with
Google, one taps the other → Add friend → Accept; Menu → Friends shows the other
online. `gcloud run services logs read eclipse-hearth --region us-central1` shows
`[hearth] … failed` lines if Firestore or the certificates are unreachable (the
room then degrades: a failed ban read lets the Keeper in, a failed friends read
starts an empty list, a failed write is refused with "Could not save that").

### Protocol 6 (trading and shared ground drops, 2026-10-21 — built, NOT deployed)

`/health` and `/join` report `protocol: 6`. A client that trades says `trade: true` on `/join`; only such sessions are
asked to trade or told what lies on the ground. The room **relays only**: the `tradeApi` Cloud Function
(functions-game/src/trade.ts → trade-core.ts) is the only thing that moves an item or Gold. Full design:
docs/design/online.md §4c.

| verb | body | effect |
|---|---|---|
| POST `/trade/ask` | `{to}` | both signed in, same `area`, not blocked either way, neither trading; the other gets `trade-ask` (lapses 30 s); 5 / 30 s |
| POST `/trade/answer` | `{ask, accept}` | accept **creates `trades/{id}`** (both uids, players, names, `status:'open'`, `expiresAt` +10 min; create-only) and opens the window: both get `trade` |
| POST `/trade/offer` | `{trade, items ≤12, gold}` | one side's offer (items validated field by field, ≤16 KB body); clears both Accepts, `rev`+1; refused once anyone confirmed |
| POST `/trade/accept` | `{trade, rev, accept}` | at the current `rev` only; both → `stage:'confirm'` |
| POST `/trade/confirm` | `{trade, rev, done}` | this side called the Function; `done:true` (the Function swapped) closes both windows with `trade-end` `done` |
| POST `/trade/cancel` | `{trade, why?, outcome?}` | closes both windows (`trade-end` cancelled / void) |
| POST `/ground/drop` | `{id, area, x, y, name, rarity, def}` | **checked against `ground-items/{id}`** (must exist, this area, this account's) then shown to everyone in the area (`ground` add); 10 / min, 60 per area |
| POST `/ground/take` | `{id, area}` | only when `ground-items/{id}` no longer exists; `ground` gone to the area; 20 / 10 s |

Events: `trade-ask`, `trade` (the window, with `me`), `trade-end`, `trade-note` (declined), `ground` (`items` on
stream open / area change, else `add` / `gone`). Leaving the room or walking to another area cancels an open trade.
Rate windows per session; asks and trades lapse in the cleanup loop.

The image is unchanged (three files): `scripts/trade-fake.mjs` is the local e2e's stand-in and is only imported
when `SOCIAL_FAKE_AUTH=1` and `SOCIAL_FAKE_TRADE=1` (refused on Cloud Run).

**IAM.** The room now also writes `trades/{id}` and reads `ground-items/{id}` with its service account (same
`roles/editor`/`roles/datastore.user` as protocol 4). Nothing new to grant.

**Deploy order (the owner's call — none of this was executed).** Functions and rules first, then the hearth, then
Hosting (the client hides Trade until the room says protocol 6, and a trade fails cleanly — "the trade house is out of
reach" — until the Function exists):

```sh
# 1. Functions (Node 22; needs the Blaze plan, which v2 functions and the scheduler already require)
cd functions && npm ci && npm run build && cd ..
firebase deploy --only functions:tradeApi,functions:groundSweep --project xsantcastx-1694b

# 2. Rules — diff the live ruleset first (memory: "Live rules drift from the repo"); CI's rules step 403s
firebase deploy --only firestore:rules --project xsantcastx-1694b

# 3. The hearth — read the live env first; keep all four origins and the project
gcloud run services describe eclipse-hearth --project xsantcastx-1694b --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)'
gcloud builds submit --project xsantcastx-1694b --config scripts/social-cloudbuild.yaml --ignore-file scripts/social-gcloudignore .
gcloud run deploy eclipse-hearth \
  --project xsantcastx-1694b --region us-central1 \
  --image gcr.io/xsantcastx-1694b/eclipse-hearth:latest \
  --allow-unauthenticated --max-instances 1 --concurrency 80 --timeout 3600 --session-affinity \
  --set-env-vars '^|^SOCIAL_ORIGINS=https://xsantcastx.com,https://www.xsantcastx.com,https://xsantcastx-1694b.web.app,https://xsantcastx-1694b.firebaseapp.com|SOCIAL_FIREBASE_PROJECT=xsantcastx-1694b'
curl -s https://eclipse-hearth-773269119730.us-central1.run.app/health   # expect "protocol":6

# 4. Hosting (or push to main and let CI deploy)
```

`tradeApi` is called at `https://us-central1-xsantcastx-1694b.cloudfunctions.net/tradeApi/{execute|cancel|drop|pickup}`
(already in firebase.json's `connect-src`; CORS allows the same four origins). `groundSweep` runs every 5 minutes and
returns ground items past their 10 minutes to their droppers (the Cloud Scheduler job is created by the deploy).

### Protocol 7 (the room simulates, 2026-10-22 — built; hearth deploys are pre-approved)

`/health` and `/join` report `protocol: 7`; `/health` adds `world: {areas, awake}`. A client that knows the room-run
world says `world: true` on `/join`. In a world area (`ember-isle` first) the room hosts the creatures itself — the
game's own simulation, bundled into the image — and streams them on the protocol-5 wire from `@room`; `/coop/hits` from
a Keeper there is weighed by the room; loot is rolled once and taken with `POST /world/take {id}` (first allowed Keeper
wins; `/world/return {id}` when the satchel is full). Older clients never say `world: true` and keep protocol 6's
behaviour. Full design: docs/design/online.md §4d.

The image now holds five files: `social-server.mjs`, `social-identity.mjs`, `social-words.mjs`, `social-world.mjs`
and `world-sim.generated.mjs`. The last is **built before the image** from the game's TypeScript (git-ignored):
`node scripts/world-sim-build.mjs` (it runs one tick of the island first, so a broken bundle never ships). Without it
the room starts with the world off (protocol 7, but every area behaves as protocol 6) and logs
`world sources unavailable`.

Firestore: the room writes `world-rooms/{area}` (what a sleeping area keeps: its ground and resting spawns), one read per
wake and at most one write a minute while awake. Same service account as protocol 4; firestore.rules' deny-all already
refuses every client. Nothing new to grant, no rules change.

Billing: nothing changes. The command below sets no CPU, memory, min-instances or region flag, so the live values stay
(1 vCPU / 512 MiB, min 0, max 1, request-based). The world ticks only while a Keeper's stream is open (that is when
Cloud Run allocates CPU anyway) and an empty area sleeps after 30 s. Measured: ~0.03 ms a tick for one Keeper and
~0.8 ms for 32 spread over the island (20 ticks a second: under 2% of a core), ~10 MB of heap.

```sh
gcloud run services describe eclipse-hearth --project xsantcastx-1694b --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)'
node scripts/world-sim-build.mjs
gcloud builds submit --project xsantcastx-1694b --config scripts/social-cloudbuild.yaml --ignore-file scripts/social-gcloudignore .
gcloud run deploy eclipse-hearth \
  --project xsantcastx-1694b --region us-central1 \
  --image gcr.io/xsantcastx-1694b/eclipse-hearth:latest \
  --allow-unauthenticated --max-instances 1 --concurrency 80 --timeout 3600 --session-affinity \
  --set-env-vars '^|^SOCIAL_ORIGINS=https://xsantcastx.com,https://www.xsantcastx.com,https://xsantcastx-1694b.web.app,https://xsantcastx-1694b.firebaseapp.com|SOCIAL_FIREBASE_PROJECT=xsantcastx-1694b'
curl -s https://eclipse-hearth-773269119730.us-central1.run.app/health   # expect "protocol":7 and a "world" entry
```

To turn the world off without a rebuild, add `|SOCIAL_WORLD=0` to the env string (the room is then protocol 7 with
every area on protocol 6 behaviour).

### Protocol 9 (M3 of the room-run world, 2026-10-26 — deployed: revision 00015; 00016 with the fixes merge)

`/health` and `/join` report `protocol: 9`; `/health world` adds `every`, `loaded`, `creatures`, `resting`, `bosses`,
`step` and `rssMB`/`heapMB`. A client that says `protocol: 9` is hosted in every area (each continent and every floor),
hears `world-omen`; protocol 7/8 clients keep the island only. The image is the same five files; the deploy command is
protocol 8's exactly (the bundle carries the new modules):

```sh
node scripts/world-sim-build.mjs
gcloud builds submit --project xsantcastx-1694b --config scripts/social-cloudbuild.yaml --ignore-file scripts/social-gcloudignore .
gcloud run deploy eclipse-hearth \
  --project xsantcastx-1694b --region us-central1 \
  --image gcr.io/xsantcastx-1694b/eclipse-hearth:latest \
  --allow-unauthenticated --max-instances 1 --concurrency 80 --timeout 3600 --session-affinity \
  --set-env-vars '^|^SOCIAL_ORIGINS=https://xsantcastx.com,https://www.xsantcastx.com,https://xsantcastx-1694b.web.app,https://xsantcastx-1694b.firebaseapp.com|SOCIAL_FIREBASE_PROJECT=xsantcastx-1694b'
curl -s https://eclipse-hearth-773269119730.us-central1.run.app/health   # expect "protocol":9 and "every":51
```

Firestore: the same `world-rooms/{area}` documents, now one per area (51), by the service account; rules unchanged
(deny-all covers them). A wake reads each area once (≤ 51 reads per cold start); writes stay "a changed area at most once
a minute, and once at sleep". Billing: no CPU, memory, instance, region or billing flag changes (00015's annotations
checked after the deploy: max 1, min 0, cpu-throttling on, 1 vCPU / 512 Mi — as 00014, which was a console redeploy).
Live check: a protocol-8 join is answered (`protocol: 9`, `world: true`, `settles`); one protocol-9 stream woke all 51
areas in under 7 s, rss 107 MB.

### Protocol 8 (M2 of the room-run world, 2026-10-22 — deployed: revision 00011)

`/health` and `/join` report `protocol: 8`; `/health` adds `economy` (the room's settles, commits, escrows and picks
with their running write times). A client that says `protocol: 8` and names its `character` has its trades settled and
its drops laid by the room, its claim budget read from its save, and its party kept across a relog. Older clients keep
protocol 6/7. Design: docs/design/online.md §4d "M2 as built".

The image is unchanged in shape (the same five files): the trade core and the budget ride inside
`world-sim.generated.mjs`, so the deploy command is protocol 7's — build the bundle, submit, deploy with the four
origins and the project:

```sh
node scripts/world-sim-build.mjs
gcloud builds submit --project xsantcastx-1694b --config scripts/social-cloudbuild.yaml --ignore-file scripts/social-gcloudignore .
gcloud run deploy eclipse-hearth \
  --project xsantcastx-1694b --region us-central1 \
  --image gcr.io/xsantcastx-1694b/eclipse-hearth:latest \
  --allow-unauthenticated --max-instances 1 --concurrency 80 --timeout 3600 --session-affinity \
  --set-env-vars '^|^SOCIAL_ORIGINS=https://xsantcastx.com,https://www.xsantcastx.com,https://xsantcastx-1694b.web.app,https://xsantcastx-1694b.firebaseapp.com|SOCIAL_FIREBASE_PROJECT=xsantcastx-1694b'
curl -s https://eclipse-hearth-773269119730.us-central1.run.app/health   # expect "protocol":8 and an "economy" entry
```

Firestore, by the room's service account (IAM as protocol 4, nothing new): transactions on `trades/{id}`, both players'
`progress/inventory` and `economy/state`, `trade-audit/*`, `ground-items/*`, `ground/{area}`, `ground-rate/{uid}` (the
same documents and the same code as the `tradeApi` Function); `parties/{id}` and `users/{uid}/social/party` (party
across relogs); one `:batchGet` of `progress/{activity,keeper-look,inventory}` per signed-in join (and every 5 minutes
in the world). Rules: none changed (live rules were diffed against the repo on 2026-10-22: identical). functions-game:
`trade-core.ts` gained `settleTrade`/`closeTrade` (the Function's verbs are unchanged); redeployed with
`npx firebase deploy --only functions:game --project xsantcastx-1694b`.

Billing: nothing changes (no CPU, memory, min/max-instances or region flag; 1 vCPU / 512 MiB, min 0, max 1).

**Save compaction (2026-10-22, revision 00013, same command).** The trade core reads the inventory document in either
format — v2 or packed (`v.version: 3`, docs/handoff/save-compaction.md) — and writes back the format it read; the
room's budget (`keeper-budget.ts wornLift`) unpacks it too. Protocol unchanged (8). Deployed before the client, with
`functions:game` and the `inventoryFormatHolds` rule (live rules diffed against the repo first: identical).
