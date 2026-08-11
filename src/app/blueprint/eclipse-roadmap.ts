/**
 * eclipse-roadmap.ts — the long arc, in six phases.
 *
 * The Now/Next/Later columns on /blueprint answer "what is being worked on this
 * month". This answers the other question: where is all of it going. The six
 * phases are named for the Eclipse Realms cosmology — a Sun that breaks, a
 * world that wakes to what broke it, and an alignment that either heals it or
 * finishes it.
 *
 * Honesty rule: a phase is only `completed` when every item under it has
 * actually shipped, and `vision` means exactly that — an intention with no
 * commitment behind it. If a phase slips, move it backwards here rather than
 * quietly redefining what it meant.
 *
 * The canonical prose version lives at docs/ECLIPSE_REALMS_ROADMAP.md.
 */

export type PhaseStatus = 'completed' | 'in-progress' | 'planned' | 'vision';

export interface EclipsePhaseItem {
  title: string;
  detail: string;
  /** true once this specific item has shipped. */
  done: boolean;
}

export interface EclipsePhase {
  id: string;
  /** Roman numeral shown in the phase orb. */
  numeral: string;
  name: string;
  /** One line: what this phase is for. */
  premise: string;
  /** A line of lore that frames the phase. */
  quote: string;
  status: PhaseStatus;
  /** Version or window this phase covers, in plain language. */
  window: string;
  items: EclipsePhaseItem[];
}

/** Colour and label per status. Gold for done, cyan for live, muted for queued. */
export const PHASE_STATUS: Record<PhaseStatus, { label: string; color: string; glow: string }> = {
  'completed':   { label: 'Complete',    color: '#C9A84C', glow: 'rgba(201, 168, 76, 0.6)' },
  'in-progress': { label: 'In progress', color: '#00d4ff', glow: 'rgba(0, 212, 255, 0.6)' },
  'planned':     { label: 'Planned',     color: '#7d918c', glow: 'rgba(125, 145, 140, 0.35)' },
  'vision':      { label: 'Vision',      color: '#c48bff', glow: 'rgba(180, 120, 255, 0.45)' },
};

