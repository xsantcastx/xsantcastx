/**
 * vocation-look.ts — how a class looks on the Keeper, the same in every view (the play world's side and front/back
 * views, the Glass of Becoming's preview). Owner, 2026-10-20: "Warlocks should have an undead look".
 *
 * The Ashguard (design-bible §4.4) is the Pyre Watch's knight: the Keeper's own face and hair under an ember-lit iron
 * kit — helm, plate, gauntlets, greaves, boots, a blade and a brass-rimmed shield. Each piece is only a stand-in: a
 * slot the Keeper actually wears shows the worn piece instead, so visible gear layers on exactly as on the Warlock.
 */
import type { GearPiece, GearSlot, KeeperGear } from './keeper-gear';
import type { Vocation } from './keeper-look.model';
import type { KeeperGarb } from './npc-looks';

/** The undead Warlock: grey-green skin, a dark violet robe with bone trim, eyes that burn violet. */
export const WARLOCK_GARB: KeeperGarb = { skin: '#a7b59a', tunic: '#2e2236', trim: '#d9d2bf', trousers: '#1c1620', eyeGlow: '#b06bff', sash: '#7a4fd0' };

/** The Ashguard's surcoat under the plate: Pyre Watch red, brass trim, an ember sash from shoulder to hip. */
export const ASHGUARD_GARB: KeeperGarb = { tunic: '#8f3a3a', trim: '#c99a3e', trousers: '#2a2a36', sash: '#e2552a' };

/** The Pyre Watch kit, in the infernal realm's iron with its ember accent (keeper-gear STYLE_COLORS). */
const piece = (slot: GearSlot, kind: GearPiece['kind']): GearPiece => ({ slot, kind, style: 'infernal', rarity: 'common' });
export const ASHGUARD_KIT: Readonly<KeeperGear> = {
  head: { ...piece('head', 'helm'), color: '#8a94a4', accent: '#ff7a2e', variant: 'pyre' }, chest: piece('chest', 'plate'), hands: piece('hands', 'gauntlet'), legs: piece('legs', 'greaves'),
  feet: piece('feet', 'boots'), weapon: piece('weapon', 'sword'), 'off-hand': { ...piece('off-hand', 'shield'), color: '#8a6a2a', accent: '#ff7a2e' },
};

/** The class's garb and its gear with the class's own pieces standing in where nothing is worn. */
export function vocationLook(v: Vocation, gear: KeeperGear | null): { garb: KeeperGarb | null; gear: KeeperGear | null } {
  if (v === 'ashguard') return { garb: ASHGUARD_GARB, gear: { ...ASHGUARD_KIT, ...(gear ?? {}) } };
  if (v !== 'warlock') return { garb: null, gear };
  return {
    garb: WARLOCK_GARB,
    gear: { ...(gear ?? {}), head: gear?.head ?? { slot: 'head', kind: 'hood', style: 'umbral', rarity: 'common', color: '#2a1f30', accent: '#7a4fd0' } },
  };
}

/** Does the class carry the Warlock's staff in the front and back views (keeper-front frontSheet's `staff`)? */
export function carriesStaff(v: Vocation | string): boolean { return v === 'warlock'; }
