/**
 * MealBuffService — a meal's lasting good (S8; gathering.model MealDef.buff): the Cold Miner's Pasty's +10% Mining XP
 * for ten minutes (read by SkillActionService.act for every Mining step that comes through it). The Thundercake's
 * lightning resist lives in the top-down engine (it is a fight number). Session state on purpose: a buff is the meal's
 * afterglow, not progress, so a reload ends it as it ends a meal's slow heal.
 */
import { Injectable } from '@angular/core';
import type { MealBuff } from './gathering.model';

@Injectable({ providedIn: 'root' })
export class MealBuffService {
  private miningUntil = 0;
  private miningPct = 0;

  /** A meal was eaten: its buff starts now (a new one replaces the old). */
  start(buff: MealBuff | undefined, now = Date.now()): void {
    if (buff?.kind === 'mining-xp') { this.miningUntil = now + buff.secs * 1000; this.miningPct = buff.pct; }
  }
  /** What Mining XP is multiplied by now. */
  miningMult(now = Date.now()): number { return now < this.miningUntil ? 1 + this.miningPct / 100 : 1; }
}
