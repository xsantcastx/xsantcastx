/**
 * book-model.ts — what the Skill Book shows (docs/design/skill-book.md §1–3), as plain data built from the rules
 * (td-tree) and the numbers (td-skills castVars, td-marks markPhrases). The book component draws it and turns taps into
 * td-tree calls on its staged copy of the tree; nothing here keeps state.
 *
 * Two trees go in: `saved` (what the save holds) and `staged` (the book's pending copy). A mark or a rank in `staged`
 * that `saved` lacks reads as pending until Accept.
 */
import type { KeeperSkillTree, Vocation } from '../../shared/keeper-look/keeper-look.model';
import { skillPointsEarned } from '../../shared/keeper-look/skill-points';
import { MAX_RANK, SKILLS, castRank, castVars, cooldownNow, manaCost, rowKind, synergies, type GearSig, type RowKind, type SkillId, type TreeId } from '../td/td-skills';
import { FOLDED, MARKS, MARK_PREV, MARK_RANK, STAR_OTHER, markDef, markPhrases, maskHas, type MarkDef, type MarkFx, type MarkSlot } from '../td/td-marks';
import { boughtRanks, bookRows, levelFor, markBlock, marksOf, pointsSpent, rankBlock, rankOf } from '../td/td-tree';

export type Translate = (key: string, vars?: Record<string, string | number>) => string;
/** The per-row Spellstone card (S2 PLACEHOLDER: today's inscribing; the HUD's stoneView). */
export interface SpellbookStone { soul: number; charges: number; rank: number; held: number; blanks: number; onBelt: boolean; why: string }

export interface BookCtx {
  vocation: Vocation;
  level: number;
  saved: KeeperSkillTree;
  staged: KeeperSkillTree;
  /** What worn gear adds (td-skills GearSig) and a caster's worn +Spells, so the cards' numbers are the fight's. */
  sig: GearSig;
  gearRanks: number;
  castSpeed: number;
  t: Translate;
  /** The HUD's own lines for a row's card (the sky's hand, what lifts its damage), or none. */
  extra?: (id: SkillId) => string[];
}

/** A mark's state on the page (skill-book.md §1 "Node states"). */
export type MarkState = 'taken' | 'pending' | 'open' | 'closed' | 'locked' | 'blocked';
/** The glyph a mark's diamond carries (skill-book.md §1: the node-verb set). */
export type MarkGlyph = 'up' | 'ring' | 'time' | 'cd' | 'mana' | 'status' | 'shape' | 'spark' | 'party' | 'fold';

export interface BookMark {
  slot: MarkSlot;
  name: string;
  branch: 'a' | 'b';
  step: 1 | 2 | 3;
  star: boolean;
  state: MarkState;
  /** What it does, in words built from its effects. */
  line: string;
  /** Why it cannot be taken now ('' when it can, or it is held). */
  need: string;
  /** The star rule's line, or a folded passive's "Was the passive…". */
  note: string;
  glyph: MarkGlyph;
  /** The other star on the row, when this one is a star. */
  other: MarkSlot | null;
}
export interface BookRow {
  id: SkillId;
  name: string;
  kind: RowKind;
  /** The staged rank, the saved one, and the rank the fight casts at (gear included). */
  rank: number;
  savedRank: number;
  castRank: number;
  level: number;
  open: boolean;
  /** [+] buys a rank now. */
  canRank: boolean;
  /** A staged rank above the saved one can be given back. */
  canDrop: boolean;
  why: string;
  marks: BookMark[] | null;
  words: string;
  cost: string;
  now: string;
  next: string[];
  syn: { from: SkillId; text: string; live: boolean }[];
  extra: string[];
  /** The ranks worn gear adds now. */
  gear: number;
  /** An active row the Spellstone placeholder sits on (S2 makes it a satchel item). */
  stone: boolean;
}
export interface BookPage { tree: TreeId; rows: BookRow[]; common: boolean }

