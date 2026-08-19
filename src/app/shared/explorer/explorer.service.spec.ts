/**
 * explorer.service.spec.ts — dispatch, settlement, and the log.
 *
 * Every test here drives the *wall clock*, not a timer: a mission is settled
 * because `startedAt + duration` is in the past, which is the whole design of
 * this service. `startedAt` is rewritten in storage to put a mission in the
 * past, and the service is then re-hydrated — which is precisely the path a
 * visitor takes when they reopen a tab that was shut overnight.
 */
import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { ExplorerService } from './explorer.service';
import {
  EXPEDITION_HISTORY_CAP,
  EXPLORER_KEY,
  type ExplorerReturn,
  type ExplorerState,
} from './explorer.model';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  attached = false;
  pending = 0;
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

/**
 * A fresh service over the given storage.
 *
 * The reset is what makes "reopen the tab" testable: several tests below build
 * a second service against the same blob, and TestBed refuses to be
 * reconfigured once it has handed an injector out. Resetting first gives each
 * call a genuinely new service — new `initialised` flag, new hydrate — which is
 * exactly the thing under test.
 */
function configure(memory: MemoryGateway): ExplorerService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ExplorerService,
      EconomyService,
      LocalSaveRegistry,
      { provide: GameStateGateway, useValue: memory },
    ],
  });
  return TestBed.inject(ExplorerService);
}

/**
 * Put enough Gold in the ledger to pay any dispatch fee.
 *
 * The three lengths above the Scout charge one — see `MissionDefinition.cost`.
 * The fees are trivial against what the missions pay (a Delve costs 500 and
 * returns 20,000 at the floor), but a test that starts from a genuinely empty
 * economy cannot afford even that, which is not what any of these tests are
 * about.
 */
function fund(): void {
  TestBed.inject(EconomyService).earnGold(5_000_000, 'test');
}

/** Read the persisted blob back, the way a fresh tab would. */
function stored(memory: MemoryGateway): ExplorerState {
  return JSON.parse(memory.readRaw(EXPLORER_KEY) ?? '{}') as ExplorerState;
}

/**
 * Push every mission in the blob far enough into the past that it has landed.
 *
 * Rewriting storage rather than mocking `Date.now` is deliberate: it exercises
 * the same `load()` → `settle()` path the overnight case takes, including the
 * validators, rather than a code path only the test ever sees.
 */
function expireEverything(memory: MemoryGateway): void {
  const state = stored(memory);
  state.active = (state.active ?? []).map(e => ({
    ...e,
    startedAt: Date.now() - e.duration - 1_000,
  }));
  memory.writeRaw(EXPLORER_KEY, JSON.stringify(state));
}

