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
| `/tools` | `/world` | `/world` | yes | after audit |
| `/tools/**` | `/world` | `/tools/:slug` → `/world` | yes | after audit |
| `/embed`, `/embed/**` | `/world` | yes | yes | after audit |
| `/mission-control` | `/world` | `/world` | yes | after audit |
| `/mcp` | `/world` | `/world` | yes | after audit |
| `/blueprint` | `/world` | `/world` | yes | after audit |
| `/changelog` | `/world` | `/world` | yes | n/a (alias) |
| `/sponsors` | `/world` | `/world` | yes | after audit |
| `/donate` | `/world` | `/world` | yes | after audit |
| `/pro` | `/world` | `/world` | yes | after audit |
| `/skills`, `/services` | `/world` (was `/tools`) | `/world` | yes | already gone |
| `/projects` | `/world` (was `/blueprint`) | `/world` | yes | already gone |
| `/contact`, `/about`, `/guestbook` | `/world` | `/world` | yes | already gone |

## Retained infrastructure (not public content)

`src/app/tools/tools-registry.ts` remains imported by quests, XP wiring, idle, realms, atmosphere, and character mastery. It is a data table for existing game mechanics, not a public catalogue.

## Not deleted (pending explicit approval)

`Eclipse Realms/Assets/Reference/Legacy Exports` is outside this repo.
