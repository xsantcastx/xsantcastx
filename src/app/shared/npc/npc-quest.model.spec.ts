/**
 * npc-quest.model.spec.ts — the chains, checked for the things a hand edit
 * breaks silently.
 *
 * A chain step that names a cosmetic variant which does not exist, or an item
 * definition that was renamed, fails at *claim time* — long after the change,
 * on one visitor's machine, with `grantCosmetic` quietly returning false and no
 * error anywhere. Those are the gates worth having, and every one of them is
 * cheap because the catalogues are all pure data.
 */
import { COSMETICS } from '../economy/economy.model';
import { ITEM_DEFINITIONS } from '../rpg/item-definition';
import { EASTER_EGGS } from '../easter-eggs/easter-egg.service';
import { EGG_HINTS } from '../../codex/codex-hints';
import { progressKey } from '../quests/quest.model';
import { canonicalizePlayerPath } from '../canonical-routes';
import { RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import { NPCS, NpcId } from './npc.model';
import {
  ALL_NPC_STEPS,
  NPC_CHAINS,
  npcStepById,
  objectiveTarget,
} from './npc-quest.model';

describe('the chains', () => {
  it('gives every character a chain', () => {
    for (const npc of NPCS) {
      expect(NPC_CHAINS[npc.id]?.length).withContext(npc.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('offers five steps to each of the five open characters', () => {
    for (const id of ['aureth', 'verrin', 'kael', 'archivist', 'merchant'] as NpcId[]) {
      expect(NPC_CHAINS[id].length).withContext(id).toBe(5);
    }
  });

  it('files every step under the character that offers it', () => {
    for (const npc of NPCS) {
      for (const step of NPC_CHAINS[npc.id]) {
        expect(step.npcId).withContext(step.id).toBe(npc.id);
      }
    }
  });

  it('gives every step a unique id', () => {
    const ids = ALL_NPC_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves every id back to its step', () => {
    for (const s of ALL_NPC_STEPS) expect(npcStepById(s.id)).toBe(s);
    expect(npcStepById('nothing')).toBeUndefined();
  });

  it('writes a title, a description and a line of character on every step', () => {
    for (const s of ALL_NPC_STEPS) {
      expect(s.title.trim()).withContext(s.id).not.toBe('');
      expect(s.description.trim()).withContext(s.id).not.toBe('');
      expect(s.loreText.trim()).withContext(s.id).not.toBe('');
    }
  });
});

describe('escalation', () => {
  /*
   * The brief's rule — Gold, then items, then titles, then cosmetics — as a
   * property rather than a list: whatever the rewards are, a later step must
   * never pay less Gold than an earlier one. This is the thing that goes wrong
   * when a step is retuned in isolation.
   */
  it('never pays a later step less Gold than an earlier one', () => {
    for (const npc of NPCS) {
      const gold = NPC_CHAINS[npc.id].map(s => s.reward.gold);
      for (let i = 1; i < gold.length; i++) {
        expect(gold[i]).withContext(`${npc.id} step ${i + 1}`).toBeGreaterThan(gold[i - 1]);
      }
    }
  });

  it('pays Gold on every step', () => {
    for (const s of ALL_NPC_STEPS) expect(s.reward.gold).withContext(s.id).toBeGreaterThan(0);
  });

  it('closes every chain with a title, an achievement and a lore fragment', () => {
    for (const npc of NPCS) {
      const last = NPC_CHAINS[npc.id][NPC_CHAINS[npc.id].length - 1];
      expect(last.reward.title).withContext(npc.id).toBeTruthy();
      expect(last.reward.achievement).withContext(npc.id).toBeTruthy();
      expect(last.reward.loreFragment).withContext(npc.id).toBeTruthy();
    }
  });
});

describe('rewards name things that exist', () => {
  /*
   * `grantCosmetic` validates the variant against the catalogue and returns
   * false on a miss — silently, because a claim that half-paid is not something
   * the caller can usefully react to. So the catalogue has to be checked here,
   * where a rename fails the build instead of one visitor's capstone.
   */
  it('names a real title-prefix variant for every title', () => {
    const prefix = COSMETICS.find(c => c.slot === 'prefix')!;
    const variants = new Set(prefix.variants.map(v => v.id));
    for (const s of ALL_NPC_STEPS) {
      if (!s.reward.title) continue;
      expect(variants.has(s.reward.title)).withContext(`${s.id} -> ${s.reward.title}`).toBe(true);
    }
  });

  it('names a real cosmetic and variant for every cosmetic reward', () => {
    for (const s of ALL_NPC_STEPS) {
      const c = s.reward.cosmetic;
      if (!c) continue;
      const def = COSMETICS.find(x => x.id === c.id);
      expect(def).withContext(`${s.id} -> ${c.id}`).toBeTruthy();
      expect(def!.variants.some(v => v.id === c.variant))
        .withContext(`${s.id} -> ${c.id}/${c.variant}`).toBe(true);
    }
  });

  it('names a real equipment definition for every item reward', () => {
    const defs = new Map(ITEM_DEFINITIONS.map(d => [d.id, d]));
    for (const s of ALL_NPC_STEPS) {
      const item = s.reward.item;
      if (!item) continue;
      const def = defs.get(item.defId);
      expect(def).withContext(`${s.id} -> ${item.defId}`).toBeTruthy();
      // mintEquipment refuses a material, a rune or a quest object and returns
      // null, which would make the grant a silent no-op.
      expect(['material', 'quest', 'rune']).not.toContain(def!.family);
      expect(RUNE_TIER_ORDER).toContain(item.rarity);
    }
  });

  /*
   * Both halves of the Codex contract. An achievement with no registry entry
   * banks into the XP ledger and never appears on the wall; a registry entry
   * with no hint falls back to the generic "the realm is keeping this one to
   * itself", which is a worse card than the one it replaced.
   */
  it('registers every chain achievement on the Codex wall, with a hint', () => {
    const eggs = new Set(EASTER_EGGS.map(e => e.id));
    for (const s of ALL_NPC_STEPS) {
      const id = s.reward.achievement;
      if (!id) continue;
      expect(eggs.has(id)).withContext(`${s.id} -> ${id} not in EASTER_EGGS`).toBe(true);
      expect(EGG_HINTS[id]).withContext(`${s.id} -> ${id} has no hint`).toBeTruthy();
    }
  });
});

describe('objectives', () => {
  it('targets a positive number on every step', () => {
    for (const s of ALL_NPC_STEPS) {
      expect(objectiveTarget(s.objective)).withContext(s.id).toBeGreaterThan(0);
    }
  });

  it('treats binary objectives as a target of one', () => {
    expect(objectiveTarget({ kind: 'achievement', id: 'x' })).toBe(1);
    expect(objectiveTarget({ kind: 'item-rarity', rarity: 'mythic' })).toBe(1);
  });

  /*
   * A delegated objective is answered by the quest board's lifetime buckets, and
   * `progressKey` returning null means there is no bucket to read — the step
   * would sit at 0/N forever with nothing to show why.
   */
  it('delegates only to conditions the quest board can actually answer', () => {
    for (const s of ALL_NPC_STEPS) {
      if (s.objective.kind !== 'quest-progress') continue;
      const c = s.objective.condition;
      const derived = ['streak', 'level', 'achievement', 'energy-balance'].includes(c.type);
      expect(derived || progressKey(c) !== null)
        .withContext(`${s.id} -> ${c.type}`).toBe(true);
      expect(c.count).withContext(s.id).toBeGreaterThan(0);
    }
  });

  /*
   * The gate this file exists for.
   *
   * Four of these steps originally read `tool-use` and `tool-variety` in a
   * realm — which is how the brief describes Aureth and Verrin, and which was
   * already unreachable when it was written: those buckets are filled only by
   * QuestWiringService's tool-beat, and every /tools route now redirects to
   * /world, so the beat never fires. The steps compiled, rendered, showed a
   * progress bar, and could not be completed by any sequence of actions.
   *
   * Nothing about that failure is visible in a type, so it is asserted here:
   * a chain step may not depend on a bucket that no live surface writes.
   */
  it('never depends on a retired surface', () => {
    const dead = ['tool-use', 'tool-variety', 'realm-spread'];
    for (const s of ALL_NPC_STEPS) {
      if (s.objective.kind !== 'quest-progress') continue;
      expect(dead).withContext(`${s.id} reads a bucket nothing fills any more`)
        .not.toContain(s.objective.condition.type);
    }
  });

  /*
   * And the same trap one level down: a `page-visit` naming a path that
   * `canonicalizePlayerPath` rewrites can never match, because the visit is
   * recorded under the canonical path and the condition compares literally.
   */
  it('names only canonical paths in a page-visit objective', () => {
    for (const s of ALL_NPC_STEPS) {
      if (s.objective.kind !== 'quest-progress') continue;
      const paths = s.objective.condition.paths ?? [];
      for (const path of paths) {
        expect(canonicalizePlayerPath(path))
          .withContext(`${s.id} -> ${path} is rewritten before it is recorded`)
          .toBe(path);
      }
      if (paths.length) {
        expect(paths.length).withContext(`${s.id} count must equal its path list`)
          .toBe(s.objective.condition.count);
      }
    }
  });

  it('names a real achievement id for every achievement objective', () => {
    const eggs = new Set(EASTER_EGGS.map(e => e.id));
    for (const s of ALL_NPC_STEPS) {
      if (s.objective.kind !== 'achievement') continue;
      expect(eggs.has(s.objective.id)).withContext(`${s.id} -> ${s.objective.id}`).toBe(true);
    }
  });
});
