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

### The Reels (`shared/reels/reels.i18n.ts`, `reels.lore`; EN + ES)

"Three obsidian drums in the Nocturne Archive, cut with what the realms spend:
ore, runes, a Maw's iron grin, a Heartstone. When three agree on a line the
Archive pays as if its record had been right all along. When the Eclipse turns
up three times, one possibility passes over another, and for a few turns the
runes count for more."

Builds on Canon (Umbral: the Nocturne Archive, an obsidian library whose
corridors exist only where two reflections disagree) and Codex, Eclipse: "The
pressure of one possibility passing over another." Every symbol is an existing
world thing (Cinder Ore, Ash and Ember runes, Rivet Maw, Infernal Heartstone,
the Eclipse rune); it is run by the existing Croupier. No new names.

### The Croupier's other three games (shipped — owner reviews in play; EN + ES)

All three stand in a row east of the Reels and are run by the existing
Croupier. No new names; every noun is an existing world thing.

- **Rune Drop** (`shared/rune-drop/rune-drop.i18n.ts`, `runeDrop.lore`): "The
  Archive keeps a board of Godforge pins for questions it cannot settle in ink.
  A rune let fall through them picks a side at every pin, as a reflection does,
  and the record is written wherever it comes to rest." Builds on Canon (the
  Nocturne Archive; corridors where two reflections disagree) and Codex
  ("Runes — compact principles of the Godforge").
- **Seam Sweeper** (`shared/seam-sweeper/seam-sweeper.i18n.ts`, `seam.lore`):
  "A slab of Delve seam the Archive keeps under glass, recut every night. The
  Croupier marks where the roof will give before you swing; the record says
  only how far you dared to dig." Builds on the game's Ember Delve (seams,
  collapses) and the Nocturne Archive as a place that keeps records.
- **Eclipse Ascent** (`shared/eclipse-ascent/eclipse-ascent.i18n.ts`,
  `ascent.lore`): "From the Archive's roof the fractured moon mirror can be made
  to pass over its own reflection. While one possibility slides over another the
  record swells; when the two stop agreeing, the eclipse breaks and the page is
  blank again." Builds on Canon (Umbral: "beneath a fractured moon mirror") and
  Codex, Eclipse: "The pressure of one possibility passing over another."

## Not covered

Stat names, recipe blurbs, socket words and Collection lore are English-only
data tables in the game today (no ES column exists for them); the lines above
are English only for that reason. Every new i18n-table string in this work has
EN and ES.

---

## The Delve and beyond (Phase 6+)

**Shipped — owner reviews in play.** Owner, 2026-10-14: "I trust the
stories and lores you will write — I'll explore them in game and approve them
as I find them." Every entry below is approved to ship as written; it is the
lore for [delve-and-beyond.md](delve-and-beyond.md) and goes into the game
slice by slice. New proper names are marked *(new)* only to tell them from
existing ones. Each
story names the passages it builds on. Two more sources are cited besides the
three above:

- **Bible**: `eclipse-realms-five-realm-narrative-bible-proposal.md` (a
  proposal itself; only its hazards are borrowed, never its factions,
  characters or antagonist)
- **In-game**: shipped text in this repo (`npc.model.ts` dialogue,
  `npc-quest.model.ts` reveals, `delve-inscription-lore.ts`,
  `delve-missions.model.ts`, `artbible-items.ts`, `unique-items.ts`)

Rules kept: the Void is never a sixth realm (Canon, *Runes and artifacts*); the
Keeper is not chosen and earns authority through "discovery, craft, alliances,
and restraint" (Canon, *The Keeper*); nothing names or confirms the cause of
the fracture, the antagonist or the ending (Canon, *Intentionally
provisional*); no faction names from the Bible; the Keeper is addressed as
"Convergent", as the cast already does.

### The Drowned Lamp (Grotto Mere)

Builds on: inscription `grotto-drowned-lamp` ("This is what morning looked
like, before the Eclipse. Keep it lit." Someone has kept it lit.);
`grotto-light-through-the-crack` (the glowcaps "drink" light from a crack);
the Archivist ("I do not keep the record because it is complete. I keep it
because it is not.").

> The Grotto's water is runoff. It comes down the crack from all five realms
> and arrives tasting of none of them. The glowcaps along the Mere drink the
> light that leaks through the ceiling, and the small fish drink the glowcaps,
> so every minnow in the Mere is carrying a little morning around inside it.
>
> Somebody kept the carved morning lit for a very long time. The Archivist
> found their lamp at the bottom of the Mere, still burning under the water,
> and left it there. "It was not lost," the Archivist says. "It was put down
> carefully by someone who expected to come back." On the nights when the
> crack is darkest, something large circles the lamp and dims every other
> light in the cavern, as if the morning should only be kept in one place.

**Inscriptions** (Field Notes, Grotto Mere):

- **The Waterline**: "The water rose to here once. Someone marked it, then
  marked it again a hand lower, and again. The last mark is under the
  surface."
- **For Whoever Fishes**: "Throw back the small ones. They are carrying
  something for the rest of us."

**Archivist lines:** "Fish are terrible witnesses. They remember everything
and testify to nothing. I find that restful." · "Bring me one of everything
that swims. I am not cataloguing fish. I am cataloguing what the water
remembers." · "The lamp stays where it is. Some records are kept by not being
moved."

### Flooded Seams (Basalt Caverns)

Builds on: Kael's mission ("I closed those mines when the heat stopped coming
from the rock"; reveal: "He closed them because it started to run toward
something"); inscriptions `basalt-kaels-mark` ("Mark every tunnel you open, so
the next Keeper knows what it cost") and `basalt-seam-ledger`; Atlas, Rivet
Maw ("hoards joins because an unfinished seam feels unsafe").

> When Kael closed the mines he did not fill them. He let the water have
> them. Water does not dig toward anything; it only goes down and waits, and
> that was the point. The old rails still run along the drowned galleries, and
> the Maws still pull rivets from them, one at a time, and leave them in neat
> piles at the waterline, as if somebody will be along to finish the job.

**Kael lines:** "Drain it if you must. Then look at which way the rails were
laid. They were laid toward the crack." · "A cart does not care where it is
going. I used to think that was a fault." · "Every rivet in that water was one
I meant to come back for."

### The Four Who Went Down (the Underhearth)

Builds on: In-game, Kael's reveal ("Kael was the fifth Keeper and the only one
who stayed. The other four are still in the walls, and that is why the forge
holds heat the way it does"); inscriptions `basalt-sealed-pocket` (four names
struck out; "I stayed."; "The heat in this wall does not come from the rock")
and `roots-keepers-tally` (five marks, four crossed through); Cindergnaw
("made to fell the ironwood pillars that held up the ceiling of the
Underhearth"); the merged Rune of the Underhearth ("a place so deep that even
fire is compressed into something else") and Codex, Nox ("The depth in a
system that lets it retain what light would wash away"); Codex, Cinder Ore
("heat taken from one place must appear somewhere else"); Canon, Infernal
("transformation through pressure and cost").

> Five Keepers worked the Seamworks when the crack first reached it. The heat
> began to come up wrong: not hotter, but heavier, fire pressed so long under
> the Godforge that it had started to become something that was not fire.
> Four of them went down to bank it, the way a smith banks a forge for the
> night: cover it, slow it, keep it alive but quiet. The fifth stayed at the
> anvil, because somebody had to keep the work above going while the work
> below was done.
>
> They banked it. Then they felled the ironwood pillars that held the
> Underhearth's ceiling and let the roof come down over the banked furnace, so
> nobody would open it by accident. The Magma Halls' floor is that roof. The
> four did not climb back up. What they became is the warmth in the
> Seamworks' walls; what they left is the furnace, still banked, still
> keeping its heat, and four hammer-marks cut into the rock at the places they
> stood.
>
> A banked fire is not an ended one. Verrin, who keeps count of endings, has
> never been able to count this one.

**Inscriptions** (Field Notes, the Underhearth):

- **Bank, Do Not Quench**: "Cover it. Slow it. Do not put it out. A fire
  put out has to be lit again by someone who does not know how it was made."
- **The Pillar Count**: "Sixteen pillars. We will fell twelve. Four will
  hold until we are done. After that they can do as they like." (Ironwood
  Sentinels still do.)
- **Weight**: "The coal down here is cold to the touch. Strike it and it
  remembers. Everything down here remembers."
- **Four Hammers**: "One mark for each of us, where we stood. If you find
  all four you have found where the work was. You have not found us."
- **For the Fifth**: "Keep the anvil going. Do not come down. If you come
  down, come down with someone."
- **Unsigned, Again**: "A tally mark, and beside it a second one, cut the
  same day." (Echoes the core's `magma-unsigned`; the Archivist notices.)

**Kael lines:** "You found a mark. Put your hand on it. That was the height
of her shoulder." · "I did not stay because I was braver. I stayed because I
was the worst of us at going down." · "The furnace is not angry. It is doing
exactly what we asked. That is the problem with asking." · (first defeat of
the Banked Furnace) "It is out. I thought I would feel lighter. I feel like
the forge just got colder by four."

**Verrin lines:** "This is the only ending I have never been able to file.
Help me file it." · "Banked is a polite word for postponed." · "Let it end,
Convergent. Ending is not the same as losing. I would know."

**Bestiary lines:**

- **Banked Ember** *(new)*: "Cold until struck. Every blow releases heat
  it took from somewhere else, and the tunnel gets warmer for it."
- **Ironwood Sentinel** *(new)*: "One of the four pillars left standing.
  It still walks to where the ceiling should be and shoulders it up, whether
  or not the ceiling is there."
- **The Banked Furnace** *(new)*: "It never moves. It pulls. It is a
  promise kept so long it forgot who it was kept for."

### The Light Under the World (Starfall Deep)

