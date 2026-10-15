# Bundle diet (initial bundle 1.82 MB -> 1.57 MB)

Cause: `AppModule` declares the shell, so every standalone overlay it imports is eager, and each pulls its data
tables with it (module is the chunking unit). Dominator analysis of `stats.json` (remove a module, count the bytes
that leave the initial graph) showed the idle overlays were the cheapest big win:

| Eager contributor (retained kB, minified) | Before | After |
|---|---|---|
| `npc-dialogue` (+ npc-quest.service, delve-missions.model) | 62 | lazy |
| `forge-flame` (+ rune-forge.service, lore-scroll.model) | 60 | lazy |
| `inspect` (+ inspect.service, entity-resolver) | 33 | lazy |
| `level-up-banner` (+ skill-unlocks) | 23 | lazy |
| quest-drawer / quest-toast / achievement-drop / discovery-toast / keeper-panel / forged-today | ~50 | lazy |

Fix: `shared/shell/deferred-overlays.component.ts` (standalone) holds those ten overlays inside one
`@defer (on idle; prefetch on immediate)`. Angular only lazifies imports of a *standalone* host, which is why this
is a component of its own and not part of `AppComponent`. Chunk is prefetched at once, rendered on idle; all are
position:fixed, so nothing shifts. Not mounted on /play (as before). Prerendered HTML no longer contains these
overlays (they rendered nothing meaningful server-side).

Still eager and worth a later pass (retained kB): `art.ts` + manifest/icons 90 (header uses artFor), `translation.service` 88,
`collection.model` + crafting/unique/artbible tables ~95 (pulled by `CollectionWiringService` in `AppComponent`),
`header` 49, `footer` 41, `godforge-loader` 31.

Watch: an event fired before idle (first second after load) reaches no toast; none are user-initiated that early.
