# World acts — long lands, weather, fish, the dark, and PvP (design)

Kept by the Dungeon Master. Written 2026-10-26 on branch `dm-design`. Builders implement from this page.
Read it with `docs/world/canon.md` (§3 places, §8 zone bible), `docs/design/world-map.md`, `docs/design/online.md`
§4d (the room) and `docs/design/realms-endgame.md` §3.9 (Tibia-style death). Where this page and canon disagree, canon
wins and the builder reports it.

Owner and player notes this answers:
- "Bigger maps, like D2 Act 1. It is long, caves link the sections, and at the end a boat or an NPC takes you to the
  next zone."
- "Weather: thunderstorms, rain, fog. Fish visible in the water. Scary zones and scary activities in the dark."
- "PvP is Tibia-style: anyone can attack anyone, anytime."

**House mood (canon §8).** The wild is the edge of the light. Dungeons are a dark tabletop dungeon. Towns and hearths
are safe light. Every dread has an exit, no jump-scares, no gore, dark-born never ambush.

---

## 0. Units and the numbers every section uses

| Thing | Value | Source |
|---|---|---|
| Tile | 16 art px | `td-art.ts TILE` |
| Block (one map character) | 8 × 8 tiles | `maps/ember-isle.ts BLOCK` |
| Keeper walking pace | 74 art px/s, about **4.6 tiles/s** before Move Speed | `td-engine.ts SPEED` |
| Section size (a surface section) | **36–44 × 22–28 blocks** (about 290–350 × 180–220 tiles) | this page |
| Path through one section, road to road | 330–420 tiles, about **75–90 s** of walking | this page |
| Act, town to last dungeon door, no fighting | **12–15 min** (Ember Isle about 5 min: it is the doorstep) | owner, D2 Act 1 |
| Cave connector | 1–2 floors, each about 60–90 × 40–60 tiles, 30–45 s to cross | this page |

**Area ids.** The room (online.md §4d) runs one `RoomWorld` per area, at most 48 creatures sent to each Keeper. A long
land therefore splits into **sections, one area each**: `<land>:<section>` (for example `infernal-reach:charwood`). The
old single-area continents keep working until a land is re-drawn; when it is, its region keys (`infernal-reach:f`)
become section keys and `td-zones.ts ZONES` gains one row per section. A section boundary is a **seam line**: a road
gate, a ford, a pass or a cave mouth, always drawn as a place you walk through (never an invisible wall). Crossing it
loads the next area with a 0.4 s fade (the route veil), and the Keeper arrives 6 tiles inside, on the road, with no
creature within 8 tiles (the arrival rule, world-map.md).

**Waystones.** Every section has one **Waystone** (a discovered waypoint, one-world.md:428-432 lore: "a stone that
remembers who touched it"). Touching it once records it on the Atlas; any Waystone then travels to any other recorded
one on the same land for free, and to the capital's for free from anywhere on the land. The Waystone Hall (endgame) is
not these; these are the land's own. Waystones stand on safe ground (r3, no PvP, no spawns), lit by one lamp.

**Caves as connectors.** Every land has at least two caves that are the *only* way between two sections (D2's
Underground Passage), plus side caves that are dead ends with a reward. A connector cave is a dungeon floor with its
own band and zone-bible entry (§1 below gives the brief).

**The end of an act.** Each land ends at its harbour, where the Harbourmaster (canon §3.3) sails on, story-locked by
the act boss. The lock is soft-warned, hard-gated: the board shows the ship and says what must fall first.

---

## 1. The act maps, land by land

Every section row gives: **area id** · name · band · size in blocks · Waystone · the way in and the way on · what it
is for. Bands are the shipped ones (`td-zones.ts`); new sections fit inside their land's band.

### 1.1 Ember Isle — Prologue (1–10), one area, grows to 40 × 30 blocks

Ember Isle stays **one area** (`ember-isle`, the room's M1 area, already live). It is the doorstep, not an act: it grows
from 32 × 25 to **40 × 30 blocks** (320 × 240 tiles) so the walk from the square to the Ashfields is about 5 minutes,
and the Slagstone Cave becomes the island's first connector.

```
 [Ember Harbour]                                         [Ninefold Stones]
       |                                                        |
 SEAMWORKS == Cinder Meadows == the Emberwood ==(Slagstone Cave)== Slagstone Hills
   (safe)        1-2              2-4         3-5 connector         3-5
       |                                                        |
  Ember Coast / Ashwater Lake 1-2              Deep Emberwood 4-6 == the Barrow Road 5-6 == the Ashfields 7-10
                                                                       (Hushed Barrow)          (Ember Mine -1..-3)
```

| Section (part of `ember-isle`) | Band | Blocks | Waystone | In / on | For |
|---|---|---|---|---|---|
| Basalt Seamworks | safe | 8 × 6 | the square's | harbour pier; meadow road | town |
| Cinder Meadows, Ember Coast, Ashwater Lake | 1–2 | 14 × 10 | **the Meadow Stone** (by the first fence) | the square; the Emberwood's edge | first fights, first fishing spots |
| The Emberwood | 2–4 | 10 × 8 | **the Woodcutter's Stone** | meadow road; Slagstone Cave's west mouth | trees, wolves |
| Slagstone Cave (connector, 1 floor) | 3–5 | 64 × 40 tiles | none (a cave) | the Emberwood; Slagstone Hills | **the only way east** once the Hills road is walled by the new rockslide |
| Slagstone Hills | 3–5 | 10 × 8 | **the Rockslide Stone** | the cave's east mouth; the Deep Emberwood path | ore, the Ninefold Stones |
| The Deep Emberwood | 4–6 | 10 × 8 | none (it is a short wood) | the hill path; the Barrow Road | the first dread: dusk all day |
| The Barrow Road | 5–6 | 8 × 6 | **the Sexton's Stone** (by the lych-gate) | the wood; the Ashfields | the Hushed Barrow, the Sexton's Count |
| The Ashfields | 7–10 | 12 × 10 | **the Slag-Cart Stone** | the Barrow Road; the Ember Mine head | the mine, the gate boss |

- **The rockslide.** A new boulder field closes the old Hills road. Glim, on first sight: "The hill came down in the
  night. There's a way under it." / ES "La colina se vino abajo de noche. Hay un camino por debajo." Slagstone Cave's
  far chest (canon §8.1) now sits *on* the route: the cave is not optional.
- **End of the Prologue.** Odd Tarn at Ember Harbour sails to Pyrehold; locked until the **Ember Warden** falls (canon
  §3.3, shipped). Walking time, square to the mine head: **about 5 minutes**.

### 1.2 Infernal Reach — Act I (8–30), nine sections

The Reach becomes a long road north and west from Pyrehold, then back east over the mountains to the Molten Deep, as
D2's Act 1 runs from the camp to the monastery. Today's single 40 × 15-block continent becomes nine section areas.

```
 Pyrehold Harbour (Garrick Dross: ships to Mossharbor, Mirewatch, Ember Isle)
      |
 PYREHOLD == Cinder Steppe == Ashen Shore/Glasswater
  (safe)       8-11              8-10
                 |
 Ashgrove == the Charwood ==(the Kiln Tunnels)== the Deep Charwood
 (village)     10-13          12-14 connector       13-16
                                                     |
 Cinderport (village, Marit Salt)          Obsidian Badlands ==(the Glass Throat)== the Molten Fields == the Pyre Peaks
   (on the Steppe's south-east road)          15-18           17-19 connector         18-21              19-22
                                               |                                                          |
                                      Forge of the Four -1..-3                      the Bastion Road 20-22 -> Ashen Bastion
                                                                                    (Ashen Crypt -1..-2)  -> the Caldera Rim 21-22
                                                                                                             -> Molten Deep -1..-6
```

| Area id | Section | Band | Blocks | Waystone | In / on | For |
|---|---|---|---|---|---|---|
| `infernal-reach:pyrehold` | Pyrehold | safe | 12 × 9 | the plaza's | harbour; north gate | capital |
| `infernal-reach:steppe` | the Cinder Steppe | 8–11 | 40 × 24 | **the Watch Cairn** (a brass-plaqued cairn) | Pyrehold's north gate; the Charwood road; the Cinderport road; the shore path | the act's moor: wolves, imps, the first orc scouts |
| `infernal-reach:shore` | the Ashen Shore and Glasswater | 8–10 | 36 × 22 | **the Glasswater Stone** | the Steppe's shore path (a dead-end section) | fishing, Drowned-glass shells, the side cave |
| `infernal-reach:charwood` | the Charwood | 10–13 | 40 × 26 | **the Kiln Stone** | the Steppe road; Ashgrove sits on its west edge; the Kiln Tunnels | charcoal wood, Ash Wolves, the Woodward's work |
| `kiln-tunnels-1` | **the Kiln Tunnels** (connector, 1 floor) | 12–14 | 80 × 50 tiles | none | the Charwood's kiln-mouth; the Deep Charwood | the charcoal burners' haul-tunnels; **the only way into the Deep Charwood** |
| `infernal-reach:deep-charwood` | the Deep Charwood | 13–16 | 40 × 26 | **the Clan Stone** (an orc totem with a Watch plaque nailed over it) | the Tunnels' far mouth; the Badlands pass | orc camps |
| `infernal-reach:badlands` | the Obsidian Badlands | 15–18 | 44 × 26 | **the Spill Stone** | the pass; the Forge of the Four's gate; the Glass Throat | Firecaller circles, the Forge |
| `glass-throat-1`, `glass-throat-2` | **the Glass Throat** (connector, 2 floors) | 17–19 | 70 × 50 tiles each | none | the Badlands' obsidian fissure; the Molten Fields | a lava-tube of black glass; **the only way to the Fields** |
| `infernal-reach:molten-fields` | the Molten Fields | 18–21 | 42 × 26 | **the Drake Stone** | the Throat's exit; the Peaks' switchbacks | drakes, lava rivers |
| `infernal-reach:pyre-peaks` | the Pyre Peaks and the Bastion Road | 19–22 | 40 × 28 | **the Pyre Stone** (by the Ring of Pyres) | the switchbacks; the Ashen Bastion; the Caldera Rim (the Molten Deep's mouth) | the high road, the Ring of Pyres, the Crypt, the Deep |

- **Cinderport and Ashgrove.** Cinderport is a village on the Steppe's south-east road (its own small area,
  `infernal-reach:cinderport`, 10 × 8 blocks, safe, with its harbour); Ashgrove is a village on the Charwood's west edge
  (`infernal-reach:ashgrove`, 8 × 6, safe). Both have a Waystone and a hearth.
- **The Kiln Tunnels** (zone brief). *Who built it, why it fell*: the charcoal burners' haul-ways, cut so the carts
  could reach Pyrehold under the orc raids; the clans found them and the burners walled their end. *Lair*: Cinder Imps
  in the old kilns, Ash Ghouls (burners who never came up). *Mood*: soot-black, one cold kiln-glow per chamber.
  *Dressing*: cart rails, sacks of charcoal gone to dust, a bricked-up arch with "BURNERS ONLY" in chalk, a tally of
  carts on a post that stops mid-week. *Sounds*: a cart rolling somewhere with nobody pushing it; ticking brick.
  *Encounter*: a rail junction room where carts roll down two slopes (step off the rails in the tell: 1.0 s rumble).
  *Hidden*: a burner's lunch tin with a Margin Note scrap; a chest behind the bricked arch (it opens from the far side
  once you have walked round).
- **The Glass Throat** (zone brief). *Who built it*: nobody: a lava tube that cooled into glass the colour of the
  Forge's spill. *Lair*: Glass Sentinels that walked out of the Foundry and lost the way home; Slag Crawlers.
  *Mood*: the Keeper's own light reflected back from every wall (light here goes *twice as far*, but shows
  doubles); dark red at the floor cracks. *Dressing*: footprints fused in the glass floor going *in*; a Firecaller's
  ritual ring on −1 with *vael dra* cut, half melted. *Sounds*: glass pinging as it cools; your own steps echoed a
  half-second late. *Encounter*: −2's mirror hall, where every Sentinel has a reflection and only the one Glim does
  not dim beside is real (canon: Glim dims beside false things). *Hidden*: a cache behind a wall of glass that shows
  your reflection without a light (unlit, it shows the chest).
