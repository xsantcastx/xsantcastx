/**
 * td-dark.spec.ts — the mystery layer (design-bible §5.3–5.4): the Hush's math and its caps, the dark-only visibility
 * rules (shapes, prints, shy chests), the Nightroads' timing, and the hand-placed data against the real maps.
 */
import {
  HUSH_BOONS, HUSH_BUMP, HUSH_CAP_VALUE, HUSH_MIN_LEVEL, HUSH_RATE, LIT_SHARE, NIGHTROADS, SHADE_CHESTS, SHAPE,
  bumpHush, darkBornHere, floorDepth, hushAwake, hushBand, hushBoon, hushRate, nightroadAt, nightroadFade,
  nightroadOpen, omenGap, omensOf, onNightroad, onNook, pastLight, pickOmen, printSpot, shadeChestShown, shapeDone,
  shapeSpot, stepHush, stepShape, type HushPlace, type Shape,
} from './td-dark';
import { DarkLayer, type DarkFrame } from './td-dark-layer';
import { TdWorld } from './td-world';
import { HandLevel } from './td-level';
import { LEVELS } from './td-engine';
import { TILE } from './td-art';

const place = (over: Partial<HushPlace> = {}): HushPlace => ({ dark: false, depth: 0, phase: 'day', town: false, hearth: false, lamp: false, lit: false, ...over });

describe('the Hush (design-bible §5.4)', () => {
  it('rises on dark floors, faster deeper and under night and eclipse skies', () => {
    const f1 = hushRate(place({ dark: true, depth: 1 })), f3 = hushRate(place({ dark: true, depth: 3 })), f6 = hushRate(place({ dark: true, depth: 6 }));
    expect(f1).toBeGreaterThan(0);
    expect(f3).toBeGreaterThan(f1);
    expect(f6).toBeGreaterThan(f3);
    expect(hushRate(place({ dark: true, depth: 3, phase: 'night' }))).toBeCloseTo(f3 * HUSH_RATE.floorNight, 6);
    expect(hushRate(place({ dark: true, depth: 3, phase: 'eclipse' }))).toBeCloseTo(f3 * HUSH_RATE.floorEclipse, 6);
    // Floor 1 takes minutes, not seconds, to reach the bell (30).
    expect(30 / f1).toBeGreaterThan(5 * 60);
  });

  it('rises in the open only after dark, and falls by day', () => {
    expect(hushRate(place({ phase: 'night' }))).toBe(HUSH_RATE.night);
    expect(hushRate(place({ phase: 'eclipse' }))).toBe(HUSH_RATE.eclipse);
    expect(hushRate(place({ phase: 'day' }))).toBeLessThan(0);
    expect(hushRate(place({ phase: 'dusk' }))).toBeLessThan(0);
  });

  it('falls fast in towns and by hearths, slowly by a lamp, and a raised light halves the rise', () => {
    expect(hushRate(place({ dark: true, depth: 6, phase: 'eclipse', town: true }))).toBe(HUSH_RATE.warm);
    expect(hushRate(place({ phase: 'night', hearth: true }))).toBe(HUSH_RATE.warm);
    expect(hushRate(place({ dark: true, depth: 2, lamp: true }))).toBe(HUSH_RATE.lamp);
    expect(hushRate(place({ dark: true, depth: 2, lit: true }))).toBeCloseTo(hushRate(place({ dark: true, depth: 2 })) * HUSH_RATE.litShare, 6);
  });

  it('stays within 0 and the player\'s cap, and drains when asleep', () => {
    const deep = place({ dark: true, depth: 6, phase: 'eclipse' });
    let h = 0;
    for (let i = 0; i < 2000; i++) h = stepHush(h, 1, deep, 'full', true);
    expect(h).toBe(100);
    let q = 0;
    for (let i = 0; i < 2000; i++) q = stepHush(q, 1, deep, 'quiet', true);
    expect(q).toBe(HUSH_CAP_VALUE.quiet);
    expect(hushBand(q)).toBe(1);
    expect(stepHush(50, 1, deep, 'off', true)).toBe(0);
    expect(stepHush(50, 1, deep, 'full', false)).toBe(40);
    expect(stepHush(5, 10, place({ town: true }), 'full', true)).toBe(0);
    expect(bumpHush(98, HUSH_BUMP.unveiled, 'full', true)).toBe(100);
    expect(bumpHush(58, HUSH_BUMP.unveiled, 'quiet', true)).toBe(59);
    expect(bumpHush(20, HUSH_BUMP.note, 'full', false)).toBe(20);
  });

  it('sleeps below level 10 and on Ember Isle', () => {
    expect(hushAwake(HUSH_MIN_LEVEL - 1, 'infernal-reach')).toBeFalse();
    expect(hushAwake(HUSH_MIN_LEVEL, 'infernal-reach')).toBeTrue();
    expect(hushAwake(50, 'ember-isle')).toBeFalse();
  });

  it('pays a little, capped: Magic Find and XP by band, never more than +15%', () => {
    expect(hushBand(0)).toBe(0); expect(hushBand(29.9)).toBe(0); expect(hushBand(30)).toBe(1); expect(hushBand(60)).toBe(2); expect(hushBand(90)).toBe(3); expect(hushBand(100)).toBe(3);
    expect(hushBoon(0)).toEqual({ mf: 0, xp: 1 });
    expect(hushBoon(45)).toEqual({ mf: 5, xp: 1 });
    expect(hushBoon(75)).toEqual({ mf: 10, xp: 1.1 });
    expect(hushBoon(100)).toEqual({ mf: 15, xp: 1.15 });
    for (const b of HUSH_BOONS) { expect(b.mf).toBeLessThanOrEqual(15); expect(b.xp).toBeLessThanOrEqual(1.15); }
  });

  it('brings omens of sound and sight only, and quiet dark keeps only the bell', () => {
    expect(omensOf(0)).toEqual([]);
    expect(omensOf(1)).toEqual(['bell']);
    expect(omensOf(3)).toContain('name');
    expect(omenGap(0, () => .5)).toBeNull();
    expect(omenGap(1, () => 0)!).toBeGreaterThan(omenGap(3, () => 1)!);
    const o = pickOmen(2, () => .99)!;
    expect(['bell', 'flicker', 'whisper']).toContain(o.kind);
    expect(o.line).toBeGreaterThanOrEqual(1);
  });

  it('reads the floor number off a dark level', () => {
    expect(floorDepth('molten-deep-4', true)).toBe(4);
    expect(floorDepth('salted-ember-0', true)).toBe(1);
    expect(floorDepth('slagstone-cave', true)).toBe(1);
    expect(floorDepth('surface', false)).toBe(0);
    expect(floorDepth('ember-inn-1', false)).toBe(0);
  });
});

