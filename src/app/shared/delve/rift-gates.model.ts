/**
 * rift-gates.model.ts — the Rift Gates: the Delve's doors to the other four
 * realms' undersides (owner, 2026-10-14: "inside the delves portals to other
 * realms"; "the realms are like deeper delves or crazy"). Pure: no Angular, no
 * storage. Lore: lore-addendum.md, "The Rift Gates" (shipped — owner reviews in
 * play). Spec for the three still settling: docs/handoff/rift-gates.md.
 *
 * Canon (docs/world/delve-and-beyond.md §1.2, §2.3): a gate does not open on a
 * sixth realm, nor on the Void. Each one opens on the UNDERSIDE of one of the
 * four other realms, the way the Ember Delve is the Infernal realm's: the rock
 * under that realm's towns, which the Echo regions (§2.3) only colour from a
 * distance. The gates stand where an Echo's colour will begin, one per realm,
 * in a fixed lattice cell of the endless Delve, so every seed has all four.
 *
 * Open today: the Umbral (the Ink Deeps), the Verdant (the Root Deeps) and the
 * Luminous (the Prism Mines); the Celestial gate is still settling.
 *
 * Every realm Delve is a STEP UP, not a side room: its gate sits deeper than
 * the strata a Keeper reaches before it (the Umbral gate is in the Underhearth
 * and its sigil needs Pickaxe IV), its creatures are tougher and its rewards
 * sit higher on the curve, and it breaks one rule of the normal Delve (the
 * Umbral's: the dark is unreliable — unlit passages shift, the ink tide rises
 * and falls, shades move only where no light is). Every broken rule is said
 * once, plainly, the first time it applies.
 *
 * A realm Delve is its own world: its own seed (from the player's, so it is
 * theirs), its own region slots in the cloud (`godforge-rift-<realm>-r0..3`,
 * merged like the main Delve's), its own core cells in the Delve index under
 * its area id. Flags live in the Delve save's `claimed`, never renamed.
 */

/** The four realms whose undersides the gates open on. */
export type RiftRealm = 'umbral' | 'luminous' | 'celestial' | 'verdant';
export const RIFT_REALMS: readonly RiftRealm[] = ['umbral', 'luminous', 'celestial', 'verdant'];

/**
 * Where a realm's gate stands in the Ember Delve: one lattice cell (LATTICE ×
 * SECTOR = 64 columns) of one stratum. `deep` puts it in the Underhearth's
 * upper band (underhearth-gen.ts BAND_A), else `stratum` is the shipped
 * stratum index (0 Root Hollows … 3 Magma Halls). The cells avoid the ones the
 * golden-hash tests pin and the Four's outposts.
 */
export interface GatePlace { cell: number; stratum: 0 | 1 | 2 | 3 | 'deep' }

export interface RiftGateDef {
  realm: RiftRealm;
  /** The realm's display name (EN; the UI reads `play.rift.realm.<realm>`). */
  name: string;
  /** The underside's own name (EN; `play.rift.world.<realm>`). */
  world: string;
  /** True when this realm's Delve has shipped; a settling gate shows, glows and says so, and opens on nothing yet. */
  open: boolean;
  /** The terrain node of the gate's opening (one per realm: its light is the realm's colour). */
  node: string;
  /** The Realm Sigil that attunes it (a satchel stack, consumed once). */
  sigil: string;
  /** The realm material the sigil is made with (an expedition / Vault material). */
  realmMaterial: string;
  /** The area id of the realm's Delve (a hunt of the Infernal town), once it exists. */
  area: string | null;
  /** Delving level the gate holds for (a step up from the strata before it). */
  delving: number;
  place: GatePlace;
  /** The realm's colour (the gate's light, the map marker). */
  color: string;
  /** The one rule of the normal Delve its underside breaks (the spec's line; EN). */
  brokenRule: string;
}

