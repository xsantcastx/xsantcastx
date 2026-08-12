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
  version: '2.19.0',
  buildDate: '2026-08-12',
  /** Each major release gets a codename */
  codename: 'The Godforge',
  /** Where the full story of this release lives */
  changelog: '/blueprint'
} as const;

/**
 * Newest first. The /blueprint Dev Log reads this to show what shipped when.
 */
export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: '2.19.0',
    codename: 'The Godforge',
    date: '2026-08-12',
    highlights: [
      'The home page is the Godforge now — a serif title over a CSS-only furnace core, the visitor\'s rank read out under it, and one door into the forges instead of a rotating carousel of five cards',
      'Tools are grouped by realm rather than by recency: five forge stations, each with its codex line and its own accent, opening one at a time. Collapsed stations keep their cards in the markup, so every link is still crawled — only the visitor\'s view is filtered',
      'The stats bar counts real things and can no longer drift: artifacts are live registry entries, fragments are registered easter eggs, realms come from the codex, and the prerendered-path count is written into a committed constant by the same script that builds the sitemap',
      'Cards the visitor has actually used are marked "Struck" from local progress — the site has no per-tool analytics, so it shows what it knows instead of inventing a usage number',
      'The Chronicle badges an entry with a realm only when the entry names a tool that can be placed; platform-wide work is left unbadged rather than filed under a guess',
      'A closing call before the footer: current rank and XP, a first tool to open, and the two doors the lore points at — the War Table and the Arena'
    ]
  },
  {
    version: '2.18.1',
    codename: 'The Long Arc',
    date: '2026-08-12',
    highlights: [
      'The Arena gates open now — "Enter →" was a bare button with no click handler on it, so every gate you unlocked led nowhere, on every card',
      'Color Memory is the first gate with a game behind it: Match the Eclipse Fragments, a 4×4 or 6×6 board of paired fragments in the brand palette, with a timer, a move counter and a best time',
      'Clearing it pays XP through the same XpService the rest of the site uses — 10 per pair, plus a bonus for finishing under par and under two minutes — so it lands in the header bar and counts towards a rank rather than into a score the game kept to itself',
      'Gates whose game is not built yet say "Still forging" instead of offering an Enter button that goes nowhere',
      'The overlay has to lift its own routed host to be seen: routeFadeIn leaves a transform with fill:forwards on every routed component, which makes it a stacking context, and a fixed overlay inside one cannot out-rank the header'
    ]
  },
  {
    version: '2.18.0',
    codename: 'The Long Arc',
    date: '2026-08-11',
    highlights: [
      'The Roadmap tab gains a second view under Now/Next/Later: six Eclipse phases — Genesis, Awakening, Eclipse, Convergence, Godforge, Final Eclipse — answering where all of it is going rather than what is being worked on this month',
      'Each phase expands to its items with a shipped/total meter, and the phase in progress starts open because that is the one a reader came to check',
      'Status is honest by construction: gold means every item under it actually shipped, cyan is live work, muted is committed but not started, and violet "vision" means an intention with no date and no promise behind it',
      'Phase III is marked in progress with five items and none of them done — including the account-backed progress the Firestore adapter is stubbed for, and error tracking, which nothing else should ship ahead of',
      'The prose version lives in the repo at docs/ECLIPSE_REALMS_ROADMAP.md and the site renders from src/app/blueprint/eclipse-roadmap.ts, so the two cannot drift into different claims'
    ]
  },
  {
    version: '2.17.0',
    codename: 'The Arena',
    date: '2026-08-11',
    highlights: [
      '/games is now /arena — "Where Convergents prove their worth" — with a 301 in the hosting config so every external link and indexed URL lands on the new address instead of the SPA 404',
      'Games became gates: each one is chained shut by a secret buried in a tool, and a gate inherits the rarity tier of the secret that opens it, so a red border in the Arena and a red drop toast are the same claim',
      'Locked gates carry a chain glyph and are desaturated — you can see the shape of the prize but not its colour. Opened gates glow in their tier',
      'New arena stats: gates opened, secrets found, and your rarest opened gate by name and tier (it reads "no gate opened yet" until you open one, rather than boasting about a card you have not earned)',
      'The four hardcoded rarity colours on the old game cards are gone; the cards read the shared rarity table instead',
      'Nav, sitemap and prerender list all moved with it, and no /games stub is emitted'
    ]
  },
  {
    version: '2.16.0',
    codename: 'Five Realms',
    date: '2026-08-11',
    highlights: [
      'The twelve registry categories are now grouped into five realms — Luminous (design), Umbral (security), Verge (code), Archivum (productivity) and Nexus (mail) — each with its own colour and a line from the Eclipse Realms codex',
      '/tools gets a realm rail above the galaxy map: five chips with live tool counts (33 / 10 / 24 / 58 / 2), and picking one cuts the grid into realm sections with the realm header and its quote',
      'Realm and category are two different cuts of the same list, so selecting one clears the other rather than intersecting into an empty result',
      'Every tool page carries a realm badge beside its category eyebrow — added by one global rule keyed on a data-realm attribute, not by editing 126 templates',
      'RealmService resolves route → tool → category → realm on each navigation and publishes it to CSS, clearing the variables again off a tool route so /home is never tinted by the last tool you opened',
      'Realms agree with the energy split shipped in 2.14.0: Umbral and Verge feed Nox, the other three feed Aether'
    ]
  },
  {
    version: '2.15.0',
    codename: 'Mythic',
    date: '2026-08-11',
    highlights: [
      'Easter eggs now drop on a six-tier ladder — Mortal, Eclipsed, Sacred, Anomalous, Mythic, Singular — instead of a flat toast that looked the same whatever you found',
      'All 139 registered eggs are tiered: 43 Mortal, 79 Eclipsed, 10 Sacred, 5 Anomalous and 2 Mythic (a hash with four leading zeros, and a regex that matches its own source)',
      'Singular is not authored — it is awarded when the global discovery counter comes back at exactly 1, meaning nobody in the realm reached that egg before you',
      'Sound is synthesised, not downloaded: a struck bell for Sacred, a detuned horn section for Anomalous, a sub-bass impact with a noise transient for Mythic, and a prismatic arpeggio over the impact for Singular — five cues, zero audio files, and no AudioContext at all until the first drop',
      'Mythic and Singular take the screen: one white frame at 100ms, a dim veil, a centred card with a pulsing tier glow and an eighteen-shard particle burst',
      'prefers-reduced-motion drops the flash, the burst and the pulse — the card still appears and still reads, it just holds still'
    ]
  },
  {
    version: '2.14.0',
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
    version: '2.13.0',
    codename: 'Control Room',
    date: '2026-08-11',
    highlights: [
      'Owner-only dashboard at /admin — engagement, easter-egg discovery, tool suggestions, CI runs and commit history on one page, gated on Firebase Auth and locked to a single verified email in firestore.rules',
      'The easter-egg counters have never recorded anything: the collection has no rule at all, so every discovery write falls through to the deny-all and is rejected, and the service catches the error and returns — all 139 eggs have been counting nothing, including the 58 that 2.8.0 had just finished wiring up',
      'Blueprint tool suggestions are readable for the first time — the collection was write-only, so every suggestion submitted through the form had landed somewhere nobody could open — and can now be triaged as reviewed, accepted or rejected without being editable',
      'Builds emit assets/build-stats.json (prerender route count, sitemap URL count, bundle size), so the dashboard reports measured numbers rather than placeholders',
      'The route is hidden four ways over: absent from the nav and the sitemap, noindex in its route data, and disallowed in robots.txt — and its prerendered shell renders two words and no panel markup'
    ]
  },
  {
    version: '2.12.0',
    codename: 'Stylesheet Drift',
    date: '2026-08-11',
    highlights: [
      'Five tools rendered as essentially unstyled HTML — tailwind-lookup, box-model, csv-json, dns-lookup and robots-generator all shipped the same 56-line generic scaffold stylesheet (four were byte-identical once the class prefix is normalised) while their templates were written against a completely different vocabulary, leaving 81–98% of the classes each page used matching no rule at all',
      'Four more tools had templates renamed without their stylesheets following: the whole SSL Certificate Inspector results area was unstyled because the CSS still targeted .cert-summary / .status-pill / .trust-chain, and hex-editor, sitemap-generator and the email auditor score gauge had the same drift on a smaller scale',
      'Four labels showed HTML entities as literal text — Angular interpolation emits its result as a text node, so "Copy &lt;link&gt; Tags", "Copy HTML &lt;img&gt; Tag", "HTML &rarr; MD" and the responsive-preview device emoji were all displayed verbatim rather than decoded',
      'The X and LinkedIn share buttons on 97 tool pages had lost their brand colors: 179 links use the short .share-btn--x / --li spellings, which no rule defined, and a plain class selector could not have won anyway against each component\'s own Angular-scoped .share-btn',
      'A repo-wide scan for templates whose classes go unmatched by their own stylesheet now reports zero tools, down from nine'
    ]
  },
  {
    version: '2.11.0',
    codename: 'Waterfall',
    date: '2026-08-11',
    highlights: [
      'New flagship tool — HAR File Analyzer & Network Waterfall at /tools/har-analyzer, filling the gap left by Google\'s abandoned HAR Analyzer',
      'Drag in a .har and get a request waterfall segmented by queueing, DNS, TCP, TLS, TTFB and download, with DOMContentLoaded and load drawn across every row',
      'Parsing runs in a Web Worker that keeps the capture off the main thread — a 100 MB export never freezes the tab, and only a few hundred KB of analysis crosses back',
      'Core Web Vitals are reconstructed and honestly labelled: TTFB, DCL and load are measured, FCP and LCP are bounded estimates with their method stated, and CLS is reported as underivable rather than invented',
      'Findings call out uncompressed text, weak cache lifetimes, slow server waits, oversized images, redirects, HTTP/1.x and third-party weight — each one filters the table down to the offenders',
      'Privacy redaction strips cookies, credential headers, request and response bodies and token-shaped query parameters, in the URL as well as the header list, then exports a HAR that is safe to attach to a ticket',
      'Share a link that carries a compressed analysis digest rather than the capture itself, or export the whole thing as a Markdown report'
    ]
  },
  {
    version: '2.10.0',
    codename: 'Dead Weight',
    date: '2026-08-11',
    highlights: [
      'Stripe and the PayPal SDK no longer load on any page — PaymentService is injected by the footer, which sits on every route, and its constructor fetched both SDKs at startup, so roughly a megabyte of checkout JavaScript was downloaded on the home page and all 123 tool pages for a flow that only opens behind a click',
      'Firebase App Check now initializes on the first idle callback instead of during bootstrap, taking reCAPTCHA (336 kB) off the startup path of every route; the three Firestore calls that fire before that window now wait for it, so the visit, changelog and tool-usage counters keep working if App Check enforcement is ever switched on',
      'Google Analytics is fetched only after the visitor accepts the cookie banner — consent mode had been denying what gtag.js stored while still downloading it on every page',
      'Carbon Ads and the AdSense slot wait until the unit is nearly scrolled into view instead of requesting during page load',
      'Measured on /home at 4x CPU throttle over Slow 4G: third-party hosts contacted 12 → 4, third-party requests 27 → 8. LCP is unchanged, because the boot-curtain fix in 2.6.0 had already taken it off the main thread — this release is about bandwidth, CPU and privacy, not paint time'
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
