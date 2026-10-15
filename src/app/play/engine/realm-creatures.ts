/**
 * realm-creatures.ts — the Root Deeps', the Prism Mines' and the Orrery Wells' creatures as pixel
 * sprites (creature-pixel.ts draws, caches and outlines them; one art style,
 * docs/handoff/one-art-style.md). Chibi proportions, like the Keepers are
 * becoming: big heads, big eyes, small bodies, so a monster reads as a
 * creature of its realm before it reads as a threat.
 *
 * Colours only from the realm ramps of the art bible (docs/art/style-guide.md
 * §5): the Verdant's root brown, moss and bioluminescent sap; the Luminous's
 * ivory, gold and dawn. Light from the upper left. Feet on the bottom row.
 */
import type { CreatureArt, CreaturePose } from './creature-pixel';

const ROOT = ['#24190f', '#3a2a1c', '#7a5a36', '#b08a55'];
const MOSS = ['#1e2a14', '#3a5a2a', '#4a7a3a', '#7fb85a'];
const SAP = ['#2a8a6a', '#7fd5a3', '#c4ffe0'];
const AMBER = ['#6a4010', '#c08a3e', '#e0b060'];
const HEART = ['#5a2418', '#9a4a2a', '#ff9a7a'];
const STONE = ['#4a4030', '#8a7a58', '#c9b88e', '#efe4c8'];
const GOLD = ['#7a5a14', '#b8901e', '#E8D44D'];
const DAWN = ['#ffe7a0', '#fff1b0', '#fffaf0'];
const SKY = ['#5fb6ff', '#a8e8ff'];
const INK = '#120a1e';

const shift = (q: CreaturePose) => ({ X: Math.round(q.lunge * 3 - q.coil * 2 - (q.hurt ? 2 : 0)), Y: q.bob + q.coil });
/** Big chibi eyes: a white, a dark pupil looking forward, a glint. Shut to a line when hurt. */
function eyes(p: (x: number, y: number, w: number, h: number, c: string) => void, x: number, y: number, gap: number, size: number, hurt: boolean, iris = INK): void {
  for (const ex of [x, x + gap]) {
    if (hurt) { p(ex, y + Math.floor(size / 2), size, 1, INK); continue; }
    p(ex, y, size, size, '#fffaf0');
    p(ex + Math.floor(size / 2), y + 1, Math.ceil(size / 2), size - 1, iris);
    p(ex + Math.floor(size / 2), y + 1, 1, 1, '#ffffff');
  }
}

/** The Graftling: a root-bulb sprout with two leaf ears, big eyes and little root feet. */
const GRAFTLING: CreatureArt = {
  w: 24, h: 22,
  paint(p, l, q) {
    const { X, Y } = shift(q);
    // Root feet that step.
    const up = q.step ? 1 : 0;
    p(7 + X, 19, 3, 3 - (q.step > 0 ? up : 0), ROOT[1]); p(14 + X, 19, 3, 3 - (q.step < 0 ? up : 0), ROOT[1]);
    p(6 + X, 21, 2, 1, ROOT[0]); p(16 + X, 21, 2, 1, ROOT[0]);
    // The bulb: round, lit from the upper left, a sap seam down the belly.
    p(5 + X, 9 + Y, 14, 11, ROOT[2]); p(6 + X, 8 + Y, 12, 1, ROOT[2]); p(6 + X, 20 + Y - 1, 12, 1, ROOT[1]);
    p(5 + X, 9 + Y, 2, 9, ROOT[3]); p(7 + X, 8 + Y, 6, 1, ROOT[3]);
    p(16 + X, 10 + Y, 3, 9, ROOT[1]);
    p(11 + X, 15 + Y, 2, 4, SAP[1]); p(11 + X, 16 + Y, 1, 1, SAP[2]);
    // Leaf ears, bending with the breath.
    l(8 + X, 8 + Y, 3 + X - q.bob, 2 + Y, 2, MOSS[2]); l(15 + X, 8 + Y, 21 + X + q.bob, 3 + Y, 2, MOSS[2]);
    p(3 + X - q.bob, 2 + Y, 2, 2, MOSS[3]); p(20 + X + q.bob, 3 + Y, 2, 2, MOSS[3]);
    // Face: two big eyes, a little mouth that opens on the strike.
    eyes(p, 7 + X, 10 + Y, 6, 4, q.hurt);
    if (q.open > .5) p(10 + X, 15 + Y, 4, 2, INK); else p(11 + X, 15 + Y, 2, 1, ROOT[0]);
  },
};

