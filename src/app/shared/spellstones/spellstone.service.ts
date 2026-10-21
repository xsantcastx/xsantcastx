/**
 * spellstone.service.ts — the only writer of `godforge-spellstones` (spellstones.model.ts): Soul, the stone pouch and
 * the belt's Spellstone slot. Per character (the gateway maps the key onto the active character, save/character-scope.ts);
 * registered with LocalSaveRegistry, so a cloud merge lands in memory in the same tick. Nothing here touches localStorage.
 *
 *  - kill()      a kill's Soul (soulForKill), never past the level's cap
 *  - inscribe()  1 Basalt Blank from the satchel + the recipe's Soul → charges on the stone (skill@rank)
 *  - use()       one charge of the slotted stone, after the shared one-second cooldown; the play view hands the spell
 *                to the engine (castStone) and only then is the charge spent (a cast that cannot go off costs nothing)
 *  - buyBlanks() Edrin Kade's counter: blanks for Gold, priced on the hunt
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { EconomyService } from '../economy/economy.service';
import {
  BLANK_ID, SPELLSTONES_KEY, STONE_COOLDOWN, blankPrice, coerceSpellstones, emptySpellstones, gainSoul, inscribe, parseStoneKey,
  soulCap, soulForKill, spendCharge, stoneRecipe, type SpellstoneSave,
} from './spellstones.model';

export type InscribeCode = 'ok' | 'rank' | 'blank' | 'soul' | 'failed' | 'ssr';
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

  /** Inscribe a Spellstone of `skill` at `rank` (the spell's mana sets the recipe). The blank first, then the stone. */
  inscribe(skill: string, rank: number, mana: number, at = Date.now()): InscribeCode {
    if (!this.isBrowser) return 'ssr';
    const s = this.state, recipe = stoneRecipe(mana);
    if (!(rank >= 1)) return 'rank';
    if (this.blanks < recipe.blanks) return 'blank';
    if (s.soul < recipe.soul) return 'soul';
    const next = inscribe(s, skill, rank, recipe);
    if (!next) return 'soul';
    const res = this.inventory.consumeStacks(`spellstone:inscribe:${skill}:${at.toString(36)}:${++this.seq}`, [{ id: BLANK_ID, count: recipe.blanks }]);
    if (!res.ok) return 'failed';
    this.write({ ...next, at: Math.max(at, s.at + 1) });
    return 'ok';
  }

  /** Put a stone on the belt's Spellstone slot (null: take it off). */
  slot(key: string | null, at = Date.now()): void {
    if (!this.isBrowser) return;
    const s = this.state;
    if (key !== null && !((s.pouch[key] ?? 0) > 0)) return;
    if (s.slot === key) return;
    this.write({ ...s, slot: key, at: Math.max(at, s.at + 1) });
  }

  /** The slotted stone, ready or not: its spell, rank, charges and the cooldown left (0–1). `now` in seconds. */
  slotted(now: number): { key: string; skill: string; rank: number; charges: number; left: number } | null {
    const s = this.state, key = s.slot, parsed = key ? parseStoneKey(key) : null;
    if (!key || !parsed || !((s.pouch[key] ?? 0) > 0)) return null;
    return { key, ...parsed, charges: s.pouch[key], left: this.cooldownLeft(now) / STONE_COOLDOWN };
  }
  cooldownLeft(now: number): number { return this.lastCast === null ? 0 : Math.max(0, STONE_COOLDOWN - (now - this.lastCast)); }

  /**
   * Use the stone at `key`: `cast` is the engine's (it returns why not, or null when the spell went off). A charge is
   * spent only when it went off. `now` in seconds (the cooldown), `at` in ms (the save).
   */
  use(key: string, now: number, cast: (skill: string, rank: number) => string | null, at = Date.now()): 'ok' | 'none' | 'cooldown' | string {
    if (!this.isBrowser) return 'none';
    const s = this.state, parsed = parseStoneKey(key);
    if (!parsed || !((s.pouch[key] ?? 0) > 0)) return 'none';
    if (this.cooldownLeft(now) > 0) return 'cooldown';
    const why = cast(parsed.skill, parsed.rank);
    if (why) return why;
    const next = spendCharge(s, key);
    if (!next) return 'none';
    this.lastCast = now;
    this.write({ ...next, at: Math.max(at, s.at + 1) });
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
    this.subject.next(coerceSpellstones(this.store.read(SPELLSTONES_KEY)));
    this.saves.register(SPELLSTONES_KEY, { rehydrate: () => this.subject.next(coerceSpellstones(this.store.read(SPELLSTONES_KEY))) });
  }
}
