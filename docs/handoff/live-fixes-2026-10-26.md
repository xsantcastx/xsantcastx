# Live fixes, 2026-10-26 (branch `fixes`)

Seven live bugs. For each one: what a player saw, the cause, and the change.

## 1. SECURITY: a guest played the account's characters
- **Cause.** Guest ("Play offline") booted into the same localStorage keys as the signed-in account. Character #1 keeps unprefixed keys, and the roster and active-character choice were shared too, so a guest on a browser that was ever signed in got the account's roster and saves.
- **Change.** Saves now have profiles (`shared/save/character-scope.ts` "Profiles").
  - A guest page on a browser an account has signed in on gets its own `guest~` namespace. This covers every saved key, the roster, the active character, and the IndexedDB names.
  - `readProfile()` decides the profile: guest flag set, no account bound, and `eclipse-account-seen` (or the older `godforge-seed-sweep`) present. The profile is fixed at page boot, like the character.
  - The gateway maps keys through `this.profile`. `attach()` refuses a guest page.
  - Signing in from a guest page reloads into the account profile (`cloud-save bind`).
  - Play offline, and a session that lapsed into Play offline, both reload into the guest profile (play-shell).
  - Nothing is deleted on sign-out. The account's copies stay on disk, but no guest page can address them. This is stricter than `discardLocal()` and loses nothing.
  - A browser that has never signed in keeps its guest saves unprefixed, as before.
- **Tests.** Karma `shared/save/guest-profile.spec.ts`. e2e `play-lobby.spec.ts` "Play offline on a browser an account signed in on".

## 2. One live session per account
- **Cause.**
  - The device lease was per browser, so tabs shared it.
  - A hidden tab released the lease (gateway `onHide`) and skipped its heartbeat.
  - A passive device only got a strip and kept playing.
- **Change.** New `shared/save/play-session.service.ts`.
  - **Tabs.** An exclusive Web Lock (`eclipse-realms-play`) is held while in the world. A second tab cannot take it.
  - **Devices.** The existing lease. Hidden tabs now keep beating, and only `pagehide` releases.
  - **Takeover screen.** A session that is not the one playing gets the play-shell screen "This account is playing on another device — Play here?" in place of the world. The world is unmounted, so nothing runs, writes or sits in the Hearth.
  - **Play here.** Steals the lock, takes the lease, settles, then reloads into the world.
  - **The old session stops at once.** The Hearth already sends `replaced` to an account's older session. The client now asks its lease on `replaced`: if it still holds the lease it rejoins, otherwise it shows the screen.
  - A signed-in page joins the Hearth only after its lease answers.
- **Test.** e2e `play-lobby.spec.ts` "a second tab of the same account sees Play here?".

## 3. Trade cancel left the other window open
- **Cause.** `TradeFlow.ended` turned a `cancelled` end into stage `failed`, and the HUD kept failed windows open to show the result.
- **Change.** `trade-hud.ended`: a `cancelled` end closes the window on both screens. The other Keeper reads "<name> cancelled the trade." (`trade.cancelledBy`, EN + ES). A `void` end (a refused commit) still shows its result.
- **Test.** e2e `td-trade.spec.ts` "one Keeper cancels".

## 4. Never pause
- **Cause.**
  - The top-down loop is requestAnimationFrame only, so a hidden tab froze.
  - The Hearth stream was paused on hide (`side-scroller` visibilitychange).
  - The server idled out any session that had not posted for 45 s.
- **Change.**
  - `td-engine` `stepHidden`: a 250 ms timer catches the world up whenever no frame ran (at most 60 s per tick, in 0.05 s steps, one HUD report at the end). Hidden tabs fire it about once a second, or once a minute after five minutes.
  - The stream stays open on hide.
  - Server cleanup: a session with an open stream never idles out. A closed stream idles out as before (`social-server.test.mjs` "never pause").
  - Audio still mutes on hide.
- **Left alone on purpose.**
  - Menus still pause the world. That is not hide, idle or AFK.
  - The Forge vigil (`idle.service`) and Thrall shifts stop on hide by design. They are anti-AFK economy rules, and expeditions run on wall-clock time.
- **Billing cap** (coordinator, for the owner's €14/month Hearth budget): `play/social/hidden-cap.ts`.
  - A stream may stay open while hidden for 30 minutes (`HIDDEN_STREAM_CAP_MS`). After that the client closes it, and the local world keeps running.
  - When the tab is seen again, `SocialRoom.rejoinNow()` joins afresh at once, which restores presence, the party (kept across a relog) and a whole world snapshot.
  - Under 30 minutes nothing changes. A tab opened in the background starts the cap at once.
  - So a forgotten tab keeps Cloud Run billed for at most about 30 minutes, plus the server's 45 s idle-out.
  - Test: Karma `social-room.spec.ts` "hidden under 30 minutes…" (fake timers).

## 5. Keepers walk through each other
- **Cause.** Movement never collided with peers. What blocked was the tap: any tap on or near a Keeper opened their card and stood still, so tapping through a crowd went nowhere.
- **Change.**
  - While walking, a tap on a Keeper walks on.
  - From a standstill, the first tap names them (opens the card) and a second tap within 3 s walks onto their spot.
  - Creatures are unchanged.
- **Test.** e2e `td-peer-tap.spec.ts` "Keepers never block".

## 6. Mobs flicker around dungeon entrances
- **Cause.**
  - **(a)** A member who changed level kept its old-area replicas until the next frame. A late snapshot of the old area still matched `this.area`, and `become('solo')` then *adopted* the old area's replicas into the new level. Bosses also got rescaled down.
  - **(b)** Stepping back onto a room-run area, the client was solo until the room listed it (~1 POST): it spawned its own creatures, then the room's view wiped them.
  - **(c)** Floors spawned locally even when the room hosts them (protocol 9, m3).
- **Change.**
  - `TdCoop.left(area)` is called by `td-engine.enter()`. It drops the replicas, decoder and interp at once, so late snapshots are refused.
  - Adopting replicas only happens within the same area.
  - `roomRuns(area)`: the room is the host from the first frame, its listing is no reset, and the client falls back to solo after 5 s.
  - `enter()` raises no local spawns on a room-run floor.
  - `setCoop(…, world, everywhere)`; `everywhere` means protocol ≥ 9.
- **Tests.** Karma `td-coop.spec.ts` (3 new).
- **Left for m3.** The server must list a Keeper in the new area quickly and stream it a keyframe on arrival.

## 7. SEO
- New title "Eclipse Realms — a pixel-art online RPG", plus a new description and keywords (MMORPG, Tibia-like, Diablo-like loot, play in browser).
- JSON-LD now says MMORPG / MultiPlayer and names the four callings.
- OG and Twitter tags match, plus `og:locale:alternate es_ES`.
- Updated the noscript intro and the manifest description.
- The sitemap and robots were already right.
