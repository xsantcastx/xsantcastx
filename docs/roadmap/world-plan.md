# World Plan — every page becomes a place

The working build tracker for turning Eclipse Realms into one walkable world.
Update it in the same commit that lands the work; an item is only `[x]` once it
is merged to `main` **and** checked in a production build.

Last updated: 2026-10-12

Legend: `[x]` shipped · `[~]` in progress (branch named) · `[ ]` next · `[-]` later / blocked

---

## The vision

Every page in the navbar is a **place in the game world**. You walk to the
Market to shop, to the Forge to craft, to the Waystone to travel. What you buy
visibly feeds your crafting; what you kill drops loot you can see fly into your
satchel; what you equip shows on your Keeper. One inventory, one economy, one
world — and every system visible while it works.

## Decisions (made 2026-10-12)

| Question | Decision | Consequence |
|---|---|---|
| Town layout | **Five realm towns** (Infernal, Luminous, Umbral, Celestial, Verdant), joined by Waystones | Each page lives in exactly one town; nothing is duplicated |
| Navbar | **World only**: shrinks to Play + Character at the end | Must keep URLs, SEO prerenders, nav audit and an accessible "Places" list working first |
| Monster loot | **Zone-specific drop tables**, hand-authored per hunting ground | More flavour; each table needs balancing |
| Translucent art | **Solidify at import** (`SOLIDIFY` in `scripts/import-assets.py`) | Keeper is solid; same treatment available for any future see-through export |

### Where each page lives (proposal; change here, then build)

| Town | Buildings / stations | Hunting ground drops |
|---|---|---|
| **Infernal**: Basalt Seamworks | Crafting Bench, Rune Forge, Enchanting Table, Material Vendor, quest stations (ore, forge, beacon, passage) | Cinder ore, ember residue |
| **Luminous** | Market (upgrades) | Light-touched materials |
| **Umbral** | Gambler, Exchange | Shadow materials, scrolls |
| **Celestial**: Meridian Orrery | Codex (observatory), Leaderboards board | Star fragments, runes |
| **Verdant**: Rootglass Canopy | Sanctum (expeditions), Quests board, Arena gate, Trials gate | Rootglass, seeds |
| *Everywhere* | Character + Satchel overlays, Waystone, Places list | |

---

## Shipped so far

- [x] Equip bug: unaimed equip picked the wrong slot (`05adf94`)
- [x] Seamworks game feel: hit flash, knockback, hitstop, shake, death dissolve, loot arcs, HUD damage chip (`2028bd6`)
- [x] Asset diet: WebP UI icons, 3.1 MB removed (`37ffbb2`)
- [x] Gambler altar reveal + history; overlay fixed to viewport; discovery card waits for the reveal (`9803216`, `8ec4647`)
- [x] Forge floor stations on crafting / enchanting / runes (`9803216`)
- [x] The Works board on /sanctum: explorers, treasury flow, from real timestamps (`9803216`)
- [x] Equip compare (green/red), stat chips, Keeper Stats sheet, Strike Power → damage, Ward → max HP (`9803216`)
- [x] Library art: 32 images, keeper avatars in header + leaderboards, Codex Bestiary (`9803216`)
- [x] Mesh-deformation rig for the Keeper and Rivet Maw (`729dd9e`)
- [x] Keeper painting solid instead of ghostly (`05e3910`)

---

## Phase 1: World foundation `[~]`

Sequential: everything after it plugs into its data model and panel host.

- [~] World data model: `TownDef` / `StationDef` / `HuntZoneDef` / `ZoneDropTable` in `src/app/play/world/`; engine reads stations, platforms, monsters and drops from data
- [~] Infernal town rebuilt on it (Seamworks widened): Crafting Bench, Rune Forge, Enchanting Table buildings + existing quest stations + Waystone
- [~] In-world panel host: opens the existing page components over the game (pause, focus trap, Escape); `IN_WORLD_PANEL` token suppresses page backdrops / heroes
- [~] Click / tap to move and interact (`engine.moveTo`)
- [~] Deep links: `/play?at=<place>`
- [~] Waystone travel panel (only Infernal open) + accessible Places list
- [ ] **Check before merging:** walk, click a building, use each bench from inside the world, overlays inside panels (gambler-style fixed layers), mobile 375px, keyboard-only path

## Phase 2: Fan out (parallel, after Phase 1 merges)

- [ ] Luminous town: Market
- [ ] Umbral town: Gambler, Exchange
- [ ] Celestial town (Meridian Orrery): Codex, Leaderboards
- [ ] Verdant town (Rootglass Canopy): Sanctum, Quests, Arena + Trials gates
- [ ] Zone drop tables per hunting ground: real items and materials, rarity beams, items fly into the satchel
- [ ] Material Vendor in Infernal: purchases fly to the forge stockpile (reuse the forge-floor flight)
- [ ] One hunting-ground monster per realm from the 5 painted creatures (Rivet Maw done; Prism Forager, Ephemeris Leech, Mirror Substitute, Rootglass Stag)
- [ ] Your gear on the Keeper in the world: weapon in hand, off-hand on the back arm, trinket and rarity auras (needs Phase 1's engine)
- [ ] In-game UI polish: HUD, satchel, panel open/close transitions (needs Phase 1's side-scroller)

## Phase 3: World only

- [ ] Every navbar page reachable by walking, the Places list, and a Waystone
- [ ] Nav audit (`scripts/audit-nav.js`, which gates deploy) understands in-world places
- [ ] Standalone URLs (`/market`, `/gambler`, …) keep their SEO prerender and open into the world
- [ ] Navbar shrinks to Play + Character

## Phase 4: Life

- [ ] NPC shopkeepers at each building (needs NPC art)
- [ ] Ambient townsfolk, per-realm weather / atmosphere
- [ ] True layered or frame animation once the art exists (`docs/animation/layered-art-spec.md`)

---

## Running in parallel right now

| Work | Branch | Status |
|---|---|---|
| Phase 1 world foundation | agent worktree (pending report) | `[~]` |
| Character build: gear on the doll, equip fly-in animation, build archetype card | agent worktree (pending report) | `[~]` |
| Missing-art commission pack: prompts + exact library filenames for every placeholder; importer auto-wires them | agent worktree (pending report) | `[~]` |

## Art still missing (placeholders in game)

No image-generation tool is available in Claude sessions; the commission pack
(`docs/art-commissions/`, landing) turns each gap into a ready prompt and a
filename the importer picks up automatically.

- 23 unique items (`ART_PENDING` in `src/app/shared/art/art.ts`)
- 6 NPCs, 18 explorer archetypes, 6 Thralls
- 5 creatures with concept sheets only
- Town buildings / stations (anvil, stalls, waystone, …) and any missing realm backdrops
- Guild screen does not exist yet (crests, banners and ranks are imported, unused)

## Known issues / watch list

- Returning visitors may see the old ghostly Keeper for up to 7 days (image cache, same filename)
- Rig unverified in motion on mobile, high-DPR seams, Safari rim light (the test browser pane runs hidden, so the loop doesn't advance)
- Initial bundle is ~113 kB over its warning budget (pre-existing)
- "Daily Tool Generation Pipeline" workflow failing on main (pre-existing, unrelated)

## How to work on this plan

- One owner per file area at a time; parallel agents get disjoint file lists.
- Every branch: `node --test scripts/seamworks-engine.test.cjs`, `check-ds-adherence`, `check-i18n-keys`, `audit-nav`, one `ng build`; then a look in a production build before merging to `main` and `dev`.
- Tick items here in the merge that ships them.
