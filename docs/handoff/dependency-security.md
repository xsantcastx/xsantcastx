# Dependency security pass (2026-10-14)

Dependabot showed 53 open alerts on main (3 critical, 24 high, 20 moderate, 6 low). This pass cleared every
alert that has a published fix without a major upgrade of the runtime stack. Nothing deployed.

## npm audit, before → after

| Lockfile | Before (crit/high/mod/low) | After |
|---|---|---|
| `package-lock.json` | 3 / 32 / 16 / 0 (51) | 0 / 12 / 3 / 0 (15) |
| `functions/package-lock.json` | 1 / 15 / 3 / 0 (19) | 0 / 2 / 0 / 0 (2) |

npm audit counts every parent that depends on a vulnerable package, so its numbers run higher than the
Dependabot alert count. The 15 + 2 left come from four root packages, listed below.

## What changed

- **Angular** framework packages → `^21.2.25`, `@angular/ssr`, `build` and `cli` → `^21.2.26` (patch bumps): fixes the
  SSR XSS/SSRF/DoS issues in platform-server, the router matrix-param DoS, the core/compiler sanitisation bypass,
  the common HttpTransferCache leak, and pulls `piscina` 5.3.2 (critical).
- **overrides** (root): `@angular/build → undici ^7.29.1`; `@angular/cli → @modelcontextprotocol/sdk ^1.31.0`;
  `@lhci/cli → basic-ftp ^6.2.3`; `@firebase/firestore → @grpc/grpc-js ^1.14.6`. Firestore pins grpc-js `~1.9.0`,
  even in its latest release. The browser build never loads grpc, and the build output has no server bundle, so
  only the prerender step runs it. Prerendering all 58 routes still passes.
- **`npm update` for semver-compatible versions** (root): fast-uri 3.1.8, proxy-addr 2.0.8 (critical), express/body-parser/qs,
  compression, hono, ip-address, brace-expansion, js-yaml 3.15.2, source-map-js, http-cache-semantics 4.3.0,
  engine.io 6.6.11, node-gyp's undici.
- **functions/**: `npm update` brought in proxy-addr 2.0.8 (critical), express 4.22.3 → qs 6.16, @fastify/busboy 3.2.3,
  grpc-js 1.14.6, js-yaml 4.3.2 and brace-expansion. `@typescript-eslint/*` went from 5 to 8. Lint is dev-only, it
  is not part of predeploy, and it already reported about 550 errors before this change. No function code changed.

## Left open, and why

- **node-forge** (functions, high): every version is affected and no fix exists. Removing it means moving to
  firebase-admin 14, which also needs firebase-functions ≥ 7.3. Both are major upgrades to deployed code (in
  v7, `pruneActivity.ts` imports the bare `firebase-functions` namespace). That needs an owner decision and a
  deploy test.
- **extract-zip** (via @lhci → puppeteer) and **sprintf-js** (via @lhci → js-yaml 3 → argparse): no patched
  versions exist. Both are dev-only and run only in the Lighthouse CI job.
- **braces** (via karma → chokidar 3): no patched version exists. It is dev-only and runs only in the unit-test runner.
  Dependabot has no alert for it.

## Gotcha

`npm install` with the new Angular ranges failed with ERESOLVE ("Conflicting peer dependency @angular/core").
This happens even when every `@angular/*` package is named in the same command, because the lockfile pins
exact peer versions. The fix that worked: delete the `node_modules/@angular/*` entries from the lockfile, then
run a real `npm install`. Both lockfiles then pass a clean `npm ci`.
