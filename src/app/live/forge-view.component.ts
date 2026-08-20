/**
 * forge-view.component.ts — /sanctum, the Inner Sanctum.
 *
 * A base-management screen over a progression that was, until now, only ever
 * visible as numbers in a header chip and a shop. The Keeper stands in the
 * middle wearing what has been bought, the forge's income runs down the left,
 * quests and expeditions down the right, and everything that happens lands in
 * the feed along the bottom.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS PAGE OWNS ALMOST NO STATE
 * ─────────────────────────────────────────────────────────────────────────────
 * Same rule as /forge-keeper, and for the same reason: EconomyService,
 * XpService, QuestService and ExplorerService each already know their own
 * piece, and a dashboard that keeps a second copy of the totals is a dashboard
 * that will eventually disagree with the header — and the visitor will believe
 * whichever one is bigger.
 *
 * The two things it does own are both genuinely local: the rolling activity
 * feed, which is a view of events that have already been banked elsewhere and
 * is deliberately not persisted, and whether the ambient hum is on.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SSR
 * ─────────────────────────────────────────────────────────────────────────────
 * Prerenders as a complete, cold forge: the Keeper at rank 1 with nothing
 * equipped, every mission length priced, the realm picker in full, an empty
 * feed. Nothing visitor-specific is read at construction time, and the browser
 * work is all in `ngOnInit` behind `isBrowser`, so the server's HTML and the
 * client's first render agree and there is no hydration flash.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FRAME BUDGET
 * ─────────────────────────────────────────────────────────────────────────────
 * Three services publish on this page at once — the economy ticks a second, the
 * explorers tick a second while a mission is out, and the flame publishes on
 * every strike. OnPush plus explicit `markForCheck` is what keeps that at one
 * pass a second rather than three: nothing here binds to a getter that walks a
 * catalog, and the embers and the forge glow are CSS reading custom properties
 * rather than anything Angular re-renders.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { EconomyService, EconomySnapshot } from '../shared/economy/economy.service';
import {
  ARTIFACTS,
  AUTO_CLICKERS,
  Artifact,
  COSMETICS,
  FORGE_UPGRADES,
  HAMMER_UPGRADES,
  MULTIPLIER_UPGRADES,
  formatCompact,
  formatCurrency,
  formatRate,
} from '../shared/economy/economy.model';
import { ForgeAudioService } from '../shared/economy/forge-audio.service';
import { ForgeFlameComponent } from '../shared/economy/forge-flame.component';
import { XpService, XpSnapshot } from '../shared/gamification/xp.service';
import { rankSigil } from '../shared/gamification/gamification.model';
import { QuestService, QuestBoard } from '../shared/quests/quest.service';
import { Quest } from '../shared/quests/quest.model';
import { ExpeditionBlock, ExplorerService } from '../shared/explorer/explorer.service';
import { ExplorerRosterPanelComponent } from '../shared/rpg/explorer-roster-panel.component';
import { ChallengePanelComponent } from '../shared/challenges/challenge-panel.component';
import { ThrallPanelComponent } from '../shared/thralls/thrall-panel.component';
import {
  EXPLORER_REALMS,
  Expedition,
  ExpeditionRecord,
  ExplorerReturn,
  ExplorerState,
  MISSIONS,
  realmMaterials,
  MAX_EXPLORER_SLOTS,
  MissionDefinition,
  MissionId,
  emptyExplorerState,
  expeditionEta,
  formatCountdown,
  formatEta,
  missionById,
  missionProgress,
  realmGoldBand,
  realmProfile,
  remainingMs,
} from '../shared/explorer/explorer.model';
import { ExplorerRosterService } from '../shared/rpg/explorer-roster.service';
import { InventoryService } from '../shared/rpg/inventory.service';
import {
  EQUIPMENT_SLOTS,
  GameItem,
  ITEM_STAT_KEYS,
  formatItemMod,
  rarityLabel,
} from '../shared/rpg/item.model';
import {
  RUNE_TIERS,
  RUNE_TIER_ORDER,
  RuneTier,
  RuneTierDefinition,
  runeById,
  tierOf,
} from '../shared/rune-forge/rune.model';
import { materialDisplay } from '../shared/rpg/material-catalog';
import { scrollById } from '../shared/rune-forge/lore-scroll.model';
import { RealmDefinition, RealmId, realmById } from '../shared/realms/realm.model';
import { ArtSceneComponent } from '../shared/art-scene/art-scene.component';
import {
  ExpeditionSite,
  defaultSiteFor,
  siteById,
  siteProfile,
  sitesInRealm,
} from '../shared/expedition/expedition-site.model';
import {
  ExpeditionBeat,
  currentBeat,
  expeditionBeats,
} from '../shared/expedition/expedition-events.model';
import { explorerXpFor, levelForXp, neutralBonus } from '../shared/rpg/explorer-progression';
import { archetypeById } from '../shared/rpg/explorer-archetypes';
import { RosterExplorer, explorerTier } from '../shared/rpg/explorer-roster.model';
import { RARITIES } from '../shared/rarity/rarity.model';

/**
 * The two energies, as colours.
 *
 * Aether takes the Archivum's gold and Nox the brand violet — both already in
 * the palette, so the Keeper's aura is never a colour that appears nowhere else
 * on the site.
 */
const AETHER_COLOR = '#C9A84C';
const NOX_COLOR = '#7b61ff';

/** One line in the rolling feed. */
export interface FeedEntry {
  key: number;
  text: string;
  /** Rarity or category colour, applied to the text. */
  color: string;
  /** A glyph in the gutter. */
  glyph: string;
}

/** A ladder line in the left column: what is owned and at what level. */
interface OwnedRow {
  id: string;
  name: string;
  icon: string;
  level: number;
  /** "+5/sec", "+50 per strike" — the effect, already resolved. */
  note: string;
}

/** One equipped thing, orbiting the Keeper. */
interface Worn {
  id: string;
  label: string;
  icon: string;
  /** Its own colour, for the halo. */
  color: string;
  /** Where on the ring it sits, in degrees. */
  angle: number;
}

/**
 * One rung of the dispatch ladder, resolved for its button.
 *
 * Everything the card needs is computed once per change-detection pass rather
 * than through six getters called from the template: the picker holds six
 * cards, each of which wants a Gold band, a cost, a block reason and a drama
 * level, and thirty-six template calls a tick on a page that already ticks
 * once a second is a budget this page cannot afford.
 */
interface MissionOption {
  def: MissionDefinition;
  /** "500K–1.4M Gold", already in the armed realm. */
  band: string;
  /** "10,000 Gold" or an empty string when the rung is free. */
  cost: string;
  /** Why it cannot be sent, or null. */
  block: ExpeditionBlock | null;
  /** The refusal, written for a human. Empty when there is none. */
  blockLabel: string;
  /** 1–6. Drives the card's glow, ring count and portal treatment. */
  drama: number;
  /** True for the three lengths past the hour. */
  deep: boolean;
  /** "guaranteed Epic+", or empty. The one line that sells the rung. */
  promise: string;
}

