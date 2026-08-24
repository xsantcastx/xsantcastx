/**
 * art-manifest.generated.ts — DO NOT EDIT BY HAND.
 *
 * Written by `scripts/import-assets.py` from the approved asset library.
 * Re-run that script after adding art; do not hand-add entries here.
 *
 * Keys are the catalogue id with the painter's two-digit prefix stripped, so
 * `01-eclipse-longblade.png` is reachable as `eclipse-longblade` — the same id
 * `ITEM_DEFINITIONS` uses. Each entry carries a srcset so a 64px bag tile does
 * not download a 512px master.
 *
 * Pure data, no browser APIs, safe to import from an SSR path.
 */

export interface ArtEntry {
  /** Smallest variant — a sensible `src` for a tile. */
  src: string;
  /** Full ladder for `srcset`, widths ascending. */
  srcset: string;
  width: number;
  height: number;
}


export const ART_CHARACTERS: Readonly<Record<string, ArtEntry>> = {
  'keeper-base': { src: 'assets/game/characters/01-keeper-base-512.webp', srcset: 'assets/game/characters/01-keeper-base-512.webp 512w, assets/game/characters/01-keeper-base-1024.webp 1024w', width: 512, height: 512 },
};

export const ART_CHARACTERS_AVATARS: Readonly<Record<string, ArtEntry>> = {
  'celestial-keeper-avatar': { src: 'assets/game/characters/avatars/02-celestial-keeper-avatar-512.webp', srcset: 'assets/game/characters/avatars/02-celestial-keeper-avatar-512.webp 512w, assets/game/characters/avatars/02-celestial-keeper-avatar-1024.webp 1024w', width: 512, height: 512 },
  'infernal-keeper-avatar': { src: 'assets/game/characters/avatars/03-infernal-keeper-avatar-512.webp', srcset: 'assets/game/characters/avatars/03-infernal-keeper-avatar-512.webp 512w, assets/game/characters/avatars/03-infernal-keeper-avatar-1024.webp 1024w', width: 512, height: 512 },
  'luminous-keeper-avatar': { src: 'assets/game/characters/avatars/04-luminous-keeper-avatar-512.webp', srcset: 'assets/game/characters/avatars/04-luminous-keeper-avatar-512.webp 512w, assets/game/characters/avatars/04-luminous-keeper-avatar-1024.webp 1024w', width: 512, height: 512 },
  'neutral-keeper-avatar': { src: 'assets/game/characters/avatars/01-neutral-keeper-avatar-512.webp', srcset: 'assets/game/characters/avatars/01-neutral-keeper-avatar-512.webp 512w, assets/game/characters/avatars/01-neutral-keeper-avatar-1024.webp 1024w', width: 512, height: 512 },
  'umbral-keeper-avatar': { src: 'assets/game/characters/avatars/05-umbral-keeper-avatar-512.webp', srcset: 'assets/game/characters/avatars/05-umbral-keeper-avatar-512.webp 512w, assets/game/characters/avatars/05-umbral-keeper-avatar-1024.webp 1024w', width: 512, height: 512 },
  'verdant-keeper-avatar': { src: 'assets/game/characters/avatars/06-verdant-keeper-avatar-512.webp', srcset: 'assets/game/characters/avatars/06-verdant-keeper-avatar-512.webp 512w, assets/game/characters/avatars/06-verdant-keeper-avatar-1024.webp 1024w', width: 512, height: 512 },
};

export const ART_CHARACTERS_PORTRAITS: Readonly<Record<string, ArtEntry>> = {
  'neutral-keeper-portrait': { src: 'assets/game/characters/portraits/01-neutral-keeper-portrait-512.webp', srcset: 'assets/game/characters/portraits/01-neutral-keeper-portrait-512.webp 512w, assets/game/characters/portraits/01-neutral-keeper-portrait-1024.webp 1024w', width: 512, height: 512 },
};

export const ART_CREATURES: Readonly<Record<string, ArtEntry>> = {
  'ephemeris-leech': { src: 'assets/game/creatures/02-ephemeris-leech-96.webp', srcset: 'assets/game/creatures/02-ephemeris-leech-96.webp 96w, assets/game/creatures/02-ephemeris-leech-256.webp 256w', width: 96, height: 96 },
  'mirror-substitute': { src: 'assets/game/creatures/04-mirror-substitute-96.webp', srcset: 'assets/game/creatures/04-mirror-substitute-96.webp 96w, assets/game/creatures/04-mirror-substitute-256.webp 256w', width: 96, height: 96 },
  'prism-forager': { src: 'assets/game/creatures/01-prism-forager-96.webp', srcset: 'assets/game/creatures/01-prism-forager-96.webp 96w, assets/game/creatures/01-prism-forager-256.webp 256w', width: 96, height: 96 },
  'rivet-maw': { src: 'assets/game/creatures/03-rivet-maw-96.webp', srcset: 'assets/game/creatures/03-rivet-maw-96.webp 96w, assets/game/creatures/03-rivet-maw-256.webp 256w', width: 96, height: 96 },
  'rootglass-stag': { src: 'assets/game/creatures/05-rootglass-stag-96.webp', srcset: 'assets/game/creatures/05-rootglass-stag-96.webp 96w, assets/game/creatures/05-rootglass-stag-256.webp 256w', width: 96, height: 96 },
};

export const ART_CURRENCIES: Readonly<Record<string, ArtEntry>> = {
  'aether': { src: 'assets/game/currencies/aether-96.webp', srcset: 'assets/game/currencies/aether-96.webp 96w, assets/game/currencies/aether-256.webp 256w', width: 96, height: 96 },
  'essence': { src: 'assets/game/currencies/essence-96.webp', srcset: 'assets/game/currencies/essence-96.webp 96w, assets/game/currencies/essence-256.webp 256w', width: 96, height: 96 },
  'gold': { src: 'assets/game/currencies/gold-96.webp', srcset: 'assets/game/currencies/gold-96.webp 96w, assets/game/currencies/gold-256.webp 256w', width: 96, height: 96 },
  'relic-dust': { src: 'assets/game/currencies/relic-dust-96.webp', srcset: 'assets/game/currencies/relic-dust-96.webp 96w, assets/game/currencies/relic-dust-256.webp 256w', width: 96, height: 96 },
};

export const ART_CURRENCIES_REALM_TOKENS: Readonly<Record<string, ArtEntry>> = {
  'celestial-token': { src: 'assets/game/currencies/realm-tokens/celestial-token-96.webp', srcset: 'assets/game/currencies/realm-tokens/celestial-token-96.webp 96w, assets/game/currencies/realm-tokens/celestial-token-256.webp 256w', width: 96, height: 96 },
  'infernal-token': { src: 'assets/game/currencies/realm-tokens/infernal-token-96.webp', srcset: 'assets/game/currencies/realm-tokens/infernal-token-96.webp 96w, assets/game/currencies/realm-tokens/infernal-token-256.webp 256w', width: 96, height: 96 },
  'luminous-token': { src: 'assets/game/currencies/realm-tokens/luminous-token-96.webp', srcset: 'assets/game/currencies/realm-tokens/luminous-token-96.webp 96w, assets/game/currencies/realm-tokens/luminous-token-256.webp 256w', width: 96, height: 96 },
  'umbral-token': { src: 'assets/game/currencies/realm-tokens/umbral-token-96.webp', srcset: 'assets/game/currencies/realm-tokens/umbral-token-96.webp 96w, assets/game/currencies/realm-tokens/umbral-token-256.webp 256w', width: 96, height: 96 },
  'verdant-token': { src: 'assets/game/currencies/realm-tokens/verdant-token-96.webp', srcset: 'assets/game/currencies/realm-tokens/verdant-token-96.webp 96w, assets/game/currencies/realm-tokens/verdant-token-256.webp 256w', width: 96, height: 96 },
};

export const ART_EFFECTS_FORGE: Readonly<Record<string, ArtEntry>> = {
  'crafting-burst': { src: 'assets/game/effects/forge/03-crafting-burst-96.webp', srcset: 'assets/game/effects/forge/03-crafting-burst-96.webp 96w, assets/game/effects/forge/03-crafting-burst-256.webp 256w', width: 96, height: 96 },
  'eclipse-summoning-sigil': { src: 'assets/game/effects/forge/04-eclipse-summoning-sigil-96.webp', srcset: 'assets/game/effects/forge/04-eclipse-summoning-sigil-96.webp 96w, assets/game/effects/forge/04-eclipse-summoning-sigil-256.webp 256w', width: 96, height: 96 },
  'ember-particle-field': { src: 'assets/game/effects/forge/02-ember-particle-field-96.webp', srcset: 'assets/game/effects/forge/02-ember-particle-field-96.webp 96w, assets/game/effects/forge/02-ember-particle-field-256.webp 256w', width: 96, height: 96 },
  'enhancement-aura': { src: 'assets/game/effects/forge/05-enhancement-aura-96.webp', srcset: 'assets/game/effects/forge/05-enhancement-aura-96.webp 96w, assets/game/effects/forge/05-enhancement-aura-256.webp 256w', width: 96, height: 96 },
  'forge-heat-shimmer': { src: 'assets/game/effects/forge/06-forge-heat-shimmer-96.webp', srcset: 'assets/game/effects/forge/06-forge-heat-shimmer-96.webp 96w, assets/game/effects/forge/06-forge-heat-shimmer-256.webp 256w', width: 96, height: 96 },
  'violet-forge-flame': { src: 'assets/game/effects/forge/01-violet-forge-flame-96.webp', srcset: 'assets/game/effects/forge/01-violet-forge-flame-96.webp 96w, assets/game/effects/forge/01-violet-forge-flame-256.webp 256w', width: 96, height: 96 },
};

export const ART_EFFECTS_RIFTS: Readonly<Record<string, ArtEntry>> = {
  'rift-portal-core': { src: 'assets/game/effects/rifts/01-rift-portal-core-96.webp', srcset: 'assets/game/effects/rifts/01-rift-portal-core-96.webp 96w, assets/game/effects/rifts/01-rift-portal-core-256.webp 256w', width: 96, height: 96 },
  'void-smoke': { src: 'assets/game/effects/rifts/02-void-smoke-96.webp', srcset: 'assets/game/effects/rifts/02-void-smoke-96.webp 96w, assets/game/effects/rifts/02-void-smoke-256.webp 256w', width: 96, height: 96 },
};

