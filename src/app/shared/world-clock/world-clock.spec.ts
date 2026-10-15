/**
 * The world clock (docs/handoff/world-clock.md): the clock math, the phases,
 * the eclipse schedule (deterministic, time-zone and DST proof), what the
 * clock puts in the world, Sera Quill's ledger through the gateway, and the
 * places that read the hour (the keepers, the fish, the score).
 */
import { TestBed } from '@angular/core/testing';
import {
  CLOCK_EPOCH_MS, ECLIPSE, MONTHS, MONTH_DAYS, WEEK_DAYS, WORLD_DAY_MS, YEAR_DAYS, clockText, daylight, eclipseAt, eclipseDepth,
  eclipseRealm, isEclipseDay, msAt, nextEclipse, phaseAt, skyAt, sunGlow, worldSpan, worldTime,
} from './world-clock.model';
import { CLOCK_ITEMS, ECLIPSE_GLASS_ID, LEDGER_MARKS, MIRRORFIN_ID, MOONWAKE_BLOOM_ID, OBSERVATION, marksDue, nextMark } from './eclipse.model';
import { ECLIPSE_KEY, SEEN_CAP, coerceEclipse, emptyEclipse, mergeEclipse, witnessed } from './eclipse-save.model';
import { EclipseService } from './eclipse.service';
import { WORLD_CLOCK_I18N } from './world-clock.i18n';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { catchTable, bestBait } from '../fishing/fishing.model';
import { keeperLines } from '../../play/world/keeper-lines';
import { ambienceFor, paletteFor, scoreHour, type SoundScene } from '../sound/sound-palette';
import { materialDisplay } from '../rpg/material-catalog';
import { pixelIcon } from '../art/pixel-icons';
import { TOWNS } from '../../play/world/world.model';

const MIN = 1000;

describe('World clock: the math', () => {
  it('starts at Year 1, the first of Emberwane, a Forgeday, midnight', () => {
    const t = worldTime(CLOCK_EPOCH_MS);
    expect(t).toEqual(jasmine.objectContaining({ day: 0, minute: 0, hour: 0, min: 0, weekday: 0, month: 0, dayOfMonth: 1, year: 1, phase: 'night' }));
    expect(WEEK_DAYS[t.weekday]).toBe('forge');
    expect(MONTHS[t.month].id).toBe('emberwane');
  });
  it('one real second is an in-game minute, one real minute an hour, 24 real minutes a day', () => {
    expect(worldTime(CLOCK_EPOCH_MS + 1000).minute).toBe(1);
    expect(worldTime(CLOCK_EPOCH_MS + 60 * MIN).hour).toBe(1);
    expect(WORLD_DAY_MS).toBe(24 * 60 * 1000);
    const next = worldTime(CLOCK_EPOCH_MS + WORLD_DAY_MS);
    expect(next.day).toBe(1); expect(next.minute).toBe(0); expect(WEEK_DAYS[next.weekday]).toBe('light');
  });
  it('a week of seven, months of fourteen (two weeks), a year of seventy days', () => {
    expect(WEEK_DAYS.length).toBe(7);
    expect(MONTHS.length).toBe(5);
    expect(YEAR_DAYS).toBe(70);
    const t = worldTime(msAt(MONTH_DAYS + 3, 0));
    expect(t.month).toBe(1); expect(t.dayOfMonth).toBe(4);
    expect(worldTime(msAt(YEAR_DAYS, 0)).year).toBe(2);
    // Every month starts on a Forgeday (14 and 70 are whole weeks).
    for (let m = 0; m < 10; m++) expect(worldTime(msAt(m * MONTH_DAYS, 0)).weekday).toBe(0);
  });
  it('is time-zone and DST proof: the same instant read through any offset or season is the same world time', () => {
    const instants = ['2026-10-25T00:59:30Z', '2026-10-25T02:59:30+02:00', '2026-10-24T20:59:30-04:00', '2026-10-25T10:29:30+09:30'];
    const reads = instants.map(iso => worldTime(new Date(iso).getTime()));
    for (const r of reads) expect(r).toEqual(reads[0]);
    // Across a DST change in any zone, a real hour is still exactly 60 in-game hours.
    const a = new Date('2026-03-29T00:30:00Z').getTime();
    expect((worldTime(a + 3600 * 1000).day * 1440 + worldTime(a + 3600 * 1000).minute) - (worldTime(a).day * 1440 + worldTime(a).minute)).toBe(3600);
  });
  it('reads before the epoch too (negative days wrap the week and the month)', () => {
    const t = worldTime(CLOCK_EPOCH_MS - 1000);
    expect(t.day).toBe(-1); expect(t.minute).toBe(1439); expect(t.weekday).toBe(6); expect(t.dayOfMonth).toBe(MONTH_DAYS);
  });
  it('formats the clock and spans', () => {
    expect(clockText(0)).toBe('00:00'); expect(clockText(7 * 60 + 5)).toBe('07:05'); expect(clockText(1440 + 61)).toBe('01:01');
    expect(worldSpan(0, 90 * MIN)).toEqual({ h: 1, m: 30 });
    expect(worldSpan(5000, 0)).toEqual({ h: 0, m: 0 });
  });
});

