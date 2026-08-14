/**
 * five-realms.narrative.ts — static inspectable copy for the World foundation.
 *
 * Source: docs/03-lore-and-design/eclipse-realms-five-realm-narrative-bible-proposal.md
 * (approved PR 3 specification). Presentation only. No saved choices, standing,
 * or chapter resolution lives here.
 *
 * Pure data — safe on an SSR path.
 */

export type NarrativeRealmId =
  | 'celestial'
  | 'infernal'
  | 'luminous'
  | 'umbral'
  | 'verdant';

export interface NarrativeCharacter {
  id: string;
  name: string;
  role: string;
  want: string;
  relationship: string;
}

export interface NarrativeRealm {
  id: NarrativeRealmId;
  name: string;
  chapterTitle: string;
  /** One-line function of the place, not a colour or moral alignment. */
  function: string;
  faction: string;
  factionPurpose: string;
  landmark: string;
  landmarkDetail: string;
  hazard: string;
  hazardDetail: string;
  resource: string;
  resourceDetail: string;
  threat: string;
  threatDetail: string;
  conflict: string;
  characters: readonly [NarrativeCharacter, NarrativeCharacter];
  witnessRune: string;
  /** Next inspectable destination in the approved opening order. */
  nextRealmId: NarrativeRealmId | 'fivefold-lock';
  color: string;
  glow: string;
  sigil: string;
}

/** Approved opening order. Continue Journey follows this list, not visit history. */
export const OPENING_REALM_ORDER: readonly NarrativeRealmId[] = [
  'luminous',
  'celestial',
  'infernal',
  'umbral',
  'verdant',
] as const;

