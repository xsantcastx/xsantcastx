import { COUNT, COUNT_CYCLE_MS, NIGHT_EVENTS, NIGHT_REWARDS, countBell, nightEventStart, nightEventsAt, nightOf, nightRewardKey, nightSpan } from './night-events.model';
import { GATHER_MEANING, MEALS, STORMSCALE_ODDS, fishHere, mealById, stormCatch, worldFishById } from '../gathering/gathering.model';
import { STRIKE, forecast, stateFor, strikeOnCreature, strikeOnKeeper, weatherAt, weightsFor, WEATHER_WINDOW_MS } from '../weather/weather.model';
import { NightEvents, SHIFT_END, COLUMN_MARCH, COLUMN_CALLS_END, NIGHT_PLACES } from '../../play/td/td-night-events';
import { WeatherFx } from '../../play/td/td-weather-fx';
import { TILE } from '../../play/td/td-art';

const T0 = Date.UTC(2026, 9, 1);

describe('S8 — the storm and the land specials', () => {
  it('each land rolls its own special in the sixth column; an eclipse still hushes it', () => {
    const row = weightsFor('verdant-wilds', '*', 'day');
    expect(stateFor(.999, row, false, 'spores')).toBe('spores');
    expect(['clear', 'overcast']).toContain(stateFor(.999, row, true, 'spores'));
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) seen.add(weatherAt({ land: 'infernal-reach', region: 'v', ms: T0 + i * WEATHER_WINDOW_MS + 1000 }).state);
    expect(seen.has('ashfall')).toBeTrue();
  });

  it('a strike takes 8% of a Keeper\'s life and never takes him below a tenth; creatures take it in full', () => {
    expect(strikeOnKeeper(1000, 1000, { wet: 0, resist: 0 })).toBe(80);
    expect(strikeOnKeeper(1000, 1000, { wet: 1, resist: 0 })).toBe(100);
    expect(strikeOnKeeper(120, 1000, { wet: 1, resist: 0 })).toBe(20);
    expect(strikeOnKeeper(100, 1000, { wet: 1, resist: 0 })).toBe(0);
    expect(strikeOnKeeper(1000, 1000, { wet: 0, resist: 5 })).toBe(76);
    expect(strikeOnCreature(500, 0)).toBe(40);
    expect(strikeOnCreature(500, 1)).toBe(50);
  });

  it('the tell lasts 1.2 s, then the strike lands; flashes keep their limits and stop under reduced motion', () => {
    const fx = new WeatherFx();
    fx.now = { state: 'storm', level: 1, window: 0, next: 'storm', leftMs: 1 };
    const ground = { pick: () => ({ x: 100, y: 100 }), onScreen: () => true };
    fx.strikeSoon();
    fx.update(.05, 0, () => .5, false, ground);
    expect(fx.rings.length).toBe(1);
    let t = .05;
    while (fx.rings.length && t < 2) { fx.update(.05, t, () => .5, false, ground); t += .05; }
    expect(t).toBeGreaterThanOrEqual(STRIKE.tell);
    expect(fx.strikes).toBe(1);
    expect(fx.flash).toBeLessThanOrEqual(.25);
    const still = new WeatherFx();
    still.now = fx.now; still.strikeSoon();
    for (let i = 0; i < 40; i++) still.update(.05, i * .05, () => .5, true, ground);
    expect(still.strikes).toBe(1);
    expect(still.flashes).toBe(0);
  });

  it('Odette\'s board names the next two windows from the same roll the sky uses', () => {
    const ms = T0 + 5 * WEATHER_WINDOW_MS + 10;
    const [a, b] = forecast('infernal-reach', ms);
    expect(a).toBe(weatherAt({ land: 'infernal-reach', region: '*', ms: ms + WEATHER_WINDOW_MS }).state);
    expect(b).toBe(weatherAt({ land: 'infernal-reach', region: '*', ms: ms + 2 * WEATHER_WINDOW_MS }).state);
  });

  it('Stormscale only bites at sea in a thunderstorm, 1 cast in 40, and cooks into the Thundercake', () => {
    expect(fishHere('sea', 99, { dark: false, eclipse: false }).some(f => f.id === 'stormscale')).toBeFalse();
    expect(stormCatch('sea', 10, 'storm', () => STORMSCALE_ODDS / 2)?.id).toBe('stormscale');
    expect(stormCatch('sea', 10, 'rain', () => 0)).toBeNull();
    expect(stormCatch('lake', 10, 'storm', () => 0)).toBeNull();
    expect(worldFishById('stormscale')?.cooked).toBe('thundercake');
    expect(mealById('thundercake')?.buff).toEqual({ kind: 'lightning-resist', pct: 5, secs: 600 });
    expect(mealById('cold-miners-pasty')?.buff?.kind).toBe('mining-xp');
    for (const m of MEALS) expect(GATHER_MEANING.some(g => g.id === m.id)).toBeTrue();
  });
});

