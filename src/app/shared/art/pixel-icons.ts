/**
 * pixel-icons.ts — procedural 16 × 16 pixel-art icons for the Fishing and
 * Liquids items, until the commissioned I1 icons land
 * (docs/art-commissions/fishing-liquids.md). Drawn the Terraria way the style
 * guide asks for (§4): a dark outline that is never black, a lit top-left, a
 * shadowed belly, a one-pixel shine. Each icon is an SVG of crisp rects in a
 * data URI (the CSP's img-src allows data:), built on first ask and cached, so
 * nothing ships as a file and SSR renders it too.
 *
 * `artFor()` falls back here only when an id has no painted art and no alias,
 * so the importer's real file takes over the moment it lands. Pure.
 */
import type { ArtEntry } from './art-manifest.generated';

/** A shape: 16 rows of 16 chars. '.' is clear; every other char is a palette slot. */
type Shape = readonly string[];
type Palette = Readonly<Record<string, string>>;

const OUTLINE = '#140a1f';

const FISH: Shape = [
  '................',
  '................',
  '................',
  '......ooo.......',
  '....oofffo......',
  '...obbbbbbo...oo',
  '..obbbbbbbbo.ott',
  '.obeobbbbbbbootto',
  '.obbbbbbbbbbbtto',
  '.oobllllllllotto',
  '..ollllllllloott',
  '...oollllloo..oo',
  '.....ooooo......',
  '................',
  '................',
  '................',
].map(row => row.slice(0, 16));

const EEL: Shape = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '...ooooooo......',
  '..obbbbbbbooooo.',
  '.obebbffbbbbbbto',
  '.obbbbbbbbbffbto',
  '.oollllllllllbto',
  '..ooooollllllloo',
  '.......oooooooo.',
  '................',
  '................',
  '................',
  '................',
];

const MINNOW: Shape = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......ooo.......',
  '....oobffo...oo.',
  '...obebbbbo.oto.',
  '...obbbbbbbootto',
  '...ollllllllotto',
  '....oollllloo.oo',
  '......ooooo.....',
  '................',
  '................',
  '................',
  '................',
];

const CRATE: Shape = [
  '................',
  '................',
  '.oooooooooooooo.',
  '.olllllllllllfo.',
  '.obbbbbbbbbbbbo.',
  '.offffffffffffo.',
  '.obbbbbbbbbbbbo.',
  '.obbbbbeebbbbbo.',
  '.obbbbbeebbbbbo.',
  '.obbbbbbbbbbbbo.',
  '.offffffffffffo.',
  '.obbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbo.',
  '.oddddddddddddo.',
  '.oooooooooooooo.',
  '................',
];

const ROD: Shape = [
  '.............ol.',
  '............obo.',
  '...........obo.e',
  '..........obo..e',
  '.........obo...e',
  '........obo....e',
  '.......obo.....e',
  '......obo......e',
  '.....obo.......e',
  '....ofo........e',
  '...offfo......oto',
  '..offfo.......oto',
  '.odoo..........o.',
  'odo.............',
  'oo..............',
  '................',
];

const BUCKET: Shape = [
  '................',
  '....oooooooo....',
  '...o........o...',
  '..o..........o..',
  '.ooooooooooooooo',
  '.offlllllllllffo',
  '.obbbbbbbbbbbbbo',
  '.obbbbbbbbbbbbbo',
  '..obbbbbbbbbbbo.',
  '..offffffffffffo',
  '..obbbbbbbbbbbo.',
  '...obbbbbbbbbo..',
  '...obbbbbbbbbo..',
  '...odddddddddo..',
  '....ooooooooo...',
  '................',
];

const GRUB: Shape = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....oooo.......',
  '...oolbblooo....',
  '..olbbobbbblo...',
  '.olbbfbbfbbbbo..',
  '.obbfbbfbbfbbbo.',
  '.obfbbfbbfbbbeo.',
  '..oddddddddddo..',
  '...oooooooooo...',
  '................',
  '................',
  '................',
];

