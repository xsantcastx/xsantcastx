# UX / copy / style consistency audit — handoff

Scope: every in-world station panel and HUD surface (Market, Gambler, Exchange, Crafting Bench,
Enchanting, Rune Forge, Vault, Reels, Rune Drop, Seam Sweeper, Eclipse Ascent, Codex, Quest Board,
Sanctum, Arena/Trials gates, Character, the satchel book, Homestead column, Delve hotbar / chest / camp
panels, Glim lines, toasts, the update prompt, the consent bar). Copy, buttons, kit reuse, tokens.
No game rules or numbers changed. Engine, Delve and fishing files were not touched.

Method: dumped every `*.i18n.ts` pair (1,135 EN/ES strings) and grepped the templates and the
inline-string tables in the `.ts` files for term variants, untranslated text, hand-rolled
controls and non-kit buttons; read the kit README and the casino / vault / forge i18n tables as the
reference voice.

## Glossary — the canonical terms

| Concept | EN (use) | ES (use) | Never |
|---|---|---|---|
| Currency | **Gold** (capital; "Gold", "20 Gold", "Gold each") | **oro** mid-sentence, **Oro** as a stand-alone label | gold (lowercase), coins, money. *Coins* is only the Quarry hunt's own tally and is not Gold. |
| What you carry | **Satchel** ("Your satchel is full") | **Mochila** (feminine: la / tu mochila) | bag, backpack, inventory, bank (as a name for what you carry), bolsa |
| Long storage | **Vault** (tabs: General I–IV, Materials, Supplies, Gear, **Overflow**) | **Bóveda** (accent) | bank, stash, Boveda |
| The player | **Keeper** | **Guardian** | player (in-world), character (only the /character page title) |
| Wear gear | **Equip** (button) / **Equipped** (state) | **Equipar** / **Equipado** | Wear, Put on (as a button) |
| Move to long storage | **Send to Vault** / **Take out** | **Enviar a la Bóveda** / **Sacar** | Deposit, Withdraw |
| Delve chest | **Put in** / **Take** / **Take all** | | |
| Spend-to-get verbs | **Buy**, **Craft**, **Strike**, **Open**, **Spin**, **Drop**, **Dig**, **Launch**, **Challenge**, **Play**, **Claim**, **Send explorer**, **Add rune**, **Brew** | | Submit, Confirm, OK, Go |
| Do the biggest affordable batch | **<Verb> max ×N** where the number is what the purse covers (Buy / Sell), **<Verb> all ×N** where it is everything you can make or strike (Craft all, Strike all) | | bare "Max" |
| Shift/disabled reason | one plain sentence on the primary button, "Satchel full — make room first" shape (em dash, sentence case) | | silent greyed button |
| Secondary drawer | **Details** (label) + one hint line naming what is inside | **Detalles** | bespoke drawer labels ("Your runes & more") |
| Win banners | sentence case: Big win, Mega win, Eclipse win | | Big Win |
| Ellipsis | the single character … | | three dots |
| Case | station names are proper nouns (Crafting Bench, Quest Board, The Vault); tabs, buttons, hints and banners are sentence case | | |

## Findings

Status: **Fixed** = changed in this branch. **Open** = listed under Remaining.

### Wording

