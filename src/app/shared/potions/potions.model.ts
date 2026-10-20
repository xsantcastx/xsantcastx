/**
 * potions.model.ts — the Keeper's potions (D2's belt, Tibia's hotkeys, cozy-sized). Pure: no Angular, no DOM.
 *
 * Three Health and three Mana tiers (Minor · Lesser · Greater) and a Rejuvenation. They are stackable satchel
 * stacks (InventoryService.grantStack / consumeStacks), never ItemDefinitions: a definition fans out to four
 * catalogues, and a potion is a thing you drink, not a thing you wear or sell on.
 *
 * Rules (pinned by potions.model.spec.ts):
 *  - Q drinks the best Health potion held, R the best Mana potion held; a Rejuvenation stands in on either key when
 *    no potion of that kind is left.
 *  - One drink every POTION_COOLDOWN seconds, shared by both keys (Tibia's exhaust).
 *  - Health and Mana pour in over POTION_POUR_SECS (a gentle fill, the engine's drinkPotion); a Rejuvenation is
 *    instant and restores a share of both.
 *  - Sources: creatures drop them now and then (better ones from stronger creatures, rollPotionDrop), and Edrin Kade
 *    sells the six plain ones at the Seamworks counter for Gold (a Gold sink: he never buys them back).
 *
 * Every potion carries its Found in, sources, uses and lore for check-meaning.js and the hover card.
 */

export type PotionKind = 'health' | 'mana' | 'rejuv';
export type PotionTier = 1 | 2 | 3;

export interface PotionDef {
  id: string;
  name: string;
  kind: PotionKind;
  tier: PotionTier;
  /** Life poured in (health) — for a Rejuvenation, the share (0..1) of max life and mana it restores at once. */
  amount: number;
  /** Gold at Edrin Kade's counter; 0 = not sold (found only). */
  price: number;
  foundIn: readonly string[];
  sources: readonly string[];
  uses: readonly string[];
  lore: string;
}

/** Seconds between two drinks (shared by both keys). */
export const POTION_COOLDOWN = 2;
/** Seconds a Health or Mana potion takes to pour in. */
export const POTION_POUR_SECS = 1;
/** The keys of the belt (desktop); phones get two buttons. */
export const POTION_KEYS: Readonly<Record<'health' | 'mana', string>> = { health: 'Q', mana: 'R' };

const DROP = 'Creatures of the Emberwood, the Quarry and the deeps: now and then (stronger creatures drop better ones)';
const SHOP = 'Seamworks: Edrin Kade\'s counter (the Material Vendor) sells it for Gold';

export const POTIONS: readonly PotionDef[] = [
  {
    id: 'minor-health-potion', name: 'Minor Health Potion', kind: 'health', tier: 1, amount: 50, price: 25,
    foundIn: [SHOP, DROP], sources: ['creature drops (any creature, low chance)', 'Edrin Kade sells it (Material Vendor)'],
    uses: ['drunk from the belt (Q): mends 50 life over a second'],
    lore: 'Edrin Kade boils these on the forge\'s spare heat: emberwood bark, a pinch of ash, and more sugar than he admits.',
  },
  {
    id: 'lesser-health-potion', name: 'Lesser Health Potion', kind: 'health', tier: 2, amount: 110, price: 90,
    foundIn: [SHOP, DROP], sources: ['creature drops (level 8 and up)', 'Edrin Kade sells it (Material Vendor)'],
    uses: ['drunk from the belt (Q): mends 110 life over a second'],
    lore: 'Brewed twice, so the bark gives up its warmth. Miners keep one in a boot for the walk home.',
  },
  {
    id: 'greater-health-potion', name: 'Greater Health Potion', kind: 'health', tier: 3, amount: 220, price: 300,
    foundIn: [SHOP, DROP], sources: ['creature drops (level 16 and up)', 'Edrin Kade sells it (Material Vendor)'],
    uses: ['drunk from the belt (Q): mends 220 life over a second'],
    lore: 'Steeped on a heartstone overnight. It tastes of a warm kitchen, which is the point.',
  },
  {
    id: 'minor-mana-potion', name: 'Minor Mana Potion', kind: 'mana', tier: 1, amount: 30, price: 25,
    foundIn: [SHOP, DROP], sources: ['creature drops (any creature, low chance)', 'Edrin Kade sells it (Material Vendor)'],
    uses: ['drunk from the belt (R): pours back 30 mana over a second'],
    lore: 'Cold water from the Seamworks well, left one night under the open sky. It hums if you hold it to your ear.',
  },
  {
    id: 'lesser-mana-potion', name: 'Lesser Mana Potion', kind: 'mana', tier: 2, amount: 70, price: 90,
    foundIn: [SHOP, DROP], sources: ['creature drops (level 8 and up)', 'Edrin Kade sells it (Material Vendor)'],
    uses: ['drunk from the belt (R): pours back 70 mana over a second'],
    lore: 'Well water that sat out through a whole turn of the stars. The Archive swears it is only water.',
  },
  {
    id: 'greater-mana-potion', name: 'Greater Mana Potion', kind: 'mana', tier: 3, amount: 140, price: 300,
    foundIn: [SHOP, DROP], sources: ['creature drops (level 16 and up)', 'Edrin Kade sells it (Material Vendor)'],
    uses: ['drunk from the belt (R): pours back 140 mana over a second'],
    lore: 'Caught the night of an eclipse, stoppered before dawn could reach it. The glass is always cold.',
  },
  {
    id: 'rejuvenation-potion', name: 'Rejuvenation Potion', kind: 'rejuv', tier: 3, amount: 0.4, price: 0,
    foundIn: ['Creatures level 10 and up, rarely; champions and bosses more often'],
    sources: ['creature drops (level 10 and up, rare; champions and bosses more often)'],
    uses: ['drunk from the belt when no Health (Q) or Mana (R) potion is left: restores 40% of life and mana at once'],
    lore: 'Nobody in the Seamworks can brew it. The deep things carry it, as if someone keeps handing it down to them.',
  },
];

