/**
 * cabinets.spec.ts — the Lost Cabinets: the table means something (sixteen,
 * real places, real things, EN + ES, the High Roads pinned to the route), the
 * Scan's math (bands, warm glass, the Delve's range, clues that tune the
 * glass), the save's merge, the service through the gateway (receipt first,
 * once ever, the set's final reward once), the pet treat / hatbox / crumbs,
 * and the cabinet's pixel art.
 */
import { TestBed } from '@angular/core/testing';
import {
  CABINETS, CABINET_ITEMS, CURIOS, FINAL_REWARD, PET_HATBOX_ID, PET_TREAT_ID, PULSE, SCAN, SET_BONUSES, WARMTHS, WARM_GLASS,
  arcReached, cabinetDef, cabinetsIn, eyeDirection, hasBonus, inReach, openClues, scanReading, tuned, warmthAt,
} from './cabinets.model';
import { CABINETS_KEY, coerceCabinets, emptyCabinets, mergeCabinets } from './cabinets-save.model';
import { CabinetsService } from './cabinets.service';
import { CABINETS_I18N } from './cabinets.i18n';
import { CURIO_ICONS } from './curio-icons';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { materialDisplay } from '../rpg/material-catalog';
import { QUEST_STACKS } from '../rpg/inventory-layout';
import { HUNT_HEIGHTS, ROUTE } from '../../play/world/heights';
import { FLOOR } from '../../play/engine/engine.model';
import { PETS, PET_TREAT, feedResult, hasHat, mealsLeft } from '../pets/pets.model';
import type { PetRecord } from '../pets/pets-save.model';
import { CABINET_H, CABINET_W, cabinetPixel } from '../../play/engine/cabinet-art';
import { slateTabs } from '../slate/slate.model';

class FakeEconomy {
  earned: [number, number][] = [];
  earnIncome(floor: number, seconds: number): number { this.earned.push([floor, seconds]); return floor; }
}
class FakeInventory {
  grants = new Map<string, { id: string; qty: number }>();
  grantStack(grantId: string, id: string, qty: number): boolean { if (!this.grants.has(grantId)) this.grants.set(grantId, { id, qty }); return true; }
  stackOf(id: string): number { let n = 0; for (const g of this.grants.values()) if (g.id === id) n += g.qty; return n; }
}

describe('Lost Cabinets: the table', () => {
  it('sixteen cabinets, unique ids, one distinct curio each, every clue and need a real cabinet', () => {
    expect(CABINETS.length).toBe(16);
    expect(new Set(CABINETS.map(c => c.id)).size).toBe(16);
    expect(new Set(CABINETS.map(c => c.curio)).size).toBe(16);
    for (const c of CABINETS) {
      expect(CURIOS.some(i => i.id === c.curio && i.cabinet === c.id)).withContext(c.id).toBeTrue();
      if (c.clueFor) expect(cabinetDef(c.clueFor)?.needs).withContext(c.id).toBe(c.id);
      if (c.needs) expect(cabinetDef(c.needs)?.clueFor).withContext(c.id).toBe(c.id);
    }
  });

  it('spread across towns, hunts, the High Roads, the Delve, the Underhearth and the four realm Delves', () => {
    const places = new Set(CABINETS.map(c => c.place));
    for (const p of ['town', 'hunt', 'heights', 'delve', 'underhearth', 'rift'] as const) expect(places.has(p)).withContext(p).toBeTrue();
    // One World (P2): the Seamworks' and the Quarry's stand in the Ember world (area ember-delve), on its surface.
    for (const area of ['luminous', 'umbral', 'celestial', 'verdant', 'ember-delve', 'umbral-delve', 'verdant-delve', 'luminous-delve', 'celestial-delve']) {
      expect(cabinetsIn(area).length).withContext(area).toBeGreaterThan(0);
    }
    // The five deep ones wait on a clue; nothing on the surface does.
    expect(CABINETS.filter(c => c.needs).map(c => c.place).sort()).toEqual(['rift', 'rift', 'rift', 'rift', 'underhearth']);
  });

  it('the High Roads cabinets stand on the route (the Prism slab, the Orrery canopy)', () => {
    const prism = cabinetDef('cab-prism-road')!, orrery = cabinetDef('cab-orrery-road')!;
    const slab = HUNT_HEIGHTS['reflection-channels'].ledges.find(l => l.y === ROUTE.slab.y)!;
    expect(prism.y).toBe(slab.y);
    expect(prism.x).toBeGreaterThanOrEqual(slab.x);
    expect(prism.x).toBeLessThanOrEqual(slab.x + slab.width);
    expect(orrery.y).toBe(FLOOR - ROUTE.tree.height);
  });

  it('every thing inside is real: a satchel name and icon, a key item (but the treat), EN + ES lore', () => {
    for (const item of CABINET_ITEMS) {
      expect(materialDisplay(item.id)?.name).withContext(item.id).toBe(item.name);
      expect(CURIO_ICONS[item.id]).withContext(item.id).toBeDefined();
      expect(QUEST_STACKS.has(item.id)).withContext(item.id).toBe(item.id !== PET_TREAT_ID);
      for (const key of [`cabinet.item.${item.id}`, `cabinet.lore.${item.id}`]) {
        expect(CABINETS_I18N[key]?.en).withContext(key).toBeTruthy();
        expect(CABINETS_I18N[key]?.es).withContext(key).toBeTruthy();
      }
      expect(CABINETS_I18N[`cabinet.lore.${item.id}`].en).withContext(item.id).toBe(item.lore);
      expect(item.foundIn.length && item.sources.length && item.uses.length).withContext(item.id).toBeTruthy();
    }
    for (const c of CABINETS) expect(CABINETS_I18N[`cabinet.place.${c.id}`]?.es).withContext(c.id).toBeTruthy();
    for (const icon of Object.values(CURIO_ICONS)) {
      expect(icon.shape.length).toBe(16);
      for (const row of icon.shape) expect(row.length).toBe(16);
    }
  });

  it('every string is EN + ES, and the pet treat is the pets\' own', () => {
    for (const [key, v] of Object.entries(CABINETS_I18N)) {
      expect(v.en.trim()).withContext(key).not.toBe('');
      expect(v.es.trim()).withContext(key).not.toBe('');
    }
    expect(PET_TREAT).toBe(PET_TREAT_ID);
  });

  it('the Scan is on the Slate\'s first face (tier I and II)', () => {
    expect(slateTabs(1)).toContain('scan');
    expect(slateTabs(2)).toContain('scan');
    expect(slateTabs(0)).not.toContain('scan');
  });
});

