# The Godforge — operating manual

**xsantcastx.com is a free idle RPG that runs in a browser tab.** No sign-up, no
install, no server-side game loop. Read this before touching anything.

This file replaced a 662-line manual for a developer-tools site. That product is
gone — see §2 — and every instruction in the old file pointed at routes that now
redirect. If something here disagrees with a comment in the code, the comment
wins: this is a map, the code is the territory.

---

## 1. What the game is

A player is a **Keeper**. They strike a forge for Gold, spend it on idle income
and on gambling for **runes**, send **explorers** into five realms on timed
expeditions, mine and forage materials, craft and enchant gear with rolled
stats, and climb ten ranks from Wanderer to Eclipse Lord.

Everything is client-side and everything is saved. Progression lives in
localStorage while signed out and in Firestore while signed in, and the two
reconcile — see §5.

### The nouns

| Word | Means |
|---|---|
| **Keeper** | the player |
| **Realm** | one of five worlds — Luminous, Umbral, Infernal, Celestial, Verdant |
| **Explorer** | a member of the roster you dispatch on expeditions |
| **Thrall** | a hired hand that works while you are away |
| **Rune** | the gambling drop, 25 of them across seven tiers |
| **Socket Word** | a rune combination that grants a set bonus |
| **Rung** | one level of one Market ladder |
| **Eclipse** | the prestige reset |

Note the vocabulary split: the **expedition** realms an explorer belongs to
(Luminous, Umbral, Verge, Archivum, Nexus) are *not* the five **world** realms
that have pages. Verge, Archivum and Nexus have no `/world/realms/*` route and
never did. Do not "fix" this by adding routes — check whether the copy was meant
to name a world realm instead.

---

## 2. There is no tools product

The site used to be 126 browser tools with a cosmic starfield. All of it is
retired. `LEGACY_TO_CANONICAL` in `src/app/shared/canonical-routes.ts` redirects
every old URL to a player hall, and `npm run audit:nav` fails the build if a
player-facing tool route ever comes back.

Practical consequences:

- **Do not add a tool page.** The nav audit will reject it.
- The cosmic engine, the pulsar, the galaxy map, the tool registry, the
  guestbook, the sponsors page and the donate page are all gone. If you find a
  reference to one in prose, it is stale — `docs/ECLIPSE_REALMS_ROADMAP.md`
  still describes Phase I in those terms and has not been rewritten.
- Old SEO surfaces still resolve, because breaking them would cost the rankings
  they earned. That is why the redirect table is long.

---

## 3. The routes

Twenty-five declared routes, 29 prerendered, 28 in the sitemap. `npm run
audit:nav` prints the authoritative list and fails on a dead link or an orphan.

**Halls** — `/world` (home), `/character`, `/market`, `/sanctum`, `/codex`,
`/leaderboards`, `/exchange`, `/gambler`.

**Forge rooms** — `/forge/runes`, `/forge/crafting`, `/forge/enchanting`. The
Bench and the Table are reached from inside the Forge, and are *also* listed in
`NAV_MANIFEST` under `more`, because a room only reachable from inside another
room reads as a dead page to anyone not already standing there.

**World** — `/world/realms/:realmId` and three authored sub-locations
(`.../infernal/basalt-seamworks`, `.../verdant/rootglass-canopy`,
`.../celestial/meridian-orrery`), plus `/world/quests`, `/world/trials`,
`/world/arena`, `/world/fivefold-lock`.

**Arena games** — five under `/arena/*`.

`NAV_MANIFEST` (`src/app/shared/nav/nav.manifest.ts`) is the single list the
header, the tab bar and the footer all iterate. A destination that is not in it
is unreachable from chrome, and the nav audit's exemption list is the only thing
that will let that pass — do not add an exemption to silence it.

---

## 4. The early game — the shape it is deliberately in

A brand-new ledger holds **0 Gold**. The floor rates are:

| Source | Pays |
|---|---|
| Idle | 0.1 Gold/sec |
| One strike of the Flame | 1 Gold (+10 on every hundredth) |
| **Scout expedition — free, 2 minutes** | **5,000–10,000 Gold** |
| The first Forge Bellows | **free** |

