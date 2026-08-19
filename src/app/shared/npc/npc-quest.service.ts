/**
 * npc-quest.service.ts — a visitor's standing against the six chains.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS ON DISK
 * ─────────────────────────────────────────────────────────────────────────────
 * Claim receipts and heard-line ids. Nothing else — no progress numbers, no
 * "step 3 of 5", no cached observations. The same split the quest board uses,
 * and for the same reason: a step's progress is a *reading* of ledgers other
 * services own, so storing a copy of it would create a second number that can
 * drift from the one on screen. Retuning a target in `npc-quest.model.ts`
 * therefore changes what every visitor sees on their next load with no
 * migration, and a claimed step can never be re-paid because the receipt is the
 * step id itself.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE HEARD-LINE LEDGER LIVES IN THIS BLOB
 * ─────────────────────────────────────────────────────────────────────────────
 * It could have been its own key. It is here because the two are one feature
 * from the visitor's side — "what this character has said to me, and what they
 * have asked me for" — and because a second key is a second `SYNCED_BLOBS`
 * entry, a second merge rule and a second thing to forget to register. One blob,
 * one document, one merge.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PAY AFTER THE RECEIPT, ALWAYS
 * ─────────────────────────────────────────────────────────────────────────────
 * `claim()` writes the receipt and persists *before* it pays out a single coin.
 * If a grant throws — a cosmetic id that no longer exists, a full bag — the step
 * stays claimed rather than becoming a faucet that pays again on every click.
 * The same ordering the Collection Log's reward settlement uses.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { XpService } from '../gamification/xp.service';
import { QuestService } from '../quests/quest.service';
import { EconomyService } from '../economy/economy.service';
import { ComboService } from '../economy/combo.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { InventoryService } from '../rpg/inventory.service';
import { CollectionService } from '../collection/collection.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { mintEquipment } from '../rpg/item-definition';
import { RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import { NpcId, NPCS } from './npc.model';
import {
  ALL_NPC_STEPS,
  NPC_CHAINS,
  NpcObjective,
  NpcQuestStep,
  npcStepById,
  objectiveTarget,
} from './npc-quest.model';

export const NPC_KEY = 'eclipse-npc';

/** Heard-line ids stop growing here. Six pools of eight cannot reach it. */
const SEEN_CAP = 400;

interface NpcState {
  version: 1;
  /** Step ids whose reward has been paid. Bare ids — a step is claimed forever. */
  claimed: string[];
  /** `lineKey()` values for dialogue this visitor has already been shown. */
  seen: string[];
}

function emptyState(): NpcState {
  return { version: 1, claimed: [], seen: [] };
}

/** One step, plus this visitor's standing against it. */
export interface NpcQuest extends NpcQuestStep {
  /** Raw reading, clamped to the target. */
  observed: number;
  target: number;
  /** 0–100, for the bar. */
  progress: number;
  claimed: boolean;
  /** Finished and unclaimed — the "?" over the portrait. */
  turnInReady: boolean;
}

/** What one NPC currently has to offer. */
export interface NpcChainState {
  npcId: NpcId;
  /** The step being worked on, or null when the chain is finished. */
  active: NpcQuest | null;
  /** How many of this chain's steps have been claimed. */
  done: number;
  total: number;
  /** True when `active` exists and has not been started — the "!" indicator. */
  offerReady: boolean;
  /** True when `active` is complete and unclaimed — the "?" indicator. */
  turnInReady: boolean;
}

export interface NpcClaim {
  step: NpcQuestStep;
  gold: number;
  /** The chain's new standing, so a caller can celebrate the whole chain. */
  chain: NpcChainState;
}

