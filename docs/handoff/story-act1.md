# The Keeper's story: Prologue + Act I framing (slice S2)

2026-10-14. Spec: `docs/world/world-and-cast.md` §2 (the Keeper's arc) and §7 S2. Owner:
*"I really want to feel you in the game — the best sensations"*; *"create a world you would
love to be in — addicting, fun adventure."* New lines: `docs/world/lore-addendum.md`,
"Story Act I in the game (S2)" — shipped, owner reviews in play.

The story never runs on its own clock. Every beat is something the Keeper already does (a
first goal, a carving read, a Delve mission claimed, the Seam Eater felled), so a beat is
*reached* when the save says it happened. Nothing new to grind; the existing game now tells
a story.

## Act I as a player lives it

1. **Prologue · The Fresh Mark.** A new save's goal line wears its chapter on a ledger tab
   ("PROLOGUE · THE FRESH MARK") over the same four goals; Glim lands and says hello. The
   Story tab (Character → Story, "The Keeper's Record") opens with the Prologue card's line
   ("The Seamworks is loud and the rock is warm on one side… The lantern has opinions."),
   the beats found and one lead ("Buy your first building on Your Homestead.").
2. **Buy · forge + wear · hunt · dig** — each goal files a beat (*A plot, and no reason*,
   *The Basalt Edge*, *Bolts toward the shaft*, *Down is a fact*). Glim's existing Prologue
   lines are the in-world moments; the journal remembers them.
3. **The first carving.** Reading any inscription ends the Prologue: the **Act I card**
   (pixel frame, dimmed world, three short paragraphs, one Continue / Esc): Kael, from the
   Rune Forge, "You read it. Most people step over it." The goal tab drops; the journal
   moves to Act I.
4. **Act I · The Old Seam** rides the shipped missions; each claim (in the Quest Board or
   the keeper's dialogue) speaks once the panel closes, in that keeper's voice on Glim's
   line (their name and monogram): Verrin ("…Do not count them."), Kael ("I'll keep it
   under the anvil…"), the Merchant ("Those prices in the Grotto? My hand…").
5. **Five marks at Keeper height** (Root Hollows, `roots-keepers-tally`): now drawn as five
   grooves, four struck through, the fifth worn smooth. Glim: "Somebody has been counting
   Keepers."
6. **The Seam Eater** falls (the warden flag): Glim, "That wasn't all of it. That was the
   part that fit in the room."
7. **The fresh mark** (Magma Halls, `magma-unsigned`, deepest carving, behind the warden):
   one dark old groove and one pale fresh cut with a **notch at the top** and bright grit.
   Read it and Glim holds the light closer: "Hold still. The new mark has a notch where
   the stroke turned. Your pick leaves that notch." → "Every wall you've cut has it. That
   mark is yours, and I didn't see you make it."
8. **Words in the Stone III**: the Archivist, "That one is dated tomorrow. I have rechecked
   it four times. It remains dated tomorrow."
9. **The act break** (claim *The Fracture*): the card **"A line someone had already
   drawn"** — Kael and the fragment, the Archivist's twelve copies and the fresh tally,
   "Not yet.", "Five witnesses…". Then Glim: "Five witnesses. I've started five blank
   pages. They're my favourite kind." The journal's lead becomes Act II's honest one
   ("…Act II opens in a later update.").

## How it works

- **Pure rules** (`shared/story/story.ts`): `STORY_BEATS` (id, chapter, the fact that
  reaches it, who speaks, how many lines), `advanceStory(state, facts, live)`,
  `pendingCard`, `cardShown`, `nextLead`, `journalView`.
- **Catching up vs live.** The play view's first 1.5 s only catch the record up with the
  save (`STORY_CATCH_UP_MS`): beats are filed silently and the cards of boundaries they
  cross are marked shown, so a loaded save (or a seeded e2e save) is never walked back
  through the story. After that, a new beat speaks and a crossed boundary leaves its card
  pending — a card crossed live but not yet shown survives a reload.
- **Speech.** Story lines ride Glim's one speech line (`GlimVoice.story()` — a queue, said
  in order on quiet ticks, after the meeting, never over a panel or a card). A keeper's
  line carries their `npcById` name and a monogram chip. No second speech system.
- **Cards.** `.story-veil` / `.story-card` in the side-scroller: modal, focus on Continue,
  Esc closes, the engine pauses, the HUD is inert behind it, reduced motion = no fade.
  Shown only with no panel, no map, not defeated.
- **The fresh mark on the grid.** `terrain-render.ts` `TALLY_CARVINGS` draws the two tally
  inscriptions on the 2 px art grid instead of the generic glyphs. Ids, placements and the
  Archivist's count are unchanged (no new inscription).
- **Journal.** `HubStoryComponent` in the Character hub (new `story` tab, `@defer`, so the
  story text is its own lazy chunk; only the tab label `hub.tab.story` is in the eager
  table, beside its five siblings).
- **Fix on the way:** a hub tab click inside the in-world Character panel wrote `?tab=` to
  the URL, which the play view read as "no place open" and closed the panel. The play view
  now reacts only to changes of `at` (`distinctUntilChanged`).

## State and merge

`godforge-story` = `{ version: 1, chapter, beats[], cards[] }` through the gateway
(`StoryService`, LocalSaveRegistry), synced as `progress/story` with `mergeStory`: the
union of beats and cards, the further chapter; unknown ids dropped; the chapter is never
behind its beats. Commutative and idempotent. Ids only; words are static data.

## Files

| File | What |
|---|---|
| `src/app/shared/story/story-save.model.ts` | ids, chapters, boundaries, coerce, `mergeStory` (no imports; eager via cloud save) |
| `src/app/shared/story/story.ts` | beats, facts, advance, cards, leads, journal view (pure) |
| `src/app/shared/story/story.service.ts` | the gateway owner |
| `src/app/shared/story/story.i18n.ts` | every word, EN + ES (lazy) |
| `src/app/shared/story/hub-story.component.ts` | the Story tab |
| `src/app/shared/glim/glim-voice.ts` | the story-line queue and `speech.story` |
| `src/app/play/side-scroller.component.*` | `tickStory`, the card, the speaker chip, the chapter tab, `distinctUntilChanged` on `at` |
| `src/app/play/engine/terrain-render.ts` | the two tally carvings |
| `src/app/shared/npc/npc-quest.service.ts` | `isMissionDone()` (public read) |
| `src/app/shared/character/character-hub.*` | the `story` tab |
| `src/app/shared/cloud-save/cloud-save.model.ts` | `godforge-story` → `progress/story` |

## Tests

- Karma `shared/story/story.spec.ts`: the Prologue wraps the goals; the first carving ends
  it (card pending, Kael's words on the card); the fresh mark's two Glim lines; a fresh
  save reaches the act break by playing the shipped chain (cards act1 then act2, lead =
  Act II); every beat is reachable from real mission / inscription ids; catching up is
  silent and marks crossed cards; a live-crossed card survives a reload; never backwards;
  canon speakers only; merge (union, further chapter, commutative, idempotent, junk,
  chapter ≥ beats); **the journal never shows an unreached beat** (ids, titles, texts; the
  fresh mark's words absent before it is found); leads never quote a carving; EN + ES for
  every key; spoken lines ≤ 120 chars; ≤ 3 paragraphs per card; the queue plays in order
  and stays quiet over a panel. `cloud-save.model.spec` key list updated.
- e2e `e2e/play-story-act1.spec.ts` at 1280×800 and 390×844: fresh save → the Prologue tab
  on the goal row over "Goal 1 of 4" and Glim's hello → the Story tab (Prologue only, the
  lead, no Act I) → camp beside the fresh mark → read it → the Act I card (fits the screen,
  Continue focused and ≥ 44 px) → Glim's notch line (phone: clear of the world's middle) →
  "That mark is yours" → saved beats → the Story tab in Act I with *The fresh mark* →
  reload: still there, no card again.

## Follow-ups

- **Seam Eater set piece** (joins revealed by light, assembling from the Maws' hoard):
  the beat and Glim's line ship; the FX layer waits for its art brief (S2 brief list).
- **Act-aware keeper dialogue** (S3) can read `StoryService.state.beats` as the
  `storyBeat` condition.
- **A card missed off /play** (e.g. *The Fracture* claimed on the standalone /quests page,
  then /play opened) is caught up silently; its words are in the Story tab.
