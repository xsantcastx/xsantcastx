import { SocialRoom, RoomSnapshot } from './social/social-room';
import {
  afterNextRender, Component, ComponentRef, ElementRef, HostListener, Injector, NgZone, OnDestroy, PLATFORM_ID, ViewChild,
  ViewContainerRef, inject,
} from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { PROLOGUE_ROWS, PROLOGUE_WALK_TILES, type PrologueStep, guideFor, prologueStep, prologueView, tipKey } from './td/td-prologue';
import { TD_PROLOGUE_I18N } from './td/td-prologue.i18n';
import { activeCharacterKey } from '../shared/save/character-scope';
import { ATTRIBUTES, pointsLeft, type Attribute, type KeeperSkillTree, type KeeperStats } from '../shared/keeper-look/keeper-look.model';
import { ATTR_STEP, GEAR_CAPS, RESIST_STAT, defenseReduction, fightStats, wornCombat } from './td/td-skills';
import { wornResists } from '../shared/loot/aura-sources';
import { auraEffect } from '../shared/loot/auras';
import type { ItemStats } from '../shared/rpg/item.model';
import { BLADE_SHARE, CLASS_SKILLS as TD_CLASS_SKILLS, CRIT_MULT, FIRE_SKILLS, MAX_MANA, MAX_RANK, SKILLS as TD_SKILLS, TIER_LEVELS, bookTrees, castRank, castVars, cooldownNow, dealsDamage, defaultAura, defaultBar, synergies, type SkillId, type TreeId } from './td/td-skills';
import { boughtRanks, buyRank, clampTree, effectiveRanks, levelFor, rankBlock, resetTree, treePointsLeft, treeSkills, type RankBlock } from './td/td-tree';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, distinctUntilChanged, map } from 'rxjs';
import { ActivityProgressionGateway } from '../shared/activity/activity-progression.gateway';
import { BASALT_SEAMWORKS_ID, CINDER_ORE_ID, EMBER_RESIDUE_ID, miningTierFor, type DisciplineProgress } from '../shared/activity/activity.model';
import { EconomyService } from '../shared/economy/economy.service';
import { InventoryService, type VaultRouted } from '../shared/rpg/inventory.service';
import { VAULT_STATION_I18N } from '../shared/vault/vault-station.i18n';
import { GameStateGateway } from '../shared/save/game-state.gateway';
import { WhereaboutsService } from '../shared/save/whereabouts.service';
import { StorageHealthService } from '../shared/save/storage-health.service';
import { INVENTORY_ERA } from '../shared/rpg/inventory.model';
import { RESET_STAMP_KEY } from '../shared/save/save-reset';
import { artFor, REALM_ART } from '../shared/art/art';
import { iconOf } from '../shared/art/item-icons';
import type { IconKind } from '../shared/art/item-icon-shapes';
import { SheetDragDirective } from './sheet-drag.directive';
import { HOME_FORGE, IN_WORLD_FOCUS, IN_WORLD_PANEL } from '../shared/in-world-panel';
import { areaOf, findStation, LootRarity, PanelId, REALM_TOWN_IDS, RealmTownId, StationDef, TOWN_LABELS, TOWNS, TownDef } from './world/world.model';
import { PANEL_REGISTRY, panelForRoute } from './world/panel-registry';
import { itemArt, isBasaltEdge, materialDisplay } from '../shared/rpg/material-catalog';
import { clusterBy, familyOf, groupItems, slotsForGroup } from '../shared/rpg/item-groups';
import { RUNE_TIER_ORDER, STRIKE_COST } from '../shared/rune-forge/rune.model';
import { definitionFor, itemFitsSlot, mintEquipment } from '../shared/rpg/item-definition';
import { IMPLICIT_BY_SLOT, affixRange, isAffixKey, isAffixSlot } from '../shared/rpg/item-affixes';
import { qualityTagOf } from '../shared/rpg/item-quality';
import {
  CHARM_SLOT_IDS, EQUIPMENT_SLOTS, GameItem, ITEM_STAT_KEYS, ItemRarity, SLOT_BY_ID, SLOT_IDS, SlotId,
  formatItemMod, formatStatValue, gearXp, ITEM_STAT_IS_PERCENT, ITEM_STAT_LABELS, rarityLabel,
} from '../shared/rpg/item.model';
import { KeeperCombatStats, keeperCombatStats } from '../shared/rpg/keeper-combat';
import { KeeperStatSheetComponent } from '../shared/rpg/keeper-stat-sheet.component';
import { compareStats, StatDeltaRow } from '../shared/rpg/stat-delta';
import { HomesteadService } from './homestead/homestead.service';
import { HomesteadColumnComponent } from './homestead/homestead-column.component';
import { HomeForgeService } from './homestead/home-forge.service';
import { homeStationOf } from './world/homestead';
import { PlayLobbyService } from './lobby/play-lobby.service';
import { createTopDownEngine, topDownGate, type TdMapPin, type TopDownEngine } from './td/td-engine';
import { ELEMENTS, MAX_KEEPER_RESIST, type Element as DamageElement } from '../shared/loot/damage.model';
import { GOLD_FIND_CAP } from '../shared/economy/economy-curve';
import { BESTIARY_KEY, bestiaryEntries, discoveredCount, readKills, withKill, type BestiaryEntry } from './td/td-bestiary';
import { MOBS, mobSheet } from './td/td-mobs';
import { bossUniqueById, relicTotals, type BossUnique, type RelicTotals } from '../shared/rpg/boss-uniques';
import { chestsHolding, setCounts, setOfPiece, setPieceById, setSigIds, tierWord } from '../shared/rpg/set-items';
import { relicSigOf, sigIds, uniqueById, type UniqueItem } from '../shared/rpg/unique-items';
import type { SeekAnswer } from './engine/engine.model';
import type { EngineOptions } from './engine/engine.model';
import { SeamworksEngine, EngineInput, EngineState, HeldItem, InteractionTarget, KeeperLoadout, KillEvent, PlaceableId, PlaceEvent, ToolTiers, UseEvent, WorldActionEvent } from './engine/engine';
import { ChestGearRow, ChestMove, ChestRow, DelveChestService } from '../shared/delve/delve-chest.service';
import { isChestHolder } from '../shared/delve/delve-save.model';
import { PLACEABLES, WARDEN_FLAG } from './engine/terrain';
import { formatXp, miningLevelView } from '../shared/activity/mining-level';
import { toolCard, toolCardLines, toolPower, toolTiers } from '../shared/skills/tools';
import { heldToolPieces, heldToolsKey, type HeldToolKind } from '../shared/skills/held-tool';
import { TOOLS_I18N } from '../shared/skills/tools.i18n';
import { CharacterHubService } from '../shared/character/character-hub.service';
import { STARTER_FAMILIES, starterInstanceId, starterToolId } from '../shared/skills/tool-items';
import { SkillActionService } from '../shared/skills/skill-actions.service';
import { SKILLS, skillForDiscipline, skillLevel, skillView, skillXp } from '../shared/skills/skill.model';
import { keeperDeeds } from './world/keeper-lines';
import { DELVE_MISSIONS } from '../shared/npc/delve-missions.model';
import { huntingXpFor } from '../shared/skills/hunting';
import { keeperLevelView } from '../shared/skills/keeper-level';
import { KeeperLevelService, type KeeperLevelUp } from '../shared/skills/keeper-level.service';
import { MILESTONES, frameFor, keeperAttributePoints, nextMilestone, passiveBonus, titlesEarned, type Milestone } from '../shared/skills/keeper-milestones';
import { skillPointsEarned } from '../shared/keeper-look/skill-points';
import { TranslationService } from '../translation.service';
import { LIFE_I18N } from './world/life.i18n';
import { DELVE_I18N } from './world/delve.i18n';
import { UNDERHEARTH_I18N } from './world/underhearth.i18n';
import { RIFT_I18N } from './world/rift.i18n';
import {
  attunedFlag, attuneCheck, DAWN_LENS, enteredFlag, GATE_ENTER_XP, GATE_SEEN_XP, ORRERY_KEY, realmOfArea, realmOfGateNode, RIFT_GATES, ROOTSEVER_BILLHOOK, seenFlag, VEIL_LANTERN,
} from '../shared/delve/rift-gates.model';
import { UMBRAL_DELVE } from './world/towns/umbral-delve';
import { VERDANT_DELVE } from './world/towns/verdant-delve';
import { LUMINOUS_DELVE } from './world/towns/luminous-delve';
import { CELESTIAL_DELVE } from './world/towns/celestial-delve';
import {
  FOUR_HAMMER_MARKS, FURNACE_FLAG, furnaceDayFlag, HAMMER_MARK_FLAGS, HAMMER_MARK_XP, SEAM_CART, THORNROOT_GRAPPLE, UNSEALED_FLAG, WAYSTONE_SHARD,
} from '../shared/delve/underhearth.model';
import { EMBER_DELVE } from './world/towns/infernal';
import { HEARTH_I18N } from './world/hearth.i18n';
import { FIRST_GOALS_I18N } from './world/first-goals.i18n';
import { HUD_I18N } from './world/hud.i18n';
import { ASHGUARD_I18N } from './td/td-ashguard.i18n';
import { LANTERN_I18N } from './td/td-lantern.i18n';
import { THORN_I18N } from './td/td-thorn.i18n';
import { ACCOUNT_I18N } from '../shared/account/account.i18n';
import { firstGoal, FirstGoalView, runeForgeHint } from './world/first-goals';
import { GLIM_I18N } from '../shared/glim/glim.i18n';
import { GlimService } from '../shared/glim/glim.service';
import { GlimVoice } from '../shared/glim/glim-voice';
import { GlimIconComponent } from '../shared/glim/glim-icon.component';
import { GlimTalkComponent } from '../shared/glim/glim-talk.component';
import { GlimChatComponent } from '../shared/glim/glim-chat.component';
import { GLIM_ALIVE_I18N } from '../shared/glim/glim-alive.i18n';
import { CompanionHost } from './companion-host';
import { PET_ACT, PET_ROLES, works } from '../shared/pets/pet-roles';
import type { TipContext } from '../shared/glim/glim-react';
import type { GlimMood } from '../shared/glim/glim-art';
import { GLIM_BOND_I18N } from '../shared/glim/glim-bond.i18n';
import {
  BACK_AFTER_MS, GLIM_RARE_KINDS, NOTICE_CELLS, SENSE_CELLS, WAY_FAR_CELLS,
  answersFor, coloured, hasAbility, momentsFrom, nextTalk, siteMoment, wayHome,
} from '../shared/glim/glim-bond';
import { npcById } from '../shared/npc/npc.model';
import { NpcQuestService } from '../shared/npc/npc-quest.service';
import { QuestService } from '../shared/quests/quest.service';
import { GlobalEggTriggersService } from '../shared/easter-eggs/global-egg-triggers.service';
import { CodexSecretsService } from '../codex/codex-secrets.service';
import { STORY_I18N } from '../shared/story/story.i18n';
import { StoryService } from '../shared/story/story.service';
import { STORY_CARD_PARAGRAPHS } from '../shared/story/story';
import type { StoryCardId, StorySceneId } from '../shared/story/story-save.model';
import { StorySceneComponent } from '../shared/story/story-scene.component';
import { DelveSaveService } from '../shared/delve/delve-save.service';
import { DelveLoreService } from '../shared/delve/delve-lore.service';
import { GatherSaveService } from '../shared/skills/gather-save.service';
import { INSCRIPTION_XP, inscriptionById } from '../shared/delve/delve-lore.model';
import { FIELD_NOTE_XP, fieldNoteFor } from '../shared/delve/field-notes.model';
/** Delving XP for a rift shrine's first touch (an inscription's worth: a find). */
const SHRINE_XP = 15;
import type { DiscoverEvent } from './engine/engine';
import { WORLD_ACTION_UNPAID } from './engine/engine.model';
// One World (docs/design/one-world.md), Phase 1: behind the per-device preview gate.
import { OneWorldFlag } from './one-world/one-world-flag';
import { EMBER_STONES, INFERNAL_WORLD_TOWN, ROAD_MAW_APPROACH_X } from './world/worlds/ember.world';
import { ONE_WORLD_I18N } from './world/one-world.i18n';
import { TRAVEL_MAP_I18N } from './world-travel/world-travel.i18n';
import type { TravelMapComponent } from './world-travel/travel-map.component';
import { headMark } from './world/routines';
import { TOWN_KEEPERS } from './world/life';
import { WaystoneService, type WaystoneHost, type WaystonePin } from '../shared/waystones/waystones.service';
import { revealSectors, travelRefusal } from '../shared/waystones/waystones.model';
import { WorldMigrationService } from '../shared/delve/delve-migration-v3';
import { worldHour } from '../shared/world/world-hour';
import type { StoneEvent } from './engine/engine.model';
import { restCueDue, settleDelveMine } from './delve-reward';
import { DelveMapView } from './delve-map-view';
import { FishingService, type PendingCatch } from '../shared/fishing/fishing.service';
import { FISHING_I18N } from '../shared/fishing/fishing.i18n';
import { LineTensionComponent } from '../shared/fishing/line-tension.component';
import { reelDuration } from '../shared/fishing/fishing-reel';
import { catchById, CRATE_IDS, fishingPerks, LODGE_CHARMS } from '../shared/fishing/fishing.model';
import { InfusionService } from '../shared/enchanting/infusion.service';
import { DROWNED_LAMP_FLAG } from './world/towns/infernal';
import type { BucketEvent, BucketId, FishEvent, HandToolId } from './engine/engine';
import { HOTBAR_FIXED } from './engine/terrain';
import { MAP_MARKER_COLORS, POINTER_COLOR, type MapPinView, type MapSource } from './engine/delve-map';
import { BountyService } from '../shared/bounties/bounty.service';
import { TownTaskService, type TownTaskView } from '../shared/town-tasks/town-tasks.service';
import { SextonCountService, type SextonView } from '../shared/sexton/sexton-count.service';
import { SEXTON_I18N } from '../shared/sexton/sexton-count.i18n';
import { SEXTON_FACTS, SEXTON_GIVER, SEXTON_LEVEL, SEXTON_REWARD, sextonGold, type SextonEvent } from '../shared/sexton/sexton-count.model';
import { SextonJournalComponent } from '../shared/sexton/sexton-journal.component';
import { LORE_PAGES } from '../shared/lore/lore';
import { LORE_I18N } from '../shared/lore/lore.i18n';
import { SpellbookPageComponent } from './spellbook/spellbook-page.component';
import { dailyResetAt, giverById, type TownTask } from '../shared/town-tasks/town-tasks.model';
import { TOWN_TASKS_I18N } from '../shared/town-tasks/town-tasks.i18n';
import { itemDefinitionById } from '../shared/rpg/item-definition';
import { itemRequirements, meetsRequirements, unmetRequirements, type KeeperStanding } from '../shared/rpg/item-requirements';
import { BOUNTIES_I18N } from '../shared/bounties/bounties.i18n';
import { HEIGHTS_I18N } from './world/heights.i18n';
import { HeightsService } from '../shared/heights/heights.service';
import type { HeightFindEvent } from './engine/engine.model';
import { COMPASS_ID, FRAGMENT_ID, bountyLine, stratumOfRow, type Bounty, type BountyEvent } from '../shared/bounties/bounty.model';
import { GLIM_MARK_COLOR, MAX_PINS, PIN_COLORS, PIN_ICONS, cleanPinName, newPinId, type MapPin, type PinIcon } from '../shared/delve/map-pins.model';
import { GLIM_MARKS, activeMark } from '../shared/glim/glim';
// The Mirror Slate (docs/handoff/mirror-slate.md): the HUD button, P, the busy rule, Lune's and Kael's counters.
import { SlateService } from '../shared/slate/slate.service';
import { PotionService, type BeltSlot } from '../shared/potions/potion.service';
import { potionById, potionEffect } from '../shared/potions/potions.model';
// The world clock (docs/handoff/world-clock.md): the sky, the hour the world keeps, the eclipse and Sera Quill's ledger.
import { WorldClockService } from '../shared/world-clock/world-clock.service';
import { EclipseService } from '../shared/world-clock/eclipse.service';
import { WORLD_CLOCK_I18N } from '../shared/world-clock/world-clock.i18n';
import { DARK_I18N } from './td/td-dark.i18n';
import { ECLIPSE_GLASS_ID, ECLIPSE_SHRINE, REALM_HUNT } from '../shared/world-clock/eclipse.model';
import { clockText, worldSpan, type Sky, type SkyPhase } from '../shared/world-clock/world-clock.model';
import { eclipseWarning, skyVars, spellMult } from './td/td-phases';
import { weaponSwing } from './td/td-melee';
import { SlateCounterComponent } from '../shared/slate/slate-counter.component';
import { SLATE_I18N } from '../shared/slate/slate.i18n';
// Make your Keeper (docs/handoff/make-your-keeper.md): the chosen look, worn gear as layers, the Glass of Becoming.
import { KeeperLookService } from '../shared/keeper-look/keeper-look.service';
import { KEEPER_LOOK_I18N } from '../shared/keeper-look/keeper-look.i18n';
import { lookKey, type KeeperLook } from '../shared/keeper-look/keeper-look.model';
import { gearKey } from '../shared/keeper-look/keeper-gear';
import { wornGear } from '../shared/keeper-look/worn-gear';
import { KeeperPainter } from '../shared/keeper-look/keeper-paint';
import { FRONT_H, FRONT_W, frontSheet } from '../shared/keeper-look/keeper-front';
import { vocationLook } from '../shared/keeper-look/vocation-look';
import { LevelUpService } from '../shared/activity/level-up.service';
import { npcPortrait } from '../shared/keeper-look/npc-portrait';
import { OnboardingService } from '../shared/onboarding/onboarding.service';
import { CROUPIER_STATIONS, KAEL_STATION, slateRefusal, type SlateTier } from '../shared/slate/slate.model';
import type { PanelEntry } from './world/panel-registry';
import { SoundService } from '../shared/sound/sound.service';
import { SoundSheetComponent } from '../shared/sound/sound-sheet.component';
// Loot & combat (docs/design/loot-and-combat.md): drops, auras, difficulty, the corpse run.
import { LootService } from '../shared/loot/loot.service';
import { LootSheetComponent } from '../shared/loot/loot-sheet.component';
import { LOOT_I18N } from '../shared/loot/loot.i18n';
import { HearthService, type FallSummary } from '../shared/hearth/hearth.service';
import { COLD_HEARTH_I18N } from '../shared/hearth/cold-hearth.i18n';
import { HEARTH_GRACE_LEVEL } from '../shared/hearth/hearth-rules';
import { HearthShrineComponent } from '../shared/hearth/hearth-shrine.component';
import { SpellstoneService } from '../shared/spellstones/spellstone.service';
import { SPELLSTONES_I18N } from '../shared/spellstones/spellstones.i18n';
import { BLANK_ID, parseStoneKey, soulCap, stoneIcon, stoneRecipe } from '../shared/spellstones/spellstones.model';
import { GraveGoodsService } from '../shared/grave-goods/grave-goods.service';
import { GRAVE_I18N } from '../shared/grave-goods/grave-goods.i18n';
import { GraveDeskComponent } from '../shared/grave-goods/grave-desk.component';
import { CURSES, WHISPERS, WHISPER_COST, isCurseId, isWhisperId, nextWhisperAt, whisperStage, type CurseId, type WhisperId } from '../shared/grave-goods/grave-goods.model';
import { installStonesHook } from '../shared/grave-goods/stones-test-hook';
import { RUNG_LEVEL, lootEntry } from '../shared/loot/drop-tables';
import { DIFFICULTIES } from '../shared/loot/difficulty.model';
import { itemAuras } from '../shared/loot/aura-sources';
import { socketCountFor, socketStats } from '../shared/enchanting/socket.model';
import { effectiveStats, wornStats } from '../shared/enchanting/socket-words';
import { PetSheetComponent } from '../shared/pets/pet-sheet.component';
import { PetsService } from '../shared/pets/pets.service';
import { PETS_I18N } from '../shared/pets/pets.i18n';
// The Lost Cabinets (docs/handoff/lost-cabinets.md): the Slate's Scan pulsing while you walk, the cabinets in the world.
import { CabinetsService } from '../shared/cabinets/cabinets.service';
import { CABINETS_I18N } from '../shared/cabinets/cabinets.i18n';
import { LIVING_I18N } from './world/living-world.i18n';
import { CRITTERS, hermitOfNote, LIVING_NOTE_XP, MYSTERY_REWARD, type CritterId, type MysteryKind } from './engine/living-world';
import { CABINETS, PULSE, SCAN, eyeDirection, scanReading, warmthAt, type ScanReading, type Warmth } from '../shared/cabinets/cabinets.model';
import type { CabinetEvent, CabinetMark } from './engine/engine.model';
import { FLOOR, type MachineEvent, type MachineMark } from './engine/engine.model';
import { BUILT_REALM_MACHINES, machinePoint } from '../shared/cascade/realm-machines.model';
import { REALM_MACHINES_I18N } from '../shared/cascade/realm-machines.i18n';
import { PlayLedgerService } from '../shared/games/play-ledger.service';
import { PET_TUNING, followingPet, gatherBonus, isHatched, petDef, xpBonus, type PetDef } from '../shared/pets/pets.model';
import { eggPortrait, petPortrait } from '../shared/pets/pet-art';
import { SOUND_I18N } from '../shared/sound/sound.i18n';
import { WorldFeelBus, type CraftedFeel } from '../shared/sound/world-feel.bus';
import { materialOf, REALM_IDS, TOWN_GROUND, type RealmId } from '../shared/sound/sound-palette';
import { LevelUpAudioService } from '../shared/activity/level-up-audio.service';
import { ForgeAudioService } from '../shared/economy/forge-audio.service';
import { RarityAudioService } from '../shared/rarity/rarity-audio.service';
import type { EngineSfx } from './engine/engine';

/** Finds a player is paid once, ever (delve-save `claimed`). */
/**
 * Whether this viewer last left the Hearth chat open. A per-device convenience,
 * not progress: plain localStorage behind try/catch, never the save gateway.
 */
const HEARTH_OPEN_KEY = 'eclipse-hearth-open';
/**
 * The first moments of a visit only catch the story up with the save: beats
 * found here are filed without a word and their cards marked shown. Long enough
 * for every service to hydrate; far shorter than anything a player can do.
 */
const STORY_CATCH_UP_MS = 1500;
/** The one-time Rune Forge hint (world/first-goals.ts runeForgeHint) was followed or dismissed. A UI note, like the Hearth's. */
const RUNE_HINT_KEY = 'eclipse-rune-hint-seen';
const ONCE_PER_PLAYER = new Set(['godforge-fragment', 'kaels-hammer']);

/** Where Delve swings are recorded in the activity ledger. */
const EMBER_DELVE_LOCATION = 'infernal/ember-delve';
import type { InventorySnapshot } from '../shared/rpg/inventory.service';

/**
 * What a held weapon lends the delve: any weapon cuts vines (blade I), and a
 * staff/wand-like one breaks wards (staff I). Pickaxe, axe and sickle have no
 * floor any more: every Keeper holds the real starter tools (ensureStarterTools).
 */
export function provisionalToolTiers(snapshot: Pick<InventorySnapshot, 'equipped'>): ToolTiers {
  const held = [snapshot.equipped['weapon'], snapshot.equipped['off-hand']].filter(item => item && !item.explorerId);
  const staff = held.some(item => /staff|wand|rod|scepter|sceptre/i.test(`${item!.definitionId} ${item!.name}`));
  const weapon = snapshot.equipped['weapon'];
  return { blade: weapon && !weapon.explorerId ? 1 : 0, staff: staff ? 1 : 0 };
}

/** On <body> while the world is mounted. styles.css and cosmic-engine.js key the backdrop off it. */
const WORLD_ROUTE_CLASS = 'gf-world-route';
const SAVE_KEY = 'eclipse-seamworks-world-v1';
/**
 * Where the Keeper last stood and what the hunts have paid in coins, local to
 * this device: `{ town?: RealmTownId, coins?: number }`. The town is restored
 * on load (a `?at=` link still wins); `coins` is the satchel's running count
 * of coins picked up (each one was also credited to the Gold purse).
 */
const PLAY_KEY = 'eclipse-play-world-v1';
/** Mining XP for an ore drop walked over, the same as a Cinder vein swung open. */
const ORE_PICKUP_XP = 2;
const CRAFT_ID = 'seamworks-world:basalt-edge:v1';
const TUTORIAL_EMBER_ID = 'seamworks-opening:keeper-ember:v1';
const BELT: SlotId[] = ['weapon', 'off-hand', 'head', 'chest', 'hands', 'legs', 'feet', 'trinket'];

/** Sexton Wren's story talk (the Sexton's Count, shared/sexton): what he says, the step's task, the reward, the choice. */
interface StoryTalk {
  view: SextonView; say: string; task: string; reward: string; paid: boolean;
  /** The two ways the end can go, one line each. */
  notes: string[];
  /** Laying the cowl to rest needs it in hand. */
  restOk: boolean;
  thanks: 'kept' | 'rested' | null;
}
interface BagPick { kind: 'stack' | 'item' | 'slot'; ref: string; }
/** A satchel cell: a stack, or a group of identical items (`ids`, item-groups) shown once with its count. */
interface BagPocket { key: string; kind: 'stack' | 'item'; ref: string; name: string; art: string; qty: number; pip: string; mark: string; ids: string[]; /** Its satchel tab. */ cat: BagCat; }
/** The satchel's tabs (MapleStory's inventory): everything, worn things, charms, materials. */
type BagCat = 'gear' | 'charm' | 'mats';
type BagTab = 'all' | BagCat;
/** Spelt out, so the HUD key checks (scripts/seamworks-engine.test.cjs) can read them. */
const BAG_TAB_KEYS: Record<BagTab, string> = {
  all: 'play.hud.book.tab.all', gear: 'play.hud.book.tab.gear', charm: 'play.hud.book.tab.charm', mats: 'play.hud.book.tab.mats',
};
/** An empty well shows a faint picture of what goes there, never a word that spills out of its box. */
const WELL_GHOST: Record<string, IconKind> = {
  weapon: 'sword', 'off-hand': 'shield', head: 'helm', chest: 'cuirass', hands: 'gauntlet', legs: 'greaves', feet: 'boots',
  trinket: 'ring', charm1: 'coin', charm2: 'coin', charm3: 'coin', pet: 'heart',
};
const ghostOf = (slot: string): string => iconOf(WELL_GHOST[slot] ?? 'orb', 'grey').src;
interface BagWell { id: SlotId; name: string; art: string; mark: string; label: string; filled: boolean; /** The faint picture an empty well shows. */ ghost: string; /** The worn item's rarity colour (the well's top pip). */ tone: string | null; }
/** A rarity's loot colour (the D2/D4 ladder, _cozy.css --cozy-loot-*): cells, cards and the hover card agree. */
const lootColor = (rarity: string): string => `var(--cozy-loot-${rarity}, var(--cozy-loot-common))`;

interface BagSlip {
  name: string; art: string; mark: string; kicker: string; note: string; stats: string[]; canWear: boolean; canStow: boolean;
  /** Rarity colour for the card's name and frame; null for materials. */
  tone?: string | null;
  /** A loose satchel item: a secondary "Send to Vault" makes room from anywhere. */
  canSend?: boolean;
  /** Why Equip is shut (an unmet requirement), or absent when it can be worn. */
  wearBlocked?: string;
  /** How many identical pieces the picked cell holds: "Send 7 to Vault" moves them all. */
  count?: number;
  /** Wearing it, against what that place holds now. Empty for worn items and materials. */
  compare: StatDeltaRow[];
  /** "Against Basalt Edge" / "Against an empty Head". */
  compareLabel: string;
  /** The hover card's layout (owner 2026-10-20: the Top Heroes item cards, docs/design/refs/cozy/top-heroes-items.jpg). */
  tip?: ItemTip;
}
/** A set piece's card block: how many of the set are worn, each piece (greyed when not), each tier (lit when on). */
interface ItemSetTip {
  name: string; count: number; total: number;
  pieces: { id: string; name: string; worn: boolean; here: boolean }[];
  tiers: { word: string; n: number; text: string; on: boolean }[];
  found: string[];
}
/** What the hover card shows beyond name and kicker: the frame's rarity, the headline stat, the affixes, wells, worth. */
interface ItemTip {
  rarity: string;
  typeLine: string;
  rarityWord: string;
  /** The implicit (or the legacy headline stat); `range` is the `[min–max]` it could roll, '' for none. */
  head: { key: string; text: string; range: string } | null;
  affixes: { key: string; text: string; range: string }[];
  /** Item level (where it dropped), or 0 for items minted before affixes. */
  itemLevel: number;
  /** Every grade ≥ 95% (perfect) or ≥ 99.9% (flawless) — item-quality qualityTagOf. */
  tag: 'perfect' | 'flawless' | null;
  /** Blue lines: auras the piece carries, or a material's use. */
  specials: string[];
  /** A set piece's block (rpg/set-items.ts): the set's name, its pieces and its tiers, and where the piece is found. */
  set?: ItemSetTip;
  /** A cursed grave-good's block (shared/grave-goods): its name, the gift, the price, and who lays it to rest. */
  curse?: { name: string; lines: string[]; rest: boolean; lore: string };
  /** A whispering item's block: the words woken so far, how awake, the cost, and whether it was silenced. */
  whisper?: { words: string; lines: string[]; silenced: boolean };
  sockets: (string | null)[];
  value: number;
  bound: boolean;
  tempered: number;
  /** "Requires Level 30", "Requires 15 Spirit" — `met` false paints the line red (item-requirements.ts). */
  reqs?: { text: string; met: boolean }[];
}

/** What the in-world panel is showing: a hosted page, the waystone's travel list, or a chest placed in the Delve. */
interface OpenPlace {
  kind: 'page' | 'waystone' | 'chest' | 'slate' | 'shrine' | 'sexton' | 'archivist' | 'journal'; stationId: string; title: string; kicker: string;
  chest?: { areaId: string; index: number };
  /** A place in the player's own Delve (a chest, a camp): no ?at= deep link. */
  own?: true;
}
/** The open chest: what is in it and what the satchel could put in. Rebuilt after every move. */
interface ChestView { rows: ChestRow[]; satchel: ChestRow[]; slots: number; gear: ChestGearRow[]; bagGear: ChestGearRow[]; gearSlots: number; gearUsed: number; note: string }
interface PlaceRow { id: string; name: string; blurb: string }
interface WaystoneRow { id: RealmTownId; realm: string; town: string; crest: string; available: boolean; current: boolean }

/** How long the place's content takes to fold away. Kept in step with `place-out` in the stylesheet. */
const PANEL_CLOSE_MS = 160;
/** How long a touched station stays highlighted, with its name card up. */
const TOUCH_TIP_MS = 1400;

interface LootToast { key: number; text: string; art?: string }
/** One slot of the Delve hotbar: a placeable and how many the satchel holds. */
interface HotbarSlot { id: PlaceableId | BucketId | HandToolId; name: string; art: string; count: number; key: string }
/** Hotbar slots past key 0, shown only while the satchel holds some: the obsidian block, the buckets, the grapple. */
const HOTBAR_EXTRA: readonly (PlaceableId | BucketId | HandToolId)[] = ['seam-bucket', 'seam-bucket-water', 'seam-bucket-lava', THORNROOT_GRAPPLE];
/** A Rift Anchor travel destination (or the Seamworks Waystone, `home`). */
interface AnchorRow { key: string; col: number; row: number; label: string; home?: boolean }
/** The reel in progress: what is on the line, and the Line Tension seed. */
interface ReelView { pending: PendingCatch; seed: number; widen: number; biome: string; liquid: 'water' | 'lava'; auto: boolean }

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function titleCase(label: string): string {
  return label.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function monogram(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

/** The tracked map pin, per device (a view choice, like the minimap's fold). */
const TRACK_KEY = 'eclipse-delve-track';


/** The stat sheet's resist rows (§6), one key each so the words stay translatable. */
const RESIST_TOTAL_KEY: Readonly<Record<DamageElement, string>> = {
  fire: 'play.td.total.res.fire', cold: 'play.td.total.res.cold', lightning: 'play.td.total.res.lightning', arcane: 'play.td.total.res.arcane',
};
/**
 * The held weapon as the Ashguard's swing reads it (td-melee weaponSwing): its Strike and Spell Damage as worn — the
 * socketed runes, a Socket Word and a grave-good's gift in — exactly what the weapon's card totals.
 */
/** A grave-good's number as its card writes it: "12%" on a percent stat (Spell Damage, Move Speed, All Resist …), else "12". */
function pctOf(key: keyof ItemStats, n: number): string { return `${n}${ITEM_STAT_IS_PERCENT[key] ? '%' : ''}`; }

function heldSwing(held: GameItem): { strikePower?: number; spellDamage?: number } {
  const st = wornStats(held);
  return { strikePower: st.strikePower, spellDamage: st.spellDamage };
}

/** Where the fight stops a worn total (the item card says it): td-skills GEAR_CAPS, the resist cap, Gold Find's. */
const WORN_CAP: Partial<Record<keyof ItemStats, number>> = {
  ...GEAR_CAPS, goldFind: GOLD_FIND_CAP,
  fireResist: MAX_KEEPER_RESIST, coldResist: MAX_KEEPER_RESIST, lightningResist: MAX_KEEPER_RESIST, arcaneResist: MAX_KEEPER_RESIST, allResist: MAX_KEEPER_RESIST,
};

@Component({
  selector: 'app-side-scroller', standalone: true, imports: [RouterLink, NgTemplateOutlet, KeeperStatSheetComponent, HomesteadColumnComponent, LineTensionComponent, GlimIconComponent, SlateCounterComponent, GlimTalkComponent, GlimChatComponent, SoundSheetComponent, LootSheetComponent, PetSheetComponent, StorySceneComponent, SheetDragDirective, HearthShrineComponent, GraveDeskComponent, SextonJournalComponent, SpellbookPageComponent],
  templateUrl: './side-scroller.component.html', styleUrls: ['./side-scroller.component.css', './side-scroller.component.b.css', './side-scroller.component.c.css'],
})
export class SideScrollerComponent implements OnDestroy {
  @ViewChild('worldCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  /**
   * Where a place's page is created. Deliberately NOT inside an @if: a
   * ViewChild in control flow is intermittently unresolved for lazily created
   * components, so the shell is always rendered (hidden when closed) and this
   * resolves statically, before any panel can open.
   */
  @ViewChild('panelHost', { read: ViewContainerRef, static: true }) panelHost!: ViewContainerRef;
  @ViewChild('placePanel', { static: true }) placePanel!: ElementRef<HTMLElement>;
  /** The station name card that follows the pointer. Written directly, outside change detection. */
  @ViewChild('stationTip', { static: true }) stationTip!: ElementRef<HTMLElement>;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  /** Pages built in the panel see IN_WORLD_PANEL and drop their full-page backdrop and hero. */
  private readonly panelInjector = Injector.create({ providers: [{ provide: IN_WORLD_PANEL, useValue: true }], parent: this.injector });
  /** A camp's bench: the same Crafting Bench, opened on what can be made now. */
  private readonly campInjector = Injector.create({
    providers: [{ provide: IN_WORLD_PANEL, useValue: true }, { provide: IN_WORLD_FOCUS, useValue: 'ready' }], parent: this.injector,
  });
  /** Your Anvil / Your Enchanting Circle in the Homestead: the same benches, with the station's tier (HOME_FORGE). */
  private readonly homeForge = inject(HomeForgeService);
  private readonly homeInjector = Injector.create({
    providers: [{ provide: IN_WORLD_PANEL, useValue: true }, { provide: HOME_FORGE, useValue: this.homeForge.context }], parent: this.injector,
  });
  /** True while the Keeper stands at the Delve shaft and has a camp below. */
  campReady = false;
  private panelRef: ComponentRef<unknown> | null = null;
  /** Bumped on every open/close so a slow lazy import never lands in a newer (or closed) panel. */
  private panelSeq = 0;
  private atSub?: Subscription;
  /** A `?at=` that arrived before the engine existed. Applied once it mounts. */
  private pendingAt: string | null = null;
  private unbindPointer: (() => void) | null = null;
  town: TownDef = OneWorldFlag.on ? INFERNAL_WORLD_TOWN : TOWNS.infernal!;
  panel: OpenPlace | null = null;
  panelLoading = false;
  panelError = '';
  /** True for the moment the place's content folds away before the panel hides. */
  closing = false;
  private closeTimer?: ReturnType<typeof setTimeout>;
  /**
   * The control that opened the place, when it was opened from the keyboard
   * (a focus-visible button outside the canvas). Focus returns there on close
   * if it is still on screen; otherwise, and for clicks/E, to the canvas.
   */
  private panelOpener: HTMLElement | null = null;
  placesOpen = false;
  /** The Bestiary window (top-down only): opened from the Map's menu row or with B. */
  bestiaryOpen = false;
  bestiary: { entries: (BestiaryEntry & { lit: string; dark: string; shownHaunts: string[]; moreHaunts: number })[]; found: number } | null = null;
  /**
   * A town task giver spoken to (top-down; shared/town-tasks): who they are, what they ask now (or the thanks for what
   * was just handed in), and whether they keep a stall (its "Trade" button opens it as before).
   */
  taskTalk: { giver: string; name: string; view: TownTaskView | null; stall: StationDef | null; thanks: { task: TownTask; reward: string } | null; story?: StoryTalk | null } | null = null;
  /** The tasks under way, for the goal scroll's Tasks rows (re-read on the HUD tick). */
  taskRows: readonly { id: string; title: string; need: string; have: number; n: number; ready: boolean; giver: string; story?: boolean }[] = [];
  /** The Sexton's Count's level, shown on Wren's talk window (never gated). */
  readonly sextonLevel = SEXTON_LEVEL;
  /** "+2 Pyrite Dust" chips over the satchel. Decorative; the objective line announces pickups. */
  lootToasts: LootToast[] = [];
  private toastKey = 0;
  // ── World feel (docs/handoff/world-feel.md): the sound, the Satchel's pulse, the craft's flight ──
  private readonly sound = inject(SoundService);
  private readonly feel = inject(WorldFeelBus);
  private readonly levelAudio = inject(LevelUpAudioService);
  private readonly forgeAudio = inject(ForgeAudioService);
  private readonly rarityAudio = inject(RarityAudioService);
  private releaseSound: (() => void) | null = null;
  private feelSub?: Subscription;
  private soundSub?: Subscription;
  /** Menu → Sound is open. */
  soundOpen = false;
  /** Menu → Loot & Combat (shared/loot/loot-sheet.component.ts). */
  lootOpen = false;
  /** The Satchel's pet well, opened (shared/pets/pet-sheet.component.ts). */
  petsOpen = false;
  /** "Crafted X — in your Satchel" with its Open, after a craft; null when none. */
  craftToast: { key: number; name: string } | null = null;
  private craftToastTimer?: ReturnType<typeof setTimeout>;
  /** A craft landed in the Satchel while a panel covered it: it pulses when the panel closes. */
  private pulseOnClose = false;
  /** Things that reached the Satchel (the clasp's data-pulse, for tests). */
  satchelPulses = 0;
  /** Pickups in a quick run climb in pitch (a little scale). */
  private pickupRun = { n: 0, at: 0 };
  /** When the Delve last said "+0 XP, the seam is catching its breath" (delve-reward.ts). */
  private restCueAt: number | null = null;
  private loadoutKey = '';
  private tipStation: string | null = null;
  private tipTimer?: ReturnType<typeof setTimeout>;
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly inventory = inject(InventoryService);
  /** The Homestead's canvas view and its data (homestead/homestead.service.ts). */
  private readonly homestead = inject(HomesteadService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly hub = inject(CharacterHubService);
  private readonly skillActions = inject(SkillActionService);
  private readonly store = inject(GameStateGateway);
  /** The character's place in the cloud (throttled; whereabouts.service.ts). */
  private readonly whereabouts = inject(WhereaboutsService);
  private readonly lobby = inject(PlayLobbyService);
  private readonly economy = inject(EconomyService);
  /** Loot & combat: drops, the aura, the difficulty, the corpse run (shared/loot). */
  private readonly loot = inject(LootService);
  /** The Cold Hearth (shared/hearth): hearths lit, the Ember debt, the blessings. Top-down only. */
  private readonly hearth = inject(HearthService);
  /** The card after a fall: where the Keeper woke and what the fall cost. Fades by itself. */
  wakeCard: { town: string; hearth: boolean; fall: FallSummary } | null = null;
  private wakeTimer: ReturnType<typeof setTimeout> | undefined;
  private lastFall: FallSummary | null = null;
  private hearthSub?: Subscription;
  private unStonesHook: () => void = () => undefined;
  /** Kills whose XP already paid the debt this session (a replayed kill never pays twice). */
  private readonly debtKills = new Set<string>();
  private rulesKey = '';
  /** Gold the last fall left behind (the fall card says it). */
  fallGold = 0;
  /** Coins picked up across sessions (PLAY_KEY), shown in the satchel. */
  coinsKept = 0;
  /** Drops already credited this page (the engine reports an accepted drop once; this makes sure). */
  private readonly creditedDrops = new Set<string>();
  /** The player's own Delve (seed + dug cells) and the inscriptions they have read. */
  private readonly delve = inject(DelveSaveService);
  private readonly delveLore = inject(DelveLoreService);
  private readonly chests = inject(DelveChestService);
  /** When each hunting-ground gathering node was last harvested (regrowth survives a reload). */
  private readonly gatherSave = inject(GatherSaveService);
  /** Fishing: the catch, the Catalogue, the Lodge's ledger. */
  private readonly fishing = inject(FishingService);
  private readonly infusions = inject(InfusionService);
  /** The Line Tension reel while a fish is on the line; null otherwise. */
  reel: ReelView | null = null;
  private fishKey = '';
  private rodAsked = 0;
  /** The chest panel's contents while one is open. */
  chestView: ChestView | null = null;
  private delveSub?: Subscription;
  private gatherSub?: Subscription;
  private homeSub?: Subscription;
  private routedSub?: Subscription;
  /** The routing burst being summed: "+12 more sent to the Vault" (inventory spec §5.3). */
  private routedBurst = { first: '', more: 0, until: 0 };
  /** At least one Homestead building owned: the first goal is met. */
  private boughtBuilding = false;
  /** The first-session goal line (world/first-goals.ts); null once all four are done. */
  guide: FirstGoalView | null = null;
  /** The quest scroll's checklist rows (top-down HUD), in goal order. */
  get questRows(): readonly { n: number; key: string }[] { return this.topDown ? PROLOGUE_ROWS : this.sideQuestRows; }
  /**
   * The top-down prologue (td/td-prologue.ts): the step now, where the walk step started (it counts a few tiles of
   * walking), the step Glim last introduced (its tip is said once a session per step), and the prologue being over.
   */
  private proStep: PrologueStep | null = null;
  private proWalkFrom: { x: number; y: number } | null = null;
  private proTipped: PrologueStep | null = null;
  private proWasOn = false;
  /** Phones read the touch words (drag, tap); a pointer reads the keys. */
  private touchMq: MediaQueryList | null | undefined;
  private get touchUi(): boolean {
    if (this.touchMq === undefined) this.touchMq = this.browser && typeof matchMedia === 'function' ? matchMedia('(hover: none) and (pointer: coarse)') : null;
    return !!this.touchMq?.matches;
  }
  private readonly sideQuestRows = [
    { n: 1, key: 'play.goal.title.buy' }, { n: 2, key: 'play.goal.title.craft' },
    { n: 3, key: 'play.goal.title.hunt' }, { n: 4, key: 'play.goal.title.delve' },
  ];
  /**
   * Glim, the Margin-Light (shared/glim): the companion who voices the goal
   * line, opens the hint ladder when asked and is the Delve's lantern. Its
   * memory goes through the save gateway (GlimService); this is its one line on
   * screen. `glimAt` mirrors the engine's sprite for the e2e (data-glim-*).
   */
  readonly glimNpc = npcById('glim');
  readonly glimVoice = new GlimVoice(inject(GlimService));
  glimAt: { x: number; targetX: number | null; arrived: boolean; dimmed: boolean; bright: boolean; mood: string; trail: number | null; lamp: number } | null = null;
  /**
   * The Keeper's story (shared/story): beats are read off the save each HUD
   * tick; a beat reached live speaks through Glim's line, and an act boundary
   * raises its story card. The first moments of a visit only catch up
   * (STORY_CATCH_UP_MS), so a loaded save is never walked back through it.
   */
  private readonly story = inject(StoryService);
  private readonly quests = inject(NpcQuestService);
  /** The quest board's visit ledger: panels and realm towns count as the halls they replaced. */
  private readonly questBoard = inject(QuestService);
  /** The same visit, for the speed-demon egg and the Codex's route secrets (both keyed on old URLs). */
  private readonly hallEggs = inject(GlobalEggTriggersService);
  private readonly secrets = inject(CodexSecretsService);
  private readonly openedAt = Date.now();
  /** The act-boundary card on screen, or null. */
  storyCard: { id: StoryCardId; paragraphs: string[] } | null = null;
  /**
   * An Act II scene on screen (shared/story/story-scene.component.ts), or null.
   * A scene whose beat is reached live opens as soon as the Keeper is free; of
   * the scenes a loaded save already owes (reached on another visit or device),
   * one opens per visit and the rest wait in the Story tab, so nobody comes
   * back to a queue of cards.
   */
  storyScene: StorySceneId | null = null;
  private readonly scenesLive = new Set<StorySceneId>();
  private sceneOwedShown = false;
  /** The Homestead's Gold list is unfolded: on phones it takes the HUD plates' place. */
  columnOpen = false;
  private readonly zone = inject(NgZone);
  private readonly i18n = inject(TranslationService);
  /** A translated string (EN / ES). The hotbar, the gathering prompt and the Hunting toast use it. */
  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  // ── One World (docs/design/one-world.md), Phase 1: the preview gate ──
  /** This device previews One World: the Seamworks stands on the Ember Delve's surface (OneWorldFlag). */
  readonly oneWorld = this.browser && OneWorldFlag.on;
  /** Top-down (docs/design/top-down.md): set when the Seamworks square runs on the top-down engine; its walking is the drag joystick. */
  topDown = false;
  private readonly waystones = inject(WaystoneService);
  private readonly worldMigration = inject(WorldMigrationService);
  /** Last resume point taken (ms), and whether a saved one was used on this mount. */
  private resumeAt = Date.now();
  private resumed = false;
  /** The world clock's hour handed to the engine (the HUD tick), and the keepers' head marks' signature. */
  hour = 12;
  private marksKey = '';
  /** The first dark stone's line has been said (Glim, once per session). */
  private toldStone = false;
  /** The realm towns' worlds (the trunk line's stones are `<world>:town`). */
  private static readonly WORLD_OF_TOWN: Readonly<Record<RealmTownId, string>> = { infernal: 'ember', umbral: 'ink', verdant: 'root', luminous: 'prism', celestial: 'orrery' };
  /** A realm town by id: under One World the Infernal town is the Ember world's settlement. */
  private townFor(id: RealmTownId): TownDef | undefined { return id === 'infernal' && this.oneWorld ? INFERNAL_WORLD_TOWN : TOWNS[id]; }
  private engine?: SeamworksEngine;
  private boundCanvas: HTMLCanvasElement | null = null;
  private room?: SocialRoom;
  social: RoomSnapshot = { status: 'Solo — join the hearth to meet other Keepers.', connected: false, players: [], messages: [], id: '' };
  joining = false;
  sending = false;
  /**
   * The chat box (owner 2026-10-20: "chat like OSRS, a little box left side, and vanishes if needed"): a Game tab (this
   * device's own lines — loot, XP, the engine's words; no server) and a Chat tab (the Hearth room).
   */
  chatTab: 'game' | 'public' = 'game';
  chatHidden = false;
  /** When a line last landed (ms): the box fades when quiet, wakes on a new line or a hover. */
  chatLastAt = 0;
  gameLog: { key: number; at: number; text: string }[] = [];
  private gameKey = 0;
  private lastLogged = '';
  private logGame(text: string): void {
    const t = text.trim();
    if (!t) return;
    this.gameLog = [...this.gameLog, { key: ++this.gameKey, at: Date.now(), text: t }].slice(-60);
    this.chatLastAt = Date.now();
  }
  get chatQuiet(): boolean { return Date.now() - this.chatLastAt > 9000; }
  /** Opening the Chat tab joins the room under the Keeper's own name (a guest name; nothing else leaves the device). */
  async openPublicChat(): Promise<void> {
    this.chatTab = 'public';
    this.chatLastAt = Date.now();
    if (!this.social.connected && !this.joining) await this.joinRoom(this.keeperName || 'Keeper');
  }
  /**
   * The Hearth chat is a small pill in the world until the player opens it
   * (it used to stand over the stalls in every town). Remembered per device;
   * a station opening folds it away again without forgetting the choice.
   */
  hearthOpen = false;
  private pendingMine: string | null = null;
  private timer?: ReturnType<typeof setInterval>;
  state: EngineState = {
    hp: 100,
    // No creature is measured until the engine reports one (the enemy bar hides at 0).
    enemyHp: 0,
    nearby: null,
    x: 160,
    y: 610,
    paused: false,
    defeated: false,
    enemyDefeated: false,
    complete: false,
    message: 'Find the Cinder Ore deposit. Walk close and interact.',
    messageKey: 'play.hud.obj.start',
    area: 'Basalt Seamworks',
  };
  restored = false;
  bagOpen = false;
  /** The satchel's one details fold: the Keeper's stat sheet and the Vault count. */
  bookStats = false;
  /** The satchel's open tab; All by default (and when the tab it was on empties). */
  bagTab: BagTab = 'all';
  /** The bag's page (ten-finger rule: pages with arrows, never a scrolling column). */
  bagPage = 0;
  readonly bagPerPage = 15;
  /** The empty pet well's faint picture. */
  readonly petGhost = ghostOf('pet');
  pick: BagPick | null = null;
  showKeys = false;
  now = Date.now();
  message = '';
  /** Last combat numbers handed to the engine. Drives the HP meter's ceiling. */
  pushed: KeeperCombatStats = { damage: 10, maxHp: 100 };
  private statsKey = '';
  private toolKey = '';
  /** The held-tool layers last pushed (heldToolsKey), so they are sent only when they change. */
  private heldToolsKey = '';
  /** The Delve hotbar, rebuilt on the HUD tick when a count changes. */
  hotbar: HotbarSlot[] = [];
  private hotbarKey = '';
  /** The hotbar's choice: what B / a long-press places. */
  placing: PlaceableId | BucketId | HandToolId | null = null;
  /**
   * Phones (Terraria's smart cursor): what a tap on a Delve cell does. 'pick'
   * digs it (the engine's own click-to-strike); 'place' puts the chosen
   * placeable there. Only taps (not mouse clicks) read it; the keyboard's B
   * and the long-press place whatever is chosen, as before.
   */
  touchTool: 'pick' | 'place' = 'pick';
  /** Phones: the goal line folded to its "Goal n of 4" chip. */
  guideFolded = false;
  /** The Delve's minimap and full map (M): drawn on the HUD tick from the engine's explored cells. */
  readonly map = new DelveMapView(() => this.mapSourceV2());
  // ── Map v2 and the Board Herald's bounties (docs/handoff/bounties-map-v2.md) ──
  private readonly bounties = inject(BountyService);
  private readonly townTasks = inject(TownTaskService);
  private readonly sexton = inject(SextonCountService);
  private readonly heights = inject(HeightsService);
  private heightsSub?: Subscription;
  private readonly glim = inject(GlimService);
  private readonly pets = inject(PetsService);
  /** The Keeper's map pins (DelveSaveService, saved per region), re-read once a second in the Delve. */
  pins: MapPin[] = [];
  /** The pin open in the editor under the full map, or null. */
  selectedPinId: string | null = null;
  /** "Add pin" is armed: the next tap on the full map places one. */
  pinning = false;
  /** The pin whose way the map draws (a per-device view choice, like the minimap's fold). */
  trackedPinId: string | null = null;
  readonly pinIcons = PIN_ICONS;
  readonly maxPins = MAX_PINS;
  /** Glim's mark (a Delve mission's hint step 3) and the compass's target, re-read once a second. */
  glimMark: { col: number; row: number } | null = null;
  glimMarkMission: string | null = null;
  compassAt: { col: number; row: number } | null = null;
  private delveTickAt = 0;
  private lastStructure = '';
  /** Bounties already announced as done this session. */
  private readonly toldReady = new Set<string>();
  // ── The Mirror Slate (docs/handoff/mirror-slate.md) ──
  private readonly slate = inject(SlateService);
  private readonly potions = inject(PotionService);
  private launchSub?: Subscription;
  // ── The world clock (docs/handoff/world-clock.md) ──
  private readonly clock = inject(WorldClockService);
  private readonly eclipses = inject(EclipseService);
  /** The world second last read (the clock is read once a world minute = one real second). */
  private clockSecond = -1;
  /** The sky last handed to the engine. */
  skyNow: Sky | null = null;
  /** The sky's phase ('dawn' … 'eclipse'), for the canvas, the keepers and the sound. */
  skyPhase: SkyPhase = 'day';
  /** The HUD's phase plate under the minimap ("22:14"), and the eclipse warning's minutes left (null: no warning). */
  skyClock = '';
  eclipseWarn: number | null = null;
  /** Announcements already made this session (an eclipse's "soon", "near", "start"; a night's fall). */
  private readonly clockTold = new Set<string>();
  // ── Make your Keeper ──
  private readonly looks = inject(KeeperLookService);
  private readonly onboarding = inject(OnboardingService);
  /** The look + gear last sent to the engine. */
  private lookPushKey = '';
  /** "Make your Keeper" opened itself once for a brand-new Keeper (this tab). */
  private makerOffered = false;
  /** HUD ticks since the world mounted, before the Glass is offered. */
  private makerWait = 0;
  /** The one gentle nudge: a lit dot on the Places button until the list is opened (existing saves). */
  lookNudge = false;
  /** The open Places list carries the nudge line this once. */
  lookNudgeShown = false;
  /** The Keeper's chosen name (the vitals label), or '' for "Keeper". */
  keeperName = '';
  /** The satchel's paper-doll figure: the player's Keeper wearing what is worn now (a data URL, painted per change). */
  dollFigure = '';
  /** The pane the Keeper holds (0: none, no button). Re-read on the HUD tick. */
  slateTier: SlateTier = 0;
  private slateSub?: Subscription;
  private storageSub?: Subscription;
  private readonly storageHealth = inject(StorageHealthService);
  // ── The Lost Cabinets (docs/handoff/lost-cabinets.md) ──
  private readonly cabinets = inject(CabinetsService);
  private cabinetSub?: Subscription;
  /** The Slate's glass is held up (the HUD button pulses with its warmth). */
  scanning = false;
  /** What the glass reads now. */
  scanWarmth: Warmth = 'none';
  /** The pulse's period (s) for the HUD's CSS, 0 when quiet. */
  scanPeriod = 0;
  private scanPulseAt = 0;
  /** Cabinets the glass has shown this session (they stay drawn until the page goes). */
  private readonly shownCabinets = new Set<string>();
  /** Cabinets Glim has already said something about this session. */
  private readonly glimToldCabinet = new Set<string>();
  private cabinetMarksKey = '';
  /** The realm machines pushed to this engine, keyed by which are found (shared/cascade/realm-machines.model.ts). */
  private machineMarksKey = '';
  private readonly gamesLedger = inject(PlayLedgerService);
  /** Glim brightens for the bond's sense, or for a warm glass; one call carries both. */
  private bondBright = false;
  private cabinetBright = false;
  /** A level up anywhere this session: the Keeper's face lights up (keeper-paint.ts). */
  private joySub?: Subscription;
  private readonly levelUps = inject(LevelUpService);
  private readonly keeperLevels = inject(KeeperLevelService);
  private keeperLvSub?: Subscription;
  /** Where each hooked cast's bob sat (a catch bounty needs the water's column). */
  private readonly hookedAt = new Map<string, { liquid: string; col: number; row: number }>();

  constructor() {
    // Gear asks for a level (and some bases an attribute) before it goes on; already-worn pieces stay worn.
    this.inventory.setWearCheck(item => meetsRequirements(item, this.standing));
    // Hydration can swap the server canvas after the first callback. Wait until
    // the canvas that is actually on screen has a size, then draw into that one.
    afterNextRender(() => this.startWorld());
    // The hearth pill renders on the server too: its strings must exist before the engine does.
    this.i18n.register(HEARTH_I18N);
    this.i18n.register(LORE_I18N);
    this.i18n.register(HUD_I18N);
    this.i18n.register(ASHGUARD_I18N);
    this.i18n.register(LANTERN_I18N);
    this.i18n.register(THORN_I18N);
    this.i18n.register(TOWN_TASKS_I18N);
    this.i18n.register(ACCOUNT_I18N);
    this.i18n.register(TOOLS_I18N);
    this.i18n.register(VAULT_STATION_I18N);
    this.i18n.register(SLATE_I18N);
    this.i18n.register(REALM_MACHINES_I18N);
    this.i18n.register(WORLD_CLOCK_I18N);
    this.i18n.register(DARK_I18N);
    this.i18n.register(KEEPER_LOOK_I18N);
    this.i18n.register(PETS_I18N);
    this.i18n.register(CABINETS_I18N);
    this.i18n.register(LIVING_I18N);
    this.map.onTap = (col, row) => this.zone.run(() => this.mapTap(col, row));
    try { this.trackedPinId = localStorage.getItem(activeCharacterKey(TRACK_KEY, localStorage)) || null; } catch { /* nothing tracked */ }
  }
  private liveCanvas(): HTMLCanvasElement | null {
    const candidates = [this.canvas?.nativeElement, this.host.nativeElement.querySelector('canvas'), document.querySelector('main.play-mode canvas')];
    for (const canvas of candidates) {
      if (canvas instanceof HTMLCanvasElement && canvas.isConnected && canvas.clientWidth >= 2 && canvas.clientHeight >= 2) return canvas;
    }
    return null;
  }
  private startWorld(): void {
    if (!this.browser) return;
    this.hearthOpen = this.readHearthOpen();
    // The game is the screen: the site-wide backdrop (starfield canvas, pulsar,
    // sigil, runes) hides under this class and cosmic-engine.js parks its loops.
    document.body.classList.add(WORLD_ROUTE_CLASS);
    // Links inside a hosted page stay in the game (see panelLinkClick).
    this.placePanel.nativeElement.addEventListener('click', this.panelLinkClick, true);
    this.inventory.init();
    this.activity.init();
    this.homestead.start();
    // Lune watches her tables from here on: the tenth play hands the Slate over, wherever it was played.
    this.slate.init();
    this.slateSub = this.slate.awarded$.subscribe(() => { this.tickSlate(); this.message = this.t('slate.awarded'); });
    // A full device used to refuse pickups; now the save keeps going in memory
    // and the cloud, and the player is told once, gently (storage-health.service.ts).
    this.storageHealth.start();
    let toldStorage: string | null = null;
    this.storageSub = this.storageHealth.state$.subscribe(state => {
      if (state === 'ok' || state === toldStorage) return;
      toldStorage = state;
      const key = state === 'full'
        ? (this.store.attached ? 'play.hud.msg.storageFullCloud' : 'play.hud.msg.storageFull')
        : 'play.hud.msg.storageNearlyFull';
      this.zone.run(() => { this.message = this.t(key); });
    });
    // The Slate's phone apps that are places of their own (the Pets well, the Codex): fold the Slate, open the place.
    this.launchSub = new Subscription();
    this.launchSub.add(this.slate.close$.subscribe(() => this.zone.run(() => { if (this.panel?.kind === 'slate') this.closePanel(); })));
    this.launchSub.add(this.slate.petFelt$.subscribe(e => this.zone.run(() => this.petFelt(e))));
    // The Slate's Scan: holding the glass up folds the Slate so you can walk with it.
    this.cabinets.refresh();
    this.cabinetSub = this.cabinets.scanning$.subscribe(on => this.zone.run(() => this.scanChanged(on)));
    const saved = this.store.read(SAVE_KEY) as { era?: number; resetAt?: string | null; restored?: boolean } | null;
    this.restored = saved?.restored === true && saved.era === INVENTORY_ERA && saved.resetAt === this.store.readRaw(RESET_STAMP_KEY);
    this.economy.init();
    this.infusions.init();
    // Back where the Keeper last stood. A `?at=` link resolves after this and still wins.
    const play = this.playSave();
    const home = typeof play.town === 'string' && (REALM_TOWN_IDS as readonly string[]).includes(play.town) ? this.townFor(play.town as RealmTownId) : undefined;
    if (home) this.town = home;
    // One World: v2's claims and chests come across once (the grants are keyed; the marker makes it once).
    if (this.oneWorld) {
      const moved = this.worldMigration.run();
      if (moved && (moved.claims || moved.stacks || moved.gear)) setTimeout(() => this.zone.run(() => { this.message = this.t('play.world.migrated'); }), 600);
    }
    this.coinsKept = Number.isInteger(play.coins) && (play.coins as number) > 0 ? play.coins as number : 0;
    this.zone.runOutsideAngular(() => {
      this.room = new SocialRoom(snapshot => this.zone.run(() => {
        this.social = snapshot;
        this.engine?.setPeers(snapshot.players.filter(p => p.id !== snapshot.id).map(p => ({ ...p, area: p.zone, facing: p.facing, animation: p.animation })));
        this.engine?.setChat(snapshot.messages, snapshot.id);
      }));
      this.mountEngine();
      // The realm the Keeper wakes in counts as its old hall (see noteVisit).
      if (REALM_TOWN_IDS.includes(this.town.id as RealmTownId)) this.noteVisit(`/world/realms/${this.town.id}`);
      this.bindFeel();
      // Only a change of `at` moves the world: a hosted page that writes its own query
      // (the Character hub's ?tab=) must not read as "no place open" and close itself.
      this.atSub = this.route.queryParamMap.pipe(map(params => params.get('at')), distinctUntilChanged())
        .subscribe(at => this.zone.run(() => this.applyAt(at)));
      // Cloud save replaced the Delve (another device's dig): rebuild it from the merged save.
      this.delveSub = this.delve.reloaded$.subscribe(() => this.engine?.setDelve(this.delve));
      // Cloud save merged another device's harvests: nodes re-read their regrowth.
      this.gatherSub = this.gatherSave.reloaded$.subscribe(() => this.engine?.setGathering(this.gatherSave));
      this.joySub = this.levelUps.events$.subscribe(() => { this.engine?.keeperFeel('happy', 1.4); this.companions.levelUp(); });
      // The Keeper's own level-up (Hunting XP on the Keeper curve): the fanfare banner, the light pillar, the badge.
      this.keeperLvSub = this.keeperLevels.events$.subscribe(event => this.zone.run(() => this.keeperLeveled(event)));
      // A save that passed milestones before they existed gets their one-time pay now (receipt first, never twice).
      queueMicrotask(() => this.zone.run(() => this.payMilestoneBacklog()));
      this.homeSub = this.homestead.hud$.subscribe(hud => { this.boughtBuilding = hud.rows.some(row => row.owned > 0); });
      // After the caller's own line ("Ore gathered"): the grant announces before the caller writes it.
      this.routedSub = this.inventory.routed$.subscribe(routed => queueMicrotask(() => this.zone.run(() => this.onRouted(routed))));
      this.timer = setInterval(() => this.zone.run(() => { this.now = Date.now(); this.mountEngine(); this.pushStats(); this.refreshGuide(); this.tickAreaCard(); this.tickAbilities(); this.tickWhereabouts(); this.tickTasks(); this.tickMakerOffer(); this.tickPhonePose(); this.tickDelveV2(); this.drawMaps(); this.tickSlate(); this.tickScan(); this.tickClock(); this.tickWorld(); }), 200);
    });
  }
  /** The play view can be replaced once during hydration. Follow the live canvas. */
  private mountEngine(): void {
    const canvas = this.liveCanvas();
    if (!canvas || canvas === this.boundCanvas) return;
    this.engine?.destroy();
    this.boundCanvas = canvas;
    this.i18n.register(LIFE_I18N);
    this.i18n.register(DELVE_I18N);
    this.i18n.register(UNDERHEARTH_I18N);
    this.i18n.register(RIFT_I18N);
    this.i18n.register(FIRST_GOALS_I18N);
    this.i18n.register(TD_PROLOGUE_I18N);
    this.i18n.register(FISHING_I18N);
    this.i18n.register(GLIM_I18N);
    this.i18n.register(GLIM_BOND_I18N);
    this.i18n.register(GLIM_ALIVE_I18N);
    this.i18n.register(STORY_I18N);
    this.i18n.register(BOUNTIES_I18N);
    this.i18n.register(HEIGHTS_I18N);
    this.i18n.register(SOUND_I18N);
    this.i18n.register(LOOT_I18N);
    this.i18n.register(COLD_HEARTH_I18N);
    this.i18n.register(SPELLSTONES_I18N);
    this.i18n.register(GRAVE_I18N);
    this.i18n.register(SEXTON_I18N);
    this.i18n.register(ONE_WORLD_I18N);
    this.i18n.register(TRAVEL_MAP_I18N);
    this.keeperKey = ''; this.marksKey = '';
    // Top-down (docs/design/top-down.md): behind the `?td=1` gate, the Seamworks square is walked in the new
    // 3/4 view; same options and callbacks, so every panel, quest and service below keeps working.
    this.topDown = this.browser && topDownGate() && this.town.id === 'infernal';
    const makeEngine = this.topDown
      ? (c: HTMLCanvasElement, o: EngineOptions) => createTopDownEngine(c, o) as unknown as SeamworksEngine
      : (c: HTMLCanvasElement, o: EngineOptions) => new SeamworksEngine(c, o);
    this.engine = makeEngine(canvas, {
      assets: { keeper: this.art('keeper-base'), creature: this.art('rivet-maw'), ore: this.art(CINDER_ORE_ID), blade: this.art('basalt-edge') },
      art: key => this.art(key),
      // Keeper name tags and their one line of chatter (world/life.i18n.ts).
      translate: key => this.i18n.translate(key),
      // Scene paintings follow the ArtScene convention: assets/images/<basename>-<width>.webp.
      scene: name => `assets/images/${name}-1536.webp`,
      town: this.town,
      // Pickups fly to the satchel's coin count, wherever the HUD layout put it. Read per pickup.
      satchelTarget: () => this.satchelPoint(),
      onInteract: (target: InteractionTarget) => this.zone.run(() => this.act(target)),
      onStation: station => this.zone.run(() => this.openStation(station)),
      // Top-down: a town task giver spoken to (E, a tap): the talk window, or false to open the stall as usual.
      onTalk: keeperId => this.zone.run(() => this.talkTo(keeperId)),
      onLoot: loot => this.zone.run(() => (loot.item || loot.rune ? this.collectGear(loot.id, loot)
        : (loot.coins > 0 ? this.collectCoins(loot.id, loot.coins) : true)
        && (loot.ore === 0 || this.collectMaterial(loot.id, loot.material ?? CINDER_ORE_ID, loot.ore)))),
      // What a kill drops on top of its area's table (shared/loot/drop-tables.ts). Outside the zone: pure rolls.
      rollLoot: kill => this.loot.rollLoot(kill).map((drop, i) => lootEntry(drop, `loot${i}`)),
      // The corpse run's purse, walked over: its Gold comes home.
      onPurse: () => this.zone.run(() => {
        const gold = this.loot.recover();
        if (gold > 0) { this.message = this.t('play.loot.recovered', { n: gold }); this.sound.sfx('coin'); this.bump('.coin-count'); }
        this.pushPurse();
      }),
      // The Cold Hearth (shared/hearth, top-down): a fall's cost, the wake at the hearth, a hearth lit, the shrine.
      onFall: event => this.zone.run(() => this.tdFell(event)),
      onWoke: event => this.zone.run(() => this.tdWoke(event)),
      onHearth: event => this.zone.run(() => this.hearthLit(event)),
      onShrine: event => this.zone.run(() => this.openShrine(event)),
      onWorldAction: event => this.zone.run(() => {
        const result = this.worldAction(event);
        // A generated Delve cell broke (it paid XP, or would have): the Board Herald's dig bounties count it.
        if (result !== false && event.node && event.xp > 0 && event.areaId === 'ember-delve') {
          this.bountyEvent({ kind: 'dig', node: event.node, row: Number(event.cellKey.split(',')[1]), token: event.cellKey });
        }
        return result;
      }),
      onDiscover: event => this.zone.run(() => this.discover(event)),
      onPlace: event => this.zone.run(() => this.placeFromSatchel(event)),
      onTakeBack: event => this.zone.run(() => this.takeToSatchel(event)),
      onUse: event => this.zone.run(() => this.useCell(event)),
      onBucket: event => this.zone.run(() => this.bucketSwap(event)),
      onFish: event => this.zone.run(() => this.fishHooked(event)),
      onKill: event => this.zone.run(() => this.hunted(event)),
      onHeightFind: event => this.zone.run(() => this.heightFound(event)),
      onCabinet: event => this.zone.run(() => this.cabinetUsed(event)),
      // A realm machine (the Orrery Tumbler): found once, then played in the place panel.
      onMachine: event => this.zone.run(() => this.machineUsed(event)),
      // The Living World: a beetle or a moth caught with a swing (its drop, once a day per creature).
      onCatch: event => this.zone.run(() => this.critterCaught(event)),
      // One World: a Waystone seen, lit, or used (waystones.service.ts writes; the engine draws).
      onStone: event => this.zone.run(() => this.stoneEvent(event)),
      // The world's sounds: never through the zone (no change detection for a footstep).
      onSfx: cue => this.engineSfx(cue),
      // The tool in hand changed (held-tool.ts): a soft cue and the canvas key for tests. No change detection.
      onHeldTool: tool => this.heldToolSwapped(tool),
      // The pet did something (pet-brain.ts): XP, finds, toasts, Glim's word (companion-host.ts).
      onPet: event => this.zone.run(() => this.companions.onPet(event)),
      // A moment Glim reacts to (a dodge, a rare beam, a drop left lying).
      onGlimCue: cue => this.zone.run(() => this.companions.onGlimCue(cue)),
      // Lumvesh, the Seek (td-seek.ts): Glim's words for where it points.
      onSeek: answer => this.zone.run(() => { this.message = this.seekLine(answer); }),
      // The Sexton's Count (shared/sexton): a stone read, the page in the dark, Barrow Door 1, the forty-first grave.
      onSexton: event => this.zone.run(() => this.sextonSaw(event.kind === 'stone' ? { kind: 'stone', n: event.n ?? 1 } : event.kind === 'page' ? { kind: 'page', dark: !!event.dark } : { kind: event.kind })),
      // Each player digs their own Delve: seed and dug cells from the save.
      delve: this.delve,
      // Gathering regrowth is measured from saved harvest times, so a reload keeps it.
      gathering: this.gatherSave,
      onState: (state: EngineState) => this.zone.run(() => {
        if (state.message !== this.state.message) this.message = '';
        // The Keeper fell: the corpse run (shared/loot). A share of the purse lies where they fell.
        if (state.defeated && !this.state.defeated) this.fallen(state);
        if (state.delve && !this.state.delve) this.refundOrphanChests();
        // At the shaft: is there a camp below to descend to? Asked once per arrival, not per frame.
        if (state.nearby === 'delve' && this.state.nearby !== 'delve') { this.campReady = !!this.engine?.hasDelveCamp(); this.anchorsReady = (this.engine?.delveAnchors().length ?? 0) > 0; }
        else if (state.nearby !== 'delve') this.campReady = false;
        this.state = state;
        // Fishing and liquids on the canvas, for tests and tools (the HUD says it in words).
        const el = this.canvas?.nativeElement;
        if (el) {
          el.setAttribute('data-fishing', state.fishing?.phase ?? (state.canFish ? `can:${state.canFish}` : ''));
          el.setAttribute('data-liquid', state.liquid?.in ?? '');
          // The fish under the water in view (fish-shadows.ts): "where are the fish?" — there.
          el.setAttribute('data-fish-shadows', String(state.fishShadows ?? 0));
          // Loot & combat (shared/loot): drops on the ground by rung, the aura, the marked creatures, the foe's pack.
          el.setAttribute('data-loot-drops', state.loot?.drops ?? '');
          el.setAttribute('data-loot-labels', state.loot?.labels ?? '');
          el.setAttribute('data-aura', state.loot?.aura ?? '');
          el.setAttribute('data-aura-debuffed', String(state.loot?.debuffed ?? 0));
          el.setAttribute('data-foe-pack', state.loot?.foe ?? '');
          el.setAttribute('data-purse', state.loot?.purse ? 'true' : 'false');
          el.setAttribute('data-tier', state.loot?.tier ?? '');
          el.setAttribute('data-kills', String(state.kills ?? 0));
          // The Underhearth (Phase 8): depth, the cart, the grapple, the furnace's fight.
          el.setAttribute('data-depth', state.depth === undefined ? '' : String(state.depth));
          el.setAttribute('data-biome', state.biome ?? '');
          el.setAttribute('data-riding', state.riding ? 'true' : 'false');
          el.setAttribute('data-grapple', state.grappling ?? '');
          el.setAttribute('data-furnace', state.furnace ? `${state.furnace.phase}:${state.furnace.vents}:${state.furnace.breathing ? 1 : 0}` : '');
          // The realm Delves behind the Rift Gates: which realm, the ink tide, ink-blind, under a mirror.
          el.setAttribute('data-realm', state.realm ? `${state.realm.id}:${state.realm.tide ?? 'open'}` : '');
          // The Root Deeps: holes waiting/grown back; the Prism Mines: beams and cells of solid light.
          el.setAttribute('data-realm-rule', !state.realm ? '' : state.realm.regrowing !== undefined ? `${state.realm.regrowing}/${state.realm.regrown ?? 0}` : state.realm.beams !== undefined ? `${state.realm.beams}/${state.realm.bridges ?? 0}`
            // The Orrery Wells: the Keeper's down, how often it turned, the Fallen Ephemeris's state.
            : state.realm.down !== undefined ? `${state.realm.down}/${state.realm.flips ?? 0}/${state.realm.ephemeris ?? ''}` : '');
          // Which way the Keeper falls (pets and any follower hang from it; engine/celestial.ts).
          el.setAttribute('data-gravity', state.gravity === -1 ? 'up' : 'down');
          el.setAttribute('data-ink-blind', state.realm?.inkBlind ? 'true' : 'false');
          // The world clock's nodes and creatures out here now ("moonwake,eclipse-glass,ink-lantern").
          el.setAttribute('data-timed', state.timed ?? '');
          // One World: the world, the region under the Keeper, the stone in reach (id:lit:charge), the hour.
          el.setAttribute('data-world', state.world ?? '');
          el.setAttribute('data-region', state.region ?? '');
          el.setAttribute('data-stone', state.stone ? `${state.stone.id}:${state.stone.lit ? 'lit' : 'dark'}:${state.stone.charge.toFixed(2)}` : '');
          el.setAttribute('data-hour', this.oneWorld ? this.hour.toFixed(1) : '');
        }
        this.soundScene(state);
        // Presence: in a world the zone is the WORLD (peers meet anywhere in it); elsewhere the area's name.
        this.room?.update(state.x, state.y, state.world || state.area || 'Basalt Seamworks', state.facing === -1 ? -1 : 1, state.animation ?? 'idle');
      }),
    });
    this.engine.setHomesteadView(this.homestead.scene);
    this.statsKey = '';
    this.cabinetMarksKey = ''; this.cabinetBright = false; this.machineMarksKey = '';
    this.loadoutKey = ''; this.lookPushKey = '';
    this.toolKey = ''; this.heldToolsKey = '';
    this.canvas?.nativeElement.setAttribute('data-keeper-held', '');
    this.engine.setPlaceable(this.placing);
    // A fresh engine gets the sky at once (not on the next world second).
    this.clockSecond = -1; this.tickClock();
    this.sync();
    this.engine.setPeers(this.social.players.filter(p => p.id !== this.social.id).map(p => ({ ...p, area: p.zone, facing: p.facing, animation: p.animation })));
    this.engine.setChat(this.social.messages, this.social.id);
    this.heightsSub?.unsubscribe();
    this.heightsSub = this.heights.found$.subscribe(found => this.engine?.setHeightsFound(found));
    this.heights.refresh();
    this.hearthSub?.unsubscribe();
    if (this.topDown) this.hearthSub = this.hearth.state$.subscribe(h => this.tdHearth?.setHearths?.({ lit: h.lit, wake: h.wake, blessings: h.blessings.length }));
    // The screenshot specs' hook (`?fxstones=1`, only under an automated browser): Soul, blanks, grave-goods.
    this.unStonesHook(); this.unStonesHook = this.topDown ? installStonesHook({ stones: this.spellstones, inventory: this.inventory }) : () => undefined;
    this.bindPointer(canvas);
    this.engine.start();
    if (this.panel && this.panel.kind !== 'slate') this.engine.setPaused(true);
    if (this.oneWorld) {
      // The Waystones read the world through this view; the Keeper logs in where they last stood (a deep link wins).
      this.waystones.attach(this.waystoneHost);
      this.engine.setStoneState(this.waystones.litSet(), this.waystones.seenSet());
      this.tickWorld();
      // Hydration can swap the canvas (and the engine) once: every mount in the first seconds of the visit resumes.
      if (!this.resumed || Date.now() - this.openedAt < 8000) this.resume();
    }
    if (this.pendingAt) { const at = this.pendingAt; this.pendingAt = null; this.applyAt(at); }
  }
  /**
   * Click/tap to walk and to interact, hover to highlight. Bound outside the
   * zone: a pointermove per frame must not run change detection. Anything that
   * changes component state comes back in through the engine callbacks, which
   * already re-enter the zone.
   */
  private bindPointer(canvas: HTMLCanvasElement): void {
    this.unbindPointer?.();
    this.zone.runOutsideAngular(() => {
      const move = (event: PointerEvent): void => {
        if (!this.engine || this.panel) return;
        // Smart cursor (Terraria): in a delve the mouse aims wherever it is; a finger aims while it is down.
        if (this.state.delve && (event.pointerType === 'mouse' || held)) this.engine.aimAt(event.clientX, event.clientY);
        if (event.pointerType !== 'mouse') return;
        const station = this.engine.pick(event.clientX, event.clientY).station;
        this.engine.setHover(station?.id ?? null);
        canvas.style.cursor = station ? 'pointer' : '';
        this.showTip(station, event.clientX, event.clientY);
      };
      const leave = (event: PointerEvent): void => {
        if (event.pointerType !== 'mouse') return;
        this.engine?.setHover(null); this.engine?.clearPointer(); this.engine?.clearAim(); canvas.style.cursor = ''; this.showTip(null, 0, 0);
      };
      // Touch has no hover: light the touched station and show its name card
      // for a beat, so a tap reads as "going there" before the Keeper arrives.
      const down = (event: PointerEvent): void => {
        if (event.pointerType === 'mouse' || !this.engine || this.panel) return;
        const station = this.engine.pick(event.clientX, event.clientY).station;
        if (!station) return;
        this.engine.setHover(station.id);
        this.showTip(station, event.clientX, event.clientY);
        if (this.tipTimer) clearTimeout(this.tipTimer);
        this.tipTimer = setTimeout(() => { this.engine?.setHover(null); this.showTip(null, 0, 0); }, TOUCH_TIP_MS);
      };
      // Delves, held use (Terraria): hold the left button (or a finger, with the pick) on a
      // cell to keep mining it at the tool's pace; hold the right button (or a finger, with a
      // placeable chosen) and drag to place along the way. A press on a placed thing takes it back.
      let held = false;
      /** The press that just ended did something: the click that follows it does not do it again. */
      let acted = false;
      const pressStart = (event: PointerEvent): void => {
        acted = false;
        if (!this.engine || this.panel || !this.state.delve || (event.button !== 0 && event.button !== 2)) return;
        const place = event.button === 2 || (event.pointerType !== 'mouse' && this.touchTool === 'place' && !!this.engine.placeable);
        held = true;
        try { canvas.setPointerCapture(event.pointerId); } catch { /* a synthetic pointer: no capture */ }
        this.zone.run(() => this.engine?.useHold(event.clientX, event.clientY, place ? 'place' : 'dig'));
      };
      const pressEnd = (event: PointerEvent): void => {
        if (!held) return;
        held = false;
        acted = (this.engine?.useRelease() ?? 0) > 0;
        if (event.pointerType !== 'mouse') this.engine?.clearAim();
      };
      // The right button's work is done on press (above); the menu never opens over the world.
      const context = (event: MouseEvent): void => { if (this.state.delve) event.preventDefault(); };
      // The kind of pointer that started the press: a tap, unlike a mouse click, follows the touch tool.
      let tapped = false;
      const note = (event: PointerEvent): void => { tapped = event.pointerType !== 'mouse'; };
      const click = (event: MouseEvent): void => {
        if (!this.engine || this.panel || this.state.defeated) return;
        // The press already mined, placed or took back: the click does not do it twice.
        if (acted) { acted = false; return; }
        // A tap with a placeable chosen places it on that cell (or takes back what is there);
        // out of reach, the Keeper walks toward it instead of digging it.
        if (tapped && this.state.delve && this.touchTool === 'place' && this.engine.placeable) {
          if (this.zone.run(() => this.engine?.placeAtClient(event.clientX, event.clientY))) return;
          this.engine.moveTo(this.engine.pick(event.clientX, event.clientY).x);
          return;
        }
        // A drop's name plate (or the drop) under the tap: pick it up, or walk to it (shared/loot).
        if (this.zone.run(() => this.engine?.pickDrop(event.clientX, event.clientY))) return;
        if (this.engine.strikeAt(event.clientX, event.clientY)) return;
        const hit = this.engine.pick(event.clientX, event.clientY);
        // The Homestead Forge strikes where it is clicked, without walking there.
        if (hit.station && this.homestead.scene.interact(this.state.areaId ?? '', hit.station.id)) return;
        if (hit.station) this.engine.goToStation(hit.station.id);
        else this.engine.moveTo(hit.x);
      };
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerleave', leave);
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointerdown', note);
      canvas.addEventListener('click', click);
      canvas.addEventListener('pointerdown', pressStart);
      canvas.addEventListener('pointerup', pressEnd);
      canvas.addEventListener('pointercancel', pressEnd);
      canvas.addEventListener('contextmenu', context);
      this.unbindPointer = () => {
        this.engine?.useRelease();
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerleave', leave);
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointerdown', note);
        canvas.removeEventListener('click', click);
        canvas.removeEventListener('pointerdown', pressStart);
        canvas.removeEventListener('pointerup', pressEnd);
        canvas.removeEventListener('pointercancel', pressEnd);
        canvas.removeEventListener('contextmenu', context);
      };
    });
  }
  /**
   * The station name card beside the pointer. Written straight to the DOM:
   * it moves with every pointermove, which must not run change detection.
   */
  private showTip(station: StationDef | null, clientX: number, clientY: number): void {
    const tip = this.stationTip?.nativeElement;
    if (!tip) return;
    if (!station || this.panel) {
      if (this.tipStation !== null) { tip.hidden = true; this.tipStation = null; }
      return;
    }
    if (this.tipStation !== station.id) {
      this.tipStation = station.id;
      const name = tip.querySelector('b'); const blurb = tip.querySelector('small');
      if (name) name.textContent = titleCase(station.label);
      if (blurb) blurb.textContent = station.blurb ?? '';
      tip.hidden = false;
    }
    const stage = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
    const x = Math.min(Math.max(clientX - stage.left + 16, 8), stage.width - 248);
    const y = Math.max(clientY - stage.top - 64, 72);
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  /** Pop a satchel number when a pickup lands. Web Animations, so a burst of
   *  pickups restarts the pop instead of queueing class toggles. */
  private bump(selector: string): void {
    if (this.reducedMotion) return;
    const el = this.host.nativeElement.querySelector(selector) as HTMLElement | null;
    el?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.45)', color: '#ffe08a', offset: .35 }, { transform: 'scale(1)' }],
      { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' },
    );
  }
  /**
   * A monster's material drop reached the Keeper. The grant id is the engine's
   * drop id (session uuid : kill count : drop-table entry), so a pickup the
   * engine reports twice is still one grant. Refused → the drop stays on the
   * floor and the Keeper is told why.
   */
  private collectMaterial(dropId: string, material: string, quantity: number): boolean {
    // Ore trains Mining like a vein does: one gateway write grants the ore and the XP together.
    if (miningTierFor(material)) {
      const result = this.skillActions.act({
        mutationId: `seamworks-loot:${dropId}`, skill: 'mining', xp: ORE_PICKUP_XP, materialId: material, qty: quantity,
        locationId: this.worldLocation(this.state.areaId ?? this.town.id),
      });
      if (!result.ok) {
        this.message = this.t('play.hud.msg.pickupFailed');
        return false;
      }
    } else if (!this.inventory.grantStack(`seamworks-loot:${dropId}`, material, quantity)) {
      this.message = this.t('play.hud.msg.pickupFailed');
      return false;
    }
    const name = materialDisplay(material)?.name ?? titleCase(material.replace(/-/g, ' '));
    this.gotItem(quantity, name, material);
    this.bump(material === CINDER_ORE_ID ? '.ore-count' : material === EMBER_RESIDUE_ID ? '.ember-count' : '.satchel .clasp span');
    return true;
  }
  /**
   * A coin drop reached the Keeper: the coins go to the Gold purse (once per
   * drop id) and onto the satchel's kept count, saved with the town.
   */
  private collectCoins(dropId: string, coins: number): boolean {
    if (this.creditedDrops.has(dropId)) return true;
    this.creditedDrops.add(dropId);
    // Gold Find (worn gear, Forge Power, a Gold potion) raises the pile on the way in; the satchel's count keeps what
    // the purse actually took.
    const paid = this.economy.earnHuntGold(coins);
    this.coinsKept += paid || coins;
    this.writePlay({ coins: this.coinsKept });
    this.bump('.coin-count');
    this.sound.sfx('coin');
    return true;
  }
  /**
   * A gear or rune drop reached the Keeper: LootService mints it (the roll is
   * frozen then) or grants the rune. False leaves it shining on the ground.
   */
  private collectGear(dropId: string, loot: { item?: { definitionId: string; rarity: LootRarity; unique: boolean; level?: number }; rune?: string }): boolean {
    const got = this.loot.grantDrop(dropId, loot);
    if (!got) return false;
    this.sound.sfx('pickup');
    this.pulseSatchel();
    return true;
  }
  /** The Keeper fell: the tier's share of the purse lies where they fell (the corpse run). */
  private fallen(state: EngineState): void {
    if (!this.browser) return;
    this.fallGold = this.loot.fall(state.areaId ?? this.town.id, state.x ?? 0, state.y ?? 0);
    this.pushPurse();
  }
  /** The top-down engine's Cold Hearth members (td-hearth.ts). */
  private get tdHearth(): { setHearths?: (s: { lit: readonly string[]; wake: string | null; blessings: number }) => void } | undefined {
    return this.topDown ? this.engine as unknown as { setHearths?: (s: { lit: readonly string[]; wake: string | null; blessings: number }) => void } : undefined;
  }
  /** The Keeper fell (top-down): the Cold Hearth takes the fall's cost; the purse lies where they fell. */
  private tdFell(event: { area: string; x: number; y: number }): void {
    if (!this.browser) return;
    this.wakeCard = null;
    this.lastFall = this.hearth.fall(event, skillXp(this.activity.snapshot.progress, 'hunting'));
    this.fallGold = this.lastFall.gold;
    this.pushPurse();
  }
  /** The Keeper woke at a hearth (or the square): the wake card says where, and what the fall cost. */
  private tdWoke(event: { hearth: string | null; town: string }): void {
    const fall = this.lastFall ?? { grace: true, gold: 0, debt: 0, debtTotal: this.hearth.state.debt, blessed: 0 };
    this.lastFall = null;
    this.wakeCard = { town: event.town, hearth: !!event.hearth, fall };
    this.sound.sfx('glim');
    clearTimeout(this.wakeTimer);
    this.wakeTimer = setTimeout(() => this.zone.run(() => { this.wakeCard = null; }), 12000);
  }
  /** A hearth lit by the Keeper's hand: it is the wake point now. */
  private hearthLit(event: { id: string; town: string; capital: boolean }): void {
    const { first } = this.hearth.light(event.id);
    this.message = this.t(first ? 'play.coldHearth.lit.first' : 'play.coldHearth.lit.again', { town: event.town });
    this.sound.sfx(first ? 'five' : 'tap');
    if (first) this.toastLoot(this.t('play.coldHearth.lit.glim'));
  }
  /** A capital's Hearth Shrine: the five blessings in the place panel. */
  private openShrine(event: { id: string; town: string }): void {
    if (!this.browser) return;
    this.showPanel({ kind: 'shrine', stationId: event.id, title: this.t('play.coldHearth.shrine.title'), kicker: event.town });
  }
  /** The Ember debt still owed (Hunting XP), for the HUD and the sheet. */
  readonly graceLevel = HEARTH_GRACE_LEVEL;
  get emberDebt(): number { return this.topDown ? this.hearth.state.debt : 0; }
  /** Hand the engine the purse (it lies only in the area it fell in). */
  private pushPurse(): void {
    const p = this.loot.state.purse;
    this.engine?.setFallenPurse(p ? { area: p.area, x: p.x, y: p.y, gold: p.gold } : null);
  }
  /** Loot & combat rules (aura, resists, difficulty, filter) to the engine when they change. */
  private pushRules(): void {
    if (!this.engine || !this.browser) return;
    const rules = this.loot.combatRules();
    const key = JSON.stringify(rules);
    if (key === this.rulesKey) return;
    const first = !this.rulesKey;
    this.rulesKey = key;
    this.engine.setCombatRules({ tier: rules.tier, seed: rules.seed, aura: rules.aura, resists: rules.resists, filter: rules.filter });
    if (first) this.pushPurse();
  }
  private playSave(): { town?: unknown; coins?: unknown; td?: unknown; tdAt?: unknown } {
    const raw = this.store.read(PLAY_KEY);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as { town?: unknown; coins?: unknown; td?: unknown; tdAt?: unknown } : {};
  }
  /**
   * The top-down Keeper's last place (owner 2026-10-20: "not saving in my last location"): kept in PLAY_KEY beside the
   * town (device-local, like the side view's), written every two seconds when it changed by a tile with its time
   * (`tdAt`), restored once. The same place is offered to WhereaboutsService, which syncs it per character at most
   * about once a minute (owner 2026-10-21: the place follows the character across devices); the wake place is the
   * newer of the two.
   */
  private tdSavedAt = 0;
  private tdSavedKey = '';
  private tdRestored = false;
  private tickWhereabouts(): void {
    if (!this.topDown || !this.browser) return;
    const e = this.engine as unknown as { whereabouts?: { continent: string; level: string; x: number; y: number }; restoreWhereabouts?: (w: unknown) => boolean } | undefined;
    if (!e?.whereabouts) return;
    if (!this.tdRestored) {
      this.tdRestored = true;
      const saved = this.whereabouts.wakePlace(this.playSave() as { td?: unknown; tdAt?: unknown });
      // A deep link (?at=) means go there, not back.
      if (saved && !this.route.snapshot.queryParamMap.get('at')) e.restoreWhereabouts?.(saved);
      return;
    }
    if (Date.now() - this.tdSavedAt < 2000) return;
    this.tdSavedAt = Date.now();
    const w = e.whereabouts, key = `${w.continent}|${w.level}|${Math.round(w.x / 16)}|${Math.round(w.y / 16)}`;
    if (key === this.tdSavedKey) return;
    this.tdSavedKey = key;
    const at = Date.now();
    this.store.write(PLAY_KEY, { ...this.playSave(), td: w, tdAt: at });
    this.whereabouts.note(w, at);
  }
  /** Merge a change into PLAY_KEY; a write that changes nothing is skipped. */
  private writePlay(patch: { town?: RealmTownId; coins?: number }): void {
    if (!this.browser) return;
    const before = this.playSave();
    const next = { ...before, ...patch };
    if (patch.town && patch.town !== before.town) this.noteVisit(`/world/realms/${patch.town}`);
    if (next.town === before.town && next.coins === before.coins) return;
    this.store.write(PLAY_KEY, next);
  }
  /**
   * Page-visit quests ("open the Codex", "walk the five realm halls") were
   * written when those were pages. In the game-only shell they are panels and
   * towns, so opening a panel records its old URL and reaching a realm town
   * records that realm's hall, through the same ledger NavigationEnd fed.
   */
  private noteVisit(path: string | undefined): void {
    if (!path) return;
    this.questBoard.addToSet('pages', path);
    this.hallEggs.noteHall(path);
    this.secrets.visit(path);
  }
  private toastLoot(text: string, art?: string): void {
    this.logGame(text);
    const key = ++this.toastKey;
    this.lootToasts = [...this.lootToasts, { key, text, ...(art ? { art } : {}) }].slice(-3);
    setTimeout(() => { this.lootToasts = this.lootToasts.filter(toast => toast.key !== key); }, 1800);
  }

  // ── World feel: sound, the Satchel's pulse, the craft's flight (docs/handoff/world-feel.md) ──

  /** The sound waits for the first tap; a craft at a bench flies to the Satchel; the old cues follow the mute. */
  private bindFeel(): void {
    this.releaseSound = this.sound.arm();
    this.feelSub = this.feel.crafted$.subscribe(event => this.zone.run(() => this.craftedFx(event)));
    // The station chimes, rarity stingers and the level-up ding are older, separate voices:
    // the world's Effects slider at zero (or Mute all) quiets them too while the world is open.
    this.soundSub = this.sound.settings$.subscribe(s => {
      const quiet = s.muted || s.effects <= 0;
      this.levelAudio.setMuted(quiet); this.forgeAudio.setMuted(quiet); this.rarityAudio.setMuted(quiet);
    });
    // A soft tick under every HUD button (never the canvas: the world has its own sounds).
    this.zone.runOutsideAngular(() => {
      const host = this.host.nativeElement as HTMLElement;
      const tap = (event: Event): void => {
        const el = event.target as Element | null;
        if (el?.closest?.('button, [role="button"], input[type="checkbox"]')) this.sound.sfx('tap');
      };
      host.addEventListener('click', tap, { capture: true, passive: true });
      this.unbindTap = () => host.removeEventListener('click', tap, { capture: true });
    });
  }
  private unbindTap: (() => void) | null = null;
  private unbindFeel(): void {
    this.releaseSound?.(); this.releaseSound = null;
    this.feelSub?.unsubscribe(); this.soundSub?.unsubscribe();
    this.unbindTap?.(); this.unbindTap = null;
    if (this.craftToastTimer) clearTimeout(this.craftToastTimer);
    // The other pages keep their own sound choices.
    this.levelAudio.setMuted(false); this.forgeAudio.setMuted(false); this.rarityAudio.setMuted(false);
  }
  /** The realm whose music and ground this is: a realm Delve's own, else the town's. */
  private soundRealm(state: EngineState = this.state): RealmId {
    const id = state.realm?.id ?? this.town.realm;
    return (REALM_IDS as readonly string[]).includes(id) ? id as RealmId : 'infernal';
  }
  /** The engine made a sound: give it its material (a cell's, or the town street's). */
  private engineSfx(cue: EngineSfx): void {
    const material = cue.node ? materialOf(cue.node) : TOWN_GROUND[this.soundRealm()] ?? 'stone';
    this.sound.sfx(cue.kind, { material });
    // The landed fish reached the Keeper: into the Satchel it goes.
    if (cue.kind === 'catch') this.zone.run(() => this.pulseSatchel());
  }
  /** What the world sounds like here, from the last report (the service ignores a repeat). */
  private soundScene(state: EngineState): void {
    if (!this.browser) return;
    this.sound.setScene({
      realm: this.soundRealm(state),
      // One World: the beds go by band (§1.2): the surface plays the town's, the underground the Delve's.
      delve: !!state.delve && !(state.world && state.region !== 'ember-delve'),
      boss: !!state.boss && state.enemyHp > 0,
      // The world clock's hour, not the device's: every player hears the same night (shared/world-clock).
      hour: this.clock.time().hour,
      eclipse: !!this.skyNow?.eclipseOn && !state.delve,
      water: !!state.near?.water || state.liquid?.in === 'water',
      lava: !!state.near?.lava || state.liquid?.in === 'lava',
      ink: !!state.near?.ink,
      glim: this.glimVoice.met,
    });
  }
  /**
   * Something entered the Satchel: "+N name" rises from the banner slot (with
   * its picture when it has one), the Satchel pulses, and a blip sounds — a
   * quick run of pickups climbs a little scale.
   */
  private gotItem(qty: number, name: string, id?: string): void {
    this.toastLoot(`+${qty} ${name}`, id ? this.art(id) || undefined : undefined);
    const now = Date.now();
    this.pickupRun = now - this.pickupRun.at < 900 ? { n: Math.min(this.pickupRun.n + 1, 7), at: now } : { n: 0, at: now };
    this.sound.sfx('pickup', { pitch: [0, 2, 4, 7, 9, 12, 14, 16][this.pickupRun.n] });
    this.pulseSatchel();
  }
  /** The Satchel button glows and swells once (reduced motion: the count is enough). */
  private pulseSatchel(): void {
    this.satchelPulses++;
    const clasp = (this.host.nativeElement as HTMLElement).querySelector('.satchel .clasp') as HTMLElement | null;
    if (!clasp) return;
    clasp.setAttribute('data-pulse', String(this.satchelPulses));
    if (this.reducedMotion) return;
    clasp.animate(
      [{ transform: 'scale(1)', filter: 'none' }, { transform: 'scale(1.12)', filter: 'drop-shadow(0 0 6px var(--adventure-ember))', offset: .35 }, { transform: 'scale(1)', filter: 'none' }],
      { duration: 520, easing: 'cubic-bezier(.22, 1, .36, 1)' },
    );
  }
  /**
   * A bench made something (WorldFeelBus): it pops above the bench's reward
   * card with a sparkle, flies to the Satchel, and a toast says where it went
   * with one Open. Owner: "when crafting, where do the items go?" — here.
   */
  private craftedFx(event: CraftedFeel): void {
    if (!this.browser) return;
    this.sound.sfx('craft');
    const name = event.qty > 1 ? `${event.name} ×${event.qty}` : event.name;
    this.craftToast = { key: ++this.toastKey, name };
    if (this.craftToastTimer) clearTimeout(this.craftToastTimer);
    this.craftToastTimer = setTimeout(() => { this.craftToast = null; }, 6500);
    if (this.panel) this.pulseOnClose = true; else this.pulseSatchel();
    this.flyCrafted(event);
  }
  /** The flight itself: a pixel icon from the bench's reward (or the panel's middle) to the Satchel. */
  private flyCrafted(event: CraftedFeel): void {
    const stage = (this.host.nativeElement as HTMLElement).querySelector('.stage') as HTMLElement | null;
    const clasp = stage?.querySelector('.satchel .clasp') as HTMLElement | null;
    if (!stage || !clasp) return;
    const box = stage.getBoundingClientRect();
    const from = (stage.querySelector('.place:not([hidden]) app-reward-pop') ?? stage.querySelector('.place:not([hidden]) .place-body')) as HTMLElement | null;
    const a = from?.getBoundingClientRect(), b = clasp.getBoundingClientRect();
    const sx = a && a.width ? a.left + a.width / 2 - box.left : box.width / 2, sy = a && a.height ? a.top + Math.min(a.height / 2, 80) - box.top : box.height / 2;
    const ex = b.left + b.width / 2 - box.left, ey = b.top + b.height / 2 - box.top;
    const el = document.createElement('div');
    el.className = 'craft-fly';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-item', event.itemId);
    if (event.art) { const img = document.createElement('img'); img.src = event.art; img.alt = ''; el.appendChild(img); }
    else el.textContent = event.name.slice(0, 2);
    // Inline (Angular's encapsulated CSS skips nodes it did not render): a framed pixel icon with a sparkle.
    el.style.cssText = `position:absolute;z-index:8;left:${sx}px;top:${sy}px;width:52px;height:52px;display:grid;place-items:center;pointer-events:none;`
      + 'transform:translate(-50%,-50%);border:2px solid var(--adventure-ember);border-radius:2px;background:var(--adventure-hud-panel-solid);'
      + 'box-shadow:0 0 0 2px var(--adventure-hud-shadow),0 0 22px var(--adventure-ember);color:var(--adventure-parchment);font:600 14px var(--font-game);';
    el.querySelector('img')?.setAttribute('style', 'width:40px;height:40px;image-rendering:pixelated;');
    for (const [x, y, delay] of [[-10, -12, 0], [58, 4, 120], [46, 54, 240], [-8, 44, 360]]) {
      const spark = document.createElement('i');
      spark.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:4px;height:4px;opacity:0;background:var(--adventure-beacon-text);box-shadow:0 0 6px var(--adventure-ember);`;
      el.appendChild(spark);
      if (!this.reducedMotion) spark.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.4)' }, { opacity: 0, transform: 'scale(.4)' }], { duration: 520, delay: 120 + delay, iterations: 2 });
    }
    stage.appendChild(el);
    if (this.reducedMotion) { setTimeout(() => el.remove(), 900); return; }
    const dx = ex - sx, dy = ey - sy;
    const anim = el.animate([
      { transform: 'translate(-50%, -50%) scale(.3)', opacity: 0, offset: 0 },
      { transform: 'translate(-50%, calc(-50% - 26px)) scale(1.25)', opacity: 1, offset: .22 },
      { transform: 'translate(-50%, calc(-50% - 20px)) scale(1)', opacity: 1, offset: .45 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.4)`, opacity: .85, offset: 1 },
    ], { duration: 1300, easing: 'cubic-bezier(.45, 0, .55, 1)', fill: 'forwards' });
    anim.onfinish = () => el.remove();
    anim.oncancel = () => el.remove();
  }
  /** The craft toast's Open: close the bench, open the Satchel on what was made. */
  openCrafted(): void {
    this.craftToast = null;
    if (this.craftToastTimer) clearTimeout(this.craftToastTimer);
    if (this.panel) this.closePanel();
    this.openBag();
  }
  /** Menu → Sound. */
  openSound(): void { this.placesOpen = false; this.soundOpen = true; }
  /** Menu → Loot & Combat. */
  openLoot(): void { this.placesOpen = false; this.lootOpen = true; }
  ngOnDestroy(): void {
    this.unStonesHook();
    this.inventory.setWearCheck(null);
    this.companions.flush();
    this.room?.leave(); this.engine?.destroy(); if (this.timer) clearInterval(this.timer);
    if (this.oneWorld) { this.waystones.cancel(); this.waystones.attach(null); }
    if (this.browser) { this.homestead.stop(); document.body.classList.remove(WORLD_ROUTE_CLASS); this.placePanel?.nativeElement.removeEventListener('click', this.panelLinkClick, true); }
    this.unbindFeel();
    this.atSub?.unsubscribe(); this.delveSub?.unsubscribe(); this.gatherSub?.unsubscribe(); this.homeSub?.unsubscribe(); this.slateSub?.unsubscribe(); this.storageSub?.unsubscribe(); this.launchSub?.unsubscribe(); this.cabinetSub?.unsubscribe(); this.joySub?.unsubscribe(); this.keeperLvSub?.unsubscribe(); clearTimeout(this.levelBannerTimer); this.routedSub?.unsubscribe(); this.heightsSub?.unsubscribe(); this.hearthSub?.unsubscribe(); clearTimeout(this.wakeTimer); this.unbindPointer?.(); this.panelHost?.clear();
    if (this.browser) this.delve.flush();
    if (this.closeTimer) clearTimeout(this.closeTimer);
    if (this.tipTimer) clearTimeout(this.tipTimer);
  }

  // ── Places: stations as in-world panels ────────────────────────────────────

  private get reducedMotion(): boolean {
    return this.browser && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  /**
   * `?at=<station id>`: stand at that station and open it, in whichever built
   * town has it (`findStation`; the current town first, since 'waystone' and
   * 'passage' repeat). Another town, or a hunt of this one, travels there
   * first. Unknown ids are ignored.
   */
  private applyAt(at: string | null): void {
    if (!this.browser) return;
    if (!at) { if (this.panel) this.closePanel(false); return; }
    if (this.panel?.stationId === at) return;
    if (!this.engine) { this.pendingAt = at; return; }
    const found = findStation(at, this.town.id);
    if (!found) {
      // `?at=character` and the other station-less panels (old page URLs redirect here).
      if (at in PANEL_REGISTRY) this.openPanelHere(at as PanelId);
      return;
    }
    const town = this.townFor(found.townId);
    if (!town) return;
    if (town.id !== this.town.id || !this.engine.inTown) { this.town = town; this.engine.setTown(town); this.writePlay({ town: town.id as RealmTownId }); }
    let station = found.station;
    // One World: the station stands at its counter in the world (its own x and floor), not the old town's x.
    if (town.home) station = this.engine.placeAtStation(at) ?? station;
    else this.engine.placeAt(station.x);
    if (station.kind === 'panel' || station.kind === 'waystone') this.openStation(station);
  }
  private openStation(station: StationDef): void {
    if (!this.browser) return;
    // Top-down: a way out the world does not have yet says so (never a detour into the old 2D view, owner 2026-10-19).
    if (this.topDown && station.kind !== 'panel' && station.kind !== 'waystone') { this.message = this.t(station.id === 'delve' ? 'play.td.soon.delve' : station.id === 'passage' ? 'play.td.soon.passage' : 'play.td.soon.place'); return; }
    // One World: a town's stone opens the Travel map (lit stones, the trunk line, the recall).
    if (station.kind === 'waystone' && this.oneWorld) { this.openTravelMap(station.id); return; }
    // One World at night: the keeper is upstairs; the bell rings, the window lights, the counter opens as always.
    if (this.oneWorld && this.state.keeperAway === 'bell') setTimeout(() => this.zone.run(() => { this.message = this.t('play.world.keeper.bellLine'); }));
    if (station.kind === 'waystone') {
      this.showPanel({ kind: 'waystone', stationId: station.id, title: 'The Waystone', kicker: 'Travel' });
      return;
    }
    const entry = station.panel ? PANEL_REGISTRY[station.panel] : undefined;
    if (!entry) return;
    // Found the Rune Forge on their own: the one-time hint has nothing left to say.
    if (station.panel === 'runes') this.markRuneHintSeen();
    const home = homeStationOf(station.id);
    if (home) {
      // No "Open full page": the routed bench would drop the home tier.
      this.showPanel({ kind: 'page', stationId: station.id, title: this.homeForge.name(home), kicker: this.homeForge.kicker() });
      this.loadPanel(entry, this.homeInjector);
      return;
    }
    this.showPanel({ kind: 'page', stationId: station.id, title: entry.title, kicker: entry.kicker });
    this.noteVisit(entry.route);
    this.loadPanel(entry, this.panelInjector);
  }
  /**
   * Character → Stats in the world: the Character page in the place panel,
   * opened on its Stats tab (Keeper stats and the Tools block).
   */
  openCharacter(): void {
    if (!this.browser) return;
    // Top-down: the Keeper's own sheet (level, points, attributes), not the old idle stats page.
    if (this.topDown) { this.placesOpen = false; this.sheetOpen = true; this.spellbookOpen = false; return; }
    this.hub.setTab('stats');
    const entry = PANEL_REGISTRY.character;
    this.showPanel({ kind: 'page', stationId: 'character', title: entry.title, kicker: entry.kicker, own: true });
    this.noteVisit(entry.route);
    this.loadPanel(entry, this.panelInjector);
  }
  /**
   * Nothing in the game navigates away from /play (game-only shell). A hosted
   * page (the Rune Forge, the Character hub, …) was written as a standalone
   * page and still links to its neighbours by their old URLs. Caught in the
   * capture phase, before RouterLink sees the click: a link naming a page that
   * now stands in the world opens that page here, in the panel, without moving
   * the Keeper; a `/play?at=…` link is left to the router (it stays in the
   * game); anything else on this origin is refused. The route guard on /play
   * (stay-in-game.guard.ts) is the backstop for programmatic navigation.
   */
  private readonly panelLinkClick = (event: MouseEvent): void => {
    const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === '/play') return;
    event.preventDefault();
    event.stopPropagation();
    const id = panelForRoute(url.pathname);
    if (id) this.zone.run(() => this.openPanelHere(id));
  };
  /** A hosted page opened in place: from the ☰ menu or from a link inside another panel. */
  private openPanelHere(id: PanelId): void {
    if (id === 'character') { this.openCharacter(); return; }
    const entry = PANEL_REGISTRY[id];
    this.showPanel({ kind: 'page', stationId: id, title: entry.title, kicker: entry.kicker, own: true });
    this.noteVisit(entry.route);
    this.loadPanel(entry, this.panelInjector);
  }
  /** ☰ → Account & settings: sign-in / cloud save, language, cookies (no station; the header used to hold these). */
  openAccount(): void {
    if (!this.browser) return;
    this.openPanelHere('account');
  }
  /** Build a hosted page into the open panel (a slow import never lands in a newer or closed one). */
  private loadPanel(entry: Pick<PanelEntry, 'load'>, injector: Injector, created?: (ref: ComponentRef<unknown>) => void): void {
    const seq = this.panelSeq;
    this.panelLoading = true;
    entry.load().then(type => {
      if (seq !== this.panelSeq || !this.panel) return;
      this.panelHost.clear();
      this.panelRef = this.panelHost.createComponent(type, { injector });
      this.panelLoading = false;
      created?.(this.panelRef);
    }).catch(() => {
      if (seq !== this.panelSeq) return;
      this.panelLoading = false;
      this.panelError = this.t('play.hud.panel.error');
    });
  }
  private showPanel(place: OpenPlace): void {
    // A place opening while the last one folds away takes over the panel at once.
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = undefined; }
    this.closing = false;
    this.showTip(null, 0, 0);
    // A place takes the screen: the sheets that float over the world fold (the settings sheet stayed up over the
    // Hearth Shrine and took its taps on a phone).
    this.soundOpen = false; this.bestiaryOpen = false;
    // Remember a keyboard opener (not one place replacing another: keep the first).
    if (!this.panel) { this.panelOpener = this.keyboardOpener(); this.sound.sfx('open'); }
    this.panelSeq++;
    this.panelHost.clear(); this.panelRef = null;
    this.panelError = ''; this.panelLoading = false;
    this.bagOpen = false; this.placesOpen = false;
    // The panel needs the room: fold the Hearth (the remembered choice stands for next time).
    this.hearthOpen = false;
    this.panel = place;
    this.engine?.setHover(null);
    // The Slate is a phone in the hand: the world goes on round it (owner, 2026-10-19). Every other panel pauses it.
    if (place.kind !== 'slate') this.engine?.setPaused(true);
    // A chest or a camp has no deep link: it is a cell in this player's own Delve.
    if (!place.own) this.setAt(place.stationId);
    // Focus moves into the dialog once it is shown; the close button is always there.
    setTimeout(() => this.placePanel.nativeElement.querySelector<HTMLElement>('.place-close')?.focus());
  }
  /**
   * Close the place and hand focus back to the world. `syncUrl` is false when
   * the URL already changed (back/forward). The content folds away first
   * (PANEL_CLOSE_MS); with reduced motion it closes at once.
   */
  closePanel(syncUrl = true): void {
    if (!this.panel || this.closing) return;
    if (this.reducedMotion) { this.finishClose(syncUrl); return; }
    this.closing = true;
    this.closeTimer = setTimeout(() => this.finishClose(syncUrl), PANEL_CLOSE_MS);
  }
  private finishClose(syncUrl: boolean): void {
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = undefined; }
    this.closing = false;
    if (!this.panel) return;
    const wasSlate = this.panel.kind === 'slate';
    this.panelSeq++;
    this.panelHost.clear(); this.panelRef = null;
    this.panel = null; this.panelLoading = false; this.panelError = '';
    this.chestView = null;
    if (wasSlate) this.pushPet();
    this.engine?.setPaused(false);
    this.sound.sfx('close');
    // Something crafted went into the Satchel under the panel: now it is in view, it pulses.
    if (this.pulseOnClose) { this.pulseOnClose = false; setTimeout(() => this.pulseSatchel()); }
    if (syncUrl) this.setAt(null);
    const opener = this.panelOpener;
    this.panelOpener = null;
    this.focusWorld(opener);
  }
  /**
   * Put keyboard focus back on the game canvas.
   *
   * Not synchronously: until change detection drops `[attr.inert]` from the
   * viewport, the canvas sits in an inert subtree and `focus()` silently
   * refuses — focus fell to <body> and keyboard players had to click once
   * before A/D/E worked again. So focus after the next render, and check.
   */
  private focusWorld(opener: HTMLElement | null = null): void {
    if (!this.browser) return;
    const attempt = (retry: boolean): void => {
      if (this.panel) return;
      const canvas = this.boundCanvas?.isConnected ? this.boundCanvas : this.liveCanvas();
      // A keyboard player goes back to the control they pressed, if it is still there.
      const target = opener && opener.isConnected && opener.getClientRects().length > 0 ? opener : canvas;
      if (!target) return;
      if (target.closest('[inert]')) { if (retry) setTimeout(() => attempt(false), 50); return; }
      target.focus({ preventScroll: true });
      // The opener refused focus (disabled since): the canvas, never <body>.
      if (target !== canvas && document.activeElement !== target) canvas?.focus({ preventScroll: true });
    };
    afterNextRender(() => attempt(true), { injector: this.injector });
  }
  /** The focused control, when it is a keyboard-focused one outside the canvas (else null). */
  private keyboardOpener(): HTMLElement | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body || active instanceof HTMLCanvasElement) return null;
    if (!(this.host.nativeElement as HTMLElement).contains(active)) return null;
    try { return active.matches(':focus-visible') ? active : null; } catch { return null; }
  }
  private setAt(at: string | null): void {
    if ((this.route.snapshot.queryParamMap.get('at') ?? null) === at) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { at }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  /** Keep Tab inside the open dialog. The rest of the stage is also `inert` while it is up. */
  /** A tap on the dim around the Slate (the veil itself, nothing inside it) puts the phone away. */
  placeClick(event: MouseEvent): void {
    if (this.panel?.kind === 'slate' && event.target === this.placePanel.nativeElement) this.closePanel();
  }
  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.panel) return;
    const root = this.placePanel.nativeElement;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.getClientRects().length > 0);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !root.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !root.contains(active))) { event.preventDefault(); first.focus(); }
  }
  get waystone(): WaystoneRow[] {
    return REALM_TOWN_IDS.map(id => ({
      id, realm: TOWN_LABELS[id], town: TOWNS[id]?.name ?? this.t('play.hud.way.uncharted'),
      crest: this.art(REALM_ART[id].crest), available: !!TOWNS[id], current: this.town.id === id,
    }));
  }
  get realmLabel(): string { return TOWN_LABELS[this.town.realm]; }
  /** The header title: the area the Keeper stands in ("Ember Delve"), not only its town. */
  get areaTitle(): string { return this.state.area || this.town.name; }
  /**
   * The place-name card (owner, 2026-10-19): no name parked in the corner; on arriving somewhere new its name rises in
   * the middle of the screen, holds, and fades (the CSS animation does the timing; the card leaves the DOM after it).
   */
  areaCard: { title: string; realm: string; n: number } | null = null;
  private areaCardSeen = '';
  private areaCardTimer?: ReturnType<typeof setTimeout>;
  /** Top-down: while the Slate is open the Keeper holds it up and looks at it (owner, 2026-10-19). */
  private tickPhonePose(): void {
    if (this.topDown) (this.engine as unknown as { setPhone?: (on: boolean) => void } | undefined)?.setPhone?.(this.panel?.kind === 'slate');
  }
  private areaCardPending = '';
  private areaCardSince = 0;
  /** Top-down: the skill bar (keys 1–4), each slot's cooldown left 0–1 and whether there is mana (td-skills.ts). */
  tdAbilities: { id: string; key: string; left: number; mana: number; ready: boolean }[] = [];
  tdMana = MAX_MANA;
  /** The running aura (its icon rides the portrait's corner / sits beside the orbs). */
  tdAura: string | null = null;
  /**
   * The Hush on the HUD (td-dark.ts, design-bible §5.4): a thin pale band under the minimap, never a number. `fill`
   * 0–1, `band` 0–3, `omen` true for a moment after an omen (the band flickers). Session state in the engine only.
   */
  tdHush: { band: number; fill: number; omen: boolean } | null = null;
  private hushOmenSeq = 0;
  private hushOmenAt = 0;
  private darkWordsKey = '';
  /** The Hush's HUD line, for its label (words, not a number). */
  get hushLabel(): string { return this.tdHush ? `${this.t('dark.hud.band.' + this.tdHush.band)}. ${this.t('dark.hud.rule')}` : ''; }
  /** Each HUD tick: the player's cap and the whispers' words to the engine, the Hush back for the band. */
  private tickHush(): void {
    const e = this.engine as unknown as { hushView?: { on: boolean; level: number; band: number; omen: { kind: string; seq: number } | null }; setHushCap?: (c: string) => void; setNight?: (n: string) => void; setDarkWords?: (w: { whispers: readonly string[]; name: string }) => void } | undefined;
    if (!e?.hushView) { this.tdHush = null; return; }
    e.setHushCap?.(this.sound.settings.hush);
    e.setNight?.(this.sound.settings.night);
    const first = this.t('dark.whisper.1');
    if (first !== this.darkWordsKey && e.setDarkWords) {
      this.darkWordsKey = first;
      e.setDarkWords({ whispers: [1, 2, 3, 4, 5, 6, 7, 8].map(n => this.t(`dark.whisper.${n}`)), name: this.t('dark.whisper.name') });
    }
    const v = e.hushView;
    if (v.omen && v.omen.seq !== this.hushOmenSeq) { this.hushOmenSeq = v.omen.seq; this.hushOmenAt = performance.now(); }
    this.tdHush = v.on ? { band: v.band, fill: Math.max(0, Math.min(1, v.level / 100)), omen: performance.now() - this.hushOmenAt < 1400 } : null;
  }
  tdMaxMana = MAX_MANA;
  tdMaxHp = 100;
  /** The Spellbook (K): every skill of the class, what it does, the bar and the aura chosen there. */
  spellbookOpen = false;
  private readonly sanitizer = inject(DomSanitizer);
  private readonly iconCache = new Map<string, SafeHtml>();
  private tdLoadoutKey = '';
  /** The Spellbook's open tree (tab), the skill picked on it, and the respec's "are you sure". */
  bookTree: TreeId = 'ember';
  bookPick: SkillId | null = null;
  respecAsk = false;
  private get tdEngine(): { abilities?: readonly { id: string; key: string; left: number; mana: number; ready: boolean }[]; mana?: number; aura?: string | null; useAbility?: (id: string) => string | null; castStone?: (id: string, rank: number) => string | null; setSkillLoadout?: (bar: readonly string[], aura: string | null) => void } | undefined {
    return this.engine as never;
  }
  private tickAbilities(): void {
    if (!this.topDown) { this.tdAbilities = []; return; }
    // The chat box's Game tab hears every line the HUD shows (the toast, the engine's own words).
    for (const line of [this.message, this.engineMessage]) if (line && line !== this.lastLogged) { this.lastLogged = line; this.logGame(line); }
    const e = this.tdEngine;
    // The Spellbook's choices (synced with the Keeper's look) reach the engine whenever they change.
    // The trees' ranks go first: the bar and the aura only take skills that hold a rank.
    const look = this.looks.look, ranks = this.skillRanks, key = `${look.bar.join(',')}|${look.aura}|${Object.values(ranks).join(',')}`;
    if (key !== this.tdLoadoutKey && e?.setSkillLoadout) {
      this.tdLoadoutKey = key;
      // The points bought ride along: the synergies (design-bible §4.1) read them, never the kit's free rank.
      (this.engine as unknown as { setSkillRanks?: (r: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>) => void } | undefined)?.setSkillRanks?.(ranks, this.skillTree.bought);
      e.setSkillLoadout(this.loadoutBar, this.loadoutAura);
    }
    // The Keeper's level (Hunting): life, mana and spell power grow with it (td-skills levelStats).
    // The worn gear's combat affixes (§3) ride along; the engine re-applies only when a number changed.
    (this.engine as unknown as { setKeeperBuild?: (n: number, st: KeeperStats, gear: Partial<ItemStats>) => void } | undefined)?.setKeeperBuild?.(this.huntingLevel, this.looks.look.stats, this.gearCombat);
    // The weapon in hand: its Strike and Spell Damage lift the Ashguard's swing (td-melee weaponSwing).
    const held = this.inventory.snapshot.equipped['weapon'];
    (this.engine as unknown as { setWeapon?: (w: { strikePower?: number; spellDamage?: number } | null) => void } | undefined)?.setWeapon?.(held && !held.explorerId ? heldSwing(held) : null);
    // The worn boss uniques' signatures (shared/rpg/boss-uniques.ts): the engine re-applies only when the set changed.
    (this.engine as unknown as { setRelics?: (ids: readonly string[]) => void } | undefined)?.setRelics?.(this.wornRelics);
    if (e?.abilities) this.tdAbilities = e.abilities.map(a => ({ ...a }));
    this.tdBelt = this.potions.belt(performance.now() / 1000);
    this.tdStone = this.spellstones.slotted(performance.now() / 1000);
    this.tdSoul = this.spellstones.state.soul;
    if (typeof e?.mana === 'number') this.tdMana = Math.floor(e.mana);
    this.tdAura = e?.aura ?? null;
    this.tickHush();
    const ext = this.engine as unknown as { maxMana?: number; maxHealth?: number } | undefined;
    if (typeof ext?.maxMana === 'number') this.tdMaxMana = ext.maxMana;
    if (typeof ext?.maxHealth === 'number') this.tdMaxHp = ext.maxHealth;
  }
  /** Top-down: the potion belt (Q · R), what each key would drink, how many, and the shared cooldown (0–1). */
  tdBelt: BeltSlot[] = [];
  /** Drink the best potion of a kind (shared/potions): the satchel pays one, the engine pours it in. */
  drinkPotion(kind: 'health' | 'mana'): void {
    if (!this.topDown) return;
    const res = this.potions.drink(kind, performance.now() / 1000);
    if (res.code === 'ok' && res.potion) {
      const fx = potionEffect(res.potion, this.tdMaxHp, this.tdMaxMana);
      (this.engine as unknown as { drinkPotion?: (heal: number, mana: number, secs: number) => void } | undefined)?.drinkPotion?.(fx.heal, fx.mana, fx.secs);
      this.message = this.t('play.potion.drank', { name: res.potion.name });
      this.sound.sfx('splash');
    } else if (res.code === 'none') this.message = this.t(kind === 'health' ? 'play.potion.noneHealth' : 'play.potion.noneMana');
    else if (res.code === 'cooldown') this.message = this.t('play.potion.cooldown');
    else if (res.code === 'failed') this.message = this.t('play.potion.failed');
    this.tickAbilities();
    this.focusWorld();
  }
  // ── Spellstones (shared/spellstones) ──
  private readonly spellstones = inject(SpellstoneService);
  private readonly graveGoods = inject(GraveGoodsService);
  /** The stone on the belt's Spellstone slot (F), or null; and the Soul held (by the mana bar). */
  tdStone: { key: string; skill: string; rank: number; charges: number; left: number } | null = null;
  tdSoul = 0;
  get soulMax(): number { return soulCap(this.huntingLevel); }
  stoneArt(skill: string): string { return this.art(stoneIcon(TD_SKILLS[skill as SkillId]?.tree ?? 'common')); }
  stoneTitle(st: { skill: string; rank: number; charges: number } | null): string {
    if (!st) return this.t('play.stone.slotEmpty');
    return this.t('play.stone.slotTitle', { name: this.t(`skill.${st.skill}`), rank: st.rank, n: st.charges });
  }
  /** F, or the belt's stone: the slotted Spellstone's spell at its rank, no mana. A charge is spent only if it went off. */
  useStone(): void {
    if (!this.topDown) return;
    const st = this.spellstones.slotted(performance.now() / 1000);
    if (!st) { this.message = this.t('play.stone.slotEmpty'); this.focusWorld(); return; }
    const res = this.spellstones.use(st.key, performance.now() / 1000, (skill, rank) => { const cast = this.tdEngine?.castStone; return cast ? cast(skill, rank) : 'locked'; });
    if (res === 'ok') {
      const left = this.spellstones.state.pouch[st.key] ?? 0, name = this.t(`skill.${st.skill}`);
      this.message = left > 0 ? this.t('play.stone.cast', { name, rank: st.rank, n: left }) : this.t('play.stone.spent', { name });
      this.canvas?.nativeElement.setAttribute('data-stone-cast', `${st.skill}@${st.rank}`);
    } else if (res === 'cooldown') this.message = this.t('play.stone.cooldown');
    else if (res !== 'none') this.message = this.t(`play.td.ability.${res}`);
    this.tickAbilities();
    this.focusWorld();
  }
  /** The Spellbook's inscribing row for an active spell: the recipe, what it gives, what is held, and whether it can be cut. */
  stoneView(id: string): { soul: number; charges: number; rank: number; held: number; blanks: number; onBelt: boolean; why: string } | null {
    const sk = TD_SKILLS[id as SkillId];
    if (!sk || sk.kind !== 'active') return null;
    const rank = this.skillRanks[id as SkillId] ?? 0, r = stoneRecipe(sk.mana), s = this.spellstones.state, blanks = this.spellstones.blanks;
    const key = `${id}@${Math.max(1, rank)}`;
    const why = rank < 1 ? this.t('play.stone.need.rank') : blanks < r.blanks ? this.t('play.stone.need.blank') : s.soul < r.soul ? this.t('play.stone.need.soul', { n: r.soul }) : '';
    return { soul: r.soul, charges: r.charges, rank: Math.max(1, rank), held: s.pouch[key] ?? 0, blanks, onBelt: s.slot === key, why };
  }
  inscribeStone(id: string): void {
    const sk = TD_SKILLS[id as SkillId];
    if (!sk) return;
    const rank = this.skillRanks[id as SkillId] ?? 0;
    const code = this.spellstones.inscribe(id, rank, sk.mana);
    const v = this.stoneView(id);
    this.message = code === 'ok' ? this.t('play.stone.inscribed', { name: this.t(`skill.${id}`), rank, n: stoneRecipe(sk.mana).charges })
      : code === 'blank' ? this.t('play.stone.need.blank') : code === 'soul' ? this.t('play.stone.need.soul', { n: v?.soul ?? 0 })
      : code === 'rank' ? this.t('play.stone.need.rank') : '';
    if (code === 'ok') this.sound.sfx('five');
    this.tickAbilities();
  }
  beltStone(id: string): void {
    const rank = Math.max(1, this.skillRanks[id as SkillId] ?? 0);
    this.spellstones.slot(`${id}@${rank}`);
    this.tickAbilities();
  }
  /** A kill: Soul, and the whispering items' count (a piece of the sentence woken says itself in the chat). */
  private stonesKill(creature: string): void {
    const level = MOBS[creature]?.level ?? this.huntingLevel;
    this.spellstones.kill(this.huntingLevel, level, this.skillRanks['soul-harvest'] ?? 0);
    for (const w of this.graveGoods.kill()) {
      const id = w.item.whisper?.id;
      if (id && isWhisperId(id)) this.toastLoot(this.t('grave.woke', { name: w.item.name, line: this.t(`grave.whisper.${id}.${w.stage}`) }));
    }
  }
  /** The card's grave-good blocks: a curse's gift and price (or "Laid to rest."), a whisper's words so far and its cost. */
  private graveTip(item: GameItem): Pick<ItemTip, 'curse' | 'whisper'> {
    const out: Pick<ItemTip, 'curse' | 'whisper'> = {};
    const c = item.curse;
    if (c && isCurseId(c.id)) {
      const def = CURSES[c.id as CurseId], lines: string[] = [];
      lines.push(this.t('grave.tip.gift', { n: pctOf(def.bonus, c.cleansed ? Math.round(c.bonus * 5) / 10 : c.bonus), stat: ITEM_STAT_LABELS[def.bonus] }));
      if (!c.cleansed) lines.push(def.cost === 'lifeRegen' ? this.t('grave.tip.drain', { n: c.cost }) : this.t('grave.tip.price', { n: pctOf(def.cost, c.cost), stat: ITEM_STAT_LABELS[def.cost] }));
      lines.push(this.t(c.cleansed ? 'grave.tip.rest' : 'grave.tip.sexton'));
      out.curse = { name: this.t('grave.tip.cursed', { name: this.t(`grave.curse.${c.id}.name`) }), lines, rest: !!c.cleansed, lore: this.t(`grave.curse.${c.id}.lore`) };
    }
    const w = item.whisper;
    if (w && isWhisperId(w.id)) {
      const def = WHISPERS[w.id as WhisperId], stage = whisperStage(w), next = nextWhisperAt({ ...w, id: w.id as WhisperId });
      const words = Array.from({ length: 4 }, (_, i) => (i <= stage ? this.t(`grave.whisper.${w.id}.${i}`) : '…')).join(' ');
      const lines = [this.t('grave.tip.awake', { n: stage + 1, v: pctOf(def.stat, Math.round(def.per * stage * 10) / 10), stat: ITEM_STAT_LABELS[def.stat] })];
      if (stage >= 3) lines.push(this.t('grave.tip.full', { who: this.t(`grave.whisper.${w.id}.who`) }));
      else if (next !== null) lines.push(this.t('grave.tip.next', { k: next, have: w.kills }));
      lines.push(w.silenced ? this.t('grave.tip.silenced') : this.t('grave.tip.listening', { n: pctOf('allResist', WHISPER_COST) }));
      if (!w.silenced) lines.push(this.t('grave.tip.archivist'));
      out.whisper = { words, lines, silenced: !!w.silenced };
    }
    return out;
  }
  /** Sexton Wren's cleansing or the Archivist's silence, in the place panel. */
  openGraveDesk(role: 'sexton' | 'archivist'): void {
    if (!this.browser) return;
    this.closeTalk();
    this.showPanel({ kind: role, stationId: role, title: this.t(`grave.${role}.title`), kicker: role === 'sexton' ? 'Sexton Aldous Wren' : this.t('grave.archivist.name') });
  }

  /** The belt slot's tooltip: the potion, its key, what it does. */
  beltTitle(slot: BeltSlot): string {
    const key = ` (${slot.key})`;
    if (!slot.potion) return this.t(slot.kind === 'health' ? 'play.potion.noneHealth' : 'play.potion.noneMana') + key;
    return `${slot.potion.name}${key} · ${this.potionLine(slot.potion.id)}`;
  }
  /** What a potion does, in one line (the belt, the hover card). */
  potionLine(id: string): string {
    const p = potionById(id);
    if (!p) return '';
    if (p.kind === 'rejuv') return this.t('play.potion.does.rejuv', { pct: Math.round(p.amount * 100) });
    return this.t(p.kind === 'health' ? 'play.potion.does.health' : 'play.potion.does.mana', { n: p.amount });
  }
  useAbility(slot: string): void {
    const why = this.tdEngine?.useAbility?.(slot);
    if (why) this.message = this.t(`play.td.ability.${why}`);
    this.tickAbilities();
    this.focusWorld();
  }
  /** A skill's pixel icon as markup (our own constant rects, td-skills.ts). */
  skillIcon(id: string, size = 28): SafeHtml {
    let h = this.iconCache.get(`${id}@${size}`);
    if (!h) {
      const sk = TD_SKILLS[id as SkillId];
      h = this.sanitizer.bypassSecurityTrustHtml(`<svg viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true">${sk?.icon ?? ''}</svg>`);
      this.iconCache.set(`${id}@${size}`, h);
    }
    return h;
  }
  get vocation(): string { return this.looks.look.vocation; }
  /** The character sheet (C): D2's attributes page made cozy — level, points to spend, what each gives. */
  sheetOpen = false;
  /** The uniques the Keeper wears (their ids): each one's passive is applied by the fight (td-mobs relics). */
  private get wornRelics(): string[] {
    // ...and the signatures of the item-set tiers they wake (rpg/set-items.ts), as `set:<set>:<pieces>` ids.
    return [...sigIds(this.wornIds), ...setSigIds(this.wornIds)];
  }
  /** The definition ids the Keeper wears (not an explorer's): what the item sets count. */
  private get wornIds(): string[] {
    return this.inventory.snapshot.items.filter(it => it.equipped && !it.explorerId && !!it.definitionId).map(it => it.definitionId!);
  }
  /** A set piece's card block (design-bible §7.4): the set, each piece (greyed when not worn), each tier (lit when on). */
  private setTip(item: GameItem): ItemSetTip | undefined {
    const piece = setPieceById(item.definitionId), set = setOfPiece(item.definitionId);
    if (!piece || !set) return undefined;
    const worn = this.wornIds, n = setCounts(worn).get(set.id) ?? 0;
    const place = piece && set.source.chests
      ? this.t('play.set.foundChest', { place: chestsHolding(piece).map(c => this.t('play.set.chest.' + c)).join(' · ') })
      : this.t('play.set.foundKills', { where: set.where, who: set.source.creatures.map(c => MOBS[c]?.name ?? c).join(', '), level: set.source.minLevel });
    return {
      name: this.t('play.set.name.' + set.id), count: n, total: set.pieces.length,
      pieces: set.pieces.map(id => ({ id, name: setPieceById(id)?.name ?? id, worn: worn.includes(id), here: id === item.definitionId })),
      tiers: set.bonuses.map(b => ({ word: this.t('play.set.tier.' + tierWord(set, b)), n: b.at, text: this.t(`play.set.bonus.${set.id}.${b.at}`), on: n >= b.at })),
      found: [this.t('play.set.used', { set: this.t('play.set.name.' + set.id) }), place],
    };
  }
  /** Glim's words for a Seek (td-seek.ts): "The Ink Abbess is very far to the south-east, below you." */
  private seekLine(a: SeekAnswer): string {
    if (a.kind === 'unknown') return this.t('play.seek.unknown', { name: a.name });
    // Glim names nothing it has not seen (design-bible §5.5): a boss not yet met is "something great".
    const met = a.kind !== 'boss' || (readKills(this.store.read(BESTIARY_KEY))[a.id] ?? 0) > 0;
    const name = a.kind === 'purse' ? this.t('play.seek.purse') : a.kind === 'story' ? this.t(a.name) : met ? a.name : this.t('play.seek.unseen');
    if (a.sea) return this.t('play.seek.sea', { name });
    const floor = a.floor === 'here' ? '' : this.t('play.seek.floor.' + a.floor);
    if (!a.dir) return this.t('play.seek.beside', { name, floor });
    return this.t('play.seek.line', { name, band: this.t('play.seek.band.' + a.band), dir: this.t('play.seek.dir.' + a.dir), floor });
  }
  /** A boss unique's card lines: what it does (Used for) and where it is found, its boss and chance (Found in). */
  private relicLines(u: BossUnique): string[] {
    return [
      this.t('play.relic.used', { text: this.t('play.relic.sig.' + u.id) }),
      this.t('play.relic.found', { boss: MOBS[u.boss]?.name ?? u.boss, where: u.lair, n: u.oneIn }),
    ];
  }
  /**
   * An ordinary unique's card lines (unique-items.ts): what its passive does in the fight (Used for, the same line the
   * truth harness measures) and where it falls (Found in: any creature's open loot roll at its authored rarity, from
   * that rung's level, drop-tables RUNG_LEVEL). A set piece has its own block (setTip); anything else: none.
   */
  private uniqueLines(u: UniqueItem | undefined): string[] {
    if (!u?.sig || u.set) return [];
    return [
      this.t('play.relic.used', { text: this.t('play.relic.sig.' + u.id) }),
      this.t('play.unique.found', { rarity: rarityLabel(u.rarity), level: Math.max(1, RUNG_LEVEL[u.rarity]) }),
    ];
  }
  /** The worn gear's combat totals (docs/design/loot-and-combat.md §3), read off the inventory by td-skills. */
  private get gearCombat(): Partial<ItemStats> {
    // The milestones' passives (shared/skills/keeper-milestones.ts) ride on the worn totals, under the same caps.
    const g: Partial<ItemStats> = { ...wornCombat(this.inventory, this.wornIds) };
    // Runes set in armour wells ward against their realm's element (shared/loot/aura-sources wornResists; the Loot sheet's rows).
    const runes = wornResists(this.inventory.snapshot.items);
    for (const el of ELEMENTS) if (runes[el]) g[RESIST_STAT[el]] = (g[RESIST_STAT[el]] ?? 0) + (runes[el] ?? 0);
    for (const [stat, n] of Object.entries(passiveBonus(this.huntingLevel)) as [keyof ItemStats, number][]) g[stat] = ((g[stat] as number | undefined) ?? 0) + n;
    return g;
  }
  get sheet(): { level: number; into: number; span: number; toNext: number; left: number; skillPoints: number; next: Milestone | null; rows: { id: Attribute; value: number; text: string }[]; totals: { key: string; value: string }[] } {
    const view = this.keeperView, st = this.looks.look.stats, lv = view.level;
    const gear = this.gearCombat;
    // The difficulty's resist penalty (shared/loot/difficulty.model), as the fight takes it (td-engine setKeeperBuild).
    const derived = fightStats(lv, st, gear, this.looks.look.vocation, DIFFICULTIES[this.loot.combatRules().tier]?.resistPenalty ?? 0), sig = this.gearSig;
    // The worn aura the Loot sheet runs (td-mobs setItemAura): Prayer's life back, Vigor's quicker feet.
    const aura = this.loot.combatRules().aura, fx = aura ? auraEffect(aura.id, aura.level) : null, vigor = fx?.moveSpeed ?? 1;
    const lifeBack = Math.round((derived.lifeRegen + sig.regen + (fx?.regen ?? 0)) * 10) / 10;
    // Worn XP and a worn unique's (xp-echo) multiply; so do Gold Find and a unique's bigger pile (gold-surge).
    const both = (a: number, b: number) => Math.round(((1 + a / 100) * (1 + b / 100) - 1) * 1000) / 10;
    const mf = Math.round((this.inventory.equippedMagicFind + sig.mf) * 10) / 10, xp = both(this.inventory.equippedTotals.xpBonus ?? 0, sig.xp);
    const gf = both(this.economy.goldFind, sig.gold);
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    const text: Record<Attribute, string> = {
      vit: this.t('play.td.attr.vit.text', { n: ATTR_STEP.vit }),
      ene: this.t('play.td.attr.ene.text', { n: ATTR_STEP.ene }),
      spi: this.t('play.td.attr.spi.text', { n: Math.round(ATTR_STEP.spi * 100) }),
      agi: this.t('play.td.attr.agi.text', { n: Math.round(ATTR_STEP.agi * 100) }),
    };
    return {
      level: lv, into: view.into, span: view.span, toNext: view.toNext, left: pointsLeft(lv, st, keeperAttributePoints(lv)),
      skillPoints: skillPointsEarned(lv), next: nextMilestone(lv),
      rows: ATTRIBUTES.map(id => ({ id, value: st[id], text: text[id] })),
      totals: [
        { key: 'play.td.total.life', value: `${derived.maxHp}` },
        { key: 'play.td.total.mana', value: `${derived.maxMana}` },
        { key: 'play.td.total.regen', value: `${derived.regen.toFixed(1)}/s` },
        { key: 'play.td.total.power', value: pct(derived.power) },
        // Speed: the level's own pace (Tibia) times Agility and worn Move Speed (td-engine walkSpeed).
        { key: 'play.td.total.speed', value: `+${pct((1 + derived.levelPace) * (1 + derived.moveHaste) * vigor - 1)}` },
        // What the worn gear adds (§3 affixes); a row shows once a piece carries it.
        ...(derived.defense > 0 ? [{ key: 'play.td.total.defense', value: `${Math.round(derived.defense)} (−${pct(defenseReduction(derived.defense, lv))})` }] : []),
        ...(derived.castSpeed > 0 ? [{ key: 'play.td.total.cast', value: `+${pct(derived.castSpeed)}` }] : []),
        ...(derived.crit > 0 ? [{ key: 'play.td.total.crit', value: pct(derived.crit) }] : []),
        // Life back a second as the fight pays it (td-engine relicRegen): worn, plus the boss uniques' and the sets'; a
        // curse's drain shows as a negative; "×2 standing still" when a Mossbound Heart or the Rootcradle doubles it.
        ...(lifeBack !== 0 ? [{ key: 'play.td.total.lifeRegen', value: `${lifeBack.toFixed(1)}/s` + (lifeBack > 0 && sig.stillRegen > 1 ? ' ' + this.t('play.td.total.still', { n: sig.stillRegen }) : '') }] : []),
        // Resists (§6): each element's worn total (its own + All Resist), capped at 75.
        ...ELEMENTS.filter(el => derived.resists[el] !== 0).map(el => ({ key: RESIST_TOTAL_KEY[el], value: `${Math.round(derived.resists[el])}%` })),
        // The finds (they change the loot, the piles and the XP, not the fight): what each kill is rolled and paid at.
        ...(mf !== 0 ? [{ key: 'play.td.total.mf', value: `+${mf}%` }] : []),
        ...(gf > 0 ? [{ key: 'play.td.total.gf', value: `+${gf}%` }] : []),
        ...(xp > 0 ? [{ key: 'play.td.total.xp', value: `+${xp}%` }] : []),
      ],
    };
  }
  spendPoint(attr: Attribute): void { const lv = this.huntingLevel; this.looks.spendPoint(attr, lv, Date.now(), keeperAttributePoints(lv)); this.tickAbilities(); }
  // ── The Keeper's level (docs/design/leveling.md): the fanfare, the milestones tab, the title, the frame ──
  /** The character sheet's tab: the attributes, or the level milestones. */
  sheetTab: 'attrs' | 'milestones' | 'lore' = 'attrs';
  /** The character sheet's Lore tab: the lore log's pages (shared/lore). */
  readonly lorePages = LORE_PAGES;
  /** The milestones tab's page (5 a page); -1 = the page holding the next milestone. */
  milestonePage = -1;
  /** The level-up banner while it shows. */
  levelBanner: { level: number; big: boolean; lines: string[]; points: boolean; skill: boolean } | null = null;
  private levelBannerTimer?: ReturnType<typeof setTimeout>;
  /** The portrait's level badge bounces for a moment after a level-up. */
  lvPulse = false;
  /** The title worn under the Keeper's name ('' none), as words. */
  get keeperTitle(): string {
    const id = this.keeperLevels.state.title;
    return id && titlesEarned(this.huntingLevel).includes(id) ? this.t(`play.lvl.title.${id}`) : '';
  }
  /** The portrait frame the level has earned (copper at 10 … starlit at 10,000). */
  get keeperFrame(): string | null { return frameFor(this.huntingLevel); }
  /** XP figures for the sheet ("12,450", "1.7M"). */
  xpText(n: number): string { return formatXp(n); }
  /** A milestone's rewards, one plain line each (the banner, the sheet). `paidGold` replaces the income line with what was paid. */
  milestoneLines(m: Milestone, paidGold?: number): string[] {
    const r = m.rewards, out: string[] = [];
    if (r.title) out.push(this.t('play.lvl.r.title', { title: this.t(`play.lvl.title.${r.title}`) }));
    if (r.skillPoints) out.push(this.t(r.skillPoints === 1 ? 'play.lvl.r.skill1' : 'play.lvl.r.skill', { n: r.skillPoints }));
    if (r.points) out.push(this.t('play.lvl.r.points', { n: r.points }));
    if (r.passive) out.push(this.t(`play.lvl.r.passive.${r.passive.stat}`, { n: r.passive.n }));
    if (r.frame) out.push(this.t('play.lvl.r.frame', { frame: this.t(`play.lvl.frame.${r.frame}`) }));
    if (r.gold) out.push(paidGold != null ? this.t('play.lvl.paid.gold', { n: paidGold.toLocaleString('en-US') }) : this.t('play.lvl.r.gold', { n: r.gold.toLocaleString('en-US') }));
    if (r.gear) out.push(this.t('play.task.gear', { rarity: this.t(`play.task.rarity.${r.gear.rarity}`), name: itemDefinitionById(r.gear.defId)?.name ?? r.gear.defId, level: r.gear.level }));
    return out;
  }
  /** The milestones tab: five a page, each claimed (reached), next, or later. */
  get milestoneView(): { page: number; pages: number; rows: { level: number; big: boolean; state: 'claimed' | 'next' | 'later'; lines: string[] }[]; titles: string[]; title: string } {
    const lv = this.huntingLevel, next = nextMilestone(lv), per = 5, pages = Math.ceil(MILESTONES.length / per);
    const at = next ? MILESTONES.indexOf(next) : MILESTONES.length - 1;
    const page = Math.max(0, Math.min(pages - 1, this.milestonePage < 0 ? Math.floor(at / per) : this.milestonePage));
    return {
      page, pages,
      rows: MILESTONES.slice(page * per, page * per + per).map(m => ({ level: m.level, big: !!m.big, state: m.level <= lv ? 'claimed' as const : m === next ? 'next' as const : 'later' as const, lines: this.milestoneLines(m) })),
      titles: titlesEarned(lv), title: this.keeperLevels.state.title,
    };
  }
  pageMilestones(step: number): void {
    const v = this.milestoneView;
    this.milestonePage = Math.max(0, Math.min(v.pages - 1, v.page + step));
  }
  /** Wear the next (or previous) earned title; '' (none) sits before the first. */
  cycleTitle(step: number): void {
    const v = this.milestoneView, list = ['', ...v.titles];
    const i = Math.max(0, list.indexOf(v.title));
    this.keeperLevels.setTitle(list[(i + step + list.length) % list.length], this.huntingLevel);
  }
  /** The fanfare: a cozy banner listing exactly what the level gave, the light pillar on the Keeper, a gentle chime. */
  private keeperLeveled(e: KeeperLevelUp): void {
    const big = e.milestones.some(m => m.big);
    const lines = [this.t('play.lvl.gain.stats', { life: e.life, mana: e.mana, power: e.power })];
    if (e.points > 0) lines.push(this.t('play.lvl.gain.points', { n: e.points }));
    if (e.skillPoints > 0) lines.push(this.t(e.skillPoints === 1 ? 'play.lvl.gain.skill1' : 'play.lvl.gain.skill', { n: e.skillPoints }));
    for (const m of e.milestones) {
      const paid = e.paid.find(p => p.level === m.level);
      lines.push(this.t('play.lvl.milestone', { n: m.level }) + ' ' + this.milestoneLines(m, paid?.gold).join(' · '));
    }
    this.levelBanner = { level: e.level, big, lines, points: e.points > 0, skill: e.skillPoints > 0 };
    this.message = this.t('play.lvl.log', { n: e.level });
    this.sound.sfx('levelup');
    (this.engine as unknown as { levelPillar?: (big: boolean) => void } | undefined)?.levelPillar?.(big);
    this.engine?.keeperFeel('happy', 1.6);
    this.lvPulse = false;
    queueMicrotask(() => { this.lvPulse = true; });
    setTimeout(() => this.zone.run(() => { this.lvPulse = false; }), 1600);
    clearTimeout(this.levelBannerTimer);
    this.levelBannerTimer = setTimeout(() => this.zone.run(() => { this.levelBanner = null; }), big ? 16000 : 10000);
    this.tickAbilities();
  }
  /** The banner's buttons: spend the attribute points (C), or the skill points (K). */
  levelBannerGo(where: 'sheet' | 'book'): void {
    this.levelBanner = null;
    clearTimeout(this.levelBannerTimer);
    this.sheetOpen = where === 'sheet'; this.spellbookOpen = where === 'book'; this.sheetTab = 'attrs';
  }
  private payMilestoneBacklog(): void {
    if (!this.browser) return;
    this.activity.init();
    const paid = this.keeperLevels.claimDue(this.huntingLevel);
    if (paid.length) this.message = this.t('play.lvl.backlog', { n: paid.reduce((g, p) => g + p.gold, 0) });
  }
  /** The trees as the fight may use them: the saved tree clamped to the level's points (td-tree). Cached per look + level. */
  private treeCache: { tree: KeeperSkillTree; level: number; voc: string; out: KeeperSkillTree; ranks: Record<SkillId, number>; bought: Record<SkillId, number> } | null = null;
  private get skillTree(): { tree: KeeperSkillTree; ranks: Record<SkillId, number>; bought: Record<SkillId, number> } {
    const look = this.looks.look, level = this.huntingLevel, c = this.treeCache;
    if (!c || c.tree !== look.tree || c.level !== level || c.voc !== look.vocation) {
      const out = clampTree(look.tree, look.vocation, level);
      this.treeCache = { tree: look.tree, level, voc: look.vocation, out, ranks: effectiveRanks(out, look.vocation), bought: boughtRanks(out, look.vocation) };
    }
    return { tree: this.treeCache!.out, ranks: this.treeCache!.ranks, bought: this.treeCache!.bought };
  }
  private get skillRanks(): Record<SkillId, number> { return this.skillTree.ranks; }
  private ranked(id: string): boolean { return (this.skillRanks[id as SkillId] ?? 0) > 0; }
  private get loadoutBar(): string[] { const b = this.looks.look.bar; return (b.length ? b : defaultBar(this.looks.look.vocation)).filter(id => this.ranked(id)); }
  private get loadoutAura(): string | null {
    const a = this.looks.look.aura, id = a === 'none' ? null : a || defaultAura(this.looks.look.vocation);
    return id && this.ranked(id) ? id : null;
  }
  /**
   * What the worn gear adds to the skills (the boss uniques' and the item sets' signatures): the same totals the fight
   * is handed (td-engine setRelics), so the card's ranks, counts, reach and cooldowns are the fight's. Cached per set.
   */
  private sigCache: { key: string; sig: RelicTotals } | null = null;
  private get gearSig(): RelicTotals {
    const ids = this.wornRelics, key = [...ids].sort().join(',');
    if (!this.sigCache || this.sigCache.key !== key) this.sigCache = { key, sig: relicTotals(ids, relicSigOf) };
    return this.sigCache.sig;
  }
  /** A skill's line at a tree rank (rank 0 reads as rank 1): the numbers the fight uses (td-skills castVars). */
  private skillLine(id: SkillId, treeRank: number): string {
    const sk = TD_SKILLS[id], sig = this.gearSig, v = castVars(id, castRank(id, Math.max(1, treeRank), sig), this.skillTree.bought, sig);
    return this.t(sk.textKey, { ...v, mana: v['mana'] ?? sk.mana, cd: sk.cd });
  }
  /** What the next tree rank changes, var by var ("Damage: 24–36 → 28–42"); a min/max pair reads as one range. */
  private rankDiff(id: SkillId, rank: number): string[] {
    const syn = this.skillTree.bought, sig = this.gearSig;
    const a = castVars(id, castRank(id, rank, sig), syn, sig), b = castVars(id, castRank(id, rank + 1, sig), syn, sig), out: string[] = [];
    const pair = 'min' in a && 'max' in a;
    if (pair && (a['min'] !== b['min'] || a['max'] !== b['max'])) out.push(`${this.t('play.td.tree.var.damage')}: ${a['min']}–${a['max']} → ${b['min']}–${b['max']}`);
    for (const k of Object.keys(a)) {
      if (pair && (k === 'min' || k === 'max')) continue;
      if (a[k] !== b[k]) out.push(`${this.t('play.td.tree.var.' + k)}: ${a[k]} → ${b[k]}`);
    }
    return out;
  }
  /** The Spellbook as D2's skill page: the open tree's tiers and skills, its prerequisite lines, the picked skill's card. */
  get spellbook(): {
    trees: { id: TreeId; ranks: number }[];
    left: number;
    tiers: { level: number; open: boolean }[];
    nodes: { id: SkillId; name: string; tier: number; col: number; rank: number; need: number; open: boolean; picked: boolean; buyable: boolean; slot: number; on: boolean }[];
    lines: { x1: number; y1: number; x2: number; y2: number; lit: boolean }[];
    pick: null | { id: SkillId; name: string; kind: string; rank: number; max: number; now: string; nowRank: number; gear: number; next: string[]; mana: number; cd: number; block: RankBlock | null; need: string; slot: number; on: boolean;
      words: string; syn: { from: SkillId; name: string; ranks: number; text: string; live: boolean }[]; phase: { text: string; up: boolean } | null; power: string | null };
  } {
    const v = this.looks.look.vocation, level = this.huntingLevel, { tree, ranks } = this.skillTree, bar = this.loadoutBar, aura = this.loadoutAura;
    const ids = treeSkills(v, this.bookTab);
    // Each row's level: its tier's, or the lowest a skill on it asks (the common page's Seek opens at 8).
    const tiers = TIER_LEVELS.slice(0, Math.max(...ids.map(id => TD_SKILLS[id].tier)) + 1).map((lv, i) => {
      const own = ids.filter(id => TD_SKILLS[id].tier === i).map(levelFor), at = own.length ? Math.min(...own) : lv;
      return { level: at, open: level >= at };
    });
    const pickId = this.bookPick && ids.includes(this.bookPick) ? this.bookPick : ids[0];
    const nodes = ids.map(id => {
      const sk = TD_SKILLS[id], need = levelFor(id);
      return { id, name: this.t(sk.nameKey), tier: sk.tier, col: sk.col, rank: ranks[id] ?? 0, need, open: level >= need,
        picked: id === pickId, buyable: !rankBlock(tree, v, id, level), slot: bar.indexOf(id) + 1, on: aura === id };
    });
    const lines = ids.filter(id => TD_SKILLS[id].req && ids.includes(TD_SKILLS[id].req!)).map(id => {
      const a = TD_SKILLS[TD_SKILLS[id].req!], b = TD_SKILLS[id];
      return { x1: a.col + .5, y1: a.tier + .5, x2: b.col + .5, y2: b.tier + .5, lit: (ranks[TD_SKILLS[id].req!] ?? 0) > 0 };
    });
    let pick: ReturnType<SideScrollerComponent['spellbookPick']> | null = null;
    if (pickId) pick = this.spellbookPick(pickId, ranks[pickId] ?? 0, rankBlock(tree, v, pickId, level), bar, aura);
    return {
      trees: bookTrees(v).map(id => ({ id, ranks: treeSkills(v, id).reduce((n, s) => n + (ranks[s] ?? 0), 0) })),
      left: treePointsLeft(tree, level), tiers, nodes, lines, pick,
    };
  }
  private spellbookPick(id: SkillId, rank: number, block: RankBlock | null, bar: string[], aura: string | null) {
    const sk = TD_SKILLS[id], req = sk.req;
    const need = block === 'level' ? this.t('play.td.tree.needLevel', { n: levelFor(id) })
      : block === 'req' && req ? this.t('play.td.tree.needSkill', { name: this.t(TD_SKILLS[req].nameKey) })
      : block === 'max' ? this.t('play.td.tree.maxed') : block === 'points' ? this.t('play.td.tree.noPoints') : '';
    // The rank the fight casts at: the tree's, plus what worn gear adds to a learnt skill (td-skills castRank).
    const sig = this.gearSig, nowRank = castRank(id, Math.max(1, rank), sig);
    return {
      id, name: this.t(sk.nameKey), kind: sk.kind, rank, max: MAX_RANK, now: this.skillLine(id, Math.max(1, rank)), nowRank, gear: rank > 0 ? nowRank - rank : 0,
      // The cooldown the Keeper really waits: less what worn gear cuts, over worn cast speed (td-mobs cdOf ÷ 1 + cast).
      next: rank >= MAX_RANK ? [] : rank < 1 ? [] : this.rankDiff(id, rank), mana: sk.mana, cd: cooldownNow(id, this.fightNow.castSpeed, sig), block, need,
      slot: bar.indexOf(id) + 1, on: aura === id,
      // The Seam-Cant (never translated) and the synergies with live numbers: each source, its bought ranks, the % now.
      words: sk.words ?? '',
      syn: synergies(id, this.skillTree.bought).map(s => ({
        from: s.from, name: this.t(TD_SKILLS[s.from].nameKey), ranks: s.ranks, live: s.pct > 0,
        text: this.t('play.td.tree.syn.line', { pct: s.pct, per: s.per, what: this.t('play.td.tree.syn.' + s.what) }),
      })),
      phase: this.spellPhase(id),
      power: this.spellPower(id),
    };
  }
  /** The Keeper's fight numbers now (td-skills fightStats): the level, the attributes and the worn gear, as the engine is handed them. */
  private get fightNow(): ReturnType<typeof fightStats> {
    return fightStats(this.huntingLevel, this.looks.look.stats, this.gearCombat, this.looks.look.vocation);
  }
  /**
   * What lifts the card's damage in the fight (td-mobs hitFoe): spell power (level, Spirit, worn Spell Damage), fire's
   * lift (Ember Mastery, worn fire) on a fire skill, the weapon's flat on a blade's blow, and the crit chance. Null on
   * a skill that deals no damage, or when nothing lifts it.
   */
  private spellPower(id: SkillId): string | null {
    if (!dealsDamage(id)) return null;
    const f = this.fightNow, sig = this.gearSig, mastery = castRank('ember-mastery', this.skillRanks['ember-mastery'] ?? 0, sig);
    const fire = FIRE_SKILLS.has(id) ? (mastery > 0 ? 1 + castVars('ember-mastery', mastery, this.skillTree.bought, sig)['pct'] / 100 : 1) * (1 + sig.fire / 100) : 1;
    const k = Math.round(f.power * fire * 100) / 100;
    const parts: string[] = [];
    if (k !== 1) parts.push(this.t('play.td.tree.power.mult', { k: k.toFixed(2) }));
    const held = this.inventory.snapshot.equipped['weapon'];
    if (this.looks.look.vocation === 'ashguard' && (id === 'watch-blade' || BLADE_SHARE.has(id))) {
      const w = weaponSwing(held && !held.explorerId ? heldSwing(held) : null);
      if (w.flat > 0) parts.push(this.t('play.td.tree.power.weapon', { n: w.flat }));
      if (w.mult !== 1) parts.push(this.t('play.td.tree.power.fists', { pct: Math.round((1 - w.mult) * 100) }));
    }
    if (f.crit > 0) parts.push(this.t('play.td.tree.power.crit', { pct: Math.round(f.crit * 100), k: CRIT_MULT }));
    return parts.length ? this.t('play.td.tree.power', { parts: parts.join(' · ') }) : null;
  }
  /** The sky's hand on a damage spell (td-phases.ts): "Eclipse now: +25% power", or null when the hour changes nothing. */
  private spellPhase(id: SkillId): { text: string; up: boolean } | null {
    // A blade-borne skill strikes with the Watch Blade's blow, so it feels the blade's (the Brand's) hour.
    const blade = BLADE_SHARE.has(id), tree = blade ? TD_SKILLS['watch-blade'].tree : TD_SKILLS[id].tree;
    const vars = TD_SKILLS[blade ? 'watch-blade' : id].vars, k = spellMult(tree, this.skyPhase);
    // The sky moves damage (and the Hearth's heal, the Watchfire): a skill with none of those keeps no hour (td-phases skyVars).
    if (k === 1 || !skyVars(tree).some(v => v in vars)) return null;
    const pct = Math.round((k - 1) * 100);
    return { up: pct > 0, text: this.t('clock.spell.now', { phase: this.t('clock.phase.' + this.skyPhase), pct: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%` }) };
  }
  /** Open a tree's tab (the first skill on it is picked). */
  /** The open tab: the chosen tree when it is this class's, else the class's first (an Ashguard opens on Brand). */
  get bookTab(): TreeId { const trees = bookTrees(this.looks.look.vocation); return trees.includes(this.bookTree) ? this.bookTree : trees[0]; }
  openTree(id: TreeId): void { this.bookTree = id; this.bookPick = null; this.respecAsk = false; }
  pickSkill(id: string): void { this.bookPick = id as SkillId; this.respecAsk = false; }
  /** Spend a skill point on a rank (D2: one click, one rank). */
  learnSkill(id: string): void {
    const look = this.looks.look, next = buyRank(look.tree, look.vocation, id as SkillId, this.huntingLevel);
    if (!next) return;
    this.looks.setTree(next);
    this.message = this.t('play.td.tree.learned', { name: this.t(TD_SKILLS[id as SkillId].nameKey), n: effectiveRanks(next, look.vocation)[id as SkillId] });
    this.tickAbilities();
  }
  /** The free respec (asked once): every bought point comes back; the starting ranks stay. */
  respecTree(): void {
    if (!this.respecAsk) { this.respecAsk = true; return; }
    this.respecAsk = false;
    this.looks.setTree(resetTree(this.skillTree.tree));
    this.message = this.t('play.td.tree.reset');
    this.tickAbilities();
  }
  /** Put a skill on a key (1–4); whatever sat there swaps to where this one was. */
  assignSkill(id: string, slot: number): void {
    if (!this.ranked(id)) return;
    const bar = [...this.loadoutBar];
    const from = bar.indexOf(id), was = bar[slot - 1];
    bar[slot - 1] = id;
    if (from >= 0 && from !== slot - 1) bar[from] = was;
    this.looks.setLoadout(bar.filter(Boolean), this.looks.look.aura);
    this.tickAbilities();
  }
  /** Choose the running aura (one at a time); choosing the running one turns it off. */
  toggleAura(id: string): void {
    this.looks.setLoadout(this.loadoutBar, this.loadoutAura === id ? 'none' : id);
    this.tickAbilities();
  }
  private tickAreaCard(): void {
    const title = this.areaTitle;
    if (!title) return;
    // Settled first: the name must hold for a moment before its card shows (no card for a step over a border).
    if (title !== this.areaCardPending) { this.areaCardPending = title; this.areaCardSince = Date.now(); return; }
    if (title === this.areaCardSeen || Date.now() - this.areaCardSince < 1200) return;
    this.areaCardSeen = title;
    this.areaCard = { title, realm: this.realmLabel, n: (this.areaCard?.n ?? 0) + 1 };
    clearTimeout(this.areaCardTimer);
    this.areaCardTimer = setTimeout(() => this.zone.run(() => { this.areaCard = null; }), 3600);
  }

  /**
   * The creature the enemy bar is measuring, exactly: the engine reports the id
   * and name of the one it measured (no guessing from spawn points, so a mixed
   * hunt is always right). The id is translated (`play.creature.<id>`); the
   * engine's English name covers a creature without a key yet.
   */
  get enemyName(): string {
    const id = this.state.enemyId;
    if (id) {
      const key = `play.creature.${id}`;
      const named = this.t(key);
      if (named !== key) return named;
    }
    return this.state.enemyName || this.t('play.creature.unknown');
  }
  travel(id: RealmTownId): void {
    const town = this.townFor(id);
    if (!town || town.id === this.town.id) { this.closePanel(); return; }
    this.sound.sfx('portal');
    this.town = town;
    this.writePlay({ town: id });
    this.closePanel();
    this.engine?.setTown(town);
  }
  private placesCache: { area: string; rows: PlaceRow[] } | null = null;
  /** The current area's stations for the accessible Places list. Pure data, so it renders on the server too. */
  get places(): PlaceRow[] {
    // Top-down: the places of the level the Keeper is on (the square's stalls and ways out, a dungeon floor's own).
    if (this.topDown && this.engine) {
      const key = `td:${this.state.area ?? ''}`;
      if (this.placesCache?.area !== key) {
        // One row per place (a floor has many seams of one ore: the list names the ore once; the Keeper walks to the nearest).
        const seen = new Set<string>();
        this.placesCache = { area: key, rows: this.engine.places.filter(st => !seen.has(st.id) && !!seen.add(st.id)).map(st => ({ id: st.id, name: titleCase(st.label), blurb: st.blurb ?? '' })) };
      }
      return this.placesCache.rows;
    }
    const area = this.state.areaId ?? this.town.id;
    if (this.placesCache?.area !== area) {
      const stations = (areaOf(this.town, area) ?? this.town).stations;
      this.placesCache = { area, rows: stations.map(station => ({ id: station.id, name: titleCase(station.label), blurb: station.blurb ?? '' })) };
    }
    return this.placesCache.rows;
  }
  togglePlaces(): void {
    this.bestiaryOpen = false;
    this.placesOpen = !this.placesOpen;
    // The nudge is a one-time thing: seen once the list is open (the entry stays).
    this.lookNudgeShown = this.placesOpen && this.lookNudge;
    if (this.placesOpen && this.lookNudge) { this.looks.markPrompted(); this.lookNudge = false; }
    if (this.placesOpen) setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('#places-list li button')?.focus());
  }
  /** Walk to the place and interact on arrival; with reduced motion, go there and open it at once. */
  choosePlace(place: PlaceRow): void {
    this.placesOpen = false;
    if (this.topDown && !this.inSquare(place.id)) { this.message = this.t(place.id === 'delve' ? 'play.td.soon.delve' : 'play.td.soon.place'); this.focusWorld(); return; }
    if (!this.engine?.goToStation(place.id, this.reducedMotion)) {
      this.message = this.t(this.state.paused ? 'play.hud.msg.closeFirst' : 'play.hud.msg.cannotTravel');
    }
    // The list (and the focused row) is gone: keep the keyboard in the world, not on <body>.
    this.focusWorld();
  }
  /** The Map window's picture, pins and the Keeper's mark (td-engine mapView); null in the side view. */
  get tdMapView(): { url: string; aspect: number; pins: TdMapPin[]; me: { u: number; v: number } } | null {
    return this.topDown ? (this.engine as unknown as { mapView?: () => ReturnType<TopDownEngine['mapView']> } | undefined)?.mapView?.() ?? null : null;
  }
  /** B or the Map's menu: open or fold the Bestiary (cards are rebuilt on open, from the saved kill counts). */
  toggleBestiary(): void {
    if (!this.topDown) return;
    if (this.bestiaryOpen) { this.closeBestiary(); return; }
    this.placesOpen = false;
    const entries = bestiaryEntries(readKills(this.store.read(BESTIARY_KEY)));
    this.bestiary = {
      found: discoveredCount(entries),
      entries: entries.map(e => ({ ...e, lit: this.mobPortrait(e.id, false), dark: this.mobPortrait(e.id, true), shownHaunts: e.haunts.slice(0, 3), moreHaunts: Math.max(0, e.haunts.length - 3) })),
    };
    this.bestiaryOpen = true;
    setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.td-best .places-close')?.focus());
  }
  closeBestiary(): void { this.bestiaryOpen = false; this.focusWorld(); }

  // ── Town tasks (shared/town-tasks): talk to a giver, accept, hand in; the Tasks rows under the goals ──

  /** A task giver was spoken to (their own spot: beside a keeper's counter, or where they stand). A stall keeper keeps a Trade button. */
  private talkTo(keeperId: string): boolean {
    // The Archivist (shared/grave-goods): no tasks; speaking to him opens his desk, where whispers are silenced.
    if (this.topDown && keeperId === 'archivist') { this.openGraveDesk('archivist'); return true; }
    if (!this.topDown || !this.townTasks.isGiver(keeperId)) return false;
    const view = this.townTasks.talk(keeperId);
    const stall = this.engine?.places.find(p => TOWN_KEEPERS.infernal.some(k => k.id === keeperId && (k.station === p.id || (k.serves ?? []).includes(p.id)))) ?? null;
    // Sexton Wren speaks of the Count first while it is not done (his town tasks are a "Something else" away).
    const story = this.sexton.isGiver(keeperId) ? this.storyTalk(null) : null;
    this.taskTalk = { giver: keeperId, name: giverById(keeperId)?.name ?? keeperId, view, stall, thanks: null, story };
    this.engine?.setPaused(true);
    setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.td-talk__acts button')?.focus());
    return true;
  }
  closeTalk(): void {
    if (!this.taskTalk) return;
    this.taskTalk = null;
    if (!this.panel && !this.map.open && !this.storyCard && !this.storyScene) this.engine?.setPaused(false);
    this.focusWorld();
  }
  acceptTask(): void {
    const tk = this.taskTalk, task = tk?.view?.task;
    if (!tk || !task || !this.townTasks.accept(task.id)) return;
    this.message = this.t('play.task.taken', { title: this.t(`task.${task.id}.title`) });
    this.sound.sfx('coin');
    // Already done (a delivery the satchel already holds): the giver asks for it at once.
    this.taskTalk = { ...tk, view: this.townTasks.talk(tk.giver) };
    if (this.taskTalk.view?.standing !== 'ready') this.closeTalk();
    this.tickTasks(true);
  }
  handInTask(): void {
    const tk = this.taskTalk, task = tk?.view?.task;
    if (!tk || !task) return;
    const claim = this.townTasks.handIn(task.id);
    if (!claim) { this.message = this.t('play.task.short'); return; }
    const parts = [this.t('play.task.gold', { n: claim.gold }), this.t('play.task.xp', { n: claim.xp })];
    if (claim.material) { parts.splice(1, 0, `${claim.material.qty} ${this.taskThing(claim.material.id)}`); this.gotItem(claim.material.qty, this.taskThing(claim.material.id), claim.material.id); }
    if (claim.gear && task.reward.gear) parts.push(this.taskGearName(task));
    if (claim.potion) { const name = potionById(claim.potion)?.name ?? claim.potion; parts.push(name); this.gotItem(1, name, claim.potion); }
    const reward = parts.join(' · ');
    this.message = this.t('play.task.done', { title: this.t(`task.${task.id}.title`), reward });
    this.sound.sfx('coin'); this.bump('.coin-count');
    this.taskTalk = { ...tk, view: this.townTasks.talk(tk.giver), thanks: { task, reward } };
    this.tickTasks(true);
  }
  /** After the thanks: the next task the giver has, if any. */
  nextTask(): void { if (this.taskTalk) this.taskTalk = { ...this.taskTalk, thanks: null }; }
  /** The stall a keeper keeps (Trade): the talk closes, the stall opens as it always did. */
  tradeInstead(): void {
    const stall = this.taskTalk?.stall;
    this.closeTalk();
    if (stall) this.openStation(stall);
  }
  // ── The Sexton's Count (shared/sexton): Wren's story talk, the world's events, the choice, the journal ──

  /** What Wren says of the Count now (null: it is done, so his town tasks speak). `thanks`: the choice just made. */
  private storyTalk(thanks: { choice: 'kept' | 'rested'; gold: number; xp: number } | null): StoryTalk | null {
    const v = this.sexton.view();
    if (thanks) return { view: v, say: this.t(`sexton.thanks.${thanks.choice}`), task: '', reward: this.t('sexton.reward.paid', { gold: thanks.gold, xp: thanks.xp }), paid: true, notes: [], restOk: false, thanks: thanks.choice };
    if (v.step === 'done') return null;
    const gone = v.step === 'return' && !v.cowlHeld;
    const say = this.t(gone ? 'sexton.ask.returnGone' : `sexton.ask.${v.step}`);
    const reward = this.t('sexton.reward.line', { gold: sextonGold('kept'), xp: SEXTON_REWARD.huntingXp });
    const notes = v.step === 'return'
      ? [v.cowlHeld ? this.t('sexton.choice.rest', { gold: SEXTON_REWARD.restGold }) : this.t('sexton.choice.needCowl'), this.t('sexton.choice.keep')]
      : [];
    return { view: v, say, task: v.step === 'offer' ? this.t('sexton.journal.lead') : this.sextonNeed(v), reward, paid: false, notes, restOk: v.cowlHeld, thanks: null };
  }
  /** The journal entry under way, as one line ("Read the three chalk-marked stones … (1/3)"). */
  sextonNeed(v: SextonView): string {
    const now = v.journal.find(e => e.state === 'now');
    return now ? this.t(`sexton.journal.${now.id}.line`, { n: v.stones }) : '';
  }
  /** Take the Count from Wren. */
  acceptStory(): void {
    const tk = this.taskTalk;
    if (!tk || !this.sexton.accept()) return;
    this.message = this.t('sexton.say.taken');
    this.sound.sfx('coin');
    this.closeTalk();
    this.tickTasks(true);
  }
  /** The end: lay the cowl to rest, or keep it. Wren thanks the Keeper; the window stays open on his words. */
  chooseStory(choice: 'kept' | 'rested'): void {
    const tk = this.taskTalk;
    if (!tk) return;
    const claim = this.sexton.choose(choice);
    if (!claim) return;
    this.message = this.t(`sexton.thanks.${choice}`);
    this.sound.sfx(choice === 'rested' ? 'five' : 'coin'); this.bump('.coin-count');
    this.taskTalk = { ...tk, story: this.storyTalk(claim), view: this.townTasks.talk(tk.giver) };
    this.tickTasks(true);
  }
  /** Wren's town tasks instead of the story (his other talk, the Grave-goods desk). */
  storyElse(): void { if (this.taskTalk) this.taskTalk = { ...this.taskTalk, story: null }; }
  /** The world told the chain something: record it, say it, push the step to the engine. */
  private sextonSaw(ev: SextonEvent): void {
    if (!this.topDown) return;
    const { line, moved } = this.sexton.event(ev);
    if (line) this.message = this.t(line);
    if (moved) { this.sound.sfx(ev.kind === 'grave' || ev.kind === 'door' ? 'five' : 'tap'); this.tickTasks(true); }
  }
  /** The quest journal (the Count's six entries), in the place panel. */
  openJournal(): void {
    if (!this.browser) return;
    this.closeTalk();
    this.showPanel({ kind: 'journal', stationId: 'journal', title: this.t('sexton.journal.title'), kicker: 'Sexton Aldous Wren' });
  }
  /** "Defeat 6 Rivet Maw" / "Bring 6 Cinder Ore" / "Reach the Ember Inn's upstairs". */
  taskNeed(task: TownTask): string {
    if (task.kind === 'visit') return this.t('play.task.need.visit', { place: this.t(`task.place.${task.target}`) });
    return this.t(task.kind === 'hunt' ? 'play.task.need.hunt' : 'play.task.need.deliver', { n: task.n, name: task.kind === 'hunt' ? (MOBS[task.target]?.name ?? task.target) : this.taskThing(task.target) });
  }
  /** What a task pays, as one line: "144 Gold · 2 Ember Residue · 60 Hunting XP · a Rare Keeper's Cowl". */
  taskReward(view: TownTaskView): string {
    const r = view.task.reward;
    const parts = [this.t('play.task.gold', { n: view.gold })];
    if (r.material) parts.push(`${r.material.qty} ${this.taskThing(r.material.id)}`);
    parts.push(this.t('play.task.xp', { n: r.huntingXp }));
    if (r.gear) parts.push(this.taskGearName(view.task));
    if (r.potion) parts.push(this.t('play.task.potionChance', { name: potionById(r.potion.id)?.name ?? r.potion.id, pct: Math.round(r.potion.chance * 100) }));
    return parts.join(' · ');
  }
  /** A daily's reset: "Resets in 5h 12m" (the next local midnight). */
  dailyResets(): string {
    const left = Math.max(0, Math.ceil((dailyResetAt(this.now) - this.now) / 60_000));
    return this.t('play.task.resets', { h: Math.floor(left / 60), m: left % 60 });
  }
  private taskGearName(task: TownTask): string {
    const g = task.reward.gear!;
    return this.t('play.task.gear', { rarity: this.t(`play.task.rarity.${g.rarity}`), name: itemDefinitionById(g.defId)?.name ?? g.defId, level: g.level });
  }
  private taskThing(id: string): string { return materialDisplay(id)?.name ?? itemDefinitionById(id)?.name ?? id; }
  /** Hunts or visits just finished: say who to go back to. */
  private tasksFinished(done: readonly TownTask[]): void {
    for (const task of done) this.message = this.t('play.task.ready', { title: this.t(`task.${task.id}.title`), name: giverById(task.giver)?.name ?? '' });
    if (done.length) this.tickTasks(true);
  }
  private tasksKey = '';
  private taskLevel = '';
  /** The HUD tick: a floor reached counts for a visit; the givers' head marks; the Tasks rows. */
  private tickTasks(force = false): void {
    if (!this.topDown || !this.browser || !this.engine) return;
    const e = this.engine as unknown as { whereabouts?: { level: string }; setTaskMarks?: (m: Record<string, '!' | '?'>) => void };
    const level = e.whereabouts?.level ?? '';
    if (level !== this.taskLevel) { this.taskLevel = level; if (level && level !== 'surface') this.tasksFinished(this.townTasks.visited(level)); }
    const marks = this.townTasks.marks();
    const rows: { id: string; title: string; need: string; have: number; n: number; ready: boolean; giver: string; story?: boolean }[] = this.townTasks.active().map(v => ({ id: v.task.id, title: (v.task.daily ? this.t('play.task.dailyTag') + ' ' : '') + this.t(`task.${v.task.id}.title`), need: this.taskNeed(v.task), have: v.have, n: v.task.n, ready: v.standing === 'ready', giver: giverById(v.task.giver)?.name ?? '' }));
    // The Sexton's Count: its mark over Wren ("!" to take it, "?" to bring the cowl back), its row first on the scroll.
    const sv = this.sexton.view();
    if (sv.step === 'offer' && marks[SEXTON_GIVER] !== '?') marks[SEXTON_GIVER] = '!';
    if (sv.step === 'return') marks[SEXTON_GIVER] = '?';
    if (sv.step !== 'offer' && sv.step !== 'done') rows.unshift({ id: 'sexton-count', title: this.t('sexton.row'), need: this.sextonNeed(sv), have: sv.index - 1, n: sv.journal.length, ready: sv.step === 'return', giver: giverById(SEXTON_GIVER)?.name ?? '', story: true });
    (this.engine as unknown as { setSextonCount?: (s: { step: string; facts: readonly string[] }) => void }).setSextonCount?.({ step: sv.step, facts: SEXTON_FACTS.filter(f => typeof sv.facts[f] === 'number') });
    const key = JSON.stringify([marks, rows]);
    if (!force && key === this.tasksKey) return;
    this.tasksKey = key;
    e.setTaskMarks?.(marks);
    this.taskRows = rows;
    // For tests and tools: the givers' head marks ("bench-smith:!;sexton-wren:!").
    this.canvas?.nativeElement.setAttribute('data-task-marks', Object.entries(marks).map(([id, m]) => `${id}:${m}`).sort().join(';'));
  }
  private readonly portraits = new Map<string, string>();
  /** A creature's first frame, painted by its own code, scaled x3 without smoothing; dark: only its outline filled in. */
  private mobPortrait(id: string, dark: boolean): string {
    const key = `${id}:${dark}`;
    const held = this.portraits.get(key);
    if (held !== undefined) return held;
    const def = MOBS[id];
    if (!def || !this.browser) return '';
    const c = document.createElement('canvas'); c.width = def.w * 3; c.height = def.h * 3;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(mobSheet(def), 0, 0, def.w, def.h, 0, 0, c.width, c.height);
    if (dark) { g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0d0813'; g.fillRect(0, 0, c.width, c.height); }
    const url = c.toDataURL('image/png');
    this.portraits.set(key, url);
    return url;
  }
  pinName(pin: TdMapPin): string { return titleCase(pin.label); }
  goPin(pin: TdMapPin): void { this.choosePlace({ id: pin.id, name: titleCase(pin.label), blurb: pin.blurb }); }
  /** Raised skeletons walking with the Keeper (0 in the side view). */
  get tdRaised(): number { return this.topDown ? (this.engine as unknown as { raisedCount?: number } | undefined)?.raisedCount ?? 0 : 0; }
  releaseRaised(): void { (this.engine as unknown as { releaseRaised?: () => number } | undefined)?.releaseRaised?.(); this.focusWorld(); }
  /** Whether the top-down square has this station (a stall the Keeper can walk to). */
  private inSquare(id: string): boolean { return !!this.engine?.places.some(p => p.id === id); }
  /**
   * The first-session goal: buy a building, defeat a Maw, forge the blade, dig
   * in the Delve. Read from the save on the HUD tick (never stored itself), so
   * it moves on the moment the thing is done, wherever it was done.
   */
  private refreshGuide(): void {
    const progress = this.activity.snapshot.progress;
    const worn = this.inventory.snapshot.equipped['weapon'];
    // One World: the settlement's street is the town ('infernal'); under it, the Delve; elsewhere the region.
    const areaId = this.state.world
      ? this.state.region === 'basalt-seamworks' ? this.town.id : this.state.region === 'ember-delve' ? 'ember-delve' : this.state.region ?? this.town.id
      : this.state.areaId ?? this.town.id;
    // Top-down: the prologue (td/td-prologue.ts), one step at a time, per character.
    const goal = this.topDown ? this.tickPrologue() : firstGoal({
      ...(this.state.world ? { world: { mawX: ROAD_MAW_APPROACH_X } } : {}),
      bought: this.boughtBuilding,
      hunted: (progress.xpByDiscipline['hunting'] ?? 0) > 0,
      crafted: this.activity.snapshot.craftedBasaltEdge || !!this.edge || (progress.xpByDiscipline['forge'] ?? 0) > 0,
      edge: !!this.edge,
      armed: !!worn && !worn.explorerId,
      dug: this.delve.hasDug('ember-delve'),
      areaId,
      ore: this.ore,
      ember: this.ember,
    });
    // After the four goals: the Rune Forge, once, the first time a strike is affordable (the side view's).
    const next = goal ?? (this.topDown ? null : runeForgeHint({
      goalsDone: true,
      gold: this.economy.snapshot.gold,
      strikeCost: STRIKE_COST,
      seen: this.runeHintSeen,
      areaId,
    }));
    if (next?.key !== this.guide?.key || next?.n !== this.guide?.n || next?.vars?.['skill'] !== this.guide?.vars?.['skill']) this.guide = next;
    this.tickStory({
      met: this.glimVoice.met,
      // Top-down: the Prologue's beats read the game the island teaches (a hearth lit, a way down the mine).
      bought: this.topDown ? this.hearth.state.lit.length > 0 : this.boughtBuilding,
      armed: !!worn && !worn.explorerId,
      hunted: (progress.xpByDiscipline['hunting'] ?? 0) > 0,
      dug: this.topDown ? this.activity.snapshot.miningAccepted > 0 || (progress.xpByDiscipline['mining'] ?? 0) > 0 : this.delve.hasDug('ember-delve'),
    });
    this.tickGlim(areaId, !goal, (progress.xpByDiscipline['hunting'] ?? 0) > 0, !!worn && !worn.explorerId);
    this.tickBond(areaId);
    this.tickPets();
  }

  /**
   * The top-down prologue's tick (td/td-prologue.ts): file what the save cannot show (a few tiles walked, the
   * Spellbook or the Satchel opened while it was the step), point Glim's chevrons at the step's thing, have Glim say
   * the step's tip once, and return the goal line's view (null: the prologue is over for this Keeper).
   */
  private tickPrologue(): FirstGoalView | null {
    const story = this.story.state;
    const facts = {
      level: this.huntingLevel,
      filed: story.tut ?? [],
      skipped: !!story.skip,
      hearthLit: this.hearth.state.lit.length > 0,
      hunted: (this.activity.snapshot.progress.xpByDiscipline['hunting'] ?? 0) > 0,
      goldEarned: this.economy.snapshot.totalGoldEarned > 0,
      storyTaken: this.sexton.view().step !== 'offer',
    };
    let step = prologueStep(facts);
    // What happens where the Keeper stands: filed the moment it is seen, so the line moves on in the same tick.
    if (step === 'walk' && this.state.x !== undefined && this.state.y !== undefined) {
      const at = { x: this.state.x, y: this.state.y };
      if (!this.proWalkFrom || this.proStep !== 'walk') this.proWalkFrom = at;
      else if (Math.hypot(at.x - this.proWalkFrom.x, at.y - this.proWalkFrom.y) >= PROLOGUE_WALK_TILES * 16) this.story.fileTut('walk');
    }
    if (step === 'book' && this.spellbookOpen) this.story.fileTut('book');
    if (step === 'bag' && this.bagOpen) this.story.fileTut('bag');
    if (step) step = prologueStep({ ...facts, filed: this.story.state.tut ?? [] });
    (this.engine as unknown as { setGuide?: (kind: string | null) => void } | undefined)?.setGuide?.(guideFor(step));
    // The prologue just ended here (not a Keeper who was past it on arrival): Glim says so, once.
    if (!step && this.proWasOn && !this.story.state.skip) this.message = this.t('play.pro.done');
    this.proWasOn = !!step;
    this.proStep = step;
    // A tip for a step already done goes (the line on screen always matches the scroll).
    const said = this.glimVoice.speech?.key;
    if (said?.startsWith('play.pro.tip.') && said !== (step ? tipKey(step) : '')) this.glimVoice.dismiss();
    if (!step) return null;
    // Glim introduces each step once a session, when nothing else is on screen (the meeting line comes first).
    if (step !== this.proTipped && this.glimVoice.met && !this.panel && this.glimVoice.react(tipKey(step), Date.now(), 8000)) this.proTipped = step;
    const look = this.looks.look;
    const slot1 = this.tdAbilities[0]?.id as SkillId | undefined;
    const skill = slot1 && TD_SKILLS[slot1] ? this.t(TD_SKILLS[slot1].nameKey) : '';
    return prologueView(step, look.vocation, this.touchUi, skill);
  }
  /** "Skip tutorial": this Keeper has played before. The prologue is over for them (the save's own beats stay). */
  skipPrologue(): void {
    this.story.skipTut();
    (this.engine as unknown as { setGuide?: (kind: string | null) => void } | undefined)?.setGuide?.(null);
    this.guide = null;
    this.proWasOn = false;
    this.message = this.t('play.pro.skipped');
    this.focusWorld();
  }

  // ── Pets (shared/pets; docs/handoff/pets.md) ──

  /**
   * The pets' roles and Glim being alive (companion-host.ts; docs/handoff/pets-and-glim-alive.md):
   * pet XP and finds, Glim's reactions, the chat card, catch-the-light.
   */
  readonly companions = new CompanionHost({
    engine: () => this.engine ?? null,
    pets: this.pets,
    glim: this.glim,
    voice: this.glimVoice,
    t: (key, vars) => this.t(key, vars),
    sfx: cue => this.sound.sfx(cue),
    toast: text => { this.message = text; this.toastLoot(text); },
    grant: (grantId, item, qty) => this.inventory.grantStack(grantId, item, qty),
    itemName: id => materialDisplay(id)?.name ?? titleCase(id.replace(/-/g, ' ')),
    busy: () => !!this.panel || !!this.storyCard || !!this.storyScene || !!this.glimTalk || this.map.open || this.petsOpen,
    tipContext: () => this.tipContext(),
    repushPet: () => { this.petKey = ''; this.pushPet(); },
  });
  /** Where the Keeper is, for one of Glim's tips. */
  private tipContext(): TipContext {
    if (this.state.fishing || this.state.canFish) return 'fishing';
    if (this.state.delve) return 'delve';
    if (followingPet(this.pets.state) && Math.random() < .35) return 'pets';
    return (this.state.enemyHp ?? 0) > 0 || this.town.hunts.some(h => h.id === this.state.areaId) ? 'hunt' : 'town';
  }
  /** Tap Glim: the chat card. */
  /** The HUD icon's face: Glim's current mood in the world. */
  get glimIconMood(): GlimMood { return (this.glimAt?.mood as GlimMood | undefined) ?? 'calm'; }
  openGlimChat(): void {
    if (this.glimTalk) return;
    this.glimVoice.dismiss();
    this.companions.openChat();
  }
  closeGlimChat(): void { this.companions.closeChat(); this.focusWorld(); }
  /** "Quiet Glim" is on (the chat card shows the switch). */
  get glimQuiet(): boolean { return this.browser && this.glim.quiet; }

  private petsAt = 0;
  private petKey = '';
  /** The Star Owlet's ore cells (the maps mark them), re-read once a second in the Delve. */
  petScentCells: { col: number; row: number }[] = [];
  /** Something new waits in the pet well (an egg, or a rescue to name). */
  get petWellNew(): boolean {
    const state = this.browser ? this.pets.state : null;
    return !!state && Object.values(state.pets).some(r => !isHatched(r) || !r.name);
  }
  /** The pet well's picture: the pet following, else the first egg or pet, else empty. */
  get petWellArt(): string {
    if (!this.browser) return '';
    const state = this.pets.state;
    const id = state.active || Object.keys(state.pets)[0];
    const rec = id ? state.pets[id] : undefined;
    const def = id ? petDef(id) : undefined;
    if (!rec || !def) return '';
    return isHatched(rec) ? petPortrait(def.id, 'idle0', rec.hat, 2) : eggPortrait(def.id, 0, 2);
  }
  /**
   * The pets' tick (once a second): find any pet the ledgers have earned (a
   * crate opened, a corridor cleared, the Herald's third day, a guardian's
   * fall), say so, let Glim greet each one once, and hand the follower to the
   * engine.
   */
  private tickPets(): void {
    if (!this.browser || !this.engine) return;
    const now = Date.now();
    if (now - this.petsAt < 1000) return;
    this.petsAt = now;
    const found = this.pets.find({
      tally: this.pets.state.tally,
      claimDays: this.bounties.state.claimDays,
      flag: id => this.delve.isClaimed(id),
    }, now);
    for (const def of found) {
      const name = this.t('play.pet.name.' + def.id);
      this.toastLoot(this.t(def.arrival === 'egg' ? 'play.pet.toast.egg' : 'play.pet.toast.rescue', { name }), def.arrival === 'egg' ? eggPortrait(def.id, 0, 2) : petPortrait(def.id, 'happy', false, 2));
      this.message = this.t(def.arrival === 'egg' ? 'play.pet.toast.egg' : 'play.pet.toast.rescue', { name });
      this.pulseSatchel();
      this.sound.sfx('chirp');
    }
    this.pushPet();
    // Glim's first word about each pet, once ever (stamped in Glim's own memory).
    if (this.glimVoice.met) {
      for (const [id, rec] of Object.entries(this.pets.state.pets)) {
        const stamp = `pet.${id}`;
        if (isHatched(rec) && !this.glim.state.said[stamp]) {
          this.glim.said(stamp);
          this.glimVoice.bond({ id: stamp, key: `play.pet.glim.${id}` });
        }
      }
    }
  }
  /** The follower, its name and hat, to the engine (only when they change). */
  private pushPet(): void {
    if (!this.engine) return;
    const state = this.pets.state;
    const def: PetDef | null = followingPet(state);
    const rec = def ? state.pets[def.id] : undefined;
    const command = this.pets.command;
    const grown = def ? this.companions.petLevel(def.id) : { level: 1, second: false };
    const key = def && rec ? `${def.id}|${rec.name}|${rec.hat}|${command}|${grown.level}` : '';
    if (key === this.petKey) return;
    this.petKey = key;
    const role = def ? PET_ROLES[def.id] : null;
    this.engine.setPet(def && rec && role ? {
      id: def.id, name: rec.name, hat: rec.hat, ability: def.ability,
      role: role.role, move: role.move, second: grown.second ? role.second : null, level: grown.level, command,
    } : null);
    this.fishKey = '';
    this.pushFishing();
  }
  /** Where the pet is (the canvas's data-pet-* for the e2e). */
  get petAt(): { id: string; x: number; y?: number; state: string; fetching: boolean; glow: boolean; act: string; hits: number; gathers: number; finds: number; heals: number; command: string; level: number } | null { return this.engine?.petView ?? null; }
  /** Top-down: the pet chip by the portrait (its face, its name, what it is doing); it opens the pet sheet. */
  get tdPet(): { id: string; name: string; doing: string; state: string; face: string } | null {
    const at = this.topDown ? this.petAt : null;
    if (!at) return null;
    const name = this.pets.record(at.id)?.name || this.t('play.pet.name.' + at.id);
    const face = (this.engine as unknown as { petFace?: () => string } | undefined)?.petFace?.() ?? '';
    return { id: at.id, name, doing: this.t('play.pet.doing.' + at.state), state: at.state, face };
  }
  /** The helper of the pet following, or null. */
  private get petAbility(): PetDef['ability'] | null { return this.browser ? followingPet(this.pets.state)?.ability ?? null : null; }
  openPets(): void { this.placesOpen = false; this.petsOpen = true; this.sound.sfx('open'); }
  closePets(): void { this.petsOpen = false; this.pushPet(); }
  /** The pet sheet asked the pet in the world to react (a meal, its trick, a hatch). */
  petFelt(event: { id: string; kind: 'happy' | 'love' | 'trick' | 'hatch' }): void {
    this.pushPet();
    if (event.kind === 'hatch') { this.sound.sfx('hatch'); this.petsAt = 0; this.tickPets(); }
    if (event.kind === 'trick') this.companions.petTrick();
    this.engine?.petFeel(event.kind === 'trick' ? 'trick' : event.kind === 'love' ? 'love' : 'happy');
  }
  /** A command from the pet card (Follow / Stay / Fight / Gather / Play). */
  petCommanded(): void { this.petKey = ''; this.pushPet(); }

  // ── The bond with Glim (shared/glim/glim-bond.ts) ──

  /** The talk card open over the world (a talk Glim offered), or null. */
  glimTalk: string | null = null;
  private bondAt = 0;
  private bondSeenAt = 0;
  private bondBackChecked = false;
  private senseKey = '';
  private noticeId = '';
  /**
   * The bond's tick (once a second): file the shared moments the ledgers show
   * (a place, a carving, a mission, a first catch, a depth, the compass), the
   * warm hello after a while away, and a stage or quest step reached. While
   * the play view catches up with a loaded save, nothing is said.
   */
  private tickBond(areaId: string): void {
    if (!this.browser || !this.glimVoice.met) return;
    const now = Date.now();
    if (now - this.bondAt < 1000) return;
    this.bondAt = now;
    // The warm hello: checked once a visit, against the stamp left by the last one. Never a guilt trip.
    if (!this.bondBackChecked) {
      this.bondBackChecked = true;
      const last = this.glim.state.seenAt;
      if (last && now - last >= BACK_AFTER_MS) {
        const n = this.glim.state.moments.filter(m => m.startsWith('back:')).length + 1;
        this.glim.addMoments([`back:${n}`]);
        this.glimVoice.bond({ id: 'back', key: coloured('glim.line.back', this.glim.answerTo('deep'), answersFor('deep')) });
      }
    }
    if (now - this.bondSeenAt >= 5 * 60_000) { this.bondSeenAt = now; this.glim.seen(now); }
    this.bondMoments(momentsFrom({
      areaId,
      inscriptions: this.delveLore.inscriptions(),
      missionsDone: DELVE_MISSIONS.filter(m => this.quests.isMissionDone(m.id)).map(m => m.id),
      caught: Object.keys(this.fishing.save.caught).filter(id => !CRATE_IDS.includes(id)),
      deepest: this.delve.hasDug('ember-delve') ? this.bounties.state.deepest : -1,
      compass: this.compassHeld,
    }));
  }
  /** File moments; when live, a stage reached offers its talk and a quest step says so. */
  private bondMoments(ids: string[]): void {
    if (!this.browser || !this.glimVoice.met) return;
    const added = this.glim.addMoments(ids);
    const live = Date.now() - this.openedAt >= STORY_CATCH_UP_MS;
    const stage = this.glim.stage;
    if (stage.n > this.glim.state.peak) {
      this.glim.reachStage(stage.n);
      const talk = nextTalk(stage, this.glim.state.moments);
      if (live) this.glimVoice.bond({ id: `stage.${stage.n}`, key: `glim.line.stage.${stage.n}`, ...(talk ? { talk: talk.id } : {}) });
    }
    if (!live) return;
    for (const id of added) {
      const n = Number(id.startsWith('quest:') ? id.slice(6) : 0);
      if (n >= 1 && n <= 5) this.glimVoice.bond({ id, key: `glim.line.quest.${n}` });
    }
  }
  /** Say a bond ability's line, at most once per `cooldownMs` (remembered through the gateway). */
  private bondLine(id: string, key: string, cooldownMs: number, vars?: Record<string, string | number>): void {
    const stamp = `bond.${id}`;
    const last = this.glim.state.lastAt[stamp] ?? 0;
    if (last && Date.now() - last < cooldownMs) return;
    this.glim.said(stamp);
    this.glimVoice.bond({ id: stamp, key, ...(vars ? { vars } : {}) });
  }
  /**
   * The bond's abilities, in the Delve (once a second): the sense (Glim
   * brightens near a room no lantern has touched or an uncopied carving), the
   * notice (a rare find near, and which way) and the way home (said when the
   * shaft is far). Each is open only at its stage.
   */
  private tickBondAbilities(read: ReadonlySet<string>): void {
    if (!this.engine || !this.glimVoice.met) return;
    const at = this.engine.keeperCell();
    const stage = this.glim.stage;
    let bright = false;
    if (at && hasAbility(stage, 'sense')) {
      const near = this.engine.compassTarget(id => read.has(id));
      if (near && Math.hypot(near.col - at.col, near.row - at.row) <= SENSE_CELLS) {
        bright = true;
        const key = `${near.col},${near.row}`;
        if (key !== this.senseKey) {
          this.senseKey = key;
          this.bondLine('sense', coloured('glim.line.sense', this.glim.answerTo('like'), answersFor('like')), 10 * 60_000);
        }
      }
    }
    this.bondBright = bright;
    this.engine.setGlimBright(bright || this.cabinetBright);
    if (!at) return;
    if (hasAbility(stage, 'notice')) {
      const rare = this.engine.rareNear(GLIM_RARE_KINDS, NOTICE_CELLS);
      if (rare && rare.id !== this.noticeId) {
        this.noticeId = rare.id;
        const dir = this.t(rare.col + rare.w / 2 >= at.col ? 'glim.dir.east' : 'glim.dir.west');
        this.bondLine('notice', coloured('glim.line.notice', this.glim.answerTo('mark'), answersFor('mark')), 15 * 60_000, { dir });
      }
    }
    if (hasAbility(stage, 'way')) {
      const way = wayHome(at, this.engine.mapSource()?.shafts ?? []);
      if (way && way.cols + way.rows >= WAY_FAR_CELLS) {
        this.bondLine('way', way.dir === 'here' ? 'glim.line.wayHere' : 'glim.line.way', 20 * 60_000,
          { cols: way.cols, rows: way.rows, dir: way.dir === 'here' ? '' : this.t(`glim.dir.${way.dir}`) });
      }
    }
  }
  /** Talk (on a bond line): the talk card opens over the world, which waits. */
  openGlimTalk(id: string): void {
    this.glimTalk = id;
    this.glimVoice.dismiss();
    this.bagOpen = false; this.placesOpen = false;
    this.engine?.setHover(null);
    this.engine?.setPaused(true);
    setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.glim-talk-card button')?.focus({ preventScroll: true }));
  }
  closeGlimTalk(): void {
    if (!this.glimTalk) return;
    this.glimTalk = null;
    if (!this.panel && !this.map.open && !this.storyCard && !this.storyScene) this.engine?.setPaused(false);
    this.focusWorld();
  }
  /**
   * The story's tick: file the beats the save has reached; a live beat's lines
   * go to Glim's line (in order, after anything on screen), and a crossed act
   * boundary raises its card once the Keeper is back in the world.
   */
  private tickStory(goals: { met: boolean; bought: boolean; armed: boolean; hunted: boolean; dug: boolean }): void {
    if (!this.browser) return;
    const live = Date.now() - this.openedAt >= STORY_CATCH_UP_MS;
    const before = new Set(this.story.state.beats);
    const lines = this.story.advance({
      ...goals,
      inscriptions: this.delveLore.inscriptions(),
      missionDone: id => this.quests.isMissionDone(id),
      wardenDown: this.delve.isClaimed(WARDEN_FLAG),
      cabinets: this.cabinets.count(),
    }, live);
    if (live) for (const beat of this.story.state.beats) if (!before.has(beat)) this.scenesLive.add(beat as StorySceneId);
    if (lines.length) this.glimVoice.story(lines);
    this.tickKeepers(goals);
    if (!this.storyCard && !this.storyScene && !this.glimTalk && !this.panel && !this.map.open && !this.state.defeated) {
      // A scene first (the act's last scene comes before the card that ends the act), then a card.
      const scene = live ? this.story.pendingScenes().find(id => this.scenesLive.has(id) || !this.sceneOwedShown) : undefined;
      const card = scene ? null : this.story.pendingCard();
      if (scene) this.openStoryScene(scene);
      else if (card) this.openStoryCard(card);
    }
  }
  /** The last story beats + station deeds handed to the town keepers (world/keeper-lines.ts). */
  private keeperKey = '';
  /**
   * The town keepers speak to where the Keeper is in the story and what they
   * have done at each station (a first craft, a first sale). Read off the save
   * on the HUD tick; the engine hears only when something changed.
   */
  private tickKeepers(goals: { bought: boolean; hunted: boolean; dug: boolean }): void {
    if (!this.engine) return;
    const progress = this.activity.snapshot.progress;
    const inv = this.inventory.snapshot;
    const economy = this.economy.snapshot;
    const deeds = keeperDeeds({
      forged: this.activity.snapshot.craftedBasaltEdge || (progress.xpByDiscipline['forge'] ?? 0) > 0,
      sold: inv.sold,
      inVault: inv.inVault,
      strikes: economy.totalClicks,
      socketed: inv.items.some(item => !!item.sockets?.some(Boolean)),
      bought: goals.bought,
      hunted: goals.hunted,
      dug: goals.dug,
      topSkill: Math.max(0, ...SKILLS.map(skill => skillLevel(progress, skill.id))),
      fished: (progress.xpByDiscipline['fishing'] ?? 0) > 0,
      mission: DELVE_MISSIONS.some(mission => this.quests.isMissionDone(mission.id)),
      bountied: this.bounties.state.total > 0,
      slated: this.slateTier > 0,
      goldEarned: economy.totalGoldEarned,
    });
    const beats = this.story.state.beats;
    // The hour the keepers notice (world/keeper-lines.ts KeeperHour): the world clock's sky.
    const hour = this.skyPhase;
    const key = `${beats.join(',')}|${deeds.join(',')}|${hour}`;
    if (key === this.keeperKey) return;
    this.keeperKey = key;
    this.engine.setKeeperContext({ beats: new Set(beats), deeds: new Set(deeds), hour });
  }
  private openStoryCard(id: StoryCardId): void {
    this.storyCard = { id, paragraphs: Array.from({ length: STORY_CARD_PARAGRAPHS[id] }, (_, n) => `story.card.${id}.p${n + 1}`) };
    this.bagOpen = false; this.placesOpen = false;
    this.glimVoice.dismiss();
    this.engine?.setHover(null);
    this.engine?.setPaused(true);
    setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.story-card__go')?.focus({ preventScroll: true }));
  }
  private openStoryScene(id: StorySceneId): void {
    if (!this.scenesLive.has(id)) this.sceneOwedShown = true;
    this.storyScene = id;
    this.bagOpen = false; this.placesOpen = false;
    this.glimVoice.dismiss();
    this.engine?.setHover(null);
    this.engine?.setPaused(true);
    setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.story-scene-card .ss__go')?.focus({ preventScroll: true }));
  }
  /** Take it (or Escape, which still files it: a reward is never lost to a skip). The world moves again. */
  closeStoryScene(): void {
    const id = this.storyScene;
    if (!id) return;
    this.storyScene = null;
    this.scenesLive.delete(id);
    this.story.playScene(id);
    if (!this.panel && !this.map.open) this.engine?.setPaused(false);
    this.focusWorld();
  }
  /** Continue (or Escape): the card is filed as shown and the world moves again. */
  closeStoryCard(): void {
    const card = this.storyCard;
    if (!card) return;
    this.storyCard = null;
    this.story.cardShown(card.id);
    if (!this.panel && !this.map.open) this.engine?.setPaused(false);
    this.focusWorld();
  }
  /** Who says the line on screen: Glim (null), or the keeper whose story line it is. */
  get sayer(): { name: string; monogram: string; color: string; portrait: string | null } | null {
    const speaker = this.glimVoice.speech?.story?.speaker;
    if (!speaker || speaker === 'glim') return null;
    const npc = npcById(speaker);
    // The pixel Keeper's face (cached per id); the monogram stays for the faceless.
    return npc ? { name: npc.name, monogram: npc.monogram, color: npc.color, portrait: npcPortrait(npc.id) } : null;
  }
  /** The chapter the goal line belongs to (the Prologue wraps the four first goals). */
  get chapterTag(): string {
    return this.story.state.chapter === 'prologue' ? this.t('story.chapter.prologue') : '';
  }
  /** Glim's tick: maybe a line (glim.ts nextLine), the sprite shown once met, and where it is. */
  private tickGlim(areaId: string, goalsDone: boolean, hunted: boolean, armed: boolean): void {
    const voice = this.glimVoice;
    voice.tick({ now: Date.now(), panelOpen: !!this.panel || !!this.storyCard || !!this.storyScene || !!this.glimTalk, areaId, armed, hunted, goalsDone, dimmed: !!this.glimAt?.dimmed });
    if (!this.engine) return;
    this.engine.setGlim(voice.met, voice.justMet);
    voice.justMet = false;
    const at = this.engine.glimView;
    this.glimAt = at.shown ? { x: at.x, targetX: at.targetX, arrived: at.arrived, dimmed: at.dimmed, bright: at.bright, mood: at.mood, trail: at.trail, lamp: at.lamp } : null;
    this.companions.tick(this.state, this.pushed.maxHp, this.skyNow ?? null);
  }
  /** The goal row's Glim button: the next step of this goal's hint ladder; step 3 is Show me. */
  askGlim(): void {
    const goal = this.guide;
    if (!goal) return;
    // The prologue: Glim says the step's tip again and points (its chevrons are already out).
    if (this.topDown && this.proStep) { this.glimVoice.answer(tipKey(this.proStep), Date.now(), 8000); return; }
    const hint = this.glimVoice.ask(`goal.${goal.id}`, goal.key, Date.now());
    if (hint.walk) this.showGoal();
  }
  /** "Ask Glim for a hint (2 of 3)". */
  get glimAskLabel(): string {
    const goal = this.guide;
    if (!goal) return '';
    if (this.topDown && this.proStep) return this.t('play.glim.askDone');
    const { next, top } = this.glimVoice.peek(`goal.${goal.id}`, goal.key);
    return top ? this.t('play.glim.ask', { n: next, total: top }) : this.t('play.glim.askDone');
  }
  dismissGlim(): void {
    this.glimVoice.dismiss();
    this.focusWorld();
  }
  /** The Rune Forge hint was followed, dismissed, or the forge opened: it never shows again. */
  private runeHintSeen = this.readRuneHintSeen();
  private readRuneHintSeen(): boolean {
    if (!this.browser) return false;
    try { return localStorage.getItem(RUNE_HINT_KEY) === '1'; } catch { return false; }
  }
  private markRuneHintSeen(): void {
    if (this.runeHintSeen) return;
    this.runeHintSeen = true;
    try { localStorage.setItem(RUNE_HINT_KEY, '1'); } catch { /* private mode: the hint is gone for this page only */ }
    if (this.guide?.id === 'rune') this.guide = null;
  }
  /** "Not now" on the Rune Forge hint. */
  hideHint(): void {
    this.markRuneHintSeen();
    this.focusWorld();
  }
  /** "Show me": walk to the goal's place (and use it on arrival), or to its spot on the floor. */
  showGoal(): void {
    // Re-read first: a press right after an area change must not use the last area's target
    // (the Homestead's 'passage' is the Seamworks' east passage to the Quarry).
    this.refreshGuide();
    const target = this.guide?.target;
    if (!target || !this.engine) return;
    // The prologue: walk to the step's thing and use it (light the hearth, talk to the Sexton, close in, the coins).
    if ('guide' in target) {
      const eng = this.engine as unknown as { guideGo?: () => boolean; guideFar?: () => number };
      // Far off (over ~40 tiles) it does not walk the whole way: Glim points and says how far.
      const far = eng.guideFar?.() ?? 0;
      if (far > 0) { this.message = this.t('play.pro.far', { n: far }); this.focusWorld(); return; }
      const went = eng.guideGo?.() ?? false;
      if (!went) this.message = this.t(this.state.paused ? 'play.hud.msg.closeFirst' : target.guide === 'foe' || target.guide === 'gold' ? 'play.pro.none' : 'play.hud.msg.cannotTravel');
      this.focusWorld();
      return;
    }
    if (this.guide?.id === 'rune') this.markRuneHintSeen();
    this.placesOpen = false;
    // Top-down: the square walks to what it has; the hunt and the mines are not in the world yet (no 2D detour, owner).
    if (this.topDown && ('x' in target || !this.inSquare(target.station))) {
      this.message = this.t('x' in target ? 'play.td.soon.hunt' : target.station === 'delve' ? 'play.td.soon.delve' : 'play.td.soon.place');
      this.focusWorld();
      return;
    }
    const ok = 'station' in target
      ? this.engine.goToStation(target.station, this.reducedMotion)
      : this.reducedMotion ? (this.engine.placeAt(target.x), true) : this.engine.moveTo(target.x);
    if (!ok) this.message = this.t(this.state.paused ? 'play.hud.msg.closeFirst' : 'play.hud.msg.cannotTravel');
    // Glim flies ahead to the place and back, leaving a short trail (it sits still under reduced motion).
    else this.engine.glimShowMe(target);
    this.focusWorld();
  }
  /** Close the Places list from the keyboard and hand focus back to its toggle. */
  private closePlaces(): void {
    this.placesOpen = false;
    setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.places-toggle')?.focus({ preventScroll: true }));
  }
  async joinRoom(name: string): Promise<void> {
    if (this.joining || !name.trim()) return;
    this.joining = true;
    try { await this.room?.join(name.trim()); } finally { this.joining = false; }
  }
  leaveRoom(): void { this.room?.leave(); }
  /** "Hearth · 3 online" when in the room, "Hearth · chat" before joining. */
  get hearthPill(): string {
    const tail = this.social.connected ? this.t('play.hearth.online', { n: this.social.players.length }) : this.t('play.hearth.chat');
    return `${this.t('play.hearth.name')} · ${tail}`;
  }
  /** Open or fold the Hearth chat; focus follows (into the form, or back to the pill). */
  toggleHearth(): void {
    this.hearthOpen = !this.hearthOpen;
    this.rememberHearth(this.hearthOpen);
    // The open panel and the satchel book share the right of the HUD strip: one at a time.
    if (this.hearthOpen) this.closeBag();
    const root = this.host.nativeElement as HTMLElement;
    setTimeout(() => {
      const target = this.hearthOpen
        ? root.querySelector<HTMLElement>('.dock input:not([disabled])') ?? root.querySelector<HTMLElement>('.hearth-hide')
        : root.querySelector<HTMLElement>('.hearth-pill');
      target?.focus({ preventScroll: true });
    });
  }
  private readHearthOpen(): boolean {
    try { return localStorage.getItem(HEARTH_OPEN_KEY) === '1'; } catch { return false; }
  }
  private rememberHearth(open: boolean): void {
    try { localStorage.setItem(HEARTH_OPEN_KEY, open ? '1' : '0'); } catch { /* private mode: the pill simply starts folded */ }
  }
  async sendChat(input: HTMLInputElement): Promise<void> {
    if (this.sending || !input.value.trim()) return;
    this.sending = true;
    const text = input.value.trim();
    // The Seam-Cant typed (design-bible §4.0, Tibia's `exori vis`): a learned spell's words cast it instead of chatting.
    if (this.castWords(text)) { input.value = ''; this.sending = false; return; }
    try { if (await this.room?.chat(text)) { if (input.value.trim() === text) input.value = ''; } } finally { this.sending = false; }
  }
  /** Typed spell words: the class's active that says them goes off (or says why not). False when no spell says them. */
  private castWords(text: string): boolean {
    const said = text.toLowerCase().replace(/\s+/g, ' ').trim();
    // Lumvesh with a name (design-bible §4.6, Tibia's exiva "name"): `lum vesh "ink abbess"` seeks that one.
    const named = this.topDown ? /^lum vesh\s+["“']?(.+?)["”']?$/.exec(said) : null;
    if (named && this.ranked('seek')) {
      const why = (this.engine as unknown as { seekFor?: (name: string | null) => string | null } | undefined)?.seekFor?.(named[1]);
      if (why && why !== 'noseek') this.message = this.t(`play.td.ability.${why}`);
      this.tickAbilities();
      return true;
    }
    const id = this.topDown ? TD_CLASS_SKILLS[this.looks.look.vocation].find(s => TD_SKILLS[s].kind === 'active' && TD_SKILLS[s].words === said) : undefined;
    if (!id) return false;
    const why = this.tdEngine?.useAbility?.(id);
    if (why) this.message = this.t(`play.td.ability.${why}`);
    this.tickAbilities();
    return true;
  }
  art(id: string): string { return artFor(id)?.src ?? ''; }
  /** The Keeper's HP as the bar prints it: whole (lava, breath and the furnace's mouth take fractions a step). */
  get hpShown(): number { return Math.ceil(this.state.hp); }
  get ore(): number { return this.inventory.stackOf(CINDER_ORE_ID); }
  get ember(): number { return this.inventory.stackOf(EMBER_RESIDUE_ID); }
  get edge() {
    const edges = this.inventory.snapshot.items.filter(item => item.definitionId === 'basalt-edge' && !item.explorerId);
    return edges.find(item => item.equipped) ?? edges[0];
  }
  get equipped(): boolean { return !!this.edge?.equipped; }
  /** What the worn loadout buys in a fight. Strike drives damage, Ward max HP. */
  /** The worn loadout's fight numbers, with the Hunting level on top (the Keeper's character level; keeper-combat.ts). */
  get combat(): KeeperCombatStats { return keeperCombatStats(this.inventory.snapshot.totals, this.huntingLevel); }
  /** The Keeper's level: Hunting XP read on the Keeper curve (shared/skills/keeper-level.ts), never below the Hunting skill level. */
  get huntingLevel(): number { return this.keeperView.level; }
  private get keeperView() { return keeperLevelView(skillXp(this.activity.snapshot.progress, 'hunting')); }
  /** The Keeper as gear requirements read them: the Hunting level and the points spent on each attribute. */
  get standing(): KeeperStanding { return { level: this.huntingLevel, stats: this.looks.look.stats }; }
  /** The HUD portrait (top-down): the Keeper's own face, from the engine's sprite; '' until the world is up. */
  get tdPortrait(): string { return this.topDown ? (this.engine as unknown as { heroPortrait?: () => string } | undefined)?.heroPortrait?.() ?? '' : ''; }
  /** The resource strip's icons: the materials' own art. */
  get oreArt(): string { return materialDisplay(CINDER_ORE_ID)?.art ?? ''; }
  get emberArt(): string { return materialDisplay(EMBER_RESIDUE_ID)?.art ?? ''; }
  get remaining(): number { return Math.ceil(this.activity.recoveryRemainingMs(this.now) / 1000); }
  get objective(): string {
    if (this.state.areaId === 'homestead') return this.t('play.hud.obj.homestead');
    if (this.state.delve) return this.t('play.delve.objective');
    if (this.state.area === 'Ember Quarry') return this.t('play.hud.obj.quarry');
    if (this.restored) return this.t('play.hud.obj.passage');
    if (this.state?.enemyDefeated) return this.t('play.hud.obj.beacon');
    if (this.equipped) return this.t('play.hud.obj.maw');
    if (this.edge) return this.t('play.hud.obj.equip');
    if (this.ore >= 6 && this.ember >= 1) return this.t('play.hud.obj.forge');
    return this.t('play.hud.obj.mine');
  }
  get actionLabel(): string {
    // One World: a Waystone (hold to light, or travel); a keeper at the fire or asleep (the station still opens).
    if (this.state?.nearby === 'stone' && this.state.stone) return this.t(this.state.stone.lit ? 'play.world.stone.travel' : this.state.stone.charge > 0 ? 'play.world.stone.lighting' : 'play.world.stone.light');
    if (this.state?.keeperAway === 'bell') return this.t('play.world.keeper.bell');
    if (this.state?.keeperAway === 'hearth' && this.state.nearbyKind === 'panel') {
      const keeper = (TOWN_KEEPERS[this.town.realm] ?? []).find(k => k.station === this.state.nearby);
      if (keeper) { const named = this.t(keeper.nameKey); return this.t('play.world.keeper.hearth', { name: named === keeper.nameKey ? keeper.name : named }); }
    }
    if (this.state?.nearby === 'hs-forge') return this.t('play.hud.act.strikeForge');
    // The Cold Hearth (shared/hearth): a hearth to light (or warm the hands at: it is the wake point), a capital's shrine.
    if (this.state?.nearby?.startsWith('hearth:')) return this.t(this.hearth.state.wake === this.state.nearby ? 'play.coldHearth.act.warm' : this.hearth.state.lit.includes(this.state.nearby) ? 'play.coldHearth.act.again' : 'play.coldHearth.act.light');
    if (this.state?.nearby?.startsWith('shrine:')) return this.t('play.coldHearth.act.shrine');
    // A town task giver (shared/town-tasks).
    if (this.state?.nearby?.startsWith('giver-')) return this.t('play.task.talkTo', { name: titleCase(this.state.nearbyLabel ?? '') });
    if (this.state?.nearbyKind === 'panel' || this.state?.nearbyKind === 'waystone') return this.t('play.hud.act.enter', { name: titleCase(this.state.nearbyLabel ?? 'place') });
    const gather = this.state?.nearby === 'gather' ? this.state.gather : undefined;
    if (gather) {
      if (gather.shut) return this.t('clock.gather.shutAct', { name: gather.label });
      if (!gather.ready) return this.t('play.gather.regrowing', { name: gather.label, n: gather.seconds });
      if (gather.need) return this.t('play.gather.needs', { name: gather.label, need: gather.need });
      return this.t('play.gather.work', { name: materialDisplay(gather.materialId)?.name ?? gather.label });
    }
    if (this.state?.nearby === 'cabinet') return this.t(this.state.cabinet?.open ? 'cabinet.act.empty' : 'cabinet.act.open');
    if (this.state?.nearby === 'machine' && this.state.machine) return this.t('machine.act', { name: this.t(`machine.title.${this.state.machine.id}`) });
    const height = this.state?.nearby === 'height' ? this.state.height : undefined;
    if (height) {
      if (height.kind === 'cache') return this.t(height.found ? 'play.height.act.cacheOpened' : 'play.height.act.cache');
      if (height.kind === 'summit') return this.t(height.found ? 'play.height.act.summitDone' : 'play.height.act.summit');
      return this.t(height.kind === 'carving' ? 'play.height.act.carving' : 'play.height.act.lookout');
    }
    switch (this.state?.nearby) {
      case 'ore': return this.remaining ? this.t('play.hud.act.seamRecovering', { n: this.remaining }) : this.t('play.hud.act.mine');
      case 'forge': return this.t(this.equipped ? 'play.hud.act.bladeEquipped' : this.edge ? 'play.hud.act.equipEdge' : 'play.hud.act.forgeEdge');
      case 'beacon': return this.t(this.restored ? 'play.hud.act.beaconRestored' : 'play.hud.act.restoreBeacon');
      case 'inscription': return this.t('play.delve.action.inscription');
      case 'chest': return this.t('play.delve.action.chest');
      case 'camp': return this.t('play.delve.action.camp');
      case 'shrine': return this.t('play.delve.action.shrine');
      case 'mark': return this.t('play.uh.action.mark');
      case 'anchor': return this.t('play.uh.action.anchor');
      case 'furnace': return this.t('play.uh.action.furnace');
      case 'rail': return this.t('play.uh.action.rail');
      case 'gate': return this.t('play.rift.action.gate');
      case 'brazier': return this.t('play.rift.action.brazier');
      case 'mirror': return this.t('play.rift.action.mirror');
      case 'ring': return this.t('play.rift.action.ring');
      case 'delve': return this.campReady ? this.t('play.delve.action.enterTop') : this.t('play.delve.action.enter');
      case 'passage': return this.t(this.state.area === 'Ember Quarry' ? 'play.hud.act.returnSeamworks' : 'play.hud.act.enterQuarry');
      default: return this.t('play.hud.act.walkCloser');
    }
  }
  get actionDisabled(): boolean {
    if (this.state?.nearby === 'gather' && (!this.state.gather?.ready || !!this.state.gather?.need || !!this.state.gather?.shut)) return true;
    if (this.state?.nearby === 'height' && this.state.height?.kind === 'cache' && this.state.height.found) return true;
    return !this.state?.nearby || !!this.state.paused || !!this.state.defeated || (this.state.nearby === 'ore' && this.remaining > 0);
  }
  interact(): void { this.engine?.interact(); }
  returnToCamp(): void { this.message = ''; this.engine?.returnToCamp(); }
  restartHunt(): void { this.message = ''; this.engine?.restartHunt(); }
  retry(): void { this.returnToCamp(); }
  input(event: PointerEvent, input: EngineInput, down: boolean): void {
    event.preventDefault();
    // Capture keeps the hold when the finger slides off; a pointer the browser no longer tracks cannot be captured, and the press still counts.
    if (down) try { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); } catch { /* not capturable */ }
    this.engine?.setInput(input, down);
  }
  /**
   * A long press on the world or a control is a game gesture (owner,
   * 2026-10-15): no context menu, no text selection, anywhere in the game.
   * Typed fields and the Hearth's chat log keep both (styles.css exempts the
   * same set from user-select).
   */
  @HostListener('contextmenu', ['$event'])
  @HostListener('selectstart', ['$event'])
  onHoldGesture(event: Event): void {
    // selectstart can target a text node: ask its element.
    const node = event.target as Node | null;
    const target = node && node.nodeType === 1 ? node as Element : node?.parentElement ?? null;
    if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-selectable]')) return;
    event.preventDefault();
  }
  @HostListener('window:keydown', ['$event'])
  onBagKey(event: KeyboardEvent): void {
    if (!this.browser || event.repeat) return;
    // A story card owns the keyboard: Escape (or Enter on Continue) closes it.
    if (this.storyCard) {
      if (event.key === 'Escape') { event.preventDefault(); this.closeStoryCard(); }
      return;
    }
    // So does a scene.
    if (this.storyScene) {
      if (event.key === 'Escape') { event.preventDefault(); this.closeStoryScene(); }
      return;
    }
    // So does a talk with Glim.
    if (this.glimTalk) {
      if (event.key === 'Escape') { event.preventDefault(); this.closeGlimTalk(); }
      return;
    }
    // Glim's chat card: Escape closes it (the world keeps running underneath).
    if (this.companions.chatOpen && event.key === 'Escape') { event.preventDefault(); this.closeGlimChat(); return; }
    // An open place owns the keyboard. Escape closes it unless the page inside
    // already used the key (its own dialog, a reveal) — window is the last stop.
    if (this.panel) {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); this.closePanel(); }
      // P folds the Slate away again (never while a field inside it has the keyboard).
      else if (event.code === 'KeyP' && this.panel.kind === 'slate' && !event.defaultPrevented && !this.typing(event)) { event.preventDefault(); this.closePanel(); }
      return;
    }
    // The Slate (P) opens over the map too: the map folds first.
    if (event.code === 'KeyP' && this.slateTier > 0 && !this.typing(event)) { event.preventDefault(); this.openSlate(); return; }
    // The full map owns the keyboard while it is open: M or Escape folds it.
    if (this.map.open) {
      if (event.key === 'Escape' || event.code === 'KeyM') { event.preventDefault(); this.closeMap(); }
      return;
    }
    if (this.taskTalk) { if (event.key === 'Escape') { event.preventDefault(); this.closeTalk(); } return; }
    if (this.bestiaryOpen && event.key === 'Escape') { event.preventDefault(); this.closeBestiary(); return; }
    // The settings and pet sheets fold on Escape too, wherever the focus is (their own handlers need it inside them).
    if (this.soundOpen && event.key === 'Escape') { event.preventDefault(); this.soundOpen = false; this.focusWorld(); return; }
    if (this.petsOpen && event.key === 'Escape') { event.preventDefault(); this.closePets(); return; }
    if (this.placesOpen && event.key === 'Escape') { event.preventDefault(); this.closePlaces(); return; }
    // Escape inside the open Hearth folds it and hands focus back to the pill.
    if (this.hearthOpen && event.key === 'Escape' && (event.target as HTMLElement | null)?.closest?.('.dock')) {
      event.preventDefault(); this.toggleHearth(); return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return;
    if (event.code === 'KeyI') { event.preventDefault(); this.toggleBag(); }
    else if (event.code === 'KeyB' && this.topDown) { event.preventDefault(); this.toggleBestiary(); }
    else if (event.code === 'KeyK' && this.topDown) { event.preventDefault(); this.spellbookOpen = !this.spellbookOpen; this.sheetOpen = false; }
    else if (event.code === 'KeyC' && this.topDown) { event.preventDefault(); this.sheetOpen = !this.sheetOpen; this.spellbookOpen = false; }
    // The potion belt: Q drinks the best Health potion held, R the best Mana potion (shared/potions).
    else if ((event.code === 'KeyQ' || event.code === 'KeyR') && this.topDown && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); this.drinkPotion(event.code === 'KeyQ' ? 'health' : 'mana');
    }
    // The belt's Spellstone slot (shared/spellstones): F casts the slotted stone.
    else if (event.code === 'KeyF' && this.topDown && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); this.useStone(); }
    else if (event.code === 'KeyC' && this.campReady) { event.preventDefault(); this.descendToCamp(); }
    // One World: M is the Travel map (the world's map with its stones); it opens the full map from there.
    else if (event.code === 'KeyM' && this.topDown) { event.preventDefault(); this.togglePlaces(); }
    else if (event.code === 'KeyM' && this.oneWorld && this.state.world) { event.preventDefault(); this.openTravelMap(null); }
    else if (event.code === 'KeyM' && this.state.delve) { event.preventDefault(); this.openMap(); }
    else if (this.state.delve && /^Digit[0-9]$/.test(event.code)) {
      // Keys 1-9, then 0 for the tenth slot.
      const slot = this.hotbar[(Number(event.code.slice(5)) + 9) % 10];
      if (slot) { event.preventDefault(); this.choosePlaceable(slot.id); }
    }
    else if (this.state.delve && (event.code === 'Minus' || event.code === 'Equal')) {
      const slot = this.hotbar.find(row => row.key === (event.code === 'Minus' ? '-' : '='));
      if (slot) { event.preventDefault(); this.choosePlaceable(slot.id); }
    }
    else if (event.code === 'Escape' && this.bagOpen) { event.preventDefault(); this.closeBag(); }
  }
  // ── The world clock (docs/handoff/world-clock.md) ──

  /**
   * Once a world minute (one real second): read the world clock, hand the sky to
   * the engine (it rebuilds its tint only when the light visibly moved), mark the
   * canvas, and say what the hour brings: night falling, dawn, an eclipse coming,
   * starting and ending. While an eclipse is on and the world is open, Sera
   * Quill's ledger writes it down (once per eclipse; receipt first).
   */
  private tickClock(): void {
    if (!this.browser) return;
    const ms = this.clock.now();
    const second = Math.floor(ms / 1000);
    if (second === this.clockSecond) return;
    const first = this.clockSecond < 0;
    this.clockSecond = second;
    const time = this.clock.time(ms);
    const sky = this.clock.sky(ms);
    const eclipse = this.clock.eclipse(ms);
    const was = this.skyNow;
    this.skyNow = sky;
    this.skyPhase = sky.phase;
    this.skyClock = clockText(time.minute);
    this.eclipseWarn = eclipseWarning(ms);
    this.engine?.setSky({ ...sky, alignedHunt: eclipse ? REALM_HUNT[eclipse.realm] ?? null : null });
    const el = this.canvas?.nativeElement;
    if (el) {
      el.setAttribute('data-sky', sky.phase);
      el.setAttribute('data-world-time', clockText(time.minute));
      el.setAttribute('data-world-day', String(time.day));
    }
    if (first || !this.engine) return;
    // Announcements: on the message line, once each (a reload does not re-announce a sky already up).
    const say = (id: string, key: string, vars?: Record<string, string | number>) => {
      if (this.clockTold.has(id)) return;
      this.clockTold.add(id);
      this.message = this.t(key, vars);
    };
    if (eclipse) {
      if (!was?.eclipseOn) {
        say(`eclipse:${eclipse.id}:start`, 'clock.announce.start');
        if (this.glimVoice.met) this.glimVoice.bond({ id: `clock.eclipse.${eclipse.id}`, key: 'clock.glim.eclipse' });
      }
      this.witnessEclipse(eclipse.id);
    } else {
      if (was?.eclipseOn) say(`eclipse:${time.day}:end`, 'clock.announce.end');
      const next = this.clock.nextEclipse(ms);
      const hours = worldSpan(ms, next.startMs).h;
      const realm = this.t(`clock.realm.${next.realm}`);
      if (hours < 1) say(`eclipse:${next.id}:near`, 'clock.announce.near');
      else if (hours < 12) say(`eclipse:${next.id}:soon`, 'clock.announce.soon', { h: hours + 1, realm });
      if (was && !was.night && sky.night) {
        say(`night:${time.day}`, 'clock.announce.night');
        if (this.glimVoice.met) this.glimVoice.bond({ id: `clock.night.${time.day}`, key: 'clock.glim.night' });
      }
      if (was && was.phase === 'night' && sky.phase === 'dawn') say(`dawn:${time.day}`, 'clock.announce.dawn');
    }
  }
  /** Sera Quill's ledger: this eclipse, written down once while the world is open (the service keeps the receipt). */
  private witnessEclipse(id: number): void {
    if (this.eclipses.seen(id)) return;
    const got = this.eclipses.witness({ id });
    if (!got) return;
    let line = this.t('clock.announce.witnessed', { n: got.count, gold: got.gold.toLocaleString('en-US') });
    for (const mark of got.marks) {
      line += ` ${this.t('clock.announce.mark', { at: mark.at, gold: mark.gold.toLocaleString('en-US'), glass: mark.glass })}`;
      if (mark.glass) this.gotItem(mark.glass, materialDisplay(ECLIPSE_GLASS_ID)?.name ?? 'Eclipse Glass', ECLIPSE_GLASS_ID);
    }
    this.message = line;
  }
  // ── The Mirror Slate ──
  /** The HUD tick: which pane is held. (The Homestead's "something waiting" badge left with the forge's income.) */
  private tickSlate(): void {
    this.slateTier = this.slate.tier();
    this.pushMachines();
  }
  // ── The realm machines (docs/handoff/eclipse-cascade.md): always standing; the ledger says which are found ──
  private pushMachines(): void {
    if (!this.engine) return;
    const marks: MachineMark[] = BUILT_REALM_MACHINES.map(m => ({ id: m.id, area: m.area, ...machinePoint(m, FLOOR), found: this.gamesLedger.found(m.id) }));
    const key = marks.map(m => `${m.id}${m.found ? '!' : ''}`).join(',');
    if (key === this.machineMarksKey) return;
    this.machineMarksKey = key;
    this.engine.setMachines(marks);
  }
  /**
   * E at a realm machine: the first time the games ledger notes it found (once,
   * merge-safe) and it installs as a Mirror Slate app; every time, it opens in
   * the place panel (playable with or without a Slate).
   */
  private machineUsed(event: MachineEvent): void {
    if (!this.browser || this.panel) return;
    this.gamesLedger.init();
    if (this.gamesLedger.markFound(event.id)) {
      this.message = `${this.t(`machine.found.${event.id}`)} ${this.t(this.slateTier > 0 ? 'machine.found.slate' : 'machine.found.noSlate')}`;
      this.sound.sfx('cabinet');
      this.engine?.keeperFeel('happy', 1.4);
      this.pushMachines();
    }
    const machine = event.id;
    this.showPanel({ kind: 'page', stationId: machine, title: this.t(`machine.title.${machine}`), kicker: this.t('machine.kicker'), own: true });
    this.loadPanel({ load: () => import('../shared/cascade/cascade.component').then(m => m.CascadeComponent) }, this.panelInjector,
      ref => ref.setInput('machine', machine));
  }
  /** A key typed into a field is the field's, not the world's. */
  private typing(event: KeyboardEvent): boolean {
    const target = event.target;
    return target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);
  }
  /** The HUD button: open the Slate, or fold it when it is the place on screen. */
  toggleSlate(): void {
    if (this.panel?.kind === 'slate') { this.closePanel(); return; }
    this.openSlate();
  }
  /**
   * Open the Slate as a place: the world pauses (showPanel), focus moves into it,
   * Escape or P folds it. Never mid-fight, never on a fallen Keeper, never during
   * a mini-game (slate.model slateRefusal); the reason goes to the message line.
   */
  openSlate(): void {
    if (!this.browser || this.panel || this.storyCard || this.storyScene) return;
    this.tickSlate();
    const refusal = slateRefusal({
      tier: this.slateTier, defeated: !!this.state.defeated, enemyHp: this.state.enemyHp,
      fishing: !!this.state.fishing, reeling: !!this.reel, storyCard: !!this.storyCard || !!this.storyScene,
    });
    if (refusal) {
      if (refusal !== 'unowned') this.message = this.t(`slate.refuse.${refusal}`);
      return;
    }
    if (this.map.open) this.closeMap();
    this.placesOpen = false;
    this.showPanel({ kind: 'slate', stationId: 'slate', title: this.t('slate.title'), kicker: this.t(this.slateTier >= 2 ? 'slate.kicker2' : 'slate.kicker'), own: true });
    this.loadPanel({ load: () => import('../shared/slate/slate.component').then(m => m.SlateComponent) }, this.panelInjector);
  }
  // ── The Lost Cabinets: the Slate's Scan (docs/handoff/lost-cabinets.md) ──
  /** The glass went up or down (the Slate's Scan face, or the Slate lost). */
  private scanChanged(on: boolean): void {
    const was = this.scanning;
    this.scanning = on;
    if (on && !was) {
      if (this.panel?.kind === 'slate') this.closePanel();
      this.message = this.t('cabinet.hud.up');
      this.scanPulseAt = 0;
      this.curatorsEye();
    } else if (!on && was) {
      this.message = this.t('cabinet.hud.awayLine');
      this.scanWarmth = 'none'; this.scanPeriod = 0;
    }
    this.tickScan();
  }
  /** The Curator's Eye (twelve curios): Glim says which way the nearest cabinet the glass can hear lies. */
  private curatorsEye(): void {
    if (!this.cabinets.bonus('curators-eye') || !this.glimVoice.met) return;
    const dir = eyeDirection(this.state.areaId ?? '', { x: this.state.x, y: this.state.y }, this.cabinets.openedSet());
    this.glimVoice.bond({ id: 'cabinet.eye', key: dir ? 'cabinet.glim.eye' : 'cabinet.glim.eyeNone', ...(dir ? { vars: { dir: this.t(`cabinet.dir.${dir}`) } } : {}) });
  }
  /**
   * The Scan's tick (5 a second, on the HUD timer): read the glass at the
   * Keeper's feet, show a cabinet once it is close, ping as it warms, brighten
   * Glim on a warm glass, and hand the engine what to draw.
   */
  private tickScan(): void {
    if (!this.browser || !this.engine) return;
    if (this.scanning && this.slateTier <= 0) { this.cabinets.setScanning(false); return; }
    const opened = this.cabinets.openedSet();
    let reading: ScanReading = { warmth: 'none', id: null, distance: Infinity };
    if (this.scanning) {
      const at = { x: this.state.x, y: this.state.y };
      reading = scanReading(this.state.areaId ?? '', at, opened, this.cabinets.bonus('warm-glass'));
      // The Curator's Loupe: rift shrines no lantern has touched warm the glass too (never past hot: a shrine is not a cabinet).
      if (this.state.delve && this.cabinets.loupe()) {
        const shrine = this.engine.rareNear(['rift-shrine'], 64), keeper = this.engine.keeperCell();
        if (shrine && keeper) {
          const d = Math.abs(shrine.col + shrine.w / 2 - keeper.col) * 32;
          if (d < reading.distance) {
            const w = warmthAt(d, SCAN.delveRange, 0);
            reading = { warmth: w === 'burning' ? 'hot' : w, id: null, distance: d };
          }
        }
      }
      if (reading.warmth === 'burning' && reading.id && !this.shownCabinets.has(reading.id)) {
        this.shownCabinets.add(reading.id);
        this.message = this.t('cabinet.hud.shown');
      }
      this.cabinets.setReading(reading);
      const pulse = PULSE[reading.warmth], now = Date.now();
      if (pulse.period && !this.state.paused && now - this.scanPulseAt >= pulse.period * 1000) {
        this.scanPulseAt = now;
        this.sound.sfx('scan', { pitch: pulse.pitch });
      }
      // Glim's rare-find hook: on a warm glass Glim brightens; once it can notice rare finds, it says so (once a cabinet).
      if (reading.id && (reading.warmth === 'warm' || reading.warmth === 'hot') && this.glimVoice.met && hasAbility(this.glim.stage, 'notice') && !this.glimToldCabinet.has(reading.id)) {
        this.glimToldCabinet.add(reading.id);
        this.glimVoice.bond({ id: `cabinet.${reading.id}`, key: 'cabinet.glim.warm' });
      }
    }
    this.scanWarmth = reading.warmth;
    this.scanPeriod = PULSE[reading.warmth].period;
    const bright = this.scanning && (reading.warmth === 'warm' || reading.warmth === 'hot' || reading.warmth === 'burning');
    if (bright !== this.cabinetBright) { this.cabinetBright = bright; this.engine.setGlimBright(this.bondBright || bright); }
    this.pushCabinets(opened);
  }
  /** What the engine draws and reaches: the cabinets the glass has shown, and every one already open. */
  private pushCabinets(opened: ReadonlySet<string>): void {
    if (!this.engine) return;
    const marks: CabinetMark[] = CABINETS.filter(c => opened.has(c.id) || this.shownCabinets.has(c.id))
      .map(c => ({ id: c.id, area: c.area, x: c.x, y: c.y, open: opened.has(c.id), delve: c.delve }));
    const key = marks.map(m => `${m.id}${m.open ? '!' : ''}`).join(',');
    if (key === this.cabinetMarksKey) return;
    this.cabinetMarksKey = key;
    this.engine.setCabinets(marks);
  }
  /**
   * E at a shown cabinet: the first open grants once (CabinetsService writes
   * the receipt first); an open one only says it is empty.
   */
  private cabinetUsed(event: CabinetEvent): void {
    if (!this.browser) return;
    if (event.open) { this.message = this.t('cabinet.empty'); return; }
    const got = this.cabinets.open(event.id);
    if (!got) return;
    const name = this.t(`cabinet.item.${got.curio}`);
    const lines = [this.t('cabinet.toast.open', { curio: name, gold: got.gold.toLocaleString('en-US') })];
    if (got.extras.length) lines.push(this.t('cabinet.toast.extras', { items: got.extras.map(e => `${e.qty} ${this.t(`cabinet.item.${e.id}`)}`).join(', ') }));
    if (got.clueFor) lines.push(this.t('cabinet.toast.clue', { place: this.t(`cabinet.place.${got.clueFor}`) }));
    if (got.bonus) lines.push(this.t('cabinet.toast.bonus', { n: got.opened, total: CABINETS.length, name: this.t(`cabinet.bonus.${got.bonus}`) }));
    if (got.final) lines.push(this.t('cabinet.toast.final', { gold: got.final.gold.toLocaleString('en-US') }));
    this.message = lines.join(' ');
    this.sound.sfx('cabinet');
    this.engine?.keeperFeel('happy', 1.4);
    this.gotItem(1, name, got.curio);
    for (const e of got.extras) this.gotItem(e.qty, this.t(`cabinet.item.${e.id}`), e.id);
    if (got.final) this.gotItem(1, this.t(`cabinet.item.${got.final.item}`), got.final.item);
    this.pushCabinets(this.cabinets.openedSet());
  }
  /** Lune's counter rides her own panels; Kael's rides the Rune Forge (the stations themselves are untouched). */

  get slateCounter(): 'croupier' | 'kael' | null {
    const id = this.panel?.kind === 'page' ? this.panel.stationId : null;
    if (!id) return null;
    if (CROUPIER_STATIONS.includes(id)) return 'croupier';
    return id === KAEL_STATION ? 'kael' : null;
  }

  // ── One World, Phase 1 (docs/design/one-world.md): the clock, the stones, travel, the resume point ──

  /**
   * The HUD tick (5 a second) with the gate on: the world clock's hour to the
   * engine (keeper routines, lit windows, the night), the keepers' head marks,
   * the Waystones' view, and a resume point every 10 s while the spot is safe.
   */
  private tickWorld(): void {
    if (!this.oneWorld || !this.engine) return;
    this.hour = worldHour(this.now);
    this.engine.setWorldHour(this.hour);
    this.tickMarks();
    this.waystones.refresh();
    const el = this.canvas?.nativeElement;
    if (el) {
      // Where each station of this area stands (x,y): the e2e's stationPoint(page, id) reads it.
      const stations = this.engine.places.map(s => `${s.id}@${Math.round(s.x)},${Math.round(s.y ?? 610)}`).join(';');
      if (el.getAttribute('data-stations') !== stations) el.setAttribute('data-stations', stations);
      const keepers = this.engine.settlementKeepers.map(k => `${k.id}@${k.x},${k.y}${k.upstairs ? ':up' : ''}${k.mark ? `:${k.mark}` : ''}`).join(';');
      if (el.getAttribute('data-keepers') !== keepers) el.setAttribute('data-keepers', keepers);
    }
    if (this.state.world && this.now - this.resumeAt >= 10_000 && this.engine.safeSpot && !this.state.paused) {
      this.resumeAt = this.now;
      this.delve.setResume({ world: this.state.world as 'ember', col: Math.floor(this.state.x / 32), row: Math.floor((this.state.y - 610) / 32), t: this.now });
    }
  }
  /** Log in where the Keeper last stood somewhere safe (One World §3.3), once per mount. */
  private resume(): void {
    this.resumed = true;
    if (this.route.snapshot.queryParamMap.get('at') || this.town !== INFERNAL_WORLD_TOWN) return;
    const at = this.delve.resumePoint();
    if (!at || at.world !== 'ember' || !this.engine) return;
    this.engine.placeAtPoint(at.col * 32 + 16, 610 + at.row * 32);
  }
  /** MapleStory head marks over the settlement's keepers: `!` an offer, `?` a hand-in (the Quest Board's states). */
  private tickMarks(): void {
    if (!this.engine) return;
    const marks: Record<string, '!' | '?'> = {};
    for (const keeper of TOWN_KEEPERS[this.town.realm] ?? []) {
      if (!keeper.npc) continue;
      const mark = headMark(this.quests.chains[keeper.npc], this.quests.missionsFor(keeper.npc));
      if (mark) marks[keeper.id] = mark;
    }
    const key = JSON.stringify(marks);
    if (key === this.marksKey) return;
    this.marksKey = key;
    this.engine.setKeeperMarks(marks);
  }

  /** What the Waystones read through this view (WaystoneService's host). */
  private readonly waystoneHost: WaystoneHost = {
    world: () => this.state.world ?? SideScrollerComponent.WORLD_OF_TOWN[this.town.id as RealmTownId] ?? null,
    stones: () => this.stoneList(),
    here: () => this.engine?.stoneHere ?? (this.state.nearby === 'waystone' ? `${SideScrollerComponent.WORLD_OF_TOWN[this.town.id as RealmTownId]}:town` : null),
    anchors: () => this.engine?.delveAnchors() ?? [],
    refusal: () => {
      const why = travelRefusal({
        defeated: !!this.state.defeated, fighting: (this.state.enemyHp ?? 0) > 0, fishing: !!this.state.fishing || !!this.reel,
        story: !!this.storyCard || !!this.storyScene,
      });
      return why ? `travelmap.refuse.${why}` : null;
    },
    prefetch: id => { const p = this.engine?.stonePoint(id); if (p) this.engine?.prefetchAt(p.col); },
    travelTo: id => this.stepToStone(id),
    recall: () => this.stepToStone('ember:town'),
  };
  /** Every stone the Travel map may list: the Ember world's own, the wild ones seen, and the trunk line's towns. */
  private stoneList(): Omit<WaystonePin, 'lit' | 'seen'>[] {
    const out: Omit<WaystonePin, 'lit' | 'seen'>[] = EMBER_STONES.map(s => ({ id: s.id, col: s.col, row: s.row, kind: s.kind, world: 'ember' }));
    const known = new Set([...this.waystones.state.seen, ...this.waystones.state.lit]);
    for (const id of known) {
      if (!id.startsWith('ember:ws:')) continue;
      const at = this.engine?.stonePoint(id);
      if (at) out.push({ id, col: at.col, row: at.row, kind: 'wild', world: 'ember' });
    }
    for (const realm of REALM_TOWN_IDS) {
      const world = SideScrollerComponent.WORLD_OF_TOWN[realm];
      if (realm !== 'infernal' && TOWNS[realm]) out.push({ id: `${world}:town`, col: 0, row: 0, kind: 'town', world });
    }
    return out;
  }
  /**
   * The step itself (after the channel): another realm's town stone travels the
   * trunk line to that town as it is today; an Ember stone steps into the
   * Ember world there (from a legacy area too). The panel closes at once.
   */
  private stepToStone(id: string): boolean {
    if (!this.engine) return false;
    if (this.panel) this.finishClose(true);
    const [world] = id.split(':');
    if (world !== 'ember') {
      const realm = (Object.keys(SideScrollerComponent.WORLD_OF_TOWN) as RealmTownId[]).find(r => SideScrollerComponent.WORLD_OF_TOWN[r] === world);
      if (!realm || !TOWNS[realm]) return false;
      this.travel(realm);
      return true;
    }
    if (this.town !== INFERNAL_WORLD_TOWN) { this.town = INFERNAL_WORLD_TOWN; this.engine.setTown(INFERNAL_WORLD_TOWN); this.writePlay({ town: 'infernal' }); }
    const ok = this.engine.travelToStone(id);
    if (ok) this.sound.sfx('portal');
    else this.message = this.t('travelmap.failed');
    return ok;
  }
  /** A Waystone seen (the save remembers), lit (receipt, then XP), or used (the Travel map). */
  private stoneEvent(event: StoneEvent): void {
    if (!this.oneWorld || !this.engine) return;
    if (event.action === 'seen') {
      const first = this.waystones.markSeen(event.id);
      // The first dark stone a Keeper meets: Glim says what it is, once.
      if (first && !this.toldStone && !this.waystones.litSet().has(event.id) && !event.id.endsWith(':town') && this.waystones.state.lit.length === 0) {
        this.toldStone = true;
        this.message = this.t('play.world.glim.firstStone');
      }
      this.engine.setStoneState(this.waystones.litSet(), this.waystones.seenSet());
      return;
    }
    if (event.action === 'light') {
      const lit = this.waystones.light(event.id, EMBER_DELVE_LOCATION);
      this.engine.setStoneState(this.waystones.litSet(), this.waystones.seenSet());
      this.sound.sfx('portal');
      if (!lit) return;
      const at = this.engine.stonePoint(event.id);
      if (at) this.engine.revealAroundStone(at.col, revealSectors(this.waystones.marks()));
      const lines = [lit.xp ? this.t('play.world.stone.lit', { n: lit.xp }) : this.t('play.world.stone.litAgain')];
      if (lit.mark) lines.push(this.t('play.world.stone.mark', { name: this.t(`travelmap.mark.${lit.mark}`) }));
      this.message = lines.join(' ');
      if (lit.xp) this.toastLoot(`+${lit.xp} XP`);
      return;
    }
    this.openTravelMap(null);
  }
  /** Open the Travel map (lazy) in the place panel. `stationId`: the town stone's deep link (`?at=waystone`). */
  openTravelMap(stationId: string | null): void {
    if (!this.browser || !this.oneWorld || this.storyCard || this.storyScene) return;
    if (this.map.open) this.closeMap();
    this.waystones.attach(this.waystoneHost);
    this.showPanel({ kind: 'page', stationId: stationId ?? 'travel', title: this.t('travelmap.title'), kicker: this.t('travelmap.kicker'), ...(stationId ? {} : { own: true as const }) });
    this.loadPanel({ load: () => import('./world-travel/travel-map.component').then(m => m.TravelMapComponent) }, this.panelInjector, ref => {
      const map = ref.instance as TravelMapComponent;
      map.source = () => this.engine?.mapSource() ?? null;
      map.closed.subscribe(() => { if (this.panel) this.closePanel(); });
      map.fullMap.subscribe(() => { this.finishClose(true); setTimeout(() => this.openMap()); });
    });
  }
  /** The prompt's stone button: a press starts lighting (hold), a release stops; a lit stone opens the map. */
  stonePress(event: PointerEvent, down: boolean): void {
    if (down && event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    this.engine?.setUseHeld(down);
    if (down) this.engine?.interact();
  }
  /** Menu → One World (preview): flip this device's gate and reload (the world is built once per page). */
  toggleOneWorld(): void {
    if (!this.browser) return;
    OneWorldFlag.set(!this.oneWorld);
    this.delve.flush();
    const url = new URL(window.location.href);
    url.searchParams.delete('oneworld');
    window.location.assign(url.toString());
  }

  // ── The Delve map ──
  /** The full map: the world holds still while it is open (nothing can reach the Keeper). */
  openMap(): void {
    if (!this.state.delve || this.panel) return;
    this.map.show();
    this.engine?.setPaused(true);
    // Drawn once it is laid out; the HUD tick keeps it current. Focus goes to its Close.
    setTimeout(() => {
      this.drawMaps();
      (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.map-close')?.focus({ preventScroll: true });
    });
  }
  closeMap(): void {
    if (!this.map.open) return;
    this.map.hide();
    if (!this.panel) this.engine?.setPaused(false);
    (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.map-mini-open, .map-toggle')?.focus({ preventScroll: true });
  }
  /** The minimap and the open full map, from the engine's explored cells (the HUD tick, 5 a second). */
  private drawMaps(): void {
    if (this.topDown) {
      const mini = (this.host.nativeElement as HTMLElement).querySelector<HTMLCanvasElement>('.td-mini canvas');
      if (mini) (this.engine as unknown as { drawMinimap?: (c: HTMLCanvasElement) => void } | undefined)?.drawMinimap?.(mini);
    }
    if (!this.state.delve) { if (this.map.open) this.closeMap(); return; }
    const host = this.host.nativeElement as HTMLElement;
    this.map.drawMini(host.querySelector<HTMLCanvasElement>('.map-mini canvas') ?? undefined);
    this.map.drawFull(host.querySelector<HTMLCanvasElement>('.map-full canvas') ?? undefined);
  }
  zoomMap(step: number): void { this.map.zoomBy(step); this.drawMaps(); }
  centreMap(): void { this.map.centre(); if (this.map.zoom < 0) this.map.zoomBy(1); this.drawMaps(); }
  /** What each mark on the map is. */
  readonly mapLegend = (['keeper', 'camp', 'chest', 'torch', 'inscription', 'shrine', 'anchor', 'mark', 'furnace', 'shaft'] as const)
    .map(kind => ({ key: `play.map.legend.${kind}`, color: MAP_MARKER_COLORS[kind] }))
    .concat([
      { key: 'play.map.legend.pin', color: PIN_COLORS.star },
      { key: 'play.map.legend.glim', color: GLIM_MARK_COLOR },
      { key: 'play.map.legend.compass', color: POINTER_COLOR },
    ]);
  /** The way line under the full map: to the tracked pin, Glim's mark, or the camp. */
  get mapHint(): string {
    const n = this.map.campPath;
    const goal = this.goalName();
    if (goal) return n <= 0 ? this.t('play.map.noWayTo', { name: goal }) : this.t('play.map.wayTo', { name: goal, n });
    return n < 0 ? this.t('play.map.noCamp') : n === 0 ? this.t('play.map.noWay') : this.t('play.map.toCamp', { n });
  }

  // ── Map v2: pins, waypoints, Glim's mark, the compass and the fragment ──

  /** What the maps draw: the engine's source plus the pins, the goal (tracked pin, else Glim's mark) and the compass. */
  private mapSourceV2(): MapSource | null {
    const source = this.engine?.mapSource() ?? null;
    if (!source) return null;
    const pins: MapPinView[] = this.pins.map(pin => ({
      id: pin.id, col: pin.col, row: pin.row, color: PIN_COLORS[pin.icon as PinIcon] ?? PIN_COLORS.star,
      selected: pin.id === this.selectedPinId, tracked: pin.id === this.trackedPinId,
    }));
    if (this.glimMark) pins.push({ id: 'glim', ...this.glimMark, color: GLIM_MARK_COLOR, glim: true });
    const tracked = this.trackedPin;
    return { ...source, pins, goal: tracked ? { col: tracked.col, row: tracked.row } : this.glimMark, pointer: this.compassAt, scent: this.petScentCells };
  }
  get trackedPin(): MapPin | null { return this.pins.find(pin => pin.id === this.trackedPinId) ?? null; }
  get selectedPin(): MapPin | null { return this.pins.find(pin => pin.id === this.selectedPinId) ?? null; }
  /** The name of what the way leads to, or null for the camp. */
  private goalName(): string | null {
    const tracked = this.trackedPin;
    if (tracked) return this.pinLabel(tracked);
    return this.glimMark ? this.t('play.map.glimMark') : null;
  }
  pinLabel(pin: MapPin): string { return pin.name || this.t(`play.map.pin.icon.${pin.icon}`); }
  pinColor(icon: string): string { return PIN_COLORS[icon as PinIcon] ?? PIN_COLORS.star; }
  /** Rift Map Fragments held (the full map offers a reading when there are any). */
  get fragments(): number { return this.browser ? this.inventory.stackOf(FRAGMENT_ID) : 0; }
  get compassHeld(): boolean { return this.browser && this.inventory.stackOf(COMPASS_ID) > 0; }

  /**
   * Map v2's tick (HUD, 5 a second; the scans once a second): the deepest
   * stratum reached and the structure stood in (bounties), the pins, Glim's
   * mark and the compass's target, and a bounty finished by walking (reach).
   */
  private tickDelveV2(): void {
    if (!this.browser || !this.engine) return;
    if (!this.state.delve) { this.pinning = false; this.lastStructure = ''; this.bondBright = false; this.engine.setGlimBright(this.cabinetBright); return; }
    const at = this.engine.keeperCell();
    if (at) this.bounties.reached(stratumOfRow(at.row));
    const here = this.engine.structureHere();
    if (here && here.id !== this.lastStructure) {
      this.bountyEvent({ kind: 'structure', structure: here.kind, token: here.id });
      // A room found together: a bond moment (each structure once; the first of each kind counts more).
      this.bondMoments([siteMoment(here.id), `kind:${here.kind}`]);
    }
    this.lastStructure = here?.id ?? '';
    const now = Date.now();
    if (now - this.delveTickAt < 1000) return;
    this.delveTickAt = now;
    // Map pins belong to the Ember Delve's regions; a realm Delve shows none (and takes none, below).
    this.pins = this.engine.realm ? [] : this.delve.pins();
    if (this.selectedPinId && !this.selectedPin) this.selectedPinId = null;
    const read = this.delveLore.inscriptions();
    this.glimMarkMission = activeMark(this.glim.state.lastAt, now);
    this.glimMark = this.glimMarkMission ? this.engine.findMark(GLIM_MARKS[this.glimMarkMission] ?? [], id => read.has(id)) : null;
    this.compassAt = this.compassHeld ? this.engine.compassTarget(id => read.has(id)) : null;
    this.petScentCells = this.engine.petScent();
    this.tickBondAbilities(read);
    this.tickGates();
    const canvas = this.canvas?.nativeElement;
    if (canvas) {
      canvas.setAttribute('data-glim-mark', this.glimMark ? `${this.glimMark.col},${this.glimMark.row}` : '');
      canvas.setAttribute('data-compass', this.compassAt ? `${this.compassAt.col},${this.compassAt.row}` : '');
      canvas.setAttribute('data-pet-scent', String(this.petScentCells.length));
    }
    // A reach bounty finishes by walking: no event names it, the frontier does.
    for (const view of this.bounties.refresh()) if (view.ready) this.bountyDone(view.bounty);
  }
  /** Offer a Delve event to today's bounties; say so when one is done. */
  private bountyEvent(event: BountyEvent): void {
    for (const bounty of this.bounties.observe(event)) this.bountyDone(bounty);
  }
  private bountyDone(bounty: Bounty): void {
    if (this.toldReady.has(bounty.id)) return;
    this.toldReady.add(bounty.id);
    const line = bountyLine(bounty);
    const vars = typeof line.vars['stratum'] === 'string' ? { ...line.vars, stratum: this.t(line.vars['stratum']) } : line.vars;
    this.toastLoot(this.t('bounty.toast'));
    // After the engine's own line for the act that finished it ("Torch placed."), which would clear this one.
    const text = this.t('bounty.ready', { name: this.t(line.key, vars) });
    setTimeout(() => this.zone.run(() => { this.message = text; }), 250);
  }

  /** "Add pin": the next tap on the full map places one (or says the satchel of pins is full). */
  startPin(): void {
    if (!this.pinning && this.pins.length >= MAX_PINS) { this.message = this.t('play.map.pin.full', { n: MAX_PINS }); return; }
    this.pinning = !this.pinning;
    if (this.pinning) this.selectedPinId = null;
  }
  /** A tap on the full map: pick the pin there, else place one when armed. */
  mapTap(col: number, row: number): void {
    const hit = this.pins
      .filter(pin => Math.abs(pin.col - col) <= 1 && row >= pin.row - 3 && row <= pin.row + 1)
      .sort((a, b) => Math.abs(a.col - col) + Math.abs(a.row - row) - Math.abs(b.col - col) - Math.abs(b.row - row))[0];
    if (hit && !this.pinning) { this.selectPin(hit.id); return; }
    if (!this.pinning) return;
    if (this.engine?.realm) { this.pinning = false; return; }
    const rows = this.engine?.mapSource()?.t.rows ?? 56;
    const pin = { id: newPinId(), col, row: Math.max(0, Math.min(rows - 1, row)), icon: 'star', name: '' };
    this.pinning = false;
    if (!this.delve.setPin(pin)) { this.message = this.t('play.map.pin.full', { n: MAX_PINS }); return; }
    this.pins = this.delve.pins();
    this.selectPin(pin.id);
  }
  selectPin(id: string): void {
    this.selectedPinId = this.selectedPinId === id ? null : id;
    this.drawMaps();
  }
  /** Edit the selected pin: its icon, or its name (blank = the icon's word). */
  editPin(change: { icon?: string; name?: string }): void {
    const pin = this.selectedPin;
    if (!pin) return;
    const next = { id: pin.id, col: pin.col, row: pin.row, icon: change.icon ?? pin.icon, name: change.name !== undefined ? cleanPinName(change.name) : pin.name };
    if (next.icon === pin.icon && next.name === pin.name) return;
    if (this.delve.setPin(next)) this.pins = this.delve.pins();
    this.drawMaps();
  }
  /** Track the selected pin (the map draws its way; the minimap points at it), or stop. */
  trackPin(): void {
    const pin = this.selectedPin;
    if (!pin) return;
    this.trackedPinId = this.trackedPinId === pin.id ? null : pin.id;
    try { if (this.trackedPinId) localStorage.setItem(activeCharacterKey(TRACK_KEY, localStorage), this.trackedPinId); else localStorage.removeItem(activeCharacterKey(TRACK_KEY, localStorage)); } catch { /* this session */ }
    this.drawMaps();
  }
  removePin(): void {
    const pin = this.selectedPin;
    if (!pin) return;
    this.delve.removePin(pin.id);
    if (this.trackedPinId === pin.id) this.trackPin();
    this.pins = this.delve.pins();
    this.selectedPinId = null;
    this.drawMaps();
  }
  /** Read a Rift Map Fragment: the nearest unvisited structure joins the map (one fragment spent, keyed by it). */
  readFragment(): void {
    if (!this.engine || this.fragments < 1) return;
    const found = this.engine.readRiftMap(s => this.inventory.consumeStacks(`rift-map:${s.id}`, [{ id: FRAGMENT_ID, count: 1 }]).ok);
    this.message = found
      ? this.t('play.map.fragment.read', { kind: this.t(`play.map.structure.${found.kind}`) })
      : this.t('play.map.fragment.none');
    this.drawMaps();
  }
  openBag(): void { if (!this.bagOpen) this.toggleBag(); }
  closeBag(): void {
    if (!this.bagOpen) return;
    // Focus inside the book would fall to <body> when it unmounts: hand it to the clasp.
    const book = this.browser ? document.getElementById('satchel-book') : null;
    const inside = !!book && book.contains(document.activeElement);
    this.bagOpen = false;
    if (inside) setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.clasp')?.focus({ preventScroll: true }));
  }
  toggleBag(): void {
    this.bagOpen = !this.bagOpen;
    // Opens on the doll and the pockets alone: the card waits for a tap.
    if (this.bagOpen) this.pick = null;
    // The book needs the room an open Hearth takes: fold it, like a station
    // does (the remembered choice stands for next time).
    if (this.bagOpen) this.hearthOpen = false;
  }
  /** Tap a pocket for its card; tap it again to put the card away. */
  choosePocket(pocket: BagPocket, ev?: Event): void {
    this.pick = this.pickedPocket(pocket) ? null : { kind: pocket.kind, ref: pocket.ref };
    this.placePick(ev);
  }
  /** Tap worn gear for its card (Stow). An empty place has nothing to say, so it closes the card. */
  chooseWell(well: BagWell, ev?: Event): void {
    this.pick = !well.filled || this.pickedWell(well.id) ? null : { kind: 'slot', ref: well.id };
    this.placePick(ev);
  }
  /** Where a click pins the item card: beside the cell, kept on screen (it flips to the cell's left at the right edge). */
  pickAt = { x: 16, y: 80 };
  private placePick(ev?: Event): void {
    const el = ev?.currentTarget as HTMLElement | null;
    if (!el?.getBoundingClientRect || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect(), W = 264, H = 380;
    const x = r.right + 10 + W > window.innerWidth ? r.left - 10 - W : r.right + 10;
    this.pickAt = { x: Math.max(8, Math.min(x, window.innerWidth - W - 8)), y: Math.max(8, Math.min(r.top - 8, window.innerHeight - H)) };
  }
  unpick(): void { this.pick = null; }
  pickedPocket(pocket: BagPocket): boolean { return this.pick?.kind === pocket.kind && this.pick.ref === pocket.ref; }
  pickedWell(id: SlotId): boolean { return this.pick?.kind === 'slot' && this.pick.ref === id; }
  get pocketFill(): number {
    const { usedRows: used, satchelCap: cap } = this.inventory.snapshot;
    return used <= 0 || !Number.isFinite(cap) ? 0 : Math.min(100, (used / cap) * 100);
  }
  /** "23/40": the satchel's slots, on the clasp and in the book. */
  get bagCount(): string {
    const { usedRows: used, satchelCap: cap } = this.inventory.snapshot;
    return Number.isFinite(cap) ? `${used}/${cap}` : `${used}`;
  }
  /**
   * The satchel's free slots, drawn as empty cells after the pockets so the grid reads
   * as a fixed bag (Diablo II), not a list. Capped so an unbounded satchel draws none.
   */
  get emptyCells(): number[] {
    const { usedRows: used, satchelCap: cap } = this.inventory.snapshot;
    if (!Number.isFinite(cap) || this.shownTab !== 'all') return [];
    const free = Math.max(0, Math.min(60, cap) - Math.max(used, this.pockets.length));
    // Only what fits on this page: the empty cells fill the last page out to a full grid.
    const room = Math.max(0, this.bagPerPage - this.shownPockets.length + this.page() * this.bagPerPage);
    return Array.from({ length: Math.min(free, room) }, (_, i) => i);
  }
  get bagFull(): boolean {
    const { usedRows: used, satchelCap: cap } = this.inventory.snapshot;
    return used >= cap;
  }
  /** Send the picked satchel item to the Vault, from anywhere (inventory spec §5.1). */
  sendToVault(): void {
    const item = this.selectedGear();
    if (!item || item.equipped || item.explorerId) return;
    const ids = this.pickedGroup();
    if (ids.length > 1) {
      // A ×N cell: the whole group, in one write.
      const moved = this.inventory.stowMany(ids);
      this.message = moved.length
        ? this.t('play.hud.msg.sentVaultN', { n: moved.length, name: item.name })
        : this.t('play.hud.msg.stowFailed', { name: item.name });
      if (!moved.length) return;
      this.pick = null;
      return;
    }
    if (!this.inventory.stow(item.id)) { this.message = this.t('play.hud.msg.stowFailed', { name: item.name }); return; }
    const tab = this.inventory.itemById(item.id)?.explorerId?.replace(/^vault:/, '') ?? 'general-1';
    this.message = this.t('play.hud.msg.sentVault', { name: item.name, tab: this.t(`vault.tab.${tab}`) });
    this.pick = null;
  }
  /**
   * An arrival a full satchel turned away. The first of a burst names itself;
   * the rest within 4 s are summed on the same line, so a Delve dig with a full
   * satchel reads as one message, not a flicker.
   */
  private onRouted(routed: VaultRouted): void {
    const now = Date.now();
    const name = routed.kind === 'item' ? routed.name : (materialDisplay(routed.stackKey)?.name ?? routed.stackKey);
    const burst = this.routedBurst;
    if (now < burst.until && burst.first) {
      burst.more += 1;
      burst.until = now + 4000;
      this.message = `${burst.first} ${this.t('play.hud.msg.routedMore', { n: burst.more })}`;
      return;
    }
    const first = routed.tab === 'overflow'
      ? this.t('play.hud.msg.routedOverflow', { name })
      : this.t('play.hud.msg.routedVault', { name, tab: this.t(`vault.tab.${routed.tab}`) });
    this.routedBurst = { first, more: 0, until: now + 4000 };
    this.message = first;
    this.bump('.satchel .clasp');
  }
  get wells(): BagWell[] {
    const snap = this.inventory.snapshot;
    const charms = snap.items.some(item => item.type === 'charm' && !item.explorerId);
    const slots = charms ? [...BELT, ...CHARM_SLOT_IDS] : BELT;
    return slots.map(id => {
      const worn = snap.equipped[id];
      const item = worn && !worn.explorerId ? worn : undefined;
      const name = SLOT_BY_ID.get(id)?.name ?? id;
      return {
        id, name,
        art: item ? (itemArt(item)?.src ?? '') : '',
        mark: monogram(item?.name ?? name),
        label: item?.name ?? 'Empty',
        filled: !!item,
        ghost: ghostOf(id),
        tone: item ? lootColor(item.rarity) : null,
      };
    });
  }
  get pockets(): BagPocket[] {
    const snap = this.inventory.snapshot;
    const pin = [CINDER_ORE_ID, EMBER_RESIDUE_ID];
    const stacks = snap.stacks.filter(stack => snap.stackPlace[stack.stackKey] === 'satchel').sort((a, b) => {
      const ai = pin.indexOf(a.stackKey);
      const bi = pin.indexOf(b.stackKey);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return (materialDisplay(a.stackKey)?.name ?? a.stackKey).localeCompare(materialDisplay(b.stackKey)?.name ?? b.stackKey);
    });
    const materials: BagPocket[] = stacks.map(stack => {
      const display = materialDisplay(stack.stackKey);
      const name = display?.name ?? stack.stackKey;
      return { key: `stack:${stack.stackKey}`, kind: 'stack', ref: stack.stackKey, name, art: display?.art ?? '', qty: stack.quantity, pip: '#df9357', mark: monogram(name), ids: [], cat: 'mats' };
    });
    const gear: BagPocket[] = clusterBy(groupItems(snap.bag), group => familyOf(group.first)).map(({ first: item, ids }) => ({
      key: `item:${item.id}`, kind: 'item', ref: item.id, name: item.name,
      art: itemArt(item)?.src ?? '', qty: ids.length, pip: lootColor(item.rarity), mark: monogram(item.name), ids,
      cat: item.type === 'charm' ? 'charm' : 'gear',
    }));
    return [...materials, ...gear];
  }
  /** The tabs that have something in them (All always). */
  get bagTabs(): { id: BagTab; n: number; key: string }[] {
    const all = this.pockets;
    const tabs: { id: BagTab; n: number; key: string }[] = [{ id: 'all', n: all.length, key: BAG_TAB_KEYS.all }];
    for (const cat of ['gear', 'charm', 'mats'] as const) {
      const n = all.filter(p => p.cat === cat).length;
      if (n) tabs.push({ id: cat, n, key: BAG_TAB_KEYS[cat] });
    }
    return tabs;
  }
  /** The open tab's pockets; a tab that emptied falls back to All. */
  get shownPockets(): BagPocket[] {
    const all = this.pockets;
    const some = this.bagTab === 'all' ? all : all.filter(p => p.cat === this.bagTab);
    const list = this.bagTab === 'all' || some.length ? some : all;
    return list.slice(this.page() * this.bagPerPage, (this.page() + 1) * this.bagPerPage);
  }
  /** How many pages the open tab has. */
  get bagPages(): number {
    const all = this.pockets;
    const some = this.bagTab === 'all' ? all : all.filter(p => p.cat === this.bagTab);
    return Math.max(1, Math.ceil((this.bagTab === 'all' || some.length ? some : all).length / this.bagPerPage));
  }
  /** The page in range (a tab that emptied, or items sold, never leave it past the end). */
  page(): number { return Math.min(this.bagPage, this.bagPages - 1); }
  turnBag(by: number): void { this.bagPage = Math.max(0, Math.min(this.bagPages - 1, this.page() + by)); }
  get shownTab(): BagTab {
    return this.bagTab !== 'all' && this.pockets.some(p => p.cat === this.bagTab) ? this.bagTab : 'all';
  }
  /** The purse, on the satchel's bottom row. */
  get purseGold(): string { return Math.floor(this.economy.snapshot.gold).toLocaleString('en-US'); }
  /**
   * The hover card (owner 2026-10-20: "look at diablo 2, just stats and that's it"): pointing at a cell with a mouse
   * shows the item's name in its rarity colour, what it is, its stats and how it compares — no art, no buttons.
   */
  hoverTip: { row: BagSlip; x: number; y: number } | null = null;
  hoverPocket(pocket: BagPocket, ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse') return;
    const row = pocket.kind === 'stack' ? this.stackSlip(pocket.ref)
      : (() => { const item = this.inventory.snapshot.items.find(r => r.id === pocket.ref && !r.explorerId); return item ? this.itemSlip(item, item.equipped) : null; })();
    this.hoverTip = row ? { row, x: ev.clientX, y: ev.clientY } : null;
  }
  hoverWell(slot: string, ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse') return;
    const item = this.inventory.snapshot.equipped[slot as SlotId];
    this.hoverTip = item && !item.explorerId ? { row: this.itemSlip(item, true), x: ev.clientX, y: ev.clientY } : null;
  }
  moveTip(ev: PointerEvent): void { if (this.hoverTip) this.hoverTip = { ...this.hoverTip, x: ev.clientX, y: ev.clientY }; }
  get slip(): BagSlip | null {
    const pick = this.pick;
    if (!pick) return null;
    if (pick.kind === 'stack') return this.stackSlip(pick.ref);
    if (pick.kind === 'slot') {
      const item = this.inventory.snapshot.equipped[pick.ref as SlotId];
      if (!item || item.explorerId) return this.emptyWell(pick.ref as SlotId);
      return this.itemSlip(item, true);
    }
    const item = this.inventory.snapshot.items.find(row => row.id === pick.ref && !row.explorerId);
    if (!item) return null;
    const slip = this.itemSlip(item, item.equipped);
    const count = item.equipped ? 1 : this.pickedGroup().length;
    // A ×N cell says so, slots included: up to 20 identical pieces share one.
    const slots = slotsForGroup(count);
    const group = slots === 1 ? this.t('play.hud.book.group.one', { n: count }) : this.t('play.hud.book.group', { n: count, s: slots });
    return count > 1 ? { ...slip, count, kicker: `${slip.kicker} · ${group}` } : slip;
  }
  wear(): void {
    const item = this.selectedGear();
    if (!item || item.equipped) return;
    const blocked = this.wearBlockedReason(item);
    if (blocked) { this.message = blocked; return; }
    const ok = isBasaltEdge(item) ? this.inventory.equip(item.id, 'weapon') : this.inventory.equip(item.id);
    this.message = this.t(ok ? 'play.hud.msg.worn' : 'play.hud.msg.wearFailed', { name: item.name });
    if (!ok) return;
    this.sound.sfx('equip');
    this.sync();
    const slot = this.inventory.snapshot.items.find(row => row.id === item.id)?.slot;
    if (slot) this.pick = { kind: 'slot', ref: slot };
  }
  stow(): void {
    const item = this.selectedGear();
    if (!item) return;
    const ok = this.inventory.unequip(item.id);
    this.message = this.t(ok ? 'play.hud.msg.stowed' : 'play.hud.msg.stowFailed', { name: item.name });
    if (!ok) return;
    this.sync();
    this.pick = { kind: 'item', ref: item.id };
  }
  /** The ids of the picked satchel cell's group (one id for a one-of-a-kind item). */
  private pickedGroup(): string[] {
    const pick = this.pick;
    if (pick?.kind !== 'item') return [];
    return this.pockets.find(pocket => pocket.kind === 'item' && pocket.ref === pick.ref)?.ids ?? [pick.ref];
  }
  private selectedGear(): GameItem | null {
    const pick = this.pick;
    if (!pick || pick.kind === 'stack') return null;
    if (pick.kind === 'slot') {
      const worn = this.inventory.snapshot.equipped[pick.ref as SlotId];
      return worn && !worn.explorerId ? worn : null;
    }
    return this.inventory.snapshot.items.find(row => row.id === pick.ref && !row.explorerId) ?? null;
  }
  private stackSlip(stackKey: string): BagSlip | null {
    const stack = this.inventory.snapshot.stacks.find(row => row.stackKey === stackKey);
    if (!stack) return null;
    const display = materialDisplay(stackKey);
    const name = display?.name ?? stackKey;
    // A catch says what it is and what it is for (the Catalogue's lines); a Lodge charm, what it does.
    const fish = catchById(stackKey), charm = LODGE_CHARMS.find(c => c.id === stackKey);
    const potion = potionById(stackKey);
    if (potion) {
      const does = this.potionLine(potion.id);
      const key = potion.kind === 'rejuv' ? 'Q · R' : potion.kind === 'health' ? 'Q' : 'R';
      const kicker = this.t('play.potion.kicker');
      return {
        name, art: display?.art ?? '', mark: monogram(name), kicker,
        note: `${does} ${potion.lore}`,
        stats: [this.t('play.hud.slip.held', { n: stack.quantity })],
        canWear: false, canStow: false, compare: [], compareLabel: '',
        tip: {
          rarity: 'material', typeLine: kicker, rarityWord: '', head: null, affixes: [],
          specials: [does, this.t('play.potion.drinkKey', { key }), potion.lore],
          sockets: [], value: 0, bound: false, tempered: 0, itemLevel: 0, tag: null,
        },
      };
    }
    return {
      name, art: display?.art ?? '', mark: monogram(name), kicker: this.t('play.hud.slip.material'),
      note: fish ? `${fish.lore} ${fish.use}` : charm ? `${charm.lore} ${charm.effect}` : this.stackNote(stackKey, stack.quantity),
      stats: [this.t('play.hud.slip.held', { n: stack.quantity })],
      canWear: false, canStow: false, compare: [], compareLabel: '',
      tip: {
        rarity: 'material', typeLine: this.t('play.hud.slip.material'), rarityWord: '', head: null, affixes: [],
        specials: [fish ? `${fish.lore} ${fish.use}` : charm ? `${charm.lore} ${charm.effect}` : this.stackNote(stackKey, stack.quantity)],
        sockets: [], value: 0, bound: false, tempered: 0, itemLevel: 0, tag: null,
      },
    };
  }
  private stackNote(stackKey: string, qty: number): string {
    if (stackKey === CINDER_ORE_ID) {
      if (qty >= 6 && this.ember >= 1) return this.t('play.hud.slip.oreReady');
      if (qty >= 6) return this.t('play.hud.slip.oreSix');
      const more = 6 - qty;
      return more === 1 ? this.t('play.hud.slip.oreMoreOne') : this.t('play.hud.slip.oreMore', { n: more });
    }
    if (stackKey === EMBER_RESIDUE_ID) {
      return this.t(this.ore >= 6 ? 'play.hud.slip.emberReady' : 'play.hud.slip.emberNeeds');
    }
    return this.t('play.hud.slip.kept');
  }
  private emptyWell(slot: SlotId): BagSlip {
    const name = SLOT_BY_ID.get(slot)?.name ?? 'Place';
    return { name, art: '', mark: monogram(name), kicker: this.t('play.hud.book.worn'), note: this.t('play.hud.slip.emptyWell'), stats: [], canWear: false, canStow: false, compare: [], compareLabel: '' };
  }
  private itemSlip(item: GameItem, worn: boolean): BagSlip {
    const def = definitionFor(item);
    const stats = ITEM_STAT_KEYS.filter(key => (item.stats[key] ?? 0) !== 0).map(key => formatItemMod(key, item.stats[key]!));
    const level = item.upgradeLevel ?? 0;
    // A tool: its power, pace and what it opens, and the rule that it works from the satchel.
    const tool = toolCard(item.definitionId, this.activity.snapshot.progress);
    if (tool) {
      return {
        name: item.name, art: itemArt(item)?.src ?? '', mark: monogram(item.name),
        kicker: worn ? this.t('play.hud.book.worn') : rarityLabel(item.rarity),
        tone: lootColor(item.rarity),
        note: this.t('toolStat.fromSatchel'),
        stats: toolCardLines(tool, (key, vars) => this.t(key, vars)),
        canWear: false, canStow: worn, canSend: !worn, compare: [], compareLabel: '',
      };
    }
    return {
      name: level > 0 ? `${item.name} +${level}` : item.name,
      art: itemArt(item)?.src ?? '',
      mark: monogram(item.name),
      kicker: worn ? this.t('play.hud.book.worn') : rarityLabel(item.rarity),
      tone: lootColor(item.rarity),
      note: item.lore || def?.lore || this.t(worn ? 'play.hud.slip.wornBy' : 'play.hud.slip.inSatchel'),
      // A D2-style aura the piece carries (its Socket Word or its name; shared/loot/aura-sources.ts).
      stats: [...stats, ...itemAuras(item).map(a => this.t('loot.aura.carries', { aura: this.t('loot.aura.' + a.aura), level: a.level }))],
      tip: this.itemTip(item, level),
      canWear: !worn && EQUIPMENT_SLOTS.some(slot => itemFitsSlot(slot.id, item)),
      ...(worn ? {} : { wearBlocked: this.wearBlockedReason(item) ?? undefined }),
      canStow: worn,
      canSend: !worn,
      ...this.slipCompare(item, worn),
    };
  }
  /** The hover card's parts for a piece of gear: its frame, the stat it is for, the rest, its wells and worth. */
  private itemTip(item: GameItem, tempered: number): ItemTip {
    const slot = definitionFor(item)?.slot ?? item.slot;
    // An affix item (§3) heads with its slot's implicit; older items with the legacy Strike / Ward.
    const affixed = item.itemLevel != null && isAffixSlot(slot);
    const headKey = affixed ? IMPLICIT_BY_SLOT[slot] : slot === 'weapon' ? 'strikePower' : 'ward';
    const range = (key: keyof GameItem['stats']): string => {
      if (!affixed || !isAffixKey(key)) return '';
      const [lo, hi] = affixRange(key, slot, item.itemLevel!, item.rarity);
      return lo || hi ? `[${lo}–${hi}]` : '';
    };
    // What the piece pays when worn (its runes and a seated Socket Word in, as the worn totals count it), not the bare
    // roll: a Voidmark word's ×2.5 used to sit only in the totals. The roll's range shows only beside an unmoved roll;
    // a grave-good's gift and price have their own block (graveTip).
    const paid = effectiveStats(item, socketStats(item));
    // Strike and Ward are not fight stats: the card says what they do (td-melee weaponSwing; item-upgrade temperFailChance).
    const what = (key: keyof GameItem['stats']) => key === 'strikePower' || key === 'ward' ? ' ' + this.t('play.tip.what.' + key) : '';
    // A stat whose worn total the fight caps says so (td-skills GEAR_CAPS, the 75 resist cap, Gold Find's 150): the C
    // sheet shows the capped total, the card says where it stops.
    const cap = (key: keyof GameItem['stats']) => { const n = WORN_CAP[key]; return n ? ' ' + this.t('play.tip.cap', { n }) : ''; };
    const line = (key: keyof GameItem['stats']) => ({ key, text: `${formatStatValue(key, paid[key]!)} ${ITEM_STAT_LABELS[key]}${what(key)}${cap(key)}`, range: paid[key] === item.stats[key] ? range(key) : '' });
    const held = ITEM_STAT_KEYS.filter(key => (paid[key] ?? 0) !== 0);
    const head = held.includes(headKey) ? line(headKey) : null;
    const wells = socketCountFor(item);
    const sockets = Array.from({ length: wells }, (_, i) => item.sockets?.[i] ?? null).map(id => (id ? materialDisplay(id)?.name ?? id : null));
    return {
      rarity: item.rarity,
      typeLine: item.type === 'charm' ? this.t('play.tip.charm') : (slot ? SLOT_BY_ID.get(slot)?.name ?? '' : ''),
      rarityWord: rarityLabel(item.rarity),
      head,
      affixes: held.filter(key => key !== head?.key).map(line),
      itemLevel: item.itemLevel ?? 0,
      tag: qualityTagOf(item),
      specials: [
        ...itemAuras(item).map(a => this.t('loot.aura.carries', { aura: this.t('loot.aura.' + a.aura), level: a.level })),
        ...(bossUniqueById(item.definitionId) ? this.relicLines(bossUniqueById(item.definitionId)!) : this.uniqueLines(uniqueById(item.definitionId))),
      ],
      sockets, value: item.soulbound ? 0 : Math.floor(item.sellValue), bound: item.soulbound, tempered,
      reqs: this.reqLines(item),
      set: this.setTip(item),
      ...this.graveTip(item),
    };
  }
  /** The card's requirement lines; a level of 1 with no attribute says nothing. */
  private reqLines(item: GameItem): { text: string; met: boolean }[] {
    const req = itemRequirements(item);
    const miss = unmetRequirements(item, this.standing);
    const lines: { text: string; met: boolean }[] = [];
    if (req.level > 1) lines.push({ text: this.t('play.tip.reqLevel', { n: req.level }), met: !miss.level });
    if (req.attr) lines.push({ text: this.t('play.tip.reqAttr', { n: req.attr.n, attr: this.t('play.td.attr.' + req.attr.key) }), met: !miss.attr });
    return lines;
  }
  /** Why this piece cannot go on yet, in one line, or null when it can. */
  private wearBlockedReason(item: GameItem): string | null {
    const miss = unmetRequirements(item, this.standing);
    if (miss.level) return this.t('play.hud.msg.needLevel', { n: miss.level, name: item.name });
    if (miss.attr) return this.t('play.hud.msg.needAttr', { n: miss.attr.n, attr: this.t('play.td.attr.' + miss.attr.key), name: item.name });
    return null;
  }
  /**
   * The slot `wear()` would put this in — the same pick `InventoryService.equip`
   * makes unaimed (a free fitting place first, else the first fitting one), and
   * the weapon slot for the Edge — and the delta against what is there now.
   */
  private slipCompare(item: GameItem, worn: boolean): Pick<BagSlip, 'compare' | 'compareLabel'> {
    if (worn) return { compare: [], compareLabel: '' };
    const equipped = this.inventory.snapshot.equipped;
    const fits = (s: SlotId) => itemFitsSlot(s, item);
    const target: SlotId | undefined = isBasaltEdge(item) ? 'weapon'
      : SLOT_IDS.find(s => fits(s) && !equipped[s]) ?? SLOT_IDS.find(fits);
    if (!target || !fits(target)) return { compare: [], compareLabel: '' };
    const current = equipped[target];
    const there = current && !current.explorerId ? current : undefined;
    const place = SLOT_BY_ID.get(target)?.name ?? target;
    return {
      // As worn (runes, a Socket Word, a grave-good's gift and price): what equipping it really changes.
      compare: compareStats(wornStats(item), there ? wornStats(there) : null, { includeUnchanged: true }),
      compareLabel: there ? this.t('play.hud.slip.against', { name: there.name }) : this.t('play.hud.slip.againstEmpty', { place }),
    };
  }
  /**
   * Every Keeper holds a Worn Pickaxe, Axe and Sickle: a fresh save gets them,
   * and one that lost one gets it back. Fixed instance ids, so this can never
   * mint a second copy; skipped when the satchel has no room (never evicts).
   */
  private starterAsked = 0;
  private ensureStarterTools(): void {
    if (!this.browser) return;
    // Asked at most once a second (pushStats runs on a 200 ms tick), so a write that fails cannot spin.
    const now = Date.now();
    if (now - this.starterAsked < 1000) return;
    this.starterAsked = now;
    for (const family of STARTER_FAMILIES) {
      const id = starterInstanceId(family);
      if (this.inventory.itemById(id) || !this.inventory.canAcceptInstance()) continue;
      const item = mintEquipment(starterToolId(family), 'common', Math.random, new Date().toISOString(), id);
      if (item) this.inventory.add(item);
    }
  }
  private sync(): void {
    this.engine?.setProgress({ equipped: this.equipped, restored: this.restored });
    this.pushStats();
  }
  /**
   * The Underhearth (Phase 8): what the Keeper carries that the world uses
   * without placing it (a Seam Cart rides rails; a Thornroot Grapple is thrown
   * from the hotbar), and Kael's word on the Banked seal: once The Fracture is
   * claimed, the seal answers to a pick (the Delve save's `underhearth-unsealed`).
   */
  private pushUnderhearth(): void {
    if (!this.engine || !this.browser) return;
    const has = (id: string) => this.inventory.stackOf(id) > 0;
    const gear = `${has(SEAM_CART)}:${has(THORNROOT_GRAPPLE)}:${has(VEIL_LANTERN)}:${has(ROOTSEVER_BILLHOOK)}:${has(DAWN_LENS)}:${has(ORRERY_KEY)}`;
    if (gear !== this.gearKey) {
      this.gearKey = gear;
      this.engine.setGear({ cart: has(SEAM_CART), grapple: has(THORNROOT_GRAPPLE), veil: has(VEIL_LANTERN), shears: has(ROOTSEVER_BILLHOOK), lens: has(DAWN_LENS), key: has(ORRERY_KEY) });
    }
    if (!this.delve.isClaimed(UNSEALED_FLAG) && this.quests.isMissionDone('delve-fracture')) this.delve.claim(UNSEALED_FLAG);
  }
  private gearKey = '';
  /** Hand the engine the loadout's combat numbers when they change. */
  private pushStats(): void {
    if (!this.engine) return;
    this.ensureStarterTools();
    this.pushLoadout();
    this.refreshHotbar();
    // Tools come from the satchel (skills/tools.ts): the starter set, raised by
    // forged ones, which also swing faster. The lantern goes
    // in tiles (toolTiers' unit; the engine multiplies by its 32 px cell), so
    // each ten Delving levels light one more tile.
    const floor = provisionalToolTiers(this.inventory.snapshot);
    const progress = this.activity.snapshot.progress;
    // A tool stored in a Delve chest is not in hand.
    const snapshot = this.inventory.snapshot;
    const crafted = toolTiers({ ...snapshot, items: snapshot.items.filter(item => !isChestHolder(item.explorerId)) }, progress);
    const tools = {
      swing: { pickaxe: crafted.swing.pickaxe, axe: crafted.swing.axe, sickle: crafted.swing.sickle },
      // The wielding skill's level sharpens each tool (skills/tool-level.ts).
      power: { pickaxe: crafted.power.pickaxe, axe: crafted.power.axe, sickle: crafted.power.sickle, staff: crafted.power.staff },
      pickaxe: Math.max(floor.pickaxe ?? 0, crafted.pickaxe),
      axe: Math.max(floor.axe ?? 0, crafted.axe),
      sickle: Math.max(floor.sickle ?? 0, crafted.sickle),
      blade: Math.max(floor.blade ?? 0, crafted.blade),
      staff: Math.max(floor.staff ?? 0, crafted.staff),
    };
    // Levels by discipline: Delve cells and hunting-ground nodes with a
    // `minLevel` clang before the host is asked.
    const levels = {
      mining: miningLevelView(progress.xpByDiscipline.mining ?? 0).level,
      foraging: skillLevel(progress, 'foraging'),
      woodcutting: skillLevel(progress, 'woodcutting'),
      // Delving: the Banked seal holds below Delving 15 (the Underhearth's depth gate).
      exploration: skillLevel(progress, 'delving'),
    };
    const toolKey = `${JSON.stringify(tools)}:${JSON.stringify(levels)}:${crafted.lanternRadius}`;
    if (toolKey !== this.toolKey) {
      this.toolKey = toolKey;
      this.engine.setTools({ ...tools, lanternTiles: crafted.lanternRadius, levels });
      // The pickaxe's pace and power (tier × Mining level) on the canvas, for tests and tools (the HUD says it in words).
      this.canvas?.nativeElement.setAttribute('data-swing-pickaxe', crafted.swing.pickaxe.toFixed(2));
      this.canvas?.nativeElement.setAttribute('data-power-pickaxe', (crafted.pickaxe ? toolPower(crafted.pickaxe) * crafted.power.pickaxe : 0).toFixed(2));
    }
    this.pushFishing();
    this.pushHeldTools(snapshot.items.filter(item => !isChestHolder(item.explorerId)).map(item => item.definitionId), progress);
    this.pushUnderhearth();
    this.pushRules();
    const stats = this.combat;
    const key = `${stats.damage}:${stats.maxHp}`;
    if (key === this.statsKey) return;
    this.statsKey = key;
    this.pushed = stats;
    this.engine.setStats(stats);
  }
  /**
   * Per activity, the tool the Keeper takes in hand (held-tool.ts): the best
   * pickaxe, axe, sickle and rod held, each capped by its skill. The engine
   * shows it while the work lasts; the equipped weapon never leaves its slot.
   */
  private pushHeldTools(definitionIds: readonly (string | undefined)[], progress: DisciplineProgress): void {
    if (!this.engine || !this.browser) return;
    const pieces = heldToolPieces({
      definitionIds,
      levels: {
        mining: skillLevel(progress, 'mining'), woodcutting: skillLevel(progress, 'woodcutting'),
        foraging: skillLevel(progress, 'foraging'), fishing: this.fishing.level(),
      },
      hasRod: id => this.inventory.stackOf(id) > 0,
    });
    const key = heldToolsKey(pieces);
    if (key === this.heldToolsKey) return;
    this.heldToolsKey = key;
    this.engine.setHeldTools(pieces);
  }
  /** The engine took a tool in hand or put it away: a soft swap cue, and the canvas says which (tests). */
  private heldToolSwapped(tool: HeldToolKind | null): void {
    this.canvas?.nativeElement.setAttribute('data-keeper-held', tool ?? '');
    this.sound.sfx('swap');
  }
  /**
   * What the Keeper wears, for the engine to draw: the weapon and off-hand art
   * (the same `itemArt()` the satchel uses) and the highest worn rarity for the
   * aura. Visual only. Sent when it changes (checked on the HUD tick).
   */
  private pushLoadout(): void {
    if (!this.engine) return;
    this.pushKeeper();
    const loadout = this.loadout();
    const key = `${loadout.weapon?.art}:${loadout.weapon?.rarity}|${loadout.offhand?.art}:${loadout.offhand?.rarity}|${loadout.auraRarity}`;
    if (key === this.loadoutKey) return;
    this.loadoutKey = key;
    this.engine.setLoadout(loadout);
  }
  /**
   * The player's pixel Keeper: the look chosen at the Glass of Becoming wearing
   * what is equipped now (every worn slot is a layer). Sent when either changes;
   * the canvas carries both keys for tests. A brand-new Keeper (the tutorial
   * ended in this tab) is offered "Make your Keeper" once; an existing save gets
   * the nudge dot on Places instead.
   */
  private pushKeeper(): void {
    const look = this.looks.look;
    const gear = wornGear(this.inventory.snapshot.equipped);
    const key = `${look.vocation}:${lookKey(look)}#${gearKey(gear)}#${this.topDown ? 'td' : 'side'}`;
    this.keeperName = look.made ? look.name : '';
    this.lookNudge = !look.made && !look.prompted;
    if (key !== this.lookPushKey) {
      this.lookPushKey = key;
      this.engine?.setKeeperLook(look, gear);
      this.paintDollFigure(look, gear);
      const el = this.canvas?.nativeElement;
      el?.setAttribute('data-keeper-look', lookKey(look));
      el?.setAttribute('data-keeper-gear', gearKey(gear));
    }
    // Offered once the arrival has settled (the route's first query emissions close any open place).
    // A brand-new browser is offered it too: since the game-only shell there is no site tutorial in front
    // of the world, so the first arrival here IS the first visit. Recording it (lastStep 0: welcomed by the
    // Glass, no tutorial) keeps the offer to once, made or not.
    this.tickMakerOffer();
  }
  /**
   * Character creation on a first visit (owner, 2026-10-20: "when we first start, create a character"). Checked on the
   * HUD tick too: the top-down arrival is quiet, and the stats push that used to carry this check never fired there.
   */
  private tickMakerOffer(): void {
    if (!this.browser || this.makerOffered) return;
    const look = this.looks.look;
    // A browser with no first-visit record and a Keeper never made is a new character: offer the Glass once (the offer
    // records the visit). Other save keys can be written before the onboarding snapshot, so shouldOnboard() alone misses it.
    const fresh = this.onboarding.finishedHere || this.onboarding.shouldOnboard() || (!look.made && !look.prompted && !this.onboarding.hasRecord());
    if (!look.made && fresh && ++this.makerWait > 8 && !this.panel && !this.storyCard && !this.storyScene && !this.glimTalk) {
      this.makerOffered = true;
      if (!this.onboarding.finishedHere) this.onboarding.finish(0);
      this.openKeeperMaker();
    }
  }

  private paintDollFigure(look: KeeperLook, gear: ReturnType<typeof wornGear>): void {
    if (!this.browser) return;
    try {
      const el = document.createElement('canvas');
      el.width = el.height = 176;
      const v = vocationLook(look.vocation, gear);
      if (this.topDown) {
        // The top-down game's doll is the Keeper the world shows (owner 2026-10-20): the front sprite, class garb and
        // hood, the staff, the worn gear — scaled up whole pixels, never smoothed.
        const sheet = frontSheet(new KeeperPainter(look, v.gear, v.garb), look.vocation === 'warlock');
        const c = el.getContext('2d')!, k = 4, w = FRONT_W * k, h = FRONT_H * k;
        c.imageSmoothingEnabled = false;
        c.drawImage(sheet, 0, 0, FRONT_W, FRONT_H, Math.round((176 - w) / 2), Math.round((176 - h) / 2), w, h);
      } else new KeeperPainter(look, v.gear, v.garb).still(el);
      this.dollFigure = el.toDataURL('image/png');
    } catch { /* no 2D canvas: the doll frame stays empty */ }
  }
  /** The menu's "Character select": the play shell saves this Keeper and shows the character list (play/lobby). */
  toCharacterSelect(): void {
    if (!this.browser) return;
    this.engine?.setPaused(true);
    this.lobby.requestSelect();
  }
  /** The Glass of Becoming: "Make your Keeper" as a place (the world pauses). */
  openKeeperMaker(): void {
    if (!this.browser) return;
    this.looks.markPrompted();
    this.lookNudge = false;
    this.showPanel({ kind: 'page', stationId: 'glass', title: this.t('look.title'), kicker: this.t('look.kicker'), own: true });
    this.loadPanel({ load: () => import('../shared/keeper-look/keeper-maker.component').then(m => m.KeeperMakerComponent) }, this.panelInjector, ref => {
      (ref.instance as { done?: { subscribe(fn: (look: KeeperLook) => void): unknown } }).done?.subscribe(() => this.zone.run(() => {
        this.pushKeeper();
        this.closePanel();
        this.message = this.t('look.saved');
      }));
    });
  }
  private loadout(): KeeperLoadout {
    const equipped = this.inventory.snapshot.equipped;
    const worn = (slot: SlotId): GameItem | undefined => {
      const item = equipped[slot];
      return item && !item.explorerId ? item : undefined;
    };
    const held = (item: GameItem | undefined): HeldItem | null => {
      const art = item ? itemArt(item)?.src : undefined;
      return item && art ? { art, rarity: item.rarity } : null;
    };
    let aura: ItemRarity | null = null;
    for (const slot of SLOT_IDS) {
      const item = worn(slot);
      if (item && (!aura || RUNE_TIER_ORDER.indexOf(item.rarity) > RUNE_TIER_ORDER.indexOf(aura))) aura = item.rarity;
    }
    return { weapon: held(worn('weapon')), offhand: held(worn('off-hand')), auraRarity: aura };
  }
  /** The satchel's coin count, in viewport px, for the engine's pickup flights. Null → the engine's default corner. */
  private satchelPoint(): { x: number; y: number } | null {
    const target = this.host.nativeElement.querySelector('.satchel .coin-count') as HTMLElement | null;
    const box = target?.getBoundingClientRect();
    return box && (box.width || box.height) ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
  }
  // ── Building in the Delve ────────────────────────────────────────────────

  /** A placeable's translated name ("Timber support" / "Puntal de madera"). */
  private placeName(id: string): string {
    const key = `play.place.${id}`;
    const name = this.t(key);
    return name === key ? (materialDisplay(id)?.name ?? id) : name;
  }
  /** A chest refusal in the player's language (its English is the fallback). */
  private chestRefusal(result: { message: string; key?: string; vars?: Record<string, number> }): string {
    if (!result.key) return result.message;
    const text = this.t(result.key, result.vars);
    return text === result.key ? result.message : text;
  }
  /**
   * The engine's line for the objective: a line it keyed (play.delve.*,
   * play.hud.*) is translated, with `item` (a placeable id) turned into
   * `name` / `lname`; anything else is shown as the engine wrote it.
   */
  get engineMessage(): string {
    const key = this.state.messageKey;
    if (!key) return this.state.message;
    const vars: Record<string, string | number> = { ...(this.state.messageVars ?? {}) };
    if (typeof vars['item'] === 'string') {
      const name = this.placeName(vars['item'] as string);
      vars['name'] = name; vars['lname'] = name.toLowerCase();
    }
    // A drop list the engine joined in English ("coins and Cinder Ore"): re-join it here.
    if (typeof vars['items'] === 'string') {
      vars['items'] = (vars['items'] as string).split(' and ').map(part => part === 'coins' ? this.t('play.hud.coins') : part).join(this.t('play.hud.and'));
    }
    const text = this.t(key, vars);
    return text === key ? this.state.message : text;
  }
  /** Rebuild the hotbar when a count changed. Cheap: one stack read per placeable. */
  private refreshHotbar(): void {
    const ids: (PlaceableId | BucketId | HandToolId)[] = [...PLACEABLES.map(def => def.id), ...HOTBAR_EXTRA];
    const counts = ids.map(id => this.inventory.stackOf(id));
    const key = counts.join(',');
    if (key === this.hotbarKey && this.hotbar.length) return;
    this.hotbarKey = key;
    // Keys 1-0 for the fixed ten; past them (the obsidian block, the buckets) only what the satchel holds, on - and =.
    let extra = 0;
    this.hotbar = ids.flatMap((id, i) => i < HOTBAR_FIXED || counts[i] > 0 ? [{
      id, name: this.placeName(id), art: materialDisplay(id)?.art ?? '', count: counts[i],
      key: i < HOTBAR_FIXED ? String((i + 1) % 10) : ['-', '='][extra++] ?? '',
    }] : []);
    // Nothing chosen yet: the first thing the satchel holds.
    if (!this.placing) {
      const first = this.hotbar.find(slot => slot.count > 0);
      if (first) this.choosePlaceable(first.id, true);
    }
  }
  /** The chosen slot, for the hint line. */
  get placingSlot(): HotbarSlot | undefined { return this.hotbar.find(slot => slot.id === this.placing); }
  choosePlaceable(id: PlaceableId | BucketId | HandToolId, quiet = false): void {
    this.placing = id;
    this.engine?.setPlaceable(id);
    if (!quiet) {
      const slot = this.placingSlot;
      this.message = slot ? this.t('play.hotbar.ready', { name: slot.name, n: slot.count }) : '';
    }
  }
  /** Phones: the hotbar's pick slot. A tap on a block digs it again. */
  choosePick(): void {
    this.touchTool = 'pick';
    this.message = this.t('play.hud.pickReady');
  }
  /** The hotbar's Place button: same as B. */
  placeHere(): void { this.engine?.place(); }
  /**
   * The engine is about to place one thing: take it from the satchel first.
   * One consume op keyed by the placement's mutation id, so a replay never
   * takes two. Refused (none left, a failed save) → nothing is placed.
   */
  private placeFromSatchel(event: PlaceEvent): boolean | number {
    if (!this.browser) return false;
    const held = this.inventory.stackOf(event.item);
    if (held < 1) {
      this.message = this.t('play.delve.noneLeft', { lname: this.placeName(event.item).toLowerCase() });
      return false;
    }
    // A rope spools one coil a cell: as many as it needs, or as many as are left.
    const count = Math.max(1, Math.min(held, Math.floor(event.count ?? 1)));
    const result = this.inventory.consumeStacks(event.mutationId, [{ id: event.item, count }]);
    if (!result.ok) {
      this.message = this.t('play.delve.chest.saveFailed');
      return false;
    }
    this.refreshHotbar();
    if (event.item === 'torch' && event.areaId === 'ember-delve') {
      this.bountyEvent({ kind: 'torch', row: Number(event.cellKey.split(',')[1]), token: event.cellKey });
    }
    return event.count !== undefined ? count : true;
  }
  /** A placed thing comes back: one grant keyed by the take's mutation id. */
  private takeToSatchel(event: PlaceEvent): boolean {
    if (!this.browser) return false;
    if (event.item === 'chest' && !this.chests.isEmpty(event.areaId, event.index)) {
      this.message = this.t('play.delve.emptyChestFirst');
      return false;
    }
    if (!this.inventory.grantStack(event.mutationId, event.item, Math.max(1, Math.floor(event.count ?? 1)))) {
      this.message = this.t('play.hud.msg.pickupFailed');
      return false;
    }
    if (event.item === 'chest') this.chests.forget(event.areaId, event.index);
    this.refreshHotbar();
    return true;
  }
  // ── Liquids and fishing ──────────────────────────────────────────────────

  /** A Seam Bucket scoops or pours: one bucket stack becomes the other, in one idempotent swap. */
  private bucketSwap(event: BucketEvent): boolean {
    if (!this.browser) return false;
    if (this.inventory.stackOf(event.from) < 1) { this.message = this.t('play.delve.noneLeft', { lname: this.placeName(event.from).toLowerCase() }); return false; }
    const taken = this.inventory.consumeStacks(event.mutationId, [{ id: event.from, count: 1 }]);
    if (!taken.ok || !this.inventory.grantStack(`${event.mutationId}:to`, event.to, 1)) { this.message = this.t('play.delve.chest.saveFailed'); return false; }
    this.refreshHotbar();
    // Keep the hand on the bucket that is now held.
    if (this.placing === event.from && this.inventory.stackOf(event.from) < 1) this.choosePlaceable(event.to, true);
    return true;
  }
  /**
   * The rod and the wards for the engine, when they change: the best rod held
   * (and what it works as at this Fishing level), the bait and charm bite
   * speed, the Gill Draught's breath and the Ember Elixir worn as a charm.
   */
  private pushFishing(): void {
    if (!this.engine || !this.browser) return;
    const now = Date.now();
    if (now - this.rodAsked > 1000) { this.rodAsked = now; this.fishing.ensureWornRod(); }
    const rod = this.fishing.rod();
    const breath = this.infusions.multiplierOn('breath');
    const elixir = Object.values(this.inventory.snapshot.equipped).some(item => item && !item.explorerId && item.definitionId === 'ember-elixir');
    // The Shade-kit watches the water: a bite comes sooner (the engine caps the speed at 4).
    // The Prism Moth-kit guides the cast (its move, when it is working): it hovers over the bob, a little sooner still.
    const moth = this.browser ? followingPet(this.pets.state) : null;
    const guide = moth && PET_ROLES[moth.id].move === 'guide' && works(PET_ROLES[moth.id].role, this.pets.command) ? PET_ACT.guideBoost : 1;
    const watch = (this.petAbility === 'fish' ? PET_TUNING.biteBoost : 1) * guide;
    const key = `${rod?.tier ?? 0}:${rod?.liquids.join('/') ?? ''}:${rod?.bite.toFixed(3) ?? 0}:${breath}:${elixir}:${watch}`;
    if (key === this.fishKey) return;
    this.fishKey = key;
    this.engine.setFishing({ tier: rod?.tier ?? 0, liquids: rod?.liquids ?? [], bite: (rod?.bite ?? 1) * watch });
    this.engine.setWards({ breath, lavaWard: elixir ? 10 : 0 });
  }
  /** The prompt's label: the place (water / lava) or the line's state; the button beside it holds the verb, or null when nothing fishing-related is in reach. */
  get fishPrompt(): string | null {
    const fishing = this.state.fishing;
    if (this.reel) return null;
    if (fishing) return this.t(fishing.phase === 'bite' ? 'play.fish.ui.biteCall' : 'play.fish.ui.waiting');
    if (this.state.canFish) return this.t(this.state.canFish === 'lava' ? 'play.fish.ui.lava' : 'play.fish.ui.water');
    return null;
  }
  /** The rod and bait the next cast uses, for the prompt's tooltip and tests. */
  get fishInfo(): string {
    const rod = this.fishing.rod();
    const bait = this.fishing.bait();
    const rodLine = !rod ? '' : rod.name === rod.works ? this.t('play.fish.ui.rod', { name: rod.name }) : this.t('play.fish.ui.rodWorks', { name: rod.name, works: rod.works });
    const baitLine = bait ? this.t('play.fish.ui.bait', { name: materialDisplay(bait)?.name ?? bait }) : this.t('play.fish.ui.noBait');
    return `${rodLine} · ${baitLine} · ${this.t('play.fish.ui.hold')}`;
  }
  /** The prompt's button: a press casts or hooks (E); holding it keeps fishing on its own (auto). */
  fishPress(event: PointerEvent, down: boolean): void {
    if (down && event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    this.engine?.setUseHeld(down);
    if (down) this.engine?.interact();
  }
  /**
   * A fish is hooked. Night, Glowcap bait, the Mere and the Archivist's second
   * page raise the Drowned Lamp instead. Auto-fish (Use held) lands at the Off
   * grade at once; otherwise the Line Tension reel decides the grade.
   */
  private fishHooked(event: FishEvent): void {
    // Nothing is fished from ink (no rod works it; the engine never casts into it).
    if (!this.browser || !this.engine || event.liquid === 'ink') return;
    const npc = this.store.read('eclipse-npc') as { claimed?: unknown } | null;
    const pageClaimed = Array.isArray(npc?.claimed) && npc!.claimed.includes('fish-drowned-lamp-2');
    if (this.fishing.lampAnswers({ biome: event.biome, liquid: event.liquid, pageClaimed, fallen: this.delve.isClaimed(DROWNED_LAMP_FLAG) })) {
      this.engine.landFish();
      this.engine.summon('drowned-lamp', (event.col + .5) * 32);
      return;
    }
    const pending = this.fishing.hooked({ castId: event.castId, biome: event.biome, liquid: event.liquid });
    this.hookedAt.set(event.castId, { liquid: event.liquid, col: event.col, row: event.row });
    if (event.auto) { this.landCatch(pending, 'off', reelDuration(pending.rarity) + .6); return; }
    const lodgeReel = this.inventory.stackOf('lodge-reel') > 0 ? .1 : 0;
    let seed = 0;
    for (const ch of event.castId) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
    this.reel = { pending, seed, widen: fishingPerks(this.fishing.level()).window + lodgeReel, biome: event.biome, liquid: event.liquid, auto: false };
  }
  /** The reel ended: land the catch at its grade. */
  reelDone(result: { grade: 'perfect' | 'good' | 'off' }): void {
    const reel = this.reel;
    this.reel = null;
    if (!reel) return;
    // A played reel ends the line; holding Use to reel must not start auto-fishing.
    this.engine?.setUseHeld(false);
    this.landCatch(reel.pending, result.grade);
  }
  private landCatch(pending: PendingCatch, grade: 'perfect' | 'good' | 'off', recastIn?: number): void {
    const landed = this.fishing.land(pending, grade);
    // The fish arcs out of the water into the Keeper, "+1 Blindfin" rising where it lands (engine), then the Satchel pulses.
    this.engine?.landFish(recastIn, landed ? `+${landed.qty} ${landed.name}` : undefined);
    const hooked = this.hookedAt.get(pending.castId);
    this.hookedAt.delete(pending.castId);
    if (!landed) { this.message = this.t('play.fish.ui.saveFailed'); return; }
    if (hooked) this.bountyEvent({ kind: 'catch', liquid: hooked.liquid, col: hooked.col, row: hooked.row, token: pending.castId });
    this.toastLoot(this.t('play.fish.ui.landed', { name: landed.name, n: landed.qty, xp: landed.xp }), this.art(landed.id) || undefined);
    this.message = landed.first ? `${this.t('play.fish.ui.grade.' + grade)} ${this.t('play.fish.ui.first')}` : this.t('play.fish.ui.grade.' + grade);
    this.canvas?.nativeElement.setAttribute('data-last-catch', landed.id);
    this.refreshHotbar();
  }
  /** The satchel's Open on a crate: its contents into the satchel, free. */
  openCrate(): void {
    const pick = this.pick;
    if (pick?.kind !== 'stack' || !CRATE_IDS.includes(pick.ref)) return;
    const got = this.fishing.openCrate(pick.ref);
    if (!got) { this.message = this.t('play.delve.chest.saveFailed'); return; }
    // A Seam Crate is where the Ember Newt lays its egg (pets.model.ts).
    if (pick.ref === 'seam-crate') { this.pets.count('crate:seam-crate'); this.petsAt = 0; this.tickPets(); }
    const items = got.map(row => `${row.qty} ${materialDisplay(row.id)?.name ?? row.id}`).join(', ');
    this.message = this.t('play.fish.ui.opened', { items });
    this.toastLoot(items);
    if (this.inventory.stackOf(pick.ref) < 1) this.pick = null;
  }
  /** The picked stack is a crate (the slip shows Open). */
  get pickIsCrate(): boolean { return this.pick?.kind === 'stack' && CRATE_IDS.includes(this.pick.ref); }

  /** E beside (or a tap on) a placed chest or camp. */
  private useCell(event: UseEvent): void {
    if (!this.browser) return;
    if (event.kind === 'chest') {
      this.showPanel({ kind: 'chest', stationId: 'chest', title: this.t('play.place.chest'), kicker: this.t('play.delve.yourDelve'), chest: { areaId: event.areaId, index: event.index }, own: true });
      this.refreshChest(this.t('play.delve.chest.intro'));
    } else if (event.kind === 'anchor') {
      this.openAnchors();
    } else if (event.kind === 'gate') {
      this.useGate(event);
    } else if (event.kind === 'brazier') {
      this.lightBrazier(event);
    } else if (event.kind === 'furnace') {
      this.wakeFurnace(event.col ?? 68);
    } else if (event.kind === 'camp') {
      // The Crafting Bench, opened on "Ready now": what you can make here with what you carry.
      const entry = PANEL_REGISTRY.crafting;
      this.showPanel({ kind: 'page', stationId: 'camp', title: this.t('play.delve.camp.title'), kicker: this.t('play.delve.camp.kicker'), own: true });
      this.loadPanel(entry, this.campInjector);
    }
  }
  // ── The Rift Gates (rift-gates.model.ts): attune, step through, step back; the Gloam Warden's braziers ──

  /**
   * E at a Rift Gate. On the realm side it is the way back out. In the Ember
   * Delve: a settling gate says so; an open one asks for its Delving level and
   * (once) its Realm Sigil, which it keeps; then the Keeper steps through.
   */
  private useGate(event: UseEvent): void {
    if (!this.engine || event.col === undefined || event.row === undefined) return;
    if (this.engine.realm) { if (!this.engine.leaveRealm()) this.message = this.t('play.rift.backFailed'); return; }
    const realm = realmOfGateNode(event.node ?? '');
    if (!realm) return;
    const gate = RIFT_GATES[realm];
    const check = attuneCheck(realm, {
      delving: skillLevel(this.activity.snapshot.progress, 'delving'),
      sigils: this.inventory.stackOf(gate.sigil),
      attuned: this.delve.isClaimed(attunedFlag(realm)),
    });
    const name = this.t(`play.rift.realm.${realm}`);
    if (!check.ok) {
      this.message = check.why === 'settling' ? this.t('play.rift.settling', { realm: name })
        : check.why === 'delving' ? this.t('play.rift.needDelving', { n: check.need })
        : this.t('play.rift.needSigil', { sigil: materialDisplay(check.sigil)?.name ?? check.sigil });
      return;
    }
    if (check.attune) {
      // The sigil is spent once, keyed by the realm: a replay never takes a second.
      if (!this.inventory.consumeStacks(`rift-attune:${realm}`, [{ id: gate.sigil, count: 1 }]).ok) { this.message = this.t('play.delve.chest.saveFailed'); return; }
      this.delve.claim(attunedFlag(realm));
      this.toastLoot(this.t('play.rift.attuned'));
    }
    const first = !this.delve.isClaimed(enteredFlag(realm));
    if (!gate.area || !this.engine.enterRealm(gate.area, { col: event.col, row: event.row })) { this.message = this.t('play.rift.enterFailed'); return; }
    this.sound.sfx('portal');
    if (first) {
      const result = this.skillActions.act({ mutationId: `rift-enter:${realm}`, skill: 'delving', xp: GATE_ENTER_XP, locationId: this.delveLocation(gate.area) });
      if (result.ok && !result.replayed) this.toastLoot(this.t('play.rift.firstStep', { n: GATE_ENTER_XP }));
    }
  }
  /** E at an unlit gloam brazier: one torch from the satchel lights it. */
  private lightBrazier(event: UseEvent): void {
    if (!this.engine || event.col === undefined || event.row === undefined) return;
    if (this.inventory.stackOf('torch') < 1) { this.message = this.t('play.rift.brazier.noTorch'); return; }
    if (!this.engine.lightBrazier(event.col, event.row)) return;
    this.braziersLit++;
    this.inventory.consumeStacks(`rift-brazier:${event.areaId}:${event.cellKey}:${Date.now()}:${this.braziersLit}`, [{ id: 'torch', count: 1 }]);
    this.refreshHotbar();
  }
  private braziersLit = 0;
  /**
   * Once a second in the Delve: a Rift Gate in sight. The first sighting of
   * each realm's gate is a moment: Glim says what it is (open or settling) and
   * it pays a little Delving XP, once.
   */
  private tickGates(): void {
    const near = this.engine?.gateNear(14) ?? null;
    this.canvas?.nativeElement.setAttribute('data-gate', near ? `${near.realm}:${near.col},${near.row}` : '');
    if (!near || this.delve.isClaimed(seenFlag(near.realm))) return;
    if (!this.delve.claim(seenFlag(near.realm))) return;
    const gate = RIFT_GATES[near.realm];
    this.message = this.t(gate.open ? 'play.rift.glim.seenOpen' : 'play.rift.glim.seenSettling', { realm: this.t(`play.rift.realm.${near.realm}`) });
    const result = this.skillActions.act({ mutationId: `rift-seen:${near.realm}`, skill: 'delving', xp: GATE_SEEN_XP, locationId: EMBER_DELVE_LOCATION });
    if (result.ok && !result.replayed) this.toastLoot(this.t('play.rift.seenXp', { n: GATE_SEEN_XP }));
  }
  /** Where a Delve action is filed: the Ember Delve, or the realm Delve it happened in. */
  private delveLocation(areaId: string | undefined): string {
    return areaId && realmOfArea(areaId) ? `${this.town.id}/${areaId}` : EMBER_DELVE_LOCATION;
  }

  // ── The Underhearth: Rift Anchor travel, the Banked Furnace's hearth ──

  /** The Rift Anchor travel sheet, while open. */
  anchorSheet: AnchorRow[] | null = null;
  /** Whether this town's Delve holds any anchor (the shaft offers "Descend to an anchor"). */
  anchorsReady = false;
  /** The anchors of this town's Delve as travel rows (and the Seamworks, from below). */
  private anchorRows(): AnchorRow[] {
    // In a realm Delve its own anchors, and the way back out is the gate you came in by.
    const inRealm = !!this.engine?.realm;
    const realm = this.engine?.realm;
    const spec = (realm === 'verdant' ? VERDANT_DELVE : realm === 'luminous' ? LUMINOUS_DELVE : realm === 'celestial' ? CELESTIAL_DELVE : inRealm ? UMBRAL_DELVE : EMBER_DELVE).terrain;
    const biomes = [...(spec?.biomes ?? []), ...(spec?.depth?.biomes ?? [])];
    const rows: AnchorRow[] = (this.engine?.delveAnchors() ?? []).map((a, n) => ({
      key: `${a.col},${a.row}`, col: a.col, row: a.row,
      label: this.t('play.uh.travel.row', { n: n + 1, place: biomes.find(b => a.row < b.to)?.name ?? '', depth: a.row }),
    }));
    if (this.state.delve) rows.push({ key: 'home', col: 0, row: 0, label: this.t(inRealm ? 'play.rift.travel.back' : 'play.uh.travel.home'), home: true });
    return rows;
  }
  /** Open the travel sheet (E at an anchor, or the shaft's button). */
  /** Any menu up over the world (the Slate has its own veil): the soft dim behind it, and what a tap on the dim closes. */
  get menuOpen(): boolean { return !!this.taskTalk || this.bagOpen || this.placesOpen || this.bestiaryOpen || this.soundOpen || this.petsOpen || (!!this.panel && this.panel.kind !== 'slate') || !!this.anchorSheet; }
  /** A tap on the dim around a menu puts the top one away (Escape does the same through each menu's own handler). */
  dismissMenu(): void {
    if (this.taskTalk) this.closeTalk();
    else if (this.petsOpen) this.closePets();
    else if (this.bestiaryOpen) this.closeBestiary();
    else if (this.soundOpen) this.soundOpen = false;
    else if (this.anchorSheet) this.closeAnchors();
    else if (this.panel) this.closePanel();
    else if (this.placesOpen) this.placesOpen = false;
    else if (this.bagOpen) this.toggleBag();
  }
  openAnchors(): void {
    if (!this.engine) return;
    this.anchorSheet = this.anchorRows();
    this.engine.setPaused(true);
  }
  closeAnchors(): void {
    this.anchorSheet = null;
    this.engine?.setPaused(false);
    this.focusWorld();
  }
  /** Step through to an anchor (or climb home to the Seamworks Waystone). */
  travelAnchor(row: AnchorRow): void {
    if (!this.engine) return;
    this.anchorSheet = null;
    this.engine.setPaused(false);
    if (row.home && this.engine.realm) { if (!this.engine.leaveRealm()) this.message = this.t('play.rift.backFailed'); }
    else if (row.home) this.engine.returnToCamp();
    else if (!this.engine.travelToAnchor(row.col, row.row)) this.message = this.t('play.uh.travel.failed');
    this.focusWorld();
  }
  /**
   * The Banked Furnace's hearth: the Four Hammer-Marks wake it. After its first
   * fall it banks itself for a day (once-a-day rekindling: nothing to farm).
   */
  private wakeFurnace(col: number): void {
    if (!this.engine) return;
    if (this.inventory.stackOf(FOUR_HAMMER_MARKS) < 1) { this.message = this.t('play.uh.furnace.needMarks'); return; }
    if (this.delve.isClaimed(FURNACE_FLAG) && this.delve.isClaimed(furnaceDayFlag(Date.now()))) { this.message = this.t('play.uh.furnace.restDay'); return; }
    if (!this.engine.summon('banked-furnace', (col + .5) * 32)) this.message = this.t('play.uh.furnace.already');
  }
  /** "Descend to your camp" at the Delve shaft. */
  descendToCamp(): void {
    if (!this.engine?.descendToCamp()) this.campReady = !!this.engine?.hasDelveCamp();
    else this.campReady = false;
  }
  /** Rebuild the open chest's two lists. */
  private refreshChest(note: string): void {
    const at = this.panel?.chest;
    if (!at) { this.chestView = null; return; }
    const place = this.inventory.snapshot.stackPlace;
    const satchel = this.inventory.snapshot.stacks
      .filter(stack => stack.quantity > 0 && place[stack.stackKey] === 'satchel')
      .map(stack => {
        const display = materialDisplay(stack.stackKey);
        return { stackKey: stack.stackKey, name: display?.name ?? stack.stackKey, art: display?.art ?? '', qty: stack.quantity };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const gear = this.chests.gear(at.areaId, at.index);
    this.chestView = {
      rows: this.chests.contents(at.areaId, at.index), satchel, slots: this.chests.slots,
      gear, bagGear: this.chests.bagGear(), gearSlots: this.chests.gearSlots,
      gearUsed: gear.reduce((sum, row) => sum + row.qty, 0), note,
    };
  }
  chestPut(row: ChestRow): void {
    const at = this.panel?.chest;
    if (!at) return;
    const result = this.chests.put(at.areaId, at.index, row.stackKey);
    this.refreshChest(result.ok ? this.t('play.delve.chest.putQty', { n: result.qty, name: row.name }) : this.chestRefusal(result));
    this.refreshHotbar();
  }
  chestTake(row: ChestRow): void {
    const at = this.panel?.chest;
    if (!at) return;
    const result = this.chests.take(at.areaId, at.index, row.stackKey);
    this.refreshChest(result.ok ? this.t('play.delve.chest.takeQty', { n: result.qty, name: row.name }) : this.chestRefusal(result));
    this.refreshHotbar();
  }
  /** Put a row in: every piece of a ×N group, until the chest refuses (then says why). */
  chestPutGear(row: ChestGearRow): void {
    this.chestMoveGear(row, (at, id) => this.chests.putGear(at.areaId, at.index, id), 'play.delve.chest.putGear', 'play.delve.chest.putGearN');
  }
  chestTakeGear(row: ChestGearRow): void {
    this.chestMoveGear(row, (at, id) => this.chests.takeGear(at.areaId, at.index, id), 'play.delve.chest.takeGear', 'play.delve.chest.takeGearN');
  }
  private chestMoveGear(
    row: ChestGearRow,
    move: (at: { areaId: string; index: number }, id: string) => ChestMove,
    one: string,
    many: string,
  ): void {
    const at = this.panel?.chest;
    if (!at) return;
    let moved = 0;
    let refused = '';
    for (const id of row.ids) {
      const result = move(at, id);
      if (!result.ok) { refused = this.chestRefusal(result); break; }
      moved++;
    }
    const done = moved === 1 ? this.t(one, { name: row.name }) : moved > 1 ? this.t(many, { n: moved, name: row.name }) : '';
    this.refreshChest([done, refused].filter(Boolean).join(' '));
  }
  /** Chests whose Delve changed under them (a version bump, a merged seed) hand their contents back. */
  private refundOrphanChests(): void {
    if (!this.browser) return;
    const refunded = this.chests.refundOrphans((areaId, index) => this.engine?.nodeIdAt(areaId, index) ?? null);
    if (refunded) this.message = this.t('play.delve.chest.refunded', { n: refunded });
  }
  /** The hotbar's Take back button: same as X. */
  takeBack(): void { this.engine?.takeBack(); }
  /** A break dropped a block: into the satchel, or the Vault when the satchel is full (routed$ says so). Never refuses the dig. */
  private grantBlock(event: WorldActionEvent): void {
    if (!event.block) return;
    const name = materialDisplay(event.block)?.name ?? event.block;
    if (this.inventory.grantStack(`${event.mutationId}:block`, event.block, 1)) {
      this.gotItem(1, name);
      this.refreshHotbar();
    } else this.message = this.t('play.hud.msg.pickupFailed');
  }

  /**
   * A delve tool is about to break a paying cell. Mining rock goes through
   * resolveMine (same gate, cooldown and idempotency as the ore station), but
   * only the reward is rate-limited: during the seam's recovery the cell still
   * breaks and pays nothing (delve-reward.ts). Other yields are granted
   * idempotently by the engine's per-cell mutation id.
   */
  private worldAction(event: WorldActionEvent): boolean | typeof WORLD_ACTION_UNPAID {
    if (!this.browser) return false;
    // An Ember Grub in dug dirt (fishing bait, spec §5.2): the block and the grub, no XP, no seam.
    if (event.materialId === 'ember-grub' && !event.xp) {
      this.grantBlock(event);
      if (this.inventory.grantStack(`${event.mutationId}:grub`, 'ember-grub', event.qty ?? 1)) this.gotItem(1, materialDisplay('ember-grub')?.name ?? 'Ember Grub', 'ember-grub');
      return true;
    }
    // Plain dirt and placed blocks pay only the block.
    if (!event.xp && !(event.materialId && event.qty)) { this.grantBlock(event); return true; }
    // The seam's own ores (and plain rock) go through the Seamworks seam's gate. Any other ore (the
    // Underhearth's emberheart and pyrite, the Ink Deeps' inkstone and nightglass) pays itself below:
    // resolveMine only knows MINING_TIERS and would book it as Cinder Ore.
    const seamOre = !event.materialId || !!miningTierFor(event.materialId);
    if (event.kind === 'mine' && event.discipline === 'mining' && !event.site && seamOre) {
      const now = Date.now();
      const settled = settleDelveMine({
        // The selected Current Work's breath, read before switching to it; with
        // another discipline selected the gateway answers "recovering" itself.
        recoveryRemainingMs: at => this.activity.snapshot.currentWork?.disciplineId === 'mining' ? this.activity.recoveryRemainingMs(at) : 0,
        resolve: (mutationId, at) => this.activity.selectCurrentWork('mining', BASALT_SEAMWORKS_ID, at)
          ? this.activity.resolveMine({ mutationId, locationId: BASALT_SEAMWORKS_ID, oreId: event.materialId, now: at })
          : { ok: false, code: 'not-selected' },
      }, event.mutationId, now);
      this.now = now;
      if (settled.outcome === 'resting') {
        // Dug, unpaid. The block still drops: it is the rock itself, not a reward.
        if (restCueDue(this.restCueAt, now)) { this.restCueAt = now; this.toastLoot(this.t('play.delve.restingXp')); }
        this.grantBlock(event);
        return WORLD_ACTION_UNPAID;
      }
      if (settled.outcome === 'refused') {
        this.message = this.t(settled.code === 'not-selected' ? 'play.hud.msg.miningNotSaved' : settled.code === 'capacity' ? 'play.hud.msg.bagFull' : settled.code === 'tier-locked' ? 'play.hud.msg.tierLocked' : 'play.hud.msg.strikeNotSaved');
        return false;
      }
      if (event.materialId) this.gotItem(1, materialDisplay(event.materialId)?.name ?? event.materialId, event.materialId);
      this.grantBlock(event);
      return true;
    }
    // Everything else trains the skill the node belongs to (rock → Mining,
    // roots → Foraging, trunks → Woodcutting, walls and caches → Delving):
    // one idempotent gateway write grants the item and the XP together and
    // plays that skill's level-up moment.
    const skill = skillForDiscipline(event.discipline);
    if (!skill) { this.grantBlock(event); return true; }
    // A once-per-player find already paid (its diff was lost, or a second device
    // still showed it): the rock breaks, nothing is paid twice.
    const once = event.materialId && ONCE_PER_PLAYER.has(event.materialId) ? event.materialId : null;
    if (once && this.delve.isClaimed(once)) {
      this.message = this.t('play.hud.msg.echo', { name: materialDisplay(once)?.name ?? once });
      return true;
    }
    // The Prism Moth-kit hums while you work: a little more XP in the Luminous (pets.model.ts xpBonus).
    const petXp = this.petAbility === 'xp' && this.town.realm === 'luminous' ? xpBonus(event.xp) : 0;
    const result = this.skillActions.act({
      // A hunting-ground node is booked where it stands; a Delve cell in the Delve.
      mutationId: event.mutationId, skill: skill.id, xp: event.xp + petXp, locationId: event.site ? this.worldLocation(event.areaId) : this.delveLocation(event.areaId),
      ...(event.materialId && event.qty ? { materialId: event.materialId, qty: event.qty } : {}),
    });
    if (!result.ok) {
      this.message = this.t(result.code === 'capacity' ? 'play.hud.msg.swingFull' : 'play.hud.msg.swingNotSaved');
      return false;
    }
    if (once) this.delve.claim(once);
    if (event.materialId && event.qty) this.gotItem(event.qty, materialDisplay(event.materialId)?.name ?? event.materialId, event.materialId);
    if (event.site) this.petHarvest(event.areaId, event.mutationId, event.materialId);
    this.grantBlock(event);
    return true;
  }
  /**
   * A hunting-ground harvest, for the pets: the Rootglass Thicket counts toward
   * the Moss Hedgehog, and the hedgehog itself sometimes noses out one more of
   * a Verdant harvest (one idempotent grant keyed by the harvest).
   */
  private petHarvest(areaId: string, mutationId: string, materialId?: string): void {
    if (areaId === 'rootglass-thicket') this.pets.count('gather:rootglass-thicket');
    if (!materialId || this.petAbility !== 'gather' || this.town.realm !== 'verdant' || !gatherBonus(mutationId)) return;
    if (!this.inventory.grantStack(`pet-gather:${mutationId}`, materialId, 1)) return;
    const item = materialDisplay(materialId)?.name ?? materialId;
    this.gotItem(1, item, materialId);
    this.message = this.t('play.pet.gather', { name: this.pets.record(this.pets.state.active)?.name || this.t('play.pet.name.moss-hedgehog'), item });
    this.engine?.petFeel('happy');
  }
  /** Where a world action is booked in the activity ledger: `<town>/<area>` ('verdant/rootglass-thicket'). */
  private worldLocation(areaId: string): string {
    return areaId === this.town.id ? `${this.town.id}/town` : `${this.town.id}/${areaId}`;
  }
  /**
   * A creature fell: Hunting XP scaled by its full HP (skills/hunting.ts),
   * keyed by the kill so a replay never pays twice. SkillActionService plays
   * the Hunting level-up moment when it crosses one.
   */
  /**
   * A find on the high ground: the first use pays once (HeightsService writes
   * the receipt before it pays); later uses only say what it is.
   */
  private heightFound(event: HeightFindEvent): void {
    if (!this.browser || event.found) return;
    const used = this.heights.use(event.id);
    if (!used) return;
    const items = used.materials.map(m => `${m.qty} ${materialDisplay(m.id)?.name ?? titleCase(m.id.replace(/-/g, ' '))}`).join(', ');
    if (used.kind === 'cache') this.message = this.t('play.height.toast.cache', { gold: used.gold, items });
    else if (used.kind === 'summit') this.message = this.t('play.height.toast.summit', { gold: used.gold, items, title: this.t(`play.height.title.${used.title}`) });
    else if (used.kind === 'lookout') this.message = this.t('play.height.toast.lookout');
    for (const m of used.materials) this.gotItem(m.qty, materialDisplay(m.id)?.name ?? m.id, m.id);
  }
  private hunted(event: KillEvent): void {
    if (!this.browser) return;
    // The Bestiary counts every top-down kill (account progress: a read-modify-write, so no copy goes stale).
    if (this.topDown) { const blob = withKill(this.store.read(BESTIARY_KEY), event.creature); if (blob) this.store.write(BESTIARY_KEY, blob); }
    // A town task's hunt counts it (only once taken: shared/town-tasks).
    if (this.topDown) this.tasksFinished(this.townTasks.killed(event.creature));
    // The Sexton's Count: the Row-Walker (its spawn key) and the Uncounted, felled while the chain waits on them.
    if (this.topDown && /^td:surface:sexton:row-walker:/.test(event.id)) this.sextonSaw({ kind: 'walker' });
    if (this.topDown && event.creature === 'the-uncounted') this.sextonSaw({ kind: 'uncounted' });
    // The Banked Furnace banks itself again for a day after every fall.
    if (event.creature === 'banked-furnace') this.delve.claim(furnaceDayFlag(Date.now()));
    // The two rescues a hunt can earn (pets.model.ts): six Foragers, six Substitutes.
    if ((event.areaId === 'reflection-channels' && event.creature === 'prism-forager') || (event.areaId === 'unrecorded-corridors' && event.creature === 'mirror-substitute')) {
      this.pets.count(`kill:${event.areaId}`);
    }
    // A gate boss on this tier opens the next one (shared/loot/difficulty.model.ts).
    // Spellstones (shared/spellstones): a kill near the Keeper's level gives Soul; Soul Harvest's ranks give more.
    // Whispering items worn count it, and may wake a piece of their sentence (shared/grave-goods).
    if (this.topDown) this.stonesKill(event.creature);
    const opened = this.loot.killed(event.creature);
    if (opened) this.message = this.t('play.loot.unlocked', { tier: this.t('loot.tier.' + opened) });
    const base = Math.round(huntingXpFor(event.hp) * (event.xp ?? 1));
    // Worn XP (the "+X% XP" affix, rpg/item.model gearXp) lifts every kill's Hunting XP, as its card says.
    const gross = base + gearXp(base, this.inventory.equippedTotals.xpBonus) + (this.petAbility === 'xp' && this.town.realm === 'luminous' ? xpBonus(base) : 0);
    // The Ember debt (shared/hearth): while one is owed, half of each kill's XP pays it off. Once per kill.
    const owed = this.topDown && this.hearth.state.debt > 0 && !this.debtKills.has(event.id);
    const pay = owed ? this.hearth.earn(gross) : { earned: gross, paid: 0 };
    if (owed) this.debtKills.add(event.id);
    const xp = pay.earned;
    if (pay.paid > 0 && this.hearth.state.debt === 0) this.message = this.t('play.coldHearth.debt.clear');
    if (xp <= 0) { if (pay.paid > 0) this.toastLoot(this.t('play.coldHearth.debt.paid', { n: 0, paid: pay.paid })); return; }
    const result = this.skillActions.act({ mutationId: `hunt:${event.id}`, skill: 'hunting', xp, locationId: this.worldLocation(event.areaId) });
    if (result.ok && !result.replayed) this.toastLoot(pay.paid > 0 ? this.t('play.coldHearth.debt.paid', { n: xp, paid: pay.paid }) : this.t('play.hunt.xp', { n: xp }));
  }
  /**
   * The Keeper read a carved wall. The first reading is recorded (for the
   * Archivist's missions and the Codex) and pays a little Delving XP, keyed by
   * the inscription so it can never pay twice; every reading shows the words.
   */
  private discover(event: DiscoverEvent): void {
    if (!this.browser) return;
    // The endless Delve (Phase 7): a rift shrine's first touch, and field-note walls.
    // Each pays a little Delving XP once, keyed by its id (the ledger's replay check is the record).
    if (event.kind === 'shrine') {
      // Under an eclipse a first touch pays double and leaves a sliver of Eclipse Glass (shared/world-clock ECLIPSE_SHRINE).
      const xp = SHRINE_XP * (event.eclipse ? ECLIPSE_SHRINE.xp : 1);
      const result = this.skillActions.act({ mutationId: `delve-shrine:${event.id}`, skill: 'delving', xp, locationId: EMBER_DELVE_LOCATION });
      if (result.ok && !result.replayed) {
        this.message = this.t('play.delve.shrine.first', { n: xp });
        if (event.eclipse && this.inventory.grantStack(`delve-shrine:${event.id}:eclipse-glass`, ECLIPSE_GLASS_ID, ECLIPSE_SHRINE.glass)) {
          this.gotItem(ECLIPSE_SHRINE.glass, materialDisplay(ECLIPSE_GLASS_ID)?.name ?? 'Eclipse Glass', ECLIPSE_GLASS_ID);
          this.message = `${this.message} ${this.t('clock.announce.shrine')}`;
        }
        // "A splinter from a waystone that was never built": one per shrine, the first time (Rift Anchors, Phase 8).
        if (this.inventory.grantStack(`delve-shrine-shard:${event.id}`, WAYSTONE_SHARD, 1)) this.toastLoot(this.t('play.uh.shrine.shard'));
      }
      // Each shrine hands over one Rift Map Fragment, the first time (map v2; the grant id is the receipt).
      const had = this.inventory.stackOf(FRAGMENT_ID);
      if (this.inventory.grantStack(`delve-shrine:${event.id}:fragment`, FRAGMENT_ID, 1) && this.inventory.stackOf(FRAGMENT_ID) > had) {
        this.gotItem(1, materialDisplay(FRAGMENT_ID)?.name ?? 'Rift Map Fragment', FRAGMENT_ID);
        this.message = `${this.message ? `${this.message} ` : ''}${this.t('play.map.fragment.got')}`;
      }
      return;
    }
    if (event.kind === 'mark') {
      // One of the Four's hammer-marks: the rubbing is filed once (Kael's "Four Hammers"), with a little Delving XP.
      const fresh = HAMMER_MARK_FLAGS.includes(event.id) && !this.delve.isClaimed(event.id) && this.delve.claim(event.id);
      if (fresh) {
        const result = this.skillActions.act({ mutationId: `delve-mark:${event.id}`, skill: 'delving', xp: HAMMER_MARK_XP, locationId: EMBER_DELVE_LOCATION });
        if (result.ok) this.toastLoot(`+${HAMMER_MARK_XP} Delving XP`);
      }
      const n = HAMMER_MARK_FLAGS.filter(flag => this.delve.isClaimed(flag)).length;
      this.message = this.t(fresh ? 'play.uh.mark.filed' : 'play.uh.mark.again', { n });
      return;
    }
    if (event.kind === 'mystery') { this.mysteryFound(event.id); return; }
    // The Living World's words (signposts, ruins, cellars, seam-engines, a hermit's door): EN + ES, a field note's XP once.
    if (event.id.startsWith('living:')) { this.livingNote(event.id.slice('living:'.length)); return; }
    const note = fieldNoteFor(event.id);
    if (note) {
      const result = this.skillActions.act({ mutationId: `delve-fieldnote:${note.id}`, skill: 'delving', xp: FIELD_NOTE_XP, locationId: EMBER_DELVE_LOCATION });
      const fresh = result.ok && !result.replayed;
      if (fresh) this.toastLoot(`+${FIELD_NOTE_XP} Delving XP`);
      this.message = `${fresh ? this.t('play.delve.fieldNote.new') : ''}${note.text}`;
      return;
    }
    const text = inscriptionById(event.id)?.text ?? this.t('play.hud.msg.unreadable');
    const fresh = this.delveLore.recordInscription(event.id);
    if (fresh) {
      const result = this.skillActions.act({
        mutationId: `delve-inscription:${event.id}`, skill: 'delving', xp: INSCRIPTION_XP, locationId: EMBER_DELVE_LOCATION,
      });
      if (result.ok) this.toastLoot(`+${INSCRIPTION_XP} Delving XP`);
    }
    this.message = `${fresh ? this.t('play.hud.msg.newInscription') : ''}${text}`;
  }
  // ── The Living World (docs/handoff/living-world.md) ──
  /** A Living World note read: its words, a little Delving XP the first time, and a hermit's gift once ever. */
  private livingNote(id: string): void {
    const key = `play.living.note.${id}`;
    if (!LIVING_I18N[key]) { this.message = this.t('play.hud.msg.unreadable'); return; }
    const result = this.skillActions.act({ mutationId: `living-note:${id}`, skill: 'delving', xp: LIVING_NOTE_XP, locationId: EMBER_DELVE_LOCATION });
    const fresh = result.ok && !result.replayed;
    if (fresh) this.toastLoot(`+${LIVING_NOTE_XP} Delving XP`);
    this.message = `${fresh ? this.t('play.living.note.new') : ''}${this.t(key)}`;
    const hermit = hermitOfNote(id);
    if (!hermit) return;
    const had = this.inventory.stackOf(hermit.gift.materialId);
    if (this.inventory.grantStack(`living-hermit:${hermit.id}`, hermit.gift.materialId, hermit.gift.qty) && this.inventory.stackOf(hermit.gift.materialId) > had) {
      const item = materialDisplay(hermit.gift.materialId)?.name ?? hermit.gift.materialId;
      this.gotItem(hermit.gift.qty, item, hermit.gift.materialId);
      this.message = `${this.message} ${this.t('play.living.hermit.gift', { name: this.t(`play.living.hermit.${hermit.id}.name`), qty: hermit.gift.qty, item })}`;
    }
  }
  /** Today's mysteries already paid (this page; the ledger keeps the rest). */
  private readonly mysteriesPaid = new Set<string>();
  /** One of the day's mysteries: Delving XP and a small find, once a day each (the ledger key is its id); Glim answers. */
  private mysteryFound(id: string): void {
    const kind = id.split(':')[2] as MysteryKind;
    const reward = MYSTERY_REWARD[kind];
    if (!reward) return;
    if (kind === 'whisper') this.message = this.t('play.living.mystery.whisper');
    const result = this.skillActions.act({ mutationId: `living-mystery:${id}`, skill: 'delving', xp: reward.xp, locationId: EMBER_DELVE_LOCATION });
    const fresh = result.ok && !result.replayed;
    this.mysteriesPaid.add(id);
    this.engine?.setMysteriesFound(this.mysteriesPaid);
    if (!fresh) { if (kind !== 'whisper') this.message = this.t('play.living.mystery.again'); return; }
    this.toastLoot(this.t('play.living.mystery.reward', { xp: reward.xp }));
    if (reward.item) {
      const had = this.inventory.stackOf(reward.item.materialId);
      if (this.inventory.grantStack(`living-mystery:${id}:item`, reward.item.materialId, reward.item.qty) && this.inventory.stackOf(reward.item.materialId) > had) {
        this.gotItem(reward.item.qty, materialDisplay(reward.item.materialId)?.name ?? reward.item.materialId, reward.item.materialId);
      }
    }
    // Glim has an opinion (a bond line; at most one a few minutes, and only once Glim is met).
    if (this.glimVoice.met) this.bondLine(`mystery.${kind}`, `play.living.glim.${kind}`, 3 * 60_000);
  }
  /** A critter caught with a swing: its drop, once a day per creature (keyed by its spawn id and the day). */
  private critterCaught(event: { id: string; critter: string }): void {
    const def = CRITTERS[event.critter as CritterId];
    if (!def?.drop) return;
    const name = this.t(`play.living.critter.${def.id}`);
    const day = Math.floor(Date.now() / 86_400_000);
    const had = this.inventory.stackOf(def.drop.materialId);
    const granted = this.inventory.grantStack(`living-catch:${day}:${event.id}`, def.drop.materialId, def.drop.qty) && this.inventory.stackOf(def.drop.materialId) > had;
    if (!granted) { this.message = this.t('play.living.catch.again', { critter: name }); return; }
    const item = materialDisplay(def.drop.materialId)?.name ?? def.drop.materialId;
    this.gotItem(def.drop.qty, item, def.drop.materialId);
    this.message = this.t('play.living.catch', { critter: name, qty: def.drop.qty, item });
  }
  private act(target: InteractionTarget): void {
    if (!this.browser || this.state?.paused || this.state?.defeated) return;
    if (target === 'ore') this.mine();
    if (target === 'forge') this.forge();
    if (target === 'beacon') this.restore();
    if (target === 'passage') this.message = '';
    this.sync();
  }
  private mine(): void {
    if (this.remaining > 0) return;
    if (!this.activity.selectCurrentWork('mining', BASALT_SEAMWORKS_ID)) {
      this.message = this.t('play.hud.msg.miningNotSavedStorage'); return;
    }
    this.pendingMine ??= `world-mine:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const result = this.activity.resolveMine({ mutationId: this.pendingMine, locationId: BASALT_SEAMWORKS_ID, oreId: CINDER_ORE_ID });
    this.now = Date.now();
    if (!result.ok) {
      this.message = this.t(result.code === 'capacity' ? 'play.hud.msg.mineFull' : result.code === 'persist' ? 'play.hud.msg.minePersist' : 'play.hud.msg.mineRecovering');
      if (result.code !== 'persist') this.pendingMine = null;
      return;
    }
    this.pendingMine = null;
    this.message = this.t('play.hud.msg.oreGathered');
    // Scoped tutorial supply, separate from the global 800-action discovery guarantee.
    // Reuse the storyboard's claim ID so switching prototypes cannot duplicate it.
    if (this.activity.snapshot.miningAccepted >= 8 && !this.edge && this.ember < 1) {
      const granted = this.inventory.grantStack(TUTORIAL_EMBER_ID, EMBER_RESIDUE_ID, 1);
      this.message = this.t(!granted ? 'play.hud.msg.emberNotStored' : this.ember > 0 ? 'play.goal.forge.ember' : 'play.hud.msg.emberClaimed');
    } else if (this.ember >= 1 && this.ore >= 6) this.message = this.t('play.hud.msg.forgeReady');
  }
  private forge(): void {
    if (this.edge) {
      this.message = this.t(this.equipped ? 'play.hud.msg.edgeWorn' : this.inventory.equip(this.edge.id, 'weapon') ? 'play.hud.msg.edgeEquipped' : 'play.hud.msg.equipFailed');
      return;
    }
    const result = this.inventory.craftBasaltEdge(CRAFT_ID);
    this.message = this.t(result.ok ? 'play.hud.msg.edgeCrafted' : result.code === 'persist' ? 'play.hud.msg.craftPersist' : result.code === 'capacity' ? 'play.hud.msg.craftRoom' : 'play.goal.forge.need');
    if (result.ok) this.activity.markCraftedBasaltEdge();
  }
  private restore(): void {
    if (this.restored) { this.message = this.t('play.hud.msg.beaconBurns'); return; }
    if (!this.state?.enemyDefeated) { this.message = this.t('play.hud.msg.beaconGuarded'); return; }
    const saved = { restored: true, era: INVENTORY_ERA, resetAt: this.store.readRaw(RESET_STAMP_KEY) };
    this.store.write(SAVE_KEY, saved);
    if (this.store.readRaw(SAVE_KEY) !== JSON.stringify(saved)) { this.message = this.t('play.hud.msg.beaconNotSaved'); return; }
    this.restored = true;
    this.message = this.t('play.hud.msg.beaconLit');
  }
}
