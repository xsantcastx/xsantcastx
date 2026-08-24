/**
 * version.ts — the single source of truth for the deployed app version.
 *
 * When an agent (or a human) ships a release, bump APP_VERSION here and prepend
 * an entry to VERSION_HISTORY in ./version-history.ts.
 *
 * The two live in separate modules on purpose. The footer renders the version
 * badge on every page, so this module is in the initial bundle; VERSION_HISTORY
 * is ~140 kB of changelog prose that only the lazy /admin route reads. Keeping
 * them together put all of it in the initial bundle, because a module is the
 * unit of chunking — esbuild cannot drop one export of a module another chunk
 * still needs. Do not re-merge them, and do not import ./version-history from
 * anything that is eagerly reachable from AppComponent.
 *
 * NOTE ON buildDate: this is a hardcoded literal on purpose. Computing it with
 * `new Date()` at module load would (a) produce a different value on the server
 * during prerender than in the browser after hydration, which Angular reports
 * as a hydration mismatch, and (b) report "today" rather than the date the
 * bundle was actually built — which is the opposite of what a build date means.
 * Bump it by hand alongside `version`.
 */

export const APP_VERSION = {
  version: '2.81.0',
  buildDate: '2026-08-24',
  /** Each major release gets a codename */
  codename: 'The Coliseum',
  /** Where the full story of this release lives */
  changelog: '/world'
} as const;
