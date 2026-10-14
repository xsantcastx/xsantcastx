import { SocialRoom, RoomSnapshot } from './social/social-room';
import {
  afterNextRender, Component, ComponentRef, ElementRef, HostListener, Injector, NgZone, OnDestroy, PLATFORM_ID, ViewChild,
  ViewContainerRef, inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, distinctUntilChanged, map } from 'rxjs';
import { ActivityProgressionGateway } from '../shared/activity/activity-progression.gateway';
import { BASALT_SEAMWORKS_ID, CINDER_ORE_ID, EMBER_RESIDUE_ID, miningTierFor } from '../shared/activity/activity.model';
import { EconomyService } from '../shared/economy/economy.service';
import { InventoryService, type VaultRouted } from '../shared/rpg/inventory.service';
import { VAULT_STATION_I18N } from '../shared/vault/vault-station.i18n';
import { GameStateGateway } from '../shared/save/game-state.gateway';
import { INVENTORY_ERA } from '../shared/rpg/inventory.model';
import { RESET_STAMP_KEY } from '../shared/save/save-reset';
import { artFor, REALM_ART } from '../shared/art/art';
import { HOME_FORGE, IN_WORLD_FOCUS, IN_WORLD_PANEL } from '../shared/in-world-panel';
import { areaOf, findStation, REALM_TOWN_IDS, RealmTownId, StationDef, TOWN_LABELS, TOWNS, TownDef } from './world/world.model';
import { PANEL_REGISTRY } from './world/panel-registry';
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
import { HEARTH_I18N } from './world/hearth.i18n';
import { FIRST_GOALS_I18N } from './world/first-goals.i18n';
import { HUD_I18N } from './world/hud.i18n';
import { firstGoal, FirstGoalView, runeForgeHint } from './world/first-goals';
import { GLIM_I18N } from '../shared/glim/glim.i18n';
import { GlimService } from '../shared/glim/glim.service';
import { GlimVoice } from '../shared/glim/glim-voice';
import { GlimIconComponent } from '../shared/glim/glim-icon.component';
import { npcById } from '../shared/npc/npc.model';
import { NpcQuestService } from '../shared/npc/npc-quest.service';
import { STORY_I18N } from '../shared/story/story.i18n';
import { StoryService } from '../shared/story/story.service';
import { STORY_CARD_PARAGRAPHS } from '../shared/story/story';
import type { StoryCardId } from '../shared/story/story-save.model';
import { DelveSaveService } from '../shared/delve/delve-save.service';
import { DelveLoreService } from '../shared/delve/delve-lore.service';
import { GatherSaveService } from '../shared/skills/gather-save.service';
import { INSCRIPTION_XP, inscriptionById } from '../shared/delve/delve-lore.model';
import type { DiscoverEvent } from './engine/engine';
import { WORLD_ACTION_UNPAID } from './engine/engine.model';
import { restCueDue, settleDelveMine } from './delve-reward';
import { DelveMapView } from './delve-map-view';
import { FishingService, type PendingCatch } from '../shared/fishing/fishing.service';
import { FISHING_I18N } from '../shared/fishing/fishing.i18n';
import { LineTensionComponent } from '../shared/fishing/line-tension.component';
import { reelDuration } from '../shared/fishing/fishing-reel';
import { catchById, CRATE_IDS, fishingPerks, LODGE_CHARMS } from '../shared/fishing/fishing.model';
import { InfusionService } from '../shared/enchanting/infusion.service';
import { DROWNED_LAMP_FLAG } from './world/towns/infernal';
import type { BucketEvent, BucketId, FishEvent } from './engine/engine';
import { HOTBAR_FIXED } from './engine/terrain';
import { MAP_MARKER_COLORS } from './engine/delve-map';

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
interface BagPocket { key: string; kind: 'stack' | 'item'; ref: string; name: string; art: string; qty: number; pip: string; mark: string; ids: string[]; }
interface BagWell { id: SlotId; name: string; art: string; mark: string; label: string; filled: boolean; }
interface BagSlip {
  name: string; art: string; mark: string; kicker: string; note: string; stats: string[]; canWear: boolean; canStow: boolean;
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
  kind: 'page' | 'waystone' | 'chest'; stationId: string; title: string; kicker: string; route?: string;
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

interface LootToast { key: number; text: string }
/** One slot of the Delve hotbar: a placeable and how many the satchel holds. */
interface HotbarSlot { id: PlaceableId | BucketId; name: string; art: string; count: number; key: string }
/** Hotbar slots past key 0, shown only while the satchel holds some: the obsidian block and the buckets. */
const HOTBAR_EXTRA: readonly (PlaceableId | BucketId)[] = ['seam-bucket', 'seam-bucket-water', 'seam-bucket-lava'];
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

@Component({
  selector: 'app-side-scroller', standalone: true, imports: [RouterLink, KeeperStatSheetComponent, HomesteadColumnComponent, LineTensionComponent, GlimIconComponent],
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
  town: TownDef = TOWNS.infernal!;
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
  glimAt: { x: number; targetX: number | null; arrived: boolean; dimmed: boolean } | null = null;
  /**
   * The Keeper's story (shared/story): beats are read off the save each HUD
   * tick; a beat reached live speaks through Glim's line, and an act boundary
   * raises its story card. The first moments of a visit only catch up
   * (STORY_CATCH_UP_MS), so a loaded save is never walked back through it.
   */
  private readonly story = inject(StoryService);
  private readonly quests = inject(NpcQuestService);
  private readonly openedAt = Date.now();
  /** The act-boundary card on screen, or null. */
  storyCard: { id: StoryCardId; paragraphs: string[] } | null = null;
  /** The Homestead's Gold list is unfolded: on phones it takes the HUD plates' place. */
  columnOpen = false;
  private readonly zone = inject(NgZone);
  private readonly i18n = inject(TranslationService);
  /** A translated string (EN / ES). The hotbar, the gathering prompt and the Hunting toast use it. */
  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
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
  pick: BagPick | null = null;
  showKeys = false;
  now = Date.now();
  message = '';
  /** Last combat numbers handed to the engine. Drives the HP meter's ceiling. */
  pushed: KeeperCombatStats = { damage: 10, maxHp: 100 };
  private statsKey = '';
  private toolKey = '';
  /** The Delve hotbar, rebuilt on the HUD tick when a count changes. */
  hotbar: HotbarSlot[] = [];
  private hotbarKey = '';
  /** The hotbar's choice: what B / a long-press places. */
  placing: PlaceableId | BucketId | null = null;
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
  readonly map = new DelveMapView(() => this.engine?.mapSource() ?? null);

  constructor() {
    // Hydration can swap the server canvas after the first callback. Wait until
    // the canvas that is actually on screen has a size, then draw into that one.
    afterNextRender(() => this.startWorld());
    // The hearth pill renders on the server too: its strings must exist before the engine does.
    this.i18n.register(HEARTH_I18N);
    this.i18n.register(HUD_I18N);
    this.i18n.register(TOOLS_I18N);
    this.i18n.register(VAULT_STATION_I18N);
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
    this.inventory.init();
    this.activity.init();
    this.homestead.start();
    const saved = this.store.read(SAVE_KEY) as { era?: number; resetAt?: string | null; restored?: boolean } | null;
    this.restored = saved?.restored === true && saved.era === INVENTORY_ERA && saved.resetAt === this.store.readRaw(RESET_STAMP_KEY);
    this.economy.init();
    this.infusions.init();
    // Back where the Keeper last stood. A `?at=` link resolves after this and still wins.
    const play = this.playSave();
    const home = typeof play.town === 'string' ? TOWNS[play.town as RealmTownId] : undefined;
    if (home) this.town = home;
    this.coinsKept = Number.isInteger(play.coins) && (play.coins as number) > 0 ? play.coins as number : 0;
    this.zone.runOutsideAngular(() => {
      this.room = new SocialRoom(snapshot => this.zone.run(() => {
        this.social = snapshot;
        this.engine?.setPeers(snapshot.players.filter(p => p.id !== snapshot.id).map(p => ({ ...p, area: p.zone, facing: p.facing, animation: p.animation })));
        this.engine?.setChat(snapshot.messages, snapshot.id);
      }));
      this.mountEngine();
      // Only a change of `at` moves the world: a hosted page that writes its own query
      // (the Character hub's ?tab=) must not read as "no place open" and close itself.
      this.atSub = this.route.queryParamMap.pipe(map(params => params.get('at')), distinctUntilChanged())
        .subscribe(at => this.zone.run(() => this.applyAt(at)));
      // Cloud save replaced the Delve (another device's dig): rebuild it from the merged save.
      this.delveSub = this.delve.reloaded$.subscribe(() => this.engine?.setDelve(this.delve));
      // Cloud save merged another device's harvests: nodes re-read their regrowth.
      this.gatherSub = this.gatherSave.reloaded$.subscribe(() => this.engine?.setGathering(this.gatherSave));
      this.homeSub = this.homestead.hud$.subscribe(hud => { this.boughtBuilding = hud.rows.some(row => row.owned > 0); });
      // After the caller's own line ("Ore gathered"): the grant announces before the caller writes it.
      this.routedSub = this.inventory.routed$.subscribe(routed => queueMicrotask(() => this.zone.run(() => this.onRouted(routed))));
      this.timer = setInterval(() => this.zone.run(() => { this.now = Date.now(); this.mountEngine(); this.pushStats(); this.refreshGuide(); this.drawMaps(); }), 200);
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
    this.i18n.register(FIRST_GOALS_I18N);
    this.i18n.register(FISHING_I18N);
    this.i18n.register(GLIM_I18N);
    this.i18n.register(STORY_I18N);
    this.keeperKey = '';
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
      onLoot: loot => this.zone.run(() => (loot.coins > 0 ? this.collectCoins(loot.id, loot.coins) : true)
        && (loot.ore === 0 || this.collectMaterial(loot.id, loot.material ?? CINDER_ORE_ID, loot.ore))),
      onWorldAction: event => this.zone.run(() => this.worldAction(event)),
      onDiscover: event => this.zone.run(() => this.discover(event)),
      onPlace: event => this.zone.run(() => this.placeFromSatchel(event)),
      onTakeBack: event => this.zone.run(() => this.takeToSatchel(event)),
      onUse: event => this.zone.run(() => this.useCell(event)),
      onBucket: event => this.zone.run(() => this.bucketSwap(event)),
      onFish: event => this.zone.run(() => this.fishHooked(event)),
      onKill: event => this.zone.run(() => this.hunted(event)),
      // Each player digs their own Delve: seed and dug cells from the save.
      delve: this.delve,
      // Gathering regrowth is measured from saved harvest times, so a reload keeps it.
      gathering: this.gatherSave,
      onState: (state: EngineState) => this.zone.run(() => {
        if (state.message !== this.state.message) this.message = '';
        if (state.delve && !this.state.delve) this.refundOrphanChests();
        // At the shaft: is there a camp below to descend to? Asked once per arrival, not per frame.
        if (state.nearby === 'delve' && this.state.nearby !== 'delve') this.campReady = !!this.engine?.hasDelveCamp();
        else if (state.nearby !== 'delve') this.campReady = false;
        this.state = state;
        // Fishing and liquids on the canvas, for tests and tools (the HUD says it in words).
        const el = this.canvas?.nativeElement;
        if (el) {
          el.setAttribute('data-fishing', state.fishing?.phase ?? (state.canFish ? `can:${state.canFish}` : ''));
          el.setAttribute('data-liquid', state.liquid?.in ?? '');
        }
        this.room?.update(state.x, state.y, state.area || 'Basalt Seamworks', state.facing === -1 ? -1 : 1, state.animation ?? 'idle');
      }),
    });
    this.engine.setHomesteadView(this.homestead.scene);
    this.statsKey = '';
    this.loadoutKey = '';
    this.toolKey = '';
    this.engine.setPlaceable(this.placing);
    this.sync();
    this.engine.setPeers(this.social.players.filter(p => p.id !== this.social.id).map(p => ({ ...p, area: p.zone, facing: p.facing, animation: p.animation })));
    this.engine.setChat(this.social.messages, this.social.id);
    this.bindPointer(canvas);
    this.engine.start();
    if (this.panel) this.engine.setPaused(true);
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
    this.toastLoot(`+${quantity} ${name}`);
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
    return true;
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
    if (next.town === before.town && next.coins === before.coins) return;
    this.store.write(PLAY_KEY, next);
  }
  private toastLoot(text: string): void {
    const key = ++this.toastKey;
    this.lootToasts = [...this.lootToasts, { key, text }].slice(-3);
    setTimeout(() => { this.lootToasts = this.lootToasts.filter(toast => toast.key !== key); }, 1800);
  }
  ngOnDestroy(): void {
    this.room?.leave(); this.engine?.destroy(); if (this.timer) clearInterval(this.timer);
    if (this.browser) { this.homestead.stop(); document.body.classList.remove(WORLD_ROUTE_CLASS); }
    this.atSub?.unsubscribe(); this.delveSub?.unsubscribe(); this.gatherSub?.unsubscribe(); this.homeSub?.unsubscribe(); this.routedSub?.unsubscribe(); this.unbindPointer?.(); this.panelHost?.clear();
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
    if (!found) return;
    const town = TOWNS[found.townId];
    if (!town) return;
    if (town.id !== this.town.id || !this.engine.inTown) { this.town = town; this.engine.setTown(town); this.writePlay({ town: town.id as RealmTownId }); }
    const station = found.station;
    this.engine.placeAt(station.x);
    if (station.kind === 'panel' || station.kind === 'waystone') this.openStation(station);
  }
  private openStation(station: StationDef): void {
    if (!this.browser) return;
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
    this.showPanel({ kind: 'page', stationId: station.id, title: entry.title, kicker: entry.kicker, route: entry.route });
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
    this.showPanel({ kind: 'page', stationId: 'character', title: entry.title, kicker: entry.kicker, route: entry.route, own: true });
    this.loadPanel(entry, this.panelInjector);
  }
  /** Build a hosted page into the open panel (a slow import never lands in a newer or closed one). */
  private loadPanel(entry: (typeof PANEL_REGISTRY)[keyof typeof PANEL_REGISTRY], injector: Injector): void {
    const seq = this.panelSeq;
    this.panelLoading = true;
    entry.load().then(type => {
      if (seq !== this.panelSeq || !this.panel) return;
      this.panelHost.clear();
      this.panelRef = this.panelHost.createComponent(type, { injector });
      this.panelLoading = false;
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
    if (!this.panel) this.panelOpener = this.keyboardOpener();
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
    this.panelSeq++;
    this.panelHost.clear(); this.panelRef = null;
    this.panel = null; this.panelLoading = false; this.panelError = '';
    this.chestView = null;
    this.engine?.setPaused(false);
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
    const town = TOWNS[id];
    if (!town || town.id === this.town.id) { this.closePanel(); return; }
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
    if (this.placesOpen) setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('#places-list button')?.focus());
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
    const areaId = this.state.areaId ?? this.town.id;
    const goal = firstGoal({
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
  }
  /**
   * The story's tick: file the beats the save has reached; a live beat's lines
   * go to Glim's line (in order, after anything on screen), and a crossed act
   * boundary raises its card once the Keeper is back in the world.
   */
  private tickStory(goals: { met: boolean; bought: boolean; armed: boolean; hunted: boolean; dug: boolean }): void {
    if (!this.browser) return;
    const live = Date.now() - this.openedAt >= STORY_CATCH_UP_MS;
    const lines = this.story.advance({
      ...goals,
      inscriptions: this.delveLore.inscriptions(),
      missionDone: id => this.quests.isMissionDone(id),
      wardenDown: this.delve.isClaimed(WARDEN_FLAG),
    }, live);
    if (lines.length) this.glimVoice.story(lines);
    this.tickKeepers(goals);
    if (!this.storyCard && !this.panel && !this.map.open && !this.state.defeated) {
      const card = this.story.pendingCard();
      if (card) this.openStoryCard(card);
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
      goldEarned: economy.totalGoldEarned,
    });
    const beats = this.story.state.beats;
    const key = `${beats.join(',')}|${deeds.join(',')}`;
    if (key === this.keeperKey) return;
    this.keeperKey = key;
    this.engine.setKeeperContext({ beats: new Set(beats), deeds: new Set(deeds) });
  }
  private openStoryCard(id: StoryCardId): void {
    this.storyCard = { id, paragraphs: Array.from({ length: STORY_CARD_PARAGRAPHS[id] }, (_, n) => `story.card.${id}.p${n + 1}`) };
    this.bagOpen = false; this.placesOpen = false;
    this.glimVoice.dismiss();
    this.engine?.setHover(null);
    this.engine?.setPaused(true);
    setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.story-card__go')?.focus({ preventScroll: true }));
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
  get sayer(): { name: string; monogram: string; color: string } | null {
    const speaker = this.glimVoice.speech?.story?.speaker;
    if (!speaker || speaker === 'glim') return null;
    const npc = npcById(speaker);
    return npc ? { name: npc.name, monogram: npc.monogram, color: npc.color } : null;
  }
  /** The chapter the goal line belongs to (the Prologue wraps the four first goals). */
  get chapterTag(): string {
    return this.story.state.chapter === 'prologue' ? this.t('story.chapter.prologue') : '';
  }
  /** Glim's tick: maybe a line (glim.ts nextLine), the sprite shown once met, and where it is. */
  private tickGlim(areaId: string, goalsDone: boolean, hunted: boolean, armed: boolean): void {
    const voice = this.glimVoice;
    voice.tick({ now: Date.now(), panelOpen: !!this.panel || !!this.storyCard, areaId, armed, hunted, goalsDone, dimmed: !!this.glimAt?.dimmed });
    if (!this.engine) return;
    this.engine.setGlim(voice.met, voice.justMet);
    voice.justMet = false;
    const at = this.engine.glimView;
    this.glimAt = at.shown ? { x: at.x, targetX: at.targetX, arrived: at.arrived, dimmed: at.dimmed } : null;
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
  get ore(): number { return this.inventory.stackOf(CINDER_ORE_ID); }
  get ember(): number { return this.inventory.stackOf(EMBER_RESIDUE_ID); }
  get edge() {
    const edges = this.inventory.snapshot.items.filter(item => item.definitionId === 'basalt-edge' && !item.explorerId);
    return edges.find(item => item.equipped) ?? edges[0];
  }
  get equipped(): boolean { return !!this.edge?.equipped; }
  /** What the worn loadout buys in a fight. Strike drives damage, Ward max HP. */
  get combat(): KeeperCombatStats { return keeperCombatStats(this.inventory.snapshot.totals); }
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
    if (this.state?.nearby === 'hs-forge') return this.t('play.hud.act.strikeForge');
    if (this.state?.nearbyKind === 'panel' || this.state?.nearbyKind === 'waystone') return this.t('play.hud.act.enter', { name: titleCase(this.state.nearbyLabel ?? 'place') });
    const gather = this.state?.nearby === 'gather' ? this.state.gather : undefined;
    if (gather) {
      if (!gather.ready) return this.t('play.gather.regrowing', { name: gather.label, n: gather.seconds });
      if (gather.need) return this.t('play.gather.needs', { name: gather.label, need: gather.need });
      return this.t('play.gather.work', { name: materialDisplay(gather.materialId)?.name ?? gather.label });
    }
    switch (this.state?.nearby) {
      case 'ore': return this.remaining ? this.t('play.hud.act.seamRecovering', { n: this.remaining }) : this.t('play.hud.act.mine');
      case 'forge': return this.t(this.equipped ? 'play.hud.act.bladeEquipped' : this.edge ? 'play.hud.act.equipEdge' : 'play.hud.act.forgeEdge');
      case 'beacon': return this.t(this.restored ? 'play.hud.act.beaconRestored' : 'play.hud.act.restoreBeacon');
      case 'inscription': return this.t('play.delve.action.inscription');
      case 'chest': return this.t('play.delve.action.chest');
      case 'camp': return this.t('play.delve.action.camp');
      case 'delve': return this.campReady ? this.t('play.delve.action.enterTop') : this.t('play.delve.action.enter');
      case 'passage': return this.t(this.state.area === 'Ember Quarry' ? 'play.hud.act.returnSeamworks' : 'play.hud.act.enterQuarry');
      default: return this.t('play.hud.act.walkCloser');
    }
  }
  get actionDisabled(): boolean {
    if (this.state?.nearby === 'gather' && (!this.state.gather?.ready || !!this.state.gather?.need)) return true;
    return !this.state?.nearby || !!this.state.paused || !!this.state.defeated || (this.state.nearby === 'ore' && this.remaining > 0);
  }
  interact(): void { this.engine?.interact(); }
  returnToCamp(): void { this.message = ''; this.engine?.returnToCamp(); }
  restartHunt(): void { this.message = ''; this.engine?.restartHunt(); }
  retry(): void { this.returnToCamp(); }
  input(event: PointerEvent, input: EngineInput, down: boolean): void {
    event.preventDefault();
    if (down) (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.engine?.setInput(input, down);
  }
  @HostListener('window:keydown', ['$event'])
  onBagKey(event: KeyboardEvent): void {
    if (!this.browser || event.repeat) return;
    // A story card owns the keyboard: Escape (or Enter on Continue) closes it.
    if (this.storyCard) {
      if (event.key === 'Escape') { event.preventDefault(); this.closeStoryCard(); }
      return;
    }
    // An open place owns the keyboard. Escape closes it unless the page inside
    // already used the key (its own dialog, a reveal) — window is the last stop.
    if (this.panel) {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); this.closePanel(); }
      return;
    }
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
  readonly mapLegend = (['keeper', 'camp', 'chest', 'torch', 'inscription', 'shaft'] as const)
    .map(kind => ({ key: `play.map.legend.${kind}`, color: MAP_MARKER_COLORS[kind] }));
  /** The way-to-camp line under the full map. */
  get mapHint(): string {
    const n = this.map.campPath;
    return n < 0 ? this.t('play.map.noCamp') : n === 0 ? this.t('play.map.noWay') : this.t('play.map.toCamp', { n });
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
    if (this.bagOpen && !this.pick) this.ensurePick();
    // The book needs the room an open Hearth takes: fold it, like a station
    // does (the remembered choice stands for next time).
    if (this.bagOpen) this.hearthOpen = false;
  }
  choosePocket(pocket: BagPocket): void { this.pick = { kind: pocket.kind, ref: pocket.ref }; }
  chooseWell(well: BagWell): void { this.pick = { kind: 'slot', ref: well.id }; }
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
      this.ensurePick();
      return;
    }
    if (!this.inventory.stow(item.id)) { this.message = this.t('play.hud.msg.stowFailed', { name: item.name }); return; }
    const tab = this.inventory.itemById(item.id)?.explorerId?.replace(/^vault:/, '') ?? 'general-1';
    this.message = this.t('play.hud.msg.sentVault', { name: item.name, tab: this.t(`vault.tab.${tab}`) });
    this.pick = null;
    this.ensurePick();
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
      return { key: `stack:${stack.stackKey}`, kind: 'stack', ref: stack.stackKey, name, art: display?.art ?? '', qty: stack.quantity, pip: '#df9357', mark: monogram(name), ids: [] };
    });
    const gear: BagPocket[] = clusterBy(groupItems(snap.bag), group => familyOf(group.first)).map(({ first: item, ids }) => ({
      key: `item:${item.id}`, kind: 'item', ref: item.id, name: item.name,
      art: itemArt(item)?.src ?? '', qty: ids.length, pip: rarityColor(item.rarity), mark: monogram(item.name), ids,
    }));
    return [...materials, ...gear];
  }
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
  private ensurePick(): void {
    const first = this.pockets[0];
    this.pick = first ? { kind: first.kind, ref: first.ref } : { kind: 'slot', ref: 'weapon' };
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
      note: item.lore || def?.lore || this.t(worn ? 'play.hud.slip.wornBy' : 'play.hud.slip.inSatchel'),
      stats,
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
    const stats = this.combat;
    const key = `${stats.damage}:${stats.maxHp}`;
    if (key === this.statsKey) return;
    this.statsKey = key;
    this.pushed = stats;
    this.engine.setStats(stats);
  }
  /**
   * What the Keeper wears, for the engine to draw: the weapon and off-hand art
   * (the same `itemArt()` the satchel uses) and the highest worn rarity for the
   * aura. Visual only. Sent when it changes (checked on the HUD tick).
   */
  private pushLoadout(): void {
    if (!this.engine) return;
    const loadout = this.loadout();
    const key = `${loadout.weapon?.art}:${loadout.weapon?.rarity}|${loadout.offhand?.art}:${loadout.offhand?.rarity}|${loadout.auraRarity}`;
    if (key === this.loadoutKey) return;
    this.loadoutKey = key;
    this.engine.setLoadout(loadout);
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
    const ids: (PlaceableId | BucketId)[] = [...PLACEABLES.map(def => def.id), ...HOTBAR_EXTRA];
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
  choosePlaceable(id: PlaceableId | BucketId, quiet = false): void {
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
  private placeFromSatchel(event: PlaceEvent): boolean {
    if (!this.browser) return false;
    const name = materialDisplay(event.item)?.name ?? event.item;
    if (this.inventory.stackOf(event.item) < 1) {
      this.message = this.t('play.delve.noneLeft', { lname: this.placeName(event.item).toLowerCase() });
      return false;
    }
    const result = this.inventory.consumeStacks(event.mutationId, [{ id: event.item, count: 1 }]);
    if (!result.ok) {
      this.message = this.t('play.delve.chest.saveFailed');
      return false;
    }
    this.refreshHotbar();
    return true;
  }
  /** A placed thing comes back: one grant keyed by the take's mutation id. */
  private takeToSatchel(event: PlaceEvent): boolean {
    if (!this.browser) return false;
    if (event.item === 'chest' && !this.chests.isEmpty(event.areaId, event.index)) {
      this.message = this.t('play.delve.emptyChestFirst');
      return false;
    }
    if (!this.inventory.grantStack(event.mutationId, event.item, 1)) {
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
    const key = `${rod?.tier ?? 0}:${rod?.liquids.join('/') ?? ''}:${rod?.bite.toFixed(3) ?? 0}:${breath}:${elixir}`;
    if (key === this.fishKey) return;
    this.fishKey = key;
    this.engine.setFishing({ tier: rod?.tier ?? 0, liquids: rod?.liquids ?? [], bite: rod?.bite ?? 1 });
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
    if (!this.browser || !this.engine) return;
    const npc = this.store.read('eclipse-npc') as { claimed?: unknown } | null;
    const pageClaimed = Array.isArray(npc?.claimed) && npc!.claimed.includes('fish-drowned-lamp-2');
    if (this.fishing.lampAnswers({ biome: event.biome, liquid: event.liquid, pageClaimed, fallen: this.delve.isClaimed(DROWNED_LAMP_FLAG) })) {
      this.engine.landFish();
      this.engine.summon('drowned-lamp', (event.col + .5) * 32);
      return;
    }
    const pending = this.fishing.hooked({ castId: event.castId, biome: event.biome, liquid: event.liquid });
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
    this.engine?.landFish(recastIn);
    if (!landed) { this.message = this.t('play.fish.ui.saveFailed'); return; }
    this.toastLoot(this.t('play.fish.ui.landed', { name: landed.name, n: landed.qty, xp: landed.xp }));
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
    const items = got.map(row => `${row.qty} ${materialDisplay(row.id)?.name ?? row.id}`).join(', ');
    this.message = this.t('play.fish.ui.opened', { items });
    this.toastLoot(items);
    if (this.inventory.stackOf(pick.ref) < 1) this.ensurePick();
  }
  /** The picked stack is a crate (the slip shows Open). */
  get pickIsCrate(): boolean { return this.pick?.kind === 'stack' && CRATE_IDS.includes(this.pick.ref); }

  /** E beside (or a tap on) a placed chest or camp. */
  private useCell(event: UseEvent): void {
    if (!this.browser) return;
    if (event.kind === 'chest') {
      this.showPanel({ kind: 'chest', stationId: 'chest', title: this.t('play.place.chest'), kicker: this.t('play.delve.yourDelve'), chest: { areaId: event.areaId, index: event.index }, own: true });
      this.refreshChest(this.t('play.delve.chest.intro'));
    } else if (event.kind === 'camp') {
      // The Crafting Bench, opened on "Ready now": what you can make here with what you carry.
      const entry = PANEL_REGISTRY.crafting;
      this.showPanel({ kind: 'page', stationId: 'camp', title: this.t('play.delve.camp.title'), kicker: this.t('play.delve.camp.kicker'), own: true });
      this.loadPanel(entry, this.campInjector);
    }
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
      this.toastLoot(`+1 ${name}`);
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
      if (this.inventory.grantStack(`${event.mutationId}:grub`, 'ember-grub', event.qty ?? 1)) this.toastLoot(`+1 ${materialDisplay('ember-grub')?.name ?? 'Ember Grub'}`);
      return true;
    }
    // Plain dirt and placed blocks pay only the block.
    if (!event.xp && !(event.materialId && event.qty)) { this.grantBlock(event); return true; }
    if (event.kind === 'mine' && event.discipline === 'mining' && !event.site) {
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
      if (event.materialId) this.toastLoot(`+1 ${materialDisplay(event.materialId)?.name ?? event.materialId}`);
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
    const result = this.skillActions.act({
      // A hunting-ground node is booked where it stands; a Delve cell in the Delve.
      mutationId: event.mutationId, skill: skill.id, xp: event.xp, locationId: event.site ? this.worldLocation(event.areaId) : EMBER_DELVE_LOCATION,
      ...(event.materialId && event.qty ? { materialId: event.materialId, qty: event.qty } : {}),
    });
    if (!result.ok) {
      this.message = this.t(result.code === 'capacity' ? 'play.hud.msg.swingFull' : 'play.hud.msg.swingNotSaved');
      return false;
    }
    if (once) this.delve.claim(once);
    if (event.materialId && event.qty) this.toastLoot(`+${event.qty} ${materialDisplay(event.materialId)?.name ?? event.materialId}`);
    this.grantBlock(event);
    return true;
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
  private hunted(event: KillEvent): void {
    if (!this.browser) return;
    const xp = huntingXpFor(event.hp);
    const result = this.skillActions.act({ mutationId: `hunt:${event.id}`, skill: 'hunting', xp, locationId: this.worldLocation(event.areaId) });
    if (result.ok && !result.replayed) this.toastLoot(this.t('play.hunt.xp', { n: xp }));
  }
  /**
   * The Keeper read a carved wall. The first reading is recorded (for the
   * Archivist's missions and the Codex) and pays a little Delving XP, keyed by
   * the inscription so it can never pay twice; every reading shows the words.
   */
  private discover(event: DiscoverEvent): void {
    if (!this.browser || event.kind !== 'inscription') return;
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
