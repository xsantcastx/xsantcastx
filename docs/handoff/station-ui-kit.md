# Station UI kit — handoff

Kit: `src/app/shared/station-ui/` (full API + do/don't in its `README.md`). Lazy-only; initial bundle 1996.70 kB → 1993.72 kB.

## API (selectors)
- `app-station-shell` — title, purpose, showTitle, detailsLabel/Hint, [(detailsOpen)]; slots `[stationWallet] [stationTabs] [stationSkill] [stationHero] [stationDetails]`.
- `app-station-tabs` — tabs: StationTab[] (route → link), [(active)]. `forgeTabs(t)` = Crafting · Enchanting · Runes.
- `app-skill-strip` — art, level|null, title, progress 0..1, progressLabel, hint (one where/how line).
- `app-station-journal` [single] — slots `[journalList]` / `[journalDetail]`; ≤640px list becomes an icon strip on top.
- `app-journal-list` — rows: JournalRow[] (name, art, rarity, sub, locked, ready), selected → (pick).
- `app-detail-head` — big icon, name, line ("Craft 1 X"), count, working.
- `app-requirement-grid` — title, costs: StationCost[], minCells, showCount, selectable/selected → (pick). have/need green/red.
- `app-action-button` — label, costs (per one), chips, blocked, progress, pending, loading, stepper, [(quantity)], allCount, allLabel → (act n) (actAll n) (refused why). Says "Need 200 more Gold" + bar, shakes.
- `app-cost-chip`, `app-reward-pop` (StationReward, in-flow), `app-details-drawer`.
- Pure helpers in `station-ui.model.ts` (isAffordable, affordProgress, shortfall, maxAffordable, formatAmount) — `node --test scripts/station-ui.test.cjs`.
- i18n: each page ships a lazy `*.i18n.ts` and calls `TranslationService.register()` in its constructor; `check-i18n-keys.js` reads every `*.i18n.ts`.

## Converted (MapleStory "Crafting Journal" anatomy)
- Crafting Bench: forge tabs → Ready now/All/category tabs → crafting LEVEL strip → recipe list | detail → Required tools / Required items → [− 1 +] Craft / Craft all. Load-the-anvil step removed (same gateway call, N times).
- Enchanting Table: tabs Add runes · Potions; list = your gear / potions; Additive grid = pick a rune; Add rune / Brew. Remove-rune, stats, secret words in Details.
- Rune Forge: single journal: "A random rune", Required items = Gold, [− n +] Strike / Strike all. Library, Runewords, equipment in Details; reveal overlay unchanged.

## Next
Market, Gambler, Exchange, Sanctum, Codex, Quests, Arena, Trials, Leaderboards, Character: same anatomy — tabs per category, skill strip (or progress strip), list | detail, requirement grids, one action row; everything else in Details. Update their e2e specs in the same change (see the three forge specs edited here).

## Market · Gambler · Exchange (trade stations)
Measured at 375×812 (fresh save), the primary button now sits above the bottom tab bar on all three; first-view words ≤ 56.
- **Market** (`shared/economy/market.component.*`): shelf tabs `Can buy (n) · All · Forge · Hammers · …` (Can buy = every shelf, only what the purse covers; default when non-empty) → INCOME strip (Gold/sec · owned/total) → list (price or Free/Owned/Maxed, ×owned) | detail (head "Buy 1 X", effect, Inspect) → **Buy** / **Buy max ×N** (Gold ladders only). Buy max = the same `purchaseListing` N times, re-reading `nextCost` before each; N is previewed by walking `costOf` + Charisma + first-free + `levelCap` (mirrors `EconomyService.nextCost`; if that function changes, change `ladderMax` too). Reward pop on every purchase; wallet flash and "+X/sec" floater kept. Details: running enchantment, shelf note/tally, Scout doorway, search/rarity/ownership/sort (still URL-backed), the Eclipse (two-click arm unchanged), income ledger, catalogue picks, Gambler link, patron, footer links. Pagination dropped (list scrolls). New strings in lazy `market.i18n.ts` (`marketJ.*`); the old eager `market.*` keys that are now unreferenced (`market.buy`, `.categories`, `.page`, `.pages`, `.prev`, `.next`, `.owned.n`, `.filteredCount`, …) can be pruned from `translation.service.ts` for a small initial-bundle win — not done here.
- **Gambler** (`shared/gambler/*`): tabs `Boxes · Sell (n)` → LUCK strip (bad-luck-protection bar) → boxes | detail (odds box "What can come out") → **Open** / **Open ×N** (N ≤ 5, = `GamblerService.open` N times; stops at first refusal; the altar reveals the rarest and says "best of N"; every pull goes on the strip). Sell tab: bag items | detail → **Sell** (one) / **Sell junk ×N** (rolls < 50%, two-press arm) — both `inventory.sellMany`. Reveal markup/CSS and the `gb-host--revealing` host fix unchanged; the reveal stays outside the shell. Details: blurb, pity sentence, opened count, spent/named, fast-reveal toggle, the full multi-select Till, back link. Strings stay inline English (the component never used TranslationService).
- **Exchange** (`shared/exchange/*`): tabs `Buy · Sell` → BAG strip (rows used / cap) → list (cheapest first; Sell = only what you hold) | detail "Buy 3 Cinder Ore" → **[− n +] Buy / Max ×N** with the price chip + "You pay / You receive · tax" line. Default selection = first line the purse covers until the player picks. Buy pops a reward card. Details: price + 24h change, events, chart + ranges, supply/demand, category tabs + search/rarity/trend/min/max/owned filters + sort, today's totals, movers, ledger, the honest footnote. `blocker` still gates `confirm()`; the trade call (with the shown unit price) is unchanged.
- e2e: `e2e/market-presentation.spec.ts` rewritten for the journal; new `e2e/gambler-exchange-journal.spec.ts` (reveal topmost, Open ×5, Buy ×3 → Sell list, Buy max). Gold is seeded via `godforge-economy` `{version:2,gold}`. Close `.npc__close` first — the town NPC bubble covers the detail on phones.
- In-world: verified at 1280 and 375 via Waystone → Umbral → Gambler / Exchange (`/play?at=waystone`); Luminous → Market works the same way.
