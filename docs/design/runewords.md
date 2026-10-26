# Runes, sockets and runewords (D2-style)

The owner asked for this on 2026-10-26, and it is now canon (`docs/world/canon.md` §6.2). The DM reviewed it the same day.

Code:
- `shared/rune-forge/{rune-stack,rune-forge.service}.ts`;
- `shared/enchanting/{socket.model,socket-words,socketing.service,rune-lines,runewords.i18n}.ts`;
- `shared/loot/drop-tables.ts`;
- `InventoryService.socketRune`, and `inventory-ops` (`socketOpId`, `socketRefunds`, and the socket union in
  `mergeInventoryLedgers`).

## 1. Runes

- **Runes drop only from monsters.** Nobody strikes, buys or crafts one. The Rune Forge is gone.
  - Retired non-monster sources now pay the rune's sell value in Gold instead (`RuneForgeService.payInstead`):
    expedition finds, thrall rolls, a Reels prize, the streak chest and NPC mission rewards.
- **A held rune is a satchel stack:** `rune-<id>`, for example `rune-ash`.
  - Each pile takes one 1×1 cell. A pile holds up to 999.
  - Stacks move between the satchel and the Vault and drop to the ground like any other stack.
  - A full satchel with no pile of that rune refuses the pickup. The rune stays on the ground.
- **The ladder.** The tier is set by the creature's level, which is its zone's level plus the difficulty's `level`.
  The table is `RUNE_LEVEL` in `drop-tables.ts`. The room on the Hearth rolls loot with these same modules.

| Tier | Runes | Zone level |
|---|---|---|
| common | Ash, Ember, Drift, Shade | 1+ (Ember Isle) |
| uncommon | Glint, Veil, Pulse, Thorn, Scorch | 8+ (the Reach) |
| rare | Nexus, Sigil, Rift, Hollow | 15+ (the Wilds) |
| epic | Fracture, Eclipse, Forge | 26+ (the Marches; Nightmare +20, so nearly anywhere) |
| legendary | Aether, Nox, Codex | 35+ (the Peaks) |
| mythic | Convergence, Godstone | 45+ (the Expanse; Hell +40, so anywhere) |
| singular | Void | Hell only (the `runeCap` of Normal and Nightmare is mythic) |

- **Drop rates.** These are pinned by `economy-sim --check` (the loot scenario, which checks the rune ceilings).
  - A kill drops a rune at this chance: normal 2%, champion 12%, unique 25%, boss 60%. The difficulty's
    `itemChance` multiplies it.
  - The tier is then chosen with these weights, among the tiers the level opens:
    - common 1;
    - uncommon 0.16;
    - rare 0.012;
    - epic 0.002;
    - legendary 0.0003;
    - mythic 0.00004;
    - singular 0.000002.
  - At zone level 20 a rune drop is about 85.3% common, 13.7% uncommon and 1.0% rare.
  - In Hell at level 50+ it is about 85.2% common, 13.6% uncommon, 1.0% rare, 0.17% epic, 0.026% legendary,
    0.0034% mythic and 0.00017% Void.
- **What a rune does, in D2's two lines** (`rune-lines.ts`):
  - **In a weapon** it adds its channel stat (`SOCKET_CHANNEL`).
  - **In armour** it adds its realm's resist (`aura-sources.ts RUNE_ELEMENT`).

## 2. Sockets

- **Only a normal (white) item can roll sockets, and only once, when it drops** (`rollSockets`, `LootService.grantDrop`).
  - The roll uses its own seeded stream, so the stats and the grave roll do not move.
  - About one white in three (`WHITE_SOCKET_CHANCE` = 0.34) comes up socketed, with 1 to the cap, uniform.
- **The cap** is the base type's maximum (`BASE_SOCKET_MAX`) or the item level's cap, whichever is lower.
  - Base maximums:
    - dagger and wand 2;
    - sword, mace and axe 3;
    - greatsword, hammer, spear, bow and crossbow 4;
    - staff 5;
    - shield 4, tome 2;
    - helm and crown 3; hood and circlet 2;
    - plate 4; robe and coat 3; legs 2.
    - Gloves, boots, belts, jewellery and tools never roll sockets.
  - Item level caps (canon): 1–14 gives 2, 15–29 gives 3, 30+ gives 4. Shields and staves get +1.