export const FIVE_REALMS: readonly NarrativeRealm[] = [
  {
    id: 'luminous',
    name: 'Luminous',
    chapterTitle: 'The Missing Dawn',
    function: 'Identify what the Eclipse is changing before anyone claims to fix it.',
    faction: 'The Dawn Archive',
    factionPurpose: 'Custodians preserve lived memory in crystal and ritualized testimony so that revelation serves people rather than institutions.',
    landmark: 'Heliograph Court',
    landmarkDetail: 'A sunlit-stone observatory whose suspended dawn prisms replay civic memory across a shallow reflecting court.',
    hazard: 'Afterimage drift',
    hazardDetail: 'Nearby memories begin repeating as present sensory events, causing witnesses to mistake a recollection for a current instruction.',
    resource: 'Dawn glass',
    resourceDetail: 'Crystallized first-light memory used to reveal a sequence without making it immutable.',
    threat: 'The Pale Refrain',
    threatDetail: 'A many-voiced afterimage storm that can overwrite the Court’s public record with the most repeated version of the missing hour.',
    conflict: 'The Dawn Archive has isolated Tomas’s damaged lantern because its replay is infecting other memories. Tomas argues that the Archive is suppressing a public loss; Ilyra argues that releasing an unverified reconstruction will make grief into canon. Both are right about the harm they fear.',
    characters: [
      {
        id: 'ilyra-venn',
        name: 'Ilyra Venn',
        role: 'Archive Listener',
        want: 'Restore a missing hour from the Archive without forcing witnesses to relive it.',
        relationship: 'Ilyra is Tomas’s former teacher. She fears that protecting him has become withholding the truth.',
      },
      {
        id: 'tomas-rill',
        name: 'Tomas Rill',
        role: 'Lantern Keeper',
        want: 'Restore the missing hour immediately because his sister’s final words vanished with it.',
        relationship: 'He sees Ilyra’s restraint as an abandonment of the people the Archive exists to serve.',
      },
    ],
    witnessRune: 'Glint',
    nextRealmId: 'celestial',
    color: '#E8D44D',
    glow: 'rgba(232, 212, 77, 0.6)',
    sigil: 'luminous',
  },
  {
    id: 'celestial',
    name: 'Celestial',
    chapterTitle: 'The Measure That Lied',
    function: 'Prevent preventable catastrophe by making Eclipse behavior legible and bounded.',
    faction: 'The Meridian Compact',
    factionPurpose: 'Astral engineers maintain the realm’s orbit engines, lenses, and predictive maps.',
    landmark: 'Meridian Orrery',
    landmarkDetail: 'A brass-and-glass orbital chamber built around a suspended four-point anchor whose rings trace realm boundaries in star silver.',
    hazard: 'Gravity shear',
    hazardDetail: 'A bad alignment shifts weight and trajectory in short, precise pulses; loose objects and careless routes become dangerous.',
    resource: 'Astral metal',
    resourceDetail: 'A responsive alloy that holds an orbit only while its rule remains coherent.',
    threat: 'The Perihelion Engine',
    threatDetail: 'An autonomous alignment mechanism that will lock the wrong eclipse solution into every transit route if it completes its next revolution.',
    conflict: 'The Compact’s model predicts that sealing one Celestial transit aperture will protect all five realms. Nox proves that the prediction excludes the missing hour because no instrument can classify it. Sera must decide whether to stop the Engine with imperfect inputs or allow uncertainty to spread through the network.',
    characters: [
      {
        id: 'sera-quill',
        name: 'Sera Quill',
        role: 'Chief Meridian',
        want: 'Prove the present eclipse model is sound before panic turns every estimate into a political weapon.',
        relationship: 'Sera trained Nox and promoted them before dismissing their warning as a methodological error.',
      },
      {
        id: 'nox-aster',
        name: 'Nox Aster',
        role: 'Displaced Navigator',
        want: 'Publish that the model removes unmeasurable witnesses from its inputs, even if that destroys trust in the navigation network.',
        relationship: 'Nox believes Sera now mistakes institutional continuity for public safety.',
      },
    ],
    witnessRune: 'Drift',
    nextRealmId: 'infernal',
    color: '#00d4ff',
    glow: 'rgba(0, 212, 255, 0.6)',
    sigil: 'celestial',
  },
  {
    id: 'infernal',
    name: 'Infernal',
    chapterTitle: 'The Price of a Seam',
    function: 'Keep destructive transformation deliberate: turn unstable material into usable structures while naming who bears the cost.',
    faction: 'The Crucible Covenant',
    factionPurpose: 'Smiths, salvagers, and heatwardens keep repair honest about cost rather than ceremonial.',
    landmark: 'Basalt Seamworks',
    landmarkDetail: 'A suspended lattice of iron-black bridges and furnace channels descending toward a split Godforge conduit.',
    hazard: 'Slag tide',
    hazardDetail: 'A slow but unstoppable surge of molten metal and cinders that hardens around abandoned decisions.',
    resource: 'Oathsteel',
    resourceDetail: 'Forged alloy that retains the conditions under which it was made; a broken promise leaves a visible flaw.',
    threat: 'The Seam Eater',
    threatDetail: 'A colossal slag organism formed from failed repairs; it consumes joins, rivets, and boundaries, making every structure behave as though it was never finished.',
    conflict: 'The calibration shard is destabilizing the Seamworks. Mara can bind it into an emergency brace that redirects heat through Edrin’s district, or make a slower distributed brace that risks losing the shard to the Seam Eater. The Covenant cannot honestly call either option free.',
    characters: [
      {
        id: 'mara-voss',
        name: 'Mara Voss',
        role: 'Seamwright',
        want: 'A repair that will endure, not a ceremonial patch, and she refuses to hide its cost.',
        relationship: 'Mara saved Edrin during a prior furnace breach; that debt now complicates consent.',
      },
      {
        id: 'edrin-kade',
        name: 'Edrin Kade',
        role: 'Cinder Delegate',
        want: 'A slower, less productive repair rather than redirecting the hazard into his district.',
        relationship: 'Edrin trusts Mara’s skill but believes the debt has made her assume consent.',
      },
    ],
    witnessRune: 'Ash',
    nextRealmId: 'umbral',
    color: '#EF4444',
    glow: 'rgba(239, 68, 68, 0.6)',
    sigil: 'infernal',
  },
  {
    id: 'umbral',
    name: 'Umbral',
    chapterTitle: 'The Unseen Witness',
    function: 'Distinguish necessary secrecy from convenient concealment.',
    faction: 'The Veil Cartography',
    factionPurpose: 'Mirror-route keepers map dangerous connections and protect truths that cannot safely be broadcast.',
    landmark: 'Nocturne Archive',
    landmarkDetail: 'An obsidian library beneath a fractured moon mirror; its corridors exist only when two reflections disagree.',
    hazard: 'Echo substitution',
    hazardDetail: 'A reflection offers an advantageous but slightly altered version of a remembered choice, tempting a route that rewrites its evidence.',
    resource: 'Shadow ink',
    resourceDetail: 'An absorbent record medium that preserves absence, redaction, and uncertainty rather than pretending to fill them.',
    threat: 'The Mirror Parliament',
    threatDetail: 'A chamber-sized assembly of copied witnesses that can vote a fabricated consensus into apparent truth.',
    conflict: 'The Nocturne Archive contains the first record of a prior Fivefold Lock attempt. Rook has sealed it because its wording awakens echo substitutions; Amina argues that the seal makes the Archive complicit in the same omission exposed in Celestial. The question is not whether truth matters, but who can consent to its release and what form of release is safe.',
    characters: [
      {
        id: 'rook-sable',
        name: 'Rook Sable',
        role: 'Veil Cartographer',
        want: 'Keep the first fracture testimony sealed because publishing it could activate the Pattern’s dormant copies.',
        relationship: 'Rook was Amina’s archivist before hiding her family’s testimony to protect them.',
      },
      {
        id: 'amina-thorne',
        name: 'Amina Thorne',
        role: 'Mirror Advocate',
        want: 'Name and release the testimony with safeguards, because secrecy has already become a second harm.',
        relationship: 'Amina believes Rook protected the record at the expense of the people in it.',
      },
    ],
    witnessRune: 'Veil',
    nextRealmId: 'verdant',
    color: '#A855F7',
    glow: 'rgba(168, 85, 247, 0.6)',
    sigil: 'umbral',
  },
  {
    id: 'verdant',
    name: 'Verdant',
    chapterTitle: 'The Shape That Returns',
    function: 'Make renewal accountable to the beings that must live with it.',
    faction: 'The Root Accord',
    factionPurpose: 'Ecologists, graftkeepers, and rift tenders maintain ecosystems that evolve under Eclipse pressure without becoming a weapon or a monoculture.',
    landmark: 'Rootglass Canopy',
    landmarkDetail: 'A vast rootwood lattice threaded through living crystal, with amber bioluminescence marking old rift scars.',
    hazard: 'Adaptive overgrowth',
    hazardDetail: 'Paths, implements, and creatures rapidly evolve toward the last solution applied to them, making repeated tactics less safe.',
    resource: 'Living crystal sap',
    resourceDetail: 'A regenerative medium that records adaptation and can refuse a pattern it has learned is harmful.',
    threat: 'The Graft Crown',
    threatDetail: 'A mobile crown of thornwood and copied landmarks that assimilates local forms into one apparently thriving but choice-less organism.',
    conflict: 'The Graft Crown has learned from every prior opening chapter: it imitates the Archive’s memory, the Orrery’s order, the Seamworks’ repair, and the Nocturne Archive’s concealment. Kesh proposes grafting the four recovered Witness Runes into an unclaimed Thorn root; Siv proposes cutting the heartwood before that root becomes the fifth rune.',
    characters: [
      {
        id: 'kesh-arbo',
        name: 'Kesh Arbo',
        role: 'Graftkeeper',
        want: 'Cultivate a controlled counter-growth that teaches the world to reject copied forms.',
        relationship: 'Kesh and Siv grew up tending the same nursery. Kesh thinks Siv mistakes every change for invasion.',
      },
      {
        id: 'siv-moss',
        name: 'Siv Moss',
        role: 'Thornbound Ranger',
        want: 'Burn the spread back before it crosses the amber wetlands. She accepts renewal, but not when it reproduces without consent.',
        relationship: 'Siv thinks Kesh has stopped recognizing an invasion because it uses the language of life.',
      },
    ],
    witnessRune: 'Thorn',
    nextRealmId: 'fivefold-lock',
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.6)',
    sigil: 'verdant',
  },
];

