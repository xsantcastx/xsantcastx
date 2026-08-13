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
import { ExplorerService } from '../shared/explorer/explorer.service';
import { ExplorerRosterPanelComponent } from '../shared/rpg/explorer-roster-panel.component';
import {
  EXPLORER_REALMS,
  Expedition,
  ExplorerReturn,
  ExplorerState,
  MISSIONS,
  MAX_EXPLORER_SLOTS,
  MissionDefinition,
  MissionId,
  emptyExplorerState,
  formatCountdown,
  missionById,
  missionProgress,
  remainingMs,
} from '../shared/explorer/explorer.model';
import { runeById, tierOf } from '../shared/rune-forge/rune.model';
import { scrollById } from '../shared/rune-forge/lore-scroll.model';
import { RealmDefinition, RealmId, realmById } from '../shared/realms/realm.model';
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

/** A mission out, with everything the card needs already computed. */
interface ActiveMission {
  id: string;
  realm: RealmDefinition;
  mission: MissionDefinition;
  /** "4:32". */
  countdown: string;
  /** 0-1, for the ring. */
  progress: number;
  done: boolean;
}

/** The loot reveal card. Held until dismissed or replaced. */
interface Landing {
  realmName: string;
  realmColor: string;
  missionName: string;
  gold: string;
  xp: number;
  rune: { name: string; glyph: string; color: string; lore: string; tierLabel: string } | null;
  scroll: { title: string; subtitle: string; text: string; color: string } | null;
}

/** How many feed lines are kept. Older ones fall off the bottom. */
const FEED_CAP = 20;

/** A trader shows up somewhere in this window, and stays for a while. */
const TRADER_MIN_MS = 90_000;
const TRADER_MAX_MS = 240_000;
const TRADER_STAY_MS = 25_000;

/** Remembers whether the visitor wanted the hum, across visits. */
const HUM_KEY = 'godforge-forge-hum';

@Component({
  selector: 'app-forge-view',
  standalone: true,
  imports: [CommonModule, RouterLink, ForgeFlameComponent, ExplorerRosterPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forge-view.component.html',
  styleUrls: ['./forge-view.component.css'],
})
export class ForgeViewComponent implements OnInit, OnDestroy {
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);
  private readonly quests = inject(QuestService);
  private readonly explorers = inject(ExplorerService);
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
    return {
      id: e.id,
      realm: realmById(e.realm)!,
      mission: missionById(e.mission)!,
      countdown: formatCountdown(left),
      progress: missionProgress(e, now),
      done: left <= 0,
    };
  }

  pickRealm(id: RealmId): void { this.pickedRealm = id; }
  pickMission(id: MissionId): void { this.pickedMission = id; }

  get pickedRealmDef(): RealmDefinition {
    return realmById(this.pickedRealm) ?? this.realms[0];
  }

  dispatch(): void {
    if (!this.explorers.dispatch(this.pickedRealm, this.pickedMission)) return;
    const realm = this.pickedRealmDef;
    const mission = missionById(this.pickedMission);
    this.audio.strike();
    this.push(
      `Explorer sent into ${realm.name} — ${mission?.name ?? 'expedition'}`,
      realm.color,
      '🧭',
    );
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

    const haul: Landing = {
      realmName: realm?.name ?? 'the realms',
      realmColor: realm?.color ?? AETHER_COLOR,
      missionName: mission?.name ?? 'Expedition',
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
    };

    if (this.landing) this.landingQueue.push(haul);
    else this.landing = haul;

    this.push(
      `Explorer home from ${realm?.name ?? 'the realms'} — ${formatCurrency(r.reward.gold)} Gold`,
      realm?.color ?? AETHER_COLOR,
      '🧭',
    );
    if (rune) this.push(`Found the ${rune.name} rune!`, rune.color, rune.icon ?? '🜂');
    if (scroll) this.push(`Recovered a fragment: ${scroll.subtitle}`, tierOf(scroll.rarity).color, '📜');

    this.audio.century();
    this.cdr.markForCheck();
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
