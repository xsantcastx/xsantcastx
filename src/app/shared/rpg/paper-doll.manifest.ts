/**
 * paper-doll.manifest.ts — C4 slot shell.
 *
 * Coordinates are percentages of a fixed-aspect doll frame. Overlay assets
 * are omitted on purpose: C4 is the shell and text/SVG fallbacks only.
 * C5 may attach approved transparent runtime overlays here.
 *
 * Live inventory still uses SlotId (`offhand`, `charm1–3`). Display maps
 * `offhand` → `off-hand`. Charm slots are a legacy strip, not doll controls.
 */
import type { SlotId } from './item.model';

export type DollSlotId =
  | 'head'
  | 'chest'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'weapon'
  | 'off-hand'
  | 'trinket';

export interface PaperDollSlotManifest {
  slotId: DollSlotId;
  /** Compatible live inventory slot, if one exists today. */
  liveSlot?: SlotId;
  labelKey: string;
  glyph: string;
  control: { x: number; y: number };
}

/** Runtime copy of the approved master, resized to 720² so /character stays lazy. */
export const PAPER_DOLL_SRC = 'assets/characters/paper-doll/01-keeper-paper-doll.png';

export const DOLL_SLOT_GLYPH: Record<DollSlotId, string> = {
  head: 'assets/ui/svg/character/head.svg',
  chest: 'assets/ui/svg/character/chest.svg',
  hands: 'assets/ui/svg/character/hands.svg',
  legs: 'assets/ui/svg/character/legs.svg',
  feet: 'assets/ui/svg/character/feet.svg',
  weapon: 'assets/ui/svg/character/weapon.svg',
  'off-hand': 'assets/ui/svg/character/off-hand.svg',
  trinket: 'assets/ui/svg/character/trinket.svg',
};

export const PAPER_DOLL_SLOTS: readonly PaperDollSlotManifest[] = [
  { slotId: 'head', liveSlot: 'head', labelKey: 'loadout.slot.head', glyph: DOLL_SLOT_GLYPH.head, control: { x: 50, y: 10 } },
  { slotId: 'chest', liveSlot: 'chest', labelKey: 'loadout.slot.chest', glyph: DOLL_SLOT_GLYPH.chest, control: { x: 50, y: 32 } },
  { slotId: 'hands', labelKey: 'loadout.slot.hands', glyph: DOLL_SLOT_GLYPH.hands, control: { x: 24, y: 36 } },
  { slotId: 'weapon', liveSlot: 'weapon', labelKey: 'loadout.slot.weapon', glyph: DOLL_SLOT_GLYPH.weapon, control: { x: 16, y: 48 } },
  { slotId: 'off-hand', liveSlot: 'offhand', labelKey: 'loadout.slot.offhand', glyph: DOLL_SLOT_GLYPH['off-hand'], control: { x: 84, y: 48 } },
  { slotId: 'legs', labelKey: 'loadout.slot.legs', glyph: DOLL_SLOT_GLYPH.legs, control: { x: 50, y: 58 } },
  { slotId: 'feet', labelKey: 'loadout.slot.feet', glyph: DOLL_SLOT_GLYPH.feet, control: { x: 50, y: 82 } },
  { slotId: 'trinket', labelKey: 'loadout.slot.trinket', glyph: DOLL_SLOT_GLYPH.trinket, control: { x: 78, y: 18 } },
];

export const LEGACY_CHARM_SLOTS: readonly SlotId[] = ['charm1', 'charm2', 'charm3'];

export function liveSlotFor(doll: DollSlotId): SlotId | null {
  return PAPER_DOLL_SLOTS.find(slot => slot.slotId === doll)?.liveSlot ?? null;
}