/** A mission out, with everything the card needs already computed. */
interface ActiveMission {
  id: string;
  /**
   * Resolved for display rather than held as the definition objects.
   *
   * `isExpedition` admits any `realm`/`mission` that is a *string* — it cannot
   * require the id to resolve, because rejecting unresolvable ones would
   * silently delete every expedition in flight at upgrade time (see the note on
   * that guard). So a saved expedition can name a realm or mission this build
   * no longer has, `realmById` answers null, and the card that reads `.name`
   * off it takes the whole Sanctum down with it — including the Recall button
   * that is the only way to free the slot. The landing card below already
   * resolves the same two ids defensively; this one now does too.
   */
  realmName: string;
  realmColor: string;
  missionName: string;
  /** Where in the realm. Absent on a mission dispatched before sites existed. */
  site?: ExpeditionSite;
  /** Who is out there. Empty when they have since been dismissed. */
  explorerName: string;
  /** Their own level, for the badge on the card. */
  explorerLevel: number;
  /** "4:32". */
  countdown: string;
  /** 0-1, for the ring and the bar. */
  progress: number;
  /** 0-100, rounded, for the readout — the ring cannot say a number. */
  percent: number;
  /** "14:32" — wall-clock time they are due. */
  eta: string;
  done: boolean;
  /**
   * The four milestone beats, each flagged with whether it has been crossed.
   *
   * Derived rather than stored — see the note at the top of
   * `expedition-events.model.ts`. Recomputed on every tick, which is four
   * string hashes per mission per second and is nothing next to the countdown
   * formatting already happening beside it.
   */
  beats: ExpeditionBeat[];
  /** The most recent beat crossed, for the one-line summary on the card. */
  latest: ExpeditionBeat | null;
}

/** Somebody standing idle, resolved for the who-goes picker. */
interface IdleExplorer {
  id: string;
  name: string;
  level: number;
  color: string;
  rarityLabel: string;
  /** True when the armed realm is their affinity realm. */
  athome: boolean;
  /** Their own wall against the armed site, or null when they may go. */
  block: ExpeditionBlock | null;
}

/** One of a realm's three sites, resolved for the picker. */
interface SiteOption {
  site: ExpeditionSite;
  /** Filled stars, as a 1-5 array the template can iterate. */
  stars: readonly number[];
  /** Why it is refused right now, or null. */
  block: ExpeditionBlock | null;
  blockLabel: string;
  /** "12K–40K Gold" for the currently armed length, after the site's cut. */
  band: string;
  /** How long the armed length runs here, after the site and the explorer. */
  duration: string;
  /** What this dispatch costs here, after the site's multiplier. */
  cost: string;
}

/** One item pulled out of a haul, resolved for the reveal card. */
interface LandingItem {
  id: string;
  name: string;
  /** The tier id, so the haul can be ranked without going through the label. */
  rarity: RuneTier;
  rarityLabel: string;
  color: string;
  glow: string;
  /** "Gold/sec +2.4 · Magic Find +7%". */
  mods: string;
  /**
   * True when some loadout slot will actually take it.
   *
   * Charms are the case: no slot accepts `type: 'charm'`, so a card that told
   * every find to go and wear it would be sending the player to a doll that
   * cannot take it. Runes and artifacts are wearable and get the loadout link;
   * everything else is told the truth, which is that it went in the bag.
   */
  wearable: boolean;
}

/** The loot reveal card. Held until dismissed or replaced. */
interface Landing {
  realmName: string;
  realmColor: string;
  missionName: string;
  explorerName: string;
  /**
   * The three ids the run was armed with, kept so Deploy Again can re-arm the
   * picker without the player re-answering three questions they just answered.
   */
  realmId: RealmId;
  siteId?: string;
  missionId: MissionId;
  /** Where they went, when the run had a site. */
  siteName: string;
  /** XP banked against the explorer themselves, and the level it bought. */
  explorerXp: number;
  explorerLevel: number;
  /** True when this return pushed them over a level boundary. */
  levelledUp: boolean;
  /**
   * Somebody they brought back with them.
   *
   * The rarest event on this page — see `EXPLORER_FIND_CHANCE` — and the one the
   * reveal card exists to make a moment out of. Resolved to what the card
   * prints rather than held as the record, so the template does not reach into
   * the archetype registry.
   */
  found: {
    name: string;
    rarityLabel: string;
    color: string;
    glow: string;
    passive: string;
    bio: string;
  } | null;
  gold: string;
  xp: number;
  rune: { name: string; glyph: string; color: string; lore: string; tierLabel: string } | null;
  /** Every rune past the first, for a multi-slot explorer. */
  extraRunes: { id: string; name: string; glyph: string; color: string; tierLabel: string }[];
  scroll: { title: string; subtitle: string; text: string; color: string } | null;
  items: LandingItem[];
  /**
   * Materials carried home, resolved for display.
   *
   * Named and pictured rather than counted, because "14 materials" is a number
   * and "Umbral Ink ×3" is a reason to have gone to Umbral — which is the whole
   * point of a realm-specific drop.
   */
  materials: { id: string; name: string; art: string; quantity: number }[];
  /**
   * The best thing in the haul, as a colour and a glow.
   *
   * Drives the card's outer bloom so a Legendary return does not look like a
   * Common one until you have read the words. Falls back to the realm's own
   * colour on a Gold-only haul, which is the honest signal: nothing rare here.
   */
  tone: string;
  toneGlow: string;
  /** True once anything above Rare landed. Turns the card's flare on. */
  rare: boolean;
}

/** One settled expedition, resolved for the log. */
interface HistoryRow {
  id: string;
  realmName: string;
  realmColor: string;
  missionName: string;
  explorerName: string;
  gold: string;
  /** "2h ago", "just now". */
  when: string;
  /** Glyph + colour per rune found, so the log reads at a glance. */
  runes: { key: string; name: string; glyph: string; color: string }[];
  scrollFound: boolean;
  itemCount: number;
  /** Total materials banked on this return. A count here — the log is a glance. */
  materialCount: number;
}

/** How many feed lines are kept. Older ones fall off the bottom. */
const FEED_CAP = 20;

/**
 * The one line that sells a rung of the ladder.
 *
 * Derived from the mission's own fields rather than authored per mission,
 * because the fields are what actually happens on return and a hand-written
 * promise is a sentence that quietly stops being true the first time a floor
 * is retuned.
 */
function missionPromise(def: MissionDefinition): string {
  const parts: string[] = [];
  if (def.guaranteedRunes) {
    const tier = RUNE_TIERS[RUNE_TIER_ORDER[def.runeFloor ?? 0]]?.label ?? 'Common';
    parts.push(
      def.guaranteedRunes === 1
        ? `guaranteed ${tier}+`
        : `${def.guaranteedRunes} guaranteed ${tier}+`,
    );
  } else if (def.runeFloor) {
    parts.push(`${RUNE_TIERS[RUNE_TIER_ORDER[def.runeFloor]]?.label ?? ''}+ runes only`);
  }
  if (def.materialsMax) parts.push(`${def.materialsMin}–${def.materialsMax} materials`);
  return parts.join(' · ');
}

