/**
 * coop-interp.spec.ts — a member's creatures glide between the host's snapshots (protocol 4).
 */
import { CoopInterp, INTERP_MS, INTERP_SNAP } from './coop-interp';
import { SNAP_MS } from './coop-protocol';

describe('coop-interp', () => {
  it('a first sighting is placed; the next glides there over INTERP_MS', () => {
    const ip = new CoopInterp();
    ip.push('a', 0, 100, 100);
    expect(ip.sample('a', 0)).toEqual({ x: 100, y: 100 });
    ip.push('a', 1000, 120, 100);
    expect(ip.sample('a', 1000)).toEqual({ x: 100, y: 100 });
    expect(ip.sample('a', 1000 + INTERP_MS / 2)!.x).toBeCloseTo(110, 5);
    expect(ip.sample('a', 1000 + INTERP_MS)).toEqual({ x: 120, y: 100 });
    expect(ip.sample('a', 5000)).toEqual({ x: 120, y: 100 });
    expect(ip.moving('a', 1000 + INTERP_MS / 2)).toBeTrue();
    expect(ip.moving('a', 1000 + INTERP_MS + 1)).toBeFalse();
  });

  it('steady 8 Hz walking is continuous: no jump at a packet, never ahead of the host', () => {
    const ip = new CoopInterp();
    let last = 0, worst = 0;
    ip.push('a', 0, 0, 0);
    for (let t = SNAP_MS; t < 3000; t += SNAP_MS) {
      const before = ip.sample('a', t)!.x;
      ip.push('a', t, t / 10, 0);                                   // the host walks 10 px a second… per 100 ms
      const after = ip.sample('a', t)!.x;
      expect(after).toBeCloseTo(before, 6);                         // a new packet never moves the drawing at once
      for (let k = t; k < t + SNAP_MS; k += 16) {
        const x = ip.sample('a', k)!.x;
        expect(x).toBeLessThanOrEqual(t / 10 + 1e-9);               // never past the host's own last word
        worst = Math.max(worst, x - last); last = x;
      }
    }
    expect(worst).toBeLessThan(3);
  });

  it('a jump past INTERP_SNAP (a Teleport, a call) is placed; reduced motion places every time', () => {
    const ip = new CoopInterp();
    ip.push('a', 0, 0, 0);
    ip.push('a', 100, INTERP_SNAP + 1, 0);
    expect(ip.sample('a', 100)).toEqual({ x: INTERP_SNAP + 1, y: 0 });
    ip.push('a', 200, INTERP_SNAP + 21, 0, true);
    expect(ip.sample('a', 200)).toEqual({ x: INTERP_SNAP + 21, y: 0 });
    ip.forget('a');
    expect(ip.sample('a', 300)).toBeNull();
  });
});
