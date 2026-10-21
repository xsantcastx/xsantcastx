/**
 * sexton-count.service.ts — the Sexton's Count in play (the chain's rules: sexton-count.model.ts).
 *
 * The chain's facts live in the town tasks blob (TownTaskService.chain / markChain: per character, through the save
 * gateway, merged as a union), so this service owns no save of its own. It turns the world's events into facts, hands
 * over the cowl when the forty-first grave is read, and pays at Wren's — RECEIPT FIRST: the choice fact is written
 * before a coin moves; the Gold, the Hunting XP (keyed `sexton-count:xp`) and the cowl's state follow, each one
 * idempotent, so a reload between them never pays twice.
 *
 *   view()     the step, the facts, the journal, the choice
 *   accept()   take the chain from Wren
 *   event()    the world told us something (a stone read, the page, the Row-Walker, the door, the Uncounted, the grave)
 *   choose()   at Wren's, the end: lay the cowl to rest (cleansed for nothing, his purse besides) or keep it cursed
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Observable } from 'rxjs';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { mintEquipment } from '../rpg/item-definition';
import { curseFor } from '../grave-goods/grave-goods.model';
import { seededRandom, hashSeed } from '../loot/champions';
import { TownTaskService } from '../town-tasks/town-tasks.service';
import {
  SEXTON_CHAIN, SEXTON_COWL, SEXTON_GIVER, SEXTON_REWARD, type JournalEntry, type SextonEvent, type SextonFacts, type SextonStep,
  journalIndex, sextonChoice, sextonEvent, sextonGold, sextonJournal, sextonStep, stonesRead,
} from './sexton-count.model';

export interface SextonView {
  step: SextonStep;
  facts: SextonFacts;
  journal: JournalEntry[];
  /** 1…6: the journal entry under way (6 once done). */
  index: number;
  stones: number;
  choice: 'kept' | 'rested' | null;
  /** The cowl is in the satchel or worn (laying it to rest needs it in hand). */
  cowlHeld: boolean;
}

export interface SextonClaim { choice: 'kept' | 'rested'; gold: number; xp: number; cleansed: boolean }

@Injectable({ providedIn: 'root' })
export class SextonCountService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly tasks = inject(TownTaskService);
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);

  /** Bumps whenever the town tasks blob changes (a fact recorded, a merge landed). */
  readonly changed$: Observable<number> = this.tasks.changed$;

  get facts(): SextonFacts { return this.tasks.chain(SEXTON_CHAIN); }

  view(): SextonView {
    const facts = this.facts;
    return {
      step: sextonStep(facts), facts, journal: sextonJournal(facts), index: journalIndex(facts), stones: stonesRead(facts),
      choice: sextonChoice(facts), cowlHeld: !!this.inventory.itemById(SEXTON_COWL.itemId),
    };
  }

  /** Is this the chain's giver? */
  isGiver(id: string): boolean { return id === SEXTON_GIVER; }

  /** Take the chain. False when it is not on offer. */
  accept(now = Date.now()): boolean {
    if (!this.isBrowser) return false;
    const out = sextonEvent(this.facts, { kind: 'accept' });
    return this.tasks.markChain(SEXTON_CHAIN, out.add, now).length > 0;
  }

  /**
   * The world told the chain something. Records what the chain's rules allow (nothing out of turn) and returns the
   * line to say (an i18n key, '' for nothing) and whether a fact was recorded. Reading the grave hands over the cowl.
   */
  event(ev: SextonEvent, now = Date.now()): { line: string; moved: boolean } {
    if (!this.isBrowser) return { line: '', moved: false };
    const out = sextonEvent(this.facts, ev);
    const moved = this.tasks.markChain(SEXTON_CHAIN, out.add, now).length > 0;
    // The grave read (now or before, the cowl not yet landed — a full satchel): the cowl, under its fixed id.
    if (ev.kind === 'grave' && typeof this.facts['grave'] === 'number' && typeof this.facts['cowl'] !== 'number') this.giveCowl(now);
    return { line: out.line, moved };
  }

  /**
   * The end, at Wren's: lay the cowl to rest (it must be in hand: he cleanses it for nothing, and adds his purse) or keep
   * it as it is (cursed). Receipt first; null when the chain is not at its end or the choice cannot be made.
   */
  choose(choice: 'kept' | 'rested', now = Date.now()): SextonClaim | null {
    if (!this.isBrowser) return null;
    if (sextonStep(this.facts) !== 'return') return null;
    const cowl = this.inventory.itemById(SEXTON_COWL.itemId);
    if (choice === 'rested' && !cowl) return null;
    // The receipt: written before a coin moves (a reload after this can never pay again: the step is 'done').
    if (!this.tasks.markChain(SEXTON_CHAIN, [choice], now).length) return null;
    const gold = sextonGold(choice);
    if (gold > 0) this.economy.earnGold(gold, `npc:${SEXTON_GIVER}:count`);
    this.tasks.grantHuntingXp(`${SEXTON_CHAIN}:${choice}`, SEXTON_REWARD.huntingXp);
    let cleansed = false;
    if (choice === 'rested' && cowl?.curse && !cowl.curse.cleansed) cleansed = this.inventory.setGrave(cowl.id, { curse: { ...cowl.curse, cleansed: true } }).ok;
    return { choice, gold, xp: SEXTON_REWARD.huntingXp, cleansed };
  }

  /** The cowl from the forty-first grave: the boss unique, cursed (its Hollow Ward frozen at the find), one only. */
  private giveCowl(now: number): void {
    if (this.inventory.itemById(SEXTON_COWL.itemId)) { this.tasks.markChain(SEXTON_CHAIN, ['cowl'], now); return; }
    const rng = seededRandom(hashSeed(`${SEXTON_CHAIN}|cowl`));
    const minted = mintEquipment(SEXTON_COWL.defId, SEXTON_COWL.rarity, rng, new Date(now).toISOString(), SEXTON_COWL.itemId, SEXTON_COWL.level);
    if (!minted) return;
    // Never lost on a full satchel: no fact is written until it lands, so reading the grave again hands it over then.
    if (this.inventory.add({ ...minted, curse: curseFor(SEXTON_COWL.curse, SEXTON_COWL.level) })) this.tasks.markChain(SEXTON_CHAIN, ['cowl'], now);
  }
}