- **The count is the length of `GameItem.sockets`.** Empty wells are `null`, so `[null, null]` is two empty sockets.
  - No new save field was needed. The packed v3 format (`so`) and trade-core (≤ 8 wells) already carry the array,
    empty wells included. `scripts/trade-core.test.mjs` pins the round trip.
  - An old item with runes set keeps every rune and keeps its wells.
- **Names, D2's way** (`piece-look.ts itemNameTone`):
  - A socketed normal base reads grey (`--cozy-loot-socketed`).
  - A runeword shows the word's name in gold (`--cozy-loot-runeword`), with the base under it in the hover card.
- **The Smith sells normal bases with empty wells** (shops.md). These are the Enchanting Table's supply.

## 3. Setting a rune

- **Where.** Only at an Enchanting Table: Idris Calder in the Seamworks, plus a table in each capital. This follows
  canon ("runewords are made only at the Enchanting Table").
  - The table's panel opens the table (`SocketingService.setAtTable`), the same way the Vault opens the stash.
  - Anywhere else, a rune dropped onto an item is refused: "Set runes at an Enchanting Table."
- **How.** Drag a rune pile onto a socketed piece in the table's satchel grid.
  - On a phone: long-press the rune, then tap the piece.
  - The table's own "Add a rune" button does the same thing, with the ritual mini-game.
  - The rune goes into the next empty well, left to right.
- **Refusals.** Nothing is spent when the piece:
  - has no sockets;
  - is full;
  - is worn (take it off first).
- **Permanent.** There is no removal: "A rune in a socket is a promise the gear has to keep." The old unsocket,
  which cost Gold, is gone.
- **One write.** `InventoryService.socketRune` records the rune's consume op `sock:<item>:<well>:<rune>` and the
  record's new wells in a single ledger write. A replay is a no-op.

## 4. Merge safety

- **Wells only fill.** When copies of an item are merged, a well set on either device stays set, whichever copy of
  the record won (`mergeInventoryLedgers`). A temper on one device and a socket on another both survive.
- **One well, two runes.** Suppose two devices set different runes into the same well offline. The winner's rune
  stays in the well. The other rune's consume op still names that well, so `socketRefunds` grants it back, once, as
  `sockback:<op id>`. Nothing is lost.

## 5. The migration of forged runes

- **When.** On the ledger's load (`RuneForgeService.migrate`).
- **What moves.** Every count in the old Rune Forge ledger (`godforge-runes.runes`) becomes a satchel stack of the
  same rune. A forged rune is a rune: same id, same tier, same use. The grant op is `runemig:<rune id>`.
- **Once only.** After the grants the counts are emptied and the save is stamped `migrated: 1`, in the same tick.
  - Two devices write the same op id, so the merge keeps one grant.
  - A cloud copy that brings the unmigrated blob back finds the op already there and lands nothing twice.
- **What stays.** First-found dates (the Codex), strikes and Gold spent stay on the ledger.
- **Forge Runewords.** The Forge's consumed account Runewords (First Light and the rest) can no longer be crafted.
  Words already crafted keep paying.

## 6. The runewords

Rules for every word:
- **Base.** A normal base of one of the listed types, with exactly the word's number of wells, filled in order.
- **Stats.** The word's fixed stats are added on top of the base and its runes.
- **Aura.** An aura's level comes from the word's rarest rune (`aura-sources.ts`).
- **Names.** Names are proper names and stay English. Lore and clues are EN + ES (`runewords.i18n.ts`).

