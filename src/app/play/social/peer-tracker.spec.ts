import { PEER_CAP, PEER_SNAP, PeerTracker, areaKey } from './peer-tracker';
import { packLook, unpackLook } from './peer-look';
import { defaultLook } from '../../shared/keeper-look/keeper-look.model';
import type { RoomPlayer } from './social-room';

const keeper = (id: string, x: number, y: number, more: Partial<RoomPlayer> = {}): RoomPlayer =>
  ({ id, name: id, x, y, zone: 'ember-isle', facing: 1, animation: 'idle', ...more });

describe('PeerTracker (other Keepers in the top-down world)', () => {
  it('glides toward the reported spot, frame-rate independent, and arrives', () => {
    const t = new PeerTracker();
    t.set([keeper('mira', 100, 100)]);
    t.set([keeper('mira', 140, 100, { animation: 'run' })]);
    const one = t.step(1 / 60, 'ember-isle', { x: 0, y: 0 })[0];
    expect(one.x).toBeGreaterThan(100); expect(one.x).toBeLessThan(110);
    expect(one.moving).toBeTrue();
    expect(one.dir).toBe('side');
    // Two half-steps land where one whole step does.
    const a = new PeerTracker(), b = new PeerTracker();
    for (const k of [a, b]) { k.set([keeper('mira', 0, 0)]); k.set([keeper('mira', 100, 0)]); }
    a.step(.1, 'ember-isle', { x: 0, y: 0 });
    const ax = a.step(.1, 'ember-isle', { x: 0, y: 0 })[0].x, bx = b.step(.2, 'ember-isle', { x: 0, y: 0 })[0].x;
    expect(Math.abs(ax - bx)).toBeLessThan(.01);
    let last = 0;
    for (let i = 0; i < 120; i++) last = t.step(1 / 60, 'ember-isle', { x: 0, y: 0 })[0].x;
    expect(last).toBe(140);
  });

  it('snaps on a jump (a stair, a ship) and under reduced motion', () => {
    const t = new PeerTracker();
    t.set([keeper('mira', 0, 0)]);
    t.set([keeper('mira', PEER_SNAP + 40, 0)]);
    expect(t.step(1 / 60, 'ember-isle', { x: 0, y: 0 })[0].x).toBe(PEER_SNAP + 40);
    t.set([keeper('mira', PEER_SNAP + 60, 0)]);
    expect(t.step(1 / 60, 'ember-isle', { x: 0, y: 0 }, true)[0].x).toBe(PEER_SNAP + 60);
  });

  it('shows only the same area, nearest first, at most the cap; never the local Keeper', () => {
    const t = new PeerTracker();
    const many = Array.from({ length: PEER_CAP + 8 }, (_, i) => keeper(`k${i}`, i * 10, 0));
    t.set([...many, keeper('me', 0, 0), keeper('deep', 5, 5, { zone: 'x', area: 'ember-mine-1' })], 'me');
    const shown = t.step(0, 'ember-isle', { x: 1000, y: 0 });
    expect(shown.length).toBe(PEER_CAP);
    expect(shown[0].id).toBe(`k${PEER_CAP + 7}`);
    expect(shown.some(p => p.id === 'me' || p.id === 'deep')).toBeFalse();
    expect(t.step(0, 'ember-mine-1', { x: 0, y: 0 }).map(p => p.id)).toEqual(['deep']);
    // A v1 room (no area): the zone carries the area id.
    expect(areaKey('Ember Isle')).toBe('ember-isle');
  });

  it('reads the way faced from the glide when the room does not send it, and forgets who left', () => {
    const t = new PeerTracker();
    t.set([keeper('mira', 0, 0)]);
    t.set([keeper('mira', 0, 60)]);
    expect(t.step(.05, 'ember-isle', { x: 0, y: 0 })[0].dir).toBe('down');
    t.set([keeper('mira', 0, 60, { dir: 'up', moving: false, level: 9, vocation: 'ashguard' })]);
    const p = t.step(.05, 'ember-isle', { x: 0, y: 0 })[0];
    expect(p.dir).toBe('up'); expect(p.moving).toBeFalse(); expect(p.level).toBe(9); expect(p.vocation).toBe('ashguard');
    t.set([]);
    expect(t.size).toBe(0);
  });

  it('packs a look into a dozen characters and back, refusing junk', () => {
    const look = { ...defaultLook(), body: 'broad' as const, form: 'fem' as const, skin: 5, hair: 'bun' as const, hairColor: 9, outfit: 3, trim: 7, face: 'freckles' as const };
    const packed = packLook(look);
    expect(packed).toMatch(/^[0-9.]{1,48}$/);
    const back = unpackLook(packed, 'thornstrider', 'Mira')!;
    expect([back.body, back.form, back.skin, back.hair, back.hairColor, back.outfit, back.trim, back.face, back.vocation, back.name])
      .toEqual(['broad', 'fem', 5, 'bun', 9, 3, 7, 'freckles', 'thornstrider', 'Mira']);
    expect(unpackLook('<img>')).toBeNull();
    expect(unpackLook('99.99.99')!.skin).toBe(defaultLook().skin);
  });
});
