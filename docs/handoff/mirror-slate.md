# The Mirror Slate — handoff

Owner, 2026-10-14: "I tried the slot machines and gambling, loved it — there should be an item like a phone or
tablet so we can gamble inside delves or whenever, and with that phone you can manage your factory and stuff."
ROADMAP item 2. Lore: [`docs/world/lore-addendum.md`](../world/lore-addendum.md), "The Mirror Slate" (shipped —
owner reviews in play). Art brief: [`docs/art-commissions/world-sprites/13-mirror-slate.md`](../art-commissions/world-sprites/13-mirror-slate.md).

## What a player can do now

- **Earn it.** Lune Coyne (Croupier, Nocturne Archive) hands over the **Mirror Slate** — a palm of the Archive's
  moon-mirror glass in Kael's brass — on the **tenth play** across her four tables (the Reels, Rune Drop, Seam Sweeper,
  Eclipse Ascent). Her counter and her four tables carry a one-line strip: "Ten plays at my tables and the Slate is
  yours. N to go." with ONE secondary button, **Buy the Slate · 500,000 Gold** (the shortcut). When the tenth play
  lands the strip and the message line say "Lune Coyne slides you the Mirror Slate. Press P to use it anywhere."
- **Use it anywhere.** A **Slate** button joins the top bar (desktop: after Places, with a `P` key hint; phones: a
  44 px pane icon left of the ☰ menu). **P** opens it too, and P / Escape / Close folds it. It opens in town, on a
  hunt, in the Delve and on the Homestead, as the same place panel every station uses, so the world **pauses**
  (engine park), the bands go inert, focus moves in and returns on close.
  - **Busy rule** (`slateRefusal`): never on a fallen Keeper, never with a creature in reach (the enemy bar is up),
    never with a fishing line out, the Line Tension reel up or a story card on screen. The reason goes to the message
    line ("Not mid-fight. Step away from the creature first."). Another place already open owns the keyboard, so P
    does nothing there; an open Delve map folds first.
- **Tables tab**: the four games **embedded, not copied**: the Slate creates the stalls' own panel components through
  `PANEL_REGISTRY`'s loaders, so odds, bet ladder and caps, the replay-safe play ledger, Details and celebrations are
  the same code. A play on the Slate is a play at the stall (same `PlayLedgerService.play` / `openRound`, same ids,
  same totals — it counts toward nothing extra). Gold only. The last table is remembered per device.
