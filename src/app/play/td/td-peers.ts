/**
 * td-peers.ts — the other Keepers in the top-down world (owner 2026-10-21: "can other players see each other?").
 *
 * The Hearth room (play/social) reports who is online and where; this draws the ones in the Keeper's own area as
 * real sprites (the same painter and front sheet as the Keeper's, dressed in their class's own kit — worn gear does
 * not travel), each with a name plate, gliding between packets (social/peer-tracker). They never block a step: there
 * is no collision with other Keepers. Under reduced motion they stand where they were last seen and the Wave holds
 * still.
 *
 * A tap on one names it (EngineOptions.onPeerTap: the HUD's small card, with Wave). A Wave hangs over the Keeper who
 * waved and the one waved at for a few seconds.
 */
import { KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { carriesStaff, vocationLook } from '../../shared/keeper-look/vocation-look';
import { FRONT_AX, FRONT_AY, FRONT_H, FRONT_W, frontFrame, frontSheet } from '../../shared/keeper-look/keeper-front';
import { defaultLook, VOCATIONS, type KeeperLook, type Vocation } from '../../shared/keeper-look/keeper-look.model';
import { PeerTracker, type PeerShown } from '../social/peer-tracker';
import { unpackLook } from '../social/peer-look';
import type { RoomPlayer } from '../social/social-room';

/** How long a Wave hangs over a head (seconds). */
export const WAVE_SECS = 3;
/** Name plates: a cool mint, apart from the townsfolk's cream and the stalls' gold. */
export const PEER_PLATE = '#a8e6c4';
/** Party members' plates: the hearth's warm gold, so a friend stands out from the room's mint. */
export const PARTY_PLATE = '#ffd27a';
/** The world's own outline (td-art PAL.outline), for the Wave's bubble. */
const OUTLINE = '#1e1420';

export interface PeerCard { id: string; name: string; vocation: string; level: number }

export class TdPeers {
  private readonly tracker = new PeerTracker();
  private shown: PeerShown[] = [];
  private readonly painters = new Map<string, { key: string; painter: KeeperPainter }>();
  /** Waves by who ('' = the local Keeper): when they end (engine seconds). */
  private readonly waves = new Map<string, number>();

  /** The room's last list, raw (the Seek and the party read where members are, in any area). */
  private raw: readonly RoomPlayer[] = [];
  /** The party's other members (protocol 3): their plates turn gold, the minimap and the Seek know them. */
  party = new Set<string>();

  set(players: readonly RoomPlayer[], selfId = ''): void {
    this.raw = players.filter(p => p && p.id !== selfId);
    this.tracker.set(players, selfId);
    const keep = new Set(players.map(p => p.id));
    for (const id of [...this.painters.keys()]) if (!keep.has(id)) this.painters.delete(id);
  }

  step(dt: number, area: string, me: { x: number; y: number }, still: boolean): void {
    this.shown = this.tracker.step(dt, area, me, still);
  }

  get drawn(): readonly PeerShown[] { return this.shown; }
  /** A Keeper's cosmetic companions string (presence `pals`, protocol 5): its pet and Glim beside it. */
  palsOf(id: string): string { const p = this.raw.find(x => x.id === id); return typeof p?.pals === 'string' ? p.pals : ''; }
  /** The party members' town portals (presence `gate`, td-waygate.ts): cosmetic and travel only. */
  partyGates(): { id: string; gate: string }[] {
    return this.raw.filter(p => this.party.has(p.id) && typeof p.gate === 'string' && p.gate).map(p => ({ id: p.id, gate: p.gate as string }));
  }
  /** Where each party member last said it stood (any area), by the room's list. */
  partyWhere(): { id: string; name: string; area: string; x: number; y: number }[] {
    return this.raw.filter(p => this.party.has(p.id) && Number.isFinite(p.x) && Number.isFinite(p.y))
      .map(p => ({ id: p.id, name: p.name, area: String(p.area ?? p.zone ?? ''), x: p.x, y: p.y }));
  }

  /** The Keeper under a point in the world (feet to head, a sprite's width), nearest the feet first. */
  at(wx: number, wy: number): PeerCard | null {
    let best: PeerShown | null = null, bestD = Infinity;
    for (const p of this.shown) {
      if (Math.abs(wx - p.x) > 10 || wy < p.y - 36 || wy > p.y + 4) continue;
      const d = Math.abs(wy - (p.y - 16)) + Math.abs(wx - p.x);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best ? { id: best.id, name: best.name, vocation: best.vocation, level: best.level } : null;
  }

  /** A Wave over `who` ('' the local Keeper) until `now + WAVE_SECS`. */
  wave(who: string, now: number): void { this.waves.set(who, now + WAVE_SECS); }
  waving(who: string, now: number): boolean { return (this.waves.get(who) ?? 0) > now; }

  private painter(p: PeerShown): KeeperPainter {
    const key = `${p.look}|${p.vocation}`;
    const have = this.painters.get(p.id);
    if (have && have.key === key) return have.painter;
    const look: KeeperLook = unpackLook(p.look, p.vocation, p.name) ?? { ...defaultLook(), name: p.name };
    const v = vocationLook(VOCATIONS.includes(p.vocation as Vocation) ? p.vocation as Vocation : look.vocation, null);
    const painter = new KeeperPainter(look, v.gear, v.garb);
    this.painters.set(p.id, { key, painter });
    return painter;
  }

  /** One Keeper, feet at (p.x, p.y): the front/back sheet facing the camera or away, the painter's side view across. */
  draw(c: CanvasRenderingContext2D, p: PeerShown, view: { scale: number; camX: number; camY: number; time: number }): void {
    const sx = Math.round(p.x), sy = Math.round(p.y);
    c.fillStyle = 'rgba(30,18,26,.28)';
    c.fillRect(sx - 7, sy - 3, 14, 1); c.fillRect(sx - 9, sy - 2, 18, 2); c.fillRect(sx - 6, sy, 12, 1);
    const painter = this.painter(p);
    // A per-Keeper phase so two standing side by side do not breathe in step.
    const t = view.time + (p.id.charCodeAt(0) % 7) * .37;
    if (p.dir !== 'side') {
      const sheet = frontSheet(painter, carriesStaff(p.vocation)), row = p.dir === 'down' ? 0 : 1, f = frontFrame(t, p.moving);
      c.drawImage(sheet, f * FRONT_W, row * FRONT_H, FRONT_W, FRONT_H, sx - FRONT_AX, sy - FRONT_AY, FRONT_W, FRONT_H);
      return;
    }
    const s = view.scale;
    c.save();
    c.setTransform(s * p.face, 0, 0, s, (sx - view.camX) * s, (sy - view.camY) * s);
    painter.draw(c, 1, { action: p.moving ? 'walk' : 'idle', time: t, attackT: 0, weapon: false });
    c.restore();
  }

  /** The little Wave over a head: a brass bubble with a raised hand, rocking (still under reduced motion). */
  drawWave(c: CanvasRenderingContext2D, x: number, y: number, time: number, still: boolean): void {
    const rock = still ? 0 : Math.round(Math.sin(time * 9));
    const bx = Math.round(x) - 7, by = Math.round(y) - 15;
    c.fillStyle = OUTLINE; c.fillRect(bx - 1, by - 1, 16, 15); c.fillRect(bx + 6, by + 14, 3, 2);
    c.fillStyle = '#ffe6a8'; c.fillRect(bx, by, 14, 13);
    // The hand: a palm and four fingers, one thumb out; it rocks a pixel either way.
    const hx = bx + 4 + rock, hy = by + 3;
    c.fillStyle = '#c98a2a';
    c.fillRect(hx, hy + 4, 6, 5);
    for (const [dx, h] of [[0, 3], [1, 4], [3, 4], [5, 3]]) c.fillRect(hx + dx, hy + 4 - h, 1, h);
    c.fillRect(hx + 6, hy + 5, 1, 2);
  }
}