| Word | Runes, in order | Bases | Pays |
|---|---|---|---|
| Cinderling | Ember · Ash | sword, dagger, greatsword | +18% attack damage, +2–5 damage, 2% life steal |
| Hearthguard | Shade · Ember | shield | +20 defence, +15 life, +15% cold resist, +5% block |
| Wayfarer | Drift · Shade | plate, robe, coat | +20 life, +15 defence, +8% MF, +6% GF |
| Mothlight | Ash · Drift | helm, hood, crown, circlet | +10 life, +12 mana, +6% XP |
| Ashwake | Ember · Drift | staff, wand | +20% spell damage, +8% cast speed, +15 mana |
| Brandoath | Thorn · Scorch · Ember | blades and hafts | +35% attack damage, +10% attack speed, +4% crit, Might |
| Stormglass | Glint · Pulse · Drift | bow, crossbow | +30% attack damage, +10% pierce, +15% lightning resist, Holy Shock |
| Rimeveil | Veil · Shade · Veil | body armour | +40 defence, +30 life, +30% cold resist, Holy Freeze |
| Mercyroot | Thorn · Veil · Ash | shield | +12% block, +35 defence, +25 life, Redemption |
| Vigil | Shade · Ash · Glint | helms | +25 life, +2 regen, +8% all resists, Prayer |
| The Archivist's Ledger | Sigil · Codex · Ash | helms | +25% XP, +30% MF, +40 mana, +1 skills |
| Verdict | Hollow · Sigil · Nexus · Rift | mace, hammer, axe, spear | +80% attack damage, +12 max damage, +8% crit, 5% life steal, Conviction |
| Riftwalk | Rift · Nexus · Hollow · Pulse | body armour | +60 life, +60 defence, +15% all resists, +4 regen, Vigor |
| Emberseam | Ember · Scorch · Forge · Ash | staff | +60% spell damage, +15% cast speed, +1 skills, +20% fire resist, Holy Fire |
| Daybreak | Aether · Glint · Ash · Sigil | shield | +20% block, +120 defence, +30% all resists, +60 life, Prayer |
| Eclipse Blade | Eclipse · Nox · Fracture · Aether | blades | +120% attack damage, +20% attack speed, +12% crit, 8% life steal, +20% all resists, Conviction |
| Godforge Weld | Godstone · Convergence · Forge · Fracture · Ember | staff (5 wells) | +150% spell damage, +30% cast speed, +3 skills, +40% all resists, +100 life, Fanaticism |
| Voidmark | Void · Eclipse · Nox · Hollow | blades | +150% attack damage, +30% attack speed, +20% crit, 12% life steal, +40% all resists, +2 skills, Conviction (Hell only) |

**The DM's renames** (2026-10-26):
- These keep shipped socket-word names alive:
  - Kindling became Cinderling;
  - Roadworn became Wayfarer;
  - Lamplight became Mothlight (it clashed with the Lamplighter);
  - Tinder became Ashwake (it clashed with *Tinder's Due*).
- Hearthward became Hearthguard, because Hearthward is the recall spell.
- Godforge Seal became Godforge Weld, because the act Seals are story items.

**Not built yet: Eclipse Words.** Canon says a word whose last rune is set during an eclipse gains an eclipse line.

## 7. Where each crafting bench recipe went

The bench is gone (canon §6.2). Each recipe now has exactly one home (`crafting.model.ts recipeStation`).
- **Kael's Anvil** (the `crafting` panel, Kael's old Rune Forge stall in the Seamworks):
  - every weapon, armour and tool recipe;
  - Kael's Seam Pick pattern;
  - the whole Delve kit: torches, ladders, platforms, chests, the camp, supports and charges;
  - the rods and the Seam Bucket;
  - the Underhearth kit: rope, rail, cart, grapple, anchor and the coal torch;
  - rivet smelting;
  - the Rift sigils, lenses and keys.
- **The Enchanting Table** (Idris Calder, its "Charms and Brews" counter, panel `brews`):
  - every charm;
  - every consumable: the elixirs, teas, tinctures, vials, phials, scrolls and capsules;
  - every Lampfish Oil rendering.
- Nothing was removed and nothing was orphaned: `check:meaning` is green and every item keeps its source and its use.
- Rune ingredients (Cindergnaw, Crown of the First Dawn and the others) are consumed from the satchel's rune stacks
  in the same write as the materials.
- Mara Voss stays at Kael's anvil as his Seamwright. Her repair counter is canon but not built yet.
