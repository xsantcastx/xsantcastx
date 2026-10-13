import { currentFirstGoal, firstGoal, FirstGoalFacts } from './first-goals';
import { FIRST_GOALS_I18N } from './first-goals.i18n';
import { HOMESTEAD, HOMESTEAD_GATE } from './homestead';
import { TOWNS, areaOf } from './world.model';

const FRESH: FirstGoalFacts = { bought: false, hunted: false, crafted: false, dug: false, areaId: 'infernal', ore: 0, ember: 0 };

describe('first-session goals', () => {
  it('walks buy → hunt → craft → delve, then disappears', () => {
    expect(currentFirstGoal(FRESH)).toBe('buy');
    expect(currentFirstGoal({ ...FRESH, bought: true })).toBe('hunt');
    expect(currentFirstGoal({ ...FRESH, bought: true, hunted: true })).toBe('craft');
    expect(currentFirstGoal({ ...FRESH, bought: true, hunted: true, crafted: true })).toBe('delve');
    expect(firstGoal({ ...FRESH, bought: true, hunted: true, crafted: true, dug: true })).toBeNull();
  });

  it('shows the first goal not yet done, whatever order the player did things in', () => {
    const view = firstGoal({ ...FRESH, hunted: true, dug: true })!;
    expect(view.id).toBe('buy');
    expect(view.n).toBe(1);
    expect(firstGoal({ ...FRESH, bought: true, crafted: true })!.id).toBe('hunt');
  });

  it('counts its steps as "n of 4"', () => {
    const view = firstGoal({ ...FRESH, bought: true, hunted: true })!;
    expect(view.n).toBe(3);
    expect(view.total).toBe(4);
  });

  it('in town, points at a place that exists in the Seamworks', () => {
    const stations = new Set(TOWNS.infernal!.stations.map(s => s.id));
    const facts: FirstGoalFacts[] = [
      FRESH,
      { ...FRESH, bought: true, hunted: true },
      { ...FRESH, bought: true, hunted: true, ore: 6, ember: 1 },
      { ...FRESH, bought: true, hunted: true, crafted: true },
    ];
    for (const f of facts) {
      const target = firstGoal(f)!.target!;
      if ('station' in target) expect(stations.has(target.station)).withContext(JSON.stringify(f)).toBeTrue();
    }
    expect(stations.has(HOMESTEAD_GATE.id)).toBeTrue();
    // The hunt goal walks to open floor east of the Waystone.
    expect('x' in firstGoal({ ...FRESH, bought: true })!.target!).toBeTrue();
  });

  it('switches the blade goal from mining to the forge once 6 ore and an ember are held', () => {
    const base = { ...FRESH, bought: true, hunted: true };
    expect(firstGoal({ ...base, ore: 6, ember: 0 })!.target).toEqual({ station: 'ore' });
    expect(firstGoal({ ...base, ore: 6, ember: 1 })!.target).toEqual({ station: 'forge' });
  });

  it('off the Seamworks floor, points back through a station that area really has', () => {
    const delve = areaOf(TOWNS.infernal!, 'ember-delve')!;
    const quarry = areaOf(TOWNS.infernal!, 'ember-quarry')!;
    const home = areaOf(TOWNS.infernal!, HOMESTEAD.id) ?? HOMESTEAD;
    const ids = (stations: readonly { id: string }[]) => new Set(stations.map(s => s.id));
    const inHome = firstGoal({ ...FRESH, areaId: HOMESTEAD.id })!;
    expect(inHome.key).toBe('play.goal.buy.home');
    expect(ids(home.stations).has((inHome.target as { station: string }).station)).toBeTrue();
    const leaveHome = firstGoal({ ...FRESH, bought: true, areaId: HOMESTEAD.id })!;
    expect(ids(home.stations).has((leaveHome.target as { station: string }).station)).toBeTrue();
    const leaveDelve = firstGoal({ ...FRESH, areaId: 'ember-delve' })!;
    expect(ids(delve.stations).has((leaveDelve.target as { station: string }).station)).toBeTrue();
    expect(firstGoal({ ...FRESH, bought: true, hunted: true, crafted: true, areaId: 'ember-delve' })!.target).toBeNull();
    const leaveQuarry = firstGoal({ ...FRESH, areaId: 'ember-quarry' })!;
    expect(ids(quarry.stations).has((leaveQuarry.target as { station: string }).station)).toBeTrue();
    expect(firstGoal({ ...FRESH, areaId: 'luminous' })!.key).toBe('play.goal.away');
  });

  it('every line it can show has EN and ES copy', () => {
    const keys = new Set<string>(['play.goal.label', 'play.goal.go', 'play.goal.goAria']);
    const areas = ['infernal', HOMESTEAD.id, 'ember-delve', 'ember-quarry', 'luminous'];
    const ladder: Partial<FirstGoalFacts>[] = [{}, { bought: true }, { bought: true, hunted: true }, { bought: true, hunted: true, ore: 6, ember: 1 }, { bought: true, hunted: true, crafted: true }];
    for (const areaId of areas) for (const step of ladder) keys.add(firstGoal({ ...FRESH, ...step, areaId })!.key);
    for (const key of keys) {
      const row = FIRST_GOALS_I18N[key];
      expect(row).withContext(key).toBeDefined();
      expect(row?.en.length).withContext(key).toBeGreaterThan(0);
      expect(row?.es.length).withContext(key).toBeGreaterThan(0);
    }
  });
});
