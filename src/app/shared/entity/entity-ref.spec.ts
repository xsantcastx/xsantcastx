import { inspectHref, parseEntityRef, serializeEntityRef } from './entity-ref';

describe('entity ref tokens', () => {
  it('round-trips type and id', () => {
    const ref = { type: 'rune' as const, id: 'ash' };
    expect(serializeEntityRef(ref)).toBe('rune:ash');
    expect(parseEntityRef('rune:ash')).toEqual(ref);
    expect(parseEntityRef('market-listing:forge-bellows')?.type).toBe('market-listing');
  });

  it('rejects empty, unknown, or malformed tokens', () => {
    expect(parseEntityRef('')).toBeNull();
    expect(parseEntityRef('rune')).toBeNull();
    expect(parseEntityRef(':ash')).toBeNull();
    expect(parseEntityRef('bubble:ash')).toBeNull();
    expect(parseEntityRef('weapon:ash')).toBeNull();
  });

  it('preserves other query keys when building an inspect href', () => {
    expect(inspectHref('/market?category=forge', { type: 'market-listing', id: 'iron-hammer' }))
      .toBe('/market?category=forge&inspect=market-listing%3Airon-hammer');
  });
});
