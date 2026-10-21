/**
 * td-waygate.ts — town portals, D2-style (owner 2026-10-21, relaying the players: "town portals").
 *
 * Two ways to open one: the Common spell **Waygate** (*ul hesk vesh* — through the seam, find the hearth; td-skills),
 * or a **Waygate Scroll** read from the satchel (shared/waygate/waygate-scroll.ts: Edrin Kade sells them, priced on the
 * hunt). Either opens a pixel portal where the Keeper stands; stepping in takes him to the nearest town hearth of the
 * continent he is on, where a matching portal stands; stepping back through returns him to the exact spot, and both
 * close. Left alone, the pair fades after WAYGATE_SECS.
 *
 * Rules (pinned by td-waygate.spec.ts):
 *  - not inside a town (there is nowhere nearer to go);
 *  - not while a boss is fighting near (cozy-fair: no walking out of an arena mid-fight and back in whole);
 *  - not during the Seam Eater's rising;
 *  - one portal per Keeper: a new one replaces the last;
 *  - a portal takes you only once you have stepped off it (you never fall back through the one you just came out of);
 *  - party members in the area may use it both ways (it is shared in presence, `gate`: travel and the picture only).
 *
 * Pure: the rules, the presence string and the picture (a canvas painter). Reduced motion paints one still frame.
 */
import { TILE } from './td-art';

/** How long a portal stands (seconds) before it fades, used or not: the spell's rank 1, and a scroll's. */
export const WAYGATE_SECS = 300;
/** The longest any portal stands (the spell at its top rank, with room): presence refuses more. */
export const WAYGATE_MAX_SECS = 900;
/** How near the feet must come to the portal's foot to step in (art px). */
export const WAYGATE_REACH = 9;
/** How far the feet must have gone from a portal before it will take them (art px). */
export const WAYGATE_ARM = 16;
/** How far beside the hearth the town's portal stands (art px): west of the fire, a step toward the viewer. */
export const TOWN_GATE_OFFSET = { x: -30, y: 6 } as const;
/** Where the Keeper stands on arrival: just south of the portal he came out of (beyond WAYGATE_ARM: it is armed). */
export const ARRIVE_BELOW = 20;

export interface WaygateSpot { continent: string; level: string; x: number; y: number }
export interface Waygate {
  /** Where it was opened (any level: a floor, a cave, the surface). */
  from: WaygateSpot;
  /** The town end: always the continent's surface, beside a hearth. */
  town: WaygateSpot & { hearth: string };
  /** Engine seconds when it opened. */
  opened: number;
  /** How long it stands (seconds): WAYGATE_SECS, longer with the spell's ranks. */
  life: number;
}
export type WaygateBlock = 'waytown' | 'wayboss' | 'wayseam';

/** Why a portal cannot open here, or null when it can. Town first, then the fights. */
export function waygateBlock(o: { inTown: boolean; bossFight: boolean; seamFight: boolean }): WaygateBlock | null {
  if (o.inTown) return 'waytown';
  if (o.seamFight) return 'wayseam';
  if (o.bossFight) return 'wayboss';
  return null;
}

/**
 * Is a boss fighting near (cozy-fair)? A living boss within its own sight of the Keeper, plus two tiles, or one that has
 * been hurt and still stands within twice that. `sight` defaults to 8 tiles.
 */
export function bossFighting(me: { x: number; y: number }, mobs: readonly { x: number; y: number; hp: number; def: { rank?: string; hp?: number; sight?: number } }[]): boolean {
  for (const m of mobs) {
    if (m.def.rank !== 'boss' || !(m.hp > 0)) continue;
    const sight = (m.def.sight ?? 8 * TILE) + 2 * TILE, d = Math.hypot(m.x - me.x, m.y - me.y);
    if (d <= sight) return true;
    if (m.def.hp && m.hp < m.def.hp && d <= sight * 2) return true;
  }
  return false;
}

