/**
 * glim-bond.ts — the bond between the Keeper and Glim, as pure data and rules.
 *
 * Owner (2026-10-14): "The more you explore the more connection you and me
 * have." The bond grows only from things the two of you actually did
 * together — a new place, a carving read, a structure found, a first catch, a
 * new depth, a mission finished, a talk, a step of "The Blank Places", coming
 * back after time away — each counted ONCE, as a named moment in a set
 * (GlimState.moments). The bond is the sum of those moments' weights, so it
 * is derived, can never be double-counted, and two devices merge by union.
 *
 * Never manipulative (world-and-cast.md §5): nothing decays, nothing is lost
 * for being away, no streaks, no timers, no "we missed you". Coming back after
 * a while earns a warm hello and (three times at most) a small moment; it is
 * never a reason to log in.
 *
 * Each of the five stages unlocks something real: a talk (Glim's own story,
 * ending in a question it remembers), an ability (the way home, sensing hidden
 * rooms, noticing rare finds), and the questline. No Angular, no browser APIs.
 */

// ── Moments ────────────────────────────────────────────────────────────────

export { MOMENT_ID, MOMENT_RULES, type MomentKind } from './glim-save.model';
import { MOMENT_ID, MOMENT_RULES, type MomentKind } from './glim-save.model';

export function momentKind(id: string): MomentKind | null {
  const kind = id.slice(0, id.indexOf(':'));
  return Object.prototype.hasOwnProperty.call(MOMENT_RULES, kind) ? kind as MomentKind : null;
}

/** A structure id from the endless Delve (`ruin@-12,40`) as a moment id. */
export function siteMoment(structureId: string): string {
  return `site:${structureId.toLowerCase().replace(/[^a-z0-9@,.-]/g, '').slice(0, 60)}`;
}

/** The bond: every counted moment's weight (caps applied in set order). */
export function bondPoints(moments: readonly string[]): number {
  const seen: Partial<Record<MomentKind, number>> = {};
  let points = 0;
  for (const id of moments) {
    const kind = momentKind(id);
    if (!kind) continue;
    const n = seen[kind] = (seen[kind] ?? 0) + 1;
    if (n <= MOMENT_RULES[kind].cap) points += MOMENT_RULES[kind].weight;
  }
  return points;
}

/** Whether one more moment of this kind would still count (the set never grows past the caps). */
export function roomFor(moments: readonly string[], id: string): boolean {
  const kind = momentKind(id);
  if (!kind || !MOMENT_ID.test(id) || moments.includes(id)) return false;
  return moments.filter(m => m.startsWith(`${kind}:`)).length < MOMENT_RULES[kind].cap;
}

/** What the play view can see this tick, from the existing ledgers. */
export interface BondFacts {
  areaId: string;
  inscriptions: Iterable<string>;
  missionsDone: Iterable<string>;
  caught: Iterable<string>;
  /** Deepest stratum reached (bounties.deepest), -1 before the first dig. */
  deepest: number;
  compass: boolean;
}

/** Every moment these facts show (the service keeps only the new ones that still count). */
export function momentsFrom(f: BondFacts): string[] {
  const out: string[] = [];
  if (f.areaId) out.push(`area:${f.areaId}`);
  for (const id of f.inscriptions) out.push(`insc:${id}`);
  for (const id of f.missionsDone) out.push(`mission:${id}`);
  for (const id of f.caught) out.push(`catch:${id}`);
  for (let d = 0; d <= Math.min(3, f.deepest); d++) out.push(`depth:${d}`);
  if (f.compass) out.push('compass:astral');
  return out.filter(id => MOMENT_ID.test(id));
}

// ── Stages ─────────────────────────────────────────────────────────────────

export type BondAbility = 'way' | 'sense' | 'notice';

export interface BondStage {
  n: 1 | 2 | 3 | 4 | 5;
  /** i18n key of the stage's name. */
  name: string;
  /** Bond points it opens at. */
  at: number;
  /** Talks it opens. */
  talks: readonly TalkId[];
  /** An ability it opens. */
  ability?: BondAbility;
  /** The questline opens here. */
  quest?: boolean;
}

