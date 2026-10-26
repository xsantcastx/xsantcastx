import { currentFirstGoal, firstGoal, FirstGoalFacts, runeForgeHint, RuneHintFacts } from './first-goals';
import { FIRST_GOALS_I18N } from './first-goals.i18n';
import { HOMESTEAD, HOMESTEAD_GATE } from './homestead';
import { TOWNS, areaOf } from './world.model';
import { craftingRecipeById } from '../../shared/crafting/crafting.model';
import { STRIKE_COST } from '../../shared/rune-forge/rune.model';

const FRESH: FirstGoalFacts = { bought: false, hunted: false, crafted: false, edge: false, armed: false, dug: false, areaId: 'infernal', ore: 0, ember: 0 };
/** The blade forged and worn. */
const ARMED: Partial<FirstGoalFacts> = { crafted: true, edge: true, armed: true };

describe('first-session goals', () => {
  it('walks buy → craft (forge and equip) → hunt → delve, then disappears', () => {
    expect(currentFirstGoal(FRESH)).toBe('buy');
    expect(currentFirstGoal({ ...FRESH, bought: true })).toBe('craft');
    expect(currentFirstGoal({ ...FRESH, bought: true, ...ARMED })).toBe('hunt');
    expect(currentFirstGoal({ ...FRESH, bought: true, ...ARMED, hunted: true })).toBe('delve');
    expect(firstGoal({ ...FRESH, bought: true, ...ARMED, hunted: true, dug: true })).toBeNull();
  });

  it('arms the Keeper before the hunt: a forged but unworn blade sends them back to the forge to equip it', () => {
    const view = firstGoal({ ...FRESH, bought: true, crafted: true, edge: true, armed: false })!;
    expect(view.id).toBe('craft');
    expect(view.key).toBe('play.goal.craft.equip');
    expect(view.target).toEqual({ station: 'forge' });
  });

  it('never sends a Keeper who has already felled a creature back to arm', () => {
    expect(currentFirstGoal({ ...FRESH, bought: true, hunted: true })).toBe('delve');
    expect(currentFirstGoal({ ...FRESH, bought: true, hunted: true, dug: true, crafted: true })).toBeNull();
  });

  it('shows the first goal not yet done, whatever order the player did things in', () => {
    const view = firstGoal({ ...FRESH, hunted: true, dug: true })!;
    expect(view.id).toBe('buy');
    expect(view.n).toBe(1);
    expect(firstGoal({ ...FRESH, bought: true, dug: true })!.id).toBe('craft');
  });

  it('counts its steps as "n of 4", the blade second and the hunt third', () => {
    expect(firstGoal({ ...FRESH, bought: true })!.n).toBe(2);
    const view = firstGoal({ ...FRESH, bought: true, ...ARMED })!;
    expect(view.n).toBe(3);
    expect(view.total).toBe(4);
  });

  it('in town, points at a place that exists in the Seamworks', () => {
    const stations = new Set(TOWNS.infernal!.stations.map(s => s.id));
    const facts: FirstGoalFacts[] = [
      FRESH,
      { ...FRESH, bought: true },
      { ...FRESH, bought: true, ore: 6, ember: 1 },
      { ...FRESH, bought: true, crafted: true, edge: true },
      { ...FRESH, bought: true, ...ARMED, hunted: true },
    ];
    for (const f of facts) {
      const target = firstGoal(f)!.target!;
      if ('station' in target) expect(stations.has(target.station)).withContext(JSON.stringify(f)).toBeTrue();
    }
    expect(stations.has(HOMESTEAD_GATE.id)).toBeTrue();
    expect(stations.has('crafting')).toBeTrue();
    // The hunt goal walks to open floor east of the Waystone.
    expect('x' in firstGoal({ ...FRESH, bought: true, ...ARMED })!.target!).toBeTrue();
  });

  it('switches the blade goal from mining to the forge once 6 ore and an ember are held', () => {
    const base = { ...FRESH, bought: true };
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
    expect(firstGoal({ ...FRESH, bought: true, ...ARMED, hunted: true, areaId: 'ember-delve' })!.target).toBeNull();
    const leaveQuarry = firstGoal({ ...FRESH, areaId: 'ember-quarry' })!;
    expect(ids(quarry.stations).has((leaveQuarry.target as { station: string }).station)).toBeTrue();
    expect(firstGoal({ ...FRESH, areaId: 'luminous' })!.key).toBe('play.goal.away');
  });

  it('every line it can show has EN and ES copy', () => {
    const keys = new Set<string>(['play.goal.label', 'play.goal.go', 'play.goal.goAria', 'play.goal.next', 'play.goal.hide', 'play.goal.rune.town']);
    const areas = ['infernal', HOMESTEAD.id, 'ember-delve', 'ember-quarry', 'luminous'];
    const ladder: Partial<FirstGoalFacts>[] = [
      {}, { bought: true }, { bought: true, ore: 6, ember: 1 }, { bought: true, crafted: true, edge: true },
      { bought: true, ...ARMED }, { bought: true, ...ARMED, hunted: true },
    ];
    for (const areaId of areas) for (const step of ladder) keys.add(firstGoal({ ...FRESH, ...step, areaId })!.key);
    for (const key of keys) {
      const row = FIRST_GOALS_I18N[key];
      expect(row).withContext(key).toBeDefined();
      expect(row?.en.length).withContext(key).toBeGreaterThan(0);
      expect(row?.es.length).withContext(key).toBeGreaterThan(0);
    }
  });
});

describe('the Rune Forge hint after the first goals', () => {
  const READY: RuneHintFacts = { goalsDone: true, gold: STRIKE_COST, strikeCost: STRIKE_COST, seen: false, areaId: 'infernal' };

  it('is retired with the Rune Forge: runes drop only from monsters, so there is nothing to point at', () => {
    expect(runeForgeHint(READY)).toBeNull();
  });

  it('stays out of the tutorial goals, out of reach of an empty purse, and never shows twice', () => {
    expect(runeForgeHint({ ...READY, goalsDone: false })).toBeNull();
    expect(runeForgeHint({ ...READY, gold: STRIKE_COST - 1 })).toBeNull();
    expect(runeForgeHint({ ...READY, seen: true })).toBeNull();
  });

  it('only shows on the Seamworks floor, where the Rune Forge stands', () => {
    expect(runeForgeHint({ ...READY, areaId: 'ember-delve' })).toBeNull();
    expect(runeForgeHint({ ...READY, areaId: HOMESTEAD.id })).toBeNull();
  });
});

describe('the guaranteed first bench craft', () => {
  it('the Torch needs only what the four goals leave behind: 2 Cinder Ore and 2 Gold, at level 1', () => {
    const torch = craftingRecipeById('craft-delve-torch')!;
    expect(torch.ingredients).toEqual([{ materialId: 'cinder-ore', count: 2 }]);
    expect(torch.goldCost).toBeLessThanOrEqual(2);
    expect(torch.requiredLevel).toBe(1);
    expect(torch.skill).toBeUndefined();
  });
});
