/**
 * codex-secrets.ts — the hidden content that is not an easter egg.
 *
 * The Achievement Wall covers everything the egg registry knows about. This
 * covers what it does not: the ritual mode behind the seal, the command
 * palette, the console handles, the routes with no link pointing at them, and
 * the tool combinations that only make sense once you have seen both halves.
 *
 * Two kinds of entry, and the difference is load-bearing:
 *
 *   `eggId`    — discovery is proven by the egg registry. Nothing extra to
 *                track; the state already exists and is already persisted.
 *   `detector` — discovery is observed by SecretsService at runtime and written
 *                to its own key.
 *
 * A secret with neither is not listed. The Codex claims to know when you found
 * something and how, and an entry that cannot actually tell would be a lie in a
 * page whose entire premise is an honest record.
 */

export type SecretGroupId =
  | 'easter-eggs'
  | 'konami'
  | 'hidden-pages'
  | 'console'
  | 'combos';

export interface SecretGroup {
  id: SecretGroupId;
  label: string;
  icon: string;
  color: string;
  blurb: string;
}

export const SECRET_GROUPS: SecretGroup[] = [
  {
    id: 'easter-eggs',
    label: 'Easter Eggs',
    icon: '🥚',
    color: '#A78BFA',
    blurb: 'Things the realm does when you are not expected to be looking.',
  },
  {
    id: 'konami',
    label: 'Konami Codes',
    icon: '🕹️',
    color: '#ff6dd7',
    blurb: 'Sequences. Type them anywhere and something changes.',
  },
  {
    id: 'hidden-pages',
    label: 'Hidden Pages',
    icon: '🚪',
    color: '#a48bff',
    blurb: 'Rooms with no door on the map. They are all real addresses.',
  },
  {
    id: 'console',
    label: 'Console Commands',
    icon: '💻',
    color: '#5fb6ff',
    blurb: 'Open the developer console. The realm left handles there on purpose.',
  },
  {
    id: 'combos',
    label: 'Tool Combos',
    icon: '⚗️',
    color: '#C9A84C',
    blurb: 'Two tools that mean more together than either does alone.',
  },
];

/** Ids of the runtime-observed secrets. Kept narrow so a typo cannot compile. */
export type DetectedSecretId =
  | 'ritual-veil'
  | 'command-palette'
  | 'console-banner';

export interface SecretDefinition {
  id: string;
  group: SecretGroupId;
  /** Shown once found. */
  name: string;
  /** Shown once found: what this actually is. */
  reveal: string;
  /** Shown while undiscovered. Never the answer. */
  clue: string;
  /** Extra lore for the rarest ones — shown under the clue, italicised. */
  lore?: string;
  /** Ladder tier, reusing the achievement rarity colours. */
  tier: 'mortal' | 'eclipsed' | 'sacred' | 'anomalous' | 'mythic' | 'singular';
  /** Discovery proven by this egg being found. */
  eggId?: string;
  /** Discovery observed by SecretsService under this id. */
  detector?: DetectedSecretId;
  /** Discovery proven by having navigated to this route at least once. */
  route?: string;
}

