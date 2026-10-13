/**
 * app-update.service.ts — notices a new deploy and, on the player's word only,
 * moves the page onto it.
 *
 * THE PROBLEM. Navigations are network-first (src/service-worker.js), so any
 * page load gets the newest deploy. But an installed PWA, or a tab left open
 * for days, never navigates: it keeps running the bundle it booted with,
 * indefinitely. The owner's own phone ran a days-old build this way.
 *
 * DETECTION, two independent signals, either sufficient:
 *   1. /version.json `{ build }` against this document's `<meta name="gf-build">`
 *      (both stamped by scripts/stamp-build-id.js), fetched `no-store`.
 *   2. `registration.update()`, then a newer worker reaching `installed` while
 *      one already controls the page. The worker's bytes change per deploy
 *      because the same script stamps BUILD_ID into it.
 * Checked on start, every 30 minutes while visible, when the page comes back
 * into view (at most every 2 minutes), and when the connection returns.
 *
 * APPLYING. Never automatic. The toast offers Reload; while a station panel or
 * any modal is open, or a foe is engaged, it is not shown at all (it waits).
 * On Reload: every save owner flushes through the gateway (localStorage is
 * settled synchronously before anything else runs — see the pagehide note in
 * local-save-registry.service.ts), the cloud push gets a short grace, the
 * waiting worker is told SKIP_WAITING, and the page reloads exactly once, on
 * `controllerchange` or after a timeout if no worker is involved (dev, iOS
 * quirks, no SW support) — the navigation is network-first, so the reload
 * itself lands on the new deploy either way.
 *
 * Lives in a lazy chunk: only update-toast.component.ts imports it, and that is
 * mounted through PwaOutletComponent once the browser is idle.
 */
import { Injectable, InjectionToken, NgZone, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GameStateGateway } from '../save/game-state.gateway';
import {
  BUSY_RECHECK_MS,
  CONTROLLER_WAIT_MS,
  INSTALL_WAIT_MS,
  UPDATE_DISMISSED_KEY,
  UPDATE_POLL_MS,
  isBuildId,
  isPlayerBusy,
  parseVersionFile,
  shouldCheck,
  updateVerdict,
} from './app-update.model';

/** The slice of ServiceWorker this service uses. */
export interface WorkerLike {
  readonly state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', cb: () => void): void;
  removeEventListener(type: 'statechange', cb: () => void): void;
}

/** The slice of ServiceWorkerRegistration this service uses. */
export interface RegistrationLike {
  readonly waiting: WorkerLike | null;
  readonly installing: WorkerLike | null;
  update(): Promise<unknown>;
  addEventListener(type: 'updatefound', cb: () => void): void;
}

/** Everything the service asks of the browser, so a spec can stand in for it. */
export interface UpdateEnv {
  runningBuild(): string | null;
  fetchServedBuild(): Promise<string | null>;
  registration(): Promise<RegistrationLike | null>;
  hasController(): boolean;
  /** Subscribe; returns the unsubscribe. */
  onControllerChange(cb: () => void): () => void;
  reload(): void;
  isBusy(): boolean;
  isVisible(): boolean;
  /** visibilitychange→visible and `online`; returns the unsubscribe. */
  onWake(cb: (reason: 'visible' | 'online') => void): () => void;
  readDismissed(): string | null;
  writeDismissed(build: string): void;
}

