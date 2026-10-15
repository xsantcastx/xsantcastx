/**
 * codex-secrets.ts — the hidden content that is not an easter egg.
 *
 * The Achievement Wall covers everything the egg registry knows about. This
 * covers what it does not: places with no sign pointing at them, and the
 * combinations that only make sense once you have seen both halves. (The ritual
 * mode, the console handles and the command palette left with the site pages —
 * docs/handoff/game-only-shell.md.)
 *
 * Two kinds of entry, and the difference is load-bearing:
 *
 *   `eggId`    — discovery is proven by the egg registry. Nothing extra to
 *                track; the state already exists and is already persisted.
 *   `route`    — discovery is observed when the place opens in the world and
 *                written to its own key.
 *
 * A secret with neither is not listed. The Codex claims to know when you found
 * something and how, and an entry that cannot actually tell would be a lie in a
 * page whose entire premise is an honest record.
 */

export type SecretGroupId =
  | 'easter-eggs'
  | 'konami'
  | 'hidden-pages';

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
];

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
  /** Discovery proven by having opened the place that once stood at this URL (the panel's old route). */
  route?: string;
}

export const SECRETS: SecretDefinition[] = [
  // ── Konami ────────────────────────────────────────────────────────────────
  {
    id: 'konami-ritual',
    group: 'konami',
    name: 'The Old Sequence',
    reveal: 'The Konami code still works here. The realm remembers who knows it.',
    clue: 'Up. Up. Down. Down. You already know the rest — it has not changed since 1986.',
    tier: 'eclipsed',
    eggId: 'konami',
  },
  // ── Easter eggs (ambient game records, not retired tool triggers) ─────────
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
    reveal: 'Five different halls opened inside sixty seconds.',
    clue: 'Move fast enough through enough doors and something starts keeping count.',
    tier: 'eclipsed',
    eggId: 'speed-demon',
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
    reveal: 'The proving ground in Rootglass Canopy. Five gates, each a trial of a different realm.',
    clue: 'There is a room where Convergents prove their worth. Its doors are held by things you find somewhere else entirely.',
    tier: 'eclipsed',
    route: '/world/trials',
  },
];
