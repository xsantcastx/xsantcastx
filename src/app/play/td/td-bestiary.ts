/**
 * td-bestiary.ts — the Bestiary's data (owner 2026-10-20): every top-down creature, where it lives (derived from the
 * continents' region tables, the hand-drawn levels and the graveyards, never hand-written), what it drops, one line of
 * lore, and how many the Keeper has defeated. Pure: the host reads and writes the kill blob through the gateway.
 */
import { materialDisplay } from '../../shared/rpg/material-catalog';
import { CONTINENTS, LEVELS } from './td-engine';
import { MOBS } from './td-mobs';

/** The save blob (account progress, synced; merge is the structural max per creature). */
export const BESTIARY_KEY = 'eclipse-bestiary-v1';
export interface BestiaryBlob { version: 1; kills: Record<string, number> }

/** Continent display names (the defs carry the town's name, not the land's). */
const CONTINENT_NAMES: Readonly<Record<string, string>> = { 'ember-isle': 'Ember Isle', 'infernal-reach': 'Infernal Reach', 'verdant-wilds': 'The Verdant Wilds' };
const continentName = (id: string): string => CONTINENT_NAMES[id] ?? id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export interface BestiaryDrop { name: string; qty: number; chance: number }
export interface BestiaryEntry {
  id: string;
  name: string;
  level: number;
  rank: 'normal' | 'champion' | 'unique' | 'boss';
  /** Every place it can be met, e.g. "The Emberwood, Ember Isle" or "Ember Mine · Floor 2". */
  haunts: string[];
  /** Gold dropped, from..to. */
  coins: [number, number];
  drops: BestiaryDrop[];
  lore: string;
  /** Times defeated; 0 = not yet met (the card shows a silhouette). */
  kills: number;
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
    }
    // A graveyard's own dead are Bone Walkers (td-world.ts).
    for (const p of c.places) if (p.kind === 'graveyard') add('bone-walker', `${p.name}, ${land}`);
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
    coins: def.coins,
    drops: def.drops.map(d => ({ name: dropName(d.material), qty: d.qty, chance: d.chance })),
    lore: def.lore ?? '',
    kills: Math.max(0, Math.floor(kills[def.id] ?? 0)),
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
