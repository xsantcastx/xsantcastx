import { NEARBY_REACH } from './td-corpse';
import { groupPiles, nearbyList, nearbySig, stackName, type CorpseIn, type LooseDrop } from './td-nearby';

const drop = (id: string, x: number, y: number, over: Partial<LooseDrop> = {}): LooseDrop => ({
  id, x, y, label: id, qty: 1, coins: 0, rarity: null, color: '#fff', art: '', stack: false, shared: false, own: false, room: false, by: '', ...over,
});
const corpse = (id: string, x: number, y: number, n = 1, stage = 'fresh'): CorpseIn => ({
  id, name: 'Ash Wolf', x, y, stage, rot: 0.1, age: 5,
  items: Array.from({ length: n }, (_, i) => ({ id: `${id}-l${i}`, label: 'ember residue', qty: 2, coins: 0, rarity: null, color: '#fff', art: '', stack: true, shared: false })),
});

describe('td-nearby (the satchel\'s Nearby tab)', () => {
  it('the in-reach radius is 3 tiles', () => { expect(NEARBY_REACH).toBe(48); });

  it('lists corpses and piles nearest first, in reach within 48, out to 128, none beyond', () => {
    const list = nearbyList(0, 0, [corpse('a', 30, 0), corpse('b', 80, 0), corpse('far', 200, 0)], [drop('own:s1', 10, 0, { own: true })]);
    expect(list.map(c => c.id)).toEqual(['pile:own:s1', 'corpse:a', 'corpse:b']);
    expect(list.map(c => c.inReach)).toEqual([true, true, false]);
    expect(list[2].tiles).toBe(5);
  });

  it('a corpse with nothing left is not listed', () => {
    expect(nearbyList(0, 0, [corpse('a', 10, 0, 0)], []).length).toBe(0);
  });

  it('drops within one tile of each other merge into one pile', () => {
    const piles = groupPiles([drop('1', 0, 0), drop('2', 12, 4), drop('3', 40, 0)]);
    expect(piles.length).toBe(2);
    expect(piles[0].drops.map(d => d.id)).toEqual(['1', '2']);
  });

  it('an online pile carries who laid it; a room-only pile is a room container', () => {
    const list = nearbyList(0, 0, [], [drop('shared:x', 20, 0, { shared: true, by: 'Bryn' }), drop('r1', 100, 0, { room: true })]);
    expect(list[0].by).toBe('Bryn');
    expect(list[0].kind).toBe('ground');
    expect(list[1].kind).toBe('room');
  });

  it('the signature changes when a piece goes or the Keeper crosses a tile', () => {
    const a = nearbySig(nearbyList(0, 0, [corpse('a', 30, 0, 2)], []));
    const b = nearbySig(nearbyList(0, 0, [corpse('a', 30, 0, 1)], []));
    const c = nearbySig(nearbyList(-20, 0, [corpse('a', 30, 0, 2)], []));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('a stack label keeps its name when its count is redrawn', () => {
    expect(stackName('Ash Log ×5')).toBe('Ash Log');
    expect(stackName('Ash Log')).toBe('Ash Log');
  });
});
