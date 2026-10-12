# Design references

Screens the owner has pointed at as "this is how it should feel". Build to the
anatomy, in our own dark / gold visual language — never copy the art or colours.

## `maplestory-crafting-journal.png` — the bar for every station menu

Owner, 2026-10-12: "look at this menu, it's so easy to understand."

1. **Tabs per craft / skill** across the top.
2. **Skill strip**: icon, LEVEL N, XP bar, and one line saying where to do it.
3. **Master–detail**: left a list (icon + name + required level; locked rows dimmed), right the selected thing (big icon + name + "Craft 1 …").
4. **Requirement boxes as icon grids**: required tools, an optional additive slot, required items with **have/need counts** (`5/5` met, `2/6` short), Gold shown the same way.
5. **One action row**: quantity stepper, **CRAFT**, **CRAFT ALL**. A disabled button names the shortfall.
6. **No lore or explanation in the view.** Extras live behind Details.

On phones the list stacks above the detail (or becomes a horizontal icon strip).
See also the standing rule in `docs/roadmap/world-plan.md` and `src/app/shared/station-ui/README.md` (when it lands).