describe('ExplorerService', () => {
  let memory: MemoryGateway;
  let explorers: ExplorerService;

  beforeEach(() => {
    memory = new MemoryGateway();
    explorers = configure(memory);
    explorers.init();
  });

  it('starts with no missions out and an empty log', () => {
    expect(explorers.snapshot.active.length).toBe(0);
    expect(explorers.snapshot.history).toEqual([]);
  });

  it('dispatches into a realm and records where they went', () => {
    expect(explorers.dispatch('umbral', 'scout')).toBeTrue();
    expect(explorers.snapshot.active.length).toBe(1);
    expect(explorers.snapshot.active[0].realm).toBe('umbral');
    expect(explorers.snapshot.active[0].mission).toBe('scout');
  });

  it('refuses a realm or a mission that is not on the board', () => {
    expect(explorers.dispatch('atlantis' as never, 'scout')).toBeFalse();
    expect(explorers.dispatch('umbral', 'holiday' as never)).toBeFalse();
    expect(explorers.snapshot.active.length).toBe(0);
  });

  it('refuses to send the same explorer twice', () => {
    // One starter explorer, one slot: the second dispatch has nobody to send.
    expect(explorers.dispatch('umbral', 'scout')).toBeTrue();
    expect(explorers.dispatch('luminous', 'scout')).toBeFalse();
  });

  it('recalls a mission without paying it out', () => {
    explorers.dispatch('umbral', 'scout');
    const id = explorers.snapshot.active[0].id;

    expect(explorers.recall(id)).toBeTrue();
    expect(explorers.snapshot.active.length).toBe(0);
    expect(explorers.snapshot.missionsCompleted).toBe(0);
    expect(explorers.snapshot.goldRecovered).toBe(0);
    expect(explorers.snapshot.history.length).toBe(0);
  });

  it('settles a mission that landed while the tab was shut', () => {
    explorers.dispatch('luminous', 'scout');
    expireEverything(memory);

    const landings: ExplorerReturn[] = [];

    // A fresh service over the same storage is what a reopened tab is.
    const reopened = configure(memory);
    reopened.returned$.subscribe(r => landings.push(r));
    reopened.init();

    expect(reopened.snapshot.active.length).toBe(0);
    expect(reopened.snapshot.missionsCompleted).toBe(1);
    expect(reopened.snapshot.goldRecovered).toBeGreaterThan(0);
    expect(landings.length).toBe(1);
    expect(landings[0].explorer.realm).toBe('luminous');
  });

  it('writes a log line for every settled mission', () => {
    fund();
    explorers.dispatch('umbral', 'delve');
    expireEverything(memory);

    const reopened = configure(memory);
    reopened.init();

    expect(reopened.snapshot.history.length).toBe(1);
    const row = reopened.snapshot.history[0];
    expect(row.realm).toBe('umbral');
    expect(row.mission).toBe('delve');
    expect(row.gold).toBeGreaterThan(0);
    expect(row.explorerName.length).toBeGreaterThan(0);
    expect(row.returnedAt).toBeGreaterThan(0);
  });

  it('persists the log so it survives a reload', () => {
    explorers.dispatch('verge', 'scout');
    expireEverything(memory);
    configure(memory).init();

    // Straight out of storage, not out of a live service — the log's whole
    // reason to be persisted is that it is read after the tab was closed.
    expect(stored(memory).history.length).toBe(1);
    expect(stored(memory).history[0].realm).toBe('verge');
  });

  it('keeps the log newest-first and capped', () => {
    // Twelve settled runs through one slot, one at a time.
    for (let i = 0; i < EXPEDITION_HISTORY_CAP + 2; i++) {
      explorers.dispatch(i % 2 ? 'umbral' : 'luminous', 'scout');
      expireEverything(memory);
      explorers = configure(memory);
      explorers.init();
    }

    const log = explorers.snapshot.history;
    expect(log.length).toBe(EXPEDITION_HISTORY_CAP);
    for (let i = 1; i < log.length; i++) {
      expect(log[i - 1].returnedAt).toBeGreaterThanOrEqual(log[i].returnedAt);
    }
  });

  it('drops a hand-edited log line rather than rendering it', () => {
    // The blob is user-writable and the log goes straight into the template.
    memory.writeRaw(EXPLORER_KEY, JSON.stringify({
      version: 1,
      active: [],
      itemsFound: 0,
      runesFound: 0,
      scrollsFound: 0,
      missionsCompleted: 0,
      goldRecovered: 0,
      history: [
        { id: 'ok', realm: 'umbral', mission: 'scout', explorerName: 'Velren', gold: 1, xp: 1, runes: [], returnedAt: 1 },
        { id: 'bad-runes', realm: 'umbral', mission: 'scout', explorerName: 'X', gold: 1, xp: 1, runes: [{}], returnedAt: 1 },
        { id: 'bad-gold', realm: 'umbral', mission: 'scout', explorerName: 'X', gold: 'lots', xp: 1, runes: [], returnedAt: 1 },
        'not even an object',
      ],
    }));

    const loaded = configure(memory);
    loaded.init();

    expect(loaded.snapshot.history.length).toBe(1);
    expect(loaded.snapshot.history[0].id).toBe('ok');
  });

  it('survives a blob that has no log at all', () => {
    // Every save written before the log existed. It must load, not throw.
    memory.writeRaw(EXPLORER_KEY, JSON.stringify({
      version: 1, active: [], itemsFound: 0, runesFound: 0,
      scrollsFound: 0, missionsCompleted: 4, goldRecovered: 900,
    }));

    const loaded = configure(memory);
    loaded.init();

    expect(loaded.snapshot.history).toEqual([]);
    expect(loaded.snapshot.missionsCompleted).toBe(4);
  });

  it('clears the log on a progression reset', () => {
    explorers.dispatch('nexus', 'scout');
    expireEverything(memory);
    const live = configure(memory);
    live.init();
    expect(live.snapshot.history.length).toBe(1);

    live.reset();
    expect(live.snapshot.history).toEqual([]);
    expect(live.snapshot.active).toEqual([]);
  });

  // ── The deep ladder's gates ───────────────────────────────────────────────

  it('keeps the first run free so a new visitor can always take it', () => {
    // The onboarding property the fee ladder must never break: at zero Gold,
    // the Scout still goes. Everything above it is reachable from what that
    // Scout pays.
    expect(TestBed.inject(EconomyService).snapshot.gold).toBe(0);
    expect(explorers.blockedReason('scout')).toBeNull();
    expect(explorers.dispatch('luminous', 'scout')).toBe(true);
  });

  it('refuses a costed run that cannot be paid for, and takes nothing', () => {
    const economy = TestBed.inject(EconomyService);
    expect(economy.snapshot.gold).toBeLessThan(500);

    expect(explorers.blockedReason('delve')?.code).toBe('gold');
    expect(explorers.dispatch('umbral', 'delve')).toBe(false);
    expect(explorers.snapshot.active.length).toBe(0);
    expect(economy.snapshot.gold).toBe(0);
  });

  it('charges the fee exactly once on a dispatch that goes', () => {
    const economy = TestBed.inject(EconomyService);
    fund();
    const before = economy.snapshot.gold;

    expect(explorers.dispatch('umbral', 'delve')).toBe(true);
    expect(before - economy.snapshot.gold).toBe(500);
  });

  it('does not charge for a dispatch the roster refuses', () => {
    const economy = TestBed.inject(EconomyService);
    fund();
    // One explorer, one slot: the second dispatch has nobody to send, and it
    // must not bill for the mission it could not start. The fee is taken after
    // the roster check for exactly this case.
    expect(explorers.dispatch('umbral', 'scout')).toBe(true);
    const before = economy.snapshot.gold;
    expect(explorers.dispatch('verge', 'delve')).toBe(false);
    expect(economy.snapshot.gold).toBe(before);
  });

  it('holds the Abyss behind a rank the fresh Keeper does not have', () => {
    fund();
    const block = explorers.blockedReason('abyss');
    expect(block?.code).toBe('level');
    expect(block?.need).toBe(5);
    expect(explorers.dispatch('umbral', 'abyss')).toBe(false);
  });

  it('reports an unknown mission rather than throwing on it', () => {
    expect(explorers.blockedReason('not-a-mission' as never)?.code).toBe('unknown');
  });
});
