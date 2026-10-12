import { itemDefinitionById } from '../rpg/item-definition';
import { runeById } from '../rune-forge/rune.model';
import { craftingRecipeById } from '../crafting/crafting.model';
import { NPCS } from './npc.model';
import { ALL_NPC_STEPS } from './npc-quest.model';
import { DELVE_INSCRIPTIONS } from '../delve/delve-lore.model';
import { DELVE_INSCRIPTION_LORE } from '../delve/delve-inscription-lore';
import {
  DELVE_MISSIONS,
  KAEL_SEAM_PICK_RECIPE,
  MISSION_RECIPES,
  NULLTHORN_RECIPE,
  delveMissionById,
  missionGold,
  missionNextStep,
  missionObserved,
  missionTarget,
  missionsFrom,
  missionXpGrants,
  type MissionReadings,
} from './delve-missions.model';
import { WORLD_ACTION_MAX_XP, xpGrantChunks } from '../activity/activity.model';

// P-6 (docs/handoff/playtest-findings.md): The Fracture's 600 Delving XP went
// to the gateway as one action over its 500 ceiling and was refused whole.
describe('mission XP rewards are grantable (P-6)', () => {
  it('splits every mission reward into grants the gateway accepts, summing exactly', () => {
    for (const mission of DELVE_MISSIONS) {
      const xp = mission.reward.delvingXp ?? 0;
      for (const times of [0, 3]) {
        const grants = missionXpGrants(mission, times);
        expect(grants.reduce((sum, g) => sum + g.xp, 0)).withContext(mission.id).toBe(xp);
        for (const grant of grants) {
          // The same checks resolveWorldAction applies to an XP-only action.
          expect(Number.isInteger(grant.xp)).withContext(grant.mutationId).toBeTrue();
          expect(grant.xp).withContext(grant.mutationId).toBeGreaterThan(0);
          expect(grant.xp).withContext(grant.mutationId).toBeLessThanOrEqual(WORLD_ACTION_MAX_XP);
        }
        expect(new Set(grants.map(g => g.mutationId)).size).withContext(mission.id).toBe(grants.length);
      }
    }
  });

  it('pays The Fracture its full 600 in two grants, the first under the original key', () => {
    const grants = missionXpGrants(delveMissionById('delve-fracture')!, 0);
    expect(grants).toEqual([
      { mutationId: 'npc-mission:delve-fracture:0:xp', xp: 500 },
      { mutationId: 'npc-mission:delve-fracture:0:xp:2', xp: 100 },
    ]);
  });

  it('keeps a reward under the ceiling as one grant under its original key', () => {
    expect(missionXpGrants(delveMissionById('delve-verrin-shadow')!, 0))
      .toEqual([{ mutationId: 'npc-mission:delve-verrin-shadow:0:xp', xp: 150 }]);
  });

  it('chunks any amount exactly', () => {
    expect(xpGrantChunks(0)).toEqual([]);
    expect(xpGrantChunks(-5)).toEqual([]);
    expect(xpGrantChunks(500)).toEqual([500]);
    expect(xpGrantChunks(1001)).toEqual([500, 500, 1]);
    expect(xpGrantChunks(7, 3)).toEqual([3, 3, 1]);
  });
});

const readings = (stacks: Record<string, number>, inscriptions = 0): MissionReadings => ({
  stackOf: id => stacks[id] ?? 0,
  inscriptions,
  inscriptionTotal: DELVE_INSCRIPTIONS.length,
});
const name = (id: string) => id;
const npcName = (id: string) => NPCS.find(n => n.id === id)?.name ?? id;