/** The Graftmother: a matron of living wood, a bark skirt, root arms, a leaf crown and a glowing sap heart. */
const GRAFTMOTHER: CreatureArt = {
  w: 56, h: 56,
  paint(p, l, q) {
    const { X, Y } = shift(q);
    // The bark skirt, rooted: it does not walk so much as shift.
    for (let k = 0; k < 7; k++) {
      const x = 10 + k * 5 + X, top = 34 + Y + (k % 2);
      p(x, top, 5, 56 - top, k % 2 ? ROOT[1] : ROOT[2]);
      p(x, top, 1, 56 - top, ROOT[3]);
    }
    p(8 + X, 53, 40, 3, ROOT[0]);
    for (const [x, d] of [[6, -1], [46, 1]] as const) l(x + 4 + X, 50, x + 4 + X + d * 4, 55, 2, ROOT[1]);
    // The body: a trunk narrowing to the shoulders.
    p(16 + X, 20 + Y, 24, 16, ROOT[2]); p(16 + X, 20 + Y, 3, 16, ROOT[3]); p(36 + X, 21 + Y, 4, 15, ROOT[1]);
    // The sap heart, brighter as she winds up.
    const glow = q.coil ? SAP[2] : SAP[1];
    p(25 + X, 25 + Y, 6, 6, SAP[0]); p(26 + X, 26 + Y, 4, 4, glow); p(26 + X, 26 + Y, 1, 1, '#ffffff');
    // Root arms: reaching out on the strike.
    const reach = Math.round(q.lunge * 6 + q.coil * -3);
    l(18 + X, 23 + Y, 6 + X - reach, 33 + Y, 3, ROOT[1]); l(6 + X - reach, 33 + Y, 3 + X - reach, 38 + Y, 2, ROOT[1]);
    l(38 + X, 23 + Y, 50 + X + reach, 32 + Y, 3, ROOT[2]); l(50 + X + reach, 32 + Y, 54 + X + reach, 37 + Y, 2, ROOT[2]);
    // The head: big and round, bark-lined, a kind face (that is the frightening part).
    p(15 + X, 4 + Y, 26, 17, ROOT[2]); p(17 + X, 3 + Y, 22, 1, ROOT[2]); p(17 + X, 21 + Y, 22, 1, ROOT[1]);
    p(15 + X, 5 + Y, 3, 14, ROOT[3]); p(38 + X, 5 + Y, 3, 15, ROOT[1]);
    p(18 + X, 7 + Y, 20, 12, AMBER[1]); p(18 + X, 7 + Y, 20, 1, AMBER[2]);
    eyes(p, 20 + X, 10 + Y, 10, 5, q.hurt, MOSS[1]);
    if (q.open > .5) p(25 + X, 16 + Y, 6, 2, INK); else p(26 + X, 17 + Y, 4, 1, ROOT[0]);
    p(19 + X, 15 + Y, 2, 1, HEART[2]); p(35 + X, 15 + Y, 2, 1, HEART[2]);
    // The leaf crown.
    for (let k = 0; k < 6; k++) {
      const x = 14 + k * 5 + X, h = 3 + (k % 3);
      p(x, 3 + Y - h, 4, h + 1, k % 2 ? MOSS[2] : MOSS[3]); p(x + 1, 2 + Y - h, 2, 1, MOSS[3]);
    }
  },
};

/** The Prismling: a faceted crystal blob, gold-rimmed, big eyes, a spark inside. */
const PRISMLING: CreatureArt = {
  w: 22, h: 20,
  paint(p, _l, q) {
    const { X, Y } = shift(q);
    const hop = q.step ? 1 : 0;
    // Little crystal feet.
    p(6 + X, 18 - hop, 3, 2, STONE[1]); p(13 + X, 18 - hop, 3, 2, STONE[1]);
    // The gem body: a rounded diamond, facets in ivory, gold and a sky glint.
    const top = 3 + Y - hop;
    for (let row = 0; row < 15; row++) {
      const half = row < 6 ? 3 + row : 9 - Math.max(0, row - 10);
      p(11 - half + X, top + row, half * 2, 1, row < 4 ? DAWN[1] : row < 10 ? STONE[2] : STONE[1]);
    }
    p(4 + X, top + 6, 2, 4, DAWN[2]); p(16 + X, top + 6, 2, 5, GOLD[1]);
    p(10 + X, top, 2, 15, GOLD[0]);
    p(7 + X, top + 2, 1, 1, '#ffffff'); p(14 + X, top + 12, 2, 1, SKY[1]);
    eyes(p, 6 + X, top + 6, 6, 3, q.hurt);
    if (q.open > .5) p(9 + X, top + 11, 4, 1, INK);
  },
};

