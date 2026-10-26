import { dropGlow, dropIconKey, dropIconSrc } from './td-drop-art';

describe('td-drop-art', () => {
  it('a rune drop takes the rune tablet, gear its icon, a material its own', () => {
    expect(dropIconKey({ rune: 'ember' })).toEqual({ kind: 'rune', id: 'ember' });
    expect(dropIconKey({ item: { definitionId: 'starter-axe' } })).toEqual({ kind: 'item', id: 'starter-axe' });
    expect(dropIconKey({ material: 'ember-residue' })).toEqual({ kind: 'material', id: 'ember-residue' });
    expect(dropIconKey({})).toBeNull();
  });
  it('resolves pixel icons, and null for unknown ids', () => {
    expect(dropIconSrc({ rune: 'ember' })).toContain('data:image/svg+xml');
    expect(dropIconSrc({ item: { definitionId: 'starter-axe' } })).toContain('data:image/svg+xml');
    expect(dropIconSrc({ material: 'ember-residue' })).toContain('data:image/svg+xml');
    expect(dropIconSrc({ item: { definitionId: 'no-such-thing' } })).toBeNull();
  });
  it('glow climbs the ladder', () => {
    const rungs = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'] as const;
    for (let i = 1; i < rungs.length; i++) {
      expect(dropGlow(rungs[i]).beam).toBeGreaterThanOrEqual(dropGlow(rungs[i - 1]).beam);
      expect(dropGlow(rungs[i]).halo).toBeGreaterThanOrEqual(dropGlow(rungs[i - 1]).halo);
    }
    expect(dropGlow('common').beam).toBe(0);
    expect(dropGlow('epic').halo).toBeGreaterThan(0);
  });
});