/** Seconds a portal still stands (0: gone). */
export function waygateLeft(g: Pick<Waygate, 'opened' | 'life'>, now: number): number {
  return Math.max(0, (g.life ?? WAYGATE_SECS) - Math.max(0, now - g.opened));
}

/** The hearth nearest a spot (any when `at` is null: the first, the capital's). */
export function nearestHearth<H extends { x: number; y: number }>(hearths: readonly H[], at: { x: number; y: number } | null): H | null {
  if (!hearths.length) return null;
  if (!at) return hearths[0];
  let best = hearths[0], bd = Infinity;
  for (const h of hearths) { const d = Math.hypot(h.x - at.x, h.y - at.y); if (d < bd) { bd = d; best = h; } }
  return best;
}

/** The town end beside a hearth's fire. */
export function townGateAt(h: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.round(h.x + TOWN_GATE_OFFSET.x), y: Math.round(h.y + TOWN_GATE_OFFSET.y) };
}

/** Is the spot on this end of a portal (same continent and level, within the reach)? */
export function onGate(end: WaygateSpot, here: WaygateSpot, reach = WAYGATE_REACH): boolean {
  return end.continent === here.continent && end.level === here.level && Math.hypot(end.x - here.x, end.y - here.y) <= reach;
}

const ID = /^[a-z0-9-]{1,40}$/;
/**
 * The portal in presence (`gate`, social-room protocol 5): `continent:level:x:y:townX:townY:secondsLeft`. The town end is
 * always on the same continent's surface. Plain lowercase ids, digits and minus signs only, ≤ 96 characters; '' = none.
 */
export function encodeGate(g: Waygate | null, now: number): string {
  if (!g) return '';
  // Whole tens of seconds, rounded up: presence is re-sent when it changes, so a ticking count would chatter.
  const left = Math.min(WAYGATE_MAX_SECS, Math.ceil(waygateLeft(g, now) / 10) * 10);
  if (left <= 0 || g.from.continent !== g.town.continent) return '';
  const s = [g.from.continent, g.from.level, Math.round(g.from.x), Math.round(g.from.y), Math.round(g.town.x), Math.round(g.town.y), left].join(':');
  return s.length <= 96 ? s : '';
}
/** A peer's portal from presence, opened so it ends with `secondsLeft` from `now`; null when the string is not one. */
export function decodeGate(s: unknown, now: number): Waygate | null {
  if (typeof s !== 'string' || !s || s.length > 96) return null;
  const p = s.split(':');
  if (p.length !== 7 || !ID.test(p[0]) || !ID.test(p[1])) return null;
  const n = p.slice(2).map(Number);
  if (!n.every(v => Number.isInteger(v) && Math.abs(v) < 1e6) || n[4] <= 0 || n[4] > WAYGATE_MAX_SECS) return null;
  return {
    from: { continent: p[0], level: p[1], x: n[0], y: n[1] },
    town: { continent: p[0], level: 'surface', x: n[2], y: n[3], hearth: '' },
    opened: now, life: n[4],
  };
}

// ── The picture ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The seam's violets round a hearth-gold heart (effects-spec: ul is the eclipse's tone, hesk the hearth's). */
const RIM = ['#1e0f38', '#3a1f63', '#7b3fc4', '#a855f7', '#d9b8ff'] as const;
const HEART = ['#ffd27a', '#fff4c2'] as const;
const OUTLINE = '#140c1c';

/**
 * A standing oval of seam-light, its foot at (X, Y): an outlined violet rim that turns, a hearth-gold heart, motes
 * rising. `fade` 0..1 dims a portal in its last seconds; `party` tints the rim's highlight gold (a friend's). Under
 * reduced motion one still frame: no turn, no motes.
 */
