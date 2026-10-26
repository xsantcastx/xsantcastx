/** td-ground-pile.spec.ts — many things on one tile are one pile (owner 2026-10-26, RuneScape-style). */
import { TILE } from './td-art';
import { heapOffset, pileAt, pileCount, pilesOf, tileCentre, tileKey } from './td-ground-pile';

describe('ground piles', () => {
  const at = (id: string, x: number, y: number, coins = 0) => ({ id, x, y, coins });
  it('groups everything on a tile into one pile, in the order it was laid', () => {
    const c = tileCentre(5 * TILE + 3, 7 * TILE + 9);
    const items = [0, 1, 2, 3, 4].map(n => { const o = heapOffset(n); return at(`i${n}`, c.x + o.dx, c.y + o.dy); });
    items.push(at('far', c.x + TILE * 3, c.y));
    const piles = pilesOf(items);
    expect(piles.size).toBe(2);
    expect(piles.get(tileKey(c.x, c.y))!.map(g => g.id)).toEqual(['i0', 'i1', 'i2', 'i3', 'i4']);
    expect(pileCount(piles.get(tileKey(c.x, c.y))!)).toBe(5);
  });
  it('a heap offset never leaves its tile', () => {
    const c = tileCentre(0, 0);
    for (let n = 0; n < 40; n++) { const o = heapOffset(n); expect(tileKey(c.x + o.dx, c.y + o.dy)).toBe(tileKey(c.x, c.y)); }
  });
  it('the pile under a point is the nearest thing and all on its tile; nothing near → empty', () => {
    const c = tileCentre(10 * TILE, 10 * TILE);
    const items = [at('a', c.x, c.y), at('b', c.x + 2, c.y - 2, 30), at('x', c.x + 5 * TILE, c.y)];
    expect(pileAt(items, c.x + 1, c.y - 4).map(g => g.id)).toEqual(['a', 'b']);
    expect(pileAt(items, c.x + 2 * TILE + 3, c.y)).toEqual([]);
  });
});
