/**
 * field-notes.model.ts — the endless Delve's field-note walls (Phase 7,
 * docs/world/delve-and-beyond.md §3.6 and §8). Pure: no Angular, no storage.
 *
 * "Field notes are not inscriptions. Inscriptions were meant to be read. Field
 * notes were meant to be found." (the Archivist, lore-addendum.md). The core's
 * twelve inscriptions stay the Archivist's set; these are a second, separate
 * set, carved into structures the sector generator lays east and west of the
 * core (engine/sector-gen.ts picks one per structure from its stratum's pool,
 * so the same note can turn up in many places). A note's id is carved into the
 * wall as `field:<id>` and reported through the engine's `onDiscover` like an
 * inscription; the play view shows its line and pays a little Delving XP the
 * first time each id is read (a ledger mutation keyed by the id: idempotent).
 *
 * Ids are saved in nobody's blob (the ledger key is the only record), but they
 * are carved by the generator, so never rename one: add new ids instead and
 * bump the generator version (`SECTOR_GV`) if a pool changes.
 * Lore: lore-addendum.md, "The Delve and beyond", field notes.
 */

export type FieldNoteStratum = 'root-hollows' | 'basalt-caverns' | 'glowcap-grotto' | 'magma-halls';

export interface FieldNoteDef {
  id: string;
  stratum: FieldNoteStratum;
  /** The one line shown in the world when it is found (English; the HUD shows it as is, like the inscriptions). */
  text: string;
}

/** The prefix a field note's id carries on the wall (Terrain.inscriptions). */
export const FIELD_NOTE_PREFIX = 'field:';

/** Delving XP the first time a note is found: half an inscription's, there are many walls. */
export const FIELD_NOTE_XP = 8;

export const FIELD_NOTES: readonly FieldNoteDef[] = [
  // Root Hollows: the old Keepers' camps.
  { id: 'roots-shadow-measured', stratum: 'root-hollows',
    text: 'Someone measured the shadow-root here every year. The marks go down the wall toward the crack, a hand a year.' },
  { id: 'roots-back-by-morning', stratum: 'root-hollows',
    text: 'A Keeper slept here once. The soot is old, the bedding is root, and the wall says only: "Back by morning."' },
  // Basalt Caverns: Kael's mines, closed and left to the water.
  { id: 'basalt-rail-gauge', stratum: 'basalt-caverns',
    text: 'A rail gauge scratched into the rock, and an arrow. The arrow points at the crack, as every one of them does.' },
  { id: 'basalt-for-whoever-comes', stratum: 'basalt-caverns',
    text: 'Kael\'s stencil, upside down, over a hollow in the wall: "For whoever comes next. Light it before you need it."' },
  { id: 'basalt-closed-in-chalk', stratum: 'basalt-caverns',
    text: '"Closed", in chalk, over a seam nobody finished. Under it, smaller: "It was running toward something."' },
  // Glowcap Grotto: the Grotto Mere's two notes (lore-addendum.md, The Drowned Lamp).
  { id: 'grotto-the-waterline', stratum: 'glowcap-grotto',
    text: 'The water rose to here once. Someone marked it, then marked it again a hand lower, and again. The last mark is under the surface.' },
  { id: 'grotto-for-whoever-fishes', stratum: 'glowcap-grotto',
    text: 'Throw back the small ones. They are carrying something for the rest of us.' },
  // Magma Halls: the Cinder Bailiffs' work routes.
  { id: 'magma-heat-debt', stratum: 'magma-halls',
    text: 'A column of heat stamps, each pressed into the rock by a Bailiff\'s seal. The last one has not been paid.' },
];

const BY_ID = new Map(FIELD_NOTES.map(note => [note.id, note]));

/** The note carved as `field:<id>`, or undefined (an inscription, or an unknown id). */
export function fieldNoteFor(carved: string): FieldNoteDef | undefined {
  return carved.startsWith(FIELD_NOTE_PREFIX) ? BY_ID.get(carved.slice(FIELD_NOTE_PREFIX.length)) : undefined;
}

/** The ids of a stratum's pool, in a fixed order (the generator picks by index). */
export function fieldNotePool(stratum: FieldNoteStratum): readonly string[] {
  return FIELD_NOTES.filter(note => note.stratum === stratum).map(note => note.id);
}
