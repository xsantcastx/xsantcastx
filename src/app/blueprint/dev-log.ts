/**
 * dev-log.ts — the build-in-public journal behind xsantcastx.com.
 *
 * Same pattern as tools-registry.ts: one array is the single source of truth,
 * and the /blueprint Dev Log tab renders whatever is in it. Entries are plain
 * data with no Firestore dependency, so this can move to a collection later
 * without touching the component — swap the array for an Observable and the
 * template stays identical.
 *
 * House rules for entries:
 *   - Real, specific, technical. Numbers you can check against the repo.
 *   - Write the mistakes down too. A log that only records wins is marketing.
 *   - Newest first.
 */

export type DevLogCategory =
  | 'problem-solved'
  | 'architecture'
  | 'milestone'
  | 'agent-log'
  | 'feature-launch';

export interface DevLogEntry {
  /** Slug — also the deep-link fragment (#log-<id>) */
  id: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  title: string;
  /** One or two sentences shown on the collapsed card */
  summary: string;
  /** Full body, one string per paragraph */
  body: string[];
  tags: string[];
  category: DevLogCategory;
}

/** Display metadata per category — label + star palette (CLAUDE.md §2). */
export const DEV_LOG_CATEGORIES: {
  key: DevLogCategory;
  label: string;
  color: string;
  glow: string;
}[] = [
  { key: 'problem-solved', label: 'Problem Solved', color: '#A78BFA', glow: 'rgba(139, 92, 246, 0.6)' },
  { key: 'architecture',   label: 'Architecture',   color: '#5fb6ff', glow: 'rgba(80, 180, 255, 0.6)' },
  { key: 'milestone',      label: 'Milestone',      color: '#ffc669', glow: 'rgba(255, 180, 80, 0.6)' },
  { key: 'agent-log',      label: 'Agent Log',      color: '#c48bff', glow: 'rgba(180, 120, 255, 0.6)' },
  { key: 'feature-launch', label: 'Feature Launch', color: '#ff6dd7', glow: 'rgba(255, 90, 210, 0.6)' }
];

