/**
 * shops.model.ts — the district shops, RuneScape-style (docs/design/shops.md; canon §6.5).
 *
 * Each shop has its own stock and buys only the goods that fit it; each stands in its district of a city (the
 * general store in the market, the tackle by the water, the woodcutter by the trees, the smith among the forges).
 * Gold only, never real money. Prices come off the economy curve: a thing costs `huntGold(level, seconds)`, so many
 * seconds of a steady hunt at the level it is meant for (economy-curve.ts), and potions keep their pinned shelf
 * prices (potions.model.ts, checked by economy-sim). A shop buys back at the vendor floor (`buybackPrice`, 8% of a
 * thing's worth), so buying and selling is never a Gold loop; `economy-sim --check` pins both.
 *
 * Pure data and functions, SSR-safe. The writes are ShopService's.
 */
import { huntGold, ITEM_ECONOMY_SCALE } from '../economy/economy-curve';
import { POTION_SHELF, potionById } from '../potions/potions.model';
import { VENDOR_SHELF, buybackPrice } from '../vendor/material-vendor.model';
import { CATCHES, CRATE_IDS, LEDGER_CATCH_IDS } from '../fishing/fishing.model';
import { TOOL_TIER_LEVEL } from '../skills/tools';
import { blankPrice } from '../spellstones/spellstones.model';
import { waygateScrollPrice } from '../waygate/waygate-scroll';

export type ShopId = 'general' | 'fishing' | 'wood' | 'smith' | 'alchemist';
export const SHOP_IDS: readonly ShopId[] = ['general', 'fishing', 'wood', 'smith', 'alchemist'];

/** The station id each shop stands at (StationDef.id; the panel is 'shop'). */
export const SHOP_STATION: Readonly<Record<ShopId, string>> = {
  general: 'shop-general', fishing: 'shop-fishing', wood: 'shop-wood', smith: 'shop-smith', alchemist: 'shop-alchemist',
};

export function shopOfStation(stationId: string | null | undefined): ShopId | null {
  const hit = SHOP_IDS.find(id => SHOP_STATION[id] === stationId);
  return hit ?? null;
}

/** One thing on a shelf. */
export type ShopOffer =
  /** A satchel stack (a torch, a rod, bait). `level` + `secs` price it off the curve. */
  | { id: string; kind: 'stack'; key: string; level: number; secs: number; skill?: { id: 'fishing'; level: number } }
  /** A potion (PotionService.buy, its pinned price). */
  | { id: string; kind: 'potion'; key: string }
  /** Priced on the Keeper's level by its own module: the Basalt Blank (Spellstones) and the Waygate Scroll. */
  | { id: string; kind: 'special'; key: 'basalt-blank' | 'waygate-scroll' }
  /** An item minted at the counter: a tool, or a normal base with empty sockets (the Smith's). */
  | { id: string; kind: 'item'; key: string; level: number; secs: number; sockets?: number };

export interface ShopDef {
  id: ShopId;
  stock: readonly ShopOffer[];
  /** The stack keys it buys back (materials, fish, herbs). */
  buys: ReadonlySet<string>;
  /** Whether it buys gear (equipment and charms the till pays for). */
  buysGear: boolean;
}

const SET = (ids: readonly string[]) => new Set(ids);
const ORE = ['slag-fragment', 'cinder-ore', 'ember-residue', 'pyrite-dust', 'emberheart-ore', 'orichalcum-ore', 'godforge-slag', 'celestial-alloy', 'luminous-prism', 'celestial-quartz'];
const HERBS = ['sunbloom', 'nightbloom', 'starlight-herb', 'moonpetal-herb', 'verdant-sap', 'umbral-ink', 'solar-resin'];
const WOOD = ['world-root-bark', 'thornroot', 'verdant-sap', 'shadowthread-silk'];
const FISHED = CATCHES.filter(c => !LEDGER_CATCH_IDS.includes(c.id)).map(c => c.id);

