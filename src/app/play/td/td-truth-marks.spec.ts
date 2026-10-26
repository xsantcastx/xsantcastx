/**
 * td-truth-marks.spec.ts — the Skill Book's marks tell the truth (docs/design/skill-book.md, skills-100.md §0.2; the
 * truth harness of td-truth.spec.ts, extended to the 288 marks of the shipped rows).
 *
 * A mark's line is built from its effects (td-marks markPhrases), so its words are its data; what is left to prove is
 * that the fight carries out that data. Every mark of every row is checked here:
 *   1. the book: six marks a row, a name and a line in EN and ES with nothing left unfilled, the ten folds where
 *      skills-100.md §6 puts them;
 *   2. the numbers (`pct`, `add`, `set`, `cd`, `mana`): the fight's own vars, cooldown and cost move by exactly them;
 *   3. the riders: the row's hit (or touch) lays the status on what it struck, and not without the mark;
 *   4. the folds: the old passive runs at its row's rank while the mark is held, and not at all without it;
 *   5. the named rules: each one, measured in a real MobSystem (one probe a rule; a rule with no probe fails).
 */
import type { EngineOptions } from '../engine/engine.model';
import { FOLDED_PASSIVES, type KeeperSkillTree, type Vocation } from '../../shared/keeper-look/keeper-look.model';
import { HUD_I18N } from '../world/hud.i18n';
import { ASHGUARD_I18N } from './td-ashguard.i18n';
import { LANTERN_I18N } from './td-lantern.i18n';
import { THORN_I18N } from './td-thorn.i18n';
import { BOOK_I18N } from '../spellbook/book.i18n';
import { markLine } from '../spellbook/book-model';
import { TILE } from './td-art';
import { MOBS, MobSystem, type Mob, type MobDef, type MobHost } from './td-mobs';
import { CLASS_SKILLS, NO_GEAR_SIG, SKILLS, castCd, castVars, rowKind, type SkillId } from './td-skills';
import { FOLDED, MARKS, MARK_BIT, MARK_SLOTS, applyMarkVars, markFlags, markRiders, type MarkDef, type MarkFlag, type MarkFx, type MarkSlot, type MarkStatus } from './td-marks';
import { bookRows, buyMark, buyRank, clampTree, dropMark, effectiveMarks, effectiveRanks, markBlock, pointsSpent, rankOf, swapStar } from './td-tree';
import { shadowBorn } from './td-lantern';

const I18N: Record<string, { en: string; es: string }> = { ...HUD_I18N, ...ASHGUARD_I18N, ...LANTERN_I18N, ...THORN_I18N, ...BOOK_I18N };
const fill = (lang: 'en' | 'es') => (key: string, vars?: Record<string, string | number>) => {
  let s = I18N[key]?.[lang] ?? `MISSING:${key}`;
  for (const [k, v] of Object.entries(vars ?? {})) s = s.split(`{{${k}}}`).join(String(v));
  return s;
};
const VOCS: Vocation[] = ['warlock', 'ashguard', 'lanternwright', 'thornstrider'];
const VOC_OF = (id: SkillId): Vocation => VOCS.find(v => (CLASS_SKILLS[v] as readonly string[]).includes(id))!;
const ROWS = Object.keys(MARKS) as SkillId[];
const bit = (slot: MarkSlot) => MARK_BIT[slot];

// ── A tiny world (as td-truth's): the Keeper at (0, 0), dummies that neither move nor bite unless asked ──
interface World { sys: MobSystem; keeper: { x: number; y: number; face: number }; life: { hp: number }; hurt: number[]; healed: number[] }
function world(voc: Vocation, ranks: Partial<Record<SkillId, number>>, marks: Partial<Record<SkillId, number>> = {}): World {
  const keeper = { x: 0, y: 0, face: 1 }, life = { hp: 5000 }, hurt: number[] = [], healed: number[] = [];
  const host: MobHost = {
    options: { onKill: () => undefined } as unknown as EngineOptions,
    walkable: () => true, levelId: () => 'marks', player: () => keeper,
    hurtPlayer: n => { hurt.push(n); life.hp = Math.max(0, life.hp - n); }, healPlayer: n => { healed.push(n); life.hp = Math.min(5000, life.hp + n); },
    swung: () => undefined, playerHp: () => life.hp, dash: (x, y) => { keeper.x = x; keeper.y = y; }, seek: () => true,
  };
  const sys = new MobSystem(host);
  sys.vocation = voc; sys.aura = null; sys.keeperMaxHp = 5000;
  sys.setRanks(ranks, null, marks);
  sys.mana = sys.maxMana = 99999; sys.power = 1; sys.crit = 0;
  return { sys, keeper, life, hurt, healed };
}
/** The row (and what its probe needs beside it) at rank 10, the given marks taken. */
const R10 = (id: SkillId, extra: Partial<Record<SkillId, number>> = {}) => ({ [id]: 10, ...extra }) as Partial<Record<SkillId, number>>;
const withMarks = (id: SkillId, mask: number, extra: Partial<Record<SkillId, number>> = {}) => world(VOC_OF(id), R10(id, extra), mask ? { [id]: mask } : {});
const DUMMY = MOBS['ash-wolf'];
const DEAD = MOBS['bone-walker'];
const SPEAR_Y = -16 + DUMMY.h / 2, ARROW_Y = -20 + DUMMY.h / 2;
function dummy(w: World, x: number, y = 0, def: MobDef = DUMMY, hp = 1e7): Mob {
  const m = w.sys.place(`d${w.sys.mobs.length}:${x},${y}`, { ...def, hp: Math.max(hp, def.hp), sight: 0, dmg: [0, 0], rate: 999, speed: 0 }, x, y);
  m.hp = hp; m.wait = 1e9; m.cd = 999;
  return m;
}
/** A dummy that bites the Keeper for exactly `n` from a tile away (it may be hunted, it does not walk). */
function biter(w: World, n: number, x = 10, def: MobDef = DUMMY): Mob {
  const m = w.sys.place(`b${w.sys.mobs.length}`, { ...def, hp: 1e7, sight: 999, dmg: [n, n], rate: .5, speed: 0 }, x, 0);
  m.hp = 1e7; m.cd = 0; m.wait = 1e9;
  return m;
}
const run = (w: World, secs: number, dt = .02) => { for (let t = 0; t < secs - 1e-9; t += dt) w.sys.update(dt); };
function cast(w: World, id: SkillId): ReturnType<MobSystem['useAbility']> {
  w.sys.cooldowns[id] = 0; w.sys.mana = 99999;
  return w.sys.useAbility(id);
}
const lost = (m: Mob) => 1e7 - m.hp;

/**
 * How a row touches a creature, for its riders and on-hit rules: where the dummy stands and what is done (a cast and
 * a wait, the basic attack against a target, the aura running). Rows that strike nothing are absent.
 */
const TOUCH: Partial<Record<SkillId, { at?: [number, number]; def?: MobDef; go: (w: World, m: Mob) => void }>> = {
  'ember-bolt': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; run(w, 1.6); } },
  'hellfire-nova': { go: (w) => { cast(w, 'hellfire-nova'); run(w, .1); } },
  'aura-embers': { go: (w) => { w.sys.aura = 'aura-embers'; run(w, 1.2); } },
  'cinder-rain': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'cinder-rain'); run(w, 1.2); } },
  'flame-wall': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'flame-wall'); run(w, 1.2); } },
  'meteor': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'meteor'); run(w, 1.4); } },
  'bone-spear': { at: [2 * TILE, SPEAR_Y], go: (w, m) => { w.sys.target = m; cast(w, 'bone-spear'); run(w, .6); } },
  'raise-skeleton': { at: [TILE, 0], go: (w) => { cast(w, 'raise-skeleton'); run(w, 4); } },
  'corpse-burst': { at: [TILE, 0], go: (w, m) => { w.sys.corpses.push({ x: m.x, y: m.y, at: w.sys.age }); cast(w, 'corpse-burst'); run(w, .1); } },
  'bone-storm': { at: [2 * TILE, SPEAR_Y], go: (w, m) => { w.sys.target = m; cast(w, 'bone-storm'); run(w, .6); } },
  'drain-life': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'drain-life'); } },
  'ember-curse': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'ember-curse'); run(w, .1); } },
  'weaken': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'weaken'); } },
  'doom': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'doom'); run(w, 4.2); } },
  'watch-blade': { at: [TILE, 0], go: (w, m) => { w.sys.target = m; run(w, 1); } },
  'cinder-cleave': { at: [TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'cinder-cleave'); run(w, .05); } },
  'whirl-of-cinders': { at: [TILE, 0], go: (w) => { cast(w, 'whirl-of-cinders'); run(w, 2.2); } },
  'shield-bash': { at: [TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'shield-bash'); } },
  'ash-stride': { at: [3 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'ash-stride'); } },
  'kindle': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; run(w, 1.6); } },
  'blinding-flash': { at: [TILE, 0], go: (w) => { cast(w, 'blinding-flash'); } },
  'banish': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'banish'); } },
  'dawn-at-noon': { at: [TILE, 0], def: DEAD, go: (w) => { cast(w, 'dawn-at-noon'); run(w, 1.1); } },
  'lamp-wisp': { at: [2 * TILE, 0], go: (w) => { cast(w, 'lamp-wisp'); run(w, 2.5); } },
  'beacon': { at: [2 * TILE, 0], go: (w) => { cast(w, 'beacon'); run(w, 2.5); } },
  'thorn-shot': { at: [2 * TILE, ARROW_Y], go: (w, m) => { w.sys.target = m; run(w, 1.2); } },
  'barbed-shot': { at: [2 * TILE, ARROW_Y], go: (w, m) => { w.sys.target = m; cast(w, 'barbed-shot'); run(w, .6); } },
  'volley': { at: [2 * TILE, ARROW_Y], go: (w, m) => { w.sys.target = m; cast(w, 'volley'); run(w, .6); } },
  'command': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'command'); w.sys.petBite(m, 5, 1); } },
  'call-of-the-wilds': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'call-of-the-wilds'); run(w, 4); } },
  'stampede': { at: [3 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'stampede'); run(w, 1.5); } },
  'thornroot-snare': { at: [2 * TILE, 0], go: (w, m) => { w.sys.target = m; cast(w, 'thornroot-snare'); run(w, .2); } },
  'bramble-trap': { at: [6, 2], go: (w) => { cast(w, 'bramble-trap'); run(w, .2); } },
};
/** The row touches a fresh dummy; the dummy is handed back (with `track` watching its statuses all the while). */
function touch(id: SkillId, mask: number, extra: Partial<Record<SkillId, number>> = {}): { w: World; m: Mob; seen: Set<MarkStatus> } {
  const t = TOUCH[id]!, w = withMarks(id, mask, extra), [x, y] = t.at ?? [TILE, 0], m = dummy(w, x, y, t.def ?? DUMMY);
  const seen = new Set<MarkStatus>();
  const look = () => {
    if ((m.scorchT ?? 0) > 0) seen.add('burn');
    if ((m.bleedT ?? 0) > 0) seen.add('bleed');
    if ((m.chillT ?? 0) > 0) seen.add('chill');
    if ((m.stun ?? 0) > 0) seen.add('stun');
    if ((m.rootT ?? 0) > 0) seen.add('root');
    if ((m.blindT ?? 0) > 0) seen.add('blind');
    if ((m.hushT ?? 0) > 0) seen.add('hush');
    if ((m.taunt ?? 0) > 0) seen.add('taunt');
    if ((m.fearT ?? 0) > 0) seen.add('fear');
  };
  const update = w.sys.update.bind(w.sys);
  w.sys.update = (dt: number) => { look(); update(dt); look(); };
  t.go(w, m); look();
  return { w, m, seen };
}

