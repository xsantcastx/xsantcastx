/**
 * td-truth-passives.spec.ts — the ordinary uniques' passives are real (owner 2026-10-21: "still not done": ~44 uniques
 * read a passive no code applied). Companion to td-truth.spec.ts (skills) and td-truth-gear.spec.ts (stats, sets,
 * boss uniques).
 *
 * Every ordinary unique (shared/rpg/unique-items.ts, not a boss's, not a set piece) must:
 *   1. carry a `sig` — what its passive does in the top-down fight (a unique without one fails);
 *   2. have a PROBE for every field of that sig (a new kind of passive without one fails), which wears ONLY that unique
 *      in a real MobSystem and MEASURES the field: the Magic Find and the named pull the loot roll is handed, the XP and
 *      the Gold pile a kill pays, the share of a bite turned back, the beat and lift of an echoing hit, the reprieve
 *      and how long it rests, the mana a kill gives back, the life a second — and the measurement must be the sig;
 *   3. say only that: its passive line and its card line (en and es) quote only numbers its sig carries;
 *   4. be reachable: an open loot roll can land on it, at its authored rarity (drop-tables uniquesAt).
 */
import type { EngineOptions } from '../engine/engine.model';
import { NO_RELICS, relicRegen, relicTotals, type RelicSig } from '../../shared/rpg/boss-uniques';
import { UNIQUE_ITEMS, relicSigOf, sigIds, type UniqueItem } from '../../shared/rpg/unique-items';
import { RUNG_LEVEL, UNIQUE_SHARE, rarityChances, rollCreatureLoot, uniqueShare, uniquesAt } from '../../shared/loot/drop-tables';
import { seededRandom } from '../../shared/loot/champions';
import { HUD_I18N } from '../world/hud.i18n';
import { MOBS, MobSystem, type Mob, type MobDef, type MobHost } from './td-mobs';

const ORDINARY = UNIQUE_ITEMS.filter(u => !u.boss && !u.set);

interface World {
  sys: MobSystem; life: { hp: number }; kills: { xp?: number }[]; rolls: { mf?: number; named?: number }[];
}
function world(wear: readonly string[] = []): World {
  const keeper = { x: 0, y: 0, face: 1 }, life = { hp: 5000 }, kills: { xp?: number }[] = [], rolls: { mf?: number; named?: number }[] = [];
  const host: MobHost = {
    options: {
      onKill: (e: { xp?: number }) => { kills.push(e); },
      rollLoot: (ctx: { mf?: number; named?: number }) => { rolls.push(ctx); return []; },
    } as unknown as EngineOptions,
    walkable: () => true, levelId: () => 'truth', player: () => keeper,
    hurtPlayer: n => { life.hp = Math.max(0, life.hp - n); }, healPlayer: n => { life.hp += n; },
    swung: () => undefined, playerHp: () => life.hp,
  };
  const sys = new MobSystem(host);
  sys.vocation = 'warlock'; sys.aura = null; sys.keeperMaxHp = 5000;
  sys.setRanks({}, null);
  sys.setRelics(relicTotals(sigIds(wear), relicSigOf));
  sys.mana = 0; sys.maxMana = 99999; sys.power = 1; sys.crit = 0; sys.defense = 0; sys.resists = {};
  return { sys, life, kills, rolls };
}
const DUMMY = MOBS['ash-wolf'];
function dummy(w: World, def: MobDef = DUMMY, hp = 1e7): Mob {
  const m = w.sys.place(`d${w.sys.mobs.length}`, { ...def, hp, sight: 0, dmg: [0, 0], rate: 999 }, 40, 0);
  m.hp = hp; m.wait = 1e9; m.cd = 999;
  return m;
}
/** A creature that bites the Keeper for exactly `n`, standing beside him. */
function biter(w: World, n: number): Mob {
  const m = w.sys.place(`b${w.sys.mobs.length}`, { ...DUMMY, hp: 1e7, sight: 999, dmg: [n, n], rate: 999, speed: 0 }, 10, 0);
  m.hp = 1e7; m.cd = 0; m.wait = 1e9;
  return m;
}
/** Step until `m` has bitten once (its blow waits `rate` after). */
function oneBite(w: World, m: Mob): void { for (let i = 0; i < 50 && m.cd <= 0; i++) w.sys.update(.02); }
const hitFoe = (w: World, m: Mob, raw: number) => (w.sys as unknown as { hitFoe(m: Mob, raw: number, c: string): number }).hitFoe(m, raw, '#fff');

