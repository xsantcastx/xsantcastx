# SSR Audit: `XC.setProperty` NotYetImplemented — Root Cause 2

**Date:** 2026-04-20
**Run:** xsantcastx-backlog-executor-v2
**Notion task:** [348e6899-f10e-81c3-afcfe533c8c75229](https://www.notion.so/348e6899f10e81c3afcfe533c8c75229) (Monitor + High)

## What is shipped this run (Root Cause 1)

Commit `f434572` ("fix(ssr): add 27 missing /embed/* routes…") closes Root Cause 1.
Commit `327fd0c` ("fix(ssr): short-circuit PortfolioService HTTP calls on the server") closes one HTTP fetch path that fails during SSR.

## Root Cause 2 status: still unresolved, narrowed further

### What we know

- Stack trace from prerender: `Error: NotYetImplemented at Fn.nyi (main.server.mjs) at XC.setProperty (main.server.mjs)`.
- The previous run (commit `54c724f`) converted **all** `[style.--xxx]` template bindings to `[attr.style]` (which uses `setAttribute`, not `setProperty`). The error persists, so the source is not those bindings.

### Source-code grep (this run)

| Pattern | Count in `src/app` | Notes |
| --- | --- | --- |
| Direct `.style.setProperty('--xxx', …)` | 2 | both in `header/header.component.ts` (`:273`, `:291`); **both guarded by `if (!this.isBrowser) return`** so cannot fire in SSR |
| `[ngStyle]` returning custom-property keys (`'--…'`) | 0 | grepped all `*.ts` for `'--…` and `"--…` inside style maps — none |
| `renderer.setStyle(…, '--…')` | 0 |  |
| `[style.--…]` template bindings | 0 | all converted by `54c724f` |

The `command-palette.component.ts` writes `body.style.overflow = …`, but `overflow` is a standard CSS property — `@angular/platform-server`'s `CSSStyleDeclaration` implements that path; it only throws `NotYetImplemented` for the `setProperty(name, value)` form when called with arguments it doesn't model.

### Conclusion

The error is **not** coming from any explicit source call. The minified `XC` class in `main.server.mjs` is from one of:

1. `@angular/ssr` runtime's hydration/DOM-diff layer (most likely) — when reconciling prerendered HTML against the component tree, it may invoke `setProperty` on a stub `CSSStyleDeclaration` for any `style="…"` attribute that contains custom properties (which we now emit via `[attr.style]`).
2. `@angular/platform-server`'s `CssParser` calling its own internal stub.
3. A third-party hydration shim (we don't bundle one).

If hypothesis (1) is correct, the `[attr.style]` migration in `54c724f` may have **moved** the failure (from template-binding setProperty to hydration-time setProperty) rather than eliminating it. The fix would be to write the values via class names + a stylesheet rather than inline.

## Recommended next steps (priority order)

1. **Upgrade `@angular/platform-server`** to the latest `^20.3.x` patch — the Notion task notes the SSRF CVE (GHSA-45q2-gjvg-7973) is fixed in newer versions, AND a recent platform-server changelog references improvements to `CSSStyleDeclaration.setProperty` for custom properties. Single change closes the High CVE _and_ may resolve this.
2. **If upgrade does not resolve:** Convert the 8 components that previously used `[style.--xxx]` (now `[attr.style]`) to use class-based theming. Pre-define `.theme-{N}` classes in CSS and apply via `[class]`. This eliminates inline `style="--xxx: …"` attributes entirely so neither template binding nor hydration can call `setProperty` for custom properties.
3. **As a stopgap if both fail:** Set `"prerender": false` in `angular.json` (under `build.options.prerender`). Cleanly disables prerender so the build succeeds; loses static HTML benefit. **Do not ship this without verifying core SEO impact** — the home page and tool index would lose their prerendered snapshots.

## Files most likely involved (8 components from commit 54c724f)

- `landing` (hero carousel `--ci`)
- `affiliate-cta` (`--aff-accent`)
- `milestone-effect` (7 particle vars consolidated)
- `crontab-ref` (tab + field color)
- `dns-lookup` (chip + 3 badge colors)
- `git-reference` (tab + 2 entry colors)
- `http-status` (tab + entry color)
- `keyboard-shortcuts` (tab + entry color)

A quick test would be to disable just `landing` (since `/` is the most-prerendered route) and rerun the build to see whether the failure count drops — if it does, hypothesis (1) is confirmed and approach (2) is the right fix.

## Why a deeper investigation wasn't shipped this run

A full `ng build` is required to obtain `main.server.mjs` for line-level inspection of the minified `XC` class. The sandbox build budget did not allow a clean prerender pass within this session's time slice. The audit above is the maximum static analysis possible without a built bundle.