// ── 1. The book ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('td-truth-marks 1: the book holds six marks a row, each named and said in both languages', () => {
  it('every row of every class but the Common page has six marks; folded passives and the Common page have none', () => {
    for (const v of VOCS) for (const id of CLASS_SKILLS[v]) {
      const kind = rowKind(id);
      if (kind === 'folded' || SKILLS[id].tree === 'common') expect(MARKS[id]).withContext(id).toBeUndefined();
      else expect(MARKS[id]?.length).withContext(id).toBe(6);
    }
    expect(ROWS.length).toBe(48);
  });

  it('the ten folds sit where skills-100.md §6 puts them, and the save knows the same ten', () => {
    expect(FOLDED).toEqual({
      'ember-mastery': { into: 'ember-bolt', slot: 'a3' }, 'soul-harvest': { into: 'bone-spear', slot: 'b1' }, 'skeleton-mastery': { into: 'raise-skeleton', slot: 'a1' },
      'life-tap': { into: 'dark-ward', slot: 'a2' }, 'hold-the-line': { into: 'shield-oath', slot: 'a1' }, 'ember-blood': { into: 'aura-watchfire', slot: 'a1' },
      'last-light': { into: 'lantern-ward', slot: 'a3' }, 'moth-kin': { into: 'lamp-wisp', slot: 'a1' }, 'heartwood': { into: 'thorn-shot', slot: 'a1' },
      'wild-heart': { into: 'pack-bond', slot: 'a1' },
    });
    expect([...FOLDED_PASSIVES].sort()).toEqual(Object.keys(FOLDED).sort());
  });

  it('every mark has a name and a line in EN and ES, fully filled, at ranks 1, 10 and 20', () => {
    for (const id of ROWS) for (const d of MARKS[id]!) {
      expect(I18N[d.nameKey]).withContext(d.nameKey).toBeDefined();
      for (const lang of ['en', 'es'] as const) for (const r of [1, 10, 20]) {
        const line = markLine(id, d, r, fill(lang));
        expect(line).withContext(`${id}.${d.slot} ${lang}@${r}: ${line}`).not.toMatch(/\{\{|MISSING|NaN|undefined|book\./);
        expect(line.length).withContext(`${id}.${d.slot}`).toBeGreaterThan(4);
      }
    }
  });
});

// ── 2. The numbers ───────────────────────────────────────────────────────────────────────────────────────────────

describe('td-truth-marks 2: a mark\'s numbers are the fight\'s numbers', () => {
  for (const id of ROWS) for (const d of MARKS[id]!) {
    const nums = d.fx.filter(f => f.k === 'pct' || f.k === 'add' || f.k === 'set' || f.k === 'cd' || f.k === 'mana');
    if (!nums.length) continue;
    it(`${id}.${d.slot} (${I18N[d.nameKey].en}): ${nums.map(f => f.k).join(', ')}`, () => {
      const plain = withMarks(id, 0), marked = withMarks(id, bit(d.slot));
      // The card's numbers (castVars) are the row's with the mark's applied, exactly; the fight (v) reads the card's,
      // under the sky's hand (td-phases), so each of its numbers sits within a point of the card's own move.
      const c0 = castVars(id, 10), c1 = castVars(id, 10, null, NO_GEAR_SIG, bit(d.slot));
      expect(c1).toEqual(applyMarkVars(id, c0, bit(d.slot)));
      const v0 = plain.sys.v(id), v1 = marked.sys.v(id), sky = (k: string) => (c0[k] ? v0[k] / c0[k] : 1);
      for (const k of Object.keys(c1)) expect(Math.abs(v1[k] - c1[k] * sky(k))).withContext(`fight ${k}`).toBeLessThanOrEqual(1.01);
      for (const f of nums) {
        if (f.k === 'pct') for (const k of f.v.flatMap(g => (g === 'dmg' ? ['min', 'max', 'dps'] : [g])).filter(k => k in c0)) {
          expect(Math.abs(c1[k] - c0[k] * (100 + f.n) / 100)).withContext(k).toBeLessThanOrEqual(.51);
          if (f.n > 0) expect(v1[k]).withContext(k).toBeGreaterThan(v0[k]); else expect(v1[k]).withContext(k).toBeLessThan(v0[k]);
        }
        if (f.k === 'add') { expect(f.v in c0).withContext(`${id} has ${f.v}`).toBeTrue(); expect(c1[f.v]).withContext(f.v).toBeCloseTo(c0[f.v] + f.n, 2); }
        if (f.k === 'set') expect(c1[f.v]).withContext(f.v).toBe(f.n);
        if (f.k === 'cd') expect(marked.sys.cdOf(id)).toBeCloseTo(Math.max(.5, SKILLS[id].cd + f.n), 5);
        if (f.k === 'mana') {
          expect(marked.sys.manaOf(id)).toBe(Math.round(SKILLS[id].mana * (100 + f.n) / 100));
          expect(marked.sys.manaOf(id)).toBeLessThan(plain.sys.manaOf(id));
        }
      }
    });
  }

  it('the card\'s cooldown is the fight\'s with the marks in (td-skills castCd)', () => {
    for (const id of ROWS) for (const d of MARKS[id]!) {
      const w = withMarks(id, bit(d.slot));
      expect(w.sys.cdOf(id)).withContext(`${id}.${d.slot}`).toBe(castCd(id, NO_GEAR_SIG, bit(d.slot)));
    }
  });

  it('a cheaper mark spends that much less on the cast', () => {
    const plain = withMarks('bone-storm', 0), cheap = withMarks('bone-storm', bit('b2'));
    for (const w of [plain, cheap]) { dummy(w, 2 * TILE, SPEAR_Y); w.sys.mana = 1000; w.sys.useAbility('bone-storm'); }
    expect(1000 - plain.sys.mana).toBe(SKILLS['bone-storm'].mana);
    expect(1000 - cheap.sys.mana).toBe(Math.round(SKILLS['bone-storm'].mana * .75));
  });

  it('a wider ring strikes a foe the plain one misses (Hellfire Nova\'s Wide Ring)', () => {
    const r = withMarks('hellfire-nova', 0).sys.v('hellfire-nova')['radius'];
    const hit = (mask: number) => { const w = withMarks('hellfire-nova', mask), m = dummy(w, (r + .5) * TILE); cast(w, 'hellfire-nova'); return lost(m) > 0; };
    expect(hit(0)).toBeFalse();
    expect(hit(bit('b1'))).toBeTrue();
  });
});

// ── 3. The riders ────────────────────────────────────────────────────────────────────────────────────────────────

describe('td-truth-marks 3: a rider lays its status on what the row touches', () => {
  for (const id of ROWS) for (const d of MARKS[id]!) for (const r of d.fx.filter((f): f is Extract<MarkFx, { k: 'rider' }> => f.k === 'rider')) {
    it(`${id}.${d.slot} (${I18N[d.nameKey].en}): ${r.st} ${r.secs} s${r.pct !== undefined ? ` at ${r.pct}%` : ''}`, () => {
      expect(TOUCH[id]).withContext(`${id} needs a touch`).toBeDefined();
      // A chance rider is tried until it lands (or plainly never does).
      let got = false;
      for (let i = 0; i < (r.chance !== undefined ? 40 : 1) && !got; i++) got = touch(id, bit(d.slot)).seen.has(r.st);
      expect(got).withContext('with the mark').toBeTrue();
      expect(touch(id, 0).seen.has(r.st)).withContext('without it').toBeFalse();
    });
  }

  it('a burn rider burns its share of the hit a second, for its seconds (Kindling)', () => {
    const { w, m } = touch('ember-bolt', bit('a2'));
    w.sys.target = null; w.sys.bolts.length = 0;
    const dps = m.scorchDps ?? 0, before = lost(m);
    expect(dps).toBeGreaterThan(0);
    run(w, 2.2);
    expect(lost(m) - before).toBeGreaterThan(0);
    expect(m.scorchT ?? 0).toBeLessThanOrEqual(0);
  });
});

// ── 4. The folds ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('td-truth-marks 4: a folded passive runs at its row\'s rank while its mark is held', () => {
  for (const [p, f] of Object.entries(FOLDED) as [SkillId, { into: SkillId; slot: MarkSlot }][]) {
    it(`${p} → ${f.into}.${f.slot}`, () => {
      const v = VOC_OF(f.into);
      let tree: KeeperSkillTree = { spent: { [f.into]: 12 }, free: [], nodes: {}, book: 2, at: 0 };
      tree = clampTree(tree, v, 60);
      const rank = rankOf(tree, v, f.into);
      expect(rankOf(tree, v, p)).withContext('no mark, no passive').toBe(0);
      // Take the branch up to the fold (a mark needs the one before it on its branch).
      for (const s of MARK_SLOTS.filter(s => s[0] === f.slot[0] && s <= f.slot)) tree = buyMark(tree, v, f.into, s, 60)!;
      expect(tree).not.toBeNull();
      expect(rankOf(tree, v, p)).toBe(rank);
      expect(effectiveRanks(tree, v)[p]).toBe(rank);
      // It takes no rank of its own, and its old points never count.
      expect(buyRank(tree, v, p, 60)).toBeNull();
      expect(clampTree({ ...tree, spent: { ...tree.spent, [p]: 5 } }, v, 60).spent[p]).toBeUndefined();
    });
  }
});