Those last two rows are the whole first hour, and both are load-bearing:

- **The free Scout** is what the tutorial's fourth screen points at, labelled
  "Do this first". Two starter explorers are minted on a fresh save, dispatch
  costs nothing, and one Scout pays for the second Market rung outright.
- **The free first rung** exists because the Market's cheapest item was 5,000
  Gold against a ledger that starts at zero. That is ~4,500 strikes or fourteen
  hours of idling before the shop sells its owner anything, which is what got
  reported as "5,000 clicks to the first upgrade". `firstFree` on
  `forge-bellows` (`economy.model.ts`) hands over level 1 only; level 2 is
  6,250 and every other ladder is untouched.

Three things hang off that zero price and all three must hold together:

1. `EconomyService.nextCost()` returns 0 *before* `discounted()`, which floors
   every price at 1 so a Charisma discount can never make a ladder free.
2. `economy-ops.ts` admits `buy-upgrade` with `amount: 0` (`ZERO_AMOUNT_OK`).
   Every other amount-carrying op still requires `> 0`. Without this the free
   rung survives locally and vanishes on the next cloud merge, because the merge
   reads every op back through `parseOp`.
3. The Market prices its cards from `EconomyService.nextCost()`, **never** from
   `costOf(def.baseCost, owned)`. The card's price is shipped back as
   `expectedCost` and `purchaseListing` compares it with `!==`.

**Do not rebalance the ladders above the doorway rung** without re-deriving what
one Scout buys. The intended first session is: land → tutorial → free Scout →
5,000 Gold → second rung. Not: land → click 4,500 times.

---

## 5. Save state — the rules that have bitten before

Progression is spread across roughly a dozen owner-per-blob localStorage keys
and the list grows every few releases. **Never** ask "has this player played" of
one key, and never write a save blob directly.

- Everything goes through `GameStateGateway`, which refuses a key it does not
  know (`isStateKey`) and syncs the ones it does. Firestore is the record while
  signed in.
- Writing a blob and then reloading loses the write. Go through
  `LocalSaveRegistry` and rehydrate in the same tick — the `pagehide` flush will
  otherwise clobber it.
- The first-run tutorial's record (`eclipse-onboarding`) is deliberately **not**
  a gateway key. It is a property of a browser, not of a player.
- You cannot simulate a first visit by clearing storage and reloading: the
  services rewrite their keys on the way out. Clear from `/robots.txt`, then
  navigate to `/world`.
- `INVENTORY_ERA` (currently 55) stamps the inventory ledger. A seed that does
  not carry the current era is dropped whole at boot, silently.
- The economy op log is `deviceId:seq`, unioned by id on merge and replayed onto
  a snapshotted `origin`. A new op kind must survive `parseOp` or it does not
  exist on any other device.

---

## 6. Tests, and how to run them without lying to yourself

```bash
npm run build          # prod + prerender + sitemap. The typecheck gate.
npm run typecheck      # tsc --noEmit, faster
npm run test:ci        # Karma, headless
npm run audit:nav      # dead links / orphans / no tool product. Gates deploy.
npm run check:i18n     # every key a template asks for exists
npm run check:ds       # design-system adherence
PW_PORT=4183 npx playwright test --project=chromium
```

**Always set `PW_PORT` in a worktree.** The suite serves `dist/` on 4173 with
`reuseExistingServer`, so a concurrent session's preview server will answer
your run and grade *its* build. The config reads `PW_PORT` for exactly this.

**The e2e suite runs against a fresh browser, which is the browser the tutorial
claims.** `playwright.config.ts` seeds `eclipse-onboarding` through
`storageState` so the modal never intercepts a click. A spec that wants to test
the tutorial has to remove that key itself. This is worth knowing because the
failure mode is invisible: the click resolves its target, scrolls to it, and
then burns the full 30-second timeout being told a `<div class="ob">` is in the
way.

Other traps:

- Karma leaks language across specs — `setLanguage('es')` persists. A red spec
  with Spanish in its "Expected" is run order, not your change.
- A worktree needs `node_modules` symlinked from the primary checkout or it
  cannot build.
