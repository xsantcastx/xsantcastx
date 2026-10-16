import { SocialRoom, RoomSnapshot } from './social/social-room';
import {
  afterNextRender, Component, ComponentRef, ElementRef, HostListener, Injector, NgZone, OnDestroy, PLATFORM_ID, ViewChild,
  ViewContainerRef, inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, distinctUntilChanged, map } from 'rxjs';
import { ActivityProgressionGateway } from '../shared/activity/activity-progression.gateway';
import { BASALT_SEAMWORKS_ID, CINDER_ORE_ID, EMBER_RESIDUE_ID, miningTierFor, type DisciplineProgress } from '../shared/activity/activity.model';
import { EconomyService } from '../shared/economy/economy.service';
import { InventoryService, type VaultRouted } from '../shared/rpg/inventory.service';
import { VAULT_STATION_I18N } from '../shared/vault/vault-station.i18n';
import { GameStateGateway } from '../shared/save/game-state.gateway';
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
import {
  CHARM_SLOT_IDS, EQUIPMENT_SLOTS, GameItem, ITEM_STAT_KEYS, ItemRarity, SLOT_BY_ID, SLOT_IDS, SlotId,
  formatItemMod, rarityColor, rarityLabel,
} from '../shared/rpg/item.model';
import { KeeperCombatStats, keeperCombatStats } from '../shared/rpg/keeper-combat';
import { KeeperStatSheetComponent } from '../shared/rpg/keeper-stat-sheet.component';
import { compareStats, StatDeltaRow } from '../shared/rpg/stat-delta';
import { HomesteadService } from './homestead/homestead.service';
import { HomesteadColumnComponent } from './homestead/homestead-column.component';
import { HomeForgeService } from './homestead/home-forge.service';
import { homeStationOf } from './world/homestead';
import { SeamworksEngine, EngineInput, EngineState, HeldItem, InteractionTarget, KeeperLoadout, KillEvent, PlaceableId, PlaceEvent, ToolTiers, UseEvent, WorldActionEvent } from './engine/engine';
import { ChestGearRow, ChestMove, ChestRow, DelveChestService } from '../shared/delve/delve-chest.service';
import { isChestHolder } from '../shared/delve/delve-save.model';
import { PLACEABLES, WARDEN_FLAG } from './engine/terrain';
import { miningLevelView } from '../shared/activity/mining-level';
import { toolCard, toolCardLines, toolPower, toolTiers } from '../shared/skills/tools';
import { heldToolPieces, heldToolsKey, type HeldToolKind } from '../shared/skills/held-tool';
import { TOOLS_I18N } from '../shared/skills/tools.i18n';
import { CharacterHubService } from '../shared/character/character-hub.service';
import { STARTER_FAMILIES, starterInstanceId, starterToolId } from '../shared/skills/tool-items';
import { SkillActionService } from '../shared/skills/skill-actions.service';
import { SKILLS, skillForDiscipline, skillLevel } from '../shared/skills/skill.model';
import { keeperDeeds } from './world/keeper-lines';
import { DELVE_MISSIONS } from '../shared/npc/delve-missions.model';
import { huntingXpFor } from '../shared/skills/hunting';
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
import { BOUNTIES_I18N } from '../shared/bounties/bounties.i18n';
import { HEIGHTS_I18N } from './world/heights.i18n';
import { HeightsService } from '../shared/heights/heights.service';
import type { HeightFindEvent } from './engine/engine.model';
import { COMPASS_ID, FRAGMENT_ID, bountyLine, stratumOfRow, type Bounty, type BountyEvent } from '../shared/bounties/bounty.model';
import { GLIM_MARK_COLOR, MAX_PINS, PIN_COLORS, PIN_ICONS, cleanPinName, newPinId, type MapPin, type PinIcon } from '../shared/delve/map-pins.model';
import { GLIM_MARKS, activeMark } from '../shared/glim/glim';
// The Mirror Slate (docs/handoff/mirror-slate.md): the HUD button, P, the busy rule, Lune's and Kael's counters.
import { SlateService } from '../shared/slate/slate.service';
// The world clock (docs/handoff/world-clock.md): the sky, the hour the world keeps, the eclipse and Sera Quill's ledger.
import { WorldClockService } from '../shared/world-clock/world-clock.service';
import { EclipseService } from '../shared/world-clock/eclipse.service';
import { WORLD_CLOCK_I18N } from '../shared/world-clock/world-clock.i18n';
import { ECLIPSE_GLASS_ID, ECLIPSE_SHRINE, REALM_HUNT } from '../shared/world-clock/eclipse.model';
import { clockText, worldSpan, type Sky, type SkyPhase } from '../shared/world-clock/world-clock.model';
import { SlateCounterComponent } from '../shared/slate/slate-counter.component';
import { SLATE_I18N } from '../shared/slate/slate.i18n';
// Make your Keeper (docs/handoff/make-your-keeper.md): the chosen look, worn gear as layers, the Glass of Becoming.
import { KeeperLookService } from '../shared/keeper-look/keeper-look.service';
import { KEEPER_LOOK_I18N } from '../shared/keeper-look/keeper-look.i18n';
import { lookKey, type KeeperLook } from '../shared/keeper-look/keeper-look.model';
import { gearKey } from '../shared/keeper-look/keeper-gear';
import { wornGear } from '../shared/keeper-look/worn-gear';
import { KeeperPainter } from '../shared/keeper-look/keeper-paint';
import { LevelUpService } from '../shared/activity/level-up.service';
import { npcPortrait } from '../shared/keeper-look/npc-portrait';
import { OnboardingService } from '../shared/onboarding/onboarding.service';
import { CROUPIER_STATIONS, KAEL_STATION, slateBadge, slateRefusal, type SlateTier } from '../shared/slate/slate.model';
import type { PanelEntry } from './world/panel-registry';
import { SoundService } from '../shared/sound/sound.service';
import { SoundSheetComponent } from '../shared/sound/sound-sheet.component';
// Loot & combat (docs/design/loot-and-combat.md): drops, auras, difficulty, the corpse run.
import { LootService } from '../shared/loot/loot.service';
import { LootSheetComponent } from '../shared/loot/loot-sheet.component';
import { LOOT_I18N } from '../shared/loot/loot.i18n';
import { lootEntry } from '../shared/loot/drop-tables';
import { itemAuras } from '../shared/loot/aura-sources';
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
interface BagSlip {
  name: string; art: string; mark: string; kicker: string; note: string; stats: string[]; canWear: boolean; canStow: boolean;
  /** Rarity colour for the card's name and frame; null for materials. */
  tone?: string | null;
  /** A loose satchel item: a secondary "Send to Vault" makes room from anywhere. */
  canSend?: boolean;
  /** How many identical pieces the picked cell holds: "Send 7 to Vault" moves them all. */
  count?: number;
  /** Wearing it, against what that place holds now. Empty for worn items and materials. */
  compare: StatDeltaRow[];
  /** "Against Basalt Edge" / "Against an empty Head". */
  compareLabel: string;
}