// ── 5. The named rules ───────────────────────────────────────────────────────────────────────────────────────────

/** A probe for each named rule of each row: true when the fight does what the line says. */
type RuleProbe = (fx: Extract<MarkFx, { k: 'flag' }>) => void;
const n_ = (fx: { n?: number }) => fx.n ?? 0;
/** The same scene with and without the mark: what `measure` reads off each. */
function ab(id: SkillId, slot: MarkSlot, measure: (w: World) => number, extra: Partial<Record<SkillId, number>> = {}): [number, number] {
  return [measure(withMarks(id, 0, extra)), measure(withMarks(id, bit(slot), extra))];
}
/** Damage one touch of the row deals to its dummy, with and without the mark (the mean of `n` tries). */
function dealt(id: SkillId, slot: MarkSlot, n = 20, extra: Partial<Record<SkillId, number>> = {}, setup?: (w: World, m: Mob) => void): [number, number] {
  const one = (mask: number) => { let s = 0; for (let i = 0; i < n; i++) { const t = TOUCH[id]!, w = withMarks(id, mask, extra), [x, y] = t.at ?? [TILE, 0], m = dummy(w, x, y, t.def ?? DUMMY); setup?.(w, m); t.go(w, m); s += lost(m); } return s / n; };
  return [one(0), one(bit(slot))];
}

/** One blow of exactly 100 through the fight's real hit (td-mobs hitFoe: the marks' multipliers in), as `src`'s. */
const blow = (w: World, m: Mob, src: SkillId | null) => (w.sys as unknown as { hitFoe(m: Mob, raw: number, c: string, s: SkillId | null): number }).hitFoe(m, 100, '#ffffff', src);