const RIVET: Shape = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....olllllbo....',
  '...olllbbbbdo...',
  '...obbbbbbbdo...',
  '....oodddddo....',
  '......obbo......',
  '......obfo......',
  '......obfo......',
  '......obfo......',
  '......obdo......',
  '.......oo.......',
  '................',
  '................',
];

const PAGE: Shape = [
  '................',
  '..oooooooooo....',
  '..ollllllllloo..',
  '..olffffffllblo.',
  '..olllllllllbbo.',
  '..olfffffflllbo.',
  '..ollllllllllbo.',
  '..olffffflllllo.',
  '..ollllllllllbo.',
  '..olfffffffllbo.',
  '..ollllllllllbo.',
  '..oeeeeeeeeeeeo.',
  '..obbbbbbbbbbbo.',
  '..oddddddddddoo.',
  '..oooooooooooo..',
  '................',
];

const FLASK: Shape = [
  '................',
  '......oooo......',
  '......olfo......',
  '......oddo......',
  '.....oo..oo.....',
  '....ollllllo....',
  '...olbbbbbbbo...',
  '..olbbbbbbbbbo..',
  '..obbbbbbbbbbo..',
  '..obebbbbbbbbo..',
  '..obbbbbbbbbbo..',
  '..obbbbbbbbbdo..',
  '...odbbbbbbdo...',
  '....oddddddo....',
  '.....oooooo.....',
  '................',
];

const KNOT: Shape = [
  '................',
  '................',
  '.....oooooo.....',
  '...oolbbbbloo...',
  '..olbbooooblbo..',
  '..obbo....obbo..',
  '..obo..oo..obo..',
  '..obo.obbo.obo..',
  '..obbooobooobo..',
  '...obbbbbbbbo...',
  '....oobffboo....',
  '......obbo......',
  '......obbo......',
  '.......oo.......',
  '................',
  '................',
];

const REEL: Shape = [
  '................',
  '................',
  '.....oooooo.....',
  '...ooffffffoo...',
  '..ofbbbbbbbbfo..',
  '..ofbooooooofo..',
  '.ofbo.olllo.bfo.',
  '.ofbo.oleloobfo.',
  '.ofbo.olllo.bfo.',
  '..ofbooooooofo..',
  '..ofbbbbbbbbfo..',
  '...ooffffffoo...',
  '.....oodddo.....',
  '......odddo.....',
  '......ooooo.....',
  '................',
];

const BLOCK: Shape = [
  'oooooooooooooooo',
  'ollllllblllllllo',
  'olbbbbbfblbbbbbo',
  'olbbfbbbbbbbbbdo',
  'olbbbbbbbdbbbbdo',
  'obbbbbebbbbbfbdo',
  'oddddddoddddddo.',
  'obbbbbbblbbbbbbo',
  'olbbbfbbbbbbbbdo',
  'olbbbbbbbbbebbdo',
  'olbbbbdbbbbbbbdo',
  'obbbbbbbbbbbbbdo',
  'oddddddddoddddd.',
  'olbbbbbbbbbbbbbo',
  'odddddddddddddd.',
  'oooooooooooooooo',
].map(row => row.padEnd(16, 'o'));

