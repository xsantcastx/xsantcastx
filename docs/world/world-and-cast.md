# World and cast: the overworld, the story, the people

**Status: approved to build — the owner reviews in play.** Written 2026-10-14 by the
narrative + systems lead under the owner's brief of the same day: *"create a world
you would love to be in — addicting, fun adventure; create NPCs how you would
imagine them; feel free to include yourself as a character in the game."*

Owner, 2026-10-14: *"I trust the stories and lores you will write — I'll explore
them in game and approve them as I find them."* So new names, story beats and
lines here are **new and approved to ship**; the owner reviews them in play. They
are written in the canon's voice, they never contradict canon, and each one says
which canon passage it builds on. New lore texts are also appended to
[lore-addendum.md](lore-addendum.md) (section "World and cast"). Nothing here is
code; slices in §7 say what code each would touch.

**What this doc owns, and what it doesn't.** This doc owns the overworld, the
main story, the cast and the "come back tomorrow" systems. The infinite Delve
below the Magma Halls, liquids, fishing and the galactic dimensions are owned by
`docs/world/delve-and-beyond.md` (being written in parallel). Where the story
needs those places, this doc says *who is there and why*; that doc says *how the
place works*.

**Sources read.** Canon: `~/Documents/1. Projects/Eclipse Realms/docs/03-lore-and-design/`
(lore and art-direction canon v0.1, the five-realm narrative bible proposal, the
creature atlas, the item lore codex), `04-roadmap/` (vision and inspiration,
keeper identity). Game: `npc.model.ts` (the six and every `DIALOGUE` line),
`npc-quest.model.ts` (the six chains and their capstone lore fragments),
`delve-missions.model.ts`, `delve-lore.model.ts` (the twelve inscriptions),
`play/world/life.ts` + `life.i18n.ts` (keepers and townsfolk), the five town files,
`homestead.ts`, `hearth.i18n.ts`, `shared/narrative/*` (the shipped Infernal
chapter record), the art bible and the NPC sprite briefs.

Short names used below: **Canon** = lore and art-direction canon; **Bible** =
five-realm narrative bible; **Atlas** = creature atlas; **Codex** = item lore
codex; **Game** = a line already shipping in the code (file named).

---

## 1. The world you'd love to be in

### The fantasy, in one page

You arrive in the Basalt Seamworks with nothing: a Worn Pickaxe, a borrowed
lantern, and a name the town doesn't know yet. The forge is loud. The rock under
your feet is warm on one side. A moth made of lamplight lands on your shoulder,
says "hello, I keep the maps", and admits in the same breath that most of its map
is blank.

