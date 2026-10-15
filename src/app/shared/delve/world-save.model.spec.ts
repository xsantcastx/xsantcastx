import { TestBed } from '@angular/core/testing';
import {
  coerceWorldRegion, coerceWorldSave, fromDelveSave, mergeWorldRegionSlots, mergeWorldSaves, toDelveSave, WORLD_KEY, WORLD_SLOT_KEYS,
  type WorldSave,
} from './world-save.model';
import { DELVE_KEY } from './delve-save.model';
import { DelveSaveService } from './delve-save.service';
import { planV2Migration, WorldMigrationService } from './delve-migration-v3';
import { InventoryService } from '../rpg/inventory.service';
import { ONE_WORLD_ESCAPE_KEY, ONE_WORLD_KEY, OneWorldFlag } from '../../play/one-world/one-world-flag';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { mergeWaystones, coerceWaystones, isLit, surveyCount, surveyMarks, WAYSTONES_KEY } from '../waystones/waystones.model';

const save = (over: Partial<WorldSave> = {}): WorldSave => ({
  version: 3, seed: 7, createdAt: 100,
  worlds: { ember: { core: { layout: '120x56:v2:7', cells: '' } } },
  claimed: ['warden-defeated'], ...over,
});

describe('save v3 (One World): the world index', () => {
  it('coerces only v3, and round-trips through the service\'s in-memory shape', () => {
    expect(coerceWorldSave({ version: 2, seed: 7, createdAt: 1, areas: {}, claimed: [] })).toBeNull();
    expect(coerceWorldSave('junk')).toBeNull();
    const s = save({ chests: { 'ember:1a': { layout: '120x56:v2:7', born: 5, n: 1, slots: { 'cinder-ore': 3 } } }, at: { world: 'ember', col: 50, row: 0, t: 9 }, migrated: 'v2' });
    const back = fromDelveSave(toDelveSave(coerceWorldSave(s)!), { at: s.at, migrated: 'v2' });
    expect(back).toEqual(coerceWorldSave(s)!);
    expect(toDelveSave(s).areas['ember-delve'].layout).toBe('120x56:v2:7');
    expect(Object.keys(toDelveSave(s).chests!)).toEqual(['ember-delve:1a']);
  });

  it('merges: the earlier seed wins, claims and chests union, the later resume point, migrated sticks; idempotent', () => {
    const a = save({ claimed: ['a'], at: { world: 'ember', col: 1, row: 0, t: 5 } });
    const b = save({ seed: 9, createdAt: 50, claimed: ['b'], at: { world: 'ember', col: 2, row: -3, t: 8 }, migrated: 'v2',
      worlds: { ember: { core: { layout: '120x56:v2:9', cells: '' } } } });
    const m = mergeWorldSaves(a, b) as WorldSave;
    expect(m.seed).toBe(9);
    expect(m.claimed).toEqual(['a', 'b']);
    expect(m.at).toEqual({ world: 'ember', col: 2, row: -3, t: 8 });
    expect(m.migrated).toBe('v2');
    expect(mergeWorldSaves(m, m)).toEqual(m);
    const n = mergeWorldSaves(b, a) as WorldSave;
    expect(n.seed).toBe(m.seed); expect(n.claimed).toEqual(m.claimed); expect(n.at).toEqual(m.at);
  });

  it('region slots: the same (world, region) merges sector by sector, commutatively; another keeps the later', () => {
    const r = (world: string, t: number, cells: string) => ({ v: 3, world, seed: 7, rx: 0, ry: -1, t, sectors: { '3,-1': { g: 1, t, c: cells } } });
    expect(coerceWorldRegion({ v: 1, seed: 7, rx: 0, ry: 0, t: 1, sectors: {} })).toBeNull();
    const x = r('ember', 10, 'AQA'), y = r('ember', 20, 'AgA');
    expect(mergeWorldRegionSlots(x, y)).toEqual(mergeWorldRegionSlots(y, x));
    expect(mergeWorldRegionSlots(mergeWorldRegionSlots(x, y), y)).toEqual(mergeWorldRegionSlots(x, y));
    expect((mergeWorldRegionSlots(r('ink', 30, 'AQA'), r('ember', 20, 'AQA')) as { world: string }).world).toBe('ink');
  });

  it('is registered: the index, 24 shared region slots and the Waystones ride the cloud save', () => {
    const keys = SYNCED_BLOBS.map(b => b.key);
    expect(keys).toContain(WORLD_KEY);
    expect(WORLD_SLOT_KEYS.length).toBe(24);
    for (const key of WORLD_SLOT_KEYS) expect(keys).toContain(key);
    expect(keys).toContain(WAYSTONES_KEY);
  });
});

describe('save v3 (One World): the Waystones', () => {
  it('coerces ids, merges by union (commutative, idempotent), and the trunk line is always lit', () => {
    expect(coerceWaystones({ lit: ['ember:ws:12', 'bad id', 'ember:quarry-head'] }).lit).toEqual(['ember:quarry-head', 'ember:ws:12']);
    const a = { lit: ['ember:ws:12'], seen: ['ember:ws:12'], marks: [] }, b = { lit: ['ember:quarry-head'], seen: ['ember:ws:20'], marks: ['sera-chart'] };
    expect(mergeWaystones(a, b)).toEqual(mergeWaystones(b, a));
    expect(mergeWaystones(mergeWaystones(a, b), b)).toEqual(mergeWaystones(a, b));
    expect(isLit({ lit: [] }, { id: 'ember:town', trunk: true })).toBeTrue();
    expect(surveyCount({ lit: [] })).toBe(5);
    expect(surveyMarks(surveyCount({ lit: [] }))).toEqual(['sera-chart']);
  });
});

