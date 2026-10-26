/**
 * td-pack-aura.ts — the monsters' pack auras, D2's (docs/design/monsters-abilities.md §3; campaign S6).
 *
 * One aura per pack. The bearer is the pack's leader (an Aura Enchanted unique or champion), or a fixed aura-bearer
 * (the Orc Warlord's Might, the Bone Priest's Redemption, the Ashsinger's Fanaticism once it has raised one, a Drowned
 * Acolyte's Prayer in the Drowned Crypts, the Gloam Witch's Lightless). It blesses its OWN pack only — its followers and
 * itself, or for a fixed bearer with no pack its own family standing round it — within PACK_AURA_REACH (4 tiles). Kill
 * the bearer and the aura ends at once. The names and effects are the Keepers' (shared/loot/auras.ts) where they share
 * one; the numbers are the pack's own (this table), scaled by the zone level, never by a worn item.
 *
 * Pure: the numbers, the zone lists, the looks. The fight reads it in td-mobs.ts, the pictures are td-ability-fx.ts.
 */
import type { Tones } from './td-fx';

export type PackAuraId =
  | 'might' | 'blessed-aim' | 'conviction' | 'redemption' | 'holy-fire' | 'holy-freeze' | 'holy-shock'
  | 'fanaticism' | 'prayer' | 'vigor' | 'thorns' | 'lightless' | 'cant-chorus';
export const PACK_AURA_IDS: readonly PackAuraId[] = [
  'might', 'blessed-aim', 'conviction', 'redemption', 'holy-fire', 'holy-freeze', 'holy-shock',
  'fanaticism', 'prayer', 'vigor', 'thorns', 'lightless', 'cant-chorus',
];
export function isPackAura(v: unknown): v is PackAuraId { return typeof v === 'string' && (PACK_AURA_IDS as readonly string[]).includes(v); }

/** The reach of a pack aura round its bearer (art px): 4 tiles. */
export const PACK_AURA_REACH = 64;
/** Seconds between a pulse aura's pulses (Holy Fire, Holy Shock): the Keepers' AURA_PULSE. */
export const PACK_PULSE = 1.5;
/** Seconds an aura stays stripped (Unmaking, Strip, Banish): bosses 1/5 (ccSecs). */
export const PACK_STRIP_SECS = 6;

/** The aura's level (§3): 1 + floor(zone level / 5), +2 on Nightmare, +4 in Hell, at most 20. */
export function packAuraLevel(zoneLevel: number, tier = 'normal'): number {
  const l = 1 + Math.floor(Math.max(0, zoneLevel) / 5) + (tier === 'hell' ? 4 : tier === 'nightmare' ? 2 : 0);
  return Math.max(1, Math.min(20, l));
}

/** Everything a pack aura does at level L; a field that does not apply is 0 (or 1 for a multiplier). */
export interface PackAuraFx {
  /** × the pack's blow (Might). */
  blow: number;
  /** Their blows miss less (Blessed Aim's cut of the miss share) and their shots fly faster. */
  aim: number; shotSpeed: number;
  /** Points off every Keeper resist in reach, at most 60 (Conviction). */
  resistLower: number;
  /** Share of the rest's life healed by each pack death in reach (Redemption). */
  redeem: number;
  /** A pulse on Keepers in reach every PACK_PULSE: B-multiples [lo, hi] (Holy Fire, Holy Shock). */
  pulse: readonly [number, number];
  /** Keepers in reach are slowed this much (Holy Freeze). */
  slow: number;
  /** × attack speed (Fanaticism) and × walk (Fanaticism, Vigor). */
  rate: number; walk: number;
  /** Share of life a second (Prayer). */
  regen: number;
  /** Share of melee damage returned (Thorns). */
  thorns: number;
  /** Tiles off the Keeper's light (Lightless). */
  dark: number;
  /** × ability cooldowns (Cant-Chorus). */
  cd: number;
}
const NONE: PackAuraFx = { blow: 1, aim: 0, shotSpeed: 1, resistLower: 0, redeem: 0, pulse: [0, 0], slow: 0, rate: 1, walk: 1, regen: 0, thorns: 0, dark: 0, cd: 1 };

