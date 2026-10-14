/**
 * quests.component.ts — /world/quests, the Quest Board, as a station
 * (shared/station-ui; MapleStory journal anatomy).
 *
 *   tabs:    Ready · Bounties · Daily · Weekly · Delve · Story · Contracts
 *            (Bounties: Pim Larkin's three daily Delve bounties, shared/bounties)
 *   strip:   TODAY  [██░ 1/3 done · new in 4h]   one how-line
 *   journal: quest list | the selected quest → ONE button: Claim
 *   Details: totals, timers, each quest's story, history
 *
 * Presentation only: the claim is the same `QuestService.claim()` /
 * `NpcQuestService.claimMission()` call the cards made. The Contract Board is
 * its own component and is hosted unchanged under the Contracts tab.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { QuestBoard, QuestLogEntry, QuestService } from '../shared/quests/quest.service';
import type { Quest } from '../shared/quests/quest.model';
import { ChallengePanelComponent } from '../shared/challenges/challenge-panel.component';
import { countdownTo } from '../shared/quests/quest-drawer.component';
import { InspectButtonComponent } from '../shared/entity/inspect-button.component';
import { DelveMissionState, NpcQuestService } from '../shared/npc/npc-quest.service';
import { NPCS, type NpcId } from '../shared/npc/npc.model';
import { missionRewardLine } from '../shared/npc/delve-missions.model';
import { craftingRecipeById } from '../shared/crafting/crafting.model';
import { runeById } from '../shared/rune-forge/rune.model';
import { TranslationService } from '../translation.service';
import {
  STATION_UI,
  STATION_UI_I18N,
  type JournalRow,
  type StationReward,
  type StationTab,
} from '../shared/station-ui';
import { QUESTS_I18N } from './quests.i18n';
import { BountyService, BountyView } from '../shared/bounties/bounty.service';
import { BOUNTIES_I18N } from '../shared/bounties/bounties.i18n';
import { FRAGMENT_EVERY, bountyLine } from '../shared/bounties/bounty.model';

import { RelatedPagesComponent } from '../shared/seo/related-pages.component';
import { injectInWorldPanel } from '../shared/in-world-panel';

/** History rows are grouped under a day heading. */
interface LogDay {
  label: string;
  entries: QuestLogEntry[];
  xp: number;
}

export type BoardTab = 'ready' | 'bounties' | 'daily' | 'weekly' | 'delve' | 'epic' | 'contracts';

/** One row of the journal: an authored quest or a Delve mission, flattened. */
interface BoardEntry {
  id: string;
  name: string;
  /** The plain "what to do" sentence under the name. */
  line: string;
  ready: boolean;
  done: boolean;
  locked: boolean;
  observed: number;
  target: number;
  /** 0..1 */
  progress: number;
  reward: string;
  /** "Asked by Verrin" for a Delve mission. */
  who: string | null;
  /** The next step, for a Delve mission. */
  next: string | null;
  lore: string | null;
  unlocks: string | null;
  quest: Quest | null;
  mission: DelveMissionState | null;
  /** One of the Board Herald's bounties. */
  bounty?: BountyView | null;
}

