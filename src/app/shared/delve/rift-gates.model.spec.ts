import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';

import {
  attuneCheck, attunedFlag, enteredFlag, realmOfArea, realmOfGateNode, realmSeed, RIFT_GATES, RIFT_REALMS, RIFT_SLOT_KEYS, riftSlotKeys,
} from './rift-gates.model';
import { DEBOUNCE_MS, DelveSaveService, SLOT_WRITE_MS } from './delve-save.service';
import { DELVE_KEY } from './delve-save.model';
import { coerceRegion, mergeRegionSlots, REGION_SLOT_KEYS, type DelveRegion } from './delve-region.model';
import { DELVE_FAR_KEY, type RegionStore } from './delve-region-store';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { GLOAM_WARDEN_FLAG } from '../npc/delve-missions.model';
import { GLOAM_WARDEN_FLAG as AREA_WARDEN_FLAG } from '../../play/world/towns/umbral-delve';
import { TERRAIN_NODES } from '../../play/engine/terrain';

class MemoryStore implements RegionStore {
  readonly kind = 'memory' as const;
  readonly degraded = false;
  regions: DelveRegion[] = [];
  load(): Promise<DelveRegion[]> { return Promise.resolve(this.regions.map(r => JSON.parse(JSON.stringify(r)))); }
  put(regions: readonly DelveRegion[]): Promise<void> {
    for (const region of regions) {
      this.regions = this.regions.filter(r => !(r.seed === region.seed && r.rx === region.rx && r.ry === region.ry));
      this.regions.push(JSON.parse(JSON.stringify(region)));
    }
    return Promise.resolve();
  }
}

describe('Rift Gates: the model', () => {
  it('has four gates, one open (the Umbral), each with its own node, sigil, realm material and colour', () => {
    expect(RIFT_REALMS.length).toBe(4);
    expect(RIFT_REALMS.filter(r => RIFT_GATES[r].open)).toEqual(['umbral']);
    for (const realm of RIFT_REALMS) {
      const gate = RIFT_GATES[realm];
      expect(TERRAIN_NODES[gate.node]?.use).toBe('gate');
      expect(realmOfGateNode(gate.node)).toBe(realm);
      expect(gate.brokenRule.length).toBeGreaterThan(20);
    }
    expect(RIFT_GATES.umbral.area).toBe('umbral-delve');
    expect(realmOfArea('umbral-delve')).toBe('umbral');
    expect(realmOfArea('ember-delve')).toBeNull();
    expect(new Set(RIFT_REALMS.map(r => `${RIFT_GATES[r].place.cell}:${RIFT_GATES[r].place.stratum}`)).size).toBe(4);
  });

  it('attunes only an open gate, at its Delving level, with its sigil; once attuned it stays open', () => {
    expect(attuneCheck('luminous', { delving: 99, sigils: 5, attuned: false })).toEqual({ ok: false, why: 'settling' });
    expect(attuneCheck('umbral', { delving: 19, sigils: 1, attuned: false })).toEqual({ ok: false, why: 'delving', need: 20 });
    expect(attuneCheck('umbral', { delving: 25, sigils: 0, attuned: false })).toEqual({ ok: false, why: 'sigil', sigil: 'umbral-sigil' });
    expect(attuneCheck('umbral', { delving: 25, sigils: 1, attuned: false })).toEqual({ ok: true, attune: true });
    expect(attuneCheck('umbral', { delving: 0, sigils: 0, attuned: true })).toEqual({ ok: true, attune: false });
    expect(attunedFlag('umbral')).toBe('rift-attuned:umbral');
    expect(enteredFlag('umbral')).toBe('rift-entered:umbral');
  });

  it('gives each realm its own seed from the player\'s, stable and unlike the Delve\'s', () => {
    expect(realmSeed(424242, 'umbral')).toBe(realmSeed(424242, 'umbral'));
    expect(realmSeed(424242, 'umbral')).not.toBe(424242);
    expect(realmSeed(424242, 'umbral')).not.toBe(realmSeed(424242, 'verdant'));
    expect(realmSeed(1, 'umbral')).not.toBe(realmSeed(2, 'umbral'));
  });

  it('syncs four region slots per realm through the same merge as the Delve\'s, and pins the Warden\'s flag', () => {
    expect(RIFT_SLOT_KEYS.length).toBe(16);
    expect(riftSlotKeys('umbral')).toEqual(['godforge-rift-umbral-r0', 'godforge-rift-umbral-r1', 'godforge-rift-umbral-r2', 'godforge-rift-umbral-r3']);
    for (const key of RIFT_SLOT_KEYS) {
      const blob = SYNCED_BLOBS.find(b => b.key === key)!;
      expect(blob).withContext(key).toBeTruthy();
      expect(blob.collection).toBe('progress');
      expect(blob.doc).toBe(key.replace('godforge-', ''));
      expect(blob.merge).toBe(mergeRegionSlots);
    }
    expect(GLOAM_WARDEN_FLAG).toBe(AREA_WARDEN_FLAG);
  });
});