@Injectable({ providedIn: 'root' })
export class NpcQuestService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly xp = inject(XpService);
  private readonly quests = inject(QuestService);
  private readonly economy = inject(EconomyService);
  private readonly combo = inject(ComboService);
  private readonly runes = inject(RuneForgeService);
  private readonly inventory = inject(InventoryService);
  private readonly collection = inject(CollectionService);
  private readonly eggs = inject(EasterEggService);

  private state: NpcState = emptyState();
  private initialised = false;

  private readonly chains$$ = new BehaviorSubject<Record<NpcId, NpcChainState>>(this.emptyChains());
  private readonly claim$$ = new Subject<NpcClaim>();

  readonly chains$: Observable<Record<NpcId, NpcChainState>> = this.chains$$.asObservable();
  readonly claim$: Observable<NpcClaim> = this.claim$$.asObservable();

  get chains(): Record<NpcId, NpcChainState> { return this.chains$$.value; }

  /** Hydrate and publish. Idempotent; safe to call from several mounts. */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    this.state = this.load();
    this.publish();

    // Every objective is a reading of some other ledger, and most of those
    // ledgers move without this service hearing about it. Rather than
    // subscribing to nine services, the board is recomputed off the two that
    // move on nearly every meaningful action — XP and the quest ledger — which
    // between them cover every path that could complete a step. A step finished
    // by a lone Gold tick therefore lands on the next XP award rather than
    // instantly, which is a second or two, and is the price of not holding nine
    // subscriptions open on all 126 routes.
    this.xp.snapshot$.subscribe(() => this.publish());
    this.quests.board$.subscribe(() => this.publish());

    // `persist()` writes this blob whole from memory, so a merged copy written
    // by cloud save would be lost at the next claim without this.
    this.saves.register(NPC_KEY, { rehydrate: () => this.rehydrate() });
  }

  private rehydrate(): void {
    if (!this.isBrowser) return;
    this.state = this.load();
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reading
  // ───────────────────────────────────────────────────────────────────────────

  /** The active step for one NPC, or null when their chain is finished. */
  activeStep(npcId: NpcId): NpcQuest | null {
    return this.chains[npcId]?.active ?? null;
  }

  /** Every step id that is offered and unclaimed. Feeds `questActive` triggers. */
  get activeStepIds(): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const chain of Object.values(this.chains)) {
      if (chain.active) ids.add(chain.active.id);
    }
    return ids;
  }

  isClaimed(stepId: string): boolean {
    return this.state.claimed.includes(stepId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Heard lines
  // ───────────────────────────────────────────────────────────────────────────

  get seenLines(): ReadonlySet<string> {
    return new Set(this.state.seen);
  }

  /** Record that a line has been shown. No-op once the cap is reached. */
  markSeen(key: string): void {
    if (!this.isBrowser || !key) return;
    if (this.state.seen.includes(key)) return;
    if (this.state.seen.length >= SEEN_CAP) return;
    this.state.seen = [...this.state.seen, key];
    this.persist();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Claiming
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Bank a finished step's reward.
   *
   * Returns false when the step is not the chain's active one, is not complete,
   * or has already been claimed — the three ways a double payout could happen.
   */
  claim(stepId: string): boolean {
    if (!this.isBrowser) return false;

    const step = npcStepById(stepId);
    if (!step) return false;

    const chain = this.chains[step.npcId];
    if (!chain?.active || chain.active.id !== stepId) return false;
    if (!chain.active.turnInReady) return false;
    if (this.state.claimed.includes(stepId)) return false;

    // Receipt first, on disk, before a single coin moves. See the header.
    this.state.claimed = [...this.state.claimed, stepId];
    this.persist();

    this.pay(step);
    this.publish();

    this.claim$$.next({
      step,
      gold: step.reward.gold,
      chain: this.chains[step.npcId],
    });
    return true;
  }

  /** Wipe every receipt and every heard line. */
  reset(): void {
    if (!this.isBrowser) return;
    this.state = emptyState();
    this.store.remove(NPC_KEY);
    this.publish();
  }

  private pay(step: NpcQuestStep): void {
    const r = step.reward;
    const npc = NPCS.find(n => n.id === step.npcId);

    if (r.gold > 0) this.economy.earnGold(r.gold, `npc:${step.npcId}`);
    if (r.xp && r.xp > 0) {
      this.xp.award('quest', {
        amount: r.xp,
        // Verrin and the Nameless feed Nox; everyone else feeds Aether. Stated
        // per step rather than inferred, so a step can override its character.
        energy: r.energy ?? (npc?.id === 'verrin' || npc?.id === 'nameless' ? 'nox' : 'aether'),
      });
    }
    if (r.item) {
      const minted = mintEquipment(r.item.defId, r.item.rarity);
      // A full bag drops the item rather than blocking the claim. The step is
      // already receipted, and holding the Gold and the title hostage to a
      // clear inventory slot would be worse than losing one grant.
      if (minted) this.inventory.add(minted);
    }
    if (r.title) this.economy.grantCosmetic('title-prefix', r.title);
    if (r.cosmetic) this.economy.grantCosmetic(r.cosmetic.id, r.cosmetic.variant);
    if (r.achievement) this.xp.claimAchievement(r.achievement);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Board assembly
  // ───────────────────────────────────────────────────────────────────────────

  private publish(): void {
    this.chains$$.next(this.computeChains());
  }

  private emptyChains(): Record<NpcId, NpcChainState> {
    const out = {} as Record<NpcId, NpcChainState>;
    for (const npc of NPCS) {
      out[npc.id] = {
        npcId: npc.id,
        active: null,
        done: 0,
        total: NPC_CHAINS[npc.id].length,
        offerReady: false,
        turnInReady: false,
      };
    }
    return out;
  }

  private computeChains(): Record<NpcId, NpcChainState> {
    const out = {} as Record<NpcId, NpcChainState>;
    for (const npc of NPCS) {
      const steps = NPC_CHAINS[npc.id];
      const done = steps.filter(s => this.state.claimed.includes(s.id)).length;
      const next = steps[done];
      const active = next ? this.resolve(next) : null;

      out[npc.id] = {
        npcId: npc.id,
        active,
        done,
        total: steps.length,
        offerReady: !!active && active.observed === 0,
        turnInReady: !!active?.turnInReady,
      };
    }
    return out;
  }

  private resolve(step: NpcQuestStep): NpcQuest {
    const target = objectiveTarget(step.objective);
    const raw = this.observe(step.objective);
    const observed = Math.min(raw, target);
    const claimed = this.state.claimed.includes(step.id);

    return {
      ...step,
      observed,
      target,
      progress: Math.round((observed / target) * 100),
      claimed,
      turnInReady: raw >= target && !claimed,
    };
  }

  /**
   * The one place each objective's reading is taken.
   *
   * Every branch reads a ledger some other service already owns. Nothing here
   * counts, caches or writes — which is what keeps a step's bar and the number
   * on the page it came from unable to disagree.
   */
  private observe(o: NpcObjective): number {
    switch (o.kind) {
      case 'level':
        return this.xp.snapshot.level.level;

      case 'achievement':
        return this.xp.hasAchievement(o.id) ? 1 : 0;

      case 'runes-unique':
        return this.runes.uniqueFound;

      case 'rune-strikes':
        return this.runes.totalStrikes;

      case 'runewords':
        return this.runes.craftedCount;

      case 'combo-best':
        return this.combo.best;

      case 'items-owned':
        return this.inventory.count;

      case 'item-rarity': {
        // "at this rarity or above", so a Singular drop satisfies a mythic ask.
        const floor = RUNE_TIER_ORDER.indexOf(o.rarity);
        return RUNE_TIER_ORDER.slice(floor).some(r => this.inventory.hasRarity(r)) ? 1 : 0;
      }

      case 'gold-earned':
        return this.economy.snapshot.totalGoldEarned;

      case 'eggs-found':
        return this.eggs.foundCount;

      case 'collection':
        return this.collection.completion.found;

      case 'quests-completed':
        return this.quests.board.totalCompleted;

      case 'quest-progress':
        return this.quests.lifetimeObserved(o.condition);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): NpcState {
    try {
      const raw = this.store.readRaw(NPC_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<NpcState>;
      // Only ids that still name a real step survive the read. A chain renamed
      // in a later build would otherwise leave a receipt that blocks the step
      // that replaced it, forever, with nothing to show for it.
      const live = new Set(ALL_NPC_STEPS.map(s => s.id));
      return {
        version: 1,
        claimed: (parsed.claimed ?? []).filter(id => live.has(id)),
        seen: (parsed.seen ?? []).slice(0, SEEN_CAP),
      };
    } catch {
      return emptyState();
    }
  }

  private persist(): void {
    this.store.write(NPC_KEY, this.state);
  }
}
