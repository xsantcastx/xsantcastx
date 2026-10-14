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