- `preview_start` reads the *primary* repo's `.claude/launch.json`. A worktree's
  own copy is invisible to it.

---

## 7. Rules that are not negotiable

1. **SSR-guard every browser API.** `isPlatformBrowser(inject(PLATFORM_ID))`, or
   `typeof window === 'undefined'` in an inline script. A guard that redirects
   during SSR makes the route prerender to a stub and unreachable in
   production — and it works fine in `ng serve`.
2. **Honour `prefers-reduced-motion`** on anything over a second. Static end
   state, not "no animation".
3. **A CSS animation outranks a plain declaration.** A class that sets `opacity`
   or `filter` on an animated element does nothing. The boot curtain's fade was
   inert for a whole release for this reason.
4. **Angular's emulated encapsulation rewrites `@keyframes` names — except
   inside media queries, sometimes.** A dangling `animation-name` is completely
   silent: no console error, no build warning, `getComputedStyle` reports the
   animation running while `element.getAnimations()` returns `[]`. Re-run a
   CSSOM sweep after any CSS refactor.
5. **`transform` on an ancestor traps `position: fixed`.** `routeFadeIn` leaves
   one on every routed host, which is why every full-viewport overlay in
   `app.component.html` is a sibling of `<main>` and not a child of a route.
   `filter` is safe; `transform` is not.
6. **44px is the floor for a *standalone* control.** Grouped filter chips and
   tab rows are the documented exception and sit at 32–36px; the group clears
   the floor. Do not bulk-bump them — read the comment on `.rp__chip` first.
7. **Do not hand-write an `assets/` path.** `scripts/import-assets.py` →
   `art-manifest.generated.ts` → `artFor()`. Source paintings live off-repo.
8. **Adding a dependency means committing the lockfile.** A hand-edited
   `package.json` passes every local build and fails `npm ci` in CI.
9. **The CSP is hand-written in `firebase.json`** and has silently broken
   Stripe, Google sign-in and the main stylesheet. `ng serve` never reproduces
   it. `/__/*` bypasses `firebase.json` entirely — curl it before adding any
   header to the `**` block.
10. **A `firestore.rules` change in a push that failed the build never
    deploys**, and every later push skips it. Check the Deploy job's conclusion,
    not the red X — the Lighthouse job fails on most `main` runs and does not
    gate deploy.

---

## 8. File map

```
src/
├── index.html                       # shell, boot curtain, SSR-safe inline setup
├── app/
│   ├── app.component.html           # every full-viewport overlay, as siblings of <main>
│   ├── app-routing.module.ts        # all 25 routes + redirects + JSON-LD
│   ├── translation.service.ts       # ~990 keys, EN + ES. check:i18n gates it
│   ├── world/                       # /world, realms, quests, trials, fivefold lock
│   ├── forge-keeper/                # /character — paper doll, bank, stats
│   ├── live/                        # /sanctum — the dashboard (forge view)
│   ├── codex/ leaderboards/ pvp/ quests/ arena/
│   └── shared/                      # 50 subsystems; the game lives here
│       ├── economy/                 # ledger, op log, Market, Flame, prices
│       ├── rpg/                     # items, rolls, inventory, roster, crafting
│       ├── explorer/ expedition/    # missions, sites, dispatch, events
│       ├── enchanting/              # sockets, Socket Words, infusions
│       ├── arena/ leaderboards/     # the Coliseum and seven standings
│       ├── save/ cloud-save/        # GameStateGateway, merge, device lease
│       ├── onboarding/ offline/     # first run, while-you-were-away
│       └── nav/                     # NAV_MANIFEST — the only chrome list
├── prerender-routes.txt             # 29 routes. generate-sitemap.js reads it
└── e2e/                             # Playwright. See §6 before running.
```

---

## 9. Where the shipped work is recorded

`src/app/version.ts` holds the deployed version and codename; `version-history.ts`
holds the prose changelog and is ~140 kB, which is why it is a separate module —
importing it from anything eagerly reachable from `AppComponent` puts all of it
in the initial bundle. The initial bundle is already over its warn budget.

Do not keep a changelog in this file. That is what `version-history.ts` is for.