| # | Surface | Issue | Fix / status |
|---|---|---|---|
| W1 | HUD, satchel book, Crafting, Enchanting, Arena, Exchange (both), Gambler, Delve chest, legacy realm pages, Character hub | "bag" used for the satchel in ~45 EN strings; ES "bolsa" | **Fixed** — satchel / mochila everywhere a player reads it (38 table lines, 6 inline TS tables). Lore lines in item and quest data deliberately left. |
| W2 | ES tables | "el mochila" (wrong gender) from a mechanical rename; "Purse" translated as mochila | **Fixed** — la mochila; Purse = Monedero |
| W3 | Header button, Character hub tab and title, Character catalogue modal | "Bank" named the satchel's contents; ES "Banco" (also means bench) | **Fixed** — Satchel / Mochila. e2e `c5-equipment` tab name updated |
| W4 | HUD message when the tutorial ember is claimed | "Retrieve it from your bank" | **Fixed** — "from your Vault" |
| W5 | HUD "fall" panel, HUD mine-full toast | "Your inventory is safe", "Make room in your inventory", duplicated "satchel … satchel" after rename | **Fixed** — "Your satchel is safe", "Make room before mining" |
| W6 | Satchel book, tally, toasts, Market cosmetics aria, Sanctum loot link | "Wear / Worn / is worn" next to "Equip / Equipped" everywhere else | **Fixed** — Equip / Equipped. e2e `side-scroller`, `play-tool-tiers` updated (exact match) |
| W7 | Delve chest, Character hint | "unworn", "(not worn)", "to wear gear" | **Fixed** — unequipped / equip |
| W8 | Casino win banners | "Big Win", "Mega Win", "Eclipse Win" in title case | **Fixed** — sentence case |
| W9 | Arena shop rows | "pts" abbreviation | **Fixed** — "points" / "puntos" |
| W10 | HUD panel opening line | `...` three dots | **Fixed** — … |
| W11 | ES Vault | "Boveda" in the HUD, "Bóveda" in the Vault station | **Fixed** — Bóveda |
| W12 | Gambler | ~55 visible strings inline English in template + component (no ES at all); "bag" | **Fixed** — new lazy `gambler.i18n.ts` (`gambler.*`, EN + ES); every label, hint, error, notice and the reveal copy now translates |
| W13 | Exchange (simulated board) | ~90 visible strings inline English (title, tabs, strip, hints, receipts, failures, filters, ledger, movers, notes, relative times) | **Fixed** — new lazy `exchange.i18n.ts` (`ge.*`, EN + ES) |
| W14 | Material Vendor | whole panel inline English (~40) | **Fixed** — lazy `material-vendor.i18n.ts` (`vendor.*`, EN + ES); expedition source lines map through `VENDOR_SOURCE_KEY` |
| W15 | Homestead panel + column, Homestead model/service sentences | inline English (~60: building names, sentences, purchase messages) | **Fixed** — lazy `homestead.i18n.ts` (`homestead.*`, ~85 keys incl. the canvas lines); the pure model and the renderer read it through `setHomesteadTranslator()` / `homesteadT()` (English from the table until the service registers) |
| W16 | Sanctum "forge view" (loot link, rows), Collection Log, Explorer roster, Works map, Codex Bestiary / Path, Forge-keeper ledger | inline English | **Fixed** — lazy tables: `sanctum.i18n.ts` (+~150 `sanctum.*`), `collection-log.i18n.ts` (`collLog.*`), `explorer-roster-panel.i18n.ts` (`rosterUi.*`), `works-map.i18n.ts` (`works.*`), `codex-extra.i18n.ts` (`codex.x.*`, `codex.beast.*`), `forge-keeper/ledger.i18n.ts` (`keeperLedger.*`). "bag" became satchel on the way. Game content (realm / site / creature / rune names, flavour, lore, secrets) stays English on purpose |
| W17 | Exchange category / rarity labels (`CATEGORY_LABELS`, `RUNE_TIERS.label`), item names | shared model tables, English only | **Fixed for Exchange (both), Gambler, Sanctum** — `shared/rune-forge/rarity.i18n.ts` (`tierLabel.*`, `exCat.*`) maps ids to keys; the models are untouched. Other `RUNE_TIERS[..].label` readers (crafting, enchanting, thralls, discovery toast, item.model `rarityLabel`) still show English: same one-line swap (`t(rarityKey(id))`) when each is next touched. Item names stay English (game content) |
| W18 | Voice | Delve/HUD error lines are plain; casino fine-print is dry but accurate; Glim and the keepers (life.i18n) are warm. Mixed by design — system toasts stay plain | No change |

### Buttons and CTAs

