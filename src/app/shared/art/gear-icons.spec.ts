/**
 * gear-icons.spec.ts — every piece of gear its own 32-px picture (owner 2026-10-21: "they all are looking the same").
 * Pure; no DOM.
 */
import { ITEM_DEFINITIONS } from '../rpg/item-definition';
import { gearLookOf, itemBase } from '../rpg/item-base';
import { itemArt } from '../rpg/material-catalog';
import { GEAR_BASES, GEAR_N, GEAR_RARITIES, gearIcon, paintGearCells, type GearLook } from './gear-icons';

const SVG = /^data:image\/svg\+xml,/;
const sig = (look: GearLook) => paintGearCells(look).map(c => (c ? `${c.c}${c.a}` : '.')).join(',');

describe('gear icons (32 px, per instance)', () => {
  it('renders every base at every rarity: a filled 32 × 32 picture with the dark outline', () => {
    for (const base of GEAR_BASES) for (const rarity of GEAR_RARITIES) {
      const cells = paintGearCells({ base, rarity, realm: 'infernal', seed: `${base}-${rarity}` });
      expect(cells.length).toBe(GEAR_N * GEAR_N);
      const solid = cells.filter(c => c && c.a === 1).length;
      expect(solid).withContext(`${base} ${rarity}`).toBeGreaterThan(90);
      expect(cells.some(c => c?.c === '#140a1f')).withContext(`${base} outline`).toBeTrue();
      expect(gearIcon({ base, rarity, seed: 'x' }).src).toMatch(SVG);
    }
  });

  it('is deterministic per seed and cached', () => {
    const look: GearLook = { base: 'sword', rarity: 'rare', realm: 'umbral', seed: 'i-123' };
    expect(sig(look)).toBe(sig({ ...look }));
    expect(gearIcon(look)).toBe(gearIcon({ ...look }));
    const svg = decodeURIComponent(gearIcon(look).src.replace(SVG, ''));
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain('shape-rendering="crispEdges"');
  });

  it('gives different seeds of one base different pictures (most of the time)', () => {
    for (const base of GEAR_BASES) {
      const seen = new Set(Array.from({ length: 12 }, (_, i) => sig({ base, rarity: 'epic', realm: 'celestial', seed: `drop-${i}` })));
      expect(seen.size).withContext(base).toBeGreaterThanOrEqual(base === 'potion' ? 2 : 4);
    }
  });

  it('dresses up the rarer piece: more painted pixels, and a halo from legendary up', () => {
    const count = (rarity: string) => paintGearCells({ base: 'helm', rarity, realm: 'luminous', seed: 's' }).filter(Boolean).length;
    expect(count('legendary')).toBeGreaterThan(count('common'));
    const glow = (rarity: string) => paintGearCells({ base: 'ring', rarity, seed: 's' }).some(c => c && c.a < 1);
    expect(glow('epic')).toBeFalse();
    expect(glow('legendary')).toBeTrue();
  });

  it('wires every weapon and armour definition through itemArt, and two drops of one definition differ', () => {
    const gear = ITEM_DEFINITIONS.filter(def => def.family === 'equipment' && def.slot && !def.soulbound);
    expect(gear.length).toBeGreaterThan(40);
    const based = gear.filter(def => itemBase({ definitionId: def.id, name: def.name }));
    // Most pieces have a painter; a few uniques (tongs, an anvil, an hourglass…) keep their own 16-px icon.
    expect(based.length / gear.length).toBeGreaterThan(.8);
    for (const def of based) {
      const a = itemArt({ id: 'drop-a', definitionId: def.id, name: def.name, rarity: 'rare' })!.src;
      const b = itemArt({ id: 'drop-b', definitionId: def.id, name: def.name, rarity: 'rare' })!.src;
      expect(a).withContext(def.id).toMatch(SVG);
      expect(decodeURIComponent(a)).withContext(def.id).toContain('0 0 32 32');
      expect(a === b && itemArt({ id: 'drop-c', definitionId: def.id, name: def.name, rarity: 'rare' })!.src === a).withContext(def.id).toBeFalse();
    }
  });

  it('reads the base from the piece: staff, dagger, helm, ring, pendant; consumables and materials keep their icons', () => {
    expect(itemBase({ definitionId: 'nullthorn-staff' })).toBe('staff');
    expect(itemBase({ definitionId: 'cindergnaw' })).toBe('dagger');
    expect(itemBase({ definitionId: 'astral-helm' })).toBe('helm');
    expect(itemBase({ definitionId: 'anchor-ring' })).toBe('ring');
    expect(itemBase({ definitionId: 'astral-pendant' })).toBe('amulet');
    expect(itemBase({ definitionId: 'starplate-cuirass' })).toBe('plate');
    expect(itemBase({ definitionId: 'meridian-longbow' })).toBe('bow');
    expect(gearLookOf({ definitionId: 'cinder-ore' })).toBeNull();
    expect(gearLookOf({ definitionId: 'ember-elixir', type: 'charm' })).toBeNull();
    // The realm and the item's own materials come along.
    expect(gearLookOf({ id: 'x', definitionId: 'nullthorn-staff', rarity: 'legendary' })).toEqual(jasmine.objectContaining({ realm: 'umbral', mat: 'umbral', acc: 'amethyst', rarity: 'legendary', seed: 'x' }));
  });
});
