/**
 * td-bestiary.ts — the Bestiary's data (owner 2026-10-20): every top-down creature, where it lives (derived from the
 * continents' region tables, the hand-drawn levels and the graveyards, never hand-written), what it drops, one line of
 * lore, and how many the Keeper has defeated. Pure: the host reads and writes the kill blob through the gateway.
 */
import { materialDisplay } from '../../shared/rpg/material-catalog';
import { CONTINENTS, LEVELS } from './td-engine';
import type { DamageType } from '../../shared/loot/damage.model';
import { MOBS, mobHits } from './td-mobs';
import { huntGoldRange } from '../../shared/economy/economy-curve';
import { MIN_PACK_LEVEL } from '../../shared/loot/champions';
import { NIGHT_TABLES } from './td-phases';
import { SEAM_ID, riftPlace } from './td-seam';
import { bossUniqueFor } from '../../shared/rpg/boss-uniques';
import { ITEM_SETS } from '../../shared/rpg/set-items';

/** The save blob (account progress, synced; merge is the structural max per creature). */
export const BESTIARY_KEY = 'eclipse-bestiary-v1';
export interface BestiaryBlob { version: 1; kills: Record<string, number> }

/** Continent display names (the defs carry the town's name, not the land's). */
const CONTINENT_NAMES: Readonly<Record<string, string>> = { 'ember-isle': 'Ember Isle', 'infernal-reach': 'Infernal Reach', 'verdant-wilds': 'The Verdant Wilds', 'umbral-marches': 'The Umbral Marches' };
const continentName = (id: string): string => CONTINENT_NAMES[id] ?? id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export interface BestiaryDrop { name: string; qty: number; chance: number }
export interface BestiaryEntry {
  id: string;
  name: string;
  level: number;
  rank: 'normal' | 'champion' | 'unique' | 'boss';
  /** Every place it can be met, e.g. "The Emberwood, Ember Isle" or "Ember Mine · Floor 2". */
  haunts: string[];
  /** Gold dropped, from..to (the level's pile, economy-curve HUNT_GOLD). */
  coins: [number, number];
  drops: BestiaryDrop[];
  lore: string;
  /** The type its blows and shots carry (§6): which resist answers it. */
  hits: DamageType;
  /** Times defeated; 0 = not yet met (the card shows a silhouette). */
  kills: number;
  /** It can come up as an elite pack (td-elites.ts): a blue champion pack or a gold-named unique with its minions. */
  elites: boolean;
  /** A boss's own unique (shared/rpg/boss-uniques.ts): it drops from this boss alone, 1 in `oneIn` kills. */
  relic: { id: string; name: string; oneIn: number } | null;
  /** The item set whose pieces this creature's kills may drop (shared/rpg/set-items.ts), from `level` up. */
  set: { id: string; level: number } | null;
}

/** Who lives where: creature id → places, in a stable order (the lands first, then the dungeons by their floors). */
export function creatureHaunts(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, where: string): void => {
    const list = out.get(id) ?? [];
    if (!list.includes(where)) list.push(where);
    out.set(id, list);
  };
  for (const c of Object.values(CONTINENTS)) {
    const land = continentName(c.id);
    for (const [region, table] of Object.entries(c.mobs)) {
      if (!table) continue;
      const name = c.names[region as keyof typeof c.names] ?? c.townName;
      for (const id of table.types) add(id, `${name}, ${land}`);
      // The night tables (td-phases.ts): who comes out there after dark.
      for (const id of table.types) for (const night of NIGHT_TABLES[id] ?? []) add(night, `${name}, ${land} (at night)`);
    }
    // A graveyard's own dead are Bone Walkers (td-world.ts).
    for (const p of c.places) if (p.kind === 'graveyard') add('bone-walker', `${p.name}, ${land}`);
    // The Seam Eater rises at each continent's rift, its standing stones, under an eclipse (td-seam.ts).
    const rift = riftPlace(c);
    if (rift) add(SEAM_ID, `${rift.name}, ${land} (under an eclipse)`);
  }
  for (const level of Object.values(LEVELS)) {
    for (const [ch, entry] of Object.entries(level.legend)) {
      if (entry.mob && level.rows.some(row => row.includes(ch))) add(entry.mob, level.name);
    }
  }
  return out;
}

const dropName = (material: string): string => materialDisplay(material)?.name ?? material.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
/** Every creature in MOBS (the Warlock's raised skeleton is not a MOBS entry) with what the Keeper has learnt of it, weakest first. */
export function bestiaryEntries(kills: Readonly<Record<string, number>>): BestiaryEntry[] {
  const haunts = creatureHaunts();
  return Object.values(MOBS).map((def): BestiaryEntry => ({
    id: def.id,
    name: def.name,
    level: def.level,
    rank: def.rank ?? 'normal',
    haunts: haunts.get(def.id) ?? [],
    coins: huntGoldRange(def.level, def.rank ?? 'normal'),
    drops: def.drops.map(d => ({ name: dropName(d.material), qty: d.qty, chance: d.chance })),
    lore: def.lore ?? '',
    hits: mobHits(def),
    kills: Math.max(0, Math.floor(kills[def.id] ?? 0)),
    elites: (def.rank ?? 'normal') === 'normal' && def.level >= MIN_PACK_LEVEL,
    relic: (u => (u ? { id: u.id, name: u.name, oneIn: u.oneIn } : null))(def.rank === 'boss' ? bossUniqueFor(def.id) : undefined),
    set: (st => (st ? { id: st.id, level: st.source.minLevel } : null))(ITEM_SETS.find(x => x.source.creatures.includes(def.id))),
  })).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export function discoveredCount(entries: readonly BestiaryEntry[]): number {
  return entries.filter(e => e.kills > 0).length;
}

/** The kill table out of a stored blob (junk and unknown ids dropped). */
export function readKills(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const kills = raw && typeof raw === 'object' ? (raw as { kills?: unknown }).kills : null;
  if (!kills || typeof kills !== 'object') return out;
  for (const [id, n] of Object.entries(kills as Record<string, unknown>)) {
    if (MOBS[id] && typeof n === 'number' && Number.isFinite(n) && n > 0) out[id] = Math.floor(n);
  }
  return out;
}

/** The blob after one more `creature` fell; null when it is not a Bestiary creature (a minion, a side-view mob). */
export function withKill(raw: unknown, creature: string): BestiaryBlob | null {
  if (!MOBS[creature]) return null;
  const kills = readKills(raw);
  kills[creature] = (kills[creature] ?? 0) + 1;
  return { version: 1, kills };
}
