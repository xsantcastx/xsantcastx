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
  version: '2.10.0',
  buildDate: '2026-08-11',
  /** Each major release gets a codename */
  codename: 'Wanderer',
  /** Where the full story of this release lives */
  changelog: '/blueprint'
} as const;

/**
 * Newest first. The /blueprint Dev Log reads this to show what shipped when.
 */
export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: '2.10.0',
    codename: 'Wanderer',
    date: '2026-08-11',
    highlights: [
      'The site remembers you now — XP, ten Eclipse Realms ranks from Wanderer to Eclipse Lord, and a progression readout in the header that expands into a panel',
      'XP is earned from what you were already doing: 15 for the first use of a tool, 5 for a page you have not seen, 5 for a copy (rate-limited to once a minute), 25 for a share and 200 for an easter egg',
      'A daily streak compounds 50 XP per consecutive day up to 600, and resets to one day on the first day you miss — the best streak is kept so the loss is visible',
      'XP splits across the two energies of the lore: Aether from design and authoring tools, Nox from security and code tools, drawn as a seam on the header bar',
      'Storage sits behind an adapter, so the Phase 2 move to per-account Firestore progress is a provider swap rather than a rewrite',
      'Nothing is sent anywhere — progression lives entirely in localStorage on your own device'
    ]
  },
  {
    version: '2.9.0',
    codename: 'Patron',
    date: '2026-08-11',
    highlights: [
      'Sponsor slots are live on the ten highest-traffic tool pages — a single native card between the tool output and the related-tools rail, carrying a visible "Sponsored" badge, a rel="sponsored" link and a dismiss button that stays dismissed',
      'Placements are keyed by tool category rather than by URL, so one booking covers every tool in that category — present and future — instead of a single page',
      'New /sponsors page for advertisers: audience, placements with a mockup of the slot in context, packages, an open-slot grid and an FAQ',
      'Traffic and pricing on /sponsors stay unpublished until real analytics back them — the page shows "on request" rather than an estimate, and the tool counts it does show are read live from the registry',
      'The page also states plainly that tool pages carry a Carbon unit and an affiliate card alongside the sponsor slot, rather than claiming an exclusivity the pages do not have',
      'Nothing changes visually anywhere until a deal is signed: with no sponsor booked, every slot renders nothing at all'
    ]
  },
  {
    version: '2.8.0',
    codename: 'Egg Hunt',
    date: '2026-08-11',
    highlights: [
      '58 tools had been calling the easter egg service with IDs that were never in the registry — trigger() looks the ID up and returns early when it finds nothing, so every one of those calls was a silent no-op with no toast, no save and no count',
      'Registering those IDs lights up 58 tools that had been shipping dead trigger code for months, and takes the registry from 71 eggs to 139',
      '21 more tools wired with new unlock conditions, including Ouroboros for a regex that matches its own source, Monochrome Master for a single-hue palette, Fort Knox for a 128-character password and Hash Miner for a digest that lands on four leading zeros',
      'JSON Tower and Regex Race were unreachable on /games — both were gated behind eggs that had no trigger anywhere in the app. Every game is now unlockable'
    ]
  },
  {
    version: '2.7.0',
    codename: 'Mobile Polish',
    date: '2026-08-11',
    highlights: [
      'Mobile type is readable — text ran from 7.4px to 13.9px on every route because the sizes were fixed rem values that resolved the same at 375px as at 1920px',
      'Two tiers: content and controls floored at 14px, decorative micro-labels at 12px, applied across the global shell, eight routes and all 126 tool pages',
      'The /live mission feed no longer squeezes its messages into a 180px column — rows wrap so the message gets the full width, and tool badges truncate instead of clipping mid-word',
      'Reclaimed the header clearance that was applied twice on 116 pages: first content sat at 192px under a 64px navbar, and now sits at 116px',
      'Momentum scrolling on every independently scrolling pane, and the last sub-44px controls (share buttons, colour swatches, the contact email and GitHub links) now meet the touch minimum'
    ]
  },
  {
    version: '2.6.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'Every indexable URL used to answer with a 301 to a trailing-slash copy of itself while its canonical tag pointed at the un-slashed form — all 138 sitemap entries were redirects, which Search Console files as "Page with redirect" instead of indexing',
      'hreflang for English and Spanish, emitted per route so each page points at its own pair rather than the homepage, with ?lang= finally switching the language for real (it had only ever read localStorage, so the Spanish URL served English to every crawler)',
      'The 125 /embed/* pages are no longer blocked in robots.txt and told to index at the same time — they carry a noindex the crawler can actually reach, so they stop competing with the real tool pages',
      'The boot splash now lifts from CSS instead of waiting on JavaScript: the hero heading had been sitting behind an opaque curtain for 18 seconds of measured LCP render delay on throttled mobile'
    ]
  },
  {
    version: '2.5.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'New flagship tool — Regex Builder & Tester at /tools/regex-builder',
      'Live match highlighting with capture groups, named groups and match offsets',
      'Real-time syntax highlighting on the pattern itself, all six JavaScript flags with explanations, and a find-and-replace preview',
      '14 presets that each load a sample so the pattern demonstrates itself, a six-section cheatsheet, and shareable permalinks that restore pattern, flags, test string and replacement',
      'Code snippets for JavaScript, Python, Go, Java, PCRE and .NET, each with notes on how that engine differs from the JavaScript one doing the matching'
    ]
  },
  {
    version: '2.4.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'Every input placeholder in every tool is now translated — 122 strings across 71 templates that a Spanish visitor previously read in English',
      'Placeholders that carry no language are deliberately left alone: colour notation like "R, G, B (0-255)", CSS and SVG syntax samples, example.com URLs and SPF/DKIM records',
      'The grocery list keeps its per-language name examples, because those describe what to type into that field rather than the interface language',
      'Fixed 15 labels that showed a literal "&amp;" instead of "&" — six category eyebrows and nine tool titles stored an HTML entity that interpolation escaped a second time'
    ]
  },
  {
    version: '2.3.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'Public roadmap re-cut against what is actually being worked on — Now is mobile polish, i18n expansion and Blueprint content',
      'Accessibility audit and security hardening left the Now column because both shipped (2.2.0 and the 2026-08-08 dependency sweep)',
      'Every Now card links to the Dev Log entry telling its story',
      'Liquid Glass CSS Studio dropped from Next'
    ]
  },
  {
    version: '2.2.1',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'Hero carousel is visible on mobile again — it had been a 210px black void directly under the header on every phone',
      'Cause: Angular scopes @keyframes names per component, but did not rewrite the animation reference inside the <=768px media query, so it pointed at a keyframes name that did not exist and the cards never left opacity: 0',
      'Mobile now reuses the desktop keyframes and flattens the 3D tilt with transform: none !important, so there is only one keyframes name left to scope'
    ]
  },
  {
    version: '2.2.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'a11y overhaul — every interactive control now has an accessible name',
      'Zero buttons without an accessible name site-wide; 82 that relied on a hover-only title tooltip now carry a real label, translated where the tooltip was',
      '296 form controls wired to the labels that were only visually beside them — sliders and colour pickers used to announce as unnamed',
      'Header logo is a real button, not a div with role="button", and shows a focus ring again',
      'rel="noopener noreferrer" on all 64 links that open a new tab',
      'Heading levels no longer skip from h1 to h3 on games, css-variables and pdf-generator'
    ]
  },
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
