# The world map — islands, towns, floors (plan)

Owner, 2026-10-20: "that map is trash … inspiration from tibia, floors, cave layers, a modern tibia world" and
"more cities, or is this like a tutorial island?". This is the whole world before it is drawn. Everything here is
drawn by hand (`src/app/play/td/maps/`); generated ground only fills a region's inside. See docs/design/vision.md.

## How it is laid out
One sea, the **Burning Sea**, with a starter island and five realm continents round it, each a day's sail apart.
Every continent has a capital, two or three towns or villages, wild regions that get harder away from the capital,
and dungeons that go down floor by floor. Ships link the harbours (a ship is a short scene and a fare in Gold).

| Where | What it is | Towns | Levels | Dungeons (floors) |
|---|---|---|---|---|
| **Ember Isle** (built) | The starter island (Tibia's Rookgaard): learn to fight, cast, loot, mine, chop | **Basalt Seamworks** | 1–8 | Ember Mine (−1…−3, boss), Slagstone Cave (−1…−2), the Caldera (−1) |
| **Infernal Reach** (built so far: Pyrehold + the Pyre Spire, Cinderport + its ship, Ashgrove, regions, the Molten Deep −1…−6, the Ashen Crypt −1…−2, the Forge of the Four −1…−3) | Volcanic mainland: ash plains, obsidian cliffs, lava rivers | **Pyrehold** (capital), Cinderport (harbour), Ashgrove (village) | 8–30 | The Molten Deep (−1…−6), Forge of the Four (−1…−4) |
| **Verdant Wilds** | Jungle continent: rivers, giant trees, ruined temples | **Rootglass** (capital, in the canopy: floors +1…+3), Mossharbor, Thornwick | 15–40 | The Overgrown Temple (−1…−5), Root Hollows (−1…−4) |
| **Umbral Marches** | Swamp and shadow: fog, stilt towns, drowned crypts | **Gloamhaven** (capital on stilts), Mirewatch, Lanternfen | 25–50 | Drowned Crypts (−1…−6), the Ink Deeps |
| **Celestial Peaks** | Snow and stone: high passes, observatories, ice caves | **Meridian** (capital, terraced: floors +1…+4), Frostgate, Starhollow | 35–60 | Frostfang Caverns (−1…−5), the Orrery Vault |
| **Luminous Expanse** | Glass desert: dunes, mirror oases, sunken palaces | **Dawnspire** (capital), Prism Oasis, Saltglass | 45–70 | The Sunken Palace (−1…−6), Mirror Labyrinth |

## Floors (Tibia's layers)
Every level of the world is a hand-drawn map with a floor number. **Up**: house upstairs, towers, city walls,
treetop walkways, mountain terraces (stairs and ladders). **Down**: cellars, sewers under every capital, mines,
caves, dungeons (ladders, holes, stairs, ramps). The deeper the floor, the harder the monsters and the better the loot;
the bottom floor of a dungeon holds its boss.

## Order of drawing
1. **Ember Isle** — built: region map, roads, places, the Ember Mine (−1…−3, the Ember Warden), Slagstone Cave, Ember
   Harbour with the ship to Pyrehold; the Hushed Barrow, a graveyard below the Sunken Chapel, off every road, where a
   few Bone Walkers stir between the graves.
2. **Infernal Reach** — built: Pyrehold (forge district, plaza of stalls, harbour), the Pyre Spire (a watchtower of
   three floors up), the Cinder Steppe, Charwood, Obsidian Badlands, Molten Fields, Pyre Peaks; Lava Hounds and
   Obsidian Golems; the Molten Deep floors −1…−3 (the Scorched Throat, the Glass Halls, the Tyrant's Caldera with the
   Magma Tyrant); Cinderport on the south-east coast (the Salted Ember tavern + cellar) and Ashgrove at the Charwood's
   edge (the Woodward's Lodge + loft), on roads from Pyrehold. The Ashen Crypt under the Ashen Bastion's ruins (a crypt
   door at the road's west end): floor −1 the Ossuary (Bone Walkers, Bone Archers, Ash Ghouls, Cinder Wraiths), floor
   −2 the Bone Hall (the Ashbone Dragon). The Cinder clans' orcs hold the Deep Charwood and the Obsidian Badlands; Ember
   Drakes hunt the Molten Fields. The Molten Deep goes on past the Tyrant (a stair south of the caldera): floor −4 the
   Slag Rivers (two slag rivers, one bridge each; Slag Crawlers, Ember Drakes, Cinder Wraiths), −5 the Glass Foundry
   (casting pits and cold anvils; Glass Sentinels that shoot molten glass, Golems), −6 the Heart of the Deep (the
   Cinder Sovereign, level 30, who calls two Lava Hounds at half its life). The Forge of the Four, a ruined gate in
   the Obsidian Badlands at the foot of the Pyre Peaks (place kind `forge`): −1 the Ash Gate, −2 the Four Smithies
   (four forge rooms off a crossway; Bailiffs and Golems), −3 the First Anvil (the Anvil-Warden, level 18, who calls
   two Bailiffs at half its life). Cinderport's salt-ketch sails from its pier back to Ember Harbour (a village way,
   `ContinentVillage.ways`). Next: the Forge's fourth floor, and something to do in each town (keepers, quests).

Buildings you walk into so far: the Ember Inn in the Seamworks (tavern + rooms upstairs), the Pyre Spire in
Pyrehold, the Salted Ember in Cinderport and the Woodward's Lodge in Ashgrove. A continent holds more towns than its
capital through `villages` (continent.ts); any town house takes a `door`. Rule for every interior and dungeon: passages at least two tiles wide, and no monster within about eight
tiles of a stair or door, so arriving is never a death trap.
3. The other four continents, one at a time, each with its capital first.
