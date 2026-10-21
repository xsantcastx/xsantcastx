/**
 * spellstone-icons.ts — 16 × 16 pixel icons for the Basalt Blank and the four families of Spellstone
 * (spellstones.model.ts), in the pixel-icons.ts convention: '.' clear, 'o' the outline, every other char a palette
 * slot (b body · l light · d shade · e the cut cant · f its glow). pixel-icons.ts spreads them into its table.
 * Light from the upper left. A blank is bare basalt; a Spellstone is the same stone with its family's sigil cut in
 * and glowing: Ember gold-orange, Bone ivory-violet, Shadow violet, Common (Light, the Seek) lamp-gold.
 */
type Shape = readonly string[];
type Icon = { shape: Shape; palette: Readonly<Record<string, string>>; glow?: string };

/** A rounded basalt tablet, uncut. */
const BLANK: Shape = [
  '................',
  '................',
  '.....oooooo.....',
  '...oollllllo....',
  '..olllbbbbbdo...',
  '..olbbbbbbbbdo..',
  '.olbbbbbbbbbdo..',
  '.olbbbbbbbbbbdo.',
  '.olbbbbbbbbbbdo.',
  '.obbbbbbbbbbbdo.',
  '..obbbbbbbbbddo.',
  '..odbbbbbbbddo..',
  '...oddddddddo...',
  '....oooooooo....',
  '................',
  '................',
];

/** The same tablet with the cant cut into it (a rune-like mark, lit from within). */
const STONE: Shape = [
  '................',
  '................',
  '.....oooooo.....',
  '...oollllllo....',
  '..olllbbebbdo...',
  '..olbbbbeffbdo..',
  '.olbbebbefbbdo..',
  '.olbbbefeebbbdo.',
  '.olbbbbfebbbbdo.',
  '.obbbbbefbebbdo.',
  '..obbbbebbbbddo.',
  '..odbbbbbbbddo..',
  '...oddddddddo...',
  '....oooooooo....',
  '................',
  '................',
];

const BASALT = { b: '#3e3844', l: '#6a6274', d: '#24202a' } as const;

export const SPELLSTONE_ICONS: Readonly<Record<string, Icon>> = {
  'basalt-blank': { shape: BLANK, palette: { ...BASALT } },
  'spellstone-ember': { shape: STONE, palette: { ...BASALT, e: '#ff8a2e', f: '#ffd25a' }, glow: '#ff9a4a' },
  'spellstone-bone': { shape: STONE, palette: { ...BASALT, e: '#e8e1cf', f: '#b06bff' }, glow: '#e9d8ff' },
  'spellstone-shadow': { shape: STONE, palette: { ...BASALT, e: '#b06bff', f: '#e9d8ff' }, glow: '#b06bff' },
  'spellstone-common': { shape: STONE, palette: { ...BASALT, e: '#ffd27a', f: '#fffbe8' }, glow: '#ffd27a' },
};