export const BOND_STAGES: readonly BondStage[] = [
  { n: 1, name: 'glim.bond.stage.1', at: 0, talks: ['who'] },
  { n: 2, name: 'glim.bond.stage.2', at: 12, talks: ['moths'], ability: 'way', quest: true },
  { n: 3, name: 'glim.bond.stage.3', at: 35, talks: ['page'], ability: 'sense' },
  { n: 4, name: 'glim.bond.stage.4', at: 70, talks: ['blanks'], ability: 'notice' },
  { n: 5, name: 'glim.bond.stage.5', at: 120, talks: ['fear', 'lamp'] },
];

export function stageOf(points: number): BondStage {
  let stage = BOND_STAGES[0]!;
  for (const s of BOND_STAGES) if (points >= s.at) stage = s;
  return stage;
}

/** The stage the bond has reached: never below the highest ever reached (`peak`). */
export function bondStage(moments: readonly string[], peak = 1): BondStage {
  const now = stageOf(bondPoints(moments));
  return now.n >= peak ? now : BOND_STAGES[Math.min(BOND_STAGES.length, Math.max(1, peak)) - 1]!;
}

export function hasAbility(stage: BondStage, ability: BondAbility): boolean {
  return BOND_STAGES.some(s => s.n <= stage.n && s.ability === ability);
}

// ── Talks ──────────────────────────────────────────────────────────────────

export type TalkId = 'who' | 'moths' | 'page' | 'blanks' | 'fear' | 'lamp';
export type QuestionId = 'like' | 'deep' | 'mark';

export interface TalkChoice { id: string; key: string; reply: string }

export interface GlimTalk {
  id: TalkId;
  /** The stage it opens at. */
  stage: number;
  /** Heard first (the lamp waits for the fear). */
  after?: TalkId;
  /** i18n keys: what Glim tells (three short paragraphs at most). */
  lines: readonly string[];
  /** A question Glim asks at the end; the choice is remembered (GlimState.answers). */
  question?: QuestionId;
  /** The Keeper's two or three replies, and Glim's answer to each. */
  choices: readonly TalkChoice[];
}

const k = (talk: string, rest: string) => `glim.talk.${talk}.${rest}`;
const choice = (talk: string, id: string): TalkChoice => ({ id, key: k(talk, `c.${id}`), reply: k(talk, `r.${id}`) });

export const GLIM_TALKS: readonly GlimTalk[] = [
  { id: 'who', stage: 1, lines: [k('who', 'p1'), k('who', 'p2')], choices: [choice('who', 'reads'), choice('who', 'hello')] },
  {
    id: 'moths', stage: 2, lines: [k('moths', 'p1'), k('moths', 'p2'), k('moths', 'p3')], question: 'like',
    choices: [choice('moths', 'carvings'), choice('moths', 'ore'), choice('moths', 'creatures'), choice('moths', 'way')],
  },
  {
    id: 'page', stage: 3, lines: [k('page', 'p1'), k('page', 'p2'), k('page', 'p3')], question: 'deep',
    choices: [choice('page', 'deep'), choice('page', 'surface'), choice('page', 'both')],
  },
  {
    id: 'blanks', stage: 4, lines: [k('blanks', 'p1'), k('blanks', 'p2'), k('blanks', 'p3')], question: 'mark',
    choices: [choice('blanks', 'danger'), choice('blanks', 'beauty')],
  },
  { id: 'fear', stage: 5, lines: [k('fear', 'p1'), k('fear', 'p2'), k('fear', 'p3')], choices: [choice('fear', 'keep'), choice('fear', 'why')] },
  // The highest stage, before the finale: a hint at the first lamp's name, never the name (world-and-cast.md §4, the easter egg).
  { id: 'lamp', stage: 5, after: 'fear', lines: [k('lamp', 'p1'), k('lamp', 'p2')], choices: [choice('lamp', 'tell'), choice('lamp', 'wait')] },
];

export function talkById(id: string): GlimTalk | null {
  return GLIM_TALKS.find(t => t.id === id) ?? null;
}

/** The answers a question can take (the choice ids of the talk that asks it). */
export function answersFor(q: QuestionId): string[] {
  return GLIM_TALKS.find(t => t.question === q)?.choices.map(c => c.id) ?? [];
}

export function heard(moments: readonly string[], id: TalkId): boolean {
  return moments.includes(`talk:${id}`);
}

/** Talks open at this stage (in order), each with whether it was heard. */
export function openTalks(stage: BondStage, moments: readonly string[]): { talk: GlimTalk; heard: boolean }[] {
  return GLIM_TALKS
    .filter(t => t.stage <= stage.n && (!t.after || heard(moments, t.after)))
    .map(talk => ({ talk, heard: heard(moments, talk.id) }));
}

