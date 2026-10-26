/**
 * rune-forge.service.ts — the rune ledger (the Rune Forge itself is gone: docs/design/runewords.md).
 *
 * Runes drop ONLY from monsters (canon §6.2): nobody strikes, buys or crafts one. A held rune is a satchel stack
 * (`rune-<id>`, rune-stack.ts), one 1×1 cell per pile, written through InventoryService's stack ops — merge-safe, and
 * the grid, the Vault, the ground and the Enchanting Table all see the same thing. This service keeps what is not
 * a count: when each rune was first found (the Codex, the Collection Log, the achievements), and the one-time
 * migration of the old Forge ledger's counts into the satchel.
 *
 * The class keeps its name so the twenty readers of `countOf` / `snapshot` did not have to move.
 *
 * Browser-only writes; on the server the snapshot stays empty.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { XpService } from '../gamification/xp.service';
import { LoreScrollService } from './lore-scroll.service';
import { LoreScroll, rollScroll } from './lore-scroll.model';
import { RUNE_ACHIEVEMENTS } from './rune-achievements';
import {
  RUNES,
  RUNEWORDS,
  RUNE_TIER_ORDER,
  Rune,
  RuneTier,
  Runeword,
  runeById,
  runeCostOf,
  tierOf,
} from './rune.model';
import { runeStackKey } from './rune-stack';
import { InventoryService } from '../rpg/inventory.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { CollectionService } from '../collection/collection.service';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import type { GameItem } from '../rpg/item.model';
import type { RosterExplorer } from '../rpg/explorer-roster.model';

/** The save key holding first-found dates (and, before the satchel, the counts). */
export const RUNES_KEY = 'godforge-runes';

/** The stack op id that moves one rune's old Forge count into the satchel. One per rune, whatever the count. */
export function runeMigrationOpId(runeId: string): string { return `runemig:${runeId}`; }

interface RuneLedger {
  version: 1;
  /** Retired: the old Forge counts. Emptied into the satchel once (`migrated`). */
  runes: Record<string, number>;
  /** rune id → ISO timestamp of the first one ever found. */
  firstFound: Record<string, string>;
  /** Lifetime strikes at the retired anvil (kept for the record). */
  strikes: number;
  goldSpent: number;
  /** 1 once the old counts went into the satchel. */
  migrated?: number;
}

function emptyLedger(): RuneLedger {
  return { version: 1, runes: {}, firstFound: {}, strikes: 0, goldSpent: 0 };
}

/** One rune that landed in the satchel. */
export interface RuneFind {
  rune: Rune;
  /** How many are held after this one landed. */
  held: number;
  copies?: number;
  /** First of its kind. */
  isNew: boolean;
  /** Retired with Realm Bridge's strikes: always 0. */
  essence: number;
  /** A Lore Scroll the find turned up, or null. */
  scroll: LoreScroll | null;
  /** Retired (the strike's charm): always null. */
  item: GameItem | null;
  /** Retired (the strike's explorer): always null. */
  explorer: RosterExplorer | null;
}

