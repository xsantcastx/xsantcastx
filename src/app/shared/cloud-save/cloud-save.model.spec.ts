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

import {
  SYNCED_BLOBS,
  hasProgress,
  isConflict,
  mergeDeep,
  mergeEconomy,
  stripUndefined,
  summarise,
  unwrapBlob,
  wrapBlob,
} from './cloud-save.model';
import { coerceLedger } from '../economy/economy-ops';

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

/**
 * The RPG layer, which was device-local for five releases.
 *
 * Every blob below existed, was written on both devices, and was never in
 * SYNCED_BLOBS — so cloud save reported "Synced" while a visitor's bag, build,
 * roster and rune ledger diverged completely between their phone and their PC.
 * The registry test at the bottom of this file is the one that stops it
 * happening again; these pin down that each of them merges *correctly* now that
 * it does sync, because three of them are cases where the generous structural
 * default would have been actively wrong.
 */
describe('the RPG layer', () => {
  const blob = (key: string) => {
    const found = SYNCED_BLOBS.find(b => b.key === key);
    expect(found).withContext(`${key} is not registered for sync`).toBeDefined();
    return found!;
  };

  describe('the bag', () => {
    const merge = (r: unknown, l: unknown) => blob('godforge-inventory').merge!(r, l) as {
      version: 2;
      records: { id: string; location?: { kind: string; slotId?: string } }[];
      goldFromSales: number;
    };

    const item = (id: string, extra: Record<string, unknown> = {}) => ({
      id, name: id, type: 'charm', rarity: 'common', stats: {},
      sellValue: 10, equipped: false, foundAt: '2026-08-01T00:00:00.000Z',
      soulbound: false, ...extra,
    });

    it('keeps items found on either device', () => {
      const merged = merge(
        { version: 1, items: [item('a'), item('b')], goldFromSales: 0, sold: 0 },
        { version: 1, items: [item('b'), item('c')], goldFromSales: 0, sold: 0 },
      );
      expect(merged.version).toBe(2);
      expect(merged.records.map(i => i.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('takes one complete location by revision, never field by field', () => {
      const worn = {
        version: 2,
        records: [{
          id: 'a', definitionId: 'charm:a', kind: 'instance', category: 'equipment',
          tags: ['charm'], soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z',
          revision: { hlc: 20, deviceId: 'phone', sequence: 1 }, source: 'inventory',
          name: 'a', type: 'charm', stats: {}, sellValue: 10,
          location: { kind: 'equipped', slotId: 'head' },
        }],
        tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 20, legacyBackup: null,
      };
      const bagged = {
        ...worn,
        records: [{
          ...worn.records[0],
          revision: { hlc: 10, deviceId: 'tablet', sequence: 1 },
          location: { kind: 'bag' },
        }],
        hlc: 10,
      };
      const ab = merge(worn, bagged);
      const ba = merge(bagged, worn);
      expect(ab.records.length).toBe(1);
      expect(ab.records[0].location).toEqual({ kind: 'equipped', slotId: 'head' });
      expect(ba.records[0].location).toEqual(ab.records[0].location);
    });

    it('takes the higher lifetime till', () => {
      const merged = merge(
        { version: 1, items: [], goldFromSales: 900, sold: 4 },
        { version: 1, items: [], goldFromSales: 120, sold: 1 },
      );
      expect(merged.goldFromSales).toBe(900);
    });

    it('stays inside the bag cap, and never drops what is worn', () => {
      const many = (prefix: string) => Array.from({ length: 200 }, (_, i) =>
        item(`${prefix}${i}`, { sellValue: i }));
      const merged = merge(
        { version: 1, items: many('r'), goldFromSales: 0, sold: 0 },
        { version: 1, items: [...many('l'), item('worn', { equipped: true, slot: 'head', sellValue: 0 })], goldFromSales: 0, sold: 0 },
      );
      expect(merged.records.length).toBe(250);
      expect(merged.records.some(i => i.id === 'worn')).toBe(true);
    });
  });

  describe('the character sheet', () => {
    const merge = (r: unknown, l: unknown) => blob('godforge-stats').merge!(r, l) as {
      stats: Record<string, number>; levelsGranted: number; respecs: number;
    };

    it('adopts one build whole rather than maxing the five bars', () => {
      // Five earned points spent on Strength here and on Luck there would come
      // back as ten under the structural rules — a build nobody paid for.
      const merged = merge(
        { version: 1, stats: { strength: 5, luck: 0 }, levelsGranted: 6, respecs: 0 },
        { version: 1, stats: { strength: 0, luck: 5 }, levelsGranted: 6, respecs: 0 },
      );
      const spent = Object.values(merged.stats).reduce((a, b) => a + b, 0);
      expect(spent).toBe(5);
    });

    it('takes the build that has been played further', () => {
      const merged = merge(
        { version: 1, stats: { strength: 9 }, levelsGranted: 10, respecs: 0 },
        { version: 1, stats: { luck: 2 }, levelsGranted: 3, respecs: 0 },
      );
      expect(merged.stats).toEqual({ strength: 9 });
      expect(merged.levelsGranted).toBe(10);
    });

    it('keeps the device in hand on a tie, and the higher respec tally', () => {
      const merged = merge(
        { version: 1, stats: { strength: 3 }, levelsGranted: 4, respecs: 7 },
        { version: 1, stats: { luck: 3 }, levelsGranted: 4, respecs: 1 },
      );
      expect(merged.stats).toEqual({ luck: 3 });
      expect(merged.respecs).toBe(7);
    });

    it('does not restore a prior-era build over a wiped sheet', () => {
      const merged = merge(
        { version: 1, era: 0, stats: { strength: 40 }, levelsGranted: 20, respecs: 3 },
        { version: 1, era: 55, stats: { unallocated: 0 }, levelsGranted: 1, respecs: 0 },
      );
      expect(merged.levelsGranted).toBe(1);
      expect(merged.stats).toEqual({ unallocated: 0 });
    });
  });

  describe('the roster and its expeditions', () => {
    it('unions explorers and never re-mints the starter', () => {
      const merged = blob('godforge-roster').merge!(
        { version: 1, explorers: [{ id: 'x' }], seeded: true, found: 3 },
        { version: 1, explorers: [{ id: 'y' }], seeded: false, found: 1 },
      ) as { explorers: { id: string }[]; seeded: boolean; found: number };

      expect(merged.explorers.map(e => e.id).sort()).toEqual(['x', 'y']);
      expect(merged.seeded).toBe(true);
      expect(merged.found).toBe(3);
    });

    it('merges lifetime hauls but leaves missions in flight alone', () => {
      // An expedition is a wall-clock timer on the device that dispatched it.
      // Adopting the other device's would pay out a mission never sent.
      const merged = blob('godforge-explorers').merge!(
        { version: 1, active: [{ id: 'remote-run' }], itemsFound: 40, goldRecovered: 900 },
        { version: 1, active: [{ id: 'local-run' }], itemsFound: 12, goldRecovered: 100 },
      ) as { active: { id: string }[]; itemsFound: number; goldRecovered: number };

      expect(merged.active.map(e => e.id)).toEqual(['local-run']);
      expect(merged.itemsFound).toBe(40);
      expect(merged.goldRecovered).toBe(900);
    });
  });

  describe('runes and scrolls', () => {
    it('holds the most of each rune, and the earliest time it was pulled', () => {
      const merged = blob('godforge-runes').merge!(
        { version: 1, runes: { el: 3 }, firstFound: { el: '2026-08-09T00:00:00.000Z' }, strikes: 80, goldSpent: 400 },
        { version: 1, runes: { el: 1, tir: 2 }, firstFound: { el: '2026-08-01T00:00:00.000Z' }, strikes: 20, goldSpent: 100 },
      ) as { runes: Record<string, number>; firstFound: Record<string, string>; strikes: number };

      expect(merged.runes).toEqual({ el: 3, tir: 2 });
      expect(merged.firstFound['el']).toBe('2026-08-01T00:00:00.000Z');
      expect(merged.strikes).toBe(80);
    });

    it('unions scrolls found and read', () => {
      const merged = blob('godforge-scrolls').merge!(
        { version: 1, found: { s1: '2026-08-05T00:00:00.000Z' }, read: ['s1'] },
        { version: 1, found: { s2: '2026-08-02T00:00:00.000Z' }, read: ['s2'] },
      ) as { found: Record<string, string>; read: string[] };

      expect(Object.keys(merged.found).sort()).toEqual(['s1', 's2']);
      expect([...merged.read].sort()).toEqual(['s1', 's2']);
    });
  });

  it('carries a bought Pro pack to the visitor\'s other devices', () => {
    // The structural default is already right here — a flag that has been set
    // stays set — and `grantsSettled` riding the same rule is what stops the
    // adopting device minting the currency grant a second time.
    const merged = mergeDeep(
      { active: true, grantsSettled: true, orderId: 'o-1', activatedAt: '2026-08-01T00:00:00.000Z' },
      { active: false, grantsSettled: false, orderId: null, activatedAt: null },
    ) as { active: boolean; grantsSettled: boolean; orderId: string };

    expect(merged.active).toBe(true);
    expect(merged.grantsSettled).toBe(true);
    expect(merged.orderId).toBe('o-1');
  });
});

/**
 * The Thrall shift.
 *
 * Three of these are cases where the generous structural default is not merely
 * wrong but *exploitable*: a Thrall merged field by field is rested on the
 * device that has been working it and wearing both devices' gear at once.
 */
describe('Forge Thralls', () => {
  const merge = (r: unknown, l: unknown) => {
    const found = SYNCED_BLOBS.find(b => b.key === 'godforge-thralls');
    expect(found).withContext('godforge-thralls is not registered for sync').toBeDefined();
    return found!.merge!(r, l) as {
      thralls: { id: string; stamina: number; status: string; equipment: Record<string, string> }[];
      log: { id: string; at: number }[];
      rolls: number;
      goldSpent: number;
      finds: Record<string, number>;
      dayKey: string;
      foundToday: number;
    };
  };

  const thrall = (id: string, extra: Record<string, unknown> = {}) => ({
    id, name: id, rarity: 'common', level: 1, xp: 0,
    stamina: 100, maxStamina: 100, magicFind: 50, rollInterval: 30_000,
    equipment: {}, status: 'working', totalRolls: 0, totalFinds: {},
    hiredAt: '2026-08-01T00:00:00.000Z', lastRollAt: 0, lastRestAt: 0, ...extra,
  });

  const blob = (extra: Record<string, unknown> = {}) => ({
    version: 1, thralls: [], log: [], goldSpent: 0, rolls: 0,
    finds: {}, dayKey: '2026-08-19', foundToday: 0, ...extra,
  });

  it('adopts a Thrall bought on the other device', () => {
    const merged = merge(
      blob({ thralls: [thrall('a'), thrall('b')] }),
      blob({ thralls: [thrall('b')] }),
    );
    expect(merged.thralls.map(t => t.id).sort()).toEqual(['a', 'b']);
  });

  it('keeps the local copy of a Thrall both devices hold, whole', () => {
    // The exploit this stops: taking the higher stamina *and* the union of both
    // equipment wells hands back a fully rested worker wearing four items.
    const merged = merge(
      blob({ thralls: [thrall('a', { stamina: 100, equipment: { charm: 'remote-charm' } })] }),
      blob({ thralls: [thrall('a', { stamina: 4, status: 'resting', equipment: { charm: 'local-charm' } })] }),
    );
    expect(merged.thralls.length).toBe(1);
    expect(merged.thralls[0].stamina).toBe(4);
    expect(merged.thralls[0].status).toBe('resting');
    expect(merged.thralls[0].equipment).toEqual({ charm: 'local-charm' });
  });

  it('takes the larger lifetime tallies', () => {
    const merged = merge(
      blob({ rolls: 900, goldSpent: 9_000, finds: { common: 800, rare: 2 } }),
      blob({ rolls: 40, goldSpent: 400, finds: { common: 12, epic: 1 } }),
    );
    expect(merged.rolls).toBe(900);
    expect(merged.goldSpent).toBe(9_000);
    expect(merged.finds).toEqual({ common: 800, rare: 2, epic: 1 });
  });

  it('unions the log newest-first and dedupes it', () => {
    const merged = merge(
      blob({ log: [{ id: 'l2', at: 200 }, { id: 'l1', at: 100 }] }),
      blob({ log: [{ id: 'l3', at: 300 }, { id: 'l2', at: 200 }] }),
    );
    expect(merged.log.map(l => l.id)).toEqual(['l3', 'l2', 'l1']);
  });

  it('caps the log so the synced document cannot grow without bound', () => {
    const many = (prefix: string) =>
      Array.from({ length: 40 }, (_, i) => ({ id: `${prefix}-${i}`, at: i }));
    const merged = merge(blob({ log: many('r') }), blob({ log: many('l') }));
    expect(merged.log.length).toBe(40);
  });

  it('only merges today count when both devices agree what today is', () => {
    // Two timezones, or a device that has been shut since yesterday. Taking the
    // larger count against the local day credits yesterday's haul to today.
    const sameDay = merge(
      blob({ dayKey: '2026-08-19', foundToday: 12 }),
      blob({ dayKey: '2026-08-19', foundToday: 3 }),
    );
    expect(sameDay.foundToday).toBe(12);

    const otherDay = merge(
      blob({ dayKey: '2026-08-18', foundToday: 400 }),
      blob({ dayKey: '2026-08-19', foundToday: 3 }),
    );
    expect(otherDay.dayKey).toBe('2026-08-19');
    expect(otherDay.foundToday).toBe(3);
  });

  it('survives a missing or malformed side', () => {
    expect(merge(null, blob({ rolls: 5 })).rolls).toBe(5);
    expect((merge(blob({ rolls: 7 }), null) as { rolls: number }).rolls).toBe(7);
  });
});

describe('the registry', () => {
  it('files every blob under a unique document path', () => {
    const paths = SYNCED_BLOBS.map(b => `${b.collection}/${b.doc}`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  /**
   * The registry, pinned key by key.
   *
   * Worth stating plainly what this does and does not do. It cannot discover a
   * localStorage key that some service writes and nobody registered — that is
   * the failure that put six blobs out of sync for five releases, and finding it
   * from inside a unit test would mean parsing the whole source tree, which
   * fails silently the first time a key is built from a template string.
   *
   * What it does do is make the list an explicit decision. Dropping a blob from
   * SYNCED_BLOBS breaks this test rather than quietly un-syncing somebody's bag,
   * and adding one means writing the key down here — which is the moment to ask
   * whether it is progression or a device preference. The keys below are grouped
   * by the answer.
   */
  it('syncs exactly the progression blobs, and nothing device-local', () => {
    // Progression, minus `eclipse-progress`. That one has its own path because
    // its Firestore document is stored flat rather than in a `{ v, updatedAt }`
    // envelope — the security rule enforcing monotonic XP reads a *top-level*
    // `xp`, and wrapping it would silently disable the guard. `STATE_ENTRIES` in
    // game-state.gateway.ts is the list that includes it.
    expect([...SYNCED_BLOBS.map(b => b.key)].sort()).toEqual([
      'easter-eggs-dates',
      'easter-eggs-found',
      'eclipse-arena-scores',
      'eclipse-combo',
      'eclipse-idle',
      'eclipse-lore',
      'eclipse-quests',
      'eclipse-realm-rush-board',
      'godforge-activity',
      'godforge-chapter',
      'godforge-economy',
      'godforge-explorers',
      'godforge-inventory',
      'godforge-pinned',
      'godforge-pro',
      'godforge-roster',
      'godforge-runes',
      'godforge-scrolls',
      'godforge-stats',
      'godforge-thralls',
      'tool-usage-counts',
    ]);
  });

  /**
   * Keys the Godforge writes that are deliberately *not* synced, each for a
   * reason about the key itself rather than about nobody having got to it:
   *
   *   cloud-save-uid             which account this browser is bound to
   *   preferred-language         a per-device chrome preference
   *   godforge-forge-hum         whether this device makes noise
   *   godforge-install-dismissed whether this device was offered the PWA
   *   cm-recent-chars            a scratch MRU inside one tool
   *   ep-recent-emojis           ditto
   *   live-chat-username         a display name for one page
   *   codex-secrets              console-entered codes, not progression
   *   donations/recent           a read cache of public data
   *   site-stats/visits          ditto
   */
  it('leaves device-local keys out of the registry', () => {
    const synced = new Set(SYNCED_BLOBS.map(b => b.key));
    for (const key of [
      'cloud-save-uid', 'preferred-language', 'godforge-forge-hum',
      'godforge-install-dismissed', 'cm-recent-chars', 'ep-recent-emojis',
      'live-chat-username', 'codex-secrets', 'donations/recent', 'site-stats/visits',
    ]) {
      expect(synced.has(key)).withContext(`${key} should not sync`).toBe(false);
    }
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

/**
 * The merge dialog only earns its interruption when the question it asks is
 * real. These pin down when it opens, because both failure modes are bad in
 * different ways: opening on a save that is simply ahead makes signing in feel
 * like an interrogation, and *not* opening when each device holds something the
 * other lacks silently applies a merge somebody might not have wanted.
 */

describe('mergeEconomy', () => {
  const origin = {
    gold: 1000,
    totalGoldEarned: 1000,
    eclipseEssence: 0,
    upgrades: {} as Record<string, number>,
    artifacts: [] as string[],
    cosmetics: [] as string[],
    runewords: [] as string[],
    equipped: {} as Record<string, string>,
    enchantments: [] as { id: string; expiresAt: number }[],
  };

  function op(partial: {
    deviceId: string;
    seq: number;
    hlc: number;
    kind?: string;
    amount?: number;
    itemId?: string;
    slot?: string;
    extra?: number | string;
  }) {
    return {
      id: `${partial.deviceId}:${partial.seq}`,
      kind: partial.kind ?? 'buy-upgrade',
      wall: partial.hlc,
      ...partial,
    };
  }

  function after(originSnap: typeof origin, ops: ReturnType<typeof op>[], extraGold = 0) {
    const spent = ops.reduce((sum, o) => sum + (o.amount ?? 0), 0);
    const upgrades: Record<string, number> = { ...originSnap.upgrades };
    for (const o of ops) {
      if (o.kind === 'buy-upgrade' && o.itemId) {
        upgrades[o.itemId] = (upgrades[o.itemId] ?? 0) + 1;
      }
    }
    return {
      ...originSnap,
      gold: originSnap.gold - spent + extraGold,
      upgrades,
      origin: originSnap,
      ops,
      hlc: Math.max(0, ...ops.map(o => o.hlc)),
    };
  }

  it('keeps a local spend when the cloud still holds the higher balance', () => {
    const buy = op({ deviceId: 'phone', seq: 1, hlc: 10, amount: 300, itemId: 'iron-hammer' });
    const local = after({ ...origin, upgrades: { 'iron-hammer': 1 } }, [buy]);
    const cloud = { ...origin, upgrades: { 'iron-hammer': 1 } };
    const merged = mergeEconomy(cloud, local) as Record<string, unknown>;
    expect(merged['gold']).toBe(700);
    expect(merged['upgrades']).toEqual({ 'iron-hammer': 2 });
    expect(merged['totalGoldEarned']).toBe(1000);
  });

  it('does not keep two concurrent purchases that together exceed the pile', () => {
    const aOp = op({ deviceId: 'aaa', seq: 1, hlc: 10, amount: 700, itemId: 'iron-hammer' });
    const bOp = op({ deviceId: 'bbb', seq: 1, hlc: 11, amount: 500, itemId: 'ember-stoker' });
    const a = after(origin, [aOp]);
    const b = after(origin, [bOp]);
    const ab = mergeEconomy(a, b) as Record<string, unknown>;
    const ba = mergeEconomy(b, a) as Record<string, unknown>;
    expect(ab).toEqual(ba);
    // First-in-order (hlc 10) spends 700; the 500 spend is skipped.
    expect(ab['gold']).toBe(300);
    expect(ab['upgrades']).toEqual({ 'iron-hammer': 1 });
    expect(ab['gold'] as number + 700).toBe(1000);
  });

  it('is commutative including Gold, Essence, runGold and equipped', () => {
    const aOp = op({
      deviceId: 'aaa', seq: 1, hlc: 5, kind: 'equip', itemId: 'golden', slot: 'rail', amount: 0,
    });
    const bOp = op({
      deviceId: 'bbb', seq: 1, hlc: 5, kind: 'equip', itemId: 'obsidian', slot: 'rail', amount: 0,
    });
    const a = {
      ...origin, gold: 40, totalGoldEarned: 40, totalClicks: 900,
      artifacts: ['obsidian-heart'], eclipseEssence: 5,
      equipped: { rail: 'golden' }, origin, ops: [aOp], hlc: 5,
    };
    const b = {
      ...origin, gold: 1200, totalGoldEarned: 1200, totalClicks: 120,
      artifacts: ['mirrorblade-kael'], eclipseEssence: 2,
      equipped: { rail: 'obsidian' },
      enchantments: [{ id: 'seekers-lens', expiresAt: 9_000 }],
      origin, ops: [bOp], hlc: 5,
    };
    const ab = mergeEconomy(a, b) as Record<string, unknown>;
    const ba = mergeEconomy(b, a) as Record<string, unknown>;
    expect(ab['gold']).toBe(ba['gold']);
    expect(ab['eclipseEssence']).toBe(ba['eclipseEssence']);
    expect(ab['equipped']).toEqual(ba['equipped']);
    expect(ab['totalGoldEarned']).toBe(1200);
    expect(ab['totalClicks']).toBe(900);
    expect(new Set(ab['artifacts'] as string[])).toEqual(new Set(ba['artifacts'] as string[]));
  });

  it('keeps unstamped cloud Gold when the local device has never spent', () => {
    const cloud = {
      gold: 5000, totalGoldEarned: 5000, upgrades: {}, artifacts: [],
      cosmetics: [], runewords: [], equipped: {}, enchantments: [], eclipseEssence: 0,
    };
    const local = {
      gold: 0, totalGoldEarned: 0, upgrades: {}, artifacts: [],
      cosmetics: [], runewords: [], equipped: {}, enchantments: [], eclipseEssence: 0,
    };
    const merged = mergeEconomy(cloud, local) as Record<string, unknown>;
    expect(merged['gold']).toBe(5000);
    expect(merged['totalGoldEarned']).toBe(5000);
  });

  it('does not let a stamped modern 100 overwrite a legacy 9999', () => {
    const legacy = {
      gold: 9999, totalGoldEarned: 9999, upgrades: {}, artifacts: [],
      cosmetics: [], runewords: [], equipped: {}, enchantments: [], eclipseEssence: 0,
    };
    const modern = {
      gold: 100, totalGoldEarned: 9999, upgrades: { x: 1 }, artifacts: [],
      cosmetics: [], runewords: [], equipped: {}, enchantments: [], eclipseEssence: 0,
      ledgerAt: 50,
    };
    const merged = mergeEconomy(legacy, modern) as Record<string, unknown>;
    expect(merged['gold']).toBe(9999);
    expect(merged['upgrades']).toEqual({ x: 1 });
  });

  it('orders equal-hlc ops by deviceId so swapped operands agree', () => {
    const aOp = op({ deviceId: 'aaa', seq: 1, hlc: 7, amount: 700, itemId: 'iron-hammer' });
    const bOp = op({ deviceId: 'zzz', seq: 1, hlc: 7, amount: 500, itemId: 'ember-stoker' });
    const a = after(origin, [aOp]);
    const b = after(origin, [bOp]);
    const ab = mergeEconomy(a, b) as Record<string, unknown>;
    const ba = mergeEconomy(b, a) as Record<string, unknown>;
    expect(ab).toEqual(ba);
    expect(ab['upgrades']).toEqual({ 'iron-hammer': 1 });
    expect(ab['gold']).toBe(300);
  });

  it('still applies a spend when the wall clock moved backwards', () => {
    const first = op({ deviceId: 'phone', seq: 1, hlc: 100, amount: 100, itemId: 'iron-hammer' });
    const second = op({
      deviceId: 'phone', seq: 2, hlc: 101, amount: 100, itemId: 'iron-hammer',
    });
    second.wall = 1;
    const local = after({ ...origin, upgrades: {} }, [first, second]);
    const cloud = { ...origin };
    const merged = mergeEconomy(cloud, local) as Record<string, unknown>;
    expect(merged['gold']).toBe(800);
    expect(merged['upgrades']).toEqual({ 'iron-hammer': 2 });
  });

  it('picks a deterministic winner when one device has a future-dated HLC', () => {
    // Policy: concurrent offline purchases have a stable but arbitrary order
    // (hlc, deviceId, seq, id). A future-dated clock sorts later. This is not
    // a reconstruction of real-world time.
    const real = op({ deviceId: 'aaa', seq: 1, hlc: 10, amount: 700, itemId: 'iron-hammer' });
    const skewed = op({ deviceId: 'bbb', seq: 1, hlc: 9_999_999, amount: 500, itemId: 'ember-stoker' });
    const a = after(origin, [real]);
    const b = after(origin, [skewed]);
    const merged = mergeEconomy(a, b) as Record<string, unknown>;
    const swapped = mergeEconomy(b, a) as Record<string, unknown>;
    expect(merged).toEqual(swapped);
    expect(merged['gold']).toBe(300);
    expect(merged['upgrades']).toEqual({ 'iron-hammer': 1 });
  });

  it('keeps idle earnings that happened after a stamped spend', () => {
    const buy = op({ deviceId: 'phone', seq: 1, hlc: 10, amount: 700, itemId: 'iron-hammer' });
    const spent = after(origin, [buy], 50);
    const other = after(origin, [buy], 0);
    const merged = mergeEconomy(other, spent) as Record<string, unknown>;
    expect(merged['gold']).toBe(350);
    expect(merged['upgrades']).toEqual({ 'iron-hammer': 1 });
  });

  it('migrates both directions between a legacy blob and an op-log blob', () => {
    const buy = op({ deviceId: 'phone', seq: 1, hlc: 10, amount: 300, itemId: 'iron-hammer' });
    const modern = after(origin, [buy]);
    const legacy = { ...origin, gold: 1000 };
    const forward = mergeEconomy(legacy, modern) as Record<string, unknown>;
    const backward = mergeEconomy(modern, legacy) as Record<string, unknown>;
    expect(forward['gold']).toBe(700);
    expect(backward['gold']).toBe(700);
    expect(forward['upgrades']).toEqual({ 'iron-hammer': 1 });
    expect(backward['upgrades']).toEqual({ 'iron-hammer': 1 });
  });
});

describe('summarise', () => {
  it('reads the headline numbers off a progress and an economy blob', () => {
    const summary = summarise(
      { level: 7, xp: 4200, achievements: [{ id: 'a' }, { id: 'b' }] },
      { gold: 1300 },
    );
    expect(summary).toEqual({ level: 7, xp: 4200, gold: 1300, achievements: 2 });
  });

  it('reports zeroes rather than throwing on blobs it has never seen', () => {
    expect(summarise(null, null)).toEqual({ level: 0, xp: 0, gold: 0, achievements: 0 });
    expect(summarise('nonsense', 42)).toEqual({ level: 0, xp: 0, gold: 0, achievements: 0 });
  });

  it('ignores a non-finite number rather than carrying NaN into the dialog', () => {
    expect(summarise({ xp: NaN }, { gold: Infinity }).xp).toBe(0);
    expect(summarise({ xp: NaN }, { gold: Infinity }).gold).toBe(0);
  });
});

describe('hasProgress', () => {
  it('is false for a browser that has never earned anything', () => {
    expect(hasProgress({ level: 1, xp: 0, gold: 0, achievements: 0 })).toBe(false);
  });

  it('is true on any of xp, gold or achievements', () => {
    expect(hasProgress({ level: 1, xp: 10, gold: 0, achievements: 0 })).toBe(true);
    expect(hasProgress({ level: 1, xp: 0, gold: 5, achievements: 0 })).toBe(true);
    expect(hasProgress({ level: 1, xp: 0, gold: 0, achievements: 1 })).toBe(true);
  });
});

describe('isConflict', () => {
  const empty = { level: 1, xp: 0, gold: 0, achievements: 0 };

  it('is false on a first device, where there is nothing to weigh', () => {
    expect(isConflict(empty, { level: 9, xp: 9000, gold: 900, achievements: 12 })).toBe(false);
    expect(isConflict({ level: 9, xp: 9000, gold: 900, achievements: 12 }, empty)).toBe(false);
  });

  it('is false when one save is ahead on everything', () => {
    // All three buttons would produce the same save, so there is nothing to ask.
    const behind = { level: 3, xp: 500, gold: 50, achievements: 2 };
    const ahead = { level: 9, xp: 9000, gold: 900, achievements: 12 };
    expect(isConflict(behind, ahead)).toBe(false);
    expect(isConflict(ahead, behind)).toBe(false);
  });

  it('is false when the two saves are identical', () => {
    const same = { level: 4, xp: 800, gold: 100, achievements: 3 };
    expect(isConflict(same, { ...same })).toBe(false);
  });

  it('is true when each side holds something the other does not', () => {
    // Played on the phone for gold, on the desktop for XP.
    const local = { level: 6, xp: 3000, gold: 20, achievements: 5 };
    const cloud = { level: 4, xp: 900, gold: 800, achievements: 7 };
    expect(isConflict(local, cloud)).toBe(true);
  });

  it('is symmetric — which device signed in first must not change the answer', () => {
    const a = { level: 6, xp: 3000, gold: 20, achievements: 5 };
    const b = { level: 4, xp: 900, gold: 800, achievements: 7 };
    expect(isConflict(a, b)).toBe(isConflict(b, a));
  });
});

describe('stripUndefined', () => {
  function containsUndefined(value: unknown): boolean {
    if (value === undefined) return true;
    if (value === null || typeof value !== 'object') return false;
    return Object.values(value).some(containsUndefined);
  }

  it('drops undefined keys and keeps null', () => {
    expect(stripUndefined({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
  });

  it('keeps array positions by turning undefined entries into null', () => {
    expect(stripUndefined([1, undefined, 3])).toEqual([1, null, 3]);
  });

  it('makes a coerced credit-gold ledger safe for Firestore', () => {
    const ledger = coerceLedger({
      gold: 250,
      ops: [{
        id: 'd:1', deviceId: 'd', seq: 1, kind: 'credit-gold',
        amount: 250, hlc: 1, wall: 1,
      }],
    });
    const envelope = wrapBlob(ledger);
    expect(containsUndefined(envelope)).toBe(false);
    expect(envelope.v).not.toBeNull();
  });
});

/*
 * The rule that decides whether signing in has anything to say.
 *
 * These are here because the old rule counted an unspent Gold balance as
 * progress the other side had never seen — which is true of every second
 * device, permanently, and so it fired for practically everybody.
 */
describe('isConflict — only unspent progress counts, never a balance', () => {
  const save = (xp: number, level: number, achievements: number, gold: number) =>
    summarise(
      { xp, level, achievements: Array.from({ length: achievements }, (_, i) => `a${i}`) },
      { gold },
    );

  it('is silent when a device simply has not spent its Gold yet', () => {
    // The phone last synced at 3000 Gold; since then the desktop spent it down
    // and earned XP. Nothing is wrong with either save.
    expect(isConflict(save(4000, 8, 3, 3000), save(5000, 9, 3, 200))).toBe(false);
  });

  it('is silent when this device spent Gold the cloud still remembers', () => {
    expect(isConflict(save(5000, 9, 3, 200), save(5000, 9, 3, 3000))).toBe(false);
  });

  it('is silent when the cloud is simply further along', () => {
    expect(isConflict(save(100, 2, 0, 10), save(5000, 9, 3, 8000))).toBe(false);
  });

  it('still speaks up when each side earned something the other never did', () => {
    expect(isConflict(save(9000, 12, 3, 100), save(5000, 9, 9, 8000))).toBe(true);
  });

  it('says nothing about an empty save', () => {
    expect(isConflict(save(0, 1, 0, 0), save(5000, 9, 3, 8000))).toBe(false);
  });
});

