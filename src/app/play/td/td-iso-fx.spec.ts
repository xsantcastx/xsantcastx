/**
 * td-iso-fx.spec.ts — the spells at the isometric angle (td-iso-fx.ts): the floor projector lays each world pixel as the
 * 2 × 1 iso pixel it covers (a world circle comes out the 2:1 iso ellipse, axis-aligned), the ground painters stop
 * squashing their rings while it runs, an air effect stands on the foot of what it hangs over, a projectile's shadow is
 * cast down and to the right, and the iso light map's falloff keeps the top-down steps.
 */
import { IsoFloorFx, airFoot, liftShadow } from './td-iso-fx';
import { circlePixels, deco, groundRing, setIsoFloor, sq } from './td-fx';
import { bayer4, isoLightOpen, isoWarmAt, lightOpen } from './td-night';
import { isoArtByKey } from './td-iso-props';

/** A canvas that records its fillRects (iso px) and the transform they were laid under. */
function recorder(): { c: CanvasRenderingContext2D; rects: number[][]; transforms: number[][] } {
  const rects: number[][] = [], transforms: number[][] = [];
  const c = {
    fillStyle: '#000', globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: false,
    setTransform: (...a: number[]) => { transforms.push(a); },
    fillRect: (x: number, y: number, w: number, h: number) => { rects.push([x, y, w, h]); },
    save: () => undefined, restore: () => undefined, drawImage: () => undefined, fillText: () => undefined,
  } as unknown as CanvasRenderingContext2D;
  return { c, rects, transforms };
}

describe('td-iso-fx: the floor projector', () => {
  it('lays a world pixel as the 2 × 1 iso pixel it covers, under the iso screen transform', () => {
    const r = recorder(), f = new IsoFloorFx().bind(r.c, 3, 100, 50);
    expect(r.transforms[0]).toEqual([3, 0, 0, 3, -300, -150]);
    f.ctx.fillRect(10, 4, 1, 1);
    // World (10, 4) → iso X = 10 − 4 = 6 (its diamond spans 5…7), Y = (10 + 4) / 2 = 7.
    expect(r.rects[0]).toEqual([5, 7, 2, 1]);
  });

  it('a world line along x is the 2:1 iso step, and a world circle the iso ellipse, twice as wide as tall', () => {
    const r = recorder(), f = new IsoFloorFx().bind(r.c, 1, 0, 0);
    for (let x = 0; x < 6; x++) f.ctx.fillRect(x, 0, 1, 1);
    expect(r.rects.map(q => [q[0], q[1]])).toEqual([[-1, 0], [0, 0], [1, 1], [2, 1], [3, 2], [4, 2]]);
    r.rects.length = 0;
    for (const q of circlePixels(20)) f.ctx.fillRect(q.x, q.y, 1, 1);
    const xs = r.rects.map(q => q[0]), ys = r.rects.map(q => q[1]);
    const w = Math.max(...xs) + 2 - Math.min(...xs), h = Math.max(...ys) + 1 - Math.min(...ys);
    expect(w / h).toBeGreaterThan(1.85);
    expect(w / h).toBeLessThan(2.15);
  });

  it('keeps the painters\' own scale (an HD pulse at ×2 lands on the half pixel), and stands upright pixels at a point', () => {
    const r = recorder(), f = new IsoFloorFx().bind(r.c, 1, 0, 0);
    f.ctx.save(); f.ctx.scale(.5, .5); f.ctx.fillRect(21, 8, 1, 1); f.ctx.restore();
    expect(r.rects[0]).toEqual([6, 7, 1, .5]);
    r.rects.length = 0;
    f.stand(10, 10);
    f.ctx.fillRect(9, 4, 1, 6);
    // Upright: offset from where (10, 10) projects (0, 10), not laid on the floor.
    expect(r.rects[0]).toEqual([-1, 4, 1, 6]);
    f.stand(NaN, NaN);
    f.ctx.fillRect(10, 10, 1, 1);
    expect(r.rects[1]).toEqual([-1, 10, 2, 1]);
  });

  it('the ground painters lay rings in world px while it runs, and squash them again after', () => {
    expect(sq(.5)).toBe(.5);
    const flat = groundRing(10), flatH = Math.max(...flat.map(q => q.y)) - Math.min(...flat.map(q => q.y));
    expect(flatH).toBeLessThanOrEqual(11);
    setIsoFloor(true);
    try {
      expect(sq(.5)).toBe(1);
      expect(deco(10)).toBe(7);
      const round = groundRing(10), roundH = Math.max(...round.map(q => q.y)) - Math.min(...round.map(q => q.y));
      expect(roundH).toBe(20);
    } finally { setIsoFloor(false); }
    expect(deco(10)).toBe(10);
  });
});

describe('td-iso-fx: height and shadows', () => {
  const mob = { x: 100, y: 200, def: { w: 20, h: 30 } };
  it('an air effect over a creature stands on its foot; one on the open ground stands on its own point', () => {
    expect(airFoot({ x: 102, y: 185 }, [mob], { x: 0, y: 0 })).toBe(200);
    expect(airFoot({ x: 160, y: 185 }, [mob], { x: 0, y: 0 })).toBe(185);
    expect(airFoot({ x: 5, y: -20 }, [mob], { x: 4, y: 0 })).toBe(0);
  });

  it('a projectile\'s shadow lies down and to the right of its foot, further the higher it flies', () => {
    const at = (lift: number) => { const r = recorder(); liftShadow(r.c, 0, 0, lift, 2, true); const xs = r.rects.map(q => q[0] + q[2] / 2); return xs.reduce((a, b) => a + b, 0) / xs.length; };
    expect(at(30)).toBeGreaterThan(at(4));
    expect(at(4)).toBeGreaterThanOrEqual(0);
  });
});

describe('td-iso-fx: the iso light map', () => {
  it('keeps the clear core and the dark beyond the rim, and only the top-down steps in between', () => {
    const levels = new Set([1, .8, .5, .3, .08, 0]);
    for (let f = 0; f <= 1; f += .01) for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) expect(levels.has(isoLightOpen(f, bayer4(x, y)))).withContext(`${f}`).toBeTrue();
    expect(isoLightOpen(.2, .99)).toBe(1);
    expect(isoLightOpen(1.01, .5)).toBe(0);
    expect(isoLightOpen(.55, .5)).toBe(lightOpen(.55));
    expect(isoWarmAt(.1, .5)).toBeCloseTo(.26, 5);
  });
});

describe('td-iso-fx: the dungeon dressing, ruins and ways between floors', () => {
  it('each has an isometric twin with pixels in it', () => {
    for (const key of ['altar', 'brazier-0', 'brazier-1', 'cage', 'chains', 'statue-broken', 'cobweb-nw', 'stairs-down', 'stairs-up', 'ladder-up', 'ruin-0', 'ruin-2']) {
      const a = isoArtByKey(key, false);
      expect(a?.base).withContext(key).toBeTruthy();
      expect(a!.base!.img.width * a!.base!.img.height).withContext(key).toBeGreaterThan(100);
    }
    // The stairs down lie in the floor and the cobweb sits at the tile's back: both sort behind what stands on the tile.
    expect(isoArtByKey('stairs-down', false)!.back).toBeGreaterThan(0);
    expect(isoArtByKey('cobweb-nw', false)!.back).toBeGreaterThan(0);
  });
});