/** Everything the readers render. */
export interface RuneSnapshot {
  /** rune id → count in the satchel. */
  held: Record<string, number>;
  /** Forge Runewords crafted before the Forge was retired (their bonuses still pay). */
  crafted: string[];
  strikes: number;
  goldSpent: number;
  /** Distinct runes ever found, out of `RUNES.length`. */
  unique: number;
  rarest: Rune | null;
  /** Gold worth of everything currently held. */
  collectionValue: number;
  firstFound: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class RuneForgeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);
  private readonly eggs = inject(EasterEggService);
  private readonly scrolls = inject(LoreScrollService);
  private readonly inventory = inject(InventoryService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);
  private readonly collection = inject(CollectionService);

  private ledger: RuneLedger = emptyLedger();
  private initialised = false;

  private readonly snapshot$$ = new BehaviorSubject<RuneSnapshot>(this.snapshotOf(emptyLedger()));
  private readonly find$$ = new Subject<RuneFind>();
  private readonly craft$$ = new Subject<Runeword>();

  readonly snapshot$: Observable<RuneSnapshot> = this.snapshot$$.asObservable();
  /** One event per rune that lands. */
  readonly find$: Observable<RuneFind> = this.find$$.asObservable();
  /** Retired with the Forge's Runewords: never emits. Kept for old subscribers. */
  readonly craft$: Observable<Runeword> = this.craft$$.asObservable();

  get snapshot(): RuneSnapshot { return this.snapshot$$.value; }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.scrolls.init();
    this.inventory.init();
    this.ledger = this.load();
    this.migrate();
    this.publish();
    // The counts are the satchel's: every inventory change republishes them.
    this.inventory.snapshot$.subscribe(() => this.publish());
    this.saves.register(RUNES_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        this.migrate();
        this.publish();
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Counts (the satchel's)
  // ───────────────────────────────────────────────────────────────────────────

  countOf(runeId: string): number {
    return runeById(runeId) ? Math.max(0, this.inventory.stackOf(runeStackKey(runeId))) : 0;
  }

  /**
   * A monster's rune lands in the satchel (LootService.grantDrop, the only caller: canon §6.2). `grantId` makes it
   * idempotent (the drop id): a retried pickup or a merged replay lands once.
   */
  grant(rune: Rune, random: () => number = Math.random, grantId?: string): RuneFind | null {
    if (!this.isBrowser || !runeById(rune.id)) return null;
    this.init();
    const id = grantId ?? `rune-find:${rune.id}:${Date.now().toString(36)}:${Math.floor(random() * 1e9).toString(36)}`;
    const before = this.countOf(rune.id);
    const isNew = !this.hasEverFound(rune.id);
    if (!this.inventory.grantStack(id, runeStackKey(rune.id), 1)) return null;
    if (isNew) {
      this.ledger = { ...this.ledger, firstFound: { ...this.ledger.firstFound, [rune.id]: new Date().toISOString() } };
      this.save();
    }
    const tier = tierOf(rune.tier);
    const dupXp = Math.max(1, Math.round(tier.xp / 10));
    this.xp.award('craft', { amount: isNew ? tier.xp : dupXp });
    const scroll = rollScroll(rune.tier, this.scrolls.foundIds, random);
    if (scroll) {
      this.scrolls.grant(scroll.id);
      this.xp.award('craft', { amount: tierOf(scroll.rarity).xp });
    }
    this.collection.discover(rune.id, 1);
    this.publish();
    this.checkAchievements();
    const find: RuneFind = { rune, held: before + 1, copies: 1, isNew, essence: 0, scroll, item: null, explorer: null };
    this.find$$.next(find);
    return find;
  }

  /**
   * A retired, non-monster rune source (an expedition, a thrall, a reel, a quest chest) found one: runes drop only
   * from monsters now (canon §6.2), so the find is paid as the rune's sell value in Gold instead. Returns the Gold.
   */
  payInstead(rune: Rune, reason = 'rune-find'): number {
    if (!this.isBrowser || !runeById(rune.id)) return 0;
    const gold = Math.max(0, Math.floor(rune.sellValue));
    if (gold > 0) this.economy.earnGold(gold, reason);
    return gold;
  }

  /** Spend runes from the satchel for a recipe or a socket. Idempotent on `mutationId`. */
  spendRune(runeId: string, count = 1, mutationId?: string): boolean {
    if (!this.isBrowser || count <= 0 || !runeById(runeId)) return false;
    if (this.countOf(runeId) < count) return false;
    const id = mutationId ?? `rune-spend:${runeId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
    const taken = this.inventory.consumeStacks(id, [{ id: runeStackKey(runeId), count }]);
    if (taken.ok) this.publish();
    return taken.ok;
  }

  hasCrafted(wordId: string): boolean {
    return this.economy.hasRuneword(wordId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Read models, for the achievement predicates
  // ───────────────────────────────────────────────────────────────────────────

  get uniqueFound(): number { return Object.keys(this.ledger.firstFound).length; }
  get craftedCount(): number { return this.economy.runewords.length; }
  get scrollsFound(): number { return this.scrolls.foundCount; }
  hasEverFound(runeId: string): boolean { return runeId in this.ledger.firstFound; }
  get totalStrikes(): number { return this.ledger.strikes; }
  get goldSpent(): number { return this.ledger.goldSpent; }

  reset(): void {
    if (!this.isBrowser) return;
    this.ledger = emptyLedger();
    this.store.remove(RUNES_KEY);
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The one-time move of the old Forge counts into the satchel
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Every rune the old ledger held becomes a satchel stack of the same rune (a forged rune is a rune: same id, same
   * tier, same use). One grant op per rune, `runemig:<id>`: two devices migrating the same save write the same id,
   * and the merge keeps one. Then the counts are emptied and the save stamped, in the same tick. Nothing is lost:
   * the grant lands before the counts are cleared, and a failed grant leaves that rune's count for the next load.
   */
  private migrate(): void {
    if (this.ledger.migrated) return;
    const left: Record<string, number> = {};
    let moved = false;
    for (const [runeId, count] of Object.entries(this.ledger.runes)) {
      if (!runeById(runeId) || !(count > 0)) continue;
      const opId = runeMigrationOpId(runeId);
      if (this.inventory.hasStackOp(opId) || this.inventory.grantStack(opId, runeStackKey(runeId), Math.floor(count))) moved = true;
      else left[runeId] = count;
    }
    // An empty fresh save is not stamped: it may yet merge with a cloud copy that still holds counts.
    if (!moved && !Object.keys(left).length && !this.ledger.strikes && !Object.keys(this.ledger.firstFound).length) return;
    this.ledger = { ...this.ledger, runes: left, ...(Object.keys(left).length ? {} : { migrated: 1 }) };
    this.save();
  }

  private checkAchievements(): void {
    for (const a of RUNE_ACHIEVEMENTS) {
      if (this.eggs.isFound(a.id)) continue;
      if (a.met(this)) void this.eggs.trigger(a.id);
    }
  }

  private load(): RuneLedger {
    try {
      const raw = this.store.readRaw(RUNES_KEY);
      if (!raw) return emptyLedger();
      const parsed = JSON.parse(raw) as Partial<RuneLedger>;
      return {
        ...emptyLedger(),
        ...parsed,
        runes: pruneToRegistry(parsed.runes),
        firstFound: pruneToRegistry(parsed.firstFound),
        version: 1,
      };
    } catch {
      return emptyLedger();
    }
  }

  private save(): void {
    if (!this.isBrowser) return;
    this.store.write(RUNES_KEY, this.ledger);
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf(this.ledger));
  }

  private snapshotOf(ledger: RuneLedger): RuneSnapshot {
    const held: Record<string, number> = {};
    let collectionValue = 0;
    if (this.isBrowser && this.inventory) {
      for (const rune of RUNES) {
        const n = this.countOf(rune.id);
        if (n > 0) { held[rune.id] = n; collectionValue += rune.forgeCost * n; }
      }
    }
    return {
      held,
      crafted: this.economy ? [...this.economy.runewords] : [],
      strikes: ledger.strikes,
      goldSpent: ledger.goldSpent,
      unique: Object.keys(ledger.firstFound).length,
      rarest: rarestOf(Object.keys(ledger.firstFound)),
      collectionValue,
      firstFound: { ...ledger.firstFound },
    };
  }
}

function pruneToRegistry<T>(map: Record<string, T> | undefined): Record<string, T> {
  const kept: Record<string, T> = {};
  for (const [id, value] of Object.entries(map ?? {})) {
    if (runeById(id)) kept[id] = value;
  }
  return kept;
}

function rarestOf(runeIds: string[]): Rune | null {
  let best: Rune | null = null;
  let bestRank = -1;
  for (const id of runeIds) {
    const rune = runeById(id);
    if (!rune) continue;
    const rank = RUNE_TIER_ORDER.indexOf(rune.tier);
    if (rank > bestRank) { best = rune; bestRank = rank; }
  }
  return best;
}

export { RUNES, RUNEWORDS, RUNE_TIER_ORDER, tierOf, runeById, runeCostOf };
export type { Rune, RuneTier, Runeword };