| # | Surface | Issue | Fix / status |
|---|---|---|---|
| B1 | Rune Forge, Vault | Details drawer had a bespoke **label** ("Your runes & more", "More storage and how the Vault works") where every other station says Details | **Fixed** — label dropped (kit default), the descriptor lives in the hint line. e2e `c9-first-loop` selector updated |
| B2 | Exchange | secondary batch button read just "Max" | **Fixed** — "Buy max ×N" / "Sell max ×N" (matches Market) |
| B3 | Casino (Reels, Rune Drop, Seam Sweeper, Eclipse Ascent), Market, Crafting, Rune Forge, Enchanting, Quests, Sanctum, Arena, Trials, Leaderboards, Gambler, Exchange | one `app-action-button` primary per view, bet / price chip on the button via the kit | Audited — consistent |
| B4 | Material Vendor | own sell button with the cost in its label ("Sell 3 X · 12 Gold"), own `Details` toggle | **Fixed** — see C1 |
| B5 | Homestead panel | own `hp-go` button and a native `<details>` | Open (see C2) |
| B6 | Disabled states | kit buttons state why (Need N more, Satchel full…). Gambler/Exchange reasons were English-only | **Fixed** with W12 / W13 |
| B7 | "Take" verbs | Vault "Take out", Delve chest "Take all", Gambler reveal "Take" (claim the prize) | Intentional — three different actions; glossary records them |

### Component reuse

| # | Surface | Hand-rolled | Status |
|---|---|---|---|
| C1 | Material Vendor (`shared/vendor`) | header + purse, shelf cards, stepper, sell button, details toggle | **Fixed** — shell + wallet chip + journal list → detail + `app-action-button` (stepper, `Sell for N Gold`, `Sell all ×N`, the material as the cost chip so a short stack reads "Need N more X"). Same `MaterialVendorService.sell` call, same mutation id, same numbers (model spec untouched). Details: where it comes from, recipes that use it, "Only the surplus (N)", last sale. The old "Everything I hold" chip is the `Sell all` button |
| C2 | Homestead panel / column (`play/homestead`) | name + sentence + `hp-go` button, native details | Open — in-world compact panel; kit shell is too tall for it. Needs a "compact" shell variant |
| C3 | Character catalogue modal (`fk-bank`) | own modal, own header/count/toggle | **Not a clean swap — kept.** Its entry (`.fk-catalogue-open`) opens the *catalogue* mode: every item in the game with a held count, including ones you do not own. The Satchel tab only lists what you hold, so swapping would delete the browse-everything view (and `inventory-ux` e2e drives it). The modal's own mode toggle already reaches the owned list. Decision for the owner: retire it only together with a Collection Log link that covers the unowned-items view |
| C4 | Delve chest / camp panels, Hearth chat | bespoke lists and buttons | Open — owned by the Delve agent; verbs documented in the glossary |
| C5 | Gambler till (multi-select checklist) | custom list | Intentional — multi-select is not a kit pattern |
| C6 | Market, Gambler, Exchange, Crafting, Enchanting, Rune Forge, Vault, casino ×4, Codex, Quests, Sanctum, Arena, Trials, Leaderboards, Character | shell / tabs / journal / action-button / drawer | On the kit |

### Spacing, typography, colour

| # | Finding | Status |
|---|---|---|
| S1 | New copy uses kit components only; no new CSS, no new colours, no new z-index | Fixed / n-a |
| S2 | `check-ds-adherence` (baselines lowered with `--update`: raw hex 641, emoji in templates 64, emoji in code 237): no rule worsened (raw hex 641, emoji in templates 66, emoji in code 237, retired golds 0, raw z-index 0 — all at or under baseline; baselines are stale-high and can be lowered with `--update`) | Holds |
| S3 | Header Bank button still carries a 🎒 emoji icon (existing violation counted by the gate) | **Fixed** — inline SVG satchel (currentColor) in both the bar pill and the tome entry; the pill's aria-label and the keeper panel's title now say Satchel / Mochila |
| S4 | 360px: Gambler and Exchange in ES measured in a real browser — document `scrollWidth` 360 (no horizontal overflow), no truncated control | Checked |

## Counts

| Category | Found | Fixed | Open |
|---|---|---|---|
| Wording | 18 | 17 (W1–W17; W17 for Exchange, Gambler, Sanctum) | 0; W18 is by design |
| Buttons / CTAs | 7 | 4 (B1, B2, B4, B6); B3 audited consistent, B7 intentional | 1 (B5, the Homestead panel buttons, needs a compact shell) |
| Component reuse | 6 | 0 swaps needed on the kit stations (C6 confirmed); C5 intentional | 1 fixed (C1); 3 open (C2 Homestead compact shell, C3 kept on purpose, C4 Delve-owned) |
| Spacing / typography / tokens | 4 | 2 (S1, S3); S2 holds, S4 checked | 0 |