/** Points still to spend in the staged tree. */
export function unusedPoints(ctx: Pick<BookCtx, 'level' | 'staged'>): number {
  return Math.max(0, skillPointsEarned(ctx.level) - pointsSpent(ctx.staged));
}
/** How many choices are pending (ranks and marks the staged tree holds over the saved one, and anything given back). */
export function pendingCount(saved: KeeperSkillTree, staged: KeeperSkillTree): number {
  let n = 0;
  const ids = new Set([...Object.keys(saved.spent), ...Object.keys(staged.spent)]);
  for (const id of ids) n += Math.abs((staged.spent[id] ?? 0) - (saved.spent[id] ?? 0));
  const rows = new Set([...Object.keys(saved.nodes ?? {}), ...Object.keys(staged.nodes ?? {})]);
  for (const id of rows) { let x = ((saved.nodes ?? {})[id] ?? 0) ^ ((staged.nodes ?? {})[id] ?? 0); while (x) { n += x & 1; x >>= 1; } }
  return n;
}

/** The glyph for a mark: its first effect's verb (skill-book.md §1). */
export function markGlyph(def: MarkDef): MarkGlyph {
  const fx: MarkFx = def.fx[0];
  if (fx.k === 'fold') return 'fold';
  if (fx.k === 'pct') return fx.v.some(v => v === 'radius') ? 'ring' : 'up';
  if (fx.k === 'add') return fx.v === 'radius' || fx.v === 'range' || fx.v === 'reach' || fx.v === 'length' || fx.v === 'arc' ? 'ring' : fx.v === 'secs' ? 'time' : 'up';
  if (fx.k === 'set') return 'shape';
  if (fx.k === 'cd') return 'cd';
  if (fx.k === 'mana') return 'mana';
  if (fx.k === 'rider') return 'status';
  const shape = ['ring', 'ringFan', 'cross', 'split', 'twin', 'return', 'shards', 'chain', 'hexRing', 'pierce', 'wideBash', 'through', 'twinArrow', 'swarm', 'twoBeacons', 'twoCalled', 'traps', 'followFoe', 'followSelf', 'echo', 'jump', 'doomTwo'];
  if (shape.includes(fx.f)) return 'shape';
  if (fx.f === 'kinHeal' || fx.f === 'kinGuard') return 'party';
  return 'spark';
}

/** A mark's line: each phrase translated (a var that names a key is translated too), joined with "; ". */
export function markLine(id: SkillId, def: MarkDef, rank: number, t: Translate, sig?: GearSig): string {
  return markPhrases(id, def).map(ph => {
    // A folded passive reads its own card line at the row's rank (td-tree: it runs at its row's rank).
    const fold = def.fx.find((f): f is Extract<MarkFx, { k: 'fold' }> => f.k === 'fold');
    if (fold && ph.key === `skill.${fold.skill}.text`) return t(SKILLS[fold.skill].textKey, castVars(fold.skill, Math.max(1, rank), null, sig));
    const vars: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(ph.vars)) vars[k] = typeof v === 'string' && /^book\.[a-z]+\./.test(v) ? t(v) : v;
    return t(ph.key, vars);
  }).join('; ');
}

function markView(ctx: BookCtx, id: SkillId, def: MarkDef): BookMark {
  const { saved, staged, vocation: v, level, t } = ctx;
  const branch = def.slot[0] as 'a' | 'b', step = Number(def.slot[1]) as 1 | 2 | 3, star = step === 3;
  const had = maskHas(marksOf(saved, v, id), def.slot), has = maskHas(marksOf(staged, v, id), def.slot);
  const block = has ? null : markBlock(staged, v, id, def.slot, level);
  const other = STAR_OTHER[def.slot] ?? null, otherDef = other ? markDef(id, other) : null;
  const state: MarkState = has ? (had ? 'taken' : 'pending') : block === null ? 'open' : block === 'star' ? 'blocked' : block === 'points' ? 'closed' : 'locked';
  const prev = MARK_PREV[def.slot], prevDef = prev ? markDef(id, prev) : null;
  const need = has ? '' : block === 'rank' ? t('book.mark.needRank', { n: MARK_RANK[def.slot] })
    : block === 'prev' && prevDef ? t('book.mark.needPrev', { name: t(prevDef.nameKey) })
    : block === 'star' && otherDef ? t('book.mark.starClosed', { name: t(otherDef.nameKey) })
    : block === 'points' ? t('book.noPoints') : '';
  const fold = def.fx.find((f): f is Extract<MarkFx, { k: 'fold' }> => f.k === 'fold');
  const note = fold ? t('book.mark.folded', { name: t(SKILLS[fold.skill].nameKey) })
    : star && otherDef ? t('book.mark.starRule', { name: t(otherDef.nameKey) }) : '';
  return {
    slot: def.slot, name: t(def.nameKey), branch, step, star, state, need, note, glyph: markGlyph(def), other,
    line: markLine(id, def, Math.max(1, rankOf(staged, v, id)), t, ctx.sig),
  };
}