/** A kill of a fat, high creature (the Gold pile big enough that a percent is not lost to rounding). */
const RICH: MobDef = { ...DUMMY, id: 'truth-rich', level: 60, rank: 'boss' };
function killOnce(w: World, def: MobDef = DUMMY): void { w.sys.smite(dummy(w, def, 10)); }

/** Each field a passive may carry, MEASURED in the fight wearing only `u`. */
const PROBES: { [K in keyof RelicSig]?: (u: UniqueItem) => unknown } = {
  mf: u => { const w = world([u.id]); killOnce(w); return w.rolls[0]?.mf ?? 0; },
  named: u => { const w = world([u.id]); killOnce(w); return w.rolls[0]?.named ?? 0; },
  xp: u => {
    const bare = world(), worn = world([u.id]);
    killOnce(bare); killOnce(worn);
    return Math.round(((worn.kills[0]?.xp ?? 1) / (bare.kills[0]?.xp ?? 1) - 1) * 1e4) / 100;
  },
  gold: u => {
    const pile = (w: World) => { killOnce(w, RICH); return w.sys.drops.find(d => d.coins > 0)?.coins ?? 0; };
    const spy = spyOn(Math, 'random').and.returnValue(.5);
    try {
      const a = pile(world()), b = pile(world([u.id]));
      return Math.round((b / a - 1) * 100);
    } finally { spy.and.callThrough(); }
  },
  thorns: u => {
    const w = world([u.id]), m = biter(w, 400);
    oneBite(w, m);
    return (1e7 - m.hp) / 400 * 100;
  },
  echo: u => {
    const w = world([u.id]), m = dummy(w);
    const got = Array.from({ length: 12 }, () => hitFoe(w, m, 100));
    const every = got.findIndex(n => n > 100) + 1;
    // The beat holds all the way: exactly every `every`-th hit is lifted, by the same amount.
    const beat = got.every((n, i) => ((i + 1) % every === 0) === (n > 100)) && new Set(got.filter(n => n > 100)).size === 1;
    return beat && every > 0 ? { every, pct: got[every - 1] - 100 } : null;
  },
  mercy: u => {
    const w = world([u.id]);
    w.life.hp = 100;
    const m = biter(w, 1000);
    oneBite(w, m);
    if (w.life.hp !== 1) return NaN;                       // spared on one point of life
    const rest = w.sys.mercyT;
    w.life.hp = 100; m.cd = 0; oneBite(w, m);
    if (w.life.hp !== 0) return NaN;                       // and not again while it rests
    for (let t = 0; t < rest + .1; t += .1) w.sys.update(.1);
    w.life.hp = 100; m.cd = 0; oneBite(w, m);
    return w.life.hp === 1 ? Math.round(rest) : NaN;       // ready again once it has rested
  },
  manaKill: u => { const w = world([u.id]); killOnce(w); return w.sys.mana; },
  // Life a second: what the engine pays (td-engine relicRegen of the worn totals), standing or walking.
  regen: u => relicRegen(0, relicTotals(sigIds([u.id]), relicSigOf), false),
};