/** The first open talk not yet heard, or null. */
export function nextTalk(stage: BondStage, moments: readonly string[]): GlimTalk | null {
  return openTalks(stage, moments).find(t => !t.heard)?.talk ?? null;
}

// ── The Blank Places (world-and-cast.md §4: six steps; opens at Mapmates) ──

export interface QuestStep {
  n: number;
  /** i18n keys: the step's name and its plain objective. */
  name: string;
  goal: string;
  /** The moments it needs (all of them). Empty: not reachable yet in this build. */
  needs: readonly string[];
}

const TOWNS = ['infernal', 'luminous', 'umbral', 'celestial', 'verdant'] as const;
const HUNTS = ['ember-quarry', 'reflection-channels', 'unrecorded-corridors', 'orrery-rings', 'rootglass-thicket'] as const;

export const BLANK_PLACES: readonly QuestStep[] = [
  { n: 1, name: 'glim.quest.1.name', goal: 'glim.quest.1.goal', needs: ['area:infernal', 'area:ember-quarry', 'depth:0'] },
  { n: 2, name: 'glim.quest.2.name', goal: 'glim.quest.2.goal', needs: ['depth:0', 'depth:1', 'depth:2', 'depth:3'] },
  { n: 3, name: 'glim.quest.3.name', goal: 'glim.quest.3.goal', needs: ['area:umbral', 'area:unrecorded-corridors'] },
  { n: 4, name: 'glim.quest.4.name', goal: 'glim.quest.4.goal', needs: ['compass:astral'] },
  { n: 5, name: 'glim.quest.5.name', goal: 'glim.quest.5.goal', needs: [...TOWNS, ...HUNTS].map(id => `area:${id}`) },
  // Leave It Blank: the Godforge threshold (Act III) is not in the world yet; it is shown, honestly, as still to come.
  { n: 6, name: 'glim.quest.6.name', goal: 'glim.quest.6.goal', needs: [] },
];

export function questStepDone(step: QuestStep, moments: readonly string[]): boolean {
  return step.needs.length > 0 && step.needs.every(id => moments.includes(id));
}

/** The quest moments these moments have earned (`quest:<n>`), not yet filed. */
export function questMoments(moments: readonly string[]): string[] {
  return BLANK_PLACES.filter(s => questStepDone(s, moments) && !moments.includes(`quest:${s.n}`)).map(s => `quest:${s.n}`);
}

// ── Abilities (the play view asks; pure) ───────────────────────────────────

/** Sense: Glim brightens within this many cells of a room no lantern has touched, or an uncopied carving. */
export const SENSE_CELLS = 14;
/** Notice: rare finds within this many cells (sector columns are 64 wide). */
export const NOTICE_CELLS = 64;
/**
 * The rare things Glim notices. Today the rift shrine (one per few sectors);
 * the Lost Cabinets (ROADMAP #6) join this list when they exist — the hook is
 * the structure kind, nothing else changes.
 */
export const GLIM_RARE_KINDS: readonly string[] = ['rift-shrine', 'rift-gate'];
/** The way home: said unasked when the shaft is this many cells away (walk + climb). */
export const WAY_FAR_CELLS = 90;

/** "Home is 84 steps west and 30 up." The shaft nearest by columns; rows to the surface. */
export function wayHome(keeper: { col: number; row: number }, shafts: readonly number[]): { dir: 'east' | 'west' | 'here'; cols: number; rows: number } | null {
  if (!shafts.length) return null;
  const shaft = shafts.reduce((a, b) => (Math.abs(b - keeper.col) < Math.abs(a - keeper.col) ? b : a));
  const dx = shaft - keeper.col;
  return { dir: Math.abs(dx) <= 2 ? 'here' : dx > 0 ? 'east' : 'west', cols: Math.abs(dx), rows: Math.max(0, keeper.row) };
}

// ── Lines the bond adds to Glim's voice ────────────────────────────────────

/** How long away counts as "a while" (the warm hello). */
export const BACK_AFTER_MS = 2 * 24 * 60 * 60_000;

/** Pick an answer-coloured variant of a line: `<base>.<answer>` when answered, else `<base>`. */
export function coloured(base: string, answer: string | undefined, known: readonly string[]): string {
  return answer && known.includes(answer) ? `${base}.${answer}` : base;
}
