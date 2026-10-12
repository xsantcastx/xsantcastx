# Station UI kit

Every "place" in Eclipse Realms where the player *does a thing for a price*
(Enchanting Table, Crafting Bench, Rune Forge — next: Market, Gambler,
Exchange, Sanctum, Codex, Quests, Arena, Trials, Leaderboards, Character) is
built from these pieces. The owner's brief:

> "It needs to be for dummies, easy to understand — just click here to enchant
> and the money cost." / "improve all menus, to be very game-like and fun."

The owner's reference is MapleStory's *Crafting Journal* — copy its anatomy,
in our dark/gold language:

```
┌ Title ─────────────────────────────── [wallet] ┐
│ [Tab][Tab][Tab][Tab]                            │  app-station-tabs   (stationTabs + a second row in the hero)
│ (icon) LEVEL 4  [██████░░░░ 1,200/3,000 XP]     │  app-skill-strip    (stationSkill)
│ Gather materials in the realms, then craft here.│    ↳ ONE line: where / how
│ ┌ list ────────┐ ┌ detail ───────────────────┐  │  app-station-journal
│ │(i) Kris      │ │ (BIG) Briarvein Kris      │  │    app-journal-list   (journalList)
│ │    LEVEL 1  ◀│ │       Craft 1 Briarvein…  │  │    app-detail-head    (journalDetail)
│ │(i) Helm      │ ├ REQUIRED TOOLS ───────────┤  │    app-requirement-grid
│ │    LEVEL 3   │ │ (i) Anvil & hammer        │  │
│ │ …dimmed if   │ ├ REQUIRED ITEMS ───────────┤  │    app-requirement-grid
│ │   locked     │ │(i) Gold 3M/12K (i) Thorn… │  │      have/need: green met, red short
│ └──────────────┘ │ [− 1 +] [ CRAFT ] [ALL ×4]│  │    app-action-button  (stepper + all)
│                  └───────────────────────────┘  │
│ ▸ Details (lore, filters, odds, history)        │  app-details-drawer (built into the shell)
└─────────────────────────────────────────────────┘
```

On a phone (≤640px) the list becomes a horizontal icon strip above the detail.

Reference implementations: `shared/crafting/crafting-bench.component.html`
(full anatomy), `shared/enchanting/enchanting-bench.component.html` (two
journal tabs; the Additive box is a *selectable* grid), and
`shared/rune-forge/rune-forge.component.html` (`[single]` journal: one action,
no list).

## Import

```ts
import { STATION_UI, STATION_UI_I18N, forgeTabs, type StationCost, type JournalRow,
         type StationReward, type StationTab } from '../station-ui';
@Component({ imports: [...STATION_UI], ... })
constructor() { this.i18n.register(STATION_UI_I18N); this.i18n.register(MY_STATION_I18N); }
```

## The pieces

| Selector | Inputs | Outputs | Job |
|---|---|---|---|
| `app-station-shell` | `title`*, `purpose`, `showTitle` (false in-world), `detailsLabel`, `detailsHint`, `[(detailsOpen)]` | — | Frame. Slots in order: `[stationWallet]`, `[stationTabs]`, `[stationSkill]`, `[stationHero]`, default (a stage), `[stationDetails]` (the drawer). |
| `app-station-tabs` | `tabs: StationTab[]`*, `[(active)]`, `label` | `activeChange` | Tabs across the top. A tab with `route` is a link (`forgeTabs(t)` → Crafting · Enchanting · Runes). `badge` = small green count. |
| `app-skill-strip` | `art`, `level` (null hides LEVEL), `title`, `progress` 0..1, `progressLabel`, `hint` | — | Icon + LEVEL N + bar + ONE where/how line. |
| `app-station-journal` | `single` | — | Master–detail grid. Slots `[journalList]`, `[journalDetail]`. |
| `app-journal-list` | `rows: JournalRow[]`*, `selected`, `label`, `empty` | `pick: string` | Rows = icon + name + sub ("Level 3"). `locked` dims, `ready` adds a green dot, selected is gold. |
| `app-detail-head` | `name`*, `art`, `rarity`, `line`, `count`, `working` | — | Big icon + name + "Craft 1 X". |
| `app-requirement-grid` | `title`*, `costs`, `minCells`, `showCount`, `pending`, `selectable`, `selected`, `empty` | `pick: string` | Icon cells with `have/need` (green/red). `selectable` = a picker (Additive). `showCount=false` for tools. |
| `app-action-button` | `label`*, `costs` (per ONE), `chips: 'all'\|'currency'\|'none'`, `blocked`, `progress`, `pending`, `loading`, `loadingLabel`, `variant`, `stepper`, `[(quantity)]`, `stepMax`, `allCount`, `allLabel` | `act: number`, `actAll: number`, `refused: string` | The action row: `[− 1 +] [PRIMARY] [ALL ×N]`. Costs scale by quantity. When unable it says why ("Need 200 more Gold") with a progress bar, and shakes. |
| `app-cost-chip` | `cost`*, `showHave`, `nudge`, `pending`, `quiet` | — | One price with art; `quiet` = wallet readout (`need = have`). |
| `app-reward-pop` | `reward: StationReward \| null` | `dismissed` | In-flow "You got X!" card on a rarity burst. Bump `seq` per reward. |
| `app-details-drawer` | `label`, `hint`, `[(open)]` | — | Native `<details>`; the shell already has one. |

Pure helpers (`station-ui.model.ts`; `node --test scripts/station-ui.test.cjs`):
`isAffordable`, `affordProgress` (weakest line), `shortfall`, `costShort`,
`maxAffordable` (the ALL count), `formatAmount`, `priceLine`.

## Checklist

**Do**
- Follow the anatomy: tabs → skill strip → list | detail → requirement boxes → action row.
- The first screen (375×812 minus HUD) shows title, tabs, skill strip, the selected thing and its
  button. No lore. Under ~60 words before the list.
- Default to something pressable: a "Ready now" tab first when it has rows, its first row selected.
- Primary label is a verb ("Craft", "Strike the forge", "Add rune"); the detail head says the whole
  sentence ("Craft 1 Briarvein Kris").
- Prices as `StationCost[]` per ONE, Gold first. Non-money blockers go in `blocked` as a sentence.
- Build every `costs` / `rows` array in the component (on refresh, pick, Gold change) — never as a
  template literal.
- Art via `artFor()` / `runeCard()` / `itemArt()`. Never hand-write an `assets/` path.
- Keep the existing service/gateway call exactly; a quantity of N is N of the same call.
- `CelebrationService.celebrate(tier)` for the screen payoff, alongside setting `reward`.
- Strings in a lazy `<station>.i18n.ts`, `register()`ed in the constructor *before* building any
  label. EN + ES.
- Tokens + `[data-rarity]` for colour; keyframes at the stylesheet's top level; inside
  `@media (prefers-reduced-motion: reduce)` only `animation: none`.
- Import the kit only from lazily-loaded components.

**Don't**
- Don't use `disabled` on the primary — it can't explain itself (the kit uses `aria-disabled`).
- Don't put lore, odds, history, filters or stat breakdowns in the journal — `[stationDetails]`.
  Don't delete them.
- Don't use jargon in the journal ("Socket", "Infusion", "Base roll") — "Add rune", "Potions".
- Don't add a fixed overlay inside a station (routed hosts and the in-world panel trap it).
- Don't define `@keyframes` or an `animation:` shorthand inside `@media`.
- Don't add one page's strings to `translation.service.ts` (eager; the bundle is at its limit).
- Don't use emoji/Unicode glyphs as icons.
