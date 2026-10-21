/**
 * character-summary.ts — one character's row on the character list, read from its save on this device.
 *
 * Level is the Keeper's Hunting level (the number on the HUD portrait), the place is where the top-down Keeper last
 * stood (the newer of PLAY_KEY's `td`, written by the play view, and the synced whereabouts), and the look is the painting fields of the Glass's choice.
 * Reads go through GameStateGateway.readFor, which never writes, so summarising a character the page is not playing
 * is safe.
 */
import { ACTIVITY_KEY } from '../../shared/activity/activity.model';
import type { DisciplineProgress } from '../../shared/activity/activity.model';
import { KEEPER_LOOK_KEY, coerceLook } from '../../shared/keeper-look/keeper-look.model';
import { keeperLevelView } from '../../shared/skills/keeper-level';
import { skillXp } from '../../shared/skills/skill.model';
import { CharacterRow, portraitOf } from '../../shared/characters/character-roster.model';
import { CONTINENTS, LEVELS } from '../td/td-engine';
import { PROGRESS_KEY } from '../../shared/gamification/gamification.model';
import { WHEREABOUTS_KEY, pickWakePlace } from '../../shared/save/whereabouts.model';

/** The play view's device-local world blob (side-scroller.component.ts PLAY_KEY): `td` is where the Keeper stands. */
export const PLAY_WORLD_KEY = 'eclipse-play-world-v1';

export interface SaveReader {
  readFor(character: string, key: string): unknown;
  hasLocalSave(character: string): boolean;
}

/** "ember-isle" → "Ember Isle"; a floor → its map's name up to the floor ("The Ashen Crypt · Floor 1"). */
export function areaName(td: unknown): string {
  if (!td || typeof td !== 'object') return '';
  const w = td as Record<string, unknown>;
  const level = typeof w['level'] === 'string' ? w['level'] : '';
  if (level && level !== 'surface' && LEVELS[level]) return LEVELS[level].name.split(' · ').slice(0, 2).join(' · ');
  const continent = typeof w['continent'] === 'string' ? w['continent'] : '';
  if (!continent || !CONTINENTS[continent]) return '';
  return continent.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

/** The Hunting level held in an activity ledger blob (1 when there is none). */
export function huntingLevelOf(activity: unknown): number {
  const progress = activity && typeof activity === 'object' ? (activity as Record<string, unknown>)['progress'] : null;
  const ok = progress && typeof progress === 'object' && typeof (progress as Record<string, unknown>)['xpByDiscipline'] === 'object'
    && (progress as Record<string, unknown>)['xpByDiscipline'] !== null;
  return keeperLevelView(skillXp(ok ? progress as DisciplineProgress : null, 'hunting')).level;
}

/**
 * `row` refreshed from this device's copy of the character's save; unchanged when this device holds none (a Keeper
 * only ever played elsewhere keeps the summary its own device wrote).
 */
export function summarise(store: SaveReader, row: CharacterRow, now = Date.now()): CharacterRow {
  if (!store.hasLocalSave(row.id)) return row;
  const rawLook = store.readFor(row.id, KEEPER_LOOK_KEY);
  const look = coerceLook(rawLook);
  const play = store.readFor(row.id, PLAY_WORLD_KEY);
  // The newer of this device's last place and the character's synced one (whereabouts.model.ts).
  const area = areaName(pickWakePlace(play && typeof play === 'object' ? play as { td?: unknown; tdAt?: unknown } : null, store.readFor(row.id, WHEREABOUTS_KEY)));
  const next: CharacterRow = {
    ...row,
    name: look.made ? look.name : row.name,
    vocation: look.vocation,
    level: huntingLevelOf(store.readFor(row.id, ACTIVITY_KEY)),
    area: area || row.area,
    look: rawLook ? portraitOf(look) : row.look,
  };
  const same = next.name === row.name && next.vocation === row.vocation && next.level === row.level && next.area === row.area
    && JSON.stringify(next.look) === JSON.stringify(row.look);
  return same ? row : { ...next, updatedAt: Math.max(now, row.updatedAt + 1) };
}

/**
 * Does `id` hold a save worth a row: a made Keeper, any skill XP or any lifetime XP? Not just "any blob": a first visit
 * writes a few empty ledgers before anyone plays, and those must not turn into an unnamed Keeper on the list.
 */
export function hasMeaningfulSave(store: SaveReader, id: string): boolean {
  if (!store.hasLocalSave(id)) return false;
  if (coerceLook(store.readFor(id, KEEPER_LOOK_KEY)).made) return true;
  const activity = store.readFor(id, ACTIVITY_KEY);
  const xp = activity && typeof activity === 'object' ? (activity as { progress?: { xpByDiscipline?: Record<string, unknown> } }).progress?.xpByDiscipline : null;
  if (xp && typeof xp === 'object' && Object.values(xp).some(v => typeof v === 'number' && v > 0)) return true;
  const progress = store.readFor(id, PROGRESS_KEY);
  return !!progress && typeof progress === 'object' && typeof (progress as { xp?: unknown }).xp === 'number' && (progress as { xp: number }).xp > 0;
}
