/**
 * ProService — ownership record for the $9 Godforge Pro Pack.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * This is not a licence check. Everything here is client-side, which means a
 * visitor who opens devtools can set the flag by hand and take the cosmetics
 * and the currency for free. That is a deliberate, accepted trade:
 *
 *   • The Pro Pack sells cosmetics, a multiplier and an ad-free read of a site
 *     whose tools are all free anyway. Nothing behind the flag is worth the
 *     cost of a licence server, and nothing behind it can be resold.
 *   • The alternative — validating a LemonSqueezy licence key on every load —
 *     needs a backend call the site does not otherwise make, and it would put
 *     a network dependency in front of a progression system that is otherwise
 *     entirely local and works offline.
 *
 * The honest framing is that Pro is a tip jar with rewards attached. People who
 * want to forge the flag will; people who want to support the site will pay.
 *
 * When that stops being acceptable — say a Pro-only tool ships that costs real
 * money to run — the upgrade path is: keep this service's public shape, and
 * swap `readRecord()` for a call that verifies `licenseKey` against the
 * LemonSqueezy licence API. Every consumer reads `isPro()` / `pro$`, so none of
 * them change.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IDEMPOTENCY — why the marker is written before the currency is minted
 * ─────────────────────────────────────────────────────────────────────────────
 * `activatePro()` mints 500 Gold and 50 Essence. That must happen exactly once
 * per purchase, not once per page load, and not once per visit to a success URL
 * the buyer might bookmark or refresh.
 *
 * So the settled-marker is persisted BEFORE the mint, matching the discipline
 * `EconomyService.markLevelsPaid()` documents for the same reason: if the
 * storage write throws, the buyer is short 500 Gold, which is a complaint they
 * can mail in. If the mint ran first and the marker write failed, every reload
 * of the success page would pay out again, which is a printing press.
 */
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';

/** localStorage key. Joins the other Godforge progression blobs. */
export const PRO_KEY = 'godforge-pro';

/** Gold granted once, on activation. */
export const PRO_GOLD_BONUS = 500;
/** Eclipse Essence granted once, on activation. */
export const PRO_ESSENCE_BONUS = 50;
/** Permanent XP multiplier applied to every award while Pro is active. */
export const PRO_XP_MULTIPLIER = 2;

/**
 * Cosmetics unlocked by Pro, and the variant each is equipped to on activation.
 *
 * These ids must exist in `COSMETICS` (economy.model.ts) or the grant is a
 * no-op — `grantCosmetic` validates against the catalogue rather than trusting
 * this list, so a typo here costs a cosmetic, not a corrupt equipped-slot.
 */
export const PRO_COSMETICS: ReadonlyArray<{ cosmeticId: string; variantId: string }> = [
  { cosmeticId: 'title-prefix', variantId: 'pro' },
  { cosmeticId: 'xp-bar-skin', variantId: 'golden' },
  { cosmeticId: 'achievement-frame', variantId: 'prismatic' },
];

/** What is persisted under PRO_KEY. */
interface ProRecord {
  active: boolean;
  /** ISO timestamp of activation. Display only. */
  activatedAt: string | null;
  /**
   * True once the one-time currency + cosmetic grants have been settled.
   * Separate from `active` so that re-reading a bookmarked success URL flips
   * nothing a second time.
   */
  grantsSettled: boolean;
  /** LemonSqueezy order identifier, when the redirect carried one. */
  orderId: string | null;
}

const EMPTY: ProRecord = {
  active: false,
  activatedAt: null,
  grantsSettled: false,
  orderId: null,
};

@Injectable({ providedIn: 'root' })
export class ProService {
  private readonly isBrowser: boolean;
  private record: ProRecord = { ...EMPTY };

  private readonly pro$$ = new BehaviorSubject<boolean>(false);
  /**
   * Emits the current Pro state, starting with it.
   *
   * Ad components subscribe to this rather than calling `isPro()` once in
   * ngOnInit: a visitor who buys Pro in one tab and returns to a tool page in
   * another should stop seeing ads without a reload, and the `storage` event
   * below makes that work.
   */
  readonly pro$: Observable<boolean> = this.pro$$.asObservable();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private economy: EconomyService,
    private saves: LocalSaveRegistry,
    private store: GameStateGateway,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (!this.isBrowser) return;

    this.record = this.readRecord();
    this.pro$$.next(this.record.active);

    // Cross-tab sync. Buying Pro in a checkout tab should quiet the ads in the
    // tool tab the buyer left open, without either tab reloading.
    window.addEventListener('storage', e => {
      if (e.key !== PRO_KEY) return;
      this.adoptStoredRecord();
    });

