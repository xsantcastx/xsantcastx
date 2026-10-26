import { TILE } from './td-art';
import { ROAM, Stand, newRoam, stepRoam, type RoamIn, type RoamState } from './td-roam';

/** A tiny repeatable rng. */
function lcg(seed: number): () => number { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const open = () => true;

describe('td-roam', () => {
  const base = (over: Partial<RoamIn>): RoamIn => ({
    me: { x: 0, y: 0 }, keeper: { x: 0, y: 0 }, stand: { calm: true }, dt: 1 / 30, foe: null, called: false, free: open, sees: open, rng: lcg(7), ...over,
  });
  /** Walk a companion by the machine for `secs`; returns the farthest it got from the keeper. */
  function walk(s: RoamState, me: { x: number; y: number }, over: Partial<RoamIn>, secs: number): { far: number; near: number } {
    const rng = lcg(11);
    let far = 0, near = Infinity;
    for (let t = 0; t < secs * 30; t++) {
      const o = stepRoam(s, base({ me, rng, ...over }));
      if (o.goal) { const d = Math.hypot(o.goal.x - me.x, o.goal.y - me.y); if (d > 1) { const st = Math.min(d, 52 * o.pace / 30); me.x += (o.goal.x - me.x) / d * st; me.y += (o.goal.y - me.y) / d * st; } }
      const d = Math.hypot(me.x - (over.keeper?.x ?? 0), me.y - (over.keeper?.y ?? 0));
      far = Math.max(far, d); if (t > 60) near = Math.min(near, d);
    }
    return { far, near };
  }

  it('calms only after the Keeper has stood still a moment, and stays calm near where he stood', () => {
    const st = new Stand();
    st.update({ x: 0, y: 0 }, 1, false);
    expect(st.calm).toBeFalse();
    st.update({ x: 0, y: 0 }, 1, false);
    expect(st.calm).toBeTrue();
    st.update({ x: 2 * TILE, y: 0 }, .1, true);
    expect(st.calm).toBeTrue();
    st.update({ x: 4 * TILE, y: 0 }, .1, true);
    expect(st.calm).toBeFalse();
  });

  it('roams 3 to 8 tiles from the Keeper while he stands still', () => {
    const s = newRoam(), me = { x: 20, y: 0 };
    const { far } = walk(s, me, {}, 60);
    expect(s.mode).toBe('roam');
    expect(far).toBeLessThanOrEqual(ROAM.maxR + 1);
    expect(far).toBeGreaterThan(ROAM.minR - ROAM.arrive - 1);
    // Every goal it picks lies in the ring.
    const rng = lcg(3), s2 = newRoam();
    for (let i = 0; i < 400; i++) {
      const o = stepRoam(s2, base({ rng }));
      if (o.goal) { const d = Math.hypot(o.goal.x, o.goal.y); expect(d).toBeGreaterThanOrEqual(ROAM.minR - .01); expect(d).toBeLessThanOrEqual(ROAM.maxR + .01); s2.has = false; s2.pause = 0; }
    }
  });

  it('only picks open, visible ground', () => {
    const rng = lcg(5), s = newRoam();
    let picked = 0;
    for (let i = 0; i < 300; i++) {
      const o = stepRoam(s, base({ rng, free: (x) => x > 0, sees: (_a, _b, x) => x > 0 }));
      if (o.goal) { expect(o.goal.x).toBeGreaterThan(0); picked++; s.has = false; s.pause = 0; }
    }
    expect(picked).toBeGreaterThan(0);
    const blocked = newRoam();
    for (let i = 0; i < 100; i++) expect(stepRoam(blocked, base({ rng, free: () => false })).goal).toBeNull();
  });

  it('returns when the Keeper walks away, running back until near', () => {
    const s = newRoam();
    stepRoam(s, base({ me: { x: 7 * TILE, y: 0 } }));
    expect(s.mode).toBe('roam');
    const away = { stand: { calm: false }, me: { x: 7 * TILE, y: 0 }, keeper: { x: 0, y: 0 } };
    expect(stepRoam(s, base(away)).mode).toBe('return');
    expect(stepRoam(s, base({ ...away, me: { x: 4 * TILE, y: 0 } })).mode).toBe('return');
    expect(stepRoam(s, base({ ...away, me: { x: 2 * TILE, y: 0 } })).mode).toBe('travel');
  });

  it('returns when called, and when it has strayed past 8 tiles', () => {
    expect(stepRoam(newRoam(), base({ called: true, me: { x: 2 * TILE, y: 0 } })).mode).toBe('return');
    expect(stepRoam(newRoam(), base({ me: { x: 9 * TILE, y: 0 } })).mode).toBe('return');
  });

  it('hunts a creature within 8 tiles of the Keeper, not one at 12', () => {
    expect(stepRoam(newRoam(), base({ foe: { x: 7 * TILE, y: 0 } })).mode).toBe('hunt');
    expect(stepRoam(newRoam(), base({ foe: { x: 12 * TILE, y: 0 } })).mode).toBe('roam');
    // On the march a near foe is fought as before.
    expect(stepRoam(newRoam(), base({ stand: { calm: false }, foe: { x: 5 * TILE, y: 0 } })).mode).toBe('hunt');
    // Called: only what is at his side.
    expect(stepRoam(newRoam(), base({ called: true, foe: { x: 7 * TILE, y: 0 } })).mode).toBe('return');
    expect(stepRoam(newRoam(), base({ called: true, foe: { x: 2 * TILE, y: 0 } })).mode).toBe('hunt');
  });

  it('keeps to the formation while the Keeper travels', () => {
    const s = newRoam();
    for (let i = 0; i < 50; i++) {
      const o = stepRoam(s, base({ stand: { calm: false }, me: { x: 30, y: 10 } }));
      expect(o.mode).toBe('travel'); expect(o.goal).toBeNull(); expect(o.idle).toBeFalse(); expect(o.pace).toBe(1);
    }
  });

  it('sniffs between points', () => {
    const s = newRoam(), rng = lcg(2);
    let idle = 0;
    for (let i = 0; i < 300; i++) if (stepRoam(s, base({ rng })).idle) idle++;
    expect(idle).toBeGreaterThan(20);
  });
});
