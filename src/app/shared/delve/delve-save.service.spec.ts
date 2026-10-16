import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';

import { DEBOUNCE_MS, DelveSaveService, SLOT_WRITE_MS } from './delve-save.service';
import { DELVE_KEY } from './delve-save.model';
import { coerceRegion, decodeRuns, encodeRuns, REGION_SLOT_KEYS, REGROW_MS, type DelveRegion } from './delve-region.model';
import { DELVE_FAR_KEY, IdbRegionStore, LocalRegionStore, openRegionStore, type RegionStore } from './delve-region-store';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { TERRAIN_NODE_LIST } from '../../play/engine/terrain';
import { OneWorldFlag } from '../../play/one-world/one-world-flag';

const KEYS = [DELVE_KEY, DELVE_FAR_KEY, ...REGION_SLOT_KEYS];
const AREA = 'ember-delve';

/** A device store in memory, so a spec controls when it answers. */
class MemoryStore implements RegionStore {
  readonly kind = 'memory' as const;
  readonly degraded = false;
  regions: DelveRegion[] = [];
  puts = 0;
  load(): Promise<DelveRegion[]> { return Promise.resolve(this.regions.map(r => JSON.parse(JSON.stringify(r)))); }
  put(regions: readonly DelveRegion[]): Promise<void> {
    this.puts++;
    for (const region of regions) {
      this.regions = this.regions.filter(r => !(r.seed === region.seed && r.rx === region.rx && r.ry === region.ry));
      this.regions.push(JSON.parse(JSON.stringify(region)));
    }
    return Promise.resolve();
  }
}