/** The pack's numbers (§3's table). */
export function packAuraFx(id: PackAuraId, L: number): PackAuraFx {
  const l = Math.max(1, Math.min(20, Math.floor(L)));
  switch (id) {
    case 'might': return { ...NONE, blow: 1 + (15 + 5 * l) / 100 };
    case 'blessed-aim': return { ...NONE, aim: (20 + 5 * l) / 100, shotSpeed: 1.2 };
    case 'conviction': return { ...NONE, resistLower: Math.min(60, 10 + 3 * l) };
    case 'redemption': return { ...NONE, redeem: (5 + l) / 100 };
    case 'holy-fire': return { ...NONE, pulse: [.3 + .05 * l, .3 + .05 * l] };
    case 'holy-freeze': return { ...NONE, slow: l >= 10 ? .5 : .3 };
    case 'holy-shock': return { ...NONE, pulse: [.2 + .05 * l, .6 + .05 * l] };
    case 'fanaticism': return { ...NONE, rate: 1 + Math.min(60, 15 + 3 * l) / 100, walk: 1.1 };
    case 'prayer': return { ...NONE, regen: (1 + .2 * l) / 100 };
    case 'vigor': return { ...NONE, walk: 1 + Math.min(40, 12 + 2 * l) / 100 };
    case 'thorns': return { ...NONE, thorns: (30 + 10 * l) / 100 };
    case 'lightless': return { ...NONE, dark: 1 + .1 * l };
    case 'cant-chorus': return { ...NONE, cd: 1 - Math.min(40, 20 + l) / 100 };
  }
}

/** The damage type a pulse aura carries. */
export const PACK_PULSE_TYPE: Partial<Record<PackAuraId, 'fire' | 'lightning'>> = { 'holy-fire': 'fire', 'holy-shock': 'lightning' };

/**
 * How each aura looks (the graphics upgrade, td-aura AuraFx): its three tones and the claimed floor's dark, and the
 * sigil drawn on the bearer's disc (16×16 art, grown ×2). Lightless is the odd one out: a black disc whose motes are
 * missing pixels.
 */
export interface PackAuraLook { tones: Tones; dark: string; sigil: PackSigil }
export type PackSigil = 'fist' | 'eye' | 'shield' | 'wing' | 'flame' | 'flake' | 'bolt' | 'spin' | 'hand' | 'gust' | 'thorn' | 'void' | 'cant';
export const PACK_AURA_LOOKS: Readonly<Record<PackAuraId, PackAuraLook>> = {
  might: { tones: { core: '#ffe0c8', body: '#ff6a3d', edge: '#b0301a' }, dark: '#3a0e08', sigil: 'fist' },
  'blessed-aim': { tones: { core: '#fff6c8', body: '#ffd25a', edge: '#b0812a' }, dark: '#2e2008', sigil: 'eye' },
  conviction: { tones: { core: '#f0e0ff', body: '#a855f7', edge: '#5a2a8a' }, dark: '#1e0a30', sigil: 'shield' },
  redemption: { tones: { core: '#ffffff', body: '#f8e8c8', edge: '#b8a888' }, dark: '#2a2418', sigil: 'wing' },
  'holy-fire': { tones: { core: '#fff2a8', body: '#ff8a3d', edge: '#c2401e' }, dark: '#3a120a', sigil: 'flame' },
  'holy-freeze': { tones: { core: '#ffffff', body: '#8fd8ff', edge: '#3f78b5' }, dark: '#0a1a2e', sigil: 'flake' },
  'holy-shock': { tones: { core: '#ffffff', body: '#ffe36d', edge: '#b0901e' }, dark: '#2a2208', sigil: 'bolt' },
  fanaticism: { tones: { core: '#fff0d8', body: '#ffa040', edge: '#b05a1a' }, dark: '#2e1808', sigil: 'spin' },
  prayer: { tones: { core: '#e6ffe9', body: '#9db8a8', edge: '#4a6a58' }, dark: '#0e1e16', sigil: 'hand' },
  vigor: { tones: { core: '#e0fbff', body: '#00d4ff', edge: '#1a7a9e' }, dark: '#08202a', sigil: 'gust' },
  thorns: { tones: { core: '#e8f0c8', body: '#8a9a4a', edge: '#4a5a24' }, dark: '#141a08', sigil: 'thorn' },
  lightless: { tones: { core: '#d8c0ff', body: '#3a2a4a', edge: '#140c1c' }, dark: '#05030a', sigil: 'void' },
  'cant-chorus': { tones: { core: '#fffbe8', body: '#f3e7cf', edge: '#a8946a' }, dark: '#241c10', sigil: 'cant' },
};

