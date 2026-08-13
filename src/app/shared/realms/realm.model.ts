/**
 * realm.model.ts — the five realms, and the map from a tool category onto one.
 *
 * The registry's twelve categories are an inventory, not a world. The realms
 * group them the way the Eclipse Realms codex does: light and making
 * (Luminous), shadow and breaking (Umbral), the unstable border where things
 * are translated between forms (Verge), the archive that keeps records
 * (Archivum), and the connective tissue between them (Nexus).
 *
 * Pure data — no browser APIs — so it is safe to import from an SSR path.
 */
import { EnergyType } from '../gamification/gamification.model';

export type RealmId = 'luminous' | 'umbral' | 'verge' | 'archivum' | 'nexus';

export interface RealmDefinition {
  id: RealmId;
  /** Realm name as it appears in a section header. */
  name: string;
  /** What this realm is, in one line, for the header subtitle. */
  domain: string;
  color: string;
  glow: string;
  /** A line from the codex, shown under the realm header. */
  quote: string;
  /** Which energy tools in this realm feed. */
  energy: EnergyType;
  /** Registry categories that belong to this realm. */
  categories: string[];
  /**
   * Basename of the realm sigil under assets/icons/realms.
   *
   * Three of these do not match their realm's name: the sigil sheet was painted
   * against a later naming pass (Verge became Celestial, Archivum became
   * Verdant, Nexus became Infernal) that the lore and category tables here have
   * not taken yet. The art is the newer artefact, so the id stays and the file
   * carries the new name until the rename lands everywhere at once.
   */
  sigil: string;
}

/**
 * Three of these colours were re-cut against the painted art (2026-08-13).
 *
 * `color` is the realm's accent everywhere — the badge on all 126 tool pages,
 * the gate on /tools — and every one of those surfaces now sits in front of the
 * realm's `bg-<sigil>` painting. Three had drifted out of step with it, which
 * only became visible once the art went full-bleed:
 *
 *   umbral   #8B2252 crimson -> #A855F7 violet.  The vault is lit by violet
 *            crystals; the old crimson belonged to `--forge-crimson`, not here.
 *   archivum #C9A84C gold    -> #10B981 emerald. bg-verdant is a green
 *            conservatory. The gold read as a second Luminous.
 *   nexus    #10B981 emerald -> #EF4444 crimson. bg-infernal is a lava-lit mail
 *            forge, so a green accent fought the whole frame.
 *
 * Archivum and Nexus had, in effect, swapped: each wore the other's colour.
 * Luminous (gold hall) and Verge (blue observatory) already matched and are
 * untouched. Note the violet is lighter than the codex's `#6B21A8` — that value
 * only reaches ~2.2:1 on `--forge-void` and cannot carry text.
 */
export const REALMS: RealmDefinition[] = [
  {
    id: 'luminous',
    name: 'Luminous',
    domain: 'Design & CSS',
    color: '#E8D44D',
    glow: 'rgba(232, 212, 77, 0.6)',
    quote: 'In the beginning, there was the Sun — whole, silent, and dreaming.',
    energy: 'aether',
    categories: ['CSS Tools', 'CSS', 'CSS Generators', 'SVG Tools'],
    sigil: 'luminous',
  },
  {
    id: 'umbral',
    name: 'Umbral',
    domain: 'Security & Secrets',
    color: '#A855F7',
    glow: 'rgba(168, 85, 247, 0.6)',
    quote: 'The Nocturne build with what the light discards.',
    energy: 'nox',
    categories: ['Security Tools'],
    sigil: 'umbral',
  },
  {
    id: 'verge',
    name: 'Verge',
    domain: 'Code & Conversion',
    color: '#00d4ff',
    glow: 'rgba(0, 212, 255, 0.6)',
    quote: 'Between light and shadow, the soul remembers both.',
    energy: 'nox',
    categories: ['Code Converters', 'DevOps', 'Reference'],
    sigil: 'celestial',
  },
  {
    id: 'archivum',
    name: 'Archivum',
    domain: 'Productivity & Record',
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.6)',
    quote: 'Truth transcends divine conflict.',
    energy: 'aether',
    categories: ['Productivity', 'Text & Data', 'SEO Tools'],
    sigil: 'verdant',
  },
  {
    id: 'nexus',
    name: 'Nexus',
    domain: 'Mail & Delivery',
    color: '#EF4444',
    glow: 'rgba(239, 68, 68, 0.6)',
    quote: 'Every message is a thread between worlds. Cut one and something goes dark.',
    energy: 'aether',
    categories: ['Email Tools'],
    sigil: 'infernal',
  },
];

/** Display order for realm-grouped listings. Mirrors REALMS. */
export const REALM_ORDER: RealmId[] = REALMS.map(r => r.id);

const BY_CATEGORY = new Map<string, RealmDefinition>();
for (const realm of REALMS) {
  for (const category of realm.categories) BY_CATEGORY.set(category, realm);
}

/**
 * The realm a category belongs to. Archivum is the fallback rather than null:
 * an unmapped category is almost certainly a new utility, and the archive is
 * where unclassified things go until someone files them properly.
 */
export function realmForCategory(category: string | undefined): RealmDefinition {
  return (category ? BY_CATEGORY.get(category) : undefined)
    ?? REALMS.find(r => r.id === 'archivum')!;
}

export function realmById(id: RealmId | null | undefined): RealmDefinition | null {
  return REALMS.find(r => r.id === id) ?? null;
}