export const DEV_LOG: DevLogEntry[] = [
  {
    id: 'gold-per-second',
    date: '2026-08-12',
    title: 'An idle economy nobody could see running',
    summary:
      'The forge earned one Gold a minute and displayed it on a pill that changed once a minute, silently. Every mechanic underneath was correct. None of it was believable.',
    category: 'problem-solved',
    tags: ['Economy', 'Idle', 'Performance', 'Prestige'],
    body: [
      'The Godforge economy shipped priced per minute and settled per minute. That is a defensible engineering choice — background tabs get their timers clamped to once a minute at best, so settling on elapsed wall-clock rather than ticking is the only version that survives a laptop lid closing — and it produced a mechanic nobody believed in. A rate you can only observe by waiting sixty seconds for it to move once, on a pill with no animation, is indistinguishable from a static number. The whole idle layer read as a claim on a shop page.',
      'The unit is now the second, from the price tables through the settlement loop to the readout. The prices did not move with it, so every existing ledger is worth sixty times more per unit of time than it was. That is deliberate: the old curve topped out at forty Gold a minute, and the new top rung costs ten million.',
      'The settlement is still elapsed-based and still capped at eight hours, because none of the reasons for that changed. What changed is that the prompt now fires every second instead of every sixty, which meant two things had to be paid for. Writes are throttled to one every five seconds with an immediate flush on purchase, prestige and pagehide — safe only because Gold and the idle clock are written together, so a dropped write rewinds both and the next load re-settles exactly the span it did not save. And the settle returns before touching Angular at all when the tab is hidden: a foreground tab costs one change-detection pass a second for the counter, a background one costs nothing.',
      'The counter itself is an odometer. Digits are keyed by distance from the right-hand end rather than by index, which sounds like a detail and is the whole thing: keyed by index, the tick that takes 999 to 1,000 destroys and rebuilds every column and the number flashes instead of rolling. Keyed from the right, the ones column is the ones column forever, three digits roll and two mount.',
      'The shop went from ten purchasable things to twenty-two. Ten forge rungs instead of five, four one-off multipliers, three automatons. The automatons are the interesting one, because the obvious implementation is wrong: an auto-clicker that calls the click handler would inherit the 500ms cooldown, the combo ladder and three Codex achievements for striking the Flame yourself — so an Eclipse Automaton at twenty a second would hold a x1,000 combo indefinitely and collect all three overnight while the tab sat behind a text editor. They are income instead. The Gold lands in the per-second rate and the Flame is told to look struck once a second, whatever the rate, because twenty animated strikes a second is a strobe nobody can count.',
      'Prestige is priced off the all-time total minus what has already been granted, which is not the obvious reading either. Shards follow a square root, so scoring them per-run would make four resets at ten million pay twice what one at forty million pays — the curve would reward bailing out at the threshold over playing on, which is the exact opposite of what a prestige mechanic is for.',
      'What the Eclipse deliberately does not reset is rank. The usual shape of this mechanic takes the level with it, and here the level is not a score the economy owns: it gates lore chapters, drives quest availability, stamps discovery dates on the Codex and is the counter Essence has already been paid against. Wiping it would delete records of things the visitor actually did, in four systems that predate the Market and cannot tell a prestige from data loss. The confirmation step says so in as many words, because a reset whose scope is a surprise is a support ticket.',
      'One near-miss worth recording. The reduced-motion fallback for the new rate floater was written as a fade keyframe declared inside the `prefers-reduced-motion` block — which is the exact failure this codebase has already shipped once. Angular rewrites `@keyframes` names for view encapsulation but does not rewrite an `animation` shorthand sitting inside a media query, so the reference resolves to nothing, the animation never runs, and there is no console error and no build warning to tell you. It was caught before it shipped and the block now only ever cancels animations, never names one. A CSSOM sweep across the built app confirms zero dangling references against 125 defined keyframes.'
    ]
  },
  {
    id: 'portable-progress',
    date: '2026-08-12',
    title: 'Making progression portable before there is anywhere to port it to',
    summary:
      'The XP ledger already worked. The problem was that it only worked here — in this browser, in this tab, keyed to nothing. Fixing that before accounts exist is cheaper than fixing it afterwards.',
    category: 'architecture',
    tags: ['Progression', 'Architecture', 'Storage', 'Firestore'],
    body: [
      'Progression was a blob in localStorage: XP, energies, streak, a list of tool slugs, a list of achievement ids. Everything the site renders today, and nothing a second device could ever make sense of. There is no account system yet, so nothing was broken — but the shape of the data quietly decided how expensive accounts would be later, and it was deciding badly.',
      'Three things changed, none of which do anything visible. The blob now carries a `userId` — a UUID minted in the browser today, the Firebase Auth UID the day sign-in exists — so it is already keyed the way a database wants rather than being an anonymous object that has to be given an identity retroactively. It carries `level` and `levelTitle` even though both are derivable from XP, because derived-on-read is right for a local object and wrong for a database: a leaderboard cannot sort by a number that only exists after you run a function over every row. And achievements are stored with the moment they were earned instead of as bare ids, so a synced profile carries its own chronology instead of depending on a second store agreeing with it.',
      'The bigger change is that the storage interface went async. localStorage does not need an await, which is exactly why it was tempting to leave it synchronous — and exactly why that would have been the mistake. A synchronous `load()` grows callers that assume storage resolves in the same tick, and by the time Firestore is behind it every one of those callers is a bug. Paying for the await now costs five call sites. Paying for it later costs an audit.',
      'That audit is worth describing, because it is the part that could have gone wrong silently. Most consumers render from an observable and correct themselves when hydration lands — the homepage marks a tool card as already-struck through a template getter, so it simply repaints. But three read the ledger once and never look again: the Bestiary backfills from the tool list, the Codex builds its streak calendar from the daily history, and an Arena gate banks a first-clear achievement. Each of those would have read an empty blob and written the emptiness back. They now await hydration explicitly. The failure mode was not a crash — it was a returning visitor quietly losing their Bestiary.',
      'Writes are debounced at 800ms with a synchronous flush on pagehide. A quest claim that awards XP and banks an achievement in the same tick used to be two writes; it is one now. localStorage would not have cared, but a persistence pattern that only works for the free backend is not a migration path.',
      'What is deliberately still not built: the Firestore adapter throws on every method. It is a real class rather than a comment block so the compiler keeps proving it satisfies the interface, and it throws rather than returning an empty blob so that wiring it up by accident looks like an error instead of a wiped profile. Its docblock carries the security rule it will need, and the non-negotiable half of that rule is that XP must not be client-writable to an arbitrary value — a document the browser can set to nine million XP makes every rank on the site meaningless the moment one person opens devtools.',
      'Existing progress migrates in place, which is the only part with no room for judgment. A migration that drops a streak looks exactly like a visitor who stopped coming back, so it is pinned by twelve unit tests and verified against a real v1 blob in a browser: XP, both energies, streak, best streak, tool list and daily history all carry across, bare achievement ids are promoted to records, and a hand-edited or truncated blob degrades to a usable level-1 state instead of throwing.'
    ]
  },
  {
    id: 'open-roadmap',
    date: '2026-08-10',
    title: 'Open Roadmap: why the whole plan is public',
    summary:
      'Shipping /blueprint meant publishing the backlog, the architecture decisions and the mistakes — including the ones not fixed yet.',
    category: 'feature-launch',
    tags: ['Blueprint', 'Build in Public', 'Roadmap'],
    body: [
      'Most side projects keep the roadmap in a private doc, and the public only ever sees the finished thing. That is comfortable, and it is also how a project quietly stops being accountable to anyone. If nobody knows what was promised, nothing was ever late.',
      'So the roadmap moved onto the site. Three columns — Now, Next, Later — with a status badge on every card. The cost of that is real: once "Regex Builder & Tester" is sitting in the Next column with your name on it, you cannot silently decide it was never a good idea. You have to move it to Later and let people see it move.',
      'The implementation is deliberately boring. Roadmap items, architecture decisions and these log entries are plain TypeScript arrays — no CMS, no database round-trip, no admin UI. Adding a roadmap item is a one-line edit that ships with the next deploy. The tool map is the one exception: it derives from TOOLS_REGISTRY at build time, so it is structurally impossible for the count on this page to drift from the tools that actually exist.',
      'The part that matters most is the suggestion form at the bottom of the Contribute tab. A roadmap that only flows outward is a changelog with extra steps. The interesting version is the one where somebody reads the Later column, thinks "that is the wrong priority", and says so.'
    ]
  },
  {
    id: 'i18n-journey',
    date: '2026-08-09',
    title: 'The i18n Journey: 126 tools, two languages',
    summary:
      'Adding Spanish revealed that the hard part is not the strings in the templates — it is the English baked into every tool\'s output.',
    category: 'feature-launch',
    tags: ['i18n', 'Angular', 'TranslationService'],
    body: [
      'The site had a TranslationService and a language toggle from early on, but it only covered the chrome: nav, footer, hero copy. Every one of the 126 tools was still hardcoded English, which meant a Spanish-speaking visitor got a translated shell wrapped around an untranslated product.',
      'The mechanical part went in batches — inject TranslationService, replace literals with translate(\'key\') calls, add the EN and ES pairs. Roughly a dozen tools per commit, because a 126-file diff is a diff nobody reviews. Doing it in batches also meant each batch could be verified independently instead of discovering a systematic mistake at the end.',
      'The interesting problem showed up about three batches in. A tool is not just labels. The CSS generators emit code comments. The validators emit error messages. The JSON tools emit type names and diff annotations. All of that is output, not UI, and none of it lives in a template where a find-and-replace can reach it. A translated button above an English error message arguably looks worse than leaving the whole thing in English.',
      'The current position is a deliberate split: interface copy is translated, generated code output stays in English. Developers read English code comments regardless of what language they speak, and a Spanish comment inside a CSS snippet the user is about to paste into an English codebase is not a kindness. That line is a judgment call and it is the kind of thing worth arguing about — which is part of why it is written down here.',
      'Still open: the tool titles and descriptions in the registry have optional titleKey and descriptionKey fields, but only a handful of tools populate them. Until every entry has them, the /tools grid is bilingual in patches.'
    ]
  },
  {
    id: 'security-hardening',
    date: '2026-08-08',
    title: 'Security Hardening: clearing the dependency tree',
    summary:
      'Twenty advisories closed across the app and Cloud Functions, one critical — plus the CSP finally dropped script-src \'unsafe-inline\'.',
    category: 'problem-solved',
    tags: ['Security', 'npm audit', 'CSP', 'Dependencies'],
    body: [
      'The audit had been red for a while. Two separate surfaces, because this repo ships a Firebase Functions package with its own package.json: ten advisories in the app dependency tree, ten more in functions including one critical. The critical one was an SSRF in axios, fixed by moving to 1.15.0, alongside a moderate ReDoS in ajv.',
      'Not everything had a clean upgrade path. Several advisories were in transitive dependencies of packages with no patched release, which is the usual dead end — you either fork the parent, drop the feature, or pin the transitive dep. Scoped npm overrides were the answer for the app tree: they let you force a patched version deep in the graph without waiting for every maintainer above it to cut a release. They are also a liability, because an override that outlives its advisory silently holds a package back. Each one is commented with the advisory it exists for.',
      'The unglamorous half was deletion. Nine dependencies were in package.json that nothing imported — 92 packages once transitive deps were counted. Firebase turned out to be installed twice as two complete SDK copies, both bundled. Removing code you are not using is the highest-yield security work available, and it has none of the drama of a CVE.',
      'Separately, the Content-Security-Policy finally dropped script-src \'unsafe-inline\'. The blocker was always the two inline scripts in index.html — the cosmic engine bootstrap and the theme guard. Both now ship with SHA-256 hashes in the policy, which allows exactly those two scripts and nothing else an injection could add.',
      'A caveat on the numbers, because audit counts are easy to inflate: npm audit reports advisories per dependency path, so the same underlying CVE can be counted many times over and a headline "closed N vulnerabilities" can be made almost arbitrarily large. Twenty is the count of distinct advisories across both trees. The metric actually worth tracking is simpler — zero advisories at moderate or above, checked in CI, every build.'
    ]
  },
  {
    id: 'angular-21',
    date: '2026-08-05',
    title: 'Angular 21: migrating a 265-route SSR app',
    summary:
      'The framework bump was routine. Converting 126 components to standalone and rewriting 253 routes to loadComponent was not.',
    category: 'architecture',
    tags: ['Angular', 'SSR', 'Standalone', 'Migration'],
    body: [
      'Angular 21.2.19 landed without much ceremony — the framework upgrade itself was close to a non-event, which is a genuine compliment to the Angular team\'s migration tooling. The real work was structural, and it was work this app had been deferring for a long time.',
      'Every one of the 126 tool components was still declared in an NgModule. That is not wrong, but it meant the build had one enormous lazy chunk: visit any single tool and you downloaded all of them. The official `ng g @angular/core:standalone` schematic did the bulk of the conversion, and then 253 routes across the tools and embed routing modules were rewritten from `component:` to `loadComponent:`, preserving path, title and SEO data verbatim. `tools-page-components.module.ts` was deleted outright.',
      'The result was a 3.7 MB single chunk splitting into 158 per-tool chunks of roughly 3–55 kB each. The largest is pdf-generator at 124 kB, and that is almost entirely jsPDF — a tool that needs a PDF library is going to carry a PDF library, and the point of the split is that the other 125 tools no longer carry it too.',
      'Worth being honest about the baseline: the internal spec driving this work claimed main.js was 5.47 MB with 125 eagerly-loaded tool components. That was wrong. main.js was already 535 kB and the tools were already lazy — just batched into one chunk. The intent of the work (per-tool chunks) was right and got implemented; the "main.js drops to 270 kB" framing in the spec never applied to reality, because the initial bundle was never the problem. Initial bundle size is essentially unchanged, by design.',
      'Prerendering now covers 265 routes. Every tool page, every top-level page, real HTML for all of them, generated at build time rather than rendered per request.'
    ]
  },
  {
    id: 'mobile-performance',
    date: '2026-06-10',
    title: 'Mobile Performance: making an animation-dense site survive a phone',
    summary:
      'A cosmic starfield, a CSS planet and a particle canvas are lovely on a desktop GPU. On a mid-range Android they are a heater.',
    category: 'problem-solved',
    tags: ['Performance', 'Mobile', 'Canvas', 'Animation'],
    body: [
      'This site runs more than twenty simultaneous ambient systems: a particle constellation canvas, a drifting pulsar, a rotating alchemical sigil, a CSS-only lit planet with ring shadows, scroll-linked parallax, per-character heading animations, cursor trails. On a desktop with a discrete GPU that is a nice atmosphere. On a mid-range phone it is a frame-rate problem and a battery problem.',
      'The first instinct — a single "is mobile, disable animations" kill switch — was the wrong shape and got removed. It produces a dead page on exactly the devices most visitors are using, and it treats a 2019 budget Android and a current iPhone Pro as the same machine. What replaced it is tiered. Canvas lite mode triggers on a compound signal: viewport ≤768px, OR hardwareConcurrency ≤4, OR deviceMemory ≤4. In lite mode device pixel ratio is capped at 1.5, particle density is halved, and the O(n²) constellation-line pass — which is the genuinely expensive part — is skipped entirely. Ripples and touch sparks stay, because those are the feedback a user actually notices.',
      'On top of that sits a frame-time governor. It keeps a rolling 60-frame average, and when that average exceeds 12 ms it sheds 20% of the remaining particles, with a floor of 24 so the effect never fully dies. It is a feedback loop rather than a threshold, which means it degrades on devices nobody tested on, including ones that did not exist when the code was written.',
      'One bug from this pass is worth recording because it is the kind that hides forever. A mobile rule setting the planet\'s surface drift to `animation-duration: 180s` had been in the stylesheet for months doing absolutely nothing — it was silently overridden by an `animation:` shorthand appearing later in source order, which resets duration. Nothing errored. The animation just ran at its desktop speed on every phone. Fixed with `!important`, matching the neighbouring mobile rules. Shorthand properties quietly clobbering longhands set earlier is a whole category of CSS bug that no tool warns about.',
      'The honest limitation: all of the above was verified by static analysis and build output. No runtime profiling on real devices has happened yet. The acceptance criteria that need an actual browser — CLS under 0.02, 55fps under throttled scroll, no horizontal overflow between 320 and 768px, Safari mask-and-blend rendering — are unverified rather than passing, and they are sitting in the roadmap for that reason.'
    ]
  },
  {
    id: 'ssr-at-scale',
    date: '2026-06-01',
    title: 'SSR at Scale: 265 prerendered routes and the errors nobody sees',
    summary:
      'A custom ErrorHandler stops SSR failures from breaking the build. That is a trade, not a fix — so it logs a grep-able trail.',
    category: 'problem-solved',
    tags: ['SSR', 'Angular', 'Monitoring', 'Build'],
    body: [
      'Prerendering 265 routes at build time is great for SEO and awful for build stability. Any single component that touches `window` at the wrong moment, or hits an API that does not exist in Node, takes down the entire production build — and it takes it down with a stack trace pointing at the framework rather than at your component.',
      'The response was a custom `SsrErrorHandler` in `app.server.module.ts`. It catches errors during server render and refuses to rethrow, so one bad component prerenders as a degraded page instead of failing 265 routes. That kept the deploy pipeline moving. It also means a component can be quietly broken on the server for weeks while every build reports success, which is a genuinely worse failure mode than a red build.',
      'So the handler is built to leave a trail. Every swallowed error logs a single structured line: `[SSR-SWALLOWED] route=<route> kind=<kind> msg=<truncated>`. The message is truncated to 200 characters and whitespace-collapsed so it stays one grep-able line. Errors are bucketed into `NotYetImplemented` — Angular\'s marker for a browser-only API called during server render, which is common and usually benign — versus `Other`, which is everything genuinely worth looking at. Anything in the `Other` bucket also emits `[SSR-SWALLOWED-STACK]` with the top three stack frames, skipping the error header, because three frames is enough to identify the component and short enough to not drown the build log.',
      'The point of that format is that it is machine-readable. A monitoring job greps build stderr for the prefix and reports counts per route, which turns "silent suppression" into "a number that should be zero and is currently not". Suppression without monitoring is just hiding bugs; suppression with a counter is a triage queue.',
      'This is not where it should end up. The right end state is zero swallowed errors and a handler that rethrows. The current state is a build that ships and a log that tells you exactly how much debt is behind it.'
    ]
  },
  {
    id: 'zero-to-126-tools',
    date: '2026-05-20',
    title: 'From 0 to 126 Tools: what made the scale possible',
    summary:
      'The catalog grew fast because of one file. Every tool is one registry entry, and that entry wires up six systems automatically.',
    category: 'agent-log',
    tags: ['Registry', 'Automation', 'Scale', 'Architecture'],
    body: [
      'Adding the first tools was slow in the way early work always is: a card on the landing page, an entry in the tools grid, a route with SEO metadata, a JSON-LD block, a related-tools mapping, a sitemap line. Six places to edit for one tool, and six places to forget.',
      'TOOLS_REGISTRY collapsed that. One entry — id, title, description, route, category, tags, icons, feature bullets — and everything downstream derives from it. The landing page cards, the /tools galaxy map, the related-tools recommendations, the category filters, the tag-based constellation lines, and the count displayed on this very page all read from the same array. The registry is not a convenience; it is the reason the catalog could get to three digits without the metadata rotting.',
      'That leaves the obvious risk, which is that 126 shallow tools is worse than 30 good ones. A spot-check sampled a dozen entries at random — meta-tag-generator, ts-playground, css-variables, email-deliverability-auditor, responsive-preview, base64-encoder, lorem-generator, snippet-manager, checklist, git-reference, hex-editor, morse-code. All had real implementations, between 107 and 677 lines of TypeScript each plus matching templates. No stubs, no placeholder pages. Three carried a handful of TODO markers, which is polish debt rather than a broken tool.',
      'A sample of twelve is not an audit of 126, and the honest read is that a few tools are probably rougher than the rest. A full pass with fresh eyes is on the roadmap. But the structural claim holds: this is not a directory of empty pages with good SEO.',
      'The other thing that made scale work is that every tool runs entirely in the browser. No server, no queue, no per-tool backend to operate. The marginal operational cost of tool 126 is the same as tool 2 — which is zero.'
    ]
  },
  {
    id: 'mcp-server',
    date: '2026-05-02',
    title: 'The MCP Server: shipping the toolbox to AI agents',
    summary:
      'Fourteen of the tools now run inside Claude and any other MCP client, as a published npm package.',
    category: 'feature-launch',
    tags: ['MCP', 'npm', 'AI Agents', 'Developer Tools'],
    body: [
      'The tools were already pure functions with a UI bolted on. Base64 encoding, hash generation, JSON formatting, cron parsing — none of that needs a browser, it needs an input and an output. The Model Context Protocol turned out to be exactly the right shape for exposing them somewhere else.',
      'Fourteen tools are packaged as `xsantcastx-mcp-server`, installable with `npm install -g xsantcastx-mcp-server`. It speaks MCP over stdio, which means it works with Claude Desktop, Claude Code, and any other MCP-compatible client without a per-client integration.',
      'The design constraint carried straight over from the website: zero API calls, all local computation. An agent using this server is not sending your data anywhere, because there is nowhere for it to go — the whole thing runs on your machine. That is the same promise the site makes to a human in a browser, and it was worth keeping identical rather than quietly relaxing it for the agent case.',
      'The interesting realisation is what this says about the tools themselves. A well-built utility has a UI-shaped surface and a function-shaped core, and if the core is clean it can be re-hosted almost for free. Repackaging fourteen tools was days of work, not months, entirely because none of them had business logic tangled into a component.'
    ]
  },
  {
    id: 'easter-eggs',
    date: '2026-04-15',
    title: 'Easter Eggs: 106 hidden things in a utility site',
    summary:
      'A registry of 106 discoverable secrets, tracked per-visitor in localStorage and counted globally in Firestore.',
    category: 'feature-launch',
    tags: ['Easter Eggs', 'Engagement', 'Games', 'Firestore'],
    body: [
      'A developer tools site has a retention problem baked into its value proposition: it works, you leave. That is the tool doing its job. The counter-move was to make the site worth poking at — not by getting in the way of the utility, but by rewarding the kind of curiosity that costs nothing to indulge.',
      'There are 106 Easter eggs in a central registry — 4 global and 102 tool-specific. The tool-specific ones fire on doing something unexpected inside a tool rather than on finding a hidden button, which is the distinction that makes them feel earned instead of arbitrary. Discovery state persists per-visitor in localStorage under `easter-eggs-found`, and global discovery counts go to Firestore, so an egg can advertise how rare it is.',
      'When one fires, a toast slides in with the egg name and a running X/106 progress count, then auto-dismisses after six seconds. Six seconds was tuned: long enough to read and register, short enough that it never becomes something you have to dismiss while working. Every one of them is skippable and none block input.',
      'The heavier layer sits behind the global eggs. The Konami code, a hidden sigil in the corner, and a console command all toggle "ritual mode", which changes the site\'s palette and fades in an ambient five-oscillator Web Audio drone. That audio graph is lazily instantiated — a visitor who never triggers ritual mode never gets an AudioContext at all, which matters both for performance and for not being the site that makes noise at somebody in an open-plan office.',
      'Whether this is a good use of engineering time on a utility site is a fair question. The argument for it: the tools are commodities and there are a hundred sites with a Base64 encoder. The thing that is not a commodity is being the one somebody remembers.'
    ]
  },
  {
    id: 'day-one',
    date: '2026-03-01',
    title: 'Day 1: Building in Public',
    summary:
      'The founding constraints — free, no sign-up, nothing leaves the browser — and why each one was worth committing to before writing any code.',
    category: 'milestone',
    tags: ['Launch', 'Principles', 'Privacy'],
    body: [
      'The site launched with 45 tools and three constraints that have not moved since: everything is free, nothing requires an account, and no data leaves the browser. Those were chosen deliberately at the start, because constraints adopted on day one are architecture and constraints adopted in month six are refactors.',
      'The privacy one does the most work. Every tool runs client-side, which means you can paste a production config, a customer CSV or a JWT into any of them without a decision to make about whether you trust the operator. There is no upload, no logging, no retention — not as a policy you have to take on faith, but because there is no server in the path to do any of it.',
      'That constraint pays for itself in ways that were not obvious upfront. No servers means no hosting costs that scale with usage, which is what makes "free forever" a sustainable claim rather than a runway problem. It means no queue, so results appear as you type. It means every tool keeps working if the backend is down, because there is no backend. And it made the MCP server possible two months later, essentially for free.',
      'The visual direction — a cosmic universe with a drifting pulsar, constellation lines and hidden runes — was the other early commitment, and the more contested one. Developer tools trend toward austere and grey. The bet was that a utility site can be memorable without being less useful, and that the wrapper is not the product. Two constraints keep that bet honest: every animation over a second has a reduced-motion fallback, and nothing decorative is allowed to block or slow the thing you actually came to do.'
    ]
  }
];
