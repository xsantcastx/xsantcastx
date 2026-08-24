/**
 * economy-wiring.service.ts — connects the ledger to everything already running.
 *
 * The same shape as XpWiringService and QuestWiringService, and for the same
 * reason: every signal the economy needs already exists somewhere in the app as
 * an observable. Tool work is the quest board's interaction beat, quest claims
 * are `QuestService.claim$`, ranks are `XpService.gain$`, and Mythic drops are
 * `EasterEggService.discovery$`. Nothing is added to 126 tool components, and
 * "using a tool" cannot come to mean one thing on the mission board and a
 * different thing in the Market — there is one beat and both read it.
 *
 * It also runs in the other direction. Three things the economy sells only
 * mean anything if a system that predates it consults the ledger:
 *   • enchantments and two artifacts multiply XP, via `XpService`'s multiplier
 *     hook — a settable function rather than an injected EconomyService, so
 *     progression does not gain a dependency on the shop;
 *   • the Codex Solarii halves lore thresholds, via `LoreService`'s scale hook;
 *   • cosmetics are painted onto `<html>` as data attributes, in the same style
 *     RealmService already publishes the active realm.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';
import { EconomyService } from './economy.service';
import {
  COSMETICS,
  ESSENCE_PER_LEVEL,
  ESSENCE_PER_MYTHIC,
  ESSENCE_PER_STREAK_WEEK,
  ESSENCE_PER_WEEKLY,
  GOLD_PER_TOOL_ACTION,
  goldForQuestXp,
  runewordQuestMultiplier,
  loreThresholdScale,
  xpMultiplier,
} from './economy.model';
import { ECONOMY_ACHIEVEMENTS } from './economy-achievements';

import { XpService } from '../gamification/xp.service';
import { QuestService } from '../quests/quest.service';
import { QuestWiringService } from '../quests/quest-wiring.service';
import { LoreService } from '../lore/lore.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { tierForEgg } from '../rarity/rarity.model';
import { ProService } from '../pro/pro.service';
import { InfusionService } from '../enchanting/infusion.service';
import { PlayerStatsService } from '../rpg/player-stats.service';
import { InventoryService } from '../rpg/inventory.service';

@Injectable({ providedIn: 'root' })
export class EconomyWiringService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);
  private readonly quests = inject(QuestService);
  private readonly questWiring = inject(QuestWiringService);
  private readonly lore = inject(LoreService);
  private readonly eggs = inject(EasterEggService);
  private readonly pro = inject(ProService);
  private readonly stats = inject(PlayerStatsService);
  private readonly inventory = inject(InventoryService);
  private readonly infusions = inject(InfusionService);

  private started = false;

  /**
   * Wisdom, plus every `xpBonus` on a worn item, plus any XP infusion running
   * at the Enchanting Table, as one multiplier.
   *
   * Both are authored as percentages and both add before the multiply, so 20
   * points of Wisdom (+60%) and a Legendary rolling +25% pay ×1.85 rather than
   * ×1.6 × ×1.25 — the same "bonuses add, the sum becomes one multiplier" rule
   * `totalBonus` uses for Runewords, for the same reason: it is what the copy on
   * the panel promises.
   */
  private rpgXpMultiplier(): number {
    const fromWisdom = this.stats.xpMultiplier - 1;
    const fromGear = this.inventory.equippedTotals.xpBonus / 100;
    // Moonpetal and Prism land here rather than in `xpMultiplier` for the same
    // reason Wisdom does: that function reads the economy blob, and the infusion
    // ledger is a different blob with a clock of its own. Added to the same sum
    // so the three compose as "+60% and +25% and +15% pay ×2", which is what
    // every card involved promises.
    const fromInfusion = this.infusions.bonusOn('xp') / 100;
    const total = 1 + fromWisdom + fromGear + fromInfusion;
    return Number.isFinite(total) && total > 1 ? total : 1;
  }

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.economy.init();
    this.installHooks();

    // Hydrate progression before reading a rank off it. This service is
    // initialised ahead of XpWiringService precisely so the multiplier is in
    // place before the first award of the page — which means XpService has not
    // been touched yet, and `snapshot` would still be the empty level-1 state.
    // `init()` is idempotent, so the call XpWiringService makes next is a no-op.
    this.xp.init();

    this.settleBackPay();
    this.mirrorProgression();
    this.paintCosmetics();

    // The streak and the rank both move through progression, not through the
    // ledger, and the ledger now multiplies by both. Re-mirroring on every XP
    // award is cheap — each setter returns immediately when the value has not
    // changed — and it is the only way the streak bonus is correct on the day
    // it rolls over rather than on the next reload.
    this.xp.snapshot$.subscribe(() => this.mirrorProgression());

    // ── Gold in ─────────────────────────────────────────────────────────────

    // One interaction beat on a tool page. The beat is coalesced to one per six
    // seconds per tool upstream, which is what stops a slider drag from paying
    // four hundred times.
    this.questWiring.beat$.subscribe(() => {
      this.economy.earnGold(GOLD_PER_TOOL_ACTION, 'tool');
    });

    // A claimed quest. Gold is derived from the XP the quest already pays
    // rather than authored a second time — see `goldForQuestXp`.
    this.quests.claim$.subscribe(({ quest }) => {
      const base = goldForQuestXp(quest.rewards.xp);
      // The Relic of the Third Dawn doubles quest rewards. It doubles the XP
      // through the multiplier hook, so it has to double the Gold here or the
      // artifact would only be half true.
      const doubled = this.economy.ownsArtifact('relic-third-dawn') ? base * 2 : base;
      // Shadow Step and Godforge Mastery both raise quest Gold specifically.
      // Applied here for the same reason the Relic is: the quest payout is
      // authored in this subscriber, so a multiplier that is not applied here
      // is not applied at all.
      const worded = doubled * runewordQuestMultiplier(this.economy.economy);
      this.economy.earnGold(worded, 'quest');

      if (quest.type === 'weekly') {
        this.economy.earnEssence(ESSENCE_PER_WEEKLY, 'weekly quest');
      }
    });

    // ── Essence in ──────────────────────────────────────────────────────────

    // A new rank. `gain$` reports the rank held *after* the award, and a single
    // large payout can cross two, so the difference against what has been paid
    // for is what settles — not one flat award per level-up event.
    this.xp.gain$.pipe(filter(g => g.levelUp)).subscribe(g => {
      this.payLevels(g.level.level);
    });

    // Mythic and Singular only. The ladder below them pays XP, which is what
    // the ladder below them is for.
    this.eggs.discovery$.pipe(filter(d => !!d && d.isNew)).subscribe(d => {
      const tier = tierForEgg(d!.egg.id, d!.egg.rarity);
      if (tier === 'mythic' || tier === 'singular') {
        this.economy.earnEssence(ESSENCE_PER_MYTHIC, 'mythic');
      }
    });

    // ── Achievements out ────────────────────────────────────────────────────

    this.economy.purchase$.subscribe(() => this.checkAchievements());
    this.economy.milestone$.subscribe(() => this.checkAchievements());
    this.economy.snapshot$.subscribe(() => this.checkAchievements());
    // A snapshot lands on init, so the first check has already run by here —
    // this catches the state a returning visitor arrives holding.
    this.checkAchievements();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Hooks into the systems that predate the economy
  // ───────────────────────────────────────────────────────────────────────────

  private installHooks(): void {
    // Enchantments, the Mirrorblade, the Relic and the Fragment all land here.
    this.xp.setMultiplierSource(ctx => {
      const e = this.economy.economy;
      const snap = this.xp.snapshot;
      // "Whichever energy you have less of" — resolved against lifetime totals
      // at the moment of the award, so the blade keeps pointing at whichever
      // realm the visitor has been neglecting rather than at a fixed one.
      const weaker = ctx.energy === (snap.aether <= snap.nox ? 'aether' : 'nox');
      // The Pro Pack's permanent 2x composes here rather than in its own call
      // to `setMultiplierSource`. That method replaces the source instead of
      // composing with it (see its doc comment), so a second caller would have
      // silently deleted the enchantments, the Mirrorblade, the Relic and the
      // Fragment — a bug that only shows up as "my artifacts stopped working"
      // for the subset of visitors who paid.
      // Wisdom and equipped `xpBonus` compose here for the same reason the Pro
      // Pack does, and it is worth restating because this is now the third
      // system to land in this one expression: `setMultiplierSource` REPLACES
      // its source. An RPG wiring layer that called it again would have
      // silently deleted the enchantments, the Mirrorblade, the Relic, the
      // Fragment and Pro — presenting as "my artifacts stopped working" for
      // every visitor with a stat point spent.
      return xpMultiplier(e, Date.now(), {
        questReward: ctx.type === 'quest',
        weakerEnergy: weaker,
      }) * this.pro.xpMultiplier() * this.rpgXpMultiplier();
    });

    // The Codex Solarii.
    this.lore.setThresholdScale(() => loreThresholdScale(this.economy.economy));

    // Repaint whenever a cosmetic is bought or swapped.
    this.economy.snapshot$.subscribe(() => this.paintCosmetics());
  }

  /**
   * Pay for ranks and streak weeks reached before the economy could watch them.
   *
   * Both are settled against a counter rather than an event, because both can
   * be crossed while nothing is subscribed: `XpService.init()` settles the daily
   * streak during its own hydration, long before this service is constructed,
   * and a visitor who reached Convergent last month was never going to receive
   * an event for it. Comparing the state against what has been paid for is the
   * only version of this that is correct on the second page load.
   */
  private settleBackPay(): void {
    this.payLevels(this.xp.snapshot.level.level);
    this.payStreakWeeks(this.xp.snapshot.streak);
  }

  /**
   * Copy the two progression numbers the Gold rate depends on into the ledger.
   *
   * The direction matters. `EconomyService` does not inject `XpService`, and it
   * must not: the ledger has to be able to price eight hours of offline time
   * from its own persisted blob on the first frame after a reload, before
   * progression has come back from its async store. So the values are pushed
   * in, and the streak is persisted alongside the Gold it multiplies.
   */
  private mirrorProgression(): void {
    const snap = this.xp.snapshot;
    this.economy.setStreakDays(snap.streak);
    this.economy.setRankLevel(snap.level.level);
  }

  private payLevels(level: number): void {
    const owed = level - this.economy.levelsPaid;
    if (owed <= 0) return;
    this.economy.markLevelsPaid(level);
    this.economy.earnEssence(owed * ESSENCE_PER_LEVEL, 'rank');
  }

  private payStreakWeeks(streak: number): void {
    const weeks = Math.floor(streak / 7);
    const owed = weeks - this.economy.streakWeeksPaid;
    if (owed <= 0) return;
    this.economy.markStreakWeeksPaid(weeks);
    this.economy.earnEssence(owed * ESSENCE_PER_STREAK_WEEK, 'streak');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cosmetics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Write the equipped cosmetics onto `<html>` as `data-cos-*` attributes, and
   * remove the ones that are not worn.
   *
   * Attributes rather than classes so the CSS can key on the *variant* —
   * `[data-cos-theme="umbral"]` is one selector where a class would need one
   * per combination — and on the root rather than the body so a cosmetic can
   * reach the fixed layers that sit outside `<app-root>`.
   */
  private paintCosmetics(): void {
    if (!this.isBrowser) return;
    const root = document.documentElement;

    for (const cosmetic of COSMETICS) {
      const attr = `data-cos-${cosmetic.slot}`;
      const worn = this.economy.ownsCosmetic(cosmetic.id)
        ? this.economy.equippedIn(cosmetic.slot)
        : null;
      if (worn) root.setAttribute(attr, worn);
      else root.removeAttribute(attr);
    }

    // The title prefix is a string the XP bar renders, not a style — published
    // as a CSS custom property so a purely presentational consumer (the `::before`
    // on the rank chip) can read it without a second binding.
    const prefixSlot = COSMETICS.find(c => c.slot === 'prefix');
    const prefixId = prefixSlot && this.economy.ownsCosmetic(prefixSlot.id)
      ? this.economy.equippedIn('prefix')
      : null;
    const label = prefixSlot?.variants.find(v => v.id === prefixId)?.label;
    if (label) root.style.setProperty('--cos-title-prefix', `"${label} "`);
    else root.style.removeProperty('--cos-title-prefix');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Achievements
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Test every economy achievement against the current ledger.
   *
   * Cheap enough to run on every snapshot: eight predicates over numbers the
   * snapshot already carries, and `EasterEggService.trigger()` is a no-op on an
   * id that is already found, so a condition that stays true forever fires
   * exactly once and then costs a set lookup.
   */
  private checkAchievements(): void {
    for (const a of ECONOMY_ACHIEVEMENTS) {
      if (this.eggs.isFound(a.id)) continue;
      if (a.met(this.economy)) void this.eggs.trigger(a.id);
    }
  }

}