/** The Hollow Sun: a ring of light with rays, a dark hollow at its heart and two eyes in it, on a crystal stem. */
const HOLLOW_SUN: CreatureArt = {
  w: 52, h: 52,
  paint(p, l, q) {
    const { X, Y } = shift(q);
    const cx = 26 + X, cy = 20 + Y;
    // The crystal stem it stands on.
    p(22 + X, 38, 8, 14, STONE[1]); p(22 + X, 38, 2, 14, STONE[3]); p(28 + X, 38, 2, 14, STONE[0]);
    p(17 + X, 49, 18, 3, STONE[0]);
    // Rays: eight, longer when it flares (the strike).
    const ray = 5 + Math.round(q.lunge * 4 + q.coil * 2);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + (q.bob ? Math.PI / 8 : 0);
      const x0 = cx + Math.round(Math.cos(a) * 15), y0 = cy + Math.round(Math.sin(a) * 15);
      const x1 = cx + Math.round(Math.cos(a) * (15 + ray)), y1 = cy + Math.round(Math.sin(a) * (15 + ray));
      l(x0, y0, x1, y1, 2, k % 2 ? GOLD[2] : DAWN[1]);
    }
    // The ring: gold, lit upper left, hollow in the middle.
    for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) {
      const d = x * x + y * y;
      if (d > 196 || d < 72) continue;
      p(cx + x, cy + y, 1, 1, x + y < -8 ? DAWN[2] : x + y < 4 ? GOLD[2] : GOLD[1]);
    }
    // The hollow: dark, and in it two eyes that look like they are waiting.
    for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) if (x * x + y * y < 72) p(cx + x, cy + y, 1, 1, '#1e1a12');
    eyes(p, cx - 6, cy - 3, 8, 4, q.hurt, GOLD[1]);
    if (q.open > .5) p(cx - 2, cy + 4, 4, 2, DAWN[0]);
  },
};

// ── The Orrery Wells (the Celestial ramps, delve-and-beyond.md: midnight, star silver, orbit blue, brass) ──
const MIDNIGHT = ['#0a1428', '#14284a', '#24406e', '#3a5a8a'];
const SILVER = ['#6a7890', '#a8b8cc', '#d8ecff'];
const ORBIT = '#5fb6ff';
const BRASS = ['#4a3a1e', '#8a6a3a', '#e8c47a'];

/** The Anchor Warden: a round brass survey-bot on stubby legs, a glass visor of two big eyes, a ring orbiting its middle. */
const ANCHOR_WARDEN: CreatureArt = {
  w: 26, h: 24,
  paint(p, l, q) {
    const { X, Y } = shift(q);
    // Stubby legs that tick like a clock.
    const up = q.step ? 1 : 0;
    p(8 + X, 20, 3, 4 - (q.step > 0 ? up : 0), BRASS[0]); p(15 + X, 20, 3, 4 - (q.step < 0 ? up : 0), BRASS[0]);
    p(7 + X, 23, 4, 1, BRASS[1]); p(15 + X, 23, 4, 1, BRASS[1]);
    // The body: a brass ball, lit from the upper left, a seam round its belly.
    const top = 5 + Y;
    for (let row = 0; row < 16; row++) {
      const half = row < 4 ? 4 + row * 2 : row > 12 ? 10 - (row - 12) * 2 : 10;
      p(13 - half + X, top + row, half * 2, 1, row < 5 ? BRASS[2] : row < 11 ? BRASS[1] : BRASS[0]);
    }
    p(5 + X, top + 4, 2, 6, BRASS[2]);
    p(4 + X, top + 11, 18, 1, BRASS[0]);
    // The visor: two big glass eyes; they glare blue on the wind-up.
    eyes(p, 7 + X, top + 4, 7, 4, q.hurt, q.coil ? ORBIT : MIDNIGHT[1]);
    if (q.open > .5) p(11 + X, top + 10, 4, 1, MIDNIGHT[0]);
    // The ring it was told to keep turning: tilted, round its middle, swinging further on the strike.
    const swing = Math.round(q.lunge * 3);
    l(0 + X - swing, top + 14 + q.bob, 26 + X + swing, top + 11 - q.bob, 1, SILVER[1]);
    p(0 + X - swing, top + 13 + q.bob, 2, 2, SILVER[2]); p(24 + X + swing, top + 10 - q.bob, 2, 2, ORBIT);
    // The antenna with its little star.
    p(12 + X, top - 4, 1, 4, BRASS[1]); p(11 + X, top - 6, 3, 2, SILVER[2]);
  },
};

