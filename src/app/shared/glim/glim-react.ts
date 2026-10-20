/**
 * glim-react.ts — Glim reacting, in real time, to what the Keeper does
 * (docs/handoff/pets-and-glim-alive.md). Owner, 2026-10-15: "Glim, I want you
 * to be even more interactive."
 *
 * A moment happens (a dodge, a rare beam, low health, a new place, nightfall,
 * a pet's trick, a level up, a drop left lying) and Glim may say ONE short line
 * and pull a face. The rules, so it never nags:
 *
 *   - each kind of moment has its own cooldown (a pet's bite is worth a word
 *     every few minutes, a legendary beam every time);
 *   - unsolicited lines keep a gap between them (GLIM_REACT_GAP), except the
 *     few that matter now (urgent: low health, a legendary beam, a level up);
 *   - a burst cap: at most GLIM_REACT_BURST lines in GLIM_REACT_WINDOW;
 *   - variety: a line said recently is not said again while another variant
 *     of that moment is fresh (`recent`, the last GLIM_RECENT lines);
 *   - "Quiet Glim" (the chat card's switch): no words at all, only its face;
 *   - never over a panel, never over another line on screen (the host checks).
 *
 * Pure: no Angular, no DOM. Copy lives in glim-alive.i18n.ts (EN + ES).
 */
import type { GlimMood } from './glim-art';
import type { BondStage } from './glim-bond';

export type GlimMoment =
  | 'dodge' | 'rare' | 'legendary' | 'lowHp' | 'place' | 'night' | 'dawn'
  | 'petTrick' | 'petHit' | 'petFind' | 'petTired' | 'petLevel' | 'levelUp' | 'missed' | 'spotted';

export interface ReactionDef {
  /** How many variants (keys glim.react.<moment>.<1..n>). */
  lines: number;
  mood: GlimMood;
  /** Seconds before this kind of moment may be voiced again. */
  rest: number;
  /** Said even inside the global gap (still under the burst cap). */
  urgent?: boolean;
}

export const GLIM_REACTIONS: Readonly<Record<GlimMoment, ReactionDef>> = {
  dodge: { lines: 4, mood: 'gasp', rest: 45 },
  rare: { lines: 3, mood: 'gasp', rest: 25 },
  legendary: { lines: 3, mood: 'gasp', rest: 0, urgent: true },
  lowHp: { lines: 3, mood: 'worry', rest: 60, urgent: true },
  place: { lines: 4, mood: 'curious', rest: 20 },
  night: { lines: 3, mood: 'calm', rest: 600 },
  dawn: { lines: 2, mood: 'happy', rest: 600 },
  petTrick: { lines: 3, mood: 'happy', rest: 30 },
  petHit: { lines: 3, mood: 'happy', rest: 150 },
  petFind: { lines: 3, mood: 'gasp', rest: 60 },
  petTired: { lines: 2, mood: 'worry', rest: 120 },
  petLevel: { lines: 2, mood: 'happy', rest: 0, urgent: true },
  levelUp: { lines: 3, mood: 'happy', rest: 15, urgent: true },
  missed: { lines: 3, mood: 'curious', rest: 60 },
  // The top-down world: Glim hops toward something worth finding (an ore seam, a way not yet taken).
  spotted: { lines: 3, mood: 'curious', rest: 90 },
};
export const GLIM_MOMENTS = Object.keys(GLIM_REACTIONS) as GlimMoment[];

/** Milliseconds between two unsolicited reactions (urgent ones excepted). */
export const GLIM_REACT_GAP = 12_000;
/** At most this many reactions in the window, urgent or not. */
export const GLIM_REACT_BURST = 6;
export const GLIM_REACT_WINDOW = 5 * 60_000;
/** How long a reaction stays on screen. */
export const GLIM_REACT_MS = 3_800;
/** Lines remembered as said "just now" (not repeated while a fresh variant waits). */
export const GLIM_RECENT = 12;

/** What Glim remembers of its reactions this session. */
export interface ReactMemory {
  /** Line keys said recently, oldest first. */
  recent: string[];
  /** moment → when it was last voiced (ms). */
  lastAt: Partial<Record<GlimMoment, number>>;
  /** When each reaction in the window was said (ms). */
  times: number[];
  /** The last unsolicited reaction (ms), for the gap. */
  lastAny: number;
}
export const emptyReactMemory = (): ReactMemory => ({ recent: [], lastAt: {}, times: [], lastAny: 0 });

export interface ReactFacts {
  now: number;
  /** "Quiet Glim": a face, no words. */
  quiet: boolean;
  /** A panel or talk is open, or another line is on screen: no words now (the face still shows). */
  busy: boolean;
  /** 0..1, picks the variant to start from (the host passes Math.random()). */
  roll: number;
}

export interface Reaction {
  /** The line key, or null for a face only (quiet, busy, resting, capped). */
  key: string | null;
  mood: GlimMood;
  memory: ReactMemory;
}

export const reactKey = (moment: GlimMoment, n: number): string => `glim.react.${moment}.${n}`;

/**
 * Glim's answer to a moment: a line (or none) and a face, with the memory it
 * leaves. Never throws; never mutates the memory it is given.
 */
