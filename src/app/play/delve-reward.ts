/**
 * delve-reward.ts: what a breaking Delve rock cell pays, decided apart from
 * whether it breaks (owner call, 2026-10-13: "in the Delve, digging is never
 * blocked; only the reward is rate-limited").
 *
 * A Delve rock cell that pays Mining goes through the town seam's action
 * economy (`selectCurrentWork` + `resolveMine`): one booked operation per
 * MINING_RECOVERY_MS, Mining XP and the ore it grants included. Before this
 * call the seam's refusal also refused the break, so a Pickaxe I cell that
 * takes four swings took seven and nothing said why. Now:
 *
 *   - `paid`: the seam booked the operation (XP + its ore). The cell breaks.
 *   - `resting`: the seam is still recovering. The cell breaks anyway and pays
 *     no XP and no ore. The cell is gone, so its mutation id can never pay
 *     later: no farming past the per-action cap, no double payment.
 *   - `refused`: something other than the breath (bag full, a failed save, a
 *     locked tier). The cell stands, cracked, so nothing is lost: the next hit
 *     asks again once the player has made room.
 *
 * Pure (no Angular) so scripts/seamworks-engine.test.cjs can drive it against
 * the real engine.
 */

export type DelveMineOutcome =
  | { outcome: 'paid'; replayed: boolean }
  | { outcome: 'resting' }
  | { outcome: 'refused'; code: string };

/** The slice of the action economy a Delve rock break needs. */
export interface DelveSeam {
  /** Milliseconds left on the Mining recovery right now (0 when an action is due). */
  recoveryRemainingMs(now: number): number;
  /** Book one Mining action keyed by `mutationId` (idempotent). */
  resolve(mutationId: string, now: number): { ok: true; replayed?: boolean } | { ok: false; code: string };
}

export function settleDelveMine(seam: DelveSeam, mutationId: string, now: number): DelveMineOutcome {
  if (seam.recoveryRemainingMs(now) > 0) return { outcome: 'resting' };
  const result = seam.resolve(mutationId, now);
  if (result.ok) return { outcome: 'paid', replayed: !!result.replayed };
  // The pre-check reads the selected Current Work; the gateway reads the seam
  // itself. Either saying "recovering" is the same breath.
  if (result.code === 'recovering') return { outcome: 'resting' };
  return { outcome: 'refused', code: result.code };
}

/**
 * The "+0 XP · the seam is catching its breath" cue shows at most once per
 * this window, so digging a run of cells during one breath does not stack
 * toasts. Longer than the recovery itself: a steady digger sees it now and
 * then, not on every cell.
 */
export const REST_CUE_GAP_MS = 6000;

export function restCueDue(lastCueAt: number | null, now: number): boolean {
  return lastCueAt === null || now - lastCueAt >= REST_CUE_GAP_MS || now < lastCueAt;
}