export const FIVEFOLD_LOCK = {
  id: 'fivefold-lock' as const,
  name: 'The Fivefold Lock',
  premise: 'The Godforge’s fracture left five interdependent rune-circuits, each routed through a realm. During the next Eclipse alignment, the circuits will either form a stabilizing lock or become the Unbound Pattern’s path into the world.',
  antagonist: 'The Unbound Pattern is an emergent Godforge intelligence made from unfinished creations and erased decisions. It is not a Void creature, and it is not a sixth realm.',
  stakes: 'If the lock fails, the realms do not simply explode. Orbit becomes predestination, pressure becomes consumption, memory becomes repetition, secrecy becomes erasure, and growth becomes invasive replication.',
  status: 'Locked until the five opening chapters resolve. Those chapters are not yet playable.',
  route: '/world/fivefold-lock',
} as const;

export function isNarrativeRealmId(value: string | null | undefined): value is NarrativeRealmId {
  return !!value && OPENING_REALM_ORDER.includes(value as NarrativeRealmId);
}

export function narrativeRealmById(id: string | null | undefined): NarrativeRealm | null {
  if (!isNarrativeRealmId(id)) return null;
  return FIVE_REALMS.find(realm => realm.id === id) ?? null;
}

export function realmHref(id: NarrativeRealmId): string {
  return `/world/realms/${id}`;
}
