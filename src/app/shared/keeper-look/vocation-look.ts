/**
 * vocation-look.ts — how a class looks on the Keeper, the same in every view (the play world's side and front/back
 * views, the Glass of Becoming's preview). Owner, 2026-10-20: "Warlocks should have an undead look".
 */
import type { KeeperGear } from './keeper-gear';
import type { Vocation } from './keeper-look.model';
import type { KeeperGarb } from './npc-looks';

/** The undead Warlock: grey-green skin, a dark violet robe with bone trim, eyes that burn violet. */
export const WARLOCK_GARB: KeeperGarb = { skin: '#a7b59a', tunic: '#2e2236', trim: '#d9d2bf', trousers: '#1c1620', eyeGlow: '#b06bff', sash: '#7a4fd0' };

/** The class's garb and its gear with the class's hood standing in when no head piece is worn. */
export function vocationLook(v: Vocation, gear: KeeperGear | null): { garb: KeeperGarb | null; gear: KeeperGear | null } {
  if (v !== 'warlock') return { garb: null, gear };
  return {
    garb: WARLOCK_GARB,
    gear: { ...(gear ?? {}), head: gear?.head ?? { slot: 'head', kind: 'hood', style: 'umbral', rarity: 'common', color: '#2a1f30', accent: '#7a4fd0' } },
  };
}