describe('things that exist only in the dark (design-bible §5.3)', () => {
  const keeper = { x: 0, y: 0, r: 100 };
  const mk = (x: number, y: number): Shape => ({ x, y, alpha: SHAPE.alpha, age: 0, life: 10, state: 'stand', seed: 1 });

  it('stands just past the lit edge', () => {
    const at = shapeSpot(0, 0, 100, 0, false);
    expect(pastLight(at.x, at.y, [keeper])).toBeCloseTo(SHAPE.gap, 3);
    const deep = shapeSpot(0, 0, 100, 0, true);
    expect(pastLight(deep.x, deep.y, [keeper])).toBeLessThan(SHAPE.gap);
    expect(pastLight(deep.x, deep.y, [keeper])).toBeGreaterThan(0);
  });

  it('never moves toward the Keeper: it stands, steps back from a light coming close, and leaves when lit', () => {
    const far = mk(100 * LIT_SHARE + 40, 0);
    stepShape(far, [keeper], .5);
    expect(far.state).toBe('stand');
    expect(far.x).toBe(100 * LIT_SHARE + 40);
    const near = mk(100 * LIT_SHARE + 6, 0), before = near.x;
    expect(stepShape(near, [keeper], .5)).toBeNull();
    expect(near.state).toBe('back');
    expect(near.x).toBeGreaterThan(before);
    const lit = mk(50, 0);
    expect(stepShape(lit, [keeper], .1)).toBe('unveiled');
    expect(lit.state).toBe('gone');
    expect(lit.x).toBeGreaterThan(50);
    expect(stepShape(lit, [keeper], .1)).toBeNull();   // told once
    for (let i = 0; i < 40; i++) stepShape(lit, [keeper], .1);
    expect(shapeDone(lit)).toBeTrue();
  });

  it('comes only where it is dark and never into a town', () => {
    expect(darkBornHere(true, 'day', false)).toBeTrue();
    expect(darkBornHere(false, 'night', false)).toBeTrue();
    expect(darkBornHere(false, 'eclipse', false)).toBeTrue();
    expect(darkBornHere(false, 'day', false)).toBeFalse();
    expect(darkBornHere(false, 'dusk', false)).toBeFalse();
    expect(darkBornHere(true, 'night', true)).toBeFalse();
  });

  it('lays prints only past the Keeper\'s light, behind him', () => {
    const trail = [{ x: -200, y: 0 }, { x: -120, y: 0 }, { x: -40, y: 0 }, { x: -5, y: 0 }];
    const p = printSpot(trail, 0, 0, 100)!;
    expect(p.x).toBe(-120);
    expect(printSpot([{ x: -5, y: 0 }], 0, 0, 100)).toBeNull();
  });

  it('a shy chest shows only while the light on it is low', () => {
    expect(shadeChestShown({ raised: 0, petLight: false, fixed: false })).toBeTrue();
    expect(shadeChestShown({ raised: 3, petLight: false, fixed: false })).toBeFalse();
    expect(shadeChestShown({ raised: 0, petLight: true, fixed: false })).toBeFalse();
    expect(shadeChestShown({ raised: 0, petLight: false, fixed: true })).toBeFalse();
  });

  it('places every shy chest on a walkable floor tile of a real dark dungeon level', () => {
    expect(SHADE_CHESTS.length).toBeGreaterThanOrEqual(3);
    for (const ch of SHADE_CHESTS) {
      const def = LEVELS[ch.level];
      expect(def).withContext(ch.level).toBeDefined();
      expect(def.dark).withContext(ch.level).toBeTrue();
      expect(new HandLevel(def).walkable(ch.c, ch.r)).withContext(`${ch.id} at ${ch.c},${ch.r}`).toBeTrue();
    }
  });

  it('the layer: chests hide in raised light and stay open once opened; the Hush holds at a pin', () => {
    const layer = new DarkLayer('spec', () => undefined);
    const frame = (over: Partial<DarkFrame> = {}): DarkFrame => ({
      dt: .1, time: 0, still: true, levelId: 'ember-mine-2', dark: true, continent: 'infernal-reach', surface: false, phase: 'day',
      safe: false, hearth: false, keeper: { x: 0, y: 0, moving: false }, keeperLevel: 20, own: { x: 0, y: -18, r: 70 }, glim: null, pet: null,
      fixed: [], raised: 0, trail: [], walkable: () => true, ...over,
    });
    const ch = SHADE_CHESTS.find(c => c.level === 'ember-mine-2')!;
    expect(layer.chestShown(ch, frame())).toBeTrue();
    expect(layer.chestShown(ch, frame({ raised: 3 }))).toBeFalse();
    layer.markOpened(ch.id);
    expect(layer.isOpened(ch.id)).toBeTrue();
    layer.pinned = 95;
    layer.update(frame());
    expect(layer.band).toBe(3);
    expect(layer.boon.mf).toBe(15);
    layer.setCap('quiet');
    layer.update(frame());
    expect(layer.band).toBe(1);
    layer.setCap('off');
    expect(layer.awake({ keeperLevel: 50, continent: 'infernal-reach' })).toBeFalse();
  });
});

