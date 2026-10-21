/**
 * grave-goods.service.ts — what the Keeper does with cursed grave-goods and whispering items (grave-goods.model.ts).
 * Every write goes through the ledger that owns the thing: Gold through EconomyService (spent first), the item's
 * marks through InventoryService.setGrave (the sole writer of `curse` / `whisper` after the mint).
 *
 *  - cleanse()  Sexton Aldous Wren lays a curse to rest: the cost goes, the bonus halves ("Laid to rest.")
 *  - silence()  the Archivist silences a whisper: it keeps its words and stat, stops growing, and its cost goes
 *  - kill()     a kill with whispering items worn: each one still listening counts it; returns the ones that woke
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { InventoryService } from '../rpg/inventory.service';
import { EconomyService } from '../economy/economy.service';
import type { GameItem } from '../rpg/item.model';
import { cleansePrice, isCurseId, isWhisperId, silencePrice, whisperKill, whisperStage, type ItemWhisper } from './grave-goods.model';

export type GraveCode = 'ok' | 'missing' | 'done' | 'gold' | 'failed' | 'ssr';

@Injectable({ providedIn: 'root' })
export class GraveGoodsService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);

  /** Every cursed piece the Keeper holds (worn first), cleansed or not. */
  cursed(): GameItem[] {
    return this.inventory.snapshot.items.filter(i => i.curse && isCurseId(i.curse.id) && !i.explorerId).sort((a, b) => Number(b.equipped) - Number(a.equipped));
  }
  /** Every whispering piece the Keeper holds (worn first). */
  whispering(): GameItem[] {
    return this.inventory.snapshot.items.filter(i => i.whisper && isWhisperId(i.whisper.id) && !i.explorerId).sort((a, b) => Number(b.equipped) - Number(a.equipped));
  }

  /** Lay a curse to rest for Gold at `level`'s price. */
  cleanse(itemId: string, level: number): GraveCode {
    if (!this.isBrowser) return 'ssr';
    const item = this.inventory.itemById(itemId);
    if (!item?.curse || !isCurseId(item.curse.id)) return 'missing';
    if (item.curse.cleansed) return 'done';
    const price = cleansePrice(level);
    if (this.economy.snapshot.gold < price) return 'gold';
    // The mark first, then the Gold in the same tick (a crash between is a free cleanse, never a charged Keeper).
    const res = this.inventory.setGrave(itemId, { curse: { ...item.curse, cleansed: true } });
    if (!res.ok) return 'failed';
    if (!this.economy.spendGold(price, `sexton:cleanse:${itemId}`)) { this.inventory.setGrave(itemId, { curse: item.curse }); return 'gold'; }
    return 'ok';
  }

  /** Silence a whisper for Gold at `level`'s price. */
  silence(itemId: string, level: number): GraveCode {
    if (!this.isBrowser) return 'ssr';
    const item = this.inventory.itemById(itemId);
    if (!item?.whisper || !isWhisperId(item.whisper.id)) return 'missing';
    if (item.whisper.silenced) return 'done';
    const price = silencePrice(level);
    if (this.economy.snapshot.gold < price) return 'gold';
    const res = this.inventory.setGrave(itemId, { whisper: { ...item.whisper, silenced: true } });
    if (!res.ok) return 'failed';
    if (!this.economy.spendGold(price, `archivist:silence:${itemId}`)) { this.inventory.setGrave(itemId, { whisper: item.whisper }); return 'gold'; }
    return 'ok';
  }

  /** A kill: each worn, unsilenced whispering piece counts it. Returns the pieces that woke a new part of the sentence. */
  kill(): { item: GameItem; stage: number }[] {
    if (!this.isBrowser) return [];
    const woke: { item: GameItem; stage: number }[] = [];
    for (const item of this.inventory.snapshot.items) {
      const w = item.whisper;
      if (!item.equipped || item.explorerId || !w || !isWhisperId(w.id) || w.silenced) continue;
      const next = whisperKill(w as ItemWhisper);
      if (next === w) continue;
      const res = this.inventory.setGrave(item.id, { whisper: next });
      if (res.ok && whisperStage(next) > whisperStage(w)) woke.push({ item: res.item, stage: whisperStage(next) });
    }
    return woke;
  }
}