export const RIFT_GATES: Readonly<Record<RiftRealm, RiftGateDef>> = {
  umbral: {
    realm: 'umbral', name: 'Umbral', world: 'the Ink Deeps', open: true,
    node: 'rift-gate-umbral', sigil: 'umbral-sigil', realmMaterial: 'umbral-ink', area: 'umbral-delve',
    delving: 20, place: { cell: -4, stratum: 'deep' }, color: '#a48bff',
    brokenRule: 'The dark is unreliable: unlit passages shift when you look away, the ink tide rises and falls, shades move only where no light is.',
  },
  luminous: {
    realm: 'luminous', name: 'Luminous', world: 'the Prism Mines', open: true,
    node: 'rift-gate-luminous', sigil: 'luminous-sigil', realmMaterial: 'luminous-prism', area: 'luminous-delve',
    delving: 28, place: { cell: 4, stratum: 2 }, color: '#ffe9a8',
    brokenRule: 'Light is solid: a beam across open air is a bridge, a beam down is a ladder, mirrors turn them, and shadow glass is a hole until light falls on it.',
  },
  celestial: {
    realm: 'celestial', name: 'Celestial', world: 'the Star-Wells', open: false,
    node: 'rift-gate-celestial', sigil: 'celestial-sigil', realmMaterial: 'celestial-alloy', area: null,
    delving: 36, place: { cell: 6, stratum: 3 }, color: '#5fb6ff',
    brokenRule: 'Down is negotiable: gravity turns with the hour, and every well has its own.',
  },
  verdant: {
    realm: 'verdant', name: 'Verdant', world: 'the Root Deeps', open: true,
    node: 'rift-gate-verdant', sigil: 'verdant-sigil', realmMaterial: 'verdant-sap', area: 'verdant-delve',
    delving: 32, place: { cell: -2, stratum: 0 }, color: '#7fd5a3',
    brokenRule: 'Dug rock grows back while you watch: tunnels close behind you unless fire burns the roots, a billhook cuts them clean, or a support holds them.',
  },
};

export function riftGate(realm: string): RiftGateDef | null {
  return (RIFT_GATES as Record<string, RiftGateDef | undefined>)[realm] ?? null;
}
/** The realm a gate node opens on (`rift-gate-umbral` → umbral), or null. */
export function realmOfGateNode(nodeId: string): RiftRealm | null {
  const realm = nodeId.startsWith(GATE_NODE_PREFIX) ? nodeId.slice(GATE_NODE_PREFIX.length) : '';
  return (RIFT_REALMS as readonly string[]).includes(realm) ? realm as RiftRealm : null;
}
export const GATE_NODE_PREFIX = 'rift-gate-';
/** The realm whose Delve an area is (`umbral-delve` → umbral), or null for the Ember Delve and every other area. */
export function realmOfArea(areaId: string): RiftRealm | null {
  for (const realm of RIFT_REALMS) if (RIFT_GATES[realm].area === areaId) return realm;
  return null;
}
/** The gate whose lattice cell and stratum this is, or null. */
export function gateAt(cell: number, stratum: GatePlace['stratum']): RiftGateDef | null {
  for (const realm of RIFT_REALMS) {
    const def = RIFT_GATES[realm];
    if (def.place.cell === cell && def.place.stratum === stratum) return def;
  }
  return null;
}

// ── Once-per-player flags (the Delve save's `claimed`) ──────────────────────

/** First sighting of a gate (a little Delving XP, once; Glim's line). */
export const seenFlag = (realm: RiftRealm) => `rift-seen:${realm}`;
/** The gate took its sigil: it stays open for this player. */
export const attunedFlag = (realm: RiftRealm) => `rift-attuned:${realm}`;
/** The Keeper has stood in the realm's Delve (a mission objective, `reach`). */
export const enteredFlag = (realm: RiftRealm) => `rift-entered:${realm}`;
/** A broken rule said once (`rift-rule:umbral:shift`): the telegraph, never repeated. */
export const ruleFlag = (realm: RiftRealm, rule: string) => `rift-rule:${realm}:${rule}`;

/** Delving XP for a gate's first sighting, and for first stepping through. */
export const GATE_SEEN_XP = 25;
export const GATE_ENTER_XP = 120;

