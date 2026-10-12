# Skills + tools handoff

## APIs
- `src/app/shared/skills/skill.model.ts`: `SkillId` = mining, foraging, woodcutting, smithing (stored as `forge`), delving (stored as `exploration`), enchanting, hunting, prospecting. `skillXp(progress, id, benchXp)`, `skillLevel(...)`.
- `skills/skill-unlocks.ts`: `SKILL_UNLOCKS`, `unlocksFor(skill, level)`, `unlocksBetween`, `nextUnlock(skill, xp)`, `skillPerks(skill, level)` (yield/speed/quality/loot %, data only), `describeUnlock` (i18n key + vars).
- `skills/tools.ts`: `toolTiers(inventory.snapshot, activity.snapshot.progress)` → `{ pickaxe, axe, sickle, staff, blade, lanternRadius }` (0 = none). Engine: `engine.setTools(toolTiers(...))`. Owned tools count from bag or worn; tiers are capped by the wielding skill (pickaxe→Mining, axe→Woodcutting, sickle→Foraging, staff→Enchanting). Blade comes from the equipped weapon's rarity. Lantern = 3 + floor(Delving/10) tiles. `TOOL_OPENS[family][tier]` = which node or material each tier opens.
- Gateway: `ActivityProgressionGateway.resolveWorldAction({ mutationId, discipline, materialId?, qty?, xp, locationId, now? })`. Idempotent per mutationId. Rejects gathering-site location ids, non-integer xp or xp over 500, qty outside 1..20, and unknown materials. Returns `xpBefore/xpAfter`.
- Use `SkillActionService.act({ mutationId, skill, materialId?, qty?, xp, locationId })` instead: it calls the gateway, then fires the level-up banner with what the level unlocked. For the anvil and the ritual: `grantSmithingXp(quality0to1, mutationId)` and `grantEnchantingXp(...)` (8 to 40 XP).
- Skills panel: `SkillsPanelComponent` (`<app-skills-panel>`), PanelId `'skills'` in PANEL_REGISTRY (no route; no station placed yet). The Character hub's Skills tab now hosts it.

## Migration guarantee
- Same formula `floor(100*(L-1)^2.2)`. MAX_SKILL_LEVEL moved from 50 to 99. Every threshold for levels 2 to 50 is unchanged, and the spec pins them, so stored XP reads as the same level. Players at 50 can only go up.
- Smithing = `forge` XP + the bench's existing CraftingState XP. The two never overlap, so every past craft counts.
- Site verbs now add XP onto the stored totals (`progressAfter`) instead of re-deriving from the 256-op window, which fixes XP shrinking after a trim.

## Tools
- 16 soulbound off-hand definitions (`pickaxe-1`..`staff-4`) in `skills/tool-items.ts`, with 16 bench recipes in category `tool`, `skill: 'smithing'`. Smithing gates are 1/10/25/45 (the same table as the wield gates). Tier I uses only level-1 gathering.
- Art: stand-in `ART_ALIAS` entries in `art/art.ts`. Needs paintings for pickaxe-1..4, axe-1..4, sickle-1..4, staff-1..4.

## Left to do
- Engine host: call `SkillActionService.act` for chop/forage/cut/blast/delve/hunt kills, apply `skillPerks`, and place a `panel: 'skills'` station.
- Bench crafts don't fire the Smithing level-up banner; its own celebration still runs.
- Not built: the anvil mini-game, the enchanting ritual UI, and hunting XP sources.