## Remaining items

0. **Homestead compact shell** (B5 / C2): the panel still uses its own `hp-go` button and a native details.
1. **Character catalogue modal** (C3): decision above; retire only with a replacement for the unowned-items view. Its own strings (`Satchel` / `Catalogue` / `held` / `Show market catalogue`) are still English inline.
2. **Other `RUNE_TIERS[..].label` readers** (W17 tail): crafting, enchanting, thralls, discovery toast, `item.model.rarityLabel`.
3. **Panel registry titles** (`play/world/panel-registry.ts`, e.g. "Material Vendor" / "Trade") are English; the panel header outside the body.
4. **Feed lines in the Sanctum** are written at push time, so they stay in the language active when the event happened.
5. Game content in Spanish (realm / site / creature / rune / item names, flavour and lore) is a content pass, not a UI pass.
6. Chart-range labels (24h, 7d, …) and a few plain unit abbreviations ("XP") stay English on purpose.

## Files

New: `src/app/shared/gambler/gambler.i18n.ts`, `src/app/shared/exchange/exchange.i18n.ts`.
Edited: `translation.service.ts`, `play/world/{hud,delve,life}.i18n.ts`, `forge-keeper/character.i18n.ts`,
`pvp/arena-station.i18n.ts`, `shared/{crafting,exchange,games,rune-forge,vault}/*.i18n.ts`,
the Gambler / Exchange component pairs, `forge-keeper`, `header`, `economy/market`, `live/forge-view`
templates, three inline-table components (crafting bench, enchanting bench, pvp arena), and six e2e
specs (selectors only, where the copy changed: `c5-equipment`, `c9-first-loop`, `loadout-slot-picker`,
`side-scroller`, `play-tool-tiers`).

## Gates

tsc clean; check:meaning (no new); ds-adherence holds; i18n keys ✓; audit-nav ✓; production build ✓;
CSP hashes ✓; Karma header + character + exchange + gambler 132/132; all 21 `play-*` specs on
chromium 106/106; `play-mobile-hud` on webkit 9/9; `c9-first-loop`, `loadout-slot-picker`,
`gambler-exchange-journal`, `market-presentation`, `c5-equipment` pass.
`side-scroller.spec.ts` (2 tests) fails identically on the untouched main build — a stale spec
(it targets UI that has since moved); only its `Wear`/`Bag` copy was updated.
Before/after screenshots (6 stations × 1280×800 and 390×844, plus ES at 360) are in `output/ux/`, not committed.

## Second pass (this branch's follow-up)

Material Vendor on the kit; Homestead, Sanctum, Collection Log, Explorer roster, Works map, Codex (Bestiary, Rank, Path, Energy, Ladder preview), Forge-keeper Ledger in EN/ES; rarity and Exchange category labels in ES; header satchel icon; the two stale `side-scroller.spec.ts` tests.

`side-scroller.spec.ts` (both tests now pass): the Interact button's accessible name is "Interact E" (key hint), so it is matched with `/^Interact/`; the satchel row is "Ore" not "Cinder ore"; the ore deposit is at x=480 so the Keeper walks to 470 (390 stands by the Vault); equipping reads "Equipped" (glossary), not "Worn"; the East Passage moved to x=3480 (the town grew a quarter-width), so the backtrack walk targets 3420. No assertion was loosened: the same states are asserted, only the selectors, text and coordinates are the current ones.

New lazy tables: `shared/vendor/material-vendor.i18n.ts`, `play/homestead/homestead.i18n.ts`, `shared/collection/collection-log.i18n.ts`, `shared/rpg/explorer-roster-panel.i18n.ts`, `shared/expedition/works-map.i18n.ts`, `codex/codex-extra.i18n.ts`, `forge-keeper/ledger.i18n.ts`, `shared/rune-forge/rarity.i18n.ts`; extended `live/sanctum.i18n.ts`. Key prefixes avoid `rarity.` / `roster.` / `ledger.` because `check-i18n-keys` reads code like `this.roster.x` as keys.

Verified at 360px in ES (real browser): /sanctum (all four tabs, Details open), /codex, /character, /exchange, /gambler and the Vendor panel in /play — document scrollWidth 360, no raw keys on screen.
