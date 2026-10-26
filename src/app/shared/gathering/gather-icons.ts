/**
 * gather-icons.ts — 16 × 16 pixel icons for the gathering skills' things (gathering.model.ts), in the pixel-icons.ts
 * convention: '.' clear, 'o' the outline, every other char a palette slot (b body · l light · d shade · f fleck ·
 * e accent · t tail). pixel-icons.ts spreads them into its table. Light from the upper left.
 */
type Shape = readonly string[];
type Icon = { shape: Shape; palette: Readonly<Record<string, string>>; glow?: string };

/** A plump fish, head left, belly lit. */
const FISH: Shape = [
  '................',
  '................',
  '................',
  '......oooo......',
  '....ooffffo.....',
  '...obbbbbbbo..oo',
  '..obbbbbbbbbo.ot',
  '.obeobbbbbbbbott',
  '.obbbbbbbbbbbtto',
  '.oobllllllllottt',
  '..olllllllllo.ot',
  '...ooollllloo..o',
  '......ooooo.....',
  '................',
  '................',
  '................',
];
/** A long thin eel. */
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
/** A cut log, its ringed end toward the viewer. */
const LOG: Shape = [
  '................',
  '................',
  '................',
  '....oooooooooo..',
  '...obbbbbbbbbooo',
  '..obbbbbbbbbolfo',
  '.obbbbbbbbbolffl',
  '.oddddddddoleffl',
  '.oddddddddolfffl',
  '.oddddddddoolfl.',
  '..oooooooooooo..',
  '................',
  '................',
  '................',
  '................',
  '................',
];
/** A cooked fish on a wooden board, steam over it. */
const MEAL: Shape = [
  '................',
  '.......e..e.....',
  '......e..e......',
  '.......e..e.....',
  '....ooooooo.....',
  '...obbbbbbbo.oo.',
  '..obfbbfbbbbobo.',
  '..obbbbbbbbbbbo.',
  '...olllllllooo..',
  '....ooooooo.....',
  '.oooooooooooooo.',
  'odddddddddddddddo'.slice(0, 16),
  '.oooooooooooooo.',
  '................',
  '................',
  '................',
];
/** Flint and a curved fire-steel in a small tin. */
const TINDER: Shape = [
  '................',
  '................',
  '................',
  '................',
  '..oooooooooooo..',
  '.obbbbbbbbbbbbo.',
  '.olllllllllllbo.',
  '.oooooooooooooo.',
  '.obbbbbbbbbbbbo.',
  '.obeebffffbddbo.',
  '.obeebffffbddbo.',
  '.obbbbbbbbbbbbo.',
  '..oooooooooooo..',
  '................',
  '................',
  '................',
];

const RAW = (b: string, l: string, f: string, t: string): Icon => ({ shape: FISH, palette: { b, l, f, e: '#140a1f', t } });
const LOGP = (b: string, d: string, l: string, f: string, e: string, glow?: string): Icon => ({ shape: LOG, palette: { b, d, l, f, e }, ...(glow ? { glow } : {}) });
const MEALP = (b: string, f: string, glow?: string): Icon => ({ shape: MEAL, palette: { b, f, l: '#8a5a32', d: '#6a4424', e: '#e8e4ef' }, ...(glow ? { glow } : {}) });

export const GATHER_ICONS: Readonly<Record<string, Icon>> = {
  // Logs by land: ash-grey, charred oak, the rootglass bough's green heart, the dark cypress.
  'ashwood-log': LOGP('#8a8288', '#5a545e', '#c8bcb4', '#a89a8a', '#6a5a4a'),
  'char-oak-log': LOGP('#3a2a24', '#22181a', '#c8a070', '#a07850', '#c4501e'),
  'rootglass-bough': LOGP('#5a4a2c', '#3a2e18', '#c8ffe0', '#7fd5a3', '#2a4a2a', '#7fd5a3'),
  'cypress-log': LOGP('#3a3a2e', '#24241c', '#a8a080', '#7a7458', '#4a6a3a'),
  // Raw fish (world-acts §4.2): the lake's grey perch, the warm lampfish, the pale moonbelly, the slow carp.
  'ash-perch': RAW('#7a7480', '#b8b0bc', '#5a545e', '#5a545e'),
  'mire-carp': RAW('#5a5a3a', '#9a9a6a', '#3a3a24', '#3a3a24'),
  'lampfish': { shape: FISH, palette: { b: '#3a3048', l: '#6a5a80', f: '#ffd36d', e: '#ffd36d', t: '#2a2238' }, glow: '#ffd36d' },
  'moonbelly': { shape: FISH, palette: { b: '#c8d0e8', l: '#ffffff', f: '#a8b8ff', e: '#140a1f', t: '#8a94c8' }, glow: '#d8e0ff' },
  // Hearth meals: the same board, the fish's own colour baked through.
  'baked-ash-perch': MEALP('#b08a5a', '#7a5432'),
  'seared-mirrorfin': MEALP('#c8b8a0', '#8a7a68'),
  'smoked-rootling-eel': { shape: EEL, palette: { b: '#7a4a24', l: '#b8844a', f: '#4a2a14', e: '#e8e4ef', t: '#4a2a14' } },
  'mire-carp-supper': MEALP('#8a7a4a', '#5a4a24'),
  'lampfish-fry': MEALP('#c89a4a', '#ffd36d', '#ffd36d'),
  'moonbelly-fillet': MEALP('#e8e0f0', '#a8b8ff', '#d8e0ff'),
  'burnt-fish': { shape: FISH, palette: { b: '#2a2024', l: '#3a3034', f: '#1a1418', e: '#c4501e', t: '#1a1418' } },
  'tinderbox': { shape: TINDER, palette: { b: '#6a6470', l: '#a8a2b0', e: '#c8bcb4', f: '#3a3440', d: '#c4501e' } },
};