describe('the Nightroads', () => {
  it('open at night and under an eclipse, and never vanish under the Keeper', () => {
    expect(nightroadOpen('night', false)).toBeTrue();
    expect(nightroadOpen('eclipse', false)).toBeTrue();
    expect(nightroadOpen('day', false)).toBeFalse();
    expect(nightroadOpen('dawn', false)).toBeFalse();
    expect(nightroadOpen('dusk', false)).toBeFalse();
    expect(nightroadOpen('day', true)).toBeTrue();
    expect(nightroadOpen('dawn', true)).toBeTrue();
  });

  it('fade in over a few seconds (at once under reduced motion), with a faint trace at dusk', () => {
    let a = 0;
    a = nightroadFade(a, true, 'night', 1, false);
    expect(a).toBeGreaterThan(0); expect(a).toBeLessThan(1);
    for (let i = 0; i < 5; i++) a = nightroadFade(a, true, 'night', 1, false);
    expect(a).toBe(1);
    expect(nightroadFade(0, true, 'night', .016, true)).toBe(1);
    expect(nightroadFade(1, false, 'dusk', .016, true)).toBe(.12);
    expect(nightroadFade(1, false, 'day', .016, true)).toBe(0);
  });

  it('cross water by day to a nook the land never reaches, and walk only while open', () => {
    expect(NIGHTROADS.length).toBe(3);
    const world = new TdWorld();
    for (const n of NIGHTROADS) {
      expect(n.continent).toBe(world.continent);
      world.nightOpen = false;
      for (const [c, r] of n.road) {
        expect(world.ground(c, r)).withContext(`${n.id} plank ${c},${r}`).toBe('water');
        expect(world.walkable(c, r)).withContext(`${n.id} plank ${c},${r} by day`).toBeFalse();
        expect(onNightroad(n.continent, c, r)).toBeTrue();
        expect(nightroadAt(n.continent, c, r)?.id).toBe(n.id);
      }
      // The nook is firm stone, and only the road touches it: every other tile round it is water.
      const inNook = (c: number, r: number) => c >= n.nook.c && c < n.nook.c + n.nook.w && r >= n.nook.r && r < n.nook.r + n.nook.h;
      for (let r = n.nook.r; r < n.nook.r + n.nook.h; r++) for (let c = n.nook.c; c < n.nook.c + n.nook.w; c++) {
        expect(onNook(n.continent, c, r)).toBeTrue();
        expect(world.walkable(c, r)).withContext(`${n.id} nook ${c},${r}`).toBeTrue();
      }
      for (let r = n.nook.r - 1; r <= n.nook.r + n.nook.h; r++) for (let c = n.nook.c - 1; c <= n.nook.c + n.nook.w; c++) {
        if (inNook(c, r) || onNightroad(n.continent, c, r)) continue;
        expect(world.walkable(c, r)).withContext(`${n.id} round the nook ${c},${r}`).toBeFalse();
      }
      expect(inNook(n.note[0], n.note[1])).toBeTrue();
      // The shore end touches land; the far end touches the nook.
      const [c0, r0] = n.road[0], step = Math.sign(n.road[0][0] - n.road[n.road.length - 1][0]);
      expect(world.walkable(c0 + step, r0)).withContext(`${n.id} shore`).toBeTrue();
      world.nightOpen = true;
      for (const [c, r] of n.road) expect(world.walkable(c, r)).withContext(`${n.id} plank ${c},${r} at night`).toBeTrue();
    }
    expect(TILE).toBe(16);
  });
});