export const SECRETS: SecretDefinition[] = [
  // ── Konami ────────────────────────────────────────────────────────────────
  {
    id: 'konami-ritual',
    group: 'konami',
    name: 'The Old Sequence',
    reveal: 'The Konami code opens ritual mode anywhere on the site.',
    clue: 'Up. Up. Down. Down. You already know the rest — it has not changed since 1986.',
    tier: 'eclipsed',
    eggId: 'konami',
  },
  {
    id: 'ks-konami',
    group: 'konami',
    name: 'The Code About The Code',
    reveal: 'Searching the keyboard-shortcut reference for "konami" finds a shortcut that is not one.',
    clue: 'One of the reference tools will happily look up a sequence that is not a shortcut at all.',
    tier: 'eclipsed',
    eggId: 'ks-konami',
  },

  // ── Easter eggs (the ambient ones, not the tool triggers) ─────────────────
  {
    id: 'ritual-veil',
    group: 'easter-eggs',
    name: 'The Veil Parts',
    reveal: 'Ritual mode. The seal in the corner, the old sequence, or the console handle all open it — and the ambient drone starts with it.',
    clue: 'There is a mark in one corner of every page that does not belong to any component. It is waiting to be pressed.',
    tier: 'sacred',
    detector: 'ritual-veil',
  },
  {
    id: 'night-owl',
    group: 'easter-eggs',
    name: 'The Small Hours',
    reveal: 'The realm notices anyone still here between 2am and 5am.',
    clue: 'Some things only happen at an hour you would not choose to be awake for.',
    tier: 'mortal',
    eggId: 'night-owl',
  },
  {
    id: 'speed-demon',
    group: 'easter-eggs',
    name: 'Too Fast To Read',
    reveal: 'Five different tools opened inside sixty seconds.',
    clue: 'Move fast enough through enough doors and something starts keeping count.',
    tier: 'eclipsed',
    eggId: 'speed-demon',
  },
  {
    id: 'hash-miner',
    group: 'easter-eggs',
    name: 'Four Zeros',
    reveal: 'A digest that begins with four zeros. There is no technique — only volume.',
    clue: 'Somewhere in the space of every possible input is one whose fingerprint starts with a run of nothing. Proof of work, for nothing but a badge.',
    lore: 'The Godforge opened. Briefly. It does that for people who refuse to stop.',
    tier: 'mythic',
    eggId: 'hash-miner',
  },
  {
    id: 'regex-ouroboros',
    group: 'easter-eggs',
    name: 'The Serpent',
    reveal: 'A regular expression that matches its own source text.',
    clue: 'A pattern can be pointed at anything. Including the line it is written on.',
    lore: 'It eats its own tail and finds the taste familiar. Almost nobody in the realm has stood here.',
    tier: 'mythic',
    eggId: 'regex-ouroboros',
  },

  // ── Hidden pages ──────────────────────────────────────────────────────────
  {
    id: 'the-codex',
    group: 'hidden-pages',
    name: 'The Codex',
    reveal: 'This page. Every secret the realm is keeping, and every one it has already given up.',
    clue: 'A record of all knowledge would have to record itself.',
    tier: 'eclipsed',
    eggId: 'codex-archivist',
  },
  {
    id: 'arena-gate',
    group: 'hidden-pages',
    name: 'The Arena',
    reveal: 'Eight games, each chained shut by a secret buried in a tool. Find the secret, break the chain.',
    clue: 'There is a room where Convergents prove their worth. Its doors are held by things you find somewhere else entirely.',
    tier: 'eclipsed',
    route: '/world/trials',
  },
  {
    id: 'blueprint-room',
    group: 'hidden-pages',
    name: 'The Open Blueprint',
    reveal: 'The public brain of the project — roadmap, dev log, architecture, and the six Eclipse phases.',
    clue: 'The realm keeps its own plans in the open. Including the parts that have not happened yet.',
    tier: 'mortal',
    route: '/blueprint',
  },
  {
    id: 'sponsors-room',
    group: 'hidden-pages',
    name: 'The Patron Slots',
    reveal: 'Where the tools are paid for. Three slots, real numbers, no agency in between.',
    clue: 'Everything here is free, which means somebody else is covering it. There is a page that says exactly who, and what it costs.',
    tier: 'mortal',
    route: '/sponsors',
  },

  // ── Console ───────────────────────────────────────────────────────────────
  {
    id: 'console-banner',
    group: 'console',
    name: 'The Greeting',
    reveal: 'Opening the developer console prints a banner, and the banner tells you what to type next.',
    clue: 'Developers look in one place nobody else does. Something is already written there, waiting.',
    tier: 'eclipsed',
    detector: 'console-banner',
  },
  {
    id: 'console-reveal',
    group: 'console',
    name: 'reveal()',
    reveal: 'A global handle that toggles ritual mode from the console. The banner names it.',
    clue: 'The realm answers to its own name, if you call it correctly and add empty parentheses.',
    tier: 'sacred',
    detector: 'ritual-veil',
  },
  {
    id: 'console-audio',
    group: 'console',
    name: 'The Drone',
    reveal: 'A five-oscillator ambient pad you can start and stop by hand. It also comes on with ritual mode.',
    clue: 'The same handle that reveals things has a sibling. That one is not visual.',
    lore: 'Nothing about the realm was ever silent. You were just not listening on the right channel.',
    tier: 'anomalous',
    detector: 'ritual-veil',
  },
  {
    id: 'command-palette',
    group: 'console',
    name: 'The Summoning',
    reveal: 'A command palette that reaches every tool on the site without touching the navigation.',
    clue: 'Two keys, pressed together, anywhere. Every editor you have ever used has taught you which two.',
    tier: 'eclipsed',
    detector: 'command-palette',
  },

  // ── Combos ────────────────────────────────────────────────────────────────
  {
    id: 'combo-mirror',
    group: 'combos',
    name: 'The Mirror Pair',
    reveal: 'Encoding "xsantcastx" and then decoding it back is two separate secrets, one in each direction.',
    clue: 'Some things count twice: once going in, once coming back out.',
    tier: 'eclipsed',
    eggId: 'b64-mirror',
  },
  {
    id: 'combo-teapot',
    group: 'combos',
    name: 'The Teapot Pair',
    reveal: 'The impossible status code is hidden twice — once in the reference, once in a real request.',
    clue: 'One number appears in two places. Looking it up is not the same as being told it.',
    tier: 'sacred',
    eggId: 'api-teapot',
  },
  {
    id: 'combo-nothing',
    group: 'combos',
    name: 'The Doctrine of Nothing',
    reveal: 'Zero, black, empty and identical are secrets in nine different tools. The realm rewards the null case everywhere.',
    clue: 'Whatever the tool, try giving it nothing at all. The realm has a soft spot for the empty answer.',
    lore: 'The Archivum has no record of this being deliberate. It was.',
    tier: 'anomalous',
    eggId: 'css-zero',
  },
  {
    id: 'combo-42',
    group: 'combos',
    name: 'The Answer, Repeated',
    reveal: 'Forty-two is a secret in four separate tools — hashed, based, filled and generated.',
    clue: 'One number opens more than one door. You have known which number since you were a teenager.',
    tier: 'sacred',
    eggId: 'hash-meaning',
  },
];

export const TOTAL_SECRETS = SECRETS.length;
