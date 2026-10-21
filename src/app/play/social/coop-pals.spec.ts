/**
 * coop-pals.spec.ts — other Keepers' companions (protocol 5): the cosmetic presence field, the party list's cleaning,
 * and the book that glides and forgets them.
 */
import { PALS_MAX, PAL_EXPIRE_MS, PalBook, cleanPals, decodePresencePals, encodePresencePals, type CoopPal } from './coop-pals';
import { INTERP_MS } from './coop-interp';

describe('coop-pals: presence (everyone sees a pet and Glim)', () => {
  it('only the pet and Glim travel, as offsets rounded to 4 px; summons stay party-only', () => {
    const pals: CoopPal[] = [
      { i: 'p', k: 'pet', t: 'moss-hedgehog', x: 113, y: 205, f: 1 }, { i: 'k1', k: 'skel', x: 90, y: 200, f: 1 },
      { i: 'g', k: 'glim', x: 86, y: 154, f: 1 },
    ];
    const s = encodePresencePals({ x: 100, y: 200 }, pals);
    expect(s).toBe('pet:moss-hedgehog:12:4,glim::-12:-44');
    expect(decodePresencePals(s)).toEqual([{ k: 'pet', t: 'moss-hedgehog', dx: 12, dy: 4 }, { k: 'glim', t: '', dx: -12, dy: -44 }]);
  });
  it('junk reads as nothing', () => {
    expect(decodePresencePals('skel::1:1,pet:<b>:1:1,glim::x:1')).toEqual([]);
    expect(decodePresencePals(42)).toEqual([]);
    expect(decodePresencePals('x'.repeat(97))).toEqual([]);
  });
});

describe('coop-pals: the party list', () => {
  it('is cleaned to what the room accepts: known kinds, whole numbers, bounded, at most PALS_MAX', () => {
    const many = Array.from({ length: PALS_MAX + 4 }, (_, n) => ({ i: `w${n}`, k: 'wisp' as const, x: n + .4, y: 1, f: 1 as const }));
    expect(cleanPals(many).length).toBe(PALS_MAX);
    expect(cleanPals([{ i: 'k1', k: 'skel', x: 1.6, y: 2, f: -1, h: 50.2, m: 40 }])).toEqual([{ i: 'k1', k: 'skel', x: 2, y: 2, f: -1, m: 40, h: 40 }]);
    expect(cleanPals([{ i: 'k1', k: 'skel', x: 1e9, y: 2, f: 1 }])).toEqual([]);
    expect(cleanPals([{ i: 'X', k: 'pet', x: 1, y: 2, f: 1 }])).toEqual([]);
  });
});

describe('coop-pals: the book', () => {
  it('glides each companion to where its owner says, drops what the owner no longer names, forgets a silent owner', () => {
    const book = new PalBook();
    book.take('a', [{ i: 'p', k: 'pet', t: 'moss-hedgehog', x: 0, y: 0, f: 1 }, { i: 'k1', k: 'skel', x: 50, y: 0, f: 1 }], 0);
    book.take('a', [{ i: 'p', k: 'pet', t: 'moss-hedgehog', x: 20, y: 0, f: 1 }], 100);
    const mid = book.shown(100 + INTERP_MS / 2);
    expect(mid.length).toBe(1);
    expect(mid[0].x).toBeCloseTo(10, 5);
    expect(mid[0].moving).toBeTrue();
    expect(book.shown(100 + INTERP_MS)[0].x).toBe(20);
    expect(book.fresh('a', 100 + PAL_EXPIRE_MS)).toBeTrue();
    expect(book.shown(101 + PAL_EXPIRE_MS)).toEqual([]);
    expect(book.fresh('a', 101 + PAL_EXPIRE_MS)).toBeFalse();
  });
});
