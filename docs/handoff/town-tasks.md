# Town tasks — every town's keepers ask for something (2026-10-20)

Owner brief: "give every town in the top-down game something to do: quests from its keepers" (Tibia / Stardew town
tasks; docs/design/vision.md, docs/design/world-map.md "Next: something to do in each town").

## What a player gets
- Each town has 2–3 **givers** with a pixel **"!"** over their head (an offer) or **"?"** (ready to hand in), also a
  dot on the minimap and a green pin in the Map's key (it travels to them).
- **E** beside them, a tap on them, or the Map pin opens a small wooden **talk window**: who they are (one line), the
  task on a parchment scroll, its reward, and one brass button — *Accept* / *Hand in* — plus *Not now*. A stall
  keeper who gives tasks (Mara Voss, Edrin Kade) is spoken to at the west end of their counter; its front still opens
  the stall, and the talk window has a *Trade* button.
- Taken tasks sit on the quest scroll under the first goals (**Tasks** rows, count or "?"); phones show the oldest one.
- Each giver's tasks run in order (2 each). Kinds, all real events: **hunt** (td-mobs `onKill`, counted only once
  taken), **deliver** (inventory stacks, handed over at the hand-in), **visit** (reach a hand-drawn floor).

| Town | Givers | Tasks |
|---|---|---|
| Basalt Seamworks (1–8) | Mara Voss · Edrin Kade · Sexton Aldous Wren (new) | 6 Cinder Ore; 4 World-Root Bark · 6 Rivet Maws; a letter to the Ember Inn's upstairs · 5 Ash Wolves; 5 Bone Walkers → **rare Keeper's Cowl iL8** |
| Pyrehold | Captain Brannoc Vey · Forgewife Ysolde Marr · Scholar Odette Pryor | 8 Cinder-clan Orcs; 5 Orc Firecallers · 6 Ember Residue; reach the Glass Halls · the Spire's lookout; the Magma Tyrant → **epic Infernal Cuirass iL20** |
| Cinderport | Harbourmaster Tamsin Coyle · Old Netter Pell | the Salted Ember's cellar; 4 Ember Drakes → **rare Keeper Staff iL18** · 6 World-Root Bark; 6 Lava Hounds |
| Ashgrove | Woodward Hesk Ashby · Maud Kiln | reach the Ossuary; 6 Ash Ghouls · 8 World-Root Bark; 6 Bone Archers → **rare Godforge Gauntlets iL12** |

Rewards: Gold as 2–15 min of income with a floor (the bounties' rate), a material, Hunting XP (30–450), and one gear
piece per town. `node scripts/economy-sim.mjs --town-tasks` prints the table (in `--check`).

## Dailies (2026-10-20)
Once a giver's two tasks are handed in they offer a **daily**: 3 per giver (`DAILY_TASKS`, hunt N of a creature in their
area or bring N of a material), one chosen per **local calendar day** (`dailyOf`: the day number plus a hash of the giver
id, mod the pool, so it rotates through all three and towns do not move in step; it depends on nothing but the date).
It resets at **local midnight**; the talk window says "Daily · Resets in 5h 12m", the Tasks row is prefixed "Daily:",
the "!" returns on a new day and the giver says "Come back tomorrow" once it is done. Pay is 1-2 min of income, 15-80
Hunting XP, now and then a small material, and a 15% chance of a Minor Health or Mana Potion (rolled from the day's key,
so two devices agree); never gear. A daily not handed in by midnight lapses.
Save version 2: `dAccepted`, `dProgress`, `dClaimed` beside the one-time fields, keyed `d<YYYYMMDD>-<task id>`. A version 1
blob reads as version 2 with them empty. Merge unions `dClaimed` (a day's daily is paid once across devices), counts
take the higher, and only the last 7 days of keys are kept. `economy-sim --town-tasks` caps the worst day (every giver's
priciest daily) at 25 min of income and a quarter of a level at 20 in XP.

## State
`godforge-town-tasks` through the GameStateGateway, synced (`progress/town-tasks`, SYNCED_BLOBS):
`{ accepted: {id: takenAt}, progress: {id: count}, claimed: [id] }`. **Merge**: `claimed` (the receipt) unioned,
counts max, accepted union at the earlier time — a merge never loses progress and never re-opens a paid task. Hand-in
is receipt-first: a delivery is consumed under `town-task:<id>` (replay-safe), the receipt is written, then Gold, the
material (`town-task:<id>:material`), XP (`town-task:<id>:xp`), and the gear minted under the fixed instance id
`town-task-<id>` (two devices' pay is one item).

## Files
`shared/town-tasks/{town-tasks.model,town-tasks-save.model,town-tasks.service,town-tasks.i18n}.ts` (+ spec);
td: `town-builder.ts` (`givers`, `giverStall`), the four town maps, `td-engine.ts` (`setTaskMarks`, head marks,
`onTalk`, keepers in villages); `engine.model.ts` `onTalk`; side-scroller (talk window, Tasks rows, `tickTasks`);
`check-meaning.js` (givers are NPCs: role, lines, placed; task rewards are sources, deliveries uses);
`economy-sim.mjs --town-tasks`; e2e `e2e/td-quests.spec.ts`; shots `docs/handoff/cozy-ui/quests-*.jpg`.

## Not done
A giver's own portrait (they use a seeded look); visits that hand an item to another NPC.
