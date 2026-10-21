import { fitBox } from './fit-viewport.directive';
import { HUD_LAYOUT_KEY, readHudLayout } from './hud-drag.directive';
import { pinCat } from './td-map-window.component';
import { mapSections, zoneLabels } from './td/td-map';
import { CONTINENTS, LEVELS } from './td/td-engine';
import { MOBS } from './td/td-mobs';
import { levelLinks, townEntries, wayEntries } from './td/td-seek';
import { BLOCK } from './td/maps/ember-isle';

describe('owner player notes 2026-10-21 (HUD helpers)', () => {
  it('fitBox keeps a tall card inside the window and flips it up and left at the edges', () => {
    const view = { w: 1280, h: 720 };
    // A bottom-row cell near the right edge: the card goes to its left and ends at the cell's foot.
    const at = fitBox({ left: 1100, top: 620, right: 1180, bottom: 700 }, { w: 264, h: 480 }, view, 'side');
    expect(at.x + 264).toBeLessThanOrEqual(1100);
    expect(at.y + 480).toBeLessThanOrEqual(view.h - 8);
    expect(at.y).toBeGreaterThanOrEqual(8);
    // Taller than the window: pinned to the top margin (its CSS caps the height and it scrolls inside).
    expect(fitBox({ left: 10, top: 600, right: 60, bottom: 650 }, { w: 264, h: 900 }, view, 'side').y).toBe(8);
    // The cursor near the bottom-right: above-left of it.
    const c = fitBox({ left: 1250, top: 700, right: 1250, bottom: 700 }, { w: 264, h: 300 }, view, 'cursor');
    expect(c.x + 264).toBeLessThanOrEqual(1250);
    expect(c.y + 300).toBeLessThanOrEqual(700);
  });

  it('readHudLayout drops anything that is not a pair of finite numbers', () => {
    localStorage.setItem(HUD_LAYOUT_KEY, JSON.stringify({ party: { x: 12, y: -40 }, chat: { x: 'a', y: 1 }, guide: null, mini: { x: 1e9, y: 0 } }));
    expect(readHudLayout()).toEqual({ party: { x: 12, y: -40 } });
    localStorage.setItem(HUD_LAYOUT_KEY, '{nope');
    expect(readHudLayout()).toEqual({});
    localStorage.removeItem(HUD_LAYOUT_KEY);
  });

  it('pinCat sorts the Map pins into the key', () => {
    const base = { label: 'x', blurb: '', u: 0, v: 0 };
    expect(pinCat({ ...base, id: 'giver-x', kind: 'npc', mark: '?' })).toBe('quest');
    expect(pinCat({ ...base, id: 'hearth-shrine', kind: 'stall' })).toBe('hearth');
    expect(pinCat({ ...base, id: 'cave', kind: 'way', to: 'slagstone-cave' })).toBe('dungeon');
    expect(pinCat({ ...base, id: 'stairs', kind: 'way' })).toBe('way');
    expect(pinCat({ ...base, id: 'ship-a', kind: 'ship' })).toBe('ship');
  });

  it('the Map lists the surface and every floor of Ember Isle, and names its regions with level bands', () => {
    const def = CONTINENTS['ember-isle'];
    const links = levelLinks([...wayEntries(CONTINENTS, LEVELS), ...townEntries(CONTINENTS, LEVELS, {})], LEVELS);
    const rows = mapSections(def, 'Ember Isle', LEVELS, links, MOBS);
    expect(rows[0].id).toBe('surface');
    expect(rows.some(r => r.id === 'slagstone-cave')).toBeTrue();
    expect(rows.every(r => r.id === 'surface' || links.get(r.id)?.continent === 'ember-isle')).toBeTrue();
    const zones = zoneLabels(def, MOBS, { block: BLOCK });
    const ash = zones.find(z => z.name === 'The Ashfields');
    expect(ash?.band).not.toBeNull();
    expect(zones.every(z => z.u >= 0 && z.u <= 1 && z.v >= 0 && z.v <= 1)).toBeTrue();
    expect(zones.some(z => z.town && z.name === def.townName)).toBeTrue();
  });
});
