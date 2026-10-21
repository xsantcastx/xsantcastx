# Realms and the Harbourmasters — travel, the story spine, the endgame (design)

Owner, 2026-10-21: "the boats, we need to have an npc there, that shows us all the options to travel to, and in the
future like in the lore we should add like portals that take us to harder places, like 'REALMS' without boats, we unlock
these by questing or discovering the story, we need to beat story to get to the high level end game, we need to be
designing these as well for when we get there."

Marked **(new)** = a name or system invented here; lore is pre-approved (memory: lore-is-pre-approved). Every thing below
has a source, a use and a lore tie (memory: everything-needs-meaning). Read with vision.md, world-map.md,
design-bible.md §3, loot-and-combat.md §8–§10, online.md §3.3–§3.11, leveling.md (levels run 1 to 10,000).

**Naming (decision, owner 2026-10-21).** The endgame places are simply **Realms**, everywhere players see them: the
game is *Eclipse Realms* and the Realms are what the title promises. The six playable landmasses are always **continents**
or **lands** in player text, never "realms". Player text already barely says "realm" (only "Eclipse Realms" and the boot
line "Waking the realm…", which becomes **"Waking the world…"** so the word means one thing). Portals stay **Seam-gates**,
the hub stays the **Waystone Hall**; only the destinations are Realms. See "Naming in code" below for identifiers.

---

## 1. Harbourmasters (build-now spec — the first build)

**Built (Phase 1, branch harbour).** `play/td/td-harbour.ts` (piers, board builder, fares, the story-lock data hook, off by
default), `play/harbour/` (the Sailing Board body and the voyage), a Harbourmaster stood on each pier by `TdWorld`, the
anchor pin on the Map, Seek by "harbour" or the master's name. Fares are the formula's (Ember Harbour is 70, not the table's
20: `huntGold(1, 150)` is 65). Cinderport already had a task giver titled Harbourmaster (Tamsin Coyle): Marit Salt keeps the
board beside her.

### 1.1 What exists
Ships are `ContinentWay { ship: true, to, arrive, along? }` on a continent or village (`play/td/continent.ts`). Each is a
bare place entry reading "ship to X": no list, no price, no reasons. Today: Ember Harbour ↔ Pyrehold/Cinderport,
Pyrehold's pier (Verdant, Umbral), Mossharbor ↔ Pyrehold and ↔ Ember Harbour (the long way), Mirewatch → Pyrehold,
Cinderport → Ember Harbour.

### 1.2 The NPC (new: Harbourmaster)
One **Harbourmaster** (a keeper kind like the task givers) stands at the head of **every pier**. They replace the bare
ship place entries: walking onto the pier opens nothing; talking to the Harbourmaster opens the **Sailing Board**. The
boat itself becomes scenery plus the transition (1.5). Each has a name, a trade line and one line of lore:

| Pier | Harbourmaster (new) | Line |
|---|---|---|
| Ember Harbour | **Odd Tarn**, one-eyed ferryman | "Sea's warm for the season. It's been warm since the second tally. Mind the Burning Sea." |
| Cinderport | **Marit Salt**, tavern-keeper's sister | "The Salted Ember keeps the lamp lit till the last ketch is in. Nobody asks why." |
| Pyrehold | **Brannoc's quartermaster, Hale Dross** | "Three ships, three coasts. I only write down the ones that come back." |
| Mossharbor | **Netter Pell's niece, Sunny Pell** | "Uncle swears the Mirrorfin bite further south each year. He's usually right." |
| Mirewatch | **Old Corvane**, lamp-warden | "I light the pier by hand. The fog thins round a lantern. Round something else, too." |
| Gloamhaven jetty, Dawnspire, Meridian, Frostgate, Saltglass | named when each is drawn | each carries one Witness-flavoured line, never exposition |

### 1.3 The Sailing Board (UI)
One window, cozy wood-and-parchment (`_cozy.css` tokens only). A header ("Sailing from Pyrehold"), a scroll of **big
rows** (≥ 44 px tall and wide on phones, full-width, 8 px gaps; the list scrolls, the window never exceeds the viewport).
A row, left to right: continent crest (the palette star), **name**, **continent**, **level band** chip ("Lv 15–40"),
**fare** with a coin glyph, and a state chip. Tap a row to expand a one-line blurb and the **[Board ship]** button
(44 px); an Escape/✕ closes. Rows sort: unlocked by distance first, locked after, uncharted last.

