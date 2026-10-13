import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { GameStateGateway } from '../save/game-state.gateway';
import {
  APP_UPDATE_ENV,
  AppUpdateService,
  RegistrationLike,
  UpdateEnv,
  WorkerLike,
} from './app-update.service';
import {
  CONTROLLER_WAIT_MS,
  UPDATE_POLL_MS,
  UPDATE_REFOCUS_GAP_MS,
  isPlayerBusy,
  parseVersionFile,
  updateVerdict,
} from './app-update.model';

class FakeWorker implements WorkerLike {
  state = 'installing';
  readonly messages: unknown[] = [];
  private listeners: Array<() => void> = [];
  postMessage(m: unknown): void { this.messages.push(m); }
  addEventListener(_t: 'statechange', cb: () => void): void { this.listeners.push(cb); }
  removeEventListener(_t: 'statechange', cb: () => void): void { this.listeners = this.listeners.filter(l => l !== cb); }
  become(state: string): void { this.state = state; for (const l of [...this.listeners]) l(); }
}

class FakeRegistration implements RegistrationLike {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  updates = 0;
  private found: Array<() => void> = [];
  update(): Promise<unknown> { this.updates++; return Promise.resolve(); }
  addEventListener(_t: 'updatefound', cb: () => void): void { this.found.push(cb); }
  /** A new deploy's worker arrives and installs. */
  deploy(): FakeWorker {
    const w = new FakeWorker();
    this.installing = w;
    for (const f of this.found) f();
    w.become('installed');
    this.installing = null;
    this.waiting = w;
    return w;
  }
}

interface Harness {
  env: UpdateEnv;
  reg: FakeRegistration;
  served: { build: string | null };
  busy: { value: boolean };
  reloads: () => number;
  wake: (r: 'visible' | 'online') => void;
  controllerChange: () => void;
  order: string[];
}

function harness(running: string | null = 'aaaaaa111111'): Harness {
  const reg = new FakeRegistration();
  const served = { build: running as string | null };
  const busy = { value: false };
  let reloads = 0;
  let wakeCb: ((r: 'visible' | 'online') => void) | null = null;
  let ccbs: Array<() => void> = [];
  let dismissed: string | null = null;
  const order: string[] = [];
  const env: UpdateEnv = {
    runningBuild: () => running,
    fetchServedBuild: () => Promise.resolve(served.build),
    registration: () => Promise.resolve(reg),
    hasController: () => true,
    onControllerChange: (cb) => { ccbs.push(cb); return () => { ccbs = ccbs.filter(c => c !== cb); }; },
    reload: () => { order.push('reload'); reloads++; },
    isBusy: () => busy.value,
    isVisible: () => true,
    onWake: (cb) => { wakeCb = cb; return () => { wakeCb = null; }; },
    readDismissed: () => dismissed,
    writeDismissed: (b) => { dismissed = b; },
  };
  return {
    env, reg, served, busy, order,
    reloads: () => reloads,
    wake: (r) => wakeCb?.(r),
    controllerChange: () => { for (const c of [...ccbs]) c(); },
  };
}

function setup(h: Harness, settle?: () => Promise<void>): AppUpdateService {
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_UPDATE_ENV, useValue: h.env },
      {
        provide: GameStateGateway,
        useValue: { settleForReload: settle ?? (() => { h.order.push('settle'); return Promise.resolve(); }) },
      },
    ],
  });
  return TestBed.inject(AppUpdateService);
}