- **End of Act I.** Garrick Dross at Pyrehold Harbour sails to Mossharbor (the Verdant Wilds), locked until the
  **Cinder Sovereign** falls (canon §3.3). Walking time, plaza to the Caldera Rim: **about 13 minutes**.

### 1.3 Verdant Wilds — Act II (15–40), eight sections

The Wilds run from Mossharbor's south shore north through the jungle to the temple, with a river crossing and the Root
Hollows as the connector under the Deep Wilds.

```
 Mossharbor (Sunny Pell: the sloop to Mirewatch; the sloop to Pyrehold)
     |
 the Mossy Shore == the Fernglades == ROOTGLASS (safe; Thornwick hamlet on the Fernglades' east road)
    15-17              15-17
                         |
                 the Rootwater Ford == the Glassmere
                     16-18              16-18 (dead end, fishing)
                         |
                   the Greenwood ==(the Root Hollows -1..-3)== the Deep Wilds == the Sunken Courts == Overgrown Temple -1..-5
                     17-20           19-25 connector             21-25            24-28
```

| Area id | Section | Band | Blocks | Waystone | In / on | For |
|---|---|---|---|---|---|---|
| `verdant-wilds:shore` | the Mossy Shore | 15–17 | 36 × 22 | **the Net Stone** | Mossharbor; the Fernglades | landing, crabs of moss |
| `verdant-wilds:rootglass` | Rootglass | safe | 12 × 10 | the boardwalk's | the Fernglades | capital |
| `verdant-wilds:fernglades` | the Fernglades | 15–17 | 40 × 24 | **the Bell-Post Stone** (a priests' bell-post, no bell) | the Shore; Rootglass; Thornwick; the Ford | the act's moor |
| `verdant-wilds:rootwater` | the Rootwater Ford | 16–18 | 40 × 24 | **the Plank Stone** | the Fernglades; the Glassmere; the Greenwood | the river crossing |
| `verdant-wilds:glassmere` | the Glassmere | 16–18 | 32 × 22 | **the Mere Stone** | the Ford (dead end) | fishing, the side cave |
| `verdant-wilds:greenwood` | the Greenwood | 17–20 | 42 × 26 | **the Copy-Tree Stone** (between two identical trees) | the Ford; the Root Hollows' mouth | copied trees, Harts |
| `root-hollows-1..3` | **the Root Hollows** (connector, shipped floors) | 19–25 | as shipped | none | the Greenwood's root-mouth; **a new exit on −3** up into the Deep Wilds | the only way into the Deep Wilds |
| `verdant-wilds:deep-wilds` | the Deep Wilds | 21–25 | 44 × 28 | **the Heartroot Stone** | the Hollows' new −3 stair up; the Courts' steps | noon is dusk |
| `verdant-wilds:courts` | the Sunken Courts | 24–28 | 40 × 26 | **the Pillar Stone** | the Deep Wilds; the Overgrown Temple's stepped gate | ruins, the Ring of Thorns |

- **The Root Hollows become a connector.** Floor −3, the Heartroot Cellar, gains a second stair: a root-ramp up into
  the Deep Wilds' heart. The Greenwood's road to the Deep Wilds is grown shut with a thorn hedge that no blade cuts
  (inscription on a cairn: "The wood closes what it forgets." / ES "El bosque cierra lo que olvida.").
- **End of Act II.** Sunny Pell at Mossharbor sails to Mirewatch (the Umbral Marches), locked until the **Elder
  Rootwyrm** falls (canon §3.3; later the Graft Crown). Walking time, Mossharbor to the temple gate: **about 14
  minutes**.

### 1.4 Umbral Marches — Act III (26–50), eight sections

The Marches run from Mirewatch's pier through the fen to the drowned abbey, on boardwalks that sink and come back. The
fog (built) stays on every section; weather adds to it (§3).

```
 Mirewatch (Old Corvane: the boat north, to Frostgate, when Act IV is built)
     |
 the Gloaming Shore == the Gloaming Fen == GLOAMHAVEN (safe, fog .55; Lanternfen village on the Fen's north road)
     26-28              26-29
                          |
                   the Pilgrims' Boardwalk ==(the Sunken Belfry, 1 floor)== the Black Meres == the Deep Fen ==(the Bog Galleries, 2 floors)== the Drowned Ruins == Drowned Crypts -1..-3
                        28-30                 30-32 connector               29-32          32-36       35-38 connector                 37-41
```

| Area id | Section | Band | Blocks | Waystone | In / on | For |
|---|---|---|---|---|---|---|
| `umbral-marches:shore` | the Gloaming Shore | 26–28 | 36 × 22 | **the Corvane Stone** | Mirewatch; the Fen | landing |
| `umbral-marches:gloamhaven` | Gloamhaven | safe | 12 × 10 | the square's | the Fen | capital |
| `umbral-marches:fen` | the Gloaming Fen | 26–29 | 40 × 24 | **the Wick Stone** | the Shore; Gloamhaven; Lanternfen; the Boardwalk | the act's moor |
| `umbral-marches:boardwalk` | **the Pilgrims' Boardwalk** (new) | 28–30 | 40 × 22 | **the Prayer-Board Stone** | the Fen; the Sunken Belfry | the pilgrims' road to the abbey, half sunk; *lum vesh* boards |
| `sunken-belfry-1` | **the Sunken Belfry** (connector, 1 floor) | 30–32 | 70 × 50 tiles | none | the Boardwalk's broken end; the Black Meres | the abbey's bell-tower, lying on its side under the water; **the only way past the broken boardwalk** |
| `umbral-marches:meres` | the Black Meres | 29–32 | 42 × 26 | **the Mere-Lamp Stone** | the Belfry; the Deep Fen | black water, Mire Lurkers |
| `umbral-marches:deep-fen` | the Deep Fen | 32–36 | 42 × 26 | **the Lost-Lantern Stone** | the Meres; the Bog Galleries | lost lanterns on posts |
| `bog-galleries-1`, `bog-galleries-2` | **the Bog Galleries** (connector, 2 floors) | 35–38 | 80 × 50 tiles each | none | the Deep Fen's peat-cut; the Drowned Ruins | the peat-cutters' galleries under the bog |
| `umbral-marches:ruins` | the Drowned Ruins | 37–41 | 44 × 28 | **the Abbey-Slab Stone** | the Galleries' exit; the Drowned Crypts' door; the Lantern Ring | the drowned abbey town |

- **The Sunken Belfry** is already a canon place (§8.4, campaign #3 and #12 "Who Rings Under the Water"). As a
  connector it is the **upper half only** (the tower lying on its side, walkable along its wall). The fifth bell and its
  chamber stay sealed for campaign #12: a door with a bell-shaped keyhole, and under the water past it, one slow note
  every 40 s. *Lair*: Lantern Wisps that came in with the water, Drowned Acolytes still ringing a bell that isn't there.
  *Mood*: green-black water light through the louvres, which are now the floor. *Dressing*: bell-ropes hanging
  sideways, a ringers' rota board, the stairs running along the wall. *Sounds*: one note under the water; rope creak.
  *Hidden*: a ringer's glove on a hook (lore scrap: "Pull on four. Never on five." / ES "Tira en el cuatro. Nunca en el
  cinco.").
- **The Bog Galleries** (zone brief). *Who built it, why it fell*: Gloamhaven's peat-cutters, who dug fuel for the
  lanterns; the galleries flooded the year the abbey drowned and the cutters left their spades standing. *Lair*: Ink
  Hounds that follow the cutters' scent; Mire Lurkers in the flooded cuts. *Mood*: peat-brown, lantern-hooks every 20
  tiles with no lanterns on them (light them with Firemaking: each hook takes a lit wick and stays lit for 10 min).
  *Dressing*: spades upright in the peat, a cutters' tally board, a wick-tag on a nail reading a name. *Sounds*: water
  seeping, a spade striking peat, once, far off. *Encounter*: −2's flooded cut, crossed on peat blocks that sink 3 s
  after you step on them. *Hidden*: a cutters' cache (Lamp-oil, a Basalt Blank, a Margin Note scrap in Veil's hand).
- **End of Act III.** Old Corvane's boat at Mirewatch goes north to Frostgate (the Celestial Peaks) once Act IV is
  built, locked until the **Ink Abbess** falls (and, when built, the Second Lantern). Until then the board shows the
  boat and "The ice is still in, Keeper." / ES "El hielo sigue cerrado, Guardian." Walking time, Mirewatch to the
  Crypts' door: **about 15 minutes**.

### 1.5 Celestial Peaks — Act IV (35–60), outline

Seven sections climbing from Frostgate's harbour to Meridian's terraces, then up again to the Orrery Vault.
Frostgate (harbour, safe) → **the Frostgate Steps** 35–38 → **the Starhollow Pass** 38–42 (Starhollow village) →
connector **the Frostfang Caverns −1…−2** 41–45 (shipped name, floors −1…−5 total; −1…−2 are the connector, −3…−5 the
dungeon) → **the High Snows** 44–48 → **Meridian** (capital, floors +1…+4, safe) → **the Orrery Ridge** 50–54 →
connector **the Wind Gallery** (a 1-floor ice tunnel) 53–56 → **the Vault Approach** 55–60 → the Orrery Vault. Weather:
snow and whiteout replace fog (§3). End: **a ship from Frostgate** (canon: one sea joins all lands); its Harbourmaster is named when the act is
built.

### 1.6 Luminous Expanse — Act V (45–70), outline

Seven sections across the glass desert: Saltglass (harbour village) → **the Salt Flats** 45–49 → **Prism Oasis**
(village, safe) → **the Mirror Dunes** 49–54 → connector **the Mirror Labyrinth −1** 53–57 (its −1 is the way through;
its deeper floors are the dungeon) → **the Noon Road** 56–61 → **Dawnspire** (capital, safe) → **the Palace Sands**
62–66 → the Sunken Palace −1…−6 (to 70). Weather: heat shimmer and glass-storms (§3). End: the Finale's threshold is
reached from the changed Seamworks, not by boat (campaign.md Finale).

---

## 2. Combat hot spots

Each land gets named places where the fighting is thick, so a hunter has somewhere to *go*. A **camp** is 6–12
creatures round a fire or a totem, respawning together 90 s after the last falls. A **den** is a small hand-drawn room
or hollow with a guaranteed champion pack. A **champion ground** rolls elite packs at **1 in 4** spawns instead of 1 in
16 (`td-elites`). An **eclipse spot** only wakes under an eclipse. All of them sit off the road, never on it, so a
traveller can pass.

### 2.1 Ember Isle (gentle)
| Spot | Section | Kind | Spawns | Why it is there |
|---|---|---|---|---|
| **The Slag-Cart Graveyard** | the Ashfields | camp | 8 Rivet Maws + 2 Cinder Bailiffs | the slag carts were dumped here for a century; the Maws chew the iron and the Bailiffs still try to serve writs on the carts |
| **The Wolf-Run** | the Deep Emberwood | den | an Ash Wolf champion pack (2–3) | the wolves hunt the hour after the last ember fades and den where the ash is deepest |
| (none) | — | eclipse spot | — | the Ninefold Stones and the Seam Eater (shipped) are the island's eclipse event |

No champion ground on Ember Isle (it is the doorstep).

### 2.2 Infernal Reach
| Spot | Section | Kind | Spawns | Why |
|---|---|---|---|---|
| **Kettle Camp** | the Deep Charwood | camp | 8 Cinder-clan Orcs, 2 Orc Firecallers, 1 Orc Warlord | the clans boil slag in a stolen Watch kettle; their totem is nailed with a Watch plaque they took |
| **The Scorch Rings** | the Obsidian Badlands | champion ground | Firecallers and Orcs, elite 1 in 4, Firecallers *vael dra* in pairs | the Firecallers' ritual circles: where they "sing the lava up" |
| **The Drake Nests** | the Molten Fields | den | an Ember Drake unique pack (named leader + 3) | drakes lay in the warm basalt where the lava runs shallow |
| **The Watch's Last Cairn** | the Pyre Peaks | camp | 6 Bone Walkers, 3 Bone Archers, 1 Ash Ghoul | the Bastion's dead marching to relieve a post that fell before they were born |
| **The Ring of Pyres** | the Pyre Peaks | eclipse spot | the Seam Eater 30 (shipped) and, round the ring's edge, 6 Eclipse-touched Cinder Wraiths | the rift |

### 2.3 Verdant Wilds
| Spot | Section | Kind | Spawns | Why |
|---|---|---|---|---|
| **The Weaver Canopy** | the Greenwood | den | a Thorn Weaver champion pack under webbed trunks | they spin between the copied trees, which do not grow back when cut |
| **The Hart Meadow** | the Deep Wilds | champion ground | Rootglass Harts and Moss Stalkers, elite 1 in 4 | the oldest Harts gather where the moss grows in straight lines |
| **The Bell-less Square** | the Sunken Courts | camp | 6 Vine Lashers, 2 Moss Stalkers, 1 Sporecap ring | the priests' square, where the bells were rung; the vines took the bell-frames |
| **The Ring of Thorns** | the Sunken Courts | eclipse spot | the Seam Eater 40 (shipped), plus 4 Eclipse-touched Canopy Bats | the rift |

### 2.4 Umbral Marches
| Spot | Section | Kind | Spawns | Why |
|---|---|---|---|---|
| **The Lure Pools** | the Black Meres | camp | 8 Mire Lurkers whose lantern-lures float over the pool | the Lurkers learned that Keepers walk toward lanterns |
| **The Knights' Causeway** | the Deep Fen | champion ground | Drowned Knights and Ink Hounds, elite 1 in 4 | the abbey's old guard still patrols the causeway to the crypts |
| **The Witch's Island** | the Drowned Ruins | den | a Gloam Witch unique pack with 2 Drowned Acolytes | the witch keeps the acolytes praying so the water stays high |
| **The Lantern Ring** | the Drowned Ruins | eclipse spot | the Seam Eater 55 (shipped), plus 4 Eclipse-touched Lantern Wisps | the rift |

---

## 3. Weather

### 3.1 The rule
Weather is **deterministic from the world clock**, so every player on a land sees the same sky at the same moment (and a
co-op host and its party agree without sending it). A land rolls one state per **weather window of 6 real minutes**:

```
window   = floor(worldClockMs / 360_000)
roll     = hashSeed(`${land}|weather|${window}`) / 2^32          // 0..1, td-dark's hashSeed
daypart  = phase at the window's midpoint ('day' | 'dusk' | 'night' | 'eclipse'; dawn counts as dusk)
state    = the zone's weights for that daypart, walked in order (Clear, Overcast, Rain, Thunderstorm, Fog, land-special)
```

- The roll is per **land**; each **section** reads it through its own weights (a mountain can storm while the shore
  only rains: the land rolls once, each section maps the same `roll` through its own cumulative table).
- **Transitions** take 30 s: rain eases in over 30 s at the window's start and out over the last 30 s if the next
  window differs. Two windows in a row of the same state join smoothly.
- An **eclipse** overrides: during an eclipse a land is Clear or Overcast only (the sky goes black; weather hushes).
  Its violet dark is the event.
- **Outdoors only.** Dungeons, caves, interiors and town houses never weather; a cave mouth's first 6 tiles show the
  rain outside.
- Menu → Sound gains **Weather: full / soft / off** ("soft" keeps the sound and the tint, drops the streaks; "off" keeps
  the rules and shows only the HUD pip). Reduced motion behaves as "soft".

### 3.2 States and what they do (fixed by the DM's shared decisions)
| State | Rules | HUD pip |
|---|---|---|
| **Clear** | nothing | sun / moon |
| **Overcast** | the day is 15% darker (`td-night` darkness +0.15 by day); nothing else | cloud |
| **Rain** | **Wet** on everything outdoors (Keepers, pets, creatures; refreshed while in it, +5 s after); fire skills −15%; lightning skills +20%; campfires gutter out in 60 s unless under a roof; Fishing bites +25%; sight and creature aggro radius −15% | droplet |
| **Thunderstorm** | Rain, plus a **strike** every 20–40 s (seeded per Keeper) at a random outdoor tile within 12 tiles of each Keeper: a **1.2 s ring tell** (a white flicker on the ground and a rising hum), then 8% of max life as lightning to whatever stands within r1. A strike never takes a Keeper below 10% life; creatures take it in full. Lightning skills **+35%** (instead of +20%) | droplet + bolt |
| **Fog** | sight radius −40% for Keepers and creatures; dark-born may show by day inside it; the Hush rises 1.5× as fast; ranged creatures lose their target past 5 tiles; the Thornstrider's fog skills gain (skills-100.md) | fog bank |
| **Ashfall** (Ember Isle, Infernal Reach) | fire +10%, cold −10%; grey ash drifts; Ash Wolves hunt in it by day | ash flake |
| **Spore drift** (Verdant Wilds) | no new element: any fire hit on anything inside the drift bursts once (design-bible §4.7's Spore rule, 2× the drift's 4 dps, r1) | spore |
| **Mist-rain** (Umbral Marches) | Rain's rules, at half strength (Wet, fire −8%, lightning +10%), and the land's fog (built) thickens by +0.1 | droplet + fog |
| **Snow** (Celestial, later) | Chill on Keepers standing still outdoors 10 s; footprints show; fire +0% | flake |
| **Glass-storm** (Luminous, later) | sight −25%, a 2-per-second arcane graze (1 damage) in the open, shelter behind any wall | glint |

**Wet** (shared table): lightning taken +25% and a chain jumps +1; fire dealt by the Wet thing −15% and fire taken
−15%; a cold hit on a Wet target Freezes it. So a thunderstorm favours the Thornstrider's storm skills, rain helps the
Warlock's Rime (a frozen pack), and the Ashguard's Ember Brand burns a little lower. Bosses take Wet in full.

### 3.3 The weights, per wild section (per cent, by daypart)

Columns: **C** Clear · **O** Overcast · **R** Rain · **T** Thunderstorm · **F** Fog · **S** the land's special. Day /
night (dusk uses the mean of the two, rounded). Each row sums to 100.

| Section | Day C/O/R/T/F/S | Night C/O/R/T/F/S | Land special |
|---|---|---|---|
| **Ember Isle** — Meadows, Coast, Lake | 55/20/15/0/5/5 | 45/20/15/0/15/5 | Ashfall |
| Ember Isle — the Emberwood, Deep Emberwood | 45/20/15/0/10/10 | 30/20/15/0/25/10 | Ashfall |
| Ember Isle — Slagstone Hills | 45/20/15/5/5/10 | 35/20/15/5/15/10 | Ashfall |
| Ember Isle — the Barrow Road | 35/20/15/0/25/5 | 20/15/10/0/50/5 | Ashfall |
| Ember Isle — the Ashfields | 30/20/10/0/10/30 | 25/20/10/0/15/30 | Ashfall |
| **Infernal Reach** — the Steppe, Shore, Glasswater | 45/20/15/5/5/10 | 35/20/15/5/15/10 | Ashfall |
| Reach — the Charwood, Deep Charwood | 35/25/10/5/10/15 | 25/20/10/5/25/15 | Ashfall |
| Reach — the Obsidian Badlands | 40/20/5/10/0/25 | 30/20/5/15/5/25 | Ashfall |
| Reach — the Molten Fields | 35/20/5/10/0/30 | 30/20/5/10/5/30 | Ashfall |
| Reach — the Pyre Peaks | 30/20/10/20/10/10 | 20/20/10/25/15/10 | Ashfall |
| **Verdant Wilds** — Shore, Fernglades | 40/20/25/5/5/5 | 30/20/25/5/15/5 | Spore drift |
| Wilds — the Rootwater Ford, Glassmere | 35/15/30/5/10/5 | 25/15/25/5/25/5 | Spore drift |
| Wilds — the Greenwood | 30/20/25/10/5/10 | 20/20/25/10/15/10 | Spore drift |
| Wilds — the Deep Wilds | 20/25/20/15/10/10 | 15/20/20/15/20/10 | Spore drift |
| Wilds — the Sunken Courts | 25/20/20/15/10/10 | 15/20/15/15/25/10 | Spore drift |
| **Umbral Marches** — Shore, Fen | 15/25/15/5/30/10 | 10/20/10/5/45/10 | Mist-rain |
| Marches — the Pilgrims' Boardwalk | 15/20/15/5/35/10 | 10/15/10/5/50/10 | Mist-rain |
| Marches — the Black Meres | 10/25/15/10/30/10 | 5/20/10/10/45/10 | Mist-rain |
| Marches — the Deep Fen | 10/20/15/10/35/10 | 5/15/10/10/50/10 | Mist-rain |
| Marches — the Drowned Ruins | 10/20/10/15/35/10 | 5/15/10/15/45/10 | Mist-rain |

Ember Isle never storms on its low sections (the doorstep stays gentle), and its only storms are on Slagstone Hills, the
one high ground. Fog peaks at night in the Barrow Road (50%): the Sexton's Count is a night quest and fog is its friend.
The Pyre Peaks are the Reach's storm country (20–25%).

### 3.4 What it looks like (effects-spec.md, td-fx kit)
- **Rain**: diagonal 1 × 3 px streaks in two depths (near streaks faster, 40 near + 60 far on screen, half on phones),
  drawn over the ground and under the HUD; 2 × 1 px splash ticks where they land; **puddles**: a 30 s after-rain decal
  on road and flagstone tiles (darker, a sky glint that shifts with the camera), fading 60 s after the rain ends.
  Roofs shed a drip-line. Fire sprites (torches, braziers) hiss and dip 20% in radius while it rains on them.
- **Thunderstorm**: rain, the screen dims 10% more, and each strike: the 1.2 s ring (white, pulsing), a 2-frame flash of
  the whole screen at 25% white (**never above 25%, never more than one flash per 3 s**: photosensitivity; off under
  reduced motion, replaced by the ring alone), a stepped pixel bolt from the screen top to the ring, a scorch decal
  that fades in 20 s. Distant strikes (off-screen) flash 8% only.
- **Fog**: today's fog bank (`td-engine drawFog`) at the state's strength: +0.35 on surface sections with no fog of
  their own, +0.1 where fog is built (the Marches). The clear patch round the Keeper shrinks with the −40% sight.
- **Ashfall**: grey 2 × 2 flakes drifting down-left slowly (20 on screen), a grey film on the ground tint (5%).
- **Spore drift**: pale green motes rising, a soft green tint, motes swirl away from a Keeper's light.
- **Mist-rain**: half the rain streaks, finer (1 × 2 px), and the fog thicker.

### 3.5 What it sounds like (shared/sound/sound-director, new beds in sound-palette)
| State | Bed (looped noise + LFO) | Event cues |
|---|---|---|
| Rain | `rain`: pink noise through a 2 kHz lowpass, a slow 0.1 Hz swell; on roofs (in a town) a second bed of brighter ticks | none |
| Thunderstorm | `rain` + `wind` (brown noise, 0.05 Hz gust LFO) | `thunder-near` (a cracked noise burst 0.1 s after the flash, then a 2.5 s low roll); `thunder-far` (a 4 s roll only, delayed 1.5–4 s) |
| Fog | the land's bed with the highs rolled off (lowpass 900 Hz): the world goes muffled | `farbell` once per window (shipped cue, the Hush's) |
| Ashfall | `wind` soft, a faint crackle | none |
| Spore drift | the jungle bed, birds stop (the existing "birds that stop all at once") | none |
| Mist-rain | `rain` at half, `drips` (the cave-drip bed, shipped) | none |

