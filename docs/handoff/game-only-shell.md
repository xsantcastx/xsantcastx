# Game-only shell (2026-10-15)

Owner: "remove this home page or change it to the play — only navigation should be in-game", then:
"remove all unused pages and layout and css … in-game no page should redirect outside of the game."
The per-route verdicts are in `docs/handoff/page-audit.md` (committed first).

## What a player gets

- `/`, `/home`, `/world` open the game. There is no landing page, no site header, footer, bottom tab
  bar, command palette, boot curtain, WebGL backdrop, corner Forge Flame, "Keepers forged today"
  counter or NPC orb — on any route. The owner's phone screenshot (`docs/references/owner-ui/bug-home-page.jpg`)
  cannot happen any more.
- ☰ menu (the Places drawer — entries only, styling is the menus-orientation lane's) now ends with
  **Account & settings**: cloud save / sign-in (the same `app-cloud-save-button`), English/Español,
  and the analytics-cookie choice. Character and Sound were already there. The "which save wins"
  merge dialog, device lease, ban/notice strip, update toast and consent bar stay in the shell.
- Every old page URL opens the place it became, in the world: `/forge/crafting` → `/play?at=crafting`,
  `/character` → `/play?at=character`, `/codex?tab=collection` → `/play?at=codex&tab=collection` (the
  old query rides along). Deleted pages and unknown URLs land in `/play`.
- Inside a panel, a hosted page's old links (Rune Forge → "Crafting Bench", Sanctum → "Market", …)
  open that panel **in place** — no navigation, no teleport. Anything else on this origin is refused.
- Page-visit quests still work: opening a panel records its old URL, reaching a realm town records
  that realm's hall (`noteVisit` in the side-scroller).
- Deleted: the landing, Exchange (+ player-market UI), Leaderboards (station, panel, page), realm
  dossier pages, Fivefold Lock page, 404 page, header, footer, command palette, deferred overlays
  host and every component only it mounted, Quick Inspect + 3D inspect, onboarding/offline
  outlets, related-pages block, place banner, `easter-eggs.js`, `cosmic-engine.js`, arcane seal.
  Amina Thorne (broker) now stands by Lune's tables, Nox Aster (chart clerk) by the Archivist —
  their lore lines are unchanged.
- The three activity sites (Basalt Seamworks with C1 Refining, Rootglass Canopy, Meridian Orrery
  with Prospecting) are station-less panels opened from the Skills Lodge's Go buttons — they are the
  only home of Refining and Prospecting, so they stay until rebuilt as stations.

## How it is built

- `app-routing.module.ts`: only `play` (prerendered, indexable, carries the VideoGame JSON-LD,
  `canDeactivate: [stayInGameGuard]`), `admin`, `CANONICAL_REDIRECTS`, and `** → play`.
- `shared/canonical-routes.ts`: `INTO_PLAY` is the one retired-URL table; redirects are functions so
  the old query is carried. `firebase.json` has the matching 301s (same table, plus `/world/realms/**`
  and `/arena/**`).
- `play/stay-in-game.guard.ts`: refuses any navigation off `/play` except `/admin`.
- `play/world/panel-registry.ts`: `route` = the legacy URL a panel replaced; `panelForRoute()`.
  New panels `account`, `seamworks`, `canopy`, `orrery`; `exchange`, `leaderboards` removed.
- `side-scroller`: capture-phase click guard on the place panel (`panelLinkClick`), `openPanelHere`,
  `applyAt` falls back to station-less panels, `noteVisit`, `<noscript>` intro (the crawlable copy:
  `/play` must prerender an `<h1>`, `generate-sitemap` checks it). The "Open full page" link is gone.
- `shared/account/`: the Account & settings panel + its lazy i18n table.
- SEO: `/play` is the only sitemap URL and the only prerendered page (redirect stubs for old URLs
  are no longer emitted: `angular.json` prerender `discoverRoutes: false`, so old URLs reach the
  router through `index.csr.html` locally and Hosting's 301s in production).
- A brand-new browser is offered "Make your Keeper" on its first arrival in /play (it used to follow
  the deleted site tutorial); the offer writes the onboarding record so it happens once. `e2e/play-helpers`
  `seed()` writes that record so seeded specs are not interrupted.

## Gates

- `scripts/audit-nav.js` rewritten: only the game is routed; every retired URL redirects into /play;
  every `?at=` names a real station/panel; no link in the app leaves /play; every panel is reachable
  in-game — by a station (towns + Homestead), a ☰ `data-open` button, or a link from a reachable
  panel (followed through imports to a fixpoint). No per-route exemptions; checked it fails by
  renaming the menu's `account` button.
- `check-meaning`: menu panels and the Skills-linked activity panels are derived, not listed; the
  Exchange no longer counts as a sell outlet (no new violations).
- `check-i18n-keys`: 321 newly orphaned keys pruned (back to the 39 baseline orphans);
  translation.service.ts 117.8 → 80.4 kB.
- `check-ds-adherence`: three baselines lowered.

## Numbers (before = origin/main 27d4329a, after = this branch, same machine)

| | before | after |
|---|---|---|
| Initial bundle (raw / transfer) | 1.57 MB / 414.87 kB | 1.23 MB / 330.85 kB |
| Built global CSS | 54.29 kB | 38.56 kB |
| `src/styles.css` source | 104,278 B | 58,541 B |
| `dist/.../browser` total | 48.5 MB | 37.7 MB |
| Prerendered pages | 58 (29 pages + redirect stubs) | 2 (`/play` + the `/` stub; `discoverRoutes: false`) |

/play perf guards (PLAY_PERF=1, 20 s windows, 4× CPU, 390×844 DPR 3; two base runs, they bracket the noise):

| scene | before p50 / p95, long tasks | after p50 / p95, long tasks |
|---|---|---|
| town (Infernal) | 16.8–17.3 / 33.8–34.7 ms, 3–4 | 16.7 / 18.7 ms, 3 |
| Delve Furnace Hall | 33.1–47.9 / 50.3–67.7 ms, 17–142 | 17.4 / 35.0 ms, 0 |
| Prism Mines / Orrery Wells | ~17–18 / ~34–35 ms, 0 | 16.7–16.9 / 33–34 ms, 0 |

JS heap at the start of the town window 19.5–19.8 → 17.2 MB. The town gain is mostly the deleted
`cosmic-engine.js` (its cursor trail ran over /play on desktop) and the body's six-layer background.

## Not done / for the next lanes

- Non-play e2e specs: deleted the ones for deleted pages (five-realm-foundation, c8-infernal-seamworks,
  character-npc-bubble, inspect, art-routes-paint), trimmed forge-reveal/embed-smoke/runtime-proxy/
  gambler-exchange-journal; **c4-character and c5-equipment are `test.fixme`** — they drive the deleted
  header pills/keeper panel and need retargeting to ☰ → Character. `visual.spec` (opt-in) still
  screenshots `/world`, now the game. Many other non-play specs `goto` an old URL and now land in the
  panel through the redirect; they were not re-run.
- Codex secrets tied to `easter-eggs.js` (ritual mode, arcane seal) and the cursor-trail / XP-bar /
  title-prefix cosmetics have no effect now (the last two never did) — retire or re-home them with the
  Slate Journal.
- `npcForPage`, `NPCS[].paths`, the atmosphere service and `prerender-stats.ts` are dead weight left for
  a careful follow-up (data the meaning check and save code still read).
- Firebase 301 destinations carry `?at=`; whether Hosting also appends the request's own query was not
  verified (the router's redirect does carry it).
- Backend leftovers (owner only): see `page-audit.md`.
