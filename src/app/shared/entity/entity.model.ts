/**
 * entity.model.ts — shared EntityRef / presentation contract for Quick Inspect.
 *
 * Source: docs/05-implementation/eclipse-realms-entity-market-inventory-character-spec.md
 * PR4a is read-only. EntityActionGateway is not implemented here.
 */
export type EntityType =
  | 'item'
  | 'market-listing'
  | 'rune'
  | 'runeword'
  | 'recipe'
  | 'creature'
  | 'realm'
  | 'zone'
  | 'quest'
  | 'boss'
  | 'character';

export interface EntityRef {
  type: EntityType;
  id: string;
}

export type EntityLoadState = 'ready' | 'loading' | 'missing' | 'error';

export interface EntityRarity {
  id: string;
  label: string;
  color: string;
  glow: string;
}

export interface EntityArt {
  src: string;
  alt: string;
}

export interface EntityFact {
  label: string;
  value: string;
  exactValue?: string;
  /** Item mods render as `Gold/sec +2.4` instead of a dt/dd pair. */
  kind?: 'mod' | 'meta';
}

export interface EntityPresentation {
  ref: EntityRef;
  name: string;
  kindLabel: string;
  accessibleName: string;
  rarity?: EntityRarity;
  art?: EntityArt;
  glyphFallback: string;
  summary: string;
  lore?: string;
  facts: ReadonlyArray<EntityFact>;
}

export interface EntityAction {
  id:
    | 'inspect'
    | 'equip'
    | 'unequip'
    | 'use'
    | 'craft'
    | 'buy'
    | 'sell'
    | 'find-source'
    | 'view-recipe'
    | 'continue-journey';
  label: string;
  kind: 'primary' | 'secondary' | 'destructive' | 'link';
  enabled: boolean;
  unavailableReason?: string;
  confirm?: { title: string; body: string; confirmLabel: string };
  href?: string;
}

export interface EntityResolution {
  state: EntityLoadState;
  presentation?: EntityPresentation;
  actions: readonly EntityAction[];
  retryable: boolean;
  message?: string;
}

export const ENTITY_TYPES: readonly EntityType[] = [
  'item',
  'market-listing',
  'rune',
  'runeword',
  'recipe',
  'creature',
  'realm',
  'zone',
  'quest',
  'boss',
  'character',
] as const;

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}
