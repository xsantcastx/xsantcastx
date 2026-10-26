/**
 * rune-stack.ts — a rune in the satchel (docs/design/runewords.md §1).
 *
 * Runes are monster drops (canon §6.2), and a held rune is a satchel stack: one 1×1 cell per pile, keyed
 * `rune-<id>` (`rune-ash`). The key carries no `|` (the packed stack ops) and no `:` (Vault stack keys are
 * `v:<tab>:<key>`). Pure, SSR-safe.
 */
import { runeById, type Rune } from './rune.model';

export const RUNE_STACK_PREFIX = 'rune-';

/** The satchel stack key of a rune. */
export function runeStackKey(runeId: string): string { return `${RUNE_STACK_PREFIX}${runeId}`; }

/** The rune a stack key holds, or null when the key is not a rune's. */
export function runeOfStack(stackKey: string | null | undefined): Rune | null {
  if (!stackKey || !stackKey.startsWith(RUNE_STACK_PREFIX)) return null;
  return runeById(stackKey.slice(RUNE_STACK_PREFIX.length)) ?? null;
}

export function isRuneStack(stackKey: string | null | undefined): boolean { return !!runeOfStack(stackKey); }
