/**
 * GatheringService — every write the gathering skills make (shared/gathering/gathering.model.ts; docs/handoff/gather.md).
 *
 * The top-down engine runs the loops (the wait for a bite, the swings, the strike of a light, the pan) and asks here at
 * each step (td-engine `onGather`). Each step lands through the one skill pipeline (SkillActionService.act → the
 * activity gateway): the XP and the stack in one idempotent write keyed by the step's mutation id, the level-up moment
 * with it. A full satchel refuses before anything is written, and the loop stops there.
 *
 * XP credit: client-side, like every gathering skill today (the save is client-written). When the room credits XP
 * (the m4 lane), these grants move behind it unchanged: each is already one keyed world action.
 */
import { Injectable, inject } from '@angular/core';
import { InventoryService } from '../rpg/inventory.service';
import { SkillActionService } from '../skills/skill-actions.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { skillLevel, type SkillId } from '../skills/skill.model';
import { WorldClockService } from '../world-clock/world-clock.service';
import { TranslationService } from '../../translation.service';
import { materialDisplay } from '../rpg/material-catalog';
import {
  BURNT_FISH_ID, SPOT_GATE, TINDERBOX_ID, fishHere, baitOf, biteSpeed, burnChance, chopSwings, cookRefusal, cookable, fireRefusal, logById, logForLand,
  mealById, rodTierOf, rollWorldFish, spotRefusal, type GatherAnswer, type GatherEvent, type MealDef,
} from './gathering.model';
import { GATHER_PILE_CAP } from './gather-keys';

/** Where the gathering skills are booked in the activity ledger. */
export const GATHER_LOCATION = 'world/gathering';

