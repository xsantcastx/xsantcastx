# Story Act II · Five Witnesses

2026-10-15. Builds on `docs/handoff/story-act1.md` (beats, cards, the Story tab), `npc-depth.md`
(act-aware keeper lines), `underhearth.md`, `rift-gates.md`, `realm-delves.md`, `celestial-delve.md`,
`lost-cabinets.md`, `glim-bond.md`, `pets.md`. Lore: `docs/world/lore-addendum.md`, "Story Act II in the
game" (shipped — owner reviews in play).

Act I ended with Kael asking for "five honest accounts, one from each realm". Everything shipped in the
last two days is those accounts: the Four's Banked Furnace (Infernal) and the four realm Delves behind
the Rift Gates (Umbral, Verdant, Luminous, Celestial). The Archivist's Lost Cabinets are a side page; Glim
has the last word in every scene and hints at the first lamp. The act ends on the light coming up the
shaft: Act III · The Fivefold Lock, Starfall Deep.

## What a player gets

Act II in the Story tab is nine beats: the three Underhearth "first pages" (unchanged) and six new ones.
Seven of them play a **scene** — a pixel-framed card over the world (or inline in the Story tab):

| Beat | Reached when (already in the game) | Who speaks (portraits) | Reward |
|---|---|---|---|
| `a2.furnace` *Let it end* | *Let It End* claimed (`verrin-four-3`) | Kael, Verrin, Kael, Glim | Codex page **The Witness Accounts** |
| `a2.ink` *The account in the dark* | *The Unlit Warden* claimed (`verrin-ink-3`) | Verrin, Rook Sable, Verrin, Glim | 2 Waystone Shards |
| `a2.root` *The first cut* | *The Graftmother* claimed (`kesh-roots-3`) | Kesh Arbo, Siv Moss, Siv, Glim | title **The Ungrafted** |
| `a2.prism` *A promise held still* | *The Hollow Sun* claimed (`aureth-prism-3`) | Aureth, Lune Coyne, Aureth, Glim | title **Dawn-Witness** |
| `a2.orrery` *The assumed down* | *The Fallen Ephemeris* claimed (`sera-wells-3`) | Sera Quill, the Archivist, Sera, Glim | 2 Waystone Shards |
| `a2.cabinets` *Every column but one* | 4 Lost Cabinets opened, after *The Fracture* | the Archivist, Hollis Fenn, the Archivist, Glim | 3 Courier's Honeycomb |
| `a2.lamp` *The light coming up* | all five accounts above (cabinets not needed) | Kael, the Archivist, Kael, Glim | title **Witness-Keeper**, then the **Act III card** |

No new grind: every condition is a mission claim or a cabinet the player already finds. The realm
accounts come in any order. Each reward names its use on the card (titles: worn before your rank,
switchable in the Market's Title Prefix; shards: Rift Anchors; honeycomb: every pet's favourite).

**The cliffhanger** (card `act3`, "End of Act II · The light coming up"): the fragment turns over on
Kael's anvil by itself; under the Underhearth the rock gives out and there is sky, and a light is coming
up; Kael says "Starfall" aloud, and "Five witnesses, and a sixth mark at Keeper height." The Story tab
then shows Act III · The Fivefold Lock ("Still being written"), lead: "Something is coming up the shaft…
Act III opens in a later update." Glim's last line: "Someone patient left a lamp lit down there. I'd like
to meet them." — the first-lamp easter egg hinted, never named (a spec forbids the name in the table).

