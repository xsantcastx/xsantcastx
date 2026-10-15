/**
 * sound-palette.ts — what each realm sounds like, as data. Pure: no Web Audio,
 * no Angular, so the specs read it without a context and a composer can tune a
 * realm by editing one row (docs/handoff/world-feel.md, "Tuning a realm").
 *
 * The score is generative and sparse, in the spirit of C418's Minecraft
 * pieces: a short phrase of a few notes, then a long silence, then another.
 * Each realm keeps its own mode, register, voice and pace:
 *
 *   infernal   warm      D dorian, felt piano over a low pad (the forge-light)
 *   luminous   bright    F lydian, glass bells high up (the lamps never sleep)
 *   umbral     hushed    C aeolian, low soft piano, long dark rests
 *   celestial  airy      E major pentatonic, a breathy flute, wide space
 *   verdant    woody     G ionian, a marimba and a plucked string
 *
 * The Delve plays the same realm quieter, lower and further apart; a guardian
 * near turns the third minor and adds a low, soft drone (tense, never loud).
 */

export type RealmId = 'infernal' | 'luminous' | 'umbral' | 'celestial' | 'verdant';
export const REALM_IDS: readonly RealmId[] = ['infernal', 'luminous', 'umbral', 'celestial', 'verdant'];
export type SceneMode = 'town' | 'delve' | 'boss';
export type VoiceKind = 'piano' | 'pad' | 'pluck' | 'bell' | 'marimba' | 'flute';

export interface MusicPalette {
  realm: RealmId;
  mode: SceneMode;
  /** MIDI note of the tonic. */
  root: number;
  /** Semitones above the root, one octave. */
  scale: readonly number[];
  /** The melody's voice, and the voice of the held chord under it. */
  lead: VoiceKind;
  under: VoiceKind;
  /** Seconds per beat. */
  beat: number;
  /** Notes in a phrase, inclusive. */
  notes: readonly [number, number];
  /** Seconds of silence after a phrase, inclusive. */
  rest: readonly [number, number];
  /** Scale degrees the melody may wander above the root (7 ≈ an octave). */
  span: number;
  /** Lowpass on the music bus, Hz: warmth (low) to air (high). */
  bright: number;
  /** Reverb send 0..1. */
  space: number;
  /** Relative loudness of the score here 0..1 (the slider scales it). */
  level: number;
  /** Chance a phrase sits on a held chord. */
  chord: number;
  /** A low soft drone under it all (a guardian near). */
  drone: boolean;
}

const BASE: Readonly<Record<RealmId, Omit<MusicPalette, 'realm' | 'mode' | 'drone'>>> = {
  infernal: { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], lead: 'piano', under: 'pad', beat: .62, notes: [3, 6], rest: [7, 15], span: 9, bright: 2600, space: .35, level: .9, chord: .55 },
  luminous: { root: 65, scale: [0, 2, 4, 6, 7, 9, 11], lead: 'bell', under: 'pad', beat: .5, notes: [4, 7], rest: [6, 13], span: 10, bright: 5600, space: .5, level: .75, chord: .45 },
  umbral: { root: 48, scale: [0, 2, 3, 5, 7, 8, 10], lead: 'piano', under: 'pad', beat: .8, notes: [2, 4], rest: [10, 20], span: 6, bright: 1500, space: .55, level: .7, chord: .35 },
  celestial: { root: 64, scale: [0, 2, 4, 7, 9], lead: 'flute', under: 'pad', beat: .72, notes: [3, 5], rest: [8, 16], span: 8, bright: 6400, space: .65, level: .7, chord: .5 },
  verdant: { root: 55, scale: [0, 2, 4, 5, 7, 9, 11], lead: 'marimba', under: 'pluck', beat: .45, notes: [4, 8], rest: [6, 13], span: 9, bright: 3400, space: .28, level: .85, chord: .4 },
};

/** The score for a realm and a moment (town, Delve, a guardian near). */
export function paletteFor(realm: RealmId, mode: SceneMode = 'town'): MusicPalette {
  const b = BASE[realm] ?? BASE.infernal;
  const p: MusicPalette = { ...b, realm: BASE[realm] ? realm : 'infernal', mode, drone: false };
  if (mode === 'delve' || mode === 'boss') {
    // Underground: an octave's worth lower in feel, quieter, further apart, more cave.
    p.root = b.root - 12 < 36 ? b.root : b.root - 12;
    p.notes = [Math.max(2, b.notes[0] - 1), Math.max(2, b.notes[1] - 2)];
    p.rest = [Math.round(b.rest[0] * 1.5), Math.round(b.rest[1] * 1.5)];
    p.bright = Math.round(b.bright * .6);
    p.space = Math.min(.85, b.space + .15);
    p.level = b.level * .7;
  }
  if (mode === 'boss') {
    // Tense but soft: the third goes minor, the phrases come closer, a drone underneath.
    p.scale = b.scale.map(s => s === 4 ? 3 : s === 11 ? 10 : s === 6 ? 5 : s);
    p.beat = b.beat * .85;
    p.rest = [Math.max(3, Math.round(b.rest[0] * .5)), Math.max(5, Math.round(b.rest[1] * .6))];
    p.level = b.level * .8;
    p.chord = .15;
    p.drone = true;
  }
  return p;
}