export const POTION_IDS: readonly string[] = POTIONS.map(p => p.id);
const BY_ID = new Map(POTIONS.map(p => [p.id, p]));
export function potionById(id: string): PotionDef | undefined { return BY_ID.get(id); }
/** What the counter sells, cheapest first. */
export const POTION_SHELF: readonly PotionDef[] = POTIONS.filter(p => p.price > 0);

/**
 * The potion a key drinks: the best tier of that kind held, else a Rejuvenation, else none.
 * `qty` reads a stack total (InventoryService.stackOf).
 */
export function bestPotion(kind: 'health' | 'mana', qty: (id: string) => number): PotionDef | null {
  const own = POTIONS.filter(p => p.kind === kind && qty(p.id) > 0).sort((a, b) => b.tier - a.tier);
  if (own.length) return own[0];
  const rejuv = POTIONS.find(p => p.kind === 'rejuv' && qty(p.id) > 0);
  return rejuv ?? null;
}

/** Seconds until the next drink (0 = ready). `lastAt` and `now` in seconds; null = never drank. */
export function potionCooldownLeft(lastAt: number | null, now: number): number {
  if (lastAt === null) return 0;
  return Math.max(0, POTION_COOLDOWN - (now - lastAt));
}

/** What a drink restores and how fast: life, mana, and the seconds it pours over (0 = at once). */
export function potionEffect(p: PotionDef, maxHp: number, maxMana: number): { heal: number; mana: number; secs: number } {
  if (p.kind === 'rejuv') return { heal: Math.round(maxHp * p.amount), mana: Math.round(maxMana * p.amount), secs: 0 };
  return p.kind === 'health' ? { heal: p.amount, mana: 0, secs: POTION_POUR_SECS } : { heal: 0, mana: p.amount, secs: POTION_POUR_SECS };
}

/** The tier a creature of this level drops: Minor below 8, Lesser below 16, Greater from 16. */
export function dropTier(level: number): PotionTier {
  return level >= 16 ? 3 : level >= 8 ? 2 : 1;
}

/** Chance a kill drops a potion, by the creature's rank. */
export const POTION_DROP_CHANCE: Readonly<Record<'normal' | 'champion' | 'unique' | 'boss', number>> = {
  normal: 0.07, champion: 0.2, unique: 0.3, boss: 0.6,
};
/** Chance that a dropped potion is a Rejuvenation instead (creatures level 10 and up). */
export const REJUV_SHARE: Readonly<Record<'normal' | 'champion' | 'unique' | 'boss', number>> = {
  normal: 0.04, champion: 0.15, unique: 0.2, boss: 0.35,
};

/**
 * A kill's potion, or null. `rand` returns [0, 1) (Math.random in play, a fixed sequence in specs).
 * Health a little more often than Mana (the Warlock regains mana by killing).
 */
export function rollPotionDrop(level: number, rank: 'normal' | 'champion' | 'unique' | 'boss', rand: () => number): PotionDef | null {
  if (rand() >= POTION_DROP_CHANCE[rank]) return null;
  if (level >= 10 && rand() < REJUV_SHARE[rank]) return potionById('rejuvenation-potion') ?? null;
  const kind: PotionKind = rand() < 0.55 ? 'health' : 'mana';
  const tier = dropTier(level);
  return POTIONS.find(p => p.kind === kind && p.tier === tier) ?? null;
}
