# Eclipse Realms — what the game is (one page)

Written 2026-10-20 after the owner asked "are we lost?". This page wins over every older doc when they disagree.

## In one sentence
**A cozy pixel-art Tibia**: one hand-made world of islands and floors to explore with your Keeper, killing monsters
for loot, levelling skills, crafting and building a home, alongside other players — in a warm Stardew-like look.

## The three pillars
1. **Explore a hand-made world (Tibia).** One world map of continents and islands in an ocean, one per realm
   (Infernal volcanic, Verdant jungle, Umbral swamp, Celestial snow peaks, Luminous glass desert). Towns, roads,
   boats between islands. **Floors**: houses and towers go up (+1…+3); caves, mines and dungeons go down (−1…−6).
   Every place is drawn by hand; nothing important is random.
2. **Fight and loot (Tibia + Diablo 2).** Monsters live in places that suit them and respawn. Click to target, swing,
   use abilities (1–4). Weapons decide the style: sword/axe up close, staff casts spells at range. Loot drops on the
   ground in its rarity colour; hovering an item shows a **small D2-style stat card**, nothing more. Bosses at the
   bottom of dungeons.
3. **A cozy life between fights (Stardew).** Mine, chop, fish, craft at stations, trade, build up your Homestead plot,
   seasons change the world weekly, festivals in towns, townsfolk going about their day.

## What it looks like
Top-down 3/4 pixel art, chibi Keepers, warm palette, wooden/parchment UI (docs/design/refs/cozy). The Keeper visibly
wears their gear (helm, armour, the weapon in hand) and animates every action (swing, cast, chop, mine, fish).

## What we are NOT making
No side-view platformer (retired), no random filler world, no big menus for small things (a hover card, not a window),
no real money.

## The order we build it (each step playable on its own)
1. **The starting island**: the Seamworks town + its surroundings drawn by hand on the world map (coast, forest,
   hills, a mine), with the mine's floors −1…−3 and a boss. Gear visible on the Keeper; staffs cast; D2 hover cards.
2. **The world map**: all five realm islands blocked out, ocean and boats, each realm's town and first dungeon.
3. **Floors everywhere**: houses you walk into, towers you climb, sewers under towns.
4. **Life**: Homestead plot on the map, farming, fishing spots, seasons, festivals.
5. **Delete the old side-view code** once nothing uses it.

## How we check we are on track
Every push: does this make the game more like the sentence at the top? If not, it waits.
