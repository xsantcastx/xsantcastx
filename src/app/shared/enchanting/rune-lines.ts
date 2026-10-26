/**
 * rune-lines.ts — what a rune does set into a weapon and into armour, as card lines (D2's two lines per rune).
 * A weapon well pays the rune's channel stat (socket.model.ts); an armour well its resist (loot/aura-sources.ts).
 */
import { formatItemMod, type ItemStats } from '../rpg/item.model';
import { runeResist } from '../loot/aura-sources';
import { socketEffectOf } from './socket.model';
import { ELEMENTS } from '../loot/damage.model';

const RESIST_KEY = { fire: 'fireResist', cold: 'coldResist', lightning: 'lightningResist', arcane: 'arcaneResist' } as const;

export function runeLines(runeId: string): { weapon: string; armor: string } {
  const eff = socketEffectOf(runeId);
  const weapon = (Object.entries(eff) as [keyof ItemStats, number][]).map(([k, v]) => formatItemMod(k, v)).join(', ');
  const res = runeResist(runeId);
  const armor = ELEMENTS.filter(e => res[e]).map(e => formatItemMod(RESIST_KEY[e], res[e]!)).join(', ');
  return { weapon, armor };
}
