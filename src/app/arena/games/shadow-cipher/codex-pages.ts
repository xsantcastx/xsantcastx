/**
 * codex-pages.ts — the ten pages of the Codex, in the order they were written.
 *
 * Kept out of the component so the puzzle content can be extended without
 * touching game logic. Each page grows by roughly one line, and the ordering
 * cues get weaker as you climb: page 1 is bracket-matching, page 10 needs you
 * to actually read the control flow.
 *
 * No page contains a blank line, and no page repeats a line. Both would create
 * an arrangement that looks right and fails the check — the puzzle has exactly
 * one solution and the player must be able to see that it does.
 */

export interface CodexPage {
  title: string;
  /** Shown as a syntax badge and used for the accent colour. */
  lang: 'css' | 'js' | 'html';
  /** The correct order. Indentation is part of the line. */
  lines: string[];
}

export const CODEX_PAGES: CodexPage[] = [
  {
    title: 'The First Sigil',
    lang: 'css',
    lines: [
      '.sigil {',
      '  color: #A78BFA;',
      '}',
    ],
  },
  {
    title: 'Gate of the Verge',
    lang: 'html',
    lines: [
      '<figure class="gate">',
      '  <img src="/verge.svg" alt="The Verge">',
      '  <figcaption>The Verge</figcaption>',
      '</figure>',
    ],
  },
  {
    title: 'Counting the Fragments',
    lang: 'js',
    lines: [
      'function countFragments(realms) {',
      '  const found = realms.filter(r => r.shattered);',
      '  return found.length;',
      '}',
    ],
  },
  {
    title: 'The Breathing Star',
    lang: 'css',
    lines: [
      '@keyframes starBreathe {',
      '  0%, 100% { opacity: 1; }',
      '  50% { opacity: 0.6; }',
      '}',
      '.star { animation: starBreathe 6s ease-in-out infinite; }',
    ],
  },
  {
    title: 'Weighing Aether against Nox',
    lang: 'js',
    lines: [
      'export function balance(aether, nox) {',
      '  const total = aether + nox;',
      '  if (total === 0) return 0.5;',
      '  return aether / total;',
      '}',
    ],
  },
  {
    title: 'The Convergent Roll',
    lang: 'html',
    lines: [
      '<section class="realms">',
      '  <h2>The Five Realms</h2>',
      '  <ul>',
      '    <li>Luminous</li>',
      '    <li>Nocturne</li>',
      '  </ul>',
      '</section>',
    ],
  },
  {
    title: 'Orbit of the Pulsar',
    lang: 'css',
    lines: [
      '.pulsar {',
      '  position: fixed;',
      '  inset: 50% auto auto 50%;',
      '  translate: -50% -50%;',
      '  filter: blur(40px);',
      '}',
    ],
  },
  {
    title: 'The Ledger of Ranks',
    lang: 'js',
    lines: [
      'const LEVELS = [0, 100, 300, 600, 1000];',
      'export function rankFor(xp) {',
      '  let rank = 1;',
      '  for (const min of LEVELS) {',
      '    if (xp >= min) rank++;',
      '  }',
      '  return rank;',
      '}',
    ],
  },
  {
    title: 'Opening the Godforge',
    lang: 'js',
    lines: [
      'async function openForge(key) {',
      '  if (!key) throw new Error("The forge is sealed");',
      '  const forge = await Forge.unlock(key);',
      '  try {',
      '    return await forge.strike();',
      '  } finally {',
      '    forge.cool();',
      '  }',
      '}',
    ],
  },
  {
    title: 'The Last Page',
    lang: 'js',
    lines: [
      'export class Eclipse {',
      '  #realms = new Map();',
      '  bind(name, realm) {',
      '    this.#realms.set(name, realm);',
      '    return this;',
      '  }',
      '  converge() {',
      '    return [...this.#realms.values()]',
      '      .every(realm => realm.balanced);',
      '  }',
      '}',
    ],
  },
];