Music: the score's warmth filter drops by a third in rain and fog (the realm's lowpass), and returns over 30 s.

### 3.6 What people say about it (EN / ES)
| Who | When | EN | ES |
|---|---|---|---|
| Old Netter Pell (Cinderport) | rain | "Rain's good for the hook. The fish come up to see what's falling." | "La lluvia es buena para el anzuelo. Los peces suben a ver que cae." |
| Odd Tarn (Ember Harbour) | storm | "No sailing in that. Not even for you." (the ship still sails; it is a grumble) | "Con eso no se navega. Ni por ti." |
| Maud Kiln (Ashgrove) | rain | "Light it under a roof or don't light it at all." | "Enciendelo bajo techo o no lo enciendas." |
| Captain Brannoc Vey (Pyrehold) | storm | "The Peaks call the lightning down. Stay off the high stones." | "Los Picos llaman al rayo. Apartate de las piedras altas." |
| Canopy Warden Ilsa Fenn (Rootglass) | spore drift | "Keep your fire in your pocket. The drift catches." | "Guarda el fuego en el bolsillo. La deriva prende." |
| Old Corvane (Mirewatch) | fog | "The fog thins round a lantern. Mind what else it thins round." | "La niebla se abre alrededor de un farol. Cuidado con que mas se abre." |
| Glim | first rain | "Wet wings. I'll ride in your hood." | "Alas mojadas. Voy en tu capucha." |
| Glim | first strike tell | "There! Off the ring, quick!" | "Ahi! Fuera del anillo, rapido!" |

