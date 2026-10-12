/**
 * skill-actions.service.ts — the one call a world action makes.
 *
 * Wraps `ActivityProgressionGateway.resolveWorldAction` and fires the level-up
 * banner (with what the level opened) for whichever skill the action trained.
 * The engine host, the future anvil mini-game and the future enchanting ritual
 * all call this rather than the gateway, so no surface has to remember to
 * announce a level.
 *
 *   act({ mutationId, skill: 'woodcutting', materialId: 'world-root-bark', xp: 6, locationId: 'verdant/grove' })
 *   grantSmithingXp(quality, mutationId)   // anvil: quality 0..1
 *   grantEnchantingXp(quality, mutationId) // ritual: quality 0..1
 *
 * Mining in a Seamworks seam keeps `resolveMine`; a pickaxe swing in the
 * world (a Delve vein) comes through here with skill 'mining'.
 */
import { Injectable, inject } from '@angular/core';

import {
  ActivityProgressionGateway,
  type WorldActionResult,
} from '../activity/activity-progression.gateway';
import { LevelUpService } from '../activity/level-up.service';
import { CraftingService } from '../crafting/crafting.service';
import { skillDef, skillXp, type SkillId } from './skill.model';

export interface SkillActionInput {
  mutationId: string;
  skill: SkillId;
  materialId?: string;
  qty?: number;
  xp: number;
  locationId: string;
  now?: number;
}

/** XP an anvil strike or a ritual pays at quality 0 and at quality 1. */
export const CRAFT_SKILL_XP = { min: 8, max: 40 } as const;

@Injectable({ providedIn: 'root' })
export class SkillActionService {
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly levelUp = inject(LevelUpService);
  private readonly crafting = inject(CraftingService);

  act(input: SkillActionInput): WorldActionResult {
    this.activity.init();
    const bench = input.skill === 'smithing' ? this.crafting.xp() : 0;
    const before = skillXp(this.activity.snapshot.progress, input.skill, bench);
    const result = this.activity.resolveWorldAction({
      mutationId: input.mutationId,
      discipline: skillDef(input.skill).discipline,
      materialId: input.materialId,
      qty: input.qty,
      xp: input.xp,
      locationId: input.locationId,
      now: input.now,
    });
    if (result.ok && !result.replayed) {
      this.levelUp.checkSkill(input.skill, before, skillXp(this.activity.snapshot.progress, input.skill, bench));
    }
    return result;
  }

  /** One finished anvil piece. `quality` 0..1 scales the XP. */
  grantSmithingXp(quality: number, mutationId: string, locationId = 'forge/anvil'): WorldActionResult {
    return this.act({ mutationId, skill: 'smithing', xp: craftSkillXp(quality), locationId });
  }

  /** One finished ritual. `quality` 0..1 scales the XP. */
  grantEnchantingXp(quality: number, mutationId: string, locationId = 'forge/enchanting'): WorldActionResult {
    return this.act({ mutationId, skill: 'enchanting', xp: craftSkillXp(quality), locationId });
  }
}

/** Whole-number XP for a crafted piece of `quality` (0..1, clamped). */
export function craftSkillXp(quality: number): number {
  const q = Number.isFinite(quality) ? Math.min(1, Math.max(0, quality)) : 0;
  return Math.round(CRAFT_SKILL_XP.min + q * (CRAFT_SKILL_XP.max - CRAFT_SKILL_XP.min));
}
