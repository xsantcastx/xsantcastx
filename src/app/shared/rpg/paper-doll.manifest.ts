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

/**
 * The Keeper the loadout is built on.
 *
 * This was `paper-doll/01-keeper-paper-doll.png`, which is not a cut-out: it
 * has an opaque near-white card (250,250,250) painted behind the figure and a
 * decorative border baked into the edge. Only 15% of that file is transparent,
 * so it rendered as a bright rectangle in the middle of a dark page. `sips -g
 * hasAlpha` reports "yes" for it — the channel is there, it is just filled —
 * which is why nothing caught it. `01-keeper-base.png` is the real cut-out
 * (83% transparent, corners at alpha 0) and is better art besides.
 */
export const PAPER_DOLL_SRC = 'assets/game/characters/01-keeper-base-1024.webp';

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

/*
 * No slot carries an `overlay` right now, and that is deliberate.
 *
 * Four slots used to point at `assets/characters/overlays/*.png` placed at
 * x:0 y:0 width:100% height:100%. Those files are not paper-doll layers — they
 * are full-canvas *item* renders. Measured against the 1254² canvas, the Keeper
 * figure occupies 23%–80% horizontally while the chest render spans 8%–95%, so
 * compositing one at frame size buried the character instead of dressing it.
 *
 * The entity spec is explicit that a missing overlay stays an honest labelled
 * slot rather than fabricated equipment art, so the slots read as empty and the
 * item renders now do their real job as tile and Inspect art (see
 * `equipment-panel.component.ts#tileArt`), which is where the 12 authored
 * equipment definitions had no art at all.
 *
 * Restoring overlays needs body-aligned cut-outs authored against this base
 * plus per-slot x/y/width/height — not the item masters.
 */
/*
 * Two flanking columns plus a head well, deliberately *beside* the Keeper
 * rather than over it. The previous centre column put chest, legs and feet
 * directly on the figure, so the art the loadout exists to show was covered by
 * the controls describing it. Each column reads top-to-bottom in wear order.
 */
export const PAPER_DOLL_SLOTS: readonly PaperDollSlotManifest[] = [
  { slotId: 'head', liveSlot: 'head', labelKey: 'loadout.slot.head', glyph: DOLL_SLOT_GLYPH.head, control: { x: 50, y: 5 } },
  { slotId: 'chest', liveSlot: 'chest', labelKey: 'loadout.slot.chest', glyph: DOLL_SLOT_GLYPH.chest, control: { x: 11, y: 26 } },
  { slotId: 'hands', liveSlot: 'hands', labelKey: 'loadout.slot.hands', glyph: DOLL_SLOT_GLYPH.hands, control: { x: 11, y: 50 } },
  { slotId: 'weapon', liveSlot: 'weapon', labelKey: 'loadout.slot.weapon', glyph: DOLL_SLOT_GLYPH.weapon, control: { x: 11, y: 74 } },
  { slotId: 'trinket', liveSlot: 'trinket', labelKey: 'loadout.slot.trinket', glyph: DOLL_SLOT_GLYPH.trinket, control: { x: 89, y: 26 } },
  { slotId: 'legs', liveSlot: 'legs', labelKey: 'loadout.slot.legs', glyph: DOLL_SLOT_GLYPH.legs, control: { x: 89, y: 50 } },
  { slotId: 'off-hand', liveSlot: 'off-hand', labelKey: 'loadout.slot.offhand', glyph: DOLL_SLOT_GLYPH['off-hand'], control: { x: 89, y: 74 } },
  { slotId: 'feet', labelKey: 'loadout.slot.feet', glyph: DOLL_SLOT_GLYPH.feet, control: { x: 50, y: 93 } },
];

export function liveSlotFor(doll: DollSlotId): SlotId | null {
  return PAPER_DOLL_SLOTS.find(slot => slot.slotId === doll)?.liveSlot ?? null;
}