/** A note of the scale: degree 0 is the root, 7 (in a 7-note mode) the octave above. */
export function degreeToMidi(p: Pick<MusicPalette, 'root' | 'scale'>, degree: number): number {
  const n = p.scale.length;
  const oct = Math.floor(degree / n);
  const i = ((degree % n) + n) % n;
  return p.root + oct * 12 + p.scale[i];
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface PhraseNote { at: number; midi: number; dur: number; vel: number }
export interface Phrase {
  notes: PhraseNote[];
  /** A held chord under the phrase (midi notes), or empty. */
  chord: number[];
  /** Seconds the phrase sounds (to its last note's end). */
  length: number;
  /** Seconds of silence to leave after it. */
  rest: number;
}

const RHYTHM = [1, 1, 1, 2, 1.5, 2, 3] as const;
const STEPS = [-2, -1, -1, 0, 1, 1, 2, 3, -3] as const;

/**
 * One phrase: a gentle random walk on the scale (mostly steps, the odd leap),
 * unhurried rhythms, the last note held. Deterministic for a given `rand`.
 */
export function composePhrase(p: MusicPalette, rand: () => number): Phrase {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length) % list.length];
  const count = p.notes[0] + Math.floor(rand() * (p.notes[1] - p.notes[0] + 1));
  const top = Math.max(2, p.span);
  let degree = Math.floor(top * .3 + rand() * top * .4);
  let at = 0;
  const notes: PhraseNote[] = [];
  for (let n = 0; n < count; n++) {
    const last = n === count - 1;
    const beats = last ? 3 + Math.floor(rand() * 2) : pick(RHYTHM);
    const dur = beats * p.beat;
    notes.push({ at: Math.round(at * 1000) / 1000, midi: degreeToMidi(p, degree), dur: Math.round(dur * 1.6 * 1000) / 1000, vel: Math.round((.5 + rand() * .3) * 100) / 100 });
    at += dur;
    degree = Math.max(0, Math.min(top, degree + pick(STEPS)));
  }
  // Phrases come home: the last note leans to the root, the third or the fifth.
  const home = [0, 2, 4][Math.floor(rand() * 3)];
  const lastNote = notes[notes.length - 1];
  const octave = Math.floor((lastNote.midi - p.root) / 12);
  lastNote.midi = degreeToMidi(p, Math.min(home, p.scale.length - 1)) + octave * 12;
  const chord = rand() < p.chord ? [0, 2, 4].map(d => degreeToMidi(p, d) - 12) : [];
  const length = Math.round((at + notes[notes.length - 1].dur * .5) * 1000) / 1000;
  const rest = p.rest[0] + rand() * (p.rest[1] - p.rest[0]);
  return { notes, chord, length, rest: Math.round(rest * 100) / 100 };
}

/** A small deterministic generator (mulberry32), for the specs and a seeded score. */
export function soundRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Ambience ───────────────────────────────────────────────────────────────

export type Bed = 'wind' | 'birds' | 'crickets' | 'murmur' | 'chimes' | 'leaves' | 'drips' | 'rumble' | 'water' | 'lava' | 'ink';
export const BEDS: readonly Bed[] = ['wind', 'birds', 'crickets', 'murmur', 'chimes', 'leaves', 'drips', 'rumble', 'water', 'lava', 'ink'];

/** What the world around the Keeper is like right now (the host reads it off the engine). */
export interface SoundScene {
  realm: RealmId;
  /** Underground (any Delve, a realm Delve behind a Rift Gate). */
  delve: boolean;
  /** A guardian is near and awake. */
  boss: boolean;
  /** Local hour 0..23: birds by day, crickets by night. */
  hour: number;
  /** Liquids within a few cells. */
  water: boolean;
  lava: boolean;
  ink: boolean;
  /** Glim travels with the Keeper (it hums the realm's tune back, now and then). */
  glim: boolean;
}

