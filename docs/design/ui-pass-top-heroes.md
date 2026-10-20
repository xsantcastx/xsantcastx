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
