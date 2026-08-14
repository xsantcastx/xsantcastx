# PR 2 — Legacy route inventory

Archived migration record. Not a public product surface.

**Branch:** `feat/legacy-product-eradication`  
**Base:** `origin/main` @ `12f2940`  
**Spec:** `docs/05-implementation/eclipse-realms-implementation-master-plan.md` § PR 2

## Rule

Legacy developer-tool, portfolio, build-in-public, and owner-product URLs redirect to `/world`. Game migrations keep their canonical game successors. No public Artifact/tools presentation remains.

## Game successors (keep)

| URL | Action | Status |
| --- | --- | --- |
| `/world` | Live game landing | keep |
| `/character` | Live character sheet | keep |
| `/forge/runes` | Live rune forge | keep |
| `/world/quests` | Live quest board | keep |
| `/world/trials` | Live trials index | keep |
| `/arena/<game>` | Live playable gates | keep |
| `/market` | Live game market | keep |
| `/codex` | Live collection/codex | keep |
| `/sanctum` | Live player management hub | keep |
| `/admin` | Hidden owner console, noindex | keep (not public) |

## Game migrations (keep)

| From | To |
| --- | --- |
| `/`, `/home` | `/world` |
| `/forge-keeper` | `/character` |
| `/rune-forge`, `/forge` | `/forge/runes` |
| `/quests` | `/world/quests` |
| `/arena` (index), `/games` | `/world/trials` |
| `/live`, `/forge-view` | `/sanctum` |

## Retired public product (redirect to `/world`)

| From | Hosting 301 | In-app redirect | Deleted from sitemap/prerender/nav | Code deletion |
| --- | --- | --- | --- | --- |
| `/tools` | `/world` | `/world` | yes | yes (registry kept) |
| `/tools/**` | `/world` | `/tools/:slug` → `/world` | yes | yes (pages deleted) |
| `/embed`, `/embed/**` | `/world` | yes | yes | yes |
| `/mission-control` | `/world` | `/world` | yes | yes (`live.component*`) |
| `/mcp` | `/world` | `/world` | yes | yes |
| `/blueprint` | `/world` | `/world` | yes | yes |
| `/changelog` | `/world` | `/world` | yes | n/a (alias) |
| `/sponsors` | `/world` | `/world` | yes | yes |
| `/donate` | `/world` | `/world` | yes | yes (form/feed too) |
| `/pro` | `/world` | `/world` | yes | yes (page only; ProService kept) |
| `/skills`, `/services` | `/world` (was `/tools`) | `/world` | yes | already gone |
| `/projects` | `/world` (was `/blueprint`) | `/world` | yes | already gone |
| `/contact`, `/about`, `/guestbook` | `/world` | `/world` | yes | already gone |

## Retained infrastructure (not public content)

`src/app/tools/tools-registry.ts` remains as a data table for leftover game mechanics (hidden quest history, egg categories, atmosphere). It is not a public catalogue. World no longer displays the registry length as a product KPI.

Public Character and Codex no longer render tool mastery, a tool Bestiary, or links to `/tools/*`. `buildAchievements()` lists only `PUBLIC_CODEX_EGGS` (`tool` unset or `global`); an unlocked JSON/Base64/regex/box-shadow egg stays in the save and does not appear on the wall. Tool-use / tool-variety / realm-spread / speed-run quests stay in the authored pools for save-history lookups but are not drawn on the public board. XP and idle no longer pay out for `/tools/*` visits; the Forge is the high-rate idle hall. `scripts/audit-nav.js` fails the build if player-facing templates, SEO, or rendered data sources (public eggs, hints, secrets, Arena unlock lines) mention tool pages, tool usage, or tool mastery.

## Not deleted (pending explicit approval)

`Eclipse Realms/Assets/Reference/Legacy Exports` is outside this repo.
