/**
 * life-mirror.ts — a Keeper's screen mirroring the life the room keeps (Hearth protocol 10, M4; keeper-life.ts is the
 * room's side; docs/design/online.md §4d "M4").
 *
 * The M2 rule: optimistic, then reconcile. The screen still shows every blow, heal and potion the moment it happens
 * (a bite lands through its own wards, a potion fills at once); what it did that the room did not see — a heal, a
 * ward's soak, harm the room did not deal, a potion, a wake — becomes a numbered claim. Each snapshot carries the life
 * the room holds and the last claim it took; the screen then shows that life plus the claims still on their way, so a
 * reconcile never undoes what the Keeper just saw unless the room refused it (a clipped heal, a forged potion). The
 * bite itself needs no claim: the room cut it already, and the snapshot that carries it carries the life after it.
 *
 * Death is the room's word: the screen never lets its own prediction take the last point (`floor`), and falls only when
 * the room says the Keeper is down.
 *
 * Pure: no Angular, no DOM (td-engine holds one while the room keeps its life; life-mirror.spec.ts).
 */
import type { LifeClaim, LifeClaimKind, LifeView } from './keeper-life';

export class LifeMirror {
  private seq = 0;
  /** Claims sent or queued and not yet taken by the room (signed: a heal +, harm −). */
  private pending: { q: number; n: number }[] = [];
  private out: LifeClaim[] = [];
  /** The room's last word (null: not heard yet). */
  room: LifeView | null = null;
  /** Round trips measured: a claim's send to the snapshot that took it (ms). */
  readonly rtt: number[] = [];
  private sentAt = new Map<number, number>();

  /** Something the room did not see moved the life (n > 0). Its sequence (0: nothing to claim). */
  claim(k: LifeClaimKind, n: number, p?: string): number {
    const v = Math.round(n);
    if (!(v > 0) && k !== 'wake') return 0;
    const q = ++this.seq;
    if (k !== 'wake') this.pending.push({ q, n: k === 'hurt' ? -v : v });
    this.out.push({ q, k, n: Math.max(0, v), ...(p ? { p } : {}) });
    return q;
  }
  /** The claims to send now (each once). */
  drain(now = 0): LifeClaim[] {
    const o = this.out;
    this.out = [];
    for (const c of o) this.sentAt.set(c.q, now);
    return o;
  }
  get queued(): number { return this.out.length; }
  /** A potion or a wake waits to go (sent at once, not on the regeneration's slow beat). */
  get urgent(): boolean { return this.out.some(c => c.k === 'potion' || c.k === 'wake'); }
  /** A send that did not reach the room: its claims go again with the next one. */
  requeue(list: readonly LifeClaim[]): void { this.out = [...list, ...this.out]; }
  /** Claims the room has not taken yet. */
  get inFlight(): number { return this.pending.length; }
  /**
   * The room's word: the life to show — what it holds plus what it has not taken yet, never above the most. Null when
   * the word is older than one already heard (a late snapshot).
   */
  reconcile(me: LifeView, now = 0): number | null {
    if (this.room && me.q < this.room.q) return null;
    for (const p of this.pending) if (p.q <= me.q && this.sentAt.has(p.q)) { this.rtt.push(now - (this.sentAt.get(p.q) ?? now)); this.sentAt.delete(p.q); }
    if (this.rtt.length > 50) this.rtt.splice(0, this.rtt.length - 50);
    this.room = { ...me };
    this.pending = this.pending.filter(p => p.q > me.q);
    const ahead = this.pending.reduce((s, p) => s + p.n, 0);
    return Math.max(0, Math.min(me.m, me.h + ahead));
  }
  /** Everything forgotten (the room stopped keeping this life: another area, an older room, a new session). */
  reset(): void { this.pending = []; this.out = []; this.room = null; this.sentAt.clear(); }
}
