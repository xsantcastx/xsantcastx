/**
 * art.ts — the one place a model id is turned into painted art.
 *
 * `art-manifest.generated.ts` is keyed by the catalogue filename minus its
 * two-digit prefix, which matches the model id almost everywhere. Where it
 * does not, the alias belongs here rather than in each caller: the three
 * artifact aliases were already duplicated between `rune-cards.ts` and the
 * Market before this existed, which is exactly how a fourth one gets missed.
 *
 * Pure data — no browser APIs — so it is safe to import from an SSR path.
 */
import { ART_ALL, type ArtEntry } from './art-manifest.generated';
import { NPCS } from '../npc/npc.model';
import { EXPLORER_ARCHETYPES } from '../rpg/explorer-archetypes';

export type { ArtEntry };

/**
 * World-layer sprites (the side-scroller and the towns) live in their own
 * generated manifest: sheets with frame sizes, actions and hand anchors, not
 * a srcset. Re-exported here so there is still one art import for callers.
 * Commissioned in `docs/art-commissions/world-sprites/`; `spriteFor(id)` is
 * null until a sheet is imported, so a caller keeps its own fallback.
 */
export { SPRITES, spriteFor } from './sprite-manifest.generated';
export type { SpriteAction, SpriteEntry } from './sprite-manifest.generated';

/**
 * Model id -> manifest key, for ids whose file is named more verbosely than
 * the model. Keep this small: a new entry here is usually a sign the art
 * should have been named after the id instead.
 */
export const ART_ALIAS: Readonly<Record<string, string>> = {
  'mirrorblade-kael': 'mirrorblade-of-kael',
  'relic-third-dawn': 'relic-of-the-third-dawn',
  'fragment-first-sun': 'fragment-of-the-first-sun',
  // The Market sells a slot; the painting is of the explorer who fills it.
  'explorer-slot': 'hire-an-explorer',
  // The craft names the weapon; the library filed its render as a portrait.
  'basalt-edge': 'basalt-edge-portrait',
  // Forged tools (skills/tool-items). Stand-ins until the commission pack
  // paints `pickaxe-1`..`staff-4`; delete each row when its file lands.
  'pickaxe-1': 'iron-hammer', 'pickaxe-2': 'obsidian-mallet', 'pickaxe-3': 'nox-crusher', 'pickaxe-4': 'eclipse-hammer',
  'axe-1': 'rootbreaker-mace', 'axe-2': 'radiant-halberd', 'axe-3': 'astral-glaive', 'axe-4': 'starfall-maul',
  'sickle-1': 'briarvein-kris', 'sickle-2': 'ashveil-throwing-knives', 'sickle-3': 'hollow-fang', 'sickle-4': 'cindergnaw',
  'staff-1': 'keeper-staff', 'staff-2': 'keeper-staff', 'staff-3': 'nullthorn-staff', 'staff-4': 'pyreclast-wand',
  // Ember Delve biome materials (shared/delve). Stand-ins until the commission
  // pack paints them; delete each row when its file lands.
  'shadow-root-cutting': 'thornroot', 'glowcap': 'nightbloom', 'godforge-fragment': 'godstone',
  'kaels-hammer': 'iron-hammer',
  // Delve building placeables. Stand-ins until the commission pack paints them.
  'dirt-block': 'relic-dust', 'basalt-block': 'godforge-slag', 'torch': 'ember-stoker',
};