export const ART_GUILD_BANNERS: Readonly<Record<string, ArtEntry>> = {
  'eclipse-banner': { src: 'assets/game/guild/banners/03-eclipse-banner-96.webp', srcset: 'assets/game/guild/banners/03-eclipse-banner-96.webp 96w, assets/game/guild/banners/03-eclipse-banner-256.webp 256w', width: 96, height: 96 },
  'gold-standard': { src: 'assets/game/guild/banners/02-gold-standard-96.webp', srcset: 'assets/game/guild/banners/02-gold-standard-96.webp 96w, assets/game/guild/banners/02-gold-standard-256.webp 256w', width: 96, height: 96 },
  'obsidian-pennant': { src: 'assets/game/guild/banners/01-obsidian-pennant-96.webp', srcset: 'assets/game/guild/banners/01-obsidian-pennant-96.webp 96w, assets/game/guild/banners/01-obsidian-pennant-256.webp 256w', width: 96, height: 96 },
};

export const ART_GUILD_CRESTS: Readonly<Record<string, ArtEntry>> = {
  'celestial-crest': { src: 'assets/game/guild/crests/01-celestial-crest-96.webp', srcset: 'assets/game/guild/crests/01-celestial-crest-96.webp 96w, assets/game/guild/crests/01-celestial-crest-256.webp 256w', width: 96, height: 96 },
  'infernal-crest': { src: 'assets/game/guild/crests/02-infernal-crest-96.webp', srcset: 'assets/game/guild/crests/02-infernal-crest-96.webp 96w, assets/game/guild/crests/02-infernal-crest-256.webp 256w', width: 96, height: 96 },
  'luminous-crest': { src: 'assets/game/guild/crests/03-luminous-crest-96.webp', srcset: 'assets/game/guild/crests/03-luminous-crest-96.webp 96w, assets/game/guild/crests/03-luminous-crest-256.webp 256w', width: 96, height: 96 },
  'umbral-crest': { src: 'assets/game/guild/crests/04-umbral-crest-96.webp', srcset: 'assets/game/guild/crests/04-umbral-crest-96.webp 96w, assets/game/guild/crests/04-umbral-crest-256.webp 256w', width: 96, height: 96 },
  'verdant-crest': { src: 'assets/game/guild/crests/05-verdant-crest-96.webp', srcset: 'assets/game/guild/crests/05-verdant-crest-96.webp 96w, assets/game/guild/crests/05-verdant-crest-256.webp 256w', width: 96, height: 96 },
};