describe('Lost Cabinets: the Scan', () => {
  const at = (x: number, y = FLOOR) => ({ x, y });

  it('warmth climbs band by band as the distance shrinks, burning only inside the reveal', () => {
    const range = 1000, reveal = 100;
    expect(warmthAt(2000, range, reveal)).toBe('cold');
    expect(warmthAt(900, range, reveal)).toBe('cool');
    expect(warmthAt(500, range, reveal)).toBe('warm');
    expect(warmthAt(200, range, reveal)).toBe('hot');
    expect(warmthAt(90, range, reveal)).toBe('burning');
    // The pulse quickens and rises with the warmth.
    const order = WARMTHS.slice(1);
    for (let i = 1; i < order.length; i++) {
      expect(PULSE[order[i]].period).toBeLessThan(PULSE[order[i - 1]].period);
      expect(PULSE[order[i]].pitch).toBeGreaterThan(PULSE[order[i - 1]].pitch);
    }
    expect(PULSE.none.period).toBe(0);
  });

  it('reads the nearest cabinet in this area only; quiet where nothing can be heard', () => {
    // One World (P2): the Seamworks cabinet is up in the Material Vendor's loft, in the Ember world's area.
    const c = cabinetDef('cab-seamworks')!;
    expect(c.area).toBe('ember-delve');
    expect(scanReading('ember-delve', at(c.x, c.y), new Set()).warmth).toBe('burning');
    expect(scanReading('ember-delve', at(c.x + 400), new Set()).warmth).toBe('hot');
    expect(scanReading('ember-delve', at(c.x, c.y), new Set()).id).toBe(c.id);
    expect(scanReading('ember-delve', at(c.x - 3000), new Set()).warmth).toBe('cold');
    // Opened, the glass turns to the next cabinet it can hear here (the forge-mines, deep under the street).
    expect(scanReading('ember-delve', at(c.x), new Set([c.id])).id).toBe('cab-forge-mines');
    expect(scanReading('homestead', at(500), new Set()).warmth).toBe('none');
    // Height counts: the Orrery's tree cabinet reads hotter as you climb under it.
    const tree = cabinetDef('cab-orrery-road')!;
    expect(scanReading('orrery-rings', at(tree.x, FLOOR), new Set()).distance).toBeGreaterThan(scanReading('orrery-rings', at(tree.x, tree.y), new Set()).distance);
  });

  it('Warm Glass (four curios) reads half again as far', () => {
    const c = cabinetDef('cab-court')!;
    const d = SCAN.surfaceRange * 1.2;
    expect(scanReading('luminous', at(c.x - d), new Set()).warmth).toBe('cold');
    expect(scanReading('luminous', at(c.x - d), new Set(), true).warmth).toBe('cool');
    expect(WARM_GLASS).toBe(1.5);
  });

  it('a deep cabinet is silent until the cabinet holding its clue is open', () => {
    const deep = cabinetDef('cab-ink-deeps')!;
    const here = at(deep.x, deep.y);
    expect(tuned(deep, new Set())).toBeFalse();
    expect(scanReading('umbral-delve', here, new Set()).warmth).toBe('none');
    expect(scanReading('umbral-delve', here, new Set(['cab-archive'])).warmth).toBe('burning');
    expect(openClues(new Set(['cab-archive'])).map(c => c.id)).toEqual(['cab-ink-deeps']);
    expect(openClues(new Set(['cab-archive', 'cab-ink-deeps']))).toEqual([]);
  });

  it('the Delve reads in its own (shorter) range and reach', () => {
    const c = cabinetDef('cab-forge-mines')!;
    expect(scanReading('ember-delve', at(c.x + SCAN.delveRange * .5, c.y), new Set()).warmth).toBe('warm');
    expect(inReach(c, at(c.x + 32, c.y))).toBeTrue();
    expect(inReach(c, at(c.x + 90, c.y))).toBeFalse();
  });

  it('the Curator\'s Eye points the way', () => {
    const c = cabinetDef('cab-seamworks')!;
    expect(eyeDirection('ember-delve', at(c.x - 500), new Set())).toBe('east');
    expect(eyeDirection('ember-delve', at(c.x + 500), new Set())).toBe('west');
    expect(eyeDirection('luminous', at(500), new Set(CABINETS.map(k => k.id)))).toBeNull();
    expect(eyeDirection('orrery-rings', at(940, FLOOR), new Set())).toBe('up');
  });

  it('set bonuses at 4 / 8 / 12 / 16, and the story keeps pace', () => {
    expect(SET_BONUSES.map(b => b.at)).toEqual([4, 8, 12, 16]);
    expect(hasBonus(3, 'warm-glass')).toBeFalse();
    expect(hasBonus(4, 'warm-glass')).toBeTrue();
    expect(hasBonus(15, 'last-page')).toBeFalse();
    expect(arcReached(0)).toBe(0);
    expect(arcReached(9)).toBe(2);
    expect(arcReached(16)).toBe(4);
  });
});