/** A refusal, written for a human. Empty string when there is nothing to say. */
function blockLabel(block: ExpeditionBlock | null): string {
  if (!block) return '';
  switch (block.code) {
    case 'level':
      return `Keeper rank ${block.need} — you are ${block.have}`;
    case 'gold':
      return `${formatCompact(block.need ?? 0)} Gold — you have ${formatCompact(block.have ?? 0)}`;
    case 'exclusive':
      return 'One at a time. Something is already down there.';
    case 'slots':
      return 'Every explorer is out.';
    case 'site-keeper-level':
      return `Keeper rank ${block.need} — you are ${block.have}`;
    case 'site-explorer-level':
      return `Explorer level ${block.need} — they are ${block.have}`;
    default:
      return 'Not available.';
  }
}

/**
 * The same refusal, phrased for a site card rather than for a send button.
 *
 * Shorter, because it is printed inside a card two thirds the width of the
 * button and the card already names the place the refusal is about.
 */
function siteBlockCopy(block: ExpeditionBlock | null): string {
  if (!block) return '';
  switch (block.code) {
    case 'site-keeper-level': return `Rank ${block.need}`;
    case 'site-explorer-level': return `Lv ${block.need} explorer`;
    default: return 'Locked';
  }
}

/** Five slots, so a difficulty rating can be drawn without a loop in the class. */
const STAR_SLOTS: readonly number[] = [1, 2, 3, 4, 5];

/**
 * "4h", "25m", "3d" — a span, at the coarsest unit that still says something.
 *
 * Distinct from `formatCountdown`, which counts *down* and needs seconds. This
 * is a length, printed on a card that is not ticking.
 */
function formatSpan(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

/** The best find in a haul, reduced to what the card needs to look like it. */
interface Tone {
  color: string;
  glow: string;
  semitones: number;
  /** Position on the rune ladder. 0 is Common, 6 is Singular. */
  rank: number;
}

/** Rune ladder positions, for ranking a haul's finds against each other. */
const TONE_RANK: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, singular: 6,
};

/**
 * The highest-tier thing in a haul.
 *
 * Items and runes share `RuneTier`, deliberately — see the note at the top of
 * `item.model.ts` — so one ladder ranks both and the card does not need to know
 * which kind of thing won.
 */
function bestTone(runeTier: RuneTierDefinition | null, items: readonly LandingItem[]): Tone | null {
  let best: Tone | null = runeTier ? toneOf(runeTier) : null;

  for (const item of items) {
    const tone = toneOf(tierOf(item.rarity));
    if (!best || tone.rank > best.rank) best = tone;
  }

  return best;
}

function toneOf(tier: RuneTierDefinition): Tone {
  return {
    color: tier.color,
    glow: tier.glow,
    semitones: tier.semitones,
    rank: TONE_RANK[tier.id] ?? 0,
  };
}

/**
 * "just now", "12m ago", "3h ago", "2d ago".
 *
 * Not `Intl.RelativeTimeFormat`: the log's whole job is to be scannable down a
 * narrow column, and "3 hours ago" wraps where "3h ago" does not. It is also
 * only ever describing the last ten landings, so the ladder stops at days.
 */
