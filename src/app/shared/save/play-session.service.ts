/**
 * play-session.service.ts — one live session per account (owner 2026-10-26: "the same account can play in several
 * tabs or devices at once").
 *
 * Two locks, one rule: only one session plays.
 *  - Between devices: the save's write lease (device-lease.ts). The holder beats every 30 s (hidden too: the game
 *    never pauses); another device that opens sees "This account is playing on another device — Play here?", and its
 *    Play here takes the lease ({@link GameStateGateway.claimLease}). The old holder learns on its next beat — or at
 *    once, when the new session joins the Hearth and the room tells the old one `replaced` ({@link hearthReplaced}).
 *  - Between tabs of one browser (they share the device id, so the lease cannot tell them apart): an exclusive Web
 *    Lock held for the life of the page in the world. A second tab cannot take it; its Play here steals it, and the
 *    first tab's lock request rejects at that instant. A reload frees it by itself (the page that held it is gone).
 *
 * A session that is not the one playing shows the takeover screen in place of the world (play-shell): the world is
 * unmounted (its last state saved), so nothing of it runs, writes or stands in the Hearth. Play here takes both locks
 * and reloads into the world, so the save the other session pushed is the one this page plays.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { DeviceLeaseService } from './device-lease.service';
import { GameStateGateway } from './game-state.gateway';
import { hasBoundAccount } from '../cloud-save/cloud-save.service';

/** The Web Lock one browser's tabs share (one plays at a time). */
export const PLAY_LOCK = 'eclipse-realms-play';

export interface PlaySessionState {
  /** 'play': this session is the one. 'elsewhere': another device or tab plays this account now. */
  role: 'play' | 'elsewhere';
  /** Where: another device (the lease's holder), another tab of this browser, or the Hearth said so. */
  why: '' | 'device' | 'tab' | 'hearth';
  /** "Chrome on iPhone" when the lease names it. */
  device: string;
}
const PLAYING: PlaySessionState = { role: 'play', why: '', device: '' };

interface LockManagerLike {
  request(name: string, options: { ifAvailable?: boolean; steal?: boolean; signal?: AbortSignal }, cb: (lock: unknown) => Promise<unknown> | unknown): Promise<unknown>;
}

@Injectable({ providedIn: 'root' })
export class PlaySessionService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly leases = inject(DeviceLeaseService);
  private readonly gateway = inject(GameStateGateway);
  private readonly zone = inject(NgZone);

  private readonly state$$ = new BehaviorSubject<PlaySessionState>(PLAYING);
  readonly state$: Observable<PlaySessionState> = this.state$$.asObservable();
  get state(): PlaySessionState { return this.state$$.value; }
  get elsewhere(): boolean { return this.state$$.value.role === 'elsewhere'; }

  /** This page holds the tab lock (in the world). */
  private holding = false;
  private release: (() => void) | null = null;

  constructor() {
    if (!this.browser) return;
    this.leases.state$.subscribe(s => {
      if (s.role === 'passive') this.mark('device', s.holder?.deviceName ?? '');
    });
  }

  /**
   * May this session join the Hearth now? A signed-in page waits for its lease to answer (a second device must not
   * knock the playing one out of the room before it knows it is the second); a passive one never joins.
   */
  get mayJoinHearth(): boolean {
    if (this.elsewhere) return false;
    if (!hasBoundAccount() || !this.gateway.attached) return true;
    return this.leases.settled && this.leases.state.role !== 'passive';
  }

  /**
   * Entering the world: take this browser's tab lock (resolves when it is known whether this tab may play). Already
   * shown "elsewhere" by the lease: stays so.
   */
  async enterWorld(): Promise<PlaySessionState> {
    if (!this.browser || this.elsewhere) return this.state;
    if (this.leases.state.role === 'passive') { this.mark('device', this.leases.state.holder?.deviceName ?? ''); return this.state; }
    if (this.holding) return this.state;
    const locks = lockManager();
    if (!locks) return this.state;
    const got = await new Promise<boolean>(resolve => {
      this.zone.runOutsideAngular(() => {
        locks.request(PLAY_LOCK, { ifAvailable: true }, lock => {
          if (!lock) { resolve(false); return undefined; }
          this.holding = true;
          resolve(true);
          return new Promise<void>(done => { this.release = done; });
        }).catch(() => {
          // Stolen: another tab of this browser pressed Play here.
          if (this.holding) { this.holding = false; this.release = null; this.zone.run(() => this.mark('tab', '')); }
          resolve(false);
        });
      });
    });
    if (!got && !this.holding) this.mark('tab', '');
    return this.state;
  }

  /**
   * The Hearth said this account joined from somewhere else (`replaced`). Signed in: ask the lease at once — a session
   * that still holds it plays on (true: join the room again); one that lost it is elsewhere. A page with no cloud save
   * attached has no lease to ask: it simply stays out of the room, as before.
   */
  async hearthReplaced(): Promise<boolean> {
    if (!this.browser || this.elsewhere) return false;
    if (!this.gateway.attached) return false;
    const s = await this.leases.refresh();
    if (s.role === 'active') return true;
    if (s.role === 'unknown') this.zone.run(() => this.mark('hearth', ''));
    return false;
  }

  /**
   * "Play here": take the tab lock from any other tab of this browser and the lease from any other device, send what
   * this page queued, then reload straight into the world (`enterKey`: the lobby's "enter this character" flag).
   */
  async playHere(enterKey: string, character: string): Promise<void> {
    if (!this.browser) return;
    const locks = lockManager();
    if (locks && !this.holding) {
      await new Promise<void>(resolve => {
        this.zone.runOutsideAngular(() => {
          locks.request(PLAY_LOCK, { steal: true }, () => { this.holding = true; resolve(); return new Promise<void>(done => { this.release = done; }); })
            .catch(() => resolve());
        });
      });
    }
    try { if (this.gateway.attached) await this.gateway.claimLease(); } catch { /* offline: the reload's attach asks again */ }
    try { await this.gateway.settleForReload(); } catch { /* best effort */ }
    try { sessionStorage.setItem(enterKey, character); } catch { /* private mode: the list opens instead */ }
    location.reload();
  }

  private mark(why: PlaySessionState['why'], device: string): void {
    const cur = this.state$$.value;
    if (cur.role === 'elsewhere' && cur.why === why && cur.device === device) return;
    this.state$$.next({ role: 'elsewhere', why, device });
  }
}

function lockManager(): LockManagerLike | null {
  const nav = typeof navigator !== 'undefined' ? navigator as Navigator & { locks?: LockManagerLike } : null;
  return nav?.locks && typeof nav.locks.request === 'function' ? nav.locks : null;
}
