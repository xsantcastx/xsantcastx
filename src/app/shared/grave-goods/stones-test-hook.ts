/**
 * stones-test-hook.ts — the screenshot specs' hook for Spellstones and grave-goods (`?fxstones=1`, honoured only under
 * an automated browser, like `?fxgold=1`). `window.__tdStones` sets the Soul, hands Basalt Blanks, and mints a cursed
 * or a whispering piece through the real mint and the real inventory, so every surface reads them as it would a drop.
 */
import type { InventoryService } from '../rpg/inventory.service';
import { mintEquipment } from '../rpg/item-definition';
import type { SpellstoneService } from '../spellstones/spellstone.service';
import { BLANK_ID } from '../spellstones/spellstones.model';
import { CURSE_IDS, WHISPER_IDS, curseFor, isCurseId, isWhisperId, type CurseId, type WhisperId } from './grave-goods.model';

/** True only under an automated browser with `?fxstones=1` in the address. */
export function stonesHookOn(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxstones=1\b/.test(location.search);
}

/** Install `window.__tdStones`; returns the uninstall. A no-op (and a no-op uninstall) when the hook is off. */
export function installStonesHook(deps: { stones: SpellstoneService; inventory: InventoryService }): () => void {
  if (!stonesHookOn()) return () => undefined;
  let n = 0;
  const mint = (defId: string, rarity: 'rare' | 'epic' | 'legendary', level: number) =>
    mintEquipment(defId, rarity, Math.random, new Date().toISOString(), `fx-grave-${Date.now().toString(36)}-${++n}`, level);
  const hook = {
    soul: (v: number) => { deps.stones.setSoulForTest(Number(v)); return deps.stones.state.soul; },
    blanks: (v: number) => deps.inventory.grantStack(`fx:blank:${Date.now().toString(36)}:${++n}`, BLANK_ID, Math.max(1, Math.floor(Number(v) || 1))),
    /** A cursed piece (default: a Keeper's Cowl, Grave-cold, item level 20); `wear` puts it on. Returns its id. */
    cursed: (curse: string = CURSE_IDS[0], wear = false) => {
      const item = mint('keepers-cowl', 'rare', 20);
      if (!item) return null;
      const id = isCurseId(curse) ? curse as CurseId : CURSE_IDS[0];
      deps.inventory.add({ ...item, curse: curseFor(id, 20) });
      if (wear) deps.inventory.equip(item.id);
      return item.id;
    },
    /** A whispering piece (default: a Keeper's Cowl, the first voice) with `kills` already made; `wear` puts it on. */
    whisper: (voice: string = WHISPER_IDS[0], kills = 0, wear = false) => {
      const item = mint('keepers-cowl', 'legendary', 24);
      if (!item) return null;
      const id = isWhisperId(voice) ? voice as WhisperId : WHISPER_IDS[0];
      deps.inventory.add({ ...item, whisper: { id, kills: Math.max(0, Math.floor(Number(kills) || 0)) } });
      if (wear) deps.inventory.equip(item.id);
      return item.id;
    },
  };
  (window as unknown as Record<string, unknown>)['__tdStones'] = hook;
  return () => { delete (window as unknown as Record<string, unknown>)['__tdStones']; };
}