**Keepers react** (npc-depth system): new beat-gated town lines for Orla Stave (furnace), Verrin and Rook
(ink), Kesh and Siv (root), Aureth and Ilyra (prism), Sera and Nox (orrery; Sera again at the act's end),
the Archivist (cabinets) and Tomas (the act's end). Canon keepers' new lines are also `DIALOGUE` rows with
`storyBeat` (Aureth, Verrin, the Archivist), plus two dialogue-orb rows for Kael (his town pool is full at 8).

## How it works

- `shared/story/story-save.model.ts`: new beat ids (`a2.ink`…`a2.lamp`), chapter `act3`, boundary
  `a2.lamp → act3`, card `act3`, and `scenes: StorySceneId[]` in the record (the reward's receipt).
  `coerceStory` drops a scene whose beat is missing; `mergeStory` unions scenes. Old blobs without
  `scenes` read as `[]`; an older device's merge never erases them (spec).
- `shared/story/story.ts`: the beats' conditions (`StoryFacts.cabinets`, from `CabinetsService.count()`),
  `STORY_SCENES` (speakers per line + reward), `STORY_PORTRAIT` (speaker → `npcPortrait` id: `kesh` is the
  Lodge Warden, `siv` the Expedition Steward, `lune` the Croupier, `hollis` Hollis Fenn), `pendingScenes`,
  `scenePlayed`, `accountsOpen/Heard`, journal beats carry `scene: 'new' | 'played' | null`.
- `StoryService.playScene(id)`: receipt first (written through the gateway), then the reward — a title via
  `EconomyService.grantCosmetic('title-prefix', …)` (three new granted-only variants in `economy.model.ts`),
  a stack via `InventoryService.grantStack('story-scene:<id>', …)` (idempotent), the Codex page derived
  from `scenes`. A second play (another tab, a replay) pays nothing.
- `story-scene.component.ts`: one line at a time (portrait 64 px, name, line), Next / Skip (≥ 44 px), then
  the reward and its use, "Take it". Used in `/play` (`.story-scene-card` in the story veil) and inline in the
  Story tab ("Play the scene · New scene" / "See it again").
- **When a scene opens in /play** (`side-scroller.component.ts` `tickStory`): after the 1.5 s catch-up, a
  scene whose beat was reached live opens as soon as nothing else is open; of the scenes a loaded save
  already owes, one opens per visit and the rest wait in the Story tab (no queue of cards on return).
  Scene before card, so the act's last scene plays before the cliffhanger. Esc/close still files the scene
  (a reward is never lost to a skip). Glim stays quiet, the HUD is inert, the engine pauses, like a card.
- **Codex**: `codex/codex-accounts.component.ts` (deferred in the Collection tab): blank until the
  Furnace's scene; then the five accounts, each one's words only once its scene is played.
- Words: `story.i18n.ts` (lazy, EN + ES): beats, leads, 28 scene lines, speaker names, reward names/uses,
  the Act III card and the Codex page. Keeper lines: `play/world/life.i18n.ts` (≤ 90 chars, harness).

## Tests

- Karma `shared/story/story.spec.ts`: realm beats from their guardians' chains (entering is not enough), the
  docket only after The Fracture (never jumps a chapter), the act's end needs all five (scene before card,
  chapter → act3), scenes owed/played/receipt, coerce + merge (union, commutative, idempotent, an old blob
  keeps scenes), the Codex page, journal scene flags, 2–5 lines with portraits and Glim last, ≤ 140 chars
  EN/ES, every reward real, no name for the first lamp's maker; `StoryService` pays once (receipt on disk,
  reload never repays, unreached beat never pays). Act I tests updated for Act III existing.
- `play/world/keeper-lines.spec.ts` + the engine harness: unchanged rules, new lines pass (≤ 8 per keeper,
  canon lines are DIALOGUE).
- e2e `e2e/play-story-act2.spec.ts` at 1280×800 and 390×844: seed the furnace chain → the owed scene opens
  (portraits on every line, Glim last, fits the screen, Next focused ≥ 44 px) → the Codex page reward →
  next visit the Ink Deeps' scene pays 2 Waystone Shards → the Story tab (played, see it again without
  repaying) → reload: nothing replays or repays; then five accounts → the act's last scene → Witness-Keeper
  equipped → the Story tab in Act III with "Starfall".

## Follow-ups

- Act III (The Fivefold Lock) and Starfall Deep: the act3 chapter has no beats yet ("Still being written").
- Scenes are cards; a staged in-world version (the Keepers standing at the anvil) waits for its art brief.
- The world-and-cast Bible's Act II (five town chapters: Missing Dawn, Measure That Lied…) is still the
  long plan; this act is the shipped Delve-side reading of "five witnesses". The town chapters can file into
  the same Witness Accounts page later.
