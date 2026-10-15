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

export type FieldNoteStratum = 'root-hollows' | 'basalt-caverns' | 'glowcap-grotto' | 'magma-halls' | 'underhearth'
  // The Rift Gates (rift-gates.model.ts): notes at the gates, and in the Umbral's underside (realm-gen.ts).
  | 'rift' | 'umbral'
  // The Verdant's underside, the Root Deeps (verdant-gen.ts), and the Luminous's, the Prism Mines (luminous-gen.ts).
  | 'verdant' | 'luminous'
  // The Celestial's underside, the Orrery Wells (celestial-gen.ts).
  | 'celestial';

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
  // The Underhearth (Phase 8): the Four's own words, cut where they worked (lore-addendum.md, The Four Who Went Down).
  { id: 'hearth-bank-not-quench', stratum: 'underhearth',
    text: '"Cover it. Slow it. Do not put it out. A fire put out has to be lit again by someone who does not know how it was made."' },
  { id: 'hearth-pillar-count', stratum: 'underhearth',
    text: '"Sixteen pillars. We will fell twelve. Four will hold until we are done. After that they can do as they like."' },
  { id: 'hearth-weight', stratum: 'underhearth',
    text: '"The coal down here is cold to the touch. Strike it and it remembers. Everything down here remembers."' },
  { id: 'hearth-four-hammers', stratum: 'underhearth',
    text: '"One mark for each of us, where we stood. If you find all four you have found where the work was. You have not found us."' },
  { id: 'hearth-for-the-fifth', stratum: 'underhearth',
    text: '"Keep the anvil going. Do not come down. If you come down, come down with someone."' },
  { id: 'hearth-unsigned-again', stratum: 'underhearth',
    text: 'A tally mark, and beside it a second one, cut the same day.' },
  // The Rift Gates: cut into the rock beside each gate (lore-addendum.md, The Rift Gates).
  { id: 'rift-not-a-door', stratum: 'rift',
    text: '"Not a door. A place where two undersides wear thin. Bring something of theirs and it lets you be from there, for a while."' },
  { id: 'rift-settling', stratum: 'rift',
    text: 'The frame is warm on one side and cold on the other. Nobody has decided yet which side is which.' },
  // The Ink Deeps, the Umbral's underside: Rook Sable's chalk, and the Warden's own words.
  { id: 'umbral-rooks-chalk', stratum: 'umbral',
    text: 'Chalk, in a neat hand: an arrow and "R.S. This way, if it is still this way." The arrow has been rubbed out and redrawn twice.' },
  { id: 'umbral-unlit-routes', stratum: 'umbral',
    text: '"Do not map what you have not lit. It will be somewhere else when you come back for it." R.S.' },
  { id: 'umbral-tide-table', stratum: 'umbral',
    text: 'A tide table scratched in the slate: rise, hold, fall, rest. No dates. The ink does not keep any.' },
  { id: 'umbral-two-hands', stratum: 'umbral',
    text: 'Two hands pressed into the slate, one over the other. One of them is not quite the same size.' },
  { id: 'umbral-warden-oath', stratum: 'umbral',
    text: '"I keep the dark that was left when the light went somewhere else. Light me, and I stand still. That is all I ask of anyone."' },
  // The Root Deeps, the Verdant's underside: Kesh's graft notes, Siv's warnings, the Graftmother's own words.
  { id: 'verdant-kesh-graft', stratum: 'verdant',
    text: 'Grafting wax pressed into a crack, and in it, with a thorn: "K.A. It took. It always takes. That is the problem."' },
  { id: 'verdant-siv-warning', stratum: 'verdant',
    text: 'Carved deep, in a ranger\'s hand: "The tunnel you dug is not yours. Burn it, cut it, or prop it, or it closes behind you. S.M."' },
  { id: 'verdant-ring-count', stratum: 'verdant',
    text: 'Someone counted the rings in a cut root and gave up at four hundred. The cut has healed over the count.' },
  { id: 'verdant-two-saplings', stratum: 'verdant',
    text: 'Two names cut into the wood as children cut them, side by side. The root grew between them, and pushed them apart.' },
  { id: 'verdant-graft-oath', stratum: 'verdant',
    text: '"Everything that is cut, I join. Everything that leaves, I keep. Cut my roots, and I will let you go." The words are grown, not carved.' },
  // The Prism Mines, the Luminous's underside: Aureth's chalk, the miners' rule, the Hollow Sun's.
  { id: 'luminous-aureth-chalk', stratum: 'luminous',
    text: 'Gold chalk, a careful hand: "A. Stand where the light is. It holds you up here, the way the truth is meant to."' },
  { id: 'luminous-turn-the-glass', stratum: 'luminous',
    text: 'A miner\'s rule scratched by the lip: "No bridge? Turn the glass. The sun does the rest."' },
  { id: 'luminous-dark-glass', stratum: 'luminous',
    text: '"The black glass is a floor if you bring a light. It is a well if you do not. Bring a light." Underneath, smaller: "I did not."' },
  { id: 'luminous-odds', stratum: 'luminous',
    text: 'A tally of bets in a croupier\'s neat columns: which beam would hold, which would not. Every line is settled, and every one was right. L.C.' },
  { id: 'luminous-hollow-sun', stratum: 'luminous',
    text: '"I am the light that was promised and never arrived. Catch me in a beam and I will stand still long enough to be ended."' },
  // The Orrery Wells, the Celestial's underside: Sera's survey marks, the Compact's rule, the Ephemeris's own table.
  { id: 'celestial-sera-survey', stratum: 'celestial',
    text: 'A surveyor\'s mark in brass, error bars and all: "Down measured here: twice. Both readings correct. S.Q." Underneath, smaller: "That is the problem."' },
  { id: 'celestial-turn-the-ring', stratum: 'celestial',
    text: 'Scratched by the tunnel: "Fell in? Turn the ring by your feet. You will fall up. Walk the roof. It is allowed."' },
  { id: 'celestial-chain-rule', stratum: 'celestial',
    text: 'A Compact rule, stamped into a plate: "Every well a chain. Every field a ring within reach of both its floors. No exceptions, no apologies."' },
  { id: 'celestial-nox-margin', stratum: 'celestial',
    text: 'In the margin of a star-table, in another hand: "This column was never measured. It was assumed. N.A." Someone has tried to scratch it out and failed.' },
  { id: 'celestial-counterweight', stratum: 'celestial',
    text: 'A brass counterweight the size of a cart, hung from nothing. Its tag reads: "Holding the floor down. Do not remove."' },
  { id: 'celestial-ephemeris', stratum: 'celestial',
    text: '"I am the table of where every star should be. I fell when the sky stopped agreeing with me. Pull my floor out from under me and I will finally be where I am."' },
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
