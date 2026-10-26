# Eclipse Realms — the canon bible

Kept by the Dungeon Master (`~/.claude/agents/dungeon-master.md`). Started 2026-10-22, bootstrap session, branch
`dm-bootstrap`. **One truth per name, date, place and rule.** When code or another doc disagrees with this file, the
disagreement goes into §10 *Open contradictions* with a proposed fix. Nobody silently picks a side, including the DM.

**Precedence when sources disagree.** The order is:
1. `docs/design/vision.md`, the north star.
2. This file.
3. The top-down design docs: `world-map.md`, `realms-endgame.md`, `design-bible.md`, `loot-and-combat.md`,
   `skill-trees.md` and `leveling.md`.
4. Shipped code: the `*.i18n.ts` tables, `play/td/maps/*`, `td-zones.ts`, `td-mobs.ts`, `boss-uniques.ts` and
   `set-items.ts`.
5. `docs/world/world-and-cast.md`, `delve-and-beyond.md` and the side-view half of `lore-addendum.md`. These are the
   **legacy layer**: written for the retired side view, and canon only where this file adopts them (§1.4).
6. `docs/design/one-world.md`, superseded by the top-down pivot. Only its Waystone lore (one-world.md:428-432) survives.

**Planned canon.** The quest chains on branch `quests2` (cd061c1e) are not merged yet. They are canon here, and are
marked **[Q2]**: *The Hollow Choir* and *The Smith Who Forgot His Own Hammer*.

**Owner-locked names (renaming any of these needs the owner).**
- *Realms* means the endgame places only.
- *Lands* or *continents* means the six playable landmasses.
- The four callings: Warlock, Ashguard, Lanternwright, Thornstrider.
- Keeper, Glim, the Seam-gates, the Waystone Hall, Gold.

**Tone.** Dark outside, warm inside. The design rules (design-bible.md:55-60) are:
- Suggest, never show all of it.
- No jump-scares and no gore; bones are bleached and tidy.
- The world explains itself in fragments.
- Every dread has an exit.
- Never punish curiosity.
- Warmth is mechanical.

Zones, dungeons and caves feel like a dark tabletop dungeon (owner, 2026-10-22). Towns and hearths are safe light in
a dark world.

---

## 1. Timeline

**Dating rule.** The world clock counts "Year N of the Held Seam" from 2026-01-01, at one in-game year per 28 real
hours (`shared/world-clock/world-clock.model.ts:27-35`). The number on the Slate climbs about one year a day, so
**no line may tie an event to a fixed year count**. The two clocks are:
- Events *before* the Held Seam are "before the years were counted". Give no number.
- Events *after* it may say "a hundred years", "forty years" and so on. Keep these well under the current year count,
  which is about 250 in late October 2026.

### 1.1 Before the count
1. **The Godforge.** The engine under the world turns will, matter, memory and possibility into real things
   (delve-and-beyond.md:44-45). The five lands formed round its radiance.
   - The five lands are the **Infernal Reach, Verdant Wilds, Umbral Marches, Celestial Peaks and Luminous Expanse**.
   - The starter island, **Ember Isle**, is the Infernal's broken-off doorstep.
   - Each land is one answer to the same pressure: *temper it* (Infernal), *adapt to it* (Verdant), *remember it*
     (Umbral), *measure it* (Celestial), *conceal it in plain light* (Luminous) (after world-and-cast.md:67-68).
2. **The Seam-Cant** is spoken before anyone writes it down.
   - It is the old tongue of making: roots say *what*, shapes say *how* (§6.1).
   - The moss-priests sang it, the Seamworks scribes later cut it into basalt, and the first Keepers wrote their lock
     in it.
   - Canon decision: the Cant is **older than the Seamworks**, and the scribes inherited it. This fixes the [Q2]
     Choir's 300-year hymn.
3. **The Merchant is already down there.** The Merchant's price list is older than the Seamworks' oldest ledger
   (world-and-cast.md:562-565).
4. **The First Eclipse.** The moon mirror crossed the sun for the first time, and the seam under the world *breathed*:
   - noon went black;
   - the dead stirred;
   - maps redrew themselves.

   The **moss-priests of the Overgrown Temple** walked into it singing the Cant, to sew it shut from the inside. They
   came back thin and voiceless; their voices had been poured into the temple's four bells. This is the **Hollow
   Choir** [Q2].
5. **Eclipses keep coming**, every fifth day. Each one leans on a different land.

   The **Drowned Abbey** of the Umbral Marches starts to sink. The **Ashen Bastion** of the Reach holds the road
   against the Cinder clans.

### 1.2 The Lock: Year 1 of the Held Seam
6. **Five Keepers draw a line.** At the Basalt Seamworks five Keepers tried to hold the seam shut with one answer: a
   line through the world, written in the Cant (world-and-cast.md:131-142).
   - **Four signed** it, with the runes that became the Witness marks: Ash, Thorn, Veil, Drift and Glint.
   - **Kael refused.** He saw a witness standing in the path of the line, put his hand into the crack to hold it open
     until the witness got out, and lost his left hand to it. This is canon; see §10 C-07.
   - The Godforge *let go* along their line instead of locking.
   - What the line erased grew, in the dark, into the **Unbound Pattern**: dissenting witnesses, unchosen answers.

   The morning after is **Year 1 of the Held Seam**.
7. **The Four go down to bank it** (lore-addendum.md:233-248). The lock held badly. The heat came up heavier, so the
   four signers went down under the Seamworks to bank the furnace, felled the pillars over it, and never climbed back
   up.
   - Kael stayed at the anvil, the fifth and only Keeper left.
   - Five tally marks are cut at Keeper height. Four are crossed through. The fifth, Kael's, is worn smooth.
   - Canon decision: the **lock** and the **banking** are two acts of one story, in that order (§10 C-01).

### 1.3 The counted years
8. **The Pyre Watch is sworn** in the Reach on a hammer "struck by five, kept by one" [Q2]. The Watch has admitted no
   one under 20 ever since.
9. **The Forge of the Four.** The Reach's smiths name their great works-forge for the four signers.
   - Its masters are always four, each holding one of four marks: a ring, a wedge, a tongs and a flame.
   - Its Bailiffs and Golems walk out into the Reach and are never told to stop.
   - Canon decision: "the Four" of the Forge is a **guild of four masters**, named for the four Keepers. It is not the
     Keepers themselves (§10 C-08).
10. **The Ashen Bastion falls.** Its garrison is buried in the cinder under its walls and never stops marching (the
    Ashen Crypt). Its last lord becomes the Ashbone Dragon.
11. **The Abbey drowns.** The water comes up through the floors of the Umbral abbey town.
    - The abbey's old guard marches down to hold the crypts.
    - The Abbess stays at her prayers and becomes the Ink Abbess.
    - Gloamhaven is built on stilts round the drowned square.
12. **The Ember Mine is worked, then left.** The miners go. The **Ember Warden** keeps the mine lit after them. Kael
    closes the mines and lets the water have the lower galleries (lore-addendum.md:208-212).
13. **A hundred years ago: Odric Hale.**
    - He was the Forge's *fifth* smith, unsigned, as Kael was the fifth Keeper. History rhymes, and the Reach does not
      notice.
    - He carried the Watch's oath-hammer into an eclipse to quench it in the seam, and came back thin.
    - The Archive struck his name. The Four scraped his crescent mark off their roll.
    - His unfinished first Anvil-Warden was walled up in the Fifth Smithy [Q2]. The cold anvil in Pyrehold's north
      forge has not been fired since.
14. **Forty years ago.** Aldous Wren becomes sexton of the Hushed Barrow on Ember Isle. He has counted forty graves
    twice every night since.
15. **"Since the second tally"** (Odd Tarn, `play/harbour/harbour.i18n.ts:19`). The Burning Sea has been warming
    since the second of the five tally marks was crossed. The sea is the Godforge's cooling bath, and it warms as the
    seam opens (design-bible.md:194).

### 1.4 Now: the Keeper arrives
16. **The Keeper lands at Ember Harbour.** Glim finds them. They are the **sixth tally mark**: a fresh mark, dated
    tomorrow, already waits in the deepest place (design-bible.md:152).
17. The **Prologue** (Ember Isle) runs through the five acts (the lands, in level order) to the **Finale** at the
    Godforge threshold under the Seamworks. After it the **Realms** open (§3.5; `realms-endgame.md` §2-§3).

**The legacy layer** (side-view Delve, "Five Witnesses", the five realm towns, the Underhearth, Starfall Deep, the
Void Shore, the Unmade) is **not the current story**. It is adopted only for:
- the cast, their voices and motives (§5);
- the cosmology (§2);
- the Four's banking;
- the tally marks;
- the five Witness names.

The legacy towns become districts of the unbuilt capitals (§3.4).

---

## 2. Cosmology

| Thing | Canon |
|---|---|
| **The Godforge** | The engine under the world. Not a god. It does not want; it makes. |
| **The Seam** | The line the five Keepers drew, where the world was stitched after the Godforge let go. It runs under every land and is thinnest under the Seamworks. |
| **The Eclipse** | Every fifth day the **moon mirror** crosses the sun for eight hours (8 real minutes; a world day is 24 real minutes). Noon goes black and Eclipse Glass is caught in the rock. Each eclipse **leans** on one land in turn: Infernal, Luminous, Umbral, Celestial, Verdant (lore-addendum.md:1615-1618). The truth, never stated before Act V: **the eclipse is the seam breathing.** |
| **The moon mirror** | A piece of the lock that broke under the first eclipse. The Archive keeps its largest shard. The **Mirror Slate** is a palm of it in Kael's brass, and every shard still faces the sky it broke under. |
| **The Unbound Pattern** | Grown from what the lock erased. It offers every frightened person one perfect answer and removes every other answer to keep it. It is the final enemy. Its legacy name "the Unanimous" (world-and-cast.md:349) is retired (§10 C-04). |
| **The erased witnesses / dark-born** | Things that exist only in the dark are not evil but *unrecorded*. Some are hostile because being forgotten hurts. **Dark-born never ambush** (`play/td/td-dark.ts:5-8`). |
| **The Hush** | The soft dread of being alone near the erased: a 0-100 meter. It never damages and never takes, and light, a hearth or a town quiets it. It is off below level 10 and on Ember Isle (`td-dark.ts:20-22`). Lore: the erased lean closer when you are alone. |
| **Wanewalkers** | Anyone who **walked into an eclipse instead of away from it** and came back *thin*: lamplight through them, steps without sound, voices or names left behind. Known so far: the Hollow Choir (moss-priests, the first eclipse) and Odric Hale (a smith, a hundred years ago) [Q2], plus "a handful of Keepers" (`shared/lore/lore.i18n.ts:11`). The Archive struck all their names. They are the locked fifth calling ("a thin one already waits by the fire"). |
| **The Seam Eater** | Something that lived in the seam and ate the thread. The Seamworks sank it in the slag under the mine. "That was not all of it." It rises in an eclipse at each land's standing stones, at fixed rift levels: the Ninefold Stones 20, the Ring of Pyres 30, the Ring of Thorns 40 and the Lantern Ring 55 (`td-zones.ts:136-138`). Felling it opens Nightmare, then Hell. |
| **Glim, the Margin-Light** | A lamplight moth, once an Afterimage Moth that ate a page of the Archivist's map. It keeps the map's blanks and dims beside false things. The Atlas has a night page because Glim draws what the dark *remembers*. "Claude" is a once-only easter egg and never canon text. |
| **Keepers** | Mortals attuned to runes who can carry Godforge fragments safely. Not a bloodline; an order that keeps restarting. There were five at the lock, and you are the sixth. Aureth, Verrin and the Archivist call a Keeper "Convergent". Everyone else says "Keeper". |
| **Gods** | **Aureth, the Radiant**: order, Luminous crystals, "The Sun did not break. The Sun let go." **Verrin, the Hollow**: endings, "I am not the opposite of Aureth. I am what happens after her." Both are legacy-layer and wait for the Luminous and Umbral acts. |
| **The Nameless** | Hidden behind combo 666. The writers' private truth is that it is the Godforge's own tally, never stated. In game it is "the one who split the world" (§10 C-05). |
| **The Burning Sea** | One sea joins all six lands. It is the Godforge's cooling bath, and it is warming. |
| **Realms** | Pockets of the world the Keepers' line erased: *unrecorded*, not evil. They open on purpose after the story's Seals (realms-endgame.md §3.1). |
| **The Calendar** | The week runs Forgeday, Lightday, Inkday, Starday, Rootday, Hearthday, Moonday. There are five months of 14 days: Emberwane, Brightmere, Inkfall, Starturn, Rootwake. Years are "Year N of the Held Seam". |