describe('S8 — the night events', () => {
  it('a night runs 20:00 to 05:00, and each event is seeded per land and night (the same on every device)', () => {
    for (let n = 300; n < 330; n++) {
      const span = nightSpan(n);
      expect(nightOf(span.start)).toBe(n);
      expect(nightOf(span.end - 1)).toBe(n);
      expect(nightOf(span.end + 60_000)).toBeNull();
      for (const def of NIGHT_EVENTS) {
        const a = nightEventStart(def, n), b = nightEventStart(def, n);
        expect(a).toBe(b);
        if (a !== null) { expect(a).toBeGreaterThanOrEqual(span.start); expect(a).toBeLessThan(span.end); }
      }
    }
  });

  it('the Late Shift comes about one night in three; the Relief Column every night; each at most once a night', () => {
    let shift = 0;
    const shiftDef = NIGHT_EVENTS.find(e => e.id === 'late-shift')!, col = NIGHT_EVENTS.find(e => e.id === 'relief-column')!;
    for (let n = 0; n < 300; n++) { if (nightEventStart(shiftDef, n) !== null) shift++; expect(nightEventStart(col, n)).not.toBeNull(); }
    expect(shift).toBeGreaterThan(60); expect(shift).toBeLessThan(140);
    // Once a night: walk the night second by second and count the starts.
    const n = 400, span = nightSpan(n), starts = new Set<number>();
    for (let ms = span.start; ms < span.end; ms += 5000) for (const e of nightEventsAt(col.area, ms)) starts.add(e.startMs);
    expect(starts.size).toBe(1);
  });

  it('the Count only in fog; its bell keeps to the world clock, one to forty and a silence', () => {
    expect(countBell(0)).toBe(1);
    expect(countBell(COUNT.step * 39 + .1)).toBe(40);
    expect(countBell(COUNT.step * 40 + .1)).toBe(41);
    expect(COUNT_CYCLE_MS).toBe(41 * 1500);
    for (let n = 0; n < 60; n++) {
      const span = nightSpan(n);
      for (let ms = span.start; ms < span.end; ms += 60_000) {
        const on = nightEventsAt('ember-isle', ms).some(e => e.id === 'count-goes-on');
        expect(on).toBe(weatherAt({ land: 'ember-isle', region: 'F', ms }).state === 'fog');
      }
    }
  });

  it('following pays once; walking away pays nothing; nothing ever hurts', () => {
    const run = (follow: boolean) => {
      const ev = new NightEvents();
      ev.forced = { id: 'late-shift', at: 0 };
      const end = NIGHT_PLACES.shift[NIGHT_PLACES.shift.length - 1];
      const k = follow ? { x: end[0] * TILE, y: end[1] * TILE } : { x: 4000, y: 4000 };
      const news = [];
      for (let t = 0; t < SHIFT_END + 3; t += .1) news.push(...ev.update({ ms: null, area: 'ember-isle', surface: true, keeper: k, dt: .1 }));
      return news.filter(n => n.kind === 'reward');
    };
    expect(run(true).length).toBe(1);
    expect(run(false).length).toBe(0);
    expect(Object.keys(NIGHT_REWARDS).length).toBe(6);
    expect(nightRewardKey('late-shift', 12, 'cold-miners-pasty')).toBe('night:late-shift:12:cold-miners-pasty');
  });

  it('the Relief Column pays one who walked at its side to the gate', () => {
    const ev = new NightEvents();
    ev.forced = { id: 'relief-column', at: 0 };
    const news = [];
    for (let t = 0; t < COLUMN_CALLS_END + 2; t += .1) {
      const head = ev.soldierAt(Math.min(t, COLUMN_MARCH), 3);
      news.push(...ev.update({ ms: null, area: 'infernal-reach-pyre-peaks', surface: true, keeper: { x: head.x + 20, y: head.y }, dt: .1 }));
    }
    expect(news.filter(n => n.kind === 'reward').length).toBe(1);
  });

  it('the kiln pays only when lit while it glows', () => {
    const ev = new NightEvents();
    expect(ev.lightKiln()).toBeFalse();
    ev.forced = { id: 'self-lit-kiln', at: 0 };
    ev.update({ ms: null, area: 'infernal-reach-deep-charwood', surface: true, keeper: { x: 0, y: 0 }, dt: .1 });
    expect(ev.kilnLive()).not.toBeNull();
    expect(ev.lightKiln()).toBeTrue();
    const news = ev.update({ ms: null, area: 'infernal-reach-deep-charwood', surface: true, keeper: { x: 0, y: 0 }, dt: .1 });
    expect(news.some(n => n.kind === 'reward')).toBeTrue();
    expect(ev.kilnLive()).toBeNull();
  });
});