const RULES: Partial<Record<string, RuleProbe>> = {
  // ── generic ──
  'ember-bolt.b2:jump': () => {
    // Split Spark: a quarter of the bolts leap to the next foe at half.
    const w = withMarks('ember-bolt', bit('b2')), a = dummy(w, 2 * TILE), b = dummy(w, 2 * TILE + 20);
    w.sys.target = a; run(w, 40);
    expect(lost(b)).toBeGreaterThan(0);
    const w0 = withMarks('ember-bolt', 0), a0 = dummy(w0, 2 * TILE), b0 = dummy(w0, 2 * TILE + 20);
    w0.sys.target = a0; run(w0, 40);
    expect(lost(b0)).toBe(0);
  },
  'drain-life.a3:jump': fx => {
    const w = withMarks('drain-life', bit('a3')), a = dummy(w, 2 * TILE), b = dummy(w, 2 * TILE + 20), c = dummy(w, 2 * TILE + 30), d = dummy(w, 2 * TILE + 40);
    w.sys.target = a; cast(w, 'drain-life');
    expect([b, c, d].filter(m => lost(m) > 0).length).toBe(fx.m!);
  },
  'kindle.b3:jump': () => {
    const w = withMarks('kindle', bit('b3')), a = dummy(w, 2 * TILE), b = dummy(w, 2 * TILE + 20);
    w.sys.target = a; run(w, 2);
    expect(lost(b)).toBeGreaterThan(0);
  },
  'call-of-the-wilds.b3:jump': () => {
    const w = withMarks('call-of-the-wilds', bit('b3')), a = dummy(w, 2 * TILE), b = dummy(w, 2 * TILE + 14);
    w.sys.target = a; cast(w, 'call-of-the-wilds'); run(w, 6);
    expect(lost(b)).toBeGreaterThan(0);
  },
  'echo': () => undefined,
  'hellfire-nova.a3:echo': fx => {
    // Twin Nova: a second ring a moment later, at its share.
    const w = withMarks('hellfire-nova', bit('a3')), m = dummy(w, TILE);
    cast(w, 'hellfire-nova'); const first = lost(m);
    run(w, (fx.s ?? 0) + .05);
    const second = lost(m) - first, v = w.sys.v('hellfire-nova');
    expect(second).toBeGreaterThanOrEqual(Math.round(v['min'] * n_(fx) / 100) - 1);
    expect(second).toBeLessThanOrEqual(Math.round(v['max'] * n_(fx) / 100) + 1);
  },
  'meteor.a3:echo': fx => {
    // Twin Impact: a second stone lands its seconds after the first, at its share.
    const one = (mask: number) => { let s = 0; for (let i = 0; i < 10; i++) { const w = withMarks('meteor', mask), m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'meteor'); run(w, w.sys.v('meteor')['delay'] + (fx.s ?? 0) + .2); s += lost(m); } return s; };
    expect(one(bit('a3')) / one(0)).toBeCloseTo(1 + n_(fx) / 100, 0);
  },
  'bone-storm.b3:echo': () => { const [a, b] = dealt('bone-storm', 'b3', 10); expect(b).toBeGreaterThan(a * 1.3); },
  'hearthlight.a3:echo': () => {
    const [a, b] = ab('hearthlight', 'a3', w => { w.life.hp = 100; cast(w, 'hearthlight'); run(w, 7); return w.life.hp; });
    expect(b).toBeGreaterThan(a);
  },
  'volley.b3:echo': () => {
    // Rolling Volley: three small volleys over the next moment (the first at once).
    const w = withMarks('volley', bit('b3')), m = dummy(w, 2 * TILE, ARROW_Y);
    w.sys.target = m; cast(w, 'volley'); const n0 = w.sys.arrows.length;
    run(w, .65);
    expect(n0).toBeGreaterThan(0);
    expect(w.sys.loosed).toBeGreaterThanOrEqual(n0 * 3);
  },
  'stampede.a3:echo': () => { const [a, b] = dealt('stampede', 'a3', 6); expect(b).toBeGreaterThan(a * 1.2); },
  'ember-bolt.b3:kill': fx => {
    const w = withMarks('ember-bolt', bit('b3')), m = dummy(w, 2 * TILE, 0, DUMMY, 1);
    w.sys.mana = 50; w.sys.maxMana = 999; w.sys.regen = 0; w.sys.target = m; run(w, 1.5);
    expect(m.hp).toBeLessThanOrEqual(0);
    expect(w.sys.mana).toBeCloseTo(50 + n_(fx), 0);
  },
  'aura-embers.b2:kill': fx => {
    const w = withMarks('aura-embers', bit('b2')), m = dummy(w, TILE, 0, DUMMY, 1);
    w.sys.aura = 'aura-embers'; w.sys.mana = 50; w.sys.maxMana = 999; w.sys.regen = 0; run(w, 1.2);
    expect(m.hp).toBeLessThanOrEqual(0);
    expect(w.sys.mana).toBeCloseTo(50 + n_(fx), 0);
  },
  'aura-siphon.b3:killHeal': fx => {
    const w = withMarks('aura-siphon', bit('b3'), { 'ember-bolt': 1 }), m = dummy(w, 2 * TILE, 0, DUMMY, 1);
    w.sys.aura = 'aura-siphon'; w.life.hp = 1000; w.sys.target = m; run(w, 1.5);
    expect(m.hp).toBeLessThanOrEqual(0);
    expect(w.healed.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(5000 * n_(fx) / 100);
  },
  'hellfire-nova.b3:absorbHit': fx => {
    const w = withMarks('hellfire-nova', bit('b3'));
    for (let i = 0; i < 3; i++) dummy(w, TILE + i);
    cast(w, 'hellfire-nova');
    expect(w.sys.markShield).toBe(3 * n_(fx));
    // It drinks a blow, and it fades after its seconds.
    const b = biter(w, 5); b.cd = 0; run(w, .05);
    expect(w.hurt.length).toBe(0);
    run(w, fx.s!);
    expect(w.sys.markShield).toBe(0);
  },
  'watch-blade.b3:absorbHit': fx => {
    const w = withMarks('watch-blade', bit('b3')), m = dummy(w, TILE); w.sys.target = m; run(w, .1);
    expect(w.sys.markShield).toBe(n_(fx));
  },
  'blinding-flash.b3:healHit': fx => {
    const w = withMarks('blinding-flash', bit('b3')), m = dummy(w, TILE); w.life.hp = 1000;
    cast(w, 'blinding-flash');
    expect(w.healed.reduce((a, b) => a + b, 0)).toBeCloseTo(lost(m) * n_(fx) / 100, -1);
  },
  'aura-siphon.a2:manaHit': fx => {
    const w = withMarks('aura-siphon', bit('a2'), { 'drain-life': 1 }), m = dummy(w, 2 * TILE);
    w.sys.aura = 'aura-siphon'; w.sys.mana = 100; w.sys.maxMana = 9999; w.sys.regen = 0; w.sys.target = m;
    w.sys.useAbility('drain-life');
    expect(w.sys.mana).toBe(100 - SKILLS['drain-life'].mana + n_(fx));
  },
  'cinder-rain.b3:vsStatus': fx => {
    const w = withMarks('cinder-rain', bit('b3')), m = dummy(w, TILE);
    expect(blow(w, m, 'cinder-rain')).toBe(100);
    m.scorchT = 9;
    expect(blow(w, m, 'cinder-rain')).toBe(100 + n_(fx));
    expect(blow(w, m, 'ember-bolt')).toBe(100);
    // And in the fight: the rain on a burning foe lands harder than on one that is not.
    const [a, b] = dealt('cinder-rain', 'b3', 60, {}, (x, f) => { f.scorchT = 99; f.scorchDps = 0; f.scorchTick = 99; });
    expect(b).toBeGreaterThan(a);
  },
  'watch-blade.b2:vsStatus': fx => {
    const w = withMarks('watch-blade', bit('b2')), m = dummy(w, TILE);
    expect(blow(w, m, 'watch-blade')).toBe(100);
    m.chillT = 9;
    expect(blow(w, m, 'watch-blade')).toBe(100 + n_(fx));
  },
  'thorn-shot.b3:vsStatus': fx => {
    const w = withMarks('thorn-shot', bit('b3')), m = dummy(w, TILE);
    expect(blow(w, m, 'thorn-shot')).toBe(100);
    m.bleedT = 9;
    expect(blow(w, m, 'thorn-shot')).toBe(100 + n_(fx));
    expect(blow(w, m, 'volley')).toBe(100);
  },
  'weaken.a2:vuln.exact': fx => {
    const w = world('warlock', { weaken: 10 }, { weaken: bit('a2') }), m = dummy(w, TILE);
    expect(blow(w, m, null)).toBe(100); m.weak = 9;
    expect(blow(w, m, null)).toBe(100 + n_(fx));
  },
  'weaken.a2:vuln': fx => {
    RULES['weaken.a2:vuln.exact']!(fx);
    const hit = (mask: number) => { const w = world('warlock', { weaken: 10, 'hellfire-nova': 10 }, mask ? { weaken: mask } : {}), m = dummy(w, TILE); m.weak = 9; m.weakPct = 1; let s = 0; for (let i = 0; i < 400; i++) { const h = m.hp; cast(w, 'hellfire-nova'); s += h - m.hp; } return s; };
    expect(hit(bit('a2')) / hit(0)).toBeCloseTo(1 + n_(fx) / 100, 1);
  },
  'barbed-shot.a2:vuln': fx => {
    const w0 = world('thornstrider', { 'barbed-shot': 10 }, { 'barbed-shot': bit('a2') }), m0 = dummy(w0, TILE);
    expect(blow(w0, m0, null)).toBe(100); m0.bleedT = 9;
    expect(blow(w0, m0, null)).toBe(100 + n_(fx));
    const hit = (mask: number) => { const w = world('thornstrider', { 'barbed-shot': 10, volley: 10 }, mask ? { 'barbed-shot': mask } : {}), m = dummy(w, 2 * TILE, ARROW_Y); m.bleedT = 99; m.bleedDps = 0; w.sys.target = m; let s = 0; for (let i = 0; i < 120; i++) { m.x = 2 * TILE; m.y = ARROW_Y; const h = m.hp; cast(w, 'volley'); run(w, .5); s += h - m.hp; } return s; };
    expect(hit(bit('a2')) / hit(0)).toBeCloseTo(1 + n_(fx) / 100, 1);
  },
  'hellfire-nova.a2:field': fx => {
    const w = withMarks('hellfire-nova', bit('a2')), m = dummy(w, TILE);
    cast(w, 'hellfire-nova'); const first = lost(m);
    run(w, fx.s! + .2);
    expect(lost(m)).toBeGreaterThan(first);
    expect(w.sys.zones.length).toBe(0);
  },
  'meteor.a2:field': fx => {
    const w = withMarks('meteor', bit('a2')), m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'meteor');
    run(w, w.sys.v('meteor')['delay'] + .05);
    expect(w.sys.zones.some(z => z.kind === 'field')).toBeTrue();
    const after = lost(m); run(w, fx.s!);
    expect(lost(m)).toBeGreaterThan(after);
  },
  'watch-blade.a3:nth': fx => {
    const w = withMarks('watch-blade', bit('a3')), m = dummy(w, TILE); w.sys.target = m;
    let stunned = false;
    for (let t = 0; t < 6; t += .02) { w.sys.update(.02); if ((m.stun ?? 0) > 0) stunned = true; }
    expect(stunned).toBeTrue();
    expect(w.sys.swings).toBeGreaterThanOrEqual(fx.m!);
  },
  'thorn-shot.a3:nthCrit': fx => {
    const w = withMarks('thorn-shot', bit('a3')), m = dummy(w, 2 * TILE, ARROW_Y); w.sys.target = m;
    run(w, 8);
    expect(w.sys.effects.some(e => e.kind === 'crit') || w.sys.floaters.some(f => f.text.endsWith('!'))).toBeTrue();
    void fx;
  },
  'kindle.a3:nthHeal': () => {
    const [a, b] = ab('kindle', 'a3', w => { w.life.hp = 100; const m = dummy(w, 2 * TILE); w.sys.target = m; run(w, 6); return w.life.hp; });
    expect(b).toBeGreaterThan(a);
  },
  'drain-life.b1:reach': fx => {
    const far = (mask: number) => { const w = withMarks('drain-life', mask), m = dummy(w, w.sys.range + (n_(fx) - .5) * TILE); w.sys.target = m; return cast(w, 'drain-life'); };
    expect(far(0)).toBe('nofoe');
    expect(far(bit('b1'))).toBeNull();
  },
  'aura-embers.b3:resist': fx => {
    const [a, b] = ab('aura-embers', 'b3', w => { w.sys.aura = 'aura-embers'; w.sys.resists = { fire: 0, cold: 0, lightning: 0, arcane: 0 }; const f = w.sys.place('f', { ...DUMMY, hp: 1e7, sight: 999, dmg: [100, 100], rate: .5, speed: 0, element: 'fire' } as MobDef, 10, 0); f.cd = 0; (w.sys as unknown as { biteKeeper(n: number, t: string, m?: Mob): void }).biteKeeper(100, 'fire', f); return w.hurt.reduce((x, y) => x + y, 0); });
    expect(b).toBeLessThan(a);
    expect(b).toBe(Math.round(100 * (1 - n_(fx) / 100)));
  },
  'aura-watchfire.b2:resist': fx => {
    const [a, b] = ab('aura-watchfire', 'b2', w => { w.sys.vocation = 'ashguard'; w.sys.aura = 'aura-watchfire'; w.sys.resists = { fire: 0, cold: 0, lightning: 0, arcane: 0 }; (w.sys as unknown as { biteKeeper(n: number, t: string): void }).biteKeeper(100, 'fire'); return w.hurt.reduce((x, y) => x + y, 0); });
    expect(b).toBe(Math.round(a * (1 - n_(fx) / 100)));
  },
  'lantern-aura.a3:resist': fx => {
    const [a, b] = ab('lantern-aura', 'a3', w => { w.sys.aura = 'lantern-aura'; w.sys.resists = { fire: 0, cold: 0, lightning: 0, arcane: 0 }; (w.sys as unknown as { biteKeeper(n: number, t: string): void }).biteKeeper(100, 'cold'); return w.hurt.reduce((x, y) => x + y, 0); });
    expect(b).toBe(Math.round(a * (1 - n_(fx) / 100)));
  },
  'pack-bond.b2:resist': fx => {
    const [a, b] = ab('pack-bond', 'b2', w => { w.sys.aura = 'pack-bond'; w.sys.resists = { fire: 0, cold: 0, lightning: 0, arcane: 0 }; (w.sys as unknown as { biteKeeper(n: number, t: string): void }).biteKeeper(100, 'lightning'); return w.hurt.reduce((x, y) => x + y, 0); });
    expect(b).toBe(Math.round(a * (1 - n_(fx) / 100)));
  },
  'aura-siphon.b2:lowDouble': () => {
    const heal = (mask: number, hp: number) => { const w = world('warlock', { 'aura-siphon': 10, 'drain-life': 1 }, mask ? { 'aura-siphon': mask } : {}); w.sys.aura = 'aura-siphon'; w.life.hp = hp; const m = dummy(w, 2 * TILE); w.sys.target = m; w.sys.useAbility('drain-life'); return w.healed[0]; };
    expect(heal(bit('b2'), 1000)).toBe(heal(0, 1000) * 2);
    expect(heal(bit('b2'), 4000)).toBe(heal(0, 4000));
  },
  'aura-watchfire.a3:lowDouble': () => {
    const mend = (mask: number) => { const w = world('ashguard', { 'aura-watchfire': 10 }, mask ? { 'aura-watchfire': mask } : {}); w.sys.vocation = 'ashguard'; w.sys.aura = 'aura-watchfire'; w.life.hp = 1000; run(w, 5.01); return w.healed.reduce((a, b) => a + b, 0); };
    expect(mend(bit('a3'))).toBeCloseTo(mend(0) * 2, -1);
  },
  'aura-embers.a2:struck': fx => {
    const w = withMarks('aura-embers', bit('a2')); w.sys.aura = 'aura-embers';
    const b = biter(w, 1); run(w, .1);
    expect((b.scorchT ?? 0) > 0).toBeTrue();
    expect(b.scorchT!).toBeLessThanOrEqual(fx.s!);
  },
  'volley.a2:pierce': () => {
    const w = withMarks('volley', bit('a2')), a = dummy(w, 2 * TILE, ARROW_Y), b = dummy(w, 2 * TILE + 12, ARROW_Y);
    w.sys.target = a; cast(w, 'volley'); run(w, .8);
    expect(lost(b)).toBeGreaterThan(0);
  },
  'bone-storm.a3:ringFan': () => {
    const w = withMarks('bone-storm', bit('a3')), a = dummy(w, 2 * TILE, SPEAR_Y), behind = dummy(w, -2 * TILE, SPEAR_Y);
    w.sys.target = a; cast(w, 'bone-storm'); run(w, .8);
    expect(lost(behind)).toBeGreaterThan(0);
  },
  'volley.a3:ringFan': () => {
    // A full ring: the arrows fly every way round, behind him too.
    const w = withMarks('volley', bit('a3')), a = dummy(w, 2 * TILE, ARROW_Y);
    w.sys.target = a; cast(w, 'volley');
    expect(w.sys.arrows.some(x => x.vx < -1)).toBeTrue();
    const w0 = withMarks('volley', 0), a0 = dummy(w0, 2 * TILE, ARROW_Y); w0.sys.target = a0; cast(w0, 'volley');
    expect(w0.sys.arrows.some(x => x.vx < -1)).toBeFalse();
  },
  'aura-watchfire.b3:hearth': () => {
    const [a, b] = ab('aura-watchfire', 'b3', w => { w.sys.vocation = 'ashguard'; w.sys.aura = 'aura-watchfire'; return w.sys.inHearth ? 1 : 0; });
    expect([a, b]).toEqual([0, 1]);
  },
  'beacon.b3:hearthNear': fx => {
    const [a, b] = ab('beacon', 'b3', w => { w.sys.vocation = 'lanternwright'; cast(w, 'beacon'); return w.sys.inHearth ? 1 : 0; });
    expect([a, b]).toEqual([0, 1]);
    const w = withMarks('beacon', bit('b3')); cast(w, 'beacon'); w.keeper.x = (n_(fx) + 1.5) * TILE;
    expect(w.sys.inHearth).toBeFalse();
  },
  'rootwalk.b3:hearth': () => {
    const [a, b] = ab('rootwalk', 'b3', w => { w.sys.vocation = 'thornstrider'; cast(w, 'rootwalk'); return w.sys.inHearth ? 1 : 0; });
    expect([a, b]).toEqual([0, 1]);
  },
  'cinder-rain.a3:followFoe': () => {
    const w = withMarks('cinder-rain', bit('a3')), m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'cinder-rain');
    m.x += 2 * TILE; run(w, 1.5);
    expect(w.sys.zones[0].x).toBeGreaterThan(2 * TILE + 4);
  },
  'dawn-at-noon.a3:followSelf': () => {
    const w = withMarks('dawn-at-noon', bit('a3')); cast(w, 'dawn-at-noon'); w.keeper.x = 50; run(w, .1);
    expect(w.sys.zones[0].x).toBe(50);
  },
  'hearth-circle.a3:followSelf': () => {
    const w = withMarks('hearth-circle', bit('a3')); cast(w, 'hearth-circle'); w.keeper.x = 50; run(w, .1);
    expect(w.sys.zones[0].x).toBe(50);
  },
  'doom.a3:strip': fx => {
    const w = withMarks('doom', bit('a3')), m = dummy(w, 2 * TILE);
    m.elite = { rank: 'champion', role: 'leader', affixes: ['stone-skin', 'fire-enchanted'] } as unknown as NonNullable<Mob['elite']>;
    w.sys.target = m; cast(w, 'doom'); run(w, 4.2);
    expect(m.elite!.affixes).not.toContain('stone-skin' as never);
    run(w, fx.s! + .5);
    expect(m.elite!.affixes).toContain('stone-skin' as never);
  },
  'banish.a3:strip': () => {
    const w = withMarks('banish', bit('a3')), m = dummy(w, 2 * TILE);
    m.elite = { rank: 'champion', role: 'leader', affixes: ['stone-skin'] } as unknown as NonNullable<Mob['elite']>;
    w.sys.target = m; cast(w, 'banish');
    expect(m.elite!.affixes.length).toBe(0);
  },
  // ── the Warlock's ──
  'aura-embers.a3:fireUp': fx => {
    const [a, b] = ab('aura-embers', 'a3', w => { w.sys.aura = 'aura-embers'; return w.sys.fireMult; });
    expect(b / a).toBeCloseTo(1 + n_(fx) / 100, 5);
  },
  'flame-wall.a3:ring': fx => {
    const w = withMarks('flame-wall', bit('a3')), m = dummy(w, 3 * TILE); w.sys.target = m; cast(w, 'flame-wall');
    for (const q of w.sys.zones[0].pts!) expect(Math.hypot(q.x - m.x, q.y - m.y)).toBeCloseTo(n_(fx) * TILE, 0);
  },
  'thornroot-snare.a3:ring': fx => {
    const w = withMarks('thornroot-snare', bit('a3')), m = dummy(w, 3 * TILE); w.sys.target = m; cast(w, 'thornroot-snare');
    for (const q of w.sys.zones[0].pts!) expect(Math.hypot(q.x - m.x, q.y - m.y)).toBeCloseTo(n_(fx) * TILE, 0);
  },
  'flame-wall.b2:slowZone': fx => {
    const w = withMarks('flame-wall', bit('b2')), m = dummy(w, 3 * TILE); w.sys.target = m; cast(w, 'flame-wall');
    const pace = (w.sys as unknown as { paceOf(m: Mob): number }).paceOf(m);
    expect(pace).toBeCloseTo(1 - n_(fx) / 100, 2);
  },
  'flame-wall.b3:cross': fx => {
    const w = withMarks('flame-wall', bit('b3')), m = dummy(w, 3 * TILE); w.sys.target = m; cast(w, 'flame-wall');
    expect(w.sys.zones.length).toBe(2);
    expect(w.sys.zones[0].min).toBeCloseTo(w.sys.v('flame-wall')['dps'] * n_(fx) / 100, 5);
  },
  'meteor.b3:split': fx => {
    const w = withMarks('meteor', bit('b3')), m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'meteor');
    run(w, w.sys.v('meteor')['delay'] + .05);
    expect(w.sys.zones.filter(z => z.kind === 'meteor' && z.frag).length).toBe(fx.m!);
  },
  'bone-spear.a3:twin': () => {
    const w = withMarks('bone-spear', bit('a3')), m = dummy(w, 2 * TILE, SPEAR_Y); w.sys.target = m; cast(w, 'bone-spear');
    expect(w.sys.spears.length).toBe(2);
  },
  'bone-spear.b3:return': fx => {
    const w = withMarks('bone-spear', bit('b3')), m = dummy(w, 2 * TILE, SPEAR_Y); w.sys.target = m; cast(w, 'bone-spear');
    const first = w.sys.spears[0]; run(w, first.life + .05);
    expect(w.sys.spears.some(s => s.vx === -first.vx && s.dmg![1] === Math.round(first.dmg![1] * n_(fx) / 100))).toBeTrue();
  },
  'raise-skeleton.a3:captain': fx => {
    const w = withMarks('raise-skeleton', bit('a3')); cast(w, 'raise-skeleton');
    const [cap, other] = w.sys.minions;
    expect(cap.maxHp).toBe(other.maxHp * n_(fx));
  },
  'raise-skeleton.b3:crumble': () => {
    const w = withMarks('raise-skeleton', bit('b3')); cast(w, 'raise-skeleton');
    const k = w.sys.minions[0], m = dummy(w, k.x + 4, k.y); k.hp = 0; run(w, .05);
    expect(lost(m)).toBeGreaterThan(0);
  },
  'corpse-burst.a2:shards': fx => {
    const w = withMarks('corpse-burst', bit('a2')); w.sys.corpses.push({ x: TILE, y: 0, at: 0 }); cast(w, 'corpse-burst');
    expect(w.sys.spears.length).toBe(fx.m!);
  },
  'corpse-burst.a3:chain': () => {
    const w = withMarks('corpse-burst', bit('a3')), far = dummy(w, 5 * TILE);
    w.sys.corpses.push({ x: TILE, y: 0, at: 0 }, { x: 3 * TILE, y: 0, at: 0 }, { x: 5 * TILE, y: 0, at: 0 });
    cast(w, 'corpse-burst');
    expect(w.sys.corpses.length).toBe(0);
    expect(lost(far)).toBeGreaterThan(0);
  },
  'bone-armor.a2:thorns': fx => {
    const w = withMarks('bone-armor', bit('a2')); cast(w, 'bone-armor');
    const b = biter(w, 20); run(w, .05);
    expect(lost(b)).toBe(Math.round(20 * n_(fx) / 100));
  },
  'bone-armor.a3:breakRaise': fx => {
    const w = withMarks('bone-armor', bit('a3'), { 'raise-skeleton': 1 }); cast(w, 'bone-armor');
    w.sys.bone = 1; biter(w, 50); run(w, .05);
    expect(w.sys.minions.length).toBe(n_(fx));
  },
  'bone-armor.b3:kinGuard': fx => {
    const w = withMarks('bone-armor', bit('b3'), { 'raise-skeleton': 1 }); cast(w, 'raise-skeleton'); cast(w, 'bone-armor');
    const k = w.sys.minions[0], hp = k.hp; (w.sys as unknown as { hurtMinion(k: unknown, n: number): void }).hurtMinion(k, 100);
    expect(hp - k.hp).toBe(Math.round(100 * (1 - n_(fx) / 100)));
  },
  'drain-life.a2:overheal': fx => {
    // At full life the whole heal pours over: it becomes a ward, up to its most.
    const w = withMarks('drain-life', bit('a2')), m = dummy(w, 2 * TILE); w.life.hp = 5000; w.sys.target = m; cast(w, 'drain-life');
    expect(w.sys.markShield).toBe(Math.min(n_(fx), w.healed[0]));
    expect(w.sys.markShield).toBeGreaterThan(0);
  },
  'drain-life.b3:kinHeal': () => {
    const w = withMarks('drain-life', bit('b3'), { 'raise-skeleton': 1 }); cast(w, 'raise-skeleton');
    const k = w.sys.minions[0]; k.hp = 1; const m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'drain-life');
    expect(k.hp).toBeGreaterThan(1);
  },
  'aura-siphon.a3:kinHeal': () => {
    const w = withMarks('aura-siphon', bit('a3'), { 'raise-skeleton': 1, 'drain-life': 1 }); cast(w, 'raise-skeleton');
    w.sys.aura = 'aura-siphon'; const k = w.sys.minions[0]; k.hp = 1; const m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'drain-life');
    expect(k.hp).toBeGreaterThan(1);
  },
  'ember-curse.a2:spread': () => {
    const w = withMarks('ember-curse', bit('a2')), a = dummy(w, 2 * TILE, 0, DUMMY, 1), b = dummy(w, 2 * TILE + 20);
    w.sys.target = a; cast(w, 'ember-curse'); run(w, 1.2);
    expect(a.hp).toBeLessThanOrEqual(0);
    expect(b.cursed).toBeGreaterThan(0);
  },
  'ember-curse.a3:hexRing': () => {
    const w = withMarks('ember-curse', bit('a3')), a = dummy(w, 2 * TILE), b = dummy(w, 2 * TILE + 20);
    w.sys.target = a; cast(w, 'ember-curse');
    expect(b.cursed).toBeGreaterThan(0);
  },
  'ember-curse.b2:cursedKill': fx => {
    const w = withMarks('ember-curse', bit('b2')), a = dummy(w, 2 * TILE, 0, DUMMY, 1);
    w.sys.target = a; cast(w, 'ember-curse'); w.sys.mana = 50; w.sys.maxMana = 999; w.sys.regen = 0; run(w, 1.2);
    expect(a.hp).toBeLessThanOrEqual(0);
    expect(w.sys.mana).toBeCloseTo(50 + n_(fx), 0);
  },
  'dark-ward.a3:shroud': fx => {
    const shots = (mask: number) => { const w = withMarks('dark-ward', mask); cast(w, 'dark-ward'); const s = w.sys.place('s', { ...DUMMY, hp: 1e7, sight: 999, dmg: [0, 0], rate: 999, speed: 0, ranged: { dmg: [5, 5], range: 200, rate: .5, speed: 120, kind: 'arrow', keep: 0 } } as unknown as MobDef, (n_(fx) + 2) * TILE, 0); s.rcd = 0; run(w, 1); return w.sys.shots.length + w.hurt.length; };
    expect(shots(0)).toBeGreaterThan(0);
    expect(shots(bit('a3'))).toBe(0);
  },
  'dark-ward.b3:breakBurst': () => {
    const w = withMarks('dark-ward', bit('b3')), m = dummy(w, TILE); cast(w, 'dark-ward');
    w.sys.ward = 1; biter(w, 50, 12); run(w, .05);
    expect(lost(m)).toBeGreaterThan(0);
  },
  'doom.a2:doomTwo': () => {
    const w = withMarks('doom', bit('a2')), a = dummy(w, 2 * TILE), b = dummy(w, 2 * TILE + 20);
    w.sys.target = a; cast(w, 'doom');
    expect(b.doom ?? 0).toBeGreaterThan(0);
  },
  'doom.b3:doomOnDeath': () => {
    const w = withMarks('doom', bit('b3')), a = dummy(w, 2 * TILE, 0, DUMMY, 1e7), b = dummy(w, 2 * TILE + 10);
    w.sys.target = a; cast(w, 'doom'); w.sys.smite(a);
    expect(lost(b)).toBeGreaterThan(0);
  },
  // ── the Ashguard's ──
  'watch-blade.b1:speed': fx => {
    const [a, b] = ab('watch-blade', 'b1', w => { w.sys.vocation = 'ashguard'; const m = dummy(w, TILE); w.sys.target = m; run(w, 20); return w.sys.swings; });
    expect(b / a).toBeCloseTo(1 + n_(fx) / 100, 1);
  },
  'ember-brand.a2:brandSpread': () => {
    const w = withMarks('ember-brand', bit('a2')), a = dummy(w, TILE, 0, DUMMY, 1e7), b = dummy(w, TILE + 20);
    cast(w, 'ember-brand'); a.brandT = 3; a.brandDps = 5; a.brandTicks = 3; w.sys.smite(a);
    expect(b.brandT ?? 0).toBeGreaterThan(0);
  },
  'ember-brand.a3:keptFire': () => {
    const w = withMarks('ember-brand', bit('a3')); cast(w, 'ember-brand'); run(w, w.sys.v('ember-brand')['secs'] + 2);
    expect(w.sys.brandT).toBeGreaterThan(0);
    const w0 = withMarks('ember-brand', 0); cast(w0, 'ember-brand'); run(w0, w0.sys.v('ember-brand')['secs'] + 2);
    expect(w0.sys.brandT).toBe(0);
  },
  'ember-brand.b3:blockBrand': () => {
    const w = withMarks('ember-brand', bit('b3')); cast(w, 'ember-brand'); w.sys.gearBlock = 1;
    const b = biter(w, 10); run(w, .05);
    expect(b.brandT ?? 0).toBeGreaterThan(0);
  },
  'cinder-cleave.b3:sunder': fx => {
    const w = withMarks('cinder-cleave', bit('b3')), m = dummy(w, TILE); w.sys.target = m;
    for (let i = 0; i < 5; i++) cast(w, 'cinder-cleave');
    expect(m.sunderN).toBe(fx.m!);
  },
  'whirl-of-cinders.a2:pull': fx => {
    const w = withMarks('whirl-of-cinders', bit('a2')), m = dummy(w, 2.5 * TILE); cast(w, 'whirl-of-cinders');
    expect(m.x).toBeCloseTo(2.5 * TILE - n_(fx) * TILE, 0);
  },
  'watch-cry.a3:pull': fx => {
    const w = withMarks('watch-cry', bit('a3')), m = dummy(w, 3 * TILE); cast(w, 'watch-cry');
    expect(m.x).toBeCloseTo(3 * TILE - n_(fx) * TILE, 0);
  },
  'whirl-of-cinders.a3:whirlHaste': fx => {
    const w = withMarks('whirl-of-cinders', bit('a3')); cast(w, 'whirl-of-cinders');
    expect(w.sys.markPace).toBeCloseTo(n_(fx) / 100, 5);
  },
  'shield-bash.a2:concuss': fx => {
    const w = withMarks('shield-bash', bit('a2')), m = dummy(w, TILE); w.sys.target = m; cast(w, 'shield-bash');
    expect(m.hushT).toBeCloseTo((m.stun ?? 0) + (fx.s ?? 0), 2);
  },
  'shield-bash.a3:rush': () => {
    const w = withMarks('shield-bash', bit('a3')), m = dummy(w, 3 * TILE); w.sys.target = m;
    expect(cast(w, 'shield-bash')).toBeNull();
    expect(w.keeper.x).toBeGreaterThan(TILE);
    const w0 = withMarks('shield-bash', 0), m0 = dummy(w0, 3 * TILE); w0.sys.target = m0;
    expect(cast(w0, 'shield-bash')).toBe('nofoe');
  },
  'shield-bash.b2:stampStun': () => {
    const w = withMarks('shield-bash', bit('b2')), m = dummy(w, TILE), b = dummy(w, TILE + 10); w.sys.target = m; cast(w, 'shield-bash');
    expect(b.stun ?? 0).toBeGreaterThan(0);
  },
  'shield-bash.b3:wideBash': () => {
    const w = withMarks('shield-bash', bit('b3')), m = dummy(w, TILE, -4), b = dummy(w, TILE, 8); w.sys.target = m; cast(w, 'shield-bash');
    expect(lost(b)).toBeGreaterThan(0);
  },
  'shield-oath.a2:counter': () => {
    const w = withMarks('shield-oath', bit('a2'), { 'watch-blade': 1 }); w.sys.vocation = 'ashguard'; cast(w, 'shield-oath'); w.sys.blockPct = 100;
    const b = biter(w, 10); run(w, .05);
    expect(lost(b)).toBeGreaterThan(0);
  },
  'shield-oath.a3:blockHeal': fx => {
    const w = withMarks('shield-oath', bit('a3')); w.sys.vocation = 'ashguard'; cast(w, 'shield-oath'); w.sys.blockPct = 100; w.life.hp = 1000;
    biter(w, 10); run(w, .05);
    expect(w.healed.reduce((a, b) => a + b, 0)).toBe(5000 * n_(fx) / 100);
  },
  'shield-oath.b3:blockMana': fx => {
    const w = withMarks('shield-oath', bit('b3')); w.sys.vocation = 'ashguard'; cast(w, 'shield-oath'); w.sys.blockPct = 100; w.sys.mana = 10; w.sys.maxMana = 999; w.sys.regen = 0;
    biter(w, 10); run(w, .05);
    expect(w.sys.mana).toBeCloseTo(10 + n_(fx), 0);
  },
  'watch-cry.b3:fearsome': () => {
    const w = withMarks('watch-cry', bit('b3')); w.sys.keeperLevel = 30; const m = dummy(w, TILE, 0, { ...DUMMY, level: 2 }); cast(w, 'watch-cry');
    expect(m.fearT ?? 0).toBeGreaterThan(0);
    expect(m.taunt ?? 0).toBe(0);
  },
  'ash-stride.a3:again': () => {
    const w = withMarks('ash-stride', bit('a3')), m = dummy(w, 3 * TILE); w.sys.target = m;
    expect(w.sys.useAbility('ash-stride')).toBeNull();
    w.keeper.x = 0; w.sys.mana = 0;
    expect(w.sys.useAbility('ash-stride')).toBeNull();
    expect(w.sys.useAbility('ash-stride')).toBe('cooldown');
  },
  'ash-stride.b3:through': () => {
    const w = withMarks('ash-stride', bit('b3')), m = dummy(w, 3 * TILE), mid = dummy(w, 1.5 * TILE); w.sys.target = m; cast(w, 'ash-stride');
    expect(lost(mid)).toBeGreaterThan(0);
  },
  'last-watch.a2:wrath': fx => {
    const w = withMarks('last-watch', bit('a2')), m = dummy(w, TILE);
    expect(blow(w, m, 'cinder-cleave')).toBe(100);
    cast(w, 'last-watch');
    expect(blow(w, m, 'cinder-cleave')).toBe(100 + n_(fx));
  },
  'last-watch.a3:vowLeech': fx => {
    const w = withMarks('last-watch', bit('a3'), { 'cinder-cleave': 10 }); w.life.hp = 1000; w.sys.power = 10; const m = dummy(w, TILE);
    cast(w, 'last-watch'); w.sys.target = m;
    for (let i = 0; i < 10; i++) cast(w, 'cinder-cleave');
    expect(w.healed.reduce((a, b) => a + b, 0)).toBeCloseTo(lost(m) * n_(fx) / 100, -1);
  },
  'last-watch.b3:vowTaunt': () => {
    const w = withMarks('last-watch', bit('b3')); w.sys.vocation = 'ashguard'; const m = dummy(w, 2 * TILE); cast(w, 'last-watch'); run(w, .1);
    expect(m.taunt ?? 0).toBeGreaterThan(0);
  },
  // ── the Lanternwright's ──
  'kindle.b2:bane': fx => {
    const w0 = withMarks('kindle', bit('b2')), d0 = dummy(w0, TILE, 0, DEAD), l0 = dummy(w0, TILE + 30);
    expect(blow(w0, d0, 'kindle')).toBe(100 + n_(fx));
    expect(blow(w0, l0, 'kindle')).toBe(100);
    const per = (mask: number) => { let s = 0, n = 0; for (let i = 0; i < 150; i++) { const w = withMarks('kindle', mask), m = dummy(w, 2 * TILE, 0, DEAD); w.sys.target = m; run(w, .7); s += lost(m); n += w.sys.flares; } return s / n; };
    expect(shadowBorn(DEAD.id)).toBeTrue();
    expect(per(bit('b2')) / per(0)).toBeCloseTo(1 + n_(fx) / 100, 1);
  },
  'lantern-aura.a2:regen': fx => {
    const w = withMarks('lantern-aura', bit('a2')); w.sys.vocation = 'lanternwright'; w.sys.aura = 'lantern-aura'; w.life.hp = 1000; run(w, 2);
    expect(w.healed.reduce((a, b) => a + b, 0)).toBeCloseTo(5000 * n_(fx) / 100 * 2, -1);
  },
  'lantern-aura.b3:baneAura': fx => {
    const w = world('lanternwright', { 'lantern-aura': 10 }, { 'lantern-aura': bit('b3') }); w.sys.vocation = 'lanternwright'; w.sys.aura = 'lantern-aura';
    const near = dummy(w, TILE, 0, DEAD), far = dummy(w, 12 * TILE, 0, DEAD), living = dummy(w, TILE, 4);
    expect(blow(w, near, null)).toBe(100 + n_(fx));
    expect(blow(w, far, null)).toBe(100);
    expect(blow(w, living, null)).toBe(100);
    w.sys.aura = null;
    expect(blow(w, near, null)).toBe(100);
  },
  'shutter-lantern.a1:shutSpeed': fx => {
    const w = withMarks('shutter-lantern', bit('a1')); w.sys.vocation = 'lanternwright'; cast(w, 'shutter-lantern');
    expect(w.sys.shuttered).toBeTrue();
    expect(w.sys.markPace).toBeCloseTo(n_(fx) / 100, 5);
  },
  'shutter-lantern.a2:quietSight': () => {
    const hunts = (mask: number) => { const w = withMarks('shutter-lantern', mask); w.sys.vocation = 'lanternwright'; cast(w, 'shutter-lantern'); const m = w.sys.place('h', { ...DUMMY, hp: 1e7, sight: 4 * TILE, speed: 40 }, 3.5 * TILE, 0); run(w, .5); return m.x < 3.5 * TILE - 2 ? 1 : 0; };
    expect(hunts(0)).toBe(1);
    expect(hunts(bit('a2'))).toBe(0);
  },
  'shutter-lantern.a3:mothHours': () => {
    const hunts = (mask: number) => { const w = withMarks('shutter-lantern', mask); w.sys.vocation = 'lanternwright'; cast(w, 'shutter-lantern'); const m = w.sys.place('h', { ...DEAD, hp: 1e7, sight: 999, speed: 40 }, 3 * TILE, 0); m.hp = m.def.hp; run(w, .5); return m.x < 3 * TILE - 2 ? 1 : 0; };
    expect(hunts(0)).toBe(1);
    expect(hunts(bit('a3'))).toBe(0);
  },
  'shutter-lantern.b2:keptLight': fx => {
    const w = withMarks('shutter-lantern', bit('b2')); w.sys.vocation = 'lanternwright'; cast(w, 'shutter-lantern');
    expect(w.sys.lightBonus).toBeGreaterThanOrEqual(n_(fx));
  },
  'shutter-lantern.b3:flareOpen': () => {
    const w = withMarks('shutter-lantern', bit('b3'), { 'blinding-flash': 1 }), m = dummy(w, TILE); w.sys.vocation = 'lanternwright';
    cast(w, 'shutter-lantern'); expect(lost(m)).toBe(0);
    cast(w, 'shutter-lantern'); expect(lost(m)).toBeGreaterThan(0);
  },
  'banish.b3:unmakeHush': () => {
    // One of the dead low enough is unmade outright; the unmaking hushes what stands near it.
    const w = withMarks('banish', bit('b3')), m = dummy(w, 2 * TILE, 0, DEAD), b = dummy(w, 2 * TILE + 20);
    m.hp = 1e6;
    w.sys.target = m; cast(w, 'banish');
    expect(m.hp).toBeLessThanOrEqual(0);
    expect(b.hushT ?? 0).toBeGreaterThan(0);
  },
  'dawn-at-noon.a2:zoneRegen': () => {
    const w = withMarks('dawn-at-noon', bit('a2')); w.life.hp = 1000; cast(w, 'dawn-at-noon'); run(w, 2);
    expect(w.healed.reduce((a, b) => a + b, 0)).toBeGreaterThan(100);
  },
  'dawn-at-noon.b3:zoneHush': () => {
    const w = withMarks('dawn-at-noon', bit('b3')), m = dummy(w, TILE); cast(w, 'dawn-at-noon');
    expect((w.sys as unknown as { hushed(m: Mob): boolean }).hushed(m)).toBeTrue();
  },
  'hearthlight.a2:quickMend': fx => {
    const w = withMarks('hearthlight', bit('a2')); w.life.hp = 100; cast(w, 'hearthlight');
    expect(w.healed[0]).toBe(Math.round(w.sys.v('hearthlight')['heal'] * n_(fx) / 100));
  },
  'hearthlight.b3:defBuff': fx => {
    const w = withMarks('hearthlight', bit('b3')); cast(w, 'hearthlight');
    expect(w.sys.defBuffPct).toBe(n_(fx)); expect(w.sys.defBuffT).toBe(fx.s!);
  },
  'hearth-circle.a2:zoneGuard': fx => {
    const [a, b] = ab('hearth-circle', 'a2', w => { cast(w, 'hearth-circle'); (w.sys as unknown as { biteKeeper(n: number, t: string): void }).biteKeeper(100, 'fire'); return w.hurt[0]; });
    expect(b).toBe(Math.round(a * (1 - n_(fx) / 100)));
  },
  'hearth-circle.b3:noChill': () => {
    const w = withMarks('hearth-circle', bit('b3')); cast(w, 'hearth-circle');
    const m = dummy(w, TILE); m.elite = { rank: 'champion', role: 'leader', affixes: ['cold-aura'] } as unknown as NonNullable<Mob['elite']>; run(w, .05);
    expect(w.sys.chill).toBe(0);
  },
  'lantern-ward.a2:breakHeal': fx => {
    const w = withMarks('lantern-ward', bit('a2')); w.sys.vocation = 'lanternwright'; w.life.hp = 1000; cast(w, 'lantern-ward');
    w.sys.lampWard = 1; biter(w, 50); run(w, .05);
    expect(w.healed.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(Math.floor(w.sys.v('lantern-ward')['absorb'] * n_(fx) / 100));
  },
  'lantern-ward.b3:breakBurst': () => {
    const w = withMarks('lantern-ward', bit('b3')), m = dummy(w, TILE); w.sys.vocation = 'lanternwright'; cast(w, 'lantern-ward');
    w.sys.lampWard = 1; biter(w, 50, 12); run(w, .05);
    expect(lost(m)).toBeGreaterThan(0);
  },
  'lamp-wisp.a2:moteHeal': () => {
    const [a, b] = ab('lamp-wisp', 'a2', w => { w.sys.vocation = 'lanternwright'; w.life.hp = 1000; const m = dummy(w, 2 * TILE); void m; cast(w, 'lamp-wisp'); run(w, 3); return w.life.hp; });
    expect(b).toBeGreaterThan(a);
  },
  'lamp-wisp.a3:swarm': fx => {
    const [a, b] = ab('lamp-wisp', 'a3', w => { cast(w, 'lamp-wisp'); return w.sys.wisps.length; });
    expect(b - a).toBe(fx.m!);
  },
  'lamp-wisp.b3:wispWard': () => {
    const w = withMarks('lamp-wisp', bit('b3')); cast(w, 'lamp-wisp');
    expect(w.sys.wisps.every(x => x.ward)).toBeTrue();
  },
  'beacon.a2:poleRegen': () => {
    const w = withMarks('beacon', bit('a2')); w.sys.vocation = 'lanternwright'; w.life.hp = 1000; cast(w, 'beacon'); run(w, 2);
    expect(w.healed.reduce((a, b) => a + b, 0)).toBeGreaterThan(50);
  },
  'beacon.a3:twoBeacons': fx => {
    const w = withMarks('beacon', bit('a3')); for (let i = 0; i < 3; i++) cast(w, 'beacon');
    expect(w.sys.beacons.length).toBe(n_(fx));
  },
  'beacon.b2:poleSpeed': fx => {
    const w = withMarks('beacon', bit('b2')); cast(w, 'beacon');
    expect(w.sys.markPace).toBeCloseTo(n_(fx) / 100, 5);
  },
  // ── the Thornstrider's ──
  'barbed-shot.b2:twinArrow': () => {
    const w = withMarks('barbed-shot', bit('b2')), m = dummy(w, 2 * TILE, ARROW_Y); w.sys.target = m; cast(w, 'barbed-shot');
    expect(w.sys.arrows.length).toBe(2);
  },
  'barbed-shot.b3:bleedSpread': fx => {
    const w = withMarks('barbed-shot', bit('b3')), a = dummy(w, 2 * TILE, 0, DUMMY, 1e7), others = [dummy(w, 2 * TILE + 14), dummy(w, 2 * TILE + 24), dummy(w, 2 * TILE + 30)];
    a.bleedT = 3; a.bleedDps = 4; w.sys.smite(a);
    expect(others.filter(o => (o.bleedT ?? 0) > 0).length).toBe(fx.m!);
  },
  'command.a3:commandWeaken': fx => {
    const w = withMarks('command', bit('a3')), m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'command');
    expect((w.sys as unknown as { weakOf(m: Mob): number }).weakOf(m)).toBe(n_(fx));
  },
  'command.b3:vsCommanded': fx => {
    const w = withMarks('command', bit('b3')), m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'command');
    expect((w.sys as unknown as { markHitMult(m: Mob, s: SkillId | null): number }).markHitMult(m, null)).toBeCloseTo(1 + n_(fx) / 100, 5);
  },
  'pack-bond.a2:sharedHurt': fx => {
    const [a, b] = ab('pack-bond', 'a2', w => { w.sys.vocation = 'thornstrider'; w.sys.aura = 'pack-bond'; w.sys.beast = { x: 4, y: 0 }; (w.sys as unknown as { biteKeeper(n: number, t: string): void }).biteKeeper(100, 'fire'); return w.hurt[0]; });
    expect(Math.abs(b - a * (1 - n_(fx) / 100))).toBeLessThanOrEqual(1);
  },
  'pack-bond.b3:biteHeal': () => {
    const w = withMarks('pack-bond', bit('b3')); w.sys.vocation = 'thornstrider'; w.sys.aura = 'pack-bond'; w.life.hp = 1000;
    const m = dummy(w, TILE); for (let i = 0; i < 10; i++) w.sys.petBite(m, 50, 1);
    expect(w.healed.length).toBeGreaterThan(0);
  },
  'call-of-the-wilds.a3:twoCalled': fx => {
    const w = withMarks('call-of-the-wilds', bit('a3')); cast(w, 'call-of-the-wilds');
    const called = w.sys.beasts.filter(b => b.kind === 'called');
    expect(called.length).toBe(2);
    expect(called[0].dmg[1]).toBe(Math.round(w.sys.v('call-of-the-wilds')['max'] * n_(fx) / 100));
  },
  'stampede.b3:herdHeal': fx => {
    const w = withMarks('stampede', bit('b3')); w.life.hp = 1000; cast(w, 'stampede');
    expect(w.healed.reduce((a, b) => a + b, 0)).toBe(Math.floor(5000 * n_(fx) / 100 * w.sys.v('stampede')['count']));
  },
  'thornroot-snare.a2:regrasp': fx => {
    // A foe that stays in the thorns (pinned where it was caught) is rooted again every few seconds.
    const w = withMarks('thornroot-snare', bit('a2')), m = dummy(w, 2 * TILE); w.sys.target = m; cast(w, 'thornroot-snare'); run(w, .1);
    m.rootT = 0;
    let again = false;
    for (let t = 0; t < (fx.s ?? 0) + .2; t += .02) { m.x = 2 * TILE; m.y = 0; w.sys.update(.02); if ((m.rootT ?? 0) > 0) again = true; }
    expect(again).toBeTrue();
  },
  'bramble-trap.a3:traps': fx => {
    const w = withMarks('bramble-trap', bit('a3')); for (let i = 0; i < 5; i++) cast(w, 'bramble-trap');
    expect(w.sys.zones.filter(z => z.kind === 'trap').length).toBe(n_(fx));
  },
  'bramble-trap.b2:throwTrap': () => {
    const w = withMarks('bramble-trap', bit('b2')), m = dummy(w, 4 * TILE); cast(w, 'bramble-trap');
    expect(w.sys.zones[0].x).toBe(m.x);
  },
  'rootwalk.a2:leafCrit': () => {
    const w = withMarks('rootwalk', bit('a2'), { 'thorn-shot': 1 }); w.sys.vocation = 'thornstrider'; cast(w, 'rootwalk');
    const m = dummy(w, 2 * TILE, ARROW_Y); w.sys.target = m; w.sys.update(.02);
    expect(w.sys.arrows[0]?.crit).toBeTrue();
  },
  'rootwalk.a3:walkGuard': fx => {
    const [a, b] = ab('rootwalk', 'a3', w => { cast(w, 'rootwalk'); (w.sys as unknown as { biteKeeper(n: number, t: string): void }).biteKeeper(100, 'fire'); return w.hurt[0]; });
    expect(b).toBe(Math.round(a * (1 - n_(fx) / 100)));
  },
};

