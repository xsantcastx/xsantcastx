# Cross-save (phone ↔ PC) — why it stopped, and the fix

Branch `fix/cross-save`. Owner report, 2026-10-20: "we need to implement cross save, its current isnt working".

Cross-save was already built (`CloudSaveService` + `GameStateGateway`, Firestore `users/{uid}/progress|economy/*`).
Nobody had to write it again. It stopped running when the game-only shell shipped.

## Root cause 1: nothing resumes sync on page load (the main bug)

`CloudSaveService.init()` resumes a signed-in browser. It re-reads the Firebase session, then `bind()` → `gateway.attach()`,
which pulls every blob, merges it and pushes the result. It also arms the 4 s push queue: `markDirty()` returns early while
the gateway is not attached, so **no write reaches the cloud until something calls `init()`**.

Commit `86cfee98` ("the game is the site", 2026-10-15) deleted the header `CloudSaveChipComponent`. That component's
`ngOnInit` held the comment "The chip is on every page, so in practice this is what resumes sync for a bound visitor", and it
was the call that did this. After that commit the only `init()` caller was `<app-cloud-save-button>`, which is mounted only
by the lazy **Account & settings** panel (plus `forge-keeper`, which is no longer routed).

What players saw:

- Sign in on the PC → that one session synced. After a reload the PC was no longer attached, so nothing more was pushed.
- Open the phone → it never pulled the PC's progress. Its own play was never pushed either.
- Both devices still looked signed in, because the binding stays in localStorage. Progress only moved if the player happened
  to open Account & settings on that load.
- Redirect sign-in (the phone/webview fallback) returned to `/play`, and nothing read `getRedirectResult`. The sign-in looked
  like it had done nothing.

Evidence: a new e2e (`e2e/play-cloud-resume.spec.ts`) seeds a remembered binding and loads `/play`. On `origin/main` it fails
with "CloudSaveService.init() never ran". With the fix it passes. The Karma shell spec is likewise red without the fix.

**Fix:** `AppComponent.ngOnInit` now calls `cloudSave.init()` after every hydrating `init()`. `CloudSaveService` was already
in the initial bundle (the site-notice outlet injects it), so this adds no bytes. A signed-out visitor pays one localStorage
read and never downloads the auth SDK (pinned by the e2e).

## Root cause 2: two progression blobs were never registered for sync

`SYNCED_BLOBS` is the only list of what syncs, and nothing fails when a new key is missing from it. Two keys were missing:

| key | what | merge added |
|---|---|---|
| `godforge-challenges` → `progress/challenges` | Contract Board (daily/weekly counters, claims, streak, lifetime Gold) | `mergeChallenges`: per-period (an older day contributes nothing), receipts union (no double pay), lifetime max, newer streak |
| `godforge-arena` → `progress/trials` | The Trials (spendable points, tier wins, purchases) | `mergeArenaState`: balance and streak from the device that fought last (the blob does not record spends, so a max would refund them), lifetime max, receipts union |

Both owners already register with `LocalSaveRegistry`, so adopting cloud state rehydrates them in place. The existing
`progress/{docId}` rule accepts any doc id, so **no rules change is needed**.

Audited and correctly left local: `eclipse-td` (view toggle), `eclipse-play-world-v1` (where this device's Keeper stood),
`eclipse-seamworks-world-v1`, `cloud-save-uid`, and UI preferences. `eclipse-td` and `eclipse-play-world-v1` are now pinned
as device-local in the model spec.

## Checked and fine (no change needed)

- **CSP** (repo and live headers match): `connect-src https://*.googleapis.com` covers Firestore, identitytoolkit,
  securetoken and App Check. `frame-src` has `'self'`, `accounts.google.com`, `apis.google.com` and `www.google.com`.
  COOP is `same-origin-allow-popups`.
- **Auth handler**: `authDomain` is `xsantcastx.com`. `https://xsantcastx.com/__/auth/handler` returns 200, and
  `/__/firebase/init.json` serves the project config.
- **Authorized domains** (read from identitytoolkit's public project config): `localhost`, `xsantcastx.com`, both
  firebaseapp/web.app hosts. `www.xsantcastx.com` does not resolve, so it does not matter.
- **App Check**: Firestore is not enforced. An unauthenticated REST read of `changelog` succeeds, so App Check cannot be
  what blocks sync.
- **Rules**: `users/{uid}/progress/*`, `economy/*` and `meta/*` allow owner read and write (monotonic XP only on
  `progress/state`). The rules file covers every doc the client writes.

## Owner-only checks (not done, no account access)

1. **Confirm the deployed Firestore rules match `firestore.rules`.** Memory notes say the rules deploy step has 403'd and
   that a failed run skips it silently. Firebase console → Firestore → Rules → check the publish date. Or run
   `firebase deploy --only firestore:rules`. This change does not need new rules, but cloud save has never worked if the
   deployed set predates the `users/{uid}/…` blocks.
2. After the deploy, a two-device check: sign in on the PC (☰ → Account & settings), play a minute, then close the tab.
   Open `/play` on the phone, already signed in, and **do not open the Account panel**. Gold, XP and the bag should arrive
   within a few seconds. If the phone has never signed in, sign in once there first.

## Tests added

- `app.component.spec.ts`: the shell calls `CloudSaveService.init()` once per load.
- `cloud-save.service.spec.ts`: a bound device re-attaches with no click; a redirect return is completed; a signed-out
  visitor loads no auth SDK and does not attach; a lapsed binding is dropped.
- `cloud-save.model.spec.ts`: registry pin updated; merge specs for both new blobs; `eclipse-td` and
  `eclipse-play-world-v1` pinned device-local.
- `e2e/play-cloud-resume.spec.ts`: a real build resumes a remembered binding on `/play` load; a signed-out load makes no
  auth requests.

## Where the character stands (2026-10-21)
Position used to be device-only (`eclipse-play-world-v1`). It now has a synced, per-character twin,
`eclipse-whereabouts` → `users/{uid}/progress/whereabouts` (character #1) or
`users/{uid}/characters/{id}/progress/whereabouts` (#2…#5), owned by `shared/save/whereabouts.service.ts`.
- The play view still writes the device blob every 2 s (now stamped `tdAt`) and offers the same place to the service.
- `WhereaboutsThrottle` writes the synced key on the page's first place, on an area change (≥ 5 s apart), at most once
  a minute while walking, never while standing; the place it held back goes up on `pagehide` / tab hidden through the
  gateway's owner flush (`LocalSaveRegistry`). With the gateway's 4 s / 20 s batching that is ≤ ~1 document write a
  minute of play.
- Merge: the newest `at` wins, whole (`mergeWhereabouts`). Wake place: the newer of the device blob and the synced one
  (`pickWakePlace`); the lobby's area line reads the same. A place adopted mid-session never teleports the Keeper.
- Specs: `whereabouts.model.spec.ts` (throttle, merge, wake), `whereabouts.service.spec.ts` (write rate, flush).
