/**
 * td-bestiary.spec.ts — the Bestiary's derivation: every creature has a haunt and a line of lore; a hand-drawn level's
 * creature finds its floor, a wild creature its continent; the kill blob only counts known creatures.
 */
import { MOBS } from './td-mobs';
import { bestiaryEntries, creatureHaunts, discoveredCount, readKills, withKill } from './td-bestiary';

describe('td-bestiary', () => {
  const entries = bestiaryEntries({});

  it('lists every MOBS creature, none of the minions', () => {
    expect(entries.map(e => e.id).sort()).toEqual(Object.keys(MOBS).sort());
    expect(entries.some(e => e.id === 'raised-skeleton')).toBeFalse();
  });

  it('gives every creature at least one haunt and a line of lore', () => {
    for (const e of entries) {
      expect(e.haunts.length).withContext(`${e.id} haunts`).toBeGreaterThan(0);
      expect(e.lore.length).withContext(`${e.id} lore`).toBeGreaterThan(20);
    }
  });

  it('finds a level creature on its floor and a wild creature on its continent', () => {
    const haunts = creatureHaunts();
    expect(haunts.get('ember-warden')).toContain("Ember Mine · Floor 3 · The Warden's Forge");
    expect(haunts.get('magma-tyrant')?.some(h => h.startsWith('The Molten Deep'))).toBeTrue();
    expect(haunts.get('orc-warlord')).toContain('The Obsidian Badlands, Infernal Reach');
    expect(haunts.get('ash-wolf')).toContain('The Emberwood, Ember Isle');
    expect(haunts.get('bone-walker')).toContain('The Hushed Barrow, Ember Isle');
  });

  it('counts discovered creatures from their kills', () => {
    const some = bestiaryEntries({ 'ash-wolf': 12, 'rivet-maw': 1 });
    expect(discoveredCount(some)).toBe(2);
    expect(some.find(e => e.id === 'ash-wolf')?.kills).toBe(12);
    expect(discoveredCount(entries)).toBe(0);
  });

  it('records a kill for a known creature only, and drops junk from a stored blob', () => {
    expect(withKill(null, 'raised-skeleton')).toBeNull();
    expect(withKill({ kills: { 'ash-wolf': 2 } }, 'ash-wolf')).toEqual({ version: 1, kills: { 'ash-wolf': 3 } });
    expect(readKills({ kills: { 'ash-wolf': -1, nope: 4, 'rivet-maw': 'x', 'cinder-imp': 5 } })).toEqual({ 'cinder-imp': 5 });
    expect(readKills('garbage')).toEqual({});
  });
});
