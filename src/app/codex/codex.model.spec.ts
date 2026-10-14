/**
 * codex.model.spec.ts — the drift guards.
 *
 * These do not test rendering. They test the ways the Codex can quietly start
 * lying as the registries around it change: an egg renamed out from under its
 * hint, a wall that drops or doubles an egg, a locked card that leaks its own
 * answer, and a secret that can never be found.
 *
 * All of these failures are silent in the browser — the page renders, it is just
 * wrong — which is exactly the kind of failure worth a test.
 */
import { EASTER_EGGS, PUBLIC_CODEX_EGGS } from '../shared/easter-eggs/easter-egg.service';
import { EGG_HINTS, orphanedHintIds, unhintedEggIds } from './codex-hints';
import { buildAchievements } from './codex.model';
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

  it('puts every public egg on the wall exactly once', () => {
    const wall = buildAchievements().map(a => a.id);
    expect(new Set(wall).size).toBe(wall.length);
    expect([...wall].sort()).toEqual(PUBLIC_CODEX_EGGS.map(e => e.id).sort());
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