function browserEnv(): UpdateEnv {
  const sw = () => ('serviceWorker' in navigator ? navigator.serviceWorker : null);
  return {
    runningBuild: () => {
      const v = document.querySelector('meta[name="gf-build"]')?.getAttribute('content');
      return isBuildId(v) ? v : null;
    },
    fetchServedBuild: async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store', credentials: 'same-origin' });
        // A missing file must not be read as a build: refuse anything but JSON.
        if (!res.ok || !(res.headers.get('Content-Type') || '').includes('json')) return null;
        return parseVersionFile(await res.json());
      } catch {
        return null;
      }
    },
    registration: async () => {
      const c = sw();
      if (!c) return null;
      try { return (await c.getRegistration()) ?? null; } catch { return null; }
    },
    hasController: () => !!sw()?.controller,
    onControllerChange: (cb) => {
      const c = sw();
      if (!c) return () => {};
      c.addEventListener('controllerchange', cb);
      return () => c.removeEventListener('controllerchange', cb);
    },
    reload: () => window.location.reload(),
    isBusy: () => isPlayerBusy(document, (n) => getComputedStyle(n as unknown as Element)),
    isVisible: () => document.visibilityState !== 'hidden',
    onWake: (cb) => {
      const vis = () => { if (document.visibilityState === 'visible') cb('visible'); };
      const online = () => cb('online');
      document.addEventListener('visibilitychange', vis);
      window.addEventListener('online', online);
      return () => {
        document.removeEventListener('visibilitychange', vis);
        window.removeEventListener('online', online);
      };
    },
    readDismissed: () => { try { return sessionStorage.getItem(UPDATE_DISMISSED_KEY); } catch { return null; } },
    writeDismissed: (b) => { try { sessionStorage.setItem(UPDATE_DISMISSED_KEY, b); } catch { /* fine */ } },
  };
}

