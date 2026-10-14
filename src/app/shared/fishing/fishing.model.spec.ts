import {
  BAITS, CATCHES, catchById, catchTable, catchXp, coerceFishingSave, CRATE_CONTENTS, CRATE_IDS, crateStep, fishingPerks, GRADE_XP, gradeFor,
  LEDGER_CATCH_IDS, ledgerCatch, ledgerGift, LODGE_CHARMS, mergeFishingSaves, openCrate, rodFor, rollCatch, RODS, waterFor, WATERS, type WaterId,
} from './fishing.model';
import { reelResult, reelStart, reelStep, reelDuration } from './fishing-reel';
import { SKILL_UNLOCKS } from '../skills/skill-unlocks';
import { DELVE_MISSIONS, DROWNED_LAMP_FLAG, missionFishingXpGrants, missionObserved, missionTarget } from '../npc/delve-missions.model';
import { DROWNED_LAMP_FLAG as ENGINE_FLAG } from '../../play/world/towns/infernal';
import { CRAFTING_RECIPES } from '../crafting/crafting.model';
import { materialDisplay } from '../rpg/material-catalog';

const WATER_IDS = Object.keys(WATERS) as WaterId[];

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('fishing.model: the catch tables', () => {
  it('every water\'s table sums to 1, with or without bait, quest or legendary caught', () => {
    for (const water of WATER_IDS) {
      for (const ctx of [
        { water, bait: 0 },
        { water, bait: .35, nightGlow: true },
        { water, bait: .2, quest: { id: 'tallyfish', water }, caught: () => 1, cratePerk: .008 },
      ]) {
        const sum = catchTable(ctx).reduce((s, row) => s + row.p, 0);
        expect(sum).withContext(`${water} ${JSON.stringify(ctx)}`).toBeCloseTo(1, 9);
        expect(catchTable(ctx).every(row => row.p >= 0)).toBeTrue();
      }
    }
  });

  it('sits on the spec\'s ladder: about 70% common, a 0.1% legendary (0.02% once caught), crates 0.4-2%', () => {
    const mere = catchTable({ water: 'mere', bait: 0 });
    const by = (rarity: string) => mere.filter(r => r.rarity === rarity).reduce((s, r) => s + r.p, 0);
    expect(by('legendary')).toBeCloseTo(.001, 6);
    expect(by('crate')).toBeCloseTo(.004, 6);
    expect(by('junk')).toBeCloseTo(.015, 6);
    expect(by('common') + by('uncommon')).toBeGreaterThan(.85);
    const again = catchTable({ water: 'mere', bait: 0, caught: () => 1 });
    expect(again.find(r => r.rarity === 'legendary')!.p).toBeCloseTo(.0002, 6);
    const baited = catchTable({ water: 'seep', bait: .35, cratePerk: .008 }).find(r => r.rarity === 'crate')!;
    expect(baited.p).toBeLessThanOrEqual(.02 + 1e-12);
  });

  it('only offers the Ledger Catch fish while it is the day\'s quest, in its water', () => {
    expect(catchTable({ water: 'mere', bait: 0 }).some(r => r.rarity === 'quest')).toBeFalse();
    expect(catchTable({ water: 'mere', bait: 0, quest: { id: 'ledgerfin', water: 'seep' } }).some(r => r.rarity === 'quest')).toBeFalse();
    expect(catchTable({ water: 'mere', bait: 0, quest: { id: 'ledgerfin', water: 'mere' } }).find(r => r.rarity === 'quest')!.id).toBe('ledgerfin');
  });

  it('rolls deterministically on the RNG it is handed', () => {
    const a = Array.from({ length: 50 }, (_, i) => rollCatch({ water: 'magma', bait: .1 }, seeded(i)).id);
    const b = Array.from({ length: 50 }, (_, i) => rollCatch({ water: 'magma', bait: .1 }, seeded(i)).id);
    expect(a).toEqual(b);
    expect(a.every(id => !!catchById(id))).toBeTrue();
  });

  it('maps biome and liquid to a water: seeps up top, the Mere below, lava is Magma', () => {
    expect(waterFor('root-hollows', 'water')).toBe('seep');
    expect(waterFor('basalt-caverns', 'water')).toBe('seep');
    expect(waterFor('glowcap-grotto', 'water')).toBe('mere');
    expect(waterFor('magma-halls', 'lava')).toBe('magma');
  });

  it('every catch has a name, a lore line, a use line, a display row, and a recipe input catalogued where it is one', () => {
    for (const c of CATCHES) {
      expect(c.lore.length).withContext(c.id).toBeGreaterThan(10);
      expect(c.use.length).withContext(c.id).toBeGreaterThan(5);
      expect(materialDisplay(c.id)?.name).withContext(c.id).toBe(c.name);
    }
    expect(LEDGER_CATCH_IDS.length).toBe(20);
    for (const b of BAITS) expect(materialDisplay(b.id)).withContext(b.id).toBeTruthy();
  });
});

