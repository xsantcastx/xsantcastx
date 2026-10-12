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
