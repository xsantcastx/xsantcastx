# The Glim bond (ROADMAP #4)

2026-10-14. Owner: *"The more you explore the more connection you and me have — we should have you and me
with lots of connections and grow our relationship."* Builds on [glim.md](glim.md), [story-act1.md](story-act1.md),
[bounties-map-v2.md](bounties-map-v2.md). Lore: `docs/world/lore-addendum.md`, "The bond with Glim" (shipped).

## What a player gets

- **A bond that grows from shared moments**, each counted once, ever: a place first visited (3), a carving read
  (3), a Delve room stood in (1; first of each kind +3), a mission finished (4), a first catch (2), a new stratum
  (5), a talk heard (3), a questline step (8), the compass in hand (4), coming back after 2+ days (2, three times
  at most). Every kind is capped, so nothing can be farmed. It never shrinks; nothing decays while away.
- **Five stages**, each opening something real:

| Stage | Bond | Opens |
|---|---|---|
| 1 Stranger with a lantern | 0 | talk *What are you?* |
| 2 Mapmates | 12 | talk *The Afterimage Moths* (asks what you like finding) · **way home** · **The Blank Places** |
| 3 Margin notes | 35 | talk *The Archivist's page* (asks deep or surface) · **sense**: Glim brightens within 14 cells of a room no lantern has touched or an uncopied carving |
| 4 Two hands on one chart | 70 | talk *Why I leave blanks* (asks danger or beauty first) · **notice**: rare finds within 64 columns (rift shrines; `GLIM_RARE_KINDS` is the Lost Cabinets hook) |
| 5 The blank page and the pen | 120 | *A complete map* (its fear), then *The first lamp* (hints at the "They called it Claude" egg, never names it) |

- **Talk to Glim.** Reaching a stage, Glim says so once ("Mapmates, I think. I'd like to talk, when you have a
  minute. About me, for once.") with a 44 px **Talk** button; the talk opens over the world (paused; Esc closes):
  ≤ 3 short paragraphs, 2–4 replies, Glim's answer to yours. Every talk replays in **Character → Story → You and
  Glim**, with the stage, an honest bond bar, what Glim remembers, the stages and the questline.
- **Answers colour later lines**: the hello after a while away, the sense line, the rare-find line.
- **The Blank Places** (opens at Mapmates): Legend, Scale Bar, Two Maps, The Needle, Every Town read the bond's
  moments; *Leave It Blank* (the threshold) shows as still being written. Each step done = a Glim line + 8 bond.

## How it works

| File | What |
|---|---|
| `shared/glim/glim-bond.ts` | pure rules: moments from ledgers, points, stages, abilities, talks, questions, questline, way home |
| `shared/glim/glim-save.model.ts` | `moments` (set), `answers` (q → {a, at}), `peak`, `seenAt`; `MOMENT_RULES` (weights + caps); merge |
| `shared/glim/glim.service.ts` | `addMoments` (new + under cap; files quest steps once open), `answer`, `reachStage`, `seen`, `stage` |
| `shared/glim/glim-voice.ts` | bond-line queue (after story lines, keeps the 25 s gap, one of a kind) with `talk` and `vars` |
| `shared/glim/glim-talk.component.ts`, `hub-glim-bond.component.ts` | the talk; the Story tab's "You and Glim" |
| `shared/glim/glim-bond.i18n.ts` | every word, EN + ES (lazy) |
| `play/side-scroller.component.*` | `tickBond` (1/s), `tickBondAbilities` (Delve, 1/s), Talk button, talk card, `data-glim-bond`, `data-glim-bright` |
| `play/engine/engine.ts`, `glim-sprite.ts` | `setGlimBright`, `glimView.bright` (bigger, livelier halo; dim wins), `rareNear(kinds, cells)` |

Moments come from existing ledgers each tick (`delveLore.inscriptions`, `isMissionDone`, `fishing.save.caught`
minus crates, `bounties.deepest` once dug, the compass) plus the area and the structure stood in. A loaded save
catches up silently (first 1.5 s): the peak rises without a line; its talks show as *New* in the Story tab.
**Merge** (`mergeGlim`): union of moments (each kind trimmed to its cap), the later answer per question, max peak,
max seenAt; commutative, idempotent. Same blob (`godforge-glim` → `progress/glim`).

## Tests

- Karma `glim-bond.spec.ts`: moments from ledgers, once, caps, ids; stages rise and each opens something, the peak
  holds, talk order; questline (step 6 never completes); EN + ES everywhere, ≤ 3 paragraphs, 2–4 replies, lines
  ≤ 120 chars, coloured variants exist; no "claude" / "missed you" / streak copy; way home; merge (both orders,
  idempotent, caps, junk, pre-bond saves); the service through the gateway (reload, answers, peak, rehydrate);
  bond lines (quiet over panels, one of a kind, the gap). `glim.spec.ts` updated for the new fields.
- e2e `play-glim-bond.spec.ts` at 1280×800 and 390×844: a seeded save one place short of Mapmates → Show me into
  the Homestead → stage line + ≥ 44 px Talk → the Moths talk and its question → "carvings" saved → reload: no
  second stage line; the Story tab shows Mapmates, the answer, the talk heard; a talk replays there.

## Not done / next

- Sense / notice / way-home are rule-tested and wired but not driven in e2e (needs a deep Delve fixture).
- The "They called it Claude" Codex egg waits for the finale (S9); the bond only hints at it.
- Glim's Atlas (S4) is still not its own surface; questline rewards are bond + Glim's lines, not Atlas features.