describe('fishing.model: XP, grades, perks, rods', () => {
  it('XP rises with the water\'s tier, never with the angler\'s level, and a grade only ever adds', () => {
    expect(catchXp('seep', 'common', 'off')).toBe(6);
    expect(catchXp('mere', 'common', 'off')).toBe(8);
    expect(catchXp('magma', 'common', 'off')).toBe(18);
    expect(catchXp('magma', 'legendary', 'off')).toBe(180);
    for (const water of WATER_IDS) for (const rarity of ['common', 'uncommon', 'rare', 'legendary', 'junk', 'crate', 'quest'] as const) {
      expect(catchXp(water, rarity, 'perfect')).toBeGreaterThanOrEqual(catchXp(water, rarity, 'good'));
      expect(catchXp(water, rarity, 'good')).toBeGreaterThanOrEqual(catchXp(water, rarity, 'off'));
      expect(catchXp(water, rarity, 'perfect')).toBeLessThanOrEqual(500);
    }
    expect(Math.min(...Object.values(GRADE_XP))).toBe(1);
  });

  it('grades by the time inside: Perfect at 90%, Good at 60%', () => {
    expect(gradeFor(.95)).toBe('perfect');
    expect(gradeFor(.9)).toBe('perfect');
    expect(gradeFor(.75)).toBe('good');
    expect(gradeFor(.3)).toBe('off');
  });

  it('a Perfect steps a crate up one tier', () => {
    expect(crateStep('root-crate')).toBe('seam-crate');
    expect(crateStep('seam-crate')).toBe('seam-crate');
  });

  it('a rod works as the tier the Fishing level allows ("works as tier N until Fishing L")', () => {
    const held = (...ids: string[]) => (id: string) => (ids.includes(id) ? 1 : 0);
    expect(rodFor(held(), 50)).toBeNull();
    expect(rodFor(held('worn-rod'), 1)!.works.id).toBe('worn-rod');
    expect(rodFor(held('seam-rod'), 5)!.works.liquids).toEqual(['water']);
    expect(rodFor(held('seam-rod'), 10)!.works.liquids).toEqual(['water', 'lava']);
    expect(rodFor(held('worn-rod', 'glowline-rod'), 30)!.works.id).toBe('glowline-rod');
  });

  it('every rod recipe is gated by the Fishing level that wears it (no Gold buys past the gate)', () => {
    for (const rod of RODS.filter(r => r.id !== 'worn-rod')) {
      const recipe = CRAFTING_RECIPES.find(r => r.output.itemId === rod.id)!;
      expect(recipe).withContext(rod.id).toBeTruthy();
      expect(recipe.skill).toBe('fishing');
      expect(recipe.requiredLevel).toBe(rod.level);
    }
  });

  it('the Skills panel rows: something every 15 levels, bite speed in 5% steps, Mastery at 99', () => {
    const rows = SKILL_UNLOCKS.fishing;
    for (let level = 1; level <= 99; level += 15) expect(rows.some(r => r.level >= level && r.level < level + 15)).withContext(`${level}`).toBeTrue();
    expect(rows.at(-1)!.kind).toBe('mastery');
    expect(fishingPerks(1).bite).toBe(1);
    expect(fishingPerks(50).bite).toBeCloseTo(1.25, 9);
    expect(fishingPerks(90).window).toBeCloseTo(.12, 9);
  });
});

describe('fishing-reel: Line Tension always lands', () => {
  it('lands at every grade, whatever is held, for every rarity', () => {
    for (const rarity of ['common', 'uncommon', 'rare', 'legendary', 'junk', 'crate', 'quest'] as const) {
      for (const pattern of ['never', 'always', 'flutter'] as const) {
        const s = reelStart(7, rarity);
        let n = 0;
        while (!reelStep(s, 1 / 60, pattern === 'always' || (pattern === 'flutter' && (n++ % 20) < 10), rarity)) { /* play */ }
        const result = reelResult(s);
        expect(result.landed).toBeTrue();
        expect(['perfect', 'good', 'off']).toContain(result.grade);
        expect(s.t).toBeCloseTo(reelDuration(rarity), 6);
      }
    }
  });

  it('a player who tracks the fish does better than one who never holds', () => {
    const idle = reelStart(11, 'common');
    while (!reelStep(idle, 1 / 60, false)) { /* never holds */ }
    const keen = reelStart(11, 'common');
    while (!reelStep(keen, 1 / 60, keen.fish > keen.window)) { /* chases the fish */ }
    expect(reelResult(keen).inside).toBeGreaterThan(reelResult(idle).inside);
    expect(reelResult(keen).grade).not.toBe('off');
  });

  it('the Lodge Reel and the window perk widen the window', () => {
    expect(reelStart(1, 'common', .2).width).toBeGreaterThan(reelStart(1, 'common', 0).width);
  });
});

