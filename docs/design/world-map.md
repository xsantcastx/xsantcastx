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
| **Infernal Reach** (first draft built: Pyrehold + harbour + regions) | Volcanic mainland: ash plains, obsidian cliffs, lava rivers | **Pyrehold** (capital), Cinderport (harbour), Ashgrove (village) | 8–30 | The Molten Deep (−1…−6), Forge of the Four (−1…−4) |
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
   Harbour with the ship to Pyrehold.
2. **Infernal Reach** — first draft built: Pyrehold (forge district, plaza of stalls, harbour), the Cinder Steppe,
   Charwood, Obsidian Badlands, Molten Fields, Pyre Peaks; Lava Hounds and Obsidian Golems. Next: Cinderport and
   Ashgrove, the Molten Deep and the Forge of the Four dungeons.
3. The other four continents, one at a time, each with its capital first.
