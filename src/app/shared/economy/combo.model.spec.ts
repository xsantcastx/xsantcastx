/**
 * combo.model.spec.ts — the ladder's shape.
 *
 * The table is the whole feature: it decides what is shouted, what is heard,
 * what is painted and what is awarded. A rung in the wrong order or an
 * achievement id that does not exist in the egg registry both fail silently —
 * the first as an escalation that goes backwards, the second as a tier that
 * quietly pays nothing — so both are pinned here rather than found by clicking
 * a thousand times.
 */

import { EASTER_EGGS } from '../easter-eggs/easter-egg.service';
import { EGG_HINTS } from '../../codex/codex-hints';
import { tierForEgg } from '../rarity/rarity.model';
import { STRIKE_COOLDOWN_MS } from '../idle/idle.model';
import {
  COMBO_RESET_MS,
  COMBO_TIERS,
  MAX_COMBO,
  NAMELESS_AT,
  NAMELESS_EGG,
  comboEggIds,
  minutesToReach,
  nextTier,
  pitchFor,
  tierCrossedAt,
  tierFor,
} from './combo.model';

describe('the combo ladder', () => {
  it('climbs — every rung is higher and louder than the one below it', () => {
    for (let i = 1; i < COMBO_TIERS.length; i++) {
      expect(COMBO_TIERS[i].at).toBeGreaterThan(COMBO_TIERS[i - 1].at);
      expect(COMBO_TIERS[i].semitones).toBeGreaterThanOrEqual(COMBO_TIERS[i - 1].semitones);
    }
  });

  it('tops out at the display cap', () => {
    expect(COMBO_TIERS[COMBO_TIERS.length - 1].at).toBe(MAX_COMBO);
  });

  it('leaves the ordinary strike alone below the first rung', () => {
    // If a click at x3 already sounded different, there would be nothing for
    // the ladder to climb away from.
    expect(pitchFor(0)).toBe(0);
    expect(pitchFor(9)).toBe(0);
    expect(pitchFor(10)).toBeGreaterThan(0);
  });
});

describe('tierFor — the rung being stood in', () => {
  it('holds the last rung passed, not the next one', () => {
    expect(tierFor(9)).toBeNull();
    expect(tierFor(10)!.at).toBe(10);
    expect(tierFor(37)!.at).toBe(25);
    expect(tierFor(99)!.at).toBe(50);
    expect(tierFor(4_999)!.at).toBe(1_000);
    expect(tierFor(MAX_COMBO)!.at).toBe(MAX_COMBO);
  });

  it('keeps climbing through 666 rather than dropping to it', () => {
    // The Nameless is passed through, not stood in — the counter should still
    // be wearing the x500 rung's colour on either side of it.
    expect(tierFor(NAMELESS_AT)!.at).toBe(500);
    expect(tierFor(NAMELESS_AT - 1)!.at).toBe(500);
    expect(tierFor(NAMELESS_AT + 1)!.at).toBe(500);
  });
});

describe('tierCrossedAt — the one-shot', () => {
  it('fires only on the exact count', () => {
    expect(tierCrossedAt(100)!.label).toBe('CENTURY FORGE!');
    expect(tierCrossedAt(101)).toBeNull();
    expect(tierCrossedAt(99)).toBeNull();
  });

  it('never fires for the Nameless, which is not a rung', () => {
    expect(tierCrossedAt(NAMELESS_AT)).toBeNull();
  });

  it('fires exactly once per rung across a full run to the cap', () => {
    const fired = new Set<number>();
    for (let n = 1; n <= MAX_COMBO; n++) {
      const t = tierCrossedAt(n);
      if (t) {
        expect(fired.has(t.at)).toBe(false);
        fired.add(t.at);
      }
    }
    expect(fired.size).toBe(COMBO_TIERS.length);
  });
});

describe('nextTier', () => {
  it('points at the rung being climbed toward', () => {
    expect(nextTier(0)!.at).toBe(10);
    expect(nextTier(10)!.at).toBe(25);
    expect(nextTier(700)!.at).toBe(1_000);
  });

  it('is null once the ladder is topped out', () => {
    expect(nextTier(MAX_COMBO)).toBeNull();
  });
});

describe('the achievements', () => {
  const eggIds = new Set(EASTER_EGGS.map(e => e.id));

  it('every ladder achievement exists in the egg registry', () => {
    // A tier pointing at an id the registry does not know is a silent no-op:
    // `trigger()` looks it up, finds nothing and returns, so the rung pays
    // nothing and says nothing. This is the check that catches it.
    for (const id of comboEggIds()) {
      expect(eggIds.has(id)).withContext(id).toBe(true);
    }
  });

  it('every ladder achievement has a codex hint', () => {
    for (const id of comboEggIds()) {
      expect(EGG_HINTS[id]).withContext(id).toBeTruthy();
    }
  });

  it('gets rarer as the ladder climbs', () => {
    const order = ['mortal', 'eclipsed', 'sacred', 'anomalous', 'mythic', 'singular'];
    const rungs = COMBO_TIERS.filter(t => t.egg);

    for (let i = 1; i < rungs.length; i++) {
      const prev = order.indexOf(tierForEgg(rungs[i - 1].egg!));
      const here = order.indexOf(tierForEgg(rungs[i].egg!));
      expect(here).withContext(`${rungs[i].egg} vs ${rungs[i - 1].egg}`).toBeGreaterThanOrEqual(prev);
    }
  });

  it('tops the ladder out at Mythic', () => {
    expect(tierForEgg('combo-first-sun')).toBe('mythic');
    expect(tierForEgg('combo-eclipse-breaker')).toBe('mythic');
  });

  it('files the Nameless as Anomalous', () => {
    expect(tierForEgg(NAMELESS_EGG)).toBe('anomalous');
  });
});

describe('the difficulty claim', () => {
  it('puts the top of the ladder at about 83 minutes of unbroken rhythm', () => {
    // Derived from the cooldown rather than written down, so the claim in the
    // release notes stays true if the cooldown is ever retuned.
    const minutes = minutesToReach(MAX_COMBO, STRIKE_COOLDOWN_MS);
    expect(Math.round(minutes)).toBe(83);
  });

  it('leaves real slack between strikes before the run breaks', () => {
    // The window has to be comfortably longer than the cooldown or the ladder
    // would be unholdable by a human rather than merely hard.
    expect(COMBO_RESET_MS).toBeGreaterThan(STRIKE_COOLDOWN_MS * 2);
  });
});
