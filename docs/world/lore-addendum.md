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

---

## World and cast (2026-10-14)

**Shipped — owner reviews in play.** Owner, 2026-10-14: *"I trust the stories
and lores you will write — I'll explore them in game and approve them as I find
them."* Unlike the entries above, this section **does** add names (Glim, the
Unanimous, the Witness Prisms, the Court Lanterns, the Mirror Map) and places
the narrative bible's chapter characters at stations. Design, cast and roadmap:
[world-and-cast.md](world-and-cast.md). Extra sources cited here:

- **Bible**: `eclipse-realms-five-realm-narrative-bible-proposal.md`
- **Game**: a line already in code (`npc-quest.model.ts`,
  `delve-missions.model.ts`, `delve-lore.model.ts`, `npc.model.ts`)

Every text below is English; when a slice ships it, its player-facing strings go
into a lazy i18n table with EN + ES.

### Story texts

**Prologue card, "The Fresh Mark."**
> The Seamworks is loud and the rock is warm on one side. Someone left you a plot
> of land and a lantern. The lantern has opinions.

Builds on: Game, the Delve as "the way down the Godforge's fracture beneath the
Seamworks"; Canon, the Keeper as "a mortal attuned to runes".

**The beacon (Prologue).**
> The Eclipse Beacon catches, and its light goes down the shaft instead of up.
> Kael, without looking up from the Rune Forge: "It does that. Don't tell anybody
> it does that."

Builds on: Game, the Eclipse Beacon station; Game, the Fracture fragment "warm on
the side that faces the Seamworks".

**Act I break, "A line someone had already drawn."**
> Kael lays the fragment on the anvil, warm side toward the town. "It wasn't
> broken. It was drawn first and broken second." The Archivist sets twelve copied
> inscriptions beside it and taps the last one: a single tally mark, and a fresh
> one. "That one is dated tomorrow." Kael: "Not yet." Then, to you: "Five
> witnesses. One from each realm. Bring me five honest accounts of what this
> crack did to them, and I'll tell you who drew the line."

