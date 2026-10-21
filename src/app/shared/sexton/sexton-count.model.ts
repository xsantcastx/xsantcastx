/**
 * sexton-count.model.ts — the Sexton's Count, Ember Isle's first story chain (design-bible §9.3, roadmap §10 item 8).
 *
 * Sexton Aldous Wren has swept the Hushed Barrow for forty years. Forty graves. Every night he counts them twice, and
 * the second count is one higher. The Keeper walks the rows, finds an open grave whose earth was pushed UP, follows
 * the dead's own jetty out at night to a page of Wren's ledger he does not remember writing, takes Barrow Key 1 from
 * the dead man who walks the rows, opens Barrow Door 1 under the plot, faces the Uncounted over the forty-first grave
 * — no name, only a tally mark — and brings back what lay on it: the sexton's own lost cowl, cursed. Wren lays it to
 * rest for nothing, or the Keeper keeps it as it is. A choice, not a fix.
 *
 * The chain is a SET OF FACTS, each recorded once with when it was first reached (TownTaskService.markChain; saved in
 * the town tasks blob, per character, through the gateway). The step is derived from the facts alone, so a cloud merge
 * (a plain union) can never send a Keeper back a step. Every rule of order lives here: an event that comes too early
 * (a page read before the stones, a door tried without the key) records nothing and says so.
 *
 * Pure: imports only the import-free economy curve.
 */
import { huntGold } from '../economy/economy-curve';

export const SEXTON_CHAIN = 'sexton-count';
export const SEXTON_GIVER = 'sexton-wren';
/** The level the chain is pitched at (shown, never gated: the bible's 5–8). */
export const SEXTON_LEVEL = 6;

/** The facts the chain records. `kept` / `rested` exclude each other; the earlier one is the answer. */
export type SextonFact =
  | 'taken' | 'stone-1' | 'stone-2' | 'stone-3' | 'page' | 'key' | 'door' | 'uncounted' | 'grave' | 'cowl' | 'kept' | 'rested';
export const SEXTON_FACTS: readonly SextonFact[] = ['taken', 'stone-1', 'stone-2', 'stone-3', 'page', 'key', 'door', 'uncounted', 'grave', 'cowl', 'kept', 'rested'];
export const SEXTON_STONES = ['stone-1', 'stone-2', 'stone-3'] as const;
export type SextonFacts = Readonly<Partial<Record<string, number>>>;

/** Where the chain stands: what the Keeper is to do next. */
export type SextonStep = 'offer' | 'stones' | 'page' | 'key' | 'door' | 'uncounted' | 'grave' | 'return' | 'done';
export const SEXTON_STEPS: readonly SextonStep[] = ['offer', 'stones', 'page', 'key', 'door', 'uncounted', 'grave', 'return', 'done'];

const has = (f: SextonFacts, k: SextonFact): boolean => typeof f[k] === 'number';

/** The step the facts say the Keeper is on. */
export function sextonStep(f: SextonFacts): SextonStep {
  if (sextonChoice(f)) return 'done';
  if (!has(f, 'taken')) return 'offer';
  if (!SEXTON_STONES.every(s => has(f, s))) return 'stones';
  if (!has(f, 'page')) return 'page';
  if (!has(f, 'key')) return 'key';
  if (!has(f, 'door')) return 'door';
  if (!has(f, 'uncounted')) return 'uncounted';
  if (!has(f, 'grave')) return 'grave';
  return 'return';
}

/** The choice made at the end, if any: the earlier of the two (a merge of two devices that chose differently agrees). */
export function sextonChoice(f: SextonFacts): 'kept' | 'rested' | null {
  const k = f['kept'], r = f['rested'];
  if (typeof k !== 'number' && typeof r !== 'number') return null;
  if (typeof k !== 'number') return 'rested';
  if (typeof r !== 'number') return 'kept';
  return r <= k ? 'rested' : 'kept';
}

/** How many of the three marked stones are read. */
export function stonesRead(f: SextonFacts): number { return SEXTON_STONES.filter(s => has(f, s)).length; }

// ── The journal: six entries the quest log shows ───────────────────────────────

export type JournalId = 'stones' | 'page' | 'key' | 'door' | 'vault' | 'return';
export const SEXTON_JOURNAL: readonly JournalId[] = ['stones', 'page', 'key', 'door', 'vault', 'return'];
/** The journal entry a step belongs to. */
export function journalOf(step: SextonStep): JournalId | null {
  switch (step) {
    case 'stones': case 'page': case 'key': case 'door': case 'return': return step;
    case 'uncounted': case 'grave': return 'vault';
    default: return null;
  }
}
export interface JournalEntry { id: JournalId; state: 'done' | 'now' | 'later' }
/** The six entries, each done, under way, or still to come (shown as a blank line, never a spoiler). */
export function sextonJournal(f: SextonFacts): JournalEntry[] {
  const step = sextonStep(f);
  if (step === 'offer') return [];
  const now = journalOf(step);
  const at = now ? SEXTON_JOURNAL.indexOf(now) : SEXTON_JOURNAL.length;
  return SEXTON_JOURNAL.map((id, i) => ({ id, state: i < at ? 'done' : i === at ? 'now' : 'later' }));
}
/** "Step 3 of 6" for the quest scroll's row: the entry under way, 1-based (6 when done). */
export function journalIndex(f: SextonFacts): number {
  const j = journalOf(sextonStep(f));
  return j ? SEXTON_JOURNAL.indexOf(j) + 1 : SEXTON_JOURNAL.length;
}

