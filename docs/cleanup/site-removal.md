# Site removal — what the old tools site left behind

Owner, 2026-10-13: "let's optimize all aspects — we really need to get rid of so
much stuff I had in this website before that doesn't even need to be here."
Zero real players; the game is the product.

Rule used for every call below: **keep** the game (`/play` and every page a
station hosts or deep-links), account / sign-in / cloud save, admin tooling the
game uses, legal (cookie consent), support (the footer's donate modals), 404,
robots, sitemap and the PWA. **Remove** everything that only existed for the
tools site, the portfolio, the mission-control feed or the ad experiments.

Most of the page-level work was already done by earlier passes ("Product A
cleanup", v2.44.0 purge, `c64ae08`, `0e5949b`): the 126 tool pages, `/tools`,
`/mcp`, `/live`'s feed, guestbook, blog, projects, skills, contact, donate,
sponsors and pro pages no longer exist as routes, and each already has a 301 in
`firebase.json` plus an in-app redirect in `shared/canonical-routes.ts`. What
was left is the code, styles, scripts and data those pages used, still shipped
in the bundle or the shell. This pass removes that residue.

## 1. Routes (before this pass)

Chunk sizes are the raw lazy-chunk sizes from the production build before this
pass (`ng build`; only chunks over ~60 kB are named by the CLI).

| Route | Lazy chunk | Reached from the game | Decision | Why |
|---|---|---|---|---|
| `/play` | side-scroller 338 kB | navbar, the game itself | KEEP | the game |
| `/play/storyboard` | ~31 kB source | nothing (nav-audit exemption) | **REMOVE** → 301 `/play` | an art-direction prototype of the Seamworks opening; the real opening is `/play`. It wrote its own save key nobody else reads. "Nav audit exemptions hide orphans" |
| `/world` (+ `/`, `/home`) | landing 82 kB | navbar brand, footer | KEEP | the game-first landing; already sends people into the world. Its ad slot is removed (see §2) |
| `/world/realms/*` (5 realms + 3 sites + `:realmId`) | small | world atlas, Waystone | KEEP | world pages |
| `/world/fivefold-lock` | small | world landing | KEEP | lore page the world links |
| `/world/quests`, `/world/trials`, `/world/arena` | small | Verdant stations | KEEP | in-world places |
| `/arena/*` (5 games) | small | Trials gates | KEEP | the Trials' playable gates |
| `/sanctum` | forge-view 173 kB | Verdant station | KEEP | expeditions hub (no longer the /live feed) |
| `/market`, `/exchange`, `/gambler` | 69 / — / 62 kB | Luminous/Umbral stations | KEEP | in-world places |
| `/forge/runes`, `/forge/crafting`, `/forge/enchanting` | 72 kB / — / — | Infernal stations | KEEP | in-world places |
| `/codex`, `/leaderboards` | 115 kB / — | Celestial stations | KEEP | in-world places |
| `/character` | forge-keeper 82 kB | navbar | KEEP | character + sign-in + cloud save |
| `/admin` | admin-routes 324 kB | owner only | KEEP | game admin (bans, notices, saves) |
| `**` (404) | small | — | KEEP | |
| Retired: `/tools`, `/tools/**`, `/embed`, `/embed/**`, `/mcp`, `/live`, `/forge-view`, `/guestbook`, `/contact`, `/about`, `/skills`, `/projects`, `/services`, `/mission-control`, `/blueprint`, `/changelog`, `/sponsors`, `/donate`, `/pro`, `/games`, `/arena` | — | — | already 301'd | no change except `/play/storyboard` joining them |

`/donate` and `/sponsors` stay 301s to `/world`: there is no donate page to keep;
the donation flow is the footer's Crypto / PayPal / Stripe modals, which are
kept. There are no privacy or terms pages in the app; the legal surface is the
cookie banner, kept.

## 2. Non-route residue

| Thing | Where | Decision | Why |
|---|---|---|---|
| Tools registry (669 lines, ~77 kB) + `tool-for-route` | `src/app/tools/` | **REMOVE** | no route can be a tool route any more; only kept alive by the lookups below |
| Tool-use beat pipeline | `quest-wiring.service.ts` (tool beats, speed-run, furniture list) | **REMOVE** | listened for clicks on `/tools/*` pages, which redirect away before it can fire |
| Tool-condition quests (`tool-use`, `tool-variety`, `realm-spread`, `speed-run`) | `quest.model.ts` | **REMOVE** | already filtered off the board by `isPlayableQuest`; dead data |
| `ToolUsageService`, `ToolMasteryService` | `shared/` | **REMOVE** | counted tool uses; nothing emits them |
| Codex tool lookup (`TOOLS_BY_ID`) | `codex.model.ts` | **REMOVE** | every public egg is global/arena; the lookup only fed `categoryForEgg` |
| Admin tool counters | `admin-data.service.ts` / admin page | **REMOVE** | "live tools / coming soon" stats for a product that no longer exists |
| Embed mode (`EmbedService`, `<app-embed-bar>`, `isEmbedMode` branches, `/embed/**` CSP header block) | app shell, forge-scene | **REMOVE** | embeds were iframed tool pages; `/embed/**` 301s to `/world` |
| Ads: Carbon, AdSense, house ad, ad config, ad visibility, sponsor slot | `shared/ads`, `shared/adsense`, `shared/carbon-ad`, `shared/sponsor-slot` | **REMOVE** | no network was ever configured; the only rendered unit was a house ad on `/world` linking to `/sponsors`, which 301s back to `/world` |
| `cdn.carbonads.com` in CSP | `firebase.json` | **REMOVE** | only Carbon used it. Stripe and PayPal stay (footer donate) |
| Visit counter + "milestone" celebration | `shared/visit-counter` | **REMOVE** | the tools-site visitor counter ("Cyber Swarm", "Neon Legion"); a Firestore write on every page load for nothing the game shows |
| Cosmic engine (`assets/js/cosmic-engine.js`, 59 kB) | `index.html` | **SLIM** | constellation canvas, pulsar, custom cursor, scroll-reveal, magnetic CTAs, card tilt, click sparks, counters, type-on headings, parallax, form confetti and the route veil are tools-site chrome. **Kept:** the cursor trail (the Market's *Cursor Trail* cosmetic recolours it) and the ambient drone (the Codex secret *The Drone* promises it) |
| Shell DOM: `.matrix-background`, `.cosmic-canvas`, `.cosmic-pulsar`, `.cosmic-cursor`, four `.rune-whisper`s | `index.html` | **REMOVE** | dead paint (matrix-background, see the body-gradient note) or engine-only |
| Arcane seal + `easter-eggs.js` (4 kB) | `index.html` | KEEP | ritual mode unlocks four Codex secrets |
| Global CSS for the removed systems (sigil, nebula, pulsar, runes, cursor, tilt, sparks, veil, reveal, tool cards, hp-* home sections) | `styles.css`, `styles/interactions.css` | **REMOVE** | selectors that match nothing any more |
| Tools-site JSON-LD in the shell (`WebPage` "Free Browser Tools" with nine tool apps) | `index.html` | **REMOVE** | advertised 301'd URLs to crawlers on every page |
| `ChangelogService`, `FirebaseService`, `PerformanceService`, `seedChangelog.ts`, `models/portfolio.models.ts`, `api`/`brevo` config templates | `src/` | **REMOVE** | imported by nothing (contact form and changelog page are gone) |
| `jspdf` dependency | `package.json` | **REMOVE** if unreferenced | the PDF catalog tool's library |
| Unused i18n keys | `translation.service.ts` | **REMOVE** behind `check-i18n-keys` | |
| e2e specs that only covered removed pages | `e2e/` | **REMOVE** | |

## 3. Kept on purpose (owner may still want these gone)

- **Daily tool pipeline** (`pipeline/`, `.github/workflows/daily-pipeline.yml`)
  — a cron that researches, generates and PRs a new browser tool every day.
  The world plan leaves "the out-of-credit daily workflow" with the owner, so
  it is untouched here, but it is the opposite of this pass.
- **Pro Pack (`ProService`)** — `/pro` already 301s and `activatePro()` has no
  caller, so nobody can buy it; it still multiplies XP and owns three cosmetic
  variants. Removing it touches the economy; left for an owner call.
- **Arena "flavour gate" eggs** (`regex-master`, `json-inception`, `chmod-god`,
  `hash-meaning`, `css-important`, `uuid-lucky`, `shadow-lord`) — tool-era names
  still listed as Trials gates in the Codex.
- **`/api/send-contact` rewrite + `sendContactEmail` function** — the contact
  page is gone; `functions/` is out of scope for this pass.
- **`site-stats` Firestore rule** — the visit counter is gone; `firestore.rules`
  is out of scope.
- **`shared/npc/delve-missions-board.component.ts`** — imported by nothing, but
  it is game work in progress, not tools residue.

## 4. Results

Production builds of `77c93df` (before) and of this branch before merging the
latest main (after), measured the same way:

| Measure | Before | After |
|---|---|---|
| Initial bundle (raw / transfer) | 1.75 MB / 452.3 kB | 1.66 MB / 433.4 kB |
| JS in dist (files / bytes) | 167 / 5.79 MB | 160 / 5.43 MB |
| dist total (files / bytes) | 1012 / 51.9 MB | 935 / 43.9 MB |
| Prerendered pages (HTML files) | 33 | 32 (`/play/storyboard` gone) |
| `src/styles.css` raw / gzip | 135.5 kB / 40.0 kB | 103.6 kB / 31.5 kB |
| Built global stylesheet raw / gzip | 70.8 kB / 16.4 kB | 54.2 kB / 12.8 kB |
| `src/index.html` raw / gzip | 19.6 kB / 5.8 kB | 14.8 kB / 4.9 kB |
| Built `index.csr.html` raw / gzip | 47.7 kB / 13.4 kB | 36.2 kB / 10.9 kB |
| `assets/js/cosmic-engine.js` | 59.2 kB | 9.5 kB |

Also found and fixed on the way: the footer's donation modals had no button
since August, so the kept donation flow was unreachable; it now has a
"Support the forge" row.

Still to decide (owner): the daily tool-generation pipeline
(`pipeline/`, `.github/workflows/daily-pipeline.yml`) still exists and, if it
ever runs with credit, opens a PR adding a new tool page to this game site.
The Codex Solarii artifact's only effect was tool-lore thresholds, so it now
does nothing. The Achievement Frame cosmetic styles `.cx-card`, which the Codex
no longer renders (pre-existing).