Odette Pryor (Pyre Spire, "the smoke leans") becomes the forecaster (canon §9): her study's board shows **the next two
windows' weather** for the Reach ("Ash by the third bell. Then rain.") — one line, from the same roll.

### 3.7 Ties to the other systems
- **Fishing**: Rain +25% bite speed; Thunderstorm +25% and a 1 in 40 cast lands a **Stormscale** (a Mirrorfin
  variant, Cooking: "Thundercake", +5% lightning resist for 10 min); Fog: Lampfish bite by day.
- **Campfires** (Firemaking, canon §6.5): rain and storm put an unroofed campfire out after 60 s (a hiss and a smoke
  puff); under a roof, a tree canopy tile (`F`, `J`) counts as a roof at half: 120 s.
- **The Hush**: Fog ×1.5 rise; Thunderstorm ×1.2 (the dark between flashes); a lit campfire still quiets it.
- **Dark-born**: may show by day in Fog (only inside the fog's thick parts, never within 6 tiles of a road lamp); they
  step back from a strike's flash the way they do from any light.
- **Creatures**: Ash Wolves and dark-born favour Fog/Ashfall spawns (+25% of their kind in the section's table while it
  holds); Lightning-enchanted elites roll twice as often in storms.

---

## 4. Fish in the water

The water must look alive. Fish are drawn as **shadows under the surface**, never as a sprite above it, except when one
jumps.

### 4.1 Where they swim
- **At every marked fishing spot** (canon §6.5: a ripple tile with a float): 3–5 shadows circling within 2 tiles of the
  float. They are the spot's actual stock: a spot that has been fished out (the shipped regrowth ring) shows 1.
- **In deep water** (`~`, `l` and river `r` tiles more than 2 tiles from shore): 1 shadow per 40 water tiles, drifting
  on lazy Bezier paths, avoiding the shore band. They are flavour, not catchable: casting there says "Too deep to
  reach. Try the float." / ES "Demasiado hondo. Prueba en la boya."
- **Perf cap**: at most **14 shadows on screen** (8 on a phone), nearest the Keeper first; each shadow is a 6 × 3 or
  8 × 4 px darker ellipse with a 1 px tail flick, updated at 15 Hz, no per-fish canvas.

### 4.2 Species by water (canon §6.5 names; size of shadow in brackets)
| Water | By day | By night | Under an eclipse |
|---|---|---|---|
| The Burning Sea (all coasts) | **Mirrorfin** (8 × 4), silver flash when it turns | Mirrorfin, fewer | **Moonwake** (10 × 5, a pale glow at the head) |
| Ashwater Lake, Glasswater, the Glassmere | Ash Perch (6 × 3) | **Lampfish** (6 × 3, a 1 px warm dot) | Moonwake |
| Rivers (the Rootwater) | Rootling Eel (long 10 × 2) | Rootling Eel | Moonwake |
| Marsh water (the Meres, the Fen) | Mire Carp (8 × 4, slow) | **Lampfish**, many (the fen glows faintly) | Moonwake |
| Lava (fishing in lava: the shipped Seam Rod rule) | Slagjaw (6 × 3, an orange shadow *on* the lava) | Slagjaw | Slagjaw |

The **Lampfish** is the night's tell: on a dark lake its warm dots are the only light, and it is why the fen
pilgrims hung lanterns over the water.

### 4.3 How they behave
- **Hour**: shadows move 30% faster at dawn and dusk (feeding), slowest at noon. The Lampfish only shows from dusk to
  dawn.
- **Weather**: in Rain and Thunderstorm, shadows come to the surface (drawn 20% lighter, with a ring each 4–8 s); in
  Fog they are drawn 40% fainter; in a Thunderstorm a strike within 6 tiles makes every shadow nearby dart away for 3 s.
- **Jumps**: each shadow jumps every 40–90 s (seeded): a 3-frame arc of the species' small sprite (silver, warm, pale),
  a 1-tile splash ring and the shipped `splash` cue at 30% volume. A jump at a fishing spot means **the next cast there
  bites 2 s sooner** (the tell a fisher learns). Moonwake jumps leave a 1 s silver trail.
- **The Keeper**: shadows scatter from a Keeper wading or standing on the shore tile next to them, and come back in 4 s;
  a cast float draws the nearest shadow toward it over 2 s (and that is the one that bites).

### 4.4 The tie to Fishing
- A spot's shadow count is its stock (fished out = 1, regrowing back to 3–5).
- The species shown is what can bite there now (by hour, weather, eclipse); the Catalogue of Strange Fish's "???"
  entry gains "Seen jumping at <place>" once one has been seen, so seeing is half of catching.
- Fishing trainers (Old Netter Pell, Netmender Wenna Brisk) say it: "Watch them jump before you cast. They tell you
  where." / ES "Miralos saltar antes de lanzar. Te dicen donde."

---

## 5. Scary dark zones and night events

The dark is where the world remembers. Every event here: **only at night, in fog or under an eclipse**; it never hurts,
takes or chases; it is always visible from a distance before it touches the Keeper; and following it pays. Walking away
ends it. The Hush may rise; nothing else happens.

Each event is seeded per land and night (`hashSeed(land|event|nightIndex)`), so a party sees the same event, and each
runs at most **once per in-game night per land** (a world day is 24 real minutes, the night about 8).

### 5.1 Ember Isle (gentle; the Hush is off here, so these are only strange)
| Event | Where | When | What happens | Reward | The exit |
|---|---|---|---|---|---|
| **The Late Shift** | the Ember Mine head (the Ashfields) | night, 1 in 3 nights | a row of six lamp-lights walks *up* out of the shaft and along the slag road toward the Seamworks, at a walk, and goes out one by one at the fence | follow to the fence: where the last goes out, a dropped lunch tin (Hearth meal: "Cold Miner's Pasty", +10% Mining XP 10 min) and a scrap: "Shift done. Nobody signed us out." / ES "Turno acabado. Nadie nos firmo la salida." | they never turn; walk off the road. **A planted clue for campaign #1** (The Beacon Goes Down): the beacon's light leans down the shaft, and something down there is still working a shift. |
| **The Count Goes On** | the Barrow Road | fog, night | the Barrow's one bell rings the count, one to forty, slowly; at forty-one, it stops and starts again | standing at the lych-gate through a full count: Aldous Wren's line "You counted with me. Nobody does." and +1 Sexton's favour (the Sexton's Count reward pool) | leave the gate |