export function drawWaygate(c: CanvasRenderingContext2D, X: number, Y: number, time: number, still: boolean, fade = 1, party = false): void {
  X = Math.round(X); Y = Math.round(Y);
  const W = 9, H = 15, cy = Y - H - 1;
  c.save();
  c.globalAlpha = Math.max(.25, Math.min(1, fade));
  // Contact glow on the ground.
  c.globalAlpha *= .45; c.fillStyle = RIM[2]; c.fillRect(X - 8, Y, 17, 1); c.fillRect(X - 6, Y + 1, 13, 1);
  c.globalAlpha = Math.max(.25, Math.min(1, fade));
  const turn = still ? 0 : time * 2.2;
  for (let r = -H; r <= H; r++) {
    const k = r / H, half = Math.round(W * Math.sqrt(Math.max(0, 1 - k * k)));
    if (half <= 0) continue;
    const y = cy + r;
    c.fillStyle = OUTLINE; c.fillRect(X - half - 1, y, 1, 1); c.fillRect(X + half + 1, y, 1, 1);
    // The rim: two pixels each side, its light walking round with the turn.
    const lit = Math.sin(turn + k * 3) > .3;
    c.fillStyle = lit ? (party ? HEART[0] : RIM[4]) : RIM[3]; c.fillRect(X - half, y, 1, 1);
    c.fillStyle = lit ? RIM[3] : RIM[2]; c.fillRect(X + half, y, 1, 1);
    if (half > 1) {
      c.fillStyle = RIM[1]; c.fillRect(X - half + 1, y, half * 2 - 1, 1);
      // The heart: hearth-gold, brightest in the middle.
      const inner = Math.max(0, half - 3);
      if (inner > 0 && Math.abs(k) < .8) { c.fillStyle = Math.abs(k) < .35 ? HEART[1] : HEART[0]; c.fillRect(X - inner + 1, y, inner * 2 - 1, 1); }
      else if (half > 2) { c.fillStyle = RIM[2]; c.fillRect(X - half + 2, y, half * 2 - 3, 1); }
    }
  }
  // Caps of outline top and bottom.
  c.fillStyle = OUTLINE; c.fillRect(X - 1, cy - H - 1, 3, 1); c.fillRect(X - 1, cy + H + 1, 3, 1);
  // Motes rising out of the top (none under reduced motion).
  if (!still) for (let i = 0; i < 3; i++) {
    const t = (time * .7 + i / 3) % 1;
    c.globalAlpha = (1 - t) * Math.max(.25, fade);
    c.fillStyle = i % 2 ? RIM[4] : HEART[0];
    c.fillRect(X - 4 + i * 4 + Math.round(Math.sin(time * 3 + i) * 1.5), cy - H - 2 - Math.round(t * 12), 1, 1);
  }
  c.restore();
}

// ── The portals in the world (the engine's part, behind a small host so it stays testable) ─────────────────────────

/** What the portals need of the world. */
export interface WaygateHost {
  /** Where the Keeper stands now. */
  here(): WaygateSpot;
  /** The hearths of the continent the Keeper is on (td-hearth hearthsOf). */
  hearths(): readonly { id: string; x: number; y: number }[];
  /** Inside a town or a village (td-world inSettlement). */
  inTown(): boolean;
  /** A boss fighting near (bossFighting), the Seam Eater risen. */
  bossFight(): boolean;
  seamFight(): boolean;
  /** Stand the Keeper there (td-engine restoreWhereabouts); false when the spot is gone. */
  travel(to: WaygateSpot): boolean;
  say(key: string): void;
  /** The party members' portals, from presence (`gate`), by member id. */
  partyGates(): readonly { id: string; gate: string }[];
}

/** One end the painter draws: where, how faded, a friend's or the Keeper's own. */
export interface WaygateEnd { x: number; y: number; fade: number; party: boolean; side: 'from' | 'town'; owner: string }

/** The Keeper's own portal pair and the party's, stepped each frame. */
export class TdWaygates {
  /** The Keeper's own portal (one at a time). */
  own: Waygate | null = null;
  /** Each end's arming, by `${owner}:${side}`: false until the feet have been WAYGATE_ARM away from it. */
  private readonly armed = new Map<string, boolean>();
  /** Trips taken (for the specs and the HUD's data attributes). */
  trips = 0;

