/**
 * entity-ref.ts — serialize ?inspect=<type>:<id> without touching other params.
 */
import { ENTITY_TYPES, isEntityType, type EntityRef, type EntityType } from './entity.model';

export const INSPECT_QUERY = 'inspect';

export function serializeEntityRef(ref: EntityRef): string {
  return `${ref.type}:${ref.id}`;
}

export function parseEntityRef(token: string | null | undefined): EntityRef | null {
  if (!token) return null;
  const trimmed = token.trim();
  const split = trimmed.indexOf(':');
  if (split <= 0 || split === trimmed.length - 1) return null;
  const type = trimmed.slice(0, split);
  const id = trimmed.slice(split + 1).trim();
  if (!isEntityType(type) || !id) return null;
  return { type, id };
}

export function inspectHref(path: string, ref: EntityRef): string {
  const url = new URL(path, 'https://xsantcastx.invalid');
  url.searchParams.set(INSPECT_QUERY, serializeEntityRef(ref));
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export { ENTITY_TYPES };
export type { EntityType };