describe('td-truth-marks 5: every named rule does what its line says', () => {
  for (const id of ROWS) for (const d of MARKS[id]!) for (const fx of markFlags(id, bit(d.slot))) {
    const key = `${id}.${d.slot}:${fx.f}`;
    it(`${key} (${I18N[d.nameKey].en})`, () => {
      const probe = RULES[key];
      expect(probe).withContext(`${key} needs a probe`).toBeDefined();
      probe?.(fx);
    });
  }
});

// ── The rules of the book (td-tree) ──────────────────────────────────────────────────────────────────────────────

describe('td-truth-marks: the book\'s rules', () => {
  const tree = (spent: Record<string, number>, nodes: Record<string, number> = {}): KeeperSkillTree => ({ spent, free: [], nodes, book: 2, at: 1 });
  it('a mark costs a point; node 2 needs rank 5, node 3 rank 10; a branch goes in order; one star a row', () => {
    let t = tree({ 'hellfire-nova': 3 });
    expect(markBlock(t, 'warlock', 'hellfire-nova', 'a2', 30)).toBe('rank');
    expect(markBlock(t, 'warlock', 'hellfire-nova', 'a1', 30)).toBeNull();
    t = buyMark(t, 'warlock', 'hellfire-nova', 'a1', 30)!;
    expect(pointsSpent(t)).toBe(4);
    t = { ...t, spent: { 'hellfire-nova': 9 } };
    expect(markBlock(t, 'warlock', 'hellfire-nova', 'b2', 30)).toBe('prev');
    t = buyMark(t, 'warlock', 'hellfire-nova', 'a2', 30)!;
    t = buyMark(t, 'warlock', 'hellfire-nova', 'a3', 30)!;
    t = buyMark(buyMark(t, 'warlock', 'hellfire-nova', 'b1', 30)!, 'warlock', 'hellfire-nova', 'b2', 30)!;
    expect(markBlock(t, 'warlock', 'hellfire-nova', 'b3', 30)).toBe('star');
    // The swap moves the point: A3 out, B3 in, the points the same.
    const spent = pointsSpent(t), s = swapStar(t, 'warlock', 'hellfire-nova', 'b3', 30)!;
    expect(effectiveMarks(s, 'warlock')['hellfire-nova']).toBe(MARK_BIT.a1 | MARK_BIT.a2 | MARK_BIT.b1 | MARK_BIT.b2 | MARK_BIT.b3);
    expect(pointsSpent(s)).toBe(spent);
    // Giving a mark back gives back the ones after it on its branch.
    expect(effectiveMarks(dropMark(s, 'warlock', 'hellfire-nova', 'b1')!, 'warlock')['hellfire-nova']).toBe(MARK_BIT.a1 | MARK_BIT.a2);
  });

  it('clamping keeps every mark honest: rank, order, one star, and the level\'s points (marks give back first)', () => {
    const all = MARK_BIT.a1 | MARK_BIT.a2 | MARK_BIT.a3 | MARK_BIT.b1 | MARK_BIT.b2 | MARK_BIT.b3;
    expect(effectiveMarks(clampTree(tree({ 'hellfire-nova': 9 }, { 'hellfire-nova': all }), 'warlock', 60), 'warlock')['hellfire-nova'])
      .toBe(MARK_BIT.a1 | MARK_BIT.a2 | MARK_BIT.a3 | MARK_BIT.b1 | MARK_BIT.b2);
    expect(effectiveMarks(clampTree(tree({ 'hellfire-nova': 3 }, { 'hellfire-nova': MARK_BIT.a1 | MARK_BIT.a2 | MARK_BIT.b2 }), 'warlock', 60), 'warlock')['hellfire-nova']).toBe(MARK_BIT.a1);
    // Level 5: 4 points; 3 ranks and 2 marks are 5 — the deepest row's last mark goes first, the ranks stay.
    const c = clampTree(tree({ 'hellfire-nova': 3 }, { 'hellfire-nova': MARK_BIT.a1 | MARK_BIT.b1 }), 'warlock', 5);
    expect(c.spent['hellfire-nova']).toBe(3);
    expect(effectiveMarks(c, 'warlock')['hellfire-nova']).toBe(MARK_BIT.a1);
    // Another class's marks never count.
    expect(effectiveMarks(clampTree(tree({}, { 'watch-blade': 1 }), 'warlock', 30), 'warlock')).toEqual({});
    for (const v of VOCS) for (let lv = 1; lv <= 40; lv += 3) {
      let t = tree({});
      for (const id of bookRows(v, 'ember').concat(...(['brand', 'lamp', 'thorn'] as const).map(tr => bookRows(v, tr)))) { const n = buyRank(t, v, id, lv); if (n) t = n; for (const s of MARK_SLOTS) { const m = buyMark(t, v, id, s, lv); if (m) t = m; } }
      expect(pointsSpent(clampTree(t, v, lv))).toBeLessThanOrEqual(lv + 2);
    }
  });

  it('a rider list and a flag list read only the marks taken', () => {
    expect(markRiders('ember-bolt', 0)).toEqual([]);
    expect(markRiders('ember-bolt', MARK_BIT.a2).map(r => r.st)).toEqual(['burn']);
    expect(markFlags('hellfire-nova', MARK_BIT.a3).map(f => f.f)).toEqual(['echo' as MarkFlag]);
    expect(castVars('hellfire-nova', 10, null, NO_GEAR_SIG, MARK_BIT.b1)['radius']).toBeCloseTo(castVars('hellfire-nova', 10)['radius'] + 1, 5);
    const d: MarkDef = MARKS['ember-bolt']![0];
    expect(d.slot).toBe('a1');
  });
});