  constructor(private readonly host: WaygateHost) {}

  /** Open a portal where the Keeper stands, standing `life` seconds; why not, or null. A new one replaces the last. */
  open(now: number, life = WAYGATE_SECS): WaygateBlock | null {
    const why = waygateBlock({ inTown: this.host.inTown(), bossFight: this.host.bossFight(), seamFight: this.host.seamFight() });
    if (why) return why;
    const here = this.host.here();
    // From a floor or a cave the hearth nearest the surface's square is the capital's (the first): the floors keep
    // no surface position of their own.
    const h = nearestHearth(this.host.hearths(), here.level === 'surface' ? here : null);
    if (!h) return 'waytown';
    const at = townGateAt(h);
    this.own = { from: { ...here }, town: { continent: here.continent, level: 'surface', x: at.x, y: at.y, hearth: h.id }, opened: now, life: Math.max(1, Math.min(WAYGATE_MAX_SECS, life)) };
    this.armed.set(':from', false); this.armed.set(':town', true);
    this.host.say('play.waygate.opened');
    return null;
  }

  /** Every portal standing now: the Keeper's own and the party's (decoded from presence). */
  gates(now: number): { owner: string; gate: Waygate }[] {
    const out: { owner: string; gate: Waygate }[] = [];
    if (this.own && waygateLeft(this.own, now) > 0) out.push({ owner: '', gate: this.own });
    for (const p of this.host.partyGates()) { const g = decodeGate(p.gate, now); if (g) out.push({ owner: p.id, gate: g }); }
    return out;
  }

  /** The ends on the Keeper's own level, for the painter. */
  ends(now: number): WaygateEnd[] {
    const here = this.host.here(), out: WaygateEnd[] = [];
    for (const { owner, gate } of this.gates(now)) {
      const left = waygateLeft(gate, now), fade = left < 20 ? left / 20 : 1;
      for (const side of ['from', 'town'] as const) {
        const end = gate[side];
        if (end.continent === here.continent && end.level === here.level) out.push({ x: end.x, y: end.y, fade, party: owner !== '', side, owner });
      }
    }
    return out;
  }

  /** Each frame: the Keeper's portal fades on time; stepping onto an armed end takes him through. */
  step(now: number): void {
    if (this.own && waygateLeft(this.own, now) <= 0) { this.own = null; this.host.say('play.waygate.faded'); }
    const here = this.host.here();
    for (const { owner, gate } of this.gates(now)) {
      for (const side of ['from', 'town'] as const) {
        const end = gate[side], key = `${owner}:${side}`;
        const same = end.continent === here.continent && end.level === here.level;
        const d = same ? Math.hypot(end.x - here.x, end.y - here.y) : Infinity;
        if (d > WAYGATE_ARM) { this.armed.set(key, true); continue; }
        if (d > WAYGATE_REACH || !this.armed.get(key)) continue;
        this.through(owner, gate, side);
        return;
      }
    }
  }

  /** Through a portal: from the field to town (arriving just south of the twin), or back to the exact spot. */
  private through(owner: string, gate: Waygate, side: 'from' | 'town'): void {
    const other = side === 'from' ? 'town' : 'from', end = gate[other];
    // Back to the very spot it was opened at; into town, a step south of the portal (so it does not take him back).
    const to: WaygateSpot = { continent: end.continent, level: end.level, x: end.x, y: other === 'from' ? end.y : end.y + ARRIVE_BELOW };
    if (!this.host.travel(to)) return;
    this.trips++;
    this.armed.set(`${owner}:${other}`, false);
    if (other === 'from') {
      // Home again: the Keeper's own pair closes behind him (a friend's stays for its owner).
      if (owner === '') { this.own = null; this.armed.delete(':from'); this.armed.delete(':town'); }
      this.host.say('play.waygate.returned');
    } else this.host.say('play.waygate.arrived');
  }

  /** The Keeper's own portal for presence (encodeGate; '' for none). */
  presence(now: number): string { return encodeGate(this.own, now); }
}
