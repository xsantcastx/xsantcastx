/**
 * expedition-events.model.ts — what happened while they were out.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS DETERMINISTIC AND NOT RANDOM
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious build calls `Math.random` when a milestone is crossed and stores
 * the line on the record. It has two problems and both of them are visible.
 *
 * First, the milestone is crossed by *the wall clock*, not by an event: a tab
 * that is shut at 20% and reopened at 80% never ran the code that would have
 * picked the 25% and 50% lines, so the story an expedition tells depends on
 * whether anyone was watching — which is precisely backwards for a mechanic
 * whose whole pitch is that it resolves while you are away.
 *
 * Second, storing them grows the save. Five explorers × four milestones is
 * twenty strings written to localStorage per dispatch cycle, for text that is
 * read once and is worth nothing after the mission lands.
 *
 * So the line is *derived*: a small integer hash of `expeditionId + milestone`
 * indexes the pool. It is stable across reloads, identical on every device the
 * save syncs to, costs nothing to store, and is correct for a mission nobody
 * watched — reopening the tab at 80% shows all three earlier beats, because
 * they were never events, they were always facts about the mission.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE POOLS ARE PER REALM AND PER TIER
 * ─────────────────────────────────────────────────────────────────────────────
 * A shared pool of forty generic lines reads as generic by the fourth dispatch,
 * because a player runs the same realm repeatedly and a line about a "shadow
 * creature" turning up in Archivum is a line about nothing. Each realm gets its
 * own voice, and the deep tier gets a darker one on top, so the Void Threshold
 * does not narrate like the Shadow Crypt with a bigger number attached.
 *
 * Pure data and pure functions. No browser APIs, no `Math.random` at all.
 */
import { RealmId } from '../realms/realm.model';
import { SiteTier } from './expedition-site.model';

/** The four beats a mission is narrated at. */
export const MILESTONES = [25, 50, 75, 100] as const;
export type Milestone = typeof MILESTONES[number];

export interface ExpeditionBeat {
  /** The percentage this beat is pinned to. */
  at: Milestone;
  /** The line itself. */
  text: string;
  /** True once the mission has actually passed this point. */
  reached: boolean;
}

/**
 * Departure, middle, turn, and home — per realm.
 *
 * Four pools rather than one because a beat at 25% is about *going in* and a
 * beat at 75% is about deciding whether to come back, and a single pool would
 * put "they turned for home" at the quarter mark.
 */
type RealmVoice = Record<Milestone, readonly string[]>;

const LUMINOUS: RealmVoice = {
  25: [
    'The light here has weight. They report leaning into it.',
    'Gold in the walls, close enough to touch and welded in place.',
    'They found the old survey markers. Somebody has been counting.',
  ],
  50: [
    'Halfway. The light has not dimmed once and that is starting to bother them.',
    'A hall nobody catalogued, full of things that were meant to be found.',
    'They stopped to shield their eyes and the glare wrote something on the floor.',
  ],
  75: [
    'They are turning back with more than they can comfortably carry.',
    'The way out is brighter than the way in. Nobody has explained it.',
    'One last chamber, and then a sensible decision about the second-last one.',
  ],
  100: [
    'Home, squinting, and richer.',
    'They came back up into the dark and called it a relief.',
    'Back at the gate, still blinking.',
  ],
};

const UMBRAL: RealmVoice = {
  25: [
    'Down past the last lamp. The lamp was not theirs.',
    'The crypt air moved before they did.',
    'They marked the wall at the first junction. The mark is gone now.',
  ],
  50: [
    'Something followed them for a while and then stopped, which is worse.',
    'Halfway. The vault is inventorying them back.',
    'A door that was open on the way in.',
  ],
  75: [
    'They have what they came for and are being unhurried about leaving.',
    'The stairs up are not the stairs they came down. They are going anyway.',
    'Turning for the surface, carrying something the dark did not offer.',
  ],
  100: [
    'Home. They will not say what the last corridor had in it.',
    'Back, with the bag heavy and the story short.',
    'Out of the vault, ahead of whatever was counting.',
  ],
};

const VERGE: RealmVoice = {
  25: [
    'First crossing made. The stone asked and they had an answer.',
    'The span held. It usually does for the first third.',
    'They are keeping notes, which here is the same as keeping their footing.',
  ],
  50: [
    'Halfway across. The far side has started answering back.',
    'A phrase they cannot translate, carved where a handrail should be.',
    'They stopped understanding something and had to go back four steps.',
  ],
  75: [
    'Nearly across. They have written down more than they set out to find.',
    'The gate let them read it. That is not usually how it goes.',
    'Coming back over, saying nothing, to be safe.',
  ],
  100: [
    'Home, and quieter than they left.',
    'Back across. The notebook is full.',
    'They crossed twice and only the second one cost anything.',
  ],
};

