# World-only navbar (world plan, Phase 3)

## What changed

**Navbar**: the desktop sidebar, the mobile tome and the bottom tab bar now show **Play** (`/play`, exact) and **Character**. The sign-in chip, cloud save, language toggle, Gold/Essence/rank/bank pills and the brand mark (→ `/world`) are unchanged. The MORE list and its CSS are gone. The Essence pill used to link to `/market`; it now opens `/play?at=market`. `NAV_MANIFEST` in `src/app/shared/nav/nav.manifest.ts` holds those two entries, and `MORE_NAV` was removed.

**Places directory** (`src/app/shared/nav/place-directory.ts`): these are the 12 halls that left the navbar, each linked to its standalone page.
- The footer's second row ("Places") renders it, which gives crawlers a path to every page.
- The command palette searches it.
- A spec pins it to the routes that have a station in a built town, so it cannot drift from the world data.

**`placeForRoute(route)`** (`src/app/shared/world/place-for-route.ts`) is a pure function over `TOWNS` and `PANEL_REGISTRY`. It returns the town, the station and the `/play?at=<station>` link for a route.
- It checks stations in the town square first, then hunting grounds, so `/forge/crafting` resolves to the Seamworks bench and not the Homestead anvil.
- It returns null for `/character`, `/world` and unknown URLs.
- It imports the towns' data, so only lazy code may import it.

**Banner**: `PlaceBannerOutletComponent` is eager and tiny. On a place route it reserves a 62px strip; it does this on the server too, so the banner causes no layout shift. In the browser it dynamically imports `PlaceBannerComponent` (a 4 kB lazy chunk) and shows "This place is in Heliograph Court · Luminous realm · [Enter the world >]".
- The banner is an `<aside>` with an aria-label.
- The link's accessible name is "Enter the world at Market, in Heliograph Court".
- Strings are in EN and ES under `gfnav.place.*`.
- Nothing redirects or auto-enters, and bots see the prerendered page unchanged. The returning-player auto-enter preference was skipped as risky.
- The banner host is positioned (`z-index: 1`). Without that, the page art scene paints over it.

**`scripts/audit-nav.js`**: a route counts as reachable when the navbar links it (only `header.*` and `nav.manifest.ts`; the footer no longer counts) **or** `worldPlaces()` places it in a built town.
- `worldPlaces()` comes from the same helper the banner uses, loaded through an in-memory TypeScript transpile, the same way the engine tests load it. There is no hand list.
- The audit also fails when the navbar does not link `/play`, or when a station names a route that is not live.
- To check the audit can fail: I temporarily retargeted Umbral's gambler station, and the audit reported `/gambler` as orphaned.

## SEO

All 58 prerendered routes still build with their title, meta and JSON-LD. The page links moved from the header into the footer, so every page still links to every other. The banner exists only on the client. The sitemap is unchanged because it is driven by prerender routes.

## Checks

- `node --test` engine/homestead/home-forge: 78 pass
- audit-nav: green
- i18n: green
- ds-adherence: holds
- `tsc` (app + spec): clean
- Targeted Karma (nav, world helper, header, footer, palette): 34 pass
- `ng build`: success, Initial total **1.73 MB**, 58 routes prerendered
- Checked in the production build:
  - `/market` shows the banner.
  - The CTA goes to `/play?at=market`.
  - The header has only `/play` and `/character`.

## For the other lanes

- **Places list** (`play/side-scroller.component.html`, not mine): it already has a labelled `<nav>` and named buttons with blurbs via `aria-describedby`, but the copy is English only ("Places", "Places in …").
- **Station ids**: `/play?at=` needs town-square station ids to stay unique across towns, because the banner links by station id only.
- **E2E specs**: a grep of `e2e/` found no selector for the removed halls (`.gfnav__more`, `.gfnav__hall`, `.gftabs__tab`, `.gftome__link`).
