import { SkyLight, type EngineSky } from './sky-light';

/** The night's lamps on a phone (docs/handoff/perf-regression.md): a pre-scaled copy, the same pixels. */
describe('SkyLight lamps', () => {
  const NIGHT: EngineSky = { phase: 'night', light: 0, glow: 0, eclipse: 0, night: true, eclipseOn: false, dark: true, alignedHunt: null };
  function frame(): CanvasRenderingContext2D {
    const el = document.createElement('canvas');
    el.width = 300; el.height = 300;
    const c = el.getContext('2d')!;
    // A phone frame's world transform: scale by the pixel scale, then the camera.
    c.setTransform(1.75, 0, 0, 1.75, -40, -12);
    return c;
  }

  it('baked: one unscaled copy at a whole device pixel, the sprite made once per size', () => {
    const sky = new SkyLight();
    sky.set(NIGHT, 'infernal');
    const c = frame();
    const draw = spyOn(c, 'drawImage').and.callThrough();
    sky.drawLamp(c, 100.3, 80.6, 40, false, 1, true);
    sky.drawLamp(c, 150.1, 70.2, 40, false, 1, true);
    expect(draw.calls.count()).toBe(2);
    for (const call of draw.calls.all()) {
      expect((call.args as unknown[]).length).toBe(3);
      expect(Number.isInteger(call.args[1])).toBeTrue();
      expect(Number.isInteger(call.args[2])).toBeTrue();
      expect((call.args[0] as HTMLCanvasElement).width).toBe(Math.round(80 * 1.75));
    }
    expect(draw.calls.argsFor(0)[0]).toBe(draw.calls.argsFor(1)[0]);
    // The frame's transform is left as it was.
    expect(c.getTransform().a).toBe(1.75);
  });

  it('live (desktop): the glow scaled into place, as before', () => {
    const sky = new SkyLight();
    sky.set(NIGHT, 'infernal');
    const c = frame();
    const draw = spyOn(c, 'drawImage').and.callThrough();
    sky.drawLamp(c, 100, 80, 40, true);
    expect((draw.calls.argsFor(0) as unknown[]).length).toBe(5);
  });

  it('baked and live lay the same glow (within a resample rounding)', () => {
    const pixels = (baked: boolean) => {
      const sky = new SkyLight();
      sky.set(NIGHT, 'infernal');
      const c = frame();
      // A lamp whose box lands on whole device pixels: the two paths differ only by the resample.
      sky.drawLamp(c, 120, 80, 40, false, 1, baked);
      return c.getImageData(0, 0, 300, 300).data;
    };
    const a = pixels(false), b = pixels(true);
    let max = 0;
    for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
    expect(max).toBeLessThanOrEqual(8);
  });

  it('draws nothing by day', () => {
    const sky = new SkyLight();
    const c = frame();
    const draw = spyOn(c, 'drawImage');
    sky.drawLamp(c, 100, 80, 40, false, 1, true);
    expect(draw).not.toHaveBeenCalled();
  });
});
