/**
 * coop-interp.ts — a member draws the host's creatures gliding between snapshots (protocol 4).
 *
 * Each new position starts a short glide from where the creature is drawn right now to where the host says it is,
 * lasting a little more than one snapshot interval (INTERP_MS), so at 8 Hz the motion is continuous and never runs
 * ahead of the host. A creature that jumped (a Teleport, a call climbing out) is placed, not slid. Pure.
 */
import { SNAP_MS } from './coop-protocol';

/** One glide: a little longer than the snapshot interval, so a creature walking steadily never stops between packets. */
export const INTERP_MS = Math.round(SNAP_MS * 1.2);
/** Further than this (world px) and the creature is placed. */
export const INTERP_SNAP = 160;

interface Glide { t0: number; x0: number; y0: number; t1: number; x1: number; y1: number }

export class CoopInterp {
  private readonly glides = new Map<string, Glide>();
  /** The host said `id` stands at (x, y), heard at `now` (ms). `still` (reduced motion): placed at once. */
  push(id: string, now: number, x: number, y: number, still = false): void {
    const g = this.glides.get(id);
    if (!g || still) { this.glides.set(id, { t0: now, x0: x, y0: y, t1: now, x1: x, y1: y }); return; }
    const at = this.sample(id, now)!;
    if (Math.hypot(x - at.x, y - at.y) > INTERP_SNAP) { this.glides.set(id, { t0: now, x0: x, y0: y, t1: now, x1: x, y1: y }); return; }
    this.glides.set(id, { t0: now, x0: at.x, y0: at.y, t1: now + INTERP_MS, x1: x, y1: y });
  }
  /** Where `id` is drawn at `now`; null when it was never heard of. */
  sample(id: string, now: number): { x: number; y: number } | null {
    const g = this.glides.get(id);
    if (!g) return null;
    if (now >= g.t1 || g.t1 <= g.t0) return { x: g.x1, y: g.y1 };
    const k = Math.max(0, (now - g.t0) / (g.t1 - g.t0));
    return { x: g.x0 + (g.x1 - g.x0) * k, y: g.y0 + (g.y1 - g.y0) * k };
  }
  /** Still gliding (the creature walks, as far as the drawing goes). */
  moving(id: string, now: number): boolean { const g = this.glides.get(id); return !!g && now < g.t1 && (g.x0 !== g.x1 || g.y0 !== g.y1); }
  forget(id: string): void { this.glides.delete(id); }
  clear(): void { this.glides.clear(); }
  get size(): number { return this.glides.size; }
}
