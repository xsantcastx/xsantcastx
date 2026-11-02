# Quick wins: item hotkeys, status badges, stacks on the room's ground (branch `quickwins`, 2026-11-02)

Base `c10c703c`. Screenshots: `docs/handoff/quickwins/` (status badges iso/classic × 1280/390, the hotkey food at
1280/390, the drop bar and the pile ×3). Verb matrix: `docs/design/verb-matrix.md` (Belt / hotkey column, T1 ground half, T3).

## What a player gets
- **Every usable stack on a hotkey** (the owner's cooked fish).
  - Three item hotkeys on the belt beside Q / R / F, on keys 9, 0 and - (`quick1`–`quick3`, rebindable in Keys).
  - Drag a stack from the satchel onto one (the bottom bar's on a desktop, the satchel's belt anywhere). On a phone,
    tap it, then tap the slot. Or press the card's **Put on hotkey** (the first free slot); **Off the hotkey** takes it back.
  - The key does what the card's one action does: a potion is drunk (that potion, on the shared cooldown), a meal eaten,
    a raw fish cooked at the fire in reach, a Town Portal scroll read, a log lit at your feet, a crate opened.
  - Materials, runes, bait and the Tinderbox have no use there: no button, and the slot refuses them.
  - The count is on the glass. At none the slot keeps its kind, greyed; it fills again by itself on a pickup.
  - The slots ride the settings blob, beside the key bindings, so they follow the account to every device and survive
    a reload. They are account-wide (an alt without the kind sees it greyed).
  - A phone's HUD shows only the slots that hold something; the satchel's belt shows all three.
- **D2-style status badges over heads**: the Keeper, party members, other Keepers and creatures.
  - Kinds: stunned, frozen, rooted, afraid, taunted, held by your threat (party), burning, poisoned (spores), bleeding,
    cursed, chilled, slowed, blinded, hushed, darkened, wet, stripped, sundered, shielded (any ward), mending
    (Hearthlight, a meal), hasted.
  - 9×9 pixel badges in the cozy palette with one dark outline, most telling first. At most 4, then "+N".
  - A duration ring (its share of the frame lit), and a blink in the last 1.5 s.
  - Reduced motion: no blink. Low detail: no ring and no blink. Never on the minimap.
  - Anchored with the engine's own `at()` (iso screen anchor over the HD figure's head, or top-down): over a creature's
    name, an elite's plate, the Keeper's head, a Keeper's name plate.
- **Stacks on the shared online ground** (T1, ground half).
  - Dropping a stack of more than one opens "How many … to drop?" (−, amount, +, All N, **Drop**; it starts at the cell's
    count). This is the trade window's bar, in a small wood window above the HUD's foot.
  - Online (signed in, a room that trades) the amount lies on the room's ground as one pile "Name ×N". It leaves the
    satchel at once (held back in the view until the server's consume op is read back, never consumed twice locally).
  - Other Keepers see it and take it whole: the first allowed take wins, and a full satchel refuses.
  - Offline, or as a guest, it lies on this screen's ground as before.

## Where it lives
- `shared/belt/`:
  - `quick-belt-slots.ts`: no imports; the saved shape, `cleanBelt`, `assignBelt`, `slotFor`;
  - `quick-belt.model.ts`: `beltUseOf`, and `BELT_MATRIX`, the verb matrix's column as data;
  - `quick-belt.service.ts`.
- Settings blob: `sound-settings.model.ts` `belt`, `SoundService.setBelt`. Keys: `keymap.model.ts` `quick1-3`.
- Host (`side-scroller`): `useQuick`, `useStack` (the card actions refactored into `eatStack`, `cookHere`,
  `lightStack`, `openCrateOf`; potions through `PotionService.drinkId`), `quickTarget`, `quickPicked`, the templates
  (`.td-belt` phone, `.book-belt__quick`, card button). The bottom bar: `hud-bar` (imports `DropTargetDirective`).
- Badges: `play/td/td-status-icons.ts`: the kinds, art, ring and blink, `keeperStatuses`, `mobStatuses`, and the
  presence word `encodeStatuses` / `decodeStatuses`.
  - Engine: `keeperBadges`, `statusPresence`, drawn in `drawFightUi` (self and creatures) and `drawWorldUi` (peers).
  - `data-status-badges` on the canvas for the specs. `MobSystem.mending` is new.
  - The old `drawKeeperStatus` is gone.
  - Peers: `TdPeers.statusesOf` runs each word's seconds down locally.
- Ground stacks:
  - `functions-game/src/trade-core.ts`: `dropItem` takes a stack offer with a press name `n` (`dropGroundId`), runs
    `takeStack`, and the `GroundDoc` gains `sk`/`qty`; `landGround` gives a pile with `giveStack`.
  - `scripts/social-server.mjs`: `layDrop` and the protocol-6 `/ground/drop` carry `sk`/`qty`.
  - Client: `GroundFlow.dropStack` / `heldBack` / `pendingStacks`; `TradeHud.dropStack` / `askDrop` / `canDropStack`
    and the stack pickup; `side-scroller` `dropStackToGround` → `layStack`; `bagView` subtracts what is held back;
    `TdEngine.setSharedGround` draws a pile as its material.

## Server: redeploy both (not done)
- **Hearth (`scripts/social-server.mjs`) changed:** presence `sts` (the badges), and stack piles in `layDrop` and
  `/ground/drop`. An old room ignores `sts` and refuses a stack lay with 400, which is told as "Could not drop it".
- **functions-game (`trade-core.ts`) changed:** stack drops and stack landings. The hearth bundles trade-core at build
  (`world-sim-build.mjs`), so the hearth deploy carries it too. The trade Function needs its own deploy for protocol 6.

## Tests
- Karma:
  - `shared/belt/quick-belt.spec.ts` (data-driven over `BELT_MATRIX`);
  - `play/td/td-status-icons.spec.ts`;
  - `sound.spec` (the blob's new field).
- Node:
  - `scripts/trade-core.test.mjs` +2 (a pile out as one op, the re-count, two presses two piles, the race, a pile home on expiry);
  - `scripts/social-m2.test.mjs` +1 (the room lays ×N, refuses a forged count, the first take wins);
  - `scripts/social-server.test.mjs` (`sts`).
- e2e:
  - `e2e/td-quick-belt.spec.ts` (desktop drag + 9, greyed, refill, reload; card path; phone tap-assign; badge shots
    iso/classic × 1280/390);
  - `e2e/td-ground-stacks.spec.ts` (two Keepers, SOCIAL_FAKE_TRADE).

## Not built
- Taking part of a pile (it is taken whole).
- Hotkey slots per character.
- The healer's buffs on other Keepers are drawn from their own screen's word, which only covers what that screen
  knows: wards, mending and haste. The room does not carry Keeper statuses.