// ── Events: what the world tells the chain, and what the chain records ─────────

export type SextonEvent =
  | { kind: 'accept' }
  | { kind: 'stone'; n: 1 | 2 | 3 }
  /** The ledger page on the barrow's jetty-nook; `dark` is whether the night (or an eclipse) is on it. */
  | { kind: 'page'; dark: boolean }
  /** The Row-Walker fell (the unique Bone Walker the chain raises at the plot while the key is to be taken). */
  | { kind: 'walker' }
  | { kind: 'door' }
  | { kind: 'uncounted' }
  | { kind: 'grave' };

/** What an event does: the facts to record (none when it is out of turn) and the line the Keeper reads (i18n key). */
export interface SextonOutcome { add: SextonFact[]; line: string }

/** Pure: the facts an event adds at this point of the chain, and what is said. */
export function sextonEvent(f: SextonFacts, ev: SextonEvent): SextonOutcome {
  const step = sextonStep(f);
  const out = (add: SextonFact[], line: string): SextonOutcome => ({ add, line });
  switch (ev.kind) {
    case 'accept':
      return step === 'offer' ? out(['taken'], 'sexton.say.taken') : out([], '');
    case 'stone': {
      const fact = `stone-${ev.n}` as SextonFact;
      // Outside the chain (or once read) a stone is just a stone: its name, worn soft.
      if (step !== 'stones' || has(f, fact)) return out([], step === 'offer' ? 'sexton.stone.worn' : `sexton.stone.${ev.n}.again`);
      const last = stonesRead(f) === SEXTON_STONES.length - 1;
      return out([fact], last ? `sexton.stone.${ev.n}.last` : `sexton.stone.${ev.n}`);
    }
    case 'page':
      // The page is only there in the dark; by day there is only the wet note under its stone.
      if (!ev.dark) return out([], 'sexton.page.lit');
      if (step !== 'page') return out([], has(f, 'page') ? 'sexton.page.again' : 'sexton.page.early');
      return out(['page'], 'sexton.page.read');
    case 'walker':
      return step === 'key' ? out(['key'], 'sexton.say.key') : out([], '');
    case 'door':
      if (has(f, 'door')) return out([], '');
      return has(f, 'key') ? out(['door'], 'sexton.door.open') : out([], 'sexton.door.locked');
    case 'uncounted':
      return step === 'uncounted' ? out(['uncounted'], 'sexton.say.uncounted') : out([], '');
    case 'grave':
      if (step === 'uncounted') return out([], 'sexton.grave.guarded');
      if (step === 'grave') return out(['grave'], 'sexton.grave.read');
      return out([], has(f, 'grave') ? 'sexton.grave.again' : 'sexton.grave.worn');
  }
}

// ── The reward ─────────────────────────────────────────────────────────────────

/** The cowl the forty-first grave gives: its definition (a boss unique of the Uncounted), its fixed instance id, level and curse. */
export const SEXTON_COWL = { defId: 'unique-sextons-lost-cowl', itemId: 'sexton-count-cowl', rarity: 'legendary', level: 8, curse: 'hollow-ward' } as const;

/**
 * What the chain pays at Wren's, either way: Gold worth twelve minutes of a steady hunt at level 8 (economy-curve
 * huntGold, as the town tasks are priced) and Hunting XP. Laying the cowl to rest adds his own purse — five minutes
 * more, "the ferry coppers I saved for myself" — against the power the curse would have given.
 */
export const SEXTON_REWARD = {
  level: 8,
  goldSeconds: 12 * 60,
  gold: huntGold(8, 12 * 60),
  restSeconds: 5 * 60,
  restGold: huntGold(8, 5 * 60),
  huntingXp: 600,
} as const;
/** The Gold a choice pays. */
export function sextonGold(choice: 'kept' | 'rested'): number {
  return Math.max(0, Math.floor(SEXTON_REWARD.gold + (choice === 'rested' ? SEXTON_REWARD.restGold : 0)));
}

// ── Lumvesh: what the Seek points at while the chain is under way ──────────────

export type SextonSeekTarget = 'stones' | 'nook' | 'walker' | 'door' | 'grave' | 'wren';
/** Where the next step is to be done (null: nothing to seek — not taken, or done). */
export function sextonSeek(f: SextonFacts): SextonSeekTarget | null {
  switch (sextonStep(f)) {
    case 'stones': return 'stones';
    case 'page': return 'nook';
    case 'key': return 'walker';
    case 'door': return 'door';
    case 'uncounted': case 'grave': return 'grave';
    case 'return': return 'wren';
    default: return null;
  }
}