describe('fishing.model: crates, the Ledger Catch, the save', () => {
  it('crates are never empty and hold only catalogued stacks', () => {
    for (const id of CRATE_IDS) for (let s = 0; s < 30; s++) {
      const got = openCrate(id, seeded(s));
      expect(got.length).toBeGreaterThan(0);
      for (const row of got) expect(materialDisplay(row.id)).withContext(row.id).toBeTruthy();
    }
    expect(Object.keys(CRATE_CONTENTS).sort()).toEqual([...CRATE_IDS].sort());
  });

  it('the Ledger Catch is one fish a day, fixed by the day and the seed, from the family', () => {
    const a = ledgerCatch('2026-10-14', 42), b = ledgerCatch('2026-10-14', 42);
    expect(a).toEqual(b);
    expect(LEDGER_CATCH_IDS).toContain(a.id);
    const days = new Set(Array.from({ length: 30 }, (_, d) => ledgerCatch(`2026-11-${String(d + 1).padStart(2, '0')}`, 42).id));
    expect(days.size).toBeGreaterThan(5);
    expect(ledgerGift(5)?.id).toBe('tackle-box');
    expect(ledgerGift(10)?.id).toBe('anglers-patience');
    expect(ledgerGift(25)?.id).toBe('lodge-reel');
    expect(ledgerGift(6)).toBeUndefined();
    expect(LODGE_CHARMS.length).toBe(3);
  });

  it('the save coerces junk away and merges two devices commutatively', () => {
    const a = coerceFishingSave({ caught: { blindfin: 3, 'bad id!': 2, emberling: -1 }, turnIns: 4, lastTurnIn: '2026-10-13', opened: 2 });
    expect(a.caught).toEqual({ blindfin: 3 });
    const b = coerceFishingSave({ caught: { blindfin: 1, 'mere-perch': 2 }, turnIns: 6, lastTurnIn: '2026-10-14', opened: 1 });
    expect(mergeFishingSaves(a, b)).toEqual(mergeFishingSaves(b, a));
    expect(mergeFishingSaves(a, b)).toEqual({ version: 1, caught: { blindfin: 3, 'mere-perch': 2 }, turnIns: 6, lastTurnIn: '2026-10-14', opened: 2 });
    expect(coerceFishingSave(null).turnIns).toBe(0);
  });
});

describe('fishing missions: the Drowned Lamp and the orders', () => {
  it('the Archivist\'s chain reads a delivery, a reading and a felled boss, in order', () => {
    const [one, two, three] = ['fish-drowned-lamp-1', 'fish-drowned-lamp-2', 'fish-drowned-lamp-3'].map(id => DELVE_MISSIONS.find(m => m.id === id)!);
    expect(one.objective.kind).toBe('deliver');
    expect(two.requires).toEqual(['fish-drowned-lamp-1']);
    expect(three.requires).toEqual(['fish-drowned-lamp-2']);
    const readings = { stackOf: () => 0, inscriptions: 0, inscriptionTotal: 12, read: (id: string) => id === 'grotto-drowned-lamp', flagged: () => false };
    expect(missionTarget(two.objective)).toBe(1);
    expect(missionObserved(two.objective, readings)).toBe(1);
    expect(missionObserved(three.objective, readings)).toBe(0);
    expect(missionObserved(three.objective, { ...readings, flagged: f => f === DROWNED_LAMP_FLAG })).toBe(1);
    expect(DROWNED_LAMP_FLAG).toBe(ENGINE_FLAG);
    expect(missionFishingXpGrants(three, 0).reduce((s, g) => s + g.xp, 0)).toBe(300);
  });

  it('every fishing mission delivers catalogued catches and pays Fishing XP or Gold', () => {
    for (const m of DELVE_MISSIONS.filter(row => row.id.startsWith('fish-'))) {
      if (m.objective.kind === 'deliver') for (const row of m.objective.items) expect(materialDisplay(row.materialId)).withContext(row.materialId).toBeTruthy();
      expect(m.reward.gold).toBeGreaterThan(0);
    }
  });
});