export function sceneMode(s: Pick<SoundScene, 'delve' | 'boss'>): SceneMode {
  return s.boss ? 'boss' : s.delve ? 'delve' : 'town';
}

export function isNight(hour: number): boolean {
  return hour >= 20 || hour < 6;
}

const TOWN_BEDS: Readonly<Record<RealmId, Partial<Record<Bed, number>>>> = {
  infernal: { wind: .35, murmur: .5, birds: .2, crickets: .3 },
  luminous: { wind: .3, murmur: .55, birds: .5, chimes: .45, crickets: .3 },
  umbral: { wind: .45, murmur: .25, birds: .1, crickets: .4 },
  celestial: { wind: .8, murmur: .25, birds: .35, chimes: .5, crickets: .2 },
  verdant: { wind: .4, murmur: .35, birds: .85, leaves: .55, crickets: .7 },
};

/**
 * The realm Delves behind the Rift Gates (rift-gates.model.ts): the Delve's beds,
 * overridden per realm. The Ember Delve is the Infernal realm's own and keeps the
 * plain Delve. The Root Deeps creak and rustle (living wood, leaves in the dark);
 * the Prism Mines ring faintly (light chiming in crystal) and drip less; the Ink
 * Deeps keep their hush (their swell is the ink bed, near ink); the Orrery Wells
 * hum with thin air and far brass, and hardly drip.
 */
export const REALM_DELVE_BEDS: Readonly<Partial<Record<RealmId, Partial<Record<Bed, number>>>>> = {
  umbral: { drips: .4 },
  verdant: { drips: .45, leaves: .3, murmur: .2 },
  luminous: { drips: .3, chimes: .35, wind: .12 },
  // The Orrery Wells: brass rings turning far off (chimes, low), a high thin air, almost no drip (nothing falls the same way twice).
  celestial: { drips: .15, chimes: .22, wind: .3, murmur: .12 },
};

/** The ambience beds for a scene, each 0..1 (the slider scales the lot). */
export function ambienceFor(s: SoundScene): Record<Bed, number> {
  const out = Object.fromEntries(BEDS.map(b => [b, 0])) as Record<Bed, number>;
  if (!s.delve) {
    const t = TOWN_BEDS[s.realm] ?? TOWN_BEDS.infernal;
    const night = isNight(s.hour);
    for (const b of BEDS) out[b] = t[b] ?? 0;
    // Birds sing by day, crickets by night; the town quietens after dark.
    if (night) { out.birds = 0; out.murmur *= .5; } else out.crickets = 0;
  } else {
    out.drips = s.realm === 'umbral' ? .4 : .6;
    out.rumble = s.boss ? .7 : .4;
    out.wind = .08;
    // A realm Delve behind a Rift Gate sounds like its realm, underneath (REALM_DELVE_BEDS).
    const own = REALM_DELVE_BEDS[s.realm];
    if (own) for (const b of BEDS) if (own[b] !== undefined) out[b] = own[b]!;
  }
  if (s.water) out.water = .7;
  if (s.lava) out.lava = .7;
  if (s.ink) out.ink = .8;
  return out;
}

// ── Materials (footsteps and digging) ──────────────────────────────────────

export type Material = 'stone' | 'earth' | 'wood' | 'ore' | 'crystal' | 'metal' | 'grass' | 'water';

/** A terrain node id (engine/terrain.ts) or a surface tag to the sound family it makes. */
export function materialOf(id: string | null | undefined): Material {
  const s = (id ?? '').toLowerCase();
  if (!s) return 'stone';
  if (s === 'grass' || s.includes('moss') || s.includes('leaf') || s.includes('vine') || s.includes('spore')) return 'grass';
  if (/(rail|iron-|anchor|charge)/.test(s) && !s.includes('basalt')) return 'metal';
  if (/(vein|seam|pyrite|fragment|splinter|heartstone)/.test(s)) return 'ore';
  if (/(glowcap|glass|mirror|crystal|obsidian|prism|dawn|light-|pane)/.test(s)) return 'crystal';
  if (s === 'water' || s === 'ink' || s === 'ink-seep') return 'water';
  if (/(wood|timber|ladder|platform|trunk|rope|chest|camp|torch|bark|plank|cache)/.test(s)) return 'wood';
  if (/(dirt|loam|root|soil|mud)/.test(s)) return 'earth';
  return 'stone';
}

/** The ground of a town street by realm (no terrain cells there). */
export const TOWN_GROUND: Readonly<Record<RealmId, Material>> = {
  infernal: 'stone', luminous: 'stone', umbral: 'stone', celestial: 'wood', verdant: 'grass',
};
