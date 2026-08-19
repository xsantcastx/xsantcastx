/**
 * npc-dialogue.service.ts — who is standing on this page, and what they say.
 *
 * One published value: an `NpcPresence` or null. The component renders it and
 * owns no selection logic of its own, which is what lets the whole decision be
 * tested without a DOM.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SEED, AND WHY THE LINE DOES NOT FLICKER
 * ─────────────────────────────────────────────────────────────────────────────
 * The line is drawn from a pool with a seeded hash rather than `Math.random()`.
 * That is not tidiness: this service republishes on every navigation, every XP
 * award and every quest-board change, and a random draw would swap the line
 * under the visitor mid-read several times a minute. The seed changes only when
 * the *page* changes, so a line holds for as long as you are standing there and
 * a new one is drawn when you walk somewhere else.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE NAMELESS GATE
 * ─────────────────────────────────────────────────────────────────────────────
 * `npcForPage()` never returns a hidden NPC, so the ordinary route match cannot
 * surface the Nameless by accident. The gate is checked here and only here: a
 * live combo at or past 666, or the Void rune ever found. Once either is true it
 * outranks whoever else was on the page — including on pages nobody else claims,
 * which is the point of it.
 *
 * SSR: `init()` returns early on the server and the presence stays null, so the
 * prerendered HTML carries no NPC and hydration has nothing to mismatch.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { XpService } from '../gamification/xp.service';
import { ComboService } from '../economy/combo.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { InventoryService } from '../rpg/inventory.service';
import {
  DialogueContext,
  NpcDefinition,
  NpcId,
  lineKey,
  normalisePath,
  npcForPage,
  npcById,
  pickLine,
  timeOfDayAt,
  triggersFor,
} from './npc.model';
import { NpcChainState, NpcQuestService } from './npc-quest.service';

/** The live combo at which the Nameless becomes reachable. Mirrors NAMELESS_AT. */
const NAMELESS_COMBO = 666;
/** The other way in: the Void rune, ever found. */
const NAMELESS_RUNE = 'void';

export interface NpcPresence {
  npc: NpcDefinition;
  /** The line on the bubble. */
  line: string;
  /** Its ledger id, so the component can mark it heard once it has been shown. */
  lineId: string;
  /** This NPC's chain standing, for the ! and ? indicators. */
  chain: NpcChainState;
}

@Injectable({ providedIn: 'root' })
export class NpcDialogueService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly router = inject(Router);
  private readonly xp = inject(XpService);
  private readonly combo = inject(ComboService);
  private readonly runes = inject(RuneForgeService);
  private readonly inventory = inject(InventoryService);
  private readonly chains = inject(NpcQuestService);

  private initialised = false;
  /** Bumped on navigation only. See the header on flicker. */
  private seed = '0';
  /** Ids the visitor dismissed on this page; cleared when the page changes. */
  private dismissed = new Set<NpcId>();

  private readonly presence$$ = new BehaviorSubject<NpcPresence | null>(null);
  readonly presence$: Observable<NpcPresence | null> = this.presence$$.asObservable();
  get presence(): NpcPresence | null { return this.presence$$.value; }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    this.chains.init();

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.seed = normalisePath(e.urlAfterRedirects);
        this.dismissed.clear();
        this.publish();
      });

    // The three ledgers that can change *who* is on screen or *what* they say
    // without a navigation: level and achievements (XP), the chain indicators,
    // and the combo — which is the Nameless's whole gate.
    this.xp.snapshot$.subscribe(() => this.publish());
    this.chains.chains$.subscribe(() => this.publish());
    this.combo.snapshot$.subscribe(() => this.publish());

    this.seed = normalisePath(this.router.url);
    this.publish();
  }

  /** Hide the current NPC until the visitor walks somewhere else. */
  dismiss(): void {
    const npc = this.presence?.npc;
    if (!npc) return;
    this.dismissed.add(npc.id);
    this.publish();
  }

  /** Record that the shown line has been read, so it is drawn last next time. */
  markHeard(): void {
    const p = this.presence;
    if (p) this.chains.markSeen(p.lineId);
  }

  // ───────────────────────────────────────────────────────────────────────────

  private publish(): void {
    const next = this.resolve();
    const prev = this.presence$$.value;
    // Republishing an identical presence would restart the typewriter on every
    // XP tick. Compared by the three fields that change what is on screen.
    if (prev?.npc.id === next?.npc.id
      && prev?.line === next?.line
      && prev?.chain.turnInReady === next?.chain.turnInReady
      && prev?.chain.offerReady === next?.chain.offerReady) {
      return;
    }
    this.presence$$.next(next);
  }

  private resolve(): NpcPresence | null {
    const path = normalisePath(this.router.url);

    const npc = this.namelessGateOpen()
      ? npcById('nameless') ?? null
      : npcForPage(path);
    if (!npc || this.dismissed.has(npc.id)) return null;

    const ctx = this.context(path);
    const trigger = triggersFor(npc.id, ctx)[0];
    if (!trigger) return null;

    const line = pickLine(trigger.lines, this.chains.seenLines, npc.id, this.seed);
    if (!line) return null;

    return {
      npc,
      line,
      lineId: lineKey(npc.id, line),
      chain: this.chains.chains[npc.id],
    };
  }

  private namelessGateOpen(): boolean {
    if (this.combo.snapshot.count >= NAMELESS_COMBO) return true;
    return this.runes.hasEverFound(NAMELESS_RUNE);
  }

  private context(path: string): DialogueContext {
    const snap = this.xp.snapshot;
    return {
      path,
      level: snap.level.level,
      timeOfDay: timeOfDayAt(),
      comboCount: this.combo.snapshot.count,
      achievements: new Set(this.xp.achievementIds),
      equipped: new Set(
        this.inventory.snapshot.items
          .filter(i => i.equipped && i.definitionId)
          .map(i => i.definitionId as string),
      ),
      activeQuests: this.chains.activeStepIds,
    };
  }
}
