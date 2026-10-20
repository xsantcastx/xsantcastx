import { FX, burst, circlePixels, discRows, linePixels, polyPoints, ringArc, ringDash } from './td-fx';

describe('td-fx (the effects kit: whole pixels only)', () => {
  const whole = (ps: readonly { x: number; y: number }[]) => ps.every(p => Number.isInteger(p.x) && Number.isInteger(p.y));

  it('gives every element three tones', () => {
    for (const t of Object.values(FX)) for (const c of [t.core, t.body, t.edge]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(FX.ember.body).toBe('#ffb347');
  });

  it('draws a circle as whole pixels on its radius, each once', () => {
    const ring = circlePixels(48);
    expect(whole(ring)).toBeTrue();
    expect(new Set(ring.map(p => `${p.x},${p.y}`)).size).toBe(ring.length);
    for (const p of ring) expect(Math.abs(Math.hypot(p.x, p.y) - 48)).toBeLessThan(1);
    // Ordered round the circle: neighbours touch.
    for (let i = 1; i < ring.length; i++) expect(Math.max(Math.abs(ring[i].x - ring[i - 1].x), Math.abs(ring[i].y - ring[i - 1].y))).toBeLessThanOrEqual(2);
  });

  it('dithers a dash ring: never two lit pixels side by side, both tones present, and it turns', () => {
    const a = ringDash(30, 0), b = ringDash(30, .25);
    expect(a.length).toBeGreaterThan(20);
    expect(a.length).toBeLessThan(circlePixels(30).length / 2);
    expect(a.some(p => p.tone === 0) && a.some(p => p.tone === 1)).toBeTrue();
    const key = (ps: typeof a) => ps.map(p => `${p.x},${p.y}`).join('|');
    expect(key(a)).not.toBe(key(b));
    expect(key(ringDash(30, 1))).toBe(key(a));
  });

  it('cuts a short arc of the ring toward an angle', () => {
    const arc = ringArc(48, 0, .3);
    expect(arc.length).toBeGreaterThan(5);
    for (const p of arc) expect(p.x).toBeGreaterThan(40);
  });

  it('fills a disc as rows of whole half-widths', () => {
    const rows = discRows(10);
    expect(rows.length).toBe(21);
    expect(rows[10]).toEqual({ y: 0, w: 10 });
    expect(rows[0].w).toBe(0);
  });

  it('bursts out and falls, the same every frame for the same seed', () => {
    expect(burst(8, .5, 3)).toEqual(burst(8, .5, 3));
    expect(burst(8, 0, 3).every(p => p.x === 0 && p.y === 0)).toBeTrue();
    const end = burst(8, 1, 3, 10, 8);
    expect(end.length).toBe(8);
    expect(whole(end)).toBeTrue();
    expect(end.reduce((s, p) => s + p.y, 0) / 8).toBeGreaterThan(4);   // they fall
  });

  it('walks a line pixel by pixel and lays polygon corners on whole pixels', () => {
    const l = linePixels(0, 0, 5, 3);
    expect(l[0]).toEqual({ x: 0, y: 0 });
    expect(l[l.length - 1]).toEqual({ x: 5, y: 3 });
    expect(l.length).toBe(6);
    const hex = polyPoints(6, 13, 18, .4);
    expect(hex.length).toBe(6);
    expect(whole(hex)).toBeTrue();
  });
});