describe('Rift Gates: a realm Delve saves as its own world (DelveSaveService)', () => {
  const KEYS = [DELVE_KEY, DELVE_FAR_KEY, ...REGION_SLOT_KEYS, ...RIFT_SLOT_KEYS];
  let device: MemoryStore;
  let clock: number;
  function boot(): DelveSaveService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const s = TestBed.inject(DelveSaveService);
    s.openDevice = () => Promise.resolve(device);
    s.now = () => clock;
    return s;
  }
  beforeEach(() => { for (const key of KEYS) localStorage.removeItem(key); device = new MemoryStore(); clock = 1_760_000_000_000; });
  afterEach(() => { for (const key of KEYS) localStorage.removeItem(key); });

  it('hands the realm its own seed, and files its sectors in its own slots and device records, apart from the Ember Delve', fakeAsync(() => {
    const service = boot();
    const seed = service.seed('ember-delve')!;
    flush();
    expect(service.seed('umbral-delve')).toBe(realmSeed(seed, 'umbral'));
    service.sectorChanged('umbral-delve', 5, 1, 1, 40, 0);
    service.sectorChanged('ember-delve', 5, 1, 1, 41, 0);
    tick(DEBOUNCE_MS);
    service.flush();
    expect(service.sector('umbral-delve', 5, 1)!.cells.get(40)).toBe(0);
    expect(service.sector('umbral-delve', 5, 1)!.cells.has(41)).toBeFalse();
    expect(service.sector('ember-delve', 5, 1)!.cells.has(40)).toBeFalse();
    const realmSlot = coerceRegion(JSON.parse(localStorage.getItem('godforge-rift-umbral-r0')!))!;
    expect(realmSlot.seed).toBe(realmSeed(seed, 'umbral'));
    expect(Object.keys(realmSlot.sectors)).toEqual(['5,1']);
    expect(service.realmSlotRegions('umbral')[0]).toBe('0_0');
    expect(device.regions.map(r => r.seed).sort()).toEqual([seed, realmSeed(seed, 'umbral')].sort());
    tick(SLOT_WRITE_MS);
    flush();
  }));

  it('reloads a realm\'s sectors from its slot, and from the device, into its own world only', fakeAsync(() => {
    const first = boot();
    first.seed('ember-delve');
    flush();
    first.sectorChanged('umbral-delve', -3, 0, 1, 7, 0);
    tick(DEBOUNCE_MS);
    first.flush();
    // A fresh service (another tab, or a reload): the slot answers first, then the device.
    const again = boot();
    again.seed('ember-delve');
    expect(again.sector('umbral-delve', -3, 0)!.cells.get(7)).toBe(0);
    flush();
    expect(again.sector('umbral-delve', -3, 0)!.cells.get(7)).toBe(0);
    expect(again.sector('ember-delve', -3, 0)).toBeNull();
    expect(again.sectorKeys('umbral-delve').length).toBe(1);
    expect(again.sectorKeys('ember-delve').length).toBe(0);
    tick(SLOT_WRITE_MS);
    flush();
  }));

  it('keeps a realm slot written under another seed out of the realm (a slot never takes another world\'s region)', fakeAsync(() => {
    const service = boot();
    service.seed('ember-delve');
    flush();
    localStorage.setItem('godforge-rift-umbral-r1', JSON.stringify({ v: 1, seed: 12345, rx: 0, ry: 0, t: 1, sectors: { '1,0': { g: 1, t: 1, c: '' } } }));
    const again = boot();
    again.seed('ember-delve');
    flush();
    expect(again.sector('umbral-delve', 1, 0)).toBeNull();
    tick(SLOT_WRITE_MS);
    flush();
  }));
});
