/**
 * glim.ts — what Glim, the Margin-Light, says, and when.
 *
 * Glim is the Keeper's companion (docs/world/world-and-cast.md §4): a
 * hand-sized moth of lamplight that keeps the maps and is the Delve's lantern.
 * This file is its voice, as pure data and pure rules:
 *
 *   - the HINT LADDER. The Archivist's rule: "A hint is a kindness. An answer is
 *     a theft." Each subject (a first goal, the Rune Forge hint, a Delve
 *     mission) has three steps, opened one at a time and only when asked:
 *     1 a nudge, 2 a direction, 3 Show me. Only subjects in GLIM_HINTS have a
 *     ladder. Anything else, every Codex secret, the Nameless, the Void rune,
 *     the meaning of an inscription, a story choice, gets "This one's yours
 *     to find", and the table is an allowlist precisely so nothing secret can
 *     reach it by accident.
 *   - its LINES: the Prologue beats, the Delve lantern, the good stopping
 *     point, the Mirror Substitute tell, a few idle Delve lines. Each is once
 *     or has a cooldown, and unsolicited lines keep a global gap, so Glim is
 *     never spammy.
 *   - the DIRECTOR: given the facts of this tick, which line (if any) Glim says
 *     now. The play view hands in facts and shows the result; Glim's memory
 *     lives in GlimService (save gateway, merge-safe).
 *
 * Copy: the lazy glim i18n table (EN + ES). No Angular, no browser APIs.
 */
// ── The hint ladder ─────────────────────────────────────────────────────────

/** 1 nudge, 2 direction, 3 Show me. */
export type GlimStep = 1 | 2 | 3;

export interface GlimHintRow {
  /** i18n key: the gentlest push. */
  nudge: string;
  /** i18n key: where, in plain words. */
  direction: string;
  /**
   * Step 3. 'walk': Glim flies to the goal's place and the Keeper follows (the
   * goal line's own Show me). 'here': the thing is where the Keeper stands; the
   * line says so. 'atlas': a pin on Glim's Atlas, which is not drawn yet
   * (slice S4), so the ladder stops at step 2 for these.
   */
  show: 'walk' | 'here' | 'atlas';
}

/** Back to the Seamworks floor: the same two steps wherever the Keeper wandered. */
const BACK: GlimHintRow = { nudge: 'play.glim.hint.back.1', direction: 'play.glim.hint.back.2', show: 'walk' };

/**
 * Every subject Glim will hint at, keyed by the goal line's i18n key (so the
 * hint matches the line on screen) or by a Delve mission id. Nothing else.
 */