describe('World clock: day and night', () => {
  it('dawn 05–07, day 07–18, dusk 18–20, night 20–05', () => {
    expect(phaseAt(4 * 60 + 59)).toBe('night');
    expect(phaseAt(5 * 60)).toBe('dawn');
    expect(phaseAt(7 * 60)).toBe('day');
    expect(phaseAt(18 * 60)).toBe('dusk');
    expect(phaseAt(20 * 60)).toBe('night');
  });
  it('daylight climbs through the dawn, holds, falls through the dusk; the low sun glows only then', () => {
    expect(daylight(2 * 60)).toBe(0);
    expect(daylight(12 * 60)).toBe(1);
    let last = -1;
    for (let m = 5 * 60; m <= 7 * 60; m += 10) { expect(daylight(m)).toBeGreaterThanOrEqual(last); last = daylight(m); }
    last = 2;
    for (let m = 18 * 60; m <= 20 * 60; m += 10) { expect(daylight(m)).toBeLessThanOrEqual(last); last = daylight(m); }
    expect(sunGlow(6 * 60)).toBeGreaterThan(.9); expect(sunGlow(19 * 60)).toBeGreaterThan(.9);
    expect(sunGlow(12 * 60)).toBe(0); expect(sunGlow(23 * 60)).toBe(0);
  });
  it('the sky: night is dark, noon is not', () => {
    const day = skyAt(msAt(1, 12 * 60)), night = skyAt(msAt(1, 23 * 60));
    expect(day.phase).toBe('day'); expect(day.dark).toBeFalse(); expect(day.light).toBe(1);
    expect(night.phase).toBe('night'); expect(night.night).toBeTrue(); expect(night.dark).toBeTrue(); expect(night.light).toBe(0);
  });
});