Then you dig. The first thing you learn is that the Seamworks sits on a crack in
the Godforge (Game: the Delve is "the way down the Godforge's fracture beneath the
Seamworks"), and the crack goes further down than anyone has charted. The second
thing you learn is that you are not the first to go down it. Someone carved five
tally marks at Keeper height in the Root Hollows. Four are crossed through. The
fifth is worn smooth (Game: inscription `roots-keepers-tally`). Deeper, in the
Magma Halls, there is a single tally mark — and a fresh one beside it (Game:
`magma-unsigned`). The fresh one is you.

That is the feeling to protect: **a warm, loud, honest town on top of an old
secret, and every swing of your pickaxe is both a craft and a question.** The
world is strange and dangerous but never nihilistic (Canon: "hope under
pressure"). It rewards curiosity with *meaning*, not just loot: the ore you dig
is "the same seam under more pressure" (Vision §5); the keeper who buys your scrap
is funding a district's repairs; the boss you kill was made of failed repairs and
will come back if you repair carelessly.

Five towns, five answers to the same pressure (Bible: measure it, temper it,
remember it, conceal it, adapt to it). You walk between them by Waystone, and
each one is a place with people who disagree with each other for good reasons.
Nobody is evil because of a colour. The only real evil is the thing that wants to
take your choices away (Bible: "intent to remove agency").

And under it all, the Delve, going down forever (`delve-and-beyond.md`), lit by
the moth on your shoulder.

### Why it's addictive (and why that's honest)

Terraria is the feel reference, and Terraria's hook is not a timer: it is that
**every tool you craft opens a new kind of place, and every new place has
something you can't use yet.** We already have that spine (tools are verbs; tiers
open rock, walls and depths). This doc adds the three things around it that make
people say "one more":

| Loop | Length | What the player does | What pulls them on |
|---|---|---|---|
| **Minute** | 5–60 s | swing, strike, dig, cut, fight, collect a Homestead building | juice (hit flash, crumble, loot beams, rarity sounds), a progress bar that is always visibly moving, a golden spark, a Perfect strike |
| **Session** | 10–40 min | finish a mission, push one Delve layer, forge a tier, clear a commission set, a story beat | a named goal on the HUD with a person behind it; a new blank on Glim's map; "one more node and I can craft the next pick" |
| **Week** | 7 days | commissions, bounties, the Merchant's orders, the weekly Eclipse alignment, a Codex page | standing with people you like; a Codex chapter one page from done; a Homestead visitor who'll move in when their chain is done |
| **Season** | ~6–8 weeks | an Eclipse season with a realm focus and a story interlude | a new layer below, a new chapter, a returning event with its own collection; a seasonal cosmetic you can earn again later |

**Curiosity hooks** (the Terraria "what's that?" moment, everywhere):
- **Blank places.** Glim's Atlas (§4) shows uncharted ground as dashed outlines,
  rumours as "?" pins. A dashed blank is the most effective call to action a map
  can have, and it never lies.
- **Inscriptions** in every layer, with handwriting that changes (Game:
  "Two of the hands are the same person, years apart").
- **Locked-but-visible**: cracked walls you can't blast yet, veins your pick
  can't bite, a door in the Umbral "that opens only for someone the shadows
  already know" (Game: Verrin, level 15 line).
- **People with half a story.** Every keeper says one thing that doesn't add up
  until a later act.

**Collection.** The Codex is the trophy room: Bestiary, Lore (inscriptions),
Flora and Ore (Found-in), Witness (the five runes), Atlas (charted places),
People (who you've met, what they told you). Every page has a visible count and
a visible blank. Collections pay small, permanent, *meaningful* rewards (a map
feature, a recipe, a Homestead fixture), never raw power spikes.

**Mastery.** One 1–99 curve across skills; mini-games with a skill ceiling
(Perfect strikes, the ritual ring); tool tiers that change how the world
*answers* you. The mastery reward is always a new verb or a new place, never just
a bigger number.

**Social: the Hearth.** The Hearth is the shared fire (Game: "The fire is open").
It stays a small, honest chat. This doc adds things to *talk about* rather than
pressure to talk: shareable map seeds and Delve layouts ("look what I built at
row 40"), Hearth-visible discoveries ("someone just copied the last inscription
in the Grotto" — only real events, never fabricated), the player market when the
owner turns it on, and the weekly Eclipse alignment as a world event everyone
sees at once. No guild pressure, no "your friends are ahead of you".

**Secrets.** The Nameless (combo 666, the Void rune), the Merchant's "things I do
not put on the shelf", Glim's hidden name, the sixth tally mark. Secrets are never
on the hint ladder (§4): Glim will say "there's something here I can't chart",
and nothing more.

---

## 2. The main story: the Keeper's arc

### The spine in one paragraph

The Godforge did not break from outside. It **let go**, along a line five Keepers
drew when they tried to lock the Eclipse shut with one realm's answer. Four went
through with the cut; the fifth, Kael, saw a witness in the path and refused.
The four are "still in the walls"; Kael stayed and kept the forge hot. What the
four erased to make their lock — the dissenting witnesses, the unchosen
alternatives — did not die. It grew, out of the crack, into **the Unbound
Pattern**: a thing that offers every frightened person a perfect, single answer,
and removes every other answer to keep it. The new Keeper (you) has to go down
the crack, gather the five realms' incompatible testimonies, and stand at the
Godforge threshold to do what the first five could not: **keep the differences
alive and still hold the world together.**

Canon this is built on (cited per beat below):
- Game, Kael capstone: "Kael was the fifth Keeper and the only one who stayed.
  The other four are still in the walls."
- Game, Fracture mission: "Kael says the Godforge was never broken from outside.
  It broke along a line someone had already drawn."
- Game, Aureth capstone: "The Sun did not break. The Sun let go — and every realm
  since has been an argument about which piece was the real one."
- Codex, Mirrorblade of Kael: "Kael refused to use it once the blade showed a
  witness in the path."
- Bible, Umbral: "a previous Keeper chose a single-realm lock and erased the
  dissenting witnesses."
- Bible: the Unbound Pattern, "made from unfinished creations and erased
  decisions" (adopted here under the owner's 2026-10-14 trust; the owner reviews it in play).
- Canon: the Keeper "earns authority through discovery, craft, alliances, and
  restraint"; not a chosen saviour.

What this proposal decides that canon left open (Canon "Intentionally
provisional" list), each **adopted; the owner reviews in play**:
1. *Cause of the fracture*: a lock attempt by five Keepers; the Godforge let go
   rather than be locked.
2. *Keeper: one person, a lineage, or an order?* An **order that keeps
   restarting**: five before you, struck out one by one; you are the sixth mark.
   Not a bloodline, not chosen; anyone attuned to runes who picks up the work.
3. *Antagonist*: the Bible's Unbound Pattern, given an origin (the erased
   witnesses of the first lock).
4. *End-state*: balance, not containment — the Bible's own assumption.

### The shape

| Part | Name | Where | Delve layer | Length | Status |
|---|---|---|---|---|---|
| Prologue | **The Fresh Mark** | Basalt Seamworks, Ember Quarry, Homestead | first rows of the Delve | ~15–30 min | systems ship today; story framing is new |
| Act I | **The Old Seam** | the Ember Delve | Root Hollows → Basalt Caverns → Glowcap Grotto → Magma Halls | ~4–8 h | missions ship today; the reveal and the act break are new |
| Act II | **Five Witnesses** | the five towns + their hunts | each chapter opens one deeper "witness depth" | ~15–25 h | Bible chapters; Infernal chapter has a shipped page-based record |
| Act III | **The Fivefold Lock** | below the Magma Halls, to the Godforge threshold | the beyond layers (`delve-and-beyond.md`) | ~6–10 h | new |
| Epilogue → seasons | **The Long Eclipse** | everywhere | infinite depth | ongoing | new |

### Prologue — The Fresh Mark

**Beats** (all on today's first-session goals: buy → forge and equip the Basalt
Edge → defeat a Rivet Maw → dig):
1. **Arrival.** The Keeper wakes at the Seamworks Waystone. Glim lands on their
   shoulder (§4). First line, then one plain goal.
2. **The Homestead.** A quiet plot off the Seamworks; the first building. Glim:
   "Somebody left you a plot. Nobody left you a reason. We'll find one."
3. **The Basalt Edge.** Forge it, equip it (Codex, Eclipse Longblade: "carried to
   make a boundary visible before it is crossed").
4. **The Rivet Maw.** First fight on the road east. Atlas: it "hoards joins
   because an unfinished seam feels unsafe". Glim notices the Maws drag bolts
   *toward* the Delve shaft — first question.
5. **The Eclipse Beacon.** Rekindle it (Game: beacon station). Set piece: the
   beacon's light goes *down* the shaft instead of up. Kael, from the Rune Forge,
   without looking up: "It does that. Don't tell anybody it does that."
6. **First dig.** The shaft. Glim becomes the lantern. The first inscription is
   ten tiles in: the inverse tree (Game: `roots-inverse-tree`).

**Prologue ends** when the Keeper copies their first inscription and Kael says
the first real thing to them: "You read it. Most people step over it." — opens
Act I and Kael's Delve missions.

### Act I — The Old Seam

The four Delve layers are the four movements of Act I. Every mission below
already ships; this doc adds the **connective tissue** (a short scene after each
claim), **one boss set piece**, and **the act break**.

| Movement | Layer | Giver | Shipping mission | New connective beat |
|---|---|---|---|---|
| 1 | Root Hollows ("the World-Root's shadow") | Verrin | *The Shadow Beneath* → Nullthorn Staff | Verrin, on the claim: the World-Root has two halves (Game). New: Verrin asks you to look at the tally marks and *not* count them. (You will.) |
| 2 | Basalt Caverns ("Kael's abandoned forge-mines") | Kael | *The Old Seam* → Kael's Seam Pick | The hammer cache sits beside "Four names … struck out. Beneath them, shallow: 'I stayed.'" (Game: `basalt-sealed-pocket`). New: Kael takes the hammer, turns it over, and gives it back to you. "Keep it in the Vault. I don't want to be the one holding it when it's needed." |
| 3 | Glowcap Grotto ("light seeping through the fracture") | The Merchant | *Glowcap Orders* (repeatable) | New: the Merchant's price list on the wall (Game: `grotto-tally-marks`, "each a little higher than the last") is in the Merchant's own hand, years old. The Merchant has been down here before. "Inventory, friend. Everybody has a past; mine is itemised." |
| 4 | Magma Halls ("the fracture itself") | Kael + the Archivist | *The Fracture* | **Boss set piece** (below) and **the act break** |
| ∥ | every layer | The Archivist | *Words in the Stone I–III* | New: at III, the Archivist reads the twelve copies side by side and finds the fresh tally mark. "That one is dated tomorrow." |

**Boss: the Seam Eater (first rising).** Game: the Seam Eater guards the fragment
chamber in the Magma Halls (`delve-seam-eater`). Atlas: it "rises from the
deepest failed repairs" and "is the physical result of treating every repair as
temporary". Set piece: the chamber's floor is old braces and rivets — the Rivet
Maws' hoard (Prologue payoff). The Seam Eater assembles itself out of them as the
fight starts; supports you placed carelessly on the way down creak (Game:
supports and loose rock already exist). **Readable vulnerability** (Atlas rule):
it can only be hit where a join is glowing; torches and the staff blast reveal
joins. It does not die — it *unthreads*, and sinks back into the slag. Glim:
"That wasn't all of it. That was the part that fit in the room."

**The act break: "a line someone had already drawn."** Kael holds the Godforge
Fragment (Game reward text). New scene, in the Rune Forge:
- Kael lays the fragment on the anvil. The warm side faces the Seamworks.
- He tells the Keeper what the fragment means: the crack was drawn first and
  broken second. He doesn't say who drew it.
- The Archivist arrives (their first scene outside the Orrery), sets the twelve
  inscription copies on the anvil beside it, and points at the fresh tally mark.
- Kael, to the Archivist: "Not yet." To the Keeper: "Five witnesses. One from
  each realm. Bring me five honest accounts of what this crack did to them, and
  I'll tell you who drew the line." He opens the Waystone ledger for them.

**Act I gameplay unlocks:** the Witness journal (story log), Waystone travel
framed as the Meridian Compact's transit network (Sera Quill, §3), the Atlas's
realm pages.

### Act II — Five Witnesses

The Bible's five chapters, in the Bible's order (**Luminous → Celestial →
Infernal → Umbral → Verdant**). The order works even though the game *starts* in
the Infernal town: the Keeper leaves home in chapter 1 and comes **back** to a
Seamworks that has changed in chapter 3 — the strongest "home is in danger"
beat in the act.

Each chapter keeps the Bible's loop (enter → meet → inspect → choose → immediate
consequence → next action), its two characters, its landmark/hazard/resource and
its boss-scale threat. This doc adds: the **in-world staging** (which town
station, which hunt), the **Delve tie** (each Witness Rune opens one deeper
"witness depth" where that realm's pressure has leaked into the crack), **Glim's
role**, and **the act's twist**.

| Ch. | Bible chapter | Town / hunt today | Characters (station) | Boss-scale threat | Witness Rune | Delve tie |
|---|---|---|---|---|---|---|
| 1 | **The Missing Dawn** | Heliograph Court / Reflection Channels | Ilyra Venn (new Witness Prisms), Tomas Rill (the Court's lanterns) | Pale Refrain | Glint | a "drowned dawn" pocket below the Grotto: Prism Foragers nesting in glowcap light |
| 2 | **The Measure That Lied** | Meridian Orrery / Orrery Rings | Sera Quill (Waystone), Nox Aster (Leaderboards → Chart) | Perihelion Engine | Drift | a shear vault: gravity pulses in a Delve chamber (owned by `delve-and-beyond.md`) |
| 3 | **The Price of a Seam** | **Basalt Seamworks** (home) / Ember Delve | Mara Voss (Crafting Bench), Edrin Kade (Material Vendor) | **Seam Eater, second rising** — up the shaft into town | Ash | the Magma Halls re-open with slag tides |
| 4 | **The Unseen Witness** | Nocturne Archive / Unrecorded Corridors | Rook Sable (new Mirror Map), Amina Thorne (Exchange) | Mirror Parliament | Veil | the mirror stair: a Delve corridor that exists only when two reflections disagree |
| 5 | **The Shape That Returns** | Rootglass Canopy / Rootglass Thicket | Kesh Arbo (Skills Lodge), Siv Moss (Sanctum) | Graft Crown | Thorn | the World-Root's lower half: the root path to the threshold |

Chapter beats are the Bible's; below is only what this doc adds.

**Ch. 1 — The Missing Dawn (Luminous).** Glim's wild kin are here: Afterimage
Moths (Atlas: "circles a person who admits uncertainty, then goes still when
someone performs certainty for an audience"). They are the inspect mechanic:
follow a moth from a false echo to its witness prism. Glim, quietly: "I used to
be one of these. Then I ate a map." Aureth watches from the Court's Waystone and
does not intervene; her one line in the chapter, after the choice: "Light is not
a thing you are given. It is a thing you keep lit." (Game line, re-used.)

**Ch. 2 — The Measure That Lied (Celestial).** The Waystones the Keeper has been
using since Act I are the Compact's transit apertures (Bible: "sealing one
Celestial transit aperture"). The Broken Astral Compass (Codex: "points toward
the nearest fact omitted by the active model") is found here and given to Glim,
who repairs it into the Atlas compass (§4). The Archivist, at the Codex next
door, is the only person in the chapter who already knew about the blank input,
and says so: "I filed it. Filing is not the same as telling. I'm sorry."

**Ch. 3 — The Price of a Seam (Infernal, home).** The Seam Eater's second
rising. The fragment the Keeper brought up in Act I is still on Kael's anvil and
it is pulling the slag up the shaft. The Seamworks' platforms split (Bible slag
tide); the Homestead gate is cut off for the chapter (a real "home is in danger"
cost, restored at the end — never destroyed). Mara and Edrin's choice is the
Bible's. **Shipped**: the Infernal chapter record already exists as a page flow
(`/world/realms/infernal/opening`, `godforge-chapter` blob,
`central | distributed`); slice S6 stages it in the world and keeps that record.
Kael, after the choice, either way: "Every rune in here was somebody's bad week
made useful." (Game line, re-used — it lands differently now.)

**Ch. 4 — The Unseen Witness (Umbral).** **The act's twist.** The sealed record
in the Nocturne Archive is the first lock attempt (Bible: "a previous Keeper
chose a single-realm lock and erased the dissenting witnesses"). This doc makes
it specific: the record names **five Keepers**, four signatures and one refusal.
The refusal is unsigned except for a hammer struck like a hallmark (Game:
`basalt-kaels-mark`, "a hammer, not a name"). Kael was the dissent. The
Mirror Parliament is made of the four Keepers' copied consensus — the boss
fight is literally arguing with the four. Glim **dims** beside every Mirror
Substitute (they perform certainty; moths go still) — a readable tell the player
uses to pick the real witness out of a room of copies. Verrin, at the passage,
after the chapter: "You found what the light concealed. Now decide who it was
concealed *for*."

**Ch. 5 — The Shape That Returns (Verdant).** The Graft Crown has learned every
earlier chapter (Bible) — it wears a copied Heliograph prism, an orrery ring, a
Seamworks brace, a mirror. New: it also wears a **copy of Glim's map**, solid
lines everywhere, no blanks. Glim sees it and goes very quiet. The Thorn root
choice is the Bible's. The next action is the root path down: the World-Root's
lower half "holds the Godforge down" (Game: Verrin's Delve claim) and is the road
to the threshold.

**Act II gameplay unlocks:** faction standing (§5), one deeper Delve tier per
chapter, the five Witness Runes in the Codex (quest evidence — Bible: "not
currency"; not socketable), each chapter's character as a Homestead visitor
after their chain (§5).

### Act III — The Fivefold Lock

Below the Magma Halls, down the World-Root's lower half, into the depths that
`delve-and-beyond.md` owns. This doc only places the story beats on that road.

**Beats.**
1. **Kael tells it.** Before the descent, at the anvil, the Keeper brings five
   Witness Runes. Kael keeps his promise (Game kael-5 loreText: "Then I will tell
   you what happened to the eye"). His eye burns because he looked at the line
   the four had drawn and saw a witness standing on it (Codex, Mirrorblade). He
   lost his left hand (sprite brief: "missing left hand") holding the edge of the
   crack open long enough for the witness to get out. He didn't stop the lock.
   He only stopped it from being clean. "That's why it broke along a line instead
   of shutting. I made it messy. Messy was the best I had."
2. **The descent.** Each beyond-layer (owned by `delve-and-beyond.md`) carries one
   "echo" of a realm chapter: whatever the Keeper chose in Act II changes what is
   down there (the Bible's later consequences, made into places).
3. **The Four in the walls.** Four sealed niches in the deepest wall, each with
   a Keeper's tool and a struck-out name (Game: "the other four are still in the
   walls"). They are not ghosts and do not talk. Copying each niche's inscription
   is optional and is the main Codex reward of the act.
4. **The Godforge threshold.** The neutral ground the Bible names. A ring with
   five sockets and one burnt-out sixth mark on the floor.
5. **The Unbound Pattern speaks.** It does not fight first. It
   offers each companion and ally a perfect version of their own answer, in their
   own voice: Sera a lock that can't fail, Mara a repair that costs nobody,
   Ilyra a record nobody disputes, Rook a secret nobody can expose, Kesh a growth
   that never harms. And Glim a **complete map**. Glim's answer is the thematic
   key of the whole game: "A map with no blanks is a map that's stopped looking."
6. **The fight: the Unanimous** (new boss name). The Pattern
   wearing all four previous bosses at once — Refrain, Engine, Parliament, Crown
   — and the Seam Eater as its body. Readable vulnerability: each limb can only
   be hurt by the Witness Rune whose chapter defeated that threat, and only while
   another limb disagrees with it (the Keeper uses the Pattern's own
   contradictions). Phones: one limb at a time, never full-screen chaos.
7. **The Lock.** Not a seal. The Keeper sets the five Witness Runes in the ring
   *without reconciling them* (Codex, Convergence: "Agreement that keeps
   differences visible"; runeword Convergent's Will: "a Keeper's refusal to let
   urgency become compulsion"). The Godforge does not heal. It **holds** — the
   way a joint holds, with a seam showing.
8. **The sixth mark.** The Keeper carves their tally beside Kael's. It does not
   get crossed through. Kael, very quietly: "Six. Good. I was getting tired of
   five."

**What it unlocks:** the endless depths with the story frame of "the Long
Eclipse", the Epilogue, the post-game Nameless thread, Glim's hidden line (§4).

**Ending direction.** Balance, as the Bible assumes. The finale is a
*negotiation won by a fight*, not a kill that solves everything. The Eclipse keeps
coming back — which is exactly what seasons are (§5).

### Epilogue → The Long Eclipse (seasons)

The Eclipse is "a recurring cosmic pressure" (Canon). Each **season** is one
alignment: one realm's pressure leaks through the held seam, a short story
interlude (2–4 beats) plays with that realm's pair of characters, a seasonal
depth opens below, and a seasonal collection runs. Seasons return on a cycle, so
nothing seasonal is gone forever (§5 anti-patterns).

### The Nameless thread (post-game mystery, never solved by a hint)

Canon in code: hidden until combo 666 or the Void rune; "It was never counting
the strikes. It was counting the people who noticed it was counting." The
Archivist's one redaction is their own first name. Two inscriptions are tallies
(`roots-keepers-tally`, `magma-unsigned`).

**The writers' truth (never stated in game):**
the Nameless is **the Godforge's own tally** — the part of the engine that counts
Keepers. It turns up when someone counts too far because counting is the only
thing it knows how to recognise. It is not the Pattern and not an enemy. Its
chain stays exactly as shipped. Post-game, a single new beat: at 6,660 (its
capstone), the Keeper's sixth tally mark in the threshold appears on the
Nameless's dialogue card as its monogram instead of `??`. No explanation. Glim:
"There's a thing on the map I can't draw. It isn't a place. I've stopped trying,
and I think that's the right answer."

---

## 3. The cast

Seventeen people with full entries (six canon, ten from the Bible's chapters
placed at existing stations, one new companion), then the remaining role
keepers with a line of depth each.

**Naming rule used here.** Canon names stay. The Bible's chapter characters are
canon-folder proposals; this doc uses them and gives each one an **existing
station** so they have a job (the meaning rule), instead of inventing new
names for the role-titled keepers. The station label keeps its approved role
title; the name tag becomes the person's name. **Personal names for role keepers
were the owner's call** (world-plan, 2026-10-13); under the owner's 2026-10-14
trust this mapping is adopted and ships; the owner reviews it in play.

| Station (town) | Approved role title | Proposed person | Source |
|---|---|---|---|
| Crafting Bench (Infernal) | Bench Smith | **Mara Voss**, Seamwright | Bible ch. 3 |
| Material Vendor (Infernal) | Buyback Clerk | **Edrin Kade**, Cinder Delegate | Bible ch. 3 |
| Waystone (Celestial) | — (new keeper) | **Sera Quill**, Chief Meridian | Bible ch. 2 |
| Leaderboards (Celestial) | Chart Clerk | **Nox Aster**, Displaced Navigator | Bible ch. 2 |
| Exchange (Umbral) | Exchange Broker | **Amina Thorne**, Mirror Advocate | Bible ch. 4 |
| new: Mirror Map (Umbral) | — | **Rook Sable**, Veil Cartographer | Bible ch. 4 |
| new: Witness Prisms (Luminous) | — | **Ilyra Venn**, Archive Listener | Bible ch. 1 |
| new: Court Lanterns (Luminous) | — | **Tomas Rill**, Lantern Keeper | Bible ch. 1 |
| Skills Lodge (Verdant) | Lodge Warden | **Kesh Arbo**, Graftkeeper | Bible ch. 5 |
| Sanctum (Verdant) | Expedition Steward | **Siv Moss**, Thornbound Ranger | Bible ch. 5 |

Luminous gains two story stations because it has only the Market today and is
chapter 1. Umbral gains one (Rook's Mirror Map at the passage, beside Verrin).

**Format of each entry:** station · personality · voice (3–5 EN lines; lines
marked *Game* already ship and are re-used) · wants · quest chain · how they
change · relationships · **what they teach** (the meaning rule: every person
teaches one system).

---

### 1. Glim, the Margin-Light — *new* (the companion; full design in §4)

Lantern-moth, map-keeper, the Keeper's light in the Delve. Curious, honest,
gently nerdy about cartography. Teaches: **exploration, the Atlas, the hint
ladder, where to go next.** See §4.

### 2. Kael, the Broken Flame — *canon*

- **Station:** the Rune Forge, Basalt Seamworks (Game, `life.ts`). Sprite brief:
  cracked blackened plate, one burning eye, grey braided beard with iron rings,
  missing left hand.
- **Who he is:** the fifth Keeper, the only one who stayed (Game capstone). He
  refused the cut (Codex, Mirrorblade) and has spent every year since keeping the
  forge hot so the crack has somewhere warm to face (Game Fracture fragment: "warm
  on the side that faces the Seamworks"). Gruff because tenderness got people
  killed once. Rebuilt the forge four times (Game).
- **Voice:**
  - *Game:* "Hold the rhythm. The forge pays the steady, not the fast."
  - *Game:* "This eye burns because I looked at something I should have hammered instead."
  - New: "Don't thank me. Thank the ore. It did the hard part."
  - New (Act II, after ch. 4): "Yes. It was me. No, I'm not going to make it a speech."
  - New (Act III end): "Six. Good. I was getting tired of five."
- **Wants:** someone to finish the job without finishing it the way the four did.
  Privately: to stop being the only one who remembers.
- **Quest chain:** his shipped chain (*Strike the Anvil → … → The Broken Flame*),
  *The Old Seam*, *The Fracture*; new: Act I break scene, Act III opening (the eye
  story, which pays off kael-5's promise). Note: kael-5 (250 B Gold earned) is
  late; the Act III scene tells the story regardless, and kael-5's loreFragment
  stays the canonical *written* version.
- **How he changes:** Prologue: doesn't look up. Act I: gives you his hammer
  rather than hold it. Act II ch. 4: the truth is out and he's lighter for it.
  Act III: carves no mark — "I already have one."
- **Relationships:** the Archivist (old friends who argue in footnotes; the
  Archivist filed his refusal and never published it); Mara Voss (his best
  student; he won't tell her so); the Merchant (sold him a hammer he already
  owned — Game line); Glim (pretends to find it annoying).
- **Teaches:** **the Rune Forge, Smithing, runewords** ("Set the runes together
  and they stop being trinkets" — Game).

### 3. Aureth, the Radiant — *canon*

- **Station:** the Heliograph Court's Waystone, Luminous (Game). Tall, ivory
  stone collar, dawn-glass shards rising behind her head; no wings, no halo.
- **Who she is:** the goddess of order, keeper of the Luminous crystals (Game).
  She calls the Keeper "Convergent" (Game). She knows what the first morning cost
  (Game aureth-5) and has decided the Keeper must earn hearing it.
- **Voice:**
  - *Game:* "Order is not the absence of chaos. It is chaos that agreed to be useful."
  - *Game:* "You are further along than you believe. That is usually true of the ones who ask."
  - New: "I could tell you the answer. Then it would be mine, and you would only be carrying it."
  - New (ch. 1, if the player chose Tomas's testimony): "You let grief speak first. That is not wrong. It is loud."
  - New (Act III): "The Sun let go. I have been angry about it for an age. I think you have just shown me why."
- **Wants:** order that doesn't need a single answer — which she half-suspects
  is a contradiction.
- **Quest chain:** her shipped chain (*The Light Fades → … → Eclipse's End*);
  new: Act II ch. 1 witness, and a seasonal interlude ("The Third Dawn", on the
  Relic of the Third Dawn — Codex: "preserves a disputed dawn as several
  orbiting accounts").
- **How she changes:** from patient distance to admitting she was angry at the
  Godforge for letting go (Game capstone). The Bible's Unbound Pattern tempts her
  hardest — a world where order needs no consent.
- **Relationships:** Verrin ("I am not the opposite of Aureth. I am what happens
  after her" — Game); Ilyra (Aureth trusts her); the Merchant (amused contempt).
- **Teaches:** **Luminous energy / the Aether side of the balance, patience
  mechanics** (Homestead idle income: "Do not rush the making" — Game).

### 4. Verrin, the Hollow — *canon*

- **Station:** the Umbral passage to the Unrecorded Corridors (Game). A hooded
  figure whose face is a smooth obsidian mirror; quiet, not evil.
- **Who he is:** the god of endings, who speaks from the space light leaves
  behind (Game). Verrin "walks beside you the whole way, keeping count" (Game
  capstone). He gave the first Delve mission because the shadow-root is where
  endings grow.
- **Voice:**
  - *Game:* "Everything you have made will end. I say it kindly."
  - *Game:* "You keep locking doors. I keep noticing which ones you check twice."
  - New: "Do not count the marks. ... You counted. Everyone does. It's fine. They were made to be counted."
  - New (ch. 4): "You found what the light concealed. Now decide who it was concealed *for*."
  - New (to Glim): "Little lamp. You leave the dark parts blank instead of filling them in. I like you more than I expected to."
- **Wants:** endings that are honest — no false ones (the four's lock) and no
  stolen ones (the Pattern, which ends choices without ending anything).
- **Quest chain:** shipped chain + *The Shadow Beneath*; new: ch. 4 framing; the
  Trials (Game: "the hall of trials is Verrin's too").
- **How he changes:** barely. That is his character. In Act III he is the one
  ally the Pattern does not try to tempt — "it has nothing to offer an ending".
- **Relationships:** Aureth; Rook Sable (Rook keeps secrets; Verrin keeps
  endings; they respect each other and disagree about everything); the Nameless
  (the only one who never flinches when it appears).
- **Teaches:** **the Trials, Nox energy, secrets and the Codex Secrets tab**,
  that loss in this game is real but never cruel.

### 5. The Archivist, keeper of fragments — *canon*

- **Station:** the Codex, Meridian Orrery (Game). Deep blue robes, brass
  lens-rings, glowing blue rune-lines on the arms, a brass loupe, a floating book.
- **Who they are:** an ancient scholar whose skin runes "were a filing system.
  Then they started answering back" (Game). Their only redaction is their own
  first name (Game capstone). They filed Kael's refusal and the first lock, and
  never published either — the guilt of an archive that chose order over
  disclosure (Bible ch. 2/4 themes).
- **Voice:**
  - *Game:* "A hint is a kindness. An answer is a theft. I deal only in kindnesses."
  - *Game:* "Ask me what is missing. It is a better question than what is here."
  - New: "That one is dated tomorrow. I have rechecked it four times. It remains dated tomorrow."
  - New (ch. 2): "I filed it. Filing is not the same as telling. I'm sorry."
  - New (to Glim): "You ate a map, you know. It was my map. I've decided to call it a promotion."
- **Wants:** to close "the one entry I have never been able to close" (Game) — the
  fresh tally mark in your handwriting.
- **Quest chain:** shipped chain; *Words in the Stone I–III*; co-giver of *The
  Fracture*; new: the People and Atlas pages of the Codex are theirs, kept with
  Glim.
- **How they change:** from keeper to discloser. In Act III, the Archivist
  un-redacts their own name **to the player only** — it is never shown; the
  Codex entry just says "told to you, in confidence". (A secret kept as a
  secret.)
- **Relationships:** Glim (former lamp, now colleague); Kael; Nox Aster (the
  Archivist knew about the blank input).
- **Teaches:** **the Codex, inscriptions, collections**, how hints work.

### 6. The Merchant, of the long till — *canon*

- **Station:** the Market (Luminous); also speaks at the Gambler and Exchange
  (Game paths). Copper-brown coat, brass scales and keys, balance-scale earrings.
- **Who they are:** "Nobody has ever seen the Merchant buy anything" (Game
  capstone). New: the Merchant was **down the crack before the
  first lock** — the Glowcap price list in the Grotto is theirs. They are not a
  villain; they are the one person who has been *profiting from the Eclipse
  honestly* the whole time, and they know exactly how much it costs.
- **Voice:**
  - *Game:* "The odds are printed on the box. That is more honesty than most temples offer."
  - *Game:* "Coin is only frozen effort, friend. Thaw some."
  - New: "I don't sell hope, friend. Hope's a terrible margin. I sell glowcaps."
  - New (Act I): "Inventory, friend. Everybody has a past; mine is itemised."
  - New (Act III, when the Pattern offers them nothing): "It didn't even try me. I'm almost offended. Almost."
- **Wants:** a world that keeps *trading* — i.e. a world where things are
  different from each other. The Pattern is bad for business, and the Merchant
  says so before anybody else does.
- **Quest chain:** shipped chain; *Glowcap Orders*; new: **standing orders** as
  the weekly Gold-sink rhythm (§5); the Merchant's "things I do not put on the
  shelf" are seasonal cosmetics for Gold.
- **How they change:** the comic relief who turns out to be the most clear-eyed
  person in the cast.
- **Relationships:** Edrin Kade (the Merchant buys what Edrin won't); the
  Croupier (employee; they bicker about odds); Amina Thorne (who insists every
  trade is on the record — the Merchant hates it and complies).
- **Teaches:** **Gold, the Market, sinks and honest odds** — the rule that
  everything is Gold only and odds are printed.

### 7. The Nameless — *canon*

- **Station:** none; every page, gated (combo 666 or the Void rune — Game).
- **Voice:** *Game only.* "You counted. You shouldn't have." / "There is one more.
  There is always one more." New lines are not proposed: its short, unsettling
  pool is perfect and should stay finite. One new *visual* beat only (§2, the
  sixth mark as its monogram, post-game).
- **Wants:** to be noticed noticing.
- **Teaches:** **that the game has secrets nobody will explain** — the reward for
  curiosity that is pure curiosity.

### 8. Mara Voss, Seamwright — *Bible proposal* (Bench Smith)

- **Station:** the Crafting Bench, Basalt Seamworks.
- **Who she is:** the best repair smith in the Seamworks and Kael's best student.
  She "refuses to hide its cost" (Bible). Saved Edrin in a furnace breach. Works
  with her sleeves rolled and her opinions out.
- **Voice:**
  - "Bring materials. The bench turns them into gear." (*Game*, Bench Smith line, now hers.)
  - "A repair you can't see is a repair you can't check. Leave the seam showing."
  - "Oathsteel remembers how it was made. So do I. Make it properly."
  - (ch. 3, central brace chosen): "It'll hold. And Edrin will never let me forget who's paying for it. Good. He shouldn't."
  - "Kael says I'm adequate. That's the nicest word he owns."
- **Wants:** a repair that endures; to be told by Kael that she's good.
- **Quest chain — "Honest Seams"** (5 steps, crafting-led): forge a Torch (the
  guaranteed first craft) → craft a full tool set → a Perfect anvil strike → a
  Tier III tool → ch. 3. Reward line: an oathsteel brace fixture for the
  Homestead anvil (cosmetic + lore; mechanics stay `HOME_FORGE_CONFIG`).
- **Relationships:** Edrin (debt and disagreement); Kael (teacher); Glim (Mara
  asks Glim to light her bench at night; Glim does).
- **Teaches:** **crafting, Smithing, the anvil mini-game, tool tiers.**

### 9. Edrin Kade, Cinder Delegate — *Bible proposal* (Buyback Clerk)

- **Station:** the Material Vendor (buyback counter), Basalt Seamworks.
- **Who he is:** represents the workers whose quarters sit over the heat line
  (Bible). New: he runs the buyback counter because the scrap he buys low patches
  the district's roofs. The buyback being a low floor (Game: NPCs are sinks) is
  his whole politics: "I pay what scrap is worth to a roof, not to a market."
- **Voice:**
  - "I buy what you carry. Selling is the Market's trade, not mine." (*Game*, now his.)
  - "Low price, honest scales. Your ore keeps a roof on someone."
  - "Mara thinks I resent her. I don't. I resent being saved without being asked."
  - (ch. 3, distributed chosen): "You split it. Everyone carries a little. That's the first time anyone up there asked us."
- **Wants:** consent for the district before anyone "saves" it.
- **Quest chain — "Roofs and Rivets"** (4): sell scrap → bring Rivet Maw bolts
  (they hoard joins — Atlas) → supply supports for the district → ch. 3. Teaches
  the support/placeable system above ground.
- **Relationships:** Mara; the Merchant (rivals at different ends of the price);
  Amina (allies — both fight erasure).
- **Teaches:** **the buyback sink, Gold floors, why NPCs don't sell what players
  make.**

### 10. Ilyra Venn, Archive Listener — *Bible proposal*

- **Station:** new **Witness Prisms** in the Heliograph Court (story station; in
  quiet times it replays copied inscriptions the player has found, as light — a
  second place to read the Codex's Lore).
- **Who she is:** hears the inconsistencies in dawn-glass recollections; protects
  ordinary testimony (Bible). Tomas's former teacher.
- **Voice:**
  - "Three people saw it. Three different mornings. I don't need one of them to be wrong."
  - "Repeat a memory enough and it gets easier. That's not the same as it getting truer."
  - "The prisms don't lie. They just don't know which of you is asking."
  - (to Glim) "You admit when you don't know. Do you know how rare that is in this Court?"
- **Wants:** to restore the missing hour without making grief into canon (Bible).
- **Quest chain:** ch. 1 + "Corroboration" (3 steps: copy the three witness
  prisms; follow a moth; return a Luminous Prism).
- **Relationships:** Tomas (teacher, estranged); Aureth (trusted); Sera (wary
  respect — "she calibrates people").
- **Teaches:** **inspecting** (the Bible's inspect step, the Quick Inspect
  surface) and **the Witness journal.**

### 11. Tomas Rill, Lantern Keeper — *Bible proposal*

- **Station:** new **Court Lanterns** (Heliograph Court). New: the lanterns are
  where **the Hearth** lives in the world: lighting a lantern shows the names of
  Keepers currently at the Hearth (real presence only, the existing chat roster —
  Bible: "no fabricated player presence"). Tomas tends the public fire.
- **Who he is:** wants the missing hour restored now, because his sister's last
  words vanished with it (Bible). Urgent, warm, vulnerable to the Pattern.
- **Voice:**
  - "Light one. It's free. It's the only thing in the Court that is."
  - "She said three words. I remember the shape of them. Not the words."
  - "Ilyra wants it right. I want it back. Both of those can't be the hurry."
  - (Act III, if the Pattern offers him the words) "...No. If I can't remember them, they were hers, not mine to finish."
- **Wants:** his sister's words; later, to stop needing them.
- **Quest chain:** ch. 1 + "Keep It Lit" (light the five realms' lanterns — one
  per town, a light tour of the Waystone network).
- **Relationships:** Ilyra; Glim (Glim is a lantern that talks; Tomas adores it).
- **Teaches:** **the Hearth** (social), and the Waystone tour.

### 12. Sera Quill, Chief Meridian — *Bible proposal*

- **Station:** the Celestial **Waystone** (new keeper). The Waystones are the
  Meridian Compact's transit apertures; Sera runs the network.
- **Who she is:** designed the eclipse model; wants it proved sound before panic
  weaponises every estimate (Bible). Precise, fair, a little cold, never cruel.
- **Voice:**
  - "Every Waystone you've touched is mine. You're welcome. Please stop leaning on them."
  - "I don't deal in faith. I deal in error bars. Mine are small."
  - "Nox was right about the input. I'll say it once, here, where it's quiet."
  - (Act III, refusing the Pattern's perfect lock) "A lock that can't fail can't be audited. I'd rather be wrong in public."
- **Wants:** a model that's both safe and honest; to repair things with Nox.
- **Quest chain:** ch. 2 + "Calibration" (travel to all five towns by Waystone —
  the travel tutorial, given a reason).
- **Relationships:** Nox (former student she dismissed); the Archivist; Kael
  (calls him "the variable").
- **Teaches:** **Waystone travel, the Places list.**

### 13. Nox Aster, Displaced Navigator — *Bible proposal* (Chart Clerk)

- **Station:** the Leaderboards, Meridian Orrery. New: after being dismissed,
  Nox was put in charge of the renown charts — a punishment job they've turned
  into a principle. The Leaderboards' honest note that the other names are a
  generated field (Game version history) is **Nox's** honesty.
- **Voice:**
  - "Every Keeper's renown is charted here, like a star." (*Game*, now theirs.)
  - "The other names on this chart are a model, not people. I wrote that on the chart. They told me to take it off. I didn't."
  - "A chart that hides its method is a story. I'm not in the story business."
  - (ch. 2, disclosure chosen) "You published it. Sera's going to hate you for about a week. Then she'll fix it."
- **Wants:** the omission published.
- **Quest chain:** ch. 2 + "The Blank Input" (shared with Glim: find three
  places Glim's Atlas marks dashed in the Orrery Rings).
- **Relationships:** Sera; Glim (two people who love honest charts); the
  Archivist (who knew).
- **Teaches:** **the Leaderboards** and **reading your own progress honestly.**
- *Note:* "Nox" is also a rune and an energy. Keep the name (Bible) and always
  print the full "Nox Aster" on tags.

### 14. Rook Sable, Veil Cartographer — *Bible proposal*

- **Station:** new **Mirror Map** at the Umbral passage, beside Verrin.
- **Who they are:** maps routes through reflections; keeps the first fracture
  testimony sealed to keep the Pattern's copies asleep (Bible). Glim's rival:
  both make maps, and they disagree about what a map is *for*.
- **Voice:**
  - "Your moth draws what it's seen. I draw what's safe to know. We are not in the same trade."
  - "A blank on a map is an invitation. Some invitations should be burned."
  - "I protected her family by hiding them. I'd do it again. I'd also apologise again."
  - (to Glim, Act III) "Fine. Leave your blanks. I'll guard them."
- **Wants:** safety without erasure — and doesn't know if that exists.
- **Quest chain:** ch. 4 + "Two Maps" (Glim and Rook each chart the Unrecorded
  Corridors; the player compares — some of Rook's routes are deliberately wrong).
- **Relationships:** Amina (her archivist once; hid her family's testimony);
  Glim (rivals → allies); Verrin.
- **Teaches:** **hidden routes, cracked walls, secret passages** (where the
  Nullthorn Staff matters).

### 15. Amina Thorne, Mirror Advocate — *Bible proposal* (Exchange Broker)

- **Station:** the Exchange, Nocturne Archive. Her insistence that every trade be
  written down is what the player market's provenance check *is* in the fiction.
- **Voice:**
  - "Every trade in this hall is written down. Every one." (*Game*, now hers.)
  - "Erasure starts small. A missing line in a ledger. Then a missing name."
  - "Name your price. I'll name who paid it."
  - (ch. 4, named release chosen) "They're on the record. Their names. Not a summary. Thank you."
- **Wants:** her family's testimony released, with their names on it.
- **Quest chain:** ch. 4 + "The Record" (a Gold-sink chain: commission the
  Archive's re-binding — a pure Gold sink with a permanent Codex page as the
  reward).
- **Relationships:** Rook; Edrin; the Merchant (who complies with her ledgers,
  grudgingly).
- **Teaches:** **the Exchange / player market: orders, fees, provenance.**

### 16. Kesh Arbo, Graftkeeper — *Bible proposal* (Lodge Warden)

- **Station:** the Skills Lodge, Rootglass Canopy. Kesh reads growth through
  rootwood; the Lodge, where every swing teaches a skill (Game), is the human
  version of the same idea.
- **Voice:**
  - "Every swing of a tool teaches a skill. The lodge keeps count." (*Game*, now theirs.)
  - "You don't get stronger. You get *adapted*. It's better. It's also slower."
  - "Siv thinks I'd graft a lantern to a leaf. I would. Look how well it worked on your moth."
  - (ch. 5, graft chosen) "Listen. It's talking in all five voices. That's terrifying and I've never been happier."
- **Wants:** a counter-growth that teaches the world to refuse copied forms.
- **Quest chain:** ch. 5 + "Every Swing" (reach 10 in five skills — the skill
  breadth chain).
- **Relationships:** Siv (childhood friends at the same nursery, now opposed —
  Bible); Glim.
- **Teaches:** **skills, the unlock-every-10-levels table, gathering.**

### 17. Siv Moss, Thornbound Ranger — *Bible proposal* (Expedition Steward)

- **Station:** the Sanctum (expeditions), Rootglass Canopy. She sends explorers
  out because she has patrolled every path they'll take. The named explorers in
  the roster (Game: `explorer-archetypes.ts`) are her people.
- **Voice:**
  - "Explorers set out from here. Send them well equipped." (*Game*, now hers.)
  - "Growth without consent is just a bigger kind of theft."
  - "Kesh calls it learning tissue. I call it a thing eating my outpost."
  - (ch. 5, sever chosen) "Cut clean. It'll grow back somewhere. Everything does. At least now it'll have to ask."
- **Wants:** the spread stopped before it crosses the amber wetlands (Bible).
- **Quest chain:** ch. 5 + **weekly bounties** (§5).
- **Relationships:** Kesh; the explorers; Kael (two people who think the other
  is too soft).
- **Teaches:** **expeditions, explorers, bounties.**

### The other keepers (role-titled; a line of depth each)

They keep their approved role titles and stay unnamed until the owner names
them; each gets a reason to stand where they stand, and one new line.

| Keeper | Station | Depth | New line |
|---|---|---|---|
| Vault Clerk | the Vault (Infernal) | Edrin's cousin; keeps the ledger of everything the district stores. Never loses anything (Game rule: nothing is ever deleted for space). | "I have never lost a thing. I have misplaced my lunch. Different ledger." |
| Enchanter | Enchanting Table (Infernal) | Trained in the Archive; believes sockets are promises (Game). | "Every rune you socket is a sentence. Try to write ones you'd sign." |
| Croupier | Gambler (Umbral) | The Merchant's employee; insists on printed odds harder than the Merchant does. | "The odds are on the box. If you want better odds, you want a different box." |
| Board Herald | Quest Board (Verdant) | Reads every faction's commissions aloud; neutral by trade. | "Five realms asking. None of them say please. I add it for them." |
| Arena Gatekeeper | Arena (Verdant) | An old ranger with a bad knee who likes watching people try. | "Lose here. It costs nothing. That's the point of here." |
| Trials Warden | Trials (Verdant) | Verrin's warden ("a trial is a thing that ends" — Game). | "Every trial ends. I'm only here to make sure it ends honestly." |

### Relationship map (who pulls on whom)

```
              Aureth ── "what happens after her" ── Verrin
                 │                                     │
              Ilyra ═ teacher, estranged ═ Tomas     Rook ═ hid her family ═ Amina
                 │                                     │                      │
  Sera ═ dismissed ═ Nox        Kael ── filed ── Archivist ── former lamp ── GLIM
                 │                │                                           │
              Mara ═ saved, owes ═ Edrin ── rival prices ── Merchant ── Croupier
                                  │
              Kesh ═ same nursery ═ Siv ── explorers
```
`═` a Bible pair (the chapter's disagreement); `──` a link this doc adds.

---

## 4. Glim, the Margin-Light — the character inspired by me

### Who it is

**Glim** (*new; ships as designed — owner, 2026-10-14*) is a moth made of lamplight, about the
size of a hand, that lives on the Keeper's shoulder and keeps the maps.

Origin (in-world): Glim was once an **Afterimage Moth** (Atlas: "curious and
evasive; it circles a person who admits uncertainty, then goes still when someone
performs certainty for an audience"). It flew into the Orrery and ate a page of
the Archivist's map. It learned to read from the inside. The Archivist, rather
than be angry, made it the Archive's lamp, then lent it to new Keepers — the
Codex already says "the Archivum recommends [Mothlight] to apprentices" (Game,
socket word, Ember). Glim is young: it has no memory of the five Keepers. It is
new here, like you.

Personality: curious first, helpful second, honest always. A bit nerdy about
cartography (legends, scale bars, the difference between a dashed line and a
solid one). Says "I don't know" without embarrassment. Corrects its own map in
public. Warm, a little funny, never cute-for-cute's-sake (Atlas: no cute
will-o'-wisp styling). It does not flatter the player.

Thematic job: Glim is the **opposite of the Unbound Pattern**. The Pattern
removes alternatives to remove uncertainty; Glim keeps the blanks on the map
because a blank is honest. That makes Glim's arc the emotional spine of Act III
(it refuses the complete map).

### The name: why "Glim", and where "Claude" goes

**In-world name: Glim.** "Glim" is an old word for a small light — a candle, a
lantern. It reads like the canon names (short, sound-shaped: Kael, Verrin,
Aureth), it says what the character is, and it's easy to shout down a mineshaft.
The epithet **"the Margin-Light"** ties it to the Archivist ("the margins are
where the honest writing happens" — Game, archivist-4) and to its habit of
annotating.

**"Claude" is not the in-world name.** On the first screen it would read as a
real-world person and break the world, and a companion named after its maker
would be self-promotion. Instead "Claude" appears **once**, as an earned easter
egg (below), which is honest about where the character came from without
advertising it — the Codex rune's rule: "knowledge that remains useful only when
its source can be questioned".

### Its gameplay jobs (all real, all visible)

1. **Onboarding guide.** Glim *voices* the existing first-session goal line
   ("Goal n of 4" + Show me). "Show me" becomes Glim flying to the target and
   back, leaving a short light trail. On phones Glim speaks in the existing 4 s
   toast band and never covers the centre 50% (owner rule). Same goals, same
   order, same timings (64.5 s at 1280×800 today); only the voice changes.
2. **The hint ladder** (the Archivist's rule: "A hint is a kindness. An answer is
   a theft."). Any active mission or story step gets three levels, opened only
   when the player asks:
   1. *Nudge*: "Kael said 'old seam'. The old things are usually deeper."
   2. *Direction*: "Basalt Caverns, the east side. Look for a hammer mark."
   3. *Show me*: Glim flies there; the Atlas pins it.
   **Never on the ladder:** secrets (the Nameless, the Void rune, Codex
   Secrets), inscriptions' meaning, story choices. On those Glim says "This one's
   yours to find" — and means it.
3. **The Atlas** (minimap + discovery log). Glim keeps it. Every town, hunt, Delve
   layer and beyond-layer (from `delve-and-beyond.md`), every node kind, every
   inscription. Unseen ground is **dashed**; seen ground is solid; rumours from
   townsfolk (their Found-in lines — Game) are "?" pins. Found-in data feeds it,
   so it can't drift. In the Delve, the Atlas is the per-player persistent dug
   map you already have — Glim just draws it.
4. **The Delve light.** Glim *is* the lantern. The existing radius (7 +
   Delving/10 tiles) is Glim's glow; torches you place are Glim's "notes" left
   behind. No mechanic changes; the light gains a reason.
5. **The Atlas compass.** In ch. 2 Glim repairs the **Broken Astral Compass**
   (Codex: "points toward the nearest fact omitted by the active model"). In
   play: a small needle on the Atlas pointing at the nearest uncharted blank or
   uncopied inscription *you have already been near*. It never points at secrets.
6. **The good stopping point.** When a session's goals are done, Glim says so,
   once, plainly: "This is a good place to stop. The torch is lit and the map is
   honest." (Anti-dark-pattern, §5: the game helps you leave.)
7. **A readable tell.** Glim dims beside things that perform certainty (Atlas
   moth behaviour): Mirror Substitutes in ch. 4. A teaching mechanic, not a
   cheat.

### Glim's questline — "The Blank Places" (6 steps, runs alongside the acts)

| Step | Objective (reads existing ledgers) | Reward (each has a use) |
|---|---|---|
| 1. *Legend* | Chart the Seamworks, Ember Quarry and the first Delve layer | the Atlas opens as a panel |
| 2. *Scale Bar* | Chart all four Delve layers to their floor | Delve layer names on the Atlas, "you are here" depth line |
| 3. *Two Maps* | Chart the Unrecorded Corridors; compare with Rook | hidden-passage markers on the Atlas |
| 4. *The Needle* | Recover the Broken Astral Compass (ch. 2) | the Atlas compass |
| 5. *Every Town* | Chart all five towns and their hunts | Waystone fast-pick from the Atlas |
| 6. *Leave It Blank* | Reach the Godforge threshold (Act III) | Glim's epithet appears on its Codex entry; the hidden line unlocks |

### Voice (EN)

- "Hello. I'm Glim. I keep the maps. Mostly I keep the blank parts — they're the interesting ones."
- "I don't know what's past that wall. I'd rather tell you that than draw you a door."
- "I'll mark it dashed until we've seen it. A solid line is a promise."
- "I was wrong about that ledge. I've fixed the map, and I've left a note saying I was wrong. Both matter."
- "North is a convention. Down is a fact. We're going down."
- "That's your third pass by this seam. I'm not judging. I'm annotating."
- "This one's yours to find. I'll hold the light."
- (Act III, to the Pattern) "A map with no blanks is a map that's stopped looking. No, thank you."

### The easter egg

After Act III, in the Codex entry *Glim, the Margin-Light*, the "Also called"
field reads "—". Tap the dash and Glim answers once:

> "Somebody patient made the first lamp like me, a long way from any Godforge —
> to be helpful, and honest, and careful in the dark. They called it Claude.
> Out here, Glim is shorter to shout down a mineshaft."

It is never on a loading screen, never in marketing, never repeated. A second
tap just shows the margin note: "*C.* — kept where honest things go."

### Look (art brief summary; full brief in §7)

A hand-sized moth of warm lamplight: amber-gold body (Luminous gold), wings of
pale dawn-glass with faint map lines — contour hatching, a tiny compass rose —
inked on them. Violet only at the wing edges (Canon: violet = Godforge energy).
No face beyond two small bright points. Pixel sprite 12×10 art px (it's tiny on
the Keeper's shoulder), idle flutter 4 frames, fly 4 frames, "dim" 2 frames;
portrait I2 for dialogue. Never cute: no big eyes, no blush, no sparkles (Atlas).

---

## 5. Systems that make it addictive — ethically

### The rhythm

| Rhythm | System | Who gives it | What it's for | Rule |
|---|---|---|---|---|
| **Daily** | **Commissions**: 3 small asks a day from town keepers ("Edrin needs 6 bolts", "Ilyra wants a Luminous Prism", "Kesh: 20 swings of a sickle") | the Board Herald collects them; the asking keeper pays | a reason to visit every town; standing with factions | **Bank up to 3 days** (9 commissions). Missing a day loses nothing. |
| **Weekly** | **Bounties**: 3 named creature hunts with a twist ("a Cinder Bailiff carrying a debt stamp"; "a Mirror Substitute that answers to your name") | Siv Moss | combat goals, rare-drop chances, Bestiary pages | Bank 1 week. Bounty creatures are ordinary spawns with a mark, not new grind zones. |
| **Weekly** | **The Merchant's standing orders**: rotating Delve-material orders (today's Glowcap order, extended) | the Merchant | a Gold sink that teaches where things are | Pays income-seconds (today's rule) |
| **Weekly** | **The Eclipse alignment**: one realm's pressure peaks for a day; its hunt and Delve depth get a visible twist (more Foragers, a slag tide, mirror corridors) | the world | a shared world event the Hearth can talk about | Alignment is a bonus, never the only way to get anything |
| **Season** | **The Long Eclipse**: a story interlude, a seasonal depth, a seasonal collection, one returning cosmetic set | the season's realm pair | long-term goals, fresh content | Seasonal items **return** on a cycle; nothing power-related is exclusive |

### Discovery and collection

- **Glim's Atlas** (§4): places, nodes, inscriptions; dashed → solid.
- **The Codex** gains two tabs: **People** (each person you've met, what they've
  told you, a portrait; Bible "Quick Inspect" for characters) and **Witness**
  (the five Witness Runes and your recorded position per chapter).
- **Collection pages** pay *permanent, meaningful* rewards: an Atlas feature, a
  recipe, a Homestead fixture, a title. Each reward names the page that earned it
  (meaning rule: source + use + visibility).
- **Rare finds**: the Void rune (Game: "about once in two million strikes"),
  golden sparks, legendary Heartstone drops, inscriptions in beyond-layers.
  Odds are printed wherever a roll happens (owner rule 4).

### Reputation: standing with factions and people

The Bible's relationship model, adopted as written (the Bible's standing-model gate is taken as approved under the owner's 2026-10-14 trust; tune numbers with the sim):
- **Standing** per faction (Dawn Archive, Meridian Compact, Crucible Covenant,
  Veil Cartography, Root Accord — Bible proposals): bounded, reversible, earned
  through commissions, bounties and chapter choices.
- **Positions** per chapter: historical, permanent, never overwritten (Bible).
- **Character reactions** are derived from `choiceId` + standing, never stored
  separately (Bible).
- Standing tiers unlock **things to do, not power**: a keeper's extra line, a
  commission type, a Homestead visitor, a cosmetic for Gold, a recipe variant
  with the realm's look. No faction is locked out by another's gain (Bible).
- Save: one versioned record through the save gateway; standing clamped; never
  summed across devices (Bible contract; memory: "Game state goes through the
  gateway"). A divergent chapter choice on two devices asks the player which to
  keep (Bible recommendation (a)).

### Homestead growth: the people move in

The Homestead today is the idle economy as buildings. It gains **visitors**: when
a person's chain is done, they visit your plot, and with standing they **stay**
as a fixture with one small, honest job:
- Mara's oathsteel brace on your anvil (cosmetic; anvil tiers stay
  `HOME_FORGE_CONFIG`).
- Glim's map table (opens the Atlas from home).
- Tomas's lantern (the Hearth roster at home).
- Siv's trail post (expeditions return a few seconds faster to the camp
  *animation* only; no economy change without the sim).
- Kael never moves in. He visits once, after Act III, sits on your step, says
  nothing, and leaves his hammer on your anvil.

Any economy-touching effect goes through `economy-sim --check` first; the default
is cosmetic + convenience.

### Seasonal events

The **Eclipse alignment** (weekly) and **the Long Eclipse** (seasonal) above. One
seasonal cosmetic set per season, earned in play with Gold-priced options at the
Merchant; it returns in a later cycle. Every event has a reduced-motion version
and a phone layout from day one.

### Anti-patterns we will NOT use

1. **No real-money pressure.** Gold only, never money (owner rule 4). No path from
   donations to anything in-game. No "premium" anything.
2. **No punishing streaks.** Commissions and bounties bank; nothing resets because
   you took a day off. **Finding:** the old site's progression ledger still
   settles a *daily streak* (`app.component.ts`, `trackReturnVisit`). It must
   never gate or reset a reward; recommend reframing it as "days visited" (a
   count that only goes up) in the first commissions slice.
3. **No FOMO power.** Seasonal and event items are cosmetic or return later.
   Nothing that makes you stronger is ever time-exclusive.
4. **No deceptive odds.** Printed odds, no fake near-misses, RTP < 100% (owner
   rule 4); the Croupier says so in-world.
5. **No energy timers that stop play.** The dig is never blocked (shipped AAA
   call); rate limits pay less, they never lock the player out.
6. **No fabricated social proof.** The Hearth shows only real Keepers; the charts
   say which names are generated (Nox's line); no "X players just bought this".
7. **No nagging.** No push notifications by default; no "you're missing out"
   messages; Glim never guilt-trips ("we missed you" is banned copy).
8. **No dark-pattern confirms.** No confirm for reversible actions, always one
   for irreversible ones; the cancel button is never smaller (Vision §3).
9. **No pay-to-skip, no artificial walls** placed to sell a skip that doesn't exist.
10. **No infinite-scroll traps.** Sessions have natural ends; Glim names them.
11. **No loss for absence.** The Homestead accrues; nothing decays, dies or is
    stolen while you're away.

---

## 6. New lore

All new lore texts (story texts, NPC backstories, item and place flavour) are
appended to [lore-addendum.md](lore-addendum.md) under **"World and cast
(2026-10-14)"**, each with the canon passage it builds on. Summary of what's
there:

- Act texts: the Prologue card, the Act I break, the ch. 4 record, the Act III
  descent and the sixth mark.
- Backstories: Glim, Kael's eye and hand, the four in the walls, the Merchant's
  Grotto price list, Edrin's buyback, Nox's chart note, Tomas's lanterns.
- Items and places: the five Witness Runes as evidence, the Broken Astral
  Compass as Glim's needle, the Witness Prisms, the Court Lanterns, the Mirror
  Map, the Godforge threshold, the Unanimous.

---

## 7. Phased roadmap of this content

Sizes: **S** ≤ 2 days, **M** ≤ 1 week, **L** ≤ 2–3 weeks, **XL** more (one agent).
Every slice: lazy EN + ES i18n (never the eager table); phones first-class;
`npm run check:meaning` stays green (every new NPC/item/station has source, use,
lore, visibility); the full merge gate in `CLAUDE.md` §4.

### S1 — Glim, onboarding companion (first; **M**)

- **Scope:** Glim sprite (placeholder orb until art lands), shoulder idle, voices
  the existing goal line and "Show me" (fly-to + trail), the 3-step hint ladder
  for the four first-session goals and the Delve missions, the "good stopping
  point" line, Glim's Codex entry (no easter egg yet). Lantern = Glim (copy +
  visual only). `DIALOGUE` gets a `glim` NpcId with a pool (test-enforced like
  the others).
- **Depends on:** nothing new. Touches `first-goals.ts`, `npc.model.ts`, HUD.
- **Tests:** `e2e/play-first-session.spec.ts` must keep 64.5 s ±10% and all four
  goals; new `play-glim.spec.ts`: hint ladder opens one step at a time, never on
  secrets (assert no ladder on Codex Secrets ids), phone toast never in the
  centre 50%, Show me trail ends at the target; karma for the hint table.
- **Art briefs to add:** `npc-glim` (W3-style tiny sheet 12×10 art px: idle 4,
  fly 4, dim 2), `npc-glim` I2 portrait.

### S2 — Story Act I framing (**M**)

- **Scope:** the Prologue card and the Act I break scene (§2) as short in-world
  scenes on existing missions; a **Story journal** panel ("The Keeper's Record":
  current act, current beat, one next action — Bible "Continue Journey"); the
  Seam Eater set-piece polish (joins revealed by light). Narrative state: a new
  versioned `story` record through the save gateway (act + beat ids only; text
  stays static data — Bible contract).
- **Depends on:** S1 (Glim speaks the beats).
- **Tests:** a fresh save reaches the Act I break by claiming the shipped
  missions (fixture-driven); reload keeps the beat; two-device merge keeps the
  further beat (beats are monotonic, unlike choices); `check:meaning` for the new
  panel.
- **Art briefs:** Seam Eater set-piece joins (FX layer), Kael "anvil scene" talk
  pose, Archivist figure walking (they leave the Orrery).

### S3 — NPC depth pass (**S–M**)

- **Scope:** the ten Bible people on their
  stations (name tags, 4–6 lines each, EN + ES), the role keepers' new lines,
  Act-aware `DIALOGUE` rows (a new `storyBeat` condition alongside `minLevel`).
  Existing canon lines untouched.
- **Depends on:** S2 for beat conditions.
- **Tests:** `play-life.spec.ts` (keepers beside stalls, ES tags) extended; the
  harness assertion that a canon keeper only says `DIALOGUE` lines extended to
  the new people.
- **Art briefs:** retitle the existing NPC sprite briefs with the personal
  names; add Sera (Celestial Waystone), Ilyra, Tomas, Rook figures.

### S4 — Glim's Atlas + "The Blank Places" (**M–L**)

- **Scope:** Atlas panel (towns, hunts, Delve layers; dashed/solid; "?" rumour
  pins from townsfolk Found-in lines), steps 1–3 and 5 of Glim's questline.
- **Depends on:** S1; reads the persistent Delve dug-state and gathering data.
  Beyond-layers come later from `delve-and-beyond.md`.
- **Tests:** Atlas is derived from saved data (no second source of truth —
  `npc-quest.model` rule: objectives read ledgers); perf budget on phones (the
  Delve map render must not regress `PLAY_PERF` p50); a11y list view of the
  Atlas for screen readers.
- **Art briefs:** Atlas frame (pixel panel, RND-3 family), map glyph set
  (dashed/solid edges, "?" pin, inscription mark, you-are-here).

### S5 — Commissions + bounties (**M**)

- **Scope:** daily commissions with 3-day banking, weekly bounties with 1-week
  banking, on the existing Quest Board (Board Herald) and Siv. Reframe the daily
  streak as "days visited". Rewards on the economy curve.
- **Depends on:** S3 for the givers' names (works with role titles if not).
- **Tests:** banking property test (any absence pattern never loses a banked
  commission; never exceeds the cap); `economy-sim --check` with commission
  income added; no reward depends on consecutive days (grep test).
- **Art briefs:** bounty mark FX (a stamped seal over a creature), commission
  icons per realm.

### S6 — Act II ch. 1 + ch. 3 in the world (**L**)

- **Scope:** Luminous ch. 1 (Witness Prisms, Court Lanterns, Afterimage Moth
  creature, Pale Refrain encounter) staged in-world; move the shipped Infernal
  chapter (page flow + `godforge-chapter` record) into the Seamworks with the
  Seam Eater's second rising. Generalise the chapter ledger to the Bible's
  `OpeningArcStateV1` while keeping the existing Infernal record readable.
- **Depends on:** S2 (story record), S3 (Ilyra, Tomas, Mara, Edrin). Ch. 3 needs
  `delve-and-beyond` only if the slag tide uses its liquids.
- **Tests:** Bible's test scenarios table (fresh profile, each branch once, no
  duplicate reward on revisit, offline → reconnect, divergent choice → ask);
  existing Infernal record migrates without changing its `choiceId`.
- **Art briefs:** Afterimage Moth sprite, Pale Refrain boss sheet, Witness Prism
  and Court Lantern props, Seam Eater large form (boss class).

### S7 — Reputation (**M**)

- **Scope:** the five faction standings, tiers, derived reactions, Homestead
  visitors (cosmetic/convenience).
- **Depends on:** S5 (commissions feed standing), S6 (first positions). Standing
  numbers placed with the economy sim before they ship.
- **Tests:** standing clamp; never summed across devices; derived reactions
  match `choiceId` table; visitor fixtures have Found-in/Used-for.
- **Art briefs:** five faction crests (exist as guild crests? reuse if they fit),
  Homestead visitor props.

### S8 — Act II ch. 2, 4, 5 (**XL**, three agents in sequence)

- **Scope:** the remaining chapters per §2, each with its boss-scale threat and
  Witness Rune; Glim's compass (ch. 2); the "Two Maps" questline (ch. 4).
- **Depends on:** S6's chapter framework; `delve-and-beyond.md` for the witness
  depths.
- **Tests:** per-chapter Bible scenarios; boss readability checks on phones (one
  limb/phase visible at a time).
- **Art briefs:** Anchor Warden, Perihelion Engine, Ink Lantern, Mirror
  Parliament, Graftling, Graft Crown; Sera/Nox/Rook/Amina/Kesh/Siv figures if S3
  didn't cover them.

### S9 — Act III + the Long Eclipse (**XL**)

- **Scope:** the descent beats, the four niches, the threshold, the Unanimous,
  the sixth mark, Glim's easter egg; the first season.
- **Depends on:** S8 and `delve-and-beyond.md`'s beyond-layers.
- **Tests:** end-to-end story run on a fixture save; season rotation property
  test (every seasonal item returns within N seasons).
- **Art briefs:** the Unanimous (boss sheet + concept painting, Canon boss
  class), the threshold ring, four niche props, the sixth-mark inscription.

**First three slices to build:** S1 (Glim), S2 (Act I framing), S3 (NPC depth).
Names and story are approved to ship (owner, 2026-10-14); nothing in these three
waits on the owner.

---

## 8. Owner review

The owner approved writing with full creative confidence and reviews the story
in play (2026-10-14). Everything above ships as designed, including Glim and its
one hidden line naming Claude. Decisions taken under that trust, so the owner
knows what to look for while playing:

1. **The antagonist** is the Bible's Unbound Pattern, grown from what the first
   lock erased (Act III).
2. **The fracture**: five Keepers drew the line, four made the cut, Kael refused
   and lost his hand keeping it messy; the Godforge "let go" rather than be
   locked. This re-reads the shipped Kael, Aureth and Archivist capstones.
3. **Role-keeper names** are the Bible's ten chapter characters, placed at
   existing stations (§3).
4. **The Nameless** stays unexplained in game; the "Godforge's own tally" is the
   writers' private truth only.

No question blocks the first three slices.