export const GLIM_HINTS: Readonly<Record<string, GlimHintRow>> = {
  'play.goal.buy.town': { nudge: 'play.glim.hint.buy.town.1', direction: 'play.glim.hint.buy.town.2', show: 'walk' },
  'play.goal.buy.home': { nudge: 'play.glim.hint.buy.home.1', direction: 'play.glim.hint.buy.home.2', show: 'walk' },
  'play.goal.buy.back': BACK,
  'play.goal.craft.mine': { nudge: 'play.glim.hint.craft.mine.1', direction: 'play.glim.hint.craft.mine.2', show: 'walk' },
  'play.goal.craft.forge': { nudge: 'play.glim.hint.craft.forge.1', direction: 'play.glim.hint.craft.forge.2', show: 'walk' },
  'play.goal.craft.equip': { nudge: 'play.glim.hint.craft.equip.1', direction: 'play.glim.hint.craft.equip.2', show: 'walk' },
  'play.goal.craft.back': BACK,
  'play.goal.hunt.town': { nudge: 'play.glim.hint.hunt.town.1', direction: 'play.glim.hint.hunt.town.2', show: 'walk' },
  'play.goal.hunt.here': { nudge: 'play.glim.hint.hunt.here.1', direction: 'play.glim.hint.hunt.here.2', show: 'here' },
  'play.goal.hunt.back': BACK,
  'play.goal.delve.town': { nudge: 'play.glim.hint.delve.town.1', direction: 'play.glim.hint.delve.town.2', show: 'walk' },
  'play.goal.delve.dig': { nudge: 'play.glim.hint.delve.dig.1', direction: 'play.glim.hint.delve.dig.2', show: 'here' },
  'play.goal.delve.back': BACK,
  'play.goal.away': BACK,
  'play.goal.rune.town': { nudge: 'play.glim.hint.rune.1', direction: 'play.glim.hint.rune.2', show: 'walk' },
  // Delve missions (delve-missions.model.ts). Where to look, never what a carving means.
  'delve-verrin-shadow': { nudge: 'play.glim.hint.m.shadow.1', direction: 'play.glim.hint.m.shadow.2', show: 'atlas' },
  'delve-kael-seam': { nudge: 'play.glim.hint.m.seam.1', direction: 'play.glim.hint.m.seam.2', show: 'atlas' },
  'delve-merchant-glowcaps': { nudge: 'play.glim.hint.m.glowcaps.1', direction: 'play.glim.hint.m.glowcaps.2', show: 'atlas' },
  'delve-archivist-words-1': { nudge: 'play.glim.hint.m.words.1', direction: 'play.glim.hint.m.words.2', show: 'atlas' },
  'delve-archivist-words-2': { nudge: 'play.glim.hint.m.words.1', direction: 'play.glim.hint.m.words.2', show: 'atlas' },
  'delve-archivist-words-3': { nudge: 'play.glim.hint.m.words3.1', direction: 'play.glim.hint.m.words.2', show: 'atlas' },
  'delve-fracture': { nudge: 'play.glim.hint.m.fracture.1', direction: 'play.glim.hint.m.fracture.2', show: 'atlas' },
  // Fishing missions (liquids-fishing.md): which water, never what it hides.
  'fish-drowned-lamp-1': { nudge: 'play.glim.hint.f.minnow.1', direction: 'play.glim.hint.f.minnow.2', show: 'atlas' },
  'fish-drowned-lamp-2': { nudge: 'play.glim.hint.f.alcove.1', direction: 'play.glim.hint.f.alcove.2', show: 'atlas' },
  'fish-drowned-lamp-3': { nudge: 'play.glim.hint.f.lamp.1', direction: 'play.glim.hint.f.lamp.2', show: 'atlas' },
  'fish-verrin-eels': { nudge: 'play.glim.hint.f.eels.1', direction: 'play.glim.hint.f.eels.2', show: 'atlas' },
  'fish-merchant-order': { nudge: 'play.glim.hint.f.order.1', direction: 'play.glim.hint.f.order.2', show: 'atlas' },
  'fish-merchant-debt': { nudge: 'play.glim.hint.f.debt.1', direction: 'play.glim.hint.f.debt.2', show: 'atlas' },
  'fish-archivist-pages': { nudge: 'play.glim.hint.f.pages.1', direction: 'play.glim.hint.f.pages.2', show: 'atlas' },
  // The Underhearth (Phase 8): where to look, never what is down there.
  'kael-flooded-seams': { nudge: 'play.glim.hint.u.rivets.1', direction: 'play.glim.hint.u.rivets.2', show: 'atlas' },
  'kael-four-1': { nudge: 'play.glim.hint.u.seal.1', direction: 'play.glim.hint.u.seal.2', show: 'atlas' },
  'kael-four-2': { nudge: 'play.glim.hint.u.marks.1', direction: 'play.glim.hint.u.marks.2', show: 'atlas' },
  'verrin-four-3': { nudge: 'play.glim.hint.u.furnace.1', direction: 'play.glim.hint.u.furnace.2', show: 'atlas' },
  'verrin-endings-kept-warm': { nudge: 'play.glim.hint.u.coalfish.1', direction: 'play.glim.hint.u.coalfish.2', show: 'atlas' },
};

/** What Glim says to anything off the ladder. */
export const GLIM_REFUSAL = 'play.glim.hint.yours';