describe('app-update.model', () => {
  it('reads only well-formed build ids from version.json', () => {
    expect(parseVersionFile({ build: 'abc123def456' })).toBe('abc123def456');
    expect(parseVersionFile({ build: '<!doctype html>' })).toBeNull();
    expect(parseVersionFile(null)).toBeNull();
    expect(parseVersionFile('abc123')).toBeNull();
  });

  it('decides from the version file first, the waiting worker second', () => {
    expect(updateVerdict({ running: null, served: 'bbbbbb', waiting: true })).toBe('current');
    expect(updateVerdict({ running: 'aaaaaa', served: 'bbbbbb', waiting: false })).toBe('available');
    expect(updateVerdict({ running: 'aaaaaa', served: 'aaaaaa', waiting: false })).toBe('current');
    expect(updateVerdict({ running: 'aaaaaa', served: 'aaaaaa', waiting: true })).toBe('activate-quietly');
    expect(updateVerdict({ running: 'aaaaaa', served: null, waiting: true })).toBe('available');
    expect(updateVerdict({ running: 'aaaaaa', served: null, waiting: false })).toBe('current');
  });

  it('counts only rendered dialogs, the enemy bar, or data-gf-busy as busy', () => {
    const doc = document.createElement('div');
    document.body.appendChild(doc);
    const probe = { querySelectorAll: (s: string) => doc.querySelectorAll(s) };
    try {
      expect(isPlayerBusy(probe)).toBeFalse();
      doc.innerHTML = '<section role="dialog" aria-modal="true" hidden>x</section>';
      expect(isPlayerBusy(probe)).toBeFalse();
      doc.innerHTML = '<section role="dialog" aria-modal="true">x</section>';
      expect(isPlayerBusy(probe)).toBeTrue();
      // The footer's donation modals: in the DOM on every page, invisible.
      doc.innerHTML = '<div role="dialog" aria-modal="true" style="opacity:0;visibility:hidden">x</div>';
      expect(isPlayerBusy(probe)).toBeFalse();
      doc.innerHTML = '<div role="dialog" aria-modal="true" style="opacity:0">x</div>';
      expect(isPlayerBusy(probe)).toBeFalse();
      doc.innerHTML = '<div class="meter enemy">x</div>';
      expect(isPlayerBusy(probe)).toBeTrue();
      doc.innerHTML = '<div data-gf-busy>x</div>';
      expect(isPlayerBusy(probe)).toBeTrue();
    } finally {
      doc.remove();
    }
  });
});