describe('World clock: the eclipse schedule', () => {
  it('every fifth day from day 2, 10:00–18:00, the realms in turn', () => {
    const days = Array.from({ length: 20 }, (_, d) => d).filter(isEclipseDay);
    expect(days).toEqual([2, 7, 12, 17]);
    expect(isEclipseDay(-3)).toBeTrue();
    expect([2, 7, 12, 17, 22, 27].map(eclipseRealm)).toEqual(['infernal', 'luminous', 'umbral', 'celestial', 'verdant', 'infernal']);
    expect(eclipseAt(msAt(2, ECLIPSE.start - 1))).toBeNull();
    expect(eclipseAt(msAt(2, ECLIPSE.start))?.id).toBe(2);
    expect(eclipseAt(msAt(2, ECLIPSE.end - 1))?.id).toBe(2);
    expect(eclipseAt(msAt(2, ECLIPSE.end))).toBeNull();
    expect(eclipseAt(msAt(3, 12 * 60))).toBeNull();
  });
  it('is deterministic: next eclipse from any instant is the same window, every time', () => {
    for (let k = 0; k < 50; k++) {
      const ms = CLOCK_EPOCH_MS + k * 7_919_000;
      const a = nextEclipse(ms), b = nextEclipse(ms);
      expect(a).toEqual(b);
      expect(isEclipseDay(a.id)).toBeTrue();
      expect(a.endMs - a.startMs).toBe((ECLIPSE.end - ECLIPSE.start) * MIN);
      // Either on now, or the next to begin (and nothing begins between).
      if (a.startMs <= ms) expect(eclipseAt(ms)?.id).toBe(a.id);
      else expect(a.startMs - ms).toBeLessThanOrEqual(ECLIPSE.every * WORLD_DAY_MS);
    }
    // From just after one ends, the next is five days on.
    const w = nextEclipse(msAt(2, ECLIPSE.end));
    expect(w.id).toBe(7);
  });
  it('darkens in and out over the ramp; the sky reads it as its own phase, a night at noon', () => {
    expect(eclipseDepth(msAt(2, ECLIPSE.start))).toBe(0);
    expect(eclipseDepth(msAt(2, 14 * 60))).toBe(1);
    const sky = skyAt(msAt(2, 14 * 60));
    expect(sky.phase).toBe('eclipse'); expect(sky.eclipseOn).toBeTrue(); expect(sky.dark).toBeTrue(); expect(sky.night).toBeFalse();
    expect(sky.light).toBeLessThan(.3);
  });
});

describe('World clock: what it puts in the world', () => {
  it('three things, each named, painted, lored in EN and ES, with a source, a use and a Found in', () => {
    expect(CLOCK_ITEMS.map(i => i.id)).toEqual([MOONWAKE_BLOOM_ID, MIRRORFIN_ID, ECLIPSE_GLASS_ID]);
    for (const item of CLOCK_ITEMS) {
      expect(materialDisplay(item.id)?.name).withContext(item.id).toBe(item.name);
      expect(pixelIcon(item.id)).withContext(item.id).not.toBeNull();
      expect(WORLD_CLOCK_I18N[`clock.lore.${item.id}`]?.es).withContext(item.id).toBeTruthy();
      expect(item.sources.length && item.uses.length && item.foundIn.length).withContext(item.id).toBeTruthy();
    }
  });
  it('a Moonwake Bloom in four hunting grounds (dark), an Eclipse Glass outcrop in all five (eclipse), the creatures keep their hour', () => {
    const hunts = Object.values(TOWNS).flatMap(t => t?.hunts ?? []).filter(h => !h.terrain);
    const moon = hunts.filter(h => h.nodes?.some(n => n.id === 'moonwake' && n.when === 'dark'));
    const glass = hunts.filter(h => h.nodes?.some(n => n.id === 'eclipse-glass' && n.when === 'eclipse'));
    expect(moon.map(h => h.id).sort()).toEqual(['ember-quarry', 'orrery-rings', 'rootglass-thicket', 'unrecorded-corridors']);
    expect(glass.length).toBe(5);
    const lantern = hunts.find(h => h.id === 'unrecorded-corridors')!.monsters.find(m => m.creature === 'ink-lantern');
    const moth = hunts.find(h => h.id === 'reflection-channels')!.monsters.find(m => m.creature === 'afterimage-moth');
    expect(lantern?.when).toBe('dark');
    expect(moth?.when).toBe('eclipse');
    expect(moth?.drops?.entries.some(e => e.kind === 'material' && e.material === ECLIPSE_GLASS_ID)).toBeTrue();
  });
  it('the Mirrorfin bites only in the dark, and far more on Moonwake bait', () => {
    const p = (ctx: Parameters<typeof catchTable>[0]) => catchTable(ctx).find(r => r.id === MIRRORFIN_ID)?.p ?? 0;
    expect(p({ water: 'mere', bait: 0 })).toBe(0);
    expect(p({ water: 'seep', bait: 0, dark: false })).toBe(0);
    const plain = p({ water: 'mere', bait: .3, dark: true });
    const baited = p({ water: 'mere', bait: .3, dark: true, moonBait: true });
    expect(plain).toBeGreaterThan(0);
    expect(baited).toBeGreaterThan(plain * 2);
    expect(p({ water: 'magma', bait: 0, dark: true })).toBe(0);
    const sum = catchTable({ water: 'mere', bait: .3, dark: true, moonBait: true }).reduce((s, r) => s + r.p, 0);
    expect(sum).toBeCloseTo(1, 9);
    // In the dark a held Moonwake goes on the hook first; by day the strongest bait does.
    const held = (id: string) => (id === 'moonwake-bloom' || id === 'shadow-root-cutting' ? 1 : 0);
    expect(bestBait(held, true)?.id).toBe('moonwake-bloom');
    expect(bestBait(held, false)?.id).toBe('shadow-root-cutting');
  });
});