/** How many steps a subject's ladder has: 3, or 2 while its Show me waits for the Atlas. 0 = no ladder. */
export function ladderTop(subject: string): 0 | 2 | 3 {
  const row = Object.prototype.hasOwnProperty.call(GLIM_HINTS, subject) ? GLIM_HINTS[subject] : undefined;
  if (!row) return 0;
  return row.show === 'atlas' ? 2 : 3;
}

export interface GlimHint {
  /** The step shown (0 = refused: no ladder for this subject). */
  step: 0 | GlimStep;
  /** Steps this ladder has (0, 2 or 3). */
  top: 0 | 2 | 3;
  /** The line to say. */
  key: string;
  /** Step 3 with a place to go: walk there (Glim flies ahead). */
  walk: boolean;
}

/**
 * The hint at `step` for a subject. `step` is what the ladder has opened so
 * far (GlimService.advance); it is clamped to the subject's own top. A subject
 * with no row is refused at every step.
 */
export function glimHint(subject: string, step: number): GlimHint {
  const top = ladderTop(subject);
  if (!top) return { step: 0, top: 0, key: GLIM_REFUSAL, walk: false };
  const row = GLIM_HINTS[subject]!;
  const s = Math.max(1, Math.min(top, Math.floor(step) || 1)) as GlimStep;
  if (s === 1) return { step: 1, top, key: row.nudge, walk: false };
  if (s === 2) return { step: 2, top, key: row.direction, walk: false };
  return row.show === 'walk'
    ? { step: 3, top, key: 'play.glim.hint.follow', walk: true }
    : { step: 3, top, key: 'play.glim.hint.here', walk: false };
}

/** Which ladder a first goal's progress is filed under: the goal, not the area variant of its line. */
export function ladderSubject(goal: { id: string } | null): string | null {
  return goal ? `goal.${goal.id}` : null;
}

// ── Lines ───────────────────────────────────────────────────────────────────

export type GlimLineId =
  | 'meet' | 'homestead' | 'edge' | 'maws' | 'delve' | 'lantern' | 'stop'
  | 'mirror' | 'mirror.again' | 'idle.dashed' | 'idle.wall' | 'idle.north';

export interface GlimLine {
  id: GlimLineId;
  key: string;
  /** Said once, ever (on any device). */
  once?: boolean;
  /** Not again within this long of its last saying. */
  cooldownMs?: number;
}

const MIN = 60_000;

export const GLIM_LINES: Readonly<Record<GlimLineId, GlimLine>> = {
  // The Prologue (world-and-cast.md, "The Fresh Mark").
  meet: { id: 'meet', key: 'play.glim.line.meet', once: true },
  homestead: { id: 'homestead', key: 'play.glim.line.homestead', once: true },
  edge: { id: 'edge', key: 'play.glim.line.edge', once: true },
  maws: { id: 'maws', key: 'play.glim.line.maws', once: true },
  delve: { id: 'delve', key: 'play.glim.line.delve', once: true },
  lantern: { id: 'lantern', key: 'play.glim.line.lantern', once: true },
  // The game helps you leave (§5 anti-patterns): said once, plainly.
  stop: { id: 'stop', key: 'play.glim.line.stop', once: true },
  // The Atlas moth's tell: Glim dims beside things that perform certainty.
  mirror: { id: 'mirror', key: 'play.glim.line.mirror', once: true },
  'mirror.again': { id: 'mirror.again', key: 'play.glim.line.mirrorAgain', cooldownMs: 20 * MIN },
  // A few Delve lines, far apart.
  'idle.dashed': { id: 'idle.dashed', key: 'play.glim.line.dashed', cooldownMs: 30 * MIN },
  'idle.wall': { id: 'idle.wall', key: 'play.glim.line.wall', cooldownMs: 30 * MIN },
  'idle.north': { id: 'idle.north', key: 'play.glim.line.north', cooldownMs: 30 * MIN },
};

