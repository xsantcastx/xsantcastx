import { TestBed } from '@angular/core/testing';
import { xpForLevel } from '../activity/mining-level';
import { emptyActivityLedger } from '../activity/activity.model';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { materialDisplay } from '../rpg/material-catalog';
import { stackCapOf } from '../rpg/inventory-layout';
import { InventoryService } from '../rpg/inventory.service';
import { SkillActionService } from '../skills/skill-actions.service';
import { skillLevel, SKILLS } from '../skills/skill.model';
import { unlocksFor } from '../skills/skill-unlocks';
import { WorldClockService } from '../world-clock/world-clock.service';
import { GATHER_PILE_CAP, GATHER_PILE_KEYS } from './gather-keys';
import {
  GATHER_KEYS, GATHER_MEANING, LOGS, MEALS, SPOT_GATE, WORLD_FISH, biteSecs, burnChance, chopSwings, cookable, fireRefusal,
  fishHere, mealOfRaw, rodTierOf, rollWorldFish, spotRefusal,
} from './gathering.model';
import { GatheringService } from './gathering.service';
import { TranslationService } from '../../translation.service';
import { GATHER_I18N } from './gathering.i18n';
import { FISHING_I18N } from '../fishing/fishing.i18n';
import { GatherRuntime } from '../../play/td/td-gather';
import { FLASH_GAP, FLASH_MAX, WeatherFx } from '../../play/td/td-weather-fx';
import type { FishSpot } from '../../play/td/td-world';
import { FIRE_RAIN_SECS, FIRE_SECS, WEATHER_LANDS, WEATHER_WEIGHTS, WEATHER_WINDOW_MS, fireSecs, stateFor, weatherAt, weatherRoll, weatherRolls, weightsFor } from '../weather/weather.model';
import { eclipseAt, nextEclipse } from '../world-clock/world-clock.model';