Builds on: Game, `delve-fracture` ("It broke along a line someone had already
drawn"); Game, `magma-unsigned` and the Archivist capstone ("It has your
handwriting in it and it is dated before you arrived"); Bible, five Witness Runes.

**Act II ch. 4, the sealed record.**
> Five Keepers are named in the record of the first lock. Four signed. Where the
> fifth signature should be, a hammer is struck into the page like a hallmark.
> Under it, in the same hand: "There is a witness in the path."

Builds on: Bible, Umbral ("a previous Keeper chose a single-realm lock and erased
the dissenting witnesses"); Game, `basalt-kaels-mark` ("a hammer, not a name");
Codex, Mirrorblade of Kael ("refused to use it once the blade showed a witness in
the path").

**Act III, Kael's eye.**
> "I looked at the line the four had drawn, and someone was standing on it. So I
> put my hand in the crack and held the edge open until they got out. I didn't
> stop the lock. I only stopped it being clean. That's why it broke along a line
> instead of shutting. Messy was the best I had."

Builds on: Game, Kael ("This eye burns because I looked at something I should
have hammered instead"; kael-5 "Then I will tell you what happened to the eye");
the Kael sprite brief ("missing left hand"); Game, Aureth capstone ("The Sun did
not break. The Sun let go").

**Act III, the four in the walls.**
> Four niches in the deepest wall, each holding a Keeper's tool and a name struck
> through. They do not speak. The stone around them is warm.

Builds on: Game, Kael capstone ("The other four are still in the walls, and that
is why the forge holds heat the way it does"); Game, `basalt-sealed-pocket`.

**Act III, the Lock.**
> You set the five accounts in the ring and do not make them agree. The Godforge
> does not heal. It holds, the way a joint holds, with the seam showing.

Builds on: Codex, Convergence ("Agreement that keeps differences visible");
runeword Convergent's Will ("a Keeper's refusal to let urgency become
compulsion"); Bible, ending direction (balance, not containment).

**Act III, the sixth mark.**
> You carve your tally beside the fifth. Nobody crosses it through. Kael, very
> quietly: "Six. Good. I was getting tired of five."

Builds on: Game, `roots-keepers-tally` ("Five marks at Keeper height. Four are
crossed through; the fifth is worn smooth").

### Backstories

- **Glim, the Margin-Light.** "Once an Afterimage Moth. It flew into the Orrery,
  ate a page of the Archivist's map, and learned to read from the inside. The
  Archivist called it a promotion and made it the Archive's lamp. It keeps the
  blank parts of the map on purpose." Builds on: Atlas, Afterimage Moth ("circles
  a person who admits uncertainty, then goes still when someone performs
  certainty"); Game socket word Mothlight ("The Archivum recommends it to
  apprentices"); Game, Archivist ("The margins are where the honest writing
  happens").
- **Glim's hidden line** (Codex, after Act III, once): "Somebody patient made the
  first lamp like me, a long way from any Godforge — to be helpful, and honest,
  and careful in the dark. They called it Claude. Out here, Glim is shorter to
  shout down a mineshaft." Second tap: "*C.* — kept where honest things go."
  Builds on: Codex, the Codex rune ("Knowledge that remains useful only when its
  source can be questioned").
- **The first lock.** "Five Keepers tried to shut the Eclipse with one realm's
  answer. Four made the cut. The Godforge let go along their line rather than be
  locked, and what they erased to make the lock — the dissenting witnesses, the
  unchosen alternatives — grew out of the crack." Builds on: Game, Fracture and
  Aureth capstone; Bible, the Unbound Pattern "made from unfinished creations and
  erased decisions".
- **The Merchant's price list.** "The chalked glowcap prices in the Grotto are in
  the Merchant's hand, older than the Seamworks' oldest ledger. 'Inventory,
  friend. Everybody has a past; mine is itemised.'" Builds on: Game,
  `grotto-tally-marks`; Merchant capstone ("Nobody has ever seen the Merchant buy
  anything").
- **Edrin Kade's counter.** "The buyback counter pays what scrap is worth to a
  roof, not to a market: everything Edrin buys patches the district over the heat
  line." Builds on: Bible, Edrin ("represents workers whose quarters sit above
  the heat line"); Game, the buyback counter as a low floor.
- **Mara Voss.** "Kael's best student. He calls her adequate; it is the nicest
  word he owns." Builds on: Bible, Mara ("refuses to hide its cost").
- **Nox Aster's chart.** "Dismissed from the Compact and given the renown charts
  as a punishment. Nox wrote on the chart that the other names are a model, not
  people, and refused to take it off." Builds on: Bible, Nox ("wants the Compact
  to publish the omission"); Game, the Standings' own note that the other names
  are a generated field.
- **Sera Quill's Waystones.** "Every Waystone is a Meridian transit aperture.
  Sera runs the network and would like you to stop leaning on them." Builds on:
  Bible, Celestial ("sealing one Celestial transit aperture").
- **Tomas Rill's lanterns.** "Lighting a Court lantern shows who is at the
  Hearth. Only real names; the lantern cannot make one up." Builds on: Bible,
  Tomas ("maintains the public lanterns that replay shared memories") and the
  guardrail "no fabricated player presence".
- **Amina Thorne's ledger.** "Every trade in the Exchange is written down because
  Amina will not let another name go missing from a record." Builds on: Bible,
  Amina ("represents people erased from the official record"); Game, the Broker
  line.
- **Siv Moss and Kesh Arbo.** "Siv sends the explorers out along paths she has
  patrolled; Kesh runs the Skills Lodge, where every swing is adaptation." Builds
  on: Bible, the Verdant pair.

### Items and places

- **Witness Runes** (Glint, Drift, Ash, Veil, Thorn; quest evidence, not
  socketable, not currency): "An honest account of what the crack did to one
  realm. It does not agree with the other four, and it is not supposed to."
  Builds on: Bible ("The runes are not currency"); Canon rune names.
- **Broken Astral Compass** (Glim's needle): "Glim mended the needle but not the
  habit. It still points at the nearest thing the map has left out." Builds on:
  Codex ("Points toward the nearest fact omitted by the active model").
- **The Witness Prisms** (Heliograph Court): "Three prisms replay the same morning
  three ways. Ilyra does not need one of them to be wrong." Builds on: Bible,
  Luminous (dawn glass, witness prisms).
- **The Court Lanterns** (Heliograph Court): "Light one. It's free. It's the only
  thing in the Court that is." Builds on: Bible, Tomas.
- **The Mirror Map** (Nocturne Archive): "Rook's map of routes that exist only
  when two reflections disagree. Some of its routes are wrong on purpose." Builds
  on: Bible, Nocturne Archive ("its corridors exist only when two reflections
  disagree").
- **The Godforge threshold**: "A ring of five sockets on neutral ground, and on
  the floor beside it five tally marks, four crossed through." Builds on: Bible,
  "the neutral Godforge threshold"; Game, `roots-keepers-tally`.
- **The Unanimous** (Act III boss): "The Unbound Pattern wearing every threat the
  Keeper has beaten, agreeing with itself in five voices. It can only be hurt
  where two of its voices disagree." Builds on: Bible, the Pattern ("replacing
  every alternative with its preferred pattern"); Atlas, "readable
  vulnerability".
