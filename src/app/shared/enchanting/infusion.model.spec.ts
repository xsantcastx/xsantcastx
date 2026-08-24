/**
 * infusion.model.spec.ts — timers, the three-slot cap, and the merge.
 *
 * The two failures that cost a player something are a lapsed row that still
 * occupies a slot and a merge that hands back a timer somebody already burned
 * through, so both are pinned here.
 */
import { materialDisplay } from '../rpg/material-catalog';
import {
  INFUSIONS,
  MAX_ACTIVE_INFUSIONS,
  channelBonus,
  channelMultiplier,
  emptyInfusionLedger,
  formatRemaining,
  infusionById,
  isRunning,
  liveInfusions,
  mergeInfusionLedgers,
  parseInfusionLedger,
  pruneInfusions,
  type InfusionLedger,
} from './infusion.model';

const T0 = 1_700_000_000_000;

function ledger(...rows: { id: string; minutes: number }[]): InfusionLedger {
  return {
    version: 1,
    active: rows.map(row => ({
      id: row.id,
      startedAt: T0,
      expiresAt: T0 + row.minutes * 60_000,
    })),
  };
}

describe('the infusion catalogue', () => {
  it('has unique ids and burns materials the game actually grants', () => {
    const ids = new Set(INFUSIONS.map(i => i.id));
    expect(ids.size).toBe(INFUSIONS.length);

    for (const infusion of INFUSIONS) {
      expect(infusion.inputs.length).withContext(infusion.id).toBeGreaterThan(0);
      for (const input of infusion.inputs) {
        expect(input.count).withContext(`${infusion.id}/${input.materialId}`).toBeGreaterThan(0);
        // A recipe naming a material the bag cannot paint renders as a raw id
        // with an empty art slot — the failure mode `material-catalog.ts`
        // documents at length.
        expect(materialDisplay(input.materialId))
          .withContext(`${infusion.id} wants ${input.materialId}, which the bag cannot name`)
          .toBeTruthy();
      }
    }
  });

  it('covers all three channels, because three slots on one channel is not a decision', () => {
    const channels = new Set(INFUSIONS.map(i => i.channel));
    expect(channels.has('gold')).toBe(true);
    expect(channels.has('xp')).toBe(true);
    expect(channels.has('magicFind')).toBe(true);
  });

  it('runs for between half an hour and four hours', () => {
    for (const infusion of INFUSIONS) {
      expect(infusion.minutes).withContext(infusion.id).toBeGreaterThanOrEqual(30);
      expect(infusion.minutes).withContext(infusion.id).toBeLessThanOrEqual(240);
      expect(infusion.bonus).withContext(infusion.id).toBeGreaterThan(0);
    }
  });
});

describe('running and lapsing', () => {
  it('counts a row as live until the instant it expires', () => {
    const led = ledger({ id: 'ember-infusion', minutes: 120 });
    expect(isRunning(led, 'ember-infusion', T0)).toBe(true);
    expect(isRunning(led, 'ember-infusion', T0 + 120 * 60_000 - 1)).toBe(true);
    expect(isRunning(led, 'ember-infusion', T0 + 120 * 60_000)).toBe(false);
  });

  it('adds bonuses on the same channel and leaves the others alone', () => {
    const led = ledger(
      { id: 'ember-infusion', minutes: 120 },     // +10% gold
      { id: 'heartstone-infusion', minutes: 60 }, // +20% gold
      { id: 'void-infusion', minutes: 60 },       // +25% magicFind
    );
    expect(channelBonus(led, 'gold', T0)).toBe(30);
    expect(channelMultiplier(led, 'gold', T0)).toBeCloseTo(1.3, 6);
    expect(channelBonus(led, 'magicFind', T0)).toBe(25);
    expect(channelBonus(led, 'xp', T0)).toBe(0);
    expect(channelMultiplier(led, 'xp', T0)).toBe(1);
  });

  it('stops paying the moment a timer lapses', () => {
    const led = ledger({ id: 'void-infusion', minutes: 60 });
    expect(channelBonus(led, 'magicFind', T0 + 61 * 60_000)).toBe(0);
  });

  it('prunes lapsed rows so they stop occupying a slot', () => {
    const led = ledger(
      { id: 'ember-infusion', minutes: 120 },
      { id: 'void-infusion', minutes: 60 },
    );
    const after = pruneInfusions(led, T0 + 90 * 60_000);
    expect(after.active.map(r => r.id)).toEqual(['ember-infusion']);
    // Same object back when nothing changed — the tick runs once a second and
    // must not republish on every one of them.
    expect(pruneInfusions(after, T0)).toBe(after);
  });

  it('sorts the live rows soonest-to-expire, which is the order the bench reads', () => {
    const led = ledger(
      { id: 'ember-infusion', minutes: 120 },
      { id: 'void-infusion', minutes: 60 },
    );
    expect(liveInfusions(led, T0).map(r => r.id)).toEqual(['void-infusion', 'ember-infusion']);
  });
});

describe('parsing and merging', () => {
  it('reads rubbish as an empty ledger rather than throwing', () => {
    expect(parseInfusionLedger(null)).toEqual(emptyInfusionLedger());
    expect(parseInfusionLedger({ active: 'nope' })).toEqual(emptyInfusionLedger());
    expect(parseInfusionLedger({ active: [{ id: 'gone', expiresAt: 1 }] }).active).toEqual([]);
    expect(parseInfusionLedger({ active: [{ id: 'ember-infusion' }] }).active).toEqual([]);
  });

  it('keeps one row per id even when the blob has two', () => {
    const parsed = parseInfusionLedger({
      active: [
        { id: 'ember-infusion', startedAt: T0, expiresAt: T0 + 1 },
        { id: 'ember-infusion', startedAt: T0, expiresAt: T0 + 2 },
      ],
    });
    expect(parsed.active.length).toBe(1);
  });

  it('takes the later expiry per id when two devices disagree', () => {
    const phone = ledger({ id: 'ember-infusion', minutes: 30 });
    const laptop = ledger({ id: 'ember-infusion', minutes: 120 });
    const merged = mergeInfusionLedgers(phone, laptop);
    expect(merged.active.length).toBe(1);
    expect(merged.active[0].expiresAt).toBe(T0 + 120 * 60_000);
  });

  it('never merges its way past the three-slot cap', () => {
    const a = ledger(
      { id: 'ember-infusion', minutes: 120 },
      { id: 'moonpetal-infusion', minutes: 120 },
    );
    const b = ledger(
      { id: 'void-infusion', minutes: 60 },
      { id: 'heartstone-infusion', minutes: 60 },
      { id: 'prism-infusion', minutes: 90 },
    );
    const merged = mergeInfusionLedgers(a, b);
    expect(merged.active.length).toBe(MAX_ACTIVE_INFUSIONS);
  });
});

describe('the countdown', () => {
  it('reads in hours, minutes or seconds, and never negative', () => {
    expect(formatRemaining(-5)).toBe('0s');
    expect(formatRemaining(31_000)).toBe('31s');
    expect(formatRemaining(90_000)).toBe('1m 30s');
    expect(formatRemaining(3_900_000)).toBe('1h 05m');
  });

  it('names every catalogue entry', () => {
    for (const infusion of INFUSIONS) {
      expect(infusionById(infusion.id)?.name).toBe(infusion.name);
    }
    expect(infusionById('nope')).toBeUndefined();
  });
});