describe('Lost Cabinets: the save', () => {
  it('merges by union, both orders, idempotent, and drops junk', () => {
    const a = { opened: ['cab-court', 'nope', 42], rewards: [] };
    const b = { opened: ['cab-seamworks'], rewards: ['cabinets:final', 'x'] };
    const ab = coerceCabinets(mergeCabinets(a, b)), ba = coerceCabinets(mergeCabinets(b, a));
    expect(ab).toEqual(ba);
    expect(ab.opened).toEqual(['cab-court', 'cab-seamworks']);
    expect(ab.rewards).toEqual(['cabinets:final']);
    expect(coerceCabinets(mergeCabinets(ab, ab))).toEqual(ab);
    expect(mergeCabinets(null, a)).toBe(a);
    expect(coerceCabinets('junk')).toEqual(emptyCabinets());
  });
  it('is a synced blob', () => {
    expect(SYNCED_BLOBS.some(blob => blob.key === CABINETS_KEY)).toBeTrue();
  });
});

describe('CabinetsService (through the gateway)', () => {
  let economy: FakeEconomy;
  let inventory: FakeInventory;
  function boot(): CabinetsService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: EconomyService, useValue: economy }, { provide: InventoryService, useValue: inventory }] });
    return TestBed.inject(CabinetsService);
  }
  const saved = () => {
    const parsed = JSON.parse(localStorage.getItem(CABINETS_KEY) ?? 'null');
    return coerceCabinets(parsed && typeof parsed === 'object' && 'v' in parsed && 'updatedAt' in parsed ? parsed.v : parsed);
  };
  beforeEach(() => { localStorage.removeItem(CABINETS_KEY); economy = new FakeEconomy(); inventory = new FakeInventory(); });
  afterEach(() => localStorage.removeItem(CABINETS_KEY));

  it('opens once: the receipt is on disk, the curio and extras are granted once, a reload never pays again', () => {
    const s = boot();
    const got = s.open('cab-quarry');
    expect(got?.curio).toBe('curio-tally-stick');
    expect(economy.earned).toEqual([[60, 180]]);
    expect(inventory.grants.get('cabinet:cab-quarry:curio-tally-stick')).toEqual({ id: 'curio-tally-stick', qty: 1 });
    expect(inventory.grants.get(`cabinet:cab-quarry:${PET_TREAT_ID}`)).toEqual({ id: PET_TREAT_ID, qty: 3 });
    expect(saved().opened).toEqual(['cab-quarry']);
    expect(s.open('cab-quarry')).toBeNull();
    expect(boot().open('cab-quarry')).toBeNull();
    expect(economy.earned.length).toBe(1);
    expect(s.open('cab-nowhere')).toBeNull();
  });

  it('a clue names its harder cabinet; the fourth open reaches Warm Glass', () => {
    const s = boot();
    expect(s.open('cab-archive')?.clueFor).toBe('cab-ink-deeps');
    s.open('cab-court'); s.open('cab-orrery');
    const fourth = s.open('cab-canopy');
    expect(fourth?.opened).toBe(4);
    expect(fourth?.bonus).toBe('warm-glass');
    expect(s.bonus('warm-glass')).toBeTrue();
    expect(s.extraMeals()).toBe(0);
  });

  it('the sixteenth pays the set\'s final reward once, with the Curator\'s Loupe', () => {
    const s = boot();
    let last = null;
    for (const c of CABINETS) last = s.open(c.id);
    expect(last?.final?.item).toBe(FINAL_REWARD.item);
    expect(saved().rewards).toEqual([FINAL_REWARD.id]);
    expect(inventory.grants.get(`${FINAL_REWARD.id}:${FINAL_REWARD.item}`)?.qty).toBe(1);
    expect(s.loupe()).toBeTrue();
    expect(s.payFinal()).toBeNull();
    expect(boot().payFinal()).toBeNull();
    expect(economy.earned.filter(([, sec]) => sec === FINAL_REWARD.goldSeconds).length).toBe(1);
    expect(s.extraMeals()).toBe(1);
  });

  it('a merged copy from another device lands in memory (and can complete the set)', () => {
    const s = boot();
    expect(s.count()).toBe(0);
    localStorage.setItem(CABINETS_KEY, JSON.stringify({ version: 1, opened: ['cab-court', 'cab-corridors'], rewards: [] }));
    TestBed.inject(LocalSaveRegistry).rehydrate(CABINETS_KEY);
    expect(s.count()).toBe(2);
    expect(s.open('cab-court')).toBeNull();
  });

  it('the Scan is a moment, not a setting: it publishes its reading only on a change, and clears when put away', () => {
    const s = boot();
    const seen: string[] = [];
    s.reading$.subscribe(r => seen.push(r.warmth));
    s.setScanning(true);
    s.setReading({ warmth: 'cool', id: 'cab-court', distance: 900 });
    s.setReading({ warmth: 'cool', id: 'cab-court', distance: 850 });
    s.setReading({ warmth: 'warm', id: 'cab-court', distance: 500 });
    s.setScanning(false);
    expect(seen).toEqual(['none', 'cool', 'warm', 'none']);
    expect(localStorage.getItem(CABINETS_KEY)).toBeNull();
  });
});

