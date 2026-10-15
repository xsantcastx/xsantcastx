# Page audit — the game-only shell (2026-10-15)

Owner: "remove all unused pages and layout and css that might affect gameplay … in-game no page should
redirect outside of the game, all pages must get migrated if needed, if not needed delete them."

This is step 0 of `game-only-shell`: every route, page, shell component and global stylesheet section,
what it does today, whether the game needs it, and the verdict. Dependency evidence was gathered by
grep across `src/`, `scripts/`, `e2e/` (file:line refs below are at base `27d4329a`).

Verdicts:
- **PANEL** — keep the component as an in-game panel (station, ☰ menu, or opened from another panel);
  its standalone route is deleted and its URL redirects into `/play` (`?at=<id>`).
- **DELETE** — client code goes now.
- **DELETE-NOW-REBUILD-LATER** — goes now; listed on the roadmap's Later list as a world-native system.

Hard lines respected: no change to `functions/`, `firestore.rules`, indexes, market flags, or deploys.
Backend leftovers are listed at the end for the owner.

## Routes and pages

| Route | Component | What it does today | Game needs it? | Verdict |
|---|---|---|---|---|
| `/`, `/home` | redirect → `/world` | front door | — | redirect → `/play` (router + Hosting 301) |
| `/world` | `LandingComponent` | marketing home: hero, welcome card, current work, play/character CTAs (owner screenshot) | No | **DELETE** (route → `/play`) |
| `/play` | `SideScrollerComponent` | the game | Yes | **KEEP** — now the only page; prerendered, indexable, carries the VideoGame JSON-LD |
| `/character` | `ForgeKeeperComponent` | stats, equipment, loadout, sign-in | Yes (☰ → Character) | **PANEL** (`?at=character`) |
| `/forge/runes`, `/forge/crafting`, `/forge/enchanting` | rune-forge, crafting-bench, enchanting-bench | core loops; Infernal stations + Homestead | Yes | **PANEL** |
| `/market` | `MarketComponent` | hammer upgrades, artifacts, enchantments, cosmetics/title switching, Thrall recruitment, Eclipse prestige | **Yes** — only UI for those; Homestead workshop is gated on owning a Thrall (`homestead.service.ts:299`) | **PANEL** (Luminous station). Rebuild as world-native trade later |
| `/gambler` | `GamblerComponent` | sealed boxes; the only source of 44 unique items; the only gear-sell UI | **Yes** | **PANEL** (Umbral station) |
| `/exchange` (+ `/grand-exchange`) | `ExchangeComponent`, `shared/market/*` player-market UI | buy/sell vs merchant houses; player order book (dormant behind `market/v1.enabled`) | No — Vendor already buys materials; nothing is Exchange-only (`check-meaning`) | **DELETE-NOW-REBUILD-LATER** (station, broker keeper, Slate pointer, component, player-market UI). `exchange.model.ts` (catalogue + quotes) stays: vendor spec, `check-meaning`, market-reference generator read it |
| `/sanctum` | `ForgeViewComponent` | expeditions dispatch/recall, explorer roster, Thrall assignment, works map | **Yes** — `void-crystal`/`orichalcum-ore` are expedition-only; Homestead camp + offline summary depend on it | **PANEL** (Verdant station) |
| `/codex` | `CodexComponent` | achievements, secrets wall, plus the only screens for Lost Cabinets sets/arcs, pets, Witness Accounts, bounty archive, heights, people, bestiary, fishing, Delve inscriptions, Collection Log | **Yes** — story rewards `{kind:'codex'}` and pet hints point at it | **PANEL** (Celestial station) now; the achievements/secrets tabs are site-era → **REBUILD-LATER** as a Slate "Journal" |
| `/leaderboards` | `LeaderboardsComponent` | read-only ladders | No | **DELETE-NOW-REBUILD-LATER** (route, panel, Celestial station, Chart Clerk keeper, `shared/leaderboards`) |
| `/world/quests` | `QuestsComponent` | quest + bounty board; the only bounty-claim UI | Yes | **PANEL** (Verdant station) |
| `/world/trials`, `/arena/*` (5 games) | `ArenaComponent` + game components | trials gates; games open as overlays inside the panel; pay XP, feed arena quests | Yes | **PANEL**; the `/arena/*` routes go, `ARENA_GAME_ROUTES` stays as the overlay's loader table |
| `/world/arena` | `PvpArenaComponent` | PvP Coliseum fights + shop | Yes (only UI for `shared/arena`) | **PANEL** (Verdant station) |
| `/world/realms/:id` ×5 | `RealmLandingComponent` (+ `InfernalChapterComponent`) | realm lore dossiers, Infernal chapter choice (text only) | No (nothing in `/play` links them) | **DELETE-NOW-REBUILD-LATER** (lore as a Journal/Waystone entry). Realm-hall page-visit quests now count reaching that realm's town |
| `/world/fivefold-lock` | `FivefoldLockComponent` | lore page linking the 5 realms | No | **DELETE-NOW-REBUILD-LATER** |
| `/world/realms/infernal/basalt-seamworks` | `BasaltSeamworksComponent` | mining page + **C1 Refining** (only place) | Refining: yes | **PANEL** (station-less, opened from the Skills panel's Go button) — rebuild later as a Refinery station |
| `/world/realms/verdant/rootglass-canopy` | `RootglassCanopyComponent` | foraging tier table + rare find | partly duplicate of in-world foraging | **PANEL** (station-less, Skills panel) — rebuild later in-world |
| `/world/realms/celestial/meridian-orrery` | `MeridianOrreryComponent` | **Prospecting** — the only place its XP can be earned | **Yes** | **PANEL** (station-less, Skills panel) — rebuild later as in-world prospecting nodes |
| `/404`, `**` | `NotFoundComponent` | soft 404 | No | **DELETE** — `**` redirects to `/play` |
| `/admin` | admin routes | owner dashboard | owner only | **KEEP** (has "← Back to the site" → `/play`; allowed by the stay-in-game guard) |
| retired legacy aliases (`/tools`, `/embed`, `/skills`, `/live`, `/forge-view`, `/quests`, `/arena`, …) | redirects | — | — | all now land in `/play` (or `/play?at=<panel>`) |

## Shell components (`app.component.html`)

| Component | On /play before? | Verdict |
|---|---|---|
| `app-header` (gold/essence/bag pills, sign-in chip, EN/ES, tome, tab bar) | no | **DELETE**. Sign-in, language and cookie choice move to ☰ → **Account & settings** (new panel); Character was already in ☰ |
| `app-footer` (donate modals, socials, effects toggle, version link) | no | **DELETE** |
| `app-command-palette` (Cmd+K) | no | **DELETE** |
| `app-godforge-loader` + inline boot script | no | **DELETE** |
| `app-forge-scene` (WebGL backdrop) + `.particle-layer` + effects toggle | no | **DELETE** |
| `app-place-banner-outlet` / banner | no | **DELETE** |
| `app-related-pages` (crawl-aid "see also" block inside pages) | inside panels | **DELETE** (no crawlable pages remain) |
| `app-deferred-overlays`: forge flame, forged-today, NPC dialogue, achievement drop, discovery toast, quest drawer/toast, level-up banner, Quick Inspect, keeper panel | no | **DELETE** the host (none rendered on /play). Components still used by surviving code stay (e.g. the Sanctum's inline flame) |
| `app-onboarding-outlet`, `app-offline-outlet` | no | **DELETE** the outlets (`OfflineService.settle()` still banks rewards) |
| `app-inspect-3d-outlet` | no | **DELETE** the outlet |
| `app-pwa-outlet kind="offer"` (install banner) | no | **DELETE** the mount |
| `app-cookie-banner`, `pwa chrome`, `pwa update`, cloud-save merge dialog, device lease, site notice | yes | **KEEP** |
| `index.html`: arcane seal, `easter-eggs.js`, `cosmic-engine.js` (cursor trail + ritual drone, ran over /play on desktop) | partly | **DELETE** |
| `AppComponent`: corner-flame plumbing, glitch poll (nothing ever set `body.glitch-out`) | — | **DELETE**; the game-state wirings stay (order is load-bearing) |

## Global CSS (`src/styles.css`, 104 kB source / 54 kB built)

Kept: fonts, `.skip-to-main`, `:root` tokens in use, base resets, selection/scrollbar, `.cta-button`,
reduced-motion, focus-visible, mobile backdrop-filter kill, `select`, touch targets, typography floor,
cosmetic theme vars, CelebrationService `.gf-fx`/`.gf-jolt`/slow-mo (stations use them), `.ds-icon`,
`main.play-mode` and `html.gf-play-route` rules. Deleted: body nebula/starfield pseudo-elements, cosmic
trail, `.hp-*`, `.section`/`.container`/`.glass-card`, route fade, particle layer, atmosphere
`@property` block, arcane seal / ritual, glitch, header/tome/tab-bar/pill/sigil rules, `gf-reveal-open`
rules for the deleted overlays, art-route layer hiding, `main` header padding. `tokens/spacing.css`:
`--nav-h` and `--header-offset` are now 0 (no header).

## Data that survives (no page)

Cabinets, pets, story, bounties, heights, fishing, Delve lore, easter-egg and codex-secret save keys,
Exchange/Gambler cloud-save blobs (merge rules untouched — save compatibility), `exchange.model.ts`,
`mystery-box.ts`, activity ids (`BASALT_SEAMWORKS_ID` etc.), `refine-ops.ts`.

## Backend leftovers (owner only — not touched)

- `functions/src/market/*` (player order book) + `functions/test/market.test.ts`: no client UI any more.
- `firebase.json` CSP entries for the market callables; Firestore `users/{uid}/economy/{exchange}` docs.
- `scripts/generate-market-reference.mjs` still generates from the Exchange catalogue.

## Rebuild later (roadmap)

World-native trade (Exchange/player market), a Slate Journal (achievements, secrets, realm lore),
leaderboards in-world, a Refinery station, in-world prospecting and canopy foraging, and slimmer
in-world hosts for the Market, Sanctum and Codex panels (they are still page components in a panel).
