# UI + character pass — after the Top Heroes reference (owner, 2026-10-20)

Owner: "I love this layout, the UI, the items … look at the UI, very important, and the detail of characters."
Reference: `docs/design/refs/cozy/top-heroes-items.jpg`. Our rules still hold: pixel art only, `_cozy.css` tokens only,
the vision in `vision.md`, D2-plain where it matters (stats, not menus).

## What the reference does that we don't yet

| Part | Reference | Ours today | Change |
|---|---|---|---|
| **Item hover** | Framed in rarity colour, big icon, headline number, coloured affix list, sockets, worth | Done (f0b33609) | — |
| **Top-left** | Square portrait in a wood frame, level badge on its corner, a slim bar under it | A text card: KEEPER · LV · two bars | The Keeper's face (the same sprite, head crop) in a framed square, level on its corner, life + mana as slim bars beside it |
| **Top-right** | One horizontal strip: icon + number per resource, nothing else | A boxed "Satchel" panel with headings | One strip: coin, ore, ember, bag slots, each a pixel icon + number; the I key hint stays on the bag icon |
| **Bottom** | A framed toolbar of square icon buttons, each with a label (Build · Workers · Production · Storage · Upgrades) | Skill bar + an Interact pill; menus hide behind keys | Bottom-left toolbar: Satchel · Spellbook · Character · Places · Map, square icon + label, key hint on hover; the skill bar stays centred |
| **Quest/goal** | Small framed list top-right with progress bars ("Construct Barracks 80%") | A wide parchment across the top centre | A compact framed list under the minimap: one line + a progress bar per goal; "Show me" becomes a small arrow |
| **World labels** | Chunky outlined text over things in the world ("AXE ● 90") | A dark label box over a station | Outlined cream text with a dark 2px outline, coin and price inline when a thing costs |
| **Panels** | Dark wood frame, a title tab with an icon, an × in the corner, inner grid lines | Mostly there (Satchel, Spellbook, sheet) | Same frame on every panel; title tab gets its icon |

## Characters
The reference's heroes read at a glance: big heads (about 40% of the height), a 1px dark outline, two-tone shading
on every surface, a bright accent (hair, cape) and a ground shadow. Ours are small and flat.

1. **The Keeper (Warlock)** first: bigger head, shaded robe with folds, a hood with a rim light, the staff with a
   glowing head, a soft ground shadow; idle bob, walk cycle with 4 frames.
2. **Townsfolk and keepers**: the same proportions and outline; each with one accent colour.
3. **Monsters**: same outline and shading rule; bosses get a rim of their element colour.

## Order
1. Top-left portrait + top-right resource strip.
2. Bottom toolbar (labelled icon buttons) and the compact goal list.
3. World labels.
4. The Keeper's sprite, then townsfolk, then monsters.
Each step: screenshot against the reference, gate, push, sha to the owner.

## Owner comments queue (2026-10-20, in order)
1. **Chat like OSRS:** a small box at the left, fading when quiet, opening to type; it replaces the Hearth pill (removed
   from the top-down game in 2eaf5a4d — "it does not work": check its transport before wiring the new box to it). Game
   messages (loot, XP, level-ups, what Glim says) are its first tab, so it is useful even offline.
2. **Phone like OSRS mobile:** no padded top bar; the minimap top-right with life and mana orbs beside it; the menu tabs
   (Satchel, Spells, Character, Places, Settings) as a grid bottom-right that opens each as a panel above it; the chat
   bottom-left; the goal as a small chip.
3. **Character detail, the bigger step:** the shading pass (2eaf5a4d) is in; the reference's detail needs a larger,
   more detailed sprite set (head ~40% of height, two-tone everything, 4-frame walk) drawn at one pixel density with
   the tiles — an art pass of its own, Warlock first.

Status: steps 1–2 of the HUD order shipped (d522c7ba portrait + strip; 1a597ee1 goals under the minimap + toolbar).
4. **Click card** (owner: "when you click on the item … this huge UI that is really ugly"): done — a click pins the hover
   card beside the item with its actions; the big slip stays only in the side view.
5. **The Satchel's paper doll** still draws the old side-view Keeper (brown hair), not the Warlock: give it the
   front sprite (keeper-front) with worn gear.
