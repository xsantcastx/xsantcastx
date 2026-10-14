/**
 * slate-items.model.ts — the Mirror Slate as things in the satchel
 * (docs/handoff/mirror-slate.md; lore: docs/world/lore-addendum.md, "The
 * Mirror Slate").
 *
 * A palm-sized pane of the Nocturne Archive's moon-mirror glass, bound in
 * Kael's brass. Two stacks, one per tier, so the tier IS the item the Keeper
 * holds (no second blob to merge): `mirror-slate` (tier I) and
 * `mirror-slate-ii` (tier II). Kael's binding consumes the tier I pane with
 * the Delve materials below and hands back the tier II one, in one ledger
 * write (InventoryService.craftStack).
 *
 *   tier I   Lune Coyne hands it over after ten plays at her four tables, or
 *            sells it (economy-curve MIRROR_SLATE). Opens the Slate: her tables
 *            anywhere, and the Homestead at a glance.
 *   tier II  Kael binds the glass's second face: map pins and Pim's bounties.
 *
 * Read by found-in.data.ts (Found in lines), scripts/check-meaning.js
 * (sources and uses) and slate.model.ts. No imports: the node harness loads it.
 */
export const MIRROR_SLATE_ID = 'mirror-slate';
export const MIRROR_SLATE_II_ID = 'mirror-slate-ii';

/** What Kael takes to bind tier II: the tier I pane and three things the Delve gives. */
export const SLATE_UPGRADE_INPUTS: readonly { id: string; count: number }[] = [
  { id: MIRROR_SLATE_ID, count: 1 },
  // Moonlit light for the glass (Glowcap Grotto).
  { id: 'glowcap', count: 6 },
  // Slag for the brass (the Delve's slag veins).
  { id: 'slag-fragment', count: 12 },
  // A black backing so the second face holds (where water meets lava).
  { id: 'obsidian-block', count: 4 },
];

export interface SlateItem {
  id: string;
  /** Found in… lines (found-in.data.ts). */
  foundIn: readonly string[];
  /** Where the game grants it (check-meaning sources). */
  sources: readonly string[];
  /** What it does (check-meaning uses). */
  uses: readonly string[];
}

export const SLATE_ITEMS: readonly SlateItem[] = [
  {
    id: MIRROR_SLATE_ID,
    foundIn: ['Nocturne Archive: Lune Coyne, after ten plays at her tables (or bought from her)'],
    sources: ['Lune Coyne after ten plays at her four tables (SlateService.checkAward)', 'bought from Lune Coyne (SlateService.buy)'],
    uses: ['carried: opens the Mirror Slate (P): her tables anywhere and the Homestead at a glance', 'Kael binds it into the Mirror Slate II'],
  },
  {
    id: MIRROR_SLATE_II_ID,
    foundIn: ['Basalt Seamworks: Kael binds it at the Rune Forge from a Mirror Slate'],
    sources: ['Kael binds a Mirror Slate with Delve glass and slag (SlateService.upgrade)'],
    uses: ['carried: the Mirror Slate with map pins and the Board Herald\'s bounties'],
  },
];
