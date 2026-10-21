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
curl -s https://eclipse-hearth-773269119730.us-central1.run.app/health   # expect "protocol":4
```

To check the identity path after the deploy: two browsers, both signed in with
Google, one taps the other → Add friend → Accept; Menu → Friends shows the other
online. `gcloud run services logs read eclipse-hearth --region us-central1` shows
`[hearth] … failed` lines if Firestore or the certificates are unreachable (the
room then degrades: a failed ban read lets the Keeper in, a failed friends read
starts an empty list, a failed write is refused with "Could not save that").
