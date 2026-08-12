/**
 * cloud-save.model.spec.ts — the reconciliation contract.
 *
 * `mergeDeep` decides what happens to somebody's save when two devices disagree,
 * and it does it without knowing what any of the six blobs it handles actually
 * are. That combination is worth pinning down: a structural rule that is subtly
 * wrong does not throw, it just quietly picks the smaller number, and the first
 * anyone hears about it is a visitor saying their artifacts are gone.
 *
 * The cases below are written against the real shapes from economy.model.ts,
 * quest.service.ts, lore.service.ts, idle.service.ts and the egg registry rather
 * than against invented ones, because the whole claim being tested is that the
 * generic rules are right for those specific blobs.
 */

import { SYNCED_BLOBS, mergeDeep, unwrapBlob, wrapBlob } from './cloud-save.model';

describe('mergeDeep', () => {
  describe('the core rules', () => {
    it('takes the larger number', () => {
      expect(mergeDeep({ gold: 900 }, { gold: 120 })).toEqual({ gold: 900 });
      expect(mergeDeep({ gold: 120 }, { gold: 900 })).toEqual({ gold: 900 });
    });

    it('unions arrays of ids', () => {
      const merged = mergeDeep(['a', 'b'], ['b', 'c']) as string[];
      expect(merged.length).toBe(3);
      expect(new Set(merged)).toEqual(new Set(['a', 'b', 'c']));
    });

    it('takes the union of both key sets', () => {
      expect(mergeDeep({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
    });

    it('takes the later of two ISO instants', () => {
      const older = '2026-08-01T10:00:00.000Z';
      const newer = '2026-08-09T10:00:00.000Z';
      expect(mergeDeep({ at: older }, { at: newer })).toEqual({ at: newer });
      expect(mergeDeep({ at: newer }, { at: older })).toEqual({ at: newer });
    });

    it('keeps a flag that either side has set', () => {
      expect(mergeDeep({ seen: true }, { seen: false })).toEqual({ seen: true });
      expect(mergeDeep({ seen: false }, { seen: true })).toEqual({ seen: true });
    });

    it('survives a null on either side', () => {
      expect(mergeDeep(null, { gold: 5 })).toEqual({ gold: 5 });
      expect(mergeDeep({ gold: 5 }, null)).toEqual({ gold: 5 });
      expect(mergeDeep(null, null)).toBeNull();
    });

    it('does not let a corrupted number poison the field', () => {
      expect(mergeDeep({ gold: NaN }, { gold: 40 })).toEqual({ gold: 40 });
      expect(mergeDeep({ gold: 40 }, { gold: Infinity })).toEqual({ gold: 40 });
    });

    it('keeps the local value when the two sides disagree about the type', () => {
      // A shape change between client versions. The running client is the one
      // that can read its own copy.
      expect(mergeDeep({ x: 'a string' }, { x: 7 })).toEqual({ x: 7 });
    });
  });

  describe('is commutative', () => {
    // The property the whole feature rests on: it must not matter which device
    // the visitor happens to sign in on first.
    const phone = {
      gold: 40, totalClicks: 900,
      upgrades: { 'iron-hammer': 3 },
      artifacts: ['obsidian-heart'],
      enchantments: [{ id: 'seekers-lens', expiresAt: 5_000 }],
    };
    const desktop = {
      gold: 1200, totalClicks: 120,
      upgrades: { 'iron-hammer': 1, 'ember-stoker': 4 },
      artifacts: ['mirrorblade-kael'],
      enchantments: [{ id: 'seekers-lens', expiresAt: 9_000 }],
    };

    it('reaches the same result from either direction', () => {
      const a = mergeDeep(phone, desktop) as Record<string, unknown>;
      const b = mergeDeep(desktop, phone) as Record<string, unknown>;

      expect(a['gold']).toBe(1200);
      expect(a['totalClicks']).toBe(900);
      expect(a['upgrades']).toEqual({ 'iron-hammer': 3, 'ember-stoker': 4 });
      expect(new Set(a['artifacts'] as string[]))
        .toEqual(new Set(['obsidian-heart', 'mirrorblade-kael']));

      // Same values, and the id sets match regardless of order.
      expect(b['gold']).toBe(a['gold']);
      expect(b['totalClicks']).toBe(a['totalClicks']);
      expect(b['upgrades']).toEqual(a['upgrades']);
      expect(new Set(b['artifacts'] as string[])).toEqual(new Set(a['artifacts'] as string[]));
    });
  });

  describe('the Godforge ledger', () => {
    it('keeps an upgrade bought on either device, at the higher level', () => {
      const merged = mergeDeep(
        { upgrades: { 'forge-bellows': 6, 'eclipse-core': 1 } },
        { upgrades: { 'forge-bellows': 2, 'nox-crusher': 3 } },
      ) as { upgrades: Record<string, number> };

      expect(merged.upgrades).toEqual({
        'forge-bellows': 6,
        'eclipse-core': 1,
        'nox-crusher': 3,
      });
    });

    it('never drops an artifact, whichever device bought it', () => {
      const merged = mergeDeep(
        { artifacts: ['obsidian-heart', 'codex-solarii'] },
        { artifacts: ['mirrorblade-kael'] },
      ) as { artifacts: string[] };

      expect(new Set(merged.artifacts)).toEqual(
        new Set(['obsidian-heart', 'codex-solarii', 'mirrorblade-kael']),
      );
    });

    it('collapses one enchantment running on two devices into one timer', () => {
      // Keyed on id alone: two entries would be two timers for one purchase.
      const merged = mergeDeep(
        { enchantments: [{ id: 'eclipse-aura', expiresAt: 1_000 }] },
        { enchantments: [{ id: 'eclipse-aura', expiresAt: 8_000 }] },
      ) as { enchantments: Array<{ id: string; expiresAt: number }> };

      expect(merged.enchantments.length).toBe(1);
      expect(merged.enchantments[0].expiresAt).toBe(8_000);
    });

    it('does not rewind the idle settlement clock', () => {
      // Taking the earlier stamp would pay the elapsed time out a second time.
      expect(mergeDeep({ lastIdleAt: 9_000 }, { lastIdleAt: 3_000 }))
        .toEqual({ lastIdleAt: 9_000 });
    });
  });

  describe('the quest log', () => {
    it('keeps the same daily cleared on two different days as two entries', () => {
      // Keyed on id *and* `at`, because clearing a daily on Monday and again on
      // Tuesday is genuinely two completions.
      const monday = { id: 'use-three-tools', title: 'Three Tools', type: 'daily', xp: 20, at: '2026-08-10T09:00:00.000Z' };
      const tuesday = { id: 'use-three-tools', title: 'Three Tools', type: 'daily', xp: 20, at: '2026-08-11T09:00:00.000Z' };

      const merged = mergeDeep({ log: [monday] }, { log: [tuesday] }) as { log: unknown[] };
      expect(merged.log.length).toBe(2);
    });

    it('does not duplicate a receipt both devices already hold', () => {
      const entry = { id: 'weekly-forge', title: 'Forge', type: 'weekly', xp: 120, at: '2026-08-10T09:00:00.000Z' };
      const merged = mergeDeep({ log: [entry] }, { log: [entry] }) as { log: unknown[] };
      expect(merged.log.length).toBe(1);
    });

    it('unions period-keyed claim receipts and takes the higher tallies', () => {
      const merged = mergeDeep(
        { claimed: ['a@2026-08-10'], life: { toolsUsed: 40 }, totalCompleted: 12 },
        { claimed: ['a@2026-08-11'], life: { toolsUsed: 12 }, totalCompleted: 9 },
      ) as { claimed: string[]; life: Record<string, number>; totalCompleted: number };

      expect(new Set(merged.claimed)).toEqual(new Set(['a@2026-08-10', 'a@2026-08-11']));
      expect(merged.life['toolsUsed']).toBe(40);
      expect(merged.totalCompleted).toBe(12);
    });
  });

  describe('lore, mastery and discoveries', () => {
    it('takes the higher use count per tool', () => {
      const merged = mergeDeep(
        { uses: { 'regex-builder': 30, 'json-formatter': 2 } },
        { uses: { 'regex-builder': 4, 'hash-generator': 11 } },
      ) as { uses: Record<string, number> };

      expect(merged.uses).toEqual({
        'regex-builder': 30,
        'json-formatter': 2,
        'hash-generator': 11,
      });
    });

    it('unions a bare top-level array, which is what the egg blob is', () => {
      // `easter-eggs-found` is a JSON array at the root, not an object.
      const merged = mergeDeep(['konami', 'night-owl'], ['night-owl', 'hash-miner']) as string[];
      expect(new Set(merged)).toEqual(new Set(['konami', 'night-owl', 'hash-miner']));
    });

    it('announces a lore chapter only once across both devices', () => {
      const merged = mergeDeep(
        { announced: ['ch-1', 'ch-2'] },
        { announced: ['ch-2'] },
      ) as { announced: string[] };
      expect(merged.announced.length).toBe(2);
    });
  });
});

describe('the discovery-date ledger', () => {
  // The one blob where the larger value is the wrong answer.
  const dates = SYNCED_BLOBS.find(b => b.key === 'easter-eggs-dates');

  it('is registered with its own merge', () => {
    expect(dates).toBeDefined();
    expect(dates!.merge).toBeDefined();
  });

  it('keeps the first time an egg was found, not the most recent', () => {
    const first = '2026-01-04T08:00:00.000Z';
    const again = '2026-08-11T22:00:00.000Z';

    const merged = dates!.merge!({ konami: again }, { konami: first }) as Record<string, string>;
    expect(merged['konami']).toBe(first);

    // And from the other direction, because this runs on both devices.
    const flipped = dates!.merge!({ konami: first }, { konami: again }) as Record<string, string>;
    expect(flipped['konami']).toBe(first);
  });

  it('carries across a date only one device has', () => {
    const merged = dates!.merge!(
      { konami: '2026-01-04T08:00:00.000Z' },
      { 'hash-miner': '2026-05-02T08:00:00.000Z' },
    ) as Record<string, string>;

    expect(Object.keys(merged).sort()).toEqual(['hash-miner', 'konami']);
  });
});

describe('the arena', () => {
  it('takes the better run, the higher play count, and any clear', () => {
    // Structural rules, no override — the shape happens to line up exactly.
    const merged = mergeDeep(
      { version: 1, games: { 'realm-rush': { best: 9100, plays: 3, cleared: false } } },
      { version: 1, games: { 'realm-rush': { best: 400, plays: 12, cleared: true } } },
    ) as { games: Record<string, { best: number; plays: number; cleared: boolean }> };

    expect(merged.games['realm-rush'].best).toBe(9100);
    expect(merged.games['realm-rush'].plays).toBe(12);
    expect(merged.games['realm-rush'].cleared).toBe(true);
  });

  describe('the Realm Rush board', () => {
    const board = SYNCED_BLOBS.find(b => b.key === 'eclipse-realm-rush-board');
    const run = (score: number) => ({ score, wpm: 60, accuracy: 95, words: 15 });

    it('stays five entries long after merging two full boards', () => {
      const remote = [run(900), run(800), run(700), run(600), run(500)];
      const local = [run(950), run(850), run(750), run(650), run(550)];

      const merged = board!.merge!(remote, local) as Array<{ score: number }>;
      expect(merged.length).toBe(5);
      expect(merged.map(r => r.score)).toEqual([950, 900, 850, 800, 750]);
    });

    it('does not count a run both devices already have twice', () => {
      const shared = run(900);
      const merged = board!.merge!([shared], [shared]) as unknown[];
      expect(merged.length).toBe(1);
    });
  });
});

describe('the trophy case', () => {
  const pinned = SYNCED_BLOBS.find(b => b.key === 'godforge-pinned');

  it('keeps this device\'s five pins rather than unioning to ten', () => {
    const mine = ['a', 'b', 'c', 'd', 'e'];
    const theirs = ['v', 'w', 'x', 'y', 'z'];
    expect(pinned!.merge!(theirs, mine)).toEqual(mine);
  });

  it('inherits the other device\'s case when this one was never customised', () => {
    // null means "never touched", which the owning service keeps distinct from
    // an empty array — so an untouched device should adopt, not blank.
    expect(pinned!.merge!(['a', 'b'], null)).toEqual(['a', 'b']);
  });

  it('respects a deliberately empty case over the other device\'s pins', () => {
    expect(pinned!.merge!(['a', 'b'], [])).toEqual([]);
  });
});

describe('the registry', () => {
  it('files every blob under a unique document path', () => {
    const paths = SYNCED_BLOBS.map(b => `${b.collection}/${b.doc}`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('reads back exactly what it wrapped', () => {
    // Including the bare array, which is the reason the envelope exists at all:
    // a Firestore document cannot hold an array at its root.
    for (const payload of [['konami'], { gold: 12 }, 0, null]) {
      expect(unwrapBlob(wrapBlob(payload))).toEqual(payload as never);
    }
  });

  it('reads a document written before the envelope existed', () => {
    expect(unwrapBlob({ gold: 12 })).toEqual({ gold: 12 });
  });
});
