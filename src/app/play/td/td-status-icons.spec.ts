/**
 * td-status-icons.spec.ts — D2-style status badges over heads (owner 2026-11-02): what each head shows, from the very
 * clocks the fight runs on (the Keeper's `kst` and wards, a creature's fields that the room's M4 bitmask mirrors), the
 * presence word other Keepers read, the 4-and-"+N" cap, the duration ring and the blink near the end.
 */
import type { EngineOptions } from '../engine/engine.model';
import { MOBS, MobSystem, type Mob, type MobHost } from './td-mobs';
import { atZoneLevel } from './td-zones';
import {
  BLINK_SECS, MAX_SHOWN, STATUS_KINDS, STS_PATTERN, StatusPeaks, blinkOff, decodeStatuses, drawStatusIcons, encodeStatuses,
  keeperStatuses, mobStatuses, ringLit, shownOf, sortStatuses, type StatusShown,
} from './td-status-icons';

function world(): MobSystem {
  const keeper = { x: 0, y: 0 };
  const host: MobHost = {
    options: {} as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => keeper,
    hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined, dash: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  return sys;
}
const mob = (sys: MobSystem): Mob => sys.place('wolf@40,0', atZoneLevel(MOBS['ember-wolf'] ?? Object.values(MOBS)[0], 5), 40, 0);
/** A canvas stand-in that counts the 9×9 badge frames drawn (the dark backing rect) and every pixel written. */
function fakeCtx(): { c: CanvasRenderingContext2D; frames: number; pixels: number; tagPixels: number } {
  const rec = { frames: 0, pixels: 0, tagPixels: 0, c: null as unknown as CanvasRenderingContext2D };
  let fill = '';
  rec.c = {
    set fillStyle(v: string) { fill = v; }, get fillStyle() { return fill; }, globalAlpha: 1,
    fillRect: (_x: number, _y: number, w: number, h: number) => { if (w === 9 && h === 9) rec.frames++; else rec.pixels++; if (fill === '#f3e7cf') rec.tagPixels++; },
  } as unknown as CanvasRenderingContext2D;
  return rec;
}

describe('td-status-icons: badges over heads', () => {
  it('the Keeper: what creatures laid on him and what helps him, the most telling first', () => {
    const sys = world(), peaks = new StatusPeaks();
    expect(keeperStatuses(sys, peaks)).toEqual([]);
    sys.kst.burn.t = 4; sys.kst.stun = 1; sys.kst.chill = 3; sys.kst.weak = 5; sys.kst.bleed.t = 2; sys.curseT = 6;
    sys.ward = 30; sys.wardT = 8;
    const list = keeperStatuses(sys, peaks, { meal: 10 });
    expect(list.map(s => s.k)).toEqual(['stun', 'burn', 'poison', 'bleed', 'curse', 'chill', 'shield', 'mend']);
    // The ring's whole is what the timer read when it was laid; it runs down from there.
    sys.kst.burn.t = 1;
    expect(keeperStatuses(sys, peaks).find(s => s.k === 'burn')).toEqual({ k: 'burn', left: 1, max: 4 });
    // Laid again: a new whole.
    sys.kst.burn.t = 5;
    expect(keeperStatuses(sys, peaks).find(s => s.k === 'burn')?.max).toBe(5);
  });

  it('a creature: its own clocks (which the room\'s M4 bitmask mirrors onto a member\'s replica), and the tank\'s threat', () => {
    const sys = world(), peaks = new StatusPeaks(), m = mob(sys);
    expect(mobStatuses(m, peaks)).toEqual([]);
    m.stun = 1.2; m.scorchT = 3; m.chillT = 2; m.slowT = 2; m.taunt = 3; m.bleedT = 4; m.cursed = 5; m.fearT = 1;
    expect(mobStatuses(m, peaks).map(s => s.k)).toEqual(['stun', 'fear', 'taunt', 'burn', 'bleed', 'curse', 'chill', 'slow']);
    // A party: this Keeper holds it against another (threat), so the tank sees which ones are his.
    m.stun = 0; m.scorchT = 0; m.chillT = 0; m.slowT = 0; m.taunt = 0; m.bleedT = 0; m.cursed = 0; m.fearT = 0;
    m.threat = new Map([['', 50], ['peer', 20]]) as Mob['threat']; m.threatOn = '';
    expect(mobStatuses(m, peaks).map(s => s.k)).toEqual(['threat']);
  });

  it('another Keeper: its screen writes a short presence word, every other screen reads it back', () => {
    const list: StatusShown[] = [{ k: 'burn', left: 3.2, max: 4 }, { k: 'chill', left: .4, max: 2 }, { k: 'shield', left: 12, max: 12 }, { k: 'threat', left: 9, max: 0 }];
    const word = encodeStatuses(list);
    expect(word).toBe('bu4,ch1,sh12');
    expect(STS_PATTERN.test(word)).toBeTrue();
    expect(decodeStatuses(word)).toEqual([{ k: 'burn', left: 4, max: 0 }, { k: 'chill', left: 1, max: 0 }, { k: 'shield', left: 12, max: 0 }]);
    // Anything malformed reads as nothing (the room checks the shape too: social-server.mjs STS).
    for (const bad of ['<b>', 'zz9', 'bu', 'bu4;ch2', 7, null]) expect(decodeStatuses(bad)).withContext(String(bad)).toEqual([]);
    // Every kind has its own code and survives the trip.
    for (const k of STATUS_KINDS) if (k !== 'threat') expect(decodeStatuses(encodeStatuses([{ k, left: 2, max: 2 }]))[0]?.k).withContext(k).toBe(k);
  });

  it('at most four badges, then "+N"; one of each kind', () => {
    const many: StatusShown[] = ['stun', 'burn', 'poison', 'bleed', 'chill', 'slow'].map(k => ({ k, left: 3, max: 3 } as StatusShown));
    expect(MAX_SHOWN).toBe(4);
    expect(shownOf(many)).toEqual({ show: many.slice(0, 4), more: 2 });
    expect(sortStatuses([{ k: 'burn', left: 1, max: 2 }, { k: 'burn', left: 3, max: 3 }])).toEqual([{ k: 'burn', left: 3, max: 3 }]);
    const r = fakeCtx();
    drawStatusIcons(r.c, many, 100, 50, 0, { still: true, low: false });
    expect(r.frames).toBe(4);
    expect(r.tagPixels).toBeGreaterThan(0);
    const few = fakeCtx();
    drawStatusIcons(few.c, many.slice(0, 2), 100, 50, 0, { still: true, low: false });
    expect(few.frames).toBe(2);
    expect(few.tagPixels).toBe(0);
  });

  it('the duration ring lights its share; it blinks in its last moments (never with reduced motion); Low draws no ring', () => {
    expect(ringLit({ k: 'burn', left: 4, max: 4 })).toBe(32);
    expect(ringLit({ k: 'burn', left: 2, max: 4 })).toBe(16);
    expect(ringLit({ k: 'burn', left: .01, max: 4 })).toBe(1);
    expect(ringLit({ k: 'burn', left: 3, max: 0 })).toBe(0);
    const ending: StatusShown = { k: 'stun', left: BLINK_SECS - .1, max: 2 };
    expect([0, 1 / 6, 2 / 6, 3 / 6].map(t => blinkOff(ending, t, false))).toEqual([false, true, false, true]);
    expect(blinkOff(ending, 1 / 6, true)).toBeFalse();
    expect(blinkOff({ k: 'stun', left: 3, max: 4 }, 1 / 6, false)).toBeFalse();
    const full = fakeCtx(), low = fakeCtx();
    drawStatusIcons(full.c, [{ k: 'burn', left: 4, max: 4 }], 0, 0, 0, { still: false, low: false });
    drawStatusIcons(low.c, [{ k: 'burn', left: 4, max: 4 }], 0, 0, 0, { still: false, low: true });
    expect(full.pixels - low.pixels).toBe(32);
  });

  it('a phone (the world drawn small): the same badges a whole step bigger, the foot where it was', () => {
    const calls: string[] = [];
    const c = { fillStyle: '', globalAlpha: 1, fillRect: () => undefined, save: () => calls.push('save'), restore: () => calls.push('restore'),
      translate: (x: number, y: number) => calls.push(`t${x},${y}`), scale: (a: number, b: number) => calls.push(`s${a},${b}`) } as unknown as CanvasRenderingContext2D;
    drawStatusIcons(c, [{ k: 'burn', left: 2, max: 2 }], 100, 50, 0, { still: true, low: false, k: 2 });
    expect(calls).toEqual(['save', 't91,32', 's2,2', 'restore']);
  });
});
