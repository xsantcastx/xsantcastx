/**
 * place-for-route.ts — where a standalone page stands in the world.
 *
 * Every hall that used to sit in the navbar is now a station in a realm town
 * (world plan, Phase 3). Its standalone URL stays for SEO and opens into the
 * world; this answers "which town, which station" for one of those URLs, so
 * the banner, the specs and `scripts/audit-nav.js` all read the same answer
 * off the same data: the towns in `TOWNS` and the routes in `PANEL_REGISTRY`.
 *
 * Preference order, so the answer is stable:
 *   1. a station in the town itself, before one in a hunt (the Homestead's own
 *      anvil also opens the Crafting Bench, but the Seamworks bench is the
 *      place everyone can reach);
 *   2. towns in `REALM_TOWN_IDS` order.
 *
 * Pure apart from its default arguments. Imports the towns' data, so only lazy
 * surfaces (the place banner, specs, the node audit) may import this file —
 * never the eager shell.
 */
import { PANEL_REGISTRY, type PanelEntry } from '../../play/world/panel-registry';
import {
  REALM_TOWN_IDS,
  TOWNS,
  TOWN_LABELS,
  type PanelId,
  type RealmTownId,
  type TownDef,
} from '../../play/world/world.model';

export interface WorldPlace {
  /** The standalone route asked about, normalised (no query, hash or trailing slash). */
  route: string;
  panel: PanelId;
  /** The station's id: the `?at=` value /play opens on. */
  stationId: string;
  /** Proper name of the town (or hunt) the station stands in, e.g. "Basalt Seamworks". */
  areaName: string;
  townId: RealmTownId;
  /** The realm's short label, e.g. "Infernal". */
  realmLabel: string;
  /** The in-world deep link. */
  href: string;
  queryParams: { at: string };
}

/** Strip query, hash and a trailing slash. */
export function normaliseRoute(route: string): string {
  const path = (route || '').split(/[?#]/)[0].replace(/\/+$/, '');
  return path || '/';
}

/**
 * The in-world place a standalone page route opens into, or null when no
 * station in a built town hosts that page (Character, /world, an unknown URL).
 */
export function placeForRoute(
  route: string,
  towns: Readonly<Partial<Record<RealmTownId, TownDef | undefined>>> = TOWNS,
  registry: Readonly<Partial<Record<PanelId, Pick<PanelEntry, 'route'>>>> = PANEL_REGISTRY,
): WorldPlace | null {
  const path = normaliseRoute(route);
  const panels = (Object.keys(registry) as PanelId[]).filter(id => registry[id]?.route === path);
  if (!panels.length) return null;

  const make = (town: TownDef, areaName: string, stationId: string, panel: PanelId): WorldPlace => ({
    route: path,
    panel,
    stationId,
    areaName,
    townId: town.id,
    realmLabel: TOWN_LABELS[town.id] ?? town.id,
    href: `/play?at=${encodeURIComponent(stationId)}`,
    queryParams: { at: stationId },
  });

  const built = REALM_TOWN_IDS.map(id => towns[id]).filter((t): t is TownDef => !!t);
  // Pass 1: the town square. Pass 2: its hunting grounds.
  for (const town of built) {
    const hit = town.stations.find(s => s.kind === 'panel' && s.panel && panels.includes(s.panel));
    if (hit) return make(town, town.name, hit.id, hit.panel!);
  }
  for (const town of built) {
    for (const hunt of town.hunts) {
      const hit = hunt.stations.find(s => s.kind === 'panel' && s.panel && panels.includes(s.panel));
      if (hit) return make(town, hunt.name, hit.id, hit.panel!);
    }
  }
  return null;
}

/** Every registry route that has a place in a built town, with that place. */
export function worldPlaces(
  towns: Readonly<Partial<Record<RealmTownId, TownDef | undefined>>> = TOWNS,
  registry: Readonly<Partial<Record<PanelId, Pick<PanelEntry, 'route'>>>> = PANEL_REGISTRY,
): WorldPlace[] {
  const routes = new Set<string>();
  for (const entry of Object.values(registry)) if (entry?.route) routes.add(entry.route);
  const out: WorldPlace[] = [];
  for (const route of routes) {
    const place = placeForRoute(route, towns, registry);
    if (place) out.push(place);
  }
  return out;
}
