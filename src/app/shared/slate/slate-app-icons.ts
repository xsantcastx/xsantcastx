/**
 * slate-app-icons.ts — the Mirror Slate's phone face: 16 × 16 pixel app icons
 * and sky icons (docs/handoff/world-clock.md), drawn the pixel-icons.ts way
 * ('.' clear, 'o' the outline, every other char a palette slot; light from the
 * upper left; a dark outline that is never black). Each is an SVG of crisp
 * rects in a data URI (the CSP allows data: images), built on first ask and
 * cached. Pure; SSR renders them too.
 */
type Shape = readonly string[];
type Palette = Readonly<Record<string, string>>;
const OUTLINE = '#140a1f';

/** About: a round "i" on the glass. */
const ABOUT: Shape = [
  '................',
  '....oooooooo....',
  '...ollllllllo...',
  '..ollllbbllllo..',
  '..ollllbbllllo..',
  '..ollllllllllo..',
  '..ollllbbllllo..',
  '..ollllbbllllo..',
  '..ollllbbllllo..',
  '..ollllbbllllo..',
  '..ollllbbllllo..',
  '...ollllllllo...',
  '....oooooooo....',
  '................',
  '................',
  '................',
];

/** Lune's tables: a reel window with three symbols and a lever. */
const TABLES: Shape = [
  '................',
  '..oooooooooooo..',
  '.oddddddddddddo.',
  '.odoooooooooodo.',
  '.odollollollodo.',
  '.odoeeoffobbodo.',
  '.odollollollodo.',
  '.odoooooooooodo.',
  '.oddddddddddddo.',
  '.odlllllllllldo.',
  '.odlbbbbbbbbldo.',
  '.oddddddddddddo.',
  '..oooooooooooo..',
  '................',
  '................',
  '................',
];

/** Rune Drop: a rune falling through a field of pins into a lit bin. */
const RUNE_DROP: Shape = [
  '................',
  '.......oo.......',
  '......oeeo......',
  '.....oeffeo.....',
  '......oeeo......',
  '.......oo.......',
  '..l...l...l...l.',
  '................',
  '....l...l...l...',
  '................',
  '..l...l...l...l.',
  '................',
  '.oooooooooooooo.',
  '.obbodddobbbodo.',
  '.oooooooooooooo.',
  '................',
];

