/**
 * td-night.spec.ts — the darkness pass (td-night.ts): the curve by hour and phase, the eclipse and the dungeon, the
 * Full / Softer setting, the stepped falloff, and where a creature's eyes are found.
 */
import { GLIM_OPEN_LIGHT, KEEPER_LIGHT, LIGHT_STEPS, NIGHT_TONES, eyeGlow, findEyes, lightOpen, litAt, nightPass, skyOfHour, warmAt } from './td-night';
import { coerceSound } from '../../shared/sound/sound-settings.model';

const pass = (h: number, setting: 'full' | 'softer' = 'full', eclipse = 0) => nightPass({ darkness: skyOfHour(h).darkness, eclipse, dungeon: false, setting });

describe('td-night: the curve by hour', () => {
  it('is clear at noon and through the day, so the ?hour=12 screenshots never change', () => {
    for (const h of [7, 9, 12, 15, 17.9]) expect(pass(h).alpha).toBe(0);
    expect(skyOfHour(12)).toEqual({ darkness: 0, glow: 0 });
  });

  it('is the full deep night from 20:00 to 05:00', () => {
    for (const h of [20, 22, 0, 2, 4.9]) expect(pass(h).alpha).toBeCloseTo(NIGHT_TONES.night.full, 3);
    expect(NIGHT_TONES.night.full).toBeGreaterThanOrEqual(.85);
  });

  it('slides smoothly through dusk and dawn: no step bigger than a few percent a world minute', () => {
    const at = (m: number) => pass(m / 60).alpha;
    let prev = at(17 * 60), rising = true;
    for (let m = 17 * 60 + 1; m <= 21 * 60; m++) { const a = at(m); expect(Math.abs(a - prev)).toBeLessThan(.02); if (a < prev - 1e-9) rising = false; prev = a; }
    expect(rising).toBeTrue();
    expect(at(19 * 60)).toBeGreaterThan(.3);
    expect(at(19 * 60)).toBeLessThan(.6);
    prev = at(4 * 60);
    for (let m = 4 * 60 + 1; m <= 8 * 60; m++) { const a = at(m); expect(Math.abs(a - prev)).toBeLessThan(.02); expect(a).toBeLessThanOrEqual(prev + 1e-9); prev = a; }
    expect(skyOfHour(19).glow).toBeGreaterThan(.9);
  });

  it('is blue-violet, never pure black', () => {
    const [r, g, b] = pass(0).rgb;
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    expect(r + g + b).toBeGreaterThan(40);
  });
});

describe('td-night: the eclipse and the dungeon', () => {
  it('makes an eclipse darker and more violet than any night', () => {
    const noonEclipse = nightPass({ darkness: .85, eclipse: 1, dungeon: false, setting: 'full' });
    const night = pass(0);
    expect(noonEclipse.alpha).toBeGreaterThan(night.alpha);
    expect(noonEclipse.alpha).toBeCloseTo(NIGHT_TONES.eclipse.full, 3);
    expect(noonEclipse.rgb[0]).toBeGreaterThan(night.rgb[0]);
    expect(noonEclipse.rgb[0] / noonEclipse.rgb[1]).toBeGreaterThan(night.rgb[0] / night.rgb[1]);
  });

  it('deepens with the eclipse: half way in is between the day and the full eclipse', () => {
    const half = nightPass({ darkness: .85 * .5, eclipse: .5, dungeon: false, setting: 'full' });
    expect(half.alpha).toBeGreaterThan(.3);
    expect(half.alpha).toBeLessThan(NIGHT_TONES.eclipse.full);
  });

  it('keeps a dungeon floor dark whatever the hour, on the same model', () => {
    for (const darkness of [0, .5, 1]) {
      const p = nightPass({ darkness, eclipse: 0, dungeon: true, setting: 'full' });
      expect(p.alpha).toBe(NIGHT_TONES.dungeon.full);
      expect(p.warm).toBe(1);
    }
    expect(NIGHT_TONES.dungeon.full).toBeGreaterThan(NIGHT_TONES.night.full);
  });
});