/** The land an area belongs to: a continent for the surface, a floor by its dungeon's land. */
const FLOOR_LANDS: readonly [RegExp, string][] = [
  [/^(ember-mine|slagstone|ember-inn|hushed-barrow)/, 'ember-isle'],
  [/^(molten-deep|forge-of-four|ashen-crypt|pyre-spire|salted-ember|woodward)/, 'infernal-reach'],
  [/^(overgrown-temple|root-hollows|rootglass|netloft|herbal)/, 'verdant-wilds'],
  [/^(drowned-crypts|lantern-tower)/, 'umbral-marches'],
];
export function landOf(levelId: string, continent: string): string {
  if (levelId === 'surface' || !levelId) return continent;
  for (const [re, land] of FLOOR_LANDS) if (re.test(levelId)) return land;
  return continent;
}

/**
 * Which auras a zone's packs may roll (§3's table): by land and zone level. Holy Shock only under a thunderstorm in
 * the Wilds (`storm`), Thorns in the Reach only in the Forge of the Four, Conviction in the Reach from 20.
 */
export function packAuraPool(land: string, level: number, o: { levelId?: string; storm?: boolean } = {}): PackAuraId[] {
  switch (land) {
    case 'ember-isle': return level < 5 ? [] : ['might', 'vigor', 'prayer'];
    case 'infernal-reach': {
      const out: PackAuraId[] = ['might', 'holy-fire', 'fanaticism', 'blessed-aim'];
      if (level >= 20) out.push('conviction');
      if (o.levelId?.startsWith('forge-of-four')) out.push('thorns');
      return out;
    }
    case 'verdant-wilds': return ['prayer', 'thorns', 'vigor', 'blessed-aim', 'redemption', ...(o.storm ? ['holy-shock' as const] : [])];
    case 'umbral-marches': return ['holy-freeze', 'lightless', 'redemption', 'conviction', 'cant-chorus', 'prayer'];
    default: return level < 5 ? [] : [...PACK_AURA_IDS];
  }
}

/** A fixed aura-bearer's own aura (§3), or null. The Ashsinger's waits for its first raise; the Acolyte's is the crypts'. */
export function fixedAura(creature: string, levelId: string, raised = false): PackAuraId | null {
  switch (creature) {
    case 'orc-warlord': return 'might';
    case 'bone-priest': return 'redemption';
    case 'ashsinger': return raised ? 'fanaticism' : null;
    case 'drowned-acolyte': return levelId.startsWith('drowned-crypts') ? 'prayer' : null;
    case 'gloam-witch': return 'lightless';
    default: return null;
  }
}

/** The Keeper's own aura of the opposite kind halves a pack aura on him (§3 counters). */
export function halvedBy(keeperAura: string | null | undefined, aura: PackAuraId): boolean {
  return (aura === 'lightless' && keeperAura === 'lantern-aura') || (aura === 'holy-freeze' && keeperAura === 'aura-watchfire') || (aura === 'conviction' && keeperAura === 'pack-bond');
}
