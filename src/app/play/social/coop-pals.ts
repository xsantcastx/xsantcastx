/**
 * coop-pals.ts — other Keepers' companions (owner 2026-10-21: "when playing online I can't see the hunter's pets, and
 * he can't see my skeletons"). Pure: no Angular, no DOM.
 *
 * Each owner's client is the authority for its own companions — the pet (or a Thornstrider's spirit beast), the beasts
 * of Call of the Wilds and a stampede, raised skeletons, the Lanternwright's Lamp-Wisps and Beacon, and Glim.
 * - **Party members in the same area** (Hearth protocol 5, `POST /coop/pals`): the whole list ~5 times a second —
 *   id, kind, type, place, facing, life and whether it is fighting. The others glide them (coop-interp.ts) and draw
 *   them with the same painters. Their blows on the host's creatures are claims like the owner's own (td-mobs hurtMob).
 * - **Everyone else** (presence `pals`, cosmetic, at presence's own rate): only the pet and Glim, as offsets from the
 *   Keeper (`pet:moss-hedgehog:-12:4,glim::-14:-46`), so a stranger's companion walks at its side. Summons stay
 *   party-only.
 */
import { CoopInterp } from './coop-interp';

export type PalKind = 'pet' | 'beast' | 'stampede' | 'skel' | 'wisp' | 'beacon' | 'glim';
export const PAL_KINDS: readonly PalKind[] = ['pet', 'beast', 'stampede', 'skel', 'wisp', 'beacon', 'glim'];
/** One companion on the wire (party channel). */
export interface CoopPal { i: string; k: PalKind; t?: string; x: number; y: number; f: 1 | -1; h?: number; m?: number; a?: boolean }
/** The most companions one owner sends. */
export const PALS_MAX = 16;
/** The party channel's rate: one list every PAL_MS while others of the party share the area (a heartbeat a second when nothing moved). */
export const PAL_MS = 200;
export const PAL_HEARTBEAT_MS = 1000;
/** An owner not heard from this long: its companions are gone from other screens. */
export const PAL_EXPIRE_MS = 2500;
/** Presence offsets are rounded to this (a companion wiggling in place does not send a presence update). */
export const PAL_STEP = 4;

const TYPE = /^[a-z0-9-]{0,40}$/;

/** The cosmetic presence field: the pet and Glim as offsets from the Keeper (at most 96 characters). */
export function encodePresencePals(me: { x: number; y: number }, pals: readonly CoopPal[]): string {
  const q = (n: number) => Math.round(n / PAL_STEP) * PAL_STEP;
  const out: string[] = [];
  for (const p of pals) {
    if (p.k !== 'pet' && p.k !== 'glim') continue;
    const t = p.k === 'pet' && p.t && TYPE.test(p.t) ? p.t : '';
    const dx = Math.max(-999, Math.min(999, q(p.x - me.x))), dy = Math.max(-999, Math.min(999, q(p.y - me.y)));
    out.push(`${p.k}:${t}:${dx}:${dy}`);
  }
  const s = out.join(',');
  return s.length <= 96 ? s : out.slice(0, 1).join(',');
}
/** The presence field read back (anything malformed is skipped). */
export function decodePresencePals(raw: unknown): { k: 'pet' | 'glim'; t: string; dx: number; dy: number }[] {
  if (typeof raw !== 'string' || raw.length > 96) return [];
  const out: { k: 'pet' | 'glim'; t: string; dx: number; dy: number }[] = [];
  for (const part of raw.split(',')) {
    const [k, t, dx, dy] = part.split(':');
    if ((k !== 'pet' && k !== 'glim') || !TYPE.test(t ?? '') || !/^-?\d{1,3}$/.test(dx ?? '') || !/^-?\d{1,3}$/.test(dy ?? '')) continue;
    out.push({ k, t: t ?? '', dx: Number(dx), dy: Number(dy) });
  }
  return out.slice(0, 2);
}
/** A list as it may be sent: known kinds, whole numbers, at most PALS_MAX. */
export function cleanPals(pals: readonly CoopPal[]): CoopPal[] {
  const out: CoopPal[] = [];
  for (const p of pals) {
    if (!PAL_KINDS.includes(p.k) || !/^[a-z0-9]{1,10}$/.test(p.i) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 1e6 || Math.abs(p.y) > 1e6) continue;
    const c: CoopPal = { i: p.i, k: p.k, x: Math.round(p.x), y: Math.round(p.y), f: p.f === -1 ? -1 : 1 };
    if (p.t && TYPE.test(p.t)) c.t = p.t;
    if (Number.isFinite(p.h) && Number.isFinite(p.m) && (p.m as number) >= 1) { c.m = Math.min(1e6, Math.round(p.m as number)); c.h = Math.max(0, Math.min(c.m, Math.round(p.h as number))); }
    if (p.a) c.a = true;
    out.push(c);
    if (out.length >= PALS_MAX) break;
  }
  return out;
}

/** Everyone else's companions as this screen last heard them, gliding. */
export class PalBook {
  private readonly owners = new Map<string, { at: number; pals: CoopPal[] }>();
  private readonly interp = new CoopInterp();
  /** An owner's list arrived at `now` (ms). Companions it no longer names are dropped. */
  take(owner: string, pals: readonly CoopPal[], now: number, still = false): void {
    const was = this.owners.get(owner);
    const list = cleanPals(pals);
    const keep = new Set(list.map(p => p.i));
    for (const p of was?.pals ?? []) if (!keep.has(p.i)) this.interp.forget(`${owner}:${p.i}`);
    for (const p of list) this.interp.push(`${owner}:${p.i}`, now, p.x, p.y, still);
    this.owners.set(owner, { at: now, pals: list });
  }
  /** Heard from `owner` within PAL_EXPIRE_MS. */
  fresh(owner: string, now: number): boolean { const o = this.owners.get(owner); return !!o && now - o.at <= PAL_EXPIRE_MS; }
  /** What to draw now: each companion of every owner still heard from, where it glides to. */
  shown(now: number): { owner: string; pal: CoopPal; x: number; y: number; moving: boolean }[] {
    const out: { owner: string; pal: CoopPal; x: number; y: number; moving: boolean }[] = [];
    for (const [owner, o] of [...this.owners]) {
      if (now - o.at > PAL_EXPIRE_MS) { this.drop(owner); continue; }
      for (const p of o.pals) {
        const at = this.interp.sample(`${owner}:${p.i}`, now) ?? p;
        out.push({ owner, pal: p, x: at.x, y: at.y, moving: this.interp.moving(`${owner}:${p.i}`, now) });
      }
    }
    return out;
  }
  drop(owner: string): void {
    for (const p of this.owners.get(owner)?.pals ?? []) this.interp.forget(`${owner}:${p.i}`);
    this.owners.delete(owner);
  }
  clear(): void { this.owners.clear(); this.interp.clear(); }
}
