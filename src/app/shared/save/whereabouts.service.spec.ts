import { TestBed } from '@angular/core/testing';

import { GameStateGateway } from './game-state.gateway';
import { LocalSaveRegistry } from './local-save-registry.service';
import { WhereaboutsService } from './whereabouts.service';
import { WHEREABOUTS_EVERY_MS, WHEREABOUTS_KEY } from './whereabouts.model';

/** Records every write, as the gateway would queue it for the cloud. */
class RecordingGateway {
  readonly bag = new Map<string, string>();
  readonly writes: { key: string; value: unknown }[] = [];
  write(key: string, value: unknown): void {
    this.bag.set(key, JSON.stringify(value));
    this.writes.push({ key, value });
  }
  read(key: string): unknown {
    const raw = this.bag.get(key);
    return raw === undefined ? null : JSON.parse(raw);
  }
}

describe('WhereaboutsService', () => {
  let gateway: RecordingGateway;
  let service: WhereaboutsService;
  let saves: LocalSaveRegistry;
  const place = (x: number, level = 'surface') => ({ continent: 'ember-isle', level, x, y: 64 });

  beforeEach(() => {
    gateway = new RecordingGateway();
    TestBed.configureTestingModule({
      providers: [WhereaboutsService, LocalSaveRegistry, { provide: GameStateGateway, useValue: gateway }],
    });
    service = TestBed.inject(WhereaboutsService);
    saves = TestBed.inject(LocalSaveRegistry);
  });

  it('writes about once a minute of walking, never once a step', () => {
    // Ten minutes, the play view offering a new tile every two seconds (its own cadence).
    for (let s = 0, x = 0; s <= 10 * 60_000; s += 2_000, x += 32) service.note(place(x), 1_000_000 + s);
    const synced = gateway.writes.filter(w => w.key === WHEREABOUTS_KEY);
    expect(synced.length).toBe(11); // the first place, then one a minute
    expect(service.writes).toBe(11);
  });

  it('writes nothing while the Keeper stands still', () => {
    service.note(place(100), 0);
    for (let s = 2_000; s <= 5 * WHEREABOUTS_EVERY_MS; s += 2_000) service.note(place(100), s);
    expect(gateway.writes.length).toBe(1);
  });

  it('writes the held-back place on the owner flush (pagehide), stamped when it was taken', () => {
    service.note(place(0), 0);
    service.note(place(400), 2_000);
    service.note(place(800), 4_000);
    expect(gateway.writes.length).toBe(1);
    // GameStateGateway.onLeave → flushOwners → LocalSaveRegistry.flush(key) for every synced key.
    saves.flush(WHEREABOUTS_KEY);
    expect(gateway.writes.length).toBe(2);
    expect(gateway.read(WHEREABOUTS_KEY)).toEqual({ version: 1, td: place(800), at: 4_000 });
    // Nothing held any more: a second flush is free.
    saves.flush(WHEREABOUTS_KEY);
    expect(gateway.writes.length).toBe(2);
  });

  it('writes an area change at once', () => {
    service.note(place(100), 0);
    service.note(place(100, 'ember-mine-1'), 6_000);
    expect(gateway.writes.length).toBe(2);
    expect((gateway.read(WHEREABOUTS_KEY) as { td: { level: string } }).td.level).toBe('ember-mine-1');
  });

  it('ignores a place that is not one', () => {
    service.note({ continent: 'ember-isle' }, 0);
    service.note(null, 0);
    expect(gateway.writes.length).toBe(0);
  });

  it('wakes at the synced place when it is newer than this device\'s', () => {
    gateway.write(WHEREABOUTS_KEY, { version: 1, td: place(900), at: 50_000 });
    expect(service.wakePlace({ td: place(10), tdAt: 40_000 })?.x).toBe(900);
    expect(service.wakePlace({ td: place(10), tdAt: 60_000 })?.x).toBe(10);
  });
});
