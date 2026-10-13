# Lore addendum

**Written for the game, pending owner review.** Every line here is used in
game. Each entry names the canon passage it builds on; nothing here
contradicts canon or adds a canon name. Canon lives in
`~/Documents/1. Projects/Eclipse Realms/docs/03-lore-and-design/`:

- **Codex**: `eclipse-realms-item-lore-codex-proposal.md` ("Runes — compact
  principles of the Godforge", the 22-rune table)
- **Atlas**: `eclipse-realms-creature-atlas-proposal.md`
- **Canon**: `eclipse-realms-lore-and-art-direction-canon.md`

Context: the owner's rule of 2026-10-13, "one name, one meaning per rune; the
canon rune table is the source of truth" (meaning audit #11, #12).

## Runes: what was merged and removed

### The ten "Rune of …" reagents merged into Forge runes

Each Art Bible reagent named an idea the canon table already gives a rune. The
reagent is gone; recipes take the Forge rune itself, spent from the Rune Forge
ledger (`CraftingIngredient.rune`).

| Reagent (removed) | Forge rune | Why (canon line it matches) |
|---|---|---|
| Rune of Radiance | **Glint** | Its item text: "they literally add light to items". Codex, Glint: "The smallest visible proof that an event occurred." |
| Rune of the Solstice | **Aether** | Its item text: the turning of the light, "12 small suns". Codex, Aether: "The lift in a system that makes it reach beyond its present form"; the in-game Aether is "Light, crystallised." |
| Rune of Hollow | **Hollow** | Same name. Codex, Hollow: "The useful absence that prevents a vessel from becoming a prison." |
| Rune of Erasure | **Eclipse** | Its item text: "the Umbral Realm's power to make things not-exist". Codex, Eclipse: "The pressure of one possibility passing over another." |
| Rune of Starfire | **Aether** | Its item text: star sapphires, stars as "reachable objects". In-game Aether: "Light, crystallised." |
| Rune of Void Navigation | **Rift** | Codex, Rift: "A passage created by difference, dangerous because it connects what should not be identical." |
| Rune of the World-Root | **Convergence** | Its item text: the tree "whose roots hold Eclipse Realms together". Codex, Convergence: "Agreement that keeps differences visible." |
| Rune of the Forge | **Forge** | Same name. Codex, Forge: "Deliberate change through will, matter, memory, and cost." |
| Rune of Cinder | **Ash** | Its item text: pumice that "cooled only on the outside". Codex, Ash: "it remembers heat after flame is gone." |
| Rune of the Underhearth | **Nox** | Its item text: "a place so deep that even fire is compressed into something else". Codex, Nox: "The depth in a system that lets it retain what light would wash away." |

Rune of Dawn's Edge, Rune of the Root and Rune of Overgrowth were used by
nothing and were removed outright (audit #11).

### Mote, Seam and Ledger removed

None is in the canon table, none was ever painted, and none has a mechanical
effect a canon rune lacks, so none is kept:

| Rune | Socket effect | Canon rune that already does it | Decision |
|---|---|---|---|
| Mote | XP | Sigil (rare), Aether (legendary) | Removed. Its one socket word moves to Ember. |
| Seam | Magic Find (was Loot quality, folded in #5) | Glint (same tier) | Removed. Its socket word moves to Rift. |
| Ledger | Magic Find (was Loot quality) | Rift (same tier) | Removed. Its socket words move to Ash. |

## Lines written for the game

### Socket words re-keyed to canon runes (`shared/enchanting/socket-words.ts`)

- **Mothlight** (Ember). Lore: "A small warmth worn close: a beginning that
  has not yet decided what it will light. The Archivum recommends it to
  apprentices." Clue: "A contained beginning, worn rather than swung." Builds
  on Codex, Ember: "A contained beginning that can warm, signal, or ignite the
  wrong thing."
- **Wayfarer** (Pulse + Rift). Lore: "One beat of the Verge, and a passage held
  open between two realms that must stay two. Carried by everyone who crosses
  on purpose." Clue: "A heartbeat, then the passage it beats across." Builds on
  Codex, Pulse ("A repeating measure that proves a system is still listening")
  and Rift ("A passage created by difference…").
- **The Archivist's Ledger** (Ash + Sigil). Lore: "The record of what was
  spent, countersigned. The Archivum keeps two copies and disagrees with
  itself about which is the original." Clue: "What was spent, and the
  signature under it. Worn, not swung." Builds on Codex, Ash ("The record of
  what a process has spent") and Sigil ("A promise made visible enough to be
  challenged").
- **Codex of the Unmade** (Codex + Ash). Lore: "The page they voted to forget,
  filed against the ash of what was lost. The vote was not unanimous and the
  filing is why." Builds on Codex, Codex ("Knowledge that remains useful only
  when its source can be questioned") and Ash.

### Ember Delve finds (`shared/collection/collection.model.ts` SEED_LORE, audit #15)

Reused text, not new lore, except the two block lines:

- **Shadow-Root Cutting**: "Under the Godforge a tree grows downward, toward
  the crack. This is a piece of its shadow." From Verrin's Delve order
  (`delve-verrin-shadow`).
- **Glowcap**: from the Grotto inscription "Where the Light Leaks".
- **Godforge Fragment**: "A piece of the Godforge. Only a Keeper, attuned to
  runes, can carry one safely." Builds on Canon: the Keeper is "a mortal
  attuned to runes and capable of safely carrying Godforge fragments."
- **Kael's Hammer**: Kael's own Delve order (`delve-kael-seam`), quoted.
- **Dirt block / Basalt block**: functional lines (what they are for).

### Creatures (`codex/bestiary.ts`, audit #14)

The Cinder Bailiff and Seam Eater Bestiary notes quote the Atlas's "Location
and role" column verbatim; no new lore.

## Not covered

Stat names, recipe blurbs, socket words and Collection lore are English-only
data tables in the game today (no ES column exists for them); the lines above
are English only for that reason. Every new i18n-table string in this work has
EN and ES.
