# Overnight, 2026-10-20 — what changed while you slept

You asked for: the first class (a Warlock) made when you start, cross save working, skills to read and assign
(D2/Tibia), passives and auras, reworked stats without gold-per-second or the house, hover stats on items, an undead
Warlock, visible gear, and a real map. All of it is in; the details are below. The north star is
docs/design/vision.md ("a cozy pixel-art Tibia"), and the world plan is docs/design/world-map.md.

## Play it
Open `/play`. On a new browser the Glass of Becoming opens first, with the Warlock chosen. Keys:
- **J / Space**: attack (the staff's Ember Bolt, at range). Tapping a monster targets it.
- **1–4**: spells. **K**: Spellbook. **C**: character sheet. **I**: Satchel (hover an item for its stats).
- **E**: use a place or cut a tree.

## The Warlock
- **Undead look**: grey-green skin, a hood, violet eyes, bone trim. A staff is in hand, and the Keeper casts facing you
  with the staff raised.
- **Spells** (mana 60, regenerating): Drain Life, Ember Curse, Hellfire Nova, Dark Ward.
- **Auras**, one at a time: Aura of Embers or Aura of Siphoning.
- **Passives**: Soul Harvest (mana back on a kill) and the staff's Ember Bolt.
- **Spellbook (K)**: every skill with its real numbers, keys 1–4 to put it on the bar, and the aura switch.
- **Character sheet (C)**: level from your Hunting XP. Five points a level go into Vitality, Energy, Spirit and Agility;
  each attribute says what it gives, with totals below. The Homestead and gold-per-second are out of the top-down game.
- **Gear shows on the Keeper**: helm, crown, plate, robe, boots, sword, shield.
- **D2 hover card** on items in the Satchel.

## The world
- **Ember Isle**: the starter island, drawn by hand. It has coast, meadows, the Emberwood, Slagstone Hills and mountain,
  the Ashfields with lava, a lake, roads, and five places to find (ruins, a cave, a shrine, the Caldera, standing stones).
- **Monsters by region**: Ash Wolves in the woods, Rivet Maws on the hills, Cinder Imps and Bailiffs in the ash.
- **Ember Mine**: floors 1, 2 and 3 by stairs, with the Ember Warden (a boss) at the bottom.
- **Slagstone Cave**: a second dungeon, under the mountain.
- **Trees can be cut** (Woodcutting XP and bark).
- **New first goals**: defeat a Rivet Maw, mine Cinder Ore, cut a tree.

## Cross save (fixed)
Since the game-only shell, nothing reconnected a signed-in browser to the cloud on page load. Progress only synced if
you opened Account & settings. It now reconnects on every load. Two progress saves (the Contract Board and the Trials)
were also never synced; they are now. Details are in docs/handoff/cross-save.md.

**Two things only you can do:**
1. Check that the live Firestore rules match `firestore.rules`: Firebase console → Firestore → Rules, publish date.
   Or run `firebase deploy --only firestore:rules`.
2. Test with two devices: sign in on the PC, play a minute, then open /play on the phone already signed in. Your
   progress should arrive within a few seconds.

## Next (in order)
1. Ember Isle's harbour and the ship to the first mainland, Infernal Reach (Pyrehold).
2. Potions and a loot table per monster.
3. Floors up: houses you walk into.