- **Homestead tab** (the factory at a glance, no economy numbers of its own — `HomesteadService`):
  purse and Gold/s; **Waiting for you** (the session receipt the plot shows as bubbles: Gold since you last looked,
  explorers home, runes found) with **Collect** (zeroes the receipt like walking past; credits nothing — the
  services banked it as it came in, so a reload or a double tap can never pay twice); **Next building**: ONE
  "Build <name> · cost" button for the best Gold/s per Gold you can afford (else the nearest, with "Need N more
  Gold") through the Market's receipted `purchaseListing`; **Crew**: the camp and workshop sentences, next explorer
  home; **In the world**: one line each for Crafting, the Market, the Exchange, the Vendor and the Sanctum ("walk to
  …") — places stay places.
- **Tier II** — Kael (Rune Forge, Basalt Seamworks) shows a strip while you hold a tier I Slate: "Lune's glass, my
  brass…" and ONE **Bind the second face** button with its requirement chips: the tier I pane + **6 Glowcap,
  12 Slag Fragment, 4 Obsidian block** (all Delve). The bound pane is the **Mirror Slate II**, which adds a **Map &
  bounties** tab: Pim's three bounties today with progress ("Done: claim it at the Quest Board") and your Delve map
  pins (name, cell) — read only, pointing at the map (M) and the board.
- **Badge**: a lit rivet on the Slate button when the Homestead has something worth a look: an explorer home, a rune
  found, or ten minutes of income piled up on the receipt (`slateBadge`). No push notifications.
- **Keepers**: Lune line 7 (always) "Ten plays at my tables and I hand you a Slate of the Archive's glass.", line 8
  (once you carry one) "The Slate in your pocket is my tables in Kael's brass. Same odds, printed."; Kael line 3 (once
  you carry one) "Lune's glass, my brass. Bring Glowcap, slag and obsidian; I'll wake its other face." (also a canon
  `DIALOGUE` line on the forge pages). New deed `slated`. EN + ES.

## How it works

| File | What |
|---|---|
| `shared/slate/slate-items.model.ts` | the two panes `mirror-slate` / `mirror-slate-ii`, Kael's inputs, Found in / sources / uses (no imports; read by found-in and check-meaning) |
| `shared/slate/slate.model.ts` | pure rules: `slateTier`, `tablesPlayed`, `slateAwardDue`, `slateOffer`, `slateUpgradeNeeds`, `slateTabs`, `slateRefusal` (busy rule), `slateBadge`, `SLATE_TABLES`, `CROUPIER_STATIONS`, `KAEL_STATION` |
| `shared/slate/slate.service.ts` | the only writer: `checkAward` (grant `slate:award`, once ever), `buy(pressId)` (grant `slate:buy:<press>` then `spendGold`, same tick), `upgrade` (`craftStack('slate:tier2', …)`, one ledger write) |
| `shared/slate/slate.component.*` | the Slate (lazy `import()` from the play view): tabs, the embedded game host, Homestead, Map & bounties, Details (lore, rules) |
| `shared/slate/slate-counter.component.*` | Lune's and Kael's strip, placed by the play view at the top of their panels (the stations are untouched) |
| `shared/slate/slate.i18n.ts` | every Slate string, EN + ES (lazy) |
| `play/side-scroller.component.*` | the HUD button + badge, P, `openSlate` (busy rule → `showPanel({kind:'slate', own})` → lazy load), the counters, `stage--slate`, the `.place--slate` bezel, the `slated` deed |
| `play/homestead/homestead.service.ts`, `engine/homestead-render.ts` | `snapshotHud`, `pendingAll`, `collectAll` (read/zero the display receipt) |
| `shared/economy/economy-curve.ts` | `MIRROR_SLATE = { price: 500_000, awardPlays: 10 }` (rule S) |
| `shared/art/pixel-icons.ts` | procedural `SLATE` icons for both panes |
| `shared/rpg/inventory-layout.ts` | both panes are key items (`QUEST_STACKS`: no slot) |
| collection / material-catalog / found-in / check-meaning | names, Collection Log seeds + lore, Found in lines, sources and uses; Glowcap, Slag Fragment and Obsidian block gain "Kael binds the mirror-slate-ii" as a use |

**No new save blob.** The tier is the pane held (stack totals, satchel or Vault), so cloud merge is the inventory's.
The gift is one fixed op id, the binding one fixed craft id, a purchase one op per press: replays, reloads and
merges are no-ops. Two devices buying offline each buy once (the economy op log keeps both debits; the Keeper holds
two panes — harmless).

**Price (rule S).** 500,000 Gold ≈ 3.3 min of income at the 30-minute stage, where a Keeper first reaches the
Archive; `economy-sim --check` holds it inside 1–10 min there. Ten plays at the 10-Gold minimum cost ~5 Gold on
average, so earning it is always the cheap road.

**Phone layout.** With a Slate carried the top band's right column slims (`--vit-w` 96 → 72 px) so the button sits
left of the menu without shrinking the Delve hotbar by more than 28 px; without one nothing moves (the mobile-HUD
spec's fresh saves are unchanged). The open Slate is a full-screen sheet clear of the notch and the home bar; every
tab and table is ≥ 44 px; Close and Escape stay in its head.

## Tests

- Karma `shared/slate/slate.model.spec.ts`: tiers, plays across only the four tables, the gift at ten, the offer,
  tier II needs, tabs per tier, the busy rule (unowned / fallen / fight / fishing / reel / story), the badge, the
  tables are the stalls' own panels and ledger ids, meaning rows.
- Karma `shared/slate/slate.service.spec.ts` (real PlayLedgerService + EconomyService + ReelsService): the gift on the
  tenth play, once (replays, more plays, a dropped pane never re-gift); a play from the Slate and the same play at the
  stall share idempotency (one debit, one count); the purchase spent once (funds / replay / owned); Kael's binding in
  one write, once.
- e2e `e2e/play-slate.spec.ts` at 1280×800 and 390×844: nine plays seeded → the tenth at the Reels earns it (strip
  and HUD button) → Waystone to the Seamworks → the Ember Delve → open the Slate (P / the button) → world paused →
  a pinned Reels spin on the glass lands on the ledger once → Homestead tab: Collect, Build next → reload: still
  carried, no record or purchase twice. Screenshots in `output/slate/` (not committed).

## Not done / follow-ups

- Real art (brief written: two item icons and the 9-slice bezel); `commissions.csv` rows once approved.
- A Hearth tab (later tier per the roadmap) is not built.
- The Slate shows map pins read-only; editing stays on the Delve map (M) on purpose.
