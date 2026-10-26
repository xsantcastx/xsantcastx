import { KeeperLife, LIFE, clampGuard, parseGuard, parseLifeClaim } from './keeper-life';
import { LifeMirror } from './life-mirror';

describe('keeper-life + life-mirror (protocol 10: the Keeper\'s life on the room)', () => {
  const guard = { max: 100, defense: 0, resists: { fire: 40 }, level: 5 };
  it('cuts a bite by the guard, bounds soaks and heals, and falls only after its grace', () => {
    const L = new KeeperLife(guard, 100);
    expect(L.bite(50, 'fire', 5, 0)).toBe(30);
    expect(L.claim({ q: 1, k: 'soak', n: 999 }, 0).n).toBe(30);
    L.claim({ q: 2, k: 'hurt', n: 120 }, 10);
    expect(L.tick(10 + LIFE.graceMs - 1)).toBeFalse();
    expect(L.tick(10 + LIFE.graceMs + 1)).toBeTrue();
    expect(L.view()).toEqual({ h: 0, m: 100, q: 2, d: 1 });
    expect(L.claim({ q: 3, k: 'wake', n: 0 }, 2000).ok).toBeTrue();
    expect(L.view()).toEqual({ h: 100, m: 100, q: 3 });
  });
  it('never lets a declared guard pass the save\'s ceiling, and reads claims and guards field by field', () => {
    expect(clampGuard({ max: 900, defense: 900, resists: { fire: 99 } }, guard).max).toBe(100);
    expect(parseGuard({ m: 10, d: 2, r: [1, 2, 3, 4] })?.resists).toEqual({ fire: 1, cold: 2, lightning: 3, arcane: 4 });
    expect(parseGuard({ m: 10, d: 2, r: [1, 2] })).toBeNull();
    expect(parseLifeClaim({ q: 1, k: 'potion', n: 40, p: 'health-1' })).toEqual({ q: 1, k: 'potion', n: 40, p: 'health-1' });
    expect(parseLifeClaim({ q: 1, k: 'revive', n: 40 })).toBeNull();
  });
  it('the screen shows the room\'s life plus what it has not taken yet (optimistic, then reconciled)', () => {
    const M = new LifeMirror();
    M.claim('heal', 10); M.claim('soak', 5);
    const sent = M.drain(0);
    expect(sent.map(c => c.q)).toEqual([1, 2]);
    // The room took the heal, not yet the soak: its life plus the soak in flight.
    expect(M.reconcile({ h: 50, m: 100, q: 1 }, 40)).toBe(55);
    expect(M.inFlight).toBe(1);
    // An older word is ignored; the soak taken: the room's number alone.
    expect(M.reconcile({ h: 40, m: 100, q: 0 })).toBeNull();
    expect(M.reconcile({ h: 61, m: 100, q: 2 }, 80)).toBe(61);
    expect(M.rtt).toEqual([40, 80]);
    // Harm the room did not see lowers the prediction until it is taken.
    M.claim('hurt', 20);
    expect(M.reconcile({ h: 61, m: 100, q: 2 })).toBe(41);
  });
});