/** Each icon: a shape and its palette (o outline · b body · l light · d shade · f fleck/stripe · e eye/accent · t tail). */
const ICONS: Readonly<Record<string, { shape: Shape; palette: Palette; glow?: string }>> = {
  // Fish (spec §5.3; lore addendum)
  'blindfin': { shape: FISH, palette: { b: '#8a7a92', l: '#c8bcd0', f: '#6a5a72', e: '#d8d0e0', t: '#6a5a72' } },
  'rootling-eel': { shape: EEL, palette: { b: '#6a4a2c', l: '#a6845a', f: '#7fb04a', e: '#ffd36d', t: '#4a2f18' } },
  'glowcap-minnow': { shape: MINNOW, palette: { b: '#2e6e9a', l: '#86d2e6', f: '#d0f6ff', e: '#140a1f', t: '#1e4a6a' }, glow: '#7fc8ff' },
  'mere-perch': { shape: FISH, palette: { b: '#4a7a58', l: '#a8c890', f: '#2e5a3a', e: '#140a1f', t: '#2e5a3a' } },
  'emberling': { shape: MINNOW, palette: { b: '#c4501e', l: '#ffd08a', f: '#ff9b4f', e: '#140a1f', t: '#7a2a12' }, glow: '#ff8a3d' },
  'slagjaw-eel': { shape: EEL, palette: { b: '#4a454e', l: '#6e6874', f: '#5ff0d8', e: '#ff9b4f', t: '#2e2a32' } },
  'the-kept-morning': { shape: FISH, palette: { b: '#e8b84a', l: '#fff4d0', f: '#ffd36d', e: '#140a1f', t: '#c98a2a' }, glow: '#ffe9a8' },
  'the-unpaid-debt': { shape: FISH, palette: { b: '#7a2a12', l: '#E8752A', f: '#ffd36d', e: '#ffd08a', t: '#4a1408' }, glow: '#ff6a3a' },
  // Junk and crates
  'rusted-rivet': { shape: RIVET, palette: { b: '#8a5a3a', l: '#c48a5a', d: '#5a3420', f: '#a86a40' } },
  'waterlogged-ledger-page': { shape: PAGE, palette: { l: '#c8c0a8', f: '#5a5a7a', b: '#9aa4a8', e: '#86d2e6', d: '#6a7478' } },
  'root-crate': { shape: CRATE, palette: { b: '#7a5a36', l: '#b08a55', f: '#4a3018', d: '#4a3018', e: '#7fb04a' } },
  'seam-crate': { shape: CRATE, palette: { b: '#4a454e', l: '#6e6874', f: '#ff9b4f', d: '#2e2a32', e: '#5ff0d8' } },
  // Bait, rods, buckets, charms, oil, the obsidian block
  'ember-grub': { shape: GRUB, palette: { b: '#e8956a', l: '#ffc8a0', f: '#c4501e', d: '#8a4a2a', e: '#140a1f' } },
  'worn-rod': { shape: ROD, palette: { b: '#8a6a4a', l: '#b89a70', f: '#5a4a3a', d: '#3a2a18', e: '#d8d0c0', t: '#a0a0a0' } },
  'root-rod': { shape: ROD, palette: { b: '#6a4a2c', l: '#a6845a', f: '#7fb04a', d: '#3a2614', e: '#d8d0c0', t: '#7fb04a' } },
  'seam-rod': { shape: ROD, palette: { b: '#5a545e', l: '#8c8494', f: '#ff9b4f', d: '#2e2a32', e: '#ffd08a', t: '#5ff0d8' } },
  'glowline-rod': { shape: ROD, palette: { b: '#244a5c', l: '#6fdcff', f: '#d0f6ff', d: '#163242', e: '#7fc8ff', t: '#ff5a8a' }, glow: '#7fc8ff' },
  'seam-bucket': { shape: BUCKET, palette: { b: '#5a545e', l: '#5a545e', f: '#8c8494', d: '#2e2a32' } },
  'seam-bucket-water': { shape: BUCKET, palette: { b: '#5a545e', l: '#86d2e6', f: '#8c8494', d: '#2e2a32' } },
  'seam-bucket-lava': { shape: BUCKET, palette: { b: '#5a545e', l: '#ffd08a', f: '#ff9b4f', d: '#2e2a32' }, glow: '#ff8a3d' },
  'lampfish-oil': { shape: FLASK, palette: { b: '#e8b84a', l: '#fff4d0', f: '#7a5a36', d: '#a8782a', e: '#ffffff' }, glow: '#ffe9a8' },
  'tackle-box': { shape: CRATE, palette: { b: '#2e5a3a', l: '#7fb04a', f: '#e8c47a', d: '#1a3a22', e: '#e8c47a' } },
  'anglers-patience': { shape: KNOT, palette: { b: '#6a4a2c', l: '#a6845a', f: '#7fb04a', d: '#3a2614' } },
  'lodge-reel': { shape: REEL, palette: { b: '#5a3f2a', l: '#d8b07a', f: '#8a6a40', d: '#2e1f14', e: '#7fb04a' } },
  'obsidian-block': { shape: BLOCK, palette: { b: '#30243f', l: '#62527f', d: '#181024', f: '#b49cff', e: '#a48bff' } },
};