// ── Shared creatures (a room's or a host's: td-coop, world/room-world) ──────────────────────────────────────────

describe('td-truth-marks: the marks on creatures the room runs', () => {
  /** This Keeper as a member under the room: every blow becomes a claim (`/coop/hits`), the room decides. */
  function member(id: SkillId, mask: number): { w: World; claims: number[] } {
    const w = withMarks(id, mask), claims: number[] = [];
    w.sys.replica = true;
    w.sys.coop = { bite: () => undefined, killed: () => undefined, claim: (_m, dmg) => { claims.push(dmg); } };
    return { w, claims };
  }
  it('a claim carries the marks lift (Sure Footing on a chilled foe), and the riders reach the creature it sees', () => {
    const { w, claims } = member('watch-blade', bit('b2')), m = w.sys.replicaMob('r1', DUMMY, TILE, 0);
    m.hp = 1e6; m.chillT = 9;
    blow(w, m, 'watch-blade');
    expect(claims).toEqual([115]);
  });
  it('a burn rider ticks as claims of its own', () => {
    const { w, claims } = member('ember-bolt', bit('a2')), m = w.sys.replicaMob('r1', DUMMY, 2 * TILE, 0); w.sys.mobs.push(m);
    m.hp = 1e6;
    blow(w, m, 'ember-bolt');
    expect((m.scorchT ?? 0) > 0).toBeTrue();
    run(w, 2.2);
    expect(claims.length).toBeGreaterThan(1);
  });
  it('a fall the room announces sets off the marks of the felling skill (Soulfire)', () => {
    const { w } = member('ember-bolt', bit('b3')), m = w.sys.replicaMob('r1', DUMMY, 2 * TILE, 0);
    m.hp = 1e6; w.sys.mana = 50; w.sys.maxMana = 999;
    blow(w, m, 'ember-bolt');
    w.sys.coopFell(m, true, m.def.hp, false);
    expect(w.sys.mana).toBe(53);
  });
});