describe('td-night: Night darkness (Full / Softer)', () => {
  it('Softer lightens every dark sky and never touches the day', () => {
    for (const t of Object.values(NIGHT_TONES)) { expect(t.softer).toBeLessThan(t.full); expect(t.softer).toBeGreaterThanOrEqual(.6); }
    expect(pass(0, 'softer').alpha).toBeCloseTo(NIGHT_TONES.night.softer, 3);
    expect(pass(12, 'softer').alpha).toBe(0);
    expect(nightPass({ darkness: 0, eclipse: 0, dungeon: true, setting: 'softer' }).alpha).toBe(NIGHT_TONES.dungeon.softer);
    expect(nightPass({ darkness: .85, eclipse: 1, dungeon: false, setting: 'softer' }).alpha).toBeCloseTo(NIGHT_TONES.eclipse.softer, 3);
  });

  it('is saved with the sound settings (an older save reads as Full)', () => {
    expect(coerceSound({}).night).toBe('full');
    expect(coerceSound({ night: 'softer' }).night).toBe('softer');
  });
});

describe('td-night: lights', () => {
  it('opens the dark in three steps and a dithered rim, never a smooth ramp', () => {
    expect(lightOpen(0)).toBe(1);
    expect(lightOpen(.45)).toBe(1);
    expect(lightOpen(.5)).toBe(.8);
    expect(lightOpen(.7)).toBe(.5);
    expect(lightOpen(.9)).not.toBe(lightOpen(.9, true));
    expect(lightOpen(1.01)).toBe(0);
    const values = new Set<number>();
    for (let f = 0; f <= 1; f += .01) values.add(lightOpen(f));
    expect(values.size).toBe(LIGHT_STEPS.length + 1);
    expect(warmAt(.1)).toBeGreaterThan(warmAt(.5));
    expect(warmAt(.95)).toBe(0);
  });

  it('keeps the Keeper\'s own light a modest circle (about 3.5 tiles), Glim a little wider', () => {
    expect(KEEPER_LIGHT).toBeLessThanOrEqual(64);
    expect(GLIM_OPEN_LIGHT).toBeGreaterThan(KEEPER_LIGHT);
  });

  it('reads how lit a point is, and the eyes glow only past the light at night', () => {
    const lights = [{ x: 0, y: 0, r: 56 }];
    expect(litAt(lights, 0, 0)).toBe(1);
    expect(litAt(lights, 100, 0)).toBe(0);
    expect(eyeGlow(.86, 0)).toBe(1);
    expect(eyeGlow(.86, 1)).toBe(0);
    expect(eyeGlow(0, 0)).toBe(0);
    expect(eyeGlow(.64, 0)).toBeGreaterThan(.5);
  });
});

describe('td-night: a creature\'s eyes', () => {
  const frame = (w: number, h: number, paint: (set: (x: number, y: number, v: number) => void) => void) => {
    const d = new Uint8ClampedArray(w * h * 4);
    const set = (x: number, y: number, v: number) => { const i = (y * w + x) * 4; d[i] = v; d[i + 1] = Math.round(v * .6); d[i + 2] = 40; d[i + 3] = 255; };
    paint(set);
    return d;
  };

  it('finds two lit eyes in a dark head', () => {
    const d = frame(12, 16, set => {
      for (let y = 2; y < 16; y++) for (let x = 2; x < 10; x++) set(x, y, 50);
      set(4, 4, 255); set(7, 4, 250);
    });
    const eyes = findEyes(d, 12, 16);
    expect(eyes.map(e => [e.x, e.y])).toEqual([[4, 4], [7, 4]]);
    expect(eyes[0].rgb[0]).toBe(255);
  });

  it('guesses at the front of the head when nothing is lit', () => {
    const d = frame(12, 16, set => { for (let y = 3; y < 16; y++) for (let x = 1; x < 11; x++) set(x, y, 60); });
    const eyes = findEyes(d, 12, 16);
    expect(eyes.length).toBe(1);
    expect(eyes[0].x).toBeGreaterThanOrEqual(7);
    expect(eyes[0].y).toBe(5);
  });
});
