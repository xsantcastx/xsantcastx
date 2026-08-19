import { ITEM_STAT_LABELS } from '../rpg/item.model';
import { RUNE_TIERS } from '../rune-forge/rune.model';
import { temperCue, temperDeltas } from './temper-feedback';

describe('temperDeltas', () => {
  it('is empty when nothing moved', () => {
    expect(temperDeltas({ goldPerSec: 1.3, strikePower: 2 }, { goldPerSec: 1.3, strikePower: 2 })).toEqual([]);
  });

  it('prints one row per raised key, rounded to two decimals, with the tooltip label', () => {
    const rows = temperDeltas({ goldPerSec: 1.3, strikePower: 2 }, { goldPerSec: 1.3, strikePower: 2.12 });
    expect(rows.length).toBe(1);
    expect(rows[0].key).toBe('strikePower');
    expect(rows[0].before).toBe(2);
    expect(rows[0].after).toBe(2.12);
    expect(rows[0].delta).toBe(0.12);
    expect(rows[0].label).toBe(ITEM_STAT_LABELS.strikePower);
  });

  it('ignores keys absent on either side', () => {
    expect(temperDeltas({ goldPerSec: 1 }, { goldPerSec: 1, ward: 0.4 })).toEqual([]);
    expect(temperDeltas({ goldPerSec: 1, ward: 0.4 }, { goldPerSec: 1 })).toEqual([]);
  });

  it('keeps ITEM_STAT_KEYS order across several keys', () => {
    const rows = temperDeltas(
      { ward: 0.4, xpBonus: 1.5, goldPerSec: 2 },
      { ward: 0.43, xpBonus: 1.58, goldPerSec: 2.1 },
    );
    expect(rows.map(r => r.key)).toEqual(['goldPerSec', 'xpBonus', 'ward']);
    expect(rows.map(r => r.delta)).toEqual([0.1, 0.08, 0.03]);
  });
});

describe('temperCue', () => {
  it('pitches common at the root and stays light', () => {
    expect(temperCue('common')).toEqual({ semitones: 0, heavy: false });
  });

  it('follows the rune ladder for semitones and turns heavy at epic', () => {
    expect(temperCue('rare')).toEqual({ semitones: RUNE_TIERS.rare.semitones, heavy: false });
    expect(temperCue('epic')).toEqual({ semitones: RUNE_TIERS.epic.semitones, heavy: true });
    expect(temperCue('singular')).toEqual({ semitones: RUNE_TIERS.singular.semitones, heavy: true });
  });

  it('falls back to common for an unknown rarity', () => {
    expect(temperCue('junk' as any)).toEqual({ semitones: 0, heavy: false });
  });
});