    // The same adoption, for a write this tab made itself. `storage` deliberately
    // does not fire in the tab that wrote the key, so cloud save merging the
    // entitlement in from another device — buying Pro on a desktop and then
    // opening the site on a phone — reaches this service only through here.
    this.saves.register(PRO_KEY, { rehydrate: () => this.adoptStoredRecord() });
  }

  /** Re-read the record and republish, whoever wrote it. */
  private adoptStoredRecord(): void {
    this.record = this.readRecord();
    this.pro$$.next(this.record.active);
  }

  /**
   * Whether this browser holds the Pro Pack.
   *
   * SSR returns false on purpose: the server has no localStorage, so a
   * prerendered page is always the free-tier variant. The ad slots hydrate to
   * empty a frame later for a Pro user, which is the correct direction to be
   * wrong in — a Pro user briefly sees a placeholder, rather than a free user
   * briefly seeing a Pro-only page.
   */
  isPro(): boolean {
    return this.isBrowser && this.record.active;
  }

  /** Activation timestamp, or null when not Pro. Display only. */
  activatedAt(): string | null {
    return this.record.activatedAt;
  }

  /**
   * The XP multiplier Pro contributes. 1 when not Pro, so callers can multiply
   * unconditionally rather than branching.
   */
  xpMultiplier(): number {
    return this.isPro() ? PRO_XP_MULTIPLIER : 1;
  }

  /**
   * Turn Pro on and settle the one-time grants.
   *
   * Safe to call repeatedly — the grants run only on the first call that finds
   * `grantsSettled` false. Returns true when this call was the one that
   * activated Pro, so the caller can decide whether to celebrate.
   */
  activatePro(orderId: string | null = null): boolean {
    if (!this.isBrowser) return false;

    const alreadyActive = this.record.active;
    const alreadySettled = this.record.grantsSettled;

    // Marker first, mint second — see the header comment.
    this.record = {
      active: true,
      activatedAt: this.record.activatedAt ?? new Date().toISOString(),
      grantsSettled: true,
      orderId: orderId ?? this.record.orderId,
    };
    this.writeRecord();
    this.pro$$.next(true);

    if (!alreadySettled) this.settleGrants();

    return !alreadyActive;
  }

  /**
   * Mint the welcome bundle and unlock the Pro cosmetics.
   *
   * Only ever reached from `activatePro()`, and only when the marker showed
   * the grants had not been settled.
   */
  private settleGrants(): void {
    this.economy.earnGold(PRO_GOLD_BONUS, 'pro-pack');
    this.economy.earnEssence(PRO_ESSENCE_BONUS, 'pro-pack');

    for (const { cosmeticId, variantId } of PRO_COSMETICS) {
      this.economy.grantCosmetic(cosmeticId, variantId);
    }
  }

  /**
   * Clear Pro from this browser.
   *
   * Deliberately does NOT claw back the Gold, the Essence or the cosmetics: it
   * exists for a buyer who wants a clean slate for testing, and reversing a
   * mint would have to reconcile against currency that has since been spent.
   * `grantsSettled` survives the reset so a re-activation cannot double-mint.
   */
  deactivatePro(): void {
    if (!this.isBrowser) return;
    this.record = { ...this.record, active: false };
    this.writeRecord();
    this.pro$$.next(false);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Persistence
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Read the record, tolerating both storage shapes.
   *
   * The original spec for this flag was the bare string 'true'. That shape is
   * still honoured on read so a browser that was flipped by hand — or by an
   * earlier build — keeps its Pro status; it is upgraded to the JSON record on
   * the next write.
   */
  private readRecord(): ProRecord {
    try {
      const raw = this.store.readRaw(PRO_KEY);
      if (!raw) return { ...EMPTY };

      if (raw === 'true') {
        // Legacy/manual shape. Treat the grants as already settled: there is no
        // way to tell whether they were paid, and declining to mint is the
        // conservative direction.
        return { active: true, activatedAt: null, grantsSettled: true, orderId: null };
      }

      const parsed = JSON.parse(raw) as Partial<ProRecord>;
      return {
        active: parsed.active === true,
        activatedAt: typeof parsed.activatedAt === 'string' ? parsed.activatedAt : null,
        grantsSettled: parsed.grantsSettled === true,
        orderId: typeof parsed.orderId === 'string' ? parsed.orderId : null,
      };
    } catch {
      // Corrupt JSON or storage disabled (Safari private mode throws on read).
      // A visitor who cannot be read is not Pro, which fails toward showing ads
      // rather than toward giving the pack away.
      return { ...EMPTY };
    }
  }

  private writeRecord(): void {
      this.store.write(PRO_KEY, this.record);
  }
}