describe('AppUpdateService', () => {
  it('does nothing at all on an unstamped (dev) build', fakeAsync(() => {
    const h = harness(null);
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    expect(h.reg.updates).toBe(0);
    expect(svc.offer()).toBeFalse();
  }));

  it('stays quiet while the server is on the same build', fakeAsync(() => {
    const h = harness();
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    expect(h.reg.updates).toBe(1);
    expect(svc.offer()).toBeFalse();
    svc.stop();
  }));

  it('offers the reload when version.json names a new build', fakeAsync(() => {
    const h = harness();
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    h.served.build = 'bbbbbb222222';
    h.wake('online');
    flushMicrotasks();
    expect(svc.available()).toBeTrue();
    expect(svc.offer()).toBeTrue();
    svc.stop();
  }));

  it('offers the reload when a new worker installs, even with no version file', fakeAsync(() => {
    const h = harness();
    h.served.build = null;
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    expect(svc.offer()).toBeFalse();
    h.reg.deploy();
    flushMicrotasks();
    expect(svc.offer()).toBeTrue();
    svc.stop();
  }));

  it('polls on an interval and throttles refocus checks', fakeAsync(() => {
    const h = harness();
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    expect(h.reg.updates).toBe(1);
    h.wake('visible');           // too soon after start
    flushMicrotasks();
    expect(h.reg.updates).toBe(1);
    tick(UPDATE_REFOCUS_GAP_MS);
    h.wake('visible');
    flushMicrotasks();
    expect(h.reg.updates).toBe(2);
    tick(UPDATE_POLL_MS);
    flushMicrotasks();
    expect(h.reg.updates).toBe(3);
    svc.stop();
  }));

  it('waits while the player is busy, and shows once they are not', fakeAsync(() => {
    const h = harness();
    h.busy.value = true;
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    h.served.build = 'bbbbbb222222';
    h.wake('online');
    flushMicrotasks();
    expect(svc.available()).toBeTrue();
    expect(svc.offer()).toBeFalse();
    h.busy.value = false;
    tick(1_500);
    expect(svc.offer()).toBeTrue();
    svc.stop();
  }));

  it('Later hides the offer for that build only', fakeAsync(() => {
    const h = harness();
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    h.served.build = 'bbbbbb222222';
    h.wake('online');
    flushMicrotasks();
    svc.dismiss();
    expect(svc.offer()).toBeFalse();
    h.served.build = 'cccccc333333';
    h.wake('online');
    flushMicrotasks();
    expect(svc.offer()).toBeTrue();
    svc.stop();
  }));

  it('Reload settles saves, then SKIP_WAITING, then reloads once on controllerchange', fakeAsync(() => {
    const h = harness();
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    h.served.build = 'bbbbbb222222';
    const worker = h.reg.deploy();
    flushMicrotasks();
    expect(svc.offer()).toBeTrue();
    void svc.apply();
    flushMicrotasks();
    expect(h.order).toEqual(['settle']);
    expect(worker.messages).toEqual(['SKIP_WAITING']);
    expect(h.reloads()).toBe(0);
    h.controllerChange();
    flushMicrotasks();
    expect(h.reloads()).toBe(1);
    // A second controllerchange, or a second tap, cannot reload again.
    h.controllerChange();
    void svc.apply();
    flushMicrotasks();
    tick(CONTROLLER_WAIT_MS);
    expect(h.reloads()).toBe(1);
  }));

  it('never posts SKIP_WAITING before the save settles', fakeAsync(() => {
    const h = harness();
    let release!: () => void;
    const svc = setup(h, () => new Promise<void>(r => { release = r; }));
    svc.start();
    flushMicrotasks();
    h.served.build = 'bbbbbb222222';
    const worker = h.reg.deploy();
    flushMicrotasks();
    expect(svc.offer()).toBeTrue();
    void svc.apply();
    flushMicrotasks();
    expect(worker.messages).toEqual([]);
    release();
    flushMicrotasks();
    expect(worker.messages).toEqual(['SKIP_WAITING']);
    h.controllerChange();
    flushMicrotasks();
    expect(h.reloads()).toBe(1);
  }));

  it('reloads after a timeout if the worker never takes control', fakeAsync(() => {
    const h = harness();
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    h.served.build = 'bbbbbb222222';
    h.reg.deploy();
    flushMicrotasks();
    void svc.apply();
    flushMicrotasks();
    tick(CONTROLLER_WAIT_MS);
    flushMicrotasks();
    expect(h.reloads()).toBe(1);
  }));

  it('reloads straight away when no worker is waiting (version file only)', fakeAsync(() => {
    const h = harness();
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    h.served.build = 'bbbbbb222222';
    h.wake('online');
    flushMicrotasks();
    void svc.apply();
    flushMicrotasks();
    expect(h.order).toEqual(['settle', 'reload']);
  }));

  it('a worker that installs before the version file answers is still an update, not a late worker', fakeAsync(() => {
    const h = harness();
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    h.served.build = 'bbbbbb222222'; // the deploy is live; this tab has not fetched since
    const w = h.reg.deploy();
    flushMicrotasks();
    expect(w.messages).toEqual([]);
    expect(svc.offer()).toBeTrue();
    svc.stop();
  }));

  it('activates a late worker quietly when the page is already on the new build', fakeAsync(() => {
    const h = harness();
    const w = new FakeWorker();
    w.state = 'installed';
    h.reg.waiting = w;
    const svc = setup(h);
    svc.start();
    flushMicrotasks();
    expect(w.messages).toEqual(['SKIP_WAITING']);
    expect(svc.offer()).toBeFalse();
    h.controllerChange();
    expect(h.reloads()).toBe(0);
    svc.stop();
  }));
});
