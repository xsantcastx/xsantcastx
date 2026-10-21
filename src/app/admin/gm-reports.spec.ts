import { coerceReport } from './gm-data.service';

describe('coerceReport (the GM console reads what the Hearth files)', () => {
  it('reads a full report and bounds what it shows', () => {
    const r = coerceReport('r1', {
      at: { toMillis: () => 5 }, status: 'open', reason: 'spam', note: 'gold seller',
      from: { uid: null, name: 'Arin', guest: true }, about: { uid: 'u2', name: 'Mira', guest: false, area: 'ember-isle' },
      lines: Array.from({ length: 12 }, (_, i) => ({ text: `line ${i}`, at: i })),
    });
    expect(r.at).toBe(5);
    expect(r.about).toEqual({ uid: 'u2', name: 'Mira', guest: false, area: 'ember-isle' });
    expect(r.from.guest).toBeTrue();
    expect(r.lines.length).toBe(10);
    expect(r.lines[0].text).toBe('line 2');
  });
  it('survives junk', () => {
    const r = coerceReport('r2', { status: 'weird', lines: 'no', about: 7 });
    expect(r.status).toBe('open');
    expect(r.reason).toBe('other');
    expect(r.lines).toEqual([]);
    expect(r.about.name).toBe('Keeper');
  });
});
