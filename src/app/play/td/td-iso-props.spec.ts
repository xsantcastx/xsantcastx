/**
 * td-iso-props.spec.ts — the isometric twins of what stands on the ground (td-iso-props.ts): every key bakes, a twin is
 * found from the top-down sprite itself, Low has no sway, trees fade and cast a shadow, fences run a tile at a time and
 * join across a one-tile gap, and a loot icon lies tipped onto the floor.
 */
import { barrel, fence, lamp, tree, spriteKey, TILE } from './td-art';
import { ISO_PROP_KEYS, CROWN_FADE, behindCrown, crownFade, fenceJoins, isoArt, isoArtByKey, isoIcon, isoPartDepth, isoParts, isoPropsFrame } from './td-iso-props';

describe('td-iso-props: the isometric twins', () => {
  it('every listed top-down key has a twin with pixels in it', () => {
    for (const key of ISO_PROP_KEYS) {
      const a = isoArtByKey(key, true);
      expect(a).withContext(key).not.toBeNull();
      const parts = a!.run ? [a!.run.seg, a!.run.cap] : [a!.base, ...a!.sway].filter(p => !!p);
      expect(parts.length).withContext(key).toBeGreaterThan(0);
      for (const p of parts) expect(p!.img.width * p!.img.height).withContext(key).toBeGreaterThan(0);
    }
  });

  it('a twin is found from the top-down sprite (its cache key), and none for an unknown painter', () => {
    isoPropsFrame(performance.now() + 1000);
    expect(spriteKey(barrel())).toBe('barrel');
    expect(isoArt(barrel())).not.toBeNull();
    isoPropsFrame(performance.now() + 1000);
    expect(isoArt({ img: document.createElement('canvas'), ax: 0, ay: 0 })).toBeNull();
  });

  it('a tree sways in three frames at Normal, one at Low; its crown fades and it casts a shadow', () => {
    const normal = isoArtByKey('tree:oak:2', false)!, low = isoArtByKey('tree:oak:2', true)!;
    expect(normal.sway.length).toBe(3);
    expect(low.sway.length).toBe(1);
    expect(normal.fades).toBeTrue();
    expect(normal.shadow).not.toBeNull();
    // A Keeper a step north of the tree (behind it on screen) under its crown fades it; one in front does not.
    const x = 400, y = 400, X = x - y, Y = (x + y) / 2;
    expect(behindCrown(normal, x, y, [X, Y - 14], 1)).toBeTrue();
    expect(behindCrown(normal, x, y, [X, Y + 8], 1)).toBeFalse();
    expect(behindCrown(normal, x, y, [X, Y + 8, X + 4, Y - 20], 2)).toBeTrue();
    // A lamp is static, a top-down tree key reaches the same twin.
    expect(isoArtByKey('lamp', false)!.sway.length).toBe(0);
    isoPropsFrame(performance.now() + 1000);
    expect(spriteKey(tree('oak', 2))).toMatch(/tree:oak:2$/);
    expect(spriteKey(lamp())).toBe('lamp');
  });

  it('a crown eases toward its fade and back, and snaps under reduced motion', () => {
    const o = {};
    const a = crownFade(o, true, .05, false);
    expect(a).toBeLessThan(1); expect(a).toBeGreaterThan(CROWN_FADE);
    expect(crownFade(o, true, 1, false)).toBe(CROWN_FADE);
    expect(crownFade(o, false, 1, false)).toBe(1);
    expect(crownFade({}, true, 0, true)).toBe(CROWN_FADE);
  });

  it('a fence run is laid a tile at a time, each tile at its own depth, and joins the next run across one tile', () => {
    const a = isoArtByKey('fence:3', false)!;
    expect(a.run?.tiles).toBe(3);
    expect(isoParts(a)).toBe(4);
    const d = [0, 1, 2, 3].map(i => isoPartDepth(a, 100, 200, i));
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1]);
    const sp = fence(3);
    const run = { x: 100, y: 200, sprite: () => sp }, next = { x: 100 + 4 * TILE, y: 200, sprite: () => sp }, far = { x: 100 + 6 * TILE, y: 200, sprite: () => sp };
    expect(fenceJoins(run, a, () => [run, next])).toBeTrue();
    expect(fenceJoins({ ...run }, a, () => [run, far])).toBeFalse();
  });

  it('a loot icon lies tipped back onto the floor, with a pixel of thickness, its foot at its lower edge', () => {
    const icon = document.createElement('canvas'); icon.width = 14; icon.height = 14;
    icon.getContext('2d')!.fillRect(0, 0, 14, 14);
    const p = isoIcon(icon);
    expect(p.img.width).toBe(35);
    expect(p.img.height).toBeLessThan(35);
    expect(p.ay).toBeGreaterThan(p.img.height - 4);
    expect(isoIcon(icon)).toBe(p);
  });
});