function relativeTime(at: number, now: number): string {
  const ago = Math.max(0, now - at);
  if (ago < 60_000) return 'just now';
  const minutes = Math.floor(ago / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** A trader shows up somewhere in this window, and stays for a while. */
const TRADER_MIN_MS = 90_000;
const TRADER_MAX_MS = 240_000;
const TRADER_STAY_MS = 25_000;

/** Remembers whether the visitor wanted the hum, across visits. */
const HUM_KEY = 'godforge-forge-hum';

@Component({
  selector: 'app-forge-view',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ForgeFlameComponent, ExplorerRosterPanelComponent,
    ChallengePanelComponent, ThrallPanelComponent, ArtSceneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forge-view.component.html',
  styleUrls: ['./forge-view.component.css'],
})
export class ForgeViewComponent implements OnInit, OnDestroy {
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);
  private readonly quests = inject(QuestService);
  private readonly explorers = inject(ExplorerService);
  private readonly roster = inject(ExplorerRosterService);
  private readonly inventory = inject(InventoryService);
  private readonly audio = inject(ForgeAudioService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly subs = new Subscription();

  // ── Live state, all mirrored in from services ──────────────────────────────

  snap: EconomySnapshot = this.economy.snapshot;
  xpSnap: XpSnapshot = this.xp.snapshot;
  board: QuestBoard | null = null;
  explorerState: ExplorerState = emptyExplorerState();

  // ── Local view state ───────────────────────────────────────────────────────

  feed: FeedEntry[] = [];
  landing: Landing | null = null;
  /** Hauls that landed behind the one on screen. See dismissLanding. */
  private landingQueue: Landing[] = [];
  humming = false;
  reducedMotion = false;

  /** The realm and length armed in the dispatch picker. */
  pickedRealm: RealmId = 'luminous';
  pickedMission: MissionId = 'scout';
  /**
   * Which of the armed realm's three sites is armed.
   *
   * Seeded to Luminous's outer site rather than left empty, so the very first
   * dispatch a visitor makes goes somewhere named rather than to a neutral
   * profile — an empty `siteId` is the *migration* path, not a starting state.
   */
  pickedSite: string = defaultSiteFor('luminous').id;

  /** The wandering trader, when one is on screen. */
  traderGold = 0;

  /** Recomputed each tick so the countdowns are honest. */
  private now = 0;

  private seq = 0;
  private traderTimer: ReturnType<typeof setTimeout> | null = null;
  private traderExpiry: ReturnType<typeof setTimeout> | null = null;

  // ── Static catalogue, safe to build at construction (pure data) ─────────────

  readonly realms = EXPLORER_REALMS;
  readonly missions = MISSIONS;
  readonly maxSlots = MAX_EXPLORER_SLOTS;

  ngOnInit(): void {
    this.economy.init();
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.snap = s;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.xp.snapshot$.subscribe(s => {
      this.xpSnap = s;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.quests.board$.subscribe(b => {
      this.board = b;
      this.cdr.markForCheck();
    }));

    if (!this.isBrowser) return;

    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.now = Date.now();

    // ── ORDER IS LOad-BEARING ───────────────────────────────────────────────
    // Every subscription below is taken *before* `explorers.init()`, because
    // init settles whatever landed while the tab was shut and emits a landing
    // for each — and `returned$` is a plain Subject with no replay, on purpose
    // (a missed landing is a missed animation, not a missed payout).
    //
    // Subscribing after init is therefore silent data loss of exactly the kind
    // the feature exists for: an hour-long expedition finished overnight would
    // bank its Gold correctly and show the visitor nothing at all. Measured
    // before the fix: 87 Gold arrived, no loot card, empty feed.
    this.subs.add(this.explorers.state$.subscribe(s => {
      this.explorerState = s;
      this.cdr.markForCheck();
    }));

    // The countdown redraw. Only fires while a mission is out — the service
    // stops its interval when none is, so an idle Forge View costs nothing.
    this.subs.add(this.explorers.tick$.subscribe(now => {
      this.now = now;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.explorers.returned$.subscribe(r => this.onExplorerReturned(r)));

    this.wireFeed();

    void this.xp.init();
    this.quests.init();
    // Before `explorers.init()`, which settles overnight landings and resolves
    // the minted item ids on the reveal card against this bag. An empty bag at
    // that moment would show a Legendary haul as "Gold and a story".
    this.inventory.init();
    this.subs.add(this.inventory.snapshot$.subscribe(() => this.cdr.markForCheck()));
    this.explorers.init();

    this.restoreHum();
    this.scheduleTrader();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    // The hum belongs to the page, not the session: leaving the Forge View with
    // a furnace still running under /tools would be a sound with no visible
    // source and no button to stop it.
    this.audio.stopHum();
    this.clearTraderTimers();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The Keeper
  // ───────────────────────────────────────────────────────────────────────────

  get rankSigil(): string { return rankSigil(this.xpSnap.level.level); }
  get rankTitle(): string { return this.xpSnap.level.title; }
  get rankLevel(): number { return this.xpSnap.level.level; }

  /** 0-100 through the current rank, for the bar under the Keeper. */
  get rankPercent(): number { return Math.round(this.xpSnap.progress * 100); }

  /**
   * Which energy has claimed this visitor, and therefore what colour the
   * Keeper burns. Aether over half, Nox under — a dead heat reads as Aether,
   * which is also what a brand-new visitor gets, and gold is the friendlier
   * first impression.
   */
  get dominantEnergy(): 'aether' | 'nox' {
    return this.xpSnap.aetherShare >= 0.5 ? 'aether' : 'nox';
  }

  get keeperColor(): string {
    return this.dominantEnergy === 'aether' ? AETHER_COLOR : NOX_COLOR;
  }

  /**
   * How hard the forge glows, 0-1.
   *
   * Logarithmic, because the rate spans six orders of magnitude and a linear
   * ramp would sit at zero until The First Sun and then peg. This way the first
   * Forge Bellows is visibly warmer than a bare forge, which is the moment the
   * feedback actually matters.
   */
  get glow(): number {
    const rate = Math.max(0, this.snap.perSecond);
    if (rate <= 0) return 0;
    return Math.min(1, Math.log10(rate + 1) / 4);
  }

  /**
   * Everything owned that has a face, arranged around the Keeper.
   *
   * Artifacts first because they are the rarest thing anyone holds, then the
   * best hammer, then equipped cosmetics. Angles are assigned by index rather
   * than stored, so the ring stays evenly spaced however many are worn.
   */
  get worn(): Worn[] {
    const items: Omit<Worn, 'angle'>[] = [];

    for (const artifact of ARTIFACTS) {
      if (!this.snap.artifacts.includes(artifact.id)) continue;
      items.push({
        id: artifact.id,
        label: artifact.name,
        icon: artifact.icon,
        color: RARITIES[artifact.tier].color,
      });
    }

    // Only the heaviest hammer held. Showing all five would put an Iron Hammer
    // on the belt of somebody carrying the Eclipse Hammer, which reads as
    // clutter rather than as a collection.
    const hammer = [...HAMMER_UPGRADES].reverse().find(h => this.economy.levelOf(h.id) > 0);
    if (hammer) {
      items.push({ id: hammer.id, label: hammer.name, icon: hammer.icon, color: AETHER_COLOR });
    }

    for (const cosmetic of COSMETICS) {
      const variantId = this.snap.equipped[cosmetic.slot];
      if (!variantId) continue;
      const variant = cosmetic.variants.find(v => v.id === variantId);
      items.push({
        id: cosmetic.id,
        label: variant ? `${cosmetic.name}: ${variant.label}` : cosmetic.name,
        icon: cosmetic.icon,
        color: variant?.color ?? NOX_COLOR,
      });
    }

    const step = items.length ? 360 / items.length : 0;
    return items.map((item, i) => ({ ...item, angle: i * step - 90 }));
  }

  /** Deterministic ember offsets. See the note in the template. */
  readonly embers = Array.from({ length: 14 }, (_, i) => ({
    key: i,
    // A cheap hash rather than Math.random: the server and the client must
    // produce the same numbers or hydration reports a mismatch on every ember.
    x: ((i * 37) % 100),
    delay: ((i * 61) % 90) / 10,
    duration: 7 + ((i * 23) % 60) / 10,
    size: 2 + ((i * 17) % 30) / 10,
  }));

  // ───────────────────────────────────────────────────────────────────────────
  // Forge activity (left)
  // ───────────────────────────────────────────────────────────────────────────

  get perSecond(): string { return formatCompact(this.snap.perSecond); }
  get perSecondExact(): string { return formatCurrency(this.snap.perSecond); }
  get gold(): string { return formatCurrency(this.snap.gold); }
  get perClick(): string { return formatCurrency(this.snap.perClick); }
  get autoRate(): string { return formatRate(this.snap.autoPerSecond); }
  get lifetime(): string { return formatCompact(this.snap.totalGoldEarned); }

  /** Everything on the income ladders that is actually owned. */
  get ownedUpgrades(): OwnedRow[] {
    const rows: OwnedRow[] = [];
    for (const u of FORGE_UPGRADES) {
      const level = this.economy.levelOf(u.id);
      if (level > 0) {
        rows.push({
          id: u.id, name: u.name, icon: u.icon, level,
          note: `${formatCompact(u.ratePerSecond * level)}/sec`,
        });
      }
    }
    for (const u of MULTIPLIER_UPGRADES) {
      if (this.economy.levelOf(u.id) > 0) {
        rows.push({ id: u.id, name: u.name, icon: u.icon, level: 1, note: u.effect });
      }
    }
    return rows;
  }

  get ownedAutomatons(): OwnedRow[] {
    return AUTO_CLICKERS
      .map(u => ({ u, level: this.economy.levelOf(u.id) }))
      .filter(x => x.level > 0)
      .map(({ u, level }) => ({
        id: u.id, name: u.name, icon: u.icon, level,
        note: `${formatRate(u.clicksPerSecond * level)} strikes/sec`,
      }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Quests (right)
  // ───────────────────────────────────────────────────────────────────────────

  /** Dailies and weeklies together — epics live on /quests, which has room. */
  get openQuests(): Quest[] {
    if (!this.board) return [];
    return [...this.board.daily, ...this.board.weekly].filter(q => !q.claimed);
  }

  claim(quest: Quest): void {
    if (!this.quests.claim(quest.id)) return;
    this.audio.coin();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Explorers (right)
  // ───────────────────────────────────────────────────────────────────────────

  get slots(): number { return this.explorers.slots; }
  get freeSlots(): number { return this.explorers.freeSlots; }

  get activeMissions(): ActiveMission[] {
    const now = this.now || Date.now();
    return this.explorerState.active.map(e => this.missionCard(e, now));
  }

  private missionCard(e: Expedition, now: number): ActiveMission {
    const left = remainingMs(e, now);
    const progress = missionProgress(e, now);
    const site = siteById(e.siteId);
    const who = this.roster.byId(e.explorerId);
    const realm = realmById(e.realm);
    const mission = missionById(e.mission);
    return {
      id: e.id,
      realmName: realm?.name ?? 'an unrecorded realm',
      realmColor: realm?.color ?? AETHER_COLOR,
      missionName: mission?.name ?? 'Expedition',
      site,
      explorerName: who?.name ?? '',
      explorerLevel: levelForXp(who?.xp ?? 0),
      countdown: formatCountdown(left),
      progress,
      percent: Math.round(progress * 100),
      eta: formatEta(expeditionEta(e)),
      done: left <= 0,
      beats: expeditionBeats(e.id, e.realm, site?.tier, progress),
      latest: currentBeat(e.id, e.realm, site?.tier, progress),
    };
  }

  /**
   * Arm a realm, and move the site with it.
   *
   * The site has to follow because the picker's three site cards are the
   * *current* realm's three: leaving `pickedSite` pointing at Umbral's Hollow
   * Depths while the realm button says Luminous would let a player press Deploy
   * on a combination `dispatch` refuses — and the refusal would be correct and
   * completely baffling.
   */
  pickRealm(id: RealmId): void {
    this.pickedRealm = id;
    this.pickedSite = defaultSiteFor(id).id;
  }

  pickMission(id: MissionId): void { this.pickedMission = id; }
  pickSite(id: string): void { this.pickedSite = id; }

  // ── Sites ──────────────────────────────────────────────────────────────────

  /** The armed realm's three sites, resolved against the armed length. */
  get siteOptions(): SiteOption[] {
    const mission = missionById(this.pickedMission);
    return sitesInRealm(this.pickedRealm).map(site => {
      const block = this.explorers.blockedSite(site.id, this.armedExplorerId);
      const band = mission ? realmGoldBand(mission, this.pickedRealm) : { min: 0, max: 0 };
      const cost = this.explorers.dispatchCost(this.pickedMission, site.id);
      return {
        site,
        stars: STAR_SLOTS,
        block,
        blockLabel: siteBlockCopy(block),
        band: `${formatCompact(Math.round(band.min * site.goldMultiplier))}–${formatCompact(Math.round(band.max * site.goldMultiplier))} Gold`,
        duration: formatSpan(this.explorers.dispatchDuration(
          this.pickedMission, this.armedExplorerId, site.id)),
        cost: cost ? `${formatCompact(cost)} Gold` : 'free',
      };
    });
  }

  get pickedSiteDef(): ExpeditionSite {
    return siteById(this.pickedSite) ?? defaultSiteFor(this.pickedRealm);
  }

  get pickedSiteOption(): SiteOption | undefined {
    return this.siteOptions.find(o => o.site.id === this.pickedSite);
  }

  // ── Who goes ───────────────────────────────────────────────────────────────

  /**
   * Everyone standing idle, resolved for the picker.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * WHY THERE IS A PICKER AT ALL
   * ─────────────────────────────────────────────────────────────────────────
   * Dispatch used to send whoever was best and idle, and that was the right
   * call when every explorer of a tier was the same explorer: choosing between
   * two identical Commons is a click that cannot be got wrong, so not offering
   * it was a kindness.
   *
   * The cast makes it the opposite. Seris doubles the rune rate in Umbral and
   * nowhere else; Callum doubles Nexus freight; a level-10 explorer can enter a
   * deep site a level-3 one is refused from. "Best" is now a question about
   * *where you are going*, and the service cannot answer it — so the player
   * gets to.
   *
   * `auto` stays as the first option and stays the default, because a player
   * with twelve on the books who just wants to fire off a Scout should not have
   * to answer a question they do not care about.
   */
  get idleExplorers(): IdleExplorer[] {
    return this.explorers.available.map(e => {
      const archetype = archetypeById(e.archetypeId);
      const tier = explorerTier(e.rarity);
      const level = levelForXp(e.xp ?? 0);
      const site = siteById(this.pickedSite);
      return {
        id: e.id,
        name: e.name,
        level,
        color: tier.color,
        rarityLabel: tier.label,
        // The one fact that decides the click: are they from where we are going.
        athome: !!archetype?.affinity && archetype.affinity === this.pickedRealm,
        // Their own wall, measured against the armed site — so an explorer who
        // cannot enter it is greyed out *before* the send button refuses.
        block: site ? this.explorers.blockedSite(site.id, e.id) : null,
      };
    });
  }

  /**
   * Who is armed, or empty for "whoever is best".
   *
   * Cleared whenever the chosen explorer is no longer idle — dispatched, or
   * dismissed from the roster panel below — so the picker can never hold a
   * stale id that `dispatch` would silently refuse.
   */
  pickedExplorer = '';

  pickExplorer(id: string): void { this.pickedExplorer = id; }

  /** The armed explorer's id, or undefined when the dispatch should choose. */
  private get armedExplorerId(): string | undefined {
    if (!this.pickedExplorer) return undefined;
    return this.explorers.available.some(e => e.id === this.pickedExplorer)
      ? this.pickedExplorer
      : undefined;
  }

  /**
   * Who this dispatch would actually send, for the confirmation copy.
   *
   * Resolved through the service rather than re-derived here, so the name on
   * the button is guaranteed to be the person the dispatch picks.
   */
  get nextExplorer(): RosterExplorer | undefined {
    const armed = this.armedExplorerId;
    return armed ? this.roster.byId(armed) : this.explorers.bestIdleExplorer();
  }

  get nextExplorerName(): string {
    return this.nextExplorer?.name ?? 'an explorer';
  }

  get nextExplorerLevel(): number {
    const who = this.nextExplorer;
    return who ? levelForXp(who.xp ?? 0) : 0;
  }

  get pickedRealmDef(): RealmDefinition {
    return realmById(this.pickedRealm) ?? this.realms[0];
  }

  /** What a realm is good for. One line under its button in the picker. */
  realmSpecialty(id: RealmId): string {
    return realmProfile(id).specialty;
  }

  /**
   * The Gold band a length pays *in the armed realm*.
   *
   * Read live off `pickedRealm` rather than off the mission alone, so switching
   * from Umbral to Luminous visibly moves all three numbers. Before realm
   * profiles existed this was a static band and the picker could not show that
   * the destination mattered, because it did not.
   */
  goldBand(mission: MissionDefinition): string {
    const band = realmGoldBand(mission, this.pickedRealm);
    const mult = siteProfile(this.pickedSite).goldMultiplier;
    return `${formatCompact(Math.round(band.min * mult))}–${formatCompact(Math.round(band.max * mult))} Gold`;
  }

  /**
   * The rune rate of the armed realm, as a plain multiplier.
   *
   * Shown as "×1.5 runes" rather than as the raw chance, which is 0.00045 and
   * reads as zero to everybody. The multiplier is the part the player can act
   * on: it is the difference between the five buttons.
   */
  get pickedRealmRuneMult(): string {
    const mult = realmProfile(this.pickedRealm).runeChanceMultiplier;
    return `×${mult.toFixed(2).replace(/\.?0+$/, '')}`;
  }

  /**
   * What the armed realm's seams hand over, named.
   *
   * Only the realm's own two, not the three commons — the commons are what
   * every realm gives and listing them under all five buttons would be the
   * same sentence five times, which is how the picker read before realm
   * profiles existed.
   */
  get pickedRealmMaterials(): string {
    const all = realmMaterials(this.pickedRealm);
    const exclusive = all.slice(3);
    return exclusive.map(id => materialDisplay(id)?.name ?? id).join(', ');
  }

  /** The six rungs, resolved for the picker. Recomputed per pass, not per cell. */
  get missionOptions(): MissionOption[] {
    return this.missions.map(def => {
      // Passed the armed site so the rung's own refusal and its printed fee are
      // both for the dispatch the player would actually make. A card that said
      // "10,000 Gold" while the Void Threshold took 40,000 would be the single
      // worst bug this panel could have.
      const block = this.explorers.blockedReason(def.id, this.armedExplorerId, this.pickedSite);
      const cost = this.explorers.dispatchCost(def.id, this.pickedSite);
      return {
        def,
        band: this.goldBand(def),
        cost: cost ? `${formatCompact(cost)} Gold` : '',
        block,
        blockLabel: blockLabel(block),
        drama: def.drama ?? 1,
        deep: def.deep === true,
        promise: missionPromise(def),
      };
    });
  }

  /** The rung currently armed, for the send button's copy. */
  get pickedMissionOption(): MissionOption | undefined {
    return this.missionOptions.find(o => o.def.id === this.pickedMission);
  }

  /** True when the armed rung cannot be sent. Disables the button. */
  get dispatchBlocked(): boolean {
    return !!this.pickedMissionOption?.block;
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  /**
   * Whether to offer the notification control, and what it should say.
   *
   * Offered only once a deep mission is actually armed. A permission prompt
   * next to the two-minute Scout is a prompt for something the visitor is about
   * to watch finish, and asking there is how a site earns a permanent "blocked"
   * from someone who would have said yes to the 72-hour one.
   */
  get canOfferNotifications(): boolean {
    const perm = this.explorers.notificationPermission;
    return perm === 'default' && (this.pickedMissionOption?.deep ?? false);
  }

  get notificationsOn(): boolean {
    return this.explorers.notificationPermission === 'granted';
  }

  async enableNotifications(): Promise<void> {
    const result = await this.explorers.requestNotifications();
    this.push(
      result === 'granted'
        ? 'The realms will call when a deep run lands.'
        : 'No notifications, then. The expedition log still keeps every return.',
      result === 'granted' ? '#7fd5a3' : '#9fb4ae',
      result === 'granted' ? '🔔' : '🔕',
    );
    this.cdr.markForCheck();
  }

  // ── The dashboard strip ────────────────────────────────────────────────────

  /**
   * The mission due back first, for the strip at the top of the page.
   *
   * The strip's job is to answer "is anything happening" without the visitor
   * having to scroll to the third column, so it reports the *soonest* landing
   * rather than a count: a count tells you there are three, which you knew, and
   * not that one of them lands in ninety seconds.
   */
  get soonestMission(): ActiveMission | null {
    const rows = this.activeMissions;
    if (!rows.length) return null;
    return rows.reduce((best, row) => (row.progress > best.progress ? row : best));
  }

  get activeCount(): number { return this.explorerState.active.length; }

  /** How many of the player's own slots are filled. Explorer kit is not counted. */
  get equippedCount(): number {
    return Object.values(this.inventory.snapshot.equipped).filter(Boolean).length;
  }

  /**
   * The worn totals, already written as mod lines.
   *
   * Zeroed stats are dropped rather than rendered as "+0", because a strip that
   * lists six stats at zero is six pieces of furniture telling the visitor
   * nothing. An empty result is handled in the template as its own line.
   */
  get equippedMods(): string[] {
    const totals = this.inventory.snapshot.totals;
    return ITEM_STAT_KEYS
      .filter(key => (totals[key] ?? 0) !== 0)
      .map(key => formatItemMod(key, totals[key]));
  }

  /** Everything in the bag, for the strip's "loot held" figure. */
  get bagCount(): number { return this.inventory.snapshot.bag.length; }

  // ── The log ────────────────────────────────────────────────────────────────

  /**
   * The last few settled expeditions.
   *
   * Resolved on read rather than stored resolved, because the record holds rune
   * *ids* and the registry is the only thing that can be right about a rune's
   * name and colour — a log written with the names baked in would keep showing
   * the old ones after a registry retune, which is the exact bug the rune ledger
   * avoids the same way.
   */
  get history(): HistoryRow[] {
    const now = this.now || Date.now();
    return this.explorerState.history.map(record => this.historyRow(record, now));
  }

  private historyRow(record: ExpeditionRecord, now: number): HistoryRow {
    const realm = realmById(record.realm);
    return {
      id: record.id,
      realmName: realm?.name ?? 'the realms',
      realmColor: realm?.color ?? AETHER_COLOR,
      missionName: missionById(record.mission)?.name ?? 'Expedition',
      explorerName: record.explorerName,
      gold: formatCompact(record.gold),
      when: relativeTime(record.returnedAt, now),
      runes: record.runes
        .map((id, i) => ({ id, rune: runeById(id), i }))
        .filter((r): r is { id: string; rune: NonNullable<ReturnType<typeof runeById>>; i: number } => !!r.rune)
        .map(({ id, rune, i }) => ({
          // The id alone is not unique inside one haul: a Mythic explorer can
          // bring home two of the same rune, and two identical trackBy keys in
          // one @for is a render the framework is entitled to get wrong.
          key: `${id}-${i}`,
          name: rune.name,
          glyph: rune.icon ?? '🜂',
          color: rune.color,
        })),
      scrollFound: !!record.scroll,
      itemCount: record.items?.length ?? 0,
      materialCount: Object.values(record.materials ?? {}).reduce((a, b) => a + b, 0),
    };
  }

  dispatch(): void {
    const mission = missionById(this.pickedMission);
    const block = this.explorers.blockedReason(this.pickedMission, this.armedExplorerId, this.pickedSite);
    if (block) {
      // A refused dispatch says why rather than doing nothing. The button is
      // already disabled in this state; this covers the keyboard path and the
      // half-second where the Gold moved between the render and the click.
      this.push(blockLabel(block), '#ff9a5a', '⛔');
      this.cdr.markForCheck();
      return;
    }
    const who = this.nextExplorerName;
    const cost = this.explorers.dispatchCost(this.pickedMission, this.pickedSite);
    if (!this.explorers.dispatch(
      this.pickedRealm, this.pickedMission, this.armedExplorerId, this.pickedSite)) return;

    // Disarm after a successful send. The person just left, so leaving them
    // armed would make the next Deploy press refuse for a reason the picker is
    // still showing as available.
    this.pickedExplorer = '';

    const realm = this.pickedRealmDef;
    const site = this.pickedSiteDef;
    this.audio.strike();
    this.push(
      cost
        ? `${who} deployed to ${site.name} — ${mission?.name ?? 'expedition'} (${formatCompact(cost)} Gold)`
        : `${who} deployed to ${site.name} — ${mission?.name ?? 'expedition'}`,
      realm.color,
      '🧭',
    );
  }

  /**
   * Send the same explorer back to the same place, straight off the reveal card.
   *
   * The single highest-value control on this page: the moment a haul lands is
   * the moment a player most wants to go again, and making them re-arm three
   * pickers to do it is where the loop leaks. Arms the picker rather than
   * dispatching directly, so there is exactly one dispatch path and one set of
   * refusal rules.
   */
  deployAgain(): void {
    const landing = this.landing;
    if (!landing) return;
    this.pickedRealm = landing.realmId;
    this.pickedSite = landing.siteId ?? defaultSiteFor(landing.realmId).id;
    this.pickedMission = landing.missionId;
    this.dismissLanding();
    this.dispatch();
  }

  recall(id: string): void {
    this.explorers.recall(id);
    this.push('Explorer recalled. They brought nothing back.', '#9fb4ae', '↩');
  }

  /**
   * Show the next haul, or clear the card.
   *
   * Three explorers finishing overnight all land inside the same settlement
   * pass. Assigning each straight to `landing` would leave only the last one on
   * screen and silently swallow the two runes above it, so they queue and the
   * dismiss button walks through them.
   */
  dismissLanding(): void {
    this.landing = this.landingQueue.shift() ?? null;
  }

  /** How many hauls are still waiting behind the one on screen. */
  get landingsQueued(): number { return this.landingQueue.length; }

  /** Runes brought home by expeditions. The runes themselves live at /rune-forge. */
  get runeCount(): number { return this.explorerState.runesFound; }
  get scrollCount(): number { return this.explorerState.scrollsFound; }
  get goldRecovered(): string { return formatCompact(this.explorerState.goldRecovered); }

  private onExplorerReturned(r: ExplorerReturn): void {
    const realm = realmById(r.explorer.realm);
    const mission = missionById(r.explorer.mission);
    const rune = r.reward.rune ? runeById(r.reward.rune) : undefined;
    const scroll = r.reward.scroll ? scrollById(r.reward.scroll) : undefined;

    // Runes past the first. A Mythic explorer rolls six times and every one of
    // them was already banked in the ledger — the card just never said so, which
    // made a six-slot explorer's return look identical to a Common's.
    const extraRunes = r.reward.runes
      .slice(1)
      .map((id, i) => ({ id, rune: runeById(id), i }))
      .filter((row): row is { id: string; rune: NonNullable<ReturnType<typeof runeById>>; i: number } => !!row.rune)
      .map(({ id, rune: extra, i }) => ({
        id: `${id}-${i}`,
        name: extra.name,
        glyph: extra.icon ?? '🜂',
        color: extra.color,
        tierLabel: tierOf(extra.tier).label,
      }));

    // The equippables the grant minted. `ExplorerReward.items` has carried these
    // ids since explorers got inventory slots and nothing has ever rendered
    // them: a haul that produced a Legendary charm read as "Gold and a story
    // nobody has written down", and the only way to find it was to notice the
    // bag count had moved.
    const items = (r.reward.items ?? [])
      .map(id => this.inventory.itemById(id))
      .filter((item): item is GameItem => !!item)
      .map(item => this.landingItem(item));

    // The card takes its bloom from the best thing in the haul. Ties go to the
    // rune, which is the find with lore attached and therefore the one the
    // player is reading.
    const best = bestTone(rune ? tierOf(rune.tier) : null, items);

    const site = siteById(r.explorer.siteId);

    // Their own ladder, read *after* the settlement has banked the XP. The
    // level-up flag is derived by subtracting this return's own award back off
    // and re-reading the level — cheaper and more honest than having the roster
    // service push a second event the card would have to correlate.
    const who = this.roster.byId(r.explorer.explorerId);
    const explorerXp = who?.xp ?? 0;
    const explorerLevel = levelForXp(explorerXp);
    const banked = explorerXpFor(r.reward.xp, r.explorer.bonus ?? neutralBonus());
    const levelledUp = levelForXp(Math.max(0, explorerXp - banked)) < explorerLevel;

    // Somebody they brought back with them. Resolved to the six strings the
    // card prints, so the template never reaches into the archetype registry.
    const foundArchetype = r.found?.archetypeId ? archetypeById(r.found.archetypeId) : undefined;
    const foundTier = r.found ? explorerTier(r.found.rarity as never) : null;

    const haul: Landing = {
      realmName: realm?.name ?? 'the realms',
      realmColor: realm?.color ?? AETHER_COLOR,
      missionName: mission?.name ?? 'Expedition',
      explorerName: r.explorerName ?? '',
      realmId: r.explorer.realm,
      siteId: r.explorer.siteId,
      missionId: r.explorer.mission,
      siteName: site?.name ?? '',
      explorerXp: banked,
      explorerLevel,
      levelledUp,
      found: r.found && foundTier
        ? {
            name: r.found.name,
            rarityLabel: foundTier.label,
            color: foundTier.color,
            glow: foundTier.glow,
            passive: foundArchetype?.passive.text ?? '',
            bio: foundArchetype?.bio ?? 'Nobody has written them down yet.',
          }
        : null,
      gold: formatCurrency(r.reward.gold),
      xp: r.reward.xp,
      rune: rune
        ? {
            name: rune.name,
            // The painted rune sheet is not in yet; the registry falls back to a
            // text glyph and so does this.
            glyph: rune.icon ?? '🜂',
            color: rune.color,
            lore: rune.lore,
            tierLabel: tierOf(rune.tier).label,
          }
        : null,
      extraRunes,
      scroll: scroll
        ? {
            title: scroll.title,
            subtitle: scroll.subtitle,
            // Scrolls carry a rune tier, not an EclipseRarity — they are shelved
            // by the rune that turns them up, so the colour comes from there.
            text: scroll.content,
            color: tierOf(scroll.rarity).color,
          }
        : null,
      items,
      materials: Object.entries(r.reward.materials ?? {}).map(([id, quantity]) => {
        const display = materialDisplay(id);
        return { id, name: display?.name ?? id, art: display?.art ?? '', quantity };
      }),
      tone: best?.color ?? realm?.color ?? AETHER_COLOR,
      toneGlow: best?.glow ?? realm?.glow ?? 'rgba(201, 168, 76, .5)',
      rare: !!best && best.rank >= 2,
    };

    if (this.landing) this.landingQueue.push(haul);
    else this.landing = haul;

    this.push(
      `Explorer home from ${realm?.name ?? 'the realms'} — ${formatCurrency(r.reward.gold)} Gold`,
      realm?.color ?? AETHER_COLOR,
      '🧭',
    );
    if (rune) this.push(`Found the ${rune.name} rune!`, rune.color, rune.icon ?? '🜂');
    for (const extra of extraRunes) this.push(`Found the ${extra.name} rune!`, extra.color, extra.glyph);
    if (scroll) this.push(`Recovered a fragment: ${scroll.subtitle}`, tierOf(scroll.rarity).color, '📜');
    for (const item of items) this.push(`Carried home ${item.name}`, item.color, '⚔');
    for (const [id, quantity] of Object.entries(r.reward.materials ?? {})) {
      this.push(`Hauled back ${materialDisplay(id)?.name ?? id} ×${quantity}`, '#C9A84C', '⛏');
    }

    this.cue(rune ? tierOf(rune.tier) : null, best);
    this.cdr.markForCheck();
  }

  /** One equippable, resolved for the reveal card. */
  private landingItem(item: GameItem): LandingItem {
    const tier = tierOf(item.rarity);
    return {
      id: item.id,
      name: item.upgradeLevel ? `${item.name} +${item.upgradeLevel}` : item.name,
      rarity: item.rarity,
      rarityLabel: rarityLabel(item.rarity),
      wearable: EQUIPMENT_SLOTS.some(slot => slot.accepts.includes(item.type)),
      color: tier.color,
      glow: tier.glow,
      mods: ITEM_STAT_KEYS
        .filter(key => item.stats[key] != null)
        .map(key => formatItemMod(key, item.stats[key]!))
        .join(' · '),
    };
  }

  /**
   * The sound a return makes, scaled to what actually came back.
   *
   * Every landing used to play `century()` — the same coin flourish whether the
   * explorer brought 5,000 Gold or the Void rune. `runeReveal` already takes a
   * pitch and a weight and is what the anvil plays for exactly this event, so a
   * rune return borrows it at the rune's own semitones, and anything Epic or
   * better gets the heavy variant. A Gold-only return keeps `century()`, which
   * is the right sound for "money arrived".
   */
  private cue(runeTier: { semitones: number } | null, best: Tone | null): void {
    if (runeTier) {
      this.audio.runeReveal(runeTier.semitones, (best?.rank ?? 0) >= 3);
      return;
    }
    if (best) {
      this.audio.runeReveal(best.semitones, best.rank >= 3);
      return;
    }
    this.audio.century();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The feed
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe the feed to everything already being published elsewhere.
   *
   * Deliberately a view over other people's events rather than a log anybody
   * writes to: nothing on this page can put a line in the feed without the
   * underlying thing having actually happened, so the feed cannot drift from
   * the ledger. It is also why it is not persisted — it is a window on the
   * session, not a record, and /codex is where the record lives.
   */
  private wireFeed(): void {
    // Gold from tools and quests, but not from the flame: a strike a second
    // would fill twenty lines in twenty seconds and push everything else off.
    this.subs.add(this.economy.gain$.subscribe(g => {
      if (g.currency !== 'gold') return;
      if (g.source === 'forge' || g.source === 'idle' || g.source === 'expedition') return;
      this.push(`+${formatCurrency(g.amount)} Gold from ${g.source}`, AETHER_COLOR, '◈');
    }));

    this.subs.add(this.economy.purchase$.subscribe(p => {
      this.push(`Bought ${p.name}`, NOX_COLOR, '⚒');
    }));

    this.subs.add(this.quests.claim$.subscribe(c => {
      this.push(
        `Quest complete: ${c.quest.title}`,
        RARITIES[c.quest.rarity].color,
        '✦',
      );
    }));

    this.subs.add(this.economy.milestone$.subscribe(m => {
      this.push(`${formatCurrency(m.clicks)} strikes — +${m.bonus} Gold`, '#ff6dd7', '🔨');
    }));
  }

  private push(text: string, color: string, glyph: string): void {
    this.feed = [{ key: this.seq++, text, color, glyph }, ...this.feed].slice(0, FEED_CAP);
    this.cdr.markForCheck();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The wandering trader
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Every so often somebody turns up with an offer, and leaves if ignored.
   *
   * The payout is a minute of the visitor's own income rather than a flat
   * number, with a floor for a forge that has none yet. A flat bonus is either
   * meaningless at the top of the ladder or unbalancing at the bottom, and
   * scaling it means the trader stays worth clicking for exactly as long as the
   * forge stays worth watching.
   */
  private scheduleTrader(): void {
    if (!this.isBrowser) return;
    const delay = TRADER_MIN_MS + Math.random() * (TRADER_MAX_MS - TRADER_MIN_MS);

    this.zone.runOutsideAngular(() => {
      this.traderTimer = setTimeout(() => {
        this.zone.run(() => {
          this.traderGold = Math.max(50, Math.round(this.snap.perSecond * 60));
          this.cdr.markForCheck();
        });

        this.traderExpiry = setTimeout(() => {
          this.zone.run(() => {
            // Only clear if the visitor did not take it — taking it already
            // zeroed this and scheduled the next one.
            if (this.traderGold > 0) {
              this.traderGold = 0;
              this.cdr.markForCheck();
              this.scheduleTrader();
            }
          });
        }, TRADER_STAY_MS);
      }, delay);
    });
  }

  takeTrade(): void {
    if (this.traderGold <= 0) return;
    const amount = this.traderGold;
    this.traderGold = 0;
    this.clearTraderTimers();

    this.economy.earnGold(amount, 'a wandering trader');
    this.audio.coin();
    this.scheduleTrader();
  }

  private clearTraderTimers(): void {
    if (this.traderTimer !== null) { clearTimeout(this.traderTimer); this.traderTimer = null; }
    if (this.traderExpiry !== null) { clearTimeout(this.traderExpiry); this.traderExpiry = null; }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The hum
  // ───────────────────────────────────────────────────────────────────────────

  toggleHum(): void {
    if (this.humming) {
      this.audio.stopHum();
      this.humming = false;
    } else {
      this.humming = this.audio.startHum();
    }
    try {
      localStorage.setItem(HUM_KEY, this.humming ? '1' : '0');
    } catch {
      // Private mode. The choice simply will not survive the reload.
    }
  }

  /**
   * Restore the preference — as a preference, not as a sound.
   *
   * A visitor who turned the hum on last week still does not get audio on load:
   * the browser would refuse to start it outside a gesture anyway, and a page
   * that makes noise on arrival is a page people close. What is restored is the
   * button's state, so one click resumes rather than discovers.
   */
  private restoreHum(): void {
    try {
      if (localStorage.getItem(HUM_KEY) !== '1') return;
    } catch {
      return;
    }
    // Armed, not playing. The first click on the toggle starts it for real.
    this.humming = false;
  }

  // ── Template helpers ───────────────────────────────────────────────────────

  /** Stroke offset for a mission's progress ring (r = 22, circumference ≈ 138.2). */
  ringOffset(progress: number): number {
    return 138.2 * (1 - progress);
  }

  artifactHeld(a: Artifact): boolean {
    return this.snap.artifacts.includes(a.id);
  }

  trackFeed(_: number, entry: FeedEntry): number { return entry.key; }
}
