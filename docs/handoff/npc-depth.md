# NPC depth pass (world & cast slice S3)

2026-10-14. Spec: `docs/world/world-and-cast.md` §3 (the cast) and §7 S3. Builds on
`docs/handoff/phase4-life.md` (keepers, townsfolk, name tags) and
`docs/handoff/story-act1.md` (the story beats it reads). New lore:
`docs/world/lore-addendum.md`, "The people in the towns (S3)", shipped, owner
reviews in play.

The towns had shop signs with legs. Now they have people: a name, a job title
under it, a pool of things to say that follows the Keeper's story and what the
Keeper has done at their station, and opinions about each other.

## The cast as a player meets them

| Town | Keeper (tag · subtitle) | Station | What opens their lines |
|---|---|---|---|
| Seamworks | **Orla Stave** · Vault Clerk | Vault | first deposit |
| Seamworks | **Edrin Kade** · Buyback Clerk | Material Vendor | first sale, first hunt, the Seam Eater, the act break |
| Seamworks | **Mara Voss** · Bench Smith | Crafting Bench | first craft, the Basalt Edge, Kael's hammer, the act break |
| Seamworks | Kael · the Broken Flame | Rune Forge | first anvil strike, first carving, the hammer, the act break |
| Seamworks | **Idris Calder** · Enchanter | Enchanting Table | first socketed rune, first carving |
| Heliograph Court | The Merchant · of the long till | Market | first building, the Grotto prices, the act break |
| Heliograph Court | Aureth · the Radiant | Waystone (west) | first building, the act break |
| Heliograph Court | **Tomas Rill** · Lantern Keeper (new) | Waystone (east) | the fresh mark, the act break |
| Heliograph Court | **Ilyra Venn** · Archive Listener (new) | East Stair | first carving, *dated tomorrow* |
| Nocturne Archive | **Lune Coyne** · Croupier | Gambler + Reels, Rune Drop, Seam Sweeper, Eclipse Ascent | first sale |
| Nocturne Archive | **Amina Thorne** · Exchange Broker | Exchange | first sale, the Grotto prices, the act break |
| Nocturne Archive | Verrin · the Hollow | Unrecorded Corridors (west) | the tally, the Seam Eater |
| Nocturne Archive | **Rook Sable** · Veil Cartographer (new) | Unrecorded Corridors (east) | first dig, the tally |
| Meridian Orrery | The Archivist · keeper of fragments | Codex | first carving, *dated tomorrow* |
| Meridian Orrery | **Nox Aster** · Chart Clerk | Leaderboards | 10,000 Gold earned, the act break |
| Meridian Orrery | **Sera Quill** · Chief Meridian (new) | Waystone | the act break |
| Rootglass Canopy | **Siv Moss** · Expedition Steward | Sanctum | first hunt, the Seam Eater |
| Rootglass Canopy | **Pim Larkin** · Board Herald | Quest Board | first Delve order, the Seam Eater, the act break |
| Rootglass Canopy | **Corran Holt** · Arena Gatekeeper | Arena Gate | first hunt |
| Rootglass Canopy | **Hesta Cairn** · Trials Warden | Trials Gate | the Seam Eater |
| Rootglass Canopy | **Kesh Arbo** · Lodge Warden | Skills Lodge | a skill at 10, first fish |