describe('save v3 (One World): v2 → v3 migration', () => {
  const KEYS = [DELVE_KEY, WORLD_KEY, ONE_WORLD_KEY, ...WORLD_SLOT_KEYS];
  let grants: { id: string; key: string; qty: number }[];
  const fakeInventory = {
    grantStack: (id: string, key: string, qty: number) => { if (!grants.some(g => g.id === id)) grants.push({ id, key, qty }); return true; },
    itemsOnExplorer: (holder: string) => holder === 'delve-chest:42' ? [{ id: 'blade-1' }] : [],
    unequip: () => true, stow: () => true,
  };
  function boot(): { delve: DelveSaveService; migration: WorldMigrationService } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: InventoryService, useValue: fakeInventory }] });
    OneWorldFlag.reset();
    return { delve: TestBed.inject(DelveSaveService), migration: TestBed.inject(WorldMigrationService) };
  }
  beforeEach(() => {
    grants = [];
    for (const key of KEYS) localStorage.removeItem(key);
    sessionStorage.removeItem(ONE_WORLD_ESCAPE_KEY);
    localStorage.setItem(DELVE_KEY, JSON.stringify({
      version: 2, seed: 5, createdAt: 1, areas: { 'ember-delve': { layout: '120x56:v2:5', cells: 'k3.0' } },
      claimed: ['warden-defeated', 'rift-attuned:umbral'],
      chests: { 'ember-delve:1a': { layout: '120x56:v2:5', born: 42, n: 2, slots: { 'cinder-ore': 12, glowcap: 3 } } },
    }));
  });
  afterEach(() => { for (const key of KEYS) localStorage.removeItem(key); sessionStorage.removeItem(ONE_WORLD_ESCAPE_KEY); OneWorldFlag.reset(); });

  it('plans the claims and each chest\'s stacks under keyed op ids', () => {
    const plan = planV2Migration(JSON.parse(localStorage.getItem(DELVE_KEY)!));
    expect(plan.claimed).toEqual(['rift-attuned:umbral', 'warden-defeated']);
    expect(plan.chests[0].stacks.map(s => s.opId)).toEqual(['v3-chest:42:cinder-ore', 'v3-chest:42:glowcap']);
  });

  it('keeps the claims, returns chest contents, leaves v2 untouched, and pays nothing twice on reload', () => {
    const v2Before = localStorage.getItem(DELVE_KEY);
    const { delve, migration } = boot();
    expect(delve.oneWorld).toBeTrue();
    const result = migration.run()!;
    expect(result).toEqual({ claims: 2, stacks: 15, gear: 1 });
    expect(delve.isClaimed('warden-defeated')).toBeTrue();
    const v3 = JSON.parse(localStorage.getItem(WORLD_KEY)!);
    expect(v3.version).toBe(3);
    expect(v3.migrated).toBe('v2');
    expect(v3.claimed).toContain('rift-attuned:umbral');
    // The digs did not come across (the world moved); v2 itself is as it was.
    expect(v3.worlds.ember).toBeUndefined();
    expect(localStorage.getItem(DELVE_KEY)).toBe(v2Before);
    expect(grants.length).toBe(2);
    // A reload: the marker holds, nothing is granted again.
    const again = boot();
    expect(again.migration.run()).toBeNull();
    expect(grants.length).toBe(2);
  });

  it('migrates a heavy save (the flip moves every old save): 60 claims, 40 chests, 120 stacks, once', () => {
    const chests: Record<string, unknown> = {};
    for (let n = 0; n < 40; n++) chests[`ember-delve:${n.toString(36)}`] = { layout: '120x56:v2:5', born: 1000 + n, n: 3, slots: { 'cinder-ore': 20 + n, glowcap: 3, 'ember-residue': 1 } };
    const claimed = Array.from({ length: 60 }, (_, n) => `claim-${n}`);
    localStorage.setItem(DELVE_KEY, JSON.stringify({ version: 2, seed: 5, createdAt: 1, areas: { 'ember-delve': { layout: '120x56:v2:5', cells: 'k3.0,k4.0' } }, claimed, chests }));
    const { delve, migration } = boot();
    const result = migration.run()!;
    expect(result.claims).toBe(60);
    expect(grants.length).toBe(120);
    expect(result.stacks).toBe(40 * 24 + (39 * 40) / 2);
    for (const id of claimed) expect(delve.isClaimed(id)).toBeTrue();
    expect(new Set(grants.map(g => g.id)).size).toBe(120);
    // A reload pays nothing again.
    const again = boot();
    expect(again.migration.run()).toBeNull();
    expect(grants.length).toBe(120);
  });

  it('is on by default (the flip), and a stale P1 "off" preview key is ignored and removed', () => {
    localStorage.setItem(ONE_WORLD_KEY, '0');
    const { delve } = boot();
    expect(delve.oneWorld).toBeTrue();
    expect(localStorage.getItem(ONE_WORLD_KEY)).toBeNull();
  });

  it('with the dev escape hatch (?oneworld=0, this tab) nothing runs and no v3 key is written', () => {
    sessionStorage.setItem(ONE_WORLD_ESCAPE_KEY, '0');
    const { delve, migration } = boot();
    expect(delve.oneWorld).toBeFalse();
    expect(migration.run()).toBeNull();
    delve.claim('x');
    expect(localStorage.getItem(WORLD_KEY)).toBeNull();
  });
});