/** A seeded RNG (mulberry32) so the rolls are the same every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('gathering: the skills, their curves and their things', () => {
  it('Firemaking and Cooking are skills on the one shared curve (100·(L−1)^2.2, 1–99, then mastery)', () => {
    for (const id of ['firemaking', 'cooking'] as const) expect(SKILLS.some(s => s.id === id && s.discipline === id)).toBeTrue();
    for (const L of [2, 10, 15, 30, 45, 99]) expect(xpForLevel(L)).toBe(Math.floor(100 * Math.pow(L - 1, 2.2)));
    const at = (xp: number) => ({ ...emptyActivityLedger().progress, xpByDiscipline: { firemaking: xp, cooking: xp } });
    expect(skillLevel(at(0), 'firemaking')).toBe(1);
    expect(skillLevel(at(xpForLevel(15)), 'firemaking')).toBe(15);
    expect(skillLevel(at(xpForLevel(15) - 1), 'cooking')).toBe(14);
    expect(skillLevel(at(xpForLevel(99)), 'cooking')).toBe(99);
  });

  it('every skill panel row names a real thing: each log, fish and meal unlocks at its gate', () => {
    for (const l of LOGS) {
      expect(unlocksFor('woodcutting', l.cut).some(u => u.kind === 'node' && u.materialId === l.id)).withContext(l.id).toBeTrue();
      expect(unlocksFor('firemaking', l.burn).some(u => u.kind === 'node' && u.materialId === l.id)).withContext(l.id).toBeTrue();
    }
    for (const f of WORLD_FISH) expect(unlocksFor('fishing', f.level).some(u => u.kind === 'node' && u.materialId === f.id)).withContext(f.id).toBeTrue();
    for (const m of MEALS) expect(unlocksFor('cooking', m.level).some(u => u.kind === 'node' && u.materialId === m.id)).withContext(m.id).toBeTrue();
  });

  it('every gathered thing has a satchel name, piles 20 to a cell, and says where it is found and what it is for', () => {
    expect([...GATHER_PILE_KEYS].sort()).toEqual([...GATHER_KEYS].sort());
    for (const id of [...GATHER_KEYS, 'tinderbox']) {
      expect(materialDisplay(id)?.name).withContext(id).toBeTruthy();
      expect(materialDisplay(id)?.art).withContext(id).toBeTruthy();
    }
    for (const id of GATHER_KEYS) { expect(stackCapOf(id)).toBe(GATHER_PILE_CAP); expect(stackCapOf(`v:general-1:${id}`)).toBe(GATHER_PILE_CAP); }
    expect(stackCapOf('cinder-ore')).toBe(999);
    for (const m of GATHER_MEANING) {
      expect(m.sources.length).withContext(m.id).toBeGreaterThan(0);
      expect(m.uses.length).withContext(m.id).toBeGreaterThan(0);
      const lore = GATHER_I18N[`gather.lore.${m.id}`];
      expect(lore?.en && lore?.es).withContext(m.id).toBeTruthy();
    }
    for (const k of ['skills.name.firemaking', 'skills.name.cooking', 'skills.hint.firemaking', 'skills.hint.cooking']) expect(FISHING_I18N[k]?.es).withContext(k).toBeTruthy();
    for (const f of WORLD_FISH) expect(mealOfRaw(f.id)?.id).withContext(f.id).toBe(f.cooked);
  });
});

describe('gathering: fishing', () => {
  it('a spot is gated by Fishing level and a rod: the Worn Rod reaches the lakes, the sea wants a store rod, rivers a Seam Rod', () => {
    expect(spotRefusal('lake', 1, 0)).toBe('rod');
    expect(spotRefusal('lake', 1, .5)).toBeNull();
    expect(spotRefusal('sea', 5, .5)).toBe('storeRod');
    expect(spotRefusal('sea', 4, 1)).toBe('level');
    expect(spotRefusal('sea', 5, 1)).toBeNull();
    expect(spotRefusal('river', 10, 1)).toBe('rodTier');
    expect(spotRefusal('river', 10, 2)).toBeNull();
    const held = (ids: string[]) => (id: string) => (ids.includes(id) ? 1 : 0);
    expect(rodTierOf(held(['worn-rod']), 1).tier).toBe(.5);
    expect(rodTierOf(held(['root-rod']), 1).tier).toBe(1);
    expect(rodTierOf(held(['seam-rod']), 1).tier).toBe(1);   // works as tier I until Fishing 10
    expect(rodTierOf(held(['seam-rod']), 10).tier).toBe(2);
    for (const w of ['lake', 'sea', 'river', 'marsh'] as const) expect(fishHere(w, SPOT_GATE[w].level, { dark: false, eclipse: false }).length).withContext(w).toBeGreaterThan(0);
  });

  it('the night and the eclipse bring their own fish; a level below a fish never catches it', () => {
    const day = { dark: false, eclipse: false }, night = { dark: true, eclipse: false }, ecl = { dark: true, eclipse: true };
    expect(fishHere('lake', 99, day).map(f => f.id)).toEqual(['ash-perch']);
    expect(fishHere('lake', 99, night).map(f => f.id)).toContain('lampfish');
    expect(fishHere('lake', 99, ecl).map(f => f.id)).toContain('moonbelly');
    const r = rng(7);
    for (let i = 0; i < 500; i++) expect(rollWorldFish('lake', 10, ecl, .3, r)?.id).toBe('ash-perch');
  });

  it('a bite comes sooner in the rain and after a jump, and never sooner than the floor', () => {
    const r1 = rng(3), r2 = rng(3);
    const dry = biteSecs(1, false, r1), jumped = biteSecs(1, true, r2);
    expect(jumped).toBeCloseTo(Math.max(1.5, dry - 2), 5);
    expect(biteSecs(100, true, rng(1))).toBe(1.5);
  });

  describe('the loop against the satchel', () => {
    let room = true;
    let granted: string[];
    beforeEach(() => {
      room = true; granted = [];
      TestBed.configureTestingModule({
        providers: [
          { provide: InventoryService, useValue: { stackOf: (id: string) => (id === 'root-rod' ? 1 : id === 'ash-perch' ? 19 : 0), canTakeStack: () => room, consumeStacks: () => ({ ok: true, replayed: false }), init: () => undefined } },
          { provide: SkillActionService, useValue: { act: (i: { materialId?: string }) => { granted.push(i.materialId ?? ''); return { ok: true, replayed: false }; } } },
          { provide: WorldClockService, useValue: { sky: () => ({ dark: false, eclipseOn: false }) } },
        ],
      });
      const activity = TestBed.inject(ActivityProgressionGateway);
      spyOn(activity, 'init');
      spyOnProperty(activity, 'snapshot', 'get').and.returnValue(emptyActivityLedger());
    });

    it('lands a catch while the satchel has room, and stops the loop when it is full (nothing written)', () => {
      const g = TestBed.inject(GatheringService);
      g.random = rng(11);
      const start = g.answer({ kind: 'fish', phase: 'start', water: 'lake', spot: 's', mutationId: 'm0', weather: 'clear' });
      expect(start.ok).toBeTrue();
      expect(start.speed).toBeGreaterThan(1);
      expect(g.answer({ kind: 'fish', phase: 'bite', water: 'lake', spot: 's', mutationId: 'm1', weather: 'clear' })).toEqual(jasmine.objectContaining({ ok: true, got: 'ash-perch' }));
      room = false;
      const full = g.answer({ kind: 'fish', phase: 'bite', water: 'lake', spot: 's', mutationId: 'm2', weather: 'clear' });
      expect(full.ok).toBeFalse();
      expect(full.text).toBe(TestBed.inject(TranslationService).translate('play.grid.full'));
      expect(granted).toEqual(['ash-perch']);
      // A full satchel refuses the cast itself too.
      expect(g.answer({ kind: 'fish', phase: 'start', water: 'lake', spot: 's', mutationId: 'm3', weather: 'rain' }).ok).toBeFalse();
    });

    it('rain makes the fish bite faster', () => {
      const g = TestBed.inject(GatheringService);
      const dry = g.answer({ kind: 'fish', phase: 'start', water: 'lake', spot: 's', mutationId: 'a', weather: 'clear' }).speed!;
      const wet = g.answer({ kind: 'fish', phase: 'start', water: 'lake', spot: 's', mutationId: 'b', weather: 'rain' }).speed!;
      expect(wet / dry).toBeCloseTo(1.25, 5);
    });
  });

  it('the runtime: the loop ends the moment the Keeper steps away, and a jump at the spot shortens the wait by 2 s', () => {
    const rt = new GatherRuntime();
    const spot: FishSpot = { id: 'ember-isle:3,4', c: 3, r: 4, x: 56, y: 72, water: 'lake', shore: { x: 56, y: 94 }, seed: 1 };
    const k = { x: 56, y: 94 };
    rt.startFish(spot, 1, k, () => .5);
    const wait = rt.fish!.wait;
    rt.stepJumps([spot], 0, { dark: false, eclipse: false }, () => undefined);   // seeds the spot's jump clock
    expect(rt.fish!.wait).toBe(wait);
    rt.stepJumps([spot], 1e6, { dark: false, eclipse: false }, () => undefined);
    expect(rt.fish!.wait).toBeCloseTo(Math.max(.3, wait - 2), 5);
    rt.update(.1, 0, { x: 80, y: 94 }, false);
    expect(rt.fish).toBeNull();
  });
});

describe('gathering: cooking and fire', () => {
  it('the burn chance falls with level to nothing at the stop level, and a range burns less', () => {
    for (const m of MEALS) {
      let last = 1;
      for (let L = m.level; L <= m.stop + 2; L++) { const p = burnChance(L, m); expect(p).toBeLessThanOrEqual(last); last = p; }
      expect(burnChance(m.level, m)).toBeCloseTo(.55, 5);
      expect(burnChance(m.stop, m)).toBe(0);
      expect(burnChance(m.level + 5, m, true)).toBeLessThan(burnChance(m.level + 5, m));
      expect(burnChance(m.stop - 5, m, true)).toBe(0);
    }
  });

  it('cooks the best fish the level allows first', () => {
    const held = (id: string) => (['ash-perch', 'mirrorfin', 'mire-carp'].includes(id) ? 2 : 0);
    expect(cookable(held, 5).map(m => m.id)).toEqual(['seared-mirrorfin', 'baked-ash-perch']);
    expect(cookable(held, 30)[0].id).toBe('mire-carp-supper');
  });

  it('a fire needs a log, a tinderbox and the level; it burns two minutes, one in the rain', () => {
    expect(fireRefusal('ashwood-log', 1, false)).toBe('tinderbox');
    expect(fireRefusal('char-oak-log', 14, true)).toBe('level');
    expect(fireRefusal('char-oak-log', 15, true)).toBeNull();
    expect(fireRefusal('ash-perch', 99, true)).toBe('notLog');
    expect(fireSecs('clear')).toBe(FIRE_SECS);
    expect(fireSecs('rain')).toBe(FIRE_RAIN_SECS);
    const rt = new GatherRuntime();
    rt.lightFire(0, 0, 'ashwood-log', fireSecs('clear'), 'surface');
    const k = { x: 100, y: 100 };
    for (let t = 0; t < 119; t++) rt.update(1, t, k, false);
    expect(rt.fires.length).toBe(1);
    rt.update(1.5, 120, k, false);
    expect(rt.fires.length).toBe(0);
    // Rain burns a fire twice as fast: a two-minute fire is gone in one.
    rt.lightFire(0, 0, 'ashwood-log', fireSecs('clear'), 'surface');
    for (let t = 0; t < 61; t++) rt.update(1, t, k, true);
    expect(rt.fires.length).toBe(0);
  });

  it('a meal mends its life over twelve seconds; a new one replaces it', () => {
    const rt = new GatherRuntime();
    rt.eat(120);
    let healed = 0;
    for (let i = 0; i < 20; i++) healed += rt.update(1, i, { x: 0, y: 0 }, false).heal;
    expect(healed).toBeCloseTo(120, 5);
    expect(rt.meal).toBeNull();
  });

  it('a Woodcutting level twenty past a log\'s gate fells it in fewer swings', () => {
    expect(chopSwings(1, LOGS[0])).toBe(4);
    expect(chopSwings(21, LOGS[0])).toBe(3);
    expect(chopSwings(99, LOGS[0])).toBe(2);
  });
});

describe('weather v1', () => {
  it('every weight row sums to 100', () => {
    for (const land of Object.keys(WEATHER_WEIGHTS)) for (const [region, w] of Object.entries(WEATHER_WEIGHTS[land])) {
      for (const part of ['day', 'night', 'dusk'] as const) expect(weightsFor(land, region, part).reduce((a, b) => a + b, 0)).withContext(`${land} ${region} ${part}`).toBe(100);
      expect(w.day.length).toBe(6);
    }
  });

  it('the roll is deterministic: one land, one window, one number on every device; the room\'s rolls agree', () => {
    const ms = Date.UTC(2026, 9, 26, 12, 3);
    const w = Math.floor(ms / WEATHER_WINDOW_MS);
    expect(weatherRoll('ember-isle', w)).toBe(weatherRoll('ember-isle', w));
    expect(weatherRoll('ember-isle', w)).not.toBe(weatherRoll('infernal-reach', w));
    const rolls = weatherRolls(w);
    expect(Object.keys(rolls).sort()).toEqual([...WEATHER_LANDS].sort());
    for (const land of WEATHER_LANDS) {
      const local = weatherAt({ land, region: '*', ms });
      const room = weatherAt({ land, region: '*', ms, rolls: { window: w, lands: rolls } });
      expect(room).toEqual(local);
    }
    // A room's roll wins over the device's own (a skewed clock still sees the room's sky).
    const forced = weatherAt({ land: 'ember-isle', region: '*', ms, rolls: { window: w, lands: { 'ember-isle': .999 } } });
    expect(forced.state).toBe(stateFor(.999, weightsFor('ember-isle', '*', 'day'), false));
  });

  it('every state shows up over a long run, Ember Isle\'s low ground never storms, and an eclipse hushes the sky', () => {
    const seen = new Set<string>();
    const start = Date.UTC(2026, 9, 1);
    for (let i = 0; i < 4000; i++) {
      const ms = start + i * WEATHER_WINDOW_MS + 1000;
      const now = weatherAt({ land: 'umbral-marches', region: 'x', ms });
      seen.add(now.state);
      expect(weatherAt({ land: 'ember-isle', region: '*', ms }).state).not.toBe('storm');
    }
    expect([...seen].sort()).toEqual(['clear', 'fog', 'overcast', 'rain', 'storm']);
    const ecl = nextEclipse(start);
    for (let ms = ecl.startMs + WEATHER_WINDOW_MS; ms < ecl.endMs - WEATHER_WINDOW_MS; ms += WEATHER_WINDOW_MS) {
      const mid = Math.floor(ms / WEATHER_WINDOW_MS) * WEATHER_WINDOW_MS + WEATHER_WINDOW_MS / 2;
      if (!eclipseAt(mid)) continue;
      expect(['clear', 'overcast']).toContain(weatherAt({ land: 'umbral-marches', region: 'x', ms }).state);
    }
    expect(weatherAt({ land: 'ember-isle', region: '*', ms: start, indoors: true }).state).toBe('clear');
  });

  it('a storm\'s flash: never above 25% white, never two within 3 s, never under reduced motion or on Soft', () => {
    const run = (still: boolean, show: 'full' | 'soft') => {
      const fx = new WeatherFx();
      fx.show = show;
      fx.now = { state: 'storm', level: 1, window: 0, next: 'storm', leftMs: 1 };
      const r = rng(5), at: number[] = [];
      let max = 0;
      for (let i = 0, n = fx.flashes; i < 20000; i++) {
        const t = i * .05;
        fx.update(.05, t, r, still);
        max = Math.max(max, fx.flash);
        if (fx.flashes !== n) { n = fx.flashes; at.push(t); }
      }
      return { at, max };
    };
    const full = run(false, 'full');
    expect(full.at.length).toBeGreaterThan(5);
    expect(full.max).toBeLessThanOrEqual(FLASH_MAX);
    for (let i = 1; i < full.at.length; i++) expect(full.at[i] - full.at[i - 1]).toBeGreaterThanOrEqual(FLASH_GAP);
    expect(run(true, 'full').at.length).toBe(0);
    expect(run(false, 'soft').at.length).toBe(0);
  });
});
