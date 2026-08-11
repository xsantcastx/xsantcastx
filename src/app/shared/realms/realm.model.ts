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
}

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
  },
  {
    id: 'umbral',
    name: 'Umbral',
    domain: 'Security & Secrets',
    color: '#8B2252',
    glow: 'rgba(139, 34, 82, 0.7)',
    quote: 'The Nocturne build with what the light discards.',
    energy: 'nox',
    categories: ['Security Tools'],
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
  },
  {
    id: 'archivum',
    name: 'Archivum',
    domain: 'Productivity & Record',
    color: '#C9A84C',
    glow: 'rgba(201, 168, 76, 0.6)',
    quote: 'Truth transcends divine conflict.',
    energy: 'aether',
    categories: ['Productivity', 'Text & Data', 'SEO Tools'],
  },
  {
    id: 'nexus',
    name: 'Nexus',
    domain: 'Mail & Delivery',
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.6)',
    quote: 'Every message is a thread between worlds. Cut one and something goes dark.',
    energy: 'aether',
    categories: ['Email Tools'],
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