/**
 * Catalogue ids that have shipped ahead of their painting.
 *
 * The Market falls back to the row's emoji glyph when `artFor` returns null,
 * which is a supported state — it is how every shelf looked before the library
 * was wired. What is *not* supported is that state being invisible, which is
 * why `art.spec.ts` fails on any unpainted row that is not named here.
 *
 * This is deliberately not an alias. Pointing a Thrall at the Apprentice
 * Striker's painting would make the coverage test pass while putting the
 * Automaton shelf's artwork on a different shelf's row — a silent lie that
 * nobody would ever be prompted to correct, because the gate would be green.
 * An entry here is a debt with a name on it. It stops exempting anything the
 * moment its painting is imported (see "How a painting lands" below), so a
 * stale line can never hide an unpainted row behind a painted one.
 *
 * Keep it short, and delete from it rather than adding.
 *
 * HOW A PAINTING LANDS. `artFor()` never reads this list — it only reads the
 * manifest — so the moment `scripts/import-assets.py` writes a manifest entry
 * for one of these ids, the placeholder is gone with no code change. The live
 * set below also drops any declared id that now has art, so a landed painting
 * cannot leave a row exempted from the coverage gate it no longer needs, and
 * `art.spec.ts` stays green on the import commit. The importer then prints the
 * literal lines that have become stale; deleting them is housekeeping, not a
 * step the art waits on. The paintings themselves are briefed, one per id, in
 * `docs/art-commissions/` — `import-assets.py --commissions` lists what is
 * still missing from the library.
 *
 *   thrall-*      the five Forge Thrall tiers and the shift-length upgrade,
 *                 shipped in v2.68.0. Nothing in `Assets/Characters` depicts a
 *                 bound worker at the anvil; this needs a new painting rather
 *                 than a crop of an existing one.
 *   unique-*      twenty-three of the forty-four named objects in
 *                 unique-items.ts. Each one is a specific thing with a history,
 *                 so each needs its own painting — aliasing "Goldmouth" onto the
 *                 Eclipse Longblade's render would put a generic blade on the
 *                 rarest weapon in the game and the gate would go green on the
 *                 lie. They fall back to the rarity orb until the library has
 *                 them.
 *
 *                 They are written out one per line rather than spread from
 *                 `UNIQUE_ITEMS`, which is what this list used to do. The Art
 *                 Bible drop painted twenty-one of them, and a spread would have
 *                 quietly carried all forty-four back in — the debt list would
 *                 have grown by the exact number of paintings that had just
 *                 arrived, and `art.spec.ts` would have had nothing to fail on.
 *                 Deleting a line here is how a paid debt is
 *                 written off.
 *   npc-*         the six speaking characters, shipped in the NPC dialogue
 *                 release. `Assets/Characters` holds Keeper avatars and
 *                 portraits only — nothing there depicts Aureth, Verrin, Kael,
 *                 the Archivist, the Merchant or the Nameless, and cropping a
 *                 neutral Keeper portrait onto a goddess would be exactly the
 *                 green-on-a-lie this list exists to prevent. They render as a
 *                 monogrammed orb in the character's accent until the six
 *                 portraits are painted.
 *   explorer-*    the eighteen named explorers, shipped with the roster
 *                 redesign. `Assets/Characters` holds Keeper avatars only, and
 *                 an explorer is not a Keeper — cropping the player's own
 *                 portrait onto Whisper of Nox would be exactly the green-on-a-
 *                 lie this list exists to prevent. They render as the rarity
 *                 orb with a level badge until the eighteen are painted.
 */
export const ART_PENDING_DECLARED: readonly string[] = [
  'thrall-common',
  'thrall-uncommon',
  'thrall-rare',
  'thrall-epic',
  'thrall-legendary',
  'thrall-slot',
  'unique-tinders-due',
  'unique-lantern-oath',
  'unique-ashfall-wrap',
  'unique-copper-witness',
  'unique-cinderwake',
  'unique-stillglass-cowl',
  'unique-thornroot-greaves',
  'unique-tally-of-hands',
  'unique-mourners-ledger',
  'unique-first-light-pendant',
  'unique-anvil-of-small-hours',
  'unique-quiet-cuirass',
  'unique-hollowmark',
  'unique-verdant-accord',
  'unique-crown-of-borrowed-noon',
  'unique-lastwarden',
  'unique-goldmouth',
  'unique-cartographers-regret',
  'unique-long-account',
  'unique-heartwood-of-the-verge',
  'unique-mirror-of-small-mercies',
  'unique-the-unstruck-hour',
  'unique-keepers-second-name',
  ...NPCS.map(n => n.artId),
  ...EXPLORER_ARCHETYPES.map(a => a.artId),
];

