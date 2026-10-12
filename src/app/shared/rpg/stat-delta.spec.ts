import {
  compareStats,
  formatDeltaChip,
  formatDeltaText,
  formatSignedValue,
  netDelta,
  round2,
  totalsDelta,
} from './stat-delta';
import { keeperCombatStats } from './keeper-combat';

const ZERO = { goldPerSec: 0, magicFind: 0, xpBonus: 0, lootBonus: 0, strikePower: 0, ward: 0 };

describe('stat-delta', () => {
  describe('compareStats', () => {
    it('reports a gain against what is worn', () => {
      const rows = compareStats({ magicFind: 9 }, { magicFind: 5 });
      expect(rows.length).toBe(1);
      expect(rows[0]).toEqual(jasmine.objectContaining({
        key: 'magicFind', before: 5, after: 9, delta: 4, direction: 'up', text: 'Magic Find +4%',
      }));
    });

    it('reports a loss with a real minus sign', () => {
      const [row] = compareStats({ strikePower: 0.7 }, { strikePower: 1 });
      expect(row.delta).toBe(-0.3);
      expect(row.direction).toBe('down');
      expect(row.text).toBe('Strike −0.3');
    });

    it('lists a stat the candidate would drop as a negative', () => {
      const rows = compareStats({ magicFind: 7 }, { goldPerSec: 4, magicFind: 5 });
      expect(rows.map(r => [r.key, r.delta])).toEqual([['goldPerSec', -4], ['magicFind', 2]]);
    });

    it('treats an empty slot as zero, so every stat is a gain', () => {
      const rows = compareStats({ goldPerSec: 2, strikePower: 1 }, undefined);
      expect(rows.map(r => r.direction)).toEqual(['up', 'up']);
      expect(rows.map(r => r.before)).toEqual([0, 0]);
    });

    it('drops unchanged stats by default and keeps them dimmed on request', () => {
      const worn = { goldPerSec: 4, magicFind: 5 };
      const cand = { goldPerSec: 4, magicFind: 8 };
      expect(compareStats(cand, worn).map(r => r.key)).toEqual(['magicFind']);

      const all = compareStats(cand, worn, { includeUnchanged: true });
      expect(all.map(r => r.key)).toEqual(['goldPerSec', 'magicFind']);
      expect(all[0].direction).toBe('same');
      expect(all[0].text).toBe('Gold/sec ±0');
    });

    it('never lists a stat neither item touches', () => {
      expect(compareStats({}, {}, { includeUnchanged: true })).toEqual([]);
      expect(compareStats({ ward: 0 }, { ward: 0 }, { includeUnchanged: true })).toEqual([]);
    });

    it('rounds float drift out of the delta', () => {
      const [row] = compareStats({ goldPerSec: 0.4 }, { goldPerSec: 0.1 });
      expect(row.delta).toBe(0.3);
      expect(row.text).toBe('Gold/sec +0.3');
    });

    it('returns rows in the canonical stat order', () => {
      const rows = compareStats({ ward: 1, goldPerSec: 1, xpBonus: 1 }, null);
      expect(rows.map(r => r.key)).toEqual(['goldPerSec', 'xpBonus', 'ward']);
    });
  });

  describe('totalsDelta', () => {
    it('lists only what moved between two loadouts', () => {
      const before = { ...ZERO, goldPerSec: 2, strikePower: 1 };
      const after = { ...ZERO, goldPerSec: 2, strikePower: 2.3, ward: 0.5 };
      const rows = totalsDelta(before, after);
      expect(rows.map(r => [r.key, r.delta, r.direction])).toEqual([
        ['strikePower', 1.3, 'up'],
        ['ward', 0.5, 'up'],
      ]);
    });

    it('reports an unequip as losses', () => {
      const rows = totalsDelta({ ...ZERO, strikePower: 1 }, ZERO);
      expect(rows.length).toBe(1);
      expect(rows[0].direction).toBe('down');
      expect(formatDeltaChip(rows[0].key, rows[0].delta)).toBe('−1 Strike');
    });

    it('is empty when nothing changed', () => {
      expect(totalsDelta(ZERO, { ...ZERO })).toEqual([]);
    });
  });

  describe('formatting', () => {
    it('signs, suffixes and never prints -0', () => {
      expect(formatSignedValue('magicFind', 2)).toBe('+2%');
      expect(formatSignedValue('ward', -0.25)).toBe('−0.25');
      expect(formatSignedValue('ward', -0.0001)).toBe('±0');
      expect(round2(-0.001)).toBe(0);
      expect(Object.is(round2(-0.001), -0)).toBeFalse();
    });

    it('writes the chip number-first and the row label-first', () => {
      expect(formatDeltaChip('strikePower', 1.3)).toBe('+1.3 Strike');
      expect(formatDeltaText('strikePower', 1.3)).toBe('Strike +1.3');
    });

    it('nets the signed deltas', () => {
      expect(netDelta(compareStats({ goldPerSec: 3, magicFind: 9 }, { goldPerSec: 4, magicFind: 5 }))).toBe(3);
      expect(netDelta([])).toBe(0);
    });
  });
});

describe('keeperCombatStats', () => {
  it('leaves an unarmed Keeper at the old floor', () => {
    expect(keeperCombatStats({})).toEqual({ damage: 10, maxHp: 100 });
  });

  it('keeps a fresh Basalt Edge at about the old 20', () => {
    // Uncommon rolls strikePower 0.85–1.15 off a base of 1.
    expect(keeperCombatStats({ strikePower: 0.85 }).damage).toBe(19);
    expect(keeperCombatStats({ strikePower: 1 }).damage).toBe(20);
    expect(keeperCombatStats({ strikePower: 1.15 }).damage).toBe(22);
  });

  it('caps damage at one Rivet Maw and health at 250', () => {
    expect(keeperCombatStats({ strikePower: 99 }).damage).toBe(60);
    expect(keeperCombatStats({ ward: 99 }).maxHp).toBe(250);
  });

  it('turns Ward into health', () => {
    expect(keeperCombatStats({ ward: 0.8 }).maxHp).toBe(108);
  });

  it('ignores negative and non-finite input', () => {
    expect(keeperCombatStats({ strikePower: -3, ward: Number.NaN })).toEqual({ damage: 10, maxHp: 100 });
  });
});