describe('Delve missions', () => {
  it('has unique ids that never collide with a chain step', () => {
    const ids = DELVE_MISSIONS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const steps = new Set(ALL_NPC_STEPS.map(s => s.id));
    expect(ids.filter(id => steps.has(id))).toEqual([]);
  });

  it('only requires missions that exist, and never itself', () => {
    for (const m of DELVE_MISSIONS) {
      for (const req of m.requires ?? []) {
        expect(delveMissionById(req)).withContext(`${m.id} → ${req}`).toBeDefined();
        expect(req).not.toBe(m.id);
      }
    }
  });

  it('gives every mission a real NPC and a one-sentence brief', () => {
    const npcs = new Set(NPCS.map(n => n.id));
    for (const m of DELVE_MISSIONS) {
      expect(npcs.has(m.npcId)).withContext(m.id).toBeTrue();
      expect(m.brief.split(/[.!?](\s|$)/).filter(s => s && s.trim()).length).withContext(m.id).toBe(1);
    }
  });

  it('points every reward at something real', () => {
    for (const m of DELVE_MISSIONS) {
      const r = m.reward;
      if (r.recipe) expect(craftingRecipeById(r.recipe)).withContext(m.id).toBeDefined();
      if (r.rune) expect(runeById(r.rune)).withContext(m.id).toBeDefined();
      if (r.item) expect(itemDefinitionById(r.item.defId)).withContext(m.id).toBeDefined();
    }
  });

  it('gates the Nullthorn Staff behind Verrin and the Seam Pick behind Kael', () => {
    expect(MISSION_RECIPES[NULLTHORN_RECIPE]).toBe('delve-verrin-shadow');
    expect(MISSION_RECIPES[KAEL_SEAM_PICK_RECIPE]).toBe('delve-kael-seam');
    expect(craftingRecipeById(KAEL_SEAM_PICK_RECIPE)?.output.itemId).toBe('pickaxe-3');
  });

  it('has the Fracture follow the other three, offered by Kael and the Archivist', () => {
    const f = delveMissionById('delve-fracture')!;
    expect(f.requires).toEqual(['delve-verrin-shadow', 'delve-kael-seam', 'delve-merchant-glowcaps']);
    expect(missionsFrom('kael').map(m => m.id)).toContain('delve-fracture');
    expect(missionsFrom('archivist').map(m => m.id)).toContain('delve-fracture');
  });

  it('pays the Archivist at 3, 6 and every inscription', () => {
    const counts = ['delve-archivist-words-1', 'delve-archivist-words-2', 'delve-archivist-words-3']
      .map(id => missionTarget(delveMissionById(id)!.objective));
    expect(counts).toEqual([3, 6, DELVE_INSCRIPTIONS.length]);
    // Every inscription with canon text is carved in the Delve: three per biome, twelve in all.
    expect(DELVE_INSCRIPTIONS.length).toBe(12);
    expect(DELVE_INSCRIPTIONS.map(i => i.id).sort()).toEqual(Object.keys(DELVE_INSCRIPTION_LORE).sort());
    expect(delveMissionById('delve-archivist-words-3')!.brief).toBe('Copy all 12 inscriptions in the Ember Delve.');
  });

  it('caps each delivery line at its own count', () => {
    const kael = delveMissionById('delve-kael-seam')!;
    expect(missionTarget(kael.objective)).toBe(11);
    // Forty slag and no hammer is still 10 of 11, not done.
    expect(missionObserved(kael.objective, readings({ 'slag-fragment': 40 }))).toBe(10);
    expect(missionObserved(kael.objective, readings({ 'slag-fragment': 40, 'kaels-hammer': 1 }))).toBe(11);
  });

  it('says the one next step in plain words', () => {
    const kael = delveMissionById('delve-kael-seam')!;
    const step = (stacks: Record<string, number>, ready = false) =>
      missionNextStep(kael, { locked: false, ready, missingFirst: [] }, readings(stacks), name, npcName);
    expect(step({})).toBe('Find 10 more slag-fragment in Slag veins in the Basalt Caverns.');
    expect(step({ 'slag-fragment': 10 })).toContain("Find 1 more kaels-hammer in an old Keeper's cache");
    expect(step({}, true)).toBe('Hand it to Kael and claim your reward.');

    const f = delveMissionById('delve-fracture')!;
    expect(missionNextStep(f, { locked: true, ready: false, missingFirst: ['delve-kael-seam'] }, readings({}), name, npcName))
      .toBe('Finish "The Old Seam" first.');

    const words = delveMissionById('delve-archivist-words-1')!;
    expect(missionNextStep(words, { locked: false, ready: false, missingFirst: [] }, readings({}, 2), name, npcName))
      .toBe('Copy 1 more inscription in the Ember Delve.');
  });

  it('prices the glowcap order in seconds of income, with a floor', () => {
    const order = delveMissionById('delve-merchant-glowcaps')!.reward;
    // Economy v3: a floor buyer — 3,000 × ρ = 180, or 90 s of income.
    expect(missionGold(order, 0)).toBe(180);
    expect(missionGold(order, Number.NaN)).toBe(180);
    expect(missionGold(order, 1)).toBe(180);
    expect(missionGold(order, 1_000)).toBe(90_000);
  });

  it('writes canon text for every inscription the Delve lists', () => {
    for (const ins of DELVE_INSCRIPTIONS) {
      const lore = DELVE_INSCRIPTION_LORE[ins.id];
      expect(lore).withContext(ins.id).toBeDefined();
      const sentences = lore.text.split(/[.!?]["”]?(\s|$)/).filter(s => s && s.trim()).length;
      expect(sentences).withContext(ins.id).toBeGreaterThanOrEqual(2);
      expect(sentences).withContext(ins.id).toBeLessThanOrEqual(4);
    }
  });
});