/** The Fallen Ephemeris: a great brass astrolabe face with a kind, stubborn pair of eyes, a crown of little orbits, a star-chart cloak. */
const FALLEN_EPHEMERIS: CreatureArt = {
  w: 56, h: 52,
  paint(p, l, q) {
    const { X, Y } = shift(q);
    const cx = 28 + X, cy = 20 + Y;
    // The star-chart cloak: midnight, silver stars on it, hemmed in brass. It floats; there are no feet.
    for (let row = 0; row < 18; row++) {
      const half = 10 + Math.floor(row * .7);
      p(cx - half, 32 + Y + row, half * 2, 1, row < 3 ? MIDNIGHT[3] : row < 10 ? MIDNIGHT[2] : MIDNIGHT[1]);
    }
    p(cx - 22, 49 + Y, 44, 1, BRASS[1]);
    for (const [sx, sy] of [[-12, 37], [6, 40], [-4, 45], [14, 46], [-17, 44], [10, 35]] as const) p(cx + sx, sy + Y, 1, 1, SILVER[2]);
    // Arms: two brass dividers (the surveyor's compass), opening on the strike.
    const open = Math.round(q.lunge * 6 - q.coil * 2);
    l(cx - 10, 34 + Y, cx - 20 - open, 44 + Y, 2, BRASS[1]); l(cx + 10, 34 + Y, cx + 20 + open, 44 + Y, 2, BRASS[1]);
    p(cx - 21 - open, 44 + Y, 2, 3, SILVER[1]); p(cx + 19 + open, 44 + Y, 2, 3, SILVER[1]);
    // The astrolabe face: a brass rim, a midnight dial, lit from the upper left.
    for (let y = -15; y <= 15; y++) for (let x = -15; x <= 15; x++) {
      const d = x * x + y * y;
      if (d > 225) continue;
      p(cx + x, cy + y, 1, 1, d > 169 ? (x + y < -6 ? BRASS[2] : BRASS[1]) : d > 144 ? BRASS[0] : (x + y < -10 ? MIDNIGHT[3] : MIDNIGHT[2]));
    }
    // The dial's meridian, and its hand pointing at a star that is not there.
    p(cx, cy - 12, 1, 24, SILVER[0]);
    l(cx, cy, cx + 8, cy - 8 + q.bob, 1, SILVER[1]);
    // Big eyes, stubborn and kind; they glare orbit-blue on the wind-up.
    eyes(p, cx - 9, cy - 3, 12, 5, q.hurt, q.coil ? ORBIT : MIDNIGHT[0]);
    if (q.open > .5) p(cx - 3, cy + 6, 6, 2, MIDNIGHT[0]); else p(cx - 2, cy + 7, 4, 1, BRASS[0]);
    p(cx - 12, cy + 4, 2, 1, '#ff9a7a'); p(cx + 10, cy + 4, 2, 1, '#ff9a7a');
    // The crown: three little orbits, each with its planet, ticking round with the breath.
    for (let k = 0; k < 3; k++) {
      const ox = cx - 12 + k * 12, oy = cy - 19 - (k === 1 ? 3 : 0);
      l(ox - 4, oy, ox + 4, oy, 1, BRASS[1]);
      p(ox + (q.bob ? 3 : -3) - 1, oy - 1, 3, 3, k === 1 ? ORBIT : SILVER[2]);
    }
  },
};

/** The realm Delves' creature art, keyed like CREATURE_ART (MonsterDef.creature). */
export const REALM_CREATURE_ART: Readonly<Record<string, CreatureArt>> = {
  'graftling': GRAFTLING,
  'graftmother': GRAFTMOTHER,
  'prismling': PRISMLING,
  'hollow-sun': HOLLOW_SUN,
  'anchor-warden': ANCHOR_WARDEN,
  'fallen-ephemeris': FALLEN_EPHEMERIS,
};
