import { type Ground } from './td-art';
import { IsoTiles } from './td-iso-tiles';
import { BLOCK_GROUND } from './td-iso-ground';

/** A diamond's box (64 × 32 HD px). */
const W = 64, H = 32;
const ALL: Ground[] = ['grass', 'dirt', 'cobble', 'sand', 'water', 'ember', 'plank', 'flowers', 'cave', 'rock', 'wall', 'rug', 'moss', 'flagstone',
  'vinewall', 'canopy', 'bark', 'mire', 'wetstone', 'blackwater', 'drownwall', 'boardwalk'];

function paint(t: IsoTiles, c = 0, r = 0, f = 0): Uint32Array {
  const px = new Uint32Array(W * H);
  t.lay(px, W, H, 0, 0, c, r, f);
  return px;
}
/** The diamond's pixels that were written (opaque). */
const filled = (px: Uint32Array) => px.reduce((n, v) => n + (v >>> 24 === 0xff ? 1 : 0), 0);

describe('IsoTiles (iso-native ground)', () => {
  it('paints every walkable ground of the game straight into its diamond, and leaves the blocks to the walls', () => {
    for (const k of ALL) {
      const t = new IsoTiles(() => k);
      if (BLOCK_GROUND.has(k)) { expect(t.paints(k)).withContext(k).toBeFalse(); continue; }
      expect(t.paints(k)).withContext(k).toBeTrue();
      // A 2:1 diamond in a 64 × 32 box holds 1 024 pixels.
      expect(filled(paint(t))).withContext(k).toBe(1024);
    }
  });

  it('a plain tile from the cache is the same as one painted fresh', () => {
    const a = new IsoTiles(() => 'grass'), first = paint(a, 3, 5), again = paint(a, 3, 5);
    expect(Array.from(again)).toEqual(Array.from(first));
    // The same place in the textures' repeat (16 tiles along each diagonal), painted by a fresh painter: the same pixels.
    expect(Array.from(paint(new IsoTiles(() => 'grass'), 3 + 16, 5 + 16))).toEqual(Array.from(first));
  });

  it('grass grows into a road beside it along a wandering edge, never as a straight tile seam', () => {
    const g = (c: number, r: number): Ground => (r < 0 ? 'grass' : 'dirt');
    const road = paint(new IsoTiles(g)), dirt = paint(new IsoTiles(() => 'dirt'));
    let changed = 0;
    for (let i = 0; i < road.length; i++) if (road[i] !== dirt[i]) changed++;
    expect(changed).toBeGreaterThan(40);
    expect(changed).toBeLessThan(600);
  });

  it('water lights foam along a shore and changes from frame to frame', () => {
    const g = (c: number): Ground => (c < 0 ? 'sand' : 'water');
    const t = new IsoTiles(g), f0 = paint(t, 0, 0, 0), f1 = paint(t, 0, 0, 1);
    const foam = 0xfff2f8ee; // #eef8f2 as ABGR
    expect(f0.some(v => v === foam)).toBeTrue();
    expect(Array.from(f0)).not.toEqual(Array.from(f1));
  });

  it('a pier over the sea hangs a beam face below its diamond, over the water', () => {
    const g = (c: number, r: number): Ground => (c === 0 && r <= 0 ? 'plank' : 'water');
    const t = new IsoTiles(g), w = 64, h = 64, px = new Uint32Array(w * h);
    t.lay(px, w, h, 0, 0, 0, 0, 0);
    expect(px[34 * w + 32]).toBe(0);
    expect(t.hasFaces(0, 0)).toBeTrue();
    t.faces(px, w, h, 0, 0, 0, 0, 0);
    // Under the bottom vertex (32, 32): the beam face.
    expect(px[34 * w + 32] >>> 24).toBe(0xff);
  });

  it('Low paints hard diamond edges (no growing in)', () => {
    const g = (c: number, r: number): Ground => (r < 0 ? 'grass' : 'dirt');
    const t = new IsoTiles(g); t.low = true;
    const plain = new IsoTiles(() => 'dirt'); plain.low = true;
    expect(Array.from(paint(t))).toEqual(Array.from(paint(plain)));
  });
});