describe('World clock: who notices the hour', () => {
  const ctx = (hour?: 'dawn' | 'day' | 'dusk' | 'night' | 'eclipse') => ({ beats: new Set<string>(), deeds: new Set<string>(), hour });
  it('a keeper says the hour\'s line first, and only at that hour', () => {
    expect(keeperLines('tomas', ctx('night'))[0]).toBe('play.life.line.tomas.8');
    expect(keeperLines('sera', ctx('eclipse'))[0]).toBe('play.life.line.sera.8');
    expect(keeperLines('tomas', ctx('day'))).not.toContain('play.life.line.tomas.8');
    expect(keeperLines('sera', ctx())).not.toContain('play.life.line.sera.8');
    expect(keeperLines('gatekeeper', ctx('dawn'))[0]).toBe('play.life.line.gatekeeper.7');
  });
  it('the score drops at night and goes minor under the eclipse; the birds stop', () => {
    const scene: SoundScene = { realm: 'verdant', delve: false, boss: false, hour: 12, water: false, lava: false, ink: false, glim: false };
    expect(scoreHour(scene)).toBe('day');
    expect(scoreHour({ ...scene, hour: 23 })).toBe('night');
    expect(scoreHour({ ...scene, eclipse: true })).toBe('eclipse');
    const day = paletteFor('verdant', 'town', 'day'), night = paletteFor('verdant', 'town', 'night'), dark = paletteFor('verdant', 'town', 'eclipse');
    expect(night.root).toBeLessThan(day.root);
    expect(dark.drone).toBeTrue(); expect(dark.scale).toContain(3);
    expect(paletteFor('verdant', 'delve', 'night').root).toBe(paletteFor('verdant', 'delve').root);
    expect(ambienceFor({ ...scene, eclipse: true }).birds).toBe(0);
    expect(ambienceFor(scene).birds).toBeGreaterThan(0);
  });
});

describe('Sera Quill\'s Eclipse Ledger: the save', () => {
  it('merges by union (max of older), both orders, idempotent, and drops junk', () => {
    const a = { seen: [2, 7, 'x', 7.5], older: 1, marks: ['eclipse:mark-1', 'nope'] };
    const b = { seen: [12, 2], older: 3, marks: ['eclipse:mark-3'] };
    const ab = coerceEclipse(mergeEclipse(a, b)), ba = coerceEclipse(mergeEclipse(b, a));
    expect(ab).toEqual(ba);
    expect(ab.seen).toEqual([2, 7, 12]);
    expect(ab.older).toBe(3);
    expect(ab.marks).toEqual(['eclipse:mark-1', 'eclipse:mark-3']);
    expect(coerceEclipse(mergeEclipse(ab, ab))).toEqual(ab);
    expect(witnessed(ab)).toBe(6);
    expect(coerceEclipse('junk')).toEqual(emptyEclipse());
  });
  it('keeps the newest SEEN_CAP and counts the rest', () => {
    const s = coerceEclipse({ seen: Array.from({ length: SEEN_CAP + 5 }, (_, i) => i * 5 + 2) });
    expect(s.seen.length).toBe(SEEN_CAP);
    expect(s.older).toBe(5);
    expect(witnessed(s)).toBe(SEEN_CAP + 5);
  });
  it('is a synced blob; the marks ascend and the next mark is the first not reached', () => {
    expect(SYNCED_BLOBS.some(b => b.key === ECLIPSE_KEY)).toBeTrue();
    expect(LEDGER_MARKS.map(m => m.at)).toEqual([1, 3, 5, 8]);
    expect(nextMark(0)?.at).toBe(1); expect(nextMark(4)?.at).toBe(5); expect(nextMark(8)).toBeNull();
    expect(marksDue(5, ['eclipse:mark-1']).map(m => m.at)).toEqual([3, 5]);
  });
});