// ── Attuning ────────────────────────────────────────────────────────────────

export type AttuneCheck =
  /** The realm's Delve has not shipped: "the rift is still settling". */
  | { ok: false; why: 'settling' }
  | { ok: false; why: 'delving'; need: number }
  | { ok: false; why: 'sigil'; sigil: string }
  /** Open: already attuned (step through), or attune now (the sigil is spent). */
  | { ok: true; attune: boolean };

/** What E at a gate does. Pure: the host hands in the ledgers. */
export function attuneCheck(realm: RiftRealm, ledger: { delving: number; sigils: number; attuned: boolean }): AttuneCheck {
  const def = RIFT_GATES[realm];
  if (!def.open || !def.area) return { ok: false, why: 'settling' };
  if (ledger.attuned) return { ok: true, attune: false };
  if (ledger.delving < def.delving) return { ok: false, why: 'delving', need: def.delving };
  if (ledger.sigils < 1) return { ok: false, why: 'sigil', sigil: def.sigil };
  return { ok: true, attune: true };
}

// ── The realm's own world ───────────────────────────────────────────────────

/** A realm Delve's seed, from the player's Delve seed: theirs, stable, and unlike the Ember Delve's. */
export function realmSeed(seed: number, realm: RiftRealm): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < realm.length; i++) h = Math.imul(h ^ realm.charCodeAt(i), 0x01000193) >>> 0;
  // murmur3's finaliser, so neighbouring seeds land far apart.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}

/** Cloud region slots per realm Delve (fewer than the Ember Delve's 16: a realm is a step out, not a home). */
export const RIFT_SLOTS = 4;
/** The realm's slot blob keys (`godforge-rift-umbral-r0..3` → `progress/rift-umbral-r0..3`). Every realm's exist now, so a new realm only adds content. */
export function riftSlotKeys(realm: RiftRealm): readonly string[] {
  return Array.from({ length: RIFT_SLOTS }, (_, n) => `godforge-rift-${realm}-r${n}`);
}
export const RIFT_SLOT_KEYS: readonly string[] = RIFT_REALMS.flatMap(realm => riftSlotKeys(realm));

/** Where the Keeper steps out on the realm side: the return gate in the realm Delve's core (realm-gen.ts lays it). */
export const REALM_ARRIVAL = { col: 35, row: 30 } as const;

// ── Satchel stacks (never rename: they are in players' saves) ──────────────

/** Rift splinters: cut from a gate's frame (Pickaxe IV); every Realm Sigil is framed with them. */
export const RIFT_SPLINTER = 'rift-splinter';
/** The Umbral Sigil: four rift splinters, Umbral Ink and an emberheart core. Spent once, at the Umbral gate. */
export const UMBRAL_SIGIL = 'umbral-sigil';
/** The Ink Deeps' two ores: Inkstone (the ink ore) and Nightglass. */
export const INKSTONE = 'inkstone';
export const NIGHTGLASS = 'nightglass';
/** The Veil Lantern: carried, the lantern reaches further in the Ink Deeps' gloom and keeps some light under ink. */
export const VEIL_LANTERN = 'veil-lantern';
/** The Verdant Sigil and the Root Deeps' ores: Rootglass and Heart-amber. */
export const VERDANT_SIGIL = 'verdant-sigil';
export const ROOTGLASS = 'rootglass';
export const HEART_AMBER = 'heart-amber';
/** The Rootsever Billhook: carried in the Root Deeps, what you dig is cut at the root and does not grow back. */
export const ROOTSEVER_BILLHOOK = 'rootsever-billhook';
/** The Luminous Sigil and the Prism Mines' ores: Prismite and Dawnglass. */
export const LUMINOUS_SIGIL = 'luminous-sigil';
export const PRISMITE = 'prismite';
export const DAWNGLASS = 'dawnglass';
/** The Dawn Lens: carried in the Prism Mines, your own lantern lights shadow glass under and round you (a floor you carry). */
export const DAWN_LENS = 'dawn-lens';