@Injectable({ providedIn: 'root' })
export class GatheringService {
  private readonly inventory = inject(InventoryService);
  private readonly skills = inject(SkillActionService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly clock = inject(WorldClockService);
  private readonly i18n = inject(TranslationService);
  /** RNG for catches and burns. Replaceable in tests. */
  random: () => number = Math.random;

  level(skill: SkillId): number {
    this.activity.init();
    return skillLevel(this.activity.snapshot.progress, skill);
  }
  private stackOf = (id: string) => this.inventory.stackOf(id);
  private t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  private name(id: string): string { return materialDisplay(id)?.name ?? id; }
  /** Would one more of `id` fit, when one of `freed` goes out first (a cooked fish takes the raw one's place)? */
  private fits(id: string, freed?: string): boolean {
    if (this.inventory.canTakeStack(id, 1)) return true;
    // The last of a raw pile leaves its cell as it is cooked: the meal (or the burnt one) may take it.
    return !!freed && this.stackOf(freed) % GATHER_PILE_CAP === 1;
  }

  /** The engine's one door. */
  answer(e: GatherEvent): GatherAnswer {
    switch (e.kind) {
      case 'fish': return e.phase === 'start' ? this.fishStart(e) : this.fishBite(e);
      case 'chop': return e.phase === 'start' ? this.chopStart(e.land) : this.chopFell(e.land, e.mutationId);
      case 'fire': return this.fireLit(e.log, e.mutationId);
      case 'cook': return e.phase === 'start' ? this.cookStart(e.range) : this.cookOne(e.range, e.mutationId);
    }
  }

  // ── Fishing ──────────────────────────────────────────────────────────────

  private fishStart(e: Extract<GatherEvent, { kind: 'fish' }>): GatherAnswer {
    const level = this.level('fishing');
    const rod = rodTierOf(this.stackOf, level);
    const why = spotRefusal(e.water, level, rod.tier);
    if (why === 'level') return { ok: false, text: this.t('gather.fish.needLevel', { n: SPOT_GATE[e.water].level }) };
    if (why === 'rod') return { ok: false, text: this.t('gather.fish.needRod') };
    if (why === 'storeRod') return { ok: false, text: this.t('gather.fish.needStoreRod') };
    if (why === 'rodTier') return { ok: false, text: this.t('gather.fish.needSeamRod') };
    const sky = this.clock.sky();
    const can = fishHere(e.water, level, { dark: sky.dark, eclipse: sky.eclipseOn });
    if (can.length && !can.some(f => this.fits(f.id))) return { ok: false, text: this.t('play.grid.full') };
    const bait = baitOf(this.stackOf);
    return { ok: true, speed: biteSpeed(rod.bite, bait?.power ?? 0, level, e.weather), text: this.t(`gather.fish.start.${e.water}`) };
  }

  private fishBite(e: Extract<GatherEvent, { kind: 'fish' }>): GatherAnswer {
    const level = this.level('fishing');
    const rod = rodTierOf(this.stackOf, level);
    if (spotRefusal(e.water, level, rod.tier)) return { ok: false, text: this.t('gather.fish.needRod') };
    const sky = this.clock.sky();
    const bait = baitOf(this.stackOf);
    const fish = rollWorldFish(e.water, level, { dark: sky.dark, eclipse: sky.eclipseOn }, bait?.power ?? 0, this.random);
    if (!fish) return { ok: false, text: this.t('gather.fish.nothing') };
    // A full satchel refuses the catch before anything is written: the fish goes back, the line comes in.
    if (!this.fits(fish.id)) return { ok: false, text: this.t('play.grid.full') };
    const r = this.skills.act({ mutationId: e.mutationId, skill: 'fishing', xp: fish.xp, materialId: fish.id, qty: 1, locationId: GATHER_LOCATION });
    if (!r.ok) return { ok: false, text: this.t(r.code === 'capacity' ? 'play.grid.full' : 'gather.notSaved') };
    // The bait is used once the catch is in (bait is optional; it only makes the better fish come up).
    if (!r.replayed && bait) this.inventory.consumeStacks(`${e.mutationId}:bait`, [{ id: bait.id, count: 1 }]);
    const speed = biteSpeed(rod.bite, baitOf(this.stackOf)?.power ?? 0, level, e.weather);
    return { ok: true, got: fish.id, label: `+1 ${this.name(fish.id)}`, speed, text: this.t('gather.fish.caught', { name: this.name(fish.id), xp: fish.xp }) };
  }

  // ── Woodcutting ──────────────────────────────────────────────────────────

  private chopStart(land: string): GatherAnswer {
    const log = logForLand(land), level = this.level('woodcutting');
    if (level < log.cut) return { ok: false, text: this.t('gather.chop.needLevel', { n: log.cut, name: this.name(log.id) }) };
    if (!this.fits(log.id)) return { ok: false, text: this.t('play.grid.full') };
    return { ok: true, swings: chopSwings(level, log) };
  }

  private chopFell(land: string, mutationId: string): GatherAnswer {
    const log = logForLand(land);
    if (this.level('woodcutting') < log.cut) return { ok: false, text: this.t('gather.chop.needLevel', { n: log.cut, name: this.name(log.id) }) };
    if (!this.fits(log.id)) return { ok: false, text: this.t('play.grid.full') };
    const r = this.skills.act({ mutationId, skill: 'woodcutting', xp: log.cutXp, materialId: log.id, qty: 1, locationId: GATHER_LOCATION });
    if (!r.ok) return { ok: false, text: this.t(r.code === 'capacity' ? 'play.grid.full' : 'gather.notSaved') };
    // The old trunks' bark still comes away now and then (World-Root Bark: rope, the Root Rod, the Woodcutting Store).
    if (!r.replayed && this.random() < .25 && this.inventory.canTakeStack('world-root-bark', 1)) this.inventory.grantStack(`${mutationId}:bark`, 'world-root-bark', 1);
    return { ok: true, got: log.id, label: `+1 ${this.name(log.id)}`, text: this.t('gather.chop.felled', { name: this.name(log.id), xp: log.cutXp }) };
  }

  // ── Firemaking ───────────────────────────────────────────────────────────

  /** Can this log be lit here and now (the satchel card asks before the engine strikes)? */
  lightRefusal(logId: string): string | null {
    const why = fireRefusal(logId, this.level('firemaking'), this.stackOf(TINDERBOX_ID) > 0);
    if (!why) return this.stackOf(logId) > 0 ? null : this.t('gather.fire.noLog');
    return why === 'tinderbox' ? this.t('gather.fire.needTinderbox')
      : why === 'level' ? this.t('gather.fire.needLevel', { n: logById(logId)?.burn ?? 1 }) : this.t('gather.fire.noLog');
  }

  private fireLit(logId: string, mutationId: string): GatherAnswer {
    const why = this.lightRefusal(logId);
    if (why) return { ok: false, text: why };
    const log = logById(logId)!;
    const took = this.inventory.consumeStacks(`${mutationId}:log`, [{ id: logId, count: 1 }]);
    if (!took.ok) return { ok: false, text: this.t('gather.fire.noLog') };
    const r = this.skills.act({ mutationId, skill: 'firemaking', xp: log.burnXp, locationId: GATHER_LOCATION });
    if (!r.ok) return { ok: false, text: this.t('gather.notSaved') };
    return { ok: true, text: this.t('gather.fire.lit', { xp: log.burnXp }) };
  }

  // ── Cooking ──────────────────────────────────────────────────────────────

  private cookStart(range: boolean): GatherAnswer {
    const level = this.level('cooking');
    const list = cookable(this.stackOf, level);
    if (!list.length) {
      const any = ['ash-perch', 'mirrorfin', 'rootling-eel', 'mire-carp', 'lampfish', 'moonwake'].some(id => this.stackOf(id) > 0);
      return { ok: false, text: this.t(any ? 'gather.cook.needLevel' : 'gather.cook.nothing') };
    }
    return { ok: true, text: this.t(range ? 'gather.cook.startRange' : 'gather.cook.start') };
  }

  private cookOne(range: boolean, mutationId: string): GatherAnswer {
    const level = this.level('cooking');
    const meal: MealDef | undefined = cookable(this.stackOf, level)[0];
    if (!meal) return { ok: false, text: this.t('gather.cook.done') };
    if (cookRefusal(meal.raw, level)) return { ok: false, text: this.t('gather.cook.needLevel') };
    const burnt = this.random() < burnChance(level, meal, range);
    const out = burnt ? BURNT_FISH_ID : meal.id;
    if (!this.fits(out, meal.raw)) return { ok: false, text: this.t('play.grid.full') };
    const took = this.inventory.consumeStacks(`${mutationId}:raw`, [{ id: meal.raw, count: 1 }]);
    if (!took.ok) return { ok: false, text: this.t('gather.cook.done') };
    const r = this.skills.act({ mutationId, skill: 'cooking', xp: burnt ? 0 : meal.xp, materialId: out, qty: 1, locationId: GATHER_LOCATION });
    if (!r.ok) return { ok: false, text: this.t('gather.notSaved') };
    return burnt
      ? { ok: true, burnt: true, got: out, label: this.t('gather.cook.burntLabel'), text: this.t('gather.cook.burnt', { name: this.name(meal.raw) }) }
      : { ok: true, got: out, label: `+1 ${this.name(meal.id)}`, text: this.t('gather.cook.cooked', { name: this.name(meal.id), xp: meal.xp }) };
  }

  // ── Eating ───────────────────────────────────────────────────────────────

  /** Eat one meal from the satchel: it is taken, and the engine mends its life over MEAL_SECS. Null when none is held. */
  eat(id: string, mutationId: string): MealDef | null {
    const meal = mealById(id);
    if (!meal || this.stackOf(id) < 1) return null;
    const took = this.inventory.consumeStacks(mutationId, [{ id, count: 1 }]);
    return took.ok ? meal : null;
  }
}