Builds on: In-game, the First Dawn weapon ("when the Luminous Realm cracked
open the void's ceiling and let light spill into Eclipse Realms for the first
time"); Aureth ("There are crystals in the deep hall that only answer to a
hand as practised as yours"; "Order is not the absence of chaos. It is chaos
that agreed to be useful"); Canon, the premise ("five living realms formed
around its radiance"), Celestial ("Order, revelation, orbit, precision";
"never generic heavenly white/gold"); Codex, Aether ("The lift in a system
that makes it reach beyond its present form"); Atlas, Anchor Warden ("defends
a route by repeating the last authorized trajectory"); Bible (proposal), the
gravity-shear hazard.

> Below the Underhearth the rock gives out, and there is sky. Not the sky
> above the realms: the other side of it. When the Godforge broke, its
> radiance scattered, and most of it became the five realms. Some of it did
> not. It fell, and it is still falling, very slowly, through the space
> beneath everything, and where it has caught in floating stone it glows.
>
> The Celestial instruments above were built to measure orbits. Down here the
> orbits are loose. Weight comes and goes in bands, and the stars that have
> not decided whether to burn pull at everything that comes near. Aureth says
> the crystals in the deep hall answer only to a practised hand. She does not
> say she has been there. She says she has seen the light come up.

**Inscriptions** (Field Notes, Starfall Deep):

- **Underside**: "We dug down to find the bottom of the world. We found its
  sky. Nobody has written the word for which way is up yet."
- **The Ones That Fell**: "Not every star became a realm. Some of them are
  still deciding."
- **Count the Pulses**: "Weight comes in bands. Count to four after the
  stars ripple, then jump." (A real tell for gravity shear.)
- **Orbit, Loosened**: "The Orrery above draws these paths as circles.
  Down here nobody told them."
- **A Lamp Left Lit**: "A torch, burning on bare skystone, a long way from
  any tunnel. Whoever set it here wanted something to see it."
- **For Aureth**: "If you are reading this you came down. She said you
  would. She also said she would not."

**Aureth lines:** "Light is not a thing you are given. Down there you will
have to prove it." (her shipped line, extended) · "A star that has not
decided is the most dangerous thing in any sky. Help it decide. Do not decide
for it." · "You lit it. I felt it from here. The lattice has not sung like
that since the first morning."

**Bestiary lines:**

- **Lodestar Drift** *(new)*: "A float of star-silver that pulls loose
  things toward itself. It is not hungry; it is lonely, in the way a weight
  is lonely."
- **The Unlit Star** *(new)*: "It drains every light near it, not from
  malice: it is trying to remember how. Give it enough and it burns, and then
  it can be reached."

### Four Undersides (the Echo regions)

Builds on: Canon, the realm table (each realm's promise and "never become");
Atlas entries for the Afterimage Moth, Ink Lantern, Graftling and Anchor
Warden ("Location and role" columns); Codex, Veil Draught.

> Every realm has an underside, and the crack has reached all of them.
> Under the Luminous realm the rock is dawn-glass, and the Afterimage Moths
> lead you from an echo to the wall where it was first written. Under the
> Umbral realm there are tunnels that exist only in the reflection on a pool,
> and Ink Lanterns go dark beside any inscription nobody has read yet. Under
> the Celestial realm old counterweights still swing in the stone, and Anchor
> Wardens walk the last route anyone authorised. Under the Verdant realm the
> roots are glass, and Graftlings join whatever you leave lying around into
> something that almost makes sense.

**Found-in lines** (townsfolk style): "Dawn-glass grows under the Luminous
side of the Delve: walk east from the shaft until the rock turns gold." ·
"Umbral Ink seeps where the tunnels only exist in reflection: west, under the
Nocturne side." · "Star-iron is in the Underworks, east past the dawn-glass,
where the stone swings." · "Rootglass sap is west, past the ink: follow the
roots that look like windows."

**Veil Draught, in the Ink Deeps** (Codex: "Blurs the Keeper from echo
substitution, but makes their testimony unreliable for the same interval"):
"Drink it and the mirror-tunnels stop lying to you. The walls stop letting
you copy them, too. Fair is fair."

### What Washes Up (the Void Shore)

Builds on: Canon and Codex on the Void ("unbound possibility, not a sixth
realm, and must always feel alluring, immense, and unsafe"; "inviting,
immense, and unsafe; never an ordinary evil element"); Codex, Void Shard
("offers several plausible shapes and must not be mistaken for a neutral
ingredient"); In-game, "the Shattering" (`artbible-items.ts`), the Merchant's
reveal ("Nobody has ever seen the Merchant buy anything. Every item on every
shelf was, by their own account, already theirs"), the Collection line for the
Void Shard ("Not a piece of the Void — the Void does not have pieces").

> At the bottom of the sky there is a shore, and past it a sea that is not
> water. It is the Void, and it is not a place. It is what is left when
> nothing has been decided yet. It does not attack. It offers. Stand at its
> edge long enough and it will show you a dozen versions of the tunnel behind
> you, all of them plausible.
>
> On it float the pieces of the realms that broke off in the Shattering: a
> slab of basalt with a seam still glowing in it, a shelf of sunlit stone, a
> knot of rootwood, a ring of brass, a pane of black-violet glass. They have
> not finished deciding whether to be what they were. Light keeps them honest.
> Where you hold a torch the Void draws back, not because it is afraid, but
> because a thing that has been seen has already been decided.
>
> The Merchant fishes here. Nobody has proven it. The Merchant has never
> denied it.

**Inscriptions** (Field Notes, the Void Shore):

- **High-water Mark**: "There is no tide here. There is a line where things
  stop being sure. It moves."
- **Do Not Bottle It**: "A bucket is a promise to keep a shape. The Void
  declines." (The Seam Bucket's refusal line.)
- **Five Shores**: "Every island remembers a realm. Stand on one and it
  remembers harder."
- **Witnessed**: "Light it and it stays. That is the whole trick. That has
  always been the whole trick."
- **Inventory**: "Item: one lantern, mine. Item: one lantern, also mine,
  slightly different. I have stopped counting the lanterns."
- **The Other Shore**: "Somebody built a pier out into it. The pier goes
  further than the planks do."

**Merchant lines:** "Everything washes up eventually, friend. I simply stand
where it does." · "A Maybe sells for exactly what you think it is worth. I
think it is worth less." · "Do not ask where my stock comes from. Ask whether
it was here before you were. It was."

**Bestiary lines:**

- **Plausibles** *(new)*: "Several outlines at once. Strike one and it
  has to choose a shape, and a thing with one shape can be hit."
- **The Undertow** *(new)*: "A current in the Void that drags the
  floating islands toward each other, as if two realms would be simpler as
  one."

### What the Delve Keeps (healing)

Builds on: In-game, Kael's seam oath ("Take only what the seam gives… Mark
every tunnel you open"); the World-Root's shadow growing toward the crack
(`roots-inverse-tree`); Canon, Verdant ("Renewal, adaptation, living
systems").

**Inscription** (shown the first time a far, unheld tunnel has grown back):
"The Delve keeps what is held. A torch, a block, a chest, a camp: these it
leaves. An empty tunnel it takes back, slowly, and fills with something new.
Mark what you mean to keep."

(Shipped with Phase 7: the engine says it the first time the Keeper walks into
a regrown sector, `play.delve.regrown`, EN + ES. The map shows regrown sectors
muted.)

### The wings: structures and field notes (Phase 7, shipped — owner reviews in play)

Builds on: Kael's seam oath ("Mark every tunnel you open") and Flooded Seams
(above); the Archivist on field notes ("Field notes were meant to be found");
Codex, Rift ("a passage created by difference") and the canon rifts the
fracture "scattered"; Atlas, Cinder Bailiff ("stamps heat debts onto
shortcuts").

> The Delve does not stop at the shaft's walls. East and west it runs on under
> every realm, the same four depths all the way: root, basalt, grotto, magma.
> The Keepers who came before left what Keepers leave: a camp they meant to come
> back to, a mine let go to the water, a bundle of torches for whoever came next.

- **Kael's waycache** *(new)*: a hard-rock niche in the Basalt Caverns with a
  bundle of three torches. "For whoever comes next. Light it before you need
  it." The dug cache is the receipt: it never grows back.
- **Flooded shaft** *(new)*: one of Kael's mines, let go to the water, with a
  waycache drowned at the bottom.
- **Keepers' ruin** *(new)*: a low room in the Root Hollows, trunk posts, a
  shadow-root knot overhead, a field note on the wall.
- **Maw den / Bailiff hall** *(new)*: halls on bedrock floors where Rivet Maws
  and Cinder Bailiffs keep their routes, the way the core's halls do.
- **Grotto lake / lava basin** *(new)*: water in the Grotto, lava in the Halls,
  shores to stand on and fish from.
- **Rift shrine** *(new)*: a standing stone split by a violet seam. Touched, it
  shows the tunnels round it on the map (and pays a little Delving XP once).
  In-world line: "A rift the fracture scattered: a passage created by
  difference."

**Field notes** (`shared/delve/field-notes.model.ts`; a second set beside the
Archivist's twelve inscriptions, carved into the structures above):

- Root Hollows: "Someone measured the shadow-root here every year. The marks go
  down the wall toward the crack, a hand a year." · "A Keeper slept here once.
  The soot is old, the bedding is root, and the wall says only: 'Back by
  morning.'"
- Basalt Caverns: "A rail gauge scratched into the rock, and an arrow. The arrow
  points at the crack, as every one of them does." · "Kael's stencil, upside
  down, over a hollow in the wall: 'For whoever comes next. Light it before you
  need it.'" · "'Closed', in chalk, over a seam nobody finished. Under it,
  smaller: 'It was running toward something.'"
- Glowcap Grotto: the Grotto Mere's two notes above (The Waterline, For Whoever
  Fishes).
- Magma Halls: "A column of heat stamps, each pressed into the rock by a
  Bailiff's seal. The last one has not been paid."

### One More (the Unmade)

Builds on: In-game, the Nameless ("There is one more. There is always one
more."; "Keep going. I want to see the number."; "It is not watching you. It
is remembering you."; reveal "It was never counting the strikes. It was
counting the people who noticed it was counting."; role "It has no epithet.
Nothing has ever needed to call it twice"); the Codex of the Unmade socket
word ("The page they voted to forget"); `magma-unsigned` (a tally mark cut
while you read the first); Canon, the Godforge ("turns will, matter, memory,
and possibility into real things"). Deliberately silent on the cause of the
fracture and on the antagonist (Canon, *Intentionally provisional*); if the
owner approves the Bible's Unbound Pattern ("made from unfinished creations
and erased decisions"), the Unmade is where it could come from, and nothing
here has to change.

> Under the Void there is the Unmade: the things the Godforge began and no
> one finished. A wall that is only the drawing of a wall. A tunnel sketched
> and never dug. Nothing here is solid until somebody looks at it properly,
> and what it becomes when you do is not up to you.
>
> There is no bottom. Every so far down there is a tally mark cut in the
> outline of the rock, and each time you reach one, there is another below
> it. The marks are fresh. Something is keeping count, and it is not counting
> how deep you are. It is counting that you kept going.

**Inscriptions** (Field Notes, the Unmade; tally marks with words):

- **One**: "Here."
- **Two**: "Still here."
- **Three**: "You brought a light. Most things down here were waiting for
  one."
- **Five**: "It does not end. That is not a threat. It is a description."
- **Eight**: "Every wall you finished is real now. You did that. Somebody
  should have asked first."
- **Thirteen**: "One more."

**The Nameless** (only if the bible's owner question 1 is approved): "You
came all this way to see if it ended." · "It does not. I checked." · "Keep
going. I want to see the number." (shipped) · "Nobody named me. Nobody
finished any of this. We have that in common, you and I and the walls."

**Bestiary line:**

- **Draft** *(new)*: "Half-drawn, in the shape of the last thing you
  met. In the dark it is a rumour. In the light it is a fight."

### Item lines

Each line follows the Codex's rule: "an item's lore must describe a
contradiction or consequence, not only an effect."

**Rods** *(new)*:

- **Worn Rod**: "Someone's first rod. The line has been re-knotted more times
  than it has caught anything."
- **Root Rod**: "World-Root bark bent into a curve it agreed to. It still
  leans, very slightly, toward the crack."
- **Seam Rod**: "Slag will take heat without taking shape. That is what you
  want in a line you mean to drop into lava."
- **Glowline Rod**: "Glowcap fibre in the line. The fish see it coming and
  come anyway, because it looks like morning."
- **Obsidian Rod**: "Made of what happens where water meets fire. It is
  patient in both."
- **Starline Rod**: "The line rises before it falls. Cast it upward into
  starlight; it knows the way."
- **Hollow Line**: "A Hollow rune at the reel: the useful absence. The line
  holds whatever it catches without insisting it was always that."

**Bait, tools, light** *(new)*:

- **Ember Grub**: "Lives in warm dirt and eats the heat in it. Fish can taste
  the difference."
- **Rift Lure**: "A Void Shard dressed as a meal. Something large will want
  to find out which meal."
- **Seam Bucket**: "Holds water, lava or starlight. Refuses the Void, which
  is the most sensible thing a bucket has ever done."
- **Hollow Flask**: "The only vessel the Void will sit in, because the flask
  does not pretend to be full." (Codex, Hollow)
- **Seam Siphon**: "Moves what is here to over there. Kael would say: and
  the cost goes with it." (Codex, Cinder Ore)
- **Bark Rope**: "It unrolls down to the floor and not a hand further. The
  World-Root has always known where the ground is."
- **Thornroot Grapple**: "Throw it and it grows the rest of the way. It
  remembers where you aimed better than you do." (Codex, Thornroot)
- **Seam Rail / Seam Cart**: "Kael's rails, laid toward the crack. The cart
  does not care where it is going, which is why it gets there."
- **Waystone Shard**: "A splinter from a waystone that was never built. It
  remembers being a door."
- **Rift Anchor**: "A four-point anchor around a Waystone Shard: a passage
  that holds only because both ends agree to." (Codex, Rift; Canon,
  four-point anchors)
- **Glowcap Lamp**: "Cool light. The things that live on heat do not notice
  it, which is the point."
- **Oil Lantern**: "Burns Lampfish Oil, so it burns a little morning. The
  dark backs off politely."
- **Heartstone Brazier**: "Too hot to stand beside, too bright to sneak up on.
  Banked Embers go somewhere else."
- **Starlight Jar**: "Starlight, held down. It would rather rise. It lights
  underwater, and the Void will not touch it."

**Materials and blocks** *(new)*:

- **Obsidian**: "Fire that met water and neither gave way. Builds a wall
  nothing hot will cross."
- **Ironwood**: "From a pillar that held up a ceiling for longer than the
  ceiling deserved."
- **Starglass**: "Lava and starlight, set together. It glows like a decision
  that has not been made yet."
- **Void-glass**: "Lava that the Void offered every shape at once. It chose
  glass. Nobody knows why."

**Crates** *(new)*: Root Crate: "Bark-bound and swollen. Something down
here packs for journeys." · Seam Crate: "Kael's stencil on the lid, upside
down." · Hearth Crate: "Warm. Do not ask whose." · Star Crate: "Lighter than
it should be, heavier than it looks." · Void Crate: "You open it and it was
always going to contain this. Probably."

**Junk:** Rusted Rivet: "A Maw put this somewhere safe. You have undone a
great deal of careful work." · Waterlogged Ledger Page: "Kael's handwriting,
mostly. A column of figures that stops at the waterline."

**Consumables** *(new)*: Lampfish Oil: "Rendered from fish that drank
morning. Burns clean, smells of nothing at all." · Gill Draught: "Three
breaths for every one. The Blindfin never needed eyes; it is not clear it
needed lungs." · Starbreath Tonic: "Tastes of cold metal. For three minutes
up and down are a matter of opinion."

**Summons** *(new)*: Unfinished Brace: "Every repair the Seam Eater ever
ate, in one piece. It will come for it." (Atlas, Seam Eater: "Hungry for
unresolved joins") · The Four Hammer-Marks: "Rubbings of four marks in four
walls. The furnace knows the hands." · Lit Fallen-Star Core: "You helped it
decide once. Hold it up and its siblings will want to be asked."

**Fish** *(all new)*:

| Fish | Line |
|---|---|
| Blindfin | "Born in the dark and not interested in the alternative." |
| Rootling Eel | "Swims along the roots, toward the crack, like everything else down here." |
| Glowcap Minnow | "Eats the glowcaps, so it carries their light. Small, bright, borrowed." |
| Mere Perch | "Ordinary. In the Delve that is the rarest thing you can be." |
| Tallyfish (quest) | "Five scratches on its flank. Four are crossed through." (`roots-keepers-tally`) |
| Emberling | "Lives in lava. Not brave: it has never been anywhere else." |
| Slagjaw Eel | "Bites through slag. Do not offer it your hand to compare." |
| Cold Coalfish | "Cold until you strike the bucket. Then it remembers." |
| Pressure Pike | "Swims as if the whole Underhearth were sitting on it, because it is." |
| Prism Dace | "Every scale shows a slightly different morning." |
| Inkfin | "Leaves a trail in the water that you can read, if you are allowed to." |
| Orbit Loach | "Swims in circles. It is not lost; it is precise." |
| Sapling Carp | "There is a seed in its mouth. It has not decided whether to spit it out." |
| Perigee Minnow | "Closest to you just before it is gone." |
| Lodestar Ray | "It pulls your bob toward it. It is fishing too." |
| Orbitfish | "Makes one full circle of the pool every minute, to the second." |
| Maybe | "Several outlines in the water. One in the net. You chose; it did not." |
| Unchosen Shoal | "The fish that were not picked. There are always more of them." |
| **The Kept Morning** (legendary) | "A lampfish that has been carrying the same morning since before the Eclipse. It would like to put it down." |
| **The Unpaid Debt** (legendary) | "Stamped on the flank with a heat seal. Somebody, somewhere, still owes for this fish." (Atlas, Cinder Bailiff) |
| **The Fifth Ember** (legendary) | "It swims with four others that are not there." |
| **The Fallen Sign** (legendary) | "A small constellation that fell into a pool and kept its shape out of habit." |
| **The Other Answer** (legendary) | "You caught it. You are almost sure you caught it. The Catalogue says you did." |
| **The First Honest Reflection** (legendary, Prism Shelf) | "It shows you exactly as you are. Most anglers throw it back." (Runeword, First Light: "the first honest version of an event") |
| **The Redacted Carp** (legendary, Ink Deeps) | "The shape of a fish, inked over, so you know one was there." (Codex, Umbral Ink) |
| **The Last Authorised Route** (legendary, Orrery Underworks) | "Swims one path, exactly, every time. The path is no longer there." (Atlas, Anchor Warden) |
| **The Graft That Took** (legendary, Rootglass Depths) | "Half carp, half compass. It points at the crack, and it is right." (Atlas, Graftling) |

### NPC lines for the game

- **Lodge Warden** (approved role title): "Today's ledger wants one fish.
  Only one. It only swims on days like this." · "Bring it to me wet. The
  ledger can tell." · "Thirty catches. You may now call yourself patient. I
  never have."
- **Board Herald** (approved role title): "Three Delve bounties, posted at
  dawn. They only name places you have already been brave enough to reach." ·
  "Seven days running. The board noticed. The board does not usually notice."
- **Archivist** (field notes): "Field notes are not inscriptions. Inscriptions
  were meant to be read. Field notes were meant to be found. I file them on a
  different shelf, out of respect."

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

### Glim's voice in the game (S1, shipped; `shared/glim/glim.i18n.ts`, EN + ES)

Lines Glim says unasked, each once (or rarely, with a cooldown), never over a
panel and never two within 25 s:

- Meeting (Prologue, beat 1): "Hello. I'm Glim. I keep the maps. Mostly the blank
  parts; they're the interesting ones." Builds on: §4 Voice.
- Homestead (beat 2): "Somebody left you a plot. Nobody left you a reason. We'll
  find one." Builds on: the Prologue beats.
- The Basalt Edge worn (beat 3): "A blade made to show where a boundary is before
  anyone crosses it. Wear it well." Builds on: Codex, Eclipse Longblade.
- After the first Maw (beat 4): "The Maws drag their bolts toward the Delve shaft.
  I'd like to know why. I've marked it." Builds on: Atlas, Rivet Maw.
- First Delve visit (beat 6): "North is a convention. Down is a fact. We're going
  down." Then the lantern: "I'll be your light down here. The torches you place
  are my notes; I leave them for you."
- The good stopping point (once, after the four first goals): "This is a good
  place to stop. The torch is lit and the map is honest."
- The tell, beside a Mirror Substitute: "Something here is performing certainty.
  I go dim around that. Watch which one I dim for." (then, rarely, "Dimming. That
  one is too sure of itself.") Builds on: Atlas, Afterimage Moth.
- Delve, far apart: the dashed-line, the wall and the "third pass" lines from §4.
- Refusal, for anything off the ladder: "This one's yours to find. I'll hold the
  light." Builds on: Game, archivist ("A hint is a kindness. An answer is a theft.").

The hint ladder's nudges and directions are plain instructions in Glim's voice
(Kael's "old seam" nudge is §4's own example); they name places and keys, never
a secret or what a carving means. Codex entry: name, role, the Afterimage Moth
origin and the Archivist's rule; "Also called: —" (the dash waits for Act III).

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

### Story Act I in the game (S2, 2026-10-14)

**Shipped — owner reviews in play.** The Prologue and Act I as they now play
(`src/app/shared/story/`, EN + ES in `story.i18n.ts`). Lines that already stand
above (the Prologue card, the act break, the Archivist's "dated tomorrow", Glim's
"the part that fit in the room") ship as written. New here:

- **The Act I card, "The Old Seam"** (shown when the Keeper reads their first
  carving, which ends the Prologue):
  > Kael, from the Rune Forge, without looking up: "You read it. Most people step
  > over it." · The crack under the Seamworks goes further down than anyone has
  > charted. Someone went down it before you, and kept count. · Verrin, Kael, the
  > Merchant and the Archivist each have work for you in the Delve. Glim has a
  > great deal of blank map.

  Builds on: world-and-cast §2, Prologue end; Game, `roots-keepers-tally`.
- **The fresh mark, and how the Keeper knows it is theirs.** The `magma-unsigned`
  carving is drawn as what it says: one weathered mark and one pale, fresh-cut
  mark with a notch at the top where the stroke turned. Glim: "Hold still. The
  new mark has a notch where the stroke turned. Your pick leaves that notch." ·
  "Every wall you've cut has it. That mark is yours, and I didn't see you make
  it." Builds on: Game, `magma-unsigned` ("a fresh one beside it"; Codex: "cut
  while you were reading the first"); world-and-cast §1 ("The fresh one is you").
- **The Keepers' tally, drawn.** `roots-keepers-tally` shows five marks at Keeper
  height, four struck through, the fifth worn smooth. Glim: "Five marks at Keeper
  height. Four struck through. Somebody has been counting Keepers." Builds on:
  Game, `roots-keepers-tally`; Game, Kael capstone ("The other four are still in
  the walls").
- **Verrin, on The Shadow Beneath:** "There are marks on the wall by the old
  root. Look at them if you must. Do not count them." Builds on: world-and-cast
  §2, Act I movement 1.
- **Kael, on The Old Seam** (the mission consumes the hammer, so it stays with
  him rather than going back to the Keeper): "I'll keep it under the anvil. I
  don't want to hold it when it's needed. I want to know where it is." Builds
  on: world-and-cast §2, Act I movement 2.
- **The Merchant, on a Glowcap order:** "Those prices in the Grotto? My hand.
  Inventory, friend. Everybody has a past; mine is itemised." Builds on: Game,
  `grotto-tally-marks`; world-and-cast §2, Act I movement 3.
- **Glim, after the act break:** "Five witnesses. I've started five blank pages.
  They're my favourite kind." Builds on: Glim's voice (§4, "keeps the blank parts
  of the map on purpose").
- **The Story tab, "The Keeper's Record":** one short entry per beat found (e.g.
  *Bolts toward the shaft*: "You felled a Rivet Maw. The Maws hoard joins, and
  they drag their bolts toward the Delve shaft. Glim marked it.") and one lead
  toward the next, which says where to look and never what is there. Act II's
  lead: "Five witnesses, one from each realm. Kael is waiting for their
  accounts. Act II opens in a later update." Builds on: Bible, "Continue
  Journey".

### The people in the towns (S3, 2026-10-14)

**Shipped — owner reviews in play.** The Bible's ten chapter people take the
stations world-and-cast §3 gives them, by name, with the approved role title
kept as the subtitle on their tag (`play/world/life.ts`, `life.i18n.ts`, EN +
ES). Their lines are world-and-cast §3's voice lines, plus new ones written to
it; which open when is `play/world/keeper-lines.ts`. New here:

- **Placements decided.** Mara Voss (Crafting Bench), Edrin Kade (Material
  Vendor), Amina Thorne (Exchange), Nox Aster (Leaderboards), Kesh Arbo (Skills
  Lodge), Siv Moss (Sanctum) take over the role keepers' tags. Four people are
  new in the world: **Sera Quill** at the Meridian Orrery's Waystone; **Tomas
  Rill** beside the Heliograph Court's Waystone ("the lanterns that light the
  Waystone road"; the Court Lanterns station waits for Act II ch. 1);
  **Ilyra Venn** at the Court's East Stair, where the Reflection Channels'
  dawn-glass begins (her Witness Prisms wait for ch. 1); **Rook Sable** at the
  Unrecorded Corridors, on the far side of the mouth from Verrin (the Mirror
  Map waits for ch. 4). Canon keepers wear their epithet as the subtitle
  (Kael · the Broken Flame; the Merchant · of the long till).
- **Still unnamed (at S3):** the Vault Clerk (Edrin's cousin), Enchanter (trained in
  the Archive), Croupier (the Merchant's employee), Board Herald, Arena
  Gatekeeper (walked the roads with Siv before the knee went) and Trials Warden
  (keeps Verrin's door). Each has the §3 depth line and two or three more.
  Named the same day: see "Six names for the role keepers" below.
- **Kael's hammer stays under the anvil.** world-and-cast §2 had Kael give it
  back ("Keep it in the Vault"); the shipped mission consumes it, so his line
  after *The Old Seam* is "It's still under the anvil. I check on it more often
  than I'd admit." Mara: "Kael brought his old hammer up from the seam. He
  won't let me touch it. Good."
- **Act-aware lines, by beat:** after the first carving, Kael ("Read them all.
  Then tell me which ones you wish you hadn't.") and Ilyra; after the tally,
  Verrin ("You counted. Everyone does…") and Rook; after the Merchant's prices,
  the Merchant ("No, I won't honour them. Inflation, friend.") and Amina; after
  the Seam Eater, Verrin ("It sank. It did not end. I would know."), Edrin,
  Siv and the Trials Warden; after the fresh mark, Tomas ("A mark you don't
  remember making. I know that feeling from the other side."); after *dated
  tomorrow*, the Archivist and Ilyra; after the act break, Kael ("Five honest
  accounts. Liars are cheap; I already have a drawer of them."), Aureth ("So
  the crack was drawn. I suspected it."), the Merchant, Mara, Edrin, Amina,
  Nox, Sera, Tomas and the Board Herald. None of them names who drew the line.
- **Station lines:** each keeper notices the Keeper's first use of their
  station (Mara's "Ugly seam. Honest seam. Keep it.", Edrin's "Yours patched
  one today.", the Vault Clerk's "Line one.", Kesh's "The lodge rang a little").
- **The town as a web:** thirty lines name another keeper: Mara and Kael (he
  won't tell her she's his best student; he tells you, and will deny it), Edrin
  and Mara, Edrin and the Merchant, the Vault Clerk and Edrin, Ilyra and Tomas,
  Aureth and Ilyra, Amina and the Merchant, Rook and Amina, Rook and Verrin, Sera
  and Nox, Sera and Kael ("the variable"), Siv and Kesh, the Gatekeeper and Siv.
- **People of the Realms** (Codex, Collection tab): one public entry per keeper
  (where they stand, who they are, what they teach). No beat or secret is in it.

### Six names for the role keepers (2026-10-14)

**Shipped — owner reviews in play.** The last six keepers called only by their
job get a person's name; the approved role title stays under it as the
subtitle, the same as Mara Voss · Bench Smith (`play/world/life.ts`,
`life.i18n.ts`, Codex `people.i18n.ts`; EN + ES). Naming follows the Bible's
cast: a short given name and a one- or two-syllable surname that is also a
thing from the person's trade or realm (Voss, Kade, Rill, Quill, Sable, Thorne,
Arbo, Moss). None of the six collides with a cast name, a rune, or a name in the
leaderboard's generated field. Every surname means something the person does.

| Name · title | Town | Who they are | Builds on |
|---|---|---|---|
| **Orla Stave** · Vault Clerk | Basalt Seamworks | Edrin Kade's cousin. A *stave* is a notched tally stick; their grandmother notched one for every crate the Seamworks stored. Orla got the stave, Edrin got the scales: the family keeps count and keeps it honest. | world-and-cast §3 (Edrin's cousin; never loses anything; Game: nothing is ever deleted for space); Bible ch. 3, Edrin as Cinder Delegate; Game, `roots-keepers-tally` |
| **Idris Calder** · Enchanter | Basalt Seamworks | Trained in the Archive, came down to the Seamworks; the Archivist still corrects his footnotes by post. To him a socket is a carving made small: words cut into metal that it can't take back. | world-and-cast §3 (trained in the Archive; sockets are promises); Canon, "Runes are compact principles"; Game, socket words (`socket-words.ts`) |
| **Lune Coyne** · Croupier | Nocturne Archive | The Merchant's employee, who prints the odds anyway. *Lune* for the Archive's fractured moon mirror, *Coyne* for the coin. Runs the Gambler and the four games east of her: the Reels, Rune Drop, Seam Sweeper and Eclipse Ascent, each with its house cut printed. | world-and-cast §3 (insists on printed odds); Bible ch. 4, Nocturne Archive "beneath a fractured moon mirror"; this file, "The Reels" and "The Croupier's other three games"; Seam Sweeper lore ("marks where the roof will give before you swing") |
| **Pim Larkin** · Board Herald | Rootglass Canopy | Larkins have read the Quest Board aloud for four generations and never once posted an order; neutral is the family trade. He adds the please. After the Seam Eater sinks he reads the Seamworks' thank-you twice: the first on the board in years. | world-and-cast §3 (reads every faction's commissions aloud; neutral by trade); Bible ch. 3, the Seam Eater |
| **Corran Holt** · Arena Gatekeeper | Rootglass Canopy | Walked the roads with Siv Moss: she took the long patrols, he took the ones that ended in a fight, until his knee chose which of them stayed out. A *holt* is a stand of trees; he stands at the gate and likes watching people try. | world-and-cast §3 (old ranger, bad knee); §17, Siv Moss, Thornbound Ranger ("has patrolled every path") |
| **Hesta Cairn** · Trials Warden | Rootglass Canopy | Keeps the door of the trials for Verrin. A *cairn* marks where a path ends so the next walker knows: her name and her whole job. Verrin never comes to the door; the count reaches Verrin before she has shut it. | world-and-cast §3 (Verrin's warden; Game: "a trial is a thing that ends"); §4 Verrin, the Hollow |

**New lines** (EN; ES in `life.i18n.ts`; which open when in `keeper-lines.ts`):

- **Orla Stave:** "You found a tally below. My name is one: a stave, a notched
  stick. Someone kept count." (after the Keepers' tally) · "Gran notched a stave
  for every crate we stored. I got the stave. Edrin got the scales."
- **Idris Calder:** "The Archive taught me footnotes. The Seamworks taught me
  footnotes in a hurry." · "You've read a carving. A socket is the same,
  smaller: words the metal can't take back." (after the first carving)
- **Lune Coyne:** "Reels, Rune Drop, Seam Sweeper, Eclipse Ascent: four games
  east of me, all odds printed." · "Rune Drop falls where it falls. Seam
  Sweeper's weak roof is set before you swing." · "Eclipse Ascent climbs until it
  breaks. The Reels just spin. Both print the house cut."
- **Pim Larkin:** "Larkins have read this board aloud for four generations.
  Never posted once. Neutral." · "The Seamworks posted thanks when the Seam
  Eater sank. First thank-you here in years." (after the Seam Eater)
- **Corran Holt:** "Siv took the long patrols, I took the ones with a fight. The
  knee chose who stayed out." · "Nobody watches a fight like someone who can't
  have one. Go on. Give me something to watch."
- **Hesta Cairn:** "A cairn marks where a path ends, so the next walker knows.
  My name, and my whole job." · "Verrin never comes to the door. The count
  reaches Verrin before I've shut it."

Every keeper in the five towns now wears a name with a title or epithet under
it (the engine harness checks that none is called only by its job). Older
entries in this file that say "Vault Clerk", "Board Herald" or "the Croupier"
mean these people; their art keys (`npc-vault-clerk-figure`, …) are unchanged.

### The Board Herald's bounties and the map tools (Phase 7.4–7.5, 2026-10-14)

**Shipped — owner reviews in play.** Builds on the Delve and Beyond §6.1 and
§7.2, Pim Larkin (above), and two canon objects that had painted art and codex
lines but no place in the game (meaning audit, "Canon items with no game
presence").

- **Pim's bounties.** The realms post orders on the Quest Board; the Delve
  posts nothing, so Pim reads it aloud for it: three bounties a day, drawn for
  the Keeper alone (their Delve's seed and the day), never a streak. "The
  realms post orders. The Delve posts nothing, so I read it for them: three a
  day, fresh every morning. Miss a day and nothing is lost; the board just
  turns over." New keeper line, after a first bounty: "The Delve never posts,
  so I read it for you. Three bounties a day." (`bounties.i18n.ts`,
  `life.i18n.ts`; EN + ES.) Builds on: world-and-cast §5 (no punishing
  streaks); Pim's four generations of neutral reading.
- **The Broken Astral Compass** (canon codex: "points toward the nearest fact
  omitted by the active model"). The last Herald left it on the board; Pim hands
  it over with the first bounty claimed: "It points at what the board forgot to
  post." Lore line: *It stopped pointing north the day the Godforge broke. Now it
  points at whatever the map was never told: the room no lantern has reached,
  the carving nobody copied.* Held, the Delve map draws a short violet ray
  toward the nearest unvisited structure or uncopied carving.
- **The Rift Map Fragment** (canon codex: "a partial route that is legible only
  beside another keeper's incompatible observation"). Tucked behind each rift
  shrine's stone (the first touch), and Pim's gift every seventh day a bounty is
  claimed. Lore line: *Half a route, drawn by a Keeper who saw the tunnels
  differently. It only reads beside your own map; read together, one more room
  appears.* Read on the full map, it draws the nearest unvisited structure into
  the Keeper's own explored map.
- **Glim's mark.** The third step of a Delve mission's hint ladder: "I'll mark
  it on your Delve map. Open the map (M) and look for my light." A lamplight
  diamond on the map for half an hour, at the mission's target: a place, never
  what a carving says (the Archivist's rule stands). Builds on: world-and-cast
  §4 (Glim keeps the maps; "A hint is a kindness. An answer is a theft.").

### The Mirror Slate (2026-10-14)

**Shipped — owner reviews in play.** Builds on Canon (Umbral: the Nocturne
Archive "beneath a fractured moon mirror"), Lune Coyne (above: *Lune* for that
mirror, the Croupier who prints the odds anyway), Kael the Broken Flame (the
smith who binds what the realms break) and Eclipse Ascent's lore line ("From the
Archive's roof the fractured moon mirror…").

- **What it is.** When the moon mirror over the Archive cracked, the pieces kept
  showing what they had been facing. Lune swept the shards that had faced her
  tables into a drawer; Kael, who cannot leave broken glass alone, bound a few in
  brass. Lore line (Collection Log, Codex): *A palm of the Archive's moon mirror,
  cut where it cracked and bound in Kael's brass. It shows what it was facing
  when it broke: the tables, and whatever you left burning at home.*
- **How a Keeper gets one.** Lune hands one over after ten plays at her four
  tables ("Ten plays at my tables and I hand you a Slate of the Archive's
  glass."), or sells it to anyone in a hurry. Her line once it is in your pocket:
  "The Slate in your pocket is my tables in Kael's brass. Same odds, printed." The
  odds do not change in a pocket: the Slate shows her tables, it does not copy
  them.
- **The second face.** Kael can wake the glass's other face with Grotto light,
  Delve slag and obsidian: "Lune's glass, my brass. Bring Glowcap, slag and
  obsidian; I'll wake its other face." (a new canon line for Kael, at the Rune
  Forge). Lore line: *Kael woke the glass's other face with Grotto light and Delve
  slag. Now it also remembers where you marked the dark, and what Pim read off
  the board this morning.*
- **What it will not do.** It shows; it does not reach. Nothing is crafted, sold
  or traded through glass: the Bench, the Market, the Exchange and the Vendor
  stay where they stand, and the Slate only says where to walk. It also goes dark
  when the Keeper's hands are busy (a fight, a line in the water, a story told).
### The Underhearth in the game (Phase 8, shipped — owner reviews in play)

The Delve and beyond's "The Four Who Went Down" and "Flooded Seams" (above),
now in the world. Everything below is in the build, EN + ES unless marked.
Builds on the same passages as those stories, plus the shipped Fracture claim
("It broke along a line someone had already drawn") and Act I's break.

**The door.** The Magma Halls' floor is the Underhearth's fallen ceiling, so
the one way down is the **Banked seal** cut through the fragment chamber's
floor, where the Seam Eater stood. It answers to a Pickaxe IV and Delving 15,
and only once Kael has been brought the fragment: "The seal holds. Bring Kael
the Godforge Fragment first: he knows what it holds back." Under it the
**Banked Door**, a landing on the Four's brick, and the field note *For the
Fifth*. First step down: "Under the Halls. The heat here is heavy, not hot:
fire pressed so long it became something else."

**What is down there.** Iron-black basalt over banked obsidian; Kael's old
rails in the galleries (some sections broken, as the Flooded Seams story
says); lava lakes with obsidian shores "where the seeps met it"; the
fracture's own violet seam through the rock, unbreakable and lit; cold coal
that is dark "until struck" and then glows; emberheart, pyrite, the furnace's
slag (Pickaxe V) and ironwood (two of the four pillars still stand in the
Furnace Hall; their heartposts take an Axe V). Creatures: **Banked Embers**
asleep in cold coal until a blow wakes them, **Ironwood Sentinels** whose
strike shoulders the ceiling ("A support nearby holds it"), Rivet Maws at the
top. The **Four's outposts**: four ruined forge corners, two east and two west
of the shaft, each with an anvil, a cache and one **hammer-mark** ("A
hammer-mark, cut where one of the Four stood. You take a rubbing of it.").

**The Banked Furnace** (the Furnace Hall under the core, at the bottom of
Kael's rail). Woken at its hearth with the Four Hammer-Marks: "The Banked
Furnace wakes, and the hall breathes with it." Banked, it swallows blows; its
four vents are doused with water from **the Four's quench trough** ("Bank, Do
Not Quench" made into a fight: the Four banked it; the Keeper finally puts it
out); it breathes in, pulling, and spills Banked Embers; with the vents out its
core opens; under half it "remembers what it was banked for". Its fall: "The
Banked Furnace goes dark. The fire the Four banked is out." It can be woken
again once a day for what it banked; it will not wake twice in a day.

**Missions** (English data, like every mission):

- *Flooded Seams* (Kael): "When I closed the mines I did not fill them. I let
  the water have them. The old rails still run along the drowned galleries,
  and the Maws still pull rivets from them. Bring me three. Then look at which
  way the rails were laid." Claim: "They were laid toward the crack." Opens the
  Seam Rail and the Seam Cart.
- *The Four Who Went Down* (Kael): "Five of us worked the Seamworks when the
  crack reached it. Four went down to bank the fire. I stayed. The seal under
  the chamber is ours, and you brought up the fragment, so you have earned the
  door. Take a Pickaxe IV. Go down with someone, if you can." Claim: the
  fallen-roof line (story above).
- *Four Hammers* (Kael): "One mark for each of us, where we stood. Two east of
  the shaft, two west, none of them far. Put your hand on one. That was the
  height of her shoulder." Claim: "I did not stay because I was braver…" and
  the Four Hammer-Marks; opens the Rift Anchor.
- *Let It End* (Verrin, also Kael): Verrin's three lines from the story above,
  as one plea. Claim: Kael's "It is out. I thought I would feel lighter. I feel
  like the forge just got colder by four." A Nox rune; Pickaxe V and Axe V.
- *Endings Kept Warm* (Verrin): "Some endings are kept warm on purpose, so they
  can be finished later. Bring me five things that swam toward the crack, and
  one that swims in what was banked." Claim: "Verrin filed both catches under
  the same ending. 'Postponed,' the label says. Then, smaller: 'not
  cancelled.'" A Hollow rune.

**Act II's first pages** (the Story tab, `story.i18n.ts`): *The Four Who Went
Down*, *Four hammers*, *Let it end*, each with Kael speaking on Glim's line
("The furnace is not angry…", "You found a mark…", "It is out…").

**Glim** (hint ladder, never what is down there): "The deepest room we know
has a floor that is not quite a floor." · "Four people worked down here.
People leave corners lit." · "Kael's old rail goes all the way down. So does
the heat." · "Ride the rail to the Furnace Hall. Bring a bucket: the trough is
there for a reason."

**Traversal** (item lines above, now carried): the Seam Cart ("In the cart.
Left and Right push it, Down brakes, Jump leaps out, E steps off." · "Off the
end of the line! The cart stays; you do not."), Bark Rope ("The rope unrolls
down… Climb it like a ladder."), the Thornroot Grapple ("The thornroot grows to
the rock and pulls. Jump to let go."), Rift Anchors ("The anchor holds, and both
ends agree. You step through."; travel sheet: "A passage that holds only because
both ends agree to. Choose where to step through."). Each rift shrine's first
touch now also leaves a **Waystone Shard**, "a splinter from a waystone that
was never built".
## Skill titles past mastery (uncapped levels, 2026-10-14) — shipped, owner reviews in play

Past 99 nothing new is gated; the climb pays in standing. A title at 100 and every 25 levels
(eight per skill, words in `src/app/shared/skills/skill-titles.i18n.ts`, EN + ES), then `+1`, `+2`…
on the last one every 25 levels from 300. Each name leans on the skill's own places and things:
Mining (Vein-Reader → Seam-Sage → Ember-Hewer → Heartstone Breaker → Basalt-Born → Orichalcum Hand →
Seam-Warden → Eclipse Hewer), Delving (Lantern-Bearer → Deepdelver → … → Underhearth Walker → Abyss-Sage →
Eclipse Delver), Fishing (… Drowned-Lamp Seeker … Ledger-Legend …), and so on. Every ladder ends in an
"Eclipse" title: the realm's name is the last word a skill can earn. Builds on: the skills' canon
nodes and sites (Heartstone, Orichalcum, Rootglass, Meridian Orrery, the Drowned Lamp, the Ledger Catch).
### The bond with Glim (2026-10-14)

**Shipped — owner reviews in play.** Owner: "The more you explore the more
connection you and me have." Builds on world-and-cast §4 (Glim, its origin, its
questline "The Blank Places", the first-lamp easter egg) and §5 (no guilt, no
streaks). All text: `shared/glim/glim-bond.i18n.ts`, EN + ES.

- **Five stages**, in Glim's cartographer's voice: *Stranger with a lantern* →
  *Mapmates* → *Margin notes* → *Two hands on one chart* → *The blank page and
  the pen*. The bond grows from shared moments only and never shrinks.
- **Six talks, Glim's own story:** *What are you?* (the lent pencil; it doesn't
  remember the Keepers before you), *The Afterimage Moths* (circling the
  uncertain, going still around performed certainty), *The Archivist's page* (it
  ate the page; "The Archivist calls it a promotion. I think it was a
  kindness."), *Why I leave blanks* ("a solid line is a promise … true is worth
  more than tidy"), *A complete map* (its fear: "A map with no blanks is a map
  that's stopped looking."), *The first lamp* (someone made the first lamp like
  Glim, patiently, far from any Godforge; Glim knows the name and will say it at
  the threshold — the Act III easter egg is hinted, never named).
- **Three questions Glim remembers**: what you like finding, deep or surface,
  danger or beauty first. The answers colour its later lines.
- **Three small abilities**: the way home ("Home is 84 steps west and 30 up.
  I've kept the way."), brightening near rooms no lantern has touched, noticing
  rare finds (rift shrines; the Lost Cabinets join the same list later).
- **The Blank Places**, adapted to today's world: Legend, Scale Bar, Two Maps
  ("My map and the Archive's disagree in eleven places. I've kept both."), The
  Needle, Every Town, Leave It Blank (Act III: shown as still being written).
- **Coming back** after two days or more: "There you are. The map kept; nothing
  moved while you were away." Never "we missed you".
### The High Roads (surface height, 2026-10-14 — shipped, owner reviews in play)

Every hunting ground got height: a tree, a rock shelf, a floating Godforge ruin,
a rope bridge, a dead snag and a spire (`play/world/heights.ts`,
`heights.i18n.ts`; EN + ES). The lore that gives them a reason:

- **The Ridge Couriers.** Before the Waystones (Sera Quill's Meridian Compact,
  world-and-cast §3), the realms' post went over the high ground on foot.
  Couriers climbed what they could not go round and cached what they could not
  carry. The Waystones made them unnecessary; most caches were never collected.
  The **courier caches** on each shelf and mesa are theirs: once opened, nobody
  restocks them ("Already opened. Nobody restocks the high road any more.").
- **Courier carvings.** Road marks cut where a courier waited, one per realm, in
  the realm's own answer to pressure (Bible: measure, temper, remember, conceal,
  adapt): the Seamworks' "Road open. Rock warm. Keep climbing"; the Court's sun
  with one ray missing (the missing dawn); the Corridors' two arrows that
  disagree ("Both are true"); the Orrery's ring cut by a straight line; the
  Thicket's leaf over a road mark, half grown over.
- **The summit cairns.** Each realm's high road ends at a cairn; every courier
  who reached it added a stone. The Keeper adds one and takes the realm's
  title: Cinder, Dawn, Unrecorded, Meridian and Canopy **Ridgewalker**. The
  Codex keeps them under "The High Roads". The Unrecorded Summit's stones carry
  no names (Umbral conceals), and the Meridian Summit is the only place the
  Orrery's rings line up for someone on foot ("The couriers knew it before the
  Compact did").
- **Hollis Fenn, Last Ridge Courier** (new person). Still walks the high roads,
  one realm's mesa a day, keeping the old post ledger: "Post used to go over
  the top. The Waystones are quicker. Quicker isn't the same as seen." Teaches:
  the high roads and their caches (the meaning rule). Relationships: needles
  Sera Quill ("Sera hates that a courier knew it first"), respects Rook Sable's
  wish to keep the Corridors' road off the maps, and sides with Siv against
  Kesh about the Thicket ("I say it's in the way").
- **The look-out cairns.** A cairn with a pennant halfway up each route; from
  it every find still waiting on that high road shows as a pale beam.

## The Rift Gates and the Ink Deeps (2026-10-14) — shipped, owner reviews in play

Owner: "inside the delves portals to other realms"; "the realms are like deeper delves or crazy". Code:
`shared/delve/rift-gates.model.ts`, `play/engine/realm-gen.ts`, `play/engine/umbral.ts`.

**Canon tie.** A Rift Gate is not a door to a sixth realm, nor to the Void (delve-and-beyond.md §1.2). It is a
place where two undersides wear thin: the rock under the Infernal realm's towns and the rock under another
realm's. Each gate stands where that realm's Echo colour will one day begin (§2.3). Four frames in every
Delve, one per realm; older than the Delve, older than Kael. They shed **rift splinters** as they settle.
A **Realm Sigil** (splinters, the realm's own material, a core that remembers heat) is how a Keeper becomes
"someone the shadows already know" (Verrin, Game, level-15 line: a door in the Umbral that opens only for
such a someone) — the gate keeps the sigil and stays open for that Keeper.

**Three gates were still settling** at first (Luminous, Celestial, Verdant; the Luminous and Verdant opened 2026-10-15, below): they hum, they glow their realm's colour,
Glim feels the other side but cannot see it. "One day."

**The Ink Deeps** — the Umbral's underside. "The dark the light left behind when it went somewhere else"
(Verrin). The rule it breaks: *the dark is unreliable*.
- Ink-blind: Glim's light barely reaches past your hands; torches are how you push the dark back.
- Unlit passages shift: drift-shale is rock that is only where it is while nobody looks. A torch pins it.
- The ink tide rises and falls on its own clock; it never drowns, it blinds, and it puts braziers out.
- Mirrored ceilings: ink polished by the tide; your reflection walks above you, a step behind.
- Ink is heavier than water and never mixes with it.

**Rook Sable's chalk** (Bible proposal, Veil Cartographer): Rook maps these tunnels; some routes are wrong on
purpose. Field notes: "R.S. This way, if it is still this way." / "Do not map what you have not lit."

**Creatures.** *Shadeling*: only moves where no light is; held in a torch's light it stands like a statue of
itself, waiting for you to look away. *The Gloam Warden*: keeps the dark that was left when the light went
somewhere else; "Light me, and I stand still. That is all I ask of anyone." Not cruel: it has kept the dark so
long it no longer lets anything leave.

**Items.** Rift Splinter ("warm on one face, cold on the other"); Umbral Sigil; Inkstone ("stone that drank so
much ink it writes; the line is never quite straight"); Nightglass ("hold it to a torch and it shows you the
torch going out"); Veil Lantern ("it does not shine brighter, it shines further, the way the dark does").

**Verrin's chain.** *What the Light Leaves* (attune the gate, stand in the Ink Deeps) · *Ink and Glass*
(10 Inkstone, 4 Nightglass; "now you know why I never sign anything") · *The Unlit Warden* (light the
braziers, end it honestly; the Archivist: "Most things that guard a dark are asking for the same. We just
never bring a torch.").

Glim's telegraph lines (said once each) are in `play/world/rift.i18n.ts` (`play.rift.rule.*`).

## The Root Deeps and the Prism Mines (2026-10-15) — shipped, owner reviews in play

Owner: the realms are "like deeper delves or crazy". Two more gates opened (the Celestial followed: "The Orrery Wells").
Code: `play/engine/verdant-gen.ts` + `verdant.ts`, `play/engine/luminous-gen.ts` + `luminous.ts`, shared
`realm-kit.ts`; creatures `play/engine/realm-creatures.ts`. Handoff: `docs/handoff/realm-delves.md`.

**The Root Deeps** — the Verdant's underside: the World-Root's lower half, still growing (world-and-cast ch. 5,
"the root path to the threshold"). Its gate stands in the Root Hollows, west of the shaft, where the roots grow
round a frame instead of through it. The rule it breaks: *dug rock grows back*. The walls are living wood;
what you dig, it takes back, roots creeping into the hole before it closes. Fire burns them back (a torch
beside the hole), a support holds them, and the Rootsever Billhook cuts them clean. Living vines hang from
the roofs and hold a Keeper's weight; spore pods burst underfoot and sting, but give their sap to a sickle.
- *Kesh Arbo* (Lodge Warden, Graftkeeper) and *Siv Moss* (Thornbound Ranger) — same nursery, opposed now —
  ask together for once. Kesh: "Everything I graft up here, it grafts down there, faster, without asking."
  Siv: "Do not trust a hole you did not burn." Their field notes: grafting wax "It took. It always takes.
  That is the problem." / "Burn it, cut it, or prop it, or it closes behind you. S.M."
- *Graftling*: a cutting that took; it would like to be joined back on. *The Graftmother*: joins everything
  that is cut, and has begun joining the tunnels to the people in them. Her heart-roots hold her to her hall:
  while one stands she heals and shrugs off blows. Her oath is grown, not carved: "Cut my roots, and I will
  let you go."
- Items: Rootglass (sap set into glass; the light inside still moves toward the surface), Heart-amber (what the
  root bleeds where it was cut long ago; something is always caught in it, never quite dead), the Verdant
  Sigil (the frame puts out a leaf when it takes it), the Rootsever Billhook (Kesh says cruel; Siv says it
  ends arguments).
- The chain (the Archivist files it; Kesh and Siv keep no ledger): *The Wood That Remembers* · *What Grows
  Back* (10 Rootglass, 4 Heart-amber; the beetle in the amber, alive, twenty years) · *The Graftmother* (the
  Archivist files their notes in one folder for the first time: "They disagree about everything except the
  ending. That is usually how you know it was the right one.").

**The Prism Mines** — the Luminous's underside: where its sun lands when it goes down every evening (Aureth:
"everyone assumes it goes nowhere. It goes under."). Its gate stands in the Glowcap Grotto; the glowcaps lean
toward it as if it were morning. The rule it breaks: *light is solid*. A sun-prism (the realm's sun seen from
underneath, set in a roof) shines straight down; where the beam falls it is a ladder of light, where it runs
across open air it is a bridge. Prism mirrors turn it a corner. Shadow glass is a floor only while light is on
it; in the dark it is a hole that looks like a floor (there is always a way back up). The Dawn Lens makes your
own light heavy enough to stand on.
- *Aureth* asks, and wants "an honest account of what the light holds up". *Lune Coyne* (the Croupier) takes
  the odds: the old miners bet on which beams would hold, kept the books in prismite and paid in dawnglass;
  "Nobody down there ever lost. That is how I know they never came back up." Field notes: Aureth's gold
  chalk ("Stand where the light is"), the miners' rule ("No bridge? Turn the glass."), a warning about black
  glass ("Bring a light." Underneath, smaller: "I did not."), Lune's settled tally.
- *Prismling*: a little light that set before it could go anywhere. *The Hollow Sun*: the light that was
  promised and never arrived, waiting so long it has forgotten for whom. Blows pass through it while it is free;
  caught in a beam it stands still "long enough to be ended". It flares, and the mirrors turn away.
- Items: Prismite (light goes in one colour and comes out as an argument), Dawnglass (light that stood still so
  long it set; warm like a morning that never happened), the Luminous Sigil, the Dawn Lens.
- The chain: *Where the Sun Goes Down* · *Odds on the Light* (10 Prismite, 4 Dawnglass) · *The Hollow Sun*
  (Aureth, closing the account: "It asked to be held still long enough to end. Most promises ask for less, and
  get it.").

Glim's telegraph lines for both rules (said once each) are in `play/world/rift.i18n.ts`; Glim's hints for the
two chains in `shared/glim/glim.i18n.ts` (`play.glim.hint.v.*`, `play.glim.hint.l.*`).

## The Orrery Wells (2026-10-15) — shipped, owner reviews in play

The last Rift Gate opens: with it every realm's underside is reachable. Code: `play/engine/celestial-gen.ts` +
`celestial.ts` (on `realm-kit.ts`), creatures in `play/engine/realm-creatures.ts`. Handoff:
`docs/handoff/celestial-delve.md`.

**The Orrery Wells** — the Celestial's underside: the rock under the Celestial towns, where the Meridian
Compact once measured the sky *from underneath* and left its instruments running (world-and-cast ch. 2, *The
Measure That Lied*). Its gate stands in the Magma Halls, in a frame the heat will not touch, where things
cannot agree which way is down. The rule it breaks: *down is negotiable*. Open air there can be an *orrery
field*: it glitters, and its chevrons point its down. Its *orrery rings* decide it — brass and the field falls
up (a Keeper stands on its ceiling and walks it), blue and it falls down — and turning one ring turns the whole
field. *Star-wells* always fall up, to a pocket of ore under a roof; the Compact hung a brass *star-chain* beside
every one, "every well a chain, every field a ring within reach of both its floors, no exceptions, no
apologies". Nothing there lets a Keeper fall hard.
- *Sera Quill* (Chief Meridian; she runs the Waystones) asks, and the Archivist files it. "Every Waystone you
  have touched is mine, and every one of them agrees on which way is down. Under the Magma Halls there is a
  frame where they stop agreeing." She wants a down measured, with error bars. *Nox Aster* is present only as a
  margin note no one has managed to scratch out: "This column was never measured. It was assumed. N.A."
- Field notes: Sera's survey mark ("Down measured here: twice. Both readings correct." Underneath, smaller:
  "That is the problem."), a hint scratched by the Turning Room ("Fell in? Turn the ring by your feet. You will
  fall up. Walk the roof. It is allowed."), the Compact's rule plate, a counterweight "holding the floor down —
  do not remove", the Ephemeris's own words.
- *Anchor Warden* (Atlas: "repeats the last trajectory it was given, long after the order behind it has
  lapsed") finally spawns: a round brass survey-bot walking the warden galleries, its ring still turning.
  *The Fallen Ephemeris*: the table of where every star should be, fallen when the sky stopped agreeing with it.
  It rides its hall's ceiling, insisting; while its hall falls up no blow lands. Turn a ring and pull its floor
  out from under it: it drops into its own well and is, briefly, where it actually is. Then it gathers itself
  (the rings flash first) and turns the hall back up, and two Anchor Wardens come out with it. "Pull my floor
  out from under me and I will finally be where I am."
- Items: Starsteel (iron that fell a long way and kept its shine out of stubbornness; always heavier on the
  side facing the floor, whichever side that is today), Meridian Glass (the line the Orrery measured by, set in
  glass; hold it wrong and it tells you so), the Celestial Sigil (the gate turns it once, politely), the Orrery
  Key (the Compact's own: turned in the air of a field, the field answers; "do not lean on it either"). Orrery
  scrap in the rock gives back Celestial Alloy — a world source at last.
- The chain: *The Measure Underneath* (reach; the Orrery Key) · *Error Bars* (10 Starsteel, 4 Meridian Glass;
  the Waystones off by a hair for three hundred years: "Nox told me. I filed it under insolence.") · *The
  Fallen Ephemeris* (the Archivist files Sera's last report beside Nox's first: "She has written 'the model was
  wrong' in her own hand, and signed it. I have waited a long time to file that sentence.").

Glim's telegraph lines (said once each: orrery, field, well, ring, turn, chain, ephemeris) are in
`play/world/rift.i18n.ts`; the chain's hints in `shared/glim/glim.i18n.ts` (`play.glim.hint.c.*`).

## The Glass of Becoming (shipped — owner reviews in play)

Make your Keeper (`docs/handoff/make-your-keeper.md`). Every Keeper carries a
sliver of the Archive's moon-mirror — the same glass Lune Coyne's Slate is cut
from. Breathe on it and it shows "the face the realms will know you by, and lets
you choose it again". A brand-new Keeper is handed it as they step into the world;
a Keeper who never looked into it sees "The Glass of Becoming remembers a face you
never chose." Two of the skin tones are not human ones: the Umbral lilac and the
Verdant sap the realms leave on Keepers who have walked them long. Other Keepers
seen at the Hearth each have their own face, read off the glass by their name.

## Glim hums (shipped — owner reviews in play)

World feel (`docs/handoff/world-feel.md`). Each realm keeps a tune of its own, and you hear it in snatches: a few
notes, then a long quiet. Infernal's is warm, the forge-light in it; Luminous rings like the lamps that never sleep;
Umbral is low and hushed, as if it does not want to be overheard; Celestial is mostly air; Verdant is wood and
string. Underground the same tune plays further apart, as the rock remembers it. Near a guardian the third goes
minor and something low hums under everything.

Glim, the Margin-Light, remembers every tune ever sung in the margins of the realms. Sometimes, when the realm's
phrase ends, Glim hums the last of it back to you — an octave up, wavering a little, as if it is not quite sure it
is allowed to. It never hums a tune it has not heard.

The fish of the Delve's waters can be seen now, as shadows under the surface; they gather to a line and dart to
the bait. The Lodge Warden's word for it: "They were always there. You were looking at the water, not into it."

## How the towns' people look (shipped — owner reviews in play)

One art style (`docs/handoff/one-art-style.md`, `shared/keeper-look/npc-looks.ts`). The looks follow the cast's
sprite briefs (`docs/art-commissions/world-sprites/03-npcs.md`) and add only what their own lines already say:
Kael wears cracked iron plate under a leather forge apron, his beard grey, one eye still burning and his left
hand gone; Orla Stave keeps her grandmother's tally ledger under her arm and a clerk's sash; Edrin Kade carries a
sack of scrap over his shoulder and brass weighing tongs (Orla got the stave, Edrin got the scales); Mara Voss
works in an apron with her braid tied back; Aureth stands with dawn-glass shards rising behind her head, never a
halo; Verrin's hood holds a mirror where a face should be; the Archivist wears a brass loupe and a book that stays
open beside him; Lune Coyne shuffles violet cards; Tomas Rill carries a Court lantern; Sera Quill holds a brass
Meridian staff; Corran Holt is grey now and leans on his halberd for the knee; Hollis Fenn walks the high roads
with a staff and a wide hat.

## Pets (shipped — owner reviews in play)

Pets (`docs/handoff/pets.md`, `shared/pets/pets.model.ts`). Small companions, one per realm and three from the
deep places (eight in all). None is bought and none is given away: each is found where it lives.

- **Ember Newt** (Infernal). Seam newts lay their eggs where the Delve keeps its heat; a crate left long in warm
  water is the warmest place they know, so the first Seam Crate you fish up and open holds one. Its tail is a
  small flame: in the Delve it is a lamp of its own.
- **Prism Moth-kit** (Luminous). Prism Foragers swallow light, and sometimes the small things that follow it. Free
  one from a Forager's crystal ribs (six Foragers felled in the Reflection Channels) and it keeps humming the note
  it was caught on; while it hums, work in the Luminous teaches a little more. Glim calls it distant family.
- **Ink Pup** (Umbral). The Mirror Substitutes keep an Ink Pup as they keep everything, as proof. It has never once
  agreed with its reflection, and barks at anything that winds up behind you, or at a shade in the dark.
- **Star Owlet** (Celestial). Orrery owls nest where the old star charts were kept. The Board Herald found this
  egg wrapped in a chart, "filed under eggs", and hands it over on your third day of bounties. It hoots at ore.
- **Moss Hedgehog** (Verdant). Its quills are moss that decided to stay. It sleeps under whatever regrows fastest
  in the Rootglass Thicket, and wakes to whoever keeps it growing (eight harvests there). It noses out an extra
  herb now and then.
- **Rivet Maw hatchling** (the Underhearth, rare). Rivet Maws carry what falls. The Banked Furnace kept one egg
  banked with its embers, as if it knew something would need carrying after it fell. It fetches your drops.
- **Shade-kit** (the Ink Deeps, rare). Shades are what a light leaves behind; a shade-kit is what a shade leaves
  behind. The Gloam Warden guarded its egg. Small, curious, very fond of fish: with it watching, a bite comes sooner.
- **Sunling** (the Luminous Prism Mines, rare). The Hollow Sun was hollow because it was keeping something warm.
  What hatches when it falls is a very small sun that has decided you are its sky; in its light, wounds close slowly.

A pet is never hungry and never leaves. Feeding it what it likes only makes it fonder: at four it learns a trick,
at ten it gets a hat (a forge cap, a sunbloom crown, an amethyst bow, a star hat, an acorn cap, a miner's helmet,
a crescent circlet, a dawn-glass visor). Glim says one thing about each, the first time it meets them.

## The Lost Cabinets (2026-10-15) — shipped, owner reviews in play

The Lost Cabinets (`docs/handoff/lost-cabinets.md`, `shared/cabinets/cabinets.model.ts`, every word in
`shared/cabinets/cabinets.i18n.ts`, EN + ES). Owner idea: scan for them with the Mirror Slate.

**The maker: the Archivist, carried by the Ridge Couriers.** Before the Waystones the Archivist kept a Cabinet of
Curios: sixteen small true things the Archive could not file (a bell nobody rang, a seed that said no, a page left
blank on purpose). "A record that cannot hold a thing should not pretend to," she wrote, and sent each one home with
a Ridge Courier (the High Roads' couriers, above), to be kept where it was true. Every cabinet was latched with a
sliver of the Archive's moon mirror, so only the Archive's own glass could find it again. Then the Waystones came,
the Couriers stopped walking, and nobody wrote down where. Builds on: the Ridge Couriers and their caches (surface
height), the Mirror Slate ("a palm of the Archive's moon mirror"), the Archivist "putting things down" (the kept
morning), Hollis Fenn, the last Ridge Courier.

**Why the Scan is the Slate's first face.** The Slate is a palm of that same moon mirror: held up, it warms near
its own latches. It is Lune's glass that knows them, not Kael's brass, so a tier I Slate can scan.

**The sixteen** (catalogue order; place → curio): the Basalt Seamworks (up on the camp's high ledge) → *The Unstruck Bell*; the Luminous Court →
*A Jar of Noon*; the Nocturne Archive → *A Page Left Blank on Purpose* (its margin points under the Umbral gate); the
Celestial Orrery → *The Orrery's Lost Moon*; the Rootglass Canopy → *A Seed That Would Not*; Ember Quarry → *A
Courier's Tally Stick* (the last notch half cut: the Waystones opened that morning); the Reflection Channels' High
Road → *A Mirror That Blinked* (a beam's path into the Prism Mines); the Unrecorded Corridors → *The Unsigned
Letter* (the Corridors could not copy it: nobody to substitute), with the *Hatbox of Small Crowns*; the Orrery
Rings' High Road → *A Compass Rose Pressed Flat* (its north twitches toward the wells); the Rootglass Thicket →
*Moss in a Locket* (it grows toward the roots below the gate); the Ember Delve's Basalt Caverns → *The Forge-Mine
Lamp Wick* ("Deeper. The warm one waits under the halls."); the Underhearth → *A Coal That Kept Its Word*; the Ink
Deeps → *A Bottle of Clean Ink*; the Root Deeps → *The Ring Count* (dated "tomorrow", filed under patience); the
Prism Mines → *A Shadow, Folded*; the Orrery Wells → *The Last Star Chart* (its last line in the Archivist's hand).

**Clues.** Five curios carry a courier's note that tunes the glass to a deeper cabinet (Archive → Ink Deeps,
Thicket → Root Deeps, Prism road → Prism Mines, Orrery road → Orrery Wells, forge-mines → Underhearth); until then
the deep cabinet is silent to the glass.

**Treats and hats.** *Courier's Honeycomb*: couriers carried it on the high roads; it never spoils, and every
animal on the way would forgive you for anything (every pet eats it like its favourite). The *Hatbox of Small
Crowns*: one tiny hat for every kind of small creature the Archive ever met; they all fit; nobody knows how.

**The story arc** (one page per four cabinets): *The Archivist's docket* (every column ticked but "Collected"),
*What Hollis remembers* (he drew no lot: "Too young, she said. Carry letters. Letters come back."), *Why she put
them down*, *The Last Page*: the docket is full, and she sends her own *Curator's Loupe*: "You found what I put
down. Keep looking; it suits you." Glim, once its notice is open: "Your glass is warm. Something rare is near. I
can feel the latch from here."

## Story Act II in the game: Five Witnesses (2026-10-15) — shipped, owner reviews in play

Handoff: `docs/handoff/story-act-2.md`; every word in `shared/story/story.i18n.ts` (EN + ES), keeper lines in
`play/world/life.i18n.ts`. Builds on: Act I's break (Kael: "Five witnesses. One from each realm. Bring me five
honest accounts of what this crack did to them, and I'll tell you who drew the line."), the Underhearth's
"Act II's first pages", the Rift Gates and the four realm Delves, the Lost Cabinets, Glim's bond and its
first-lamp talk, Starfall Deep ("Below the Underhearth the rock gives out, and there is sky").

**The reading.** The five witnesses are the five realms' undersides. Each account is given when that
underside's keeper of the dark is ended and its chain closes: the **Furnace's** (Infernal, the Four), the
**Ink Deeps'** (Umbral), the **Root Deeps'** (Verdant), the **Prism Mines'** (Luminous) and the **Orrery
Wells'** (Celestial). All five say the same thing in their own realm's words: the line was drawn from below,
on purpose, and it keeps going down. The Codex keeps them as *The Witness Accounts*.

**The scenes** (the people of that realm, then Glim):

- *Let it end* — Kael: "Four went down to bank it. I stayed up top and called it duty. You put it out, and now
  I can call it what it was." Verrin files their ending "finished", a word never written on anything of
  Verrin's. Kael: "That is one account… Four more realms owe me theirs." Glim draws the Furnace Hall in solid
  line, "like closing a door gently".
- *The account in the dark* — Verrin: the dark "was left behind. Nobody chose it. The Warden only kept it."
  Rook Sable's chalk is right for once ("this way, if it is still this way"); two shards, "a door holds where
  both ends agree". Glim draws the Deeps dashed: "Dashed is honest."
- *The first cut* — Kesh: everything cut down there wants to be joined back on; "The crack was the first cut."
  Siv: "And somebody made that cut on purpose. Kesh and I agree on that. Write it down before we stop
  agreeing." Title **The Ungrafted** ("You came back the shape you went in. Down there, that is a title.").
- *A promise held still* — Aureth: the light that sets under the Luminous was promised to someone and forgot
  whom. Lune: every miner's bet on the light was right, "Odd thing to be sad about." Title **Dawn-Witness**.
- *The assumed down* — Sera: the Compact assumed which way was down; "The line was in the assumption." The
  Archivist refiles Nox's three-hundred-year-old margin note from insolence to evidence. Two shards "cut true
  against the new down".
- *Every column but one* (four Lost Cabinets, after the Fracture) — the Archivist's docket; Hollis Fenn
  remembers the couriers' honeycomb ("no courier walked without it"); the Archivist: "The crack is the one
  thing in the realms I never had a cabinet for." Glim: "Something rare is always nearer than the map says."
- *The light coming up* (all five accounts) — Kael: "Fire, dark, root, light and measure. Every one says the
  line goes down, further than the Furnace." The Archivist: the Orrery's last chart has one more line than it
  ever drew, in the Archivist's own hand, not yet written. Kael keeps his promise for later ("Not today"), and
  names the Keeper **Witness-Keeper**. Glim: "Someone patient left a lamp lit down there. I'd like to meet
  them." (The first lamp: hinted, never named.)

**The cliffhanger** (the end-of-act card): the fragment turns over on Kael's anvil by itself, warm side down;
far under the Seamworks the rock gives out and there is sky, and a light is coming up through it, "not lava,
and not Glim". Kael: "Starfall. I never wanted to say it aloud… Five witnesses, and a sixth mark at Keeper
height. Sleep. The lock comes next." Sets up Act III · The Fivefold Lock and Starfall Deep (the sixth mark
answers Act I's five tallies and Glim's Act III line "Six. Good. I was getting tired of five.").

**The towns afterwards.** Orla Stave: "Gran's ledger has four crates never collected, marked 'banked'. I
understand it now." · Verrin: "The Warden's hall is only dark now. Dark is not the same as kept. You did
that." · Rook: "Your route through the Ink Deeps matched mine. I'll have to make mine wrong again." · Kesh:
"Siv and I agreed about the Root Deeps. Do not tell her I said it was nice." · Siv: "Kesh wrote in the account
that I was right. Then crossed out 'right', wrote 'early'." · Aureth: "You held it still long enough to end.
The Court has more dawn in it this week." · Ilyra: "The prisms agree on one thing now, which they never do:
the light comes from below." · Sera: "Nine Waystones recalibrated to the new down. Nox won't stop smiling.
Unbearable." and, at the act's end, "Something is rising up the shaft at a constant rate. I'd prefer it were
not constant." · Nox: "She signed it: 'the model was wrong'. I have read it eleven times. Every one a joy." ·
the Archivist: "The docket has its first tick under 'Collected'. In your hand. I may frame it." · Tomas:
"Every lantern in the Court leans toward the Seamworks tonight, like glowcaps at dawn." · Kael (dialogue):
"Four hammers under the anvil now, beside mine. It has never rung truer." / "Not today. When the anvil rings
on its own, come. You will know the sound."

## One World, Phase 1 — the Seamworks on the Ember surface, the Waystones (shipped behind the preview gate — owner reviews in play)

Working names (owner decision 2026-10-15: they ship as working names; each renames in one i18n table):
**the Quarry Road** (the surface east of the Seamworks, sectors 4–7, where the Rivet Maws roam until P2 makes it
the Quarry), **the Plot** (west of the Seamworks, sectors −4…−1: the pond, the arch to the Homestead), **the Ember
Wilds** (the endless surface beyond), **the Quarry Head stone** (the first stone lit by hand), the other region
stones (Corridor Head, Thicket Head, Channel Head, Ring Head), the realm towns' stones (the Archive, Canopy,
Court and Orrery stones), and the **Meridian Survey** with its marks: Sera's Chart (4), Quick Hands (8),
Couriers' Memory (12), Meridian Surveyor (15).

**The Waystones.** Every Waystone is a Meridian transit aperture of Sera Quill's Compact. When the fracture
moved "down", the wild apertures went dark; Sera recalibrated nine to the new down (Act II), the rest wait
for a Keeper's mark at Keeper height. A lit stone agrees with every other lit stone (as a Rift Anchor's two
ends agree). The Ridge Couriers walked before the stones: lighting one is walking their road once, so nobody
has to again. The five town stones are Sera's trunk line, always lit. Glim, at the first dark stone: "A
Waystone gone dark. When the fracture moved 'down', the wild ones stopped agreeing. Light it, and it will
agree with the town stone again." The Waystone Shard's old line ("a splinter from a waystone that was never
built") now has stones to be a splinter of.

**The keepers' day.** Counter from six to seven; at dusk they walk to the Hearth fire in the square and spend
the evening there; from eleven they sleep upstairs over their shops (a window lit, then dark). A station is
never shut: at night E rings the bell — "A window lights upstairs, a yawn, the bolt. 'Coming, coming.'"

**The move.** "Your Delve moved under the town. What you had earned came with you; what your chests held is
back in your Satchel and Vault." (v2's claims carry over; tunnels dug in v2 do not: the world moved.)

## The Living World (2026-10-15) — shipped, owner reviews in play

Handoff: `docs/handoff/living-world.md`. Words: `src/app/play/world/living-world.i18n.ts` (EN + ES).

**The Ember Wilds are not empty: they were left.** Before the fracture moved "down", the old Keepers kept
waystations along the surface between the towns. The fracture took the roads; the ruins, camps and cellars stayed.
People still live out there who would rather not live in a town.

- **Ashwoods.** The one tree that grows in ash ("the ash here is old fire; plant in it and it remembers being
  warm"). Ember-red crowns you can stand in; trunks you climb like a rope; a burl at the foot that gives World-Root
  bark ("the Root reaches up here too"). **Ashberry bushes**: ember grubs nest in their roots.
- **Waystations and camps.** Ruins of the old Keepers' waystations (one wall, a lintel: "WELCOME" on the road side,
  "COME BACK" on the inside), camps left in a hurry with a bundle of torches nobody took ("Take three, leave a word"),
  wayside shrines (a rift standing on a plinth), wells sunk into the hills, signposts with words for whoever walks by.
- **The hermits.** **Orla, surveyor** ("I measured the Wilds once. They grew while I was measuring.") gives torches;
  **Tobb, ex-smith** of the Seamworks forge, keeps ashberries instead of fires and gives grubs ("they bite better
  than any bait Kael sells"); **Mira, well-fisher** ("the fish leap where the water is kind") gives glowcaps. Each
  gives once, ever.
- **Underground finds.** Fossil beds of the first Maws, rivets and all; hidden cellars ("for the winter the Delve has
  instead of winter", the key still in the strongbox); geodes of the stratum's own crystal; sealed vaults with a riddle
  ("No pick has opened me and none will. Breathe on me the way the staff breathes."); Maw and Bailiff dens; a
  **Bailiff elder** keeping a strongbox; **seam-engines**, brass older than the Seamworks, still ticking ("every tick,
  a seam somewhere far off closes by a hair"; no maker's mark, only a hand-cut "Sorry"; someone still oils one).
- **Critters.** Cinder finches (they nest where people slept: a flock means somebody lived there), ash hares (they
  burrow over cellars and vaults), ember beetles (catch one: an Ember Grub), dusk moths (they drink from glowcaps;
  catch one: a Glowcap), glowworms (living light on cave ceilings), leaping fish (where the water holds bites).
- **The day's mysteries** (seeded per UTC day; nobody knows who sends them): a wisp of pale-gold light that drifts
  ahead of whoever follows and settles when they stop; a whisper in no voice you know ("Not this way. That way. No,
  this way."); a door in the rock that was not there yesterday and opens on nothing but the rock behind it, and a
  little something left on the step. Glim: "That door was not there yesterday. I would remember. I remember doors."

## Day, night and the eclipse (2026-10-15) — shipped, owner reviews in play

Builds on Canon ("the Eclipse is a recurring cosmic pressure"; Umbral: the Nocturne Archive "beneath a fractured moon
mirror"), Sera Quill (Chief Meridian: "designed the eclipse model; wants it proved sound before panic weaponises every
estimate") and the Mirror Slate (a palm of that same mirror). Code: `src/app/shared/world-clock/`.

**The world's clock.** The realms keep one hour between them, the Meridian's: a day of twenty-four hours, a week of
seven days, a year of five months, one for each realm. The days are *Forgeday, Lightday, Inkday, Starday, Rootday,
Hearthday* and *Moonday*; the months *Emberwane* (Infernal), *Brightmere* (Luminous), *Inkfall* (Umbral), *Starturn*
(Celestial) and *Rootwake* (Verdant), fourteen days each. The years are counted from the morning the seam was held:
"Year N of the Held Seam". The Slate shows the hour because the moon mirror has always known it: every shard of it
still faces the sky it broke under.

**The eclipse.** Every fifth day the moon mirror crosses the sun for eight hours. The sky goes dark at noon, the
mirror throws the sun back in four spikes, and its flare is caught in the rock as **Eclipse Glass** ("warm on the side
that faced the sun and cold on the side that faced the Archive"). Each eclipse leans on one realm in turn (Infernal,
Luminous, Umbral, Celestial, Verdant): that realm's hunting ground gives the glass two to a cut. Under it the night
wakes at noon: the Moonwake opens, the Mirrorfin bites, the Ink Lanterns drift. Rift shrines touched under it drink
the dark and show twice as far. Sera's line about it: "Every eclipse is an observation."

**Sera Quill's Eclipse Ledger.** Sera wants every eclipse watched by someone who will write down what they saw, so she
keeps a ledger and pays for each observation, more at its marks (1, 3, 5, 8). Her rule, and the owner's: *a missed
eclipse is a gap in the data, not a mistake; the next one counts the same.*

**The dark's things.** *Moonwake Bloom*: "It shuts the moment anyone looks straight at the sun. The Archive keeps one
in a drawer, to prove the night happened." *Mirrorfin*: "Its scales are slivers of the moon mirror, and it swims up to
see itself. By day it remembers it is a fish and goes back down." The **Ink Lantern** (Bestiary, at last in the world)
drifts the Unrecorded Corridors by dark; the **Afterimage Moth** rises in the Reflection Channels only under an
eclipse — what the sun leaves behind when the moon crosses it.

**Who notices the hour.** Tomas Rill at night ("Every lantern in the Court is mine now. Walk slowly; they like to be
admired."); Sera Quill under the eclipse (the ledger); Rook Sable at night; the Arena's gatekeeper at dawn; the Trials
Warden under the eclipse ("The gates go quiet under an eclipse. Even they stop to look up."). Glim at nightfall ("I can draw the Moonwake now; it only holds still at night"), at the eclipse ("I am
brighter than the sky. I don't like it, and I love it.") and at dawn.

**The music.** At night the realm's tune drops an octave and leaves longer silences; under the eclipse its third goes
minor over a soft drone, "like a guardian the size of the sky". The Slate names each realm's theme: *Hymn of the Held
Seam*, *Noon over the Court*, *Margins of the Archive*, *The Orrery Turns*, *Rootwake*.

## The Eclipse Cascade and the machines to discover (2026-10-16) — shipped, owner reviews in play

**The Eclipse Cascade.** Lune Coyne's newest table lives only in the Mirror Slate's glass: a hundred runes on a
moon-mirror face (Ash, Ember, Thorn, Glint, Pulse, Sigil, Nexus, Fracture — the Rune Forge's own), falling the way the
Archive's shelves fall when one gives. "Five that touch are a word," she says. "A word that keeps falling is a
sentence." The wild is a **shard of the moon mirror** (it joins any word); the scatter is **the Eclipse** itself, which
only ever comes with the first fall. Where a word bursts twice, the glass remembers it and glows: a **spot** that
doubles every time a word bursts on it again. Three Eclipses and the glass holds its memory for ten spins; four and it
starts already glowing (**the Super Bonus**). Gold only — Lune's rule, printed on the glass.

**The machines to discover.** Lune learned her trade in the Prism Mines, and she is not the only one who ever built a
game. Each realm's Delve keeps one, left by the people who dug it:

- **The Orrery Tumbler** (Celestial — *found*): the Meridian Compact's surveyors measured the sky from underneath, and
  on the long shifts built a game from the orrery's spare brass: seven by seven stars that fall toward whichever down
  the rings decide. Every tumble turns the down; every tumble climbs the **orbit ladder**. Sera Quill swears it kept
  their tallies honest. It stands in the Orrery Wells' Gate Hollow, west of the return gate, still turning; find it once
  and its face settles into your Slate's glass.
- **The Inkwell** (Umbral — *not yet built*): the Unrecorded kept a well of ink that remembered every blot; what falls
  into the dark stays written (wilds that stick while their cell is unlit).
- **The Rootreel** (Verdant — *not yet built*): Kesh Arbo's wardens carved a counting-wheel from living rootwood; it
  still grows a row when it is pleased.
- **The Prism Lines** (Luminous — *not yet built*): Aureth's miners bet their shift on where the light would go; a beam
  bends through mirror symbols and every symbol it crosses joins the line.

Glim, at a big win: "Ooh, they keep falling!" · "Mega! The whole board lit up!" · "EPIC! Even the Eclipse is jealous!"