export const APP_UPDATE_ENV = new InjectionToken<UpdateEnv>('APP_UPDATE_ENV', {
  providedIn: 'root',
  factory: browserEnv,
});

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly gateway = inject(GameStateGateway);
  private readonly env = inject(APP_UPDATE_ENV);

  /** The server is on a newer build (or a newer worker is waiting). */
  readonly available = signal(false);
  /** A modal, a station panel or a fight is up: the offer waits. */
  readonly busy = signal(false);
  /** Reload was pressed and the page is on its way out. */
  readonly applying = signal(false);
  private readonly dismissedFor = signal<string | null>(null);
  private readonly servedBuild = signal<string | null>(null);

  /** What the toast binds to. */
  readonly offer = computed(() =>
    this.available() && !this.busy() && !this.applying()
    && (this.dismissedFor() === null || this.dismissedFor() !== this.offerKey()));

  private started = false;
  private lastCheck = 0;
  private checking: Promise<void> | null = null;
  private watchedReg: RegistrationLike | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private busyTimer: ReturnType<typeof setInterval> | null = null;
  private unwake: (() => void) | null = null;
  private reloaded = false;

  /** Begin watching. Idempotent; does nothing on the server or on unstamped builds. */
  start(): void {
    if (!this.isBrowser || this.started) return;
    if (!this.env.runningBuild()) return; // `ng serve` / unstamped: nothing to compare
    this.started = true;
    this.dismissedFor.set(this.env.readDismissed());
    // Timers and listeners outside the zone: a 30-minute interval inside it
    // would keep the app "unstable" for its whole life. Signals still render.
    this.zone.runOutsideAngular(() => {
      this.pollTimer = setInterval(() => {
        if (this.env.isVisible()) void this.check('poll');
      }, UPDATE_POLL_MS);
      this.unwake = this.env.onWake((reason) => { void this.check(reason); });
    });
    void this.check('start');
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.busyTimer) clearInterval(this.busyTimer);
    this.pollTimer = this.busyTimer = null;
    this.unwake?.();
    this.unwake = null;
    this.started = false;
  }

  /** Ask the server and the worker whether there is something newer. */
  check(reason: 'start' | 'poll' | 'visible' | 'online'): Promise<void> {
    if (this.checking) return this.checking;
    const now = Date.now();
    if (!shouldCheck(reason, now, this.lastCheck)) return Promise.resolve();
    this.lastCheck = now;
    this.checking = this.runCheck().finally(() => { this.checking = null; });
    return this.checking;
  }

  /** "Later": hide the offer for this build, for this tab session. */
  dismiss(): void {
    const key = this.offerKey();
    this.dismissedFor.set(key);
    this.env.writeDismissed(key);
  }

  /** "Reload": settle saves, hand over to the waiting worker, reload once. */
  async apply(): Promise<void> {
    if (this.applying() || this.reloaded) return;
    this.applying.set(true);
    try {
      await this.gateway.settleForReload();
    } catch { /* a failed push leaves the queue in the cache; local is settled */ }

    const reg = await this.env.registration();
    let worker = reg?.waiting ?? null;
    if (!worker && reg?.installing) worker = await this.waitInstalled(reg.installing);

    if (worker && this.env.hasController()) {
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          off();
          clearTimeout(timer);
          resolve();
        };
        const off = this.env.onControllerChange(finish);
        const timer = setTimeout(finish, CONTROLLER_WAIT_MS);
        worker!.postMessage('SKIP_WAITING');
      });
    }
    this.reloadOnce();
  }

  // ─── internals ─────────────────────────────────────────────────────────────

  private offerKey(): string {
    return this.servedBuild() ?? 'worker';
  }

  private async runCheck(): Promise<void> {
    const reg = await this.env.registration();
    if (reg) {
      this.watch(reg);
      // update() rejects offline and on a 404; the version file still counts.
      try { await reg.update(); } catch { /* offline */ }
    }
    const served = await this.env.fetchServedBuild();
    if (served) this.servedBuild.set(served);
    this.decide(reg);
  }

  /** Re-evaluate from the facts as they stand now. */
  private decide(reg: RegistrationLike | null, installed: WorkerLike | null = null): void {
    // `installed` is the worker whose statechange brought us here. The spec sets
    // `registration.waiting` before that event, but not every engine has been
    // faithful to it, so the worker in hand is taken as the waiting one.
    const waitingWorker = reg?.waiting ?? installed;
    const waiting = !!waitingWorker && this.env.hasController();
    const verdict = updateVerdict({
      running: this.env.runningBuild(),
      served: this.servedBuild(),
      waiting,
    });
    if (verdict === 'activate-quietly') {
      // This page already runs the server's build; the worker merely caught up
      // late. Let it take over now — there is nothing for the player to reload.
      waitingWorker!.postMessage('SKIP_WAITING');
      return;
    }
    if (verdict === 'available' && !this.available()) {
      this.available.set(true);
      this.watchBusy();
    }
  }

  private async refreshThenDecide(reg: RegistrationLike, installed: WorkerLike): Promise<void> {
    const served = await this.env.fetchServedBuild();
    if (served) this.servedBuild.set(served);
    this.decide(reg, installed);
  }

  /** Follow a newly found worker to `installed`, then re-decide. */
  private watch(reg: RegistrationLike): void {
    if (this.watchedReg === reg) return;
    this.watchedReg = reg;
    reg.addEventListener('updatefound', () => {
      const incoming = reg.installing;
      if (!incoming) return;
      const onState = () => {
        // Re-read the version file first: the worker can finish installing
        // before this check's own fetch returns, and deciding on the previous
        // answer would mistake a new deploy for a late worker on this build.
        if (incoming.state === 'installed') void this.refreshThenDecide(reg, incoming);
        if (incoming.state === 'installed' || incoming.state === 'redundant') {
          incoming.removeEventListener('statechange', onState);
        }
      };
      incoming.addEventListener('statechange', onState);
    });
  }

  private watchBusy(): void {
    this.busy.set(this.env.isBusy());
    if (this.busyTimer) return;
    this.zone.runOutsideAngular(() => {
      this.busyTimer = setInterval(() => {
        const next = this.env.isBusy();
        if (next !== this.busy()) this.busy.set(next);
      }, BUSY_RECHECK_MS);
    });
  }

  private waitInstalled(worker: WorkerLike): Promise<WorkerLike | null> {
    if (worker.state === 'installed') return Promise.resolve(worker);
    return new Promise((resolve) => {
      const onState = () => {
        if (worker.state === 'installed') finish(worker);
        else if (worker.state === 'redundant') finish(null);
      };
      const timer = setTimeout(() => finish(null), INSTALL_WAIT_MS);
      const finish = (w: WorkerLike | null) => {
        clearTimeout(timer);
        worker.removeEventListener('statechange', onState);
        resolve(w);
      };
      worker.addEventListener('statechange', onState);
    });
  }

  private reloadOnce(): void {
    if (this.reloaded) return;
    this.reloaded = true;
    this.stop();
    this.env.reload();
  }
}
