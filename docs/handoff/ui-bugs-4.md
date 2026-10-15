# UI bugs 4 — the four pass-2 leftovers

1. **Feet slot accepted nothing.** `EQUIPMENT_SLOTS` had `feet.accepts = []` and the paper-doll manifest gave the feet well no
   `liveSlot`, so the well was locked and `itemFitsSlot('feet', ...)` was always false although Astral Striders exists.
   Both set. Spec (`item-definition.spec.ts`): every wearable fits its own slot, every gear slot has an item, every doll well
   maps to a live slot. All other slots already agreed.
2. **Kael's bubble over the Weapon well.** The NPC widget is fixed bottom-left. `EquipmentPanelComponent` now sets
   `body.has-loadout` while mounted and `styles.css` keeps the bubble folded (portrait only) unless the player opens it.
   `e2e/character-npc-bubble.spec.ts` checks 1280x800 and 390x844, at top and bottom scroll.
3. **Self-Aware toast every visit.** `EasterEggService.trigger` announces ("Rediscovered") even when not new;
   `ForgeKeeperComponent.hydrate` called it unconditionally. Now only when `!isFound`. Spec: `forge-keeper.component.spec.ts`.
4. **"You have no runes yet" twice.** Rune grid `[empty]` and the action button's blocked reason printed the same string.
   The grid no longer carries it; the button reason stays. Spec: `enchanting-bench.component.spec.ts`.
