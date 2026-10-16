/**
 * loot.service.ts — the only writer of `godforge-loot` (loot-save.model.ts),
 * and the host's half of drops, auras and the corpse run.
 *
 *  - settings: the loot filter, the picked aura, the difficulty (and the tiers opened);
 *  - rollLoot(): what a kill drops on top of its area table (drop-tables.ts),
 *    seeded from the player's loot seed and the kill, so it is reproducible;
 *  - grantDrop(): a picked-up item is minted HERE, once (its roll grade frozen
 *    at mint, item-quality.ts), and a rune goes to the Forge ledger;
 *  - combatRules(): what the engine needs from the worn loadout (aura, resists);
 *  - fall()/recover(): the corpse run's purse.
 *
 * Saved through the gateway, registered with LocalSaveRegistry (a cloud merge
 * lands in memory in the same tick). Nothing here touches localStorage.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { EconomyService } from '../economy/economy.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { mintEquipment } from '../rpg/item-definition';
import { runeById } from '../rune-forge/rune.model';
import type { GameItem } from '../rpg/item.model';
import { pickAura, type AuraId, type AuraSource } from './auras';
import { wornAuraSources, wornResists } from './aura-sources';
import { hashSeed, seededRandom, type MonsterRank } from './champions';
import { deathCost, unlockedBy, type DifficultyTier } from './difficulty.model';
import type { Resists } from './damage.model';
import { rollCreatureLoot, type LootDrop } from './drop-tables';
import type { LootFilter, LootTier } from './loot-tiers';
import { LOOT_KEY, coerceLoot, defaultLoot, type FallenPurse, type LootSave } from './loot-save.model';

/** What the engine is told about the fight (SeamworksEngine.setCombatRules). */
export interface CombatRules {
  tier: DifficultyTier;
  seed: number;
  magicFind: number;
  aura: { id: AuraId; level: number } | null;
  resists: Resists;
  filter: LootFilter;
}

