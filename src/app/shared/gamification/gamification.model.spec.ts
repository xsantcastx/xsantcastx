/**
 * gamification.model.spec.ts — the migration and merge contract.
 *
 * These three functions are the ones that can silently destroy a visitor's
 * progression, and they are the hardest to notice going wrong: a migration that
 * drops a streak looks exactly like a visitor who stopped coming back, and a
 * merge that picks the wrong side looks like a sync bug months later. They are
 * also pure, so they are cheap to pin down here rather than by clicking.
 */

import {
  PROGRESS_VERSION,
  ProgressState,
  emptyProgress,
  levelForXp,
  mergeProgress,
  migrateProgress,
  withLevel,
} from './gamification.model';

/** A realistic v1 blob — the shape every visitor from before v2 already has. */
function v1Blob() {
  return {
    version: 1,
    xp: 1740,
    aether: 1200,
    nox: 540,
    streak: 6,
    lastVisit: '2026-08-11',
    bestStreak: 9,
    toolsUsed: ['box-shadow-generator', 'json-formatter'],
    achievements: ['codex-archivist', 'arena-clear-shadow-puzzle'],
    history: { '2026-08-10': 400, '2026-08-11': 260 },
  };
}

describe('migrateProgress', () => {
  it('carries every v1 field across without loss', () => {
    const migrated = migrateProgress(v1Blob());

    expect(migrated.version).toBe(PROGRESS_VERSION);
    expect(migrated.xp).toBe(1740);
    expect(migrated.aether).toBe(1200);
    expect(migrated.nox).toBe(540);
    expect(migrated.streak).toBe(6);
    expect(migrated.bestStreak).toBe(9);
    expect(migrated.lastVisit).toBe('2026-08-11');
    expect(migrated.toolsUsed).toEqual(['box-shadow-generator', 'json-formatter']);
    expect(migrated.history).toEqual({ '2026-08-10': 400, '2026-08-11': 260 });
  });

  it('promotes bare achievement ids to records', () => {
    const migrated = migrateProgress(v1Blob());

    expect(migrated.achievements.map(a => a.id))
      .toEqual(['codex-archivist', 'arena-clear-shadow-puzzle']);
    // v1 recorded no unlock time, so every legacy trophy is stamped with the
    // earliest moment we can honestly claim rather than "just now".
    migrated.achievements.forEach(a => expect(a.unlockedAt).toBe(migrated.createdAt));
  });

  it('mints an identity and denormalises the rank', () => {
    const migrated = migrateProgress(v1Blob());

    expect(migrated.userId).toBeTruthy();
    expect(migrated.level).toBe(levelForXp(1740).level);
    expect(migrated.levelTitle).toBe(levelForXp(1740).title);
    expect(migrated.createdAt).toBeTruthy();
    expect(migrated.updatedAt).toBeTruthy();
  });

  it('survives junk instead of throwing', () => {
    // A hand-edited or truncated blob must degrade to a usable level-1 state,
    // never take the page down with it.
    expect(migrateProgress(null).xp).toBe(0);
    expect(migrateProgress('not an object').xp).toBe(0);
    expect(migrateProgress({ version: 2, xp: 'abc', achievements: 'nope' }).xp).toBe(0);
    expect(migrateProgress({ version: 2, achievements: [{ nope: true }] }).achievements).toEqual([]);
  });

  it('hydrates a v2 blob that predates a newly added field', () => {
    const partial = { ...emptyProgress(), xp: 500 } as Partial<ProgressState>;
    delete (partial as Record<string, unknown>)['toolsUsed'];

    const migrated = migrateProgress(partial);

    expect(migrated.toolsUsed).toEqual([]);
    expect(migrated.xp).toBe(500);
  });

  it('keeps the stored identity on a v2 blob rather than reminting it', () => {
    const existing = { ...emptyProgress(), userId: 'stable-id', xp: 120 };
    expect(migrateProgress(existing).userId).toBe('stable-id');
  });
});

describe('withLevel', () => {
  it('keeps the denormalised rank in step with xp', () => {
    const state = { ...emptyProgress(), xp: 2600 };
    const ranked = withLevel(state);

    expect(ranked.level).toBe(levelForXp(2600).level);
    expect(ranked.levelTitle).toBe(levelForXp(2600).title);
  });

  it('returns the same object when nothing changed', () => {
    const state = withLevel({ ...emptyProgress(), xp: 0 });
    expect(withLevel(state)).toBe(state);
  });
});

describe('mergeProgress', () => {
  function device(overrides: Partial<ProgressState>): ProgressState {
    return withLevel({ ...emptyProgress(), ...overrides });
  }

  it('takes the max of every counter rather than the sum', () => {
    // Summing would double a visitor's total the first time they signed in on a
    // second device — the failure mode is silent and generous, which is worse
    // than the honest one.
    const laptop = device({ xp: 1000, aether: 700, nox: 300, bestStreak: 9, streak: 4 });
    const phone = device({ xp: 400, aether: 400, nox: 0, bestStreak: 3, streak: 6 });

    const merged = mergeProgress(laptop, phone);

    expect(merged.xp).toBe(1000);
    expect(merged.aether).toBe(700);
    expect(merged.bestStreak).toBe(9);
    expect(merged.streak).toBe(6);
  });

  it('unions tools and achievements', () => {
    const laptop = device({
      xp: 1000,
      toolsUsed: ['a', 'b'],
      achievements: [{ id: 'one', unlockedAt: '2026-01-01T00:00:00.000Z' }],
    });
    const phone = device({
      xp: 400,
      toolsUsed: ['b', 'c'],
      achievements: [{ id: 'two', unlockedAt: '2026-02-01T00:00:00.000Z' }],
    });

    const merged = mergeProgress(laptop, phone);

    expect([...merged.toolsUsed].sort()).toEqual(['a', 'b', 'c']);
    expect(merged.achievements.map(a => a.id).sort()).toEqual(['one', 'two']);
  });

  it('is commutative, so there is no wrong device to sign in from', () => {
    const laptop = device({ xp: 1000, toolsUsed: ['a'], history: { '2026-08-01': 300 } });
    const phone = device({ xp: 400, toolsUsed: ['b'], history: { '2026-08-01': 100, '2026-08-02': 50 } });

    const ab = mergeProgress(laptop, phone);
    const ba = mergeProgress(phone, laptop);

    expect(ab.xp).toBe(ba.xp);
    expect([...ab.toolsUsed].sort()).toEqual([...ba.toolsUsed].sort());
    expect(ab.history).toEqual(ba.history);
    expect(ab.createdAt).toBe(ba.createdAt);
  });

  it('keeps the earliest createdAt and the busiest day per date', () => {
    const older = device({ xp: 100, createdAt: '2026-01-01T00:00:00.000Z', history: { '2026-08-01': 300 } });
    const newer = device({ xp: 900, createdAt: '2026-06-01T00:00:00.000Z', history: { '2026-08-01': 120 } });

    const merged = mergeProgress(older, newer);

    expect(merged.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(merged.history['2026-08-01']).toBe(300);
  });
});
