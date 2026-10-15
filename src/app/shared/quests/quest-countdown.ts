/**
 * quest-countdown.ts — the board's reset countdown label (it outlived the site's quest drawer).
 */
/** "4h 23m" / "2d 6h" / "48s". Coarse on purpose — this is flavour, not a timer. */
export function countdownTo(iso: string | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'moments';

  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
