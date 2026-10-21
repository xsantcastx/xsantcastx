/**
 * td-prologue.ts — "Prologue · The Fresh Mark" as the top-down game teaches it (owner, 2026-10-21: "we need to fix new
 * character creation and onboarding to the game with new characters and new users").
 *
 * The first goals used to be the side view's (buy a Homestead building, forge the Basalt Edge, dig in the Delve) and
 * then three top-down ones (a Rivet Maw down the mine, Cinder Ore, a tree) whose "Show me" said "soon". None of them
 * taught the game a new Keeper actually plays. This is the short, cozy version: ONE clear goal at a time, in plain
 * words, with Glim's chevrons pointing at the thing (the engine's setGuide), class-aware where the class matters
 * (what your basic attack is, what your key 1 casts), and touch-aware on a phone.
 *
 *   1. walk     — move about (WASD / drag)
 *   2. hearth   — light the town hearth (where you wake if you fall)
 *   3. fight    — defeat your first creature with the class's own attack and key 1
 *   4. gold     — pick up the Gold it dropped (Gold comes from the hunt only)
 *   5. book     — open the Spellbook (K): your skills and skill points
 *   6. bag      — open the Satchel (I): loot, and wearing it
 *   7. story    — talk to Sexton Aldous Wren: the first story (the Sexton's Count)
 *
 * Progress is per character: what the save already shows (a hearth lit, Hunting XP, Gold earned, the Sexton's chain
 * taken) counts by itself; the three things a save cannot show (walked, opened the book, opened the bag) are filed in
 * the character's story record (story-save.model `tut`), as is a skip. A Keeper past level 3 never sees it.
 *
 * Pure: no Angular, no browser. Words live in td-prologue.i18n.ts (EN + ES).
 */
import type { FirstGoalView } from '../world/first-goals';

export const PROLOGUE_STEPS = ['walk', 'hearth', 'fight', 'gold', 'book', 'bag', 'story'] as const;
export type PrologueStep = (typeof PROLOGUE_STEPS)[number];
/** The steps the save cannot show by itself: filed in the story record when seen. */
export const PROLOGUE_FILED: ReadonlySet<PrologueStep> = new Set<PrologueStep>(['walk', 'book', 'bag']);
/** A Keeper at this level or above has played: the prologue is over for them. */
export const PROLOGUE_VETERAN_LEVEL = 4;
/** Tiles the Keeper walks before "walk" counts. */
export const PROLOGUE_WALK_TILES = 3;

/** What the engine's chevrons point at for a step (TopDownEngine.setGuide). */
export type GuideKind = 'hearth' | 'foe' | 'gold' | 'sexton';

export interface PrologueFacts {
  /** The Keeper's level (Hunting XP). */
  level: number;
  /** Steps filed in the story record (walk, book, bag). */
  filed: readonly string[];
  /** The prologue was skipped on this character. */
  skipped: boolean;
  hearthLit: boolean;
  hunted: boolean;
  /** Any Gold ever picked up (lifetime). */
  goldEarned: boolean;
  /** The Sexton's Count has been taken (its step is past 'offer'). */
  storyTaken: boolean;
}

/** Is a step done, from the facts? */
export function stepDone(step: PrologueStep, f: PrologueFacts): boolean {
  switch (step) {
    case 'hearth': return f.hearthLit;
    case 'fight': return f.hunted;
    case 'gold': return f.goldEarned;
    case 'story': return f.storyTaken;
    default: return f.filed.includes(step);
  }
}

/** The prologue is over for this character: skipped, a veteran, or every step done. */
export function prologueOver(f: PrologueFacts): boolean {
  return f.skipped || f.level >= PROLOGUE_VETERAN_LEVEL || PROLOGUE_STEPS.every(s => stepDone(s, f));
}

/** The step to do now, or null when the prologue is over. */
export function prologueStep(f: PrologueFacts): PrologueStep | null {
  if (prologueOver(f)) return null;
  return PROLOGUE_STEPS.find(s => !stepDone(s, f)) ?? null;
}

/** The engine's pointer for a step (null: nothing in the world to point at). */
export function guideFor(step: PrologueStep | null): GuideKind | null {
  switch (step) {
    case 'hearth': return 'hearth';
    case 'fight': return 'foe';
    case 'gold': return 'gold';
    case 'story': return 'sexton';
    default: return null;
  }
}

/** The classes the prologue has its own words for; any other (a class still to come) reads the plain line. */
const CLASS_WORDS: ReadonlySet<string> = new Set(['warlock', 'ashguard', 'lanternwright']);

/**
 * The line for a step: its i18n key. `touch` picks the phone's words (drag, tap) over the keyboard's; the fight step
 * also reads the class.
 */
export function stepKey(step: PrologueStep, vocation: string, touch: boolean): string {
  const how = touch ? 'touch' : 'keys';
  if (step === 'fight') return `play.pro.fight.${CLASS_WORDS.has(vocation) ? vocation : 'any'}.${how}`;
  if (step === 'walk' || step === 'book' || step === 'bag' || step === 'hearth') return `play.pro.${step}.${how}`;
  return `play.pro.${step}`;
}

/** Glim's tip as a step begins (one line, in its voice). */
export function tipKey(step: PrologueStep): string { return `play.pro.tip.${step}`; }

/** The quest scroll's rows: every step's short name, in order. */
export const PROLOGUE_ROWS: readonly { n: number; key: string }[] = PROLOGUE_STEPS.map((s, i) => ({ n: i + 1, key: `play.pro.title.${s}` }));

/**
 * The goal line's view (the HUD's FirstGoalView): "Step n of 7", the line, and a Show me for every step that has a
 * place in the world (the walk, the book and the bag happen where you stand).
 */
export function prologueView(step: PrologueStep, vocation: string, touch: boolean, skill: string): FirstGoalView {
  const n = PROLOGUE_STEPS.indexOf(step) + 1;
  const guide = guideFor(step);
  return {
    id: `pro-${step}` as FirstGoalView['id'],
    n,
    total: PROLOGUE_STEPS.length,
    key: stepKey(step, vocation, touch),
    vars: { skill },
    target: guide ? { guide } : null,
  };
}
