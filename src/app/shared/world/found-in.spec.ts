import { foundIn, foundInLine, foundInPlaces, type FoundInIndex } from './found-in';
import { buildFoundInIndex, foundInWorld } from './found-in.data';

const INDEX: FoundInIndex = {
  gathering: [{ place: 'Rootglass Canopy', materialIds: ['sunbloom'] }],
  areas: [
    {
      name: 'Rootglass Thicket',
      drops: { entries: [{ kind: 'coins' }, { kind: 'material', material: 'thornroot' }] },
      monsters: [{ drops: { entries: [{ kind: 'material', material: 'sunbloom' }] } }],
    },
    {
      name: 'Ember Delve',
      drops: { entries: [{ kind: 'material', material: 'cinder-ore' }] },
      monsters: [],
      terrainNodes: ['dirt', 'cinder-vein', 'glow-node'],
    },
  ],
  nodeYields: { 'cinder-vein': 'cinder-ore', 'glow-node': 'glowcap' },
  delve: { glowcap: { area: 'Ember Delve', biomes: ['Glowcap Grotto'] }, 'kaels-hammer': { area: 'Ember Delve', biomes: [] } },
  vendor: [{ materialId: 'sunbloom', place: 'Material Vendor', source: 'Verge expeditions' }],
};

describe('foundIn (pure)', () => {
  it('orders gathering, hunts, then vendor and expedition', () => {
    expect(foundIn('sunbloom', INDEX).map(p => p.label))
      .toEqual(['Rootglass Canopy', 'Rootglass Thicket', 'Material Vendor', 'Verge expeditions']);
  });

  it('reads per-monster drop overrides and area drops alike', () => {
    expect(foundIn('thornroot', INDEX).map(p => p.kind)).toEqual(['hunt']);
  });

  it('names the Delve for a dug node, once, even when monsters also drop it', () => {
    expect(foundIn('cinder-ore', INDEX).map(p => p.label)).toEqual(['Ember Delve']);
  });

  it('prefers the biome over the bare delve name', () => {
    expect(foundIn('glowcap', INDEX).map(p => p.label)).toEqual(['Ember Delve · Glowcap Grotto']);
  });

  it('falls back to the area when no biome is known', () => {
    expect(foundIn('kaels-hammer', INDEX).map(p => p.label)).toEqual(['Ember Delve']);
  });

  it('says nothing rather than something wrong', () => {
    expect(foundIn('unobtainium', INDEX)).toEqual([]);
    expect(foundInLine('Unobtainium', [])).toBeNull();
    expect(foundInPlaces([])).toBeNull();
  });

  it('formats the one-line tooltip', () => {
    expect(foundInLine('Glowcap', foundIn('glowcap', INDEX))).toBe('Glowcap — Ember Delve · Glowcap Grotto');
  });
});

describe('foundIn (the real world data)', () => {
  const labels = (id: string) => foundInWorld(id).map(p => p.label);

  it('puts Glowcaps in the Glowcap Grotto', () => {
    expect(labels('glowcap')).toEqual(['Ember Delve · Glowcap Grotto']);
  });

  it('finds Cinder Ore at the Seamworks, in the Quarry and in the Delve', () => {
    const where = labels('cinder-ore');
    expect(where[0]).toBe('Basalt Seamworks');
    expect(where).toContain('Ember Quarry');
    expect(where).toContain('Ember Delve');
  });

  it('finds Slag in the Delve terrain and at the Seamworks seam', () => {
    expect(labels('slag-fragment')).toEqual(jasmine.arrayContaining(['Basalt Seamworks', 'Ember Delve']));
  });

  it('lists the vendor and the expedition for a shelf material', () => {
    expect(labels('pyrite-dust')).toEqual(jasmine.arrayContaining(['Material Vendor', 'Nexus expeditions']));
  });

  it('places every material a town drop table names somewhere', () => {
    const index = buildFoundInIndex();
    for (const area of index.areas) {
      for (const entry of area.drops.entries) {
        if (entry.kind !== 'material') continue;
        expect(labels(entry.material).length).withContext(entry.material).toBeGreaterThan(0);
      }
    }
  });
});