| State | Look | Reason line (always shown, never a silent grey-out) |
|---|---|---|
| Unlocked | full colour, fare in gold | — |
| Can't afford | fare in red | "You have 640; the fare is 820." |
| Locked: level | padlock | "Recommended level 25. You may still sail, at your own risk." (soft: warn, don't block) |
| Locked: story | padlock + page glyph | "The Umbral captains won't sail until the Cinder Sovereign falls." (hard gate = act gate, 2.2) |
| Uncharted | dashed silhouette | "No chart yet. Someone in Pyrehold may know one." (Celestial/Luminous until built) |

A level warning is soft by design (Tibia lets you sail anywhere; the dread is the point). Only story gates hard-lock, and
only for the destinations that are an act's *entry*, not for returning home.

### 1.4 Destinations and fares (priced via `huntGold`)
Fare = `huntGold(entryLevel, 150)` — about ten steady kills at the destination's entry level, rounded to 10
(`economy-curve`). So fares track the economy and never become a wall, and sailing *home* (low entry level) is cheap.
`economy-sim --check` gets one row. Approximate values from the mean pile formula:

| Destination | Continent | Zone band | Entry level | Fare ≈ | Story gate |
|---|---|---|---|---|---|
| Ember Harbour | Ember Isle | 1–8 | 1 | 20 | none (home) |
| Cinderport / Pyrehold | Infernal Reach | 8–30 | 8 | 260 | Ember Warden felled (end of Prologue) |
| Mossharbor / Rootglass coast | Verdant Wilds | 15–40 | 15 | 470 | Cinder Sovereign felled (Act I) |
| Mirewatch / Gloamhaven | Umbral Marches | 25–50 | 25 | 820 | Elder Rootwyrm + Graft Crown (Act II) |
| Frostgate / Meridian | Celestial Peaks | 35–60 | 35 | 1,220 | Ink Abbess + Mirror Parliament (Act III) — uncharted until built |
| Dawnspire / Saltglass | Luminous Expanse | 45–70 | 45 | 1,670 | Perihelion Engine (Act IV) — uncharted until built |

A boat may sail to any *harbour already visited by foot or ship* in a continent you are cleared for (the board lists
that continent's other piers too, e.g. Mossharbor ↔ Ember Harbour "the long way", priced by the lower entry level and
labelled "long way, 2 min"). Sailing home to a lower level is never gated.

### 1.5 Flow: boarding, sailing, arrival, returning
1. **Board**: [Board ship] → fare debited through `EconomyService.spend` (reason `fare`), then a 1.2 s fade to the sea.
2. **Sail** (new, 4–6 s, skippable by tap): a pixel deck scene — the Keeper at the rail, gulls, Glim on the bowsprit, the
   destination's silhouette sliding in, the day/eclipse sky from `td-phases` so a night crossing is dark and an eclipse
   crossing is violet with a Wanewalker's lamp far off the bow. One line of sea-lore from a rotating table.
   `prefers-reduced-motion`: a single still card ("The crossing, a day's sail") with a 1 s fade. No combat at sea.
3. **Arrive**: fade in at the destination pier (the `arrive` station), the Harbourmaster there greets by name and shows the
   board for the way back. The first visit adds the continent to the **Atlas** and fires its first Lore Margin Note.
4. **Return**: every harbour has a Harbourmaster, so the way back is the same board; a free "ferry back to your
   hearth" is not offered (the Cold Hearth is the cheap way home).

### 1.6 Map pin
A new **place pin** (an anchor glyph in the continent's colour) on the world map and minimap at every pier, named for its
Harbourmaster ("Pyrehold Pier — Hale Dross"). Seek (`lum vesh "<name>"`) accepts a Harbourmaster's name or "harbour" and
points Glim at the nearest pier. A hover card on the pin lists the destinations and the cheapest fare.

### 1.7 Replaces
The bare `ContinentWay` ship entries stay as data (pier position, `to`/`arrive`), but the player-facing "ship to X" place
text is removed; the Harbourmaster reads all ships of its pier from the same ways and composes the board. No duplicated
route data. Existing maps are not redrawn: a Harbourmaster is stood on each pier by a keepers-table entry.

---

## 2. The story spine to endgame

Each continent is an act (design-bible §3.3). Acts gate the *sea* (1.4) and later the *Realms* (3.2). The quest chain is
D2-shaped: a **gate quest** in the act town sends the Keeper down the deepest dungeon, the **act boss** drops the **Seal**
(new) of that act, and the Harbourmaster / the next act's Warden recognises it.

| Act | Land | Levels | Act boss (closes it) | Gate chain (new quest names) | Seal earned |
|---|---|---|---|---|---|
| Prologue | Ember Isle | 1–8 | **The Ember Warden** (Ember Mine −3) | *The Beacon Goes Down*: light the Ninefold Stones; the Hushed Barrow's first grave; the Warden | Seamworks Tally (1st mark) |
| I | Infernal Reach | 8–30 | **The Cinder Sovereign** (Molten Deep −6) | *What Drinks the Heat*: Forgewife Ysolde, frost-glass in the Glass Halls, cold anvils in the Foundry; the Anvil-Warden; the Sovereign | Cinder Seal (Ash's chapter) |
| II | Verdant Wilds | 15–40 | **The Graft Crown** (Rootcradle −6, below the Elder Rootwyrm) | *The Wood Wears a Lantern*: Canopy Warden Ilsa, the Colossus, the Rootwyrm, the copy-tree | Thorn Seal |
| III | Umbral Marches | 25–50 | **The Mirror Parliament** (Ink Deeps, below Drowned Crypts −6) | *Who Carries the Second Lantern*: the Ink Abbess; the Lamplighter Below; Veil's twist | Veil Seal |
| IV | Celestial Peaks | 35–60 | **The Perihelion Engine** (Orrery Vault) | *The Charts Are Right*: Meridian's stars, the Frostfang Matriarch, the Orrery | Drift Seal |
| V | Luminous Expanse | 45–70 | **The Pale Refrain** (Sunken Palace −6) | *Noon Without End*: shadows that point wrong, Mirror Labyrinth's Echo, the Palace | Glint Seal |
| Finale | Godforge threshold (Seamworks, changed) | 70+ | **The Unbound Pattern** | *The Sixth Mark*: bring the five Seals to Kael; carve the tally or leave it blank | the Unbound Seal; **opens the Realms** and Hell-tier |

Notes:
- Acts I–III and the Prologue are built; IV–V and the finale are the unbuilt content the Realms wait on. Order IV/V
  follows level order (design-bible §3.3).
- **Witness journal**: each Seal's act also yields a Witness chapter (Ash, Thorn, Veil, Drift, Glint); the five Seals are
  the five signatures the Keepers put on the lock. Kael, who refused, has none (his "Broken Flame" ending line).
- The sixth tally mark (design-bible §3.4) is carved in each act-boss room, one more per act; at the finale it is the
  player's choice. The choice sets a **Seam Stance (new)**: *Carved* (embrace the Realms' offence) or *Blank* (defence).
  Cosmetic and a small rune-bonus flavour, never a power gate.
- Difficulty: the finale boss opens **Nightmare** with the Seam Eater as today (loot-and-combat §8); the Realms are the
  next ring and deliberately stack with, not replace, tiers (3.7).

---

## 3. Realms: the endgame

### 3.1 Premise (lore tie)
The eclipse is the seam breathing (bible §3.1). Five Keepers drew a line; four signed; the erased witnesses grew into the
Unbound Pattern. Where the Pattern is beaten, the seam is not sewn shut — it is *opened on purpose*. **Seam-gates (new)**
are standing stones (the Ninefold Stones, Ring of Pyres, Ring of Thorns, Lantern Ring) and **rifts (new)** in the cellars
of the five capitals that, after the Unbound Seal, lean on one specific erased thing. A Realm is a pocket of the world
the Keepers erased: a place *unrecorded*, not evil (bible §3.1 point 3). No boats; you step in.

### 3.2 How a Realm opens (unlock)
A Realm needs three things, checked per character (not per account):
1. **The Seal** that matches it (the act's Seal, 2.1) — a story beat finished, never a level number.
2. **A Gate Fragment (new)**: a hand-placed Margin Note set (three notes in one hand, bible §3.4) found in that act's
   world — the discovery half. Quests tell you *where*; the notes tell you *what leans there*.
3. **The Unbound Seal** for the second half of the list (Realms 6–8), so "beat the story" is literally required.
Opening is a one-time **Opening rite**: stand at the matching Seam-gate in an eclipse (or hold the Lamp Seal in hand any
time, once you own the Unbound Seal), say the Cant word for the Realm (*bible §4.0* in Glim's voice), and the stone
"remembers". After that the gate works on any night, no eclipse needed (mercy: unlocking is the hard part, using is cozy).

### 3.3 Entering, the portal network, parties
- **Realm Waystone network (new)**: each opened Realm gets a portal glyph in every capital's *Waystone Hall* (new; a
  small room under the Harbourmaster's pier tower or the capital shrine) and at its home gate. Select a glyph → pick a
  **Realm tier** (3.5) → step through. The Waystone Hall also lists every **discovered** Realm even if locked, with the
  Seal missing named (parallel to the Sailing Board's reason lines).
- **Party**: the leader picks the Realm and tier; a party of 2–4 gets a single **portal ticket** (new id
  `realm:{id}:{tier}:{runSeed}`); each member must have *their own* Realm opened and tier unlocked (so nobody is carried
  past the story). Members join within the portal's 90 s mouth; the Realm is **instanced** per party, host-authority
  (online.md §3.3 step 2): the leader's client hosts the floor sim, members send intents, loot is **personal** (rolls
  seeded `bossKillId + playerId`). Party scaling: boss HP × (1 + 0.75 × (n − 1)), damage × (1 + 0.1 × (n − 1)).
- Leaving: a Realm run ends at its boss, or the "Take me out" glyph; the exit places you at
  the gate you entered. A fall inside a Realm uses the Tibia-style death (3.9), not the Cold Hearth.

### 3.4 The eight Realms (all new)
Bands are the *entry* monster level on Tier 1; each Realm spans a range up the tier ladder. They cover Keeper levels 50 →
10,000 (leveling.md): the early Realms are story-adjacent, the late ones are the long game. A Realm is 3 floors plus a
boss floor (with an inline **Margin Note** per floor and a safe-room Hearthstone), a shape the engine already ships.

| # | Realm (new) | Theme | Lore tie | Levels (T1 → T10) | Signature mechanic | Boss |
|---|---|---|---|---|---|---|
| 1 | **The Cold Anvil** | a forge that was never lit | the cold anvils in the Glass Foundry; the Cinder Sovereign was banking heat to keep the seam shut | 50 → 90 | **Banked Heat**: floors start cold (−speed, monsters tough); lighting braziers and slotting coals warms the room and *buffs the party*. Heat is a shared resource | **The Unlit Smith** |
| 2 | **The Wrong Wood** | the Verdant, copied wrong | the Graft Crown; the tree that wears a lantern | 60 → 110 | **Copies**: each room has one real tree and several graft-copies; attack the real one, the copies spawn Rootgnaws. Glim dims beside a copy | **The Graft-Mother** |
| 3 | **The Drowned Lamp** | an endless flooded abbey | the Lamplighter Below; lanterns tended for whoever comes next | 75 → 140 | **Light is health**: a carried flame is your timer; sconces refill it; ink floods bring dark. The Lamplighter Below sells a lamp-upgrade once per run | **The Second Lantern** |
| 4 | **The Stilled Orrery** | a clockwork sky stopped between phases | the Perihelion Engine; Sera's ledger; Odette's smoke | 90 → 180 | **Phase lock**: each room is stuck in one eclipse phase (night/eclipse/dawn) with that phase's spell modifiers; ring a gong to step to the next | **The Eighth Hour** |
| 5 | **The Noon That Never Ends** | no shadows, mirror glare | the Pale Refrain; shadows that point wrong | 110 → 250 | **No shadows, no cover**: the Hush (bible §5.4) inverted — the *brightest* tile is the danger; tells are shown as shadows on the floor that point at the *attacker*. Shade pickups give brief safe cover | **The Verse-Without-End** |
| 6 | **The Hush Beneath** | the far side of the Hush | the Wanewalkers; the Seam Eater's hunger; Sexton Wren's unburied | 150 → 400 | **Half-world**: every Keeper partly phases; the party can *swap places* with a ghost-twin to dodge, the twin takes the blow. Requires the Wanewalkers lore page | **The Unremembered** |
| 7 | **The Tally Hall** | the five Keepers' last descent, written in marks | the sixth tally; the five Keepers; Kael who refused | 250 → 1,500 | **Echo fights**: each floor is a hand (Ash, Thorn, Veil, Drift, Glint) with a copied kit of that Witness; the boss floor is all five on a clock | **The Five Hands** |
| 8 | **The Unwritten Margin** | where Glim draws what the dark remembers | Glim's dashed blanks; the Atlas's night page; the Unbound Pattern | 400 → 10,000 | **Endless depth**: no fixed floors; every cleared room extends the Margin by one with +1 level and a new affix. The ladder the long game climbs | **The Erased Witness** (the Unbound Pattern, un-erased) |

Each Realm's boss names its mechanic: one tell-heavy fight with a phase at half life (the engine already does "calls two
X at half its life"). Realm 8 has a boss every 25 rooms and an endless milestone ladder instead of a single one.

### 3.5 Realm tiers and affixes (map-like, cozy-dark)
- **Tiers T1–T10** per Realm (new): each tier steps the Realm's level by one tenth of its range, multiplies Keeper-facing
  drops, and unlocks only after the tier below is cleared *once*. T1 is always gentle for the Realm's band; only T7+ is
  "dying a lot" territory.
- **Affixes (new)**, 0 at T1, 1 at T3, 2 at T5, 3 at T8; two cap at T10. Simple, shown as pips on the portal ticket and
  the loading card ("This run: Cold, Whispering"). Reuse the elite affix names where possible (design-bible §5.7).

| Affix | Effect | Tradeoff / bonus |
|---|---|---|
| **Cold** | −10% move speed, +15% monster life | +15% Realm Shards |
| **Lightless** | light radius −2; Glim dims | +20% rare+ chance |
| **Whispering** | 1 in 6 monsters drops a Margin Note shard; names flicker | +1 Hush on hit |
| **Mirrored** | one copy of each pack that dies in one hit | copies drop nothing |
| **Ember-hearted** | monsters burst on death (fire r2) | +10% Gold Find |
| **Grave-called** | packs raise 2 Bone Walkers at half life | +bone-crown mat |
| **Eclipse-touched** | all monsters Eclipse-touched | one ladder step on drops |
| **Brutal** | every 3rd hit is a heavy 0.6 s telegraphed blow | +10% XP |
| **Thin** | 20% fewer monsters, each tougher | cozy relief; −10% Shards |
| **Seamed** | a rift opens in a room: a free elite spawns on the loot | +1 unique roll |

Rule of thumb: every affix *teaches a counter* and pays something; none are pure punishment (cozy-dark).

### 3.6 Endgame loot and uniques per Realm
Drops ride `drop-tables`: the tier's item-chance and ladder shift (loot-and-combat §8–§9), plus Realm-only currencies and
uniques. All new.

- **Realm Shards (new)**: a stackable per Realm (Cold Anvil Shard…); drop from any monster, more from the boss; spent at
  the Waystone Hall's **Seamsmith (new NPC, voiced by Kael)** to re-roll one affix on an item, to socket a Realm rune, or
  to buy that Realm's set piece. *Use*: a reason to run a Realm that isn't the boss's trophy. *Source*: kills.
- **Per-Realm uniques (new, 2 per Realm, singular rarity, passive `sig` per the existing relic scheme)**:
  1 Cold Anvil: *Banked Gauntlets* (`regen` while a brazier is lit nearby) and *The Unlit Hammer* (heavy hit + `echo`).
  2 Wrong Wood: *Graft-Crown Circlet* (`named` + thorns) and *Copy-Bark Mantle* (`mercy`).
  3 Drowned Lamp: *Second Lantern* (a light-radius staff, `manaKill`) and *Lamplighter's Wick* (`regen`).
  4 Stilled Orrery: *The Eighth-Hour Dial* (`xp` + phase-immune) and *Gong-Chain* (`mf`).
  5 Noon: *Shadow-Pin* (`echo`, tells shown) and *Verse Shawl* (`gold`).
  6 Hush Beneath: *Thin-Hands* gloves (ghost-twin swap cooldown −) and *Unburied Locket* (`mercy`).
  7 Tally Hall: a **set of five** (*The Five Hands*, one piece per Witness), 2/3/5 bonuses, drops only on that floor's hand.
  8 Unwritten Margin: **Margin Fragments** that craft *Erasure* weapons; a per-100-room milestone chest.
- **Realm runes (new)**: socket words one tier above the Rune cap, only from Shards. They finish the "endgame rune"
  ladder the Singular rune cap stops at.
- Source/use/lore rule: each unique's card says "Found in: <Realm> tier N+, as a named singular", per the existing
  card-line convention.

### 3.7 How difficulty tiers interact
Normal → Nightmare → Hell is *the world's* tier (loot-and-combat §8) and stacks with *the Realm's* tier:
- **Gating**: the Realm gate needs the story Seal (2) **and** Hell-tier only for T8–T10 (Nightmare for T4–T7; Normal opens
  T1–T3), so a casual story-only player still gets to see every Realm's first tiers.
- **Stacking**: monster life/blow/resist use the world tier's multipliers, then the Realm tier's level step and affixes on
  top. To keep the combat sim's bands (`combat-sim --check`), the Realm tier *replaces*, not multiplies, the level offset
  of Nightmare/Hell inside a Realm (level is set by the Realm; multipliers are the world tier's). Item chance multiplies.
- **A wall, not impossible** (the same promise as the Seam Eater): resist gear is the answer; the first clear of any
  tier is fair at the matching level, with `economy-sim`/`combat-sim` rows added per Realm tier as the check.

### 3.8 Online: party Realms and leaderboards
- **Party Realms** are the main co-op surface (online.md Phase 5): instanced, host-authority (leader hosts), personal loot,
  scaling per 3.3, max 4. Solo is fully supported; party never required, party is richer (Realm 6 swap mechanic,
  Realm 7 echo fights are tuned 1–4).
- **Leaderboards (online.md §3.11)**, one doc per board, rebuilt by the scheduled Function from `users/*/progress/state`:
  *Deepest Margin* (Realm 8 room count), *Fastest clear per Realm tier* (top 100), *Tally Hall five-hand clear time*.
  Opt-out by the privacy setting, signed-in only, flagged-by-/admin strikes for impossible times.
- **Eclipse sync**: a shared **Realm-leaning eclipse** (new) briefly doubles Realm Shard drops in the one Realm the eclipse
  leans on — turns the five-day eclipse into a reason to log in, not a chore.

### 3.9 Death: Tibia-style in Realms and on Nightmare/Hell

**Scope.** The normal world (Normal difficulty, continents, dungeons) keeps the soft Cold Hearth death of design-bible
§5.8 (Ember debt, fallen purse, no level or item loss). **Inside any Realm, and on Nightmare and Hell anywhere,** a fall is
Tibia-faithful but fair. *Option for the owner:* extend this death world-wide later by lifting the scope line; every number
below is already per-tier so it needs no redesign (see 4.5). Under level 20 nothing is ever lost.

| On a fall | Rule |
|---|---|
| **XP** | lose **9%** of the XP of the *current level* (8% on Nightmare, 10% in Realms and Hell), not of lifetime XP, so it never crushes a 5,000-level Keeper. It can drop you a level; the death screen says so plainly ("Level 412 → 411"). It replaces the Ember debt in these scopes (no double penalty). |
| **Items** | **10%** chance to lose **one random equipped piece** (never a slot-empty roll that takes nothing). The lost piece goes into the corpse bag, not into the void. |
| **Corpse bag** | the carried satchel (non-protected items) and **all carried Gold** drop as a bag where you fell, with the equipped loss if any. Retrieve within **15 min** (the Realm run's clock pauses nothing); a second fall before then leaves the old bag to expire, it is not stacked. Leaving the Realm does not end the timer; the bag stays at the spot, so re-entering the same instance at the same tier is the recovery run. If the instance has closed, the bag is mailed to the Cold Hearth's Lost Property chest for the **remaining** time, so a crash or a closed party never costs more than the timer. |
| **Blessings** | the five Hearth Blessings each cut **XP loss by 20% of the base** and **item-loss chance by 20% of the base** (all five: XP loss 0, item chance 0, bag still drops: Tibia's "blessed"). They are consumed on a fall that costs anything, as today. Price stays `huntGold(level, 60)` each; a Realm run asks for the sums on the Waystone Hall board ("5 of 5 blessings: yes/no"). |
| **Amulet of Loss** | **Amulet of Loss (new, Seamsmith, Gold + 1 Shard)**: worn, it makes item loss **0** (the bag still drops unless blessed: only the worn pieces are saved, as Tibia). Consumed on any fall. It does not touch XP loss. |
| **Wake** | at the Realm's safe-room Hearthstone if lit, else the gate; life and mana full; the *Chilled* welcome applies. |

**Never lost (decision).** Soulbound items, quest and story items (Seals, Lamp Seal, Margin Notes, Gate Fragments), and
the character's own Hearth, Atlas and lore progress are never in the bag or the loss roll: losing a story item would
soft-lock the spine (2), which a cozy-dark game must not do. **Boss uniques are NOT protected**: protecting them would
make the rarest item the safest, and the retrievable bag already makes the loss recoverable; the risk is the point. The
gold figure and Realm Shards in the satchel are lost to the bag like any stack; **equipped Realm runes and sockets** come
off with the piece they sit in, recoverably.

**Party.** Others can **loot your bag for you** (Tibia corpse looting): any party member standing at the bag can press
*Recover* to take the whole bag and carry it; it is then theirs to hand back via a 1-tap trade (no theft: the bag is
tagged to the owner, and any member's pickup is logged to the party chat "Sera carries Kael's bag"). A non-member who
walks into a bag does nothing. Bags are never visible to or lootable by other parties.

**UI: the death screen.** One cozy window, big text, one line per cost, nothing hidden:
"You fell to <Name>. **Lost:** 9% of this level's XP (-1,240, level 412 -> 411). **Lost:** your Cinder Ring (worn). **Dropped:**
a bag with 3,200 Gold and 14 items at <place>, 14:32 left. **Saved by:** Pyre Ember, Rootglass Sap (-40% XP, -40% item
chance); Amulet of Loss (item loss prevented, now consumed)." Buttons (44 px): **[Wake at the hearth]**,
**[Find my bag]** (opens the minimap pin: a bag glyph with a ticking ring). A "what saved me" column is shown even when
empty, so the player learns what blessings do.

**Ties.** The hearth wake and the Ember debt are `shared/hearth/` today and remain the normal-world rules; this extends the
same rules module with a `mode: 'soft' | 'tibia'` selected by scope. The bag is a bigger sibling of `LootService.fall`
(the fallen purse), reusing its pin, walk-over pickup and "fall again first and it is lost" rule; the bag adds items and
the party-recover verb. Blessings reuse `economy-sim --hearth` pricing and gain a Tibia-mode row. Gold safety: because the
bag holds **all** carried Gold, the Seamsmith and Hearth Shrine are the only sinks that touch it, never auto-spent.

---

## 4. Implementation plan

### 4.1 Data model sketch (types only; no code yet)
```ts
// src/app/play/realms/realm.types.ts (new module, see "Naming in code")
export interface RealmDef {
  id: string;                         // 'cold-anvil'
  name: string;                       // i18n key
  seal: SealId;                       // the act Seal required (2)
  requiresUnbound: boolean;           // Realms 6–8
  levelBand: [number, number];        // T1 entry → T10
  gate: { hall: string; stone: string }; // Waystone Hall + home standing stones
  floors: string[];                   // td map ids (hand-drawn), incl. boss floor
  mechanic: MechanicId;               // 'banked-heat' | 'copies' | …
  boss: string;                       // td-mobs boss id
  shardId: string; uniques: string[]; set?: string;
}
export interface RealmTier { realm: string; tier: number; affixes: string[]; level: number }
export interface RealmProgress { opened: string[]; cleared: Record<string, number>; shards: Record<string, number>; stance?: 'carved'|'blank' }
export interface HarbourDef { pier: string; npc: string; ways: ContinentWay[] } // derived from continents
```
`RealmProgress` is one more blob in the game-state gateway (memory: game-state-goes-through-the-gateway; **godforge state
lives in many blobs** — add it to the registry list, with a merge-safe verb: opened/cleared only grow). Unlock flags per
character; Seals are existing quest-completion ids, so a Realm reads `quests.completed` rather than a second flag.

### 4.1b Naming in code
- **Never rename save keys or persisted fields.** Older code uses `realm` to mean a *continent* (`town.realm === 'luminous'`,
  save key `godforge-realm-era`, the Hearth Blessings "one per realm"). Those stay exactly as they are.
- **New continent code says `continent`.** New fields, params and types for a landmass use `continent`, never `realm`.
- **The endgame lives in its own module, `src/app/play/realms/`**, with types `RealmDef`, `RealmProgress`, `RealmTier`
  (and `HarbourDef` stays with the continent code). Inside that module `Realm` means only the endgame place.
- Legacy `realm` identifiers that mean a continent get a one-line doc comment ("`realm` here is a continent") when
  touched; they are renamed only when cheap and safe (no persisted data, no public API), never as a drive-by.

### 4.2 What it reuses
| Need | Reuse |
|---|---|
| Piers, ships | `continent.ts` `ContinentWay`/`VillageWay`; the Harbourmaster reads them |
| Fares | `economy-curve huntGold`; `EconomyService.spend` |
| Gold-bounded checks | `economy-sim --check` row |
| Zone levels / hunting grounds | the design-bible §9.1 table / `td-mobs.ts` levels |
| Hearths, death | `td-hearth.ts`, the Cold Hearth, a Hearthstone per Realm safe room; `LootService.fall` for the corpse bag; Blessings for the Tibia-mode cuts (3.9) |
| Find a Harbourmaster / gate | `td-seek.ts` (`lum vesh`) |
| Eclipse phases, "leaning realm" | `td-phases.ts` (add the lean + the Phase-lock mechanic) |
| Seam gates, rifts | `td-seam.ts` standing-stone rifts |
| Party instancing | online.md host-authority; the shared monsters host |
| Boss tells, summons | `td-mobs` boss profile, CALL_TELL, BOSS_TELL |
| Affixes | `td-elites.ts` pack affixes + new Realm ones |
| Drops | `drop-tables.ts`, `relicTotals`, the card "Found in" line |
| Lore pages | `shared/lore/lore.ts` (add one page per Seal / Realm) |

### 4.3 Phases (S/M/L; first build marked)
| # | Phase | What | Size |
|---|---|---|---|
| **1 — build first** | **Harbourmasters + Sailing Board** | NPC per pier, one window, rows with states and reasons, huntGold fares, sail transition, arrival, map pin, Seek target, `economy-sim` row, i18n EN+ES, e2e for desktop and phone width | **M** |
| 2 | **Act gating** | Seal ids; story gate rows on the board; the missing quest chains (Act IV/V as the continents get built) | M (then per-act L) |
| 3 | **Realm data + one vertical slice** | `RealmDef`, Waystone Hall, portal glyph, **Realm 1 (Cold Anvil)** as 3 floors + boss, tier ladder T1–T3, Shards, one affix, Tibia-style death + corpse bag (3.9) | L |
| 4 | **Realms 2–5** | one per act, each reusing the slice; mechanic per Realm | L total (S–M each) |
| 5 | **Party Realms** | portal ticket, host-authority instance, scaling, personal loot | L (rides online Phase 5) |
| 6 | **Realms 6–8 + Unbound unlock** | the finale quest, Seam Stance, the Hush/Tally/Margin Realms | L |
| 7 | **Leaderboards** | Realm boards; rides online Phase 7 | S–M |

### 4.4 What to build first
**Phase 1, the Harbourmaster.** It needs no new world art, fixes the current "ship to X" rough edge today, gives every
later gate (acts, then Realms) a place to explain "locked, and here is why", and the Sailing Board component is reused as
the Waystone Hall list in Phase 3. After that, Phase 3's Cold Anvil is the first Realm: its lore is already half-built
(Foundry cold anvils, Cinder Sovereign banking heat), so it needs the least new story.

### 4.5 Resolved and open questions
**Resolved (owner, 2026-10-21):**
1. *Label:* the endgame places are plain **Realms**; the old compound label is gone and continents are never "realms" in player text.
2. *Death in a Realm:* **Tibia-style** (3.9), not free; the normal world keeps the soft hearth death.

**Open:**
1. Should the Tibia-style death extend world-wide (all difficulties), as 3.9 offers? Default: no, Realms and Nightmare/Hell only.
2. Level range for Realm 8 up to 10,000: confirm Realm tier steps (L/10 per tier) against the 1-10,000 leveling curve.
3. Numbers to playtest in `economy-sim`: XP loss 8-10%, item chance 10%, bag timer 15 min; and whether boss uniques should
   be protected (drafted: not).