@Injectable({ providedIn: 'root' })
export class LootService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private readonly runes = inject(RuneForgeService);
  private readonly subject = new BehaviorSubject<LootSave>(defaultLoot());
  private hydrated = false;
  /** Drop ids already granted this session (a retried pickup never pays twice). */
  private readonly granted = new Set<string>();

  get state(): LootSave { this.hydrate(); return this.subject.value; }
  get state$(): Observable<LootSave> { this.hydrate(); return this.subject.asObservable(); }

  setFilter(filter: LootFilter, at = Date.now()): void { this.edit({ filter }, at); }
  setAura(aura: AuraId | null, at = Date.now()): void { this.edit({ aura }, at); }
  setTier(tier: DifficultyTier, at = Date.now()): boolean {
    if (!this.state.unlocked.includes(tier)) return false;
    this.edit({ tier }, at);
    return true;
  }

  /** The auras the worn loadout grants, and the one that runs. */
  auraSources(items: readonly GameItem[] = this.inventory.snapshot.items): AuraSource[] { return wornAuraSources(items); }
  activeAura(items: readonly GameItem[] = this.inventory.snapshot.items): AuraSource | null {
    return pickAura(this.auraSources(items), this.state.aura);
  }

  combatRules(): CombatRules {
    const items = this.inventory.snapshot.items;
    const a = this.activeAura(items);
    const s = this.state;
    return {
      tier: s.tier, seed: this.seed(), magicFind: this.inventory.equippedMagicFind,
      aura: a ? { id: a.aura, level: a.level } : null,
      resists: wornResists(items), filter: s.filter,
    };
  }

  /**
   * What a kill drops on top of its area's table, rolled from the loot seed and
   * the save's kill count (`rolls`, advanced per kill): reproducible from the
   * save, and a reload continues the sequence rather than replaying a kill.
   */
  rollLoot(ctx: { creature: string; level: number; rank: MonsterRank; killKey?: string }): LootDrop[] {
    const seed = this.seed();
    const s = this.state;
    const n = s.rolls + 1;
    if (this.isBrowser) this.write({ ...s, rolls: n });
    const rng = seededRandom(hashSeed(`${seed}|kill|${n}`));
    return rollCreatureLoot({ creature: ctx.creature, level: ctx.level, tier: s.tier, magicFind: this.inventory.equippedMagicFind, rank: ctx.rank }, rng);
  }

  /**
   * A gear or rune drop was walked over or tapped: mint it into the satchel
   * (an item) or the Forge ledger (a rune). False leaves it on the ground.
   */
  grantDrop(dropId: string, drop: { item?: { definitionId: string; rarity: LootTier }; rune?: string }): GameItem | true | false {
    if (!this.isBrowser) return false;
    if (this.granted.has(dropId)) return true;
    if (drop.item) {
      const rng = seededRandom(hashSeed(`${this.seed()}|mint|${dropId}`));
      const item = mintEquipment(drop.item.definitionId, drop.item.rarity, rng);
      if (!item) return false;
      const landed = this.inventory.add(item);
      if (!landed) return false;
      this.granted.add(dropId);
      return landed;
    }
    if (drop.rune) {
      const rune = runeById(drop.rune);
      if (!rune) return false;
      const rng = seededRandom(hashSeed(`${this.seed()}|rune|${dropId}`));
      if (!this.runes.grant(rune, rng)) return false;
      this.granted.add(dropId);
      return true;
    }
    return false;
  }

  /** A creature fell: a gate boss on this tier opens the next. Returns the tier opened, if any. */
  killed(creature: string, at = Date.now()): DifficultyTier | null {
    const s = this.state;
    const next = unlockedBy(creature, s.tier);
    if (!next || s.unlocked.includes(next)) return null;
    this.write({ ...s, unlocked: [...s.unlocked, next], updatedAt: Math.max(at, s.updatedAt + 1) });
    return next;
  }

  /**
   * The Keeper fell at (area, x, y): the tier's share of the purse is taken and
   * left there (the corpse run). An earlier purse not recovered is gone (D2's
   * second death). Returns the Gold left; 0 when the purse was empty.
   */
  fall(area: string, x: number, y: number, at = Date.now()): number {
    if (!this.isBrowser) return 0;
    const s = this.state;
    const gold = deathCost(this.economy.snapshot.gold, s.tier);
    const purse: FallenPurse | null = gold > 0 && this.economy.spendGold(gold, 'fall') ? { area, x: Math.round(x), y: Math.round(y), gold, tier: s.tier } : null;
    this.write({ ...s, purse, purseAt: Math.max(at, s.purseAt + 1) });
    return purse?.gold ?? 0;
  }

  /** The purse was walked over: its Gold comes home. Returns it (0 if none). */
  recover(at = Date.now()): number {
    const s = this.state;
    if (!s.purse) return 0;
    const gold = s.purse.gold;
    this.write({ ...s, purse: null, purseAt: Math.max(at, s.purseAt + 1) });
    this.economy.earnGold(gold, 'recovered');
    return gold;
  }

  // ── Inside ────────────────────────────────────────────────────────────────

  /** The loot seed, minted once (first use) and saved. */
  private seed(): number {
    const s = this.state;
    if (s.seed) return s.seed;
    if (!this.isBrowser) return 1;
    let seed = 0;
    try { const a = new Uint32Array(1); crypto.getRandomValues(a); seed = a[0]; } catch { seed = Math.floor(Math.random() * 2 ** 32); }
    seed = (seed >>> 0) || 1;
    this.write({ ...s, seed });
    return seed;
  }

  private edit(patch: Partial<Pick<LootSave, 'filter' | 'aura' | 'tier'>>, at: number): void {
    const cur = this.state;
    this.write({ ...cur, ...patch, updatedAt: Math.max(at, cur.updatedAt + 1) });
  }

  private write(next: LootSave): void {
    this.subject.next(next);
    if (this.isBrowser) this.store.write(LOOT_KEY, next);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.subject.next(coerceLoot(this.store.read(LOOT_KEY)));
    this.saves.register(LOOT_KEY, { rehydrate: () => this.subject.next(coerceLoot(this.store.read(LOOT_KEY))) });
  }
}
