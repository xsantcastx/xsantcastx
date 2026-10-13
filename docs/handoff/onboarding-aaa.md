# Onboarding: armed before the first fight, a first bench craft, the Rune Forge in context

Date: 2026-10-13. Follows `docs/handoff/first-session-audit.md`, which left three
owner calls open. The owner delegated them ("decide AAA-style"); this is what was
decided and built.

## 1. Arm the player before the first fight

**Choice: reorder, no starter weapon.** The Basalt Edge needs 6 Cinder Ore and
1 Ember Residue (`play/side-scroller.component.ts` `forge()`,
`InventoryService.craftBasaltEdge`). Both come from the Cinder Ore seam in the
Seamworks, a few steps from spawn: every strike pays one ore, and the seam
grants the tutorial Ember Residue by the 8th accepted ore (claim id shared with
the storyboard, so it is never duplicated). Nothing in the recipe needs a hunt
drop, so a starter weapon would only have been a second, weaker blade that the
first goal then replaced. Reordering costs no save writes, no new grant and no
merge risk.

New order: **buy a building → forge the Basalt Edge and equip it → defeat a
Rivet Maw → dig in the Delve.**

- `world/first-goals.ts`: the blade goal is done only when something has been
  crafted **and** a main-hand weapon is worn (`armed`), or once a creature has
  already fallen (a veteran who unequips is never sent back). A forged but
  unworn Edge shows "Your Basalt Edge is ready. Use the Seamworks Forge once
  more to equip it before you hunt." and Show me walks to the forge, which
  equips it on arrival (`forge()` already did this on a second use).
- The hunt line now reads "Test your blade: defeat a Rivet Maw…".
- The Seamworks objective chain (ore → blade → Maw → beacon) and the goal line
  now agree; before, the goal line sent players to the Maws bare-handed.
- `showGoal()` re-reads the goal before walking: pressing Show me in the same
  200 ms tick as an area change used the last area's target (the Homestead's
  `passage` is the Seamworks' east passage, so the Keeper walked to the Quarry).
  The old order hid this because the hunt went east anyway.

## 2. Guaranteed first craft at the Crafting Bench

**Choice: make the existing Torch reachable.** It was 1 Cinder Ore + 1
World-Root Bark + 30 Gold; bark needs the Quarry (behind the beacon) or the Delve's
Root Hollows, and 30 Gold is five minutes of Bellows. Now **2 Cinder Ore + 2
Gold → 3 Torches**, level 1, no Smithing gate (`crafting.model.ts`
`craft-delve-torch`). The four goals leave 2–3 ore in the satchel (8 mined, 6
spent on the Edge, 1 per Maw), and the Bellows pays 2 Gold in 20 s, so the
Torch is in "Ready now" from the moment the Edge is forged.

- No new recipe, item or material: no catalogue fan-out. The Torch is a Delve
  kit stack (output `stack: true`), not an `ITEM_DEFINITIONS` entry.
- Economy: Delve kit fees are authored in v3 Gold and are outside the craft fee
  floors; `scripts/economy-sim.mjs --check` unchanged (first purchase 4 s, 44 in
  10 min). Torches get cheaper for everyone; they are a light source, not loot.
- Engine test (`scripts/seamworks-engine.test.cjs`) and `first-goals.spec.ts`
  pin the Torch to Seamworks ore only, ≤ 2 ore, ≤ 2 Gold, level 1.

## 3. The Rune Forge in context

**Choice: a one-time "Next step" line in the goal row.** It stays out of the
four goals and the tutorial. When all four goals are done, the Keeper stands on
the Seamworks floor, and the purse first covers a strike (`STRIKE_COST`, 600
Gold), the goal row shows "NEXT STEP · You can afford a rune strike. Try your
luck at the Rune Forge." with **Show me** (walks there, opens it) and **Not
now**.

- Pure rule: `runeForgeHint()` in `world/first-goals.ts`.
- "Seen" is a UI note in `localStorage['eclipse-rune-hint-seen']` (like the
  Hearth's open/folded note), set by Show me, Not now, or opening the Rune Forge
  any other way. It is not save state and not synced: on a new device a veteran
  with 600+ Gold who never opened the forge may see it once there.
- Copy EN + ES in the lazy `first-goals.i18n.ts` (`play.goal.next`,
  `play.goal.rune.town`, `play.goal.hide`, `play.goal.craft.equip`).

## Timings, new first session (1280×800, production build, Show me only)

| Step | Time from `/` |
|---|---|
| Into the world (tutorial) | 4.2 s |
| Goal 1: first building | 13.8 s |
| Goal 2: Basalt Edge forged **and worn** | 45.6 s |
| Goal 3: first Rivet Maw (armed) | 56.3 s |
| Goal 4: first Delve dig, all four done | 64.5 s |
| Crafting Bench open, Torch in Ready now | 68.7 s |

Before (audit): all four took 2 min 18 s at this size; the bare-handed hunt alone
was 32 s. With the Edge worn the hunt goal takes about 11 s, walk included. The phone run covers goal
1 only (the hit test on the Bellows' Buy button) and now checks that the next
goal is the blade.

## Tests

- `e2e/play-first-session.spec.ts`: a first visit through all four goals using
  only Show me. Asserts that the forged Edge is not worn until the equip step,
  that the satchel's Damage rises when it is worn, and that the Keeper still has
  that Damage when walking to the Maws. Then it checks "Ready now" at the bench
  (badge ≥ 1, Torch picked, Craft enabled). It tops the purse up to 5,000 Gold
  from `/robots.txt` and checks that the Rune Forge line appears, Show me opens
  it (`?at=runes`), and it never comes back after a reload.
- `src/app/play/world/first-goals.spec.ts`: order, arming, veteran safety, rune
  hint rules, Torch reachability, EN + ES coverage.

## For the owner

- Torch price: 3 torches for 2 ore + 2 Gold is deliberately trivial. Raise the
  Gold once a second, mid-game torch source exists, but keep it inside the first
  two minutes of Bellows income.
- The rune hint fires at 600 Gold. The economy curve gets a fresh player there
  in a few minutes of play; if that feels early, gate it on the second building
  as well.
