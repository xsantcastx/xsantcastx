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
  --set-env-vars 'SOCIAL_ORIGINS=https://xsantcastx.com'
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