/** What the next rank changes, var by var ("Damage: 24–36 → 28–42"); a min/max pair reads as one range. */
function rankDiff(ctx: BookCtx, id: SkillId, rank: number, mask: number, bought: Partial<Record<SkillId, number>>): string[] {
  const { sig, gearRanks, t } = ctx;
  const a = castVars(id, castRank(id, rank, sig, gearRanks), bought, sig, mask), b = castVars(id, castRank(id, rank + 1, sig, gearRanks), bought, sig, mask), out: string[] = [];
  const pair = 'min' in a && 'max' in a;
  if (pair && (a['min'] !== b['min'] || a['max'] !== b['max'])) out.push(`${t('play.td.tree.var.damage')}: ${a['min']}–${a['max']} → ${b['min']}–${b['max']}`);
  for (const k of Object.keys(a)) {
    if (pair && (k === 'min' || k === 'max')) continue;
    if (a[k] !== b[k]) out.push(`${t('play.td.tree.var.' + k)}: ${a[k]} → ${b[k]}`);
  }
  return out;
}

function rowView(ctx: BookCtx, id: SkillId): BookRow {
  const { saved, staged, vocation: v, level, t, sig, gearRanks } = ctx;
  const sk = SKILLS[id], kind = rowKind(id), rank = rankOf(staged, v, id), savedRank = rankOf(saved, v, id), mask = marksOf(staged, v, id);
  const bought = boughtRanks(staged, v), block = rankBlock(staged, v, id, level), cr = castRank(id, Math.max(1, rank), sig, gearRanks);
  const vars = castVars(id, cr, bought, sig, mask);
  const why = block === 'level' ? t('book.opens', { n: levelFor(id) }) : block === 'req' ? t('book.req') : block === 'max' ? t('book.maxed') : block === 'points' ? t('book.noPoints') : '';
  const active = sk.kind === 'active';
  return {
    id, name: t(sk.nameKey), kind, rank, savedRank, castRank: rank > 0 ? cr : 0, level: levelFor(id), open: level >= levelFor(id),
    canRank: block === null, canDrop: (staged.spent[id] ?? 0) > (saved.spent[id] ?? 0),
    why, marks: MARKS[id] ? MARKS[id]!.map(d => markView(ctx, id, d)) : null,
    words: sk.words ?? '',
    cost: active && sk.mana + sk.cd > 0 ? t('book.cost', { mana: manaCost(id, mask), cd: cooldownNow(id, ctx.castSpeed, sig, mask) }) : '',
    now: t(sk.textKey, { ...vars, mana: vars['mana'] ?? manaCost(id, mask), cd: sk.cd }),
    next: rank >= 1 && rank < MAX_RANK ? rankDiff(ctx, id, cr, mask, bought) : [],
    syn: synergies(id, bought).map(s => ({ from: s.from, live: s.pct > 0, text: `${t(SKILLS[s.from].nameKey)}: ${t('play.td.tree.syn.line', { pct: s.pct, per: s.per, what: t('play.td.tree.syn.' + s.what) })}` })),
    extra: ctx.extra?.(id) ?? [],
    gear: rank > 0 ? cr - rank : 0,
    stone: active && id !== 'waygate' && rank >= 1,
  };
}

/** One page of the book: its rows in the book's order, each with its marks (the Common page's take none). */
export function bookPage(ctx: BookCtx, tree: TreeId): BookPage {
  return { tree, common: tree === 'common', rows: bookRows(ctx.vocation, tree).map(id => rowView(ctx, id)) };
}
/** The ranks and marks a page holds (the tab's brass number). */
export function pageSpent(tree: KeeperSkillTree, v: Vocation, page: TreeId): number {
  return bookRows(v, page).reduce((n, id) => n + rankOf(tree, v, id) + [...'abcdef'].filter((_, i) => (marksOf(tree, v, id) >> i) & 1).length, 0);
}
/** A folded passive's row and slot (the book's "Was the passive…" link from the old name). */
export function foldOf(id: SkillId): { into: SkillId; slot: MarkSlot } | null { return FOLDED[id] ?? null; }
