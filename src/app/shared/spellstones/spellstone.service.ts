/**
 * spellstone.service.ts — the only writer of `godforge-spellstones` (spellstones.model.ts): Soul, the stone pouch and
 * the belt's Spellstone slot. Per character (the gateway maps the key onto the active character, save/character-scope.ts);
 * registered with LocalSaveRegistry, so a cloud merge lands in memory in the same tick. Nothing here touches localStorage.
 *
 *  - kill()      a kill's Soul (soulForKill), never past the level's cap
 *  - cut()       1 Basalt Blank from the satchel + the recipe's Soul → a Spellstone in the SATCHEL (skill-book.md §4):
 *                a 1×1 item recording the spell, rank, marks and charges (inscribe() is cut() with no marks)
 *  - use()       one charge of a satchel stone of the slotted recipe, after the shared one-second cooldown; the play
 *                view hands the spell to the engine (castStone) and only then is the charge spent
 *  - migration   a v1 save's hidden pouch becomes satchel stones on load, once (version 2), merge-safe: each stone's id
 *                names its spell, rank and the save's `inscribed` count, so two devices migrating the same pouch mint
 *                the same records (the merge keeps one) and a stone used up since stays used up (its tombstone wins)
 *  - buyBlanks() Edrin Kade's counter: blanks for Gold, priced on the hunt
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { EconomyService } from '../economy/economy.service';
import type { GameItem } from '../rpg/item.model';
import {
  BLANK_ID, SPELLSTONES_KEY, STONE_CHARGE_GOLD, STONE_COOLDOWN, STONE_MAX_CHARGES, blankPrice, coerceSpellstones, emptySpellstones,
  gainSoul, parseRecipeKey, parseStoneKey, recipeKey, recipeOfDef, soulCap, soulForKill, stoneDefId, stoneRecipe, type SpellstoneSave,
} from './spellstones.model';

export type InscribeCode = 'ok' | 'rank' | 'blank' | 'soul' | 'room' | 'failed' | 'ssr';

/** A Spellstone as a satchel item (charges carried on the item). */
export function mintStone(id: string, recipe: string, charges: number, foundAt: string, skillName?: string): GameItem {
  const parsed = parseRecipeKey(recipe);
  const name = `Spellstone: ${skillName ?? parsed?.skill ?? recipe}`;
  const n = Math.max(1, Math.min(STONE_MAX_CHARGES, Math.floor(charges)));
  return {
    id, name, type: 'artifact', rarity: 'common', stats: {}, sellValue: STONE_CHARGE_GOLD * n, equipped: false,
    foundAt, soulbound: false, definitionId: stoneDefId(recipe), charges: n,
    lore: 'A spell held in stone keeps the hand that cut it. Lend it to a friend and it still speaks in your voice.',
  };
}
export type BlankBuyCode = 'ok' | 'replayed' | 'funds' | 'failed' | 'unknown' | 'ssr';