/** What the in-world panel is showing: a hosted page, the waystone's travel list, or a chest placed in the Delve. */
interface OpenPlace {
  kind: 'page' | 'waystone' | 'chest' | 'slate'; stationId: string; title: string; kicker: string;
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

@Component({
  selector: 'app-side-scroller', standalone: true, imports: [RouterLink, KeeperStatSheetComponent, HomesteadColumnComponent, LineTensionComponent, GlimIconComponent, SlateCounterComponent, GlimTalkComponent, GlimChatComponent, SoundSheetComponent, LootSheetComponent, PetSheetComponent, StorySceneComponent, SheetDragDirective],
  templateUrl: './side-scroller.component.html', styleUrls: ['./side-scroller.component.css'],
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
  private readonly economy = inject(EconomyService);
  /** Loot & combat: drops, the aura, the difficulty, the corpse run (shared/loot). */
  private readonly loot = inject(LootService);
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
  /** The Homestead has something worth a look: the button wears a badge. */
  slateReady = false;
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
  /** Where each hooked cast's bob sat (a catch bounty needs the water's column). */
  private readonly hookedAt = new Map<string, { liquid: string; col: number; row: number }>();

  constructor() {
    // Hydration can swap the server canvas after the first callback. Wait until
    // the canvas that is actually on screen has a size, then draw into that one.
    afterNextRender(() => this.startWorld());
    // The hearth pill renders on the server too: its strings must exist before the engine does.
    this.i18n.register(HEARTH_I18N);
    this.i18n.register(HUD_I18N);
    this.i18n.register(ACCOUNT_I18N);
    this.i18n.register(TOOLS_I18N);
    this.i18n.register(VAULT_STATION_I18N);
    this.i18n.register(SLATE_I18N);
    this.i18n.register(REALM_MACHINES_I18N);
    this.i18n.register(WORLD_CLOCK_I18N);
    this.i18n.register(KEEPER_LOOK_I18N);
    this.i18n.register(PETS_I18N);
    this.i18n.register(CABINETS_I18N);
    this.i18n.register(LIVING_I18N);
    this.map.onTap = (col, row) => this.zone.run(() => this.mapTap(col, row));
    try { this.trackedPinId = localStorage.getItem(TRACK_KEY) || null; } catch { /* nothing tracked */ }
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
      this.homeSub = this.homestead.hud$.subscribe(hud => { this.boughtBuilding = hud.rows.some(row => row.owned > 0); });
      // After the caller's own line ("Ore gathered"): the grant announces before the caller writes it.
      this.routedSub = this.inventory.routed$.subscribe(routed => queueMicrotask(() => this.zone.run(() => this.onRouted(routed))));
      this.timer = setInterval(() => this.zone.run(() => { this.now = Date.now(); this.mountEngine(); this.pushStats(); this.refreshGuide(); this.tickDelveV2(); this.drawMaps(); this.tickSlate(); this.tickScan(); this.tickClock(); this.tickWorld(); }), 200);
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
    this.i18n.register(FISHING_I18N);
    this.i18n.register(GLIM_I18N);
    this.i18n.register(GLIM_BOND_I18N);
    this.i18n.register(GLIM_ALIVE_I18N);
    this.i18n.register(STORY_I18N);
    this.i18n.register(BOUNTIES_I18N);
    this.i18n.register(HEIGHTS_I18N);
    this.i18n.register(SOUND_I18N);
    this.i18n.register(LOOT_I18N);
    this.i18n.register(ONE_WORLD_I18N);
    this.i18n.register(TRAVEL_MAP_I18N);
    this.keeperKey = ''; this.marksKey = '';
    this.engine = new SeamworksEngine(canvas, {
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
      onLoot: loot => this.zone.run(() => (loot.item || loot.rune ? this.collectGear(loot.id, loot)
        : (loot.coins > 0 ? this.collectCoins(loot.id, loot.coins) : true)
        && (loot.ore === 0 || this.collectMaterial(loot.id, loot.material ?? CINDER_ORE_ID, loot.ore)))),
      // What a kill drops on top of its area's table (shared/loot/drop-tables.ts). Outside the zone: pure rolls.
      rollLoot: kill => this.loot.rollLoot(kill).map((drop, i) => lootEntry(drop, `loot${i}`)),
      // The corpse run's purse, walked over: its Gold comes home.
      onPurse: () => this.zone.run(() => {
        const gold = this.loot.recover();
        if (gold > 0) { this.message = this.t('play.loot.recovered', { n: gold }); this.sound.sfx('coin'); this.bump('.coin-count'); }
      }),
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
    this.bindPointer(canvas);
    this.engine.start();
    if (this.panel) this.engine.setPaused(true);
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
    this.economy.earnGold(coins, 'hunt');
    this.coinsKept += coins;
    this.writePlay({ coins: this.coinsKept });
    this.bump('.coin-count');
    this.sound.sfx('coin');
    return true;
  }
  /**
   * A gear or rune drop reached the Keeper: LootService mints it (the roll is
   * frozen then) or grants the rune. False leaves it shining on the ground.
   */
  private collectGear(dropId: string, loot: { item?: { definitionId: string; rarity: LootRarity; unique: boolean }; rune?: string }): boolean {
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
  private playSave(): { town?: unknown; coins?: unknown } {
    const raw = this.store.read(PLAY_KEY);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as { town?: unknown; coins?: unknown } : {};
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
      + 'box-shadow:0 0 0 2px var(--adventure-hud-shadow),0 0 22px var(--adventure-ember);color:var(--adventure-parchment);font:600 14px Orbitron,sans-serif;';
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
    this.companions.flush();
    this.room?.leave(); this.engine?.destroy(); if (this.timer) clearInterval(this.timer);
    if (this.oneWorld) { this.waystones.cancel(); this.waystones.attach(null); }
    if (this.browser) { this.homestead.stop(); document.body.classList.remove(WORLD_ROUTE_CLASS); this.placePanel?.nativeElement.removeEventListener('click', this.panelLinkClick, true); }
    this.unbindFeel();
    this.atSub?.unsubscribe(); this.delveSub?.unsubscribe(); this.gatherSub?.unsubscribe(); this.homeSub?.unsubscribe(); this.slateSub?.unsubscribe(); this.storageSub?.unsubscribe(); this.launchSub?.unsubscribe(); this.cabinetSub?.unsubscribe(); this.joySub?.unsubscribe(); this.routedSub?.unsubscribe(); this.heightsSub?.unsubscribe(); this.unbindPointer?.(); this.panelHost?.clear();
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
    this.engine?.setPaused(true);
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
    const area = this.state.areaId ?? this.town.id;
    if (this.placesCache?.area !== area) {
      const stations = (areaOf(this.town, area) ?? this.town).stations;
      this.placesCache = { area, rows: stations.map(station => ({ id: station.id, name: titleCase(station.label), blurb: station.blurb ?? '' })) };
    }
    return this.placesCache.rows;
  }
  togglePlaces(): void {
    this.placesOpen = !this.placesOpen;
    // The nudge is a one-time thing: seen once the list is open (the entry stays).
    this.lookNudgeShown = this.placesOpen && this.lookNudge;
    if (this.placesOpen && this.lookNudge) { this.looks.markPrompted(); this.lookNudge = false; }
    if (this.placesOpen) setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('#places-list li button')?.focus());
  }
  /** Walk to the place and interact on arrival; with reduced motion, go there and open it at once. */
  choosePlace(place: PlaceRow): void {
    this.placesOpen = false;
    if (!this.engine?.goToStation(place.id, this.reducedMotion)) {
      this.message = this.t(this.state.paused ? 'play.hud.msg.closeFirst' : 'play.hud.msg.cannotTravel');
    }
    // The list (and the focused row) is gone: keep the keyboard in the world, not on <body>.
    this.focusWorld();
  }
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
    const goal = firstGoal({
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
    // After the four goals: the Rune Forge, once, the first time a strike is affordable.
    const next = goal ?? runeForgeHint({
      goalsDone: true,
      gold: this.economy.snapshot.gold,
      strikeCost: STRIKE_COST,
      seen: this.runeHintSeen,
      areaId,
    });
    if (next?.key !== this.guide?.key || next?.n !== this.guide?.n) this.guide = next;
    this.tickStory({
      met: this.glimVoice.met,
      bought: this.boughtBuilding,
      armed: !!worn && !worn.explorerId,
      hunted: (progress.xpByDiscipline['hunting'] ?? 0) > 0,
      dug: this.delve.hasDug('ember-delve'),
    });
    this.tickGlim(areaId, !goal, (progress.xpByDiscipline['hunting'] ?? 0) > 0, !!worn && !worn.explorerId);
    this.tickBond(areaId);
    this.tickPets();
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
  get petAt(): { id: string; x: number; state: string; fetching: boolean; glow: boolean; act: string; hits: number; gathers: number; finds: number; heals: number; command: string; level: number } | null { return this.engine?.petView ?? null; }
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
    const hint = this.glimVoice.ask(`goal.${goal.id}`, goal.key, Date.now());
    if (hint.walk) this.showGoal();
  }
  /** "Ask Glim for a hint (2 of 3)". */
  get glimAskLabel(): string {
    const goal = this.guide;
    if (!goal) return '';
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
    if (this.guide?.id === 'rune') this.markRuneHintSeen();
    this.placesOpen = false;
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
    try { if (await this.room?.chat(text)) { if (input.value.trim() === text) input.value = ''; } } finally { this.sending = false; }
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
  get huntingLevel(): number { return skillLevel(this.activity.snapshot.progress, 'hunting'); }
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
    if (this.placesOpen && event.key === 'Escape') { event.preventDefault(); this.closePlaces(); return; }
    // Escape inside the open Hearth folds it and hands focus back to the pill.
    if (this.hearthOpen && event.key === 'Escape' && (event.target as HTMLElement | null)?.closest?.('.dock')) {
      event.preventDefault(); this.toggleHearth(); return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return;
    if (event.code === 'KeyI') { event.preventDefault(); this.toggleBag(); }
    else if (event.code === 'KeyC' && this.campReady) { event.preventDefault(); this.descendToCamp(); }
    // One World: M is the Travel map (the world's map with its stones); it opens the full map from there.
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
  /** The HUD tick: which pane is held, and whether the Homestead has something worth a look. */
  private tickSlate(): void {
    this.slateTier = this.slate.tier();
    this.slateReady = this.slateTier > 0 && slateBadge(this.homestead.pendingAll(), this.economy.snapshot.perSecond);
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
    try { if (this.trackedPinId) localStorage.setItem(TRACK_KEY, this.trackedPinId); else localStorage.removeItem(TRACK_KEY); } catch { /* this session */ }
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
  choosePocket(pocket: BagPocket): void {
    this.pick = this.pickedPocket(pocket) ? null : { kind: pocket.kind, ref: pocket.ref };
  }
  /** Tap worn gear for its card (Stow). An empty place has nothing to say, so it closes the card. */
  chooseWell(well: BagWell): void {
    this.pick = !well.filled || this.pickedWell(well.id) ? null : { kind: 'slot', ref: well.id };
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
        tone: item ? rarityColor(item.rarity) : null,
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
      art: itemArt(item)?.src ?? '', qty: ids.length, pip: rarityColor(item.rarity), mark: monogram(item.name), ids,
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
    return {
      name, art: display?.art ?? '', mark: monogram(name), kicker: this.t('play.hud.slip.material'),
      note: fish ? `${fish.lore} ${fish.use}` : charm ? `${charm.lore} ${charm.effect}` : this.stackNote(stackKey, stack.quantity),
      stats: [this.t('play.hud.slip.held', { n: stack.quantity })],
      canWear: false, canStow: false, compare: [], compareLabel: '',
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
        tone: rarityColor(item.rarity),
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
      tone: rarityColor(item.rarity),
      note: item.lore || def?.lore || this.t(worn ? 'play.hud.slip.wornBy' : 'play.hud.slip.inSatchel'),
      // A D2-style aura the piece carries (its Socket Word or its name; shared/loot/aura-sources.ts).
      stats: [...stats, ...itemAuras(item).map(a => this.t('loot.aura.carries', { aura: this.t('loot.aura.' + a.aura), level: a.level }))],
      canWear: !worn && EQUIPMENT_SLOTS.some(slot => itemFitsSlot(slot.id, item)),
      canStow: worn,
      canSend: !worn,
      ...this.slipCompare(item, worn),
    };
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
      compare: compareStats(item.stats, there?.stats, { includeUnchanged: true }),
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
    const key = `${lookKey(look)}#${gearKey(gear)}`;
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
    const fresh = this.onboarding.finishedHere || this.onboarding.shouldOnboard();
    if (!look.made && !this.makerOffered && fresh && ++this.makerWait > 8 && !this.panel && !this.storyCard && !this.storyScene && !this.glimTalk) {
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
      new KeeperPainter(look, gear).still(el);
      this.dollFigure = el.toDataURL('image/png');
    } catch { /* no 2D canvas: the doll frame stays empty */ }
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
  get menuOpen(): boolean { return this.bagOpen || this.placesOpen || this.soundOpen || this.petsOpen || (!!this.panel && this.panel.kind !== 'slate') || !!this.anchorSheet; }
  /** A tap on the dim around a menu puts the top one away (Escape does the same through each menu's own handler). */
  dismissMenu(): void {
    if (this.petsOpen) this.closePets();
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
    // The Banked Furnace banks itself again for a day after every fall.
    if (event.creature === 'banked-furnace') this.delve.claim(furnaceDayFlag(Date.now()));
    // The two rescues a hunt can earn (pets.model.ts): six Foragers, six Substitutes.
    if ((event.areaId === 'reflection-channels' && event.creature === 'prism-forager') || (event.areaId === 'unrecorded-corridors' && event.creature === 'mirror-substitute')) {
      this.pets.count(`kill:${event.areaId}`);
    }
    // A gate boss on this tier opens the next one (shared/loot/difficulty.model.ts).
    const opened = this.loot.killed(event.creature);
    if (opened) this.message = this.t('play.loot.unlocked', { tier: this.t('loot.tier.' + opened) });
    const base = huntingXpFor(event.hp);
    const xp = base + (this.petAbility === 'xp' && this.town.realm === 'luminous' ? xpBonus(base) : 0);
    const result = this.skillActions.act({ mutationId: `hunt:${event.id}`, skill: 'hunting', xp, locationId: this.worldLocation(event.areaId) });
    if (result.ok && !result.replayed) this.toastLoot(this.t('play.hunt.xp', { n: xp }));
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