/** Seam Sweeper: a seam of cells, one opened on ore, one flagged. */
const SWEEPER: Shape = [
  '................',
  '.oooooooooooooo.',
  '.olldolldolldo..',
  '.olddoldd.oddo..',
  '.oooooooooooooo.',
  '.oeeeoffdolldo..',
  '.oefeoffdoddoo..',
  '.oooooooooooooo.',
  '.olldobbboeedo..',
  '.oddoobbboedd...',
  '.oooooooooooooo.',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** Eclipse Ascent: a chevron climbing past the eclipse. */
const ASCENT: Shape = [
  '..........ffff..',
  '.........fooodf.',
  '.........fodbof.',
  '.........foodof.',
  '..........ffff..',
  '.......oo.......',
  '......olloo.....',
  '.....olleelo....',
  '....olle..elo...',
  '...olle....elo..',
  '..olle......elo.',
  '..ooo........oo.',
  '................',
  '..eeeeeeeeeeee..',
  '................',
  '................',
];

/** The Homestead: a round-roofed little house with a lit window and a chimney. */
const HOME: Shape = [
  '................',
  '..........oo....',
  '......oooodoo...',
  '.....olllldo....',
  '....olllllldo...',
  '...olllllllldo..',
  '..oddddddddddoo.',
  '...obbbbbbbbbo..',
  '...obeebbffbbo..',
  '...obeebbffbbo..',
  '...obbbbbffbbo..',
  '...obbbbbffbbo..',
  '...oooooooooooo.',
  '................',
  '................',
  '................',
];

/** Map & bounties: a folded map with a red pin. */
const MAP: Shape = [
  '................',
  '..........oo....',
  '.........oeeo...',
  '.ooooooooeeeeo..',
  '.olllldd.oeeo...',
  '.ollffddll.ooo..',
  '.olllddllllddo..',
  '.olllddlllfddo..',
  '.ollfddllllddo..',
  '.olllddlllfddo..',
  '.olllddlllfddo..',
  '.oooooooooooooo.',
  '................',
  '................',
  '................',
  '................',
];

/** The Scan: a pane of moon glass with rings of warmth. */
const SCAN: Shape = [
  '................',
  '...ffffffffff...',
  '..f..........f..',
  '.f..oooooooo..f.',
  '.f..olleeeedo.f.',
  '.f..oleeeeedo.f.',
  '.f..oeeeeeedo.f.',
  '.f..oeeeeeedo.f.',
  '.f..oeeeeeedo.f.',
  '.f..oeeeeeedo.f.',
  '.f..oddddddoo.f.',
  '.f..oooooooo..f.',
  '..f..........f..',
  '...ffffffffff...',
  '................',
  '................',
];

/** Pets: a round paw. */
const PETS: Shape = [
  '................',
  '...oo......oo...',
  '..olbo....olbo..',
  '..obbo....obbo..',
  '...oo.oooo.oo...',
  '.oo..olllbo..oo.',
  'olbo.olbbbo.olbo',
  'obbo..obbo..obbo',
  '.oo..oooooo..oo.',
  '....olllbbbo....',
  '...olbbbbbbbo...',
  '...obbbbbbbdo...',
  '...odbbbbbddo...',
  '....oddddddo....',
  '.....oooooo.....',
  '................',
];

/** The Codex: a thick book with a clasp. */
const CODEX: Shape = [
  '................',
  '...oooooooooo...',
  '..olllllllllfo..',
  '..olbbbbbbbbfo..',
  '..olbeeeeeebfo..',
  '..olbbbbbbbbfo..',
  '..olbeeeeebbfoo.',
  '..olbbbbbbbbfoeo',
  '..olbeeeeeebfoeo',
  '..olbbbbbbbbfoo.',
  '..olbbbbbbbbfo..',
  '..oddddddddddo..',
  '..offfffffffffo.',
  '...ooooooooooo..',
  '................',
  '................',
];

/** The eclipse (and Sera's ledger): a dark disc in a gold ring with four spikes. */
const ECLIPSE: Shape = [
  '.......e........',
  '.......e........',
  '.....ffffff.....',
  '....fooooooof...',
  '...foddddddof...',
  '...fodbbbbbdof..',
  'ee.fodbbbbbdof.e',
  '...fodbbbbbdof..',
  '...fodbbbbbdof..',
  '...foddddddof...',
  '....fooooooof...',
  '.....ffffff.....',
  '.......e........',
  '.......e........',
  '................',
  '................',
];

/** Music: a pair of notes. */
const MUSIC: Shape = [
  '................',
  '......oooooooo..',
  '......olllllllo.',
  '......odooooodo.',
  '......odo...odo.',
  '......odo...odo.',
  '......odo...odo.',
  '......odo...odo.',
  '...ooodo..ooodo.',
  '..olllo..olllo..',
  '..obbbo..obbbo..',
  '..oddo...oddo...',
  '...oo.....oo....',
  '................',
  '................',
  '................',
];

/** The day: a round sun with rays. */
const SUN: Shape = [
  '.......e........',
  '..e....e....e...',
  '...e.......e....',
  '.....oooooo.....',
  '....olllllbo....',
  '....olllbbbo....',
  'ee..olbbbbbo..ee',
  '....olbbbbdo....',
  '....obbbbddo....',
  '.....oooooo.....',
  '...e.......e....',
  '..e....e....e...',
  '.......e........',
  '................',
  '................',
  '................',
];

/** Dawn and dusk: half a sun on the horizon. */
const HORIZON: Shape = [
  '................',
  '................',
  '.......e........',
  '..e....e....e...',
  '...e.......e....',
  '.....oooooo.....',
  '....olllllbo....',
  'ee..olllbbbo..ee',
  '....olbbbbbo....',
  'dddddddddddddddd',
  'ffffffffffffffff',
  '.dddddd..dddddd.',
  '....ffff..ffff..',
  '................',
  '................',
  '................',
];

/** Night: the moon mirror, cracked, and a star. */
const MOON: Shape = [
  '............e...',
  '...........eee..',
  '.....ooooo..e...',
  '....ollllbo.....',
  '...olllfbbbo....',
  '...ollllfbbo....',
  '...olllllfbo....',
  '...olbbbbbfo....',
  '...obbbbbddo....',
  '....obbbddo.....',
  '.....ooooo......',
  '..e.............',
  '.eee............',
  '..e.............',
  '................',
  '................',
];

const ICONS: Readonly<Record<string, { shape: Shape; palette: Palette }>> = {
  reels: { shape: TABLES, palette: { d: '#8a6a3a', l: '#fff4dc', e: '#E8752A', f: '#a855f7', b: '#E8D44D' } },
  'rune-drop': { shape: RUNE_DROP, palette: { e: '#a855f7', f: '#c9a0ff', l: '#d8dcf0', b: '#E8D44D', d: '#5a2f8a' } },
  'seam-sweeper': { shape: SWEEPER, palette: { l: '#8a7a58', d: '#4a4030', e: '#c4501e', f: '#E8D44D', b: '#5ff0d8' } },
  'eclipse-ascent': { shape: ASCENT, palette: { l: '#fff4dc', e: '#E8752A', f: '#E8D44D', d: '#33263a', b: '#0e0912' } },
  factory: { shape: HOME, palette: { l: '#c4501e', d: '#7a2a12', b: '#b08a55', e: '#ffd08a', f: '#5a3f2a' } },
  map: { shape: MAP, palette: { l: '#efe4c8', d: '#c9b88e', f: '#8a7a58', e: '#c4501e' } },
  scan: { shape: SCAN, palette: { l: '#ffffff', e: '#33263a', d: '#a5793a', f: '#8a90b0' } },
  pets: { shape: PETS, palette: { l: '#ffe7a0', b: '#e0b060', d: '#c08a3e' } },
  codex: { shape: CODEX, palette: { l: '#c9a0ff', b: '#5a2f8a', e: '#d8dcf0', f: '#E8D44D', d: '#33263a' } },
  eclipse: { shape: ECLIPSE, palette: { b: '#0e0912', d: '#33263a', f: '#E8D44D', e: '#fff4dc' } },
  about: { shape: ABOUT, palette: { l: '#d8dcf0', b: '#5a2f8a' } },
  music: { shape: MUSIC, palette: { l: '#d8dcf0', d: '#8a90b0', b: '#a855f7' } },
  'sky-day': { shape: SUN, palette: { l: '#fff4dc', b: '#ffd08a', d: '#E8752A', e: '#E8D44D' } },
  'sky-dawn': { shape: HORIZON, palette: { l: '#fff4dc', b: '#ffd08a', e: '#ffe7a0', d: '#7b4fc0', f: '#4a3260' } },
  'sky-dusk': { shape: HORIZON, palette: { l: '#ffd08a', b: '#E8752A', e: '#c4501e', d: '#4a3260', f: '#1a1220' } },
  'sky-night': { shape: MOON, palette: { l: '#f4f4ff', b: '#d8dcf0', d: '#8a90b0', f: '#8a90b0', e: '#e8ecff' } },
  'sky-eclipse': { shape: ECLIPSE, palette: { b: '#0e0912', d: '#33263a', f: '#E8D44D', e: '#fff4dc' } },
};

function svgFor(shape: Shape, palette: Palette): string {
  const rects: string[] = [];
  for (let y = 0; y < 16; y++) {
    const row = shape[y] ?? '';
    let x = 0;
    while (x < 16) {
      const ch = row[x] ?? '.';
      if (ch === '.') { x++; continue; }
      let run = 1;
      while (x + run < 16 && row[x + run] === ch) run++;
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${ch === 'o' ? OUTLINE : palette[ch] ?? '#888'}"/>`);
      x += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="64" height="64" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

const cache = new Map<string, string>();
/** The data-URI of a Slate app or sky icon ('' for an unknown id). */
export function slateIcon(id: string): string {
  let uri = cache.get(id);
  if (uri !== undefined) return uri;
  const icon = ICONS[id];
  uri = icon ? `data:image/svg+xml,${encodeURIComponent(svgFor(icon.shape, icon.palette))}` : '';
  cache.set(id, uri);
  return uri;
}
export const SLATE_ICON_IDS: readonly string[] = Object.keys(ICONS);