---

## 3. Lands, regions and places

Level bands are **fixed per zone** (D2-style; `play/td/td-zones.ts:33-125` is the one table). **Bold** names are
built.

### 3.1 The six lands

| Land (EN / ES as shipped) | Band | Act | Capital | Towns and villages | Dungeons |
|---|---|---|---|---|---|
| **Ember Isle** / Isla Brasa | **1–10** | Prologue | **Basalt Seamworks** | Ember Harbour (pier) | **Ember Mine** −1…−3, **Slagstone Cave**, **Hushed Barrow** vault, the Caldera (no way in yet) |
| **Infernal Reach** / Dominio Infernal | 8–30 | I | **Pyrehold** | **Cinderport**, **Ashgrove** | **Forge of the Four** −1…−3 (+ the Fifth Smithy [Q2]; −4 planned), **Ashen Crypt** −1…−2, **Molten Deep** −1…−6 |
| **Verdant Wilds** / Selvas Verdes | 15–40 | II | **Rootglass** | **Mossharbor**, **Thornwick** | **Root Hollows** −1…−3, **Overgrown Temple** −1…−5 (+ the Choir Loft [Q2]; the Rootcradle Below, −6, planned) |
| **Umbral Marches** / Marismas Umbrias | **26–50** | III | **Gloamhaven** | **Mirewatch**, **Lanternfen** | **Drowned Crypts** −1…−3 (−4…−6 and the Ink Deeps planned) |
| Celestial Peaks | 35–60 | IV | Meridian (floors +1…+4) | Frostgate, Starhollow | Frostfang Caverns −1…−5, the Orrery Vault |
| Luminous Expanse | 45–70 | V | Dawnspire | Prism Oasis, Saltglass | the Sunken Palace −1…−6, the Mirror Labyrinth |

The finale is at the **Godforge threshold**: a ring of five sockets under the changed Seamworks, at 70+.

### 3.2 Zones and bands (built)

**Ember Isle**
- Basalt Seamworks: safe.
- 1–2: Cinder Meadows, Ember Coast, Ashwater Lake.
- 2–4: the Emberwood.
- 3–5: Slagstone Hills.
- 4–6: the Deep Emberwood.
- 5–6: the Hushed Barrow plot.
- 7–10: the Ashfields.
- Ember Mine: −1 2–3, −2 4–6 (the Flooded Galleries), −3 7–8 (the Warden's Forge; Ember Warden 8).
- Slagstone Cave: 3–5.
- Hushed Barrow vault: 6–7 (the Uncounted 7).
- Places (`maps/ember-isle.ts:65-74`): the Sunken Chapel (ruins), the Hushed Barrow, Slagstone Cave, the Ember Shrine,
  the Caldera, the Ninefold Stones, Ember Harbour.
- Nightroads: Ashwater Lake, the Barrow's sea jetty, the steps below the Ember Shrine.

**Infernal Reach**
- Pyrehold: safe.
- 8–10: the Ashen Shore, Glasswater.
- 8–11: the Cinder Steppe.
- 10–13: the Charwood.
- 13–16: the Deep Charwood.
- 15–18: the Obsidian Badlands.
- 18–21: the Molten Fields.
- 19–22: the Pyre Peaks.
- Forge of the Four: −1 the Ash Gate 12–14, −2 the Four Smithies 14–16, −3 the First Anvil 16–18 (Anvil-Warden 18).
  The Fifth Smithy [Q2] is 16–17 (the Unfinished Warden 17).
- Ashen Crypt: −1 the Ossuary 14–17, −2 the Bone Hall 22–25 (Ashbone Dragon 25).
- Molten Deep, by floor:
  - −1 the Scorched Throat 12–14
  - −2 the Glass Halls 15–17
  - −3 the Tyrant's Caldera 18–20 (Magma Tyrant 20)
  - −4 the Slag Rivers 21–23
  - −5 the Glass Foundry 24–26
  - −6 the Heart of the Deep 27–30 (Cinder Sovereign 30)
- Places: the Ashen Bastion, the Ashen Crypt door, the Ring of Pyres, the Ember Altar, the Great Caldera, the Molten
  Deep, the Forge of the Four, Pyrehold Harbour.
- Interiors (safe): the Pyre Spire (Watch Hall, Study, Lookout), the Salted Ember and its cellar, the Woodward's Lodge
  and its loft.

**Verdant Wilds**
- Rootglass: safe.
- 15–17: the Fernglades, the Mossy Shore.
- 16–18: the Rootwater, the Glassmere.
- 17–20: the Greenwood.
- 21–25: the Deep Wilds.
- 24–28: the Sunken Courts.
- Root Hollows: −1 the Gnawed Galleries 19–21, −2 the Sporewell 21–23, −3 the Heartroot Cellar 23–25.
- Overgrown Temple, by floor:
  - −1 the Sunken Narthex 24–26
  - −2 the Hall of Roots 27–29
  - −3 the Heart Shrine 30–34 (Mossbound Colossus 34)
  - −4 the Drowned Vault 33–36
  - −5 the Rootcradle 36–40 (Elder Rootwyrm 40)
  - The Choir Loft [Q2] 28–29 (the Hollow Cantor 29)
- Places: the Overgrown Temple's stepped gate, the Moss Altar, the Drowned Aqueduct, the Ring of Thorns, the Root
  Hollows.
- Interiors (safe): the Rootglass Bole (Root Hall 0, Lower Boughs +1, Sap Galleries +2, the Crown +3), the
  Net-Mender's Loft, the Herbalist's Cottage and its root cellar.

**Umbral Marches**
- Gloamhaven: safe, fog .55.
- 26–28: the Gloaming Shore.
- 26–29: the Gloaming Fen.
- 29–32: the Black Meres.
- 32–36: the Deep Fen.
- 37–41: the Drowned Ruins.
- Drowned Crypts: −1 the Flooded Nave 41–43, −2 the Sunken Cloister 43–46, −3 the Abbess's Chapel 46–50 (Ink Abbess
  50).
