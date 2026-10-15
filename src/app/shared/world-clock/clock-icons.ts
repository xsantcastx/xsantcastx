/**
 * clock-icons.ts — 16 × 16 pixel icons for the world clock's three things
 * (eclipse.model.ts CLOCK_ITEMS), in the pixel-icons.ts convention: '.' clear,
 * 'o' the outline, every other char a palette slot (b body · l light · d shade ·
 * f fleck · e accent). pixel-icons.ts spreads them into its table. Light from
 * the upper left; colours from the moon (silver), the night (violet) and the
 * eclipse (deep violet with a gold rim) ramps.
 */
type Shape = readonly string[];
type Icon = { shape: Shape; palette: Readonly<Record<string, string>>; glow?: string };

/** A night flower, open: five pale petals round a lit heart, on a short stem. */
const BLOOM: Shape = [
  '................',
  '......oooo......',
  '.....ollllo.....',
  '..ooo.olbo.ooo..',
  '.ollloobboolllo.',
  '.olllbeeeebbbdo.',
  '..olbeefeebddo..',
  '..oobeeeeebboo..',
  '.olllbbeebblldo.',
  '.ollbdooooblldo.',
  '..oodo.dd.oddo..',
  '.......dd.......',
  '......oddo......',
  '.....oddddo.....',
  '......oooo......',
  '................',
];

/** A slim fish with a mirror stripe down its flank. */
const MIRRORFISH: Shape = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '...oollllllo..oo',
  '..olllffflllooto',
  '.oeolfffffbbbtto',
  '.ollffeeffbbbtto',
  '.olbbffffbbbbtto',
  '..obbbbbbbbdooto',
  '...oodddddddo.oo',
  '.....oooooo.....',
  '................',
  '................',
  '................',
  '................',
];

/** A shard of dark glass with a gold rim on its lit edge. */
const ECLIPSE_SHARD: Shape = [
  '................',
  '.......oo.......',
  '......oeeo......',
  '.....oellbo.....',
  '....oellbbbo....',
  '....oelbbfbdo...',
  '...oelbbbbbbdo..',
  '...oelbbffbbdo..',
  '...oeebbbbbddo..',
  '....oebbbbbddo..',
  '....oebbbbddo...',
  '.....oebbdddo...',
  '......oeddo.....',
  '.......odo......',
  '........o.......',
  '................',
];

export const CLOCK_ICONS: Readonly<Record<string, Icon>> = {
  'moonwake-bloom': { shape: BLOOM, palette: { l: '#d8dcf0', b: '#8a90b0', d: '#33263a', e: '#c9a0ff', f: '#ffffff' }, glow: '#c9a0ff' },
  'mirrorfin': { shape: MIRRORFISH, palette: { b: '#6a7890', l: '#d8dcf0', f: '#ffffff', e: '#140a1f', d: '#33263a', t: '#8a90b0' }, glow: '#d8ecff' },
  'eclipse-glass': { shape: ECLIPSE_SHARD, palette: { b: '#1a1220', l: '#4a3260', d: '#0e0912', e: '#E8D44D', f: '#a855f7' }, glow: '#E8D44D' },
};