### 5.2 Infernal Reach
| Event | Where | When | What happens | Reward | The exit |
|---|---|---|---|---|---|
| **The Relief Column** | the Pyre Peaks road to the Ashen Bastion | night | a column of grey, half-seen soldiers marches past the Keeper toward the Bastion, in step, and halts at the gate; a voice calls "Present." twenty times | walk the column's length at their side to the gate: the roll-call's last name is chalked on the gate, a Margin Note scrap behind it (the Ashen Crypt's sealed chapel thread, canon §9 "Doors in the dark") | step off the road; the column never looks |
| **The Kiln That Lights Itself** | the Deep Charwood | night, Ashfall | a cold kiln glows for 2 minutes; charcoal-burners' shadows work it and leave | light it (Firemaking) before it fades: a burner's cache (charcoal ×10, a Basalt Blank) and the burners' tally line | leave it to fade |
| **The Second Hammer** | the Obsidian Badlands, at the Forge gate | eclipse | the Forge's hammer (the "one blow from nowhere") rings from *outside*, out in the Badlands, three times, moving | find where it rang the third time: a hammer-scar on the obsidian and an Unsigned-crescent scrap [Q2 thread, Odric] | none needed; it only rings |

### 5.3 Verdant Wilds
| Event | Where | When | What happens | Reward | The exit |
|---|---|---|---|---|---|
| **The Walking Tree** | the Greenwood, at a pair of copied trees | night or fog | one of the two copied trees is in a different place each time the Keeper looks away (only while unseen; it never moves in sight, never closer than 6 tiles) | after it has moved three times, Glim dims beside it: strike it once and it becomes a plain tree again, leaving a **copy-seed** (quest hook: campaign #7, the Graft Crown) | it never follows past the section edge |
| **Dusk Hymn** | the Sunken Courts | dusk only | the temple's hymn [Q2] carries out over the Courts; Vine Lashers and Moss Stalkers stand still for its length (90 s) | a Keeper who walks the Courts while it sings passes untouched; the Bell-less Square's camp drops a moss-priest's bell-clapper (lore item, campaign #12 seed) | the creatures wake when it ends; it never ends while a Keeper is mid-fight |
| **Spore Lights** | the Deep Wilds | night, Spore drift | spore motes gather into a line of soft lights leading off the road | follow: a Root Hollows side mouth (an extra way down) with a Sporecap ring and a rootglass cache | the lights fade if the Keeper leaves them |

### 5.4 Umbral Marches
| Event | Where | When | What happens | Reward | The exit |
|---|---|---|---|---|---|
| **The Sisters' Procession** | the Pilgrims' Boardwalk | fog, night | a line of small lanterns walks the boardwalk toward the abbey; where the boardwalk is sunk, they walk *on the water* | follow on the boardwalk to the Belfry: a sister's sandal on a post and a prayer-board with a name (one of the Drowned Abbey set's names, a scrap); 3 nights followed: a shade chest on the Belfry's sunk end | they never come off the water |
| **A Voice Calls a Name** | the Deep Fen | night | a voice calls one name across the fen, once (canon §8.4) — **the Keeper's own name** on the third night | walk toward it: a wick-tag on a lost lantern post with the Keeper's name on it; light it (any light) and it stays lit on that post forever, for that Keeper (a personal fixed light on the Atlas) | silence for the rest of the night if walked away from |
| **The Bell Under the Water** | the Black Meres, over the Sunken Belfry | eclipse | the fifth bell rings once, and every Lampfish in the Meres goes dark | stand still through the eclipse: the Belfry's sealed door's keyhole glows on the map (campaign #12 seed) | none; it is one note |

---

## 6. PvP (Tibia-style, within canon)

**The DM's ruling.** Tibia's open world is kept: anyone can attack anyone, anytime, outside the safe light. The cozy
contract is kept too: towns, hearths and the starter island are always safe; new Keepers are protected until 20; the
penalties follow canon §6.6 and realms-endgame.md §3.9 (soft in the Normal world, Tibia-style in Realms and on
Nightmare/Hell); story items are never lost; and every murder is *counted*. Lore: **the world counts.** The Keepers'
line was a count; the Sexton counts the graves; the Archive strikes names. A Keeper who kills the uncounted gets counted.

### 6.1 Where
| Ground | PvP |
|---|---|
| Every continent's wilds and sections, every dungeon floor and cave, every Realm | **on** |
| **Ember Isle** — the whole island, surface and dungeons | **off** (the Rookgaard rule) |
| Towns' and villages' safe ground (`TdWorld.safeAt`), every interior, piers and harbour boards, Waystones (r3), hearth rings (r3), the Waystone Hall | **off** |

A blow into safe ground is refused at the source (it never lands, and no mark is given); a Keeper standing on safe
ground cannot strike out of it. The edge of safe ground is drawn: the town's cream light ends in a faint ring at dusk
and night, and the HUD shows a small hearth pip while the Keeper stands inside.

### 6.2 Protection
- **Under level 20**: cannot attack a Keeper and cannot be attacked by one (both ways). Their plate shows a small
  **fresh-mark** (a pale chalk tick) to everyone.
- **The two-thirds rule**: a Keeper cannot *open* on one whose level is below 2/3 of their own (a 60 cannot open on a
  39). It may fight back if struck first, and may strike a marked one (Ash Mark, Red Tally, Struck) of any level of 20+.
- **Wake grace**: after waking at a hearth, 60 s during which the Keeper cannot be attacked, ending the moment they
  attack.
- **Party**: party members never hurt each other (blows, AoE, storms, traps pass through). Guilds and guild wars come
  with online.md §3.7.

### 6.3 Marks (the count on your name)
| Mark | How you get it | How long | What it looks like | What it means |
|---|---|---|---|---|
| **Ash Mark** / *Marca de ceniza* | strike an unmarked Keeper first (any damage, any CC, any pet blow under your command) | **15 min**, refreshed by each new first-strike | a grey ash smudge on the name plate, and a thin grey smoke wisp over the head every 4 s | anyone may fight you without getting a mark themselves |
| **Red Tally** / *Cuenta Roja* | **3 unjustified kills in 24 h**, or **5 in 7 days**, or **10 in 30 days** | **30 days** (real time, counting through logout) | the plate turns rust-red with five tally strokes beside the name; the Keeper's own light takes a red rim | anyone 20+ may kill you without a mark; your death costs far more (§6.5); a bounty is on you |
| **Struck** (black) | **6 unjustified kills while Red** | **45 days** | the plate shows **no name**, only "Struck" / ES "Tachado", with a single black line through it; Glim's light dims beside the Keeper | all of the Red Tally's, plus no harbour boats, no Waystone Hall, no blessings |

- An **unjustified kill** = killing a Keeper who was not marked and had not struck you (Tibia's rule). Killing a marked
  Keeper, or one who struck you first, is justified and adds nothing.
- **The count is shown.** The character sheet (C) gains one line under the level: "Unjustified: 1 today · 2 this week ·
  2 this month" / ES "Injustificadas: 1 hoy · 2 esta semana · 2 este mes", and the Red threshold in brackets. Nobody
  crosses a line without seeing it coming.
- **The counts decay** on their windows (24 h, 7 d, 30 d), not on the mark: a Red Tally runs its 30 days even if the
  counts fall back.

### 6.4 The fight
| Rule | Number |
|---|---|
| Damage between Keepers | **×0.5** (every skill, pet, Spellstone, storm strike called by a skill) |
| CC durations on a Keeper from a Keeper | **×0.5** (stun, root, freeze, chill, blind, taunt; slows keep their strength) |
| Heals received while **Hot Ember** | **×0.75** |
| **Hot Ember** (the combat status) | 60 s after any PvP hit, given or taken; an ember pip on the HUD with its seconds |
| While Hot Ember | no Waygate, no Waygate Scroll, no harbour board, no logout-vanish: a Keeper who closes the game leaves their body standing for **60 s** (it can be struck and can fall) |
| Spellstones | usable; the shared stone exhaust is **2 s** while Hot Ember (1 s otherwise) |
| Level gap rules (`gapHurt`, `gapMiss`) | **do not apply** between Keepers (they are for creatures) |
| Seeing | a hostile Keeper's plate shows their mark, level and calling; nothing about their gear until inspected |

### 6.5 Death to a Keeper
XP follows the **scope** (canon §6.6): the soft Ember debt in the Normal world, the §3.9 Tibia rule in Realms and on
Nightmare/Hell. Loot is new: a death to a Keeper always leaves a **Keeper's bag**.

| Victim | XP | What the bag holds | Worn items |
|---|---|---|---|
| Unmarked or Ash-marked, **Normal world** | the Ember debt (10% of the level's XP; blessings cut it) | **10% of carried Gold** + up to **3 random unprotected satchel stacks** | none |
| Unmarked or Ash-marked, **Realm / Nightmare / Hell** | §3.9 (9% of the level's XP, 8% Nightmare, 10% Hell and Realms; blessings cut it) | the full §3.9 bag: the carried satchel (non-protected) and all carried Gold | §3.9: 10% chance of one random worn piece (blessings and the Amulet of Loss cut it) |
| **Red Tally**, any scope | the scope's XP loss **×2**, **no blessings** | the **full satchel** (non-protected) + all carried Gold | **3 random worn pieces** |
| **Struck**, any scope | the scope's XP loss **×2**, **no blessings** | the full satchel + all carried Gold | **5 random worn pieces** |

- **Never lost** (canon): soulbound items, quest and story items (Seals, Lamp Seal, Margin Notes, Gate Fragments, Witness
  marks), the Atlas, the Hearth and lore progress. Under 20 nothing is ever lost (they cannot be in PvP anyway).
- **Unprotected stack** = any satchel stack that is not soulbound or story; the vault (the town's depot) is always safe.
- **The bag**: a leather Keeper's bag with the victim's mark-colour cord, where they fell. For **60 s** only the
  killer's party may open it; then **anyone** for the rest of its **15 min**. The victim may always take it back. A
  bag inside a Realm follows §3.9's instance rules. Each take is logged in the victim's death card ("Hollow took your
  Cinder Ring.").
- **Blessings** (Hearth Blessings, §3.9): unchanged in effect; they are **not consumed** by a death to a Keeper in the
  Normal world unless they cut something (the Ember debt).
- **No XP and no Gold reward for a kill** except the bounty (§6.6). PvP is for hunting grounds and grudges, not levels.

### 6.6 Bounties: the Writ of the Watch
Killing a **Red Tally** or **Struck** Keeper (justified, by definition) gives the killer a **Writ of the Watch** (a
satchel item, one per kill, tradeable). Hand it in at **Captain Brannoc Vey's desk** in the Pyre Spire's Watch Hall
(Pyrehold): **huntGold(victimLevel, 30) Gold** (half a minute of a hunt at the victim's level; ×2 for Struck). The Watch
keeps a board of the current Red and Struck names (the **Watch Board**, a station in the Watch Hall).
- Lore: the Pyre Watch admits no one under 20 and holds the gate; it pays for the counted. The writs are copied by the
  same Cinder Bailiffs' forms the Watch took off the old mine ("Writ — the bearer has kept the count.").
- Brannoc Vey: "Bring me the writ, not the story." / ES "Traeme el escrito, no la historia."
- Abuse guard: a Writ is not issued for a victim killed by the same Keeper or party more than once in 24 h, nor when
  the two share an account or a guild.

### 6.7 How the world reacts
| Who | To whom | EN | ES |
|---|---|---|---|
| Glim | the Keeper gets an Ash Mark | "That one didn't start it." | "Ese no empezo." |
| Glim | the Keeper goes Red | (Glim's light takes a red rim; Glim says nothing for the first minute, then) "I'm still here. I'm counting too." | "Sigo aqui. Yo tambien cuento." |
| Glim | Struck | Glim dims beside the Keeper (as beside false things) and speaks only when spoken to. "I can't find your name on the map." | "No encuentro tu nombre en el mapa." |
| Sexton Aldous Wren (Hushed Barrow) | any Red/Struck Keeper who visits | he cuts a tally on the lych-gate post while they watch: "Forty graves. And one more name to keep." | "Cuarenta tumbas. Y un nombre mas que guardar." |
| Sexton Aldous Wren | the mark ends | "Your stroke's worn smooth. Like Kael's." | "Tu raya se ha borrado. Como la de Kael." |
| Every Harbourmaster (Odd Tarn, Garrick Dross, Marit Salt, Sunny Pell, Old Corvane) | Struck | refuses passage: "The Watch has your name, Keeper. Or it doesn't. Either way, not on my deck." | "La Guardia tiene tu nombre, Guardian. O no lo tiene. En mi cubierta, no." |
| Innkeepers | Red | serve, but: "Sit where I can see you." | "Sientate donde te vea." |
| Captain Brannoc Vey | Red/Struck Keeper at his desk | "You're on my board. Walk out the way you came." | "Estas en mi tablon. Sal por donde entraste." |

### 6.8 The death screen (one card, nothing hidden)
"You fell to **<Keeper>**, a Keeper. **Lost:** the Ember debt (−1,240 XP to pay off). **Dropped:** a bag with 320 Gold
and 3 stacks at the Charwood, 14:59 left; <Keeper>'s party may open it for 60 s. **Saved by:** Pyre Ember (−20% debt)."
ES: "Caiste ante **<Keeper>**, un Guardian. **Perdido:** la deuda de ascuas (−1.240 PX por pagar). **Soltado:** una bolsa
con 320 de Oro y 3 montones en el Charwood, quedan 14:59; el grupo de <Keeper> puede abrirla durante 60 s. **Salvado
por:** Ascua de Pyre (−20% de deuda)."

Buttons (44 px): **[Wake at the hearth]** / **[Despertar en el hogar]**, **[Find my bag]** / **[Buscar mi bolsa]**. A
justified-kill line for the killer: "Justified: they bore the Red Tally. A Writ of the Watch is in your satchel." / ES
"Justificada: llevaba la Cuenta Roja. Tienes un Escrito de la Guardia en la bolsa."

### 6.9 The build dependency
PvP needs the **room to own Keeper life** (online.md §4d lists the Keeper's own life as client-trusted in M1/M2). Until
online **M3** moves Keeper life, Keeper-to-Keeper hit claims and deaths into the room, PvP is designed, not built. The
marks, counts and bags are server state (one `pvp/{characterId}` ledger the room writes, never the client); the bag is
a room ground pile with an owner window (the shipped `world-ground` `own[]` + `free ms`, protocol 7).

---

## 7. Build order

| # | Build | Size | Depends on | Player impact |
|---|---|---|---|---|
| 1 | **Weather v1**: the deterministic roll, Clear/Overcast/Rain/Fog, Wet, the rain and fog visuals, the rain bed, the HUD pip, Menu → Weather; the weight table as data (`td-weather.ts`) | M | none | high: every outdoor minute changes |
| 2 | **Fish shadows** at fishing spots and deep water, jumps, the bite tell | S | none | high for cozy feel |
| 3 | **Thunderstorm** strikes (tell, cap at 10%, flash rules), Ashfall, Spore drift, Mist-rain, thunder cues, the NPC lines, Odette's forecast | M | 1 | medium |
| 4 | **Infernal Reach as sections**: split into the nine areas (ids above), the Kiln Tunnels and the Glass Throat (zone briefs §1.2), the Waystones, the section seams, `td-zones` rows | L | the room's per-area worlds (M1 shipped) | very high: the act feels long |
| 5 | **Hot spots** for the Reach (§2.2), then each land as it is re-drawn | S each | 4 (works on today's map too) | high |
| 6 | **Night events** batch 1: the Late Shift, the Count Goes On, the Relief Column, the Kiln That Lights Itself | M | none | high for mystery |
| 7 | **Ember Isle grows** to 40 × 30 with the rockslide and Slagstone Cave as the connector | M | none | medium (first impression) |
| 8 | **Verdant Wilds as sections**, the Root Hollows −3 exit, the thorn hedge; its hot spots and events | L | 4's tooling | high |
| 9 | **Umbral Marches as sections**: the Pilgrims' Boardwalk, the Sunken Belfry (upper half), the Bog Galleries; its hot spots and events | L | 8 | high |
| 10 | **PvP**: safe ground, protection, Hot Ember, marks and counts, bags, the Writ and the Watch Board, the reactions, the death card | L | online M3 (the room owns Keeper life) | high for the MMO pillar |
| 11 | Celestial and Luminous section plans become maps (with Acts IV and V) | L | the acts' story | — |