Each keeper has 4 to 8 lines. 30 of them name another keeper (Mara and Kael,
Edrin and Mara, the Merchant and Edrin, Ilyra and Tomas, Amina and the Merchant,
Rook and Amina, Sera and Nox, Siv and Kesh…). The six role keepers that S3
left unnamed were named the same day (Orla Stave, Idris Calder, Lune Coyne, Pim
Larkin, Corran Holt, Hesta Cairn; lore-addendum, "Six names for the role
keepers"), so every keeper now wears a name with a title under it.

## How it works

- **`play/world/keeper-lines.ts`** (pure): `KEEPER_LINES[keeper]` is a list of
  `{ n, beat?, deed? }`. `keeperLines(id, { beats, deeds })` returns the open
  lines as i18n keys, **newest first**: a later story beat, then an earlier
  one, then a deed, then the always-there lines in their own order. A line
  gated on a beat is never in the pool before the beat is reached.
  `keeperDeeds(facts)` turns the save into deeds (`crafted`, `sold`,
  `vaulted`, `struck`, `socketed`, `bought`, `hunted`, `dug`, `skilled`,
  `fished`, `mission`, `renown`).
- **The play view** (`side-scroller.component.ts` `tickKeepers`, on the HUD
  tick right after the story's): builds the deed facts from the inventory,
  economy, activity, delve and quest services it already holds, plus
  `StoryService.state.beats`. It calls `engine.setKeeperContext()` only when
  the beats + deeds signature changes.
- **`TownLife`** (`engine/town-life.ts`): one voice per keeper, whose lines are
  `keeperLines()` of the current context. `setContext` swaps a keeper's pool
  when it changes and restarts it from the top (`KeeperChatter.restart`), so
  the next greeting is about what just happened. Greet once per approach,
  rearm after 300 px + 20 s, 5.5 s bubble: unchanged from Phase 4.
- **Name tags:** the plate shows the name (14 px, as before) and, for a
  person, the subtitle (11 px italic) under it: the approved role title, or a
  canon epithet. Role keepers without a name keep the title as their name and
  no subtitle. `KeeperDef.title` / `titleKey` (`play.life.title.<id>`).
- **Canon keepers** still only say `DIALOGUE` lines (harness-enforced).
  Their act-aware lines are new `DIALOGUE` rows with a new **`storyBeat`**
  condition (`npc.model.ts`). `NpcDialogueService` fills `storyBeats` straight
  from the gateway (`godforge-story` + `coerceStory`, both already eager), so
  the page NPCs speak the same act-aware lines without pulling `story.ts` into
  the eager bundle.
- **People of the Realms** (`codex/codex-people.component.ts`, `@defer` in the
  Codex's Collection tab, after Glim's entry): where, who, teaches, per keeper;
  words in `codex/people.i18n.ts` (lazy) + `life.i18n.ts`.
- **`check:meaning`**: every keeper must have a People entry
  (`codex.people.{where,who,teaches}.<id>`) and its `titleKey`; a keeper at a
  passage counts as "shows the way to <area>" (Ilyra, Rook; a click on them
  takes the passage, as with Verrin).

## Files

| File | What |
|---|---|
| `src/app/play/world/keeper-lines.ts` (+ `.spec.ts`) | line gates, ordering, deeds |
| `src/app/play/world/life.ts` | names, subtitles, four new keepers, `KeeperChatter.restart` |
| `src/app/play/world/life.i18n.ts` | names, subtitles, every line, EN + ES |
| `src/app/play/engine/town-life.ts` | voices, `setContext`, the two-line tag |
| `src/app/play/engine/engine.ts` | `setKeeperContext` |
| `src/app/play/side-scroller.component.ts` | `tickKeepers` |
| `src/app/shared/npc/npc.model.ts` (+ spec) | `storyBeat` condition, act-aware rows, new pool lines |
| `src/app/shared/npc/npc-dialogue.service.ts` | `storyBeats` in the context |
| `src/app/codex/codex-people.component.ts`, `people.i18n.ts`, `codex.component.*` | People of the Realms |
| `scripts/check-meaning.js` | People entry + passage use |
| `scripts/seamworks-engine.test.cjs` | 2 new tests (names/subtitles/pools/entries/cross-refs; newest-first, never unreached, survives re-entry) |
| `e2e/play-life.spec.ts` | subtitles in every town (EN + ES); act-aware walk past the act break vs a fresh save |

## Tests

- Karma `keeper-lines.spec.ts`: 4–8 lines each, one pool per keeper; **never a
  line for an unreached beat at any point of the story**; deed lines only after
  the deed; newest first; `keeperDeeds`; EN + ES for every name, subtitle and
  line (and lines actually translated); canon keepers only say `DIALOGUE`;
  named people's subtitles are the approved role titles.
- Karma `npc.model.spec.ts`: `storyBeat` gates (and a context without beats
  reaches none); every act-aware row names a real beat and wins once reached.
- Harness: as above; the Phase 4 chatter test is unchanged (line 1, then 2).
- e2e `play-life.spec.ts`: the five-town walk now also checks each person's
  subtitle; the Spanish walk checks Spanish subtitles; a save past the act
  break hears Kael, Mara and Edrin's act-break lines first; a fresh save hears
  only first lines.

## Art briefs (follow-ups)

- New figure keys, unpainted (placeholder draws): `npc-tomas-rill-figure`,
  `npc-ilyra-venn-figure`, `npc-rook-sable-figure`, `npc-sera-quill-figure`.
  The six renamed role keepers keep their old keys
  (`npc-bench-smith-figure` is Mara's, etc.); retitle the briefs in
  `docs/art-commissions/` with the personal names when they are next touched.

## Not done (on purpose)

- The Bible people's **quest chains** (Honest Seams, Roofs and Rivets, …) and
  the three story stations (Witness Prisms, Court Lanterns, Mirror Map) belong
  to S5/S6; the people stand where those stations will go.
- Chapter-choice lines (ch. 1–5) wait for Act II; nothing past the act break is
  said.