/** Unsolicited lines keep at least this far apart. Hints (asked for) do not wait. */
export const GLIM_GAP_MS = 25_000;
/** The first idle line waits this long into a Delve visit. */
export const GLIM_IDLE_AFTER_MS = 3 * MIN;
/** How long a line stays up (dismissible any time). */
export const GLIM_SAY_MS = 7_000;
export const GLIM_HINT_MS = 10_000;

/** What Glim remembers of its lines (GlimState.said / lastAt). */
export interface GlimMemory {
  said: Readonly<Record<string, number>>;
  lastAt: Readonly<Record<string, number>>;
}

/** May this line be said now? Once-lines never twice; cooldowns from the last saying. */
export function canSay(id: GlimLineId, memory: GlimMemory, now: number): boolean {
  const line = GLIM_LINES[id];
  if (line.once) return !memory.said[id];
  const last = memory.lastAt[id] ?? 0;
  return !line.cooldownMs || !last || now - last >= line.cooldownMs;
}

// ── The director ────────────────────────────────────────────────────────────

/** The facts of one HUD tick. */
export interface GlimFacts {
  now: number;
  met: boolean;
  memory: GlimMemory;
  /** When Glim last said an unsolicited line (this session; 0 = never). */
  lastSpokeAt: number;
  /** A line (or a hint) is on screen right now. */
  speaking: boolean;
  /** A station panel is open: Glim keeps quiet. */
  panelOpen: boolean;
  areaId: string;
  /** First-goal progress, from the save. */
  armed: boolean;
  hunted: boolean;
  goalsDone: boolean;
  /** When this Delve visit began (0 = not in the Delve). */
  delveSince: number;
  /** A Mirror Substitute stands near the Keeper (the engine's tell). */
  dimmed: boolean;
}

const DELVE = 'ember-delve';
const IDLE: readonly GlimLineId[] = ['idle.dashed', 'idle.wall', 'idle.north'];

/**
 * The beats a Keeper is already past when Glim first meets them: a veteran
 * save is not walked back through the Prologue, so these are filed as said
 * without being said.
 */
export function pastBeats(f: Pick<GlimFacts, 'armed' | 'hunted' | 'goalsDone' | 'areaId'>): GlimLineId[] {
  const out: GlimLineId[] = [];
  if (f.armed || f.hunted) out.push('edge');
  if (f.hunted) out.push('maws');
  if (f.goalsDone) out.push('homestead', 'delve', 'lantern', 'stop');
  return out;
}

/**
 * What Glim says this tick, unasked, or null. The meeting comes first and
 * ignores the gap; everything else waits for quiet (no panel, nothing on
 * screen, GLIM_GAP_MS since the last unsolicited line) and is a once-line or
 * off its cooldown.
 */
export function nextLine(f: GlimFacts): GlimLineId | null {
  if (f.panelOpen || f.speaking) return null;
  if (!f.met) return 'meet';
  if (f.lastSpokeAt && f.now - f.lastSpokeAt < GLIM_GAP_MS) return null;
  const may = (id: GlimLineId) => canSay(id, f.memory, f.now);
  // The tell first: it is about something standing next to you right now.
  if (f.dimmed) return may('mirror') ? 'mirror' : may('mirror.again') ? 'mirror.again' : null;
  if (f.goalsDone && may('stop')) return 'stop';
  if (f.areaId === 'homestead' && may('homestead')) return 'homestead';
  if (f.armed && may('edge')) return 'edge';
  if (f.hunted && may('maws')) return 'maws';
  if (f.areaId === DELVE) {
    if (may('delve')) return 'delve';
    if (may('lantern')) return 'lantern';
    if (f.delveSince && f.now - f.delveSince >= GLIM_IDLE_AFTER_MS) {
      // Every idle line shares one clock: one of them per half hour at most.
      const lastIdle = Math.max(0, ...IDLE.map(id => f.memory.lastAt[id] ?? 0));
      if (!lastIdle || f.now - lastIdle >= GLIM_LINES['idle.dashed'].cooldownMs!) {
        return IDLE.find(id => !f.memory.said[id]) ?? IDLE[Math.floor(f.now / MIN) % IDLE.length]!;
      }
    }
  }
  return null;
}