/**
 * The Ledger Catch family: one fish shape each, its palette drawn from a fixed
 * ladder so twenty fish read as twenty, every one with the tally stripe.
 */
const LEDGER: Readonly<Record<string, readonly [string, string]>> = {
  'tallyfish': ['#7a6a5a', '#d8c8a8'], 'ledgerfin': ['#5a6a7a', '#c8d8e8'], 'carry-one-carp': ['#8a6a2a', '#e8c47a'],
  'overdue-dace': ['#6a5a7a', '#c8b8e0'], 'margin-loach': ['#4a6a5a', '#a8d8b8'], 'inkblot-gudgeon': ['#2e2a3a', '#7a7090'],
  'struck-through-shiner': ['#8a8a9a', '#e8e8f0'], 'balance-bream': ['#7a7040', '#d8d090'], 'receipt-eel': ['#b0a890', '#f4ead6'],
  'countback-chub': ['#6a4a3a', '#c89a7a'], 'unsigned-sprat': ['#9aa0a8', '#f0f4f8'], 'column-pike': ['#3a5a4a', '#8ac0a0'],
  'duplicate-darter': ['#5a4a6a', '#b8a0d0'], 'tally-perch': ['#4a6a3a', '#a8d080'], 'seal-wax-snapper': ['#8a2a2a', '#e8806a'],
  'quill-minnow': ['#3a4a6a', '#90a8d8'], 'errata-ray': ['#6a6a5a', '#d0d0b8'], 'rivet-ruffe': ['#6a5040', '#c8a080'],
  'waterline-loach': ['#2e5a6a', '#86c8d8'], 'closing-entry-carp': ['#7a3a5a', '#e0a0c0'],
};

function svgFor(shape: Shape, palette: Palette, glow?: string): string {
  const rects: string[] = [];
  if (glow) rects.push(`<rect x="1" y="1" width="14" height="14" rx="7" fill="${glow}" opacity=".22"/>`);
  for (let y = 0; y < 16; y++) {
    const row = shape[y] ?? '';
    let x = 0;
    while (x < 16) {
      const ch = row[x] ?? '.';
      if (ch === '.') { x++; continue; }
      let run = 1;
      while (x + run < 16 && row[x + run] === ch) run++;
      const fill = ch === 'o' ? OUTLINE : palette[ch] ?? palette['b'] ?? '#888';
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${fill}"/>`);
      x += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="64" height="64" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

const cache = new Map<string, ArtEntry | null>();

/** A procedural pixel icon for `id`, or null when there is none. */
export function pixelIcon(id: string): ArtEntry | null {
  let entry = cache.get(id);
  if (entry !== undefined) return entry;
  const icon = ICONS[id];
  const ledger = LEDGER[id];
  const svg = icon ? svgFor(icon.shape, icon.palette, icon.glow)
    : ledger ? svgFor(FISH, { b: ledger[0], l: ledger[1], f: '#140a1f', e: '#140a1f', t: ledger[0] })
    : null;
  entry = svg ? { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, srcset: '', width: 64, height: 64 } : null;
  cache.set(id, entry);
  return entry;
}

/** Every id that has a procedural icon (tests and the art brief read it). */
export const PIXEL_ICON_IDS: readonly string[] = [...Object.keys(ICONS), ...Object.keys(LEDGER)];