/** Every number a line prints, word-numbers ("third", "one point") aside. */
const numbers = (s: string) => [...s.matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
const flat = (o: unknown): number[] => typeof o === 'number' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(flat) : [];

describe('td-truth passives: every ordinary unique does what its passive says', () => {
  it('there are ordinary uniques to check (the filter did not empty the list)', () => {
    expect(ORDINARY.length).toBeGreaterThan(40);
  });

  for (const u of ORDINARY) {
    describe(u.name, () => {
      it('carries a signature, and every field of it has a probe', () => {
        expect(u.sig).withContext(`${u.id} has passive text but no sig`).toBeDefined();
        const keys = Object.keys(u.sig ?? {}) as (keyof RelicSig)[];
        expect(keys.length).withContext(u.id).toBeGreaterThan(0);
        for (const k of keys) expect(PROBES[k]).withContext(`${u.id}: no probe measures "${k}"`).toBeDefined();
      });

      it('the fight measures exactly its signature', () => {
        for (const [k, want] of Object.entries(u.sig ?? {}) as [keyof RelicSig, unknown][]) {
          expect(PROBES[k]?.(u)).withContext(`${u.id} ${k}`).toEqual(want);
        }
      });

      it('its lines (the passive, and the card in en and es) quote only its signature\'s numbers', () => {
        const have = flat(u.sig);
        const card = HUD_I18N['play.relic.sig.' + u.id];
        expect(card).withContext(`${u.id}: no card line`).toBeDefined();
        for (const text of [u.passive.text, card?.en ?? '', card?.es ?? '']) {
          for (const n of numbers(text)) expect(have).withContext(`${u.id}: "${text}" says ${n}`).toContain(n);
        }
        expect(numbers(card?.es ?? '')).withContext(u.id).toEqual(numbers(card?.en ?? ''));
        expect(numbers(u.passive.text)).withContext(u.id).toEqual(numbers(card?.en ?? ''));
      });

      it('an open loot roll can land on it, at its authored rarity', () => {
        expect(uniquesAt(u.rarity).map(x => x.id)).withContext(u.id).toContain(u.id);
        // Its rung opens from RUNG_LEVEL (the card's "Found in" line names it).
        expect(rarityChances(Math.max(1, RUNG_LEVEL[u.rarity]), 0, 0)[u.rarity]).withContext(u.id).toBeGreaterThan(0);
      });
    });
  }

  it('worn alone, the boss uniques and set tiers are untouched by the ordinary fields (no cross-talk)', () => {
    const t = relicTotals(['unique-wardens-last-ember'], relicSigOf);
    expect(t.xp).toBe(0); expect(t.gold).toBe(0); expect(t.thorns).toBe(0); expect(t.echo).toEqual([]);
    expect(t.mercy).toBe(0); expect(t.manaKill).toBe(0); expect(t.named).toBe(0);
    expect(relicTotals([], relicSigOf)).toEqual({ ...NO_RELICS, ranks: {}, cdCut: {}, echo: [] });
  });

  it('the named pull lifts the unique share by exactly its %, and the loot roll honours it', () => {
    expect(uniqueShare({ magicFind: 0 })).toBeCloseTo(UNIQUE_SHARE, 10);
    expect(uniqueShare({ magicFind: 0, named: 25 })).toBeCloseTo(UNIQUE_SHARE * 1.25, 10);
    expect(uniqueShare({ magicFind: 0, named: 1e6 })).toBe(.5);
    // Sampled: a boss's rolls at a high level, with and without a 60% pull.
    const share = (named: number) => {
      const rng = seededRandom(7);
      let items = 0, uniq = 0;
      for (let i = 0; i < 6000; i++) for (const d of rollCreatureLoot({ creature: 'ash-wolf', level: 40, tier: 'normal', magicFind: 0, rank: 'boss', named }, rng)) {
        if (d.kind !== 'item') continue;
        const open = uniquesAt(d.rarity);
        if (d.unique && !open.some(x => x.id === d.definitionId)) continue;   // a set piece's own roll, not the open one
        if (open.length) { items++; if (d.unique) uniq++; }
      }
      return uniq / items;
    };
    expect(share(60) / share(0)).toBeGreaterThan(1.4);
    expect(share(60) / share(0)).toBeLessThan(1.8);
  });
});
