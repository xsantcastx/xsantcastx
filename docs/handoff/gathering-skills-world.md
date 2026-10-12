# Handoff: gathering in the world, Skills Lodge, Hunting XP, cross-town `?at=`

## Gathering nodes in every realm's hunting ground

Data: `AreaDef.nodes` (`GatherNodeDef` in `play/world/world.model.ts`). Each node has `x`, `kind` (herb/wood/ore), `tools` (tool → minimum tier), `hp`, `discipline`, `xp`, `minLevel`, `yield` and `respawn` seconds.

The engine applies the Delve's rule through the same `toolFor()`. It picks the best swing tool that meets the tier, and each hit deals `1 + (tier - min) / 2`. After the tool, it checks the skill level (`setTools({ levels })`). A failed check clangs with "Need Sickle II" or "Needs Woodcutting 10".

A break asks the host through `onWorldAction`, with `site` set to the node id and `mutationId: gather:<session>:<area>:<node>:<gen>`. The host books it with `SkillActionService.act` at `<town>/<area>`, which grants the XP and the item in one idempotent write and plays the level-up moment. A refusal leaves the node standing on its last crack.

The ready state is visible: a ready node glows and shows its material's icon. A harvested node is a dim stump with a regrowth ring. The glow breathes, except under reduced motion, where it stays still. You can gather with J (hold it to keep going), with E, or by clicking the node, which walks you there and swings once.

| Hunt | Node | Material | Tool | Skill (minLevel) |
|---|---|---|---|---|
| Ember Quarry | starlight tuft | starlight-herb | Sickle I | Foraging 1 |
| | scorched trunk | world-root-bark 60% | Axe I | Woodcutting 1 |
| | slag outcrop | slag-fragment | Pickaxe II | Mining 8 |
| Reflection Channels | starlight patch | starlight-herb | Sickle I | Foraging 1 |
| | sunbloom | sunbloom | Sickle II | Foraging 6 |
| | golden oak | solar-resin 50% | Axe III | Woodcutting 25 |
| Unrecorded Corridors | dusk sapling | world-root-bark 60% | Axe I | Woodcutting 1 |
| | nightbloom | nightbloom | Sickle III | Foraging 14 |
| | shadowbark | shadowthread-silk 50% | Axe IV | Woodcutting 45 |
| Orrery Rings | starlight sprig | starlight-herb | Sickle I | Foraging 1 |
| | star-iron outcrop | celestial-alloy | Pickaxe II | Mining |
| | moonpetal | moonpetal-herb | Sickle III | Foraging 40 |
| Rootglass Thicket | starlight clump | starlight-herb | Sickle I | Foraging 1 |
| | World-Root sapling | world-root-bark | Axe I | Woodcutting 1 |
| | sap tree | verdant-sap | Axe II | Woodcutting 10 |
| | thornroot bramble | thornroot | Sickle III | Foraging 25 |

How the gates were chosen:
- Tool tiers follow `TOOL_OPENS`.
- `minLevel` equals the Skills panel's "Gather X" row; a test enforces this.
- Every hunt has something the starter kit can gather.
- **Found in** reads `nodes[].yield` through the new `AreaLike.gatherMaterials`, and labels those entries as `gather`.

## Other features

- **Skills Lodge**: a `panel: 'skills'` station in Rootglass Canopy at x 1805. It shows up in the Places list and at `/play?at=skills`.
- **Hunting XP**: the new engine callback `onKill({ id, areaId, creature, name, hp })` fires once per kill, Delve kills included. The host pays `huntingXpFor(hp)`, which is `round(hp / 5)` capped at 500 (`shared/skills/hunting.ts`). It uses `mutationId: hunt:<id>` and shows a "+N Hunting XP" toast. Examples: a Maw pays 12, the Warden 52.
- **Smithing banner on bench crafts**: `CraftingGateway` calls `SkillActionService.announceBenchCraft(progress)` after both `recordCraft` sites. It checks Smithing (forge XP plus bench XP) before and after the craft.
- **Cross-town `?at=`**: `findStation(stationId, prefer?) → { townId, station } | null` in `world.model.ts` is pure.
  - It searches the preferred town first, then the others in realm order, because `waystone` and `passage` ids repeat across towns.
  - It looks at town stations only, not hunts.
  - `applyAt` travels to the station's town when needed, even from a hunt, then places the Keeper and opens the station.
- **Lantern units**: `toolTiers().lanternRadius` is measured in tiles, and is now 7 + floor(Delving / 10), so 7 to 16. The engine takes `setTools({ lanternTiles })` and converts with tiles × CELL (32). `DEFAULT_LANTERN` is 7 × 32 = 224 px, which is the old 230 reach. The host passes the tiles, so Delving levels now grow the lantern. `lanternRadius` in px is still accepted.
- **i18n**: new `play.*` keys in EN and ES cover the Delve hotbar (label, held count, none, Place, Take and its hint, the ready message, the 7 placeable names), the gathering prompt and the Hunting toast.

## Not done or left open

- The engine's canvas messages and clang text are still English, like the rest of the engine.
- `skillPerks` (yield, speed, loot) are not applied to nodes or kills.
- Node regrowth is per session: it is not saved and pauses while a panel is open. Each regrowth is a new mutation id per engine session, so a reload makes every node ready again. This is by design, since a node is a renewable resource.
- Celestial has no tree, because no Celestial wood material exists.
- Art: the nodes are drawn in code. A herb, tree and outcrop painting per realm would lift them.

## Tests

- `scripts/seamworks-engine.test.cjs`: 68 tests. The 7 new ones cover node data validity, harvest and regrowth, tiers and levels, refusal, E and click, kills and Hunting XP, `findStation`, and lantern units. The Verdant panel assertion now includes `skills`.
- Karma: `skills.spec` (lantern 7 to 16), the new `skill-actions.service.spec` (bench banner) and `found-in.spec` (gather sources). The skills, world, crafting and activity specs pass (181 of 181).
- Also passing: homestead (10) and home-forge (7) node tests, `tsc` for app and spec, ds-adherence, i18n and audit-nav.
- `ng build` passes with an initial total of 1.73 MB.
- Checked in the production build: `/play?at=skills` from Infernal travels to the Canopy and opens Skills. In the Thicket, the starlight clump gathers (+1 toast, regrowth prompt).