class FakeEconomy {
  earned: [number, number][] = [];
  earnIncome(floor: number, seconds: number): number { this.earned.push([floor, seconds]); return floor; }
}
class FakeInventory {
  grants = new Map<string, { id: string; qty: number }>();
  grantStack(grantId: string, id: string, qty: number): boolean { if (!this.grants.has(grantId)) this.grants.set(grantId, { id, qty }); return true; }
  stackOf(id: string): number { let n = 0; for (const g of this.grants.values()) if (g.id === id) n += g.qty; return n; }
}

describe('EclipseService (through the gateway)', () => {
  let economy: FakeEconomy;
  let inventory: FakeInventory;
  function boot(): EclipseService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: EconomyService, useValue: economy }, { provide: InventoryService, useValue: inventory }] });
    return TestBed.inject(EclipseService);
  }
  const saved = () => {
    const parsed = JSON.parse(localStorage.getItem(ECLIPSE_KEY) ?? 'null');
    return coerceEclipse(parsed && typeof parsed === 'object' && 'v' in parsed && 'updatedAt' in parsed ? parsed.v : parsed);
  };
  beforeEach(() => { localStorage.removeItem(ECLIPSE_KEY); economy = new FakeEconomy(); inventory = new FakeInventory(); });
  afterEach(() => localStorage.removeItem(ECLIPSE_KEY));

  it('writes an eclipse down once: receipt on disk, the observation and the first mark paid once, a reload never pays again', () => {
    const s = boot();
    const got = s.witness({ id: 2 });
    expect(got?.count).toBe(1);
    expect(got?.marks.map(m => m.at)).toEqual([1]);
    expect(saved().seen).toEqual([2]);
    expect(saved().marks).toEqual(['eclipse:mark-1']);
    expect(economy.earned).toEqual([[OBSERVATION.gold, OBSERVATION.goldSeconds], [LEDGER_MARKS[0].gold, LEDGER_MARKS[0].goldSeconds]]);
    expect(inventory.grants.get('eclipse:mark-1:glass')).toEqual({ id: ECLIPSE_GLASS_ID, qty: LEDGER_MARKS[0].glass });
    expect(s.witness({ id: 2 })).toBeNull();
    expect(boot().witness({ id: 2 })).toBeNull();
    expect(economy.earned.length).toBe(2);
  });
  it('missing eclipses costs nothing: the next one counts the same, and the marks come as the count does', () => {
    const s = boot();
    s.witness({ id: 2 });
    // Skipped 7 and 12: the next one is simply the second observation.
    expect(s.witness({ id: 17 })?.count).toBe(2);
    expect(s.witness({ id: 22 })?.marks.map(m => m.at)).toEqual([3]);
    expect(s.count()).toBe(3);
  });
  it('a merged copy that crossed a mark lands in memory, and catchUp pays that mark once', () => {
    const s = boot();
    expect(s.count()).toBe(0);
    localStorage.setItem(ECLIPSE_KEY, JSON.stringify({ version: 1, seen: [2, 7, 12], older: 0, marks: [] }));
    TestBed.inject(LocalSaveRegistry).rehydrate(ECLIPSE_KEY);
    expect(s.count()).toBe(3);
    expect(s.catchUp().map(m => m.at)).toEqual([1, 3]);
    expect(s.catchUp()).toEqual([]);
    expect(s.witness({ id: 7 })).toBeNull();
  });
});
