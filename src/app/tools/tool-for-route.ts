/**
 * tool-for-route.ts — "is this path a tool page?", without the tool registry.
 *
 * The registry is 77 kB of retired developer-tool data. Three root services
 * (RealmService, AtmosphereService, QuestWiringService) used to import it
 * statically just to look the current route up in it, which put the whole
 * thing in the initial bundle of every page — and "the module is the chunking
 * unit", so one `.find()` dragged in all of it.
 *
 * The tools product is retired: the router's CANONICAL_REDIRECTS send
 * `tools/:slug` to `/world` and Hosting 301s `/tools/**` the same way, so a
 * resolved URL is never a tool route in practice. The lookup is kept rather
 * than deleted, but the registry now arrives through a dynamic import, and only
 * for a path that could possibly match — every other route answers `null`
 * without loading anything.
 */
import type { ToolDefinition } from './tools-registry';

/** True when `path` has the shape of a tool route and is worth looking up. */
export function isToolPath(path: string): boolean {
  return path.startsWith('/tools/');
}

/** The tool whose route is exactly `path`, or null. Loads the registry on demand. */
export function toolForRoute(path: string): Promise<ToolDefinition | null> {
  if (!isToolPath(path)) return Promise.resolve(null);
  return import('./tools-registry').then(
    m => m.TOOLS_REGISTRY.find(t => t.route === path) ?? null,
    () => null,
  );
}
