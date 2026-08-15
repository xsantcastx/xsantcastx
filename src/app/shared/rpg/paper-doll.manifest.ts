/**
 * paper-doll.manifest.ts — C5 slot shell + approved overlays.
 *
 * Overlay assets are the approved transparent slot copies, shown only when
 * that slot is filled. hands/legs/trinket are live without overlays yet.
 * feet stays locked. Never use concept crops. Basalt Edge swaps the
 * weapon overlay when that instance is worn.
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

export interface PaperDollOverlay {
  asset: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface PaperDollSlotManifest {
  slotId: DollSlotId;
  liveSlot?: SlotId;
  labelKey: string;
  glyph: string;
  control: { x: number; y: number };
  overlay?: PaperDollOverlay;
}

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

const full: Omit<PaperDollOverlay, 'asset' | 'zIndex'> = { x: 0, y: 0, width: 100, height: 100 };

export const PAPER_DOLL_SLOTS: readonly PaperDollSlotManifest[] = [
  { slotId: 'head', liveSlot: 'head', labelKey: 'loadout.slot.head', glyph: DOLL_SLOT_GLYPH.head, control: { x: 50, y: 10 }, overlay: { ...full, asset: 'assets/characters/overlays/01-head-overlay.png', zIndex: 4 } },
  { slotId: 'chest', liveSlot: 'chest', labelKey: 'loadout.slot.chest', glyph: DOLL_SLOT_GLYPH.chest, control: { x: 50, y: 32 }, overlay: { ...full, asset: 'assets/characters/overlays/02-chest-overlay.png', zIndex: 3 } },
  { slotId: 'hands', liveSlot: 'hands', labelKey: 'loadout.slot.hands', glyph: DOLL_SLOT_GLYPH.hands, control: { x: 24, y: 36 } },
  { slotId: 'weapon', liveSlot: 'weapon', labelKey: 'loadout.slot.weapon', glyph: DOLL_SLOT_GLYPH.weapon, control: { x: 16, y: 48 }, overlay: { ...full, asset: 'assets/characters/overlays/06-weapon-overlay.png', zIndex: 5 } },
  { slotId: 'off-hand', liveSlot: 'off-hand', labelKey: 'loadout.slot.offhand', glyph: DOLL_SLOT_GLYPH['off-hand'], control: { x: 84, y: 48 }, overlay: { ...full, asset: 'assets/characters/overlays/07-off-hand-overlay.png', zIndex: 5 } },
  { slotId: 'legs', liveSlot: 'legs', labelKey: 'loadout.slot.legs', glyph: DOLL_SLOT_GLYPH.legs, control: { x: 50, y: 58 } },
  { slotId: 'feet', labelKey: 'loadout.slot.feet', glyph: DOLL_SLOT_GLYPH.feet, control: { x: 50, y: 82 } },
  { slotId: 'trinket', liveSlot: 'trinket', labelKey: 'loadout.slot.trinket', glyph: DOLL_SLOT_GLYPH.trinket, control: { x: 78, y: 18 } },
];

export function liveSlotFor(doll: DollSlotId): SlotId | null {
  return PAPER_DOLL_SLOTS.find(slot => slot.slotId === doll)?.liveSlot ?? null;
}
