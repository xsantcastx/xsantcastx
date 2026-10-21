/**
 * vocation-look.ts — how a class looks on the Keeper, the same in every view (the play world's side and front/back
 * views, the Glass of Becoming's preview). Owner, 2026-10-20: "Warlocks should have an undead look".
 *
 * The Ashguard (design-bible §4.4) is the Pyre Watch's knight: the Keeper's own face and hair under an ember-lit iron
 * kit — helm, plate, gauntlets, greaves, boots, a blade and a brass-rimmed shield. Each piece is only a stand-in: a
 * slot the Keeper actually wears shows the worn piece instead, so visible gear layers on exactly as on the Warlock.
 *
 * The Lanternwright (design-bible §4.3) is the lamp-keepers' own: the Keeper's face under a cream wool hood, a long
 * brass-buttoned coat, and a lantern hung from the crook of a pole — it glows, and its light is the Keeper's (td-lantern
 * VOCATION_LIGHT). A worn weapon takes the pole's hand; the lantern then hangs from the off-hand, unless that is worn too.
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

/** The Lanternwright's undercoat: cream wool, brass trim, dark breeches, a lamp-glow sash. */
export const LANTERN_GARB: KeeperGarb = { tunic: '#e8dcc0', trim: '#c99a3e', trousers: '#4a3a2a', sash: '#ffd27a' };

/** The lamp-keeper's kit: the hood, the coat, soft boots and the lamp-staff (a staff with a lantern at its crook). */
const lamp = (slot: GearSlot, kind: GearPiece['kind'], color: string, accent: string): GearPiece => ({ slot, kind, style: 'luminous', rarity: 'common', color, accent });
export const LANTERN_KIT: Readonly<KeeperGear> = {
  head: lamp('head', 'hood', '#d9c9a3', '#c99a3e'),
  chest: lamp('chest', 'coat', '#8a6a3a', '#ffd27a'),
  feet: lamp('feet', 'boots', '#5a4020', '#c99a3e'),
  weapon: { ...lamp('weapon', 'staff', '#6e4526', '#ffd27a'), variant: 'lamp' },
};
/** The lantern on its own, for the off-hand when the pole's hand holds a worn weapon. */
export const LANTERN_OFFHAND: GearPiece = lamp('off-hand', 'lantern', '#8a6a3a', '#ffd27a');

/** The class's garb and its gear with the class's own pieces standing in where nothing is worn. */
export function vocationLook(v: Vocation, gear: KeeperGear | null): { garb: KeeperGarb | null; gear: KeeperGear | null } {
  if (v === 'ashguard') return { garb: ASHGUARD_GARB, gear: { ...ASHGUARD_KIT, ...(gear ?? {}) } };
  if (v === 'lanternwright') {
    const out: KeeperGear = { ...LANTERN_KIT, ...(gear ?? {}) };
    // A worn staff carries the lantern at its crook; any other weapon leaves the lantern to the off-hand.
    if (gear?.weapon?.kind === 'staff') out.weapon = { ...gear.weapon, variant: 'lamp' };
    else if (gear?.weapon && !gear['off-hand']) out['off-hand'] = LANTERN_OFFHAND;
    return { garb: LANTERN_GARB, gear: out };
  }
  if (v !== 'warlock') return { garb: null, gear };
  return {
    garb: WARLOCK_GARB,
    gear: { ...(gear ?? {}), head: gear?.head ?? { slot: 'head', kind: 'hood', style: 'umbral', rarity: 'common', color: '#2a1f30', accent: '#7a4fd0' } },
  };
}

/** Does the class carry the Warlock's staff in the front and back views (keeper-front frontSheet's `staff`)? */
export function carriesStaff(v: Vocation | string): boolean { return v === 'warlock'; }
