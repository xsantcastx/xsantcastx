/**
 * atmosphere.model.ts — which part of the Godforge each route stands in.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS
 * ─────────────────────────────────────────────────────────────────────────────
 * Art creates atmosphere; CSS creates UI. Only /home has painted art behind it
 * so far, so every other route has been standing in the same undifferentiated
 * violet void. This table gives each one a wash of colour instead — enough that
 * walking from the Arena to the Codex feels like walking into a different room,
 * and not so much that it competes with the glass panels on top of it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIVE SLOTS, NOT FREEFORM GRADIENTS
 * ─────────────────────────────────────────────────────────────────────────────
 * An atmosphere is five colours, not a `background` string. The five positions
 * are fixed in CSS (see the ATMOSPHERE block in styles.css) and only the colours
 * change per route:
 *
 *     center   the wash a page sits inside          (the Godforge core)
 *     top      a glow overhead                      (a command-centre ceiling)
 *     bottom   a glow underfoot                     (candlelight, pit-light)
 *     tl / tr  corner hints                         (light bleeding in)
 *
 * Fixing the positions is what makes the transition work. Registered custom
 * properties of type `<color>` interpolate, so a route change cross-fades one
 * palette into the next; a `background-image` swap would not animate at all,
 * and animating the positions as well would make the wash visibly slide.
 *
 * Every slot defaults to `transparent`, so a route with no entry here — /home
 * above all — paints exactly what it painted before this file existed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER STATUS
 * ─────────────────────────────────────────────────────────────────────────────
 * These are deliberately holding a shape open for art that does not exist yet.
 * When a page gets painted, its entry here is deleted and the artwork takes the
 * first slot of body's `background-image` — the wash is a stand-in, not a
 * permanent fixture.
 *
 * Pure data and pure functions — no browser APIs — so it is safe to import from
 * an SSR path.
 */
import { REALMS, RealmDefinition, realmForCategory } from '../realms/realm.model';

/**
 * The five wash slots. All optional; anything omitted is `transparent`, i.e.
 * that gradient contributes nothing.
 */
export interface Atmosphere {
  /** Identity, written to `data-atmosphere` so the wash is debuggable in devtools. */
  id: string;
  center?: string;
  top?: string;
  bottom?: string;
  tl?: string;
  tr?: string;
}

/** Every slot cleared — what /home and any unlisted route gets. */
export const NO_ATMOSPHERE: Atmosphere = { id: 'none' };

/**
 * `rgba()` from one of the realm hexes in realm.model.
 *
 * The realm colours are the single source of truth for realm identity, so a
 * tool page's wash is derived from the same hex that paints its badge and its
 * sigil glow rather than from a second table that could drift out of step.
 */
export function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ── The palette these washes draw from ───────────────────────────────────────
   Named rather than inlined so a reader can see that /market's purple is the
   same purple as /tools' core, and so the eventual art pass has a list of the
   colours it is replacing. Alphas live between 0.03 and 0.08: a wash that
   reads as a colour rather than as a panel. */
const VIOLET = (a: number) => `rgba(139, 92, 246, ${a})`;   // the Godforge core
const GOLD   = (a: number) => `rgba(200, 152, 104, ${a})`;   // Archivum, commerce, patronage
const CRIMSON = (a: number) => `rgba(220, 38, 38, ${a})`;   // the pit
const CYAN   = (a: number) => `rgba(0, 212, 255, ${a})`;    // Verge, instrumentation
const SUN    = (a: number) => `rgba(232, 212, 77, ${a})`;   // Luminous
const NOCTURNE = (a: number) => `rgba(139, 34, 82, ${a})`;  // Umbral

/**
 * Route → atmosphere, for the routes that are places rather than tools.
 *
 * Keyed on the first path segment. A route absent from this map gets
 * NO_ATMOSPHERE, which is why /home needs no entry: its art already carries the
 * page, and an added wash would sit on top of it.
 */