export const ECLIPSE_ROADMAP: EclipsePhase[] = [
  {
    id: 'genesis',
    numeral: 'I',
    name: 'Genesis',
    premise: 'A world, and things in it worth using.',
    quote: 'In the beginning, there was the Sun — whole, silent, and dreaming.',
    status: 'completed',
    window: 'v1.0 – v2.9',
    items: [
      { title: '126 tools, all client-side', detail: 'Every tool runs in the tab. Nothing is uploaded, so there is no server to pay for and no queue to wait in.', done: true },
      { title: 'The cosmic engine', detail: 'Constellation canvas, cursor pulsar, scroll reveal, magnetic CTAs, click ripples — 22 systems, all SSR-safe and all with a reduced-motion path.', done: true },
      { title: 'English and Spanish throughout', detail: 'Every string behind TranslationService, including the 122 input placeholders that had been left in English.', done: true },
      { title: 'Blueprint, dev log and public roadmap', detail: 'The order of work, in public, with cards that move backwards when that is what happened.', done: true },
      { title: 'Accessibility and mobile passes', detail: 'Every control has an accessible name, every standalone control clears 44px, and the drawer works on a notched phone.', done: true },
    ],
  },
  {
    id: 'awakening',
    numeral: 'II',
    name: 'Awakening',
    premise: 'The site starts remembering who is using it.',
    quote: 'The soul remembers both.',
    status: 'completed',
    window: 'v2.10 – v2.13',
    items: [
      { title: 'XP and ten ranks', detail: 'Wanderer through Eclipse Lord, earned from tool use, page visits, copies, shares and secrets.', done: true },
      { title: 'Daily streak', detail: 'Compounds 50 XP a day to a 600 cap, resets on the first day missed, and keeps your best so the loss is visible.', done: true },
      { title: 'Aether and Nox', detail: 'XP splits by what you actually use — design work feeds one energy, security and code work the other.', done: true },
      { title: 'The rarity ladder', detail: 'Six tiers with their own colour, synthesised sound and screen effect. Singular is awarded for being first in the realm.', done: true },
      { title: 'Five realms', detail: 'Twelve tool categories grouped into Luminous, Umbral, Verge, Archivum and Nexus, with a realm badge on every tool page.', done: true },
      { title: 'The Arena', detail: 'Eight gates, each chained by a secret, each inheriting that secret\'s tier.', done: true },
    ],
  },
  {
    id: 'eclipse',
    numeral: 'III',
    name: 'Eclipse',
    premise: 'Progression that survives changing device.',
    quote: 'The Eclipse Sun aligns every thirty-three years, and for seven days the realms are one.',
    status: 'in-progress',
    window: 'next',
    items: [
      { title: 'Accounts and cloud progress', detail: 'The Firestore progress adapter is stubbed and documented; it needs a sign-in and a reconciliation rule before it can be switched on.', done: false },
      { title: 'Global first-in-realm ledger', detail: 'Singular already reads the global discovery counter. The public record of who got there first does not exist yet.', done: false },
      { title: 'Realm-tinted tool chrome', detail: 'The realm badge landed; tinting the tool page itself — accent, focus ring, output panel — has not.', done: false },
      { title: 'Playable Arena gates', detail: 'The eight gates unlock, but nothing is behind them yet. Shadow Puzzle first.', done: false },
      { title: 'Error tracking', detail: 'A client crash is currently invisible. Nothing above ships safely until that is not true.', done: false },
    ],
  },
  {
    id: 'convergence',
    numeral: 'IV',
    name: 'Convergence',
    premise: 'The tools reach people who never visit the site.',
    quote: 'Balance sustains existence.',
    status: 'planned',
    window: 'after Eclipse',
    items: [
      { title: 'Browser extension', detail: 'The ten most-used tools from a popup, same cosmic chrome.', done: false },
      { title: 'VS Code extension', detail: 'A command-palette entry that opens a tool in a webview. The MCP server already exists to repackage.', done: false },
      { title: 'PWA', detail: 'Most tools already work offline. A manifest and a service worker make that official.', done: false },
      { title: 'CLI', detail: 'npx xsantcastx box-shadow opens the tool deep-linked. Small and shareable.', done: false },
      { title: 'Cross-surface progression', detail: 'XP earned in the extension counts. This is why Eclipse has to land first.', done: false },
    ],
  },
  {
    id: 'godforge',
    numeral: 'V',
    name: 'Godforge',
    premise: 'The engine becomes something other people can build with.',
    quote: 'The Godforge opens during the Eclipse, and forces you to meet the other version of yourself.',
    status: 'planned',
    window: 'later',
    items: [
      { title: '@xsantcastx/cosmic-engine', detail: 'The engine extracted from index.html into a package anyone can install.', done: false },
      { title: 'A tool SDK', detail: 'One manifest and one component, and a new tool inherits routing, SEO, i18n, embeds, realms and secrets.', done: false },
      { title: 'Community tools', detail: 'Tools contributed by other people, carrying the same guarantees: no upload, no account, no tracking.', done: false },
      { title: 'Public API', detail: 'The registry, the realm map and the rarity ladder as data other projects can read.', done: false },
    ],
  },
  {
    id: 'final-eclipse',
    numeral: 'VI',
    name: 'Final Eclipse',
    premise: 'The whole thing as one world rather than a site with features bolted on.',
    quote: 'The world shall end not in fire nor shadow, but when the Convergent forgets which one they were.',
    status: 'vision',
    window: 'no date, and no commitment',
    items: [
      { title: 'A realm map you can walk', detail: 'Not a filter — a map, where tools sit in a place and the place means something.', done: false },
      { title: 'Seasons', detail: 'Singular is one-of-a-kind per season in the economy doc. Seasons do not exist here yet.', done: false },
      { title: 'Convergent profiles', detail: 'A public page for a rank, an energy balance and the secrets someone found first.', done: false },
      { title: 'The lore, playable', detail: 'The codex stops being flavour text and becomes something you move through.', done: false },
    ],
  },
];

/** Items shipped / items total, for the phase progress readout. */
export function phaseProgress(phase: EclipsePhase): { done: number; total: number; percent: number } {
  const done = phase.items.filter(i => i.done).length;
  const total = phase.items.length;
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}
