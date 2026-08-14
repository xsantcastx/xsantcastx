/**
 * codex.model.spec.ts — the drift guards.
 *
 * These do not test rendering. They test the four ways the Codex can quietly
 * start lying as the registries around it change: an egg renamed out from under
 * its hint, an Arena gate renamed out from under its category, a category that
 * fails to partition, and a locked card that leaks its own answer.
 *
 * All four failures are silent in the browser — the page renders, it is just
 * wrong — which is exactly the kind of failure worth a test.
 */
import { EASTER_EGGS, PUBLIC_CODEX_EGGS } from '../shared/easter-eggs/easter-egg.service';
import { EGG_HINTS, orphanedHintIds, unhintedEggIds } from './codex-hints';
import {
  ARENA_GATE_EGGS,
  CODEX_CATEGORIES,
  buildAchievements,
  categoryForEgg,
} from './codex.model';
import { SECRETS } from './codex-secrets';

describe('Codex data integrity', () => {
  it('has a hand-authored hint for every registered egg', () => {
    // The generic fallback exists so a missing hint cannot crash a card, not so
    // that missing hints can accumulate.
    expect(unhintedEggIds()).toEqual([]);
  });

  it('has no hint pointing at an egg that no longer exists', () => {
    expect(orphanedHintIds()).toEqual([]);
  });

  it('never shows the answer on a locked card', () => {
    // A hint that contains the description is the description. The whole design
    // of the wall rests on these two strings being different.
    for (const egg of EASTER_EGGS) {
      const hint = EGG_HINTS[egg.id];
      if (!hint) continue;
      expect(hint.toLowerCase()).not.toContain(egg.description.toLowerCase());
    }
  });

  it('assigns every egg to exactly one category', () => {
    const known = new Set(CODEX_CATEGORIES.map(c => c.id));
    const counts = new Map<string, number>();

    for (const egg of EASTER_EGGS) {
      const id = categoryForEgg(egg);
      expect(known.has(id)).toBe(true);
      counts.set(egg.id, (counts.get(egg.id) ?? 0) + 1);
    }

    // Section totals must sum to the public wall, or the filter chips lie.
    const wall = buildAchievements();
    const summed = CODEX_CATEGORIES
      .map(c => wall.filter(a => a.category.id === c.id).length)
      .reduce((a, b) => a + b, 0);
    expect(summed).toBe(PUBLIC_CODEX_EGGS.length);
    expect(wall.length).toBe(PUBLIC_CODEX_EGGS.length);
  });

  it('does not render a legacy tool egg even when that egg is unlocked', () => {
    const legacy = EASTER_EGGS.find(e => e.id === 'json-inception');
    expect(legacy).toBeTruthy();
    expect(legacy!.tool).toBe('json-formatter');

    const wall = buildAchievements();
    const card = wall.find(a => a.id === 'json-inception');
    expect(card).toBeUndefined();

    const copy = wall.map(a => `${a.name}\n${a.description}\n${a.hint}`).join('\n');
    expect(copy).not.toMatch(/Formatted JSON nested 10\+ levels deep/i);
    expect(copy).not.toMatch(/Encoded .+ in Base64/i);
    expect(copy).not.toMatch(/Wrote a regex/i);
    expect(copy).not.toMatch(/Created a box shadow/i);
  });

  it('maps every Arena gate egg to an egg that exists', () => {
    const live = new Set(EASTER_EGGS.map(e => e.id));
    for (const id of Object.keys(ARENA_GATE_EGGS)) {
      expect(live.has(id)).toBe(true);
    }
  });

  it('gives every secret a way to actually be discovered', () => {
    // A secret with no eggId, no detector and no route can never flip to found.
    // It would sit on the page as a permanent tease that is not tracking
    // anything — the one thing the Secrets tab promises it does not do.
    for (const secret of SECRETS) {
      expect(!!(secret.eggId || secret.detector || secret.route))
        .withContext(`secret "${secret.id}" is untrackable`)
        .toBe(true);
    }
  });

  it('points every egg-backed secret at a registered egg', () => {
    const live = new Set(EASTER_EGGS.map(e => e.id));
    for (const secret of SECRETS) {
      if (!secret.eggId) continue;
      expect(live.has(secret.eggId))
        .withContext(`secret "${secret.id}" points at missing egg "${secret.eggId}"`)
        .toBe(true);
    }
  });
});
