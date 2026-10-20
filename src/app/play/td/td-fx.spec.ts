import { FX, LOOT, beamMotes, beamSteps, burst, circlePixels, conePixels, discRows, groundRing, linePixels, lootBeam, polyPoints, ringArc, ringDash, type LootRung } from './td-fx';

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

describe('td-fx: loot on the ground (third pass)', () => {
  const whole = (ps: readonly { x: number; y: number }[]) => ps.every(p => Number.isInteger(p.x) && Number.isInteger(p.y));
  const LADDER: LootRung[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'];

  it('mirrors the --cozy-loot-* tokens as the body of each rung', () => {
    expect(LOOT.common.body).toBe('#d8d2c2');
    expect(LOOT.uncommon.body).toBe('#6fd36a');
    expect(LOOT.rare.body).toBe('#5aa8ff');
    expect(LOOT.epic.body).toBe('#b46bff');
    expect(LOOT.legendary.body).toBe('#ff9a3c');
    expect(LOOT.mythic.body).toBe('#ffd25a');
    for (const r of LADDER) for (const c of [LOOT[r].core, LOOT[r].body, LOOT[r].edge]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('stands the rarer taller: common only glints, legendary and up carry motes', () => {
    expect(lootBeam('common').h).toBe(0);
    for (let i = 1; i < LADDER.length; i++) expect(lootBeam(LADDER[i]).h).toBeGreaterThan(lootBeam(LADDER[i - 1]).h);
    expect(lootBeam('epic').motes).toBe(0);
    expect(lootBeam('legendary').motes).toBeGreaterThan(0);
    expect(lootBeam('mythic').motes).toBeGreaterThan(0);
  });

  it('steps a column\'s falloff in bands (no gradient), dimmer going up, never over 55%', () => {
    expect(beamSteps(0)).toEqual([]);
    const s = beamSteps(38);
    expect(s.length).toBe(3);
    expect(s[0].y0).toBe(-0);
    expect(s[2].y1).toBe(-38);
    for (let i = 1; i < s.length; i++) { expect(s[i].a).toBeLessThan(s[i - 1].a); expect(s[i].y0).toBe(s[i - 1].y1); }
    expect(beamSteps(38, .9)[0].a).toBeLessThanOrEqual(.55);
  });

  it('keeps rising motes on whole pixels inside the column', () => {
    for (const t of [0, .7, 2.9]) {
      const m = beamMotes(38, 3, t, 5);
      expect(m.length).toBe(3);
      expect(whole(m)).toBeTrue();
      for (const q of m) { expect(q.y).toBeLessThanOrEqual(-4); expect(q.y).toBeGreaterThanOrEqual(-38); expect(Math.abs(q.x)).toBeLessThanOrEqual(3); }
    }
  });

  it('lays a ring flat on the ground: twice as wide as it is tall, each pixel once', () => {
    const r = groundRing(8);
    expect(whole(r)).toBeTrue();
    expect(new Set(r.map(p => `${p.x},${p.y}`)).size).toBe(r.length);
    expect(Math.max(...r.map(p => p.x))).toBe(8);
    expect(Math.max(...r.map(p => p.y))).toBe(4);
  });
});

describe('td-fx: a boss\'s tell (fourth pass)', () => {
  it('draws a cone toward its angle: outline and a sparse dither, all inside its reach and spread', () => {
    const { edge, fill } = conePixels(60, .3, 0);
    expect(edge.length).toBeGreaterThan(60);
    expect(fill.length).toBeGreaterThan(50);
    for (const p of [...edge, ...fill]) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBeTrue();
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(61);
      expect(p.x).toBeGreaterThanOrEqual(0);
      const r = Math.hypot(p.x, p.y);
      if (r > 4) expect(Math.abs(Math.atan2(p.y, p.x))).toBeLessThanOrEqual(.3 + 1.5 / r);
    }
    // Dithered: no two fill pixels side by side.
    const set = new Set(fill.map(p => `${p.x},${p.y}`));
    expect(fill.some(p => set.has(`${p.x + 1},${p.y}`))).toBeFalse();
    // Pointing down, it lies below.
    expect(conePixels(40, .2, Math.PI / 2).fill.every(p => p.y > 0)).toBeTrue();
  });
});