- Places: the Drowned Crypts door, the Gloam Shrine, the Sunken Belfry, the Lantern Ring.
- Interiors (safe): the Lantern Tower (the Keeper's Hall, the Wick Loft, the Lantern Room with the Great Lantern).

### 3.3 Sea and harbours
The Harbourmasters (`play/td/td-harbour.ts:29-33`):
- Ember Harbour: **Odd Tarn**.
- Pyrehold: **Garrick Dross** (renamed from Hale Dross, C-20, decided 2026-10-22), three ships.
- Cinderport: **Marit Salt**.
- Mossharbor: **Sunny Pell**.
- Mirewatch: **Old Corvane**.

Fares are `huntGold(entryLevel, 150)`. Story locks:
- Reach: the Ember Warden must be felled.
- Verdant: the Cinder Sovereign.
- Umbral: the Elder Rootwyrm. Later the Graft Crown, once it is built.

Level warnings are soft; only story locks are hard.

### 3.4 Legacy towns, re-homed (canon decision)
The side-view realm towns survive as **districts of the unbuilt capitals**, so their keepers have a future address:
- **Heliograph Court** becomes the court district of **Dawnspire**: Aureth, the Merchant's Market, Ilyra Venn, Tomas
  Rill.
- **Meridian Orrery** becomes the observatory of **Meridian**: the Archivist's Codex, Sera Quill, Nox Aster.
- **Nocturne Archive** becomes the drowned abbey's library under **Gloamhaven**: Lune Coyne, Amina Thorne, Rook Sable,
  and Verrin's passage. This is where the Archive keeps its moon-mirror shard.
- **Rootglass Canopy** becomes **the Crown** of the Rootglass Bole and its lodges: Kesh Arbo, Siv Moss, Pim Larkin,
  Corran Holt, Hesta Cairn.

The Delve strata are retired: Root Hollows (Delve), Basalt Caverns, Glowcap Grotto, Magma Halls, the Underhearth,
Starfall Deep, the Void Shore and the Unmade. Their **ideas** move into the Realms (realms-endgame.md §3.4). The name
**Root Hollows** now means only the Verdant dungeon.

### 3.4b The acts as long lands (planned, 2026-10-26, `docs/design/world-acts.md` §1)
Each land becomes a D2-style act: a chain of long surface **sections** (one room area each, `<land>:<section>`), each
with a **Waystone** (a stone that remembers who touched it), joined by **connector caves** that are the only way on,
and ending at the land's harbour (the Harbourmasters, §3.3).
- **Ember Isle** grows to 40 × 30 blocks. A **rockslide** closes the old Hills road, so **Slagstone Cave** is the way
  east. New: **the Barrow Road**.
- **Infernal Reach**: the Cinder Steppe → the Charwood → **the Kiln Tunnels** (connector, the charcoal burners'
  haul-ways) → the Deep Charwood → the Obsidian Badlands → **the Glass Throat** −1…−2 (connector, a lava tube cooled to
  glass) → the Molten Fields → the Pyre Peaks, **the Bastion Road** and **the Caldera Rim**.
- **Verdant Wilds**: the Mossy Shore → the Fernglades → **the Rootwater Ford** → the Greenwood → the Root Hollows (now a
  connector: −3 gains a root-ramp up) → the Deep Wilds → the Sunken Courts. A thorn hedge "the wood closes what it
  forgets" shuts the Greenwood road.
- **Umbral Marches**: the Gloaming Shore → the Fen → **the Pilgrims' Boardwalk** → the Sunken Belfry (connector,
  upper half only; the fifth bell stays sealed for campaign #12) → the Black Meres → the Deep Fen → **the Bog
  Galleries** −1…−2 (connector, the peat-cutters') → the Drowned Ruins.
- **Waystone names**: Meadow, Woodcutter's, Rockslide, Sexton's, Slag-Cart (Ember Isle); Watch Cairn, Glasswater,
  Kiln, Clan, Spill, Drake, Pyre (Reach); Net, Bell-Post, Plank, Mere, Copy-Tree, Heartroot, Pillar (Wilds); Corvane,
  Wick, Prayer-Board, Mere-Lamp, Lost-Lantern, Abbey-Slab (Marches).
- **Hot spots**: the Slag-Cart Graveyard, the Wolf-Run; Kettle Camp, the Scorch Rings, the Drake Nests, the Watch's
  Last Cairn; the Weaver Canopy, the Hart Meadow, the Bell-less Square; the Lure Pools, the Knights' Causeway, the
  Witch's Island. New landmarks: **the Storm-Struck Oak** (the Greenwood) and **the three dead lantern posts** of the
  Black Meres.
- **New fish**: Ash Perch, Rootling Eel, Mire Carp, **Stormscale** (a Mirrorfin caught in thunder). Mirrorfin, Lampfish
  and Moonwake keep their waters.
- **Celestial and Luminous** section names are outlines only (world-acts.md §1.5–1.6); they are not canon until those
  acts are built.

### 3.5 Realms (endgame, planned)
These follow realms-endgame.md §3.4. Each opens with an act **Seal**, a **Gate Fragment** (three Margin Notes in one
hand), and, for Realms 6–8, the **Unbound Seal**. Entry is through a **Seam-gate** (a standing-stone ring) or a capital
**rift**, from the **Waystone Hall**.

| # | Realm | Theme |
|---|---|---|
| 1 | The Cold Anvil | the Sovereign's banked heat |
| 2 | The Wrong Wood | the Graft Crown |
| 3 | The Drowned Lamp | the Lamplighter Below |
| 4 | The Stilled Orrery | the Perihelion Engine |
| 5 | The Noon That Never Ends | the Pale Refrain |
| 6 | The Hush Beneath | the Wanewalkers |
| 7 | The Tally Hall | the five hands |
| 8 | The Unwritten Margin | the Erased Witness |

---

## 4. Factions and callings

### 4.1 Factions and orders
| Name | Seat | What they want | Who |
|---|---|---|---|
| **The Pyre Watch** | Pyrehold, the Pyre Spire | Hold the gate. Sworn on a hammer "struck by five, kept by one"; admits no one under 20. | Captain Brannoc Vey, Garrick Dross (quartermaster) |
| **The Four** (smiths' guild) | the Forge of the Four, Pyrehold's great forges | Four masters, four marks (ring, wedge, tongs, flame). They scraped the fifth. | Forgewife Ysolde Marr keeps the forges; Odric Hale was the fifth [Q2] |
| **The Archive** (formally *the Dawn Archive*; its hall is the *Archivum*) | the Meridian observatory; its moon-mirror shard under Gloamhaven | Keeps the rolls: who is counted, who is struck. It files what it cannot measure and does not publish it. | The Archivist, Idris Calder (trained there), Ilyra Venn, Tomas Rill |
| **The Meridian Compact** | Meridian | Keeps the hour and the Waystones; modelled the eclipse, "the model was wrong". | Sera Quill, Nox Aster (dismissed) |
| **The Moss-readers** | Rootglass | Read the moss, which "keeps better records than we do"; kept a purse for the choir for three centuries. | Mossreader Oren Tull |
| **The Canopy Wardens** | the Rootglass Bole | Keep the Bole and the wood true; Thornstrider line. | Canopy Warden Ilsa Fenn (nine generations) |
| **The moss-priests** (gone) | the Overgrown Temple | Rang four bells each dusk to keep the wood true; walked into the first eclipse. | The Hollow Choir, the Hollow Cantor [Q2] |
| **The Lamplighters** | the Lantern Tower, Gloamhaven | Keep the Great Lantern and every post lit through the fog; Lanternwright line. | (to be named; see campaign #3) |
| **The Drowned Abbey** (gone) | under the Drowned Ruins | Sisters at prayer, an old guard, an abbess who would not leave. | Ink Abbess, Drowned Knights, Drowned Acolytes |
| **The Ashen Bastion** (gone) | the Ashen Crypt | Swore to stand the watch past death, and did. | Ossuary Watch, the Ashbone Dragon |
| **The Cinder clans** | Deep Charwood, Obsidian Badlands | Orc raiders; firecallers who "sing the lava up" in the Cant (*vael dra*). | Orcs, Firecallers, Warlords |
| **The Seamworks** | Basalt Seamworks | Stitched the world shut where it wore thin; smiths, scribes, clerks. | Kael, Mara Voss, Edrin Kade, Orla Stave, Idris Calder |
| **The Wanewalkers** | nowhere, and the far side of the Hush | To be remembered. | see §2 |

Legacy factions (world-and-cast.md:970-973) are kept as names for later acts:
- **Crucible Covenant** (Infernal smiths and heatwardens).
- **Veil Cartography** (Umbral).
- **Root Accord** (Verdant).

### 4.2 The four callings (owner-locked), plus one waiting
| Calling (EN / ES) | Trainer and line | Trees | Fantasy | Role (DM, 2026-10-26) |
|---|---|---|---|---|
| **Warlock** / Brujo | Old Mother Cindle, Ember Inn back room | Ember, Bone, Shadow (curses, wards and **rime**) | the hearth-witch who walks the dark | **AoE damage**, the fastest to level |
| **Ashguard** / Guardiceniza | Captain Brannoc Vey, Pyre Watch | Brand, Oath, Ash | the watch that holds the gate | **the tank**; a strong duellist |
| **Lanternwright** / Farolero | Tomas Rill, the lamp-keepers | Lamp, Hearth, Moth | the one who carries the light in | **the healer** (the only true one), bane of the dead |
| **Thornstrider** / Caminaespinas | Canopy Warden Ilsa Fenn | Thorn, Wild, **Briar & Sky** (*Zarza y Cielo*) | the one the wild lets through | **single target and weather**; the PvP lean |
| *(locked)* **Wanewalker** | none: "a thin one already waits by the fire" | — | fights from the far side of the Hush | — |

The callings are chosen at **the Glass** in the Keeper maker. Any calling may wear any gear. Every calling's book runs
to level 100 (`docs/design/skills-100.md`); each has a level-100 capstone that is a **sixth-mark** skill (the Keeper is
the sixth tally): *Noon Goes Black* (Warlock), *Kept by One* (Ashguard, from the Watch's "kept by one"), *The Sixth
Light* (Lanternwright), *Eye of the Storm* (Thornstrider).

**Why these roles (lore).** The Watch holds the gate, so the Ashguard stands in front. The lamp-keepers bring people
home: "the first five didn't come home, so the sixth brings them home", so the Lanternwright mends and **Rekindles**
the fallen. The Warlock spends the fire inside on many at once. The Canopy Wardens read the weather in the wood, so
the Thornstrider asks the sky, and sometimes it answers.

---

## 5. NPC registry

Format: **Name**, title. *Place.* Voice. **Wants** / **Secret** / **Quests**. "Built" means placed in the top-down
world now.

### 5.1 Ember Isle: the Basalt Seamworks (built)
- **Kael, the Broken Flame**, the fifth Keeper. *Seamworks anvil (forge stall 18,8; Kael's Anvil 30,11, the old runes stall).*
  - Voice: gruff, short, warm under it. "Hold the rhythm. The forge pays the steady, not the fast."
  - Look: blackened plate, one burning eye, grey braid with iron rings, left hand missing.
  - **Wants**: someone to finish the job without finishing it like the four did. Privately, to stop being the only one
    who remembers.
  - **Secret**: he refused the lock and kept a witness alive. He knows who drew the line. He promised to tell what
    happened to the eye "when the anvil rings on its own".
  - **Quests**: *The Beacon Goes Down* (Prologue gate, campaign #1); the Finale, *The Sixth Mark*. He voices the
    **Seamsmith** in the Waystone Hall (Realms).
  - The Rune Forge is gone (built 2026-10-26): he keeps **Kael's Anvil (smithing)**, where every smithed recipe of
    the old bench is made (§6.2).
- **Glim, the Margin-Light**, companion. *On the Keeper's shoulder.*
  - Voice: curious, honest, cartography-nerdy, never cute. "A solid line is a promise."
  - **Wants**: the blanks kept on the map. **Secret**: the first lamp's name (for the finale).
  - Speaks the Seek (*lum vesh*).
- **Sexton Aldous Wren**, keeper of the Hushed Barrow. *West lane (9,13).*
  - Voice: dry, tired, kind, counts aloud. "Forty-one. It comes out right now. Mostly."
  - **Wants**: the count to come out. **Secret**: he buried the forty-first himself and does not remember the face.
  - **Quests**: *The Sexton's Count* (built), town tasks. Cleanses grave-goods.
- **Edrin Kade**, buyback clerk and Cinder Delegate. *Vendor stall (22,22).*
  - Voice: warm counter, prickly about consent. "I resent being saved without being asked."
  - Brews potions, buys Basalt Blanks.
  - **Wants**: the district's roofs patched, and to be asked. **Secret**: Mara pulled him out of a furnace breach, and
    he has never thanked her properly.
  - Keeps the **General Store** in the Seamworks market, his potion shelf in it (§6.5, built 2026-10-26).
- **Mara Voss**, Seamwright and bench smith. *Crafting stall (14,11).*
  - Voice: "Leave the seam showing."
  - **Wants**: Kael to tell her she is good. **Secret**: Kael's best student; he never told her.
  - The crafting bench is gone (2026-10-26): she works at Kael's Anvil as his Seamwright. Her **Seamwright's repair
    counter**, which mends and re-sockets nothing, "only honest seams" (cosmetic dye and repair), is planned.
- **Orla Stave**, vault clerk. *Vault stall.* "I have never lost a thing. I have misplaced my lunch." Edrin's cousin.
- **Idris Calder**, enchanter, Archive-trained. *Enchanting stall (13,19).*
  - "A rune in a socket is a promise the gear has to keep."
  - **The Enchanting Table's keeper: runes are set and runewords made here, and only here** (§6.2, built 2026-10-26).
    Its second counter, **Charms and Brews**, makes what the bench used to enchant or brew.
- **The Archivist**, keeper of fragments. Pronoun **they** (decided 2026-10-22, C-12). *Stall (35,13).*
  - Silences whispering items. "A hint is a kindness. An answer is a theft."
  - **Secret**: filed Kael's refusal and the first lock and never published either. Their own first name is the one
    redaction.
- **Old Mother Cindle** (planned, design-bible.md:246; not placed in code yet), retired Warlock. *Ember Inn back
  room.* She knits; she trains Warlocks.
- **Odd Tarn**, one-eyed ferryman. *Ember Harbour.* "It's been warm since the second tally."
- **Davy Tarn**, Odd Tarn's nephew. *The tackle shed on the river bank (13,24).* Keeps the Seamworks' Fishing Store
  (§6.5). "Uncle says the sea's warm. Uncle says a lot." (Named by the DM, 2026-10-26.)
- **Forester Abe Thatch**. *The north orchard (40,5).* Keeps the Seamworks' Woodcutting Store. "Take the fallen first.
  Then ask me." (Named by the DM, 2026-10-26.)
- **Hollis Vane, the Row-Walker** (dead; brother to Tobias Vane, C-20), a unique Bone Walker who carries Barrow Key 1. *Barrow plot.*
- **The Barrow dead**: Maren Cole, who rang the bell; Tobias Vane, and his dog; the forty-first, with no name, only a
  tally mark.

### 5.2 Infernal Reach (built)
- **Captain Brannoc Vey**, Pyre Watch. *Pyrehold (42,16).*
  - Voice: plain soldier. "Break eight of their orcs and they'll think twice."
  - **Wants**: the Charwood road held. **Secret**: he has always wondered who the fifth was, "and why nobody asked
    him" [Q2].
  - **Quests**: town tasks; Ashguard trainer; *Hammer* witness [Q2].
- **Forgewife Ysolde Marr**, keeper of the great forges. *Pyrehold (9,10); the Smith's (27,3), built 2026-10-26.*
  - Voice: practical, not superstitious. "I am a smith."
  - **Wants**: to know what is drinking her forges' heat.
  - **Quests**: town tasks; *The Smith Who Forgot His Own Hammer* [Q2]; Act I gate *What Drinks the Heat* (campaign #2).
- **Scholar Odette Pryor**. *Pyrehold (34,19), the Pyre Spire study.*
  - Maps the Deep; keeps the Forge-roll of the Four.
  - **Thread**: the caldera smoke leans toward the land the next eclipse will lean on. She becomes a forecaster.
- **Apothecary Juno Marl**, the Alchemist. *Pyrehold plaza (15,20).* "Everything here is brewed. Not the Rejuvenations.
  Nobody here brews those." (Named by the DM, 2026-10-26; the line keeps the Rejuvenation mystery for Act III.)
- **Garrick Dross** (was Hale Dross; C-20), Brannoc's quartermaster and Harbourmaster; keeps the General Store on the
  plaza (23,22). *Pyrehold pier.* "I only write down the ones that come
  back."
- **Harbourmaster Tamsin Coyle**. *Cinderport (18,10).* "Nothing docks in Cinderport without her nod." Task giver.
- **Marit Salt**, the Salted Ember tavern-keeper's sister. *Cinderport pier, the Sailing Board.* "The Salted Ember
  keeps the lamp lit till the last ketch is in. Nobody asks why." See §10 C-10.
- **Old Netter Pell**. *Cinderport (9,11).* Mends nets. **Thread**: the Mirrorfin bite further south each year, because
  the sea is warming. Planned **Fishing Store** keeper (§6.5).
- **Woodward Hesk Ashby**, woodward of the Charwood. *Ashgrove (5,8).* Planned **Woodcutting** trainer.
- **Maud Kiln**, charburner. *Ashgrove (20,8).* Planned **Firemaking** trainer: "Charcoal is fire that agreed to wait."
- **Odric Hale** (thin) [Q2]. *Pyrehold north forge, the cold anvil, at night only.*
  - Voice: lost and polite. "Find what I made, Keeper. It will know me."
  - **Wants**: his hammer and his name. **Secret**: he carried the Watch's oath-hammer into an eclipse.

### 5.3 Verdant Wilds (built)
- **Canopy Warden Ilsa Fenn**. *Rootglass (28,11).* Her family has kept the Bole for nine generations; Thornstrider
  trainer.
  - **Thread**: when the bells stopped, the wood began to forget what it was: "the tree that wears a lantern".
  - **Quests**: town tasks; Choir witness [Q2]; Act II gate *The Wood Wears a Lantern*.
- **Mossreader Oren Tull**. *Rootglass (34,10).*
  - Voice: gentle, self-mocking. "My ears are fine. It is the rest of me that would rather not."
  - **Quests**: town tasks; *The Hollow Choir* [Q2].
- **Netmender Wenna Brisk**. *Mossharbor (23,7), the Net-Mender's Loft.* Task giver; planned **Fishing** trainer for
  the Wilds.
- **Herbalist Agathe Sorrel**. *Thornwick (4,7), the Herbalist's Cottage.* She has her grandmother's memory and most of
  her temper. Choir witness [Q2]. Planned **Cooking** trainer (herbs) for the Wilds.
- **Sunny Pell**, Netter Pell's niece and Harbourmaster. *Mossharbor pier.*
- **Provisioner Teo Alder**, Rootglass's general store. *The boardwalk market (4,16).* "Rope, oil, a lamp that won't
  scorch the boardwalk. The Bole's not for sale; I get asked." (DM, 2026-10-26.)
- **Seedwife Rue Hazel**, Herb and Seed. *The Bole (18,8).* "Plant what you buy here and it grows true. Mostly. The
  wood's been forgetful." (DM, 2026-10-26: a quiet seed for Act II's copied trees.)

### 5.4 Umbral Marches (built, almost empty)
- **Old Corvane**, lamp-warden and Harbourmaster. *Mirewatch pier.* "The fog thins round a lantern. Round something
  else, too."
- **Lampwife Hesper Reed** (new, campaign #3). *Lanternfen, the lantern green.* Keeps nine lanterns for the nine lost.
- **Ansel Mott, Wick-Keeper** (new, campaign #3). *The Lantern Tower, the Keeper's Hall.* Keeps the tower's log.
- **The Lamplighter Below** (planned, Act III). A sixth Keeper's apprentice who never came up. Brews the Rejuvenations,
  leaves the Lamplighter's Things, and becomes a Homestead visitor.
- **Chandler Odo Murk**, Gloamhaven's general store and chandlery. *The square (18,9).* "Oil, wick, candles. In the
  Marches that is the general store." (DM, 2026-10-26.)
- **Fishmonger Dace Morrow** (reserved in campaign.md queue #6). *The west jetty (10,11).* "Black water, fat fish. Don't
  ask what they eat." (DM, 2026-10-26.)

### 5.5 Legacy cast (adopted; placed when their capitals are built)
Aureth, Verrin, the Merchant, Sera Quill, Nox Aster (always print the full name), Ilyra Venn, Tomas Rill, Rook Sable,
Amina Thorne, Lune Coyne, Kesh Arbo, Siv Moss, Pim Larkin, Corran Holt, Hesta Cairn and Hollis Fenn (the last Ridge
Courier). Voices, wants and secrets are as world-and-cast.md:437-817. The **Merchant**: "Nobody has ever seen the
Merchant buy anything". This is canon; the Merchant *weighs and takes in*, the Croupier buys (§10 C-15).

### 5.6 Bosses with a reason to exist
| Boss | Where | Why it is there |
|---|---|---|
| Ember Warden 8 | Ember Mine −3 | Kept the mine lit after the miners left; bites anyone who comes to stoke it. |
| The Uncounted 7 | Hushed Barrow vault | The forty-first grave. "It fights like it wants to be counted." |
| Anvil-Warden 18 | Forge −3 | The First Smith's anvil grew legs to keep its oath. |
| The Unfinished Warden 17 [Q2] | the Fifth Smithy | Odric's first Anvil-Warden, never told what it was for, so it works at everything. |
| Magma Tyrant 20 | Molten Deep −3 | A crown poured too hot; set to guard the stair down. |
| Ashbone Dragon 25 | Ashen Crypt −2 | The Bastion's last lord, a promise the ash made. |
| Cinder Sovereign 30 | Molten Deep −6 | What the fire remembers; **banking the heat to keep the seam shut**. |
| Mossbound Colossus 34 | Temple −3 | The temple's guardian; the Root grew in and kept it. |
| The Hollow Cantor 29 [Q2] | the Choir Loft | The choirmaster who stayed, beating time to keep the bells ringing. |
| Elder Rootwyrm 40 | Temple −5 | The first thing the Root grew; the priests called it the Cradle. |
| Ink Abbess 50 | Drowned Crypts −3 | Would not leave her prayers when the water came. |
| Seam Eater, Risen | the standing stones | The seam's hunger, assembled when the stitches let go. |
| **World bosses** (M3, 2026-10-26; `play/world/world-bosses.ts`) | rise on timers of hours, at a random spot in their regions, heard the world over (an omen line) | — |
| Old Greymaw 12 (world) | Ember Isle, the Emberwood and the Deep Emberwood | The Ash Wolves' matriarch: when the Emberwood goes quiet, the wolves are waiting for her. Above the isle's 1–10 band (the Seam Eater at 20 is the precedent); the omen carries "Dangerous for your level". |
| Gharak Emberjaw 32 (world) | Infernal Reach, the Obsidian Badlands and the Deep Charwood | A Cinder warlord who answers no clan; his war-horns blow and none of the clans answer. |
| The Copied Hart 42 (world) | Verdant Wilds, the Deep Wilds | A rootglass hart the wood copied one time too many; foreshadows the Graft Crown (a copy that wants to be the original). Its fall line keeps the copying unresolved. |
| Ser Wickless, Marshal of the Drowned Guard 55 (world) | Umbral Marches, the Drowned Ruins and the Deep Fen | The *other* abbey captain: he refused the Abbess's last order ("Bring them in"), gave his lantern's flame to the Fog-Shepherd (The Tenth Lantern), and has patrolled the Ruins dark ever since. |
| (planned) Graft Crown ~45 | the Rootcradle Below | The tree that wears a lantern: a copy that wants to be the original. |
| (planned) Mirror Parliament ~55 | the Ink Deeps | The four Keepers' consensus, copied and left to vote forever. |
| (planned) Perihelion Engine; Pale Refrain; Unbound Pattern | Acts IV, V, Finale | design-bible.md §3.3 |
| (planned) **The Last Siege** ~32, world boss | the Obsidian Badlands, ashfall nights | the Ashen Bastion's siege tower, still rolling toward a war that ended. It is not angry; it is late. If it reaches the Bastion's ruin it salutes and leaves. |
| (planned) **The Antlered Storm** ~42, world boss | the Storm-Struck Oak, the Greenwood, thunderstorms | the oldest Rootglass Hart, struck by the first storm after the Lock; the lightning stayed. The wood remembering it was weather before it was a wood. |
| (planned) **The Fogmother** ~54, world boss | the Black Meres, fog at night | what the fog keeps when a lantern gutters, wrapped in the drowned sisters' habits. Lighting the three dead posts first prevents her. She is **not** what the fog thins round (Act III's Second Lantern). |

**Party forms** (planned, monsters-abilities.md §5.3). On Nightmare and Hell, a party meets each floor boss's party
form: its reason made visible as a mechanic (the Anvil-Warden's Sunder is the hammer on the anvil; the Ink Abbess
writes your name, a Brand only the healer can lift).

**World-boss uniques** (planned; worldbound: one trade binds):
- **The Wall That Kept Walking**, a shield. "It held the line so well that it carried the line with it."
- **Crown of the Antlered Storm**, a helm. "The hart wanted to be a tree. The tree wanted to be the storm. Neither
  asked the antlers."
- **The Psalm Heard Through Water**, an amulet. "She sang it wrong for so long that it became a different hymn, and
  that one works."

### 5.7 Creatures added 2026-10-26 (shipped 2026-10-26 on branch `mobs`, S6; monsters-abilities.md §2)
- **Ashsinger** / *Cantaceniza* (orc, 12–18, the Deep Charwood and the Obsidian Badlands). The clans' shaman sings the
  fallen back up (*vael osk teth*), D2's Fallen Shaman: "The clans bury no one. The Ashsinger sings them back up
  instead, and charges the family for the verse."
- **Bone Priest** / *Sacerdote de hueso* (bone, 15–25, the Ashen Crypt only). The Bastion's chaplain still calls the
  roll (*osk teth*): "He still calls the roll, and the roll still answers."
- **Monster auras** share the Keepers' aura names (Might, Blessed Aim, Conviction, Redemption, Holy Fire, Holy Freeze,
  Holy Shock, Fanaticism, Prayer, Vigor, Thorns), plus two of our own: **Lightless** (the dark leaning in) and
  **Cant-Chorus** (a pack speaking the old tongue together). A pack's aura blesses its own pack only.

---

## 6. The rules of magic, runes and crafts

### 6.1 The Seam-Cant
The tongue of making, older than the Seamworks. Roots say *what*; shapes say *how* (design-bible.md:207-233).

| Root | Meaning |
|---|---|
| vael | fire, ember |
| osk | bone, the dead |
| nyr | shadow, the unseen |
| lum | light, lamp |
| hesk | hearth, warmth, mending |
| thar | thorn, root, the wild |
| brann | oath, iron, the watch |
| ul | the eclipse, the seam |
| vor | the sky, weather, storm: rain, wind, thunder (added 2026-10-26) |
| rim | cold, frost, ice: "what the heat leaves" (added 2026-10-26) |

| Shape | Meaning |
|---|---|
| -sha | a bolt, one target |
| -orum | a ring, all around |
| -dra | falling, from above |
| -mur | a wall, a line |
| -ka | on the self, a ward |
| -teth | calling, raising |
| -vesh | seeking |
| -un | undoing, ending |

**Rules**
- A word is root + root + shape, read left to right. Every spell has words; monsters speak them as tells (Firecallers
  *vael dra*, the Ink Abbess *nyr orum*, the Seam Eater *ul nyr sha*).
- **Riddles in the world are answered in Cant** (the Choir lectern: *ul un*). No riddle may need a root or shape not in
  this table. A new root needs the DM's entry here first.
- The final sentence is the **Cant of Holding**, *ul brann hesk lum nyr*: "the five-root sentence the first Keepers
  spoke wrong". Do not reveal its meaning before the Finale.
- The Cant is never a person's name. See §10 C-14 (Hesk Ashby).
- **Compounds fixed by the 2026-10-26 pass**: lightning is *lum vor*, "the sky's lamp"; rain *vor dra*; fog *vor nyr*;
  a blizzard *rim vor dra*; a frost bolt *rim sha*; raising the dead *osk teth* (the Ashsinger sings *vael osk teth*).
  *vor* and *rim* are never names (§7.5).

### 6.2 Runes and runewords (the owner's queued system, now canon)
- **What a rune is.** The 22 runes are *compact principles of the Godforge*. They are splinters of the line the Keepers
  drew, shaken loose by every eclipse and caught in the creatures that live nearest the seam. This is why **runes drop
  only from monsters**: nobody forges, buys or crafts one.
- **Runes drop by zone level.** The deeper and harder the zone, the heavier the rune. The tier ladder (rune names from
  `shared/rune-forge/rune.model.ts:177-232`; level gates are the DM's proposal for the builder, to be tuned against
  `loot-and-combat.md` §8):

| Tier | Runes | Lowest zone band | Where it first appears |
|---|---|---|---|
| common | Ash, Ember, Drift, Shade | 1+ | Ember Isle |
| uncommon | Glint, Veil, Pulse, Thorn, Scorch | 8+ | the Reach |
| rare | Nexus, Sigil, Rift, Hollow | 15+ | the Wilds and the Reach's deeps |
| epic | Fracture, Eclipse, Forge | 26+ | the Marches; Nightmare anywhere |
| legendary | Aether, Nox, Codex | 35+ | the Peaks; Nightmare cap |
| mythic | Convergence, Godstone | 45+ | the Expanse; Hell |
| singular | Void | Hell or Realms | about 1 in 2,000,000 |

  The zone's level decides the tier on every difficulty (built 2026-10-26: Nightmare lifts creatures 20 levels, Hell
  40); only Hell lets the Void fall. (The earlier caps, Normal rare and Nightmare legendary, contradicted the ladder's
  Marches and Peaks and were raised to mythic.) Drop rates: `docs/design/runewords.md` §1.
- **Runewords** (the shipped *Socket Words*). They are made only at the **Enchanting Table** (Idris Calder in the
  Seamworks, plus an enchanting stall in each capital), by setting runes in order into a **normal** (white, no-affix)
  base with exactly the right number of sockets. The base keeps its item level. Lore: "Every rune you socket is a
  sentence." The eighteen starter words: `docs/design/runewords.md` §6 (Cinderling, Hearthguard, Wayfarer, Mothlight,
  Ashwake, Brandoath, Stormglass, Rimeveil, Mercyroot, Vigil, the Archivist's Ledger, Verdict, Riftwalk, Emberseam,
  Daybreak, Eclipse Blade, Godforge Weld, Voidmark). A runeword's name shows gold; a socketed white base, grey.
- **Setting a rune** happens only at a table, and **it never comes out**: "A rune in a socket is a promise the gear
  has to keep." There is no unsocketing.
- **Sockets**:
  - By item level: 1–14 gives up to 2, 15–29 up to 3, 30+ up to 4; shields and staves get +1. Only a normal (white)
    item rolls them, once, when it drops; each base type has its own maximum (gloves, boots, belts, jewellery and
    tools none). The Smith's in Pyrehold sells socketed normal bases.
  - Armour sockets give resists; weapon sockets give the rune's weapon line.
- **Eclipse Words.** A word whose last rune is set during an eclipse gains an eclipse line. This is the most
  mysterious crafting rule and ties runes to the clock.
- **Witness runes.** Ash, Thorn, Veil, Drift and Glint are also the *names* the four signers and Kael's line wrote
  under. As Witness marks they are **quest evidence, never socketable**. A dropped Ash rune is the principle; the Ash
  Witness mark is a signature.
- **Retired (removed 2026-10-26).** The **Rune Forge** (strike for runes, STRIKE_COST) and the **crafting bench**.
  No line may say runes are struck, forged or bought. Old forged runes stayed owned: they moved into the satchel as
  the same runes. Every bench recipe moved to **Kael's Anvil (smithing)** or the Enchanting Table's **Charms and
  Brews** counter (`docs/design/runewords.md` §7).
  - Kael keeps his anvil.
  - "Every rune in here was somebody's bad week made useful" moves to the Enchanting Table's rune pouch, voiced by
    Idris.
  - Kael's Anvil (smithing) replaces "Kael's Quench": no rune crafting.
- **Realm runes** (endgame): one tier above the rune cap, bought only with Realm Shards from the Seamsmith.

### 6.3 Spellstones (Tibia runes)
They are called **Spellstones** so they never clash with runes. A **Basalt Blank** plus **Soul** plus a known spell,
cut in the **Skill Book** (the "create Spellstone" button on the skill's row), makes a charged stone. "The Seamworks
scribes cut the Cant into basalt because basalt remembers being fire."
- **A stone records the hand that cut it** (2026-10-26, `skill-book.md` §4): the spell's rank *and the marks (modifier
  nodes) taken under it*. It is a real satchel item, one charge a unit, stacking only with stones of the identical
  recipe; it can be traded, sold and dropped. "Lend it to a friend and it still speaks in your voice."
- The hidden stone pouch is retired; its stones move into the satchel.

### 6.4 Light, dark and the eclipse
- Light is a resource: torches, lamps and hearths are fixed lights, and the Keeper and Glim carry light.
- Dark-born show only in low light and **never ambush**.
- Eclipse phases change spells (the Ember/Lamp tables).
- An eclipse crossing at sea is violet, with a Wanewalker's lamp far off the bow.

### 6.5 Gathering, cooking and shops (the owner's queued plan, now canon)
RuneScape-style skills on the shared skill curve. Each has a home, a trainer and a lore line.

| Skill | How | Trainer and home | Lore line |
|---|---|---|---|
| **Fishing** | at **marked fishing spots** (a ripple tile with a float), not any water. Mirrorfin, Lampfish, the Moonwake catch under an eclipse. | Old Netter Pell (Cinderport), Netmender Wenna Brisk (Mossharbor) | "The sea is warmer. The fish know first." |
| **Woodcutting** | at named trees by band: Ember Isle ashwood → Charwood char-oak → Verdant rootglass boughs (never the Bole) → Umbral cypress | Woodward Hesk Ashby (Ashgrove) | "Take the fallen first. The Charwood keeps count." |
| **Firemaking** | logs plus a tinderbox light a **campfire**: a small hearth for 2 min that quiets the Hush and keeps dark-born back | Maud Kiln (Ashgrove) | "Every fire you light is a small hearth. The dark minds its manners round one." |
| **Cooking** | at a hearth or a lit campfire: fish and game become **Hearth meals** (regen, Hearthwarmth) | Edrin Kade (Seamworks), Agathe Sorrel (Thornwick) | "You hunt better on a night's sleep and a full belly." |

**Themed shops by district** (Tibia-style, Gold only; each keeper says what they sell and *don't*):

| City | District → shop | Keeper |
|---|---|---|
| Seamworks | Market square → **General Store** (rope, torches, ladders, Waygate Scrolls, small potions); river bank by the bridge → **Tackle shed** (Fishing Store); the north orchard → **Woodcutting Store** | Edrin Kade; Davy Tarn; Forester Abe Thatch |
| Pyrehold | Plaza of stalls → General Store and the **Alchemist** (every potion, not the Rejuvenations); Forge district → **Smith's** (normal bases with sockets, the Enchanting Table's supply); Harbour → **Fishing Store** | Garrick Dross; Apothecary Juno Marl; Ysolde Marr; Netter Pell's stall |
| Ashgrove | The Charwood's edge by the lodge → **Woodcutting Store** (axes, timber) | Woodward Hesk Ashby |
| Cinderport | Dockside → **Fishing Store** (rods, bait, the fishing-spot chart) | Old Netter Pell |
| Rootglass | Boardwalk market → General Store; the Bole → **Herb and Seed** (built 2026-10-26) | Provisioner Teo Alder; Seedwife Rue Hazel |
| Mossharbor | Pier → **Fishing Store** | Netmender Wenna Brisk |
| Gloamhaven | West jetty → **Fishmonger and Tackle**; the square → the **Chandlery**, the general store with the Lamp-oil and Wick folded in (candles, wick, lamp oil) (built 2026-10-26) | Fishmonger Dace Morrow; Chandler Odo Murk |

### 6.6 Death
- **Normal world**: the Cold Hearth. Ember debt, a fallen purse, nothing lost; under level 20 a fall costs the walk.
- **Realms and Nightmare/Hell**: Tibia-style (realms-endgame.md §3.9). Story items are never lost.
- **A death to a Keeper** (PvP, §6.8) keeps the scope's XP rule and always leaves a **Keeper's bag** (world-acts.md §6.5).
- **Rekindle** (the Lanternwright, L30): a party member fallen where a fall costs can be woken where they fell; within
  30 s of the fall, the death costs nothing. Lore: the sixth brings them home.

### 6.7 Weather (2026-10-26, `docs/design/world-acts.md` §3)
- The sky is one for everyone: each land rolls its weather every 6 real minutes from the world clock. States: Clear,
  Overcast, Rain, Thunderstorm, Fog, and one per land (Ashfall on Ember Isle and the Reach, Spore drift in the Wilds,
  Mist-rain in the Marches; Snow and Glass-storm later). Outdoors only; an eclipse hushes it.
- **Wet** is the weather's rule: lightning bites deeper and leaps further on the wet; fire burns lower; cold freezes
  them. A thunderstorm's strike never takes a Keeper below a tenth of their life.
- Lore: "Ask the sky; sometimes it answers." The Canopy Wardens read it; **Odette Pryor** forecasts it from the
  Pyre Spire (the smoke-leans thread pays off here first, §9).

### 6.7b Skill Book marks and their stand-ins (2026-10-26, `docs/design/skill-book-stand-ins.md`)
- A mark's **name is canon and its group effect is the promise**. Where a group system is missing, the mark carries a
  solo stand-in and says so in its line; the stand-in stays and the group effect is *added* when the system ships.
- The DM ruled all 58 listed stand-ins: 18 permanent, 6 replaced now, 34 swapped later (S4, S5, S6, S8, S10).
- A mark's name must not promise what its effect is not: Watchfire B1 is **Tempered Fire / Fuego templado**
  (was Wide Fire, which gave armour, not reach).
- The Spanish mark names were the builder's; 16 rows (21 marks) are re-named: "Cheap" is **Frugal** in ES
  (never "Barato", a shop word); "Rally" is **Cerrar filas**; wisps are **fuegos fatuos**.

### 6.8 PvP: the world counts (2026-10-26, `docs/design/world-acts.md` §6)
- Open, Tibia-style, everywhere outside the safe light. **Never** on Ember Isle, on a town's or village's safe ground,
  indoors, on piers and boards, at Waystones and hearth rings, in the Waystone Hall. Under level 20 nobody fights a
  Keeper. Nobody opens on a Keeper below two-thirds of their level.
- **The marks** are a count on your name, because the world counts (the Keepers' line was a count; the Sexton counts
  the graves; the Archive strikes names):
  - **Ash Mark** / *Marca de ceniza*: struck first; 15 minutes.
  - **Red Tally** / *Cuenta Roja*: 3 unjustified kills in a day, 5 in a week or 10 in a month; 30 days.
  - **Struck** / *Tachado*: 6 more while Red; 45 days; your name leaves the plate, Glim dims beside you, no harbour
    will carry you.
- The Pyre Watch pays a **Writ of the Watch** for the counted, at Captain Brannoc Vey's desk. Aldous Wren cuts a
  tally on the lych-gate post for every Red Keeper who visits: "Forty graves. And one more name to keep."


---

## 7. Naming style guide

1. **Places are compound English nouns from the land's material.** Examples: *Slagstone, Ashgrove, Rootglass,
   Mossharbor, Gloamhaven, Lanternfen, Cinderport, Mirewatch*. The pattern is material + human place-word (-hold,
   -port, -grove, -wick, -fen, -watch, -haven). Dungeons are "the X of the Y" or "the Adj Noun" (*the Forge of the
   Four, the Drowned Crypts, the Molten Deep*). Each floor gets its own "the …" name (*the Sporewell, the Bone Hall*).
2. **People have a working title and two plain names**, the title first in speech: *Forgewife Ysolde Marr, Mossreader
   Oren Tull, Netmender Wenna Brisk*.
   - Surnames are short English craft or landscape words (*Reed, Kiln, Salt, Pell, Tarn, Brisk*).
   - Infernal names run harder (*Brannoc, Dross, Odric*); Verdant ones softer (*Agathe, Oren, Ilsa*); Umbral ones dim
     (*Corvane, Hesper, Ansel*).
   - **No two named characters share a first name or a surname**, unless they are family and the text says so (Netter
     and Sunny Pell). Check §5 before naming.
3. **Bosses are "the Adjective Role"** (*the Ember Warden, the Hollow Cantor, the Unfinished Warden*) or a role +
   material (*Ashbone Dragon, Magma Tyrant*). A boss name says what it was *for*.
4. **Uniques are possessive or "The X"**, and their lore line is a contradiction or a consequence, never only an effect
   (lore-addendum.md:537-538). Examples: *Warden's Last Ember*, *The Unsigned Hammer*.
5. **Never use the Cant roots** (vael, osk, nyr, lum, hesk, thar, brann, ul) **or rune names** (Ash, Thorn, Veil,
   Drift, Glint, Nox, Sigil, Forge…) as personal names. Legacy exceptions are grandfathered: Nox Aster is always
   printed in full. Hesk Ashby is in §10.
6. **Words owned by one thing.**
   - *Realm* means the endgame only.
   - *Land/continent* means a landmass.
   - *Seam* means the line.
   - *the Hush* means the dread meter; *Hushed Barrow* is a place.
   - *Archive* means the Dawn Archive.
   - *the Four* means the smiths' guild; the Keepers are "the four who signed".
   - *Waystone* means the Waystone Hall (the endgame portal hub); the portals themselves are *Seam-gates*; recall is
     *Waygate*.
7. **Spanish ships in the house style**:
   - no diacritics or ñ, as in the shipped tables ("Guardian", "anos");
   - place names stay English (*Rootglass*, *Pyrehold*) in every language (decided 2026-10-22, §10 C-16);
   - the Seamworks is *el Taller* in story text;
   - a Keeper is *Guardian*.
8. **Numbers in lore**: see the dating rule in §1. Counts are sacred: forty graves, four bells, five marks, nine lanterns.
   Once said, a count is never changed.

---

## 8. Zone bible (duty 5; the builders' brief for every zone)

**The house mood.** The **wild** is the edge of the light: dusk, weather and animals. **Dungeons** are a dark tabletop
dungeon:
- someone built them, and they fell;
- something lairs there now, for a reason;
- light is scarce and placed on purpose;
- every floor has something to *read*, something *sealed* and something *hidden*.

**Towns and hearths** are warm cream light (`#fff2a8`), music and people: the safe light. A town never has a dread
prop.

**Set-dressing vocabulary.** The engine has torch, bones, chest, pillar, grave, lantern, forge and anvil. The
atmosphere pass adds:
- **altar**
- **brazier**, unlit or lit; a lit one is a light source, and a Keeper may light an unlit one
- **cage**
- **chains** (wall)
- **broken statue**
- **cobweb** (corner decal)
- **ritual circle** (floor decal)
- **inscription** (a readable wall tile, a station with an i18n line)
- **sealed door** (a Tibia door with no key yet)
- **old stain**: rust-brown, dry, never fresh, never red; per the bible, no gore

**Light rule for dungeons**:
- torches only at stairs (the safe-arrival rule), at a boss ring, and where a story says someone keeps them lit;
- everything else is dark or lit by the lair's own glow (lava, rootglass, ink);
- at most about 4 fixed lights per floor outside the stair and boss rings.

### 8.1 Ember Isle (Prologue: the doorstep of the dark; gentle dread)
- **The wilds**: Cinder Meadows, Ember Coast, Ashwater Lake, the Emberwood, the Deep Emberwood, Slagstone Hills, the
  Ashfields.
  - *Who and what*: farmland the Seamworks fed; the Ashfields are where the slag carts dumped for a century. Ash Wolves
    hunt the hour after the last ember fades; Rivet Maws chew the old rivet dumps.
  - *Mood*: warm by day; at dusk grey ash drifts like snow; the Ashfields are colourless.
  - *Dressing*: abandoned slag carts in the Ashfields, a broken Cant milestone on the east road ("UL… MUR", half
    buried), chalk tally marks on fence posts near the Barrow.
  - *Sounds*: surf, crickets, far forge-hammers; at night one bell from the Barrow.
  - *Hidden*: a Nightroad's end at Ashwater Lake (a shade chest); a Margin Note in Kael's hand under the Ember Shrine.
- **Ember Mine** (−1 the first workings, −2 the Flooded Galleries, −3 the Warden's Forge).
  - *Who built it, why it fell*: Seamworks miners dug Cinder Ore. The heat came up "heavier" after the Lock, Kael
    closed the mine, and the water took the lower galleries.
  - *Lair*: Rivet Maws (scrap that kept its teeth); Cinder Bailiffs still serving writs to a dead mine; the Ember
    Warden keeps the forge-fire banked.
  - *Mood*: −1 timber and torch-lit near the ladder, black past the first bend. −2 black water, plank walks, drips.
    −3 a long dark hall to a ring of torches.
  - *Dressing*:
    - a shift board with the last crew's names chalked, the last line unfinished (inscription);
    - lunch tins and a cold lamp by the bones where the last crew stopped;
    - writ-nails hammered into −2's posts (Bailiff work);
    - in −3, five tally marks at Keeper height behind the Warden's ring, four crossed (the Prologue's tally seed).
  - *Sounds*: drips, plank creak, a rivet rattling somewhere it shouldn't.
  - *Encounters*: boss lair (−3); a flooded side gallery on −2 with the Lamplighter's lantern in a shade chest
    (built); a collapsed adit on −1 sealed with a rusted grate (later, a key-ring door).
  - *Hidden*: the shade chest (−2); a miner's ledger page ("Paid in full. The mine was not.").
- **Slagstone Cave**.
  - *Who, why it fell*: an old miners' camp under Slagstone mountain; the slag pools rose and the camp was left.
    Rivet Maws nest in the cold forge-pit; Cinder Imps spark in the slag.
  - *Mood*: low orange slag-light, smoke-black ceiling.
  - *Dressing*: a camp of three bedrolls, one still made; a kettle; a "back at dusk" note on a crate (inscription;
    never back).
  - *Sounds*: slag bubbling, rivets ticking as they cool.
  - *Encounters*: a nest room of Maws round the ore vein.
  - *Hidden*: the far chest past the slag pools; a boulder that hides a two-tile crawlspace with bones and a
    copper-bound tally stick.
- **The Hushed Barrow** (the plot, and the vault under it).
  - *Who, why it fell*: the Seamworks' burying ground below the Sunken Chapel. The chapel sank; the Barrow kept its
    sexton. The dead walk the rows: they remember walking to work.
  - *Mood*: the plot is blue-grey moonlight and fog low on the grass. The vault has two lanterns somebody keeps lit,
    and nothing else.
  - *Dressing*: forty headstones, chalk-counted; a fresh lamp-wick on Tobias Vane's stone; earth pushed *up* on the
    nameless grave; Barrow Door 1 iron-banded with a keyhole stamped "1"; **room in the vault wall for Barrow Doors
    2–5** (sealed, keyholes 2–5; planted for later chains).
  - *Sounds*: one far bell, wind in the yews, the Sexton's broom by day.
  - *Encounters*: the Sexton's Count (built); Hollis the Row-Walker; the Uncounted over the forty-first.
  - *Hidden*: the jetty ledger page (night only); doors 2–5 as sealed promises.
- **The Sunken Chapel, the Ember Shrine, the Caldera, the Ninefold Stones** (surface places).
  - The Ninefold Stones are nine standing stones. **Five carry a tally mark**, four crossed and one worn smooth
    (campaign #1); the Seam Eater rises here in an eclipse.
  - The Caldera's crater has steam vents and a basalt stair going down into fog (no way in yet: the planned Caldera
    −1, Act I epilogue).

### 8.2 Infernal Reach (Act I: heat, oaths, ash)
- **The wilds**: the Cinder Steppe, Ashen Shore, Glasswater, the Charwood, the Deep Charwood, Obsidian Badlands, Molten
  Fields, Pyre Peaks.
  - *Who and what*: the Watch's land, clawed back from the Cinder clans. The Charwood burned and was charcoaled for a
    century. The Badlands are the Forge's spill. Orc camps hold the Deep Charwood and the Badlands. Drakes nest in the
    Molten Fields.
  - *Mood*: red dusk all day near the lava; black trunks; heat shimmer.
  - *Dressing*:
    - Watch cairns with brass oath plaques (inscription: "Struck by five, kept by one");
    - orc totems of bone and slag;
    - Firecaller ritual circles in the Badlands (scorched rings, *vael dra* cut into stone);
    - cages of the Cinder clans (empty, door hanging);
    - charcoal kilns gone cold in the Deep Charwood.
  - *Sounds*: crackle, lava hiss, a war-horn far off, the Watch bell from Pyrehold.
  - *Hidden*: the Ring of Pyres (Seam Eater 30); the Ember Altar with a Margin Note in Ash's hand.
- **The Forge of the Four** (−1 the Ash Gate, −2 the Four Smithies, −3 the First Anvil; [Q2] the Fifth Smithy; −4
  planned).
  - *Who built it, why it fell*: the Four's works-forge. The masters died out or walked away; what they made was never
    told to stop. Bailiffs and Golems keep the halls; the Anvil-Warden keeps the First Smith's oath.
  - *Mood*: cold hearths everywhere except two lava channels; firelight only from the channels and the stair torches.
    Iron-grey and ember-orange.
  - *Dressing*:
    - each smithy carries its master's mark (ring, wedge, tongs, flame) cut over the forge (inscription), with
      unfinished blades on the racks;
    - chains for hauling;
    - a broken statue of the Four, its fifth plinth empty;
    - a **sealed door** at −3 (later −4).
  - *Sounds*: one hammer blow from nowhere, every half-minute; bellows breathing with nobody at them.
  - *Encounters*: the Four Smithies' marks puzzle and the stair nobody drew [Q2]; the Anvil-Warden's slag-moat lair.
  - *Hidden*: the Lamplighter's gloves (shade chest, −2); Odric's crescent filed under the fourth mark [Q2].
- **The Ashen Crypt** (−1 the Ossuary, −2 the Bone Hall).
  - *Who built it, why it fell*: the Ashen Bastion's garrison, buried in the cinder under its walls. They swore to
    stand the watch past death, and do. The last lord became the Ashbone Dragon.
  - *Mood*: grey ash light, bone-white, the only colour in the slag pools. Torches only at the processional and the
    throne.
  - *Dressing*:
    - bone niches floor to ceiling; banners of the Bastion rotted to threads;
    - a roll-call board with names scratched off one by one (inscription: "Present." under each, in the same hand);
    - an altar to the Watch with a dry censer;
    - ritual circle under the throne;
    - cobwebs thick.
  - *Sounds*: marching feet in step, then stopping; bone archers' bowstrings.
  - *Encounters*: the processional gauntlet; the Dragon's throne room.
  - *Hidden*: the Ossuary Watch set; the Lamplighter's coat (shade chest, −2); a sealed side chapel (keyhole shaped
    like a Watch badge, for a later Ashguard calling quest).
- **The Molten Deep** (−1 to −6).
  - *Who built it, why it fell*: the Reach's deepest working. The Four's guild cast black glass in the Glass Foundry
    (−5). It fell when the heat began to *go down* instead of up. The Cinder Sovereign sits at the bottom banking the
    heat to keep the seam shut.
  - *Lair*: Lava Hounds, Imps, Golems, Slag Crawlers, Drakes, Glass Sentinels still at their posts.
  - *Mood*: lava glow is the light. **Too many torches today** (8–12 per floor; atmosphere pass, campaign #4). −2 needs
    **frost on obsidian beside lava** (the wrongness clue); −5 needs cold anvils and unlit braziers.
  - *Dressing*:
    - −1: hound bones round the pools; a caved-in mine cart on a lava track.
    - −2: frost-glass seams (blue-white rime on black glass, inscription line "cold on the side that faces down").
    - −3: a crown-shaped slag cast at the caldera rim.
    - −4: bridges with chain railings, one railing gone.
    - −5: casting pits numbered 1–5 in Cant numerals; cold anvils with frost; unlit braziers.
    - −6: the basalt dais; a sixth tally mark scratched into it, fresh (the act-boss tally seed).
  - *Sounds*: deep bass rumble; glass ticking as it cools; at −5, nothing at all (the dread is the silence).
  - *Encounters*: the Tyrant's island; the bridge crossings; the Sovereign's dais and its Lava Hound call.
  - *Hidden*: frost-glass clues (campaign #2); a Margin Note in Ash's hand at −6.
- **Pyrehold, Cinderport, Ashgrove** (towns: safe light).
  - Pyrehold: the forge district's glow, the plaza of stalls, the Watch bell, the Pyre Spire's study lamp. The **cold
    anvil** in the north forge is the one dark spot in town, and it is a story [Q2].
  - Cinderport: the Salted Ember's lamp "lit till the last ketch is in".
  - Ashgrove: kiln smoke, thatch, a green.

### 8.3 Verdant Wilds (Act II: the wood forgets what it is)
- **The wilds**: the Fernglades, Mossy Shore, Rootwater, Glassmere, Greenwood, Deep Wilds, Sunken Courts.
  - *Who and what*: the wood the moss-priests kept true by bells. Since the bells stopped, it copies itself: a tree
    that wears a lantern; deer that grew old into Harts.
  - *Mood*: green-gold by day; in the Deep Wilds, noon is dusk. Rootglass glows teal in the roots.
  - *Dressing*:
    - **copied trees** (two identical trees side by side, one slightly wrong);
    - moss growing in straight lines near the Courts;
    - priests' bell-posts with no bells;
    - Thorn Weaver webs between trunks;
    - broken temple statues swallowed by roots in the Courts.
  - *Sounds*: birds that stop all at once; a dusk hymn from the temple [Q2]; creaking boughs.
  - *Hidden*: the Ring of Thorns (Seam Eater 40); the Moss Altar's offering bowl (a Margin Note in Thorn's hand); the
    Drowned Aqueduct (planned interior).
- **The Root Hollows** (−1 the Gnawed Galleries, −2 the Sporewell, −3 the Heartroot Cellar).
  - *Who built it, why it fell*: no one built it. A giant tree died standing; its roots rotted and left their shape in
    the earth. Rootgnaws chew it wider; Sporecaps grow in the dark they leave.
  - *Mood*: **already right**: no torches, only rootglass lamps and the heartroot's faint glow. Keep it that way.
  - *Dressing*: gnaw-marks; spore drifts (a floor decal); a woodward's rope and a broken lamp at the Sporewell's lip
    (somebody went down the well); the heartroot's rings with "tomorrow" scratched at the outer ring.
  - *Sounds*: chewing in the walls; a slow drip into the well; a heartbeat, faint, at −3.
  - *Encounters*: the Sporewell round-room; the heartroot.
  - *Hidden*: the Lamplighter's ring (shade chest, −2); a cache behind a root that moves when lit.
- **The Overgrown Temple** (−1 the Sunken Narthex … −5 the Rootcradle; [Q2] the Choir Loft).
  - *Who built it, why it fell*: the moss-priests. They worshipped the Root, and the Root came to worship back: it grew
    in through the floors and drank the springs. The choir walked into the first eclipse and came back hollow. The
    Root kept the guardian (the Colossus), the priests (the Drowned Acolytes) and its first child (the Elder
    Rootwyrm).
  - *Mood*: should be **dim green and holy-abandoned**; **today it is lit like a hall** (6–8 torches a floor; campaign
    #4). Shafts of daylight through the vinewall on −1 only; below that, rootglass glow and spring shimmer.
  - *Dressing*:
    - −1: the four bells [Q2]; pews of moss; an altar under roots; hymn-boards (inscriptions in Cant).
    - −2: roots through the flagstones, broken statues of priests with their faces mossed smooth.
    - −3: the moat shrine; offering bowls.
    - −4: the Drowned Vault's niches of offerings, chained reliquaries.
    - −5: a ritual circle of roots round the Cradle.
  - *Sounds*: a hymn too faint to place; water through stone; the Colossus's heartbeat.
  - *Encounters*: the bell puzzle and lectern riddle [Q2]; the Colossus; the Rootwyrm's cone.
  - *Hidden*: a Thorn-hand Margin Note per floor; a sealed door below −5 (the Rootcradle Below, the Graft Crown).
- **Rootglass, Mossharbor, Thornwick** (safe light).
  - Rootglass: lamps on every boardwalk, the Bole's warm hollow.
  - Mossharbor: nets drying, the moss-sailed sloop.
  - Thornwick: the herbalist's jars.

### 8.4 Umbral Marches (Act III: fog, lanterns, what carries one)
- **The wilds**: the Gloaming Shore, Gloaming Fen, Black Meres, Deep Fen, Drowned Ruins.
  - *Who and what*: the drowned abbey town's land, sinking for generations. Mire Lurkers wear lantern-lures; Lantern
    Wisps are lost flames; the Drowned Knights still patrol.
  - *Mood*: fog everywhere, thinning round light (built). Violet-grey, black water, single warm lanterns.
  - *Dressing*:
    - lost lanterns on posts in the Deep Fen;
    - abbey slabs half under the bog;
    - name-tags on wicks;
    - a pilgrims' boardwalk with Cant prayer-boards (*lum vesh*: "light, seek");
    - the Sunken Belfry's roof above the water.
  - *Sounds*: frogs; a bell under water; a voice calling a name, once.
  - *Hidden*: the Lantern Ring (Seam Eater 55); the Gloam Shrine; the Sunken Belfry (campaign #3).
- **The Drowned Crypts** (−1 the Flooded Nave, −2 the Sunken Cloister, −3 the Abbess's Chapel).
  - *Who built it, why it fell*: the abbey's crypts. The water came in through the floors; the guard marched down; the
    abbess stayed at her prayers.
  - *Mood*: **good already**: lanterns only, fog .35–.45. Add more dark between lanterns, not more light.
  - *Dressing*:
    - silted pews;
    - the sisters' cells with sandals in rows (the Drowned Abbey set's source);
    - ink stains on every wall (the Abbess's writing);
    - a cage of drowned books;
    - the altar island with a censer chain.
  - *Sounds*: lapping water; a censer swinging; a page turning.
  - *Encounters*: the cloister walk; the Abbess's ink wave.
  - *Hidden*: the Lamplighter's Things chest (−2); a sealed door to −4 (the Ink Deeps).
- **Gloamhaven, Mirewatch, Lanternfen** (safe light).
  - Gloamhaven: lantern posts that never go out; the Great Lantern.
  - Mirewatch: Corvane's hand-lit pier.
  - Lanternfen: nine lanterns on the green (campaign #3).

---

### 8.5 Connector caves (planned, 2026-10-26; full briefs in `docs/design/world-acts.md` §1)
- **The Kiln Tunnels** (Reach, 12–14). *Built by* the charcoal burners to haul under the orc raids; *fell* when the clans
  found them and the burners bricked their end. *Lair*: Cinder Imps in cold kilns, Ash Ghouls (burners who never came
  up). *Mood*: soot-black, one cold kiln-glow per chamber. *Dressing*: cart rails, "BURNERS ONLY" chalked on a bricked
  arch, a cart tally that stops mid-week. *Sounds*: a cart rolling with nobody pushing it. *Puzzle*: the rail junction.
  *Hidden*: a lunch tin with a Margin Note scrap; a chest behind the arch, opened from the far side.
- **The Glass Throat** −1…−2 (Reach, 17–19). *Built by* nobody: a lava tube cooled to glass. *Lair*: Glass Sentinels
  that lost the way home to the Foundry. *Mood*: your light comes back from every wall, and shows doubles. *Puzzle*:
  −2's mirror hall, where only the Sentinel Glim does not dim beside is real. *Hidden*: a cache that shows only with
  your light shuttered.
- **The Bog Galleries** −1…−2 (Marches, 35–38). *Built by* Gloamhaven's peat-cutters, who cut fuel for the lanterns;
  *fell* when they flooded the year the abbey drowned. *Lair*: Ink Hounds on the cutters' scent, Mire Lurkers. *Mood*:
  peat-brown, empty lantern-hooks you can light (Firemaking). *Puzzle*: sinking peat blocks on −2. *Hidden*: a cutters'
  cache with a Margin Note scrap in Veil's hand.
- **The Sunken Belfry**, upper half (Marches, 30–32): the abbey's bell-tower lying on its side under the water. Its
  louvres are the floor now. The fifth bell's door stays sealed (campaign #12).

## 9. Open threads and planted clues

| Thread | Planted (where) | Pays off |
|---|---|---|
| **The sixth tally mark** | five marks at Keeper height; Ember Mine −3 / Ninefold Stones (campaign #1); a fresh mark in each act-boss room | Finale: carve it or leave it blank (Seam Stance) |
| **The forty-first grave / Barrow Doors 2–5** | the Sexton's Count; four sealed keyholes in the vault | one door per act: the erased witnesses each act uncovers |
| **What drinks the heat** | Ysolde Marr's forges; frost-glass; cold anvils | Act I: the Sovereign banked heat to keep the seam shut; Realm 1 the Cold Anvil |
| **The smoke leans** | Odette Pryor | she becomes the forecaster: first the weather (her board shows the next two windows, world-acts.md §3.6), then the eclipse's lean |
| **The sea is warmer** | Netter Pell, Odd Tarn ("since the second tally"), Sunny Pell | the Burning Sea is the Godforge's cooling bath (Act IV/V) |
| **Wanewalkers** | lore page; the Hollow Choir; Odric Hale [Q2]; the Sailing Board's eclipse lamp | Realm 6 the Hush Beneath; the fifth calling |
| **Who brews the Rejuvenations / the Lamplighter's Things** | potion lore; five shade chests; "For whoever comes next" (campaign #3) | the Lamplighter Below, Act III |
| **The tree that wears a lantern** | Ilsa Fenn's line [Q2]; copied trees | Act II: the Graft Crown, Realm 2 the Wrong Wood |
| **The fog thins round something else** | Old Corvane | Act III: the Second Lantern |
| **Kael's eye and hand** | "when the anvil rings on its own" | Finale: the anvil rings when the fifth Seal is laid on it |
| **The Archive's struck names** | Odric, the Choir, the Wanewalkers | Act IV: the Archivist publishes the struck roll (their own first name last) |
| **The Watch's hammer "struck by five"** | Brannoc Vey [Q2]; the Hammer of the First Watch | the Ashguard calling quest: re-swear the oath "struck by six" |
| **Glim's first lamp** | Glim's margin tales | Finale egg (unchanged) |
| **Doors in the dark** | sealed doors in the Ashen Crypt, Temple below −5, Drowned Crypts below −3; the Relief Column's chalked last name (night event) | Graft Crown, Ink Deeps, Ashguard quest |
| **The Late Shift** (night event, the Ember Mine head) | six lamp-lights walk up out of the shaft and go out at the fence: "Shift done. Nobody signed us out." | campaign #1 The Beacon Goes Down: the beacon leans down the shaft because something below is still working |
| **The Ossuary Watch badge** | dropped by the Last Siege (1 in 3) | campaign #11 Barrow Door 2 |
| **The copy-seed** | the Walking Tree (Greenwood night event) | campaign #7, the Graft Crown |
| **The bell-clapper and the bell under the water** | the Dusk Hymn (Sunken Courts); the Bell Under the Water (eclipse, the Black Meres); a ringer's glove: "Pull on four. Never on five." | campaign #12 Who Rings Under the Water |
| **A Voice Calls a Name** | the Deep Fen: on the third night it calls the Keeper's own name | a personal fixed light; ties to Old Corvane's lanterns (Act III) |
| **The world counts** | PvP marks; Wren cuts a tally for every Red Keeper | the Tally Hall (Realm 7) may read the PvP counts; DM to decide when it is built |

---

## 10. Open contradictions

Each entry lists the sides, the proposed fix, and who decides. "DM" means lore that is pre-approved: the builder
applies it. "Owner" means it touches an owner-locked name or system.

**C-01. What the Four did.** Two accounts of one event:
- the lock: world-and-cast.md:131-142;
- the banking: lore-addendum.md:233-248, and also delve-and-beyond.md:83/153 (Cindergnaw felled the pillars).

*Fix (DM)*: both happen, in order (§1.2): lock, then banking. Cindergnaw is the tool the Four used. Add one line to
lore-addendum: "The lock held badly; the four who signed it went down to bank what it could not hold."

**C-02. "First eclipse" is a hundred years ago and also three hundred** [Q2]:
- wt-quests2 `chains/forgotten-hammer.ts:15` says Odric took the hammer into "the first eclipse";
- quests2 `docs/world/lore-addendum.md` (the Hammer entry) and the quests2 design-bible addition repeat it ("Both tie
  the Wanewalkers to the first eclipse");
- `chains/forgotten-hammer.i18n.ts:10` and the door line at :77 date Odric to "a hundred years";
- `chains/hollow-choir.i18n.ts:47` puts the Choir in the first eclipse, "three hundred years" back.

*Fix (DM)*: the Choir owns the first eclipse. Odric went into "an eclipse, a hundred years ago". Change the
forgotten-hammer.ts header and the two quests2 doc lines to "into an eclipse to quench it in the seam". The player text
already says "the eclipse".

**C-03. "Three hundred years" against the live calendar.** `hollow-choir.i18n.ts:10`, :70 and :73 say three hundred
years. The Slate's Year count (world-clock.model.ts:27-35) passes 300 in December 2026, which would put the first
eclipse *after* the Held Seam.

*Fix (DM)*: replace "for three hundred years" with "for longer than the years have been counted"; ES "desde antes de
que se contaran los anos". The beat-time line becomes "from longer than anyone has counted".

**C-04. The finale boss's name.** world-and-cast.md:349 says "The Unanimous"; design-bible.md:172 and
realms-endgame.md:121 say "The Unbound Pattern".

*Fix (DM)*: the Unbound Pattern. "The Unanimous" survives as the Pattern's phase-2 title.

**C-05. Who split the world.**
- `shared/rpg/unique-items.ts:441` says the Nameless is "the founder, the builder, the one who split the world".
- world-and-cast.md (the Nameless section) says it is the Godforge's own tally, not an enemy.
- §1 says the Godforge let go along the Keepers' line.

*Fix (DM)*: reword unique-items.ts:441 to "the one who was there when the world split, and counted". This keeps the
mystery without a second cosmogony.

**C-06. Ember Isle's band.** It is 1–10 in world-map.md:15/29 and `td-zones.ts:35-52` (the Ashfields are 7–10). It is
1–8 in design-bible.md:166, realms-endgame.md:73/115 and leveling.md:46.

*Fix (DM)*: 1–10 (the code). Edit the three docs.

**C-07. Kael's left hand.**
- `unique-items.ts:433`: "consumed when he shook hands with the Godforge to seal a covenant".
- world-and-cast.md (Act III beat 1): he lost it holding the crack open for a witness.

*Fix (DM)*: the witness version (§1.2). Reword :433 to "the original was lost holding the crack open for someone who
had to get out".

**C-08. Which Four?** Kael's Four (the signing Keepers, the Underhearth) against the Forge of the Four's smiths
(`maps/forge-of-four.ts:3-5`; [Q2] the ring/wedge/tongs/flame marks).

*Fix (DM)*: the Forge's Four is a guild of four masters named for the four signers (§1.3 item 9). No code change. Add
one line to the forge-of-four.ts header comment.

**C-09. Two hammers.**
- `boss-uniques.ts` *Hammer of the First Watch*: "Four smithies. One hammer they all agreed on."
- [Q2] `forgotten-hammer.i18n.ts:19` says Odric "carried their hammer into the eclipse", then "That is his hammer".

*Fix (DM)*: Odric carried the **Watch's oath-hammer** (the Hammer of the First Watch) in, and it came back. The
**Unsigned Hammer** is his own. Change the return line to "He carried the Watch's hammer into the eclipse for them and
came back thin… This one is his own, and nobody alive signed it."

**C-10. Two harbourmasters in Cinderport.**
- `shared/town-tasks/town-tasks.model.ts:79` and `maps/cinderport.ts:58` have Harbourmaster Tamsin Coyle.
- `play/td/td-harbour.ts:31` has Marit Salt at the board.

*Fix (DM)*: retitle Coyle **Portwarden Tamsin Coyle** (she clears what docks; Marit sells passage). This changes the
title only, in town-tasks.model.ts:79 and the ES `who` line. Also add the missing **Salted Ember tavern-keeper** (Marit's
sister, **Bryony Salt**) as a flavour keeper.

**C-11. Ember Isle, the Umbral band and the Forge's floors in the docs.**
- Umbral is 25–50 in design-bible.md:169, realms-endgame.md:76/118 and leveling.md:47, but 26–50 in code.
- The Forge of the Four is "−1…−4" in world-map.md:15 but 3 floors are built.
- The Drowned Crypts are "−1…−6" in world-map.md:17 but 3 floors are built.

*Fix (DM)*:
- Umbral is 26–50.
- Mark the unbuilt floors "(−4 planned)" and "(−4…−6 planned)".

**C-12. The Archivist's pronoun.** world-and-cast.md:531-555 says they; lore-addendum.md:1408 says him;
lore-addendum.md:1449-1451 says she; `seamworks-square.ts` (stall blurb) says "He silences".

*Decided (owner, 2026-10-22)*: **they**. Still to apply in code: `seamworks-square.ts:121` "He silences" → "They
silence what whispers." (lore-addendum lines are history and stay).

**C-13. The Graft Crown's floor.** It is at "Rootcradle −6" in design-bible.md:168 and realms-endgame.md:117, but the
temple ends at −5, the Rootcradle (`maps/overgrown-temple.ts`; world-map.md:31).

*Fix (DM)*: the Graft Crown waits in **the Rootcradle Below**, a −6 floor reached through a sealed root-door in the
Rootcradle. Reword both docs.

**C-14. A Cant root as a name.** Woodward **Hesk** Ashby (`town-tasks.model.ts`; lore-addendum.md:1730) uses *hesk*
(hearth, mending).

*Fix (DM, low)*: grandfather it with a line: Ashgrove names its children for the hearth. No new Cant-root names (§7.5).

**C-15. The Merchant buys.** "Nobody has ever seen the Merchant buy anything" (`npc-quest.model.ts:469`) against "Sell
me what you do not want" (`npc.model.ts:611`).

*Fix (DM)*: give the :611 line to Lune Coyne (the Croupier buys for the Merchant), or reword it to "Leave what you do
not want on the scale. I will weigh it."

**C-16. Spanish place names.** `play/harbour/harbour.i18n.ts:8-17` translates them (Isla Brasa, Pirohold, Puerto
Ceniza…); everywhere else keeps English (`td-prologue.i18n.ts:47` "Ember Isle").

*Decided (owner, 2026-10-22)*: place names stay English in every language; the board's Spanish may stand only as a
subtitle. Still to apply: `harbour.i18n.ts:8-17`.

**C-17. "Realms" in player text for the lands.** `shared/lore/lore.i18n.ts:6` says "Pages the realms have told you",
and `play/lobby/lobby.i18n.ts:7` says "Waking the realm...". Both break the owner's naming decision
(realms-endgame.md:12-16).

*Fix (DM, the decision is already made)*: "Pages the world has told you" / "Paginas que el mundo te ha contado"; "Waking
the world..." / "Despertando el mundo...".

**C-18. "A handful of Keepers."** The Wanewalkers are "a handful of Keepers" in `shared/lore/lore.i18n.ts:11`, but the
Choir (priests) and Odric (a smith) are Wanewalkers too [Q2].

*Fix (DM)*: "a handful of people (priests, smiths, Keepers) walked into the eclipse instead of away from it."

**C-19. Two cowls from Wren.** `town-tasks.i18n.ts:42` (task `seam-wren-2`) says "the cowl I found among them" and
rewards a Keeper's Cowl iL8. The Sexton's Count says his own cowl lies on the forty-first grave.

*Fix (DM)*: reward `seam-wren-2` with the **Barrow-Keeper's Gloves** instead ("gloves I found among them"), or reword
the line to "a gravedigger's cowl, not mine".

**C-20. Hollis × 2, Fenn × 2, Hale × 2.**
- Hollis Fenn (courier, lore-addendum.md:1225) against Hollis the Row-Walker (`play/td/td-sexton.ts:34`).
- Ilsa Fenn against Hollis Fenn.
- Hale Dross against Odric Hale [Q2].

*Fix (DM)*:
- Rename the legacy courier **Corwin Ridge** (unplaced, no shipped player text in the top-down game).
- Make the Row-Walker **Hollis Vane**, brother to Tobias Vane on the stone. This adds a Barrow family.
- Rename the quartermaster **Hale Dross → Garrick Dross** in td-harbour.ts / harbour.i18n.ts. Odric's surname is the
  story's.

*Decided (owner, 2026-10-22)*: Garrick Dross and Hollis Vane approved. **Still to apply in code** (2026-10-26):
`play/td/td-harbour.ts:30` (`harbourmaster-hale-dross`, 'Hale Dross') and `play/td/td-sexton.ts:34` ('Hollis the
Row-Walker').

**C-21. Rune counts in comments.** `shared/rune-forge/rune.model.ts:2` says "twenty-five runes"; there are 22.
`shared/rpg/boss-uniques.ts:5` says "ten", while :71 and :155 say "nine"; there are 10, and 12 with [Q2].

*Fix (builder)*: comments only.

**C-22. Missing creature profiles.** `shared/loot/creature-families.ts` lacks ash-wolf, cinder-imp, lava-hound,
obsidian-golem, ember-warden, magma-tyrant, the-uncounted and seam-eater-risen; the Hollow Cantor [Q2] is also missing.
So the Uncounted is not `boss`, and it fails the Lanternwright's "dead and dark-born" check (`play/td/td-lantern.ts:15-22`).

*Fix (builder)*: add profiles. The Uncounted and the Hollow Cantor are `bone`/`shade`. Cinder Bailiff's level is 6 in
the profile (`creature-families.ts:73`) but 3 in `td-mobs.ts`; use 3.

**C-23. Task levels below their floors.** `town-tasks.model.ts:119` verd-tull-1 is 20 against Hall of Roots 27–29;
`:103` pyre-marr-2 is 12 against Glass Halls 15–17; `:112` ash-hesk-1 is 9 against the Ossuary 14–17.

*Fix (builder)*: raise the pitched levels to each floor's low end.

**C-24. Retired systems still described as current.**
- design-bible.md:416-417 (Spellstones "at the Rune Forge stall") and :788-803 (Kael's Quench "Rune up").
- world-map.md:74/106 (stalls "rune forge … crafting").

*Fix (DM)*: per §6.2, once the Rune Forge and bench are removed, edit these to "enchanting, vault, vendor, smith".

**C-25. The Umbral sea is named "The Burning Sea".** `maps/umbral-marches.ts:240` copies the name. It is correct: one
sea joins all lands (§2). No fix. Logged so nobody "fixes" it.

**C-26. The Lamplighter's set source text.** `shared/rpg/set-items.ts:75` says "shade chests of the five crypts and
mines", but only three are crypts or mines.

*Fix (DM)*: "the five shade chests in the dark places of four lands".

**C-27. Legacy act structure.** world-and-cast.md:172-178 has Act I in the Delve and Act II as the Five Witnesses.
design-bible.md:164-172 and realms-endgame.md:111-121 have one act per land.

*Fix (DM)*: the land acts are canon (§1.4, campaign.md). Add a banner at the top of world-and-cast.md and
delve-and-beyond.md: "Legacy layer: see docs/world/canon.md for what is current."

**C-28. Item loss on death, rejected and now asked for.** design-bible.md:100 lists "Full-loot or item-loss death
(Tibia red skull, D2 hardcore)" under *What we reject*. The owner asked on 2026-10-26 for Tibia-style PvP with loot on
death.

*Fix (DM, decided)*: the owner's newer ask wins, inside the cozy contract. Only a **death to a Keeper** drops a bag.
Only a **Red Tally or Struck** Keeper loses worn pieces. Story items are never lost, and nothing is lost under level 20
or on Ember Isle (world-acts.md §6). Reword design-bible.md:100 to "Full loot for everyone (D2 hardcore) | kills the
cozy contract | bags only from deaths to a Keeper; worn items only from the counted (Red Tally, Struck)".

**C-29. The skill rules in skill-trees.md.** skill-trees.md "Rules" (tiers 1 · 6 · 12 · 18 · 24, a prerequisite chain,
standalone passives) and design-bible.md §4.3 (Last Light as a tier-5 skill) describe the board that skills-100.md and
skill-book.md replace. Also stale: spellstones.model.ts:15-16 ("Stones live in the Keeper's stone pouch … not the
satchel") and design-bible.md §5.1.

*Fix (builder, when the book ships)*: put a banner on skill-trees.md, "Superseded by skills-100.md and skill-book.md for
the book's rules; the shipped numbers stay here." Update the spellstones header comment.

**C-30. Monster auras' math.** monsters-abilities.md first said a pack aura uses "the same math" as a Keeper's. Its own
table uses different numbers (Conviction −(10 + 3/L), max −60, against the Keepers' −(20 + 4/L), max 85).

*Fix (DM, applied 2026-10-26)*: "same names and effects, with its own pack coefficients".

**C-31. The Lanternwright heals only herself in code.** `play/td/td-lantern.ts` and `td-lantern-skills.ts`: Hearthlight
and the Hearth Circle mend the Keeper only. Canon §4.2 now makes the Lanternwright the party's healer.

*Fix (builder)*: skills-100.md §3, ally targeting (campaign §4 S3). It is not a lore contradiction, but a role the
code must catch up to.

