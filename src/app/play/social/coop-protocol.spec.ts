/**
 * coop-protocol.spec.ts — the shared creatures' wire (protocol 4): the host's delta encoder and a member's decoder.
 */
import { CoopDecoder, CoopEncoder, KEYFRAME_MS, quantize, type CoopMobState, type CoopSnapMsg } from './coop-protocol';

const mob = (i: string, more: Partial<CoopMobState> = {}): CoopMobState => ({ i, t: 'ash-wolf', k: `w:${i}`, x: 100, y: 200, f: 1, h: 40, m: 40, l: 6, e: null, tl: 0, ax: 0, ay: 0, fl: 0, ...more });
const msg = (s: ReturnType<CoopEncoder['encode']>, term = 1, from = 'host'): CoopSnapMsg => ({ area: 'ember-isle', from, term, ev: [], ...s });

describe('coop-protocol: delta encoding', () => {
  it('opens with a keyframe: every creature whole', () => {
    const enc = new CoopEncoder();
    const s = enc.encode(0, [mob('a'), mob('b', { e: { r: 'champion', o: 'leader', a: ['extra-fast'] } })]);
    expect(s.kf).toBeTrue();
    expect(s.mobs.length).toBe(2);
    expect(s.mobs[1]).toEqual(jasmine.objectContaining({ i: 'b', t: 'ash-wolf', k: 'w:b', x: 100, y: 200, h: 40, m: 40, l: 6, e: { r: 'champion', o: 'leader', a: ['extra-fast'] } }));
  });

  it('then sends only what changed: a moved creature its place, a wounded one its life; an unchanged one nothing', () => {
    const enc = new CoopEncoder();
    enc.encode(0, [mob('a'), mob('b'), mob('c')]);
    const s = enc.encode(125, [mob('a', { x: 103.6 }), mob('b', { h: 31 }), mob('c')]);
    expect(s.kf).toBeFalse();
    expect(s.mobs).toEqual([{ i: 'a', x: 104 }, { i: 'b', h: 31 }]);
    expect(s.gone).toEqual([]);
    // Sub-pixel drift rounds to nothing at all.
    expect(enc.encode(250, [mob('a', { x: 103.9 }), mob('b', { h: 31 }), mob('c')]).mobs).toEqual([]);
  });

  it('a vanished creature is named in `gone`; a new one comes whole', () => {
    const enc = new CoopEncoder();
    enc.encode(0, [mob('a'), mob('b')]);
    const s = enc.encode(125, [mob('a'), mob('z', { t: 'lava-hound' })]);
    expect(s.gone).toEqual(['b']);
    expect(s.mobs).toEqual([jasmine.objectContaining({ i: 'z', t: 'lava-hound', x: 100, h: 40 })]);
  });

  it('keyframes come every KEYFRAME_MS, and at once when asked (a newcomer, a failed send)', () => {
    const enc = new CoopEncoder();
    enc.encode(0, [mob('a')]);
    expect(enc.encode(KEYFRAME_MS - 1, [mob('a')]).kf).toBeFalse();
    expect(enc.encode(KEYFRAME_MS, [mob('a')]).kf).toBeTrue();
    enc.keyframe();
    expect(enc.encode(KEYFRAME_MS + 10, [mob('a')]).kf).toBeTrue();
  });

  it('quantizes to whole numbers and clamps the wind-up', () => {
    expect(quantize(mob('a', { x: 10.4, y: -3.6, h: 12.7, tl: 140, f: -1 }))).toEqual(jasmine.objectContaining({ x: 10, y: -4, h: 13, tl: 100, f: -1 }));
  });

  it('round trip: a member\'s set equals the host\'s after any run of keyframes and deltas', () => {
    const enc = new CoopEncoder(), dec = new CoopDecoder();
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let set = ['a', 'b', 'c', 'd'].map(i => mob(i));
    for (let t = 0; t < 8000; t += 125) {
      set = set.filter(() => rnd() > .03).map(m => ({ ...m, x: m.x + (rnd() - .5) * 8, h: Math.max(0, m.h - (rnd() < .2 ? 3 : 0)) }));
      if (rnd() < .1) set.push(mob(`n${t}`, { x: rnd() * 500 }));
      expect(dec.apply(msg(enc.encode(t, set))).ok).toBeTrue();
      const want = new Map(set.map(m => [m.i, quantize(m)]));
      expect([...dec.state.keys()].sort()).toEqual([...want.keys()].sort());
      for (const [id, s] of want) expect(dec.state.get(id)).toEqual(jasmine.objectContaining({ x: s.x, y: s.y, h: s.h, m: s.m, t: s.t }));
    }
  });
});

describe('coop-protocol: a member out of step', () => {
  it('a missed delta: the member ignores deltas until the next keyframe', () => {
    const enc = new CoopEncoder(), dec = new CoopDecoder();
    dec.apply(msg(enc.encode(0, [mob('a')])));
    enc.encode(125, [mob('a', { x: 150 })]);                         // lost on the way
    expect(dec.apply(msg(enc.encode(250, [mob('a', { x: 160, h: 20 })]))).ok).toBeFalse();
    expect(dec.synced).toBeFalse();
    expect(dec.state.get('a')!.x).toBe(100);
    enc.keyframe();
    expect(dec.apply(msg(enc.encode(375, [mob('a', { x: 170, h: 20 })]))).ok).toBeTrue();
    expect(dec.state.get('a')).toEqual(jasmine.objectContaining({ x: 170, h: 20 }));
  });

  it('a new host (another term): out of step until its first keyframe; a keyframe drops what it does not name', () => {
    const one = new CoopEncoder(), two = new CoopEncoder(), dec = new CoopDecoder();
    dec.apply(msg(one.encode(0, [mob('a'), mob('b')])));
    two.encode(0, [mob('a')]);
    expect(dec.apply(msg(two.encode(125, [mob('a', { x: 1 })]), 2, 'new')).ok).toBeFalse();
    two.keyframe();
    const r = dec.apply(msg(two.encode(250, [mob('a', { x: 2 })]), 2, 'new'));
    expect(r.ok).toBeTrue();
    expect(r.removed).toEqual(['b']);
    expect([...dec.state.keys()]).toEqual(['a']);
  });

  it('a creature first heard of in a delta without its kind waits for a keyframe', () => {
    const dec = new CoopDecoder();
    dec.apply({ from: 'h', term: 1, seq: 1, kf: true, mobs: [], gone: [] });
    const r = dec.apply({ from: 'h', term: 1, seq: 2, kf: false, mobs: [{ i: 'q', x: 4 }], gone: [] });
    expect(r.added).toEqual([]);
    expect(dec.state.size).toBe(0);
  });
});