export function react(moment: GlimMoment, mem: ReactMemory, f: ReactFacts): Reaction {
  const def = GLIM_REACTIONS[moment];
  const times = mem.times.filter(t => f.now - t < GLIM_REACT_WINDOW);
  const face: Reaction = { key: null, mood: def.mood, memory: { ...mem, times } };
  if (f.quiet || f.busy) return face;
  const last = mem.lastAt[moment];
  if (last !== undefined && f.now - last < def.rest * 1000) return face;
  if (!def.urgent && mem.lastAny && f.now - mem.lastAny < GLIM_REACT_GAP) return face;
  if (times.length >= GLIM_REACT_BURST) return face;
  // The first variant not said recently, starting from the roll; all recent: the one said longest ago.
  const start = Math.floor(Math.max(0, Math.min(.999, f.roll)) * def.lines);
  let key: string | null = null;
  for (let i = 0; i < def.lines && !key; i++) {
    const k = reactKey(moment, ((start + i) % def.lines) + 1);
    if (!mem.recent.includes(k)) key = k;
  }
  if (!key) {
    const mine = mem.recent.filter(k => k.startsWith(`glim.react.${moment}.`));
    key = mine[0] ?? reactKey(moment, start + 1);
  }
  const recent = [...mem.recent.filter(k => k !== key), key].slice(-GLIM_RECENT);
  return {
    key, mood: def.mood,
    memory: { recent, lastAt: { ...mem.lastAt, [moment]: f.now }, times: [...times, f.now], lastAny: def.urgent ? mem.lastAny : f.now },
  };
}

// ── Talking to Glim (tap it): the chat's choices, by the bond ──────────────

/**
 * The chat card's choices. `around`: what is near (words); `find`: Glim flies to
 * the nearest find and lays a trail of light to it; `tips`: a tip for where you
 * are; `story`: a short tale from the margins; `play`: catch the light; `quiet`:
 * the switch that silences unasked lines.
 */
export type ChatTopic = 'around' | 'tips' | 'story' | 'find' | 'play';
export const CHAT_TOPICS: readonly ChatTopic[] = ['around', 'find', 'tips', 'story', 'play'];
/** The bond stage each choice opens at (glim-bond.ts stages 1..5). */
export const CHAT_STAGE: Readonly<Record<ChatTopic, number>> = { around: 1, tips: 1, story: 1, find: 2, play: 2 };

export function chatTopics(stage: Pick<BondStage, 'n'>): ChatTopic[] {
  return CHAT_TOPICS.filter(t => stage.n >= CHAT_STAGE[t]);
}

/**
 * Glim's powers in the world, by the bond: the lamp (it lights the tunnel when
 * you hold still) from Mapmates, flying to a drop you left lying from Margin
 * notes. The high five is always.
 */
export function glimPowers(stage: Pick<BondStage, 'n'>): { lamp: boolean; missed: boolean } {
  return { lamp: stage.n >= 2, missed: stage.n >= 3 };
}

/** Where the Keeper is, for a tip. */
export type TipContext = 'delve' | 'town' | 'hunt' | 'fishing' | 'pets';
export const GLIM_TIPS: Readonly<Record<TipContext, number>> = { delve: 4, town: 3, hunt: 3, fishing: 2, pets: 3 };
export const tipKey = (ctx: TipContext, n: number): string => `glim.tip.${ctx}.${n}`;

/** The next tip for a context: the first one not heard this session, else from the top again. */
export function nextTip(ctx: TipContext, heard: readonly string[]): string {
  for (let n = 1; n <= GLIM_TIPS[ctx]; n++) if (!heard.includes(tipKey(ctx, n))) return tipKey(ctx, n);
  return tipKey(ctx, 1);
}

/** Glim's tales from the margins (lore-addendum, "Glim's margin tales"). */
export const GLIM_STORIES = 6;
export const storyKey = (n: number): string => `glim.story.${n}`;
/** The tale told least often (ties: the first), by the counts in Glim's memory (`said['story.N']`). */
export function nextStory(said: Readonly<Record<string, number>>): number {
  let best = 1, fewest = Infinity;
  for (let n = 1; n <= GLIM_STORIES; n++) {
    const c = said[`story.${n}`] ?? 0;
    if (c < fewest) { fewest = c; best = n; }
  }
  return best;
}

/** Catch the light: how many motes, how long (ms), and the line for a score. */
export const LIGHT_GAME = { motes: 5, ms: 10_000 } as const;
export function lightGameKey(caught: number): string {
  return caught >= LIGHT_GAME.motes ? 'glim.play.all' : caught >= 3 ? 'glim.play.most' : caught >= 1 ? 'glim.play.some' : 'glim.play.none';
}
/** Mote positions (fractions of the stage), deterministic per round: the outer band only, never the middle half. */
export function lightGameMotes(round: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let h = (round * 2654435761) >>> 0;
  const next = (): number => { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 0x100000000; };
  for (let i = 0; i < LIGHT_GAME.motes; i++) {
    // Left or right quarter, any height between 18 % and 78 %.
    const side = i % 2 === 0 ? 0 : 1;
    out.push({ x: side ? .78 + next() * .14 : .08 + next() * .14, y: .18 + next() * .6 });
  }
  return out;
}

/** What the chat says when asked about a find kind (glim-alive.i18n.ts glim.find.<kind>). */
export type FindKind = 'room' | 'cabinet' | 'ore' | 'node' | 'drop';