describe('DelveSaveService (save v2: the endless Delve)', () => {
  // Save v2 is the legacy game: since the One World flip it runs only behind the dev hatch (?oneworld=0).
  beforeAll(() => OneWorldFlag.set(false));
  afterAll(() => { OneWorldFlag.set(true); OneWorldFlag.reset(); });
  let service: DelveSaveService;
  let device: MemoryStore;
  let clock: number;

  function boot(store: RegionStore = device): DelveSaveService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const s = TestBed.inject(DelveSaveService);
    s.openDevice = () => Promise.resolve(store);
    s.now = () => clock;
    return s;
  }

  beforeEach(() => {
    for (const key of KEYS) localStorage.removeItem(key);
    device = new MemoryStore();
    clock = 1_760_000_000_000;
    service = boot();
  });
  afterEach(() => { for (const key of KEYS) localStorage.removeItem(key); });

  it('is the engine\'s sector store: a sector change round-trips through the device store and a fresh service', fakeAsync(() => {
    service.seed(AREA);
    flush();
    service.sectorChanged(AREA, 9, 0, 1, 31, 0);
    service.sectorChanged(AREA, 9, 0, 1, 32, 0);
    service.sectorChanged(AREA, 10, 1, 1, 0, 23, true);
    service.sectorLiquids(AREA, 9, 0, 1, new Map([[33, 0x18]]));
    service.sectorExplored(AREA, 9, 0, 1, Uint8Array.from([255, 0, 0, 0, 0, 0, 0, 1]));
    tick(DEBOUNCE_MS);
    expect(device.regions.length).toBe(1);
    const again = boot();
    again.seed(AREA);
    flush();
    const sector = again.sector(AREA, 9, 0)!;
    expect([...sector.cells]).toEqual([[31, 0], [32, 0]]);
    expect([...sector.liquids]).toEqual([[33, 0x18]]);
    expect([...sector.fog!]).toEqual([255, 0, 0, 0, 0, 0, 0, 1]);
    expect(again.sector(AREA, 10, 1)!.receipts.has(0)).toBeTrue();
    expect(again.sectorKeys(AREA).length).toBe(2);
    flush();
  }));

  it('writes the index as version 2 and keeps the core in `areas` exactly as v1 did', fakeAsync(() => {
    service.changed(AREA, '120x56:v2:5', 7, 0);
    tick(DEBOUNCE_MS);
    const saved = JSON.parse(localStorage.getItem(DELVE_KEY)!);
    expect(saved.version).toBe(2);
    expect(saved.areas[AREA].layout).toBe('120x56:v2:5');
    flush();
  }));

  it('reads a v1 save (no sectors) and keeps its core diff', fakeAsync(() => {
    localStorage.setItem(DELVE_KEY, JSON.stringify({ version: 1, seed: 42, createdAt: 1, areas: { [AREA]: { layout: '120x56:v2:42', cells: 'k3.0' } }, claimed: [] }));
    const s = boot();
    expect(s.seed(AREA)).toBe(42);
    expect(s.cells(AREA, '120x56:v2:42')?.size).toBe(1);
    expect(s.sectorKeys(AREA)).toEqual([]);
    flush();
  }));

  it('an unknown or broken save never crashes: junk slots and junk regions are ignored', fakeAsync(() => {
    localStorage.setItem(DELVE_KEY, '{"version":9,"seed":"no"}');
    localStorage.setItem(REGION_SLOT_KEYS[0], '{"v":{"oops":true}}');
    localStorage.setItem(REGION_SLOT_KEYS[1], 'not json');
    device.regions = [{ v: 1, seed: 3, rx: 0, ry: 0, t: 1, sectors: { 'x,y': { g: 1, t: 1 } } } as unknown as DelveRegion];
    const s = boot();
    expect(() => s.seed(AREA)).not.toThrow();
    flush();
    expect(s.sector(AREA, 0, 0)).toBeNull();
    expect(s.sectorKeys(AREA)).toEqual([]);
  }));

  it('cloud slots: a changed region takes a slot (written at once on flush, else at most every 30 s)', fakeAsync(() => {
    service.seed(AREA);
    flush();
    service.sectorChanged(AREA, 20, 0, 1, 5, 0);
    tick(DEBOUNCE_MS);
    const slot = service.slotRegions().indexOf('2_0');
    expect(slot).toBeGreaterThanOrEqual(0);
    const first = coerceRegion(slotBlob(slot));
    expect(first?.rx).toBe(2);
    // A second change inside the 30 s: on the device at once, in the slot only later (or on flush).
    clock += 1000;
    service.sectorChanged(AREA, 20, 0, 1, 6, 0);
    tick(DEBOUNCE_MS);
    const read = () => coerceRegion(slotBlob(slot))!;
    expect(decodeRuns(read().sectors['20,0'].c).has(6)).toBeFalse();
    service.flush();
    expect(decodeRuns(read().sectors['20,0'].c).has(6)).toBeTrue();
    clock += SLOT_WRITE_MS;
    service.sectorChanged(AREA, 20, 0, 1, 7, 0);
    tick(SLOT_WRITE_MS + DEBOUNCE_MS);
    expect(decodeRuns(read().sectors['20,0'].c).has(7)).toBeTrue();
    flush();
  }));

  it('eviction: past 16 regions the one changed longest ago leaves its slot and stays on the device', fakeAsync(() => {
    service.seed(AREA);
    flush();
    for (let n = 0; n < 17; n++) {
      clock += 60_000;
      service.sectorChanged(AREA, n * 8, 0, 1, 1, 0);
      service.flush();
    }
    const slots = service.slotRegions();
    expect(slots.filter(Boolean).length).toBe(16);
    expect(slots).not.toContain('0_0');
    expect(slots).toContain('16_0');
    expect(device.regions.some(r => r.rx === 0)).withContext('the evicted region is still on this device').toBeTrue();
    // And it is still the player's Delve after a reload.
    const again = boot();
    again.seed(AREA);
    flush();
    expect(again.sector(AREA, 0, 0)?.cells.get(1)).toBe(0);
  }));

  it('cross-device merge: another device\'s copy of a slot is merged into this one\'s region on rehydrate', fakeAsync(() => {
    service.seed(AREA);
    flush();
    service.sectorChanged(AREA, 20, 0, 1, 5, 0);
    service.flush();
    const slot = service.slotRegions().indexOf('2_0');
    const seed = service.seed(AREA)!;
    let reloaded = 0;
    service.reloaded$.subscribe(() => reloaded++);
    // The cloud merge adopted a copy holding the other device's dig in the same sector.
    const theirs: DelveRegion = { v: 1, seed, rx: 2, ry: 0, t: clock + 5, sectors: { '20,0': { g: 1, t: clock + 5, c: encodeRuns(new Map([[9, 0]])) } } };
    localStorage.setItem(REGION_SLOT_KEYS[slot], JSON.stringify(theirs));
    TestBed.inject(LocalSaveRegistry).rehydrate(REGION_SLOT_KEYS[slot]);
    expect(reloaded).toBe(1);
    const cells = service.sector(AREA, 20, 0)!.cells;
    expect(cells.get(5)).toBe(0);
    expect(cells.get(9)).toBe(0);
    flush();
  }));

  it('regrowth on load: a far sector unchanged for 14 days drops its tunnels, keeps receipts and the map', fakeAsync(() => {
    service.seed(AREA);
    flush();
    const seed = service.seed(AREA)!;
    const old = clock - REGROW_MS - 1000;
    device.regions = [{ v: 1, seed, rx: 3, ry: 0, t: old, sectors: {
      '25,0': { g: 1, t: old, c: encodeRuns(new Map([[1, 0], [2, 0]])), k: encodeRuns(new Map([[2, 1]])), f: 'ff00000000000000' },
      '26,0': { g: 1, t: old, c: encodeRuns(new Map([[1, 23]])) },  // a torch (node 23): held
    } }];
    const s = boot();
    s.seed(AREA);
    flush();
    const healed = s.sector(AREA, 25, 0)!;
    expect([...healed.cells]).toEqual([[2, 0]]);
    expect(healed.healed).toBe(clock);
    expect(healed.fog).not.toBeNull();
    expect(s.sector(AREA, 26, 0)!.cells.size).toBe(1);
  }));

  // ── The Underhearth (Phase 8): deep sectors, Rift Anchors ──
  const ANCHOR = TERRAIN_NODE_LIST.findIndex(node => node.id === 'rift-anchor');
  const TORCH = TERRAIN_NODE_LIST.findIndex(node => node.id === 'torch');

  it('anchors: a Rift Anchor in a deep sector (sy 2, 3) round-trips through the device and a fresh service', fakeAsync(() => {
    service.seed(AREA);
    flush();
    service.sectorChanged(AREA, 2, 2, 1, 42, ANCHOR);
    service.sectorChanged(AREA, -5, 3, 1, 7, ANCHOR);
    tick(DEBOUNCE_MS);
    service.flush();
    const again = boot();
    again.seed(AREA);
    flush();
    expect(again.sector(AREA, 2, 2)!.cells.get(42)).toBe(ANCHOR);
    expect(again.sector(AREA, -5, 3)!.cells.get(7)).toBe(ANCHOR);
    expect(again.sectorKeys(AREA).map(k => `${k.sx},${k.sy}`).sort()).toEqual(['-5,3', '2,2']);
  }));

  it('anchors: two devices\' anchors in the same deep sector are unioned on a slot merge', fakeAsync(() => {
    service.seed(AREA);
    flush();
    service.sectorChanged(AREA, 20, 3, 1, 10, ANCHOR);
    service.flush();
    const slot = service.slotRegions().indexOf('2_0');
    expect(slot).toBeGreaterThanOrEqual(0);
    const seed = service.seed(AREA)!;
    const theirs: DelveRegion = { v: 1, seed, rx: 2, ry: 0, t: clock + 5, sectors: { '20,3': { g: 1, t: clock + 5, c: encodeRuns(new Map([[200, ANCHOR]])) } } };
    localStorage.setItem(REGION_SLOT_KEYS[slot], JSON.stringify(theirs));
    TestBed.inject(LocalSaveRegistry).rehydrate(REGION_SLOT_KEYS[slot]);
    const cells = service.sector(AREA, 20, 3)!.cells;
    expect(cells.get(10)).toBe(ANCHOR);
    expect(cells.get(200)).toBe(ANCHOR);
    flush();
  }));

  it('anchors: a sector holding one never regrows, and it holds the rock round it like a camp', fakeAsync(() => {
    service.seed(AREA);
    flush();
    const seed = service.seed(AREA)!;
    const old = clock - REGROW_MS - 1000;
    device.regions = [{ v: 1, seed, rx: 3, ry: 0, t: old, sectors: {
      '25,2': { g: 1, t: old, c: encodeRuns(new Map([[1, ANCHOR], [2, 0]])) },
      // Two sectors away: within the anchor's clearance, so its tunnel stays too.
      '27,2': { g: 1, t: old, c: encodeRuns(new Map([[3, 0]])) },
      // Far away and unheld: it regrows.
      '31,2': { g: 1, t: old, c: encodeRuns(new Map([[4, 0], [5, TORCH]])) },
      '31,6': { g: 1, t: old, c: encodeRuns(new Map([[4, 0]])) },
    } }];
    const s = boot();
    s.seed(AREA);
    flush();
    expect(s.sector(AREA, 25, 2)!.cells.get(1)).toBe(ANCHOR);
    expect(s.sector(AREA, 27, 2)!.cells.get(3)).toBe(0);
    expect(s.sector(AREA, 31, 6)!.cells.size).withContext('far and unheld').toBe(0);
  }));

  it('IndexedDB missing: the store falls back to a device-only localStorage key through the gateway', async () => {
    const gateway = TestBed.inject(GameStateGateway);
    expect(await IdbRegionStore.open(null)).toBeNull();
    const store = await openRegionStore(gateway, null);
    expect(store.kind).toBe('local');
    await store.put([{ v: 1, seed: 1, rx: 0, ry: 0, t: 1, sectors: {} }]);
    expect(localStorage.getItem(DELVE_FAR_KEY)).toContain('"rx":0');
    const back = await new LocalRegionStore(gateway).load();
    expect(back.length).toBe(1);
    // A refusing factory falls back too.
    const refusing = { open: () => { throw new Error('denied'); } } as unknown as IDBFactory;
    expect((await openRegionStore(gateway, refusing)).kind).toBe('local');
  });

  it('IndexedDB present: regions round-trip through a real database', async () => {
    if (typeof indexedDB === 'undefined') { pending('no IndexedDB in this browser'); return; }
    const store = await IdbRegionStore.open(indexedDB);
    expect(store).not.toBeNull();
    const region: DelveRegion = { v: 1, seed: 77, rx: -1, ry: 0, t: 5, sectors: { '-3,0': { g: 1, t: 5, c: encodeRuns(new Map([[4, 0]])) } } };
    await store!.put([region]);
    const back = (await store!.load()).find(r => r.seed === 77 && r.rx === -1);
    expect(back?.sectors['-3,0'].c).toBe(region.sectors['-3,0'].c);
  });

  // ── Map v2: pins ride their region (device store and cloud slot) ──

  it('pins: placed, edited and removed; saved in their cell\'s region, back after a reload, capped at 12', fakeAsync(() => {
    service.seed(AREA);
    flush();
    expect(service.setPin({ id: 'pin00001', col: 300, row: 20, icon: 'fish', name: 'The east lake' })).toBeTrue();
    expect(service.setPin({ id: 'pin00002', col: 10, row: 5, icon: 'star', name: '' })).toBeTrue();
    expect(service.setPin({ id: 'pin00003', col: 10, row: 5, icon: 'not-an-icon', name: '' })).toBeFalse();
    tick(DEBOUNCE_MS);
    service.flush();
    // The lake pin lives in region 1_0 (sector column 9), the core pin in 0_0; both ride a slot.
    expect(service.slotRegions().filter(Boolean).sort()).toEqual(['0_0', '1_0']);
    const lake = device.regions.find(r => r.rx === 1)!;
    expect(lake.p?.map(p => p.id)).toEqual(['pin00001']);
    let again = boot();
    again.seed(AREA);
    flush();
    expect(again.pins().map(p => `${p.id}:${p.icon}:${p.name}`)).toEqual(['pin00001:fish:The east lake', 'pin00002:star:']);
    // Edit (the later edit wins), move into another region, remove (a tombstone).
    clock += 1000;
    expect(again.setPin({ id: 'pin00001', col: 300, row: 20, icon: 'danger', name: 'Lava!' })).toBeTrue();
    clock += 1000;
    expect(again.setPin({ id: 'pin00002', col: -40, row: 5, icon: 'star', name: 'West' })).toBeTrue();
    expect(again.removePin('pin00001')).toBeTrue();
    expect(again.removePin('pin00001')).toBeFalse();
    again.flush();
    again = boot();
    again.seed(AREA);
    flush();
    expect(again.pins().map(p => `${p.id}:${p.col}`)).toEqual(['pin00002:-40']);
    // Twelve at most.
    for (let n = 0; n < 11; n++) expect(again.setPin({ id: `cap${String(n).padStart(5, '0')}`, col: 200 + n, row: 3, icon: 'pick', name: '' })).toBeTrue();
    expect(again.pins().length).toBe(12);
    expect(again.setPin({ id: 'onetoomany', col: 250, row: 3, icon: 'pick', name: '' })).toBeFalse();
    expect(again.setPin({ id: 'pin00002', col: -40, row: 6, icon: 'door', name: 'West' })).toBeTrue();
    flush();
  }));

  it('pins: another device\'s pins and removals merge in through the region slot', fakeAsync(() => {
    service.seed(AREA);
    flush();
    service.setPin({ id: 'minepin1', col: 300, row: 20, icon: 'fish', name: '' });
    service.setPin({ id: 'shared01', col: 301, row: 20, icon: 'star', name: '' });
    service.flush();
    const slot = service.slotRegions().indexOf('1_0');
    const seed = service.seed(AREA)!;
    const theirs: DelveRegion = { v: 1, seed, rx: 1, ry: 0, t: clock + 50, sectors: {}, p: [
      { id: 'theirs01', c: 290, r: 10, i: 'chest', n: 'Their chest', t: clock + 50 },
      { id: 'shared01', c: 301, r: 20, i: 'star', n: '', t: clock + 50, d: 1 },
    ] };
    localStorage.setItem(REGION_SLOT_KEYS[slot], JSON.stringify(theirs));
    TestBed.inject(LocalSaveRegistry).rehydrate(REGION_SLOT_KEYS[slot]);
    expect(service.pins().map(p => p.id).sort()).toEqual(['minepin1', 'theirs01']);
    flush();
  }));

  it('exploredSpan: the seed and the frontier, and never rolls a seed before the first Delve', fakeAsync(() => {
    expect(service.exploredSpan()).toBeNull();
    expect(localStorage.getItem(DELVE_KEY)).toBeNull();
    service.seed(AREA);
    flush();
    service.sectorExplored(AREA, 9, 0, 1, Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0]));
    service.sectorExplored(AREA, -3, 1, 1, Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0]));
    service.sectorChanged(AREA, 30, 0, 1, 5, 0); // changed but never explored: not the frontier
    expect(service.exploredSpan()).toEqual({ seed: service.seed(AREA)!, east: 9, west: -3 });
    flush();
  }));

  function slotBlob(slot: number): unknown {
    const parsed = JSON.parse(localStorage.getItem(REGION_SLOT_KEYS[slot]) ?? 'null');
    return parsed && typeof parsed === 'object' && 'v' in parsed && 'updatedAt' in parsed ? parsed.v : parsed;
  }
});
