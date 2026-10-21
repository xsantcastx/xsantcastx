/**
 * td-prologue.spec.ts — the top-down prologue (td-prologue.ts): one step at a time, in order, read from the save; the
 * three steps a save cannot show are filed; a skip or a veteran's level ends it; the words follow the class and the
 * device (keys or touch).
 */
import {
  PROLOGUE_ROWS, PROLOGUE_STEPS, PROLOGUE_VETERAN_LEVEL, type PrologueFacts, guideFor, prologueOver, prologueStep, prologueView, stepKey,
} from './td-prologue';
import { TD_PROLOGUE_I18N } from './td-prologue.i18n';

const fresh = (over: Partial<PrologueFacts> = {}): PrologueFacts => ({
  level: 1, filed: [], skipped: false, hearthLit: false, hunted: false, goldEarned: false, storyTaken: false, ...over,
});

describe('td prologue', () => {
  it('a fresh Keeper starts at the walk, and each step follows in order as the save shows it done', () => {
    let f = fresh();
    expect(prologueStep(f)).toBe('walk');
    f = { ...f, filed: ['walk'] };
    expect(prologueStep(f)).toBe('hearth');
    f = { ...f, hearthLit: true };
    expect(prologueStep(f)).toBe('fight');
    f = { ...f, hunted: true };
    expect(prologueStep(f)).toBe('gold');
    f = { ...f, goldEarned: true };
    expect(prologueStep(f)).toBe('book');
    f = { ...f, filed: ['walk', 'book'] };
    expect(prologueStep(f)).toBe('bag');
    f = { ...f, filed: ['walk', 'book', 'bag'] };
    expect(prologueStep(f)).toBe('story');
    f = { ...f, storyTaken: true };
    expect(prologueStep(f)).toBeNull();
    expect(prologueOver(f)).toBeTrue();
  });

  it('a step done out of order is skipped past (a kill before the hearth still counts)', () => {
    expect(prologueStep(fresh({ filed: ['walk'], hunted: true, goldEarned: true }))).toBe('hearth');
  });

  it('a skip, or a Keeper who has levelled past the island\'s first hours, never sees it', () => {
    expect(prologueStep(fresh({ skipped: true }))).toBeNull();
    expect(prologueStep(fresh({ level: PROLOGUE_VETERAN_LEVEL }))).toBeNull();
    expect(prologueStep(fresh({ level: PROLOGUE_VETERAN_LEVEL - 1 }))).toBe('walk');
  });

  it('points Glim at the step\'s thing in the world, and only where there is one', () => {
    expect(guideFor('walk')).toBeNull();
    expect(guideFor('hearth')).toBe('hearth');
    expect(guideFor('fight')).toBe('foe');
    expect(guideFor('gold')).toBe('gold');
    expect(guideFor('book')).toBeNull();
    expect(guideFor('story')).toBe('sexton');
    expect(prologueView('hearth', 'warlock', false, '').target).toEqual({ guide: 'hearth' });
    expect(prologueView('book', 'warlock', false, '').target).toBeNull();
  });

  it('speaks the class and the device: the fight names the class\'s own attack and key-1 spell', () => {
    expect(stepKey('fight', 'warlock', false)).toBe('play.pro.fight.warlock.keys');
    expect(stepKey('fight', 'ashguard', true)).toBe('play.pro.fight.ashguard.touch');
    expect(stepKey('fight', 'lanternwright', false)).toBe('play.pro.fight.lanternwright.keys');
    // A class still to come reads the plain line rather than a missing one.
    expect(stepKey('fight', 'thornstrider', false)).toBe('play.pro.fight.any.keys');
    expect(stepKey('walk', 'warlock', true)).toBe('play.pro.walk.touch');
    const v = prologueView('fight', 'lanternwright', false, 'Hearthlight');
    expect(v).toEqual(jasmine.objectContaining({ id: 'pro-fight', n: 3, total: PROLOGUE_STEPS.length, vars: { skill: 'Hearthlight' } }));
    expect(TD_PROLOGUE_I18N[v.key].en).toContain('{{skill}}');
  });

  it('every line it can ask for exists in EN and ES', () => {
    const keys = new Set<string>(['play.pro.label', 'play.pro.skip', 'play.pro.skipped', 'play.pro.done', 'play.pro.none', ...PROLOGUE_ROWS.map(r => r.key)]);
    for (const step of PROLOGUE_STEPS) {
      keys.add(`play.pro.tip.${step}`);
      for (const v of ['warlock', 'ashguard', 'lanternwright', 'other']) for (const touch of [false, true]) keys.add(stepKey(step, v, touch));
    }
    for (const key of keys) {
      expect(TD_PROLOGUE_I18N[key]?.en).withContext(key).toBeTruthy();
      expect(TD_PROLOGUE_I18N[key]?.es).withContext(key).toBeTruthy();
    }
  });
});
