import {
  WHEREABOUTS_EVERY_MS, WHEREABOUTS_KEY, WHEREABOUTS_MIN_GAP_MS, WhereaboutsThrottle, coerceWhereabouts, mergeWhereabouts,
  pickWakePlace, type Place,
} from './whereabouts.model';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { ACCOUNT_WIDE_KEYS, characterDocPath, isCharacterScoped } from './character-scope';

const at = (x: number, y = 100, level = 'surface', continent = 'ember-isle'): Place => ({ continent, level, x, y });

describe('whereabouts: the write throttle', () => {
  it('writes the first place of the page at once', () => {
    const t = new WhereaboutsThrottle();
    expect(t.offer(at(100), 1_000)).toBeTrue();
    expect(t.pending).toBeNull();
  });

  it('never writes the tile it last wrote, however long the Keeper stands there', () => {
    const t = new WhereaboutsThrottle();
    t.offer(at(100), 0);
    expect(t.offer(at(102), 10 * WHEREABOUTS_EVERY_MS)).toBeFalse(); // same tile (16 px)
    expect(t.pending).toBeNull();
  });

  it('holds a walk inside one area back until a minute has passed, then writes the newest place', () => {
    const t = new WhereaboutsThrottle();
    t.offer(at(100), 0);
    let writes = 0;
    // A Keeper walking a tile every two seconds for five minutes: one write a minute, never one a step.
    for (let s = 2_000, x = 116; s <= 5 * 60_000; s += 2_000, x += 16) if (t.offer(at(x), s)) writes++;
    expect(writes).toBe(5);
    expect(t.offer(at(5_000), 5 * 60_000 + 2_000)).toBeFalse();
    expect(t.pending?.place.x).toBe(5_000);
    expect(t.pending?.at).toBe(5 * 60_000 + 2_000);
  });

  it('writes an area change at once, but not twice inside the minimum gap', () => {
    const t = new WhereaboutsThrottle();
    t.offer(at(100), 0);
    expect(t.offer(at(100, 100, 'ember-mine-1'), WHEREABOUTS_MIN_GAP_MS)).toBeTrue();
    // Straight back up the stair: held, not a second write.
    expect(t.offer(at(100, 100, 'surface'), WHEREABOUTS_MIN_GAP_MS + 1_000)).toBeFalse();
    expect(t.pending?.place.level).toBe('surface');
    // Another continent once the gap has passed: written.
    expect(t.offer(at(10, 10, 'surface', 'verdant'), 2 * WHEREABOUTS_MIN_GAP_MS + 1_000)).toBeTrue();
  });

  it('forgets the held place once it is written by the flush', () => {
    const t = new WhereaboutsThrottle();
    t.offer(at(100), 0);
    t.offer(at(300), 2_000);
    const held = t.pending!;
    t.sent(held.place, held.at);
    expect(t.pending).toBeNull();
    // The flushed tile is now the last written one.
    expect(t.offer(at(300), 3_000)).toBeFalse();
  });
});

describe('whereabouts: the cross-device merge', () => {
  const phone = { version: 1, td: at(10), at: 2_000 };
  const desk = { version: 1, td: at(900, 50, 'ember-mine-2'), at: 5_000 };

  it('keeps the newest place, whole', () => {
    expect(mergeWhereabouts(phone, desk)).toEqual(desk as never);
    expect(mergeWhereabouts(desk, phone)).toEqual(desk as never);
  });

  it('keeps the local copy on a tie', () => {
    const other = { ...phone, td: at(20) };
    expect(mergeWhereabouts(other, phone)?.td.x).toBe(10);
  });

  it('lets a real place beat garbage on either side', () => {
    expect(mergeWhereabouts(null, phone)?.td.x).toBe(10);
    expect(mergeWhereabouts(phone, { td: 'nowhere' })?.td.x).toBe(10);
    expect(mergeWhereabouts({ td: at(1) }, null)).toBeNull(); // unstamped: never wins
    expect(coerceWhereabouts({ td: at(1), at: Number.NaN })).toBeNull();
  });

  it('is the merge the gateway uses for the synced key', () => {
    const entry = SYNCED_BLOBS.find(b => b.key === WHEREABOUTS_KEY)!;
    expect(entry.collection).toBe('progress');
    expect(entry.doc).toBe('whereabouts');
    expect(entry.merge!(phone, desk)).toEqual(desk as never);
    expect(entry.merge!(desk, phone)).toEqual(desk as never);
  });

  it('is stored per character, beside the character\'s other progress documents', () => {
    const keys = new Set(SYNCED_BLOBS.map(b => b.key));
    expect(ACCOUNT_WIDE_KEYS.has(WHEREABOUTS_KEY)).toBeFalse();
    expect(isCharacterScoped(WHEREABOUTS_KEY, keys)).toBeTrue();
    expect(characterDocPath('c1', 'progress', 'whereabouts')).toEqual(['progress', 'whereabouts']);
    expect(characterDocPath('k2abc', 'progress', 'whereabouts')).toEqual(['characters', 'k2abc', 'progress', 'whereabouts']);
  });
});

describe('whereabouts: where to wake', () => {
  it('wakes at the newer of this device\'s place and the synced one', () => {
    const synced = { version: 1, td: at(500), at: 9_000 };
    expect(pickWakePlace({ td: at(10), tdAt: 5_000 }, synced)?.x).toBe(500);
    expect(pickWakePlace({ td: at(10), tdAt: 12_000 }, synced)?.x).toBe(10);
  });

  it('prefers the synced place over a device place from before the sync (no stamp)', () => {
    expect(pickWakePlace({ td: at(10) }, { version: 1, td: at(500), at: 1 })?.x).toBe(500);
  });

  it('falls back to whichever exists', () => {
    expect(pickWakePlace({ td: at(10) }, null)?.x).toBe(10);
    expect(pickWakePlace(null, { version: 1, td: at(500), at: 1 })?.x).toBe(500);
    expect(pickWakePlace(null, null)).toBeNull();
  });
});
