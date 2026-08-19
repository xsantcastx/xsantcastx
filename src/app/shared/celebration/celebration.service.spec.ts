/**
 * celebration.service.spec.ts — the layer goes up, and it always comes down.
 *
 * The behaviours worth guarding are not what a Legendary looks like — that is
 * the model's job and the model has its own spec. They are the ones that would
 * leave the site broken if they regressed:
 *
 *   · a Common must not put anything on the page at all;
 *   · a second celebration must replace the first, not stack on it;
 *   · every run must clean up after itself, including the flags on <html>;
 *   · a throw inside one effect must not leave a fixed overlay pinned there;
 *   · none of it may ever eat a click.
 */
import { TestBed } from '@angular/core/testing';

import { CelebrationService } from './celebration.service';
import { CelebrationAudioService } from './celebration-audio.service';
import { ForgeSceneService } from '../forge-scene/forge-scene.service';
import { TIER_FX } from './celebration.model';

describe('CelebrationService', () => {
  let svc: CelebrationService;
  let scene: jasmine.SpyObj<Pick<ForgeSceneService, 'celebrate' | 'shake'>>;
  let audio: jasmine.SpyObj<Pick<CelebrationAudioService, 'play'>>;

  const layer = () => document.querySelector('.gf-fx');
  const root = () => document.documentElement;

  beforeEach(() => {
    scene = jasmine.createSpyObj('ForgeSceneService', ['celebrate', 'shake']);
    audio = jasmine.createSpyObj('CelebrationAudioService', ['play']);
    TestBed.configureTestingModule({
      providers: [
        { provide: ForgeSceneService, useValue: scene },
        { provide: CelebrationAudioService, useValue: audio },
      ],
    });
    svc = TestBed.inject(CelebrationService);
  });

  afterEach(() => {
    svc.cancel();
  });

  it('does nothing at all for a Common', () => {
    svc.celebrate('common');
    expect(layer()).toBeNull();
    expect(audio.play).not.toHaveBeenCalled();
    expect(scene.celebrate).not.toHaveBeenCalled();
  });

  it('puts a layer on the page for a Rare', () => {
    svc.celebrate('rare');
    const el = layer();
    expect(el).not.toBeNull();
    expect(el!.getAttribute('aria-hidden')).toBe('true');
    expect((el as HTMLElement).dataset['tier']).toBe('rare');
  });

  it('is never a click target', () => {
    svc.celebrate('legendary');
    const el = layer() as HTMLElement;
    expect(getComputedStyle(el).pointerEvents).toBe('none');
  });

  it('replaces the previous celebration rather than stacking on it', () => {
    svc.celebrate('rare');
    svc.celebrate('epic');
    expect(document.querySelectorAll('.gf-fx').length).toBe(1);
    expect((layer() as HTMLElement).dataset['tier']).toBe('epic');
  });

  it('takes the whole layer down on cancel', () => {
    svc.celebrate('singular');
    expect(layer()).not.toBeNull();
    svc.cancel();
    expect(layer()).toBeNull();
  });

  it('clears the flags it wrote on <html>', () => {
    // A route change mid-Mythic used to be able to leave the whole site under
    // a hue-rotate until the next reload.
    svc.celebrate('mythic');
    svc.cancel();
    expect(root().classList.contains('gf-distorting')).toBe(false);
    expect(root().dataset['gfSlowmo']).toBeUndefined();
  });

  it('never transforms the document', () => {
    // A transform on <html> or <body> makes it the containing block for every
    // position:fixed descendant, which re-anchors the reveal dialog against the
    // document and throws the card off the screen mid-shake. The shake is spent
    // on the scene's camera and on elements with nothing fixed inside them.
    svc.celebrate('singular');
    expect(getComputedStyle(root()).transform).toBe('none');
    expect(getComputedStyle(document.body).transform).toBe('none');
    expect(root().classList.contains('gf-jolt')).toBe(false);
    expect(document.body.classList.contains('gf-jolt')).toBe(false);
  });

  it('shakes the scene and the card it was handed', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    try {
      svc.celebrate('epic', el);
      // Amplitude is asserted as a range, not a literal: scaleFx trims it on a
      // narrow viewport and Karma's runner iframe is one. Duration is never
      // scaled, so that one is exact.
      const [amplitude, duration] = scene.shake.calls.mostRecent().args;
      expect(duration).toBe(TIER_FX.epic.shake!.duration);
      expect(amplitude).toBeGreaterThan(0);
      expect(amplitude).toBeLessThanOrEqual(TIER_FX.epic.shake!.amplitude);
      expect(el.classList.contains('gf-jolt')).toBe(true);
      expect(layer()!.classList.contains('gf-jolt')).toBe(true);
      // And it hands the caller's element back clean.
      svc.cancel();
      expect(el.classList.contains('gf-jolt')).toBe(false);
      expect(el.style.getPropertyValue('--gf-shake')).toBe('');
    } finally {
      el.remove();
    }
  });

  it('leaves an element alone when the tier does not shake', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    try {
      svc.celebrate('rare', el);
      expect(scene.shake).not.toHaveBeenCalled();
      expect(el.classList.contains('gf-jolt')).toBe(false);
    } finally {
      el.remove();
    }
  });

  it('raises the slow-motion flag only for the tiers that ask for it', () => {
    svc.celebrate('rare');
    expect(root().dataset['gfSlowmo']).toBeUndefined();
    svc.celebrate('mythic');
    expect(root().dataset['gfSlowmo']).toBe(String(TIER_FX.mythic.timeScale));
  });

  describe('letters', () => {
    it('is off for the tiers that do not earn it', () => {
      expect(svc.letters('common')).toBe(false);
      expect(svc.letters('uncommon')).toBe(false);
    });

    it('is on from Rare up', () => {
      for (const tier of ['rare', 'epic', 'legendary', 'mythic', 'singular'] as const) {
        expect(svc.letters(tier)).withContext(tier).toBe(true);
      }
    });

    it('respects the budget, not just the table', () => {
      // The bug this guards: the component used to read TIER_FX directly, which
      // meant a visitor who had asked for reduced motion still got a Singular's
      // name typed out one character at a time.
      spyOn(window, 'matchMedia').and.returnValue({ matches: true } as unknown as MediaQueryList);
      expect(svc.letters('singular')).toBe(false);
    });
  });

  it('plays the tier profile and hands the reaction to the scene', () => {
    svc.celebrate('epic');
    expect(audio.play).toHaveBeenCalledWith(TIER_FX.epic.sound);
    expect(scene.celebrate).toHaveBeenCalled();
    expect(scene.celebrate.calls.mostRecent().args[0]).toBe(TIER_FX.epic.scene);
  });

  it('delays the scene reaction past a blackout', () => {
    // The field should not be doing anything visible behind a black curtain.
    svc.celebrate('legendary');
    const delay = scene.celebrate.calls.mostRecent().args[3];
    const { fade, hold } = TIER_FX.legendary.blackout!;
    expect(delay).toBe(fade + hold);
  });

  it('radiates from the element it was handed', () => {
    // Placed as a fraction of the real viewport: Karma's runner iframe is a few
    // hundred pixels tall, and a box pinned at a fixed 200px would fall off the
    // bottom of it and take the off-screen fallback path instead.
    const left = Math.round(window.innerWidth * 0.25);
    const top = Math.round(window.innerHeight * 0.25);
    const el = document.createElement('div');
    el.style.cssText =
      `position:fixed;left:${left}px;top:${top}px;width:40px;height:60px`;
    document.body.appendChild(el);
    try {
      svc.celebrate('rare', el);
      expect((layer() as HTMLElement).style.getPropertyValue('--fx-x')).toBe(`${left + 20}px`);
      expect((layer() as HTMLElement).style.getPropertyValue('--fx-y')).toBe(`${top + 30}px`);
    } finally {
      el.remove();
    }
  });

  it('falls back to the middle of the screen for an element that is not on it', () => {
    // A hidden or scrolled-away card would otherwise throw its rings at a
    // corner the player is not looking at.
    const el = document.createElement('div');
    document.body.appendChild(el);
    try {
      svc.celebrate('rare', el);
      const x = (layer() as HTMLElement).style.getPropertyValue('--fx-x');
      expect(x).toBe(`${window.innerWidth / 2}px`);
    } finally {
      el.remove();
    }
  });

  it('builds the tier colour into the layer once, not per node', () => {
    svc.celebrate('legendary');
    const el = layer() as HTMLElement;
    expect(el.style.getPropertyValue('--fx-color')).toBeTruthy();
    expect(el.style.getPropertyValue('--fx-glow')).toBeTruthy();
    // The children read it by inheritance, so none of them carries a colour.
    const speck = el.querySelector('.gf-fx__speck') as HTMLElement;
    expect(speck.style.getPropertyValue('--fx-color')).toBe('');
  });

  it('builds every channel the tier asks for', () => {
    svc.celebrate('singular');
    const el = layer()!;
    expect(el.querySelector('.gf-fx__dark')).withContext('blackout').not.toBeNull();
    expect(el.querySelector('.gf-fx__flash')).withContext('flash').not.toBeNull();
    expect(el.querySelector('.gf-fx__ring')).withContext('wave').not.toBeNull();
    expect(el.querySelector('.gf-fx__beam')).withContext('beams').not.toBeNull();
    expect(el.querySelector('.gf-fx__speck')).withContext('particles').not.toBeNull();
    expect(el.querySelector('.gf-fx__mote')).withContext('shower').not.toBeNull();
    expect(el.querySelector('.gf-fx__fissure')).withContext('crack').not.toBeNull();
    expect(el.querySelector('.gf-fx__pour')).withContext('pour').not.toBeNull();
  });

  it('builds nothing a Rare did not ask for', () => {
    svc.celebrate('rare');
    const el = layer()!;
    expect(el.querySelector('.gf-fx__dark')).toBeNull();
    expect(el.querySelector('.gf-fx__mote')).toBeNull();
    expect(el.querySelector('.gf-fx__bolt')).toBeNull();
    expect(el.querySelector('.gf-fx__fissure')).toBeNull();
  });

  it('draws a bolt that actually reaches the card', () => {
    // The jitter tapers to nothing at the target, so the last point of every
    // bolt is the origin the effect was given. A bolt that lands near the card
    // reads as a bug, not as weather.
    svc.celebrate('legendary');
    const bolt = layer()!.querySelector('.gf-fx__bolt');
    if (!bolt) {
      // Absence is allowed for exactly one reason — scaleFx cuts lightning
      // below 768px, and Karma's runner iframe is often narrower than that.
      // Asserted rather than silently returned, so a bolt that goes missing on
      // a wide viewport still fails the spec.
      expect(window.innerWidth).toBeLessThan(768);
      return;
    }
    const points = bolt.getAttribute('d')!.trim().split(/[ML]\s*/).filter(Boolean);
    const [x, y] = points[points.length - 1].trim().split(/\s+/).map(Number);
    expect(x).toBeCloseTo(window.innerWidth / 2, 0);
    expect(y).toBeCloseTo(window.innerHeight / 2, 0);
  });

  it('does not take the drop down with it when an effect throws', () => {
    // The rune is already banked and the card is already on screen by the time
    // any of this runs; a broken celebration must be invisible, not fatal.
    const boom = spyOn(document, 'createElement').and.callFake(((tag: string) => {
      if (tag === 'span') throw new Error('boom');
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    }) as typeof document.createElement);

    expect(() => svc.celebrate('rare')).not.toThrow();
    boom.and.callThrough();
    // And it cleaned up rather than leaving half a layer pinned over the page.
    expect(layer()).toBeNull();
  });
});