@Injectable({ providedIn: 'root' })
export class SpellstoneService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private readonly subject = new BehaviorSubject<SpellstoneSave>(emptySpellstones());
  private hydrated = false;
  private lastCast: number | null = null;
  private seq = 0;

  get state(): SpellstoneSave { this.hydrate(); return this.subject.value; }
  get state$(): Observable<SpellstoneSave> { this.hydrate(); return this.subject.asObservable(); }
  /** Basalt Blanks in the satchel. */
  get blanks(): number { return this.isBrowser ? this.inventory.stackOf(BLANK_ID) : 0; }

  /** A kill of a creature of `creatureLevel` by a Keeper of `keeperLevel`: the Soul it gives (0 at the cap). */
  kill(keeperLevel: number, creatureLevel: number, harvestRank = 0, at = Date.now()): number {
    if (!this.isBrowser) return 0;
    const s = this.state, n = soulForKill(keeperLevel, creatureLevel, harvestRank);
    const next = gainSoul(s, n, soulCap(keeperLevel));
    if (next === s) return 0;
    this.write({ ...next, at: Math.max(at, s.at + 1) });
    return next.soul - s.soul;
  }

  /** Inscribe a Spellstone of `skill` at `rank` with no marks (the pre-book path): `cut` with marks 0. */
  inscribe(skill: string, rank: number, mana: number, at = Date.now()): InscribeCode {
    return this.cut(skill, rank, 0, mana, at);
  }

  /**
   * Cut a Spellstone (the Skill Book's "create Spellstone", skill-book.md §4.2): 1 Basalt Blank + the recipe's Soul →
   * a stone in the satchel recording the spell, its rank and the marks taken (`marks`, the row's 6-bit node mask).
   * Refused with 'room' when the satchel has no cell for it (nothing is spent). The first stone ever cut goes on the belt.
   */
  cut(skill: string, rank: number, marks: number, mana: number, at = Date.now()): InscribeCode {
    if (!this.isBrowser) return 'ssr';
    const s = this.state, recipe = stoneRecipe(mana);
    if (!(rank >= 1)) return 'rank';
    if (this.blanks < recipe.blanks) return 'blank';
    if (s.soul < recipe.soul) return 'soul';
    const key = recipeKey(skill, rank, marks);
    const stone = mintStone(`stone-${key.replace(/[@#]/g, '-')}-${at.toString(36)}-${++this.seq}`, key, recipe.charges, new Date(at).toISOString());
    if (!this.inventory.canPickUp(stone)) return 'room';
    const res = this.inventory.consumeStacks(`spellstone:inscribe:${skill}:${at.toString(36)}:${this.seq}`, [{ id: BLANK_ID, count: recipe.blanks }]);
    if (!res.ok) return 'failed';
    if (!this.inventory.add(stone)) return 'failed';
    // The first stone cut goes on the belt by itself (and an empty slot takes the newest).
    const slot = s.slot && this.chargesOf(s.slot) > 0 ? s.slot : key;
    this.write({ ...s, soul: s.soul - recipe.soul, inscribed: s.inscribed + 1, slot, at: Math.max(at, s.at + 1) });
    return 'ok';
  }

  /** The satchel's stones (loose in the satchel, not the Vault), newest first. */
  stones(): GameItem[] {
    return this.inventory.snapshot.bag.filter(i => recipeOfDef(i.definitionId) !== null);
  }
  /** Charges held in the satchel for a recipe. */
  chargesOf(recipe: string): number {
    return this.stones().filter(i => recipeOfDef(i.definitionId) === recipe).reduce((n, i) => n + (i.charges ?? 0), 0);
  }

  /** Put a stone's recipe on the belt's Spellstone slot (null: take it off). It must be in the satchel. */
  slot(key: string | null, at = Date.now()): void {
    if (!this.isBrowser) return;
    const s = this.state;
    const recipe = key === null ? null : (parseRecipeKey(key) ? recipeKey(parseRecipeKey(key)!.skill, parseRecipeKey(key)!.rank, parseRecipeKey(key)!.marks) : null);
    if (key !== null && (!recipe || this.chargesOf(recipe) <= 0)) return;
    if (s.slot === recipe) return;
    this.write({ ...s, slot: recipe, at: Math.max(at, s.at + 1) });
  }

  /** The slotted recipe, ready or not: its spell, rank, marks, the satchel's charges and the cooldown left (0–1). */
  slotted(now: number): { key: string; skill: string; rank: number; marks: number; charges: number; left: number } | null {
    const key = this.state.slot, parsed = key ? parseRecipeKey(key) : null;
    if (!key || !parsed) return null;
    const charges = this.chargesOf(key);
    if (charges <= 0) return null;
    return { key, ...parsed, charges, left: this.cooldownLeft(now) / STONE_COOLDOWN };
  }
  cooldownLeft(now: number): number { return this.lastCast === null ? 0 : Math.max(0, STONE_COOLDOWN - (now - this.lastCast)); }

  /**
   * Use a stone of the recipe `key` from the satchel: `cast` is the engine's (it returns why not, or null when the
   * spell went off). One charge is spent (from the emptiest stone of the pile) only when it went off. `now` in seconds.
   */
  use(key: string, now: number, cast: (skill: string, rank: number, marks: number) => string | null, _at = Date.now()): 'ok' | 'none' | 'cooldown' | string {
    if (!this.isBrowser) return 'none';
    const parsed = parseRecipeKey(key);
    if (!parsed) return 'none';
    const recipe = recipeKey(parsed.skill, parsed.rank, parsed.marks);
    const pile = this.stones().filter(i => recipeOfDef(i.definitionId) === recipe && (i.charges ?? 0) > 0)
      .sort((a, b) => (a.charges ?? 0) - (b.charges ?? 0) || a.id.localeCompare(b.id));
    if (!pile.length) return 'none';
    if (this.cooldownLeft(now) > 0) return 'cooldown';
    const why = cast(parsed.skill, parsed.rank, parsed.marks);
    if (why) return why;
    if (!this.inventory.spendCharge(pile[0].id)) return 'none';
    this.lastCast = now;
    return 'ok';
  }

  /** Buy `n` Basalt Blanks at Edrin Kade's counter for a Keeper of `level`. `pressId` names the press (a retry replays). */
  buyBlanks(n: number, level: number, pressId: string): BlankBuyCode {
    if (!this.isBrowser) return 'ssr';
    const count = Math.floor(n);
    if (!(count >= 1)) return 'unknown';
    const grantId = `spellstone:blank:${pressId}`;
    if (this.inventory.hasStackOp(grantId)) return 'replayed';
    const total = blankPrice(level) * count;
    if (this.economy.snapshot.gold < total) return 'funds';
    if (!this.inventory.grantStack(grantId, BLANK_ID, count)) return 'failed';
    if (!this.economy.spendGold(total, grantId)) {
      this.inventory.consumeStacks(`${grantId}:undo`, [{ id: BLANK_ID, count }]);
      return 'failed';
    }
    return 'ok';
  }

  /** Test hook only: set the Soul held (never past the hard cap). */
  setSoulForTest(n: number): void {
    const s = this.state;
    this.write({ ...s, soul: Math.max(0, Math.min(200, Math.floor(n))), at: Math.max(Date.now(), s.at + 1) });
  }

  private write(next: SpellstoneSave): void {
    this.subject.next(next);
    if (this.isBrowser) this.store.write(SPELLSTONES_KEY, next);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.inventory.init();
    this.adopt(coerceSpellstones(this.store.read(SPELLSTONES_KEY)));
    this.saves.register(SPELLSTONES_KEY, { rehydrate: () => this.adopt(coerceSpellstones(this.store.read(SPELLSTONES_KEY))) });
  }

  /**
   * Take a save in; a v1 save's pouch moves into the satchel first (skill-book.md §6.3), in the same tick, and the save
   * is written back as v2 with an empty pouch only after the satchel write landed.
   */
  private adopt(save: SpellstoneSave): void {
    if (save.version === 2) { this.subject.next(save); return; }
    const entries = Object.entries(save.pouch).filter(([k, n]) => parseStoneKey(k) && n > 0).sort(([a], [b]) => a.localeCompare(b));
    const stones: GameItem[] = [];
    for (const [k, n] of entries) {
      const { skill, rank } = parseStoneKey(k)!;
      const recipe = recipeKey(skill, rank, 0);
      for (let i = 0, left = n; left > 0; i++, left -= STONE_MAX_CHARGES) {
        stones.push(mintStone(`stone-mig-${skill}-${rank}-i${save.inscribed}-${i}`, recipe, Math.min(STONE_MAX_CHARGES, left), new Date(save.at || 0).toISOString()));
      }
    }
    if (stones.length && !this.inventory.addMigrated(stones, save.at)) { this.subject.next(save); return; }
    const next: SpellstoneSave = { ...save, version: 2, pouch: {}, at: Math.max(save.at, 1) };
    this.subject.next(next);
    this.store.write(SPELLSTONES_KEY, next);
  }
}