describe('Lost Cabinets: what the pets get', () => {
  const rec = (over: Partial<PetRecord> = {}): PetRecord => ({ got: 1, hatched: 1, name: 'Hoot', nameAt: 1, love: 0, feedDay: '', feeds: 0, hat: false, hatAt: 0, xp: 0, findDay: '', scouts: 0, trinkets: 0, ...over });
  it('every pet eats the Courier\'s Honeycomb like its favourite', () => {
    for (const def of PETS) {
      const r = feedResult(def, rec(), PET_TREAT, '2026-10-15');
      expect(r.ok && r.gain).withContext(def.id).toBe(2);
    }
  });
  it('Pocketful of Crumbs: one more meal a day', () => {
    const full = rec({ feedDay: '2026-10-15', feeds: 3 });
    expect(mealsLeft(full, '2026-10-15')).toBe(0);
    expect(mealsLeft(full, '2026-10-15', 1)).toBe(1);
    expect(feedResult(PETS[0], full, PETS[0].favourite, '2026-10-15', 1).ok).toBeTrue();
  });
  it('the Hatbox of Small Crowns: any hatched pet may wear its hat now (never an egg)', () => {
    expect(hasHat(rec())).toBeFalse();
    expect(hasHat(rec(), true)).toBeTrue();
    expect(hasHat(rec({ hatched: 0 }), true)).toBeFalse();
    expect(QUEST_STACKS.has(PET_HATBOX_ID)).toBeTrue();
  });
});

describe('Lost Cabinets: the pixel cabinet', () => {
  it('stays inside its 12 x 16 box, outlined, and its three frames differ', () => {
    const frames = [0, 1, 2] as const;
    const grid = frames.map(f => Array.from({ length: CABINET_H }, (_, y) => Array.from({ length: CABINET_W }, (_, x) => cabinetPixel(x, y, f)).join('|')).join('/'));
    expect(new Set(grid).size).toBe(3);
    for (const f of frames) {
      expect(cabinetPixel(-1, 0, f)).toBe('');
      expect(cabinetPixel(CABINET_W, 5, f)).toBe('');
      expect(cabinetPixel(0, 8, f)).not.toBe('');
      expect(cabinetPixel(5, 0, f)).not.toBe('');
    }
  });
});
