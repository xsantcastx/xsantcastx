/**
 * version.ts — the single source of truth for the deployed app version.
 *
 * When an agent (or a human) ships a release, bump APP_VERSION and prepend an
 * entry to VERSION_HISTORY. The footer badge and the /blueprint Overview tab
 * both read from here, so one edit updates the version site-wide.
 *
 * NOTE ON buildDate: this is a hardcoded literal on purpose. Computing it with
 * `new Date()` at module load would (a) produce a different value on the server
 * during prerender than in the browser after hydration, which Angular reports
 * as a hydration mismatch, and (b) report "today" rather than the date the
 * bundle was actually built — which is the opposite of what a build date means.
 * Bump it by hand alongside `version`.
 */

export interface VersionRelease {
  version: string;
  codename: string;
  /** ISO date (YYYY-MM-DD) the release shipped */
  date: string;
  highlights: string[];
}

export const APP_VERSION = {
  version: '2.1.0',
  buildDate: '2026-08-11',
  /** Each major release gets a codename */
  codename: 'Blueprint',
  /** Where the full story of this release lives */
  changelog: '/blueprint'
} as const;

/**
 * Newest first. The /blueprint Dev Log reads this to show what shipped when.
 */
export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: '2.1.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'Mobile navigation repaired — 44px tap targets, drawer sits flush under the header',
      'Mobile performance — nine always-composited full-viewport layers down to five, all static',
      'backdrop-filter disabled on mobile (was 300+ declarations, four stacked in the header alone)',
      '/live and the header no longer overflow a 375px viewport',
      'Every standalone control now meets the 44px touch minimum'
    ]
  },
  {
    version: '2.0.0',
    codename: 'Blueprint',
    date: '2026-08-10',
    highlights: [
      'Blueprint public roadmap + dev log',
      'i18n support (EN/ES)',
      'Accessibility overhaul',
      'Security hardening',
      '126 tools'
    ]
  },
  {
    version: '1.0.0',
    codename: 'Genesis',
    date: '2026-03-01',
    highlights: [
      'Initial launch',
      'First 45 tools',
      'Easter egg system',
      'Dark theme'
    ]
  }
];
