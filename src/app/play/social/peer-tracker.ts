/**
 * peer-tracker.ts — the other Keepers the top-down world draws, from the Hearth room's presence list.
 *
 * Presence arrives a few times a second (social-room.ts throttles each sender to ~4/s); between packets each Keeper
 * glides toward where it last said it stood (exponential smoothing, frame-rate independent), and snaps when it jumped
 * (a ship, a stair, a Waystone) or when the player asked for reduced motion (like Glim, td-engine). Only Keepers in
 * the same area are shown, nearest first, at most `cap`. No collision: they are drawn, never walked into.
 *
 * Pure (no DOM, no canvas): the engine owns the drawing, this owns where.
 */
import type { RoomPlayer } from './social-room';

export type PeerDir = 'side' | 'down' | 'up';
export interface PeerShown {
  id: string; name: string; x: number; y: number; face: 1 | -1; dir: PeerDir; moving: boolean;
  vocation: string; level: number; look: string; area: string;
}
interface Track extends PeerShown { tx: number; ty: number; sentDir: PeerDir | null; sentMoving: boolean | null }

/** How fast a peer closes on its reported spot (per second; ~95% of the way in a quarter second). */
export const PEER_FOLLOW = 12;
/** Further than this from the last spot (world px) and the peer is placed, not slid. */
export const PEER_SNAP = 160;
/** The most Keepers drawn at once. */
export const PEER_CAP = 30;

/** The presence area as the server accepts it (`[a-z0-9_-]{1,40}`); '' when there is nothing usable. */
export function areaKey(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export class PeerTracker {
  private readonly tracks = new Map<string, Track>();
  constructor(private readonly cap = PEER_CAP) {}

  /** The room's list (the local Keeper excluded by `selfId`). Unknown or broken entries are skipped. */
  set(players: readonly RoomPlayer[], selfId = ''): void {
    const present = new Set<string>();
    for (const p of players) {
      if (!p || typeof p.id !== 'string' || p.id === selfId || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      present.add(p.id);
      // A v1 server only knows `zone`: the client sends its area id there too, so both servers line Keepers up.
      const area = areaKey(p.area ?? p.zone);
      const sentDir = p.dir === 'side' || p.dir === 'down' || p.dir === 'up' ? p.dir : null;
      const sentMoving = typeof p.moving === 'boolean' ? p.moving : p.animation ? p.animation === 'run' : null;
      const face: 1 | -1 = p.facing === -1 ? -1 : 1;
      const name = typeof p.name === 'string' ? p.name.slice(0, 24) : '';
      const vocation = typeof p.vocation === 'string' ? p.vocation : '';
      const level = Number.isInteger(p.level) && (p.level as number) > 0 ? p.level as number : 0;
      const look = typeof p.look === 'string' ? p.look : '';
      const t = this.tracks.get(p.id);
      if (!t || t.area !== area || Math.hypot(p.x - t.x, p.y - t.y) > PEER_SNAP) {
        this.tracks.set(p.id, { id: p.id, name, x: p.x, y: p.y, tx: p.x, ty: p.y, face, dir: sentDir ?? 'down', moving: !!sentMoving, vocation, level, look, area, sentDir, sentMoving });
      } else {
        Object.assign(t, { name, tx: p.x, ty: p.y, face, vocation, level, look, sentDir, sentMoving });
      }
    }
    for (const id of [...this.tracks.keys()]) if (!present.has(id)) this.tracks.delete(id);
  }

  /** Advance `dt` seconds and return who is drawn in `area`, nearest to `me` first, at most `cap`. */
  step(dt: number, area: string, me: { x: number; y: number }, still = false): PeerShown[] {
    const k = still ? 1 : 1 - Math.exp(-PEER_FOLLOW * Math.max(0, Math.min(dt, .5)));
    const out: Track[] = [];
    for (const t of this.tracks.values()) {
      const dx = t.tx - t.x, dy = t.ty - t.y;
      t.x += dx * k; t.y += dy * k;
      if (Math.abs(t.tx - t.x) < .05) t.x = t.tx;
      if (Math.abs(t.ty - t.y) < .05) t.y = t.ty;
      const gliding = Math.hypot(dx, dy) > .6;
      t.moving = t.sentMoving ?? gliding;
      // The way it faces: as sent (protocol 2), else read off the glide (a v1 server only has left/right).
      if (t.sentDir) t.dir = t.sentDir;
      else if (gliding) t.dir = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'down' : 'up') : 'side';
      if (!t.sentDir && gliding && Math.abs(dx) >= Math.abs(dy)) t.face = dx < 0 ? -1 : 1;
      if (t.area === area) out.push(t);
    }
    out.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    return out.slice(0, this.cap).map(t => ({ id: t.id, name: t.name, x: t.x, y: t.y, face: t.face, dir: t.dir, moving: t.moving, vocation: t.vocation, level: t.level, look: t.look, area: t.area }));
  }

  get size(): number { return this.tracks.size; }
}