export const SHOPS: Readonly<Record<ShopId, ShopDef>> = {
  // The market's store: what keeps a Keeper walking. Edrin Kade (Seamworks) brews the small potions himself.
  general: {
    id: 'general',
    stock: [
      { id: 'gen-torch', kind: 'stack', key: 'torch', level: 1, secs: 15 },
      { id: 'gen-ladder', kind: 'stack', key: 'ladder', level: 1, secs: 30 },
      { id: 'gen-platform', kind: 'stack', key: 'platform', level: 1, secs: 30 },
      { id: 'gen-rope', kind: 'stack', key: 'bark-rope', level: 3, secs: 30 },
      { id: 'gen-rail', kind: 'stack', key: 'seam-rail', level: 1, secs: 20 },
      { id: 'gen-blank', kind: 'special', key: 'basalt-blank' },
      { id: 'gen-waygate', kind: 'special', key: 'waygate-scroll' },
      { id: 'gen-minor-health', kind: 'potion', key: 'minor-health-potion' },
      { id: 'gen-minor-mana', kind: 'potion', key: 'minor-mana-potion' },
      { id: 'gen-lesser-health', kind: 'potion', key: 'lesser-health-potion' },
      { id: 'gen-lesser-mana', kind: 'potion', key: 'lesser-mana-potion' },
    ],
    // The old Material Vendor's whole board: no material lost its counter.
    buys: SET(VENDOR_SHELF.map(v => v.materialId)),
    buysGear: true,
  },
  // By the water: rods, bait, and the catch bought back.
  fishing: {
    id: 'fishing',
    stock: [
      { id: 'fish-root-rod', kind: 'stack', key: 'root-rod', level: 1, secs: 240, skill: { id: 'fishing', level: 1 } },
      { id: 'fish-seam-rod', kind: 'stack', key: 'seam-rod', level: 10, secs: 300, skill: { id: 'fishing', level: 10 } },
      { id: 'fish-grub', kind: 'stack', key: 'ember-grub', level: 1, secs: 10 },
      { id: 'fish-bucket', kind: 'stack', key: 'seam-bucket', level: 5, secs: 120 },
    ],
    buys: SET(FISHED),
    buysGear: false,
  },
  // By the trees: axes, and the wood bought back.
  wood: {
    id: 'wood',
    stock: [
      { id: 'wood-axe-1', kind: 'item', key: 'axe-1', level: TOOL_TIER_LEVEL[1], secs: 180 },
      { id: 'wood-axe-2', kind: 'item', key: 'axe-2', level: TOOL_TIER_LEVEL[2], secs: 300 },
      { id: 'wood-timber', kind: 'stack', key: 'timber-support', level: 5, secs: 60 },
    ],
    buys: SET(WOOD),
    buysGear: false,
  },
  // Among the forges: plain steel with room in it (normal bases with empty sockets, the Enchanting Table's supply:
  // canon §6.5), and ore and gear bought back. Two-well bases at item level 10, three-well at 15.
  smith: {
    id: 'smith',
    stock: [
      { id: 'smith-longblade-2', kind: 'item', key: 'eclipse-longblade', level: 10, secs: 300, sockets: 2 },
      { id: 'smith-staff-2', kind: 'item', key: 'keeper-staff', level: 10, secs: 300, sockets: 2 },
      { id: 'smith-buckler-2', kind: 'item', key: 'void-buckler', level: 10, secs: 300, sockets: 2 },
      { id: 'smith-cowl-2', kind: 'item', key: 'keepers-cowl', level: 10, secs: 300, sockets: 2 },
      { id: 'smith-mantle-2', kind: 'item', key: 'keepers-mantle', level: 10, secs: 300, sockets: 2 },
      { id: 'smith-buckler-3', kind: 'item', key: 'void-buckler', level: 12, secs: 390, sockets: 3 },
      { id: 'smith-mace-3', kind: 'item', key: 'rootbreaker-mace', level: 15, secs: 390, sockets: 3 },
      { id: 'smith-crossbow-3', kind: 'item', key: 'spinerift-crossbow', level: 15, secs: 390, sockets: 3 },
      { id: 'smith-helm-3', kind: 'item', key: 'astral-helm', level: 15, secs: 390, sockets: 3 },
      { id: 'smith-mantle-3', kind: 'item', key: 'keepers-mantle', level: 15, secs: 390, sockets: 3 },
    ],
    buys: SET(ORE),
    buysGear: true,
  },
  // The plaza's apothecary: every potion on the shelf, and herbs bought back. Not the Rejuvenations.
  alchemist: {
    id: 'alchemist',
    stock: POTION_SHELF.map(p => ({ id: `alc-${p.id}`, kind: 'potion' as const, key: p.id })),
    buys: SET(HERBS),
    buysGear: false,
  },
};

const OFFERS = new Map<string, { shop: ShopId; offer: ShopOffer }>();
for (const shop of SHOP_IDS) for (const offer of SHOPS[shop].stock) OFFERS.set(offer.id, { shop, offer });

export function offerById(id: string): { shop: ShopId; offer: ShopOffer } | undefined { return OFFERS.get(id); }

/** What one of the offer costs, in Gold (whole, ≥ 1). `level`: the Keeper's (the level-priced specials read it). */
export function offerPrice(offer: ShopOffer, level = 1): number {
  if (offer.kind === 'potion') return potionById(offer.key)?.price ?? 0;
  if (offer.kind === 'special') return offer.key === 'basalt-blank' ? blankPrice(level) : waygateScrollPrice(level);
  return Math.max(1, huntGold(offer.level, offer.secs));
}

/** A stack's worth (v3 Gold) for the buyback floor, or 0 when no shop prices it. */
export function stackWorth(key: string): number {
  const shelf = VENDOR_SHELF.find(v => v.materialId === key);
  if (shelf) return shelf.worth;
  const fish = CATCHES.find(c => c.id === key);
  if (fish && !LEDGER_CATCH_IDS.includes(fish.id)) return Math.round(fish.anchor * ITEM_ECONOMY_SCALE);
  return 0;
}

/** What this shop pays for one of a stack, or 0 when it does not buy it. */
export function buyPriceOf(shop: ShopId, key: string): number {
  if (!SHOPS[shop].buys.has(key)) return 0;
  return buybackPrice(stackWorth(key));
}

/** Whether a crate counts as a catch (bought back like a fish). */
export function isCrate(key: string): boolean { return CRATE_IDS.includes(key); }

/** The keepers by name, per shop stall (StationDef.keeper). Names are canon §5 / §6.5. */
export const SHOP_KEEPERS: Readonly<Record<string, string>> = {
  'edrin-kade': 'Edrin Kade',
  'davy-tarn': 'Davy Tarn',
  'abe-thatch': 'Forester Abe Thatch',
  'garrick-dross': 'Garrick Dross',
  'ysolde-marr': 'Forgewife Ysolde Marr',
  'netter-pell': 'Old Netter Pell',
  'juno-marl': 'Apothecary Juno Marl',
  'hesk-ashby': 'Woodward Hesk Ashby',
  'teo-alder': 'Provisioner Teo Alder',
  'rue-hazel': 'Seedwife Rue Hazel',
  'odo-murk': 'Chandler Odo Murk',
  'dace-morrow': 'Fishmonger Dace Morrow',
};
