import { compareHlc } from '../activity/activity-ops';
import { emptyChapterLedger } from './chapter.model';
import {
  buildInfernalRecord,
  coerceChapterLedger,
  mergeChapterLedgers,
  parseInfernalChoice,
} from './chapter-ops';

describe('chapter-ops', () => {
  it('accepts only the two authored Infernal positions', () => {
    expect(parseInfernalChoice('central')).toBe('central');
    expect(parseInfernalChoice('distributed')).toBe('distributed');
    expect(parseInfernalChoice('both')).toBeNull();
  });

  it('keeps the higher HLC choice and never unions two positions', () => {
    const early = buildInfernalRecord({
      choiceId: 'central',
      deviceId: 'a',
      previous: null,
      now: 1_000,
    });
    const late = buildInfernalRecord({
      choiceId: 'distributed',
      deviceId: 'b',
      previous: early.revision,
      now: 2_000,
    });
    expect(compareHlc(late.revision, early.revision)).toBeGreaterThan(0);
    const merged = mergeChapterLedgers(
      { version: 1, infernal: early },
      { version: 1, infernal: late },
    );
    const reversed = mergeChapterLedgers(
      { version: 1, infernal: late },
      { version: 1, infernal: early },
    );
    expect(merged.infernal?.choiceId).toBe('distributed');
    expect(reversed.infernal?.choiceId).toBe('distributed');
    expect(merged).toEqual(reversed);
  });

  it('fails closed on a corrupt blob', () => {
    expect(coerceChapterLedger({ version: 1, infernal: { choiceId: 'central' } })).toBeNull();
    expect(coerceChapterLedger({ version: 2, infernal: null })).toBeNull();
    expect(mergeChapterLedgers('nope', null)).toEqual(emptyChapterLedger());
  });
});
