import { BAND_ABOVE, BAND_BELOW, PartyShare, SHARE, SHARE_KILLS_PER_MIN, SHARE_TILES, SHARE_TILE_PX, shareCapPerMin, type ShareKill, type ShareMe } from './party-share';
import { huntingXpFor } from '../../shared/skills/hunting';

describe('PartyShare (shared Hunting XP, trust-based)', () => {
  const table: Record<string, { level: number; hp: number }> = { 'rivet-maw': { level: 4, hp: 60 }, 'cinder-bailiff': { level: 10, hp: 110 }, 'deep-thing': { level: 40, hp: 2000 } };
  const lookup = (id: string) => table[id] ?? null;
  const me: ShareMe = { id: 'me', area: 'ember-isle', x: 100, y: 100, level: 5, members: ['me', 'ally'] };
  let n = 0;
  const kill = (over: Partial<ShareKill> = {}): ShareKill => ({ id: `k${++n}`, from: 'ally', creature: 'rivet-maw', level: 4, hp: 60, area: 'ember-isle', x: 120, y: 110, ...over });

  it('pays 60% of the base XP to a member near the kill, once per kill', () => {
    const s = new PartyShare(lookup), k = kill();
    expect(s.accept(k, me, 0)).toEqual({ ok: true, xp: Math.round(huntingXpFor(60) * SHARE) });
    expect(s.accept(k, me, 1)).toEqual({ ok: false, why: 'seen' });
  });

  it('carries the sky\'s factor, clipped at 3, and never more life than the creature has', () => {
    const s = new PartyShare(lookup);
    expect(s.accept(kill({ xp: 1.5 }), me, 0)).toEqual({ ok: true, xp: Math.round(huntingXpFor(60) * 1.5 * SHARE) });
    expect(s.accept(kill({ xp: 50 }), me, 0)).toEqual({ ok: true, xp: Math.round(huntingXpFor(60) * 3 * SHARE) });
    expect(s.accept(kill({ hp: 99999 }), me, 0)).toEqual({ ok: true, xp: Math.round(huntingXpFor(60) * SHARE) });
  });

  it('refuses itself, strangers, unknown creatures and a level that disagrees with its own table', () => {
    const s = new PartyShare(lookup);
    expect(s.accept(kill({ from: 'me' }), me, 0)).toEqual({ ok: false, why: 'self' });
    expect(s.accept(kill({ from: 'stranger' }), me, 0)).toEqual({ ok: false, why: 'stranger' });
    expect(s.accept(kill({ creature: 'made-up' }), me, 0)).toEqual({ ok: false, why: 'unknown' });
    expect(s.accept(kill({ level: 9 }), me, 0)).toEqual({ ok: false, why: 'level' });
  });

  it('only on the same area and within 12 tiles of where the killer stood', () => {
    const s = new PartyShare(lookup), edge = SHARE_TILES * SHARE_TILE_PX;
    expect(s.accept(kill({ area: 'ember-mine-1' }), me, 0)).toEqual({ ok: false, why: 'area' });
    expect(s.accept(kill({ x: me.x + edge + 1, y: me.y }), me, 0)).toEqual({ ok: false, why: 'far' });
    expect(s.accept(kill({ x: me.x + edge, y: me.y }), me, 0).ok).toBeTrue();
  });

  it('ignores creatures far outside the recipient\'s level band', () => {
    const s = new PartyShare(lookup);
    expect(s.accept(kill({ creature: 'deep-thing', level: 40, hp: 2000 }), me, 0)).toEqual({ ok: false, why: 'band' });
    expect(40 > me.level + BAND_ABOVE).toBeTrue();
    const high: ShareMe = { ...me, level: 4 + BAND_BELOW + 1 };
    expect(s.accept(kill(), high, 0)).toEqual({ ok: false, why: 'band' });
  });

  it('caps shared kills and shared XP per minute, and frees them a minute later', () => {
    const s = new PartyShare(lookup);
    for (let i = 0; i < SHARE_KILLS_PER_MIN; i++) expect(s.accept(kill(), me, i * 100).ok).toBeTrue();
    expect(s.accept(kill(), me, 2000)).toEqual({ ok: false, why: 'kills' });
    expect(s.accept(kill(), me, 60000).ok).toBeTrue();
    // The XP cap: a level-1 Keeper's minute holds 240; big kills fill it and the last is trimmed to fit.
    const low = new PartyShare(lookup), one: ShareMe = { ...me, level: 1 };
    const big = () => kill({ creature: 'cinder-bailiff', level: 10, hp: 110, xp: 3 });
    let total = 0;
    for (let i = 0; i < 12; i++) { const r = low.accept(big(), one, i); if (r.ok) total += r.xp; }
    expect(total).toBe(shareCapPerMin(1));
    expect(low.accept(big(), one, 20)).toEqual({ ok: false, why: 'cap' });
    expect(low.paidLastMinute(20)).toBe(shareCapPerMin(1));
    expect(low.paidLastMinute(60020)).toBe(0);
  });
});