const ARCHIVUM: RealmVoice = {
  25: [
    'Into the stacks. The catalogue already had them listed as arriving.',
    'Shelf after shelf of things that were carefully kept and never wanted.',
    'They found the index. The index found them first.',
  ],
  50: [
    'Halfway. Two copies of everything, and the copies disagree.',
    'A ledger open at today, in a hand nobody recognises.',
    'They are reading rather than searching, which the Archive prefers.',
  ],
  75: [
    'They are copying one last page out by hand.',
    'The shelves end. Something is still writing past where they end.',
    'Turning back with a fragment the wall has been missing.',
  ],
  100: [
    'Home, with the second copy.',
    'Back, and already entered in the record they came from.',
    'Out of the stacks. The catalogue has been updated.',
  ],
};

const NEXUS: RealmVoice = {
  25: [
    'On the freight line. Something else is using it in the other direction.',
    'The yards are running. Nobody is running them.',
    'A crate addressed to the Sanctum, dated before the Sanctum.',
  ],
  50: [
    'Halfway out along a thread that stopped being maintained a long time ago.',
    'Deliveries still arriving at an address that burned.',
    'They are riding freight now rather than walking beside it.',
  ],
  75: [
    'Loaded, and looking for a line that still goes home.',
    'The route back is shorter than the route out. It should not be.',
    'They are cutting loose and coasting in.',
  ],
  100: [
    'Home on the last thread that still runs.',
    'Back in the yards, with freight nobody sent.',
    'Delivered. To us, this time.',
  ],
};

const VOICES: Record<RealmId, RealmVoice> = {
  luminous: LUMINOUS,
  umbral: UMBRAL,
  verge: VERGE,
  archivum: ARCHIVUM,
  nexus: NEXUS,
};

/**
 * Overrides for the deep sites only.
 *
 * Not a fourth realm voice — a *pressure* on the existing one. A deep run in
 * Archivum should still sound like Archivum; it should just sound like the part
 * of Archivum nobody has a shelf number for.
 */
const DEEP: RealmVoice = {
  25: [
    'Past the last place anything is written down.',
    'They have stopped reporting distances. There is nothing to measure against.',
    'The descent is no longer a descent. Nobody has a better word.',
  ],
  50: [
    'Halfway, by a clock that is no longer certain it is theirs.',
    'They have been gone longer down there than they have been gone up here.',
    'Contact held. Barely, and not continuously.',
  ],
  75: [
    'Coming up. Slower than they went down, and carrying more.',
    'They have decided to leave. Something has decided to let them.',
    'The way out opened. They are not asking why.',
  ],
  100: [
    'Home from the deep. Count them.',
    'Back, changed by an amount that is difficult to put a figure on.',
    'They surfaced. The bag surfaced with them.',
  ],
};

/**
 * A small, stable, non-cryptographic hash. FNV-1a, 32-bit.
 *
 * Chosen over `id.length + milestone` — which is what a first pass reaches for —
 * because expedition ids are `realm-mission-timestamp-count` and differ mostly
 * in their tail, so a length-based index would hand every mission in a realm
 * the same four lines all evening.
 */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The line this exact mission tells at this exact milestone. Always the same. */
export function beatText(
  expeditionId: string,
  realm: RealmId | string,
  tier: SiteTier | undefined,
  at: Milestone,
): string {
  const voice = tier === 'deep' ? DEEP : (VOICES[realm as RealmId] ?? LUMINOUS);
  const pool = voice[at];
  if (!pool.length) return '';
  return pool[hash(`${expeditionId}:${at}`) % pool.length];
}

/**
 * The whole story so far: four beats, each flagged with whether the mission has
 * actually reached it.
 *
 * Returns all four rather than only the reached ones so the panel can render
 * the unreached beats as blanks — the shape of the journey is visible from the
 * moment they leave, which is what makes crossing 50% feel like something
 * arriving rather than a line appearing out of nowhere.
 *
 * `progress` is 0–1, the same value the ring and the bar already read.
 */
export function expeditionBeats(
  expeditionId: string,
  realm: RealmId | string,
  tier: SiteTier | undefined,
  progress: number,
): ExpeditionBeat[] {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return MILESTONES.map(at => ({
    at,
    text: beatText(expeditionId, realm, tier, at),
    reached: pct >= at,
  }));
}

/** The most recent beat the mission has actually crossed, or null before 25%. */
export function currentBeat(
  expeditionId: string,
  realm: RealmId | string,
  tier: SiteTier | undefined,
  progress: number,
): ExpeditionBeat | null {
  const reached = expeditionBeats(expeditionId, realm, tier, progress).filter(b => b.reached);
  return reached.length ? reached[reached.length - 1] : null;
}