/** The declared debt minus whatever has been painted since. See above. */
export const ART_PENDING: ReadonlySet<string> = new Set(
  ART_PENDING_DECLARED.filter(id => !hasArt(id)),
);

/** Painted art for a catalogue id, or null when nothing has been painted. */
export function artFor(id: string | undefined | null): ArtEntry | null {
  if (!id) return null;
  return ART_ALL[ART_ALIAS[id] ?? id] ?? null;
}

/** True when `id` has art. Cheaper to read than `!!artFor(id)` at a call site. */
export function hasArt(id: string | undefined | null): boolean {
  return artFor(id) !== null;
}

// ── Keeper identity, realm emblems, Guild marks ─────────────────────────────
//
// The manifest names these after the library file (`celestial-keeper-avatar`,
// `infernal-crest`), so without this every caller would rebuild the key with a
// template literal — which is how a typo becomes a silent null, and how a key
// drops out of any grep for "which art is actually requested". They are
// written out once here, as literals.

/** The five realms the Keeper variants, crests and tokens are painted for. */
export type ArtRealm = 'celestial' | 'infernal' | 'luminous' | 'umbral' | 'verdant';

export const ART_REALMS: readonly ArtRealm[] = ['celestial', 'infernal', 'luminous', 'umbral', 'verdant'];

/**
 * Per-realm art keys. The avatar is the same masked Keeper in that realm's trim
 * (the Keeper identity roadmap: realm variants change light and mantle, never
 * the silhouette); the crest is the realm's affiliation anchor; the token is
 * the realm's own coin.
 */
export const REALM_ART: Readonly<Record<ArtRealm, { avatar: string; crest: string; token: string }>> = {
  celestial: { avatar: 'celestial-keeper-avatar', crest: 'celestial-crest', token: 'celestial-token' },
  infernal:  { avatar: 'infernal-keeper-avatar',  crest: 'infernal-crest',  token: 'infernal-token' },
  luminous:  { avatar: 'luminous-keeper-avatar',  crest: 'luminous-crest',  token: 'luminous-token' },
  umbral:    { avatar: 'umbral-keeper-avatar',    crest: 'umbral-crest',    token: 'umbral-token' },
  verdant:   { avatar: 'verdant-keeper-avatar',   crest: 'verdant-crest',   token: 'verdant-token' },
};

/**
 * The player's own avatar. Neutral, because nothing in the save records a
 * realm alignment, and the composition spec reserves the realm variants for an
 * *opted-in* affiliation. When an alignment choice exists, pass it to
 * `keeperAvatarArt` instead of reaching for these.
 */
export const KEEPER_AVATAR = 'neutral-keeper-avatar';
export const KEEPER_PORTRAIT = 'neutral-keeper-portrait';

/** Avatar art for a realm, or the neutral Keeper when no realm is given. */
export function keeperAvatarArt(realm?: ArtRealm | null): ArtEntry | null {
  return artFor(realm ? REALM_ART[realm].avatar : KEEPER_AVATAR);
}

/**
 * Guild rank marks, lowest first, and the three banners. There is no Guild
 * surface in the game yet, so nothing renders these; they are named here so
 * the first one does not have to rediscover the filenames. The composition
 * spec governs use: one rank mark beside the name, never over the avatar; a
 * banner only as a shallow header texture.
 */
export const GUILD_RANK_ART = ['initiate', 'warden', 'keeper', 'archon', 'master', 'founder'] as const;
export const GUILD_BANNER_ART = ['obsidian-pennant', 'gold-standard', 'eclipse-banner'] as const;