@Component({
  selector: 'app-quests',
  standalone: true,
  imports: [RelatedPagesComponent, CommonModule, RouterLink, ChallengePanelComponent, InspectButtonComponent, ...STATION_UI],
  templateUrl: './quests.component.html',
  styleUrls: ['./quests.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestsComponent implements OnInit, OnDestroy {
  private readonly quests = inject(QuestService);
  private readonly npc = inject(NpcQuestService);
  private readonly bountyService = inject(BountyService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Hosted as the Verdant Quest Board: no page heading, no links that leave /play. */
  protected readonly inWorld = injectInWorldPanel();

  private readonly subs = new Subscription();
  private ticker: ReturnType<typeof setInterval> | null = null;

  board: QuestBoard = this.quests.board;
  missions: DelveMissionState[] = [];
  bounties: BountyView[] = [];
  dailyCountdown = '—';
  weeklyCountdown = '—';
  history: LogDay[] = [];
  detailsOpen = false;

  /** Null until the visitor picks: then the default tab is Ready when it has rows. */
  private chosenTab: BoardTab | null = null;
  tab: BoardTab = 'daily';
  tabs: StationTab[] = [];
  rows: JournalRow[] = [];
  entries: BoardEntry[] = [];
  selected: BoardEntry | null = null;
  private selectedId: string | null = null;

  todayDone = 0;
  todayLabel = '';
  /** The TODAY strip's bar: the daily quests, or (Bounties tab) today's bounties claimed. */
  todayProgress = 0;
  reward: StationReward | null = null;
  private rewardSeq = 0;
  announce = '';

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(QUESTS_I18N);
    this.i18n.register(BOUNTIES_I18N);
    this.rebuild();
  }

  ngOnInit(): void {
    this.quests.init();

    this.subs.add(this.quests.board$.subscribe(b => {
      this.board = b;
      this.history = groupLog(b.log, this.t('quests.history.today'), this.t('quests.history.yesterday'));
      this.recount();
      this.rebuild();
      this.cdr.markForCheck();
    }));

    if (this.isBrowser) {
      this.npc.init();
      this.subs.add(this.npc.missions$.subscribe(all => {
        this.missions = all;
        this.rebuild();
        this.cdr.markForCheck();
      }));
      this.subs.add(this.bountyService.views$.subscribe(views => {
        this.bounties = views;
        this.rebuild();
        this.cdr.markForCheck();
      }));
      this.bountyService.refresh();
      this.recount();
      this.rebuild();
      // A minute is enough on a page you read — the drawer ticks every second
      // because it is glanced at, this one is not.
      this.ticker = setInterval(() => {
        // The board turns over at midnight; a reach bounty's frontier moves without an event.
        this.bountyService.refresh();
        this.recount();
        this.rebuild();
        this.cdr.markForCheck();
      }, 60_000);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.ticker) clearInterval(this.ticker);
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  get epicCleared(): number {
    return this.board.epic.filter(q => q.claimed).length;
  }

  setTab(id: string): void {
    this.chosenTab = id as BoardTab;
    this.selectedId = null;
    this.rebuild();
  }

  pick(id: string): void {
    this.selectedId = id;
    this.selected = this.entries.find(e => e.id === id) ?? null;
  }

  /** The ONE action. Same service calls the old cards made. */
  claim(): void {
    const entry = this.selected;
    if (!entry || !entry.ready) return;
    let caption = entry.reward;
    if (entry.bounty) {
      const paid = this.bountyService.claim(entry.bounty.bounty.id);
      if (!paid) return;
      caption = [this.t('bounty.reward', { gold: paid.gold.toLocaleString('en-US'), xp: paid.xp }),
        ...paid.gifts.map(id => this.t(id === 'broken-astral-compass' ? 'bounty.giftCompass' : 'bounty.giftFragment'))].join(' · ');
    } else {
      const ok = entry.quest ? this.quests.claim(entry.quest.id) : this.npc.claimMission(entry.mission!.mission.id);
      if (!ok) return;
    }
    this.reward = {
      seq: ++this.rewardSeq,
      name: entry.name,
      kicker: this.t('quests.claimedKicker'),
      caption,
    };
    this.announce = `${this.t('quests.claimedKicker')}: ${entry.name}, ${entry.reward}`;
    // Stay on the row so the player sees it turn to Done; the services push
    // the new board and rebuild() refreshes the entry.
    this.rebuild();
    this.cdr.markForCheck();
  }

  dismissReward(): void { this.reward = null; }

  /** The button's "why not" sentence, or null when it can claim. */
  blockedReason(entry: BoardEntry): string | null {
    if (entry.ready) return null;
    if (entry.done) return this.t('quests.claimedAlready');
    if (entry.locked) return entry.next ?? this.t('quests.sub.locked');
    if ((entry.mission || entry.bounty) && entry.next) return entry.next;
    return this.t('quests.notYet', { n: entry.observed, total: entry.target });
  }

  // ── Building the journal (never in the template) ─────────────────────────

  private rebuild(): void {
    const all = {
      daily: this.board.daily.map(q => this.fromQuest(q)),
      weekly: this.board.weekly.map(q => this.fromQuest(q)),
      epic: this.board.epic.map(q => this.fromQuest(q)),
      delve: this.missions.map(m => this.fromMission(m)),
      bounties: this.bounties.map(b => this.fromBounty(b)),
    };
    const ready = [...all.bounties, ...all.daily, ...all.weekly, ...all.epic, ...all.delve].filter(e => e.ready);

    this.tab = this.chosenTab ?? (ready.length ? 'ready' : 'daily');
    this.tabs = [
      { id: 'ready', label: this.t('quests.tab.ready'), badge: ready.length || null },
      { id: 'bounties', label: this.t('bounty.tab'), badge: all.bounties.filter(e => e.ready).length || null },
      { id: 'daily', label: this.t('quests.tab.daily') },
      { id: 'weekly', label: this.t('quests.tab.weekly') },
      { id: 'delve', label: this.t('quests.tab.delve'), badge: all.delve.filter(e => e.ready).length || null },
      { id: 'epic', label: this.t('quests.tab.epic') },
      { id: 'contracts', label: this.t('quests.tab.contracts') },
    ];

    this.entries = this.tab === 'ready' ? ready : this.tab === 'contracts' ? [] : all[this.tab];
    this.rows = this.entries.map(e => ({
      id: e.id,
      name: e.name,
      sub: e.ready ? this.t('quests.sub.ready')
        : e.done ? this.t('quests.sub.done')
        : e.locked ? this.t('quests.sub.locked')
        : `${e.observed}/${e.target}`,
      ready: e.ready,
      locked: e.locked || e.done,
    }));

    const keep = this.entries.find(e => e.id === this.selectedId);
    this.selected = keep
      ?? this.entries.find(e => e.ready)
      ?? this.entries.find(e => !e.done && !e.locked)
      ?? this.entries[0]
      ?? null;
    this.selectedId = this.selected?.id ?? null;

    this.todayDone = this.board.daily.filter(q => q.status === 'completed' || q.claimed).length;
    this.todayLabel = this.t('quests.todayLabel', { n: this.todayDone, total: this.board.daily.length, t: this.dailyCountdown });
    this.todayProgress = this.board.daily.length ? this.todayDone / this.board.daily.length : 0;
    if (this.tab === 'bounties' && this.bounties.length) {
      // Pim's three turn over at the local midnight, on their own clock.
      const claimed = this.bounties.filter(v => v.claimed).length;
      this.todayLabel = this.t('bounty.todayLabel', { n: claimed, total: this.bounties.length });
      this.todayProgress = claimed / this.bounties.length;
    }
  }

  private fromQuest(q: Quest): BoardEntry {
    const done = q.claimed;
    return {
      id: `q:${q.id}`,
      name: q.title,
      line: q.description,
      ready: q.status === 'completed' && !q.claimed,
      done,
      locked: false,
      observed: Math.min(q.observed, q.condition.count),
      target: q.condition.count,
      progress: q.progress / 100,
      reward: rewardLabel(q),
      who: null,
      next: null,
      lore: q.claimed && q.rewards.loreFragment ? `${q.loreText} ${q.rewards.loreFragment}` : q.loreText,
      unlocks: null,
      quest: q,
      mission: null,
    };
  }

  /** One of Pim Larkin's bounties as a journal row. */
  private fromBounty(v: BountyView): BoardEntry {
    const b = v.bounty, line = bountyLine(b);
    const vars = { ...line.vars, ...(typeof line.vars['stratum'] === 'string' ? { stratum: this.t(line.vars['stratum'] as string) } : {}) };
    const name = this.t(line.key, vars);
    return {
      id: `b:${b.id}`,
      name,
      line: name,
      ready: v.ready,
      done: v.claimed,
      locked: false,
      observed: v.observed,
      target: v.target,
      progress: v.target ? v.observed / v.target : 0,
      reward: this.t('bounty.reward', { gold: v.gold.toLocaleString('en-US'), xp: v.xp }),
      who: this.t('bounty.postedBy'),
      next: v.claimed || v.ready ? null : this.t(`bounty.next.${b.kind}`),
      lore: this.t('bounty.lore'),
      unlocks: null,
      quest: null,
      mission: null,
      bounty: v,
    };
  }

  /** Days visited, bounties claimed, and how far the next Rift Map Fragment is (Details). */
  get bountyCounts(): { days: number; total: number; toFragment: number } {
    const s = this.bountyService.state;
    // Claim days still to go until the next multiple of seven (the next claim day is claimDays + 1).
    return { days: s.days, total: s.total, toFragment: FRAGMENT_EVERY - (s.claimDays % FRAGMENT_EVERY) };
  }

  private fromMission(m: DelveMissionState): BoardEntry {
    const name = (id: NpcId) => NPCS.find(n => n.id === id)?.name ?? id;
    const giver = m.mission.alsoFrom ? `${name(m.mission.npcId)} & ${name(m.mission.alsoFrom)}` : name(m.mission.npcId);
    const r = m.mission.reward;
    const reward = missionRewardLine(
      r, m.gold,
      r.recipe ? craftingRecipeById(r.recipe)?.name : undefined,
      r.rune ? runeById(r.rune)?.name : undefined,
    );
    const title = m.mission.repeatable && m.timesDone > 0
      ? `${m.mission.title} · ${this.t('quests.filled', { n: m.timesDone })}`
      : m.mission.title;
    return {
      id: `m:${m.mission.id}`,
      name: title,
      line: m.locked ? m.nextStep : m.mission.brief,
      ready: m.turnInReady,
      done: m.claimed,
      locked: m.locked,
      observed: m.observed,
      target: m.target,
      progress: m.progress / 100,
      reward,
      who: this.t('quests.askedBy', { who: giver }),
      next: m.claimed ? null : m.nextStep,
      lore: m.claimed && r.loreFragment ? `${m.mission.loreText} ${r.loreFragment}` : m.mission.loreText,
      unlocks: m.mission.unlocks ?? null,
      quest: null,
      mission: m,
    };
  }

  private recount(): void {
    this.dailyCountdown = countdownTo(this.board.dailyResetAt);
    this.weeklyCountdown = countdownTo(this.board.weeklyResetAt);
  }
}

function rewardLabel(q: Quest): string {
  const { xp, energy } = q.rewards;
  if (energy === 'aether') return `+${xp} Aether`;
  if (energy === 'nox') return `+${xp} Nox`;
  return `+${xp} XP`;
}

/**
 * Group the log into days, newest first, and keep the last seven that have
 * anything in them. Seven *days with entries* rather than seven calendar days —
 * a week with two quiet days should still show a week of history.
 */
function groupLog(log: QuestLogEntry[], today: string, yesterday: string): LogDay[] {
  const byDay = new Map<string, QuestLogEntry[]>();

  for (const entry of log) {
    const d = new Date(entry.at);
    if (Number.isNaN(d.getTime())) continue;
    const key = dateKey(d);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(entry);
    else byDay.set(key, [entry]);
  }

  const todayKey = dateKey(new Date());
  const yesterdayKey = dateKey(new Date(Date.now() - 86_400_000));

  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .map(([key, entries]) => ({
      label: key === todayKey ? today : key === yesterdayKey ? yesterday : key,
      entries,
      xp: entries.reduce((sum, e) => sum + e.xp, 0),
    }));
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