export const ART_GUILD_RANKS: Readonly<Record<string, ArtEntry>> = {
  'archon': { src: 'assets/game/guild/ranks/04-archon-96.webp', srcset: 'assets/game/guild/ranks/04-archon-96.webp 96w, assets/game/guild/ranks/04-archon-256.webp 256w', width: 96, height: 96 },
  'founder': { src: 'assets/game/guild/ranks/06-founder-96.webp', srcset: 'assets/game/guild/ranks/06-founder-96.webp 96w, assets/game/guild/ranks/06-founder-256.webp 256w', width: 96, height: 96 },
  'initiate': { src: 'assets/game/guild/ranks/01-initiate-96.webp', srcset: 'assets/game/guild/ranks/01-initiate-96.webp 96w, assets/game/guild/ranks/01-initiate-256.webp 256w', width: 96, height: 96 },
  'keeper': { src: 'assets/game/guild/ranks/03-keeper-96.webp', srcset: 'assets/game/guild/ranks/03-keeper-96.webp 96w, assets/game/guild/ranks/03-keeper-256.webp 256w', width: 96, height: 96 },
  'master': { src: 'assets/game/guild/ranks/05-master-96.webp', srcset: 'assets/game/guild/ranks/05-master-96.webp 96w, assets/game/guild/ranks/05-master-256.webp 256w', width: 96, height: 96 },
  'warden': { src: 'assets/game/guild/ranks/02-warden-96.webp', srcset: 'assets/game/guild/ranks/02-warden-96.webp 96w, assets/game/guild/ranks/02-warden-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_ARTBIBLE_ACCESSORIES: Readonly<Record<string, ArtEntry>> = {
  'aurumleaf-pendant': { src: 'assets/game/items/artbible/accessories/031-aurumleaf-pendant-idle-96.webp', srcset: 'assets/game/items/artbible/accessories/031-aurumleaf-pendant-idle-96.webp 96w, assets/game/items/artbible/accessories/031-aurumleaf-pendant-idle-256.webp 256w', width: 96, height: 96 },
  'coinspinners-ring': { src: 'assets/game/items/artbible/accessories/032-coinspinners-ring-idle-96.webp', srcset: 'assets/game/items/artbible/accessories/032-coinspinners-ring-idle-96.webp 96w, assets/game/items/artbible/accessories/032-coinspinners-ring-idle-256.webp 256w', width: 96, height: 96 },
  'dewdrop-purse': { src: 'assets/game/items/artbible/accessories/034-dewdrop-purse-idle-96.webp', srcset: 'assets/game/items/artbible/accessories/034-dewdrop-purse-idle-96.webp 96w, assets/game/items/artbible/accessories/034-dewdrop-purse-idle-256.webp 256w', width: 96, height: 96 },
  'phantom-toll': { src: 'assets/game/items/artbible/accessories/035-phantom-toll-idle-96.webp', srcset: 'assets/game/items/artbible/accessories/035-phantom-toll-idle-96.webp 96w, assets/game/items/artbible/accessories/035-phantom-toll-idle-256.webp 256w', width: 96, height: 96 },
  'tithe-of-ash': { src: 'assets/game/items/artbible/accessories/033-tithe-of-ash-idle-96.webp', srcset: 'assets/game/items/artbible/accessories/033-tithe-of-ash-idle-96.webp 96w, assets/game/items/artbible/accessories/033-tithe-of-ash-idle-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_ARTBIBLE_ARMOR: Readonly<Record<string, ArtEntry>> = {
  'abyssal-aegis': { src: 'assets/game/items/artbible/armor/022-abyssal-aegis-idle-96.webp', srcset: 'assets/game/items/artbible/armor/022-abyssal-aegis-idle-96.webp 96w, assets/game/items/artbible/armor/022-abyssal-aegis-idle-256.webp 256w', width: 96, height: 96 },
  'astral-striders': { src: 'assets/game/items/artbible/armor/028-astral-striders-idle-96.webp', srcset: 'assets/game/items/artbible/armor/028-astral-striders-idle-96.webp 96w, assets/game/items/artbible/armor/028-astral-striders-idle-256.webp 256w', width: 96, height: 96 },
  'blazebraid-belt': { src: 'assets/game/items/artbible/armor/029-blazebraid-belt-idle-96.webp', srcset: 'assets/game/items/artbible/armor/029-blazebraid-belt-idle-96.webp 96w, assets/game/items/artbible/armor/029-blazebraid-belt-idle-256.webp 256w', width: 96, height: 96 },
  'cinderhide-coat': { src: 'assets/game/items/artbible/armor/024-cinderhide-coat-idle-96.webp', srcset: 'assets/game/items/artbible/armor/024-cinderhide-coat-idle-96.webp 96w, assets/game/items/artbible/armor/024-cinderhide-coat-idle-256.webp 256w', width: 96, height: 96 },
  'cometfall-helm': { src: 'assets/game/items/artbible/armor/023-cometfall-helm-idle-96.webp', srcset: 'assets/game/items/artbible/armor/023-cometfall-helm-idle-96.webp 96w, assets/game/items/artbible/armor/023-cometfall-helm-idle-256.webp 256w', width: 96, height: 96 },
  'crown-of-the-first-dawn': { src: 'assets/game/items/artbible/armor/016-crown-of-the-first-dawn-idle-96.webp', srcset: 'assets/game/items/artbible/armor/016-crown-of-the-first-dawn-idle-96.webp 96w, assets/game/items/artbible/armor/016-crown-of-the-first-dawn-idle-256.webp 256w', width: 96, height: 96 },
  'duskmail-hauberk': { src: 'assets/game/items/artbible/armor/026-duskmail-hauberk-idle-96.webp', srcset: 'assets/game/items/artbible/armor/026-duskmail-hauberk-idle-96.webp 96w, assets/game/items/artbible/armor/026-duskmail-hauberk-idle-256.webp 256w', width: 96, height: 96 },
  'ember-vambraces': { src: 'assets/game/items/artbible/armor/020-ember-vambraces-idle-96.webp', srcset: 'assets/game/items/artbible/armor/020-ember-vambraces-idle-96.webp 96w, assets/game/items/artbible/armor/020-ember-vambraces-idle-256.webp 256w', width: 96, height: 96 },
  'forgeborn-warhelm': { src: 'assets/game/items/artbible/armor/027-forgeborn-warhelm-idle-96.webp', srcset: 'assets/game/items/artbible/armor/027-forgeborn-warhelm-idle-96.webp 96w, assets/game/items/artbible/armor/027-forgeborn-warhelm-idle-256.webp 256w', width: 96, height: 96 },
  'luminous-aegis-mantle': { src: 'assets/game/items/artbible/armor/030-luminous-aegis-mantle-idle-96.webp', srcset: 'assets/game/items/artbible/armor/030-luminous-aegis-mantle-idle-96.webp 96w, assets/game/items/artbible/armor/030-luminous-aegis-mantle-idle-256.webp 256w', width: 96, height: 96 },
  'rootwall-shield': { src: 'assets/game/items/artbible/armor/025-rootwall-shield-idle-96.webp', srcset: 'assets/game/items/artbible/armor/025-rootwall-shield-idle-96.webp 96w, assets/game/items/artbible/armor/025-rootwall-shield-idle-256.webp 256w', width: 96, height: 96 },
  'solstice-greaves': { src: 'assets/game/items/artbible/armor/021-solstice-greaves-idle-96.webp', srcset: 'assets/game/items/artbible/armor/021-solstice-greaves-idle-96.webp 96w, assets/game/items/artbible/armor/021-solstice-greaves-idle-256.webp 256w', width: 96, height: 96 },
  'starplate-cuirass': { src: 'assets/game/items/artbible/armor/018-starplate-cuirass-idle-96.webp', srcset: 'assets/game/items/artbible/armor/018-starplate-cuirass-idle-96.webp 96w, assets/game/items/artbible/armor/018-starplate-cuirass-idle-256.webp 256w', width: 96, height: 96 },
  'thornmantle-pauldrons': { src: 'assets/game/items/artbible/armor/019-thornmantle-pauldrons-idle-96.webp', srcset: 'assets/game/items/artbible/armor/019-thornmantle-pauldrons-idle-96.webp 96w, assets/game/items/artbible/armor/019-thornmantle-pauldrons-idle-256.webp 256w', width: 96, height: 96 },
  'voidweave-cowl': { src: 'assets/game/items/artbible/armor/017-voidweave-cowl-idle-96.webp', srcset: 'assets/game/items/artbible/armor/017-voidweave-cowl-idle-96.webp 96w, assets/game/items/artbible/armor/017-voidweave-cowl-idle-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_ARTBIBLE_ARTIFACTS: Readonly<Record<string, ArtEntry>> = {
  'unique-architect-compass': { src: 'assets/game/items/artbible/artifacts/061-unique-architect-compass-idle-96.webp', srcset: 'assets/game/items/artbible/artifacts/061-unique-architect-compass-idle-96.webp 96w, assets/game/items/artbible/artifacts/061-unique-architect-compass-idle-256.webp 256w', width: 96, height: 96 },
  'unique-ashen-covenant': { src: 'assets/game/items/artbible/artifacts/070-unique-ashen-covenant-idle-96.webp', srcset: 'assets/game/items/artbible/artifacts/070-unique-ashen-covenant-idle-96.webp 96w, assets/game/items/artbible/artifacts/070-unique-ashen-covenant-idle-256.webp 256w', width: 96, height: 96 },
  'unique-eclipse-hourglass': { src: 'assets/game/items/artbible/artifacts/069-unique-eclipse-hourglass-idle-96.webp', srcset: 'assets/game/items/artbible/artifacts/069-unique-eclipse-hourglass-idle-96.webp 96w, assets/game/items/artbible/artifacts/069-unique-eclipse-hourglass-idle-256.webp 256w', width: 96, height: 96 },
  'unique-first-anvil-fragment': { src: 'assets/game/items/artbible/artifacts/063-unique-first-anvil-fragment-idle-96.webp', srcset: 'assets/game/items/artbible/artifacts/063-unique-first-anvil-fragment-idle-96.webp 96w, assets/game/items/artbible/artifacts/063-unique-first-anvil-fragment-idle-256.webp 256w', width: 96, height: 96 },
  'unique-heartstone-world-root': { src: 'assets/game/items/artbible/artifacts/062-unique-heartstone-world-root-idle-96.webp', srcset: 'assets/game/items/artbible/artifacts/062-unique-heartstone-world-root-idle-96.webp 96w, assets/game/items/artbible/artifacts/062-unique-heartstone-world-root-idle-256.webp 256w', width: 96, height: 96 },
  'unique-merchants-scale': { src: 'assets/game/items/artbible/artifacts/065-unique-merchants-scale-idle-96.webp', srcset: 'assets/game/items/artbible/artifacts/065-unique-merchants-scale-idle-96.webp 96w, assets/game/items/artbible/artifacts/065-unique-merchants-scale-idle-256.webp 256w', width: 96, height: 96 },
  'unique-mirror-meridians': { src: 'assets/game/items/artbible/artifacts/067-unique-mirror-meridians-idle-96.webp', srcset: 'assets/game/items/artbible/artifacts/067-unique-mirror-meridians-idle-96.webp 96w, assets/game/items/artbible/artifacts/067-unique-mirror-meridians-idle-256.webp 256w', width: 96, height: 96 },
  'unique-pyrograph-scroll-case': { src: 'assets/game/items/artbible/artifacts/066-unique-pyrograph-scroll-case-idle-96.webp', srcset: 'assets/game/items/artbible/artifacts/066-unique-pyrograph-scroll-case-idle-96.webp 96w, assets/game/items/artbible/artifacts/066-unique-pyrograph-scroll-case-idle-256.webp 256w', width: 96, height: 96 },
  'unique-shadowloom': { src: 'assets/game/items/artbible/artifacts/064-unique-shadowloom-idle-96.webp', srcset: 'assets/game/items/artbible/artifacts/064-unique-shadowloom-idle-96.webp 96w, assets/game/items/artbible/artifacts/064-unique-shadowloom-idle-256.webp 256w', width: 96, height: 96 },
  'unique-spore-crown': { src: 'assets/game/items/artbible/artifacts/068-unique-spore-crown-idle-96.webp', srcset: 'assets/game/items/artbible/artifacts/068-unique-spore-crown-idle-96.webp 96w, assets/game/items/artbible/artifacts/068-unique-spore-crown-idle-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_ARTBIBLE_CONSUMABLES: Readonly<Record<string, ArtEntry>> = {
  'astral-ink': { src: 'assets/game/items/artbible/consumables/077-astral-ink-idle-96.webp', srcset: 'assets/game/items/artbible/consumables/077-astral-ink-idle-96.webp 96w, assets/game/items/artbible/consumables/077-astral-ink-idle-256.webp 256w', width: 96, height: 96 },
  'eclipse-fragment-capsule': { src: 'assets/game/items/artbible/consumables/080-eclipse-fragment-capsule-idle-96.webp', srcset: 'assets/game/items/artbible/consumables/080-eclipse-fragment-capsule-idle-96.webp 96w, assets/game/items/artbible/consumables/080-eclipse-fragment-capsule-idle-256.webp 256w', width: 96, height: 96 },
  'embervial': { src: 'assets/game/items/artbible/consumables/075-embervial-idle-96.webp', srcset: 'assets/game/items/artbible/consumables/075-embervial-idle-96.webp 96w, assets/game/items/artbible/consumables/075-embervial-idle-256.webp 256w', width: 96, height: 96 },
  'forge-dust-sachet': { src: 'assets/game/items/artbible/consumables/079-forge-dust-sachet-idle-96.webp', srcset: 'assets/game/items/artbible/consumables/079-forge-dust-sachet-idle-96.webp 96w, assets/game/items/artbible/consumables/079-forge-dust-sachet-idle-256.webp 256w', width: 96, height: 96 },
  'liquid-dawn': { src: 'assets/game/items/artbible/consumables/071-liquid-dawn-idle-96.webp', srcset: 'assets/game/items/artbible/consumables/071-liquid-dawn-idle-96.webp 96w, assets/game/items/artbible/consumables/071-liquid-dawn-idle-256.webp 256w', width: 96, height: 96 },
  'phial-null': { src: 'assets/game/items/artbible/consumables/072-phial-null-idle-96.webp', srcset: 'assets/game/items/artbible/consumables/072-phial-null-idle-96.webp 96w, assets/game/items/artbible/consumables/072-phial-null-idle-256.webp 256w', width: 96, height: 96 },
  'rootsap-tincture': { src: 'assets/game/items/artbible/consumables/074-rootsap-tincture-idle-96.webp', srcset: 'assets/game/items/artbible/consumables/074-rootsap-tincture-idle-96.webp 96w, assets/game/items/artbible/consumables/074-rootsap-tincture-idle-256.webp 256w', width: 96, height: 96 },
  'scroll-shattering-memory': { src: 'assets/game/items/artbible/consumables/076-scroll-shattering-memory-idle-96.webp', srcset: 'assets/game/items/artbible/consumables/076-scroll-shattering-memory-idle-96.webp 96w, assets/game/items/artbible/consumables/076-scroll-shattering-memory-idle-256.webp 256w', width: 96, height: 96 },
  'starbloom-tea': { src: 'assets/game/items/artbible/consumables/073-starbloom-tea-idle-96.webp', srcset: 'assets/game/items/artbible/consumables/073-starbloom-tea-idle-96.webp 96w, assets/game/items/artbible/consumables/073-starbloom-tea-idle-256.webp 256w', width: 96, height: 96 },
  'thornberry-elixir': { src: 'assets/game/items/artbible/consumables/078-thornberry-elixir-idle-96.webp', srcset: 'assets/game/items/artbible/consumables/078-thornberry-elixir-idle-96.webp 96w, assets/game/items/artbible/consumables/078-thornberry-elixir-idle-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_ARTBIBLE_MATERIALS: Readonly<Record<string, ArtEntry>> = {
  'celestial-quartz': { src: 'assets/game/items/artbible/materials/083-celestial-quartz-idle-96.webp', srcset: 'assets/game/items/artbible/materials/083-celestial-quartz-idle-96.webp 96w, assets/game/items/artbible/materials/083-celestial-quartz-idle-256.webp 256w', width: 96, height: 96 },
  'emberheart-ore': { src: 'assets/game/items/artbible/materials/090-emberheart-ore-idle-96.webp', srcset: 'assets/game/items/artbible/materials/090-emberheart-ore-idle-96.webp 96w, assets/game/items/artbible/materials/090-emberheart-ore-idle-256.webp 256w', width: 96, height: 96 },
  'godforge-slag': { src: 'assets/game/items/artbible/materials/087-godforge-slag-idle-96.webp', srcset: 'assets/game/items/artbible/materials/087-godforge-slag-idle-96.webp 96w, assets/game/items/artbible/materials/087-godforge-slag-idle-256.webp 256w', width: 96, height: 96 },
  'moonpetal-herb': { src: 'assets/game/items/artbible/materials/086-moonpetal-herb-idle-96.webp', srcset: 'assets/game/items/artbible/materials/086-moonpetal-herb-idle-96.webp 96w, assets/game/items/artbible/materials/086-moonpetal-herb-idle-256.webp 256w', width: 96, height: 96 },
  'orichalcum-ore': { src: 'assets/game/items/artbible/materials/081-orichalcum-ore-idle-96.webp', srcset: 'assets/game/items/artbible/materials/081-orichalcum-ore-idle-96.webp 96w, assets/game/items/artbible/materials/081-orichalcum-ore-idle-256.webp 256w', width: 96, height: 96 },
  'pyrite-dust': { src: 'assets/game/items/artbible/materials/085-pyrite-dust-idle-96.webp', srcset: 'assets/game/items/artbible/materials/085-pyrite-dust-idle-96.webp 96w, assets/game/items/artbible/materials/085-pyrite-dust-idle-256.webp 256w', width: 96, height: 96 },
  'shadowthread-silk': { src: 'assets/game/items/artbible/materials/082-shadowthread-silk-idle-96.webp', srcset: 'assets/game/items/artbible/materials/082-shadowthread-silk-idle-96.webp 96w, assets/game/items/artbible/materials/082-shadowthread-silk-idle-256.webp 256w', width: 96, height: 96 },
  'solar-resin': { src: 'assets/game/items/artbible/materials/089-solar-resin-idle-96.webp', srcset: 'assets/game/items/artbible/materials/089-solar-resin-idle-96.webp 96w, assets/game/items/artbible/materials/089-solar-resin-idle-256.webp 256w', width: 96, height: 96 },
  'void-crystal': { src: 'assets/game/items/artbible/materials/088-void-crystal-idle-96.webp', srcset: 'assets/game/items/artbible/materials/088-void-crystal-idle-96.webp 96w, assets/game/items/artbible/materials/088-void-crystal-idle-256.webp 256w', width: 96, height: 96 },
  'world-root-bark': { src: 'assets/game/items/artbible/materials/084-world-root-bark-idle-96.webp', srcset: 'assets/game/items/artbible/materials/084-world-root-bark-idle-96.webp 96w, assets/game/items/artbible/materials/084-world-root-bark-idle-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_ARTBIBLE_RUNES: Readonly<Record<string, ArtEntry>> = {
  'rune-of-cinder': { src: 'assets/game/items/artbible/runes/059-rune-of-cinder-idle-96.webp', srcset: 'assets/game/items/artbible/runes/059-rune-of-cinder-idle-96.webp 96w, assets/game/items/artbible/runes/059-rune-of-cinder-idle-256.webp 256w', width: 96, height: 96 },
  'rune-of-dawns-edge': { src: 'assets/game/items/artbible/runes/047-rune-of-dawns-edge-96.webp', srcset: 'assets/game/items/artbible/runes/047-rune-of-dawns-edge-96.webp 96w, assets/game/items/artbible/runes/047-rune-of-dawns-edge-256.webp 256w', width: 96, height: 96 },
  'rune-of-erasure': { src: 'assets/game/items/artbible/runes/050-rune-of-erasure-96.webp', srcset: 'assets/game/items/artbible/runes/050-rune-of-erasure-96.webp 96w, assets/game/items/artbible/runes/050-rune-of-erasure-256.webp 256w', width: 96, height: 96 },
  'rune-of-hollow': { src: 'assets/game/items/artbible/runes/049-rune-of-hollow-96.webp', srcset: 'assets/game/items/artbible/runes/049-rune-of-hollow-96.webp 96w, assets/game/items/artbible/runes/049-rune-of-hollow-256.webp 256w', width: 96, height: 96 },
  'rune-of-overgrowth': { src: 'assets/game/items/artbible/runes/056-rune-of-overgrowth-idle-96.webp', srcset: 'assets/game/items/artbible/runes/056-rune-of-overgrowth-idle-96.webp 96w, assets/game/items/artbible/runes/056-rune-of-overgrowth-idle-256.webp 256w', width: 96, height: 96 },
  'rune-of-radiance': { src: 'assets/game/items/artbible/runes/046-rune-of-radiance-96.webp', srcset: 'assets/game/items/artbible/runes/046-rune-of-radiance-96.webp 96w, assets/game/items/artbible/runes/046-rune-of-radiance-256.webp 256w', width: 96, height: 96 },
  'rune-of-root': { src: 'assets/game/items/artbible/runes/055-rune-of-root-96.webp', srcset: 'assets/game/items/artbible/runes/055-rune-of-root-96.webp 96w, assets/game/items/artbible/runes/055-rune-of-root-256.webp 256w', width: 96, height: 96 },
  'rune-of-starfire': { src: 'assets/game/items/artbible/runes/053-rune-of-starfire-96.webp', srcset: 'assets/game/items/artbible/runes/053-rune-of-starfire-96.webp 96w, assets/game/items/artbible/runes/053-rune-of-starfire-256.webp 256w', width: 96, height: 96 },
  'rune-of-the-forge': { src: 'assets/game/items/artbible/runes/058-rune-of-the-forge-idle-96.webp', srcset: 'assets/game/items/artbible/runes/058-rune-of-the-forge-idle-96.webp 96w, assets/game/items/artbible/runes/058-rune-of-the-forge-idle-256.webp 256w', width: 96, height: 96 },
  'rune-of-the-solstice': { src: 'assets/game/items/artbible/runes/048-rune-of-the-solstice-96.webp', srcset: 'assets/game/items/artbible/runes/048-rune-of-the-solstice-96.webp 96w, assets/game/items/artbible/runes/048-rune-of-the-solstice-256.webp 256w', width: 96, height: 96 },
  'rune-of-the-underhearth': { src: 'assets/game/items/artbible/runes/060-rune-of-the-underhearth-idle-96.webp', srcset: 'assets/game/items/artbible/runes/060-rune-of-the-underhearth-idle-96.webp 96w, assets/game/items/artbible/runes/060-rune-of-the-underhearth-idle-256.webp 256w', width: 96, height: 96 },
  'rune-of-the-world-root': { src: 'assets/game/items/artbible/runes/057-rune-of-the-world-root-idle-96.webp', srcset: 'assets/game/items/artbible/runes/057-rune-of-the-world-root-idle-96.webp 96w, assets/game/items/artbible/runes/057-rune-of-the-world-root-idle-256.webp 256w', width: 96, height: 96 },
  'rune-of-void-navigation': { src: 'assets/game/items/artbible/runes/054-rune-of-void-navigation-96.webp', srcset: 'assets/game/items/artbible/runes/054-rune-of-void-navigation-96.webp 96w, assets/game/items/artbible/runes/054-rune-of-void-navigation-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_ARTBIBLE_SINGULAR: Readonly<Record<string, ArtEntry>> = {
  'unique-archivists-codex': { src: 'assets/game/items/artbible/singular/093-unique-archivists-codex-idle-96.webp', srcset: 'assets/game/items/artbible/singular/093-unique-archivists-codex-idle-96.webp 96w, assets/game/items/artbible/singular/093-unique-archivists-codex-idle-256.webp 256w', width: 96, height: 96 },
  'unique-aureths-mantle': { src: 'assets/game/items/artbible/singular/091-unique-aureths-mantle-idle-96.webp', srcset: 'assets/game/items/artbible/singular/091-unique-aureths-mantle-idle-96.webp 96w, assets/game/items/artbible/singular/091-unique-aureths-mantle-idle-256.webp 256w', width: 96, height: 96 },
  'unique-eclipse-manifest': { src: 'assets/game/items/artbible/singular/100-unique-eclipse-manifest-idle-96.webp', srcset: 'assets/game/items/artbible/singular/100-unique-eclipse-manifest-idle-96.webp 96w, assets/game/items/artbible/singular/100-unique-eclipse-manifest-idle-256.webp 256w', width: 96, height: 96 },
  'unique-forges-memory': { src: 'assets/game/items/artbible/singular/099-unique-forges-memory-idle-96.webp', srcset: 'assets/game/items/artbible/singular/099-unique-forges-memory-idle-96.webp 96w, assets/game/items/artbible/singular/099-unique-forges-memory-idle-256.webp 256w', width: 96, height: 96 },
  'unique-kaels-left-hand': { src: 'assets/game/items/artbible/singular/094-unique-kaels-left-hand-idle-96.webp', srcset: 'assets/game/items/artbible/singular/094-unique-kaels-left-hand-idle-96.webp 96w, assets/game/items/artbible/singular/094-unique-kaels-left-hand-idle-256.webp 256w', width: 96, height: 96 },
  'unique-merchants-ledger': { src: 'assets/game/items/artbible/singular/097-unique-merchants-ledger-idle-96.webp', srcset: 'assets/game/items/artbible/singular/097-unique-merchants-ledger-idle-96.webp 96w, assets/game/items/artbible/singular/097-unique-merchants-ledger-idle-256.webp 256w', width: 96, height: 96 },
  'unique-nameless-crown': { src: 'assets/game/items/artbible/singular/095-unique-nameless-crown-idle-96.webp', srcset: 'assets/game/items/artbible/singular/095-unique-nameless-crown-idle-96.webp 96w, assets/game/items/artbible/singular/095-unique-nameless-crown-idle-256.webp 256w', width: 96, height: 96 },
  'unique-rootmothers-embrace': { src: 'assets/game/items/artbible/singular/098-unique-rootmothers-embrace-idle-96.webp', srcset: 'assets/game/items/artbible/singular/098-unique-rootmothers-embrace-idle-96.webp 96w, assets/game/items/artbible/singular/098-unique-rootmothers-embrace-idle-256.webp 256w', width: 96, height: 96 },
  'unique-verrins-requiem': { src: 'assets/game/items/artbible/singular/092-unique-verrins-requiem-idle-96.webp', srcset: 'assets/game/items/artbible/singular/092-unique-verrins-requiem-idle-96.webp 96w, assets/game/items/artbible/singular/092-unique-verrins-requiem-idle-256.webp 256w', width: 96, height: 96 },
  'unique-worldsplitter': { src: 'assets/game/items/artbible/singular/096-unique-worldsplitter-idle-96.webp', srcset: 'assets/game/items/artbible/singular/096-unique-worldsplitter-idle-96.webp 96w, assets/game/items/artbible/singular/096-unique-worldsplitter-idle-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_ARTBIBLE_TOOLS: Readonly<Record<string, ArtEntry>> = {
  'cinder-compass': { src: 'assets/game/items/artbible/tools/045-cinder-compass-idle-96.webp', srcset: 'assets/game/items/artbible/tools/045-cinder-compass-idle-96.webp 96w, assets/game/items/artbible/tools/045-cinder-compass-idle-256.webp 256w', width: 96, height: 96 },
  'ember-primer': { src: 'assets/game/items/artbible/tools/038-ember-primer-idle-96.webp', srcset: 'assets/game/items/artbible/tools/038-ember-primer-idle-96.webp 96w, assets/game/items/artbible/tools/038-ember-primer-idle-256.webp 256w', width: 96, height: 96 },
  'gilded-quill': { src: 'assets/game/items/artbible/tools/040-gilded-quill-idle-96.webp', srcset: 'assets/game/items/artbible/tools/040-gilded-quill-idle-96.webp 96w, assets/game/items/artbible/tools/040-gilded-quill-idle-256.webp 256w', width: 96, height: 96 },
  'inkwell-talisman': { src: 'assets/game/items/artbible/tools/037-inkwell-talisman-idle-96.webp', srcset: 'assets/game/items/artbible/tools/037-inkwell-talisman-idle-96.webp 96w, assets/game/items/artbible/tools/037-inkwell-talisman-idle-256.webp 256w', width: 96, height: 96 },
  'lens-of-the-archivist': { src: 'assets/game/items/artbible/tools/036-lens-of-the-archivist-idle-96.webp', srcset: 'assets/game/items/artbible/tools/036-lens-of-the-archivist-idle-96.webp 96w, assets/game/items/artbible/tools/036-lens-of-the-archivist-idle-256.webp 256w', width: 96, height: 96 },
  'seedpod-of-knowing': { src: 'assets/game/items/artbible/tools/039-seedpod-of-knowing-idle-96.webp', srcset: 'assets/game/items/artbible/tools/039-seedpod-of-knowing-idle-96.webp 96w, assets/game/items/artbible/tools/039-seedpod-of-knowing-idle-256.webp 256w', width: 96, height: 96 },
  'starweavers-thread': { src: 'assets/game/items/artbible/tools/043-starweavers-thread-idle-96.webp', srcset: 'assets/game/items/artbible/tools/043-starweavers-thread-idle-96.webp 96w, assets/game/items/artbible/tools/043-starweavers-thread-idle-256.webp 256w', width: 96, height: 96 },
  'sunstone-dowser': { src: 'assets/game/items/artbible/tools/042-sunstone-dowser-idle-96.webp', srcset: 'assets/game/items/artbible/tools/042-sunstone-dowser-idle-96.webp 96w, assets/game/items/artbible/tools/042-sunstone-dowser-idle-256.webp 256w', width: 96, height: 96 },
  'thornseeker-beetle': { src: 'assets/game/items/artbible/tools/044-thornseeker-beetle-idle-96.webp', srcset: 'assets/game/items/artbible/tools/044-thornseeker-beetle-idle-96.webp 96w, assets/game/items/artbible/tools/044-thornseeker-beetle-idle-256.webp 256w', width: 96, height: 96 },
  'unique-voids-whisper': { src: 'assets/game/items/artbible/tools/041-unique-voids-whisper-idle-96.webp', srcset: 'assets/game/items/artbible/tools/041-unique-voids-whisper-idle-96.webp 96w, assets/game/items/artbible/tools/041-unique-voids-whisper-idle-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_ARTBIBLE_WEAPONS: Readonly<Record<string, ArtEntry>> = {
  'ashveil-throwing-knives': { src: 'assets/game/items/artbible/weapons/011-ashveil-throwing-knives-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/011-ashveil-throwing-knives-idle-96.webp 96w, assets/game/items/artbible/weapons/011-ashveil-throwing-knives-idle-256.webp 256w', width: 96, height: 96 },
  'astral-glaive': { src: 'assets/game/items/artbible/weapons/014-astral-glaive-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/014-astral-glaive-idle-96.webp 96w, assets/game/items/artbible/weapons/014-astral-glaive-idle-256.webp 256w', width: 96, height: 96 },
  'briarvein-kris': { src: 'assets/game/items/artbible/weapons/004-briarvein-kris-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/004-briarvein-kris-idle-96.webp 96w, assets/game/items/artbible/weapons/004-briarvein-kris-idle-256.webp 256w', width: 96, height: 96 },
  'cindergnaw': { src: 'assets/game/items/artbible/weapons/005-cindergnaw-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/005-cindergnaw-idle-96.webp 96w, assets/game/items/artbible/weapons/005-cindergnaw-idle-256.webp 256w', width: 96, height: 96 },
  'dawnrender': { src: 'assets/game/items/artbible/weapons/001-dawnrender-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/001-dawnrender-idle-96.webp 96w, assets/game/items/artbible/weapons/001-dawnrender-idle-256.webp 256w', width: 96, height: 96 },
  'eclipse-edge': { src: 'assets/game/items/artbible/weapons/010-eclipse-edge-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/010-eclipse-edge-idle-96.webp 96w, assets/game/items/artbible/weapons/010-eclipse-edge-idle-256.webp 256w', width: 96, height: 96 },
  'godforge-tongs': { src: 'assets/game/items/artbible/weapons/015-godforge-tongs-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/015-godforge-tongs-idle-96.webp 96w, assets/game/items/artbible/weapons/015-godforge-tongs-idle-256.webp 256w', width: 96, height: 96 },
  'hollow-fang': { src: 'assets/game/items/artbible/weapons/007-hollow-fang-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/007-hollow-fang-idle-96.webp 96w, assets/game/items/artbible/weapons/007-hollow-fang-idle-256.webp 256w', width: 96, height: 96 },
  'meridian-longbow': { src: 'assets/game/items/artbible/weapons/006-meridian-longbow-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/006-meridian-longbow-idle-96.webp 96w, assets/game/items/artbible/weapons/006-meridian-longbow-idle-256.webp 256w', width: 96, height: 96 },
  'nullthorn-staff': { src: 'assets/game/items/artbible/weapons/002-nullthorn-staff-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/002-nullthorn-staff-idle-96.webp 96w, assets/game/items/artbible/weapons/002-nullthorn-staff-idle-256.webp 256w', width: 96, height: 96 },
  'pyreclast-wand': { src: 'assets/game/items/artbible/weapons/009-pyreclast-wand-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/009-pyreclast-wand-idle-96.webp 96w, assets/game/items/artbible/weapons/009-pyreclast-wand-idle-256.webp 256w', width: 96, height: 96 },
  'radiant-halberd': { src: 'assets/game/items/artbible/weapons/012-radiant-halberd-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/012-radiant-halberd-idle-96.webp 96w, assets/game/items/artbible/weapons/012-radiant-halberd-idle-256.webp 256w', width: 96, height: 96 },
  'rootbreaker-mace': { src: 'assets/game/items/artbible/weapons/008-rootbreaker-mace-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/008-rootbreaker-mace-idle-96.webp 96w, assets/game/items/artbible/weapons/008-rootbreaker-mace-idle-256.webp 256w', width: 96, height: 96 },
  'spinerift-crossbow': { src: 'assets/game/items/artbible/weapons/013-spinerift-crossbow-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/013-spinerift-crossbow-idle-96.webp 96w, assets/game/items/artbible/weapons/013-spinerift-crossbow-idle-256.webp 256w', width: 96, height: 96 },
  'starfall-maul': { src: 'assets/game/items/artbible/weapons/003-starfall-maul-idle-96.webp', srcset: 'assets/game/items/artbible/weapons/003-starfall-maul-idle-96.webp 96w, assets/game/items/artbible/weapons/003-starfall-maul-idle-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_ARTIFACTS: Readonly<Record<string, ArtEntry>> = {
  'codex-solarii': { src: 'assets/game/items/artifacts/32-codex-solarii-96.webp', srcset: 'assets/game/items/artifacts/32-codex-solarii-96.webp 96w, assets/game/items/artifacts/32-codex-solarii-256.webp 256w', width: 96, height: 96 },
  'fragment-of-the-first-sun': { src: 'assets/game/items/artifacts/33-fragment-of-the-first-sun-96.webp', srcset: 'assets/game/items/artifacts/33-fragment-of-the-first-sun-96.webp 96w, assets/game/items/artifacts/33-fragment-of-the-first-sun-256.webp 256w', width: 96, height: 96 },
  'mirrorblade-of-kael': { src: 'assets/game/items/artifacts/30-mirrorblade-of-kael-96.webp', srcset: 'assets/game/items/artifacts/30-mirrorblade-of-kael-96.webp 96w, assets/game/items/artifacts/30-mirrorblade-of-kael-256.webp 256w', width: 96, height: 96 },
  'obsidian-heart': { src: 'assets/game/items/artifacts/29-obsidian-heart-96.webp', srcset: 'assets/game/items/artifacts/29-obsidian-heart-96.webp 96w, assets/game/items/artifacts/29-obsidian-heart-256.webp 256w', width: 96, height: 96 },
  'relic-of-the-third-dawn': { src: 'assets/game/items/artifacts/31-relic-of-the-third-dawn-96.webp', srcset: 'assets/game/items/artifacts/31-relic-of-the-third-dawn-96.webp 96w, assets/game/items/artifacts/31-relic-of-the-third-dawn-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_CONSUMABLES: Readonly<Record<string, ArtEntry>> = {
  'clarity-elixir': { src: 'assets/game/items/consumables/02-clarity-elixir-96.webp', srcset: 'assets/game/items/consumables/02-clarity-elixir-96.webp 96w, assets/game/items/consumables/02-clarity-elixir-256.webp 256w', width: 96, height: 96 },
  'ember-elixir': { src: 'assets/game/items/consumables/01-ember-elixir-96.webp', srcset: 'assets/game/items/consumables/01-ember-elixir-96.webp 96w, assets/game/items/consumables/01-ember-elixir-256.webp 256w', width: 96, height: 96 },
  'rift-key': { src: 'assets/game/items/consumables/04-rift-key-96.webp', srcset: 'assets/game/items/consumables/04-rift-key-96.webp 96w, assets/game/items/consumables/04-rift-key-256.webp 256w', width: 96, height: 96 },
  'veil-draught': { src: 'assets/game/items/consumables/03-veil-draught-96.webp', srcset: 'assets/game/items/consumables/03-veil-draught-96.webp 96w, assets/game/items/consumables/03-veil-draught-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_EQUIPMENT: Readonly<Record<string, ArtEntry>> = {
  'anchor-ring': { src: 'assets/game/items/equipment/08-anchor-ring-96.webp', srcset: 'assets/game/items/equipment/08-anchor-ring-96.webp 96w, assets/game/items/equipment/08-anchor-ring-256.webp 256w', width: 96, height: 96 },
  'astral-helm': { src: 'assets/game/items/equipment/09-astral-helm-96.webp', srcset: 'assets/game/items/equipment/09-astral-helm-96.webp 96w, assets/game/items/equipment/09-astral-helm-256.webp 256w', width: 96, height: 96 },
  'astral-pendant': { src: 'assets/game/items/equipment/07-astral-pendant-96.webp', srcset: 'assets/game/items/equipment/07-astral-pendant-96.webp 96w, assets/game/items/equipment/07-astral-pendant-256.webp 256w', width: 96, height: 96 },
  'eclipse-longblade': { src: 'assets/game/items/equipment/01-eclipse-longblade-96.webp', srcset: 'assets/game/items/equipment/01-eclipse-longblade-96.webp 96w, assets/game/items/equipment/01-eclipse-longblade-256.webp 256w', width: 96, height: 96 },
  'godforge-gauntlets': { src: 'assets/game/items/equipment/06-godforge-gauntlets-96.webp', srcset: 'assets/game/items/equipment/06-godforge-gauntlets-96.webp 96w, assets/game/items/equipment/06-godforge-gauntlets-256.webp 256w', width: 96, height: 96 },
  'infernal-cuirass': { src: 'assets/game/items/equipment/10-infernal-cuirass-96.webp', srcset: 'assets/game/items/equipment/10-infernal-cuirass-96.webp 96w, assets/game/items/equipment/10-infernal-cuirass-256.webp 256w', width: 96, height: 96 },
  'keeper-staff': { src: 'assets/game/items/equipment/02-keeper-staff-96.webp', srcset: 'assets/game/items/equipment/02-keeper-staff-96.webp 96w, assets/game/items/equipment/02-keeper-staff-256.webp 256w', width: 96, height: 96 },
  'keepers-cowl': { src: 'assets/game/items/equipment/04-keepers-cowl-96.webp', srcset: 'assets/game/items/equipment/04-keepers-cowl-96.webp 96w, assets/game/items/equipment/04-keepers-cowl-256.webp 256w', width: 96, height: 96 },
  'keepers-mantle': { src: 'assets/game/items/equipment/05-keepers-mantle-96.webp', srcset: 'assets/game/items/equipment/05-keepers-mantle-96.webp 96w, assets/game/items/equipment/05-keepers-mantle-256.webp 256w', width: 96, height: 96 },
  'luminous-greaves': { src: 'assets/game/items/equipment/11-luminous-greaves-96.webp', srcset: 'assets/game/items/equipment/11-luminous-greaves-96.webp 96w, assets/game/items/equipment/11-luminous-greaves-256.webp 256w', width: 96, height: 96 },
  'verdant-bracers': { src: 'assets/game/items/equipment/12-verdant-bracers-96.webp', srcset: 'assets/game/items/equipment/12-verdant-bracers-96.webp 96w, assets/game/items/equipment/12-verdant-bracers-256.webp 256w', width: 96, height: 96 },
  'void-buckler': { src: 'assets/game/items/equipment/03-void-buckler-96.webp', srcset: 'assets/game/items/equipment/03-void-buckler-96.webp 96w, assets/game/items/equipment/03-void-buckler-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_MATERIALS: Readonly<Record<string, ArtEntry>> = {
  'celestial-alloy': { src: 'assets/game/items/materials/02-celestial-alloy-96.webp', srcset: 'assets/game/items/materials/02-celestial-alloy-96.webp 96w, assets/game/items/materials/02-celestial-alloy-256.webp 256w', width: 96, height: 96 },
  'cinder-ore': { src: 'assets/game/items/materials/01-cinder-ore-96.webp', srcset: 'assets/game/items/materials/01-cinder-ore-96.webp 96w, assets/game/items/materials/01-cinder-ore-256.webp 256w', width: 96, height: 96 },
  'ember-residue': { src: 'assets/game/items/materials/12-ember-residue-96.webp', srcset: 'assets/game/items/materials/12-ember-residue-96.webp 96w, assets/game/items/materials/12-ember-residue-256.webp 256w', width: 96, height: 96 },
  'infernal-heartstone': { src: 'assets/game/items/materials/13-infernal-heartstone-96.webp', srcset: 'assets/game/items/materials/13-infernal-heartstone-96.webp 96w, assets/game/items/materials/13-infernal-heartstone-256.webp 256w', width: 96, height: 96 },
  'luminous-prism': { src: 'assets/game/items/materials/03-luminous-prism-96.webp', srcset: 'assets/game/items/materials/03-luminous-prism-96.webp 96w, assets/game/items/materials/03-luminous-prism-256.webp 256w', width: 96, height: 96 },
  'nightbloom': { src: 'assets/game/items/materials/09-nightbloom-96.webp', srcset: 'assets/game/items/materials/09-nightbloom-96.webp 96w, assets/game/items/materials/09-nightbloom-256.webp 256w', width: 96, height: 96 },
  'slag-fragment': { src: 'assets/game/items/materials/11-slag-fragment-96.webp', srcset: 'assets/game/items/materials/11-slag-fragment-96.webp 96w, assets/game/items/materials/11-slag-fragment-256.webp 256w', width: 96, height: 96 },
  'starlight-herb': { src: 'assets/game/items/materials/07-starlight-herb-96.webp', srcset: 'assets/game/items/materials/07-starlight-herb-96.webp 96w, assets/game/items/materials/07-starlight-herb-256.webp 256w', width: 96, height: 96 },
  'sunbloom': { src: 'assets/game/items/materials/08-sunbloom-96.webp', srcset: 'assets/game/items/materials/08-sunbloom-96.webp 96w, assets/game/items/materials/08-sunbloom-256.webp 256w', width: 96, height: 96 },
  'thornroot': { src: 'assets/game/items/materials/10-thornroot-96.webp', srcset: 'assets/game/items/materials/10-thornroot-96.webp 96w, assets/game/items/materials/10-thornroot-256.webp 256w', width: 96, height: 96 },
  'umbral-ink': { src: 'assets/game/items/materials/04-umbral-ink-96.webp', srcset: 'assets/game/items/materials/04-umbral-ink-96.webp 96w, assets/game/items/materials/04-umbral-ink-256.webp 256w', width: 96, height: 96 },
  'verdant-sap': { src: 'assets/game/items/materials/05-verdant-sap-96.webp', srcset: 'assets/game/items/materials/05-verdant-sap-96.webp 96w, assets/game/items/materials/05-verdant-sap-256.webp 256w', width: 96, height: 96 },
  'void-shard': { src: 'assets/game/items/materials/06-void-shard-96.webp', srcset: 'assets/game/items/materials/06-void-shard-96.webp 96w, assets/game/items/materials/06-void-shard-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_PORTRAITS: Readonly<Record<string, ArtEntry>> = {
  'basalt-edge-portrait': { src: 'assets/game/items/portraits/04-basalt-edge-portrait-96.webp', srcset: 'assets/game/items/portraits/04-basalt-edge-portrait-96.webp 96w, assets/game/items/portraits/04-basalt-edge-portrait-256.webp 256w', width: 96, height: 96 },
  'eclipse-longblade-portrait': { src: 'assets/game/items/portraits/01-eclipse-longblade-portrait-96.webp', srcset: 'assets/game/items/portraits/01-eclipse-longblade-portrait-96.webp 96w, assets/game/items/portraits/01-eclipse-longblade-portrait-256.webp 256w', width: 96, height: 96 },
  'keeper-staff-portrait': { src: 'assets/game/items/portraits/02-keeper-staff-portrait-96.webp', srcset: 'assets/game/items/portraits/02-keeper-staff-portrait-96.webp 96w, assets/game/items/portraits/02-keeper-staff-portrait-256.webp 256w', width: 96, height: 96 },
  'obsidian-heart-portrait': { src: 'assets/game/items/portraits/03-obsidian-heart-portrait-96.webp', srcset: 'assets/game/items/portraits/03-obsidian-heart-portrait-96.webp 96w, assets/game/items/portraits/03-obsidian-heart-portrait-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_QUEST: Readonly<Record<string, ArtEntry>> = {
  'broken-astral-compass': { src: 'assets/game/items/quest/02-broken-astral-compass-96.webp', srcset: 'assets/game/items/quest/02-broken-astral-compass-96.webp 96w, assets/game/items/quest/02-broken-astral-compass-256.webp 256w', width: 96, height: 96 },
  'keeper-signet': { src: 'assets/game/items/quest/03-keeper-signet-96.webp', srcset: 'assets/game/items/quest/03-keeper-signet-96.webp 96w, assets/game/items/quest/03-keeper-signet-256.webp 256w', width: 96, height: 96 },
  'rift-map-fragment': { src: 'assets/game/items/quest/04-rift-map-fragment-96.webp', srcset: 'assets/game/items/quest/04-rift-map-fragment-96.webp 96w, assets/game/items/quest/04-rift-map-fragment-256.webp 256w', width: 96, height: 96 },
  'sealed-codex-page': { src: 'assets/game/items/quest/01-sealed-codex-page-96.webp', srcset: 'assets/game/items/quest/01-sealed-codex-page-96.webp 96w, assets/game/items/quest/01-sealed-codex-page-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_RUNES: Readonly<Record<string, ArtEntry>> = {
  'aether': { src: 'assets/game/items/runes/17-aether-96.webp', srcset: 'assets/game/items/runes/17-aether-96.webp 96w, assets/game/items/runes/17-aether-256.webp 256w', width: 96, height: 96 },
  'ash': { src: 'assets/game/items/runes/01-ash-96.webp', srcset: 'assets/game/items/runes/01-ash-96.webp 96w, assets/game/items/runes/01-ash-256.webp 256w', width: 96, height: 96 },
  'codex': { src: 'assets/game/items/runes/19-codex-96.webp', srcset: 'assets/game/items/runes/19-codex-96.webp 96w, assets/game/items/runes/19-codex-256.webp 256w', width: 96, height: 96 },
  'convergence': { src: 'assets/game/items/runes/20-convergence-96.webp', srcset: 'assets/game/items/runes/20-convergence-96.webp 96w, assets/game/items/runes/20-convergence-256.webp 256w', width: 96, height: 96 },
  'drift': { src: 'assets/game/items/runes/03-drift-96.webp', srcset: 'assets/game/items/runes/03-drift-96.webp 96w, assets/game/items/runes/03-drift-256.webp 256w', width: 96, height: 96 },
  'eclipse': { src: 'assets/game/items/runes/15-eclipse-96.webp', srcset: 'assets/game/items/runes/15-eclipse-96.webp 96w, assets/game/items/runes/15-eclipse-256.webp 256w', width: 96, height: 96 },
  'ember': { src: 'assets/game/items/runes/02-ember-96.webp', srcset: 'assets/game/items/runes/02-ember-96.webp 96w, assets/game/items/runes/02-ember-256.webp 256w', width: 96, height: 96 },
  'forge': { src: 'assets/game/items/runes/16-forge-96.webp', srcset: 'assets/game/items/runes/16-forge-96.webp 96w, assets/game/items/runes/16-forge-256.webp 256w', width: 96, height: 96 },
  'fracture': { src: 'assets/game/items/runes/14-fracture-96.webp', srcset: 'assets/game/items/runes/14-fracture-96.webp 96w, assets/game/items/runes/14-fracture-256.webp 256w', width: 96, height: 96 },
  'glint': { src: 'assets/game/items/runes/05-glint-96.webp', srcset: 'assets/game/items/runes/05-glint-96.webp 96w, assets/game/items/runes/05-glint-256.webp 256w', width: 96, height: 96 },
  'godstone': { src: 'assets/game/items/runes/21-godstone-96.webp', srcset: 'assets/game/items/runes/21-godstone-96.webp 96w, assets/game/items/runes/21-godstone-256.webp 256w', width: 96, height: 96 },
  'hollow': { src: 'assets/game/items/runes/13-hollow-96.webp', srcset: 'assets/game/items/runes/13-hollow-96.webp 96w, assets/game/items/runes/13-hollow-256.webp 256w', width: 96, height: 96 },
  'nexus': { src: 'assets/game/items/runes/10-nexus-96.webp', srcset: 'assets/game/items/runes/10-nexus-96.webp 96w, assets/game/items/runes/10-nexus-256.webp 256w', width: 96, height: 96 },
  'nox': { src: 'assets/game/items/runes/18-nox-96.webp', srcset: 'assets/game/items/runes/18-nox-96.webp 96w, assets/game/items/runes/18-nox-256.webp 256w', width: 96, height: 96 },
  'pulse': { src: 'assets/game/items/runes/07-pulse-96.webp', srcset: 'assets/game/items/runes/07-pulse-96.webp 96w, assets/game/items/runes/07-pulse-256.webp 256w', width: 96, height: 96 },
  'rift': { src: 'assets/game/items/runes/12-rift-96.webp', srcset: 'assets/game/items/runes/12-rift-96.webp 96w, assets/game/items/runes/12-rift-256.webp 256w', width: 96, height: 96 },
  'scorch': { src: 'assets/game/items/runes/09-scorch-96.webp', srcset: 'assets/game/items/runes/09-scorch-96.webp 96w, assets/game/items/runes/09-scorch-256.webp 256w', width: 96, height: 96 },
  'shade': { src: 'assets/game/items/runes/04-shade-96.webp', srcset: 'assets/game/items/runes/04-shade-96.webp 96w, assets/game/items/runes/04-shade-256.webp 256w', width: 96, height: 96 },
  'sigil': { src: 'assets/game/items/runes/11-sigil-96.webp', srcset: 'assets/game/items/runes/11-sigil-96.webp 96w, assets/game/items/runes/11-sigil-256.webp 256w', width: 96, height: 96 },
  'thorn': { src: 'assets/game/items/runes/08-thorn-96.webp', srcset: 'assets/game/items/runes/08-thorn-96.webp 96w, assets/game/items/runes/08-thorn-256.webp 256w', width: 96, height: 96 },
  'veil': { src: 'assets/game/items/runes/06-veil-96.webp', srcset: 'assets/game/items/runes/06-veil-96.webp 96w, assets/game/items/runes/06-veil-256.webp 256w', width: 96, height: 96 },
  'void': { src: 'assets/game/items/runes/22-void-96.webp', srcset: 'assets/game/items/runes/22-void-96.webp 96w, assets/game/items/runes/22-void-256.webp 256w', width: 96, height: 96 },
};

export const ART_ITEMS_RUNEWORDS: Readonly<Record<string, ArtEntry>> = {
  'breath-of-the-void': { src: 'assets/game/items/runewords/28-breath-of-the-void-96.webp', srcset: 'assets/game/items/runewords/28-breath-of-the-void-96.webp 96w, assets/game/items/runewords/28-breath-of-the-void-256.webp 256w', width: 96, height: 96 },
  'convergents-will': { src: 'assets/game/items/runewords/26-convergents-will-96.webp', srcset: 'assets/game/items/runewords/26-convergents-will-96.webp 96w, assets/game/items/runewords/26-convergents-will-256.webp 256w', width: 96, height: 96 },
  'first-light': { src: 'assets/game/items/runewords/23-first-light-96.webp', srcset: 'assets/game/items/runewords/23-first-light-96.webp 96w, assets/game/items/runewords/23-first-light-256.webp 256w', width: 96, height: 96 },
  'godforge-mastery': { src: 'assets/game/items/runewords/27-godforge-mastery-96.webp', srcset: 'assets/game/items/runewords/27-godforge-mastery-96.webp 96w, assets/game/items/runewords/27-godforge-mastery-256.webp 256w', width: 96, height: 96 },
  'realm-bridge': { src: 'assets/game/items/runewords/25-realm-bridge-96.webp', srcset: 'assets/game/items/runewords/25-realm-bridge-96.webp 96w, assets/game/items/runewords/25-realm-bridge-256.webp 256w', width: 96, height: 96 },
  'shadow-step': { src: 'assets/game/items/runewords/24-shadow-step-96.webp', srcset: 'assets/game/items/runewords/24-shadow-step-96.webp 96w, assets/game/items/runewords/24-shadow-step-256.webp 256w', width: 96, height: 96 },
};

export const ART_MARKET_AUTOMATONS: Readonly<Record<string, ArtEntry>> = {
  'apprentice-striker': { src: 'assets/game/market/automatons/apprentice-striker-96.webp', srcset: 'assets/game/market/automatons/apprentice-striker-96.webp 96w, assets/game/market/automatons/apprentice-striker-256.webp 256w', width: 96, height: 96 },
  'eclipse-automaton': { src: 'assets/game/market/automatons/eclipse-automaton-96.webp', srcset: 'assets/game/market/automatons/eclipse-automaton-96.webp 96w, assets/game/market/automatons/eclipse-automaton-256.webp 256w', width: 96, height: 96 },
  'forge-golem': { src: 'assets/game/market/automatons/forge-golem-96.webp', srcset: 'assets/game/market/automatons/forge-golem-96.webp 96w, assets/game/market/automatons/forge-golem-256.webp 256w', width: 96, height: 96 },
};

export const ART_MARKET_CATEGORIES: Readonly<Record<string, ArtEntry>> = {
  'artifacts': { src: 'assets/game/market/categories/artifacts-96.webp', srcset: 'assets/game/market/categories/artifacts-96.webp 96w, assets/game/market/categories/artifacts-256.webp 256w', width: 96, height: 96 },
  'automaton-shop': { src: 'assets/game/market/categories/automaton-shop-96.webp', srcset: 'assets/game/market/categories/automaton-shop-96.webp 96w, assets/game/market/categories/automaton-shop-256.webp 256w', width: 96, height: 96 },
  'consumables': { src: 'assets/game/market/categories/consumables-96.webp', srcset: 'assets/game/market/categories/consumables-96.webp 96w, assets/game/market/categories/consumables-256.webp 256w', width: 96, height: 96 },
  'eclipse-shop': { src: 'assets/game/market/categories/eclipse-shop-96.webp', srcset: 'assets/game/market/categories/eclipse-shop-96.webp 96w, assets/game/market/categories/eclipse-shop-256.webp 256w', width: 96, height: 96 },
  'equipment': { src: 'assets/game/market/categories/equipment-96.webp', srcset: 'assets/game/market/categories/equipment-96.webp 96w, assets/game/market/categories/equipment-256.webp 256w', width: 96, height: 96 },
  'expedition-shop': { src: 'assets/game/market/categories/expedition-shop-96.webp', srcset: 'assets/game/market/categories/expedition-shop-96.webp 96w, assets/game/market/categories/expedition-shop-256.webp 256w', width: 96, height: 96 },
  'mastery-shop': { src: 'assets/game/market/categories/mastery-shop-96.webp', srcset: 'assets/game/market/categories/mastery-shop-96.webp 96w, assets/game/market/categories/mastery-shop-256.webp 256w', width: 96, height: 96 },
  'materials': { src: 'assets/game/market/categories/materials-96.webp', srcset: 'assets/game/market/categories/materials-96.webp 96w, assets/game/market/categories/materials-256.webp 256w', width: 96, height: 96 },
  'quest-items': { src: 'assets/game/market/categories/quest-items-96.webp', srcset: 'assets/game/market/categories/quest-items-96.webp 96w, assets/game/market/categories/quest-items-256.webp 256w', width: 96, height: 96 },
  'runes': { src: 'assets/game/market/categories/runes-96.webp', srcset: 'assets/game/market/categories/runes-96.webp 96w, assets/game/market/categories/runes-256.webp 256w', width: 96, height: 96 },
};

export const ART_MARKET_COSMETICS: Readonly<Record<string, ArtEntry>> = {
  'achievement-frame': { src: 'assets/game/market/cosmetics/achievement-frame-96.webp', srcset: 'assets/game/market/cosmetics/achievement-frame-96.webp 96w, assets/game/market/cosmetics/achievement-frame-256.webp 256w', width: 96, height: 96 },
  'cursor-trail': { src: 'assets/game/market/cosmetics/cursor-trail-96.webp', srcset: 'assets/game/market/cosmetics/cursor-trail-96.webp 96w, assets/game/market/cosmetics/cursor-trail-256.webp 256w', width: 96, height: 96 },
  'theme-variant': { src: 'assets/game/market/cosmetics/theme-variant-96.webp', srcset: 'assets/game/market/cosmetics/theme-variant-96.webp 96w, assets/game/market/cosmetics/theme-variant-256.webp 256w', width: 96, height: 96 },
  'title-prefix': { src: 'assets/game/market/cosmetics/title-prefix-96.webp', srcset: 'assets/game/market/cosmetics/title-prefix-96.webp 96w, assets/game/market/cosmetics/title-prefix-256.webp 256w', width: 96, height: 96 },
  'xp-bar-skin': { src: 'assets/game/market/cosmetics/xp-bar-skin-96.webp', srcset: 'assets/game/market/cosmetics/xp-bar-skin-96.webp 96w, assets/game/market/cosmetics/xp-bar-skin-256.webp 256w', width: 96, height: 96 },
};

export const ART_MARKET_ENCHANTMENTS: Readonly<Record<string, ArtEntry>> = {
  'convergents-blessing': { src: 'assets/game/market/enchantments/convergents-blessing-96.webp', srcset: 'assets/game/market/enchantments/convergents-blessing-96.webp 96w, assets/game/market/enchantments/convergents-blessing-256.webp 256w', width: 96, height: 96 },
  'eclipse-aura': { src: 'assets/game/market/enchantments/eclipse-aura-96.webp', srcset: 'assets/game/market/enchantments/eclipse-aura-96.webp 96w, assets/game/market/enchantments/eclipse-aura-256.webp 256w', width: 96, height: 96 },
  'scholars-mark': { src: 'assets/game/market/enchantments/scholars-mark-96.webp', srcset: 'assets/game/market/enchantments/scholars-mark-96.webp 96w, assets/game/market/enchantments/scholars-mark-256.webp 256w', width: 96, height: 96 },
  'seekers-lens': { src: 'assets/game/market/enchantments/seekers-lens-96.webp', srcset: 'assets/game/market/enchantments/seekers-lens-96.webp 96w, assets/game/market/enchantments/seekers-lens-256.webp 256w', width: 96, height: 96 },
};

export const ART_MARKET_EXPEDITIONS: Readonly<Record<string, ArtEntry>> = {
  'hire-an-explorer': { src: 'assets/game/market/expeditions/hire-an-explorer-96.webp', srcset: 'assets/game/market/expeditions/hire-an-explorer-96.webp 96w, assets/game/market/expeditions/hire-an-explorer-256.webp 256w', width: 96, height: 96 },
};

export const ART_MARKET_FORGE: Readonly<Record<string, ArtEntry>> = {
  'aether-siphon': { src: 'assets/game/market/forge/aether-siphon-96.webp', srcset: 'assets/game/market/forge/aether-siphon-96.webp 96w, assets/game/market/forge/aether-siphon-256.webp 256w', width: 96, height: 96 },
  'eclipse-core': { src: 'assets/game/market/forge/eclipse-core-96.webp', srcset: 'assets/game/market/forge/eclipse-core-96.webp 96w, assets/game/market/forge/eclipse-core-256.webp 256w', width: 96, height: 96 },
  'eclipse-reactor': { src: 'assets/game/market/forge/eclipse-reactor-96.webp', srcset: 'assets/game/market/forge/eclipse-reactor-96.webp 96w, assets/game/market/forge/eclipse-reactor-256.webp 256w', width: 96, height: 96 },
  'ember-stoker': { src: 'assets/game/market/forge/ember-stoker-96.webp', srcset: 'assets/game/market/forge/ember-stoker-96.webp 96w, assets/game/market/forge/ember-stoker-256.webp 256w', width: 96, height: 96 },
  'forge-bellows': { src: 'assets/game/market/forge/forge-bellows-96.webp', srcset: 'assets/game/market/forge/forge-bellows-96.webp 96w, assets/game/market/forge/forge-bellows-256.webp 256w', width: 96, height: 96 },
  'godforge-heart': { src: 'assets/game/market/forge/godforge-heart-96.webp', srcset: 'assets/game/market/forge/godforge-heart-96.webp 96w, assets/game/market/forge/godforge-heart-256.webp 256w', width: 96, height: 96 },
  'nether-furnace': { src: 'assets/game/market/forge/nether-furnace-96.webp', srcset: 'assets/game/market/forge/nether-furnace-96.webp 96w, assets/game/market/forge/nether-furnace-256.webp 256w', width: 96, height: 96 },
  'nox-harvester': { src: 'assets/game/market/forge/nox-harvester-96.webp', srcset: 'assets/game/market/forge/nox-harvester-96.webp 96w, assets/game/market/forge/nox-harvester-256.webp 256w', width: 96, height: 96 },
  'realm-conduit': { src: 'assets/game/market/forge/realm-conduit-96.webp', srcset: 'assets/game/market/forge/realm-conduit-96.webp 96w, assets/game/market/forge/realm-conduit-256.webp 256w', width: 96, height: 96 },
  'the-first-sun': { src: 'assets/game/market/forge/the-first-sun-96.webp', srcset: 'assets/game/market/forge/the-first-sun-96.webp 96w, assets/game/market/forge/the-first-sun-256.webp 256w', width: 96, height: 96 },
};

export const ART_MARKET_HAMMERS: Readonly<Record<string, ArtEntry>> = {
  'aether-striker': { src: 'assets/game/market/hammers/aether-striker-96.webp', srcset: 'assets/game/market/hammers/aether-striker-96.webp 96w, assets/game/market/hammers/aether-striker-256.webp 256w', width: 96, height: 96 },
  'eclipse-hammer': { src: 'assets/game/market/hammers/eclipse-hammer-96.webp', srcset: 'assets/game/market/hammers/eclipse-hammer-96.webp 96w, assets/game/market/hammers/eclipse-hammer-256.webp 256w', width: 96, height: 96 },
  'iron-hammer': { src: 'assets/game/market/hammers/iron-hammer-96.webp', srcset: 'assets/game/market/hammers/iron-hammer-96.webp 96w, assets/game/market/hammers/iron-hammer-256.webp 256w', width: 96, height: 96 },
  'nox-crusher': { src: 'assets/game/market/hammers/nox-crusher-96.webp', srcset: 'assets/game/market/hammers/nox-crusher-96.webp 96w, assets/game/market/hammers/nox-crusher-256.webp 256w', width: 96, height: 96 },
  'obsidian-mallet': { src: 'assets/game/market/hammers/obsidian-mallet-96.webp', srcset: 'assets/game/market/hammers/obsidian-mallet-96.webp 96w, assets/game/market/hammers/obsidian-mallet-256.webp 256w', width: 96, height: 96 },
};

export const ART_MARKET_MASTERY: Readonly<Record<string, ArtEntry>> = {
  'forge-efficiency-i': { src: 'assets/game/market/mastery/forge-efficiency-i-96.webp', srcset: 'assets/game/market/mastery/forge-efficiency-i-96.webp 96w, assets/game/market/mastery/forge-efficiency-i-256.webp 256w', width: 96, height: 96 },
  'forge-efficiency-ii': { src: 'assets/game/market/mastery/forge-efficiency-ii-96.webp', srcset: 'assets/game/market/mastery/forge-efficiency-ii-96.webp 96w, assets/game/market/mastery/forge-efficiency-ii-256.webp 256w', width: 96, height: 96 },
  'forge-efficiency-iii': { src: 'assets/game/market/mastery/forge-efficiency-iii-96.webp', srcset: 'assets/game/market/mastery/forge-efficiency-iii-96.webp 96w, assets/game/market/mastery/forge-efficiency-iii-256.webp 256w', width: 96, height: 96 },
  'forge-mastery': { src: 'assets/game/market/mastery/forge-mastery-96.webp', srcset: 'assets/game/market/mastery/forge-mastery-96.webp 96w, assets/game/market/mastery/forge-mastery-256.webp 256w', width: 96, height: 96 },
};

export const ART_MARKET_STATUS: Readonly<Record<string, ArtEntry>> = {
  'buy-order': { src: 'assets/game/market/status/buy-order-96.webp', srcset: 'assets/game/market/status/buy-order-96.webp 96w, assets/game/market/status/buy-order-256.webp 256w', width: 96, height: 96 },
  'eclipse-shard': { src: 'assets/game/market/status/eclipse-shard-96.webp', srcset: 'assets/game/market/status/eclipse-shard-96.webp 96w, assets/game/market/status/eclipse-shard-256.webp 256w', width: 96, height: 96 },
  'enchantment-active': { src: 'assets/game/market/status/enchantment-active-96.webp', srcset: 'assets/game/market/status/enchantment-active-96.webp 96w, assets/game/market/status/enchantment-active-256.webp 256w', width: 96, height: 96 },
  'gold-rate': { src: 'assets/game/market/status/gold-rate-96.webp', srcset: 'assets/game/market/status/gold-rate-96.webp 96w, assets/game/market/status/gold-rate-256.webp 256w', width: 96, height: 96 },
  'market-empty': { src: 'assets/game/market/status/market-empty-96.webp', srcset: 'assets/game/market/status/market-empty-96.webp 96w, assets/game/market/status/market-empty-256.webp 256w', width: 96, height: 96 },
  'sell-listing': { src: 'assets/game/market/status/sell-listing-96.webp', srcset: 'assets/game/market/status/sell-listing-96.webp 96w, assets/game/market/status/sell-listing-256.webp 256w', width: 96, height: 96 },
  'total-value': { src: 'assets/game/market/status/total-value-96.webp', srcset: 'assets/game/market/status/total-value-96.webp 96w, assets/game/market/status/total-value-256.webp 256w', width: 96, height: 96 },
  'trade-complete': { src: 'assets/game/market/status/trade-complete-96.webp', srcset: 'assets/game/market/status/trade-complete-96.webp 96w, assets/game/market/status/trade-complete-256.webp 256w', width: 96, height: 96 },
  'watch': { src: 'assets/game/market/status/watch-96.webp', srcset: 'assets/game/market/status/watch-96.webp 96w, assets/game/market/status/watch-256.webp 256w', width: 96, height: 96 },
};

/** Every family, in one lookup. Later families win on an id clash. */
export const ART_ALL: Readonly<Record<string, ArtEntry>> = {
  ...ART_CHARACTERS,
  ...ART_CHARACTERS_AVATARS,
  ...ART_CHARACTERS_PORTRAITS,
  ...ART_CREATURES,
  ...ART_CURRENCIES,
  ...ART_CURRENCIES_REALM_TOKENS,
  ...ART_EFFECTS_FORGE,
  ...ART_EFFECTS_RIFTS,
  ...ART_GUILD_BANNERS,
  ...ART_GUILD_CRESTS,
  ...ART_GUILD_RANKS,
  ...ART_ITEMS_ARTBIBLE_ACCESSORIES,
  ...ART_ITEMS_ARTBIBLE_ARMOR,
  ...ART_ITEMS_ARTBIBLE_ARTIFACTS,
  ...ART_ITEMS_ARTBIBLE_CONSUMABLES,
  ...ART_ITEMS_ARTBIBLE_MATERIALS,
  ...ART_ITEMS_ARTBIBLE_RUNES,
  ...ART_ITEMS_ARTBIBLE_SINGULAR,
  ...ART_ITEMS_ARTBIBLE_TOOLS,
  ...ART_ITEMS_ARTBIBLE_WEAPONS,
  ...ART_ITEMS_ARTIFACTS,
  ...ART_ITEMS_CONSUMABLES,
  ...ART_ITEMS_EQUIPMENT,
  ...ART_ITEMS_MATERIALS,
  ...ART_ITEMS_PORTRAITS,
  ...ART_ITEMS_QUEST,
  ...ART_ITEMS_RUNES,
  ...ART_ITEMS_RUNEWORDS,
  ...ART_MARKET_AUTOMATONS,
  ...ART_MARKET_CATEGORIES,
  ...ART_MARKET_COSMETICS,
  ...ART_MARKET_ENCHANTMENTS,
  ...ART_MARKET_EXPEDITIONS,
  ...ART_MARKET_FORGE,
  ...ART_MARKET_HAMMERS,
  ...ART_MARKET_MASTERY,
  ...ART_MARKET_STATUS,
};

export function artFor(id: string): ArtEntry | null {
  return ART_ALL[id] ?? null;
}