const BY_SEGMENT: Record<string, Atmosphere> = {
  /* The nexus between all five realms: the core glows below everything, and the
     two brightest realms bleed in from the top corners. */
  tools: { id: 'tools', center: VIOLET(0.08), tl: SUN(0.05), tr: CYAN(0.05) },

  /* An underground pit. The light is beneath you and it is the wrong colour. */
  arena: { id: 'arena', bottom: CRIMSON(0.06), center: CRIMSON(0.02) },

  /* An archive read by candlelight — warm from below, dark overhead. */
  codex: { id: 'codex', bottom: GOLD(0.06), center: GOLD(0.02) },

  /* Forge energy overhead, the colour of money underfoot. */
  market: { id: 'market', center: VIOLET(0.05), bottom: GOLD(0.04) },

  /* A war table under instrument light: clean, overhead, analytical. */
  blueprint: { id: 'blueprint', top: CYAN(0.05) },

  /* Patronage. Gold, centred, restrained — the page is a pitch, not a set. */
  sponsors: { id: 'sponsors', center: GOLD(0.04) },

  /* The mission board hangs in the same violet as the Market it pays out to. */
  quests: { id: 'quests', center: VIOLET(0.05), top: VIOLET(0.03) },

  /* No `games` entry on purpose: /games is a legacy address that redirects to
     /arena, and the service resolves on `urlAfterRedirects`, so this table is
     never asked about it. An entry here would be dead code that reads as
     coverage. */

  /* A live feed is an instrument panel. Same light as the war table, dimmer. */
  live: { id: 'live', top: CYAN(0.045), center: CYAN(0.02) },

  /* No `skills`, `projects`, `contact` or `guestbook` entries, for the same
     reason `games` has none: the full migration deleted those pages and left
     redirects behind, and the service resolves on `urlAfterRedirects`, so this
     table is never asked about them. */

  /* Fuel for the forge: the core, brighter than anywhere but /tools. */
  donate: { id: 'donate', center: VIOLET(0.07), bottom: GOLD(0.03) },

  /* A machine interface for other machines. */
  mcp: { id: 'mcp', top: CYAN(0.04), center: VIOLET(0.03) },
};

/** The atmosphere for a place-route, or null when the segment is not a place. */
export function atmosphereForSegment(segment: string): Atmosphere | null {
  return BY_SEGMENT[segment] ?? null;
}

/**
 * A tool page's atmosphere: its realm's own colour, centred, low.
 *
 * One wash rather than the two or three a place gets. A tool page's subject is
 * the tool, and the realm badge in its header is already saying which realm it
 * belongs to — the wash only has to agree with it.
 */
export function atmosphereForRealm(realm: RealmDefinition): Atmosphere {
  return {
    id: `realm-${realm.id}`,
    center: tint(realm.color, 0.06),
    bottom: tint(realm.color, 0.025),
  };
}

/** The atmosphere for a tool, by its registry category. */
export function atmosphereForCategory(category: string | undefined): Atmosphere {
  return atmosphereForRealm(realmForCategory(category));
}

/**
 * /forge-keeper wears whichever realm has claimed the visitor.
 *
 * The thresholds match the identity card on the page itself
 * (forge-keeper.component.ts `realmColor`): above 55% Aether is Solari, below
 * 45% is Nocturne, and the band between is Convergent — claimed by neither, so
 * it gets the neutral core instead of a blend that would read as a third realm
 * that does not exist.
 *
 * `share` is XpSnapshot.aetherShare, 0..1. A visitor with no history sits at
 * exactly 0.5 and lands in the Convergent band, which is the correct default:
 * the page should not claim an allegiance before the visitor has earned one.
 */
export function atmosphereForAetherShare(share: number): Atmosphere {
  const pct = Math.round(share * 100);
  if (pct > 55) {
    return { id: 'keeper-solari', center: SUN(0.06), bottom: SUN(0.03) };
  }
  if (pct < 45) {
    return { id: 'keeper-nocturne', center: NOCTURNE(0.07), bottom: NOCTURNE(0.035) };
  }
  return { id: 'keeper-convergent', center: VIOLET(0.06), bottom: VIOLET(0.03) };
}

/**
 * Sanity net for the realm table: every realm must produce a usable wash.
 * Exported for the spec rather than called at runtime.
 */
export function allRealmAtmospheres(): Atmosphere[] {
  return REALMS.map(atmosphereForRealm);
}
