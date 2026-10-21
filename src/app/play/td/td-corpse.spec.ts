/**
 * td-corpse.spec.ts — what the fallen leave behind (td-corpse.ts): the decay timeline, the cap, and the loot link.
 */
import type { EngineOptions } from '../engine/engine.model';
import {
  CORPSE_BONES_SECS, CORPSE_BOSS_STAY, CORPSE_CAP, CORPSE_FRESH_SECS, CORPSE_ROT_SECS,
  corpseAlpha, corpseLife, corpseStage, layCorpse, leavesAsh, weatherCorpses, type Corpse,
} from './td-corpse';
import { corpseSprite, flyDots } from './td-corpse-art';
import { MOBS, MobSystem, type MobHost } from './td-mobs';

function world(): { sys: MobSystem; loot: unknown[] } {
  const loot: unknown[] = [];
  const host: MobHost = {
    options: { onLoot: (l: unknown) => { loot.push(l); return true; } } as unknown as EngineOptions,
    walkable: () => true,
    levelId: () => 'spec',
    player: () => ({ x: 0, y: 0 }),
    hurtPlayer: () => undefined,
    healPlayer: () => undefined,
    swung: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  return { sys, loot };
}

const fake = (id: string, born = 0, boss = false): Corpse => ({ id, x: 0, y: 0, kind: { id: 'ash-wolf', name: 'Ash Wolf', w: 30, h: 22 }, def: MOBS['ash-wolf'], face: 1, born, boss, seed: 7 });

describe('corpse decay', () => {
  it('goes fresh, rotting, bones, gone on the timeline (about three and a half minutes)', () => {
    expect(corpseStage(0, false)).toBe('fresh');
    expect(corpseStage(CORPSE_FRESH_SECS - .1, false)).toBe('fresh');
    expect(corpseStage(CORPSE_FRESH_SECS, false)).toBe('rotting');
    expect(corpseStage(CORPSE_ROT_SECS - .1, false)).toBe('rotting');
    expect(corpseStage(CORPSE_ROT_SECS, false)).toBe('bones');
    expect(corpseStage(CORPSE_BONES_SECS - .1, false)).toBe('bones');
    expect(corpseStage(CORPSE_BONES_SECS, false)).toBe('gone');
    expect(CORPSE_BONES_SECS).toBeGreaterThanOrEqual(180);
    expect(CORPSE_BONES_SECS).toBeLessThanOrEqual(240);
  });
  it('a boss lies longer, every stage scaled', () => {
    expect(corpseLife(true)).toBe(CORPSE_BONES_SECS * CORPSE_BOSS_STAY);
    expect(corpseStage(CORPSE_FRESH_SECS * 1.5, true)).toBe('fresh');
    expect(corpseStage(CORPSE_FRESH_SECS * 1.5, false)).toBe('rotting');
    expect(corpseStage(CORPSE_BONES_SECS * 1.5, true)).toBe('bones');
    expect(corpseStage(CORPSE_BONES_SECS * 2, true)).toBe('gone');
  });
  it('sinks away only in the last seconds of the bones', () => {
    expect(corpseAlpha(10, false)).toBe(1);
    expect(corpseAlpha(CORPSE_BONES_SECS - 20, false)).toBe(1);
    const late = corpseAlpha(CORPSE_BONES_SECS - 2, false);
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(1);
    expect(corpseAlpha(CORPSE_BONES_SECS, false)).toBe(0);
  });
  it('weathers the finished ones out of the list and keeps the rest', () => {
    const list = [fake('a', 0), fake('b', 100), fake('c', 0, true)];
    expect(weatherCorpses(list, CORPSE_BONES_SECS + 1).map(c => c.id)).toEqual(['a']);
    expect(list.map(c => c.id)).toEqual(['b', 'c']);
    expect(weatherCorpses(list, CORPSE_BONES_SECS * 2 + 101).length).toBe(2);
    expect(list.length).toBe(0);
  });
});

describe('the corpse cap', () => {
  it('holds at most 40, the oldest giving way first', () => {
    expect(CORPSE_CAP).toBe(40);
    const list: Corpse[] = [];
    let gone: Corpse[] = [];
    for (let i = 0; i < 45; i++) gone = gone.concat(layCorpse(list, fake(`c${i}`, i)));
    expect(list.length).toBe(40);
    expect(gone.map(c => c.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
    expect(list[0].id).toBe('c5');
  });
  it('holds in the mob system too, through real kills', () => {
    const { sys } = world();
    for (let i = 0; i < 45; i++) sys.smite(sys.place(`wolf-${i}`, { ...MOBS['ash-wolf'], speed: 0, sight: 0 }, 20 * i, 0));
    expect(sys.remains.length).toBe(40);
  });
});

describe('a kill leaves a corpse with its loot beside it', () => {
  it('lays the corpse where it fell and tags the drops with its id', () => {
    const { sys } = world();
    const m = sys.place('w', { ...MOBS['ash-wolf'], speed: 0, sight: 0 }, 50, 20);
    sys.smite(m);
    expect(sys.remains.length).toBe(1);
    const cp = sys.remains[0];
    expect(cp.x).toBe(50); expect(cp.y).toBe(20);
    expect(cp.kind.id).toBe('ash-wolf');
    const loot = sys.corpseLoot(cp.id);
    expect(loot.length).toBeGreaterThan(0);
    expect(loot.some(d => d.coins > 0)).toBeTrue();
    expect(sys.drops.every(d => d.corpse === cp.id)).toBeTrue();
  });
  it('lets the Keeper take a piece out of it (and the walk-over pickup still exists)', () => {
    const { sys, loot } = world();
    sys.smite(sys.place('w', { ...MOBS['ash-wolf'], speed: 0, sight: 0 }, 50, 20));
    const cp = sys.remains[0];
    const before = sys.corpseLoot(cp.id).length;
    expect(sys.takeDrop(sys.corpseLoot(cp.id)[0].id)).toBeTrue();
    expect(sys.corpseLoot(cp.id).length).toBe(before - 1);
    expect(loot.length).toBe(1);
    // The rest lies there to walk over: the Keeper stands on it.
    for (let t = 0; t < 1.5; t += .05) sys.update(.05);
    expect(sys.drops.length).toBeLessThan(before - 1 + 1);
  });
  it('finds a corpse near the Keeper only while it holds loot, and under a tap', () => {
    const { sys } = world();
    sys.smite(sys.place('w', { ...MOBS['ash-wolf'], speed: 0, sight: 0 }, 50, 20));
    const cp = sys.remains[0];
    expect(sys.corpseNear(40, 20)?.id).toBe(cp.id);
    expect(sys.corpseNear(300, 20)).toBeNull();
    expect(sys.corpseAt(50, 14)?.id).toBe(cp.id);
    expect(sys.corpseAt(150, 14)).toBeNull();
    for (const d of sys.corpseLoot(cp.id)) sys.takeDrop(d.id);
    expect(sys.corpseNear(40, 20)).toBeNull();
  });
  it('rots with the system clock and leaves the list when its time is up', () => {
    const { sys } = world();
    sys.smite(sys.place('w', { ...MOBS['ash-wolf'], speed: 0, sight: 0 }, 400, 20));
    const cp = sys.remains[0];
    expect(corpseStage(sys.age - cp.born, cp.boss)).toBe('fresh');
    for (let t = 0; t < CORPSE_FRESH_SECS + 5; t += .5) sys.update(.5);
    expect(corpseStage(sys.age - cp.born, cp.boss)).toBe('rotting');
    for (let t = 0; t < CORPSE_BONES_SECS; t += 1) sys.update(1);
    expect(sys.remains.length).toBe(0);
  });
  it('lays a corpse for a Keeper who only shared the kill, with no loot in it', () => {
    const { sys } = world();
    const m = sys.place('w', { ...MOBS['ash-wolf'], speed: 0, sight: 0 }, 50, 20);
    sys.coopFell(m, false, m.def.hp);
    expect(sys.remains.length).toBe(1);
    expect(sys.corpseLoot(sys.remains[0].id).length).toBe(0);
  });
  it('lays a corpse with loot for a member who fought, and the same kind of corpse as the host', () => {
    const host = world().sys, member = world().sys;
    const a = host.place('w', { ...MOBS['bone-walker'], speed: 0, sight: 0 }, 50, 20);
    const b = member.place('w', { ...MOBS['bone-walker'], speed: 0, sight: 0 }, 51, 20);
    host.smite(a);
    member.coopFell(b, true, b.def.hp);
    expect(member.remains[0].kind.id).toBe(host.remains[0].kind.id);
    expect(member.corpseLoot(member.remains[0].id).length).toBeGreaterThan(0);
  });
  it('keeps a boss corpse alive past a common one', () => {
    const { sys } = world();
    sys.smite(sys.place('boss', { ...MOBS['magma-tyrant'], speed: 0, sight: 0 }, 100, 0));
    expect(sys.remains[0].boss).toBeTrue();
    for (let t = 0; t < CORPSE_BONES_SECS + 5; t += 1) sys.update(1);
    expect(sys.remains.length).toBe(1);
  });
});

describe('corpse art', () => {
  it('paints each stage from the creature, and flies hang over only a rotting one', () => {
    const c = fake('x');
    const fresh = corpseSprite(c, 'fresh'), rot = corpseSprite(c, 'rotting'), bones = corpseSprite(c, 'bones');
    for (const s of [fresh, rot, bones]) { expect(s.width).toBeGreaterThan(0); expect(s.height).toBeLessThan(MOBS['ash-wolf'].h); }
    const px = (s: HTMLCanvasElement) => Array.from(s.getContext('2d')!.getImageData(0, 0, s.width, s.height).data).join(',');
    expect(px(fresh)).not.toBe(px(rot));
    expect(px(rot)).not.toBe(px(bones));
    expect(flyDots(c, 1).length).toBe(3);
  });
  it('knows what leaves ash and what leaves blood', () => {
    expect(leavesAsh('bone-walker')).toBeTrue();
    expect(leavesAsh('ash-wolf')).toBeFalse();
    expect(leavesAsh('cinder-orc')).toBeFalse();
    expect(leavesAsh('cinder-imp')).toBeTrue();
    expect(leavesAsh('anything', true)).toBeTrue();
  });
});
